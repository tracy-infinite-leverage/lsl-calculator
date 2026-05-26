import { citation } from '@/lib/lsl/engine/citation';
import { toDate } from '@/lib/lsl/engine/dates';
import type {
  Citation,
  ContinuousServiceEvent,
  ISODate,
} from '@/lib/lsl/engine/types';

/**
 * ACT workers compensation date-aware override at 9 June 2023.
 *
 * Pre-cutoff: WC absence counts up to **2 weeks per service year**; excess is
 * excluded from continuous service (s.10A pre-amendment + s.2G).
 * From cutoff (ON or after 9 June 2023): WC absence counts in FULL per
 * WC Act 1951 (ACT) s.46 amendment. Per TBD-ACT-05 RESOLVED — cutoff
 * inclusivity strict "on or after"; cap is per-service-year.
 *
 * WA DEV-CROSS-2 fields (`paidConcurrent`, `returnToWorkProgram`) are IGNORED
 * by the ACT orchestrator (TBD-ACT-06 RESOLVED).
 */

export const ACT_WC_CUTOFF: ISODate = '2023-06-09' as ISODate;
const TWO_WEEKS_DAYS = 14;

export interface ACTWCOverrideResult {
  daysExcluded: number;
  preCutoffCapApplied: boolean;
  postCutoffCountsApplied: boolean;
  regimeSplit: boolean;
  citations: Citation[];
}

/**
 * Per-service-year-bucketed 2-wk cap on a date range.
 * Mutates `sharedSYBuckets` so callers can carry state across calls.
 */
function applyTwoWeekCap(
  startDate: ISODate,
  absStart: ISODate,
  absEnd: ISODate,
  sharedSYBuckets: Map<number, number>
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
    const usedSoFar = sharedSYBuckets.get(N) ?? 0;
    if (usedSoFar < TWO_WEEKS_DAYS) {
      sharedSYBuckets.set(N, usedSoFar + 1);
    } else {
      excluded += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return excluded;
}

export function applyACTWCOverride(
  startDate: ISODate,
  event: ContinuousServiceEvent,
  sharedSYBuckets: Map<number, number> = new Map()
): ACTWCOverrideResult {
  if (event.type !== 'workers_comp_absence' || !event.endDate) {
    return {
      daysExcluded: 0,
      preCutoffCapApplied: false,
      postCutoffCountsApplied: false,
      regimeSplit: false,
      citations: [],
    };
  }

  const citations: Citation[] = [];
  const absStart = event.startDate;
  const absEnd = event.endDate;

  const startsBefore = absStart < ACT_WC_CUTOFF;
  const endsBefore = absEnd < ACT_WC_CUTOFF;
  const straddles = startsBefore && !endsBefore;

  let daysExcluded = 0;
  let preCutoffCapApplied = false;
  let postCutoffCountsApplied = false;
  const regimeSplit = straddles;

  if (startsBefore) {
    const preEnd: ISODate = endsBefore
      ? absEnd
      : ('2023-06-08' as ISODate);
    const preExcluded = applyTwoWeekCap(startDate, absStart, preEnd, sharedSYBuckets);
    daysExcluded += preExcluded;
    if (preExcluded > 0) {
      preCutoffCapApplied = true;
      citations.push(
        citation(
          'ACT LSL Act 1976 s.2G',
          'continuous-service.workers-comp-pre-9jun2023-capped-at-2wks-per-yr',
          139
        )
      );
    } else {
      citations.push(
        citation(
          'ACT LSL Act 1976 s.2G',
          'continuous-service.workers-comp-pre-9jun2023-within-2wk-cap',
          139
        )
      );
    }
  }

  if (!endsBefore) {
    postCutoffCountsApplied = true;
    citations.push(
      citation(
        'WC Act 1951 (ACT) s.46',
        'workers-comp-counts-from-9jun2023',
        139,
        'Act-level citation only in v1 per documented limitation pending RES-3 quarterly review (parallel to TBD-WA-02)'
      )
    );
  }

  return {
    daysExcluded,
    preCutoffCapApplied,
    postCutoffCountsApplied,
    regimeSplit,
    citations,
  };
}
