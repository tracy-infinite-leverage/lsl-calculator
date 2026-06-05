// E5.3 Phase 2 / Task T2.1 — barrel exports for the deterministic Pass-1
// auto-detection layer of the pay-code mapping epic.
//
// Refs:
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md (v0.2 LOCKED)
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping-impl-plan.md Phase 2
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping-tasks.md §T2.1
//
// The four detector modules are pure functions; the wizard (Phase 4) and the
// LLM Pass-2 (Phase 3) both consume from this barrel.

export type {
  // File-shape detection (§5.1)
  DetectorFileInput,
  FileShape,
  FileShapeDetection,
  FileRelationship,
  SheetInfo,
  // Column auto-detection (§5.2)
  ColumnDetection,
  ColumnRef,
  DetectedColumnTarget,
  // Proposal rows (the wizard / Pass-2 boundary)
  ProposalRow,
  ProposalSource,
  ProposalKind,
  // Domain enums
  LslBucket,
  PayCodeAliasPatternKind,
  ValueNormaliseTargetField,
  // DB row passthroughs
  MappingRow,
  PayCodeAliasRow,
  ValueNormaliseAliasRow,
} from './types';

export {
  COLUMN_HEADER_PROPOSE_THRESHOLD,
  VALUE_PATTERN_PROPOSE_THRESHOLD,
} from './types';

export { detectFileShape } from './file-shape';
export { detectColumns } from './columns';
export { detectValueNormalisations } from './value-normalise';
export { detectPayCodes } from './pay-codes';
