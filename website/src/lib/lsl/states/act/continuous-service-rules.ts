import { Decimal } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import {
  dateGT,
  inclusiveDays,
  overlapDays,
  toDate,
} from '@/lib/lsl/engine/dates';
import type {
  Citation,
  ContinuousServiceEvent,
  EmploymentType,
  ISODate,
  Warning,
} from '@/lib/lsl/engine/types';
import type { ACTExtraInputs } from './extra-inputs';
import { applyACTWCOverride } from './rules/workers-comp-override';

export type { ACTExtraInputs };

/**
 * ACT continuous-service handling.
 *
 * Single rule set per TBD-ACT-01 RESOLVED — the 9 June 2023 cliff is WC-only.
 * WC handling delegates to `rules/workers-comp-override.ts`.
 *
 * Break tolerances (ACT LSL Act 1976 s.2G):
 *   - General re-employment: 2 months (~61 days).
 *   - Slackness-of-trade: 6 months (~183 days). REUSES DEV-CROSS-2 flag.
 *   - Apprentice → tradesperson: 12 months.
 *
 * Service-event treatment:
 *   - paid_leave: counts UNLESS note contains "parental" — non-counting per
 *     TBD-ACT-15 RESOLVED (ACT divergence from NSW/SA/VIC-post-2018).
 *     Sickness paid_leave (note contains sick/illness/injury) capped at
 *     2 wks/yr per TBD-ACT-17 RESOLVED.
 *   - workers_comp_absence: dispatched to workers-comp-override.ts.
 *   - unpaid_parental_leave / leave_without_pay: "extends-the-line" — not
 *     service-counting per TBD-ACT-13 RESOLVED.
 *   - industrial_action / stand_down: continuity preserved; no accrual.
 *   - transfer_of_business: service preserved per s.10.
 *
 * Sources:
 *   - ACT LSL Act 1976 s.2G, s.10, s.10A
 *   - WC Act 1951 (ACT) s.46 — amended effective 9 June 2023
 *   - WorkSafe ACT — LSL guidance material
 *   - docs/qa/test-cases-act.md v1.0 PM-signed 2026-05-26
 */

const ACT_REHIRE_GAP_DAYS_NON_SLACKNESS = 61;
const ACT_REHIRE_GAP_DAYS_SLACKNESS = 183;
const ACT_APPRENTICE_GAP_DAYS = 365;
const TWO_WEEKS_DAYS = 14;

function noteIndicatesParental(note?: string): boolean {
  if (!note) return false;
  return note.toLowerCase().includes('parental');
}

function noteIndicatesSickness(note?: string): boolean {
  if (!note) return false;
  const lower = note.toLowerCase();
  return (
    lower.includes('sick') ||
    lower.includes('illness') ||
    lower.includes('injury') ||
    lower.includes('personal/carer')
  );
}

function applyTwoWeekPerServiceYearCap(
  startDate: ISODate,
  absStart: ISODate,
  absEnd: ISODate,
  alreadyUsedBySY: Map<number, number>
): number {
  let excluded = 0;
  const cursor = toDate(absStart);
  const end = toDate(absEnd);
  const startY = Number(startDate.slice(0, 4));
  const startM = Number(startDate.slice(5, 7));
  const startD = Number(startDate.slice(8, 10));

  while (cursor <= end) {
    const dayY = cursor.getUTCFullYear();
    const dayM = cursor.getUTCMonth() + 1;
    const dayD = cursor.getUTCDate();
    let N = dayY - startY;
    if (dayM < startM || (dayM === startM && dayD < startD)) N -= 1;
    if (N < 0) N = 0;
    const usedSoFar = alreadyUsedBySY.get(N) ?? 0;
    if (usedSoFar < TWO_WEEKS_DAYS) {
      alreadyUsedBySY.set(N, usedSoFar + 1);
    } else {
      excluded += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return excluded;
}

export interface ACTContinuousServiceState {
  effectiveServiceStart: ISODate;
  daysOfContinuousService: number;
  daysNotCountedInService: number;
  yearsOfContinuousService: Decimal;
  citations: Citation[];
  warnings: Warning[];
  workersCompRegimeSplitApplied: boolean;
  workersCompPre9Jun2023Capped: boolean;
  workersCompPost9Jun2023Counts: boolean;
  sicknessExcessExcluded: boolean;
  parentalLeaveExcluded: boolean;
}

export function computeACTContinuousService(
  startDate: ISODate,
  prescribedDate: ISODate,
  events: ContinuousServiceEvent[],
  employmentType: EmploymentType,
  _extraInputs?: ACTExtraInputs
): ACTContinuousServiceState {
  void _extraInputs;
  const citations: Citation[] = [];
  const warnings: Warning[] = [];
  let workersCompRegimeSplitApplied = false;
  let workersCompPre9Jun2023Capped = false;
  let workersCompPost9Jun2023Counts = false;
  let sicknessExcessExcluded = false;
  let parentalLeaveExcluded = false;

  let effectiveStart = startDate;

  // ── Step 1: rehire-gap handling.
  for (const ev of events) {
    if (ev.type === 'employer_initiated_termination_and_rehire' && ev.endDate) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      const slackness = ev.slacknessOfTrade === true;
      const tolerance = slackness
        ? ACT_REHIRE_GAP_DAYS_SLACKNESS
        : ACT_REHIRE_GAP_DAYS_NON_SLACKNESS;
      if (gap > tolerance) {
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
        warnings.push({
          code: 'gap_exceeds_state_tolerance',
          message: slackness
            ? `Re-employment gap of ${Math.round(gap / 30)} months exceeds ACT's 6-month slackness-of-trade tolerance under s.2G(2)(b). Pre-gap service forfeited.`
            : `Re-employment gap of ${Math.round(gap / 30)} months exceeds ACT's 2-month non-slackness tolerance under s.2G(2)(e). Pre-gap service forfeited.`,
        });
        citations.push(
          citation(
            'ACT LSL Act 1976 s.2G',
            slackness
              ? 'continuous-service.rehire-gap-exceeds-6mo-slackness-breaks-service'
              : 'continuous-service.rehire-gap-exceeds-2mo-non-slackness-breaks-service',
            139
          )
        );
      } else {
        if (slackness) {
          warnings.push({
            code: 'act_slackness_of_trade_continuity_preserved',
            message:
              'Re-employment within 6 months following slackness-of-trade stand-down preserves continuity per ACT LSL Act 1976 s.2G(2)(b). Gap days do not count as service.',
          });
        }
        citations.push(
          citation(
            'ACT LSL Act 1976 s.2G',
            slackness
              ? 'continuous-service.rehire-within-6mo-slackness'
              : 'continuous-service.rehire-within-2mo-non-slackness',
            139
          )
        );
      }
    } else if (
      ev.type === 'apprentice_to_tradesperson_transition' &&
      ev.endDate
    ) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      if (gap > ACT_APPRENTICE_GAP_DAYS) {
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
      } else {
        citations.push(
          citation(
            'ACT LSL Act 1976 s.2G',
            'continuous-service.apprentice-to-trade-within-12mo',
            139
          )
        );
      }
    } else if (ev.type === 'transfer_of_business') {
      warnings.push({
        code: 'transfer_of_business_continuity_preserved_act',
        message:
          'Service deemed continuous across transfer of business per ACT LSL Act 1976 s.10. New employer assumes LSL liability and becomes sole employer.',
      });
      citations.push(
        citation(
          'ACT LSL Act 1976 s.10',
          'continuous-service.transfer-of-business-preserves',
          139
        )
      );
    }
  }

  if (dateGT(effectiveStart, prescribedDate)) {
    return {
      effectiveServiceStart: effectiveStart,
      daysOfContinuousService: 0,
      daysNotCountedInService: 0,
      yearsOfContinuousService: new Decimal(0),
      citations,
      warnings,
      workersCompRegimeSplitApplied: false,
      workersCompPre9Jun2023Capped: false,
      workersCompPost9Jun2023Counts: false,
      sicknessExcessExcluded: false,
      parentalLeaveExcluded: false,
    };
  }

  const elapsedDays = inclusiveDays(effectiveStart, prescribedDate);

  // ── Step 2: walk events for service exclusions.
  let daysNotCountedInService = 0;
  const sicknessUsedBySY = new Map<number, number>();
  const wcUsedBySY = new Map<number, number>();

  for (const ev of events) {
    if (!ev.endDate) continue;
    const clippedOverlap = overlapDays(
      ev.startDate,
      ev.endDate,
      effectiveStart,
      prescribedDate
    );
    if (clippedOverlap <= 0) continue;
    const evStart: ISODate =
      ev.startDate >= effectiveStart ? ev.startDate : effectiveStart;
    const evEnd: ISODate =
      ev.endDate <= prescribedDate ? ev.endDate : prescribedDate;

    switch (ev.type) {
      case 'workers_comp_absence': {
        const wcRes = applyACTWCOverride(
          effectiveStart,
          { ...ev, startDate: evStart, endDate: evEnd },
          wcUsedBySY
        );
        daysNotCountedInService += wcRes.daysExcluded;
        if (wcRes.regimeSplit) workersCompRegimeSplitApplied = true;
        if (wcRes.preCutoffCapApplied) workersCompPre9Jun2023Capped = true;
        if (wcRes.postCutoffCountsApplied) workersCompPost9Jun2023Counts = true;
        citations.push(...wcRes.citations);
        break;
      }

      case 'paid_leave': {
        if (noteIndicatesParental(ev.note)) {
          parentalLeaveExcluded = true;
          daysNotCountedInService += clippedOverlap;
          citations.push(
            citation(
              'ACT LSL Act 1976 s.2G',
              'continuous-service.paid-parental-leave-does-not-count',
              139
            )
          );
        } else if (noteIndicatesSickness(ev.note)) {
          const excluded = applyTwoWeekPerServiceYearCap(
            effectiveStart,
            evStart,
            evEnd,
            sicknessUsedBySY
          );
          daysNotCountedInService += excluded;
          if (excluded > 0) {
            sicknessExcessExcluded = true;
            citations.push(
              citation(
                'ACT LSL Act 1976 s.2G',
                'continuous-service.sickness-pre-2wk-cap-counts-rest-excluded',
                139
              )
            );
          } else {
            citations.push(
              citation(
                'ACT LSL Act 1976 s.2G',
                'continuous-service.sickness-within-2wk-cap',
                139
              )
            );
          }
        } else {
          citations.push(
            citation(
              'ACT LSL Act 1976 s.2G',
              'continuous-service.paid-leave-counts',
              139
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
            'ACT LSL Act 1976 s.2G',
            'continuous-service.unpaid-parental-leave-extends-the-line',
            139
          )
        );
        break;

      case 'leave_without_pay':
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'ACT LSL Act 1976 s.2G',
            'continuous-service.unpaid-leave-extends-the-line',
            139
          )
        );
        break;

      case 'industrial_action':
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'ACT LSL Act 1976 s.2G',
            'continuous-service.industrial-action-continuous-but-no-accrual',
            139
          )
        );
        break;

      case 'employer_stand_down':
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'ACT LSL Act 1976 s.2G',
            'continuous-service.stand-down-continuous-but-no-accrual',
            139
          )
        );
        break;

      case 'jobkeeper_or_covid_standdown':
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'ACT LSL Act 1976 s.2G',
            'continuous-service.jobkeeper-or-covid-standdown-continuous',
            139
          )
        );
        break;

      case 'employer_initiated_termination_and_rehire': {
        const gap = inclusiveDays(ev.startDate, ev.endDate);
        const slackness = ev.slacknessOfTrade === true;
        const tolerance = slackness
          ? ACT_REHIRE_GAP_DAYS_SLACKNESS
          : ACT_REHIRE_GAP_DAYS_NON_SLACKNESS;
        if (gap <= tolerance) {
          daysNotCountedInService += clippedOverlap;
        }
        break;
      }

      case 'apprentice_to_tradesperson_transition':
      case 'transfer_of_business':
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

  void employmentType;

  return {
    effectiveServiceStart: effectiveStart,
    daysOfContinuousService,
    daysNotCountedInService,
    yearsOfContinuousService,
    citations,
    warnings,
    workersCompRegimeSplitApplied,
    workersCompPre9Jun2023Capped,
    workersCompPost9Jun2023Counts,
    sicknessExcessExcluded,
    parentalLeaveExcluded,
  };
}

export function workersCompOverlapsTriggerACT(
  events: ContinuousServiceEvent[],
  triggerDate: ISODate
): boolean {
  for (const ev of events) {
    if (ev.type !== 'workers_comp_absence') continue;
    if (!ev.endDate) {
      if (ev.startDate <= triggerDate) return true;
      continue;
    }
    const overlap = overlapDays(ev.startDate, ev.endDate, triggerDate, triggerDate);
    if (overlap > 0) return true;
  }
  return false;
}
