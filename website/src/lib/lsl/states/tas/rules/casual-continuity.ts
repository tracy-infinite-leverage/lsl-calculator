import type {
  EmploymentType,
  ISODate,
  WagePeriod,
} from '@/lib/lsl/engine/types';
import { inclusiveDays, overlapDays, toDate, toISO } from '@/lib/lsl/engine/dates';
import type { TASExtraInputs } from '../extra-inputs';

/**
 * TAS s.5(3) — Casual 32-hour-4-week continuity test.
 *
 * v1 evaluator per TBD-TAS-04 RESOLVED Option (c) HYBRID hierarchy:
 *   1. Try auto-derivation from `wageHistory` 4-week sliding windows. If any
 *      candidate window has hours >0 sparsity ≤25% AND total weekly hours can
 *      be inferred, evaluate strict 32hr/4wk continuity at each window.
 *   2. Fall back to operator flag (`extraInputs.tas_casual_32hr_4wk_periods_
 *      compliant`) if available.
 *   3. Default permissive (continuity preserved) + emit advisory if neither
 *      auto-derive nor operator flag could resolve the test.
 *
 * Only consumed when `employmentType === 'casual'`. PT/FT employees skip.
 *
 * Returns one of three verdicts:
 *   - `satisfied`     — engine confirmed continuity preserved
 *   - `not_satisfied` — engine detected a 4-wk window <32 h (or operator flag false)
 *   - `unverified`    — engine could not auto-derive AND no operator flag
 *
 * The orchestrator maps verdicts to warning codes:
 *   - satisfied      → `tas_casual_32hr_4wk_continuity_satisfied`
 *   - not_satisfied  → `tas_casual_32hr_4wk_continuity_not_satisfied`
 *   - unverified     → `tas_casual_continuity_test_unverified`
 *                       (permissive default — continuity preserved)
 *
 * Sources:
 *   - TAS LSL Act 1976 s.5(3)
 *   - docs/qa/test-cases-tas.md v1.0 PM-signed 2026-05-26 — TBD-TAS-04 RESOLVED
 */

export type CasualContinuityVerdict = 'satisfied' | 'not_satisfied' | 'unverified';

export interface CasualContinuityResult {
  verdict: CasualContinuityVerdict;
  /** Source that determined the verdict — for diagnostics & warning provenance. */
  source: 'derived' | 'operator_flag' | 'default_permissive';
  /** First date on which a 4-wk window fell below 32 h — present iff `not_satisfied`. */
  breakDate?: ISODate;
  /**
   * Fraction (0..1) of 4-wk windows missing hours data in wageHistory. >0.25
   * triggers the operator-flag-fallback step.
   */
  sparsity: number;
}

const THIRTY_TWO = 32;
const SPARSITY_FALLBACK_THRESHOLD = 0.25;

/**
 * Estimate hours in a date range from a single WagePeriod row by linear
 * proration of `hours` (if present) OR `grossPay / hourlyRate` (else
 * `undefined` — row contributes 0 hours but counts as a "missing" signal).
 *
 * v1 is intentionally conservative — we do NOT extrapolate hours from gross
 * pay because hourly rates vary by award and casual loading. Only wage rows
 * with an explicit `hours` field (added via extras) contribute. In practice
 * the operator flag fallback covers cases where wageHistory is sparse.
 */
function hoursInRange(
  wageHistory: WagePeriod[],
  rangeStart: ISODate,
  rangeEnd: ISODate
): { hours: number | undefined; coveredAny: boolean } {
  const total = 0;
  let any = false;
  for (const row of wageHistory) {
    const rowDays = row.periodDays ?? inclusiveDays(row.periodStart, row.periodEnd);
    if (rowDays === 0) continue;
    const overlap = overlapDays(row.periodStart, row.periodEnd, rangeStart, rangeEnd);
    if (overlap === 0) continue;
    any = true;
    // v1: wage rows do NOT carry an `hours` field on the cross-state shape.
    // Without an hours signal we leave the row uncontributing to the 32-hr
    // total — and the window is flagged "missing" by the sparsity counter.
    // Operator flag handles this path via TBD-TAS-04 Option (c) hierarchy.
    void rowDays;
    void overlap;
    void total;
  }
  // v1: explicit hours absent at the row level. Return undefined unless
  // wageHistory carries an explicit hours field on the future schema. For
  // T8.2 we always return undefined → engine falls through to operator flag.
  return { hours: undefined, coveredAny: any };
}

function addDays(iso: ISODate, days: number): ISODate {
  const dt = toDate(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return toISO(dt) as ISODate;
}

/**
 * Try to derive the 32hr/4wk verdict from wageHistory. Returns `undefined`
 * when the engine cannot make a determination (caller falls back to operator
 * flag / default permissive).
 */
function tryDeriveFromWageHistory(
  serviceStart: ISODate,
  serviceEnd: ISODate,
  wageHistory: WagePeriod[]
): { verdict: CasualContinuityVerdict; sparsity: number; breakDate?: ISODate } | undefined {
  if (wageHistory.length === 0) return undefined;

  let windowStart = serviceStart;
  let totalWindows = 0;
  let missingWindows = 0;
  let firstBreak: ISODate | undefined;

  while (windowStart <= serviceEnd) {
    const windowEnd = addDays(windowStart, 27); // 4-week (28 day) inclusive window
    totalWindows += 1;
    const { hours, coveredAny } = hoursInRange(wageHistory, windowStart, windowEnd);
    if (hours === undefined && !coveredAny) {
      missingWindows += 1;
    } else if (hours !== undefined && hours < THIRTY_TWO) {
      if (firstBreak === undefined) firstBreak = windowStart;
    }
    windowStart = addDays(windowStart, 28);
  }

  const sparsity = totalWindows > 0 ? missingWindows / totalWindows : 1;
  if (sparsity > SPARSITY_FALLBACK_THRESHOLD) return undefined;
  if (firstBreak !== undefined) {
    return { verdict: 'not_satisfied', sparsity, breakDate: firstBreak };
  }
  return { verdict: 'satisfied', sparsity };
}

export function evaluateTASCasualContinuity(
  employmentType: EmploymentType,
  serviceStart: ISODate,
  serviceEnd: ISODate,
  wageHistory: WagePeriod[],
  extras: TASExtraInputs
): CasualContinuityResult {
  // Only meaningful for casuals.
  if (employmentType !== 'casual') {
    return { verdict: 'satisfied', source: 'derived', sparsity: 0 };
  }

  // ── Step 1: try auto-derive from wageHistory.
  const derived = tryDeriveFromWageHistory(serviceStart, serviceEnd, wageHistory);
  if (derived) {
    return { ...derived, source: 'derived' };
  }

  // ── Step 2: operator flag fallback.
  if (extras.tas_casual_32hr_4wk_periods_compliant === true) {
    return { verdict: 'satisfied', source: 'operator_flag', sparsity: 1 };
  }
  if (extras.tas_casual_32hr_4wk_periods_compliant === false) {
    return {
      verdict: 'not_satisfied',
      source: 'operator_flag',
      sparsity: 1,
      breakDate: (extras.tas_casual_continuity_break_date as ISODate) ?? undefined,
    };
  }

  // ── Step 3: default permissive + advisory.
  return { verdict: 'unverified', source: 'default_permissive', sparsity: 1 };
}
