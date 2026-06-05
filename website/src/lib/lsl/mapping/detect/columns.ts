/**
 * Column auto-detection — spec §5.2 (Pass 1, deterministic).
 *
 * Pure function. No DB writes, no side effects. Reads pre-loaded
 * `pay_code_aliases` system rows (kind=`header_name`) from the call-site.
 *
 * Identifies the following columns in a payroll-export sheet:
 *   - pay-code column
 *   - gross-amount column
 *   - units (hours) column
 *   - employee-id column
 *   - pay-period-end column
 *   - work-jurisdiction column
 *   - pay-frequency column
 *
 * Each output carries a confidence in [0, 1]. Columns scoring below
 * `COLUMN_HEADER_PROPOSE_THRESHOLD` are returned undefined → deferred to Pass 2.
 */

import type { PayCodeAliasRow } from "@/lib/db/types";
import { COLUMN_HEADER_PROPOSE_THRESHOLD } from "./thresholds";

/** A single column match — header name + confidence + ordinal. */
export interface ColumnRef {
  /** The exact header string as it appears in the file. */
  header: string;
  /** Zero-indexed position of the column in the sheet's header row. */
  index: number;
  /** 0..1 — confidence the column is what we think it is. */
  confidence: number;
}

export interface DetectedColumns {
  payCode?: ColumnRef;
  amount?: ColumnRef;
  units?: ColumnRef;
  employeeId?: ColumnRef;
  periodEnd?: ColumnRef;
  jurisdiction?: ColumnRef;
  frequency?: ColumnRef;
}

/**
 * A sampled row used for the value-cardinality tie-break heuristic
 * (pay-code columns have 10–50 distinct values per period).
 */
export type SampleRow = ReadonlyArray<string | number | null | undefined>;

/**
 * Detect columns deterministically. Implementation lands in T2.3.
 *
 * @param headers The sheet's header row, in order.
 * @param sampleRows Optional sample rows for the value-cardinality tie-break.
 * @param aliases System-level `pay_code_aliases` rows with
 *   `pattern_kind === 'header_name'`. The caller pre-filters and passes them in.
 */
export function detectColumns(
  headers: string[],
  sampleRows: SampleRow[],
  aliases: PayCodeAliasRow[],
): DetectedColumns {
  void headers;
  void sampleRows;
  void aliases;
  void COLUMN_HEADER_PROPOSE_THRESHOLD;
  throw new Error("detectColumns not implemented — lands in T2.3");
}
