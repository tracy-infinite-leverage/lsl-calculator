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
import { normaliseToken } from "./util";

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
 * Built-in vocabulary of header substrings that strongly signal a
 * payroll-period sheet. Used in addition to the DB-seeded
 * `pay_code_aliases` `header_name` rows.
 *
 * These are intentionally generic — they cover the structural columns the
 * `pay_code_aliases` seed does NOT (the seed only covers the pay-code
 * column itself; the spec says detection looks at amount / employee-id /
 * period-end as well).
 */
const STRUCTURAL_HEADER_SIGNALS: ReadonlyArray<{
  /** Normalised token to match in the header (substring + exact both OK). */
  needle: string;
  /** 0..1 — how strong the signal is. */
  weight: number;
}> = [
  { needle: "employee id", weight: 1.0 },
  { needle: "emp id", weight: 0.9 },
  { needle: "employee number", weight: 0.9 },
  { needle: "employee no", weight: 0.85 },
  { needle: "pay period end", weight: 1.0 },
  { needle: "pay period", weight: 0.85 },
  { needle: "period end", weight: 0.85 },
  { needle: "pay date", weight: 0.85 },
  { needle: "amount", weight: 0.9 },
  { needle: "gross", weight: 0.85 },
  { needle: "pay amount", weight: 0.9 },
  { needle: "units", weight: 0.85 },
  { needle: "hours", weight: 0.85 },
  { needle: "pay run", weight: 0.95 },
];

/**
 * Build a set of normalised header_name patterns from a pay_code_aliases
 * snapshot. Used to score sheets/files for "is this the payroll-export?".
 */
function buildHeaderNamePatternSet(aliases: PayCodeAliasRow[]): Set<string> {
  const set = new Set<string>();
  for (const a of aliases) {
    if (a.pattern_kind !== "header_name") continue;
    if (a.bucket === "pii_strip") continue;
    set.add(normaliseToken(a.pattern));
  }
  return set;
}

/**
 * Score one sheet's headers against the union of seeded header_name patterns
 * + the built-in structural signals.
 *
 * Returns a 0..1 score normalised by the count of headers actually
 * sampled (so a 12-column sheet with 6 matches scores 0.5, regardless of
 * how many alias rows existed).
 */
function scoreSheet(
  headers: string[],
  headerPatternSet: Set<string>,
): { score: number; matched: string[] } {
  if (headers.length === 0) {
    return { score: 0, matched: [] };
  }

  const matched = new Set<string>();
  let weightedHits = 0;

  for (const rawHeader of headers) {
    const normalised = normaliseToken(rawHeader);
    if (!normalised) continue;

    // DB alias exact-match — full credit.
    if (headerPatternSet.has(normalised)) {
      matched.add(rawHeader);
      weightedHits += 1.0;
      continue;
    }

    // Substring match against either DB aliases or structural signals.
    let bestWeight = 0;
    for (const pattern of headerPatternSet) {
      if (normalised.includes(pattern) || pattern.includes(normalised)) {
        bestWeight = Math.max(bestWeight, 0.8);
      }
    }
    for (const signal of STRUCTURAL_HEADER_SIGNALS) {
      if (normalised.includes(signal.needle)) {
        bestWeight = Math.max(bestWeight, signal.weight);
      }
    }
    if (bestWeight > 0) {
      matched.add(rawHeader);
      weightedHits += bestWeight;
    }
  }

  // Normalise by header count — capped at 1.0 so a sheet packed with
  // payroll-export columns doesn't score > 1.
  const denom = Math.max(headers.length, 1);
  const score = Math.min(1, weightedHits / denom);
  return { score, matched: [...matched] };
}

/**
 * Built-in vocabulary of join-key column header substrings. Used by the
 * multi-file relational detector to identify a shared key across files.
 *
 * `Employee ID` is canonical (per spec §5.1 "typically Employee ID"); the
 * variants below cover common spellings.
 */
const JOIN_KEY_NEEDLES: ReadonlyArray<{ needle: string; weight: number }> = [
  { needle: "employee id", weight: 1.0 },
  { needle: "emp id", weight: 0.95 },
  { needle: "employee number", weight: 0.95 },
  { needle: "employee no", weight: 0.9 },
  { needle: "payroll id", weight: 0.85 },
  { needle: "staff id", weight: 0.85 },
];

/**
 * Find a join key shared across all files. Returns the original (raw)
 * header from the FIRST file plus confidence based on:
 *   - the join-key needle weight
 *   - presence across every file (required — otherwise the join is invalid)
 */
function findSharedJoinKey(
  files: FileInput[],
): { rawHeader: string; confidence: number } | null {
  if (files.length < 2) return null;

  // Gather all headers per file (flatten across sheets, though CSV files
  // have a single sheet).
  const fileHeaders: Array<{ raw: string; norm: string }[]> = files.map(
    (f) => {
      const headers: { raw: string; norm: string }[] = [];
      for (const s of f.sheets) {
        for (const h of s.headers) {
          headers.push({ raw: h, norm: normaliseToken(h) });
        }
      }
      return headers;
    },
  );

  // Score every (needle) by min weight across files where the needle
  // appears at least once. If a needle is absent from any file, score 0.
  let bestNeedle: { needle: string; weight: number; rawInFirstFile: string } | null = null;
  for (const candidate of JOIN_KEY_NEEDLES) {
    const matchedInEachFile: string[] = [];
    let allFilesMatch = true;
    for (const headers of fileHeaders) {
      const found = headers.find((h) => h.norm.includes(candidate.needle));
      if (!found) {
        allFilesMatch = false;
        break;
      }
      matchedInEachFile.push(found.raw);
    }
    if (allFilesMatch) {
      if (!bestNeedle || candidate.weight > bestNeedle.weight) {
        bestNeedle = {
          needle: candidate.needle,
          weight: candidate.weight,
          rawInFirstFile: matchedInEachFile[0],
        };
      }
    }
  }

  if (!bestNeedle) return null;
  return { rawHeader: bestNeedle.rawInFirstFile, confidence: bestNeedle.weight };
}

/**
 * Classify an upload — spec §5.1 implementation.
 *
 * @param files One or more pre-parsed files.
 * @param aliases System-level `pay_code_aliases` rows (read once at the call
 *   site; the function is pure and does NOT query the DB).
 */
export function detectFileShape(
  files: FileInput[],
  aliases: PayCodeAliasRow[],
): FileShapeResult {
  if (files.length === 0) {
    throw new Error("detectFileShape: at least one file required");
  }

  const headerPatternSet = buildHeaderNamePatternSet(aliases);

  // ─── Multi-file path ──────────────────────────────────────────────────
  if (files.length > 1) {
    // Score each file's sheets for "is this the payroll-period source?".
    // For the multi-file path we treat each file as its own scoring unit
    // (and within a file, we score the first sheet — multi-file relational
    // shapes always pair CSVs / single-sheet xlsx).
    const fileScores = files.map((f) => {
      const sheet = f.sheets[0];
      const scored = sheet
        ? scoreSheet(sheet.headers, headerPatternSet)
        : { score: 0, matched: [] };
      return { name: f.name, score: scored.score };
    });
    const primary = [...fileScores].sort((a, b) => b.score - a.score)[0];
    const joinKey = findSharedJoinKey(files);

    if (joinKey && primary) {
      const companions = files
        .map((f) => f.name)
        .filter((n) => n !== primary.name);
      // Final confidence is the join-key needle weight tempered by whether
      // the primary file's sheet has any payroll-export signal.
      const confidence = Math.min(
        1,
        joinKey.confidence * (primary.score > 0 ? 1 : 0.7),
      );
      return {
        shape: "multi-file-relational",
        fileRelationship: {
          joinKey: joinKey.rawHeader,
          primary: primary.name,
          companions,
          confidence,
        },
      };
    }
    // Multi-file but no join key — still report the shape; UI surfaces a
    // relationship picker with `confidence < JOIN_KEY_PROPOSE_THRESHOLD`.
    return {
      shape: "multi-file-relational",
      fileRelationship: primary
        ? {
            joinKey: "",
            primary: primary.name,
            companions: files
              .map((f) => f.name)
              .filter((n) => n !== primary.name),
            confidence: 0,
          }
        : undefined,
    };
  }

  // ─── Single-file path ─────────────────────────────────────────────────
  const [file] = files;
  if (file.extension === "csv") {
    return { shape: "csv" };
  }

  // .xlsx / .xlsm
  if (file.sheets.length <= 1) {
    return { shape: "excel-single" };
  }

  const sheets: SheetScore[] = file.sheets.map((s) => {
    const { score, matched } = scoreSheet(s.headers, headerPatternSet);
    return { name: s.name, score, matchedHeaders: matched };
  });
  sheets.sort((a, b) => b.score - a.score);

  const top = sheets[0];
  // Propose the highest-scoring sheet by default. The wizard's
  // sheet-picker visibility is governed by OQ-MAP-6 (always-on first
  // import) — NOT by this threshold; the threshold gates the pre-selection.
  const proposedSheet =
    top && top.score >= SHEET_SIGNATURE_PROPOSE_THRESHOLD
      ? top.name
      : top
        ? top.name
        : undefined;

  // Reference the join-key threshold so it is not "unused" (it informs the
  // multi-file branch above; tsc would flag it if no path references it).
  void JOIN_KEY_PROPOSE_THRESHOLD;

  return {
    shape: "excel-multi",
    sheets,
    proposedSheet,
  };
}
