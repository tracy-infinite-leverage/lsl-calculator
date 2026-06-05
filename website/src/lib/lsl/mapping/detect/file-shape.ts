/**
 * File-shape detection — spec §5.1.
 *
 * Pure function. No DB writes, no side effects. Reads pre-loaded
 * system aliases from the call-site.
 *
 * Determines whether the uploaded file(s) are:
 *   - a single CSV
 *   - a single-sheet `.xlsx` / `.xlsm`
 *   - a multi-sheet `.xlsx` / `.xlsm` (proposes the payroll-export sheet)
 *   - a multi-file relational drop (proposes the join key)
 */

import type { PayCodeAliasRow } from "@/lib/db/types";
import {
  JOIN_KEY_PROPOSE_THRESHOLD,
  SHEET_SIGNATURE_PROPOSE_THRESHOLD,
} from "./thresholds";

/** A single file's metadata + parsed headers. The caller pre-parses. */
export interface FileInput {
  /** Logical file name (e.g. `Virtus.xlsx`, `PayHistory.csv`). */
  name: string;
  /** Lower-cased extension without dot — `csv`, `xlsx`, `xlsm`. */
  extension: "csv" | "xlsx" | "xlsm";
  /** Sheets in the file. For CSVs this is always length 1 (`sheet.name === ''`). */
  sheets: SheetInput[];
}

export interface SheetInput {
  /** Sheet name (Excel) or `''` for CSV. */
  name: string;
  /** Header row (first row of the sheet, trimmed). */
  headers: string[];
  /**
   * Approximate row count for tie-break heuristics. Caller may pass a
   * sample-derived estimate; precision is not required.
   */
  rowCount?: number;
}

/** The four discrete file-shape outcomes from spec §5.1. */
export type FileShape =
  | "csv"
  | "excel-single"
  | "excel-multi"
  | "multi-file-relational";

export interface SheetScore {
  name: string;
  /** 0..1 — fraction of `headers` that matched any header_name alias. */
  score: number;
  matchedHeaders: string[];
}

export interface FileRelationship {
  /** The join key column header found across all files (e.g. `Employee ID`). */
  joinKey: string;
  /** The file proposed as the primary payroll-period source. */
  primary: string;
  /** Companion files that join to `primary` on `joinKey`. */
  companions: string[];
  /** 0..1 — confidence the relationship is correct. */
  confidence: number;
}

export interface FileShapeResult {
  shape: FileShape;
  /** Populated for `excel-multi`. Ranked highest score first. */
  sheets?: SheetScore[];
  /** The proposed payroll-export sheet (for `excel-multi`). */
  proposedSheet?: string;
  /** Populated for `multi-file-relational`. */
  fileRelationship?: FileRelationship;
}

/**
 * Classify an upload — implementation lands in T2.2.
 *
 * @param files One or more pre-parsed files.
 * @param aliases System-level `pay_code_aliases` rows (read once at the call
 *   site; the function is pure and does NOT query the DB).
 */
export function detectFileShape(
  files: FileInput[],
  aliases: PayCodeAliasRow[],
): FileShapeResult {
  void files;
  void aliases;
  void SHEET_SIGNATURE_PROPOSE_THRESHOLD;
  void JOIN_KEY_PROPOSE_THRESHOLD;
  throw new Error("detectFileShape not implemented — lands in T2.2");
}
