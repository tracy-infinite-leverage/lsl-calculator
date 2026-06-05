// E5.3 Phase 2 / Task T2.1 — shared types for the deterministic auto-detection
// pass (Pass 1) of the pay-code mapping layer.
//
// Refs:
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md §5 (v0.2 LOCKED)
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping-impl-plan.md §3 Phase 2
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping-tasks.md §T2.1–T2.7
//
// Design notes
// ────────────
// This file defines the contract every Pass-1 detector module conforms to.
// The wizard (Phase 4) and the LLM Pass-2 (Phase 3) both consume `ProposalRow`
// as their boundary type — Pass 1 fills `source ∈ {auto_mapped, historical,
// system_seed}`, Pass 2 fills `source = 'llm_suggested'`, and surfaces left
// unresolved by both fill `source = 'needs_review'`.
//
// Every detector is a PURE FUNCTION — no DB access, no env reads, no global
// state. The caller wires aliases / org-mappings in from the data layer. This
// keeps unit tests trivially fast and the calibration sweep (T2.6) cheap.

import type {
  MappingRow,
  PayCodeAliasRow,
  ValueNormaliseAliasRow,
} from '@/lib/db/types';

// ─────────────────────────────────────────────────────────────────────────────
// Bucket taxonomy — umbrella spec §6 (LSL pay-bucket reference).
// Mirrored as a TypeScript union for compile-time exhaustiveness. The DB
// `bucket` column is `text` with a CHECK constraint, so the generated row
// types come through as `string`. We narrow at this boundary.
// ─────────────────────────────────────────────────────────────────────────────

export type LslBucket =
  | 'ordinary_time'
  | 'overtime_regular'
  | 'overtime_adhoc'
  | 'penalty_rates'
  | 'commission'
  | 'bonus_discretionary'
  | 'bonus_contractual'
  | 'allowance_all_purpose'
  | 'allowance_single_purpose'
  | 'casual_loading'
  | 'leave_annual'
  | 'leave_personal'
  | 'leave_lsl'
  | 'leave_workers_comp'
  | 'leave_unpaid_parental'
  | 'leave_unpaid_other'
  | 'termination_lsl'
  | 'termination_other'
  | 'excluded_other';

// `pii_strip` is a special marker used by `pay_code_aliases` to flag column
// names that must be stripped at upload time (TFN / BSB / bank / super). The
// detector emits a `kind: 'pii_strip_required'` proposal rather than a bucket.
export type PayCodeAliasPatternKind =
  | 'header_name'
  | 'code_value'
  | 'code_prefix'
  | 'code_suffix';

export type ValueNormaliseTargetField =
  | 'work_jurisdiction'
  | 'employment_type'
  | 'pay_frequency';

// ─────────────────────────────────────────────────────────────────────────────
// File-shape detection — §5.1
// ─────────────────────────────────────────────────────────────────────────────

export type FileShape =
  | 'csv'
  | 'excel-single'
  | 'excel-multi'
  | 'multi-file-relational';

export interface SheetInfo {
  /** Sheet name as it appears in the workbook. */
  name: string;
  /** Header row (row 1). */
  headers: string[];
  /** Optional first-N sample rows used for column-signature scoring. */
  sampleRows?: ReadonlyArray<ReadonlyArray<string>>;
  /** Score against `pay_code_aliases.header_name` patterns (0.0–1.0). */
  score: number;
}

export interface FileRelationship {
  /** The join key column name shared across the related files. */
  joinKey: string;
  /** The file proposed as the per-pay-period source. */
  primaryFile: string;
  /** Companion files (rate history, position history, etc.). */
  companionFiles: ReadonlyArray<string>;
  /** Confidence (0.0–1.0) the system has in this relationship proposal. */
  confidence: number;
}

export interface FileShapeDetection {
  shape: FileShape;
  /** For Excel files: per-sheet metadata + scores. */
  sheets?: ReadonlyArray<SheetInfo>;
  /** For Excel multi-sheet: the sheet name with the top score. */
  proposedSheet?: string;
  /** For multi-file relational: the proposed file relationship. */
  fileRelationship?: FileRelationship;
}

// Input file shape — kept deliberately abstract so the detector doesn't care
// where the bytes came from. The caller (E5.4 ingestion) hydrates `headers`
// and `sampleRows` from whichever parser opened the file (`xlsx` / CSV).
export interface DetectorFileInput {
  /** Filename (used for relational join-key heuristics). */
  filename: string;
  /** MIME-ish content type — `.csv` / `.xlsx` / `.xlsm`. */
  kind: 'csv' | 'xlsx' | 'xlsm';
  /** For Excel: per-sheet content. For CSV: a single synthetic sheet. */
  sheets: ReadonlyArray<{
    name: string;
    headers: string[];
    sampleRows: ReadonlyArray<ReadonlyArray<string>>;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Column auto-detection — §5.2
// ─────────────────────────────────────────────────────────────────────────────

export type DetectedColumnTarget =
  | 'pay_code'
  | 'amount'
  | 'units'
  | 'employee_id'
  | 'period_end'
  | 'jurisdiction'
  | 'frequency';

export interface ColumnRef {
  /** The detected target this column maps to. */
  target: DetectedColumnTarget;
  /** Header text as it appears in the file. */
  headerName: string;
  /** Zero-based column index. */
  columnIndex: number;
  /** Confidence the detector has (0.0–1.0). */
  confidence: number;
  /** Which alias pattern matched (for audit trail). Null for cardinality-driven matches. */
  matchedAliasId?: string | null;
}

export type ColumnDetection = {
  [K in DetectedColumnTarget]?: ColumnRef;
};

// ─────────────────────────────────────────────────────────────────────────────
// Proposal rows — the surface fed to the wizard and to Pass 2.
// One row per unresolved-or-resolved surface. The wizard renders rows whose
// `source = 'needs_review'` for user input; rows whose `source ∈ {auto_mapped,
// historical, system_seed}` render with a one-click confirm.
// ─────────────────────────────────────────────────────────────────────────────

export type ProposalSource =
  | 'auto_mapped'       // matched a pay_code_aliases or value_normalisation_aliases row
  | 'historical'        // matched an existing per-org `pay_code_mappings` row
  | 'system_seed'       // matched a system-managed `value_normalisation_aliases` row (org_id IS NULL)
  | 'llm_suggested'     // Pass 2 — Phase 3 will fill these
  | 'needs_review';     // no match at any layer

export type ProposalKind =
  | 'pay_code_mapping'
  | 'value_normalisation'
  | 'pii_strip_required';

/**
 * A single wizard-bound proposal row.
 *
 * - For `kind: 'pay_code_mapping'` — `suggestion` is one of {@link LslBucket}.
 * - For `kind: 'value_normalisation'` — `suggestion` is the canonical enum
 *   value (a state code like `'TAS'`, an employment-type like `'casual'`).
 * - For `kind: 'pii_strip_required'` — `suggestion` is `null`; the row exists
 *   only to surface a refusal/strip event.
 *
 * Multi-state cohort handling (OQ-MAP-9 lock, see T2.4 acceptance):
 * `hintedJurisdictions` carries the parsed sides of a hyphenated cohort
 * label (e.g. `'VIC-TAS'` → `['VIC', 'TAS']`). It is NEVER persisted as an
 * employee-level field; the field is a runtime hint for downstream validation
 * of per-pay-period work_jurisdiction values.
 */
export interface ProposalRow {
  /** Stable id within the import — `${kind}:${raw}` works for most cases. */
  id: string;
  kind: ProposalKind;
  /** Raw value seen in the file (case-preserved). */
  raw: string;
  /** Suggested canonical value. Null when no proposal was generated. */
  suggestion: string | null;
  /** Confidence (0.0–1.0). Zero when `source = 'needs_review'`. */
  confidence: number;
  source: ProposalSource;
  /** Sample rows (first 3 employee + period + amount) — used by wizard step 4. */
  samples?: ReadonlyArray<string>;
  /** Multi-state cohort hint per OQ-MAP-9 lock. */
  hintedJurisdictions?: ReadonlyArray<string>;
  /** Cross-jurisdiction flag — set when raw was hyphenated cohort label. */
  crossJurisdictionFlag?: boolean;
  /** For audit trail. */
  matchedAliasId?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Threshold constants — locked per spec §5; calibrated against the 10-fixture
// set in T2.6. Threshold values themselves are pinned; alias `confidence` is
// the tuning knob.
// ─────────────────────────────────────────────────────────────────────────────

export const COLUMN_HEADER_PROPOSE_THRESHOLD = 0.7;
export const VALUE_PATTERN_PROPOSE_THRESHOLD = 0.6;

// ─────────────────────────────────────────────────────────────────────────────
// Re-export DB row types for ergonomic detector imports.
// Detectors take rows as ReadonlyArray<...> inputs; the data layer is
// responsible for loading them.
// ─────────────────────────────────────────────────────────────────────────────

export type { MappingRow, PayCodeAliasRow, ValueNormaliseAliasRow };
