import type { EmploymentType } from '@/lib/lsl/engine/types';
import type { NTExtraInputs } from '../extra-inputs';

/**
 * NT casual continuity — T9.1 SCAFFOLD.
 *
 * The NT LSL Act 1981 contains NO specific quantitative casual-continuity test
 * (unlike TAS s.5(3) 32hr/4wk or NSW "regular and systematic" or VIC "12
 * weeks unless agreement"). Per TBD-NT-03 RESOLVED Option (a) 2026-05-27
 * (docs/qa/test-cases-nt.md), v1 reads the operator-supplied flag
 * `extraInputs.nt_casual_continuity_preserved`. The engine does NOT impose a
 * quantitative test absent statutory authority — this aligns with the
 * benefits-conferring construction principle.
 *
 * Verdict mapping:
 *   - `undefined` → permissive default; engine treats continuity as preserved
 *     and emits `nt_casual_continuity_preserved_default`.
 *   - `true`      → continuity preserved; no advisory.
 *   - `false`     → continuity broken; engine emits `nt_casual_continuity_
 *                   broken` and the orchestrator treats pre-break service as
 *                   forfeited (semantics finalised in T9.2).
 *
 * Only consumed when `employmentType === 'casual'`. PT/FT employees skip.
 *
 * Sources:
 *   - NT LSL Act 1981 s.12
 *   - docs/qa/test-cases-nt.md v1.0 PM-signed 2026-05-27 — TBD-NT-03 RESOLVED
 */

export type NTCasualContinuityVerdict =
  | 'preserved'
  | 'broken'
  | 'unverified';

export interface NTCasualContinuityResult {
  verdict: NTCasualContinuityVerdict;
  /** Source that determined the verdict — for diagnostics & warning provenance. */
  source: 'operator_flag' | 'default_permissive' | 'not_applicable';
}

/**
 * T9.1 SCAFFOLD: operator-flag-only evaluator. T9.2 will keep this same surface
 * — the Act has no quantitative test to auto-derive against. Future work may
 * add an optional `wageHistory`-based heuristic, but that would be advisory
 * only and gated behind a separate operator opt-in.
 */
export function evaluateNTCasualContinuity(
  employmentType: EmploymentType,
  extras: NTExtraInputs
): NTCasualContinuityResult {
  if (employmentType !== 'casual') {
    return { verdict: 'preserved', source: 'not_applicable' };
  }

  if (extras.nt_casual_continuity_preserved === true) {
    return { verdict: 'preserved', source: 'operator_flag' };
  }
  if (extras.nt_casual_continuity_preserved === false) {
    return { verdict: 'broken', source: 'operator_flag' };
  }

  return { verdict: 'unverified', source: 'default_permissive' };
}
