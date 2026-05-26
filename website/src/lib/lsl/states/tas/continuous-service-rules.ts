import { Decimal } from '@/lib/lsl/engine/decimal';
import { inclusiveDays } from '@/lib/lsl/engine/dates';
import type {
  Citation,
  ContinuousServiceEvent,
  EmploymentType,
  ISODate,
  Warning,
} from '@/lib/lsl/engine/types';
import type { TASExtraInputs } from './extra-inputs';

export type { TASExtraInputs };

/**
 * TAS continuous-service handling — T8.1 SCAFFOLD.
 *
 * Single rule set per TAS LSL Act 1976 — no dated regime cliff (parallel to
 * QLD / SA / ACT). Real implementation arrives in T8.2 (rules + orchestrator).
 *
 * Locked surface for T8.1 (signed test-cases-tas.md v1.0):
 *   - Break tolerances: 3 months general (s.5), 6 months slackness-of-trade
 *     PLUS 14-day return-to-work offer (s.5 — TBD-TAS-12); apprentice
 *     transition 3 months (TBD-TAS-11 — TAS-shorter than other states).
 *   - Workers comp absence COUNTS as service per s.5(1)(c) — "absence due to
 *     illness or injury certified by a medical practitioner".
 *   - Paid + unpaid parental leave DOES NOT COUNT as service (TBD-TAS-13).
 *   - Industrial-dispute time DOES NOT COUNT unless worker returns under
 *     settlement.
 *   - Casual continuity test: 32 hours per consecutive 4-week period
 *     (s.5(3) — TAS UNIQUE). Hybrid hierarchy per TBD-TAS-04 RESOLVED
 *     Option (c) — auto-derive from wageHistory → operator flag fallback →
 *     permissive default + advisory.
 *
 * For T8.1 the function returns a degenerate "elapsed days, nothing excluded"
 * state — sufficient for the smoke test on TC-TAS-001 (10-yr FT, no service
 * events). Subsequent T8.x tasks implement event walking, the s.5(3) casual
 * continuity test, slackness-of-trade tolerance, etc.
 *
 * Sources:
 *   - TAS LSL Act 1976 s.2 (definitions), s.5 (continuous service incl. s.5(3)
 *     casual 32hr/4wk test), s.5(1)(c) (WC counts), s.12 (taking LSL +
 *     termination)
 *   - WorkSafe Tasmania — LSL guidance material
 *   - docs/qa/test-cases-tas.md v1.0 PM-signed 2026-05-26
 */

export interface TASContinuousServiceState {
  effectiveServiceStart: ISODate;
  daysOfContinuousService: number;
  daysNotCountedInService: number;
  yearsOfContinuousService: Decimal;
  citations: Citation[];
  warnings: Warning[];
  /** Reserved for T8.2 — s.5(3) test outcome. */
  casual32hr4wkVerified?: 'satisfied' | 'not_satisfied' | 'unverified';
  /** Reserved for T8.2 — `true` when s.5 slackness 6mo + 14-day window held. */
  slacknessOfTradePreserved?: boolean;
  /** Reserved for T8.2. */
  parentalLeaveExcluded?: boolean;
}

export function computeTASContinuousService(
  startDate: ISODate,
  prescribedDate: ISODate,
  events: ContinuousServiceEvent[],
  employmentType: EmploymentType,
  _extraInputs?: TASExtraInputs
): TASContinuousServiceState {
  // T8.1 scaffold — degenerate elapsed-days computation. Sufficient for the
  // smoke fixture TC-TAS-001 (10 yrs FT, empty serviceEvents). T8.2 swaps in
  // the full event walk, s.5(3) casual test, slackness window, apprentice
  // tolerance, WC counting, parental-leave exclusion, etc.
  void events;
  void employmentType;
  void _extraInputs;

  const elapsedDays = inclusiveDays(startDate, prescribedDate);
  const daysOfContinuousService = Math.max(0, elapsedDays);
  const yearsOfContinuousService = new Decimal(daysOfContinuousService).dividedBy(
    new Decimal('365.25')
  );

  return {
    effectiveServiceStart: startDate,
    daysOfContinuousService,
    daysNotCountedInService: 0,
    yearsOfContinuousService,
    citations: [],
    warnings: [],
  };
}

/**
 * Reserved for T8.2 — currently a stub used by trigger-handlers to decide
 * whether to emit `tas_lsl_calculated_at_wc_reduced_rate_warning`.
 *
 * Returns true when a `workers_comp_absence` service event overlaps the
 * trigger date. Mirrors `workersCompOverlapsTriggerACT` shape.
 */
export function workersCompOverlapsTriggerTAS(
  events: ContinuousServiceEvent[],
  triggerDate: ISODate
): boolean {
  for (const ev of events) {
    if (ev.type !== 'workers_comp_absence') continue;
    if (!ev.endDate) {
      if (ev.startDate <= triggerDate) return true;
      continue;
    }
    if (ev.startDate <= triggerDate && ev.endDate >= triggerDate) return true;
  }
  return false;
}
