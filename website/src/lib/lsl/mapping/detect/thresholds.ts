/**
 * Detection thresholds — pinned per spec §5.2.
 *
 * These constants govern when Pass 1 (deterministic) emits a proposal vs.
 * defers a surface to Pass 2 (LLM-assisted). They are NOT user-tunable — the
 * spec calls them out as fixed seeds (calibration goes through seed
 * `confidence` values on `pay_code_aliases`, NOT through these thresholds).
 *
 * See: `.specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md` §5.2.
 */

/**
 * Minimum confidence score for a column-header alias to be proposed as a
 * column match. Below this, the column is left unresolved (Pass 2 fallback).
 *
 * Spec §5.2 step 1: "If no header scores ≥ 0.7, defer to Pass 2".
 */
export const COLUMN_HEADER_PROPOSE_THRESHOLD = 0.7;

/**
 * Minimum confidence score for a pay-code value alias to be proposed as a
 * bucket match. Below this, the code is left unresolved (Pass 2 fallback).
 *
 * Spec §5.4 step 7: "If no pattern scores ≥ 0.6 → defer to Pass 2".
 */
export const PAY_CODE_VALUE_PROPOSE_THRESHOLD = 0.6;

/**
 * Minimum confidence score for a sheet-name signature to win as the proposed
 * payroll-export sheet without showing a sheet-picker. Spec §5.1 step 0.
 *
 * Note: OQ-MAP-6 lock says the sheet-picker is ALWAYS shown on the first
 * import for a given (org, file-signature). This threshold governs the
 * `proposedSheet` pre-selection, not the picker visibility.
 */
export const SHEET_SIGNATURE_PROPOSE_THRESHOLD = 0.7;

/**
 * Minimum confidence score for a multi-file relational join key to be
 * proposed without surfacing the relationship-picker. Spec §5.1 step 0.
 */
export const JOIN_KEY_PROPOSE_THRESHOLD = 0.7;

/**
 * Value-cardinality range for the pay-code column tie-break. The pay-code
 * column typically has 10–50 distinct values per pay period; columns with
 * far fewer or far more distinct values are unlikely to be the pay-code
 * column. Spec §5.2 step 1.
 */
export const PAY_CODE_CARDINALITY_MIN = 3;
export const PAY_CODE_CARDINALITY_MAX = 200;
