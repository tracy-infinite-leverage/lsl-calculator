import type { ContinuousServiceEvent, Citation, ISODate, Warning } from './types';
import { Decimal } from './decimal';
import { dateGT, inclusiveDays, overlapDays } from './dates';
import { citation } from './citation';

/**
 * Per NSW LSA s.4(11) and research brief §1.4: classification of how each event type
 * affects (a) counting toward service and (b) the lookback denominator.
 *
 *   countsAsService: true if the event days count in `years_of_continuous_service`
 *   countsInLookbackDenominator: true if the event days remain in `(window_days - daysNotCounted)`
 *     (i.e., the employee was being paid through this period — only `paid_leave` qualifies)
 */
const SERVICE_EVENT_RULES: Record<
  ContinuousServiceEvent['type'],
  { countsAsService: boolean; countsInLookbackDenominator: boolean; section: string; pdfPage?: number; ruleKey: string }
> = {
  paid_leave: {
    countsAsService: true,
    countsInLookbackDenominator: true,
    section: 'NSW LSA s.4(11)',
    pdfPage: 14,
    ruleKey: 'continuous-service.paid-leave-counts',
  },
  workers_comp_absence: {
    countsAsService: true,
    countsInLookbackDenominator: false,
    section: 'NSW LSA s.4(11)',
    pdfPage: 16,
    ruleKey: 'continuous-service.workers-comp-counts',
  },
  unpaid_parental_leave: {
    countsAsService: false,
    countsInLookbackDenominator: false,
    section: 'NSW LSA s.4(11)',
    pdfPage: 14,
    ruleKey: 'continuous-service.upl-excluded',
  },
  leave_without_pay: {
    countsAsService: false,
    countsInLookbackDenominator: false,
    section: 'NSW LSA s.4(11)',
    pdfPage: 15,
    ruleKey: 'continuous-service.lwop-excluded',
  },
  industrial_action: {
    countsAsService: false,
    countsInLookbackDenominator: false,
    section: 'NSW LSA s.4(11)',
    pdfPage: 14,
    ruleKey: 'continuous-service.industrial-action-excluded',
  },
  employer_stand_down: {
    countsAsService: false,
    countsInLookbackDenominator: false,
    section: 'NSW LSA s.4(11)',
    pdfPage: 14,
    ruleKey: 'continuous-service.slackness-no-service-no-break',
  },
  jobkeeper_or_covid_standdown: {
    countsAsService: true,
    countsInLookbackDenominator: false,
    section: 'NSW LSA s.4(11)',
    pdfPage: 15,
    ruleKey: 'continuous-service.jobkeeper-counts',
  },
  // The next three are "structural" — handled separately; their day spans are NOT applied
  // to elapsed-service-days arithmetic via the same path.
  transfer_of_business: {
    countsAsService: true,
    countsInLookbackDenominator: true,
    section: 'NSW LSA s.4(6)',
    pdfPage: 16,
    ruleKey: 'continuous-service.transfer-of-business-preserves',
  },
  employer_initiated_termination_and_rehire: {
    countsAsService: false,
    countsInLookbackDenominator: false,
    section: 'NSW LSA s.4(11)',
    pdfPage: 16,
    ruleKey: 'continuous-service.employer-init-rehire',
  },
  apprentice_to_tradesperson_transition: {
    countsAsService: false,
    countsInLookbackDenominator: false,
    section: 'NSW LSA s.4(11)',
    pdfPage: 14,
    ruleKey: 'continuous-service.apprentice-to-trade-within-12mo',
  },
};

/** NSW rehire-gap threshold per F9 + PM clarification #7: inclusive ≤ 60 days. */
const REHIRE_GAP_DAYS_NSW = 60;
/** Apprentice-to-tradesperson 12-month preservation cap per PDF p.14. */
const APPRENTICE_GAP_DAYS_MAX = 365;

export interface ServiceState {
  effectiveServiceStart: ISODate;
  daysOfContinuousService: number;
  daysNotCountedInService: number;
  yearsOfContinuousService: Decimal;
  /** Citations accumulated by this computation. */
  citations: Citation[];
  warnings: Warning[];
  /** Map of event index → days actually excluded (after window intersection). For diagnostics. */
  perEventDaysExcluded: Map<number, number>;
}

/**
 * Compute continuous service days from start to prescribed date, applying:
 *   - employer_initiated_termination_and_rehire gap > 60 days → service breaks; start moves to rehire date
 *   - apprentice_to_tradesperson_transition gap > 365 days → service breaks (rare)
 *   - non-counting events subtract from elapsed days
 */
export function computeContinuousService(
  startDate: ISODate,
  prescribedDate: ISODate,
  events: ContinuousServiceEvent[]
): ServiceState {
  const citations: Citation[] = [];
  const warnings: Warning[] = [];

  // ── Step 1: determine effective service start (may move forward if service was broken)
  let effectiveStart = startDate;

  for (const ev of events) {
    if (ev.type === 'employer_initiated_termination_and_rehire' && ev.endDate) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      if (gap > REHIRE_GAP_DAYS_NSW) {
        // Service breaks — move start to rehire date
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
        warnings.push({
          code: 'gap_exceeds_2mo',
          message: `Employer-initiated re-hire gap of ${gap} days exceeds the NSW 2-month (60-day) preservation cap — prior service not preserved.`,
        });
        citations.push(
          citation(
            'NSW LSA s.4(11)',
            'continuous-service.gap-exceeds-2mo-breaks-service',
            16
          )
        );
      } else {
        citations.push(
          citation(
            'NSW LSA s.4(11)',
            'continuous-service.employer-init-rehire-within-2mo',
            16
          )
        );
        if (gap === REHIRE_GAP_DAYS_NSW) {
          warnings.push({
            code: 'rehire_gap_at_threshold',
            message: `Re-hire gap is exactly ${gap} days — at the NSW preservation threshold.`,
          });
        }
      }
    } else if (
      ev.type === 'apprentice_to_tradesperson_transition' &&
      ev.endDate
    ) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      if (gap > APPRENTICE_GAP_DAYS_MAX) {
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
      } else {
        citations.push(
          citation(
            'NSW LSA s.4(11)',
            'continuous-service.apprentice-to-trade-within-12mo',
            14
          )
        );
      }
    } else if (ev.type === 'transfer_of_business') {
      citations.push(
        citation(
          'NSW LSA s.4(6)',
          'continuous-service.transfer-of-business-preserves',
          16
        )
      );
      citations.push(
        citation(
          'NSW LSA s.4(11)',
          'continuous-service.deemed-continuous',
          16
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
      perEventDaysExcluded: new Map(),
    };
  }

  // ── Step 2: elapsed days from effective start to prescribed date
  const elapsedDays = inclusiveDays(effectiveStart, prescribedDate);

  // ── Step 3: subtract non-counting event days (intersected with [effectiveStart, prescribedDate])
  let daysNotCountedInService = 0;
  const perEventDaysExcluded = new Map<number, number>();

  events.forEach((ev, idx) => {
    if (!ev.endDate) return; // structural events without endDate skipped here
    const rule = SERVICE_EVENT_RULES[ev.type];

    let countsAsService = rule.countsAsService;
    let ruleKey = rule.ruleKey;

    // Special handling: employer_initiated_termination_and_rehire gap counts depending on threshold
    if (ev.type === 'employer_initiated_termination_and_rehire') {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      if (gap <= REHIRE_GAP_DAYS_NSW) {
        // Preserved: gap days don't count toward service (they're excluded time)
        countsAsService = false;
        ruleKey = 'continuous-service.rehire-gap-excluded-from-service';
      } else {
        // Broken: we've already moved effectiveStart past this event — no day subtraction here
        return;
      }
    }
    if (ev.type === 'apprentice_to_tradesperson_transition') {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      if (gap <= APPRENTICE_GAP_DAYS_MAX) {
        countsAsService = false;
        ruleKey = 'continuous-service.apprentice-gap-excluded-from-service';
      } else {
        return;
      }
    }

    // Intersect event range with [effectiveStart, prescribedDate]
    const overlap = overlapDays(
      ev.startDate,
      ev.endDate,
      effectiveStart,
      prescribedDate
    );
    if (overlap <= 0) return;

    if (countsAsService) {
      // Event days count toward service (e.g. workers_comp, jobkeeper, paid_leave) — emit
      // the "counts" citation so callers can trace why the day was preserved.
      citations.push(
        citation(rule.section, ruleKey, rule.pdfPage, ev.note ?? undefined)
      );
      return;
    }

    daysNotCountedInService += overlap;
    perEventDaysExcluded.set(idx, overlap);
    citations.push(
      citation(rule.section, ruleKey, rule.pdfPage, ev.note ?? undefined)
    );
  });

  const daysOfContinuousService = elapsedDays - daysNotCountedInService;
  // Years of service computed as days / 365.25 (legislative convention; pro-rates leap years)
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
    perEventDaysExcluded,
  };
}

/**
 * Compute days-not-counted in a lookback window: sum of event-days where
 * `countsInLookbackDenominator === false`, intersected with the window.
 */
export function computeDaysNotCountedInLookback(
  windowStart: ISODate,
  windowEnd: ISODate,
  events: ContinuousServiceEvent[]
): number {
  let total = 0;
  for (const ev of events) {
    if (!ev.endDate) continue;
    const rule = SERVICE_EVENT_RULES[ev.type];

    // employer_initiated_termination_and_rehire gap: always excluded from lookback denominator
    // (no income earned in that gap regardless of whether prior service was preserved)
    let countsInDenom = rule.countsInLookbackDenominator;
    if (ev.type === 'employer_initiated_termination_and_rehire') {
      countsInDenom = false;
    }
    if (ev.type === 'apprentice_to_tradesperson_transition') {
      countsInDenom = false;
    }

    if (countsInDenom) continue;

    const exclude = overlapDays(ev.startDate, ev.endDate, windowStart, windowEnd);
    total += exclude;
  }
  return total;
}

/** Re-export the rules table for callers needing per-event metadata. */
export const serviceEventRules = SERVICE_EVENT_RULES;
