/**
 * Effective-dated history service for public.employee_history.
 *
 * Phase 2 (Task 2.7) per E5.2 Employee Masterfile + Customer Setup.
 *
 * Owns the write + read path for the `employee_history` table created by
 * Migration 3 (`create_employee_history.sql`). The table captures the value
 * of engine-load-bearing fields as at a point in time, so a 2018 valuation
 * sees the 2018 state of the employee, not today's state.
 *
 * Operations:
 *
 *   - `appendHistorySegment(supabase, args)` — closes the currently-open
 *     segment (effective_to IS NULL) for an employee by setting its
 *     `effective_to` to the new segment's `effectiveFrom`, then INSERTs a
 *     new open segment with the supplied changes. v1 issues these as two
 *     PostgREST calls rather than one DB function (RPC) — see PR body for
 *     the RPC-vs-PostgREST decision. The DB-side EXCLUDE GIST constraint
 *     (`employee_history_no_overlap`) is the safety net: concurrent writes
 *     race-condition into a 23P01, which we translate to `history_overlap`.
 *
 *   - `getHistory(supabase, employeeId, asOf?)` — returns segments in
 *     ascending `effective_from` order. If `asOf` is supplied, the segments
 *     are filtered application-side to the single segment whose
 *     `[effective_from, effective_to)` interval contains that date — this
 *     mirrors the Postgres `daterange(..., '[)')` semantics.
 *
 *   - `getCurrentSegment(supabase, employeeId)` — convenience read for the
 *     open segment (effective_to IS NULL). Returns `not_found` when no open
 *     segment exists, which is a legitimate state during initial-record
 *     bootstrapping before the first append.
 *
 * RLS is the security boundary — every entry point takes a session-bound
 * `SupabaseClient` (from `createSupabaseServerClient`). The service-role
 * client is NEVER used here; the route handlers in Phase 3 enforce that.
 *
 * Refs:
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §4.3, §6 (AC-EMP-5)
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §1.4
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-tasks.md §Task 2.7
 *   - website/supabase/migrations/20260531171530_create_employee_history.sql
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { err, ok, type Result } from './types';

// ─── Domain types ────────────────────────────────────────────────────────────

/**
 * The engine-load-bearing fields whose value-at-a-date matters. Setting any
 * of these on `employees` SHOULD be paired with an `appendHistorySegment`
 * call from Task 2.6's `updateEmployee` so the historical value is preserved.
 *
 * Mirrors the column list on `public.employee_history` (Migration 3) minus
 * audit columns + `change_reason`.
 */
export interface EffectiveDatedFields {
  employment_type?: 'full_time' | 'part_time' | 'casual' | 'salaried' | 'hourly';
  pay_frequency?: 'weekly' | 'fortnightly' | 'monthly' | 'four_weekly';
  classification?: string | null;
  hours_per_week?: number | null;
  default_work_jurisdiction?: 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
}

/**
 * Returned row shape from `appendHistorySegment` / `getHistory` /
 * `getCurrentSegment`. Mirrors the `employee_history` column list verbatim.
 *
 * Nullable fields use `T | null` (DB-storage shape) rather than `T | undefined`
 * because PostgREST returns explicit `null` for absent values; this keeps the
 * boundary contract tidy.
 */
export interface HistorySegment {
  id: string;
  employee_id: string;
  org_id: string;
  effective_from: string;
  effective_to: string | null;
  employment_type: EffectiveDatedFields['employment_type'] | null;
  pay_frequency: EffectiveDatedFields['pay_frequency'] | null;
  classification: string | null;
  hours_per_week: number | null;
  default_work_jurisdiction: EffectiveDatedFields['default_work_jurisdiction'] | null;
  change_reason: string | null;
  created_at: string;
  created_by: string;
}

/**
 * Argument shape for `appendHistorySegment`. Bundled in a single object
 * rather than positional args because the function takes 6+ inputs and
 * call-site readability matters.
 */
export interface AppendHistoryArgs {
  /** uuid — must be a real employee row owned by `orgId`. */
  employeeId: string;
  /** uuid — denormalised onto `employee_history` rows for RLS performance. */
  orgId: string;
  /** ISO date (YYYY-MM-DD). Start of the new segment; the prior open segment's `effective_to` is set to this value. */
  effectiveFrom: string;
  /** Effective-dated field values for the NEW segment. Must contain ≥ 1 key. */
  changes: EffectiveDatedFields;
  /** uuid — populated into `created_by` on the new segment row. */
  userId: string;
  /** Optional free-text audit note. */
  changeReason?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'casual', 'salaried', 'hourly'] as const;
const PAY_FREQUENCIES = ['weekly', 'fortnightly', 'monthly', 'four_weekly'] as const;
const JURISDICTIONS = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;

/**
 * Column list selected by every read path. Centralised so the shape stays in
 * sync with `HistorySegment` above; a column rename here without a type
 * change above would mis-shape at runtime.
 */
const SEGMENT_COLUMNS =
  'id, employee_id, org_id, effective_from, effective_to, employment_type, pay_frequency, classification, hours_per_week, default_work_jurisdiction, change_reason, created_at, created_by';

// ─── Pure validation ─────────────────────────────────────────────────────────

/**
 * Strict ISO date validation — narrow shape + real-calendar-date round-trip
 * (so `2024-02-30` is rejected rather than silently normalised). Lifted from
 * the `opening-balance.ts` validator pattern.
 */
function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

/**
 * Validate the changes payload. Each field is independently validated;
 * the function returns the first failure with a `field` set to the offending
 * column name (matching the masterfile column name, NOT an engine name).
 */
function validateChanges(changes: EffectiveDatedFields): Result<EffectiveDatedFields> {
  const keys = Object.keys(changes);
  if (keys.length === 0) {
    return err('validation_failed', 'changes must include at least one effective-dated field', {
      field: 'changes',
    });
  }

  if (changes.employment_type !== undefined) {
    if (!EMPLOYMENT_TYPES.includes(changes.employment_type)) {
      return err(
        'invalid_employment_type',
        `employment_type must be one of ${EMPLOYMENT_TYPES.join('/')}`,
        { field: 'employment_type' },
      );
    }
  }
  if (changes.pay_frequency !== undefined) {
    if (!PAY_FREQUENCIES.includes(changes.pay_frequency)) {
      return err(
        'invalid_pay_frequency',
        `pay_frequency must be one of ${PAY_FREQUENCIES.join('/')}`,
        { field: 'pay_frequency' },
      );
    }
  }
  if (changes.default_work_jurisdiction !== undefined) {
    if (!JURISDICTIONS.includes(changes.default_work_jurisdiction)) {
      return err(
        'invalid_jurisdiction',
        `default_work_jurisdiction must be one of ${JURISDICTIONS.join('/')}`,
        { field: 'default_work_jurisdiction' },
      );
    }
  }
  if (changes.hours_per_week !== undefined && changes.hours_per_week !== null) {
    if (typeof changes.hours_per_week !== 'number' || !Number.isFinite(changes.hours_per_week)) {
      return err('validation_failed', 'hours_per_week must be a finite number', {
        field: 'hours_per_week',
      });
    }
    if (changes.hours_per_week < 0) {
      return err('validation_failed', 'hours_per_week must be non-negative', {
        field: 'hours_per_week',
      });
    }
    // numeric(5,2) → up to 999.99. Mirror the DB constraint so the failure
    // surfaces at parse time rather than at insert time.
    if (changes.hours_per_week > 999.99) {
      return err('validation_failed', 'hours_per_week must be ≤ 999.99', {
        field: 'hours_per_week',
      });
    }
  }
  return ok(changes);
}

// ─── PostgREST error translation ─────────────────────────────────────────────

/**
 * Translate a PostgREST/PostgreSQL error to a structured `ServiceError`. The
 * codes surfaced here are the ones the EXCLUDE/UNIQUE/RLS layers can produce
 * for this table; anything else falls through to `db_error`.
 */
function translatePostgrestError(pgError: { code?: string; message: string }): ReturnType<typeof err> {
  switch (pgError.code) {
    case '23P01':
      // exclusion_violation — the EXCLUDE GIST constraint
      // (employee_history_no_overlap) fired. Surface to the caller as a
      // distinct kind so route handlers (Phase 3) can map to HTTP 409.
      return err('history_overlap', pgError.message, { detail: pgError });
    case '42501':
      return err('rls_denied', pgError.message);
    case '23514':
      // CHECK violation — should have been caught at the validator. Re-route
      // to validation_failed so the caller sees a 4xx rather than a 5xx.
      return err('validation_failed', pgError.message, { detail: pgError });
    case 'PGRST116':
      return err('not_found', pgError.message);
    default:
      return err('db_error', pgError.message, { detail: pgError });
  }
}

// ─── appendHistorySegment ────────────────────────────────────────────────────

/**
 * Append a new effective-dated segment for an employee. Implements the
 * 4-step pattern from impl-plan §1.4:
 *
 *   1. Read the current open segment (effective_to IS NULL).
 *   2. UPDATE that segment: set effective_to = effectiveFrom (close it).
 *   3. INSERT a new open segment with effective_from = effectiveFrom.
 *   4. (Caller — Task 2.6 `updateEmployee`) UPDATE the employees row.
 *
 * Step 4 is the caller's responsibility. This service owns steps 1–3.
 *
 * v1 implementation note (RPC-vs-PostgREST):
 * Steps 2 + 3 are two separate PostgREST round-trips, not one DB function.
 * A concurrent writer racing between them would either:
 *   (a) Encounter the DB-side EXCLUDE GIST constraint and surface `23P01`,
 *       which we translate to `history_overlap` — the caller retries.
 *   (b) Leave a brief window where the new segment exists but the parent
 *       `employees` row hasn't been updated yet. RLS limits read visibility
 *       to org members; the window is bounded by the duration of one
 *       round-trip. We log this in the spec's RE-N risk register.
 * Phase 1 is closed for migrations, so an RPC `update_employee_with_history`
 * would require a separate Phase 1 amendment — see PR body recommendation.
 */
export async function appendHistorySegment(
  supabase: SupabaseClient,
  args: AppendHistoryArgs,
): Promise<Result<HistorySegment>> {
  // ── Input validation ────────────────────────────────────────────────────
  if (!UUID_REGEX.test(args.employeeId)) {
    return err('validation_failed', 'employee_id must be a uuid', { field: 'employee_id' });
  }
  if (!UUID_REGEX.test(args.orgId)) {
    return err('validation_failed', 'org_id must be a uuid', { field: 'org_id' });
  }
  if (!UUID_REGEX.test(args.userId)) {
    return err('validation_failed', 'user_id must be a uuid', { field: 'user_id' });
  }
  if (!isValidIsoDate(args.effectiveFrom)) {
    return err('validation_failed', 'effective_from must be a real ISO date (YYYY-MM-DD)', {
      field: 'effective_from',
    });
  }
  const changesValidation = validateChanges(args.changes);
  if (!changesValidation.ok) {
    return changesValidation;
  }

  // ── Step 1: read the current open segment ──────────────────────────────
  const { data: openSegment, error: readError } = await supabase
    .from('employee_history')
    .select('id, effective_from')
    .eq('employee_id', args.employeeId)
    .is('effective_to', null)
    .maybeSingle();

  if (readError) {
    return translatePostgrestError(readError);
  }

  // ── Step 2: close the open segment (if any) ────────────────────────────
  if (openSegment !== null && openSegment !== undefined) {
    const segment = openSegment as { id: string; effective_from: string };
    // Sanity: the new effective_from must be strictly after the open
    // segment's effective_from. Otherwise the EXCLUDE constraint will fire
    // anyway, but we'd rather catch it pre-write with a clearer error.
    if (args.effectiveFrom <= segment.effective_from) {
      return err(
        'validation_failed',
        `effective_from (${args.effectiveFrom}) must be strictly after the current open segment's effective_from (${segment.effective_from})`,
        { field: 'effective_from' },
      );
    }
    const { error: closeError } = await supabase
      .from('employee_history')
      .update({ effective_to: args.effectiveFrom })
      .eq('id', segment.id)
      .select('id')
      .maybeSingle();

    if (closeError) {
      return translatePostgrestError(closeError);
    }
  }

  // ── Step 3: insert the new open segment ────────────────────────────────
  const insertRow: Record<string, unknown> = {
    employee_id: args.employeeId,
    org_id: args.orgId,
    effective_from: args.effectiveFrom,
    effective_to: null,
    created_by: args.userId,
  };
  if (args.changes.employment_type !== undefined) {
    insertRow.employment_type = args.changes.employment_type;
  }
  if (args.changes.pay_frequency !== undefined) {
    insertRow.pay_frequency = args.changes.pay_frequency;
  }
  if (args.changes.classification !== undefined) {
    insertRow.classification = args.changes.classification;
  }
  if (args.changes.hours_per_week !== undefined) {
    insertRow.hours_per_week = args.changes.hours_per_week;
  }
  if (args.changes.default_work_jurisdiction !== undefined) {
    insertRow.default_work_jurisdiction = args.changes.default_work_jurisdiction;
  }
  if (args.changeReason !== undefined) {
    insertRow.change_reason = args.changeReason;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('employee_history')
    .insert(insertRow)
    .select(SEGMENT_COLUMNS)
    .single();

  if (insertError) {
    return translatePostgrestError(insertError);
  }
  if (inserted === null || inserted === undefined) {
    return err('db_error', 'insert returned no row');
  }

  return ok(inserted as unknown as HistorySegment);
}

// ─── getHistory ──────────────────────────────────────────────────────────────

/**
 * Read all segments for an employee, ordered ascending by `effective_from`.
 * If `asOf` is supplied, returns only the segment whose
 * `[effective_from, effective_to)` interval contains that date — at most one
 * segment per Postgres EXCLUDE constraint, so the array length is 0 or 1.
 *
 * Application-side filtering is preferred over `daterange @>` in the SQL
 * because PostgREST does not expose `daterange` operators natively and the
 * per-employee row count is bounded (history segments are coarse — most
 * employees will have ≤ 10 over their tenure).
 */
export async function getHistory(
  supabase: SupabaseClient,
  employeeId: string,
  asOf?: string,
): Promise<Result<HistorySegment[]>> {
  if (!UUID_REGEX.test(employeeId)) {
    return err('validation_failed', 'employee_id must be a uuid', { field: 'employee_id' });
  }
  if (asOf !== undefined && !isValidIsoDate(asOf)) {
    return err('validation_failed', 'as_of must be a real ISO date (YYYY-MM-DD)', {
      field: 'as_of',
    });
  }

  const { data, error } = await supabase
    .from('employee_history')
    .select(SEGMENT_COLUMNS)
    .eq('employee_id', employeeId)
    .order('effective_from', { ascending: true });

  if (error) {
    return translatePostgrestError(error);
  }
  const rows = (data ?? []) as unknown as HistorySegment[];
  if (asOf === undefined) {
    return ok(rows);
  }
  const matching = rows.filter((row) => containsDate(row, asOf));
  return ok(matching);
}

/**
 * `[effective_from, effective_to)` containment — inclusive lower, exclusive
 * upper. Open segments (`effective_to === null`) extend to +infinity. String
 * comparison works here because ISO `YYYY-MM-DD` is lexicographically
 * ordered the same as chronologically.
 */
function containsDate(segment: HistorySegment, date: string): boolean {
  if (date < segment.effective_from) return false;
  if (segment.effective_to === null) return true;
  return date < segment.effective_to;
}

// ─── getCurrentSegment ───────────────────────────────────────────────────────

/**
 * Read the open segment (effective_to IS NULL) for an employee. Returns
 * `not_found` when no open segment exists — this is the legitimate state
 * for a brand-new employee row before the first `appendHistorySegment`.
 */
export async function getCurrentSegment(
  supabase: SupabaseClient,
  employeeId: string,
): Promise<Result<HistorySegment>> {
  if (!UUID_REGEX.test(employeeId)) {
    return err('validation_failed', 'employee_id must be a uuid', { field: 'employee_id' });
  }

  const { data, error } = await supabase
    .from('employee_history')
    .select(SEGMENT_COLUMNS)
    .eq('employee_id', employeeId)
    .is('effective_to', null)
    .maybeSingle();

  if (error) {
    return translatePostgrestError(error);
  }
  if (data === null || data === undefined) {
    return err('not_found', `no open segment for employee ${employeeId}`);
  }
  return ok(data as unknown as HistorySegment);
}
