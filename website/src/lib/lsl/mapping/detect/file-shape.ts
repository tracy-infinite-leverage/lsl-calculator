// E5.3 Phase 2 / Task T2.1 — file-shape detection skeleton.
//
// Refs:
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md §5.1
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping-impl-plan.md §3 Phase 2 / step 2.2
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping-tasks.md §T2.2
//
// Implementation lands in T2.2 — this file provides the typed signature and a
// `not_implemented` runtime guard so callers (Phase 4 wizard, E5.4 ingestion)
// can wire against the contract without waiting for T2.2 to land.

import type {
  DetectorFileInput,
  FileShapeDetection,
  PayCodeAliasRow,
} from './types';

/**
 * Determine the file shape and (for Excel multi-sheet or multi-file relational
 * drops) propose the primary sheet / join key.
 *
 * Algorithm summary (T2.2 will implement; T2.1 just scaffolds):
 *
 *   1. If exactly one file with `kind === 'csv'` → return `{ shape: 'csv' }`.
 *   2. If one Excel file with exactly one sheet → return
 *      `{ shape: 'excel-single', sheets }`.
 *   3. If one Excel file with multiple sheets → score each sheet's header set
 *      against `aliases` rows where `pattern_kind === 'header_name'`. Return
 *      `{ shape: 'excel-multi', sheets, proposedSheet }`.
 *   4. If two-to-four CSV files → look for a shared key column (typically
 *      `Employee ID`) and return `{ shape: 'multi-file-relational',
 *      fileRelationship }`. If no shared key with confidence ≥ 0.7, surface
 *      via the wizard relationship-picker (caller responsibility).
 *
 * Pure function — no I/O, no env reads, no DB calls.
 *
 * @throws Error('not_implemented') until T2.2 lands.
 */
export function detectFileShape(
  files: ReadonlyArray<DetectorFileInput>,
  aliases: ReadonlyArray<PayCodeAliasRow>,
): FileShapeDetection {
  void files;
  void aliases;
  throw new Error(
    'detectFileShape not_implemented — T2.1 scaffold; implementation in T2.2',
  );
}
