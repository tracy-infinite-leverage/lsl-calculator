import type { ContinuousServiceEvent, Citation, ISODate, Warning } from './types';
import { Decimal } from './decimal';
import { dateGT, inclusiveDays, overlapDays } from './dates';
import { citation } from './citation';

/**
 * Per-event treatment classification.
 *
 *   countsAsService: true if the event days count in `years_of_continuous_service`
 *   countsInLookbackDenominator: true if the event days remain in `(window_days - daysNotCounted)`
 *     (i.e., the employee was being paid through this period)
 *
 * The exact rule values are STATE-SPECIFIC and live under
 * `website/src/lib/lsl/states/{state}/continuous-service-rules.ts`. The shared engine
 * only knows the SHAPE.
 */
export interface ServiceEventRule {
  countsAsService: boolean;
  countsInLookbackDenominator: boolean;
  section: string;
  pdfPage?: number;
  ruleKey: string;
  /**
   * Additional citations emitted alongside the primary rule citation when this
   * event type is encountered. Used by NSW for `transfer_of_business` to emit
   * both `s.4(6)` (preserves) and `s.4(11)` (deemed-continuous).
   */
  extraCitations?: Array<{ section: string; ruleKey: string; pdfPage?: number }>;
}

/**
 * Per-state profile passed into the shared engine arithmetic.
 *
 * Every state ships one of these — see `states/nsw/continuous-service-rules.ts`
 * for the NSW reference. Adding a new state means writing a new profile, not
 * modifying this file.
 */
export interface ContinuousServiceProfile {
  /** State this profile encodes — for citation provenance only. */
  state: string;
  /** Map of every ServiceEventType → its state's classification. */
  serviceEventRules: Record<ContinuousServiceEvent['type'], ServiceEventRule>;
  /**
   * Maximum allowed gap (in inclusive days) for an employer-initiated
   * termination-and-rehire to preserve prior service. NSW = 60, VIC/QLD/TAS = ~90.
   */
  rehireGapDaysMax: number;
  /**
   * Maximum allowed apprentice-to-tradesperson transition gap (inclusive days)
   * for prior service to be preserved.
   */
  apprenticeGapDaysMax: number;
  /**
   * Citation emitted when an employer-rehire gap exceeds the threshold and
   * service breaks.
   */
  gapExceedsThresholdCitation: { section: string; ruleKey: string; pdfPage?: number };
  /**
   * Citation emitted when an employer-rehire gap is within threshold and
   * service is preserved.
   */
  gapWithinThresholdCitation: { section: string; ruleKey: string; pdfPage?: number };
  /**
   * User-facing warning message when an employer-rehire gap exceeds the
   * threshold. Receives `gap` (days) and `thresholdDays` for interpolation.
   */
  gapExceedsThresholdMessage: (gap: number, thresholdDays: number) => string;
  /**
   * User-facing warning message when a re-hire gap lands exactly on the
   * threshold. Receives `gap` (days).
   */
  gapAtThresholdMessage: (gap: number) => string;
}

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
 *   - employer_initiated_termination_and_rehire gap > threshold → service breaks; start moves to rehire date
 *   - apprentice_to_tradesperson_transition gap > threshold → service breaks (rare)
 *   - non-counting events subtract from elapsed days
 *
 * State-specific rule values (rehire threshold, per-event treatment, citations)
 * are passed in via `profile`. The arithmetic itself is state-agnostic.
 */
export function computeContinuousService(
  startDate: ISODate,
  prescribedDate: ISODate,
  events: ContinuousServiceEvent[],
  profile: ContinuousServiceProfile
): ServiceState {
  const citations: Citation[] = [];
  const warnings: Warning[] = [];

  // ── Step 1: determine effective service start (may move forward if service was broken)
  let effectiveStart = startDate;

  for (const ev of events) {
    if (ev.type === 'employer_initiated_termination_and_rehire' && ev.endDate) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      if (gap > profile.rehireGapDaysMax) {
        // Service breaks — move start to rehire date
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
        warnings.push({
          code: 'gap_exceeds_state_tolerance',
          message: profile.gapExceedsThresholdMessage(gap, profile.rehireGapDaysMax),
        });
        citations.push(
          citation(
            profile.gapExceedsThresholdCitation.section,
            profile.gapExceedsThresholdCitation.ruleKey,
            profile.gapExceedsThresholdCitation.pdfPage
          )
        );
      } else {
        citations.push(
          citation(
            profile.gapWithinThresholdCitation.section,
            profile.gapWithinThresholdCitation.ruleKey,
            profile.gapWithinThresholdCitation.pdfPage
          )
        );
        if (gap === profile.rehireGapDaysMax) {
          warnings.push({
            code: 'rehire_gap_at_threshold',
            message: profile.gapAtThresholdMessage(gap),
          });
        }
      }
    } else if (
      ev.type === 'apprentice_to_tradesperson_transition' &&
      ev.endDate
    ) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      if (gap > profile.apprenticeGapDaysMax) {
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
      } else {
        const rule = profile.serviceEventRules.apprentice_to_tradesperson_transition;
        citations.push(citation(rule.section, rule.ruleKey, rule.pdfPage));
      }
    } else if (ev.type === 'transfer_of_business') {
      const rule = profile.serviceEventRules.transfer_of_business;
      citations.push(citation(rule.section, rule.ruleKey, rule.pdfPage));
      if (rule.extraCitations) {
        for (const ec of rule.extraCitations) {
          citations.push(citation(ec.section, ec.ruleKey, ec.pdfPage));
        }
      }
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
    const rule = profile.serviceEventRules[ev.type];

    let countsAsService = rule.countsAsService;
    let ruleKey = rule.ruleKey;

    // Special handling: employer_initiated_termination_and_rehire gap counts depending on threshold
    if (ev.type === 'employer_initiated_termination_and_rehire') {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      if (gap <= profile.rehireGapDaysMax) {
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
      if (gap <= profile.apprenticeGapDaysMax) {
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
 *
 * State-specific rule values come from `profile`.
 */
export function computeDaysNotCountedInLookback(
  windowStart: ISODate,
  windowEnd: ISODate,
  events: ContinuousServiceEvent[],
  profile: ContinuousServiceProfile
): number {
  let total = 0;
  for (const ev of events) {
    if (!ev.endDate) continue;
    const rule = profile.serviceEventRules[ev.type];

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
