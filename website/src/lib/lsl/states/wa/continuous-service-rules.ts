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
import {
  preWA2022DaysExcluded,
  preWA2022CasualAdvisoryCitation,
} from './continuous-service-rules-pre-2022';
import { postWA2022DaysExcluded } from './continuous-service-rules-post-2022';
import type { WAExtraInputs } from './extra-inputs';

export type { WAExtraInputs };

/**
 * WA continuous-service dispatcher.
 *
 * Implements the TBD-WA-01 RESOLUTION: single WA rule set with date-aware
 * continuous-service handling. Two `continuous-service-rule` modules
 * (`-pre-2022` and `-post-2022`) feed the SAME s.8 accrual formula. The
 * dispatcher picks pre vs post per absence based on the absence's start
 * date. A third date-aware override at 2024-07-01 (WCIM Act 2023 (WA))
 * sits on top of the post-2022 module for `workers_comp_absence` events.
 *
 * Break tolerances (WA LSL Act 1958 s.6):
 *   - Non-slackness termination + rehire: 2 months (~61 inclusive days).
 *   - Slackness-of-trade termination + rehire: 6 months (~183 inclusive days).
 *     The slackness flag comes from DEV-CROSS-2 `slacknessOfTrade` field on
 *     `employer_initiated_termination_and_rehire`.
 *   - Apprentice → tradesperson: up to 52 weeks (365 days).
 *
 * Sources:
 *   - WA LSL Act 1958 s.6 (pre- and post-2022)
 *   - IR Legislation Amendment Act 2021 (WA) — commenced 2022-06-20
 *   - WCIM Act 2023 (WA) — commenced 2024-07-01
 *   - DEMIRS plain-English guidance
 *   - docs/qa/test-cases-wa.md v1.0 PM-signed 2026-05-25
 */

/** Cutoff date for the IR Legislation Amendment Act 2021 commencement. */
const WA_2022_CUTOFF = '2022-06-20';

/** Cutoff date for the WCIM Act 2023 (WA) commencement (WC counts in full from this date). */
const WA_WCIM_CUTOFF = '2024-07-01';

/** WA re-hire gap tolerances. */
const WA_REHIRE_GAP_DAYS_NON_SLACKNESS = 61; // ~2 months (inclusive days)
const WA_REHIRE_GAP_DAYS_SLACKNESS = 183; // ~6 months
const WA_APPRENTICE_GAP_DAYS = 365; // 52 weeks

/** Decide regime: an event starting strictly before 2022-06-20 → pre-2022 rules. */
function isPre2022Absence(event: ContinuousServiceEvent): boolean {
  return event.startDate < WA_2022_CUTOFF;
}

/**
 * Split an event that straddles 2022-06-20 into two halves. Returns null for
 * any half that doesn't exist.
 */
function splitAt2022Cutoff(event: ContinuousServiceEvent): {
  preCutoff: { startDate: ISODate; endDate: ISODate } | null;
  postCutoff: { startDate: ISODate; endDate: ISODate } | null;
} {
  if (!event.endDate) return { preCutoff: null, postCutoff: null };
  const startsBefore = event.startDate < WA_2022_CUTOFF;
  const endsBefore = event.endDate < WA_2022_CUTOFF;
  if (startsBefore && endsBefore) {
    return {
      preCutoff: { startDate: event.startDate, endDate: event.endDate },
      postCutoff: null,
    };
  }
  if (!startsBefore) {
    return {
      preCutoff: null,
      postCutoff: { startDate: event.startDate, endDate: event.endDate },
    };
  }
  // Straddles — split. Pre-portion ends 2022-06-19; post starts 2022-06-20.
  return {
    preCutoff: { startDate: event.startDate, endDate: '2022-06-19' as ISODate },
    postCutoff: { startDate: WA_2022_CUTOFF as ISODate, endDate: event.endDate },
  };
}

/**
 * Split a workers_comp event at 2024-07-01 (WCIM Act 2023 cutoff). Days
 * on/after 2024-07-01 count regardless of which pre/post-2022 module is active.
 */
function splitAtWCIMCutoff(
  startDate: ISODate,
  endDate: ISODate
): {
  preCutoff: { startDate: ISODate; endDate: ISODate } | null;
  postCutoff: { startDate: ISODate; endDate: ISODate } | null;
} {
  const startsBefore = startDate < WA_WCIM_CUTOFF;
  const endsBefore = endDate < WA_WCIM_CUTOFF;
  if (startsBefore && endsBefore) {
    return {
      preCutoff: { startDate, endDate },
      postCutoff: null,
    };
  }
  if (!startsBefore) {
    return {
      preCutoff: null,
      postCutoff: { startDate, endDate },
    };
  }
  // Straddles — split.
  return {
    preCutoff: { startDate, endDate: '2024-06-30' as ISODate },
    postCutoff: { startDate: WA_WCIM_CUTOFF as ISODate, endDate },
  };
}

export interface WAContinuousServiceState {
  effectiveServiceStart: ISODate;
  daysOfContinuousService: number;
  daysNotCountedInService: number;
  yearsOfContinuousService: Decimal;
  citations: Citation[];
  warnings: Warning[];
  /** True if any segment was governed by pre-2022 rules — drives regime-split warning. */
  regimeSplitApplied: boolean;
  /** True if any WC pre-2024-07-01 days were excluded. */
  workersCompPre2024Excluded: boolean;
  /** True if any WC absence had paidConcurrent or returnToWorkProgram exception fire. */
  workersCompPaidConcurrent: boolean;
  /** True if any pre-2022 casual gap > 0 days surfaced the no-specific-rules advisory. */
  pre2022CasualAdvisoryEmitted: boolean;
}

/**
 * Compute WA continuous service from `startDate` to `prescribedDate`.
 *
 * Implements the TBD-WA-01 RESOLUTION single-rule-set-with-date-aware-handling
 * pattern. Per-absence regime selection by absence start date; straddling
 * absences split at 2022-06-20. Workers-comp absences also split at
 * 2024-07-01 for the WCIM Act 2023 override.
 */
export function computeWAContinuousService(
  startDate: ISODate,
  prescribedDate: ISODate,
  events: ContinuousServiceEvent[],
  employmentType: EmploymentType,
  extraInputs?: WAExtraInputs
): WAContinuousServiceState {
  const citations: Citation[] = [];
  const warnings: Warning[] = [];
  let regimeSplitApplied = false;
  let workersCompPre2024Excluded = false;
  let workersCompPaidConcurrent = false;
  let pre2022CasualAdvisoryEmitted = false;

  // Insufficient-granularity fallback: apply post-2022 rules across the
  // entire tenure and emit `wa_regime_split_data_insufficient`.
  const useFallback = extraInputs?.regimeSplitDataInsufficient === true;
  if (useFallback) {
    warnings.push({
      code: 'wa_regime_split_data_insufficient',
      message:
        'Service spans 20 June 2022 but the supplied wage history lacks the date granularity to determine the pre/post 2022 status of historical absences. The engine has applied post-2022 continuous-service rules to the entire tenure as a single-regime fallback. To obtain the dual-regime calculation, re-upload with at least monthly wage-history granularity.',
    });
    citations.push(
      citation(
        'WA LSL Act 1958 s.6',
        'continuous-service.post-2022',
        36
      )
    );
  }

  // ── Step 1: determine effective service start (may move forward).
  let effectiveStart = startDate;

  for (const ev of events) {
    if (ev.type === 'employer_initiated_termination_and_rehire' && ev.endDate) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      const slackness = ev.slacknessOfTrade === true;
      const tolerance = slackness
        ? WA_REHIRE_GAP_DAYS_SLACKNESS
        : WA_REHIRE_GAP_DAYS_NON_SLACKNESS;
      if (gap > tolerance) {
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
        warnings.push({
          code: 'gap_exceeds_state_tolerance',
          message: slackness
            ? `Re-hire gap exceeded WA's 6-month limit (slackness-of-trade termination) — prior service not preserved per WA LSL Act 1958 s.6.`
            : `Re-hire gap exceeded WA's 2-month limit (non-slackness termination) — prior service not preserved per WA LSL Act 1958 s.6.`,
        });
        citations.push(
          citation(
            'WA LSL Act 1958 s.6',
            slackness
              ? 'continuous-service.rehire-gap-exceeds-6mo-slackness-breaks-service'
              : 'continuous-service.rehire-gap-exceeds-2mo-non-slackness-breaks-service',
            36
          )
        );
      } else {
        citations.push(
          citation(
            'WA LSL Act 1958 s.6',
            slackness
              ? 'continuous-service.rehire-within-6mo-slackness'
              : 'continuous-service.rehire-within-2mo-non-slackness',
            36
          )
        );
      }
      // Pre-2022 casual advisory for any pre-2022 casual gap > 0 days.
      if (
        employmentType === 'casual' &&
        !useFallback &&
        isPre2022Absence(ev) &&
        gap > 0 &&
        !pre2022CasualAdvisoryEmitted
      ) {
        warnings.push({
          code: 'wa_pre_2022_casual_no_specific_rules',
          message:
            'Casual gap falls within a pre-2022 accrual block. Pre-2022 WA LSL Act had no specific casual continuity rules; the general s.6 re-employment rules apply (2 months non-slackness; 6 months slackness of trade). Prior casual service across this gap may be more restrictive than case law would allow.',
        });
        citations.push(preWA2022CasualAdvisoryCitation());
        pre2022CasualAdvisoryEmitted = true;
      }
    } else if (
      ev.type === 'apprentice_to_tradesperson_transition' &&
      ev.endDate
    ) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      if (gap > WA_APPRENTICE_GAP_DAYS) {
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
      } else {
        citations.push(
          citation(
            'WA LSL Act 1958 s.6',
            'continuous-service.apprentice-to-trade-within-52wks',
            36
          )
        );
      }
    } else if (ev.type === 'transfer_of_business') {
      // Service preserved across change of ownership. Emit citation here
      // because transfer_of_business events typically lack an endDate and
      // are skipped by the day-exclusion walk.
      if (!isPre2022Absence(ev) || useFallback) {
        citations.push(
          citation(
            'WA LSL Act 1958 s.6',
            'continuous-service.post-2022.transfer-of-business-preserves',
            36
          )
        );
      } else {
        citations.push(
          citation(
            'WA LSL Act 1958 s.6',
            'continuous-service.pre-2022.transfer-of-business-preserves',
            36
          )
        );
      }
    } else if (
      employmentType === 'casual' &&
      (ev.type === 'leave_without_pay' || ev.type === 'unpaid_parental_leave') &&
      ev.endDate &&
      !useFallback
    ) {
      // Casual gap handling: if the gap exceeds the standard 2-mo tolerance,
      // and we are PRE-2022, surface the casual-no-specific-rules advisory.
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      if (
        isPre2022Absence(ev) &&
        gap > WA_REHIRE_GAP_DAYS_NON_SLACKNESS &&
        !pre2022CasualAdvisoryEmitted
      ) {
        // Break casual service at the end of the gap (general s.6 fallback).
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
        warnings.push({
          code: 'wa_pre_2022_casual_no_specific_rules',
          message: `Casual gap of ${gap} days falls within a pre-2022 accrual block. Pre-2022 WA LSL Act had no specific casual continuity rules; the general 2-month re-employment rule applies. Prior casual service before this gap not preserved.`,
        });
        citations.push(preWA2022CasualAdvisoryCitation());
        pre2022CasualAdvisoryEmitted = true;
      }
    }
  }

  // Bounds check.
  if (dateGT(effectiveStart, prescribedDate)) {
    return {
      effectiveServiceStart: effectiveStart,
      daysOfContinuousService: 0,
      daysNotCountedInService: 0,
      yearsOfContinuousService: new Decimal(0),
      citations,
      warnings,
      regimeSplitApplied,
      workersCompPre2024Excluded,
      workersCompPaidConcurrent,
      pre2022CasualAdvisoryEmitted,
    };
  }

  // ── Step 2: elapsed days.
  const elapsedDays = inclusiveDays(effectiveStart, prescribedDate);

  // ── Step 3: walk events to determine days excluded from accrual.
  let daysNotCountedInService = 0;

  for (const ev of events) {
    if (!ev.endDate) continue;

    // Workers Comp gets the 2024-07-01 split + DEMIRS paid-concurrent/RTW exception.
    if (ev.type === 'workers_comp_absence') {
      const splitWCIM = splitAtWCIMCutoff(ev.startDate, ev.endDate);
      // Track exception flag for advisory emission.
      if (ev.paidConcurrent === true) {
        workersCompPaidConcurrent = true;
      }
      // Post-2024-07-01 portion: counts in full.
      if (splitWCIM.postCutoff) {
        citations.push(
          citation(
            'WCIM Act 2023 (WA)',
            'workers-comp-counts-from-2024-07-01'
          )
        );
        // overlap is 0 excluded — counts as service.
      }
      // Pre-2024-07-01 portion: apply per-2022-regime rule.
      if (splitWCIM.preCutoff) {
        const preEvSegment: ContinuousServiceEvent = {
          ...ev,
          startDate: splitWCIM.preCutoff.startDate,
          endDate: splitWCIM.preCutoff.endDate,
        };
        // Now also apply the 2022 cutoff inside this pre-WCIM portion.
        if (useFallback) {
          const excluded = postWA2022DaysExcluded(
            preEvSegment,
            preEvSegment.startDate,
            preEvSegment.endDate!,
            effectiveStart,
            prescribedDate,
            employmentType,
            citations
          );
          if (excluded > 0) {
            workersCompPre2024Excluded = true;
            warnings.push({
              code: 'wa_workers_comp_pre_2024_excluded',
              message: `Workers compensation absence partially pre-2024-07-01: ${excluded} days excluded from continuous employment (pre-WCIM Act 2023 commencement).`,
            });
          }
          daysNotCountedInService += excluded;
        } else {
          // Apply pre/post 2022 split.
          const split22 = splitAt2022Cutoff(preEvSegment);
          let excludedTotal = 0;
          if (split22.preCutoff) {
            regimeSplitApplied = true;
            excludedTotal += preWA2022DaysExcluded(
              preEvSegment,
              split22.preCutoff.startDate,
              split22.preCutoff.endDate,
              effectiveStart,
              prescribedDate,
              employmentType,
              citations
            );
          }
          if (split22.postCutoff) {
            excludedTotal += postWA2022DaysExcluded(
              preEvSegment,
              split22.postCutoff.startDate,
              split22.postCutoff.endDate,
              effectiveStart,
              prescribedDate,
              employmentType,
              citations
            );
          }
          if (excludedTotal > 0) {
            workersCompPre2024Excluded = true;
            warnings.push({
              code: 'wa_workers_comp_pre_2024_excluded',
              message:
                splitWCIM.postCutoff !== null
                  ? `Workers compensation absence partially pre-2024-07-01: ${excludedTotal} days excluded from continuous employment (pre-WCIM Act 2023 commencement); post-cutoff days counted in full.`
                  : `Workers compensation absence entirely pre-2024-07-01: ${excludedTotal} days excluded from continuous employment under WA LSL Act 1958 s.6 (WCIM Act 2023 confers counting only from 1 July 2024 onward).`,
            });
            // Add WCIM Act citation as reference for the override.
            citations.push(
              citation(
                'WCIM Act 2023 (WA)',
                'workers-comp-counts-from-2024-07-01'
              )
            );
          }
          daysNotCountedInService += excludedTotal;
        }
      }
      continue;
    }

    // Non-WC events: apply pre/post 2022 split (with fallback override).
    if (useFallback) {
      daysNotCountedInService += postWA2022DaysExcluded(
        ev,
        ev.startDate,
        ev.endDate,
        effectiveStart,
        prescribedDate,
        employmentType,
        citations
      );
      continue;
    }

    const split = splitAt2022Cutoff(ev);
    if (split.preCutoff && split.postCutoff) {
      // Straddling — split.
      regimeSplitApplied = true;
      daysNotCountedInService += preWA2022DaysExcluded(
        ev,
        split.preCutoff.startDate,
        split.preCutoff.endDate,
        effectiveStart,
        prescribedDate,
        employmentType,
        citations
      );
      daysNotCountedInService += postWA2022DaysExcluded(
        ev,
        split.postCutoff.startDate,
        split.postCutoff.endDate,
        effectiveStart,
        prescribedDate,
        employmentType,
        citations
      );
    } else if (split.preCutoff) {
      regimeSplitApplied = true;
      daysNotCountedInService += preWA2022DaysExcluded(
        ev,
        split.preCutoff.startDate,
        split.preCutoff.endDate,
        effectiveStart,
        prescribedDate,
        employmentType,
        citations
      );
    } else if (split.postCutoff) {
      daysNotCountedInService += postWA2022DaysExcluded(
        ev,
        split.postCutoff.startDate,
        split.postCutoff.endDate,
        effectiveStart,
        prescribedDate,
        employmentType,
        citations
      );
    }
  }

  const daysOfContinuousService = Math.max(0, elapsedDays - daysNotCountedInService);
  const yearsOfContinuousService = new Decimal(daysOfContinuousService).dividedBy(
    new Decimal('365.25')
  );

  // Detect regime-split applied even with no events — if tenure straddles
  // 2022-06-20, the first/subsequent accrual blocks may be governed by
  // different rules and we surface the regime-split advisory.
  if (!useFallback && !regimeSplitApplied && startDate < WA_2022_CUTOFF && prescribedDate >= WA_2022_CUTOFF) {
    regimeSplitApplied = true;
  }

  // Emit `wa_regime_split_applied` warning when split is engaged (and not in
  // fallback mode — fallback already explained via the data-insufficient code).
  if (regimeSplitApplied && !useFallback) {
    warnings.push({
      code: 'wa_regime_split_applied',
      message:
        'Service spans 20 June 2022. Pre-2022 and post-2022 continuous-service rules have been applied to the relevant accrual blocks per WA LSL Act 1958 s.6 (as amended by IR Legislation Amendment Act 2021).',
    });
  }

  // Emit `wa_workers_comp_paid_concurrent` advisory if exception fired.
  if (workersCompPaidConcurrent) {
    warnings.push({
      code: 'wa_workers_comp_paid_concurrent',
      message:
        'Workers compensation absence overlapped paid leave (annual or LSL) — counts as continuous employment per WA LSL Act 1958 s.6 exception (employee receiving paid leave concurrent with WC).',
    });
  }

  return {
    effectiveServiceStart: effectiveStart,
    daysOfContinuousService,
    daysNotCountedInService,
    yearsOfContinuousService,
    citations,
    warnings,
    regimeSplitApplied,
    workersCompPre2024Excluded,
    workersCompPaidConcurrent,
    pre2022CasualAdvisoryEmitted,
  };
}

/**
 * Compute the inclusive day count an employee's `workers_comp_absence`
 * events overlap a given trigger window. Returns true if any WC event was
 * active at the trigger date. Drives `wa_lsl_calculated_at_wc_reduced_rate_warning`.
 */
export function workersCompOverlapsTriggerWA(
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
