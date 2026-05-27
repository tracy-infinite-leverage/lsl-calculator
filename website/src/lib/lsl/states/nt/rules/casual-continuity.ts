import type { EmploymentType, ISODate } from '@/lib/lsl/engine/types';
import type { NTExtraInputs } from '../extra-inputs';

/**
 * NT casual continuity — operator-flag based (no quantitative test).
 *
 * v1 evaluator per TBD-NT-03 RESOLVED 2026-05-27 Option (a). The NT LSL Act
 * 1981 s.12 is SILENT on a casual continuity test (no equivalent to TAS
 * s.5(3) 32-hr-4-wk, no equivalent to NSW "regular and systematic"). The
 * engine does NOT impose a quantitative test — operator owns the
 * determination.
 *
 * Pure operator-flag hierarchy:
 *   - `undefined` (default) → permissive: continuity preserved + emits
 *                             `nt_casual_continuity_preserved_default`.
 *   - `true`                → continuity preserved (no advisory).
 *   - `false` + `break_date` → continuity broken at supplied date; service
 *                              before the break-date is forfeited.
 *   - `false` + no `break_date` → engine strict-zeros all casual service and
 *                                  emits `nt_casual_continuity_not_preserved_no_break_date`.
 *
 * Returns one of four verdicts:
 *   - `satisfied`           — continuity preserved (default or operator true)
 *   - `not_satisfied`       — operator flag false; service may be split or
 *                             zeroed depending on break-date supply
 *   - `unverified_default`  — no operator signal; permissive default applied
 *   - `not_satisfied_no_break_date` — flag false but no break date supplied
 *
 * The orchestrator maps verdicts to warning codes:
 *   - satisfied            → no advisory (if from flag) OR
 *                            `nt_casual_continuity_preserved_default` (default)
 *   - not_satisfied        → `nt_casual_continuity_broken`
 *   - not_satisfied_no_break_date → `nt_casual_continuity_not_preserved_no_break_date`
 *   - unverified_default   → `nt_casual_continuity_preserved_default`
 *
 * Sources:
 *   - NT LSL Act 1981 s.12 (silent on quantitative casual test)
 *   - docs/qa/test-cases-nt.md v1.0 PM-signed 2026-05-27 — TBD-NT-03 RESOLVED
 */

export type NTCasualContinuityVerdict =
  | 'satisfied'
  | 'not_satisfied'
  | 'unverified_default'
  | 'not_satisfied_no_break_date';

export interface NTCasualContinuityResult {
  verdict: NTCasualContinuityVerdict;
  /** Source that determined the verdict — for diagnostics & warning provenance. */
  source: 'operator_flag' | 'default_permissive';
  /** Operator-supplied break date — present only when verdict === 'not_satisfied'. */
  breakDate?: ISODate;
}

export function evaluateNTCasualContinuity(
  employmentType: EmploymentType,
  extras: NTExtraInputs
): NTCasualContinuityResult {
  // Only meaningful for casuals.
  if (employmentType !== 'casual') {
    return { verdict: 'satisfied', source: 'default_permissive' };
  }

  // ── Operator flag path.
  if (extras.nt_casual_continuity_preserved === true) {
    return { verdict: 'satisfied', source: 'operator_flag' };
  }
  if (extras.nt_casual_continuity_preserved === false) {
    if (extras.nt_casual_continuity_break_date) {
      return {
        verdict: 'not_satisfied',
        source: 'operator_flag',
        breakDate: extras.nt_casual_continuity_break_date as ISODate,
      };
    }
    return { verdict: 'not_satisfied_no_break_date', source: 'operator_flag' };
  }

  // ── Default permissive.
  return { verdict: 'unverified_default', source: 'default_permissive' };
}
