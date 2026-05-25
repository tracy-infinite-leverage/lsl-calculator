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
import type { SAExtraInputs } from './extra-inputs';

export type { SAExtraInputs };

/**
 * SA continuous-service handling.
 *
 * Single regime — per TBD-SA-01 RESOLUTION (2026-05-25), SA has NO date-aware
 * service routing. The LSL (Calculation of Average Weekly Earnings)
 * Amendment Act 2015 (SA) transitional provision is uniform forward-looking
 * (the amended methodology applies to every calculation taken on or after
 * commencement, INCLUDING in respect of absences before commencement).
 * SA mirrors QLD's flat single-regime architecture.
 *
 * Break tolerances (SA LSL Act 1987 s.6 + SafeWork SA accruing-leave guidance):
 *   - General: 2 months (~61 inclusive days) — same as WA non-slackness;
 *     tighter than QLD's 3-month rule.
 *   - Casual: 3-month engine heuristic without seasonal-shutdown justification;
 *     up to 6 months tolerated where the user supplies a seasonal-shutdown
 *     signal via `extraInputs.sa_seasonal_shutdown_justified` OR a per-event
 *     note containing seasonal/shutdown tokens. Per TBD-SA-02 RESOLUTION.
 *
 * Service-event treatment (s.6 + SafeWork SA accruing-leave guidance):
 *   - paid_leave: counts as service (paid annual / sick / parental / LSL).
 *   - workers_comp_absence: counts as service per SafeWork SA (TBD-SA-05).
 *     SEPARATELY, WC weeks are excluded from the 156-wk casual/PT averaging
 *     window — that exclusion lives in `value-of-week.ts` / the form helper.
 *   - unpaid_parental_leave / leave_without_pay: does NOT count toward
 *     service, but does NOT break continuity (SA "extends-the-line" rule).
 *   - industrial_action / employer_stand_down: continuity preserved; period
 *     itself does not count toward accrual (general s.6 read with the
 *     "doesn't break continuity but doesn't accrue" treatment).
 *   - jobkeeper_or_covid_standdown: continuity preserved; period excluded
 *     from accrual.
 *   - transfer_of_business: service preserved per s.6.
 *   - employer_initiated_termination_and_rehire: gap ≤ 2 mo preserves
 *     service for any employment type; for casuals, gap may extend up to
 *     6 mo with seasonal-shutdown justification.
 *   - apprentice_to_tradesperson_transition: counts as service.
 *
 * Sources:
 *   - SA LSL Act 1987 ss.5, 6 (including PH-inclusive rule in s.5)
 *   - SafeWork SA — accruing-leave / casual-workers / part-time-and-full-time
 *     calculation guidance
 *   - APA LSL Masterclass PDF pp.80-94
 *   - docs/qa/test-cases-sa.md v1.0 PM-signed 2026-05-25
 */

/** SA 2-month general break tolerance (inclusive days). */
const SA_REHIRE_GAP_DAYS = 61; // ~2 months
/** SA 3-month standard casual heuristic (inclusive days) per TBD-SA-02. */
const SA_CASUAL_GAP_DAYS_STANDARD = 91; // ~3 months
/** SA 6-month seasonal-shutdown casual tolerance (inclusive days) per TBD-SA-02. */
const SA_CASUAL_GAP_DAYS_SEASONAL = 183; // ~6 months
/** SA apprentice gap tolerance (inclusive days) — generous default like QLD. */
const SA_APPRENTICE_GAP_DAYS = 365;

const SEASONAL_TOKENS = [
  'seasonal',
  'shutdown',
  'temporary closure',
  'temporary shut',
  'closes janua',
  'closes febru',
  'closes march',
  'closes april',
  'closes may',
  'closes june',
  'closes july',
  'closes august',
  'closes septe',
  'closes octo',
  'closes nove',
  'closes dece',
];

function noteSuggestsSeasonal(note?: string): boolean {
  if (!note) return false;
  const lower = note.toLowerCase();
  return SEASONAL_TOKENS.some((t) => lower.includes(t));
}

export interface SAContinuousServiceState {
  effectiveServiceStart: ISODate;
  daysOfContinuousService: number;
  daysNotCountedInService: number;
  yearsOfContinuousService: Decimal;
  citations: Citation[];
  warnings: Warning[];
}

/**
 * Compute SA continuous service from `startDate` to `prescribedDate`.
 *
 * Walks service events for rehire-gap handling (which may move effective
 * start forward), then walks events again to determine days excluded from
 * accrual. SA has no historical cliffs (TBD-SA-01 / TBD-SA-12).
 */
export function computeSAContinuousService(
  startDate: ISODate,
  prescribedDate: ISODate,
  events: ContinuousServiceEvent[],
  employmentType: EmploymentType,
  extraInputs?: SAExtraInputs
): SAContinuousServiceState {
  const citations: Citation[] = [];
  const warnings: Warning[] = [];

  let effectiveStart = startDate;

  // ── Step 1: rehire-gap handling — may move effective start forward.
  for (const ev of events) {
    if (ev.type === 'employer_initiated_termination_and_rehire' && ev.endDate) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      const isCasual = employmentType === 'casual';
      const seasonal =
        extraInputs?.sa_seasonal_shutdown_justified === true ||
        noteSuggestsSeasonal(ev.note);

      let tolerance: number;
      if (isCasual) {
        tolerance = seasonal
          ? SA_CASUAL_GAP_DAYS_SEASONAL
          : SA_CASUAL_GAP_DAYS_STANDARD;
      } else {
        tolerance = SA_REHIRE_GAP_DAYS;
      }

      if (gap > tolerance) {
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
        warnings.push({
          code: 'gap_exceeds_state_tolerance',
          message: isCasual
            ? seasonal
              ? `Casual employment gap of ~${Math.round(gap / 30)} months exceeds SA's 6-month seasonal-shutdown tolerance under s.6. Pre-gap service forfeited.`
              : `Casual employment gap of ~${Math.round(gap / 30)} months is too long to be 'regular or systematic' under SA LSL Act 1987 s.6. Pre-gap service forfeited.`
            : `Re-employment gap of ~${Math.round(gap / 30)} months exceeds SA's 2-month tolerance under s.6. Pre-gap service forfeited.`,
        });
        citations.push(
          citation(
            'SA LSL Act 1987 s.6',
            isCasual
              ? 'continuous-service.casual-gap-exceeds-tolerance-breaks-service'
              : 'continuous-service.rehire-gap-exceeds-2mo-breaks-service',
            85
          )
        );
      } else {
        if (isCasual && seasonal && gap > SA_CASUAL_GAP_DAYS_STANDARD) {
          warnings.push({
            code: 'sa_casual_seasonal_continuity_preserved',
            message: `Casual employment continuity preserved across a ~${Math.round(gap / 30)}-month seasonal shutdown per SA LSL Act 1987 s.6 and SafeWork SA casual guidance ('seasonal variations, temporary shutdowns' typically do not break continuity).`,
          });
          citations.push(
            citation(
              'SA LSL Act 1987 s.6',
              'continuous-service.casual-seasonal-shutdown-preserves',
              85
            )
          );
        } else {
          citations.push(
            citation(
              'SA LSL Act 1987 s.6',
              isCasual
                ? 'continuous-service.casual-gap-within-tolerance'
                : 'continuous-service.rehire-within-2mo-preserves',
              85
            )
          );
        }
      }
    } else if (
      ev.type === 'apprentice_to_tradesperson_transition' &&
      ev.endDate
    ) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      if (gap > SA_APPRENTICE_GAP_DAYS) {
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
      }
    } else if (ev.type === 'transfer_of_business') {
      // Preserved per s.6.
      warnings.push({
        code: 'transfer_of_business_continuity_preserved_sa',
        message:
          'Service deemed continuous across transfer of business per SA LSL Act 1987 s.6. New employer assumes LSL liability. Sale-of-business contract terms cannot displace this statutory rule.',
      });
      citations.push(
        citation(
          'SA LSL Act 1987 s.6',
          'continuous-service.transfer-of-business-preserves-from-original-start',
          85
        )
      );
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

  // ── Step 2: elapsed days from effective start.
  const elapsedDays = inclusiveDays(effectiveStart, prescribedDate);

  // ── Step 3: walk events to compute days NOT counted as service.
  let daysNotCountedInService = 0;
  for (const ev of events) {
    if (!ev.endDate) continue;
    daysNotCountedInService += accountEventDaysExcluded(
      ev,
      effectiveStart,
      prescribedDate,
      employmentType,
      extraInputs,
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
  extraInputs: SAExtraInputs | undefined,
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
          'SA LSL Act 1987 s.6',
          'continuous-service.paid-leave-counts',
          85
        )
      );
      return 0;

    case 'workers_comp_absence':
      // TBD-SA-05: WC counts toward continuous service per SafeWork SA
      // accruing-leave guidance (illness/injury bucket). Separately, WC
      // weeks are excluded from the 156-wk averaging window — that
      // exclusion is in value-of-week.ts / form helper, not here.
      citations.push(
        citation(
          'SA LSL Act 1987 s.6',
          'continuous-service.workers-comp-counts',
          85
        )
      );
      return 0;

    case 'unpaid_parental_leave':
    case 'leave_without_pay':
      // SA "extends-the-line" — does NOT count as service but does NOT break
      // continuity. Entitlement date moves out by the duration.
      citations.push(
        citation(
          'SA LSL Act 1987 s.6',
          'continuous-service.unpaid-leave-extends-the-line',
          85
        )
      );
      return overlap;

    case 'industrial_action':
      citations.push(
        citation(
          'SA LSL Act 1987 s.6',
          'continuous-service.industrial-action-continuous-but-no-accrual',
          85
        )
      );
      return overlap;

    case 'employer_stand_down':
      citations.push(
        citation(
          'SA LSL Act 1987 s.6',
          'continuous-service.stand-down-continuous-but-no-accrual',
          85
        )
      );
      return overlap;

    case 'jobkeeper_or_covid_standdown':
      citations.push(
        citation(
          'SA LSL Act 1987 s.6',
          'continuous-service.jobkeeper-or-covid-standdown-continuous',
          85
        )
      );
      return overlap;

    case 'employer_initiated_termination_and_rehire': {
      // Gap days are excluded from accrual when prior service is preserved.
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      const isCasual = employmentType === 'casual';
      const seasonal =
        extraInputs?.sa_seasonal_shutdown_justified === true ||
        noteSuggestsSeasonal(ev.note);
      const tolerance = isCasual
        ? seasonal
          ? SA_CASUAL_GAP_DAYS_SEASONAL
          : SA_CASUAL_GAP_DAYS_STANDARD
        : SA_REHIRE_GAP_DAYS;
      if (gap <= tolerance) {
        return overlap;
      }
      // Broken service: those days don't appear in [effectiveStart, prescribedDate]
      // because effectiveStart has already advanced past the gap.
      return 0;
    }

    case 'apprentice_to_tradesperson_transition': {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      if (gap <= SA_APPRENTICE_GAP_DAYS) {
        citations.push(
          citation(
            'SA LSL Act 1987 s.6',
            'continuous-service.apprentice-to-trade-counts',
            85
          )
        );
        return 0;
      }
      return 0;
    }

    case 'transfer_of_business':
      return 0;
  }
  return 0;
}

/**
 * Compute whether an employee's `workers_comp_absence` events overlap a
 * given trigger window. Used to emit the SA WC-overlap advisory per
 * TBD-SA-08 RESOLUTION (parallel to QLD/WA pattern).
 */
export function workersCompOverlapsTrigger(
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
