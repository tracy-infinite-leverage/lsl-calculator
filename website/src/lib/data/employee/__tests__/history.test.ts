/**
 * Effective-dated history service — unit tests (Task 2.7).
 *
 * Phase 2 (Task 2.7) per E5.2 Employee Masterfile + Customer Setup.
 *
 * Covers spec §4.3 (employee_history) and AC-EMP-5 (editing an effective-dated
 * field on an employee creates an employee_history row capturing the prior
 * value and the effective date of the change).
 *
 * Operations under test:
 *
 *   - `appendHistorySegment(supabase, args)` — close the currently-open segment
 *     for an employee and INSERT a new open segment in the same logical write.
 *     v1 uses two PostgREST calls (UPDATE then INSERT) rather than an RPC to
 *     keep DB surface area in Phase 1 only — see PR body for the
 *     RPC-vs-PostgREST recommendation. The EXCLUDE GIST constraint
 *     (`employee_history_no_overlap`) is the DB-side safety net — if the two
 *     calls race against a concurrent write, the INSERT step fails with
 *     `23P01` and we surface `history_overlap` so the caller can retry.
 *
 *   - `getHistory(supabase, employeeId, asOf?)` — list all segments for an
 *     employee. With `asOf`, returns the single segment whose
 *     `[effective_from, effective_to)` interval contains the date.
 *
 *   - `getCurrentSegment(supabase, employeeId)` — convenience for the open
 *     segment (effective_to IS NULL). Returns `not_found` if there is none.
 *
 * Test strategy:
 *   - Mocked Supabase client — same surface pattern as `org-setup.test.ts`.
 *   - Pure-function coverage for shape / validation pre-checks.
 *   - PostgREST error-code translation (`23P01` → `history_overlap`,
 *     `42501` → `rls_denied`, `08006` → `db_error`).
 *
 * Refs:
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §4.3, §6 (AC-EMP-5)
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §1.4
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-tasks.md §Task 2.7
 *   - website/supabase/migrations/20260531171530_create_employee_history.sql
 */

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  appendHistorySegment,
  getHistory,
  getCurrentSegment,
  type HistorySegment,
  type EffectiveDatedFields,
} from '../history';

// ---------------------------------------------------------------------------
// Mock helpers — chained PostgREST query builders. Mirrors the shape used
// in org-setup.test.ts. We never spin up real Postgres here; integration
// coverage for the EXCLUDE constraint lives in Phase 3 against a Supabase
// branch fixture.
// ---------------------------------------------------------------------------

interface PgResult<T> {
  data: T | null;
  error: { code?: string; message: string } | null;
}

/**
 * Mock for the "find current open segment" read path:
 *   from(table).select(cols).eq('employee_id', id).is('effective_to', null).maybeSingle()
 */
function mockSelectMaybeSingle(result: PgResult<Record<string, unknown>>): SupabaseClient {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const isFn = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ is: isFn, maybeSingle }));
  const order = vi.fn(() => ({ eq }));
  const select = vi.fn(() => ({ eq, order }));
  const from = vi.fn(() => ({ select }));
  return { from } as unknown as SupabaseClient;
}

/**
 * Mock for the "list all segments" read path:
 *   from(table).select(cols).eq('employee_id', id).order('effective_from', { ascending: true })
 *
 * Terminal — returns the rows array directly. PostgREST treats `.order()` as
 * the last builder call when no `.single()` / `.maybeSingle()` follows.
 */
function mockSelectMany(result: PgResult<Record<string, unknown>[]>): SupabaseClient {
  // The terminal awaited shape is `{ data, error }`. We model this by making
  // `order()` itself a thenable.
  const orderResult = Promise.resolve(result);
  const order = vi.fn(() => orderResult);
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { from } as unknown as SupabaseClient;
}

/**
 * Sequenced builder mock — appendHistorySegment issues three calls in order:
 *   (1) SELECT current open segment
 *   (2) UPDATE open segment → set effective_to
 *   (3) INSERT new open segment
 *
 * Each invocation of `.from()` returns the next-stage builder according to the
 * fixed sequence supplied in `stages`.
 */
function mockAppendSequence(stages: {
  /** Stage 1: read current open segment. `null` = no prior segment yet. */
  readOpen: PgResult<Record<string, unknown> | null>;
  /** Stage 2: UPDATE the open segment (only invoked if readOpen returned a row). */
  closeOpen?: PgResult<Record<string, unknown>>;
  /** Stage 3: INSERT the new open segment. */
  insertNew: PgResult<Record<string, unknown>>;
}): SupabaseClient {
  let call = 0;
  const fromFn = vi.fn(() => {
    call += 1;
    if (call === 1) {
      // SELECT … .eq(employee_id, id).is(effective_to, null).maybeSingle()
      const maybeSingle = vi.fn().mockResolvedValue(stages.readOpen);
      const isFn = vi.fn(() => ({ maybeSingle }));
      const eq = vi.fn(() => ({ is: isFn, maybeSingle }));
      const select = vi.fn(() => ({ eq }));
      return { select };
    }
    if (call === 2 && stages.closeOpen) {
      // UPDATE … .eq('id', segmentId).select(cols).maybeSingle()
      const maybeSingle = vi.fn().mockResolvedValue(stages.closeOpen);
      const select = vi.fn(() => ({ maybeSingle }));
      const eq = vi.fn(() => ({ select }));
      const update = vi.fn(() => ({ eq }));
      return { update };
    }
    // INSERT … .insert(row).select(cols).single()
    const single = vi.fn().mockResolvedValue(stages.insertNew);
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    return { insert };
  });
  return { from: fromFn } as unknown as SupabaseClient;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = '33333333-3333-3333-3333-333333333333';
const PRIOR_SEGMENT_ID = '44444444-4444-4444-4444-444444444444';
const NEW_SEGMENT_ID = '55555555-5555-5555-5555-555555555555';

const PRIOR_OPEN_SEGMENT: Record<string, unknown> = {
  id: PRIOR_SEGMENT_ID,
  employee_id: EMPLOYEE_ID,
  org_id: ORG_ID,
  effective_from: '2024-01-01',
  effective_to: null,
  employment_type: 'full_time',
  pay_frequency: 'fortnightly',
  classification: 'Award Level 4',
  hours_per_week: 38,
  default_work_jurisdiction: 'NSW',
  change_reason: null,
  created_at: '2024-01-01T00:00:00Z',
  created_by: USER_ID,
};

const VALID_CHANGES: EffectiveDatedFields = {
  employment_type: 'part_time',
  hours_per_week: 20,
};

// ===========================================================================
// appendHistorySegment — input validation
// ===========================================================================

describe('appendHistorySegment — input validation', () => {
  it('rejects an invalid employee_id (not a uuid)', async () => {
    const supabase = mockAppendSequence({
      readOpen: { data: null, error: null },
      insertNew: { data: null, error: null },
    });
    const result = await appendHistorySegment(supabase, {
      employeeId: 'not-a-uuid',
      orgId: ORG_ID,
      effectiveFrom: '2026-01-01',
      changes: VALID_CHANGES,
      userId: USER_ID,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('employee_id');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('rejects an invalid org_id (not a uuid)', async () => {
    const supabase = mockAppendSequence({
      readOpen: { data: null, error: null },
      insertNew: { data: null, error: null },
    });
    const result = await appendHistorySegment(supabase, {
      employeeId: EMPLOYEE_ID,
      orgId: 'not-a-uuid',
      effectiveFrom: '2026-01-01',
      changes: VALID_CHANGES,
      userId: USER_ID,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('org_id');
  });

  it('rejects an invalid user_id (not a uuid)', async () => {
    const supabase = mockAppendSequence({
      readOpen: { data: null, error: null },
      insertNew: { data: null, error: null },
    });
    const result = await appendHistorySegment(supabase, {
      employeeId: EMPLOYEE_ID,
      orgId: ORG_ID,
      effectiveFrom: '2026-01-01',
      changes: VALID_CHANGES,
      userId: 'not-a-uuid',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('user_id');
  });

  it('rejects when effectiveFrom is not an ISO date', async () => {
    const supabase = mockAppendSequence({
      readOpen: { data: null, error: null },
      insertNew: { data: null, error: null },
    });
    const result = await appendHistorySegment(supabase, {
      employeeId: EMPLOYEE_ID,
      orgId: ORG_ID,
      effectiveFrom: '01/01/2026',
      changes: VALID_CHANGES,
      userId: USER_ID,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('effective_from');
  });

  it('rejects when effectiveFrom is not a real calendar date (2024-02-30)', async () => {
    const supabase = mockAppendSequence({
      readOpen: { data: null, error: null },
      insertNew: { data: null, error: null },
    });
    const result = await appendHistorySegment(supabase, {
      employeeId: EMPLOYEE_ID,
      orgId: ORG_ID,
      effectiveFrom: '2024-02-30',
      changes: VALID_CHANGES,
      userId: USER_ID,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('effective_from');
  });

  it('rejects when changes is an empty object (no effective-dated field changed)', async () => {
    const supabase = mockAppendSequence({
      readOpen: { data: null, error: null },
      insertNew: { data: null, error: null },
    });
    const result = await appendHistorySegment(supabase, {
      employeeId: EMPLOYEE_ID,
      orgId: ORG_ID,
      effectiveFrom: '2026-01-01',
      changes: {},
      userId: USER_ID,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('changes');
  });

  it('rejects an invalid employment_type', async () => {
    const supabase = mockAppendSequence({
      readOpen: { data: null, error: null },
      insertNew: { data: null, error: null },
    });
    const result = await appendHistorySegment(supabase, {
      employeeId: EMPLOYEE_ID,
      orgId: ORG_ID,
      effectiveFrom: '2026-01-01',
      changes: { employment_type: 'contractor' as never },
      userId: USER_ID,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('invalid_employment_type');
    expect(result.error.field).toBe('employment_type');
  });

  it('rejects an invalid pay_frequency', async () => {
    const supabase = mockAppendSequence({
      readOpen: { data: null, error: null },
      insertNew: { data: null, error: null },
    });
    const result = await appendHistorySegment(supabase, {
      employeeId: EMPLOYEE_ID,
      orgId: ORG_ID,
      effectiveFrom: '2026-01-01',
      changes: { pay_frequency: 'biweekly' as never },
      userId: USER_ID,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('invalid_pay_frequency');
  });

  it('rejects an invalid jurisdiction', async () => {
    const supabase = mockAppendSequence({
      readOpen: { data: null, error: null },
      insertNew: { data: null, error: null },
    });
    const result = await appendHistorySegment(supabase, {
      employeeId: EMPLOYEE_ID,
      orgId: ORG_ID,
      effectiveFrom: '2026-01-01',
      changes: { default_work_jurisdiction: 'XYZ' as never },
      userId: USER_ID,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('invalid_jurisdiction');
  });

  it('rejects hours_per_week that is not finite', async () => {
    const supabase = mockAppendSequence({
      readOpen: { data: null, error: null },
      insertNew: { data: null, error: null },
    });
    const result = await appendHistorySegment(supabase, {
      employeeId: EMPLOYEE_ID,
      orgId: ORG_ID,
      effectiveFrom: '2026-01-01',
      changes: { hours_per_week: Number.POSITIVE_INFINITY },
      userId: USER_ID,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('hours_per_week');
  });

  it('rejects negative hours_per_week', async () => {
    const supabase = mockAppendSequence({
      readOpen: { data: null, error: null },
      insertNew: { data: null, error: null },
    });
    const result = await appendHistorySegment(supabase, {
      employeeId: EMPLOYEE_ID,
      orgId: ORG_ID,
      effectiveFrom: '2026-01-01',
      changes: { hours_per_week: -5 },
      userId: USER_ID,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
  });
});

// ===========================================================================
// appendHistorySegment — happy path
// ===========================================================================

describe('appendHistorySegment — happy path', () => {
  it('closes the open segment AND inserts a new open segment in a single call', async () => {
    const newSegment: Record<string, unknown> = {
      ...PRIOR_OPEN_SEGMENT,
      id: NEW_SEGMENT_ID,
      employment_type: 'part_time',
      hours_per_week: 20,
      effective_from: '2026-01-01',
      effective_to: null,
      change_reason: 'Switched to part-time',
    };

    const supabase = mockAppendSequence({
      readOpen: { data: PRIOR_OPEN_SEGMENT, error: null },
      closeOpen: {
        data: { ...PRIOR_OPEN_SEGMENT, effective_to: '2026-01-01' },
        error: null,
      },
      insertNew: { data: newSegment, error: null },
    });

    const result = await appendHistorySegment(supabase, {
      employeeId: EMPLOYEE_ID,
      orgId: ORG_ID,
      effectiveFrom: '2026-01-01',
      changes: { employment_type: 'part_time', hours_per_week: 20 },
      userId: USER_ID,
      changeReason: 'Switched to part-time',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe(NEW_SEGMENT_ID);
    expect(result.data.effective_from).toBe('2026-01-01');
    expect(result.data.effective_to).toBeNull();
    expect(result.data.employment_type).toBe('part_time');
  });

  it('inserts the first segment when no prior open segment exists', async () => {
    const newSegment: Record<string, unknown> = {
      id: NEW_SEGMENT_ID,
      employee_id: EMPLOYEE_ID,
      org_id: ORG_ID,
      effective_from: '2024-01-01',
      effective_to: null,
      employment_type: 'full_time',
      pay_frequency: 'fortnightly',
      classification: null,
      hours_per_week: 38,
      default_work_jurisdiction: 'NSW',
      change_reason: 'Initial record',
      created_at: '2024-01-01T00:00:00Z',
      created_by: USER_ID,
    };

    const supabase = mockAppendSequence({
      readOpen: { data: null, error: null },
      insertNew: { data: newSegment, error: null },
    });

    const result = await appendHistorySegment(supabase, {
      employeeId: EMPLOYEE_ID,
      orgId: ORG_ID,
      effectiveFrom: '2024-01-01',
      changes: {
        employment_type: 'full_time',
        pay_frequency: 'fortnightly',
        hours_per_week: 38,
        default_work_jurisdiction: 'NSW',
      },
      userId: USER_ID,
      changeReason: 'Initial record',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.effective_from).toBe('2024-01-01');
    expect(result.data.effective_to).toBeNull();
  });
});

// ===========================================================================
// appendHistorySegment — error translation
// ===========================================================================

describe('appendHistorySegment — error translation', () => {
  it('translates 23P01 (exclusion violation) to history_overlap on INSERT', async () => {
    const supabase = mockAppendSequence({
      readOpen: { data: PRIOR_OPEN_SEGMENT, error: null },
      closeOpen: {
        data: { ...PRIOR_OPEN_SEGMENT, effective_to: '2026-01-01' },
        error: null,
      },
      insertNew: {
        data: null,
        error: {
          code: '23P01',
          message: 'conflicting key value violates exclusion constraint "employee_history_no_overlap"',
        },
      },
    });

    const result = await appendHistorySegment(supabase, {
      employeeId: EMPLOYEE_ID,
      orgId: ORG_ID,
      effectiveFrom: '2026-01-01',
      changes: VALID_CHANGES,
      userId: USER_ID,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('history_overlap');
  });

  it('translates 42501 (RLS denied) on the SELECT step', async () => {
    const supabase = mockAppendSequence({
      readOpen: { data: null, error: { code: '42501', message: 'permission denied' } },
      insertNew: { data: null, error: null },
    });

    const result = await appendHistorySegment(supabase, {
      employeeId: EMPLOYEE_ID,
      orgId: ORG_ID,
      effectiveFrom: '2026-01-01',
      changes: VALID_CHANGES,
      userId: USER_ID,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('rls_denied');
  });

  it('translates 42501 (RLS denied) on the INSERT step', async () => {
    const supabase = mockAppendSequence({
      readOpen: { data: null, error: null },
      insertNew: { data: null, error: { code: '42501', message: 'permission denied' } },
    });

    const result = await appendHistorySegment(supabase, {
      employeeId: EMPLOYEE_ID,
      orgId: ORG_ID,
      effectiveFrom: '2026-01-01',
      changes: VALID_CHANGES,
      userId: USER_ID,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('rls_denied');
  });

  it('translates 23514 (CHECK constraint) to validation_failed', async () => {
    const supabase = mockAppendSequence({
      readOpen: { data: null, error: null },
      insertNew: {
        data: null,
        error: { code: '23514', message: 'check constraint violation' },
      },
    });

    const result = await appendHistorySegment(supabase, {
      employeeId: EMPLOYEE_ID,
      orgId: ORG_ID,
      effectiveFrom: '2026-01-01',
      changes: VALID_CHANGES,
      userId: USER_ID,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
  });

  it('translates an unknown error to db_error', async () => {
    const supabase = mockAppendSequence({
      readOpen: { data: null, error: { code: '08006', message: 'connection failure' } },
      insertNew: { data: null, error: null },
    });

    const result = await appendHistorySegment(supabase, {
      employeeId: EMPLOYEE_ID,
      orgId: ORG_ID,
      effectiveFrom: '2026-01-01',
      changes: VALID_CHANGES,
      userId: USER_ID,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('db_error');
  });
});

// ===========================================================================
// getHistory
// ===========================================================================

describe('getHistory', () => {
  it('returns all segments for an employee in ascending effective_from order', async () => {
    const rows = [
      { ...PRIOR_OPEN_SEGMENT, effective_to: '2026-01-01' },
      {
        ...PRIOR_OPEN_SEGMENT,
        id: NEW_SEGMENT_ID,
        effective_from: '2026-01-01',
        effective_to: null,
        employment_type: 'part_time',
        hours_per_week: 20,
      },
    ];

    const supabase = mockSelectMany({ data: rows, error: null });
    const result = await getHistory(supabase, EMPLOYEE_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0]!.effective_from).toBe('2024-01-01');
    expect(result.data[1]!.employment_type).toBe('part_time');
  });

  it('returns an empty array when the employee has no history rows', async () => {
    const supabase = mockSelectMany({ data: [], error: null });
    const result = await getHistory(supabase, EMPLOYEE_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('rejects an invalid employee_id', async () => {
    const supabase = mockSelectMany({ data: [], error: null });
    const result = await getHistory(supabase, 'not-a-uuid');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('employee_id');
  });

  it('translates an RLS-denied error to rls_denied', async () => {
    const supabase = mockSelectMany({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });
    const result = await getHistory(supabase, EMPLOYEE_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('rls_denied');
  });

  it('filters to the segment containing asOf when supplied', async () => {
    const rows = [
      { ...PRIOR_OPEN_SEGMENT, effective_to: '2025-06-01' },
      {
        ...PRIOR_OPEN_SEGMENT,
        id: NEW_SEGMENT_ID,
        effective_from: '2025-06-01',
        effective_to: '2026-01-01',
      },
      {
        ...PRIOR_OPEN_SEGMENT,
        id: '66666666-6666-6666-6666-666666666666',
        effective_from: '2026-01-01',
        effective_to: null,
      },
    ];

    const supabase = mockSelectMany({ data: rows, error: null });
    const result = await getHistory(supabase, EMPLOYEE_ID, '2025-08-15');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // asOf = 2025-08-15 → middle segment [2025-06-01, 2026-01-01)
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.effective_from).toBe('2025-06-01');
  });

  it('returns the open segment for an asOf inside its window', async () => {
    const rows = [
      { ...PRIOR_OPEN_SEGMENT, effective_to: '2026-01-01' },
      {
        ...PRIOR_OPEN_SEGMENT,
        id: NEW_SEGMENT_ID,
        effective_from: '2026-01-01',
        effective_to: null,
      },
    ];
    const supabase = mockSelectMany({ data: rows, error: null });
    const result = await getHistory(supabase, EMPLOYEE_ID, '2030-12-31');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.effective_to).toBeNull();
  });

  it('returns an empty array when asOf falls outside every segment', async () => {
    const rows = [{ ...PRIOR_OPEN_SEGMENT, effective_to: '2024-06-01' }];
    const supabase = mockSelectMany({ data: rows, error: null });
    const result = await getHistory(supabase, EMPLOYEE_ID, '2020-01-01');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('rejects an invalid asOf date', async () => {
    const supabase = mockSelectMany({ data: [], error: null });
    const result = await getHistory(supabase, EMPLOYEE_ID, 'not-a-date');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('as_of');
  });
});

// ===========================================================================
// getCurrentSegment
// ===========================================================================

describe('getCurrentSegment', () => {
  it('returns the open segment when present', async () => {
    const supabase = mockSelectMaybeSingle({ data: PRIOR_OPEN_SEGMENT, error: null });
    const result = await getCurrentSegment(supabase, EMPLOYEE_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe(PRIOR_SEGMENT_ID);
    expect(result.data.effective_to).toBeNull();
  });

  it('returns not_found when no open segment exists', async () => {
    const supabase = mockSelectMaybeSingle({ data: null, error: null });
    const result = await getCurrentSegment(supabase, EMPLOYEE_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('not_found');
  });

  it('translates RLS denied', async () => {
    const supabase = mockSelectMaybeSingle({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });
    const result = await getCurrentSegment(supabase, EMPLOYEE_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('rls_denied');
  });

  it('rejects an invalid employee_id', async () => {
    const supabase = mockSelectMaybeSingle({ data: null, error: null });
    const result = await getCurrentSegment(supabase, 'not-a-uuid');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
  });
});

// ===========================================================================
// Type-shape sanity — make sure the HistorySegment fields align with the
// migration column list. This is a compile-time check; if it fails to
// compile, the test would not load.
// ===========================================================================

describe('HistorySegment shape', () => {
  it('matches the column list from create_employee_history.sql', () => {
    const seg: HistorySegment = {
      id: NEW_SEGMENT_ID,
      employee_id: EMPLOYEE_ID,
      org_id: ORG_ID,
      effective_from: '2026-01-01',
      effective_to: null,
      employment_type: 'part_time',
      pay_frequency: null,
      classification: null,
      hours_per_week: 20,
      default_work_jurisdiction: null,
      change_reason: null,
      created_at: '2026-01-01T00:00:00Z',
      created_by: USER_ID,
    };
    expect(seg.id).toBe(NEW_SEGMENT_ID);
  });
});
