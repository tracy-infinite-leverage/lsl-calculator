import { Decimal } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import { dateGT, inclusiveDays, overlapDays } from '@/lib/lsl/engine/dates';
import type {
  Citation,
  ContinuousServiceEvent,
  EmploymentType,
  ISODate,
  Warning,
} from '@/lib/lsl/engine/types';
import type { VICExtraInputs } from './extra-inputs';

export type { VICExtraInputs };

/**
 * VIC continuous-service handling — date-aware per TBD-VIC-01.
 *
 * The 2018 Act came into force on 1 November 2018, repealing the 1992 Act.
 * Transitional rules in 2018 Act s.57 preserve 1992 Act treatment for absences
 * that started before 1 November 2018. The entitlement formula (s.6, 8.6667/10
 * per year) is UNCHANGED across both Acts — only the per-absence rule for
 * "does this absence count as service?" differs.
 *
 * For absences straddling 1/11/2018 (e.g. Olivia, TC-VIC-037), the pre-cutoff
 * portion follows 1992 Act rules and the post-cutoff portion follows 2018 Act
 * rules. See `computeVICContinuousService` below.
 *
 * Break tolerance:
 *   - 2018 Act s.12(6)(a) / (b) / (c): 12 weeks (84 days) for employer- or
 *     employee-initiated termination + rehire, and fixed-term contract renewal.
 *   - 2018 Act s.12(6)(c): 52 weeks for apprentice → tradesperson transition.
 *   - 1992 Act (legacy, via s.57): 3 months for dismissal/rehire, 12 months
 *     for apprenticeships.
 *
 * Casual employees get extended UPL allowance (s.12(2)(d) — 104 weeks vs 52
 * for non-casuals).
 *
 * Sources:
 *   - VIC LSL Act 2018 ss.6, 11, 12, 13, 14, 17, 57
 *   - VIC LSL Act 1992 ss.62, 62A, 63 (preserved via s.57)
 *   - APA LSL Masterclass PDF pp.32-48
 *   - docs/qa/test-cases-vic.md (PM-signed 2026-05-24)
 */

/** Cutoff date for the 2018 Act commencement. */
const CUTOFF_2018 = '2018-11-01';

/** 2018 Act tolerances (in inclusive days). */
const VIC_REHIRE_GAP_DAYS_2018 = 84; // 12 weeks
const VIC_APPRENTICE_GAP_DAYS_2018 = 364; // 52 weeks
const VIC_UPL_CAP_DAYS = 364; // 52 weeks per period (TBD-VIC-08 — per-period interpretation)
const VIC_UPL_CAP_DAYS_CASUAL = 728; // 104 weeks for casual parental leave (s.12(2)(d))

/** 1992 Act tolerances (legacy, via 2018 Act s.57). */
const VIC_REHIRE_GAP_DAYS_1992 = 91; // 3 months (~APA p.35)
const VIC_APPRENTICE_GAP_DAYS_1992 = 365; // 12 months
const VIC_ILLNESS_CAP_DAYS_1992 = 336; // 48 weeks

/**
 * Decision: is an event governed by 1992 Act rules or 2018 Act rules?
 * Decided by absence start date — events starting on/after 1/11/2018 → 2018 Act.
 */
function isPre2018Absence(event: ContinuousServiceEvent): boolean {
  return event.startDate < CUTOFF_2018;
}

/** Split an event that straddles 1/11/2018 into two halves. Returns null for the half if empty. */
function splitAtCutoff(event: ContinuousServiceEvent): {
  preCutoff: { startDate: ISODate; endDate: ISODate } | null;
  postCutoff: { startDate: ISODate; endDate: ISODate } | null;
} {
  if (!event.endDate) return { preCutoff: null, postCutoff: null };
  const startsBefore = event.startDate < CUTOFF_2018;
  const endsBefore = event.endDate < CUTOFF_2018;
  if (startsBefore && endsBefore) {
    return { preCutoff: { startDate: event.startDate, endDate: event.endDate }, postCutoff: null };
  }
  if (!startsBefore) {
    return { preCutoff: null, postCutoff: { startDate: event.startDate, endDate: event.endDate } };
  }
  // Straddles: split at cutoff. Pre-portion ends on 2018-10-31; post-portion starts 2018-11-01.
  return {
    preCutoff: { startDate: event.startDate, endDate: '2018-10-31' as ISODate },
    postCutoff: { startDate: CUTOFF_2018 as ISODate, endDate: event.endDate },
  };
}

export interface VICContinuousServiceState {
  effectiveServiceStart: ISODate;
  daysOfContinuousService: number;
  daysNotCountedInService: number;
  yearsOfContinuousService: Decimal;
  citations: Citation[];
  warnings: Warning[];
}

/**
 * Compute VIC continuous service. Date-aware: each absence is classified by
 * its start date as pre- or post-2018-Act-commencement and the corresponding
 * rule module is applied. Straddling absences are split at 2018-11-01.
 *
 * Output:
 *   - effective service start (advances past any 1992-Act-broken-service or
 *     2018-Act-broken-service finding)
 *   - days of continuous service (after excluding all non-counting days)
 *   - days not counted in service (sum across absences)
 *   - years of continuous service = days / 365.25
 *   - citations emitted per absence type + Act regime
 *   - warnings emitted per state-tolerance-exceeded finding
 */
export function computeVICContinuousService(
  startDate: ISODate,
  prescribedDate: ISODate,
  events: ContinuousServiceEvent[],
  employmentType: EmploymentType,
  extraInputs?: VICExtraInputs
): VICContinuousServiceState {
  const citations: Citation[] = [];
  const warnings: Warning[] = [];
  const unpaidLeaveWrittenAgreement = extraInputs?.unpaidLeaveWrittenAgreement === true;

  // ── Step 1: determine effective service start (may move forward if service was broken)
  let effectiveStart = startDate;

  for (const ev of events) {
    if (ev.type === 'employer_initiated_termination_and_rehire' && ev.endDate) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      const pre2018 = isPre2018Absence(ev);
      const threshold = pre2018 ? VIC_REHIRE_GAP_DAYS_1992 : VIC_REHIRE_GAP_DAYS_2018;
      if (gap > threshold) {
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
        if (pre2018) {
          warnings.push({
            code: 'pre_2018_service_broken',
            message: `Re-hire gap of ${gap} days exceeded the 1992 Act 3-month limit — prior service broken per s.62(2)(g); 2018 Act s.57(1) preserves the finding.`,
          });
          citations.push(
            citation(
              'VIC LSL Act 2018 s.57(1)',
              'transitional.1992-act-break-preserved',
              34
            )
          );
          citations.push(
            citation(
              'VIC LSL Act 1992 s.62(2)(g)',
              'transitional.legacy.dismissal-rehire-3mo-cap',
              35,
              'Per APA LSL Masterclass; legacy provision preserved via 2018 Act s.57'
            )
          );
        } else {
          warnings.push({
            code: 'gap_exceeds_state_tolerance',
            message: `Re-hire gap exceeded VIC's 12-week limit — prior service not preserved per VIC LSL Act 2018 s.12(6)(a).`,
          });
          citations.push(
            citation(
              'VIC LSL Act 2018 s.12(6)(a)',
              'continuous-service.gap-exceeds-12wks-breaks-service',
              36
            )
          );
        }
      } else {
        // Gap within tolerance — emit "within" citation; prior service preserved.
        if (pre2018) {
          citations.push(
            citation(
              'VIC LSL Act 2018 s.57(2)',
              'transitional.absence-straddling-or-pre-2018',
              34
            )
          );
        } else {
          // 2018 Act: s.12(6)(a) employer- or employee-initiated rehire
          citations.push(
            citation(
              'VIC LSL Act 2018 s.12(6)(a)',
              'continuous-service.employer-initiated-rehire-within-12wks',
              36
            )
          );
        }
      }
    } else if (
      ev.type === 'apprentice_to_tradesperson_transition' &&
      ev.endDate
    ) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      const pre2018 = isPre2018Absence(ev);
      const threshold = pre2018
        ? VIC_APPRENTICE_GAP_DAYS_1992
        : VIC_APPRENTICE_GAP_DAYS_2018;
      if (gap > threshold) {
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
        if (pre2018) {
          citations.push(
            citation(
              'VIC LSL Act 2018 s.57(2)',
              'transitional.pre-2018-apprenticeship-cap-12mo',
              34
            )
          );
        }
      } else {
        if (pre2018) {
          citations.push(
            citation(
              'VIC LSL Act 2018 s.57(2)',
              'transitional.pre-2018-apprenticeship-cap-12mo',
              34
            )
          );
        } else {
          citations.push(
            citation(
              'VIC LSL Act 2018 s.12(6)(c)',
              'continuous-service.apprentice-to-trade-within-52wks',
              34
            )
          );
          citations.push(
            citation(
              'VIC LSL Act 2018 s.13(2)',
              'continuous-service.apprenticeship-counts-as-service',
              34
            )
          );
        }
      }
    } else if (ev.type === 'transfer_of_business') {
      // Service preserved across change of ownership; no day-level adjustment here.
      citations.push(
        citation(
          'VIC LSL Act 2018 s.11(3)',
          'continuous-service.transfer-of-business-preserves-from-original-start',
          36
        )
      );
    }
  }

  // Bounds check: effectiveStart must not be after prescribedDate
  if (dateGT(effectiveStart, prescribedDate)) {
    return {
      effectiveServiceStart: effectiveStart,
      daysOfContinuousService: 0,
      daysNotCountedInService: 0,
      yearsOfContinuousService: new Decimal(0),
      citations,
      warnings,
    };
  }

  // ── Step 2: elapsed days from effective start to prescribed date
  const elapsedDays = inclusiveDays(effectiveStart, prescribedDate);

  // ── Step 3: walk events again to compute days NOT counted as service.
  let daysNotCountedInService = 0;

  for (const ev of events) {
    if (!ev.endDate) continue;
    daysNotCountedInService += accountEventDaysExcluded(
      ev,
      effectiveStart,
      prescribedDate,
      employmentType,
      unpaidLeaveWrittenAgreement,
      citations
    );
  }

  const daysOfContinuousService = Math.max(0, elapsedDays - daysNotCountedInService);
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
  };
}

/**
 * For one event, return the days excluded from "period of continuous employment".
 * Side-effect: appends citations for the rule that fired.
 *
 * Handles straddling events by splitting at 1/11/2018 and applying each regime
 * to its segment.
 */
function accountEventDaysExcluded(
  ev: ContinuousServiceEvent,
  effectiveStart: ISODate,
  prescribedDate: ISODate,
  employmentType: EmploymentType,
  writtenAgreement: boolean,
  citations: Citation[]
): number {
  if (!ev.endDate) return 0;

  // Two-step: if event straddles 1/11/2018, split and recurse on each half.
  const split = splitAtCutoff(ev);
  if (split.preCutoff && split.postCutoff) {
    citations.push(
      citation(
        'VIC LSL Act 2018 s.57(2)',
        'transitional.absence-straddling-1nov2018',
        34
      )
    );
    const preHalf = accountSegmentDays(
      ev.type,
      split.preCutoff.startDate,
      split.preCutoff.endDate,
      effectiveStart,
      prescribedDate,
      employmentType,
      writtenAgreement,
      true /* preCutoff */,
      citations
    );
    const postHalf = accountSegmentDays(
      ev.type,
      split.postCutoff.startDate,
      split.postCutoff.endDate,
      effectiveStart,
      prescribedDate,
      employmentType,
      writtenAgreement,
      false /* preCutoff */,
      citations
    );
    return preHalf + postHalf;
  }

  const pre2018 = isPre2018Absence(ev);
  return accountSegmentDays(
    ev.type,
    ev.startDate,
    ev.endDate,
    effectiveStart,
    prescribedDate,
    employmentType,
    writtenAgreement,
    pre2018,
    citations
  );
}

/**
 * Compute days excluded for a single segment of an event under one Act regime.
 * Returns the number of days within `[effectiveStart, prescribedDate]` that
 * are NOT counted as service.
 */
function accountSegmentDays(
  type: ContinuousServiceEvent['type'],
  segStart: ISODate,
  segEnd: ISODate,
  effectiveStart: ISODate,
  prescribedDate: ISODate,
  employmentType: EmploymentType,
  writtenAgreement: boolean,
  preCutoff: boolean,
  citations: Citation[]
): number {
  const overlap = overlapDays(segStart, segEnd, effectiveStart, prescribedDate);
  if (overlap <= 0) return 0;

  if (preCutoff) {
    // ── 1992 Act regime ──────────────────────────────────────────────────
    switch (type) {
      case 'paid_leave':
        citations.push(
          citation(
            'VIC LSL Act 1992 s.62',
            'transitional.legacy.paid-leave-counts',
            34,
            'Per APA LSL Masterclass; legacy 1992 Act paid-leave-counts rule preserved via 2018 Act s.57'
          )
        );
        return 0;
      case 'workers_comp_absence': {
        // 1992 Act: 48-wk illness/injury cap. Excess above 48 wks → excluded.
        const segLen = inclusiveDays(segStart, segEnd);
        const excessDays = Math.max(0, segLen - VIC_ILLNESS_CAP_DAYS_1992);
        if (excessDays > 0) {
          citations.push(
            citation(
              'VIC LSL Act 2018 s.57(2)',
              'transitional.absence-straddling-or-pre-2018',
              34
            )
          );
          citations.push(
            citation(
              'VIC LSL Act 1992 s.63',
              'transitional.legacy.illness-injury-48wk-cap',
              34,
              'Per APA LSL Masterclass; legacy 1992 Act 48-week illness cap preserved via 2018 Act s.57'
            )
          );
        }
        // Excess is excluded; the excluded days are those at the end of the segment.
        // Intersect the excluded-tail with [effectiveStart, prescribedDate].
        if (excessDays === 0) return 0;
        const excludedSegStartDay = segLen - excessDays; // 0-indexed offset from segStart
        const excludedStart = addDays(segStart, excludedSegStartDay);
        return overlapDays(excludedStart, segEnd, effectiveStart, prescribedDate);
      }
      case 'unpaid_parental_leave':
      case 'leave_without_pay':
        // 1992 Act: UPL / LWOP does NOT count at all.
        citations.push(
          citation(
            'VIC LSL Act 1992 s.62',
            'transitional.legacy.pre-2018-upl-excluded',
            34,
            'Per APA LSL Masterclass; legacy 1992 Act UPL-excluded rule preserved via 2018 Act s.57'
          )
        );
        return overlap;
      case 'industrial_action':
      case 'employer_stand_down':
        // 1992 Act: continuous but not service (similar to 2018 Act behaviour).
        citations.push(
          citation(
            'VIC LSL Act 1992 s.62',
            'transitional.legacy.standdown-or-industrial-action-excluded',
            34,
            'Per APA LSL Masterclass'
          )
        );
        return overlap;
      case 'jobkeeper_or_covid_standdown':
        // Cannot pre-date 2018 — JobKeeper is 2020+. Defensive: treat as counts.
        return 0;
      case 'employer_initiated_termination_and_rehire':
      case 'apprentice_to_tradesperson_transition':
      case 'transfer_of_business':
        // Structural events — gap days handled in Step 1 (effective-start
        // calculation). No day-level subtraction here.
        return 0;
    }
  } else {
    // ── 2018 Act regime ──────────────────────────────────────────────────
    switch (type) {
      case 'paid_leave':
        citations.push(
          citation(
            'VIC LSL Act 2018 s.13(1)(a)',
            'continuous-service.paid-leave-counts',
            33
          )
        );
        return 0;
      case 'workers_comp_absence':
        // s.13(1)(d)(iii) — illness/injury unpaid leave uncapped.
        citations.push(
          citation(
            'VIC LSL Act 2018 s.13(1)(d)(iii)',
            'continuous-service.illness-injury-unpaid-leave-uncapped',
            33
          )
        );
        return 0;
      case 'unpaid_parental_leave': {
        // s.13(1)(b)/(c): up to 52 wks counts (104 for casual per s.12(2)(d)).
        // Per-period interpretation per TBD-VIC-08.
        const segLen = inclusiveDays(segStart, segEnd);
        const cap =
          employmentType === 'casual' ? VIC_UPL_CAP_DAYS_CASUAL : VIC_UPL_CAP_DAYS;
        citations.push(
          citation(
            employmentType === 'casual'
              ? 'VIC LSL Act 2018 s.12(2)(d)'
              : 'VIC LSL Act 2018 s.13(1)(b)',
            employmentType === 'casual'
              ? 'continuous-service.casual-parental-leave-up-to-104wks-counts'
              : 'continuous-service.unpaid-leave-52wk-counts',
            33
          )
        );
        if (segLen <= cap) {
          return 0;
        }
        citations.push(
          citation(
            'VIC LSL Act 2018 s.14(a)',
            'continuous-service.unpaid-leave-beyond-52wk-excluded',
            33
          )
        );
        const excessDays = segLen - cap;
        const excludedStart = addDays(segStart, segLen - excessDays);
        return overlapDays(excludedStart, segEnd, effectiveStart, prescribedDate);
      }
      case 'leave_without_pay': {
        // s.13(1)(b)/(c): up to 52 wks counts per period (TBD-VIC-08).
        // s.13(1)(d)(ii): written agreement uncaps.
        const segLen = inclusiveDays(segStart, segEnd);
        if (writtenAgreement) {
          citations.push(
            citation(
              'VIC LSL Act 2018 s.13(1)(d)(ii)',
              'continuous-service.unpaid-leave-written-agreement-uncapped',
              33
            )
          );
          return 0;
        }
        citations.push(
          citation(
            'VIC LSL Act 2018 s.13(1)(b)',
            'continuous-service.unpaid-leave-52wk-counts',
            33
          )
        );
        if (segLen <= VIC_UPL_CAP_DAYS) {
          return 0;
        }
        citations.push(
          citation(
            'VIC LSL Act 2018 s.14(a)',
            'continuous-service.unpaid-leave-beyond-52wk-excluded',
            33
          )
        );
        const excessDays = segLen - VIC_UPL_CAP_DAYS;
        const excludedStart = addDays(segStart, segLen - excessDays);
        return overlapDays(excludedStart, segEnd, effectiveStart, prescribedDate);
      }
      case 'industrial_action':
        // s.12(8) continuous, s.14(d) excluded from accrual.
        citations.push(
          citation(
            'VIC LSL Act 2018 s.12(8)',
            'continuous-service.industrial-action-continuous',
            33
          )
        );
        citations.push(
          citation(
            'VIC LSL Act 2018 s.14(d)',
            'continuous-service.industrial-action-excluded-from-accrual',
            33
          )
        );
        return overlap;
      case 'employer_stand_down':
        // s.12(7) continuous, s.14(c) excluded from accrual.
        citations.push(
          citation(
            'VIC LSL Act 2018 s.12(7)(c)',
            'continuous-service.stand-down-slackness-continuous',
            33
          )
        );
        citations.push(
          citation(
            'VIC LSL Act 2018 s.14(c)',
            'continuous-service.stand-down-excluded-from-accrual',
            33
          )
        );
        return overlap;
      case 'jobkeeper_or_covid_standdown':
        // s.12(7) covers various stand-down scenarios. Treat as continuous, not counted.
        citations.push(
          citation(
            'VIC LSL Act 2018 s.12(7)',
            'continuous-service.jobkeeper-or-standdown-continuous',
            33
          )
        );
        return overlap;
      case 'employer_initiated_termination_and_rehire':
        // Gap days are excluded from accrual (s.14(b)) when prior service preserved.
        // Effective-start logic in Step 1 handles broken-service case.
        citations.push(
          citation(
            'VIC LSL Act 2018 s.14(b)',
            'continuous-service.gap-not-counted',
            33
          )
        );
        return overlap;
      case 'apprentice_to_tradesperson_transition':
        // Gap days excluded from accrual when within 52-week cap.
        return overlap;
      case 'transfer_of_business':
        return 0;
    }
  }
  return 0;
}

function addDays(iso: ISODate, days: number): ISODate {
  const dt = new Date(
    Date.UTC(
      Number(iso.slice(0, 4)),
      Number(iso.slice(5, 7)) - 1,
      Number(iso.slice(8, 10))
    )
  );
  dt.setUTCDate(dt.getUTCDate() + days);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}` as ISODate;
}

/**
 * Compute days NOT counted in a lookback window for VIC. Used by value-of-week
 * averaging — events that didn't count as service also don't count in the
 * window denominator (so the average is per-week-actually-worked).
 *
 * Same logic as `computeVICContinuousService` but only sums days in the window
 * range. Does NOT emit citations (those are emitted by the main service walk).
 */
export function computeVICDaysNotCountedInLookback(
  windowStart: ISODate,
  windowEnd: ISODate,
  events: ContinuousServiceEvent[],
  employmentType: EmploymentType,
  extraInputs?: VICExtraInputs
): number {
  const writtenAgreement = extraInputs?.unpaidLeaveWrittenAgreement === true;
  let total = 0;
  const sinkCitations: Citation[] = [];
  for (const ev of events) {
    if (!ev.endDate) continue;
    total += accountEventDaysExcluded(
      ev,
      windowStart,
      windowEnd,
      employmentType,
      writtenAgreement,
      sinkCitations
    );
  }
  return total;
}
