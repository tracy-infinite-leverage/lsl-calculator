import { Decimal } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import {
  dateGT,
  inclusiveDays,
  overlapDays,
} from '@/lib/lsl/engine/dates';
import type {
  Citation,
  ContinuousServiceEvent,
  EmploymentType,
  ISODate,
  Warning,
  WagePeriod,
} from '@/lib/lsl/engine/types';
import type { NTExtraInputs } from './extra-inputs';
import { evaluateNTCasualContinuity } from './rules/casual-continuity';

export type { NTExtraInputs };

/**
 * NT continuous-service handling — T9.2.
 *
 * Single rule set per NT LSL Act 1981 — no dated regime cliff (parallel to
 * QLD / SA / ACT / TAS).
 *
 * Locked rules (from PM-signed test-cases-nt.md v1.0):
 *   - Break tolerance, re-employment: **2 months (~61 days)** — standard,
 *     parallel to NSW/SA/WA/ACT. Per TBD-NT-12 RESOLVED Option (a).
 *   - Break tolerance, slackness of trade: continuity PRESERVED but does
 *     NOT count for length. Per TBD-NT-12.
 *   - Apprentice → tradesperson transition: **12 months** — parallel to
 *     NSW/SA/ACT (NOT TAS/QLD's 3-mo). Per TBD-NT-14.
 *
 * Service-event treatment (NT is one of the most restrictive jurisdictions):
 *   - `workers_comp_absence`: **DOES NOT COUNT** — NT divergence corrected in
 *     research v2.0 (v1.0 had it counted; v2.0 is the locked reading per
 *     s.12). Emits `nt_workers_comp_excluded`.
 *   - `unpaid_parental_leave`: **DOES NOT COUNT** per s.12. Emits
 *     `nt_unpaid_maternity_excluded`.
 *   - `paid_leave` with parental/maternity note: treated as unpaid maternity
 *     for service-counting per s.12 strict reading; emits the maternity
 *     advisory.
 *   - `leave_without_pay` with "sick" / "illness" / "injury" note: emits
 *     `nt_unpaid_sick_leave_excluded`.
 *   - `leave_without_pay` (general): emits `nt_leave_without_pay_excluded`.
 *   - `industrial_action` / `employer_stand_down` (slackness): continuity
 *     preserved but does NOT count for length. Emits
 *     `nt_industrial_dispute_excluded` for industrial_action.
 *   - `transfer_of_business`: preserved per s.12(8)/(9). Emits
 *     `transfer_of_business_continuity_preserved_nt`.
 *   - `apprentice_to_tradesperson_transition`: 12-month tolerance per
 *     s.12(3). Emits `nt_apprentice_12mo_continuity_preserved`.
 *   - `jobkeeper_or_covid_standdown`: treated as employer-stand-down
 *     (continuity preserved, no accrual).
 *
 * Casual continuity:
 *   - Operator-flag-based per TBD-NT-03 (no statutory test); see
 *     `./rules/casual-continuity.ts`.
 *
 * Related corporations (s.12(6)/(7)): operator-supplied
 * `extraInputs.nt_related_corporation_service_years` (default 0) added to
 * `years_of_continuous_service` per TBD-NT-15.
 *
 * Sources:
 *   - NT LSL Act 1981 s.12, s.12(3), s.12(6), s.12(7), s.12(8), s.12(9)
 *   - APA LSL Masterclass — NT section
 *   - docs/qa/test-cases-nt.md v1.0 PM-signed 2026-05-27
 */

const NT_REHIRE_GAP_DAYS = 61;           // ~2 months — TBD-NT-12 Option (a)
const NT_APPRENTICE_GAP_DAYS = 365;      // 12 months — TBD-NT-14
const NT_ACT_PAGE = 0;                   // Page anchors TBD — RES-3 pending.

function noteIndicatesParental(note?: string): boolean {
  if (!note) return false;
  const lower = note.toLowerCase();
  return lower.includes('parental') || lower.includes('maternity');
}

function noteIndicatesSickOrIllness(note?: string): boolean {
  if (!note) return false;
  const lower = note.toLowerCase();
  return (
    lower.includes('sick') || lower.includes('illness') || lower.includes('injury')
  );
}

export interface NTContinuousServiceState {
  effectiveServiceStart: ISODate;
  daysOfContinuousService: number;
  daysNotCountedInService: number;
  yearsOfContinuousService: Decimal;
  citations: Citation[];
  warnings: Warning[];
  /** True when WC absence was treated as excluded per s.12 (NT-DIVERGENT). */
  workersCompExcluded: boolean;
  /** True when unpaid (or paid-marked-parental) maternity leave was excluded. */
  unpaidMaternityExcluded: boolean;
  /** True when an LWP-note-sick entry was excluded as unpaid sick leave. */
  unpaidSickLeaveExcluded: boolean;
  /** True when general LWP was treated as excluded per s.12. */
  leaveWithoutPayExcluded: boolean;
  /** True when an industrial-action event was excluded per s.12. */
  industrialDisputeExcluded: boolean;
  /** True when transfer-of-business continuity was preserved per s.12(8)/(9). */
  transferOfBusinessPreserved: boolean;
  /** True when an apprentice → tradesperson transition preserved continuity. */
  apprentice12moPreserved: boolean;
  /** Related-corp aggregation years (per TBD-NT-15). */
  relatedCorporationAggregatedYears: Decimal;
  /** Casual continuity verdict (preserved/broken/unverified). */
  casualContinuityVerdict: 'preserved' | 'broken' | 'unverified';
}

export function computeNTContinuousService(
  startDate: ISODate,
  prescribedDate: ISODate,
  events: ContinuousServiceEvent[],
  employmentType: EmploymentType,
  extras: NTExtraInputs,
  wageHistory: WagePeriod[] = []
): NTContinuousServiceState {
  void wageHistory; // reserved for future heuristic

  const citations: Citation[] = [];
  const warnings: Warning[] = [];
  let workersCompExcluded = false;
  let unpaidMaternityExcluded = false;
  let unpaidSickLeaveExcluded = false;
  let leaveWithoutPayExcluded = false;
  let industrialDisputeExcluded = false;
  let transferOfBusinessPreserved = false;
  let apprentice12moPreserved = false;

  let effectiveStart = startDate;

  // ── Step 1: rehire-gap + apprentice transition + transfer-of-business
  // pre-pass. NT uses a flat 2-month tolerance; slackness-of-trade does NOT
  // extend that tolerance (slackness preserves continuity but the gap days
  // do not count for length — TBD-NT-12).
  for (const ev of events) {
    if (ev.type === 'employer_initiated_termination_and_rehire' && ev.endDate) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      const slackness = ev.slacknessOfTrade === true;

      if (gap > NT_REHIRE_GAP_DAYS && !slackness) {
        // Tolerance exceeded — pre-gap service forfeited.
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
        warnings.push({
          code: 'gap_exceeds_state_tolerance',
          message: `Re-employment gap of ${Math.round(gap / 30)} months exceeds NT's 2-month tolerance under NT LSL Act 1981 s.12. Pre-gap service forfeited.`,
        });
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.rehire-gap-exceeds-2mo-breaks-service',
            NT_ACT_PAGE
          )
        );
      } else if (gap > NT_REHIRE_GAP_DAYS && slackness) {
        // Slackness-of-trade: continuity preserved but gap days do NOT count.
        // No advance of effectiveStart — gap is excluded as days-not-counted
        // in the event walk below.
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.slackness-of-trade-continuity-preserved-no-length',
            NT_ACT_PAGE
          )
        );
      } else {
        // Within standard tolerance — fully preserved.
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.rehire-within-2mo',
            NT_ACT_PAGE
          )
        );
      }
    } else if (
      ev.type === 'apprentice_to_tradesperson_transition' &&
      ev.endDate
    ) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      if (gap > NT_APPRENTICE_GAP_DAYS) {
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
      } else {
        apprentice12moPreserved = true;
        warnings.push({
          code: 'nt_apprentice_12mo_continuity_preserved',
          message:
            'Apprentice → tradesperson transition within 12 months preserves continuity per NT LSL Act 1981 s.12(3). NT uses the 12-month apprentice lead-in window (parallel to NSW/SA/ACT — NOT TAS/QLD\'s 3-month).',
        });
        citations.push(
          citation(
            'NT LSL Act 1981 s.12(3)',
            'continuous-service.apprentice-to-trade-within-12mo',
            NT_ACT_PAGE
          )
        );
      }
    } else if (ev.type === 'transfer_of_business') {
      transferOfBusinessPreserved = true;
      warnings.push({
        code: 'transfer_of_business_continuity_preserved_nt',
        message:
          'Service deemed continuous across transmission of business per NT LSL Act 1981 s.12(8)/(9). New employer assumes LSL liability and becomes sole employer.',
      });
      citations.push(
        citation(
          'NT LSL Act 1981 s.12(8)',
          'continuous-service.transfer-of-business-preserves',
          NT_ACT_PAGE
        )
      );
    }
  }

  // If the cut-off rehire date crosses the prescribed date, no continuous service.
  if (dateGT(effectiveStart, prescribedDate)) {
    return {
      effectiveServiceStart: effectiveStart,
      daysOfContinuousService: 0,
      daysNotCountedInService: 0,
      yearsOfContinuousService: new Decimal(0),
      citations,
      warnings,
      workersCompExcluded,
      unpaidMaternityExcluded,
      unpaidSickLeaveExcluded,
      leaveWithoutPayExcluded,
      industrialDisputeExcluded,
      transferOfBusinessPreserved,
      apprentice12moPreserved,
      relatedCorporationAggregatedYears: new Decimal(0),
      casualContinuityVerdict: 'preserved',
    };
  }

  const elapsedDays = inclusiveDays(effectiveStart, prescribedDate);
  let daysNotCountedInService = 0;

  // ── Step 2: walk events for service exclusions.
  for (const ev of events) {
    if (!ev.endDate) continue;
    const clippedOverlap = overlapDays(
      ev.startDate,
      ev.endDate,
      effectiveStart,
      prescribedDate
    );
    if (clippedOverlap <= 0) continue;

    switch (ev.type) {
      case 'workers_comp_absence': {
        workersCompExcluded = true;
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.workers-comp-excluded',
            NT_ACT_PAGE
          )
        );
        break;
      }

      case 'paid_leave': {
        if (noteIndicatesParental(ev.note)) {
          unpaidMaternityExcluded = true;
          daysNotCountedInService += clippedOverlap;
          citations.push(
            citation(
              'NT LSL Act 1981 s.12',
              'continuous-service.paid-parental-leave-does-not-count',
              NT_ACT_PAGE
            )
          );
        } else {
          // Standard paid leave (annual / paid sick) counts per s.12.
          citations.push(
            citation(
              'NT LSL Act 1981 s.12',
              'continuous-service.paid-leave-counts',
              NT_ACT_PAGE
            )
          );
        }
        break;
      }

      case 'unpaid_parental_leave':
        unpaidMaternityExcluded = true;
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.unpaid-parental-leave-excluded',
            NT_ACT_PAGE
          )
        );
        break;

      case 'leave_without_pay': {
        // Sub-classify based on note: sick / illness / injury → sick leave,
        // parental/maternity → maternity, otherwise general LWP.
        if (noteIndicatesParental(ev.note)) {
          unpaidMaternityExcluded = true;
        } else if (noteIndicatesSickOrIllness(ev.note)) {
          unpaidSickLeaveExcluded = true;
        } else {
          leaveWithoutPayExcluded = true;
        }
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.leave-without-pay-excluded',
            NT_ACT_PAGE
          )
        );
        break;
      }

      case 'industrial_action':
        industrialDisputeExcluded = true;
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.industrial-dispute-excluded',
            NT_ACT_PAGE
          )
        );
        break;

      case 'employer_stand_down':
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.stand-down-continuous-but-no-accrual',
            NT_ACT_PAGE
          )
        );
        break;

      case 'jobkeeper_or_covid_standdown':
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.jobkeeper-or-covid-standdown',
            NT_ACT_PAGE
          )
        );
        break;

      case 'employer_initiated_termination_and_rehire': {
        // Gap days do not count for length — see Step 1 pre-pass.
        const gap = inclusiveDays(ev.startDate, ev.endDate);
        const slackness = ev.slacknessOfTrade === true;
        if (slackness && gap > NT_REHIRE_GAP_DAYS) {
          // Slackness branch: continuity preserved (no effectiveStart advance)
          // but gap days excluded from length.
          daysNotCountedInService += clippedOverlap;
        } else if (gap <= NT_REHIRE_GAP_DAYS) {
          daysNotCountedInService += clippedOverlap;
        }
        break;
      }

      case 'apprentice_to_tradesperson_transition':
      case 'transfer_of_business':
        // Pre-pass handles continuity; no service-day exclusion here.
        break;
    }
  }

  // ── Step 3: emit aggregated exclusion advisories.
  if (workersCompExcluded) {
    warnings.push({
      code: 'nt_workers_comp_excluded',
      message:
        'Workers compensation absence does NOT count as service under NT LSL Act 1981 s.12. NT-DIVERGENT from NSW/VIC/QLD/SA/TAS (which count) and ACT (counts post-9-Jun-2023). Corrected reading per research dossier v2.0.',
    });
  }
  if (unpaidMaternityExcluded) {
    warnings.push({
      code: 'nt_unpaid_maternity_excluded',
      message:
        'Unpaid maternity / parental leave does NOT count as service under NT LSL Act 1981 s.12.',
    });
  }
  if (unpaidSickLeaveExcluded) {
    warnings.push({
      code: 'nt_unpaid_sick_leave_excluded',
      message:
        'Unpaid sick leave does NOT count as service under NT LSL Act 1981 s.12.',
    });
  }
  if (leaveWithoutPayExcluded) {
    warnings.push({
      code: 'nt_leave_without_pay_excluded',
      message:
        'General leave without pay does NOT count as service under NT LSL Act 1981 s.12.',
    });
  }
  if (industrialDisputeExcluded) {
    warnings.push({
      code: 'nt_industrial_dispute_excluded',
      message:
        'Industrial dispute time does NOT count as service under NT LSL Act 1981 s.12 unless the worker returns under settlement.',
    });
  }

  // ── Step 4: casual continuity (TBD-NT-03).
  const casualResult = evaluateNTCasualContinuity(employmentType, extras);
  if (employmentType === 'casual') {
    if (casualResult.verdict === 'broken') {
      warnings.push({
        code: 'nt_casual_continuity_broken',
        message:
          'Operator confirmed casual continuity broken via `extraInputs.nt_casual_continuity_preserved: false`. Pre-break service forfeited per NT LSL Act 1981 s.12.',
      });
      citations.push(
        citation(
          'NT LSL Act 1981 s.12',
          'continuous-service.casual-continuity-broken',
          NT_ACT_PAGE
        )
      );
      // Strict zeros — service forfeited.
      return {
        effectiveServiceStart: effectiveStart,
        daysOfContinuousService: 0,
        daysNotCountedInService,
        yearsOfContinuousService: new Decimal(0),
        citations,
        warnings,
        workersCompExcluded,
        unpaidMaternityExcluded,
        unpaidSickLeaveExcluded,
        leaveWithoutPayExcluded,
        industrialDisputeExcluded,
        transferOfBusinessPreserved,
        apprentice12moPreserved,
        relatedCorporationAggregatedYears: new Decimal(0),
        casualContinuityVerdict: 'broken',
      };
    }
    if (casualResult.verdict === 'unverified') {
      warnings.push({
        code: 'nt_casual_continuity_preserved_default',
        message:
          'Operator did not supply `extraInputs.nt_casual_continuity_preserved`. NT LSL Act 1981 s.12 contains no specific quantitative casual-continuity test (unlike TAS s.5(3) or NSW "regular and systematic"). Engine defaulted permissive (continuity preserved) per TBD-NT-03 RESOLVED Option (a) — operator should verify against actual employment pattern.',
      });
      citations.push(
        citation(
          'NT LSL Act 1981 s.12',
          'continuous-service.casual-continuity-permissive-default',
          NT_ACT_PAGE
        )
      );
    }
  }

  // ── Step 5: anchor s.12 framing citation.
  citations.push(
    citation(
      'NT LSL Act 1981 s.12',
      'continuous-service.wall-clock-walk',
      NT_ACT_PAGE
    )
  );

  const daysOfContinuousService = Math.max(
    0,
    elapsedDays - daysNotCountedInService
  );
  const yearsOfContinuousService = new Decimal(daysOfContinuousService).dividedBy(
    new Decimal('365.25')
  );

  // ── Step 6: related-corp aggregation (TBD-NT-15).
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

  const yearsAggregated = yearsOfContinuousService.plus(relatedYears);

  return {
    effectiveServiceStart: effectiveStart,
    daysOfContinuousService,
    daysNotCountedInService,
    yearsOfContinuousService: yearsAggregated,
    citations,
    warnings,
    workersCompExcluded,
    unpaidMaternityExcluded,
    unpaidSickLeaveExcluded,
    leaveWithoutPayExcluded,
    industrialDisputeExcluded,
    transferOfBusinessPreserved,
    apprentice12moPreserved,
    relatedCorporationAggregatedYears: relatedYears,
    casualContinuityVerdict: casualResult.verdict,
  };
}

/**
 * Returns true when a `workers_comp_absence` service event overlaps the
 * trigger date. Used by the orchestrator for the defensive advisory — note
 * the case rarely arises in NT because WC absence does NOT count as service.
 */
export function workersCompOverlapsTriggerNT(
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
