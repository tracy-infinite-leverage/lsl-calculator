/**
 * Employee CRUD service for public.employees.
 *
 * Phase 2 (Task 2.6) per E5.2 Employee Masterfile + Customer Setup.
 *
 * Owns the read + write path for `public.employees` (Migration 2 —
 * `create_employees.sql`). Composes Task 2.7 (`history.ts`) for
 * effective-dated field changes and the pure reconciler from Task 2.8
 * (`opening-balance.ts`) for opening-balance writes governed by the
 * org's `opening_balances_method` policy column (per spec §3 amendment
 * 2026-05-31 / PR #119).
 *
 * Operations exposed:
 *
 *   - createEmployee(supabase, orgId, payload, opts)
 *       INSERT a new employee row. If the payload includes any of
 *       `employment_type` / `pay_frequency` / `classification` /
 *       `hours_per_week` / `default_work_jurisdiction`, this function also
 *       opens an initial history segment (effective_from = start_date).
 *       Opening-balance writes are governed by the org's policy column
 *       per the spec §3 amendment (PR #119): the call site reads the
 *       policy, strips fields the policy disallows, and emits structured
 *       warnings (`csv_opening_balance_skipped_per_policy`,
 *       `wizard_opening_balance_skipped_per_policy`).
 *
 *   - updateEmployee(supabase, employeeId, patch, opts)
 *       UPDATE the row. If the patch includes any effective-dated field,
 *       the caller MUST also pass `effectiveFrom`; in that case this
 *       function calls `appendHistorySegment` (Task 2.7) so the historical
 *       value is preserved. The two writes are NOT atomic — see PR body
 *       for the RPC-vs-PostgREST recommendation. The EXCLUDE GIST
 *       constraint on `employee_history` is the safety net against
 *       concurrent races.
 *
 *   - getEmployee(supabase, employeeId)
 *       SELECT the row by primary key. Returns `not_found` for invisible
 *       rows (RLS gates SELECT to org members; an invisible row looks the
 *       same as a missing row).
 *
 *   - listEmployees(supabase, orgId, filters?)
 *       Paginated SELECT with active / archived filter. Default returns
 *       active rows (`archived_at IS NULL`) ordered by `created_at DESC`.
 *
 *   - archiveEmployee(supabase, employeeId, opts)
 *       Soft-delete per AC-EMP-6. Sets `archived_at = now()`. If
 *       `end_date` is null, also sets it to today (UTC). The DB trigger
 *       `tg_set_retention_expires_at` (Migration 4) then populates
 *       `retention_expires_at = end_date + 7 years` automatically.
 *
 *   - reactivateEmployee(supabase, employeeId, opts)
 *       Clear `archived_at` and `end_date`. The retention trigger clears
 *       `retention_expires_at` when `end_date` is set to NULL.
 *
 *   - getOpeningBalance(supabase, employeeId)
 *       Read the three opening_balance_* columns. Scope-trim absorption
 *       from Task 2.8 (operator ratified 2026-05-31).
 *
 *   - clearOpeningBalance(supabase, employeeId, opts)
 *       Set all three opening_balance_* columns to NULL — used for
 *       retroactive corrections. Scope-trim absorption from Task 2.8.
 *
 * Refs:
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §3, §4.2, §6
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §1.3, §1.4, §2
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-tasks.md §Task 2.6
 *   - PR #119 (policy-column-driven collision resolution).
 *   - website/supabase/migrations/20260531113015_create_employees.sql
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { err, ok, type Result } from './types';
import {
  appendHistorySegment,
  type HistorySegment,
  type EffectiveDatedFields,
} from './history';

// ─── Domain types ────────────────────────────────────────────────────────────

export type Jurisdiction = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
export type EmploymentType = 'full_time' | 'part_time' | 'casual' | 'salaried' | 'hourly';
export type PayFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'four_weekly';
export type Sex = 'M' | 'F' | 'unspecified';
export type Scheme = 'state_lsl' | 'portable_construction' | 'portable_cleaning' | 'portable_coal';
export type OpeningBalancesMethod = 'csv_field' | 'setup_wizard' | 'both' | 'none';

/**
 * Discriminator for the write source — drives policy-column-driven
 * opening-balance behaviour per spec §3 (amended 2026-05-31, PR #119).
 *   - `'csv'`    — bulk CSV import path (Task 2.4 → Task 2.6 commit).
 *   - `'wizard'` — manual add / edit UI path.
 */
export type WriteSource = 'csv' | 'wizard';

/**
 * Soft warning kinds emitted by create + update. Open-ended enough that
 * callers can route to UI surface (warnings banner) without parsing strings.
 */
export type EmployeeWriteWarning =
  | 'tas_missing_sex' // AC-EMP-10 soft warn
  | 'nt_missing_dob' // AC-EMP-10 soft warn
  | 'csv_opening_balance_skipped_per_policy' // PR #119
  | 'wizard_opening_balance_skipped_per_policy' // PR #119
  | 'csv_value_overwritten'; // AC-EMP-12 + PR #119

/**
 * Full row shape mirroring `public.employees` columns 1:1. PostgREST returns
 * `null` (not `undefined`) for unset optional columns; this shape mirrors
 * the DB representation.
 */
export interface EmployeeRow {
  id: string;
  org_id: string;
  employee_external_id: string;
  full_name: string;
  start_date: string;
  end_date: string | null;
  archived_at: string | null;
  default_work_jurisdiction: Jurisdiction;
  employment_type: EmploymentType;
  pay_frequency: PayFrequency;
  sex: Sex | null;
  dob: string | null;
  classification: string | null;
  hours_per_week: number | null;
  scheme: Scheme;
  opening_balance_weeks: number | null;
  opening_balance_taken_weeks: number | null;
  opening_balance_as_at_date: string | null;
  retention_expires_at: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

/**
 * Payload accepted by `createEmployee`. All required spec §4.2 fields are
 * required here; optional fields may be omitted or set to `null`.
 *
 * `scheme` is optional — defaults to `'state_lsl'`. v1 rejects anything
 * other than `'state_lsl'` per AC-EMP-8.
 */
export interface CreateEmployeePayload {
  employee_external_id: string;
  full_name: string;
  start_date: string;
  end_date?: string | null;
  default_work_jurisdiction: Jurisdiction;
  employment_type: EmploymentType;
  pay_frequency: PayFrequency;
  sex?: Sex | null;
  dob?: string | null;
  classification?: string | null;
  hours_per_week?: number | null;
  scheme?: Scheme;
  opening_balance_weeks?: number | null;
  opening_balance_taken_weeks?: number | null;
  opening_balance_as_at_date?: string | null;
  tags?: string[];
}

/**
 * Patch shape for `updateEmployee` — all fields optional. Setting a field
 * to `null` updates the DB to NULL; omitting a field leaves it untouched.
 */
export interface UpdateEmployeePatch {
  employee_external_id?: string;
  full_name?: string;
  start_date?: string;
  end_date?: string | null;
  default_work_jurisdiction?: Jurisdiction;
  employment_type?: EmploymentType;
  pay_frequency?: PayFrequency;
  sex?: Sex | null;
  dob?: string | null;
  classification?: string | null;
  hours_per_week?: number | null;
  scheme?: Scheme;
  opening_balance_weeks?: number | null;
  opening_balance_taken_weeks?: number | null;
  opening_balance_as_at_date?: string | null;
  tags?: string[];
}

export interface CreateEmployeeOpts {
  /** uuid — populated into `created_by` / `updated_by`. */
  userId: string;
  /** Defaults to `'wizard'` if omitted. Drives opening-balance policy. */
  source?: WriteSource;
}

export interface UpdateEmployeeOpts {
  userId: string;
  /** Required when patch contains any effective-dated field. */
  effectiveFrom?: string;
  source?: WriteSource;
  changeReason?: string;
}

export interface ArchiveOpts {
  userId: string;
}

export interface CreateEmployeeSuccess {
  row: EmployeeRow;
  warnings: EmployeeWriteWarning[];
  historySegment?: HistorySegment;
}

export interface UpdateEmployeeSuccess {
  row: EmployeeRow;
  warnings: EmployeeWriteWarning[];
  historySegment?: HistorySegment;
}

export interface ListEmployeesFilters {
  status?: 'active' | 'archived' | 'all';
  limit?: number;
  offset?: number;
}

export interface ListEmployeesSuccess {
  rows: EmployeeRow[];
}

export interface OpeningBalanceFields {
  opening_balance_weeks: number;
  opening_balance_taken_weeks: number | null;
  opening_balance_as_at_date: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
const EMPLOYMENT_TYPES: ReadonlyArray<EmploymentType> = [
  'full_time',
  'part_time',
  'casual',
  'salaried',
  'hourly',
];
const PAY_FREQUENCIES: ReadonlyArray<PayFrequency> = [
  'weekly',
  'fortnightly',
  'monthly',
  'four_weekly',
];
const SEXES: ReadonlyArray<Sex> = ['M', 'F', 'unspecified'];

/**
 * Service-layer soft cap on `employee_external_id`. The DB column has no
 * length CHECK (per DEV-EMP-2 spike 2026-05-31); the cap lives here so a
 * pathological input doesn't bloat the row.
 */
const EXTERNAL_ID_MAX_LEN = 128;

/**
 * Effective-dated field names — kept in sync with impl-plan §1.4. A patch
 * containing any of these triggers an `appendHistorySegment` call.
 */
const EFFECTIVE_DATED_FIELDS = [
  'employment_type',
  'pay_frequency',
  'classification',
  'hours_per_week',
  'default_work_jurisdiction',
] as const;

const OPENING_BALANCE_FIELDS = [
  'opening_balance_weeks',
  'opening_balance_taken_weeks',
  'opening_balance_as_at_date',
] as const;

/**
 * Default page size for `listEmployees`. The list UI in Phase 4 will use
 * virtual scrolling, but the service-layer cap protects against unbounded
 * fetches from misbehaving callers.
 */
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/** Column list for every read path. */
const EMPLOYEE_COLUMNS =
  'id, org_id, employee_external_id, full_name, start_date, end_date, archived_at, default_work_jurisdiction, employment_type, pay_frequency, sex, dob, classification, hours_per_week, scheme, opening_balance_weeks, opening_balance_taken_weeks, opening_balance_as_at_date, retention_expires_at, tags, created_at, updated_at, created_by, updated_by';

// ─── Pure validation ─────────────────────────────────────────────────────────

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

/**
 * Today's date (UTC) as `YYYY-MM-DD`. Used by `archiveEmployee` to default
 * `end_date` when null. Kept as a helper so tests can mock if needed.
 */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Validate the `CreateEmployeePayload` field-by-field. Returns the first
 * failure with a `field` set to the offending column name.
 *
 * Why not Zod here: the patch shape and create-payload shape diverge in
 * required-vs-optional handling, and writing two Zod schemas + the result
 * mapping adds more surface than a hand-rolled validator at this size.
 */
function validateCreatePayload(payload: CreateEmployeePayload): Result<CreateEmployeePayload> {
  // Required text fields.
  if (typeof payload.employee_external_id !== 'string' || payload.employee_external_id.trim() === '') {
    return err('validation_failed', 'employee_external_id is required', {
      field: 'employee_external_id',
    });
  }
  if (payload.employee_external_id.length > EXTERNAL_ID_MAX_LEN) {
    return err(
      'validation_failed',
      `employee_external_id exceeds ${EXTERNAL_ID_MAX_LEN}-char soft cap`,
      { field: 'employee_external_id' },
    );
  }
  if (typeof payload.full_name !== 'string' || payload.full_name.trim() === '') {
    return err('validation_failed', 'full_name is required', { field: 'full_name' });
  }
  if (typeof payload.start_date !== 'string' || payload.start_date === '') {
    return err('validation_failed', 'start_date is required', { field: 'start_date' });
  }
  if (!isValidIsoDate(payload.start_date)) {
    return err('validation_failed', 'start_date must be a real ISO date', {
      field: 'start_date',
    });
  }
  if (payload.end_date !== undefined && payload.end_date !== null) {
    if (!isValidIsoDate(payload.end_date)) {
      return err('validation_failed', 'end_date must be a real ISO date', { field: 'end_date' });
    }
    if (payload.end_date < payload.start_date) {
      return err('validation_failed', 'end_date cannot be before start_date', {
        field: 'end_date',
      });
    }
  }
  if (!JURISDICTIONS.includes(payload.default_work_jurisdiction)) {
    return err(
      'invalid_jurisdiction',
      `default_work_jurisdiction must be one of ${JURISDICTIONS.join('/')}`,
      { field: 'default_work_jurisdiction' },
    );
  }
  if (!EMPLOYMENT_TYPES.includes(payload.employment_type)) {
    return err(
      'invalid_employment_type',
      `employment_type must be one of ${EMPLOYMENT_TYPES.join('/')}`,
      { field: 'employment_type' },
    );
  }
  if (!PAY_FREQUENCIES.includes(payload.pay_frequency)) {
    return err(
      'invalid_pay_frequency',
      `pay_frequency must be one of ${PAY_FREQUENCIES.join('/')}`,
      { field: 'pay_frequency' },
    );
  }
  if (payload.sex !== undefined && payload.sex !== null && !SEXES.includes(payload.sex)) {
    return err('validation_failed', `sex must be one of ${SEXES.join('/')}`, { field: 'sex' });
  }
  if (payload.dob !== undefined && payload.dob !== null && !isValidIsoDate(payload.dob)) {
    return err('validation_failed', 'dob must be a real ISO date', { field: 'dob' });
  }
  if (payload.hours_per_week !== undefined && payload.hours_per_week !== null) {
    if (typeof payload.hours_per_week !== 'number' || !Number.isFinite(payload.hours_per_week)) {
      return err('validation_failed', 'hours_per_week must be a finite number', {
        field: 'hours_per_week',
      });
    }
    if (payload.hours_per_week < 0) {
      return err('validation_failed', 'hours_per_week must be non-negative', {
        field: 'hours_per_week',
      });
    }
  }
  if (payload.scheme !== undefined && payload.scheme !== 'state_lsl') {
    // v1 only writes state_lsl. AC-EMP-8 + AC-EMP-11.
    return err('invalid_scheme', `scheme must be 'state_lsl' in v1`, { field: 'scheme' });
  }
  return ok(payload);
}

/**
 * Validate an `UpdateEmployeePatch`. Each field is optional but must still
 * be shape-valid when present.
 */
function validateUpdatePatch(patch: UpdateEmployeePatch): Result<UpdateEmployeePatch> {
  if (patch.employee_external_id !== undefined) {
    if (typeof patch.employee_external_id !== 'string' || patch.employee_external_id.trim() === '') {
      return err('validation_failed', 'employee_external_id cannot be blank', {
        field: 'employee_external_id',
      });
    }
    if (patch.employee_external_id.length > EXTERNAL_ID_MAX_LEN) {
      return err(
        'validation_failed',
        `employee_external_id exceeds ${EXTERNAL_ID_MAX_LEN}-char soft cap`,
        { field: 'employee_external_id' },
      );
    }
  }
  if (patch.full_name !== undefined) {
    if (typeof patch.full_name !== 'string' || patch.full_name.trim() === '') {
      return err('validation_failed', 'full_name cannot be blank', { field: 'full_name' });
    }
  }
  if (patch.start_date !== undefined && !isValidIsoDate(patch.start_date)) {
    return err('validation_failed', 'start_date must be a real ISO date', {
      field: 'start_date',
    });
  }
  if (patch.end_date !== undefined && patch.end_date !== null && !isValidIsoDate(patch.end_date)) {
    return err('validation_failed', 'end_date must be a real ISO date', { field: 'end_date' });
  }
  if (
    patch.default_work_jurisdiction !== undefined &&
    !JURISDICTIONS.includes(patch.default_work_jurisdiction)
  ) {
    return err(
      'invalid_jurisdiction',
      `default_work_jurisdiction must be one of ${JURISDICTIONS.join('/')}`,
      { field: 'default_work_jurisdiction' },
    );
  }
  if (patch.employment_type !== undefined && !EMPLOYMENT_TYPES.includes(patch.employment_type)) {
    return err(
      'invalid_employment_type',
      `employment_type must be one of ${EMPLOYMENT_TYPES.join('/')}`,
      { field: 'employment_type' },
    );
  }
  if (patch.pay_frequency !== undefined && !PAY_FREQUENCIES.includes(patch.pay_frequency)) {
    return err(
      'invalid_pay_frequency',
      `pay_frequency must be one of ${PAY_FREQUENCIES.join('/')}`,
      { field: 'pay_frequency' },
    );
  }
  if (patch.sex !== undefined && patch.sex !== null && !SEXES.includes(patch.sex)) {
    return err('validation_failed', `sex must be one of ${SEXES.join('/')}`, { field: 'sex' });
  }
  if (patch.dob !== undefined && patch.dob !== null && !isValidIsoDate(patch.dob)) {
    return err('validation_failed', 'dob must be a real ISO date', { field: 'dob' });
  }
  if (patch.hours_per_week !== undefined && patch.hours_per_week !== null) {
    if (typeof patch.hours_per_week !== 'number' || !Number.isFinite(patch.hours_per_week)) {
      return err('validation_failed', 'hours_per_week must be a finite number', {
        field: 'hours_per_week',
      });
    }
    if (patch.hours_per_week < 0) {
      return err('validation_failed', 'hours_per_week must be non-negative', {
        field: 'hours_per_week',
      });
    }
  }
  if (patch.scheme !== undefined && patch.scheme !== 'state_lsl') {
    return err('invalid_scheme', `scheme must be 'state_lsl' in v1`, { field: 'scheme' });
  }
  return ok(patch);
}

// ─── PostgREST error translation ─────────────────────────────────────────────

/**
 * Translate a PostgREST/PostgreSQL error to a structured `ServiceError`.
 * Codes specific to the employees table:
 *   - 23505 on the case-insensitive UNIQUE index → `duplicate_external_id`
 *   - 42501 RLS → `rls_denied`
 *   - 23514 CHECK → `validation_failed` (catches enum drift)
 *   - 23P01 EXCLUDE → `history_overlap` (only via the history table path)
 */
function translatePostgrestError(pgError: { code?: string; message: string }): ReturnType<typeof err> {
  switch (pgError.code) {
    case '23505':
      return err('duplicate_external_id', pgError.message, {
        field: 'employee_external_id',
        detail: pgError,
      });
    case '23P01':
      return err('history_overlap', pgError.message, { detail: pgError });
    case '42501':
      return err('rls_denied', pgError.message);
    case '23514':
      return err('validation_failed', pgError.message, { detail: pgError });
    case 'PGRST116':
      return err('not_found', pgError.message);
    default:
      return err('db_error', pgError.message, { detail: pgError });
  }
}

// ─── Opening-balance policy lookup (PR #119 amendment) ───────────────────────

/**
 * Read the org's `opening_balances_method` from `public.organisations`.
 * RLS gates SELECT to org members; an invisible org → `not_found`.
 */
async function getOpeningBalancePolicy(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Result<OpeningBalancesMethod | null>> {
  const { data, error } = await supabase
    .from('organisations')
    .select('opening_balances_method')
    .eq('id', orgId)
    .maybeSingle();
  if (error) {
    return translatePostgrestError(error);
  }
  if (data === null || data === undefined) {
    return err('not_found', `organisation ${orgId} not found`);
  }
  const policy = (data as { opening_balances_method: OpeningBalancesMethod | null })
    .opening_balances_method;
  return ok(policy);
}

/**
 * Decide whether opening-balance fields in the payload may be written, and
 * what warning (if any) to emit. Implements the policy matrix from spec §3
 * (amended 2026-05-31, PR #119):
 *
 *   policy=setup_wizard + source=csv     → strip + warn
 *   policy=csv_field    + source=wizard  → strip + warn
 *   policy=both         + source=*       → write (collision overwrite warning)
 *   policy=none / NULL  + source=*       → reject (validation_failed)
 */
type PolicyDecision =
  | { kind: 'allow' }
  | { kind: 'strip'; warning: EmployeeWriteWarning }
  | { kind: 'reject' };

function decideOpeningBalancePolicy(
  policy: OpeningBalancesMethod | null,
  source: WriteSource,
): PolicyDecision {
  if (policy === null || policy === 'none') {
    return { kind: 'reject' };
  }
  if (policy === 'both') {
    return { kind: 'allow' };
  }
  if (policy === 'setup_wizard') {
    if (source === 'csv') {
      return { kind: 'strip', warning: 'csv_opening_balance_skipped_per_policy' };
    }
    return { kind: 'allow' };
  }
  // policy === 'csv_field'
  if (source === 'wizard') {
    return { kind: 'strip', warning: 'wizard_opening_balance_skipped_per_policy' };
  }
  return { kind: 'allow' };
}

/**
 * Returns true iff any of the three opening_balance_* keys are present in
 * the patch — `null` counts as present (an explicit clear is a write).
 */
function hasOpeningBalanceFields(
  patch: CreateEmployeePayload | UpdateEmployeePatch,
): boolean {
  for (const field of OPENING_BALANCE_FIELDS) {
    if (field in patch && (patch as Record<string, unknown>)[field] !== undefined) {
      return true;
    }
  }
  return false;
}

/**
 * Remove the three opening_balance_* keys from a payload object. Used when
 * the policy decision is `strip`. Returns a new object — does not mutate
 * the input.
 *
 * Typed as a generic with object-shape constraint so callers can pass
 * either a `CreateEmployeePayload` or an `UpdateEmployeePatch` and keep
 * the exact return type.
 */
function stripOpeningBalanceFields<T extends object>(payload: T): T {
  const out: Record<string, unknown> = { ...(payload as Record<string, unknown>) };
  for (const field of OPENING_BALANCE_FIELDS) {
    delete out[field];
  }
  return out as T;
}

// ─── createEmployee ──────────────────────────────────────────────────────────

export async function createEmployee(
  supabase: SupabaseClient,
  orgId: string,
  payload: CreateEmployeePayload,
  opts: CreateEmployeeOpts,
): Promise<Result<CreateEmployeeSuccess>> {
  // ── Pre-DB validation ────────────────────────────────────────────────────
  if (!UUID_REGEX.test(orgId)) {
    return err('validation_failed', 'org_id must be a uuid', { field: 'org_id' });
  }
  if (!UUID_REGEX.test(opts.userId)) {
    return err('validation_failed', 'user_id must be a uuid', { field: 'user_id' });
  }
  const validation = validateCreatePayload(payload);
  if (!validation.ok) return validation;

  const warnings: EmployeeWriteWarning[] = [];
  const source: WriteSource = opts.source ?? 'wizard';
  let writePayload: CreateEmployeePayload = payload;

  // ── Opening-balance policy resolution (PR #119) ─────────────────────────
  if (hasOpeningBalanceFields(payload)) {
    const policyResult = await getOpeningBalancePolicy(supabase, orgId);
    if (!policyResult.ok) return policyResult;
    const decision = decideOpeningBalancePolicy(policyResult.data, source);
    if (decision.kind === 'reject') {
      return err(
        'validation_failed',
        'opening_balance writes are not permitted by the org policy',
        { detail: { reason: 'opening_balance_policy_not_set', policy: policyResult.data } },
      );
    }
    if (decision.kind === 'strip') {
      writePayload = stripOpeningBalanceFields(payload);
      warnings.push(decision.warning);
    }
    // 'allow' → no change.
  }

  // ── Soft warnings for TAS / NT missing fields (AC-EMP-10) ────────────────
  if (writePayload.default_work_jurisdiction === 'TAS' && writePayload.sex == null) {
    warnings.push('tas_missing_sex');
  }
  if (writePayload.default_work_jurisdiction === 'NT' && writePayload.dob == null) {
    warnings.push('nt_missing_dob');
  }

  // ── Build insert row ────────────────────────────────────────────────────
  const insertRow: Record<string, unknown> = {
    org_id: orgId,
    employee_external_id: writePayload.employee_external_id,
    full_name: writePayload.full_name,
    start_date: writePayload.start_date,
    default_work_jurisdiction: writePayload.default_work_jurisdiction,
    employment_type: writePayload.employment_type,
    pay_frequency: writePayload.pay_frequency,
    scheme: writePayload.scheme ?? 'state_lsl',
    created_by: opts.userId,
    updated_by: opts.userId,
  };
  if (writePayload.end_date !== undefined) insertRow.end_date = writePayload.end_date;
  if (writePayload.sex !== undefined) insertRow.sex = writePayload.sex;
  if (writePayload.dob !== undefined) insertRow.dob = writePayload.dob;
  if (writePayload.classification !== undefined) insertRow.classification = writePayload.classification;
  if (writePayload.hours_per_week !== undefined) insertRow.hours_per_week = writePayload.hours_per_week;
  if (writePayload.opening_balance_weeks !== undefined)
    insertRow.opening_balance_weeks = writePayload.opening_balance_weeks;
  if (writePayload.opening_balance_taken_weeks !== undefined)
    insertRow.opening_balance_taken_weeks = writePayload.opening_balance_taken_weeks;
  if (writePayload.opening_balance_as_at_date !== undefined)
    insertRow.opening_balance_as_at_date = writePayload.opening_balance_as_at_date;
  if (writePayload.tags !== undefined) insertRow.tags = writePayload.tags;

  // ── INSERT employees ────────────────────────────────────────────────────
  const { data: insertedRow, error: insertError } = await supabase
    .from('employees')
    .insert(insertRow)
    .select(EMPLOYEE_COLUMNS)
    .single();

  if (insertError) {
    return translatePostgrestError(insertError);
  }
  if (insertedRow === null || insertedRow === undefined) {
    return err('db_error', 'insert returned no row');
  }
  const row = insertedRow as unknown as EmployeeRow;

  // ── INSERT initial history segment ──────────────────────────────────────
  // Per impl-plan §1.4 + AC-EMP-5: the engine-load-bearing fields need a
  // baseline history row. We insert directly (no close-segment step — there
  // is no prior segment for a brand-new employee).
  const initialSegment: Record<string, unknown> = {
    employee_id: row.id,
    org_id: orgId,
    effective_from: row.start_date,
    effective_to: null,
    employment_type: row.employment_type,
    pay_frequency: row.pay_frequency,
    default_work_jurisdiction: row.default_work_jurisdiction,
    change_reason: 'initial',
    created_by: opts.userId,
  };
  if (row.classification !== null) initialSegment.classification = row.classification;
  if (row.hours_per_week !== null) initialSegment.hours_per_week = row.hours_per_week;

  const { data: segmentData, error: segmentError } = await supabase
    .from('employee_history')
    .insert(initialSegment)
    .select(
      'id, employee_id, org_id, effective_from, effective_to, employment_type, pay_frequency, classification, hours_per_week, default_work_jurisdiction, change_reason, created_at, created_by',
    )
    .single();

  if (segmentError) {
    // The employees row is already inserted — surface the segment failure
    // so callers can decide whether to compensate (Phase 3 wraps both calls
    // in a route handler; the route handler can choose to delete the just-
    // inserted employees row on segment failure).
    return translatePostgrestError(segmentError);
  }

  const segment = segmentData as unknown as HistorySegment | null;
  const success: CreateEmployeeSuccess = { row, warnings };
  if (segment !== null && segment !== undefined) {
    success.historySegment = segment;
  }
  return ok(success);
}

// ─── updateEmployee ──────────────────────────────────────────────────────────

export async function updateEmployee(
  supabase: SupabaseClient,
  employeeId: string,
  patch: UpdateEmployeePatch,
  opts: UpdateEmployeeOpts,
): Promise<Result<UpdateEmployeeSuccess>> {
  if (!UUID_REGEX.test(employeeId)) {
    return err('validation_failed', 'employee_id must be a uuid', { field: 'employee_id' });
  }
  if (!UUID_REGEX.test(opts.userId)) {
    return err('validation_failed', 'user_id must be a uuid', { field: 'user_id' });
  }
  const validation = validateUpdatePatch(patch);
  if (!validation.ok) return validation;

  // ── Detect effective-dated changes upfront ──────────────────────────────
  const effectiveDatedKeys = EFFECTIVE_DATED_FIELDS.filter(
    (field) => field in patch && (patch as Record<string, unknown>)[field] !== undefined,
  );
  if (effectiveDatedKeys.length > 0 && !opts.effectiveFrom) {
    return err(
      'validation_failed',
      'effective_from is required when the patch includes an effective-dated field',
      { field: 'effective_from' },
    );
  }
  if (opts.effectiveFrom !== undefined && !isValidIsoDate(opts.effectiveFrom)) {
    return err('validation_failed', 'effective_from must be a real ISO date', {
      field: 'effective_from',
    });
  }

  const warnings: EmployeeWriteWarning[] = [];
  const source: WriteSource = opts.source ?? 'wizard';
  let writePatch: UpdateEmployeePatch = patch;
  let priorOrgId: string | null = null;

  // ── Opening-balance policy resolution ───────────────────────────────────
  if (hasOpeningBalanceFields(patch)) {
    // Read the employee row first to learn org_id (we don't take it as a
    // param — RLS does not give us org_id leakage anyway) AND its current
    // opening_balance_weeks (for the `csv_value_overwritten` collision flag).
    const { data: priorRow, error: priorErr } = await supabase
      .from('employees')
      .select('org_id, opening_balance_weeks')
      .eq('id', employeeId)
      .maybeSingle();
    if (priorErr) return translatePostgrestError(priorErr);
    if (priorRow === null || priorRow === undefined) {
      return err('not_found', `employee ${employeeId} not found`);
    }
    const typedPrior = priorRow as { org_id: string; opening_balance_weeks: number | null };
    priorOrgId = typedPrior.org_id;

    const policyResult = await getOpeningBalancePolicy(supabase, priorOrgId);
    if (!policyResult.ok) return policyResult;
    const decision = decideOpeningBalancePolicy(policyResult.data, source);

    if (decision.kind === 'reject') {
      return err(
        'validation_failed',
        'opening_balance writes are not permitted by the org policy',
        { detail: { reason: 'opening_balance_policy_not_set', policy: policyResult.data } },
      );
    }
    if (decision.kind === 'strip') {
      writePatch = stripOpeningBalanceFields(patch);
      warnings.push(decision.warning);
    } else if (
      // 'allow' under policy='both' + wizard source + prior CSV value present
      // → emit the collision warning per AC-EMP-12.
      policyResult.data === 'both' &&
      source === 'wizard' &&
      typedPrior.opening_balance_weeks !== null &&
      patch.opening_balance_weeks !== undefined &&
      patch.opening_balance_weeks !== typedPrior.opening_balance_weeks
    ) {
      warnings.push('csv_value_overwritten');
    }
  }

  // ── Build patch object for the UPDATE ───────────────────────────────────
  const updatePayload: Record<string, unknown> = { updated_by: opts.userId };
  // Copy across only the keys the caller supplied — leaves other columns
  // untouched. Note we use `writePatch` here so stripped fields don't leak.
  for (const key of Object.keys(writePatch)) {
    const value = (writePatch as Record<string, unknown>)[key];
    if (value === undefined) continue;
    updatePayload[key] = value;
  }

  // Re-order with the policy reads from above: if we already read the org_id
  // for opening-balance policy, the SELECT in the chain is correctly
  // scripted; otherwise the first `.from('employees')` call is the UPDATE
  // directly.
  const { data: updatedRow, error: updateError } = await supabase
    .from('employees')
    .update(updatePayload)
    .eq('id', employeeId)
    .select(EMPLOYEE_COLUMNS)
    .maybeSingle();

  if (updateError) {
    return translatePostgrestError(updateError);
  }
  if (updatedRow === null || updatedRow === undefined) {
    return err('not_found', `employee ${employeeId} not found`);
  }
  const row = updatedRow as unknown as EmployeeRow;

  // ── Append history segment (when effective-dated fields changed) ────────
  let historySegment: HistorySegment | undefined;
  if (effectiveDatedKeys.length > 0) {
    // We have opts.effectiveFrom by construction (validated above).
    const changes: EffectiveDatedFields = {};
    if (patch.employment_type !== undefined) changes.employment_type = patch.employment_type;
    if (patch.pay_frequency !== undefined) changes.pay_frequency = patch.pay_frequency;
    if (patch.classification !== undefined) changes.classification = patch.classification;
    if (patch.hours_per_week !== undefined) changes.hours_per_week = patch.hours_per_week;
    if (patch.default_work_jurisdiction !== undefined)
      changes.default_work_jurisdiction = patch.default_work_jurisdiction;

    const segmentResult = await appendHistorySegment(supabase, {
      employeeId,
      orgId: row.org_id,
      effectiveFrom: opts.effectiveFrom!,
      changes,
      userId: opts.userId,
      changeReason: opts.changeReason,
    });
    if (!segmentResult.ok) return segmentResult;
    historySegment = segmentResult.data;
  }

  const success: UpdateEmployeeSuccess = { row, warnings };
  if (historySegment) success.historySegment = historySegment;
  return ok(success);
}

// ─── getEmployee ─────────────────────────────────────────────────────────────

export async function getEmployee(
  supabase: SupabaseClient,
  employeeId: string,
): Promise<Result<EmployeeRow>> {
  if (!UUID_REGEX.test(employeeId)) {
    return err('validation_failed', 'employee_id must be a uuid', { field: 'employee_id' });
  }
  const { data, error } = await supabase
    .from('employees')
    .select(EMPLOYEE_COLUMNS)
    .eq('id', employeeId)
    .maybeSingle();
  if (error) return translatePostgrestError(error);
  if (data === null || data === undefined) {
    return err('not_found', `employee ${employeeId} not found`);
  }
  return ok(data as unknown as EmployeeRow);
}

// ─── listEmployees ───────────────────────────────────────────────────────────

export async function listEmployees(
  supabase: SupabaseClient,
  orgId: string,
  filters?: ListEmployeesFilters,
): Promise<Result<ListEmployeesSuccess>> {
  if (!UUID_REGEX.test(orgId)) {
    return err('validation_failed', 'org_id must be a uuid', { field: 'org_id' });
  }
  const limit = filters?.limit ?? DEFAULT_LIMIT;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit <= 0 || limit > MAX_LIMIT) {
    return err('validation_failed', `limit must be 1..${MAX_LIMIT}`, { field: 'limit' });
  }
  const offset = filters?.offset ?? 0;
  if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
    return err('validation_failed', 'offset must be a non-negative integer', { field: 'offset' });
  }
  const status = filters?.status ?? 'active';

  // Build the chain. PostgREST: `.from(table).select(cols).eq('org_id', id).is/order/range`.
  // Status filter is applied via `.is('archived_at', null)` / `.not('archived_at', 'is', null)`.
  // The chain is fluent — each call returns the builder, the terminal is a thenable.
  let query = supabase.from('employees').select(EMPLOYEE_COLUMNS).eq('org_id', orgId);
  if (status === 'active') {
    query = (query as { is: (col: string, val: unknown) => typeof query }).is('archived_at', null);
  } else if (status === 'archived') {
    query = (query as {
      not: (col: string, op: string, val: unknown) => typeof query;
    }).not('archived_at', 'is', null);
  }
  // Pagination + ordering.
  query = (query as {
    order: (col: string, opts: { ascending: boolean }) => typeof query;
  }).order('created_at', { ascending: false });
  query = (query as {
    range: (from: number, to: number) => typeof query;
  }).range(offset, offset + limit - 1);

  const { data, error } = await (query as unknown as Promise<{
    data: unknown[] | null;
    error: { code?: string; message: string } | null;
  }>);
  if (error) return translatePostgrestError(error);
  return ok({ rows: (data ?? []) as unknown as EmployeeRow[] });
}

// ─── archiveEmployee ─────────────────────────────────────────────────────────

export async function archiveEmployee(
  supabase: SupabaseClient,
  employeeId: string,
  opts: ArchiveOpts,
): Promise<Result<EmployeeRow>> {
  if (!UUID_REGEX.test(employeeId)) {
    return err('validation_failed', 'employee_id must be a uuid', { field: 'employee_id' });
  }
  if (!UUID_REGEX.test(opts.userId)) {
    return err('validation_failed', 'user_id must be a uuid', { field: 'user_id' });
  }
  // Read current end_date to decide whether to backfill it. The retention
  // trigger (Migration 4) fires on end_date INSERT/UPDATE — backfilling
  // when null is what kicks off the 7-year clock from the archive date.
  const { data: existing, error: readErr } = await supabase
    .from('employees')
    .select('end_date')
    .eq('id', employeeId)
    .maybeSingle();
  if (readErr) return translatePostgrestError(readErr);
  if (existing === null || existing === undefined) {
    return err('not_found', `employee ${employeeId} not found`);
  }

  const typedExisting = existing as { end_date: string | null };
  const patch: Record<string, unknown> = {
    archived_at: new Date().toISOString(),
    updated_by: opts.userId,
  };
  if (typedExisting.end_date === null) {
    patch.end_date = todayIso();
  }

  const { data: updated, error: updateErr } = await supabase
    .from('employees')
    .update(patch)
    .eq('id', employeeId)
    .select(EMPLOYEE_COLUMNS)
    .maybeSingle();
  if (updateErr) return translatePostgrestError(updateErr);
  if (updated === null || updated === undefined) {
    return err('not_found', `employee ${employeeId} not found`);
  }
  return ok(updated as unknown as EmployeeRow);
}

// ─── reactivateEmployee ──────────────────────────────────────────────────────

export async function reactivateEmployee(
  supabase: SupabaseClient,
  employeeId: string,
  opts: ArchiveOpts,
): Promise<Result<EmployeeRow>> {
  if (!UUID_REGEX.test(employeeId)) {
    return err('validation_failed', 'employee_id must be a uuid', { field: 'employee_id' });
  }
  if (!UUID_REGEX.test(opts.userId)) {
    return err('validation_failed', 'user_id must be a uuid', { field: 'user_id' });
  }
  // Setting end_date = NULL clears retention_expires_at via Migration 4
  // trigger. archived_at is independent of the retention clock.
  const { data: updated, error: updateErr } = await supabase
    .from('employees')
    .update({ archived_at: null, end_date: null, updated_by: opts.userId })
    .eq('id', employeeId)
    .select(EMPLOYEE_COLUMNS)
    .maybeSingle();
  if (updateErr) return translatePostgrestError(updateErr);
  if (updated === null || updated === undefined) {
    return err('not_found', `employee ${employeeId} not found`);
  }
  return ok(updated as unknown as EmployeeRow);
}

// ─── getOpeningBalance (scope-trim absorption from Task 2.8) ─────────────────

export async function getOpeningBalance(
  supabase: SupabaseClient,
  employeeId: string,
): Promise<Result<OpeningBalanceFields | null>> {
  if (!UUID_REGEX.test(employeeId)) {
    return err('validation_failed', 'employee_id must be a uuid', { field: 'employee_id' });
  }
  const { data, error } = await supabase
    .from('employees')
    .select('opening_balance_weeks, opening_balance_taken_weeks, opening_balance_as_at_date')
    .eq('id', employeeId)
    .maybeSingle();
  if (error) return translatePostgrestError(error);
  if (data === null || data === undefined) {
    return err('not_found', `employee ${employeeId} not found`);
  }
  const typed = data as {
    opening_balance_weeks: number | null;
    opening_balance_taken_weeks: number | null;
    opening_balance_as_at_date: string | null;
  };
  // "All-null" → return `null` (no opening balance captured).
  if (
    typed.opening_balance_weeks === null &&
    typed.opening_balance_taken_weeks === null &&
    typed.opening_balance_as_at_date === null
  ) {
    return ok(null);
  }
  return ok({
    opening_balance_weeks: typed.opening_balance_weeks ?? 0,
    opening_balance_taken_weeks: typed.opening_balance_taken_weeks,
    opening_balance_as_at_date: typed.opening_balance_as_at_date,
  });
}

// ─── clearOpeningBalance (scope-trim absorption from Task 2.8) ───────────────

export async function clearOpeningBalance(
  supabase: SupabaseClient,
  employeeId: string,
  opts: ArchiveOpts,
): Promise<Result<EmployeeRow>> {
  if (!UUID_REGEX.test(employeeId)) {
    return err('validation_failed', 'employee_id must be a uuid', { field: 'employee_id' });
  }
  if (!UUID_REGEX.test(opts.userId)) {
    return err('validation_failed', 'user_id must be a uuid', { field: 'user_id' });
  }
  const { data, error } = await supabase
    .from('employees')
    .update({
      opening_balance_weeks: null,
      opening_balance_taken_weeks: null,
      opening_balance_as_at_date: null,
      updated_by: opts.userId,
    })
    .eq('id', employeeId)
    .select(EMPLOYEE_COLUMNS)
    .maybeSingle();
  if (error) return translatePostgrestError(error);
  if (data === null || data === undefined) {
    return err('not_found', `employee ${employeeId} not found`);
  }
  return ok(data as unknown as EmployeeRow);
}
