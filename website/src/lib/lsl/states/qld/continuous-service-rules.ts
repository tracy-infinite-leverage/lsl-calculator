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
import type { QLDExtraInputs } from './extra-inputs';

export type { QLDExtraInputs };

/**
 * QLD continuous-service handling.
 *
 * Single-regime — the QLD IR Act 2016 commenced cleanly on 1 March 2017
 * with no s.57-style transitional carry-forward (the 1999 Act was repealed).
 * Per TBD-QLD-02 the only historical-cliff handling is:
 *
 *   - **s.103 casual cliff (1994-03-30, HARD-ANCHOR)**: when employee is
 *     casual AND startDate < 1994-03-30, anchor effective service start at
 *     1994-03-30. Emit `pre_1994_casual_cliff_qld` warning. Applies only to
 *     the casual portion — permanent service from a casual-to-permanent
 *     transition continues to count fully.
 *
 *   - **s.96 general cliff (1990-06-23, ADVISORY-ONLY)**: when startDate <
 *     1990-06-23, use actual start date in accrual computation BUT emit
 *     `pre_1990_service_advisory_qld` warning. Calculator does not adjudicate
 *     whether a pre-1990 industrial award preserved service.
 *
 *   - **Both cliffs applied to a casual-to-permanent transition** are
 *     captured by the s.103 hard-anchor alone in v1 (the engine receives a
 *     single `employmentType` field; the casual cliff anchors to 1994-03-30
 *     and an additional `employment_type_transition_qld` warning surfaces
 *     the nuance).
 *
 * Break tolerances (QLD IR Act 2016 s.103 + s.134):
 *   - General + casual: 3 months between contracts (91 inclusive days).
 *     The state-agnostic `gap_exceeds_state_tolerance` warning is reused
 *     with QLD-specific message text ("3 months").
 *
 * Service-event treatment (s.134 + Business QLD interpretive guidance):
 *   - paid_leave: counts as service.
 *   - workers_comp_absence: counts as service (Business QLD).
 *   - unpaid_parental_leave / leave_without_pay: does NOT count toward
 *     service, but does NOT break continuity (QLD's UPL rule is simpler
 *     than VIC's 52-wk-counts).
 *   - industrial_action / employer_stand_down: continuity preserved per
 *     s.134(2); period itself does not count toward accrual (aligns with
 *     VIC s.14(c) per TBD-QLD-02 resolution).
 *   - jobkeeper_or_covid_standdown: continuity preserved; period excluded
 *     from accrual.
 *   - transfer_of_business: service preserved per s.134.
 *   - employer_initiated_termination_and_rehire: gap < 3 mo preserves
 *     service; gap > 3 mo breaks.
 *   - apprentice_to_tradesperson_transition: counts as service.
 *
 * Sources:
 *   - QLD IR Act 2016 ss.93, 96, 103, 134
 *   - Business Queensland — Office of Industrial Relations guidance
 *   - APA LSL Masterclass PDF pp.49-58
 *   - docs/qa/test-cases-qld.md v1.0 PM-signed 2026-05-25
 */

/** QLD 3-month break tolerance (inclusive days). */
const QLD_REHIRE_GAP_DAYS = 91;
const QLD_APPRENTICE_GAP_DAYS = 365;

/** s.103 casual cliff: from this date onward, casual service counts toward LSL. */
const QLD_CASUAL_CLIFF_DATE = '1994-03-30';
/** s.96 general cliff: pre-1990 service triggers an advisory only. */
const QLD_GENERAL_CLIFF_DATE = '1990-06-23';

export interface QLDContinuousServiceState {
  effectiveServiceStart: ISODate;
  daysOfContinuousService: number;
  daysNotCountedInService: number;
  yearsOfContinuousService: Decimal;
  citations: Citation[];
  warnings: Warning[];
}

/**
 * Compute QLD continuous service from `startDate` to `prescribedDate`.
 *
 * Applies the s.103 casual hard-anchor first (may move effective start
 * forward), then walks service events to determine days excluded from
 * accrual. The s.96 general advisory is emitted but does NOT alter the
 * arithmetic.
 */
export function computeQLDContinuousService(
  startDate: ISODate,
  prescribedDate: ISODate,
  events: ContinuousServiceEvent[],
  employmentType: EmploymentType,
  _extraInputs?: QLDExtraInputs
): QLDContinuousServiceState {
  const citations: Citation[] = [];
  const warnings: Warning[] = [];
  // `_extraInputs` reserved for future signals (e.g. employment-type history);
  // unused in v1 — single `employmentType` drives the cliff logic.
  void _extraInputs;

  // ── Step 0: apply s.103 casual hard-anchor.
  let effectiveStart = startDate;
  if (employmentType === 'casual' && startDate < QLD_CASUAL_CLIFF_DATE) {
    effectiveStart = QLD_CASUAL_CLIFF_DATE as ISODate;
    warnings.push({
      code: 'pre_1994_casual_cliff_qld',
      message:
        'This casual employee\'s start date precedes 30 March 1994. Casual service before that date does not count toward LSL under QLD IR Act 2016 s.103. Engine has anchored service to 30 March 1994.',
    });
    citations.push(
      citation(
        'QLD IR Act 2016 s.103',
        'continuous-service.casual-cliff-30mar1994',
        56
      )
    );
    // If the original start was also pre-1990, surface the transition advisory too.
    if (startDate < QLD_GENERAL_CLIFF_DATE) {
      warnings.push({
        code: 'employment_type_transition_qld',
        message:
          'Casual service before 30 March 1994 excluded; subsequent permanent service from the casual-to-permanent transition date counts fully.',
      });
      citations.push(
        citation(
          'QLD IR Act 2016 s.134',
          'continuous-service.casual-to-permanent-transition',
          56
        )
      );
    }
  } else if (startDate < QLD_GENERAL_CLIFF_DATE) {
    // s.96 advisory only — actual start date used in computation.
    warnings.push({
      code: 'pre_1990_service_advisory_qld',
      message:
        "This employee's start date predates 23 June 1990. The Industrial Relations Act 2016 (Qld) s.96 contains transitional rules for service before that date. In practice the employee's post-1990 service alone exceeds the qualifying period, so the cliff is moot for the accrual calculation; we flag it here so the user can confirm with their industrial relations adviser if the employee's pre-1990 service is governed by an earlier industrial award that may have preserved it. Engine has used the full start date as the service anchor; if the user prefers a 23 June 1990 anchor, recompute with a manual override.",
    });
    citations.push(
      citation(
        'QLD IR Act 2016 s.96',
        'continuous-service.pre-1990-cliff-advisory',
        51
      )
    );
  } else if (employmentType !== 'casual' && startDate >= QLD_GENERAL_CLIFF_DATE) {
    // For permanent employees with post-1990 start, surface the "cliff not engaged"
    // diagnostic only if start year is in the 1990–2000 window where it would matter.
    if (startDate < '2000-01-01') {
      citations.push(
        citation(
          'QLD IR Act 2016 s.96',
          'continuous-service.pre-1990-cliff-not-engaged',
          51,
          'Start date post-1990; cliff not engaged'
        )
      );
    }
  }

  // ── Step 1: rehire-gap handling — may further move effective start forward.
  for (const ev of events) {
    if (ev.type === 'employer_initiated_termination_and_rehire' && ev.endDate) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      const tolerance = QLD_REHIRE_GAP_DAYS;
      if (gap > tolerance) {
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
        warnings.push({
          code: 'gap_exceeds_state_tolerance',
          message:
            employmentType === 'casual'
              ? `Casual gap exceeded QLD's 3-month limit between contracts — prior casual service not preserved per QLD IR Act 2016 s.103.`
              : `Re-hire gap exceeded QLD's 3-month limit — prior service not preserved per QLD IR Act 2016 s.134.`,
        });
        citations.push(
          citation(
            employmentType === 'casual'
              ? 'QLD IR Act 2016 s.103'
              : 'QLD IR Act 2016 s.134',
            employmentType === 'casual'
              ? 'continuous-service.casual-3mo-gap-breaks-service'
              : 'continuous-service.gap-exceeds-3mo-breaks-service',
            56
          )
        );
      } else {
        citations.push(
          citation(
            'QLD IR Act 2016 s.134',
            'continuous-service.rehire-within-3mo-preserves',
            56
          )
        );
      }
    } else if (
      ev.type === 'apprentice_to_tradesperson_transition' &&
      ev.endDate
    ) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      if (gap > QLD_APPRENTICE_GAP_DAYS) {
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
      }
    } else if (ev.type === 'transfer_of_business') {
      // Preserved per s.134 — also covers the dismissal-at-transfer + rehire-within-3-mo
      // pattern (broader carve-out than the generic s.134 3-month rule).
      citations.push(
        citation(
          'QLD IR Act 2016 s.134',
          'continuous-service.transfer-of-business-preserves-from-original-start',
          56
        )
      );
    }
  }

  // For casual-only check: s.103 also applies to LWOP-style gaps between contracts.
  if (employmentType === 'casual') {
    for (const ev of events) {
      if (
        (ev.type === 'leave_without_pay' || ev.type === 'unpaid_parental_leave') &&
        ev.endDate
      ) {
        const gap = inclusiveDays(ev.startDate, ev.endDate);
        if (gap > QLD_REHIRE_GAP_DAYS) {
          if (dateGT(ev.endDate, effectiveStart)) {
            effectiveStart = ev.endDate;
          }
          warnings.push({
            code: 'gap_exceeds_state_tolerance',
            message: `Casual gap exceeded QLD's 3-month limit between contracts — prior casual service not preserved per QLD IR Act 2016 s.103.`,
          });
          citations.push(
            citation(
              'QLD IR Act 2016 s.103',
              'continuous-service.casual-3mo-gap-breaks-service',
              56
            )
          );
        } else {
          citations.push(
            citation(
              'QLD IR Act 2016 s.103',
              'continuous-service.casual-3mo-gap-rule',
              56
            )
          );
        }
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
    };
  }

  // ── Step 2: elapsed days.
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
 * Days excluded from accrual for a single event, intersected with the
 * `[effectiveStart, prescribedDate]` range. Side-effect: appends the rule's
 * citation.
 */
function accountEventDaysExcluded(
  ev: ContinuousServiceEvent,
  effectiveStart: ISODate,
  prescribedDate: ISODate,
  employmentType: EmploymentType,
  citations: Citation[]
): number {
  if (!ev.endDate) return 0;
  const overlap = overlapDays(
    ev.startDate,
    ev.endDate,
    effectiveStart,
    prescribedDate
  );
  if (overlap <= 0) return 0;

  switch (ev.type) {
    case 'paid_leave':
      citations.push(
        citation(
          'QLD IR Act 2016 s.134',
          'continuous-service.paid-leave-counts',
          56
        )
      );
      citations.push(
        citation(
          'QLD IR Act 2016 s.93',
          'continuous-service.definition-includes-paid-leave',
          49
        )
      );
      return 0;

    case 'workers_comp_absence':
      citations.push(
        citation(
          'QLD IR Act 2016 s.134',
          'continuous-service.workers-comp-counts',
          56
        )
      );
      return 0;

    case 'unpaid_parental_leave':
    case 'leave_without_pay':
      citations.push(
        citation(
          'QLD IR Act 2016 s.134',
          'continuous-service.unpaid-leave-does-not-count-but-no-break',
          56
        )
      );
      return overlap;

    case 'industrial_action':
      citations.push(
        citation(
          'QLD IR Act 2016 s.134',
          'continuous-service.industrial-action-continuous-but-no-accrual',
          56
        )
      );
      return overlap;

    case 'employer_stand_down':
      citations.push(
        citation(
          'QLD IR Act 2016 s.134',
          'continuous-service.stand-down-slackness-continuous-but-no-accrual',
          56
        )
      );
      return overlap;

    case 'jobkeeper_or_covid_standdown':
      citations.push(
        citation(
          'QLD IR Act 2016 s.134',
          'continuous-service.jobkeeper-or-covid-standdown-continuous',
          56
        )
      );
      return overlap;

    case 'employer_initiated_termination_and_rehire': {
      // Gap days are excluded from accrual when prior service is preserved.
      // Effective-start logic in Step 1 handles broken-service case.
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      if (gap <= QLD_REHIRE_GAP_DAYS) {
        return overlap;
      }
      // Broken service: those days don't appear in [effectiveStart, prescribedDate]
      // because effectiveStart has already advanced past the gap.
      return 0;
    }

    case 'apprentice_to_tradesperson_transition': {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      if (gap <= QLD_APPRENTICE_GAP_DAYS) {
        citations.push(
          citation(
            'QLD IR Act 2016 s.134',
            'continuous-service.apprentice-to-trade-counts',
            56
          )
        );
        return 0;
      }
      return 0;
    }

    case 'transfer_of_business':
      return 0;
  }
  // Defensive: `void` silences exhaustive-switch checks on a new type.
  void employmentType;
  return 0;
}

/**
 * Compute the inclusive day count an employee's `workers_comp_absence`
 * events overlap a given trigger window.  Returns 0 if no overlap.
 *
 * Used by the orchestrator to emit `qld_lsl_calculated_at_wc_reduced_rate_warning`.
 * A simple windowed-overlap check — a 7-day window straddling the trigger
 * date is sufficient to capture "active WC at trigger time".
 */
export function workersCompOverlapsTrigger(
  events: ContinuousServiceEvent[],
  triggerDate: ISODate
): boolean {
  // Build a single-day window for the trigger date.
  for (const ev of events) {
    if (ev.type !== 'workers_comp_absence') continue;
    if (!ev.endDate) {
      // Open-ended WC absence: started <= trigger date counts as active.
      if (ev.startDate <= triggerDate) return true;
      continue;
    }
    const overlap = overlapDays(ev.startDate, ev.endDate, triggerDate, triggerDate);
    if (overlap > 0) return true;
  }
  return false;
}
