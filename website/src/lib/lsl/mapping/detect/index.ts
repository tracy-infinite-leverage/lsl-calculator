/**
 * Barrel — E5.3 Phase 2 auto-detection (Pass 1, deterministic).
 *
 * Spec: `.specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md` §5.
 *
 * Pure-function layer. All detectors are read-only against the system alias
 * tables + the org's historical mappings. No DB writes. No network calls.
 * No LLM. (Pass 2 — LLM-assisted — lands in Phase 3.)
 */

export {
  COLUMN_HEADER_PROPOSE_THRESHOLD,
  JOIN_KEY_PROPOSE_THRESHOLD,
  PAY_CODE_CARDINALITY_MAX,
  PAY_CODE_CARDINALITY_MIN,
  PAY_CODE_VALUE_PROPOSE_THRESHOLD,
  SHEET_SIGNATURE_PROPOSE_THRESHOLD,
} from "./thresholds";

export { detectFileShape } from "./file-shape";
export type {
  FileInput,
  FileRelationship,
  FileShape,
  FileShapeResult,
  SheetInput,
  SheetScore,
} from "./file-shape";

export { detectColumns } from "./columns";
export type { ColumnRef, DetectedColumns, SampleRow } from "./columns";

export { detectValueNormalisations } from "./value-normalise";
export type {
  NormalisationProposal,
  NormalisationTargetField,
  ProposalSource,
} from "./value-normalise";

export { detectPayCodes } from "./pay-codes";
export type { PayCodeProposal, PayCodeProposalSource } from "./pay-codes";
