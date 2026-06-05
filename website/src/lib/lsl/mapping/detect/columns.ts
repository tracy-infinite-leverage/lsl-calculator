// E5.3 Phase 2 / Task T2.1 — column auto-detection skeleton.
//
// Refs:
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md §5.2
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping-impl-plan.md §3 Phase 2 / step 2.3
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping-tasks.md §T2.3
//
// Implementation lands in T2.3. AC-MAP-1 (≥ 90% accuracy on the 10-fixture
// set) is verified in T2.6 calibration sweep.

import type {
  ColumnDetection,
  PayCodeAliasRow,
} from './types';

/**
 * Identify the canonical target column for each known signal in a tabular
 * file — pay code, amount, units (hours), employee id, period end, work
 * jurisdiction, pay frequency.
 *
 * Algorithm summary (T2.3 will implement):
 *
 *   1. For each target, score each header against `aliases` rows where
 *      `pattern_kind === 'header_name'`. Highest-scoring header wins.
 *   2. Tie-break via value-cardinality heuristic — pay-code columns typically
 *      have 10–50 distinct values per pay period; employee-id columns have
 *      far more; amount columns have a different numeric profile.
 *   3. Apply the `COLUMN_HEADER_PROPOSE_THRESHOLD = 0.7` gate per spec §5.2.
 *      Targets that don't clear the threshold are omitted from the result;
 *      the caller (Pass 2 / wizard) treats them as `needs_review`.
 *
 * Pure function — no I/O, no env reads, no DB calls.
 *
 * @param headers - Row 1 of the chosen sheet (post file-shape detection).
 * @param sampleRows - First-N data rows. Used for cardinality tie-break and
 *                     for the wizard's sample-rows mini-cell (step 4).
 * @param aliases - System-managed `pay_code_aliases` rows. Caller filters to
 *                  `pattern_kind === 'header_name'` or passes the full set.
 *
 * @throws Error('not_implemented') until T2.3 lands.
 */
export function detectColumns(
  headers: ReadonlyArray<string>,
  sampleRows: ReadonlyArray<ReadonlyArray<string>>,
  aliases: ReadonlyArray<PayCodeAliasRow>,
): ColumnDetection {
  void headers;
  void sampleRows;
  void aliases;
  throw new Error(
    'detectColumns not_implemented — T2.1 scaffold; implementation in T2.3',
  );
}
