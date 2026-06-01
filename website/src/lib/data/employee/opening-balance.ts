/**
 * Opening-balance reconciliation.
 *
 * Phase 2 (Task 2.8) per E5.2 Employee Masterfile + Customer Setup.
 *
 * Two pure functions in this module:
 *
 *   1. `validateOpeningBalance(payload)`
 *      Pure validator. Checks numeric ranges + date sanity + cross-field
 *      invariants (taken ≤ accrued; no future as-at date; taken cannot exist
 *      without accrued). Returns `Result<OpeningBalance, ServiceError>`.
 *
 *   2. `reconcileOpeningBalance({ csvValue, wizardValue })`
 *      Pure reconciler. Applies AC-EMP-12 collision rule: "wizard wins on
 *      collision" (locked 2026-05-27 per spec §7 OQ-EMP-1). Returns the
 *      winning balance, the provenance (`'csv_field'` / `'setup_wizard'` /
 *      `null`), and any warning markers (`'csv_value_overwritten'`).
 *
 * DB writes are NOT in this file — Task 2.6 (employee CRUD service) owns
 * the `employees.opening_balance_*` upsert. This module is the pure
 * reconciliation contract Task 2.6 consumes.
 *
 * Collision-resolution design question — see PR body.
 *   The schema doesn't store a per-employee "source" flag, so persisted
 *   collision detection has to come from somewhere. Three options live
 *   in the PR body; Option 2 (drive collision behaviour from the org's
 *   `opening_balances_method` policy column) is the recommended path.
 *   This module's pure reconciler is policy-agnostic — both sources are
 *   passed in as candidate values. The policy decision sits one layer up
 *   in the route handler / employee CRUD service (Task 2.6).
 *
 * Refs:
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §4.2, §7 OQ-EMP-1
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-tasks.md §Task 2.8
 *   - AC-EMP-12 (wizard wins on collision; locked 2026-05-27)
 *   - DB columns: employees.opening_balance_weeks (numeric(8,4)),
 *                 employees.opening_balance_taken_weeks (numeric(8,4)),
 *                 employees.opening_balance_as_at_date (date).
 */

import { err, ok, type Result } from './types';

// ─── Domain types ────────────────────────────────────────────────────────────

/**
 * Canonical opening-balance shape. All three fields are optional — a fully
 * empty `OpeningBalance` is a valid value (means "no opening balance
 * captured"). When fields are populated, they are co-dependent: `taken_weeks`
 * cannot exceed `weeks`, and `taken_weeks` cannot exist without `weeks`.
 *
 * The shape mirrors the three columns on `public.employees` (Migration 2 —
 * `opening_balance_weeks`, `opening_balance_taken_weeks`,
 * `opening_balance_as_at_date`).
 */
export interface OpeningBalance {
  /** Accrued LSL weeks at go-live. numeric(8,4) → 0 ≤ x ≤ 9999.9999. */
  opening_balance_weeks?: number;
  /** LSL weeks already taken against the accrued balance at go-live. */
  opening_balance_taken_weeks?: number;
  /** ISO date string (YYYY-MM-DD) — the as-at date for the two fields above. */
  opening_balance_as_at_date?: string;
}

/**
 * Provenance of the reconciled value.
 *
 * `null` means neither source supplied a meaningful value (the all-empty
 * case 4 in AC-EMP-12). Otherwise the source that won.
 */
export type OpeningBalanceSource = 'csv_field' | 'setup_wizard';

/**
 * The shape `reconcileOpeningBalance` returns.
 *
 * `warnings` is an open-ended list of soft markers the caller may surface
 * (e.g. in the upload preview UI). Currently the only marker emitted is
 * `'csv_value_overwritten'` — fired when wizard input overrides a present
 * CSV input.
 */
export interface ReconciledOpeningBalance {
  balance: OpeningBalance;
  source: OpeningBalanceSource | null;
  warnings: string[];
}

/**
 * Loose payload shape accepted by `validateOpeningBalance`. Permits `null`
 * for any field (CSV parsers and form submissions both commonly emit `null`
 * for absent values) and `unknown` for everything because the validator
 * itself is what narrows the shape.
 */
export interface OpeningBalanceInput {
  opening_balance_weeks?: number | null;
  opening_balance_taken_weeks?: number | null;
  opening_balance_as_at_date?: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * numeric(8,4) → up to four digits before the decimal point (= 9999) and four
 * after. The Postgres type rejects > 9999.9999; we mirror that in the validator
 * so the failure surfaces at parse time instead of at insert time.
 */
const MAX_BALANCE_WEEKS = 9999.9999;

/**
 * Strict ISO calendar-date regex (YYYY-MM-DD). Deliberately narrow — we do
 * NOT accept other formats (DD/MM/YYYY etc.) at this layer. Upstream parsers
 * are expected to normalise.
 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── validateOpeningBalance ──────────────────────────────────────────────────

/**
 * Validate a candidate opening-balance payload.
 *
 * Pure — no DB calls, no clock reads beyond `new Date()` for the
 * "no future as-at date" check. Returns `Result<OpeningBalance>` so the
 * caller can branch on `result.ok` without inspecting strings.
 *
 * Validation rules (mirror spec §4.2 column constraints):
 *   - `opening_balance_weeks` — optional; finite; non-negative; ≤ 9999.9999.
 *   - `opening_balance_taken_weeks` — optional; finite; non-negative;
 *      requires `opening_balance_weeks` to be set; ≤ `opening_balance_weeks`.
 *   - `opening_balance_as_at_date` — optional; strict ISO YYYY-MM-DD;
 *      a real calendar date (no `2024-02-30`); not in the future.
 */
export function validateOpeningBalance(
  input: OpeningBalanceInput,
): Result<OpeningBalance> {
  // Normalise null → undefined so downstream callers see a single shape.
  const weeks = input.opening_balance_weeks ?? undefined;
  const taken = input.opening_balance_taken_weeks ?? undefined;
  const asAt = input.opening_balance_as_at_date ?? undefined;

  // ── opening_balance_weeks ──────────────────────────────────────────────
  if (weeks !== undefined) {
    if (typeof weeks !== 'number' || !Number.isFinite(weeks)) {
      return err('validation_failed', 'opening_balance_weeks must be a finite number', {
        field: 'opening_balance_weeks',
      });
    }
    if (weeks < 0) {
      return err('validation_failed', 'opening_balance_weeks must be non-negative', {
        field: 'opening_balance_weeks',
      });
    }
    if (weeks > MAX_BALANCE_WEEKS) {
      return err(
        'validation_failed',
        `opening_balance_weeks must be ≤ ${MAX_BALANCE_WEEKS}`,
        { field: 'opening_balance_weeks' },
      );
    }
  }

  // ── opening_balance_taken_weeks ────────────────────────────────────────
  if (taken !== undefined) {
    if (typeof taken !== 'number' || !Number.isFinite(taken)) {
      return err(
        'validation_failed',
        'opening_balance_taken_weeks must be a finite number',
        { field: 'opening_balance_taken_weeks' },
      );
    }
    if (taken < 0) {
      return err(
        'validation_failed',
        'opening_balance_taken_weeks must be non-negative',
        { field: 'opening_balance_taken_weeks' },
      );
    }
    if (weeks === undefined) {
      return err(
        'validation_failed',
        'opening_balance_taken_weeks requires opening_balance_weeks to be set',
        { field: 'opening_balance_taken_weeks' },
      );
    }
    if (taken > weeks) {
      return err(
        'validation_failed',
        'opening_balance_taken_weeks cannot exceed opening_balance_weeks',
        { field: 'opening_balance_taken_weeks' },
      );
    }
  }

  // ── opening_balance_as_at_date ─────────────────────────────────────────
  if (asAt !== undefined) {
    if (typeof asAt !== 'string' || !ISO_DATE_RE.test(asAt)) {
      return err(
        'validation_failed',
        'opening_balance_as_at_date must be an ISO date (YYYY-MM-DD)',
        { field: 'opening_balance_as_at_date' },
      );
    }
    // Calendar-date sanity — `2024-13-99` matches the regex but parses to
    // `Invalid Date` (or normalises to a different month).
    const parsed = new Date(`${asAt}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      return err(
        'validation_failed',
        'opening_balance_as_at_date is not a real calendar date',
        { field: 'opening_balance_as_at_date' },
      );
    }
    // Round-trip check — guards against silent normalisation (e.g.
    // 2024-02-30 → 2024-03-01).
    const roundTrip = parsed.toISOString().slice(0, 10);
    if (roundTrip !== asAt) {
      return err(
        'validation_failed',
        'opening_balance_as_at_date is not a real calendar date',
        { field: 'opening_balance_as_at_date' },
      );
    }
    // Future-date guard — the as-at date cannot be in the future. Compared
    // at UTC midnight to avoid TZ-edge flakes around the date boundary.
    const todayMidnightUtc = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    if (parsed.getTime() > todayMidnightUtc.getTime()) {
      return err(
        'validation_failed',
        'opening_balance_as_at_date cannot be in the future',
        { field: 'opening_balance_as_at_date' },
      );
    }
  }

  // ── Build normalised output ────────────────────────────────────────────
  const balance: OpeningBalance = {};
  if (weeks !== undefined) balance.opening_balance_weeks = weeks;
  if (taken !== undefined) balance.opening_balance_taken_weeks = taken;
  if (asAt !== undefined) balance.opening_balance_as_at_date = asAt;
  return ok(balance);
}

// ─── reconcileOpeningBalance ─────────────────────────────────────────────────

/**
 * Reconcile a CSV-supplied opening balance with a wizard-supplied opening
 * balance per AC-EMP-12 (locked 2026-05-27).
 *
 * Rule: wizard wins on collision.
 *   - Both present → wizard wins; emits `'csv_value_overwritten'` warning.
 *   - CSV only     → CSV wins; no warnings.
 *   - Wizard only  → wizard wins; no warnings.
 *   - Neither      → empty balance; source `null`.
 *
 * "Present" means the payload has at least one defined field — an empty
 * object `{}` is treated as "not present" so an empty wizard form
 * submission does NOT clobber a valid CSV value.
 *
 * Wizard wins atomically — when wizard is the winner, the entire returned
 * balance is the wizard's shape (no field-by-field merge with CSV). This
 * preserves operator intent: a wizard entry is a deliberate post-import
 * correction, not a partial overlay.
 *
 * Returned balance is a defensive copy of the winner — mutating it cannot
 * mutate either input.
 */
export function reconcileOpeningBalance(args: {
  csvValue: OpeningBalance | null | undefined;
  wizardValue: OpeningBalance | null | undefined;
}): ReconciledOpeningBalance {
  const csvPresent = hasAnyField(args.csvValue);
  const wizardPresent = hasAnyField(args.wizardValue);

  // Case 4: neither — empty result.
  if (!csvPresent && !wizardPresent) {
    return { balance: {}, source: null, warnings: [] };
  }

  // Case 3: wizard only — wizard wins; no warnings.
  if (!csvPresent && wizardPresent) {
    return {
      balance: copyBalance(args.wizardValue!),
      source: 'setup_wizard',
      warnings: [],
    };
  }

  // Case 2: CSV only — CSV wins; no warnings.
  if (csvPresent && !wizardPresent) {
    return {
      balance: copyBalance(args.csvValue!),
      source: 'csv_field',
      warnings: [],
    };
  }

  // Case 1: both — wizard wins atomically; emit warning.
  return {
    balance: copyBalance(args.wizardValue!),
    source: 'setup_wizard',
    warnings: ['csv_value_overwritten'],
  };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * True iff the payload has at least one defined field. Zero counts as
 * defined — a tenured employee with zero opening balance is a meaningful
 * input.
 */
function hasAnyField(b: OpeningBalance | null | undefined): boolean {
  if (b === null || b === undefined) return false;
  return (
    b.opening_balance_weeks !== undefined ||
    b.opening_balance_taken_weeks !== undefined ||
    b.opening_balance_as_at_date !== undefined
  );
}

/**
 * Shallow defensive copy of an `OpeningBalance`. The three field types are
 * all primitives (number / string), so a shallow copy is enough — no deep
 * cloning needed.
 */
function copyBalance(b: OpeningBalance): OpeningBalance {
  const out: OpeningBalance = {};
  if (b.opening_balance_weeks !== undefined)
    out.opening_balance_weeks = b.opening_balance_weeks;
  if (b.opening_balance_taken_weeks !== undefined)
    out.opening_balance_taken_weeks = b.opening_balance_taken_weeks;
  if (b.opening_balance_as_at_date !== undefined)
    out.opening_balance_as_at_date = b.opening_balance_as_at_date;
  return out;
}
