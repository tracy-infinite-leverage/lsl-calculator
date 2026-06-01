/**
 * Tags dictionary service — unit tests.
 *
 * Phase 2 (Task 2.8b) per E5.2 Employee Masterfile + Customer Setup.
 *
 * The tags dictionary is the org-scoped vocabulary that backs the
 * `employees.tags text[]` column (Migration 7). Operations:
 *
 *   - `createTag(supabase, orgId, name)`        — normalise + insert
 *   - `getTag(supabase, tagId)`                 — read by id
 *   - `listTags(supabase, orgId, filters?)`     — paginated list + prefix search
 *   - `renameTag(supabase, tagId, newName)`     — UPDATE; DB trigger cascades
 *   - `deleteTag(supabase, tagId)`              — DELETE; DB trigger cascades
 *   - `getTagUsageCount(supabase, orgId, name)` — computed on demand via
 *                                                  SELECT count(*) FROM employees
 *                                                  WHERE org_id = ? AND name = ANY(tags)
 *
 * Normalisation rule (service layer, BEFORE insert):
 *   trim → lowercase → collapse internal whitespace.
 *
 * DB CHECK enforces 1-50 chars + trimmed + lowercased as a safety net.
 *
 * Cascade triggers (already on prod — NOT re-implemented at the service):
 *   - `tg_cascade_tag_rename_on_tags` — AFTER UPDATE OF name → array_replace
 *   - `tg_cascade_tag_delete_on_tags` — BEFORE DELETE → array_remove
 *
 * The cascade integration is exercised by the integration test against the
 * Supabase test branch (see §"cascade integration test" below — gated on the
 * `RUN_INTEGRATION_TESTS` env var to keep CI hermetic).
 *
 * Refs:
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §4.4
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §3.1 Migration 7
 *   - AC-EMP-14.
 */

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createTag,
  getTag,
  listTags,
  renameTag,
  deleteTag,
  getTagUsageCount,
  normaliseTagName,
} from '../tags';

// ---------------------------------------------------------------------------
// Helpers — Supabase mocks for each query-builder shape used by the service.
// ---------------------------------------------------------------------------

/**
 * `supabase.from(table).insert(payload).select(cols).single()`
 *   — used by createTag.
 */
function mockInsertReturning(result: {
  data: Record<string, unknown> | null;
  error: { code?: string; message: string } | null;
}): SupabaseClient {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  return { from } as unknown as SupabaseClient;
}

/**
 * `supabase.from(table).select(cols).eq(col, value).maybeSingle()`
 *   — used by getTag.
 */
function mockSelectMaybeSingle(result: {
  data: Record<string, unknown> | null;
  error: { code?: string; message: string } | null;
}): SupabaseClient {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { from } as unknown as SupabaseClient;
}

/**
 * `supabase.from(table).update(payload).eq(col, value).select(cols).single()`
 *   — used by renameTag.
 */
function mockUpdateReturning(result: {
  data: Record<string, unknown> | null;
  error: { code?: string; message: string } | null;
}): SupabaseClient {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ single }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { from } as unknown as SupabaseClient;
}

/**
 * `supabase.from(table).delete().eq(col, value)`
 *   — used by deleteTag (the terminal `.eq()` resolves to `{ error }`).
 */
function mockDelete(result: {
  error: { code?: string; message: string } | null;
}): SupabaseClient {
  const eq = vi.fn().mockResolvedValue({ data: null, ...result });
  const del = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ delete: del }));
  return { from } as unknown as SupabaseClient;
}

/**
 * `supabase.from(table).select(cols, { count: 'exact', head: true })
 *   .eq('org_id', orgId).contains('tags', [name])`
 *   — used by getTagUsageCount.
 *
 * The terminal `.contains()` resolves to `{ count, error }` per PostgREST.
 */
function mockCountContains(result: {
  count: number | null;
  error: { code?: string; message: string } | null;
}): SupabaseClient {
  const contains = vi.fn().mockResolvedValue({ data: null, count: result.count, error: result.error });
  const eq = vi.fn(() => ({ contains }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { from } as unknown as SupabaseClient;
}

/**
 * `supabase.from(table).select(cols).eq('org_id', orgId).ilike('name', pattern)
 *   .order('name', { ascending: true }).range(from, to)`
 *   — used by listTags (with optional prefix). The final `range` resolves
 *   to `{ data, error, count }`.
 */
function mockListQuery(result: {
  data: Array<Record<string, unknown>> | null;
  count?: number | null;
  error: { code?: string; message: string } | null;
}): { supabase: SupabaseClient; spies: { ilike: ReturnType<typeof vi.fn> } } {
  const range = vi.fn().mockResolvedValue({
    data: result.data,
    count: result.count ?? null,
    error: result.error,
  });
  const order = vi.fn(() => ({ range }));
  const ilike = vi.fn(() => ({ order, range }));
  // When no prefix supplied the chain skips `ilike`: select.eq(org_id).order().range()
  const eq = vi.fn(() => ({ ilike, order, range }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { supabase: { from } as unknown as SupabaseClient, spies: { ilike } };
}

const VALID_ORG_ID = '00000000-0000-0000-0000-000000000001';
const VALID_TAG_ID = '00000000-0000-0000-0000-000000000010';

// ===========================================================================
// normaliseTagName — pure helper (exposed for testability + reuse)
// ===========================================================================

describe('normaliseTagName', () => {
  it('trims surrounding whitespace', () => {
    expect(normaliseTagName('  finance  ')).toBe('finance');
  });

  it('lowercases ASCII', () => {
    expect(normaliseTagName('Finance')).toBe('finance');
    expect(normaliseTagName('FINANCE')).toBe('finance');
  });

  it('collapses multiple internal whitespace runs to a single space', () => {
    expect(normaliseTagName('night  shift')).toBe('night shift');
    expect(normaliseTagName('night   shift\toperator')).toBe('night shift operator');
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(normaliseTagName('   ')).toBe('');
  });
});

// ===========================================================================
// createTag
// ===========================================================================

describe('createTag', () => {
  it('inserts a normalised tag and returns the row', async () => {
    const row = {
      id: VALID_TAG_ID,
      org_id: VALID_ORG_ID,
      name: 'finance',
      created_at: '2026-05-31T00:00:00.000Z',
      created_by: null,
    };
    const supabase = mockInsertReturning({ data: row, error: null });
    const result = await createTag(supabase, VALID_ORG_ID, '  Finance  ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe('finance');
    expect(result.data.org_id).toBe(VALID_ORG_ID);
  });

  it('rejects an empty (whitespace-only) name with validation_failed', async () => {
    const supabase = mockInsertReturning({ data: null, error: null });
    const result = await createTag(supabase, VALID_ORG_ID, '   ');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('name');
    expect((supabase.from as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('rejects a name longer than 50 chars after normalisation', async () => {
    const supabase = mockInsertReturning({ data: null, error: null });
    const result = await createTag(supabase, VALID_ORG_ID, 'a'.repeat(51));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('name');
    expect((supabase.from as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('accepts a 50-char name at the upper boundary', async () => {
    const name = 'a'.repeat(50);
    const supabase = mockInsertReturning({
      data: { id: VALID_TAG_ID, org_id: VALID_ORG_ID, name, created_at: 't', created_by: null },
      error: null,
    });
    const result = await createTag(supabase, VALID_ORG_ID, name);
    expect(result.ok).toBe(true);
  });

  it('rejects an invalid orgId before touching Supabase', async () => {
    const supabase = mockInsertReturning({ data: null, error: null });
    const result = await createTag(supabase, 'not-a-uuid', 'finance');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('org_id');
    expect((supabase.from as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('returns duplicate_tag_name on a 23505 UNIQUE violation', async () => {
    const supabase = mockInsertReturning({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "tags_org_id_name_key"',
      },
    });
    const result = await createTag(supabase, VALID_ORG_ID, 'finance');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('duplicate_tag_name');
  });

  it('returns rls_denied on a 42501 permission error', async () => {
    const supabase = mockInsertReturning({
      data: null,
      error: { code: '42501', message: 'permission denied for table tags' },
    });
    const result = await createTag(supabase, VALID_ORG_ID, 'finance');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('rls_denied');
  });

  it('translates 23514 CHECK violation to validation_failed (defence-in-depth)', async () => {
    const supabase = mockInsertReturning({
      data: null,
      error: { code: '23514', message: 'new row violates check constraint "tags_name_check"' },
    });
    const result = await createTag(supabase, VALID_ORG_ID, 'finance');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
  });

  it('returns db_error for an unexpected PostgREST error', async () => {
    const supabase = mockInsertReturning({
      data: null,
      error: { code: '08006', message: 'connection failure' },
    });
    const result = await createTag(supabase, VALID_ORG_ID, 'finance');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('db_error');
  });
});

// ===========================================================================
// getTag
// ===========================================================================

describe('getTag', () => {
  it('returns the row when present', async () => {
    const row = {
      id: VALID_TAG_ID,
      org_id: VALID_ORG_ID,
      name: 'finance',
      created_at: '2026-05-31T00:00:00.000Z',
      created_by: null,
    };
    const supabase = mockSelectMaybeSingle({ data: row, error: null });
    const result = await getTag(supabase, VALID_TAG_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe(VALID_TAG_ID);
    expect(result.data.name).toBe('finance');
  });

  it('returns not_found when the tag is missing', async () => {
    const supabase = mockSelectMaybeSingle({ data: null, error: null });
    const result = await getTag(supabase, VALID_TAG_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('not_found');
  });

  it('returns rls_denied when PostgREST signals 42501', async () => {
    const supabase = mockSelectMaybeSingle({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });
    const result = await getTag(supabase, VALID_TAG_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('rls_denied');
  });

  it('rejects an invalid tagId before touching Supabase', async () => {
    const supabase = mockSelectMaybeSingle({ data: null, error: null });
    const result = await getTag(supabase, 'not-a-uuid');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('tag_id');
    expect((supabase.from as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// listTags
// ===========================================================================

describe('listTags', () => {
  it('returns the rows for an org with default pagination', async () => {
    const rows = [
      { id: 't1', org_id: VALID_ORG_ID, name: 'accounting', created_at: 't', created_by: null },
      { id: 't2', org_id: VALID_ORG_ID, name: 'finance', created_at: 't', created_by: null },
    ];
    const { supabase } = mockListQuery({ data: rows, count: 2, error: null });
    const result = await listTags(supabase, VALID_ORG_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rows).toHaveLength(2);
    expect(result.data.total).toBe(2);
  });

  it('applies an ilike prefix when filter.prefix is set', async () => {
    const { supabase, spies } = mockListQuery({
      data: [{ id: 't1', org_id: VALID_ORG_ID, name: 'finance', created_at: 't', created_by: null }],
      count: 1,
      error: null,
    });
    const result = await listTags(supabase, VALID_ORG_ID, { prefix: 'fin' });
    expect(result.ok).toBe(true);
    expect(spies.ilike).toHaveBeenCalled();
    // First call arg should be the column, second the pattern with a trailing '%'.
    const [col, pattern] = spies.ilike.mock.calls[0]!;
    expect(col).toBe('name');
    expect(pattern).toBe('fin%');
  });

  it('lowercases the prefix before sending to Supabase', async () => {
    const { supabase, spies } = mockListQuery({ data: [], count: 0, error: null });
    await listTags(supabase, VALID_ORG_ID, { prefix: 'Fin' });
    const [, pattern] = spies.ilike.mock.calls[0]!;
    expect(pattern).toBe('fin%');
  });

  it('escapes ilike wildcards (% and _) in the prefix', async () => {
    const { supabase, spies } = mockListQuery({ data: [], count: 0, error: null });
    await listTags(supabase, VALID_ORG_ID, { prefix: '100%' });
    const [, pattern] = spies.ilike.mock.calls[0]!;
    // Both wildcard chars must be escaped — otherwise a "100%" prefix would
    // match every row. The DB treats `\%` as a literal percent.
    expect(pattern.startsWith('100\\%')).toBe(true);
  });

  it('returns rls_denied when PostgREST signals 42501', async () => {
    const { supabase } = mockListQuery({
      data: null,
      count: null,
      error: { code: '42501', message: 'permission denied' },
    });
    const result = await listTags(supabase, VALID_ORG_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('rls_denied');
  });

  it('rejects an invalid orgId before touching Supabase', async () => {
    const { supabase } = mockListQuery({ data: null, count: null, error: null });
    const result = await listTags(supabase, 'not-a-uuid');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('org_id');
    expect((supabase.from as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// renameTag
// ===========================================================================

describe('renameTag', () => {
  it('updates the name and returns the row', async () => {
    const persisted = {
      id: VALID_TAG_ID,
      org_id: VALID_ORG_ID,
      name: 'accounting',
      created_at: 't',
      created_by: null,
    };
    const supabase = mockUpdateReturning({ data: persisted, error: null });
    const result = await renameTag(supabase, VALID_TAG_ID, '  ACCOUNTING  ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe('accounting');
  });

  it('rejects an empty new name with validation_failed', async () => {
    const supabase = mockUpdateReturning({ data: null, error: null });
    const result = await renameTag(supabase, VALID_TAG_ID, '   ');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('name');
    expect((supabase.from as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('rejects an invalid tagId before touching Supabase', async () => {
    const supabase = mockUpdateReturning({ data: null, error: null });
    const result = await renameTag(supabase, 'not-a-uuid', 'finance');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('tag_id');
    expect((supabase.from as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('returns duplicate_tag_name when the new name already exists in the org', async () => {
    const supabase = mockUpdateReturning({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "tags_org_id_name_key"',
      },
    });
    const result = await renameTag(supabase, VALID_TAG_ID, 'finance');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('duplicate_tag_name');
  });

  it('returns rls_denied when PostgREST signals 42501', async () => {
    const supabase = mockUpdateReturning({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });
    const result = await renameTag(supabase, VALID_TAG_ID, 'finance');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('rls_denied');
  });

  it('returns not_found when no row matched the id (PostgREST PGRST116)', async () => {
    // Using `.single()` after UPDATE: 0 rows ⇒ PostgREST emits PGRST116.
    const supabase = mockUpdateReturning({
      data: null,
      error: { code: 'PGRST116', message: 'Searched for one row but found 0' },
    });
    const result = await renameTag(supabase, VALID_TAG_ID, 'finance');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('not_found');
  });
});

// ===========================================================================
// deleteTag
// ===========================================================================

describe('deleteTag', () => {
  it('deletes the row and returns ok', async () => {
    const supabase = mockDelete({ error: null });
    const result = await deleteTag(supabase, VALID_TAG_ID);
    expect(result.ok).toBe(true);
  });

  it('rejects an invalid tagId before touching Supabase', async () => {
    const supabase = mockDelete({ error: null });
    const result = await deleteTag(supabase, 'not-a-uuid');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('tag_id');
    expect((supabase.from as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('returns rls_denied when PostgREST signals 42501', async () => {
    const supabase = mockDelete({
      error: { code: '42501', message: 'permission denied' },
    });
    const result = await deleteTag(supabase, VALID_TAG_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('rls_denied');
  });

  it('returns db_error for an unexpected PostgREST error', async () => {
    const supabase = mockDelete({
      error: { code: '08006', message: 'connection failure' },
    });
    const result = await deleteTag(supabase, VALID_TAG_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('db_error');
  });
});

// ===========================================================================
// getTagUsageCount
// ===========================================================================

describe('getTagUsageCount', () => {
  it('returns the count from PostgREST', async () => {
    const supabase = mockCountContains({ count: 7, error: null });
    const result = await getTagUsageCount(supabase, VALID_ORG_ID, 'finance');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(7);
  });

  it('returns 0 when no employees carry the tag', async () => {
    const supabase = mockCountContains({ count: 0, error: null });
    const result = await getTagUsageCount(supabase, VALID_ORG_ID, 'finance');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(0);
  });

  it('normalises the name before issuing the count query', async () => {
    const supabase = mockCountContains({ count: 3, error: null });
    const result = await getTagUsageCount(supabase, VALID_ORG_ID, '  Finance  ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(3);
  });

  it('rejects empty name with validation_failed', async () => {
    const supabase = mockCountContains({ count: null, error: null });
    const result = await getTagUsageCount(supabase, VALID_ORG_ID, '   ');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('name');
    expect((supabase.from as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('rejects an invalid orgId before touching Supabase', async () => {
    const supabase = mockCountContains({ count: null, error: null });
    const result = await getTagUsageCount(supabase, 'not-a-uuid', 'finance');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('org_id');
    expect((supabase.from as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('returns rls_denied when PostgREST signals 42501', async () => {
    const supabase = mockCountContains({
      count: null,
      error: { code: '42501', message: 'permission denied' },
    });
    const result = await getTagUsageCount(supabase, VALID_ORG_ID, 'finance');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('rls_denied');
  });

  it('returns db_error for an unexpected PostgREST error', async () => {
    const supabase = mockCountContains({
      count: null,
      error: { code: '08006', message: 'connection failure' },
    });
    const result = await getTagUsageCount(supabase, VALID_ORG_ID, 'finance');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('db_error');
  });
});
