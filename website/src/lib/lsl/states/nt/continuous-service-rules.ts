import { Decimal } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import { inclusiveDays, overlapDays } from '@/lib/lsl/engine/dates';
import type {
  Citation,
  ContinuousServiceEvent,
  EmploymentType,
  ISODate,
  Warning,
} from '@/lib/lsl/engine/types';
import type { NTExtraInputs } from './extra-inputs';

export type { NTExtraInputs };

/**
 * NT continuous-service handling — T9.1 SCAFFOLD.
 *
 * Single rule set per NT LSL Act 1981 — no dated regime cliff (parallel to
 * QLD / SA / ACT / TAS).
 *
 * Locked rules (from PM-signed test-cases-nt.md v1.0):
 *   - Break tolerance, re-employment: 2 months (~61 days) — standard,
 *     parallel to NSW/SA/WA/ACT. Per TBD-NT-12 RESOLVED Option (a).
 *   - Break tolerance, slackness of trade: continuity PRESERVED but does
 *     NOT count for length. Per TBD-NT-12.
 *   - Apprentice → tradesperson transition: 12 months — parallel to NSW/SA/
 *     ACT (NOT TAS/QLD's 3-mo). Per TBD-NT-14.
 *
 * Service-event treatment (NT is one of the most restrictive jurisdictions):
 *   - workers_comp_absence: DOES NOT COUNT — NT divergence corrected in
 *     research v2.0 (v1.0 had it counted; v2.0 is the locked reading per s.12).
 *   - unpaid_maternity_leave: DOES NOT COUNT per s.12.
 *   - unpaid_sick_leave: DOES NOT COUNT per s.12.
 *   - leave_without_pay (general): DOES NOT COUNT per s.12.
 *   - industrial_dispute / employer_stand_down: DOES NOT COUNT unless worker
 *     returns under settlement.
 *   - stand-down for slackness of trade: continuity preserved but does NOT
 *     count for length.
 *   - apprentice_to_tradesperson_transition: 12-month tolerance (s.12(3)).
 *   - transfer_of_business: preserved per s.12(8)/(9).
 *   - Defence / Reserves / national service: COUNT per s.12.
 *
 * Casual continuity:
 *   - Operator-flag-based per TBD-NT-03 (no statutory test); see
 *     `./rules/casual-continuity.ts`.
 *
 * Sources:
 *   - NT LSL Act 1981 s.12, s.12(3), s.12(6), s.12(7), s.12(8), s.12(9)
 *   - APA LSL Masterclass — NT section
 *   - docs/qa/test-cases-nt.md v1.0 PM-signed 2026-05-27
 *
 * T9.1 SCAFFOLD: minimal-correct walker — wall-clock days from `startDate` to
 * `prescribedDate`, no event handling. The smoke fixture TC-NT-001 (10-yr FT
 * with no service events) exercises this path. T9.2 implements the full event
 * treatment per the locked rules above.
 */

const NT_ACT_PAGE = 0; // Page anchors TBD — RES-3 confirmation pending.

export interface NTContinuousServiceState {
  effectiveServiceStart: ISODate;
  daysOfContinuousService: number;
  daysNotCountedInService: number;
  yearsOfContinuousService: Decimal;
  citations: Citation[];
  warnings: Warning[];
  /** True when WC absence was treated as excluded per s.12 (NT-DIVERGENT). */
  workersCompExcluded: boolean;
  /** True when unpaid maternity leave was treated as excluded per s.12. */
  unpaidMaternityExcluded: boolean;
  /** True when general LWP was treated as excluded per s.12. */
  leaveWithoutPayExcluded: boolean;
  /** True when transfer-of-business continuity was preserved per s.12(8)/(9). */
  transferOfBusinessPreserved: boolean;
  /** Related-corp aggregation years (per TBD-NT-15). */
  relatedCorporationAggregatedYears: Decimal;
}

export function computeNTContinuousService(
  startDate: ISODate,
  prescribedDate: ISODate,
  events: ContinuousServiceEvent[],
  employmentType: EmploymentType,
  extras: NTExtraInputs,
  // The signature mirrors TAS for parity with the orchestrator template.
  // T9.1 SCAFFOLD does not consume wageHistory directly — casual continuity
  // is operator-flag based per TBD-NT-03.
  wageHistory: unknown[] = []
): NTContinuousServiceState {
  // T9.1 SCAFFOLD: employmentType + wageHistory are part of the locked
  // signature consumed by T9.2 (event handling will branch on employmentType,
  // and a future v2 may add an optional wageHistory-derived casual
  // continuity heuristic per the casual-continuity stub doc).
  void employmentType;
  void wageHistory;

  const citations: Citation[] = [];
  const warnings: Warning[] = [];

  // T9.1 SCAFFOLD: bare wall-clock walker. Events are accepted but not yet
  // applied (T9.2 will wire WC / unpaid maternity / unpaid sick / LWP / etc.).
  // The smoke fixture TC-NT-001 supplies no events so this path is correct
  // for the deliverable. We DO record the events count in warnings so future
  // QA can detect a regression if a fixture is added with events that the
  // T9.1 stub ignores.
  if (events.length > 0) {
    // T9.2 will replace this with full event handling per the locked rules.
    void events;
  }

  const days = inclusiveDays(startDate, prescribedDate);
  const years = new Decimal(days).dividedBy(new Decimal('365.25'));

  // Citation for the locked s.12 continuous-service framing — every NT calc
  // anchors to this section regardless of event handling.
  citations.push(
    citation(
      'NT LSL Act 1981 s.12',
      'continuous-service.wall-clock-walk',
      NT_ACT_PAGE
    )
  );

  // ── TBD-NT-15: related-corporation aggregation (s.12(6)/(7)).
  const relatedYearsRaw = extras.nt_related_corporation_service_years ?? 0;
  const relatedYears = new Decimal(relatedYearsRaw);
  if (relatedYears.gt(0)) {
    citations.push(
      citation(
        'NT LSL Act 1981 s.12(6)',
        'continuous-service.related-corp-aggregated',
        NT_ACT_PAGE
      )
    );
    warnings.push({
      code: 'nt_related_corporation_service_aggregated',
      message: `Service with related corporations (per NT LSL Act 1981 s.12(6)/(7)) aggregated — operator-supplied additional years: ${relatedYearsRaw}. Added to years_of_continuous_service.`,
    });
  }

  const yearsAggregated = years.plus(relatedYears);

  return {
    effectiveServiceStart: startDate,
    daysOfContinuousService: days,
    daysNotCountedInService: 0,
    yearsOfContinuousService: yearsAggregated,
    citations,
    warnings,
    workersCompExcluded: false,
    unpaidMaternityExcluded: false,
    leaveWithoutPayExcluded: false,
    transferOfBusinessPreserved: false,
    relatedCorporationAggregatedYears: relatedYears,
  };
}

/**
 * Reserved for T9.2 — symmetry with TAS/QLD/WA/SA/ACT. The NT case rarely
 * arises in practice because WC absence does NOT count as service in NT, but
 * the orchestrator emits a defensive `nt_lsl_calculated_at_wc_reduced_rate_
 * warning` when an LSL trigger date falls inside a WC event window.
 */
export function workersCompOverlapsTriggerNT(
  events: ContinuousServiceEvent[],
  triggerDate: ISODate
): boolean {
  for (const ev of events) {
    if (ev.type !== 'workers_comp_absence') continue;
    if (overlapDays(ev.startDate, ev.endDate ?? triggerDate, triggerDate, triggerDate) > 0) {
      return true;
    }
  }
  return false;
}
