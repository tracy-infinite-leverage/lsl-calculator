/**
 * Employee CRUD service — unit tests (Task 2.6).
 *
 * Phase 2 (Task 2.6) per E5.2 Employee Masterfile + Customer Setup.
 *
 * Covers spec §4.2 (employees), §3 policy-column-driven opening-balance
 * collision resolution (amended 2026-05-31, PR #119), §6 acceptance criteria
 * AC-EMP-3 / -4 / -6 / -8 / -10 / -11 / -12 / -13.
 *
 * Operations under test:
 *   - createEmployee — INSERT with effective-dated history segment + retention.
 *   - updateEmployee — UPDATE in place; OR UPDATE + appendHistorySegment when
 *     an effective-dated field is in the patch (composes Task 2.7).
 *   - getEmployee — SELECT.
 *   - listEmployees — paginated with active / archived filter.
 *   - archiveEmployee — soft-delete (archived_at + end_date).
 *   - reactivateEmployee — clear archived_at + end_date (retention trigger
 *     clears retention_expires_at).
 *   - getOpeningBalance — scope-trim absorption from Task 2.8.
 *   - clearOpeningBalance — scope-trim absorption from Task 2.8.
 *
 * Refs:
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §4.2, §6
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §1.3, §1.4, §2
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-tasks.md §Task 2.6
 *   - AC-EMP-3, AC-EMP-4, AC-EMP-6, AC-EMP-8, AC-EMP-10, AC-EMP-11, AC-EMP-12, AC-EMP-13.
 *   - PR #119 (policy-column-driven collision resolution).
 */

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createEmployee,
  updateEmployee,
  getEmployee,
  listEmployees,
  archiveEmployee,
  reactivateEmployee,
  getOpeningBalance,
  clearOpeningBalance,
  type EmployeeRow,
  type CreateEmployeePayload,
} from '../employees';

// ---------------------------------------------------------------------------
// Helpers — Supabase mock surface. We model PostgREST as a sequence of
// per-table calls. Each call to `supabase.from(table)` yields a builder
// whose terminal call resolves to `{ data, error }`.
//
// `mockTableSequence` lets us script the per-from() builder for each call
// to from() in order. The factory under test makes calls in deterministic
// sequence (validation → policy read → check duplicate → insert → history)
// so a hand-scripted queue is sufficient.
// ---------------------------------------------------------------------------

interface PgResult<T> {
  data: T | null;
  error: { code?: string; message: string } | null;
}

type BuilderShape = Record<string, unknown>;

/**
 * Build a chainable mock from a flat result. The terminal resolution shape
 * is `{ data, error }`. Intermediate builder calls (`select`, `eq`, `in`,
 * `is`, `order`, `limit`, `range`, `single`, `maybeSingle`) all return the
 * same chained surface so call ordering doesn't matter.
 */
function buildChain(result: PgResult<unknown>): BuilderShape {
  const terminal: Promise<PgResult<unknown>> = Promise.resolve(result);
  const chain: BuilderShape = {};
  const noop = (): BuilderShape => chain;
  // Each method returns the chain itself (for further chaining) BUT also
  // resolves as a thenable so the terminal `await` lands on `result`.
  // We implement this by attaching `.then` to the chain object.
  (chain as { then: typeof terminal.then }).then = terminal.then.bind(terminal);
  for (const name of [
    'select',
    'eq',
    'neq',
    'in',
    'is',
    'or',
    'order',
    'limit',
    'range',
    'single',
    'maybeSingle',
    'gte',
    'lte',
    'not',
  ]) {
    (chain as Record<string, unknown>)[name] = vi.fn(noop);
  }
  return chain;
}

/**
 * Script the supabase.from() sequence: each entry binds (table, op) → result.
 * `op` lets the implementation specify which verb the builder is for so the
 * test reads close to the prod code.
 *
 * Implementation: each invocation of supabase.from() returns the next-stage
 * builder. The builder dispatches the verb call to a chain that resolves to
 * the scripted result.
 */
interface Stage {
  /** Optional `from(table)` assertion. */
  table?: string;
  /** Optional verb assertion (insert / update / select / delete). */
  verb?: 'insert' | 'update' | 'select' | 'delete';
  /** Scripted result for this stage. */
  result: PgResult<unknown>;
}

function mockSequence(stages: Stage[]): {
  supabase: SupabaseClient;
  calls: { from: ReturnType<typeof vi.fn>; verbs: string[] };
} {
  let i = 0;
  const verbsSeen: string[] = [];
  const from = vi.fn((tableName: string) => {
    const stage = stages[i++];
    if (!stage) {
      throw new Error(`Unexpected supabase.from(${tableName}) — no stage scripted`);
    }
    if (stage.table && stage.table !== tableName) {
      throw new Error(
        `supabase.from(${tableName}) expected ${stage.table} at stage ${i - 1}`,
      );
    }
    const chain = buildChain(stage.result);
    // Verb dispatchers wrap the chain so we record which verb the impl invoked.
    const builder: BuilderShape = {};
    for (const verb of ['insert', 'update', 'select', 'delete'] as const) {
      (builder as Record<string, unknown>)[verb] = vi.fn(() => {
        verbsSeen.push(verb);
        if (stage.verb && stage.verb !== verb) {
          throw new Error(
            `supabase.from(${tableName}).${verb}() expected ${stage.verb}() at stage ${i - 1}`,
          );
        }
        return chain;
      });
    }
    return builder;
  });
  return {
    supabase: { from } as unknown as SupabaseClient,
    calls: { from, verbs: verbsSeen },
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const EMPLOYEE_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = '33333333-3333-3333-3333-333333333333';

const VALID_CREATE_PAYLOAD: CreateEmployeePayload = {
  employee_external_id: 'EMP-001',
  full_name: 'Jane Doe',
  start_date: '2024-01-01',
  default_work_jurisdiction: 'NSW',
  employment_type: 'full_time',
  pay_frequency: 'fortnightly',
};

const PERSISTED_ROW: EmployeeRow = {
  id: EMPLOYEE_ID,
  org_id: ORG_ID,
  employee_external_id: 'EMP-001',
  full_name: 'Jane Doe',
  start_date: '2024-01-01',
  end_date: null,
  archived_at: null,
  default_work_jurisdiction: 'NSW',
  employment_type: 'full_time',
  pay_frequency: 'fortnightly',
  sex: null,
  dob: null,
  classification: null,
  hours_per_week: null,
  scheme: 'state_lsl',
  opening_balance_weeks: null,
  opening_balance_taken_weeks: null,
  opening_balance_as_at_date: null,
  retention_expires_at: null,
  tags: [],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  created_by: USER_ID,
  updated_by: USER_ID,
};

// ===========================================================================
// createEmployee — input validation
// ===========================================================================

describe('createEmployee — input validation', () => {
  it('rejects an invalid orgId', async () => {
    const { supabase } = mockSequence([]);
    const result = await createEmployee(supabase, 'not-a-uuid', VALID_CREATE_PAYLOAD, {
      userId: USER_ID,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('org_id');
  });

  it('rejects an invalid userId', async () => {
    const { supabase } = mockSequence([]);
    const result = await createEmployee(supabase, ORG_ID, VALID_CREATE_PAYLOAD, {
      userId: 'not-a-uuid',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('user_id');
  });

  it('rejects a missing employee_external_id', async () => {
    const { supabase } = mockSequence([]);
    const result = await createEmployee(
      supabase,
      ORG_ID,
      { ...VALID_CREATE_PAYLOAD, employee_external_id: '' },
      { userId: USER_ID },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('employee_external_id');
  });

  it('rejects an employee_external_id over 128 chars (service-layer soft cap)', async () => {
    const { supabase } = mockSequence([]);
    const result = await createEmployee(
      supabase,
      ORG_ID,
      { ...VALID_CREATE_PAYLOAD, employee_external_id: 'A'.repeat(129) },
      { userId: USER_ID },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('employee_external_id');
  });

  it('rejects a missing start_date', async () => {
    const { supabase } = mockSequence([]);
    const result = await createEmployee(
      supabase,
      ORG_ID,
      { ...VALID_CREATE_PAYLOAD, start_date: '' },
      { userId: USER_ID },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('start_date');
  });

  it('rejects an invalid start_date', async () => {
    const { supabase } = mockSequence([]);
    const result = await createEmployee(
      supabase,
      ORG_ID,
      { ...VALID_CREATE_PAYLOAD, start_date: '01/01/2024' },
      { userId: USER_ID },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('start_date');
  });

  it('rejects an invalid jurisdiction', async () => {
    const { supabase } = mockSequence([]);
    const result = await createEmployee(
      supabase,
      ORG_ID,
      { ...VALID_CREATE_PAYLOAD, default_work_jurisdiction: 'XYZ' as never },
      { userId: USER_ID },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('invalid_jurisdiction');
  });

  it('rejects an invalid employment_type', async () => {
    const { supabase } = mockSequence([]);
    const result = await createEmployee(
      supabase,
      ORG_ID,
      { ...VALID_CREATE_PAYLOAD, employment_type: 'contractor' as never },
      { userId: USER_ID },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('invalid_employment_type');
  });

  it('rejects an invalid pay_frequency', async () => {
    const { supabase } = mockSequence([]);
    const result = await createEmployee(
      supabase,
      ORG_ID,
      { ...VALID_CREATE_PAYLOAD, pay_frequency: 'biweekly' as never },
      { userId: USER_ID },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('invalid_pay_frequency');
  });

  it('rejects scheme other than state_lsl in v1 (AC-EMP-8)', async () => {
    const { supabase } = mockSequence([]);
    const result = await createEmployee(
      supabase,
      ORG_ID,
      { ...VALID_CREATE_PAYLOAD, scheme: 'portable_construction' as never },
      { userId: USER_ID },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('invalid_scheme');
  });

  it('rejects an invalid sex value', async () => {
    const { supabase } = mockSequence([]);
    const result = await createEmployee(
      supabase,
      ORG_ID,
      { ...VALID_CREATE_PAYLOAD, sex: 'X' as never },
      { userId: USER_ID },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('sex');
  });

  it('rejects end_date before start_date', async () => {
    const { supabase } = mockSequence([]);
    const result = await createEmployee(
      supabase,
      ORG_ID,
      { ...VALID_CREATE_PAYLOAD, end_date: '2023-12-31' },
      { userId: USER_ID },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('end_date');
  });

  it('rejects negative hours_per_week', async () => {
    const { supabase } = mockSequence([]);
    const result = await createEmployee(
      supabase,
      ORG_ID,
      { ...VALID_CREATE_PAYLOAD, hours_per_week: -5 },
      { userId: USER_ID },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('hours_per_week');
  });
});

// ===========================================================================
// createEmployee — happy path + 23505 dedup + RLS
// ===========================================================================

describe('createEmployee — happy path', () => {
  it('inserts the row and returns the persisted shape', async () => {
    const { supabase } = mockSequence([
      // 1. INSERT employees → row
      { table: 'employees', verb: 'insert', result: { data: PERSISTED_ROW, error: null } },
      // 2. INSERT employee_history (initial open segment)
      {
        table: 'employee_history',
        verb: 'insert',
        result: {
          data: {
            id: '99999999-9999-9999-9999-999999999999',
            employee_id: EMPLOYEE_ID,
            org_id: ORG_ID,
            effective_from: '2024-01-01',
            effective_to: null,
            employment_type: 'full_time',
            pay_frequency: 'fortnightly',
            classification: null,
            hours_per_week: null,
            default_work_jurisdiction: 'NSW',
            change_reason: 'initial',
            created_at: '2024-01-01T00:00:00Z',
            created_by: USER_ID,
          },
          error: null,
        },
      },
    ]);
    const result = await createEmployee(supabase, ORG_ID, VALID_CREATE_PAYLOAD, {
      userId: USER_ID,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.row.id).toBe(EMPLOYEE_ID);
    expect(result.data.row.scheme).toBe('state_lsl');
    expect(result.data.warnings).toEqual([]);
  });

  it('translates 23505 (UNIQUE violation) to duplicate_external_id (AC-EMP-4)', async () => {
    const { supabase } = mockSequence([
      {
        table: 'employees',
        verb: 'insert',
        result: {
          data: null,
          error: {
            code: '23505',
            message: 'duplicate key value violates unique constraint "employees_org_external_id_ci_idx"',
          },
        },
      },
    ]);
    const result = await createEmployee(supabase, ORG_ID, VALID_CREATE_PAYLOAD, {
      userId: USER_ID,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('duplicate_external_id');
  });

  it('translates 42501 (RLS) to rls_denied', async () => {
    const { supabase } = mockSequence([
      {
        table: 'employees',
        verb: 'insert',
        result: { data: null, error: { code: '42501', message: 'permission denied' } },
      },
    ]);
    const result = await createEmployee(supabase, ORG_ID, VALID_CREATE_PAYLOAD, {
      userId: USER_ID,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('rls_denied');
  });

  it('translates 23514 (CHECK violation) to validation_failed', async () => {
    const { supabase } = mockSequence([
      {
        table: 'employees',
        verb: 'insert',
        result: {
          data: null,
          error: { code: '23514', message: 'check constraint violation' },
        },
      },
    ]);
    const result = await createEmployee(supabase, ORG_ID, VALID_CREATE_PAYLOAD, {
      userId: USER_ID,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
  });

  it('emits a soft warning when TAS employee is missing sex (AC-EMP-10)', async () => {
    const tasRow: EmployeeRow = { ...PERSISTED_ROW, default_work_jurisdiction: 'TAS' };
    const { supabase } = mockSequence([
      { table: 'employees', verb: 'insert', result: { data: tasRow, error: null } },
      {
        table: 'employee_history',
        verb: 'insert',
        result: { data: { id: '99999999-9999-9999-9999-999999999999' }, error: null },
      },
    ]);
    const result = await createEmployee(
      supabase,
      ORG_ID,
      { ...VALID_CREATE_PAYLOAD, default_work_jurisdiction: 'TAS' },
      { userId: USER_ID },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.warnings).toContain('tas_missing_sex');
  });

  it('emits a soft warning when NT employee is missing dob (AC-EMP-10)', async () => {
    const ntRow: EmployeeRow = { ...PERSISTED_ROW, default_work_jurisdiction: 'NT' };
    const { supabase } = mockSequence([
      { table: 'employees', verb: 'insert', result: { data: ntRow, error: null } },
      {
        table: 'employee_history',
        verb: 'insert',
        result: { data: { id: '99999999-9999-9999-9999-999999999999' }, error: null },
      },
    ]);
    const result = await createEmployee(
      supabase,
      ORG_ID,
      { ...VALID_CREATE_PAYLOAD, default_work_jurisdiction: 'NT' },
      { userId: USER_ID },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.warnings).toContain('nt_missing_dob');
  });
});

// ===========================================================================
// createEmployee — opening-balance policy resolution (PR #119)
// ===========================================================================

describe('createEmployee — opening-balance policy (PR #119 amendment)', () => {
  it('source=csv + policy=setup_wizard → opening_balance fields stripped, warning emitted', async () => {
    const { supabase } = mockSequence([
      // 1. SELECT org policy
      {
        table: 'organisations',
        verb: 'select',
        result: { data: { opening_balances_method: 'setup_wizard' }, error: null },
      },
      // 2. INSERT employees (opening_balance_* columns NOT present in patch)
      { table: 'employees', verb: 'insert', result: { data: PERSISTED_ROW, error: null } },
      // 3. INSERT history
      {
        table: 'employee_history',
        verb: 'insert',
        result: { data: { id: '99999999-9999-9999-9999-999999999999' }, error: null },
      },
    ]);
    const result = await createEmployee(
      supabase,
      ORG_ID,
      {
        ...VALID_CREATE_PAYLOAD,
        opening_balance_weeks: 12.5,
        opening_balance_taken_weeks: 2,
        opening_balance_as_at_date: '2024-01-01',
      },
      { userId: USER_ID, source: 'csv' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.warnings).toContain('csv_opening_balance_skipped_per_policy');
  });

  it('source=wizard + policy=csv_field → opening_balance fields stripped, warning emitted', async () => {
    const { supabase } = mockSequence([
      {
        table: 'organisations',
        verb: 'select',
        result: { data: { opening_balances_method: 'csv_field' }, error: null },
      },
      { table: 'employees', verb: 'insert', result: { data: PERSISTED_ROW, error: null } },
      {
        table: 'employee_history',
        verb: 'insert',
        result: { data: { id: '99999999-9999-9999-9999-999999999999' }, error: null },
      },
    ]);
    const result = await createEmployee(
      supabase,
      ORG_ID,
      { ...VALID_CREATE_PAYLOAD, opening_balance_weeks: 12.5 },
      { userId: USER_ID, source: 'wizard' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.warnings).toContain('wizard_opening_balance_skipped_per_policy');
  });

  it('source=csv + policy=both → opening_balance fields written (no warning)', async () => {
    const persistedWithBalance: EmployeeRow = {
      ...PERSISTED_ROW,
      opening_balance_weeks: 12.5,
    };
    const { supabase } = mockSequence([
      {
        table: 'organisations',
        verb: 'select',
        result: { data: { opening_balances_method: 'both' }, error: null },
      },
      {
        table: 'employees',
        verb: 'insert',
        result: { data: persistedWithBalance, error: null },
      },
      {
        table: 'employee_history',
        verb: 'insert',
        result: { data: { id: '99999999-9999-9999-9999-999999999999' }, error: null },
      },
    ]);
    const result = await createEmployee(
      supabase,
      ORG_ID,
      { ...VALID_CREATE_PAYLOAD, opening_balance_weeks: 12.5 },
      { userId: USER_ID, source: 'csv' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.row.opening_balance_weeks).toBe(12.5);
    expect(result.data.warnings).not.toContain('csv_opening_balance_skipped_per_policy');
  });

  it('policy=none → explicit opening_balance write rejected', async () => {
    const { supabase } = mockSequence([
      {
        table: 'organisations',
        verb: 'select',
        result: { data: { opening_balances_method: 'none' }, error: null },
      },
    ]);
    const result = await createEmployee(
      supabase,
      ORG_ID,
      { ...VALID_CREATE_PAYLOAD, opening_balance_weeks: 12.5 },
      { userId: USER_ID, source: 'wizard' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.detail).toMatchObject({ reason: 'opening_balance_policy_not_set' });
  });

  it('policy=NULL → explicit opening_balance write rejected', async () => {
    const { supabase } = mockSequence([
      {
        table: 'organisations',
        verb: 'select',
        result: { data: { opening_balances_method: null }, error: null },
      },
    ]);
    const result = await createEmployee(
      supabase,
      ORG_ID,
      { ...VALID_CREATE_PAYLOAD, opening_balance_weeks: 12.5 },
      { userId: USER_ID, source: 'csv' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.detail).toMatchObject({ reason: 'opening_balance_policy_not_set' });
  });

  it('no opening_balance fields → no policy lookup, no warning', async () => {
    const { supabase, calls } = mockSequence([
      { table: 'employees', verb: 'insert', result: { data: PERSISTED_ROW, error: null } },
      {
        table: 'employee_history',
        verb: 'insert',
        result: { data: { id: '99999999-9999-9999-9999-999999999999' }, error: null },
      },
    ]);
    const result = await createEmployee(supabase, ORG_ID, VALID_CREATE_PAYLOAD, {
      userId: USER_ID,
      source: 'csv',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.warnings).toEqual([]);
    // Org policy lookup was skipped because no opening_balance fields in payload.
    expect(calls.from).not.toHaveBeenCalledWith('organisations');
  });
});

// ===========================================================================
// updateEmployee — non-effective-dated patch (in-place update)
// ===========================================================================

describe('updateEmployee — non-effective-dated patch', () => {
  it('updates full_name in place without appending history', async () => {
    const updatedRow: EmployeeRow = { ...PERSISTED_ROW, full_name: 'Jane Smith' };
    const { supabase, calls } = mockSequence([
      { table: 'employees', verb: 'update', result: { data: updatedRow, error: null } },
    ]);
    const result = await updateEmployee(
      supabase,
      EMPLOYEE_ID,
      { full_name: 'Jane Smith' },
      { userId: USER_ID },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.row.full_name).toBe('Jane Smith');
    // No history append — only the employees table was touched.
    expect(calls.from).toHaveBeenCalledTimes(1);
    expect(calls.from).toHaveBeenCalledWith('employees');
  });

  it('returns not_found when update affects 0 rows', async () => {
    const { supabase } = mockSequence([
      { table: 'employees', verb: 'update', result: { data: null, error: null } },
    ]);
    const result = await updateEmployee(
      supabase,
      EMPLOYEE_ID,
      { full_name: 'Jane Smith' },
      { userId: USER_ID },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('not_found');
  });

  it('translates 23505 on external_id rename → duplicate_external_id', async () => {
    const { supabase } = mockSequence([
      {
        table: 'employees',
        verb: 'update',
        result: {
          data: null,
          error: { code: '23505', message: 'duplicate key' },
        },
      },
    ]);
    const result = await updateEmployee(
      supabase,
      EMPLOYEE_ID,
      { employee_external_id: 'EMP-002' },
      { userId: USER_ID },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('duplicate_external_id');
  });

  it('rejects scheme other than state_lsl', async () => {
    const { supabase } = mockSequence([]);
    const result = await updateEmployee(
      supabase,
      EMPLOYEE_ID,
      { scheme: 'portable_coal' as never },
      { userId: USER_ID },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('invalid_scheme');
  });
});

// ===========================================================================
// updateEmployee — effective-dated patch (composes Task 2.7)
// ===========================================================================

describe('updateEmployee — effective-dated patch', () => {
  it('updates the row AND appends a history segment for an employment_type change', async () => {
    const updatedRow: EmployeeRow = { ...PERSISTED_ROW, employment_type: 'part_time' };
    const { supabase, calls } = mockSequence([
      // 1. UPDATE employees → updated row
      { table: 'employees', verb: 'update', result: { data: updatedRow, error: null } },
      // 2. SELECT current open segment
      {
        table: 'employee_history',
        verb: 'select',
        result: { data: null, error: null }, // no prior open segment
      },
      // 3. INSERT new open segment
      {
        table: 'employee_history',
        verb: 'insert',
        result: {
          data: {
            id: '99999999-9999-9999-9999-999999999999',
            employee_id: EMPLOYEE_ID,
            org_id: ORG_ID,
            effective_from: '2026-01-01',
            effective_to: null,
            employment_type: 'part_time',
            pay_frequency: null,
            classification: null,
            hours_per_week: null,
            default_work_jurisdiction: null,
            change_reason: null,
            created_at: '2026-01-01T00:00:00Z',
            created_by: USER_ID,
          },
          error: null,
        },
      },
    ]);
    const result = await updateEmployee(
      supabase,
      EMPLOYEE_ID,
      { employment_type: 'part_time' },
      { userId: USER_ID, effectiveFrom: '2026-01-01' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.row.employment_type).toBe('part_time');
    expect(result.data.historySegment).toBeDefined();
    expect(result.data.historySegment?.effective_from).toBe('2026-01-01');
    expect(calls.from).toHaveBeenCalledWith('employees');
    expect(calls.from).toHaveBeenCalledWith('employee_history');
  });

  it('rejects an effective-dated patch without effectiveFrom in opts', async () => {
    const { supabase } = mockSequence([]);
    const result = await updateEmployee(
      supabase,
      EMPLOYEE_ID,
      { employment_type: 'part_time' },
      { userId: USER_ID },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('effective_from');
  });

  it('surfaces history_overlap from the segment INSERT', async () => {
    const updatedRow: EmployeeRow = { ...PERSISTED_ROW, hours_per_week: 20 };
    const { supabase } = mockSequence([
      { table: 'employees', verb: 'update', result: { data: updatedRow, error: null } },
      { table: 'employee_history', verb: 'select', result: { data: null, error: null } },
      {
        table: 'employee_history',
        verb: 'insert',
        result: {
          data: null,
          error: {
            code: '23P01',
            message: 'conflicting key value violates exclusion constraint',
          },
        },
      },
    ]);
    const result = await updateEmployee(
      supabase,
      EMPLOYEE_ID,
      { hours_per_week: 20 },
      { userId: USER_ID, effectiveFrom: '2026-01-01' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('history_overlap');
  });
});

// ===========================================================================
// getEmployee
// ===========================================================================

describe('getEmployee', () => {
  it('returns the row when present', async () => {
    const { supabase } = mockSequence([
      { table: 'employees', verb: 'select', result: { data: PERSISTED_ROW, error: null } },
    ]);
    const result = await getEmployee(supabase, EMPLOYEE_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe(EMPLOYEE_ID);
  });

  it('returns not_found when the row is missing', async () => {
    const { supabase } = mockSequence([
      { table: 'employees', verb: 'select', result: { data: null, error: null } },
    ]);
    const result = await getEmployee(supabase, EMPLOYEE_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('not_found');
  });

  it('rejects an invalid employeeId', async () => {
    const { supabase } = mockSequence([]);
    const result = await getEmployee(supabase, 'not-a-uuid');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
  });

  it('translates rls_denied', async () => {
    const { supabase } = mockSequence([
      {
        table: 'employees',
        verb: 'select',
        result: { data: null, error: { code: '42501', message: 'permission denied' } },
      },
    ]);
    const result = await getEmployee(supabase, EMPLOYEE_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('rls_denied');
  });
});

// ===========================================================================
// listEmployees
// ===========================================================================

describe('listEmployees', () => {
  it('returns rows with default filter (active only)', async () => {
    const { supabase } = mockSequence([
      {
        table: 'employees',
        verb: 'select',
        result: { data: [PERSISTED_ROW], error: null },
      },
    ]);
    const result = await listEmployees(supabase, ORG_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rows).toHaveLength(1);
  });

  it('returns archived rows when filter=archived', async () => {
    const archived: EmployeeRow = {
      ...PERSISTED_ROW,
      archived_at: '2026-01-01T00:00:00Z',
      end_date: '2026-01-01',
    };
    const { supabase } = mockSequence([
      {
        table: 'employees',
        verb: 'select',
        result: { data: [archived], error: null },
      },
    ]);
    const result = await listEmployees(supabase, ORG_ID, { status: 'archived' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rows).toHaveLength(1);
    expect(result.data.rows[0]!.archived_at).not.toBeNull();
  });

  it('returns empty array when no rows match', async () => {
    const { supabase } = mockSequence([
      { table: 'employees', verb: 'select', result: { data: [], error: null } },
    ]);
    const result = await listEmployees(supabase, ORG_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rows).toEqual([]);
  });

  it('rejects an invalid orgId', async () => {
    const { supabase } = mockSequence([]);
    const result = await listEmployees(supabase, 'not-a-uuid');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
  });

  it('rejects an out-of-range limit', async () => {
    const { supabase } = mockSequence([]);
    const result = await listEmployees(supabase, ORG_ID, { limit: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
  });

  it('rejects a negative offset', async () => {
    const { supabase } = mockSequence([]);
    const result = await listEmployees(supabase, ORG_ID, { offset: -1 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
  });
});

// ===========================================================================
// archiveEmployee
// ===========================================================================

describe('archiveEmployee (AC-EMP-6)', () => {
  it('sets archived_at AND end_date when end_date was null', async () => {
    // First read the current row to see if end_date is set.
    const { supabase } = mockSequence([
      {
        table: 'employees',
        verb: 'select',
        result: { data: { end_date: null }, error: null },
      },
      {
        table: 'employees',
        verb: 'update',
        result: {
          data: {
            ...PERSISTED_ROW,
            archived_at: '2026-05-31T00:00:00Z',
            end_date: '2026-05-31',
          },
          error: null,
        },
      },
    ]);
    const result = await archiveEmployee(supabase, EMPLOYEE_ID, { userId: USER_ID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.archived_at).not.toBeNull();
    expect(result.data.end_date).not.toBeNull();
  });

  it('only sets archived_at when end_date was already set', async () => {
    const { supabase } = mockSequence([
      {
        table: 'employees',
        verb: 'select',
        result: { data: { end_date: '2024-12-31' }, error: null },
      },
      {
        table: 'employees',
        verb: 'update',
        result: {
          data: {
            ...PERSISTED_ROW,
            archived_at: '2026-05-31T00:00:00Z',
            end_date: '2024-12-31',
          },
          error: null,
        },
      },
    ]);
    const result = await archiveEmployee(supabase, EMPLOYEE_ID, { userId: USER_ID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.end_date).toBe('2024-12-31');
  });

  it('returns not_found when employee is missing', async () => {
    const { supabase } = mockSequence([
      { table: 'employees', verb: 'select', result: { data: null, error: null } },
    ]);
    const result = await archiveEmployee(supabase, EMPLOYEE_ID, { userId: USER_ID });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('not_found');
  });

  it('translates rls_denied', async () => {
    const { supabase } = mockSequence([
      {
        table: 'employees',
        verb: 'select',
        result: { data: null, error: { code: '42501', message: 'denied' } },
      },
    ]);
    const result = await archiveEmployee(supabase, EMPLOYEE_ID, { userId: USER_ID });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('rls_denied');
  });
});

// ===========================================================================
// reactivateEmployee (AC-EMP-13 — retention trigger clears retention_expires_at)
// ===========================================================================

describe('reactivateEmployee', () => {
  it('clears archived_at AND end_date', async () => {
    const reactivated: EmployeeRow = {
      ...PERSISTED_ROW,
      archived_at: null,
      end_date: null,
      retention_expires_at: null,
    };
    const { supabase } = mockSequence([
      {
        table: 'employees',
        verb: 'update',
        result: { data: reactivated, error: null },
      },
    ]);
    const result = await reactivateEmployee(supabase, EMPLOYEE_ID, { userId: USER_ID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.archived_at).toBeNull();
    expect(result.data.end_date).toBeNull();
    expect(result.data.retention_expires_at).toBeNull();
  });

  it('returns not_found when the row is missing', async () => {
    const { supabase } = mockSequence([
      { table: 'employees', verb: 'update', result: { data: null, error: null } },
    ]);
    const result = await reactivateEmployee(supabase, EMPLOYEE_ID, { userId: USER_ID });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('not_found');
  });
});

// ===========================================================================
// getOpeningBalance / clearOpeningBalance (scope-trim absorption from 2.8)
// ===========================================================================

describe('getOpeningBalance', () => {
  it('returns the three fields when present', async () => {
    const { supabase } = mockSequence([
      {
        table: 'employees',
        verb: 'select',
        result: {
          data: {
            opening_balance_weeks: 12.5,
            opening_balance_taken_weeks: 2,
            opening_balance_as_at_date: '2024-01-01',
          },
          error: null,
        },
      },
    ]);
    const result = await getOpeningBalance(supabase, EMPLOYEE_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.opening_balance_weeks).toBe(12.5);
  });

  it('returns null balance when all three fields are null', async () => {
    const { supabase } = mockSequence([
      {
        table: 'employees',
        verb: 'select',
        result: {
          data: {
            opening_balance_weeks: null,
            opening_balance_taken_weeks: null,
            opening_balance_as_at_date: null,
          },
          error: null,
        },
      },
    ]);
    const result = await getOpeningBalance(supabase, EMPLOYEE_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();
  });

  it('returns not_found when the employee row is missing', async () => {
    const { supabase } = mockSequence([
      { table: 'employees', verb: 'select', result: { data: null, error: null } },
    ]);
    const result = await getOpeningBalance(supabase, EMPLOYEE_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('not_found');
  });
});

describe('clearOpeningBalance', () => {
  it('sets all three opening_balance_* fields to null', async () => {
    const cleared: EmployeeRow = {
      ...PERSISTED_ROW,
      opening_balance_weeks: null,
      opening_balance_taken_weeks: null,
      opening_balance_as_at_date: null,
    };
    const { supabase } = mockSequence([
      { table: 'employees', verb: 'update', result: { data: cleared, error: null } },
    ]);
    const result = await clearOpeningBalance(supabase, EMPLOYEE_ID, { userId: USER_ID });
    expect(result.ok).toBe(true);
  });

  it('returns not_found when the row is missing', async () => {
    const { supabase } = mockSequence([
      { table: 'employees', verb: 'update', result: { data: null, error: null } },
    ]);
    const result = await clearOpeningBalance(supabase, EMPLOYEE_ID, { userId: USER_ID });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('not_found');
  });

  it('translates rls_denied', async () => {
    const { supabase } = mockSequence([
      {
        table: 'employees',
        verb: 'update',
        result: { data: null, error: { code: '42501', message: 'denied' } },
      },
    ]);
    const result = await clearOpeningBalance(supabase, EMPLOYEE_ID, { userId: USER_ID });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('rls_denied');
  });
});

// ===========================================================================
// updateEmployee — opening_balance policy resolution (PR #119)
// ===========================================================================

describe('updateEmployee — opening_balance policy', () => {
  it('source=csv + policy=both → CSV writes opening_balance fields', async () => {
    const updatedRow: EmployeeRow = {
      ...PERSISTED_ROW,
      opening_balance_weeks: 10,
    };
    const { supabase } = mockSequence([
      // Read existing employee FIRST (to learn org_id + prior balance) before
      // looking up org policy. updateEmployee takes only employeeId — orgId
      // is not a parameter, so the impl must derive it from the row.
      {
        table: 'employees',
        verb: 'select',
        result: {
          data: { org_id: ORG_ID, opening_balance_weeks: null },
          error: null,
        },
      },
      {
        table: 'organisations',
        verb: 'select',
        result: { data: { opening_balances_method: 'both' }, error: null },
      },
      { table: 'employees', verb: 'update', result: { data: updatedRow, error: null } },
    ]);
    const result = await updateEmployee(
      supabase,
      EMPLOYEE_ID,
      { opening_balance_weeks: 10 },
      { userId: USER_ID, source: 'csv' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.row.opening_balance_weeks).toBe(10);
  });

  it('source=csv + policy=both + prior CSV value present → emits csv_value_overwritten when wizard overrides', async () => {
    // This case is documented in the PR #119 amend: `both` policy, wizard
    // overrides existing CSV value, warning is emitted.
    const updatedRow: EmployeeRow = {
      ...PERSISTED_ROW,
      opening_balance_weeks: 15,
    };
    const { supabase } = mockSequence([
      {
        table: 'employees',
        verb: 'select',
        result: {
          data: { org_id: ORG_ID, opening_balance_weeks: 10 },
          error: null,
        },
      },
      {
        table: 'organisations',
        verb: 'select',
        result: { data: { opening_balances_method: 'both' }, error: null },
      },
      { table: 'employees', verb: 'update', result: { data: updatedRow, error: null } },
    ]);
    const result = await updateEmployee(
      supabase,
      EMPLOYEE_ID,
      { opening_balance_weeks: 15 },
      { userId: USER_ID, source: 'wizard' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.warnings).toContain('csv_value_overwritten');
  });

  it('source=wizard + policy=csv_field → wizard write silently skipped', async () => {
    const { supabase } = mockSequence([
      {
        table: 'employees',
        verb: 'select',
        result: {
          data: { org_id: ORG_ID, opening_balance_weeks: null },
          error: null,
        },
      },
      {
        table: 'organisations',
        verb: 'select',
        result: { data: { opening_balances_method: 'csv_field' }, error: null },
      },
      // Update happens but with the opening_balance_* fields stripped.
      { table: 'employees', verb: 'update', result: { data: PERSISTED_ROW, error: null } },
    ]);
    const result = await updateEmployee(
      supabase,
      EMPLOYEE_ID,
      { opening_balance_weeks: 10 },
      { userId: USER_ID, source: 'wizard' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.warnings).toContain('wizard_opening_balance_skipped_per_policy');
  });
});
