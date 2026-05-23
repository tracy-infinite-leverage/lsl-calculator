import type { Confidence, ExtractedEmployee } from './schema';

/**
 * Confidence-threshold gate per impl-plan §4.4 / D05.
 *
 *   aggregate ≥ 0.85 → render preview, all values editable
 *   aggregate <  0.85 → refuse + route to CSV with form state preserved
 *   per-field < 0.7   → low-confidence badge on the corresponding form section
 *
 * The 0.85 threshold is configurable here; D05 calls for calibration against
 * a labelled 50-PDF set before launch. Threshold lives in code (not env) so
 * it's reviewable in PR diffs.
 */
export const AGGREGATE_THRESHOLD = 0.85;
export const PER_FIELD_LOW_CONFIDENCE_THRESHOLD = 0.7;

export type ConfidenceGate =
  | { ok: true; flags: PerFieldFlags[] }
  | { ok: false; reason: 'aggregate_below_threshold'; aggregate: number };

export interface PerFieldFlags {
  employeeIndex: number;
  identity: boolean;
  employment: boolean;
  wageHistory: boolean;
}

/** Apply the gate to one or more extracted employees. */
export function checkConfidence(employees: ExtractedEmployee[]): ConfidenceGate {
  // Worst-case across all employees in a bulk batch sets the bar.
  let worstAggregate = 1;
  for (const e of employees) {
    if (e.confidence.aggregate < worstAggregate) worstAggregate = e.confidence.aggregate;
  }
  if (worstAggregate < AGGREGATE_THRESHOLD) {
    return {
      ok: false,
      reason: 'aggregate_below_threshold',
      aggregate: worstAggregate,
    };
  }

  const flags: PerFieldFlags[] = employees.map((e, i) => ({
    employeeIndex: i,
    identity: e.confidence.identity < PER_FIELD_LOW_CONFIDENCE_THRESHOLD,
    employment: e.confidence.employment < PER_FIELD_LOW_CONFIDENCE_THRESHOLD,
    wageHistory: e.confidence.wage_history < PER_FIELD_LOW_CONFIDENCE_THRESHOLD,
  }));

  return { ok: true, flags };
}

/** Convenience: is any per-field score below threshold? */
export function hasLowConfidenceFields(c: Confidence): boolean {
  return (
    c.identity < PER_FIELD_LOW_CONFIDENCE_THRESHOLD ||
    c.employment < PER_FIELD_LOW_CONFIDENCE_THRESHOLD ||
    c.wage_history < PER_FIELD_LOW_CONFIDENCE_THRESHOLD
  );
}
