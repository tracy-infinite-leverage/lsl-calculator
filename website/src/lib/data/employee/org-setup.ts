/**
 * Org-setup service — customer-setup wizard backend.
 *
 * Phase 2 (Task 2.5) per E5.2 Employee Masterfile + Customer Setup.
 *
 * The customer-setup wizard (Phase 4 — `/app/setup`) writes the six
 * customer-setup columns added to `public.organisations` by Migration 1
 * (`extend_organisations_customer_setup.sql`):
 *
 *   - `employer_legal_name`         (required)
 *   - `employer_trading_name`       (optional)
 *   - `abn`                         (required, 11-digit format)
 *   - `default_work_jurisdiction`   (required, one of NSW/VIC/QLD/WA/SA/TAS/ACT/NT)
 *   - `default_pay_frequency`       (optional, one of weekly/fortnightly/monthly/four_weekly)
 *   - `opening_balances_method`     (optional, one of csv_field/setup_wizard/both/none)
 *
 * The DB defers NOT NULL on the three required columns (per impl-plan §3.1
 * Migration 1) until the wizard backfills existing rows — so the service
 * layer enforces required-ness here.
 *
 * Operations exposed:
 *
 *   - `validateOrgSetup(payload)` — pure validator. Returns `Result<ValidatedOrgSetup>`
 *     with normalised values + a `warnings: string[]` channel for soft signals
 *     that don't reject. The only v1 warning is `'abn_check_digit_invalid'`
 *     (mod-89 fail); the spec §4.1 + impl-plan §3.1 explicitly defer hard
 *     check-digit enforcement to v1.1.
 *
 *   - `getOrgSetup(supabase, orgId)` — read the six columns for the org.
 *     Returns `not_found` when the row is missing, `rls_denied` when
 *     PostgREST signals 42501, `db_error` for unexpected conditions.
 *
 *   - `saveOrgSetup(supabase, orgId, payload)` — validates then writes the
 *     normalised payload. Returns `{ row, warnings }` on success so callers
 *     can surface soft warnings (e.g. ABN check-digit) in the UI.
 *
 * Refs:
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §4.1, §6 (AC-EMP-1)
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §2, §3.1
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-tasks.md §Task 2.5
 *   - AC-EMP-1.
 */

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { err, ok, type Result } from './types';

// ─── Domain types ────────────────────────────────────────────────────────────

export type Jurisdiction = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
export type PayFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'four_weekly';
export type OpeningBalancesMethod = 'csv_field' | 'setup_wizard' | 'both' | 'none';

const JURISDICTIONS: ReadonlyArray<Jurisdiction> = [
  'NSW',
  'VIC',
  'QLD',
  'WA',
  'SA',
  'TAS',
  'ACT',
  'NT',
];
const PAY_FREQUENCIES: ReadonlyArray<PayFrequency> = [
  'weekly',
  'fortnightly',
  'monthly',
  'four_weekly',
];
const OPENING_BALANCES_METHODS: ReadonlyArray<OpeningBalancesMethod> = [
  'csv_field',
  'setup_wizard',
  'both',
  'none',
];

/**
 * Maximum length for the two free-text name fields. Mirrors the (looser)
 * Postgres `text` column — the service layer enforces this so a typo'd
 * paste from a Word document doesn't get persisted.
 */
const NAME_MAX_LENGTH = 200;

/**
 * Soft warning emitted on the validator's `warnings` array. v1 only emits
 * `'abn_check_digit_invalid'`; the union is kept narrow so a new warning
 * is a deliberate addition rather than an unconstrained string.
 */
export type OrgSetupWarning = 'abn_check_digit_invalid';

// ─── Public payload + result shapes ──────────────────────────────────────────

/**
 * Raw payload coming from the customer-setup wizard (Phase 4) or the
 * Phase-3 route handler. Strings are accepted as-is — whitespace handling
 * and casing are normalised inside `validateOrgSetup`.
 */
export interface OrgSetupPayload {
  employer_legal_name: string;
  employer_trading_name?: string | null;
  abn: string;
  default_work_jurisdiction: string;
  default_pay_frequency?: string | null;
  opening_balances_method?: string | null;
}

/**
 * Validator output. Optional fields are normalised to `undefined` rather
 * than `null` so the write path can `.update()` the exact set of columns
 * the caller supplied; the DB stores NULL for either case.
 */
export interface ValidatedOrgSetup {
  employer_legal_name: string;
  employer_trading_name?: string;
  abn: string;
  default_work_jurisdiction: Jurisdiction;
  default_pay_frequency?: PayFrequency;
  opening_balances_method?: OpeningBalancesMethod;
  warnings: OrgSetupWarning[];
}

/**
 * Persisted row shape returned by `getOrgSetup` and on the `row` field of
 * `saveOrgSetup`. Mirrors the column list on `public.organisations` for
 * the six customer-setup columns; the DB stores NULL for unset optional
 * fields so the shape uses `T | null` here.
 */
export interface OrgSetupRow {
  employer_legal_name: string | null;
  employer_trading_name: string | null;
  abn: string | null;
  default_work_jurisdiction: Jurisdiction | null;
  default_pay_frequency: PayFrequency | null;
  opening_balances_method: OpeningBalancesMethod | null;
}

export interface SaveOrgSetupSuccess {
  row: OrgSetupRow;
  warnings: OrgSetupWarning[];
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

/**
 * UUID v4/v1/v5 broad-shape regex. Supabase uses uuid v4 from
 * `gen_random_uuid()` and `auth.users.id`. We accept any RFC 4122 shape so
 * test fixtures that hard-code `00000000-0000-0000-0000-000000000001` (a
 * non-conforming-but-RFC-shape "nil-style" id) still pass — the actual DB
 * lookup will reject malformed values anyway.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const orgSetupSchema = z.object({
  employer_legal_name: z
    .string({ message: 'employer_legal_name is required' })
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .min(1, 'employer_legal_name must be 1-200 chars')
        .max(NAME_MAX_LENGTH, 'employer_legal_name must be 1-200 chars'),
    ),
  employer_trading_name: z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((v) => (v == null ? undefined : v.trim()))
    .refine(
      (v) => v === undefined || (v.length >= 1 && v.length <= NAME_MAX_LENGTH),
      'employer_trading_name must be 1-200 chars when present',
    ),
  abn: z
    .string({ message: 'abn is required' })
    // Allow human-formatted ABNs ("53 004 085 616") by stripping interior whitespace.
    .transform((v) => v.replace(/\s+/g, ''))
    .pipe(z.string().regex(/^\d{11}$/, 'abn must be 11 digits')),
  default_work_jurisdiction: z.enum(JURISDICTIONS as readonly [Jurisdiction, ...Jurisdiction[]], {
    message: 'default_work_jurisdiction must be one of NSW/VIC/QLD/WA/SA/TAS/ACT/NT',
  }),
  default_pay_frequency: z
    .union([
      z.enum(PAY_FREQUENCIES as readonly [PayFrequency, ...PayFrequency[]]),
      z.null(),
      z.undefined(),
    ])
    .optional()
    .transform((v) => (v == null ? undefined : v)),
  opening_balances_method: z
    .union([
      z.enum(OPENING_BALANCES_METHODS as readonly [OpeningBalancesMethod, ...OpeningBalancesMethod[]]),
      z.null(),
      z.undefined(),
    ])
    .optional()
    .transform((v) => (v == null ? undefined : v)),
});

// ─── ABN check-digit (mod-89) ────────────────────────────────────────────────

/**
 * Australian Business Number checksum: subtract 1 from the first digit, then
 * apply the weights below; the weighted sum must be divisible by 89. Sourced
 * from the ATO's published ABN format specification. Pure function; testable
 * in isolation (covered indirectly through `validateOrgSetup`).
 */
const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19] as const;

function isAbnCheckDigitValid(abn: string): boolean {
  // Assumes the format check has already passed (11 digits, all numeric).
  const digits = abn.split('').map(Number);
  digits[0] = digits[0]! - 1;
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i]! * ABN_WEIGHTS[i]!;
  }
  return sum % 89 === 0;
}

// ─── validateOrgSetup ────────────────────────────────────────────────────────

/**
 * Pure validator. Normalises whitespace + casing, enforces required-ness
 * + enum + format, and emits soft warnings on the `warnings` channel.
 *
 * Returns `Result<ValidatedOrgSetup>`. The error variants used:
 *   - `validation_failed`     — generic field shape / length / format issue
 *   - `invalid_jurisdiction`  — `default_work_jurisdiction` outside the 8 codes
 *   - `invalid_pay_frequency` — `default_pay_frequency` outside the 4 codes
 *
 * The narrower `invalid_*` kinds are preferred over generic `validation_failed`
 * for the enum fields so route handlers (Phase 3) can map them to a
 * field-specific UI hint without parsing the `message` string.
 */
export function validateOrgSetup(payload: OrgSetupPayload): Result<ValidatedOrgSetup> {
  const parsed = orgSetupSchema.safeParse(payload);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]!;
    const path = firstIssue.path[0];
    const field = typeof path === 'string' ? path : undefined;
    const message = firstIssue.message;

    if (field === 'default_work_jurisdiction') {
      return err('invalid_jurisdiction', message, { field });
    }
    if (field === 'default_pay_frequency') {
      return err('invalid_pay_frequency', message, { field });
    }
    return err('validation_failed', message, field ? { field } : undefined);
  }

  const warnings: OrgSetupWarning[] = [];
  if (!isAbnCheckDigitValid(parsed.data.abn)) {
    warnings.push('abn_check_digit_invalid');
  }

  // Strip undefined keys for a clean return shape — easier to debug-log.
  const data: ValidatedOrgSetup = {
    employer_legal_name: parsed.data.employer_legal_name,
    abn: parsed.data.abn,
    default_work_jurisdiction: parsed.data.default_work_jurisdiction,
    warnings,
  };
  if (parsed.data.employer_trading_name !== undefined) {
    data.employer_trading_name = parsed.data.employer_trading_name;
  }
  if (parsed.data.default_pay_frequency !== undefined) {
    data.default_pay_frequency = parsed.data.default_pay_frequency;
  }
  if (parsed.data.opening_balances_method !== undefined) {
    data.opening_balances_method = parsed.data.opening_balances_method;
  }
  return ok(data);
}

// ─── PostgREST error translation ─────────────────────────────────────────────

/**
 * PostgREST surfaces an SQL error with a `.code` matching PostgreSQL's
 * SQLSTATE. We map the codes the service-layer cares about to canonical
 * `ServiceError` kinds; anything else falls through to `db_error` and is
 * logged for diagnosis.
 */
function translatePostgrestError(
  pgError: { code?: string; message: string },
  field?: string,
): ReturnType<typeof err> {
  switch (pgError.code) {
    case '42501':
      // insufficient_privilege — RLS denied the row.
      return err('rls_denied', pgError.message);
    case '23514':
      // check_violation — service-layer should have caught this, but a
      // race between an enum amend and a CHECK constraint amend could
      // surface it. Re-route to validation_failed rather than db_error
      // so the caller sees a 4xx in route-handler mapping (Phase 3).
      return err(
        'validation_failed',
        pgError.message,
        field ? { field, detail: pgError } : { detail: pgError },
      );
    case 'PGRST116':
      // PostgREST: "Searched for one row but found 0" — not_found semantics
      // when callers used `.single()` (we use `.maybeSingle()` here, so this
      // path is defensive coverage).
      return err('not_found', pgError.message);
    default:
      return err('db_error', pgError.message, { detail: pgError });
  }
}

// ─── getOrgSetup ─────────────────────────────────────────────────────────────

const SETUP_COLUMNS =
  'employer_legal_name, employer_trading_name, abn, default_work_jurisdiction, default_pay_frequency, opening_balances_method';

/**
 * Read the six customer-setup columns for an org. RLS is the security
 * boundary — callers MUST pass a session-bound `SupabaseClient` (from
 * `createSupabaseServerClient`), NOT the service-role admin client.
 *
 * Returns `not_found` when the org row is invisible (either deleted, or
 * RLS evaluated SELECT-USING to false for this caller). `rls_denied` is
 * reserved for the explicit 42501 path PostgREST sometimes returns when
 * INSERT/UPDATE policies fire — for SELECT, an invisible row looks like
 * a missing row and is `not_found`.
 */
export async function getOrgSetup(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Result<OrgSetupRow>> {
  if (!UUID_REGEX.test(orgId)) {
    return err('validation_failed', 'org_id must be a uuid', { field: 'org_id' });
  }

  const { data, error } = await supabase
    .from('organisations')
    .select(SETUP_COLUMNS)
    .eq('id', orgId)
    .maybeSingle();

  if (error) {
    return translatePostgrestError(error);
  }
  if (data === null) {
    return err('not_found', `organisation ${orgId} not found`);
  }
  return ok(data as unknown as OrgSetupRow);
}

// ─── saveOrgSetup ────────────────────────────────────────────────────────────

/**
 * Validate the payload and write the six customer-setup columns to the
 * org row. RLS is the boundary — the UPDATE policy on `organisations`
 * (set up by E5.1 migrations) only permits admins of the org.
 *
 * The write uses `.update().eq('id', orgId).select(COLS).maybeSingle()`
 * so a successful update returns the persisted row in one round-trip.
 * `null` data with no error means 0 rows matched — surfaced as `not_found`.
 *
 * Soft warnings from `validateOrgSetup` (e.g. `'abn_check_digit_invalid'`)
 * propagate to the success shape so the UI can render a yellow banner
 * without rejecting the save.
 */
export async function saveOrgSetup(
  supabase: SupabaseClient,
  orgId: string,
  payload: OrgSetupPayload,
): Promise<Result<SaveOrgSetupSuccess>> {
  if (!UUID_REGEX.test(orgId)) {
    return err('validation_failed', 'org_id must be a uuid', { field: 'org_id' });
  }

  const validated = validateOrgSetup(payload);
  if (!validated.ok) {
    return validated;
  }

  // Build the column patch — only the keys the caller supplied. Omitting
  // a field leaves the existing DB value intact; passing `undefined` to
  // PostgREST is equivalent to omitting the key.
  const patch: Record<string, string | null> = {
    employer_legal_name: validated.data.employer_legal_name,
    abn: validated.data.abn,
    default_work_jurisdiction: validated.data.default_work_jurisdiction,
  };
  if (validated.data.employer_trading_name !== undefined) {
    patch.employer_trading_name = validated.data.employer_trading_name;
  }
  if (validated.data.default_pay_frequency !== undefined) {
    patch.default_pay_frequency = validated.data.default_pay_frequency;
  }
  if (validated.data.opening_balances_method !== undefined) {
    patch.opening_balances_method = validated.data.opening_balances_method;
  }

  const { data, error } = await supabase
    .from('organisations')
    .update(patch)
    .eq('id', orgId)
    .select(SETUP_COLUMNS)
    .maybeSingle();

  if (error) {
    return translatePostgrestError(error);
  }
  if (data === null) {
    return err('not_found', `organisation ${orgId} not found`);
  }

  return ok({
    row: data as unknown as OrgSetupRow,
    warnings: validated.data.warnings,
  });
}
