import type { Confidence, ExtractedEmployee } from './schema';

/**
 * Confidence reporting per impl-plan §4.4 / D05 — REVISED 2026-05-23.
 *
 * Original design rejected aggregate < 0.85 outright. Real-world testing
 * showed Claude routinely returns 0.6-0.8 on extractions that are largely
 * correct — it's just honest about ambiguity. Blocking those at the route
 * level defeats the purpose of the editable preview table.
 *
 * New behaviour: always show the preview. Per-field scores below 0.7 paint
 * the corresponding section yellow (existing). Aggregate below
 * AGGREGATE_WARN_THRESHOLD adds a banner urging extra-careful review but
 * doesn't block the workflow.
 */
export const AGGREGATE_WARN_THRESHOLD = 0.85;
export const PER_FIELD_LOW_CONFIDENCE_THRESHOLD = 0.7;

export interface PerFieldFlags {
  employeeIndex: number;
  identity: boolean;
  employment: boolean;
  wageHistory: boolean;
}

export interface ConfidenceReport {
  /** Worst aggregate score across all employees. */
  worstAggregate: number;
  /** True when worstAggregate is below the warn threshold — show banner. */
  lowOverallConfidence: boolean;
  /** Per-field flags drive yellow section borders. */
  flags: PerFieldFlags[];
}

/** Build the confidence report for one or more extracted employees. */
export function checkConfidence(employees: ExtractedEmployee[]): ConfidenceReport {
  let worstAggregate = 1;
  for (const e of employees) {
    if (e.confidence.aggregate < worstAggregate) worstAggregate = e.confidence.aggregate;
  }
  const flags: PerFieldFlags[] = employees.map((e, i) => ({
    employeeIndex: i,
    identity: e.confidence.identity < PER_FIELD_LOW_CONFIDENCE_THRESHOLD,
    employment: e.confidence.employment < PER_FIELD_LOW_CONFIDENCE_THRESHOLD,
    wageHistory: e.confidence.wage_history < PER_FIELD_LOW_CONFIDENCE_THRESHOLD,
  }));
  return {
    worstAggregate,
    lowOverallConfidence: worstAggregate < AGGREGATE_WARN_THRESHOLD,
    flags,
  };
}

/** Convenience: is any per-field score below threshold? */
export function hasLowConfidenceFields(c: Confidence): boolean {
  return (
    c.identity < PER_FIELD_LOW_CONFIDENCE_THRESHOLD ||
    c.employment < PER_FIELD_LOW_CONFIDENCE_THRESHOLD ||
    c.wage_history < PER_FIELD_LOW_CONFIDENCE_THRESHOLD
  );
}
