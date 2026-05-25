import { citation } from '@/lib/lsl/engine/citation';
import { overlapDays } from '@/lib/lsl/engine/dates';
import type {
  Citation,
  ContinuousServiceEvent,
  EmploymentType,
  ISODate,
} from '@/lib/lsl/engine/types';

/**
 * WA continuous-service handling — POST-2022 rules.
 *
 * Applies WA LSL Act 1958 s.6 AS AMENDED rules (in force on/after 2022-06-20
 * via the IR Legislation Amendment Act 2021).
 *
 * Key post-2022 differences from pre-2022:
 *   - **Paid sickness/injury** — counts in full (no 15-day cap).
 *   - **Paid parental leave** — counts as service.
 *   - **Unpaid parental leave** — for casuals with `reasonableExpectationOfReturn`
 *     === true, counts toward service (DEMIRS post-2022 casual rule).
 *     Otherwise (permanent UPL): does NOT count, but does NOT break continuity.
 *   - **Casual continuity** — "regular and systematic" + reasonable expectation
 *     of return. No specific gap-duration test; the general 2-mo non-slackness
 *     / 6-mo slackness re-employment tolerance covers structural gaps.
 *   - **Transfer of business** — broader Fair Work Act standards.
 *
 * Workers Comp is handled separately (WCIM Act 2023 override at 2024-07-01)
 * by the dispatcher (`continuous-service-rules.ts`).
 *
 * Sources:
 *   - WA LSL Act 1958 s.6 (as amended 2022)
 *   - DEMIRS post-2022 guidance
 *   - docs/qa/test-cases-wa.md v1.0 PM-signed 2026-05-25
 */

/**
 * For a single event under post-2022 rules, compute days excluded from accrual
 * within [effectiveStart, prescribedDate]. Side-effect: appends citations.
 */
export function postWA2022DaysExcluded(
  ev: ContinuousServiceEvent,
  segStart: ISODate,
  segEnd: ISODate,
  effectiveStart: ISODate,
  prescribedDate: ISODate,
  employmentType: EmploymentType,
  citations: Citation[]
): number {
  const overlap = overlapDays(segStart, segEnd, effectiveStart, prescribedDate);
  if (overlap <= 0) return 0;

  switch (ev.type) {
    case 'paid_leave':
      // Post-2022: paid sickness/injury and all paid leave counts in full.
      citations.push(
        citation(
          'WA LSL Act 1958 s.6',
          'continuous-service.post-2022.paid-leave-counts',
          36
        )
      );
      return 0;

    case 'workers_comp_absence':
      // Default post-2022 (pre-2024-07-01) WC treatment: does NOT count unless
      // paidConcurrent OR returnToWorkProgram. The 2024-07-01 override is
      // applied by `continuous-service-rules.ts` BEFORE reaching here for
      // any WC days on/after 2024-07-01.
      if (ev.paidConcurrent || ev.returnToWorkProgram) {
        citations.push(
          citation(
            'WA LSL Act 1958 s.6',
            'continuous-service.post-2022.workers-comp-paid-concurrent-or-rtw-counts',
            36
          )
        );
        return 0;
      }
      citations.push(
        citation(
          'WA LSL Act 1958 s.6',
          'continuous-service.workers-comp-pre-2024-excluded',
          36
        )
      );
      return overlap;

    case 'unpaid_parental_leave':
      // Post-2022 casual UPL with reasonable expectation of return → counts.
      if (
        employmentType === 'casual' &&
        ev.reasonableExpectationOfReturn === true
      ) {
        citations.push(
          citation(
            'WA LSL Act 1958 s.6',
            'continuous-service.post-2022.casual-upl-reasonable-expectation-counts',
            36
          )
        );
        return 0;
      }
      // Permanent UPL (or casual without expectation): does not count, no break.
      citations.push(
        citation(
          'WA LSL Act 1958 s.6',
          'continuous-service.post-2022.upl-does-not-count-but-no-break',
          36
        )
      );
      return overlap;

    case 'leave_without_pay':
      citations.push(
        citation(
          'WA LSL Act 1958 s.6',
          'continuous-service.post-2022.lwop-does-not-count-but-no-break',
          36
        )
      );
      return overlap;

    case 'industrial_action':
      citations.push(
        citation(
          'WA LSL Act 1958 s.6',
          'continuous-service.post-2022.industrial-action-continuous',
          36
        )
      );
      return overlap;

    case 'employer_stand_down':
      citations.push(
        citation(
          'WA LSL Act 1958 s.6',
          'continuous-service.post-2022.stand-down-continuous',
          36
        )
      );
      return overlap;

    case 'jobkeeper_or_covid_standdown':
      citations.push(
        citation(
          'WA LSL Act 1958 s.6',
          'continuous-service.post-2022.jobkeeper-or-covid-continuous',
          36
        )
      );
      return overlap;

    case 'employer_initiated_termination_and_rehire':
    case 'apprentice_to_tradesperson_transition':
      // Structural events — gap days excluded from accrual where service is
      // preserved; broken-service case handled in effective-start step.
      return overlap;

    case 'transfer_of_business':
      // Service + accrued leave preserved per s.6 as amended 2022 (Fair Work
      // Act standards). No day-level subtraction here.
      citations.push(
        citation(
          'WA LSL Act 1958 s.6',
          'continuous-service.post-2022.transfer-of-business-preserves',
          36
        )
      );
      return 0;
  }
}
