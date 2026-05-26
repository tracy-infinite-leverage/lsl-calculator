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
import type { TASExtraInputs } from './extra-inputs';
import {
  evaluateTASCasualContinuity,
  type CasualContinuityVerdict,
} from './rules/casual-continuity';

export type { TASExtraInputs };

/**
 * TAS continuous-service handling — T8.2.
 *
 * Single rule set per TAS LSL Act 1976 — no dated regime cliff (parallel to
 * QLD / SA / ACT).
 *
 * Break tolerances (s.5):
 *   - General re-employment: 3 months (~91 days) — TAS-specific (longer than
 *     NSW/SA/WA's 2-month tolerance; same as QLD's 3-month).
 *   - Slackness-of-trade: 6 months (~183 days) BUT ONLY IF the worker accepted
 *     the return-to-work offer within 14 days. Per TBD-TAS-12 RESOLVED,
 *     surfaced via `extraInputs.tas_slackness_return_within_14_days: boolean`
 *     (default false). When the 14-day window is missed the 6-mo tolerance is
 *     NOT applied — engine falls back to the standard 3-month threshold and
 *     emits `tas_slackness_14_day_return_window_missed`.
 *   - Apprentice → tradesperson transition: 3 months — SHORTEST in Australia
 *     (TBD-TAS-11). Hardcoded TAS constant; reuses the cross-state
 *     `apprentice_to_tradesperson_transition` event added in DEV-CROSS-2.
 *
 * Service-event treatment:
 *   - paid_leave: counts UNLESS the note contains "parental" or "maternity"
 *     (case-insensitive). Per TBD-TAS-13 RESOLVED, TAS is the MOST restrictive
 *     jurisdiction — both paid AND unpaid parental leave excluded from service.
 *   - workers_comp_absence: counts in full per s.5(1)(c) when medical-
 *     certificate-backed (default). Engine reads `note` for the substring
 *     "no medical certificate" (case-insensitive) as a signal to treat the
 *     absence as ordinary unpaid leave (excluded from service).
 *   - leave_without_pay / unpaid_parental_leave: not service-counting — extends-
 *     the-line pattern. Parental-marked entries surface `tas_maternity_leave_
 *     excluded`.
 *   - industrial_action / employer_stand_down / jobkeeper_or_covid_standdown:
 *     continuity preserved but no accrual (excluded from service).
 *   - transfer_of_business: service preserved per s.5; emits
 *     `transfer_of_business_continuity_preserved_tas`.
 *   - apprentice_to_tradesperson_transition: 3-month tolerance, emits
 *     `tas_apprentice_3mo_continuity_preserved` when within tolerance.
 *
 * Casual s.5(3) 32hr/4wk continuity:
 *   - Hybrid evaluation per TBD-TAS-04 RESOLVED — see `./rules/casual-continuity.ts`.
 *   - When `not_satisfied` the orchestrator returns total_entitlement_weeks = 0;
 *     service is treated as forfeited unless qualifying re-engagement applies.
 *   - When `unverified` (no operator flag + sparse wageHistory) the engine
 *     defaults permissive and emits `tas_casual_continuity_test_unverified`.
 *
 * Sources:
 *   - TAS LSL Act 1976 ss.2, 5 (incl. s.5(1)(c), s.5(3)), 12
 *   - WorkSafe Tasmania — LSL guidance material
 *   - docs/qa/test-cases-tas.md v1.0 PM-signed 2026-05-26
 */

const TAS_REHIRE_GAP_DAYS_NON_SLACKNESS = 91;        // 3 months
const TAS_REHIRE_GAP_DAYS_SLACKNESS = 183;           // 6 months — only with 14-day window
const TAS_APPRENTICE_GAP_DAYS = 91;                   // 3 months — TAS UNIQUE shortest
const TAS_ACT_PAGE = 96;

function noteIndicatesParental(note?: string): boolean {
  if (!note) return false;
  const lower = note.toLowerCase();
  return lower.includes('parental') || lower.includes('maternity');
}

function noteIndicatesMissingCertificate(note?: string): boolean {
  if (!note) return false;
  return note.toLowerCase().includes('no medical certificate');
}

export interface TASContinuousServiceState {
  effectiveServiceStart: ISODate;
  daysOfContinuousService: number;
  daysNotCountedInService: number;
  yearsOfContinuousService: Decimal;
  citations: Citation[];
  warnings: Warning[];
  /** s.5(3) outcome from the hybrid casual-continuity evaluator. */
  casual32hr4wkVerified: CasualContinuityVerdict;
  /** True when the 6-mo slackness tolerance was preserved by the 14-day window. */
  slacknessOfTradePreserved: boolean;
  /** True when the 14-day return-to-work window was missed and the 6-mo path denied. */
  slackness14DayWindowMissed: boolean;
  parentalLeaveExcluded: boolean;
  apprentice3moPreserved: boolean;
  transferOfBusinessPreserved: boolean;
  /** True when a WC absence was rejected because no certificate was supplied. */
  workersCompCertificateMissing: boolean;
}

export function computeTASContinuousService(
  startDate: ISODate,
  prescribedDate: ISODate,
  events: ContinuousServiceEvent[],
  employmentType: EmploymentType,
  extras: TASExtraInputs,
  wageHistory: WagePeriod[] = []
): TASContinuousServiceState {
  const citations: Citation[] = [];
  const warnings: Warning[] = [];
  let slacknessOfTradePreserved = false;
  let slackness14DayWindowMissed = false;
  let parentalLeaveExcluded = false;
  let apprentice3moPreserved = false;
  let transferOfBusinessPreserved = false;
  let workersCompCertificateMissing = false;

  let effectiveStart = startDate;

  // ── Step 1: rehire-gap + apprentice transition + transfer-of-business pre-pass.
  for (const ev of events) {
    if (ev.type === 'employer_initiated_termination_and_rehire' && ev.endDate) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      const slackness = ev.slacknessOfTrade === true;
      const within14 = extras.tas_slackness_return_within_14_days === true;

      let tolerance: number;
      let toleranceKind: 'slackness_14day' | 'standard';
      if (slackness && within14) {
        tolerance = TAS_REHIRE_GAP_DAYS_SLACKNESS;
        toleranceKind = 'slackness_14day';
      } else {
        tolerance = TAS_REHIRE_GAP_DAYS_NON_SLACKNESS;
        toleranceKind = 'standard';
        if (slackness && !within14 && gap > TAS_REHIRE_GAP_DAYS_NON_SLACKNESS) {
          slackness14DayWindowMissed = true;
        }
      }

      if (gap > tolerance) {
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
        if (toleranceKind === 'slackness_14day') {
          warnings.push({
            code: 'gap_exceeds_state_tolerance',
            message: `Re-employment gap of ${Math.round(gap / 30)} months exceeds TAS's 6-month slackness-of-trade tolerance under TAS LSL Act 1976 s.5. Pre-gap service forfeited.`,
          });
          citations.push(
            citation(
              'TAS LSL Act 1976 s.5',
              'continuous-service.rehire-gap-exceeds-6mo-slackness-breaks-service',
              TAS_ACT_PAGE
            )
          );
        } else if (slackness && !within14) {
          warnings.push({
            code: 'tas_slackness_14_day_return_window_missed',
            message:
              'Slackness-of-trade re-employment exceeded 3 months AND the return-to-work offer was NOT accepted within 14 days. Continuity preservation per TAS LSL Act 1976 s.5 does NOT apply; standard 3-month break tolerance used. Pre-gap service forfeited.',
          });
          citations.push(
            citation(
              'TAS LSL Act 1976 s.5',
              'continuous-service.slackness-14-day-window-missed',
              TAS_ACT_PAGE
            )
          );
        } else {
          warnings.push({
            code: 'gap_exceeds_state_tolerance',
            message: `Re-employment gap of ${Math.round(gap / 30)} months exceeds TAS's 3-month non-slackness tolerance under TAS LSL Act 1976 s.5. Pre-gap service forfeited.`,
          });
          citations.push(
            citation(
              'TAS LSL Act 1976 s.5',
              'continuous-service.rehire-gap-exceeds-3mo-non-slackness-breaks-service',
              TAS_ACT_PAGE
            )
          );
        }
      } else {
        if (toleranceKind === 'slackness_14day') {
          slacknessOfTradePreserved = true;
          warnings.push({
            code: 'tas_slackness_of_trade_continuity_preserved',
            message:
              'Re-employment within 6 months following slackness-of-trade stand-down AND return-to-work offer accepted within 14 days — continuity preserved per TAS LSL Act 1976 s.5. Gap days do not count as service.',
          });
          citations.push(
            citation(
              'TAS LSL Act 1976 s.5',
              'continuous-service.rehire-within-6mo-slackness-14day-window',
              TAS_ACT_PAGE
            )
          );
        } else {
          citations.push(
            citation(
              'TAS LSL Act 1976 s.5',
              'continuous-service.rehire-within-3mo-non-slackness',
              TAS_ACT_PAGE
            )
          );
        }
      }
    } else if (
      ev.type === 'apprentice_to_tradesperson_transition' &&
      ev.endDate
    ) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      if (gap > TAS_APPRENTICE_GAP_DAYS) {
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
      } else {
        apprentice3moPreserved = true;
        warnings.push({
          code: 'tas_apprentice_3mo_continuity_preserved',
          message:
            'Apprentice → tradesperson transition within 3 months preserves continuity per TAS LSL Act 1976 s.5. TAS uses the SHORTEST apprentice lead-in window in Australia (NSW/SA/NT 12 mo, VIC 52 wks, WA 52 wks, QLD 3 mo, ACT 12 mo).',
        });
        citations.push(
          citation(
            'TAS LSL Act 1976 s.5',
            'continuous-service.apprentice-to-trade-within-3mo',
            TAS_ACT_PAGE
          )
        );
      }
    } else if (ev.type === 'transfer_of_business') {
      transferOfBusinessPreserved = true;
      warnings.push({
        code: 'transfer_of_business_continuity_preserved_tas',
        message:
          'Service deemed continuous across transmission of business per TAS LSL Act 1976 s.5. New employer assumes LSL liability and becomes sole employer.',
      });
      citations.push(
        citation(
          'TAS LSL Act 1976 s.5',
          'continuous-service.transfer-of-business-preserves',
          TAS_ACT_PAGE
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
      casual32hr4wkVerified: 'satisfied',
      slacknessOfTradePreserved,
      slackness14DayWindowMissed,
      parentalLeaveExcluded,
      apprentice3moPreserved,
      transferOfBusinessPreserved,
      workersCompCertificateMissing,
    };
  }

  const elapsedDays = inclusiveDays(effectiveStart, prescribedDate);

  // ── Step 2: walk events for service exclusions.
  let daysNotCountedInService = 0;

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
        if (noteIndicatesMissingCertificate(ev.note)) {
          workersCompCertificateMissing = true;
          daysNotCountedInService += clippedOverlap;
          citations.push(
            citation(
              'TAS LSL Act 1976 s.5(1)(c)',
              'continuous-service.workers-comp-no-medical-certificate-excluded',
              TAS_ACT_PAGE
            )
          );
        } else {
          // Medical-certificate-backed (default). Counts in full.
          citations.push(
            citation(
              'TAS LSL Act 1976 s.5(1)(c)',
              'continuous-service.workers-comp-counts-medical-certificate',
              TAS_ACT_PAGE
            )
          );
        }
        break;
      }

      case 'paid_leave': {
        if (noteIndicatesParental(ev.note)) {
          parentalLeaveExcluded = true;
          daysNotCountedInService += clippedOverlap;
          citations.push(
            citation(
              'TAS LSL Act 1976 s.5',
              'continuous-service.paid-parental-leave-does-not-count',
              TAS_ACT_PAGE
            )
          );
        } else {
          citations.push(
            citation(
              'TAS LSL Act 1976 s.5',
              'continuous-service.paid-leave-counts',
              TAS_ACT_PAGE
            )
          );
        }
        break;
      }

      case 'unpaid_parental_leave':
        parentalLeaveExcluded = true;
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'TAS LSL Act 1976 s.5',
            'continuous-service.unpaid-parental-leave-extends-the-line',
            TAS_ACT_PAGE
          )
        );
        break;

      case 'leave_without_pay': {
        // TBD-TAS-13: parental + maternity LWOP entries excluded from service
        // and surface the maternity-excluded advisory. Other LWOP just extends
        // the line.
        if (noteIndicatesParental(ev.note)) {
          parentalLeaveExcluded = true;
        }
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'TAS LSL Act 1976 s.5',
            'continuous-service.unpaid-leave-extends-the-line',
            TAS_ACT_PAGE
          )
        );
        break;
      }

      case 'industrial_action':
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'TAS LSL Act 1976 s.5',
            'continuous-service.industrial-action-continuous-but-no-accrual',
            TAS_ACT_PAGE
          )
        );
        break;

      case 'employer_stand_down':
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'TAS LSL Act 1976 s.5',
            'continuous-service.stand-down-continuous-but-no-accrual',
            TAS_ACT_PAGE
          )
        );
        break;

      case 'jobkeeper_or_covid_standdown':
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'TAS LSL Act 1976 s.5',
            'continuous-service.jobkeeper-or-covid-standdown-continuous',
            TAS_ACT_PAGE
          )
        );
        break;

      case 'employer_initiated_termination_and_rehire': {
        // The gap days are NOT working days — they should not contribute to
        // accrued service. If the gap fell inside the elapsed window AND the
        // tolerance was preserved (handled above), exclude the gap from
        // service days. If the tolerance was exceeded, `effectiveStart` was
        // already advanced and the gap is naturally excluded.
        const gap = inclusiveDays(ev.startDate, ev.endDate);
        const slackness = ev.slacknessOfTrade === true;
        const within14 = extras.tas_slackness_return_within_14_days === true;
        const tolerance =
          slackness && within14
            ? TAS_REHIRE_GAP_DAYS_SLACKNESS
            : TAS_REHIRE_GAP_DAYS_NON_SLACKNESS;
        if (gap <= tolerance) {
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

  if (parentalLeaveExcluded) {
    warnings.push({
      code: 'tas_maternity_leave_excluded',
      message:
        'Maternity / parental leave (both paid and unpaid) does NOT count as service under TAS LSL Act 1976 s.5. TAS is the most restrictive parental-leave treatment in Australia — diverges from NSW/SA (which count company-paid parental) and from VIC post-2018 (which counts the first 52 wks).',
    });
  }

  // ── Step 3: casual s.5(3) 32hr/4wk continuity test.
  const casualVerdict = evaluateTASCasualContinuity(
    employmentType,
    effectiveStart,
    prescribedDate,
    wageHistory,
    extras
  );

  if (employmentType === 'casual') {
    switch (casualVerdict.verdict) {
      case 'satisfied':
        warnings.push({
          code: 'tas_casual_32hr_4wk_continuity_satisfied',
          message: `Casual employee's continuity confirmed via TAS LSL Act 1976 s.5(3) 32-hour-4-week test (source: ${casualVerdict.source === 'derived' ? 'auto-derived from wageHistory' : 'operator-supplied via extraInputs.tas_casual_32hr_4wk_periods_compliant'}).`,
        });
        citations.push(
          citation(
            'TAS LSL Act 1976 s.5(3)',
            'continuous-service.casual-32hr-4wk-satisfied',
            TAS_ACT_PAGE
          )
        );
        break;
      case 'not_satisfied':
        warnings.push({
          code: 'tas_casual_32hr_4wk_continuity_not_satisfied',
          message:
            'Casual employee FAILS TAS LSL Act 1976 s.5(3) — 32-hour-4-week continuity test not satisfied. Service is interrupted at the first failed 4-week period; pre-failure service forfeited unless a qualifying re-engagement event applied. Engine returned 0 weeks of service.',
        });
        citations.push(
          citation(
            'TAS LSL Act 1976 s.5(3)',
            'continuous-service.casual-32hr-4wk-not-satisfied',
            TAS_ACT_PAGE
          )
        );
        // Forfeit service: zero out the accrued period.
        return {
          effectiveServiceStart: effectiveStart,
          daysOfContinuousService: 0,
          daysNotCountedInService,
          yearsOfContinuousService: new Decimal(0),
          citations,
          warnings,
          casual32hr4wkVerified: casualVerdict.verdict,
          slacknessOfTradePreserved,
          slackness14DayWindowMissed,
          parentalLeaveExcluded,
          apprentice3moPreserved,
          transferOfBusinessPreserved,
          workersCompCertificateMissing,
        };
      case 'unverified':
        warnings.push({
          code: 'tas_casual_continuity_test_unverified',
          message:
            'Operator did not supply `extraInputs.tas_casual_32hr_4wk_periods_compliant` AND engine could not derive a definitive answer from `wageHistory`. Engine assumed continuity preserved for v1 (permissive default). Operator should verify against actual 4-week-period worked hours.',
        });
        citations.push(
          citation(
            'TAS LSL Act 1976 s.5(3)',
            'continuous-service.casual-32hr-4wk-unverified-permissive-default',
            TAS_ACT_PAGE
          )
        );
        break;
    }
  }

  const daysOfContinuousService = Math.max(
    0,
    elapsedDays - daysNotCountedInService
  );
  const yearsOfContinuousService = new Decimal(daysOfContinuousService).dividedBy(
    new Decimal('365.25')
  );

  return {
    effectiveServiceStart: effectiveStart,
    daysOfContinuousService,
    daysNotCountedInService,
    yearsOfContinuousService,
    citations,
    warnings,
    casual32hr4wkVerified: casualVerdict.verdict,
    slacknessOfTradePreserved,
    slackness14DayWindowMissed,
    parentalLeaveExcluded,
    apprentice3moPreserved,
    transferOfBusinessPreserved,
    workersCompCertificateMissing,
  };
}

/**
 * Returns true when a `workers_comp_absence` service event overlaps the
 * trigger date. Used by the orchestrator to surface
 * `tas_lsl_calculated_at_wc_reduced_rate_warning`. Mirrors `workersCompOverlapsTriggerACT`.
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
