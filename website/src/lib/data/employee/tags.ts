/**
 * Tags dictionary service — org-scoped vocabulary backing `employees.tags`.
 *
 * Phase 2 (Task 2.8b) per E5.2 Employee Masterfile + Customer Setup.
 *
 * The `public.tags` table holds the canonical list of tag names per org.
 * `employees.tags text[]` carries denormalised tag names for fast filtering;
 * Migration 7 added two DB triggers that keep the array in sync automatically:
 *
 *   - `tg_cascade_tag_rename_on_tags` — AFTER UPDATE OF name on `tags`
 *     propagates the rename via `array_replace(employees.tags, OLD.name, NEW.name)`.
 *   - `tg_cascade_tag_delete_on_tags` — BEFORE DELETE on `tags`
 *     strips the name from every employee via `array_remove(employees.tags, OLD.name)`.
 *
 * The service layer therefore does NOT manually update `employees.tags` from
 * a rename or delete — the DB triggers own that contract.
 *
 * Operations exposed:
 *
 *   - `createTag(supabase, orgId, name)`       — normalise + insert. UNIQUE
 *     violation on `(org_id, name)` surfaces as `duplicate_tag_name`.
 *
 *   - `getTag(supabase, tagId)`                — read by id. Missing row ⇒
 *     `not_found`.
 *
 *   - `listTags(supabase, orgId, filters?)`    — paginated list, optional
 *     case-insensitive prefix search. Wildcard chars in the prefix are
 *     escaped so a user typing `"100%"` doesn't match every row.
 *
 *   - `renameTag(supabase, tagId, newName)`    — UPDATE. DB trigger cascades
 *     to `employees.tags`.
 *
 *   - `deleteTag(supabase, tagId)`             — DELETE. DB trigger strips the
 *     name from `employees.tags`.
 *
 *   - `getTagUsageCount(supabase, orgId, name)` — count employees carrying
 *     this tag. Per Q5 there is NO `usage_count_cached` column — count is
 *     computed on demand via PostgREST `head: true, count: 'exact'` so the
 *     server returns only a HEAD response with the count header.
 *
 *   - `normaliseTagName(input)` — exposed helper. Trim → lowercase → collapse
 *     internal whitespace runs to a single space. Service-layer rule;
 *     the DB CHECK is a defence-in-depth safety net.
 *
 * Validation rules:
 *   - empty after normalisation ⇒ `validation_failed { field: 'name' }`
 *   - > 50 chars after normalisation ⇒ `validation_failed { field: 'name' }`
 *
 * Refs:
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §4.4
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §3.1 Migration 7
 *   - AC-EMP-14.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { err, ok, type Result } from './types';

// ─── Domain types ────────────────────────────────────────────────────────────

export interface Tag {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
  created_by: string | null;
}

export interface ListTagsFilters {
  /**
   * Case-insensitive prefix to match against `tags.name`. Whitespace is
   * trimmed and ASCII is lowercased before matching. SQL LIKE wildcards
   * (`%`, `_`) embedded in the user input are escaped so they match as
   * literal characters.
   */
  prefix?: string;
  /** Zero-based offset for pagination. Default 0. */
  offset?: number;
  /**
   * Maximum rows to return. Default 50; capped at 200 to bound memory on
   * unbounded admin queries.
   */
  limit?: number;
}

export interface ListTagsResult {
  rows: Tag[];
  /**
   * Total row count for the org (or for the prefix filter when supplied).
   * `null` when PostgREST didn't return a count header — defensive coverage.
   */
  total: number | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TAGS_TABLE = 'tags';
const EMPLOYEES_TABLE = 'employees';
const TAG_COLUMNS = 'id, org_id, name, created_at, created_by';

const MAX_NAME_LENGTH = 50;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * UUID v1/v4/v5 broad-shape regex. Mirrors org-setup.ts for consistency —
 * we deliberately accept any RFC-4122 shape so test fixtures using nil-style
 * IDs (`00000000-0000-0000-0000-000000000001`) round-trip cleanly; the DB
 * rejects malformed UUIDs at the column-type boundary regardless.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── normaliseTagName ────────────────────────────────────────────────────────

/**
 * Normalise a tag name BEFORE issuing a DB query.
 *
 *   trim → toLowerCase → collapse internal whitespace runs to single spaces
 *
 * The DB has matching CHECK constraints (Migration 7) — those are a safety
 * net rather than the primary validator. Centralising the rule here ensures
 * lookups (e.g. `getTagUsageCount`) match the normalisation used at insert.
 */
export function normaliseTagName(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ─── Internal validators ─────────────────────────────────────────────────────

function validateName(raw: string): Result<string> {
  if (typeof raw !== 'string') {
    return err('validation_failed', 'tag name must be a string', { field: 'name' });
  }
  const normalised = normaliseTagName(raw);
  if (normalised.length === 0) {
    return err('validation_failed', 'tag name must be 1-50 chars (not empty)', { field: 'name' });
  }
  if (normalised.length > MAX_NAME_LENGTH) {
    return err('validation_failed', `tag name must be 1-${MAX_NAME_LENGTH} chars`, { field: 'name' });
  }
  return ok(normalised);
}

function validateUuid(value: string, field: string): Result<string> {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    return err('validation_failed', `${field} must be a uuid`, { field });
  }
  return ok(value);
}

/**
 * Escape SQL LIKE / ILIKE wildcards so a user typing `"100%"` matches `100%`
 * literally rather than every row. Per PostgreSQL docs, backslash escapes
 * `%`, `_`, and itself in a LIKE pattern.
 */
function escapeLikePattern(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// ─── PostgREST error translation ─────────────────────────────────────────────

/**
 * Map PostgREST/SQLSTATE error codes the tags service cares about onto
 * canonical `ServiceError` kinds. Anything unrecognised falls through to
 * `db_error` and is logged via the `detail` payload.
 */
function translatePostgrestError(pgError: {
  code?: string;
  message: string;
}): ReturnType<typeof err> {
  switch (pgError.code) {
    case '23505':
      // unique_violation on (org_id, name).
      return err('duplicate_tag_name', pgError.message);
    case '23514':
      // check_violation — DB CHECK on `name` shape. Service-layer validator
      // should have caught it; surface as validation_failed not db_error so
      // route handlers map this to 4xx in Phase 3.
      return err('validation_failed', pgError.message, {
        field: 'name',
        detail: pgError,
      });
    case '42501':
      return err('rls_denied', pgError.message);
    case 'PGRST116':
      // PostgREST: "Searched for one row but found 0".
      return err('not_found', pgError.message);
    default:
      return err('db_error', pgError.message, { detail: pgError });
  }
}

// ─── createTag ───────────────────────────────────────────────────────────────

/**
 * Insert a normalised tag. Required guards:
 *   - `orgId` must be a UUID
 *   - normalised `name` must be 1-50 chars
 *
 * RLS policy (Migration 7): INSERT only permitted for `org_admin` /
 * `org_payroll`. The caller MUST supply a session-bound client.
 */
export async function createTag(
  supabase: SupabaseClient,
  orgId: string,
  name: string,
): Promise<Result<Tag>> {
  const orgValidation = validateUuid(orgId, 'org_id');
  if (!orgValidation.ok) return orgValidation;

  const nameValidation = validateName(name);
  if (!nameValidation.ok) return nameValidation;

  const { data, error } = await supabase
    .from(TAGS_TABLE)
    .insert({ org_id: orgId, name: nameValidation.data })
    .select(TAG_COLUMNS)
    .single();

  if (error) {
    return translatePostgrestError(error);
  }
  if (data === null) {
    return err('db_error', 'insert returned no row');
  }
  return ok(data as unknown as Tag);
}

// ─── getTag ──────────────────────────────────────────────────────────────────

export async function getTag(
  supabase: SupabaseClient,
  tagId: string,
): Promise<Result<Tag>> {
  const tagValidation = validateUuid(tagId, 'tag_id');
  if (!tagValidation.ok) return tagValidation;

  const { data, error } = await supabase
    .from(TAGS_TABLE)
    .select(TAG_COLUMNS)
    .eq('id', tagId)
    .maybeSingle();

  if (error) {
    return translatePostgrestError(error);
  }
  if (data === null) {
    return err('not_found', `tag ${tagId} not found`);
  }
  return ok(data as unknown as Tag);
}

// ─── listTags ────────────────────────────────────────────────────────────────

/**
 * Paginated list with optional case-insensitive prefix search.
 *
 * Prefix handling:
 *   - whitespace trimmed + ASCII lowercased to match insert-time normalisation
 *   - LIKE wildcards (`%`, `_`) escaped so `"100%"` matches `100%` literally
 *   - empty prefix after normalisation is treated as no filter
 *
 * The query uses PostgREST `.ilike('name', 'fin%')` which produces a
 * case-insensitive prefix scan. The DB has a btree index on `(org_id, name)`
 * (Migration 7) so an exact + prefix lookup is index-supported.
 */
export async function listTags(
  supabase: SupabaseClient,
  orgId: string,
  filters: ListTagsFilters = {},
): Promise<Result<ListTagsResult>> {
  const orgValidation = validateUuid(orgId, 'org_id');
  if (!orgValidation.ok) return orgValidation;

  const offset = Math.max(0, filters.offset ?? 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, filters.limit ?? DEFAULT_LIMIT));

  // Build the base query — separate branches keep the chain types tight and
  // mirror the mock surface in tags.test.ts.
  const baseQuery = supabase
    .from(TAGS_TABLE)
    .select(TAG_COLUMNS, { count: 'exact' })
    .eq('org_id', orgId);

  const prefix = filters.prefix !== undefined ? normaliseTagName(filters.prefix) : '';
  const filteredQuery =
    prefix.length > 0 ? baseQuery.ilike('name', `${escapeLikePattern(prefix)}%`) : baseQuery;

  const { data, count, error } = await filteredQuery
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return translatePostgrestError(error);
  }
  return ok({
    rows: (data ?? []) as unknown as Tag[],
    total: count ?? null,
  });
}

// ─── renameTag ───────────────────────────────────────────────────────────────

/**
 * Rename a tag. The DB trigger `tg_cascade_tag_rename_on_tags` propagates the
 * new name into every employee's `tags` array via `array_replace` — this
 * service does NOT touch `employees` directly.
 *
 * UPDATE policy (Migration 7): only `org_admin` and `org_payroll` for the
 * owning org. UNIQUE violation on `(org_id, name)` surfaces as
 * `duplicate_tag_name`.
 */
export async function renameTag(
  supabase: SupabaseClient,
  tagId: string,
  newName: string,
): Promise<Result<Tag>> {
  const tagValidation = validateUuid(tagId, 'tag_id');
  if (!tagValidation.ok) return tagValidation;

  const nameValidation = validateName(newName);
  if (!nameValidation.ok) return nameValidation;

  const { data, error } = await supabase
    .from(TAGS_TABLE)
    .update({ name: nameValidation.data })
    .eq('id', tagId)
    .select(TAG_COLUMNS)
    .single();

  if (error) {
    return translatePostgrestError(error);
  }
  if (data === null) {
    return err('not_found', `tag ${tagId} not found`);
  }
  return ok(data as unknown as Tag);
}

// ─── deleteTag ───────────────────────────────────────────────────────────────

/**
 * Delete a tag. The DB trigger `tg_cascade_tag_delete_on_tags` strips the
 * tag name from every employee's `tags` array via `array_remove` BEFORE the
 * row is removed — this service does NOT touch `employees` directly.
 *
 * DELETE policy (Migration 7): only `org_admin` for the owning org.
 *
 * The success shape is `Result<void>` — we don't echo the deleted row.
 */
export async function deleteTag(
  supabase: SupabaseClient,
  tagId: string,
): Promise<Result<void>> {
  const tagValidation = validateUuid(tagId, 'tag_id');
  if (!tagValidation.ok) return tagValidation;

  const { error } = await supabase.from(TAGS_TABLE).delete().eq('id', tagId);

  if (error) {
    return translatePostgrestError(error);
  }
  return ok(undefined);
}

// ─── getTagUsageCount ────────────────────────────────────────────────────────

/**
 * Count the employees in `orgId` whose `tags` array contains `name`.
 *
 * Per Q5 resolution there is NO `usage_count_cached` column — usage count
 * is computed on demand using PostgREST's HEAD count:
 *
 *   GET /rest/v1/employees?select=id&org_id=eq.{orgId}&tags=cs.{{name}}
 *     Prefer: count=exact
 *     // head: true so the response is just headers + Content-Range.
 *
 * `.contains('tags', [name])` translates to the PostgreSQL `@>` operator,
 * which is supported by the GIN index on `employees.tags` (Migration 6).
 */
export async function getTagUsageCount(
  supabase: SupabaseClient,
  orgId: string,
  name: string,
): Promise<Result<number>> {
  const orgValidation = validateUuid(orgId, 'org_id');
  if (!orgValidation.ok) return orgValidation;

  const nameValidation = validateName(name);
  if (!nameValidation.ok) return nameValidation;

  const { count, error } = await supabase
    .from(EMPLOYEES_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .contains('tags', [nameValidation.data]);

  if (error) {
    return translatePostgrestError(error);
  }
  return ok(count ?? 0);
}
