/**
 * Org-setup service — unit tests.
 *
 * Phase 2 (Task 2.5) per E5.2 Employee Masterfile + Customer Setup.
 *
 * Covers spec §4.1 customer-setup columns + the AC-EMP-1 onboarding wizard
 * persistence contract. The service exposes three entry points:
 *
 *   - `validateOrgSetup(payload)` — pure validator, returns `Result<ValidatedOrgSetup>`
 *     with structural + enum + format checks. ABN check-digit failure surfaces
 *     as a SOFT warning (per spec §4.1 + impl-plan §3.1: "check-digit validation
 *     deferred to v1.1") rather than a rejection.
 *
 *   - `getOrgSetup(supabase, orgId)` — read the 6 customer-setup columns from
 *     `public.organisations`. Maps `not_found` from PostgREST `PGRST116` and
 *     surfaces an `rls_denied` when the row is invisible to the caller.
 *
 *   - `saveOrgSetup(supabase, orgId, payload)` — validates then writes the
 *     payload to `public.organisations`. Returns the persisted row + any
 *     soft warnings the validator emitted.
 *
 * Test strategy:
 *   - Pure-function coverage for `validateOrgSetup` — bulk of the tests.
 *   - Mocked-Supabase coverage for `getOrgSetup` / `saveOrgSetup` — verifies
 *     the service translates Supabase error shapes to `ServiceError` kinds
 *     correctly. Real DB integration lives in Phase 3 route-handler tests.
 *
 * Refs:
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §4.1, §6 (AC-EMP-1)
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §2, §3.1
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-tasks.md §Task 2.5
 *   - AC-EMP-1.
 */

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  validateOrgSetup,
  getOrgSetup,
  saveOrgSetup,
  type OrgSetupPayload,
} from '../org-setup';

// ---------------------------------------------------------------------------
// Helpers — a minimal Supabase mock surface for chained query-builder calls.
// We do NOT spin up a real Postgres connection here; the integration story
// is owned by Phase 3 / Playwright. These tests pin the service translation
// from PostgREST error shapes → ServiceError kinds.
// ---------------------------------------------------------------------------

/**
 * Build a mock that handles `supabase.from(table).select(cols).eq(col, value).maybeSingle()`
 * — the read path used by `getOrgSetup`. The terminal `maybeSingle()` returns
 * `{ data, error }` matching PostgREST's shape.
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
 * Build a mock that handles
 *   `supabase.from(table).update(payload).eq(col, value).select(cols).maybeSingle()`
 * — the write path used by `saveOrgSetup`. PostgREST returns the updated row
 * via the trailing `select().maybeSingle()`.
 */
function mockUpdateReturning(result: {
  data: Record<string, unknown> | null;
  error: { code?: string; message: string } | null;
}): SupabaseClient {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { from } as unknown as SupabaseClient;
}

const VALID_ORG_ID = '00000000-0000-0000-0000-000000000001';

const VALID_PAYLOAD: OrgSetupPayload = {
  employer_legal_name: 'Acme Pty Ltd',
  abn: '53004085616', // ABN that passes the mod-89 check (known-good test ABN)
  default_work_jurisdiction: 'NSW',
};

// ===========================================================================
// validateOrgSetup — pure validator
// ===========================================================================

describe('validateOrgSetup — required fields', () => {
  it('accepts the minimum valid payload (3 required fields)', () => {
    const result = validateOrgSetup(VALID_PAYLOAD);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.employer_legal_name).toBe('Acme Pty Ltd');
    expect(result.data.abn).toBe('53004085616');
    expect(result.data.default_work_jurisdiction).toBe('NSW');
    // Optional fields default to undefined / null on the validated shape.
    expect(result.data.employer_trading_name).toBeUndefined();
    expect(result.data.default_pay_frequency).toBeUndefined();
    expect(result.data.opening_balances_method).toBeUndefined();
    expect(result.data.warnings).toEqual([]);
  });

  it('accepts a fully-populated payload (all 6 columns)', () => {
    const result = validateOrgSetup({
      employer_legal_name: 'Acme Pty Ltd',
      employer_trading_name: 'Acme',
      abn: '53004085616',
      default_work_jurisdiction: 'VIC',
      default_pay_frequency: 'fortnightly',
      opening_balances_method: 'both',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      employer_legal_name: 'Acme Pty Ltd',
      employer_trading_name: 'Acme',
      abn: '53004085616',
      default_work_jurisdiction: 'VIC',
      default_pay_frequency: 'fortnightly',
      opening_balances_method: 'both',
    });
    expect(result.data.warnings).toEqual([]);
  });

  it('rejects when employer_legal_name is missing', () => {
    const result = validateOrgSetup({
      abn: '53004085616',
      default_work_jurisdiction: 'NSW',
    } as unknown as OrgSetupPayload);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('employer_legal_name');
  });

  it('rejects when employer_legal_name is an empty / whitespace-only string', () => {
    const result = validateOrgSetup({ ...VALID_PAYLOAD, employer_legal_name: '   ' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('employer_legal_name');
  });

  it('trims employer_legal_name on accept', () => {
    const result = validateOrgSetup({ ...VALID_PAYLOAD, employer_legal_name: '  Acme Pty Ltd  ' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.employer_legal_name).toBe('Acme Pty Ltd');
  });

  it('rejects when employer_legal_name exceeds 200 chars', () => {
    const result = validateOrgSetup({
      ...VALID_PAYLOAD,
      employer_legal_name: 'A'.repeat(201),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('employer_legal_name');
  });

  it('rejects when abn is missing', () => {
    const result = validateOrgSetup({
      employer_legal_name: 'Acme',
      default_work_jurisdiction: 'NSW',
    } as unknown as OrgSetupPayload);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('abn');
  });

  it('rejects when default_work_jurisdiction is missing', () => {
    const result = validateOrgSetup({
      employer_legal_name: 'Acme',
      abn: '53004085616',
    } as unknown as OrgSetupPayload);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('invalid_jurisdiction');
    expect(result.error.field).toBe('default_work_jurisdiction');
  });
});

// ===========================================================================
// ABN format + check-digit
// ===========================================================================

describe('validateOrgSetup — ABN format', () => {
  it('rejects ABN with non-digit characters', () => {
    const result = validateOrgSetup({ ...VALID_PAYLOAD, abn: '5300408561A' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('abn');
  });

  it('rejects ABN shorter than 11 digits', () => {
    const result = validateOrgSetup({ ...VALID_PAYLOAD, abn: '5300408561' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('abn');
  });

  it('rejects ABN longer than 11 digits', () => {
    const result = validateOrgSetup({ ...VALID_PAYLOAD, abn: '530040856160' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('abn');
  });

  it('strips whitespace inside ABN before validating (handles "53 004 085 616")', () => {
    const result = validateOrgSetup({ ...VALID_PAYLOAD, abn: '53 004 085 616' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.abn).toBe('53004085616');
    expect(result.data.warnings).toEqual([]);
  });

  it('emits a soft warning when the ABN check digit (mod-89) fails', () => {
    // 11111111111 — passes the regex but fails mod-89.
    const result = validateOrgSetup({ ...VALID_PAYLOAD, abn: '11111111111' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.abn).toBe('11111111111');
    expect(result.data.warnings).toContain('abn_check_digit_invalid');
  });

  it('does NOT emit the check-digit warning for a valid ABN', () => {
    const result = validateOrgSetup(VALID_PAYLOAD);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.warnings).not.toContain('abn_check_digit_invalid');
  });
});

// ===========================================================================
// Jurisdiction enum (the 8 codes)
// ===========================================================================

describe('validateOrgSetup — default_work_jurisdiction enum', () => {
  it.each(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'])(
    'accepts %s',
    (code) => {
      const result = validateOrgSetup({ ...VALID_PAYLOAD, default_work_jurisdiction: code });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.default_work_jurisdiction).toBe(code);
    },
  );

  it('rejects an unknown jurisdiction code', () => {
    const result = validateOrgSetup({
      ...VALID_PAYLOAD,
      default_work_jurisdiction: 'XYZ',
    } as unknown as OrgSetupPayload);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('invalid_jurisdiction');
    expect(result.error.field).toBe('default_work_jurisdiction');
  });

  it('rejects a lowercase jurisdiction code (DB stores uppercase per Migration 1 CHECK)', () => {
    const result = validateOrgSetup({
      ...VALID_PAYLOAD,
      default_work_jurisdiction: 'nsw',
    } as unknown as OrgSetupPayload);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('invalid_jurisdiction');
  });
});

// ===========================================================================
// Optional enums
// ===========================================================================

describe('validateOrgSetup — default_pay_frequency enum (optional)', () => {
  it.each(['weekly', 'fortnightly', 'monthly', 'four_weekly'])(
    'accepts %s',
    (freq) => {
      const result = validateOrgSetup({ ...VALID_PAYLOAD, default_pay_frequency: freq });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.default_pay_frequency).toBe(freq);
    },
  );

  it('rejects an unknown pay frequency', () => {
    const result = validateOrgSetup({
      ...VALID_PAYLOAD,
      default_pay_frequency: 'biweekly',
    } as unknown as OrgSetupPayload);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('invalid_pay_frequency');
    expect(result.error.field).toBe('default_pay_frequency');
  });

  it('accepts omitted default_pay_frequency (optional field)', () => {
    const result = validateOrgSetup(VALID_PAYLOAD);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.default_pay_frequency).toBeUndefined();
  });
});

describe('validateOrgSetup — opening_balances_method enum (optional)', () => {
  it.each(['csv_field', 'setup_wizard', 'both', 'none'])(
    'accepts %s',
    (method) => {
      const result = validateOrgSetup({ ...VALID_PAYLOAD, opening_balances_method: method });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.opening_balances_method).toBe(method);
    },
  );

  it('rejects an unknown opening-balances method', () => {
    const result = validateOrgSetup({
      ...VALID_PAYLOAD,
      opening_balances_method: 'spreadsheet',
    } as unknown as OrgSetupPayload);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('opening_balances_method');
  });
});

describe('validateOrgSetup — employer_trading_name (optional)', () => {
  it('accepts omitted trading name', () => {
    const result = validateOrgSetup(VALID_PAYLOAD);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.employer_trading_name).toBeUndefined();
  });

  it('trims and accepts a trading name', () => {
    const result = validateOrgSetup({ ...VALID_PAYLOAD, employer_trading_name: '  Acme  ' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.employer_trading_name).toBe('Acme');
  });

  it('rejects a trading name longer than 200 chars', () => {
    const result = validateOrgSetup({
      ...VALID_PAYLOAD,
      employer_trading_name: 'A'.repeat(201),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('employer_trading_name');
  });
});

// ===========================================================================
// getOrgSetup — mocked Supabase
// ===========================================================================

describe('getOrgSetup', () => {
  it('returns the row when present', async () => {
    const row = {
      employer_legal_name: 'Acme Pty Ltd',
      employer_trading_name: 'Acme',
      abn: '53004085616',
      default_work_jurisdiction: 'NSW',
      default_pay_frequency: 'fortnightly',
      opening_balances_method: 'both',
    };
    const supabase = mockSelectMaybeSingle({ data: row, error: null });
    const result = await getOrgSetup(supabase, VALID_ORG_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual(row);
  });

  it('returns not_found when the org row is missing', async () => {
    const supabase = mockSelectMaybeSingle({ data: null, error: null });
    const result = await getOrgSetup(supabase, VALID_ORG_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('not_found');
  });

  it('returns rls_denied when PostgREST signals a permission error (42501)', async () => {
    const supabase = mockSelectMaybeSingle({
      data: null,
      error: { code: '42501', message: 'permission denied for table organisations' },
    });
    const result = await getOrgSetup(supabase, VALID_ORG_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('rls_denied');
  });

  it('returns db_error for an unexpected PostgREST error', async () => {
    const supabase = mockSelectMaybeSingle({
      data: null,
      error: { code: '08006', message: 'connection failure' },
    });
    const result = await getOrgSetup(supabase, VALID_ORG_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('db_error');
  });

  it('rejects a malformed orgId before hitting the DB', async () => {
    const supabase = mockSelectMaybeSingle({ data: null, error: null });
    const result = await getOrgSetup(supabase, 'not-a-uuid');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('org_id');
  });
});

// ===========================================================================
// saveOrgSetup — mocked Supabase
// ===========================================================================

describe('saveOrgSetup', () => {
  it('validates then writes the payload', async () => {
    const persisted = {
      employer_legal_name: 'Acme Pty Ltd',
      employer_trading_name: null,
      abn: '53004085616',
      default_work_jurisdiction: 'NSW',
      default_pay_frequency: null,
      opening_balances_method: null,
    };
    const supabase = mockUpdateReturning({ data: persisted, error: null });
    const result = await saveOrgSetup(supabase, VALID_ORG_ID, VALID_PAYLOAD);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.row.employer_legal_name).toBe('Acme Pty Ltd');
    expect(result.data.row.abn).toBe('53004085616');
    expect(result.data.warnings).toEqual([]);
  });

  it('surfaces validation errors before touching Supabase', async () => {
    const supabase = mockUpdateReturning({ data: null, error: null });
    const result = await saveOrgSetup(supabase, VALID_ORG_ID, {
      ...VALID_PAYLOAD,
      abn: '12',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('abn');
    // Ensure the mock was NOT called — short-circuit on validation failure.
    expect((supabase.from as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('rejects an invalid orgId before touching Supabase', async () => {
    const supabase = mockUpdateReturning({ data: null, error: null });
    const result = await saveOrgSetup(supabase, 'not-a-uuid', VALID_PAYLOAD);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
    expect(result.error.field).toBe('org_id');
    expect((supabase.from as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('returns invalid_jurisdiction when default_work_jurisdiction is bad', async () => {
    const supabase = mockUpdateReturning({ data: null, error: null });
    const result = await saveOrgSetup(supabase, VALID_ORG_ID, {
      ...VALID_PAYLOAD,
      default_work_jurisdiction: 'XYZ' as never,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('invalid_jurisdiction');
  });

  it('returns rls_denied when Supabase replies with 42501', async () => {
    const supabase = mockUpdateReturning({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });
    const result = await saveOrgSetup(supabase, VALID_ORG_ID, VALID_PAYLOAD);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('rls_denied');
  });

  it('returns not_found when the update affects 0 rows (PostgREST returns null)', async () => {
    const supabase = mockUpdateReturning({ data: null, error: null });
    const result = await saveOrgSetup(supabase, VALID_ORG_ID, VALID_PAYLOAD);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('not_found');
  });

  it('translates a 23514 CHECK violation to validation_failed', async () => {
    // Defence-in-depth: should the service-layer enum drift from the DB CHECK,
    // PostgREST surfaces 23514. We translate it back to a validation_failed
    // surface so the caller never sees a 5xx for what is really a bad input.
    const supabase = mockUpdateReturning({
      data: null,
      error: { code: '23514', message: 'new row for relation "organisations" violates check constraint' },
    });
    const result = await saveOrgSetup(supabase, VALID_ORG_ID, VALID_PAYLOAD);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation_failed');
  });

  it('returns db_error for an unexpected PostgREST error', async () => {
    const supabase = mockUpdateReturning({
      data: null,
      error: { code: '08006', message: 'connection failure' },
    });
    const result = await saveOrgSetup(supabase, VALID_ORG_ID, VALID_PAYLOAD);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('db_error');
  });

  it('propagates ABN check-digit warning through the save path', async () => {
    const persisted = {
      employer_legal_name: 'Acme Pty Ltd',
      employer_trading_name: null,
      abn: '11111111111',
      default_work_jurisdiction: 'NSW',
      default_pay_frequency: null,
      opening_balances_method: null,
    };
    const supabase = mockUpdateReturning({ data: persisted, error: null });
    const result = await saveOrgSetup(supabase, VALID_ORG_ID, {
      ...VALID_PAYLOAD,
      abn: '11111111111',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.warnings).toContain('abn_check_digit_invalid');
  });
});
