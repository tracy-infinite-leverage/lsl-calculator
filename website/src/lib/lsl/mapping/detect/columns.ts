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
import {
  COLUMN_HEADER_PROPOSE_THRESHOLD,
  PAY_CODE_CARDINALITY_MAX,
  PAY_CODE_CARDINALITY_MIN,
} from "./thresholds";
import { normaliseToken } from "./util";

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
 * Column kind we are trying to identify. `payCode` is the only one driven
 * by `pay_code_aliases.header_name` rows; the rest are driven by the
 * built-in vocabulary below — the spec's seed only covers the pay-code
 * column.
 */
type ColumnKind =
  | "payCode"
  | "amount"
  | "units"
  | "employeeId"
  | "periodEnd"
  | "jurisdiction"
  | "frequency";

interface BuiltInRule {
  /** Normalised needle (matched as exact or substring against header). */
  needle: string;
  /** 0..1 — base weight for an exact match. Substring matches get 80% of this. */
  weight: number;
  /** If true, the needle must match the WHOLE header (no substring). */
  exactOnly?: boolean;
}

/**
 * Built-in header vocabularies for the non-pay-code columns. The
 * `pay_code_aliases` seed covers `payCode` exclusively; everything else
 * lives here because the platform owns the canonical alias set for these
 * structural columns.
 */
const BUILT_IN_VOCABULARY: Record<Exclude<ColumnKind, "payCode">, BuiltInRule[]> = {
  amount: [
    { needle: "amount", weight: 0.85 },
    { needle: "pay amount", weight: 0.95 },
    { needle: "gross", weight: 0.85 },
    { needle: "gross amount", weight: 0.95 },
    { needle: "gross pay", weight: 0.9 },
    { needle: "value", weight: 0.7, exactOnly: true },
    { needle: "total amount", weight: 0.9 },
    { needle: "earnings amount", weight: 0.9 },
  ],
  units: [
    { needle: "units", weight: 0.9 },
    { needle: "hours", weight: 0.85 },
    { needle: "normal hours paid", weight: 0.95 },
    { needle: "fixed ordinary weekly hours", weight: 0.95 },
    { needle: "qty", weight: 0.75, exactOnly: true },
    { needle: "quantity", weight: 0.8 },
  ],
  employeeId: [
    { needle: "employee id", weight: 1.0 },
    { needle: "emp id", weight: 0.95 },
    { needle: "employee number", weight: 0.95 },
    { needle: "employee no", weight: 0.9 },
    { needle: "employeeid", weight: 0.95, exactOnly: true },
    { needle: "payroll id", weight: 0.85 },
    { needle: "staff id", weight: 0.85 },
  ],
  periodEnd: [
    { needle: "pay period end", weight: 1.0 },
    { needle: "period end", weight: 0.9 },
    { needle: "period end date", weight: 0.95 },
    { needle: "pay date", weight: 0.85 },
    { needle: "pay end date", weight: 0.9 },
    { needle: "pay period end date", weight: 1.0 },
  ],
  jurisdiction: [
    { needle: "state", weight: 0.9 },
    { needle: "work state", weight: 0.95 },
    { needle: "work jurisdiction", weight: 1.0 },
    { needle: "jurisdiction", weight: 0.95 },
    { needle: "location state", weight: 0.85 },
    { needle: "state code", weight: 0.95 },
    { needle: "work location", weight: 0.8 },
    { needle: "location", weight: 0.7 },
  ],
  frequency: [
    { needle: "pay frequency", weight: 1.0 },
    { needle: "frequency", weight: 0.85 },
    { needle: "pay cycle", weight: 0.9 },
    { needle: "cycle", weight: 0.7 },
  ],
};

/**
 * Score a header against a list of built-in rules. Returns the max weight,
 * dropping by 20% for substring matches.
 */
function scoreBuiltIn(
  normalisedHeader: string,
  rules: BuiltInRule[],
): number {
  let best = 0;
  for (const r of rules) {
    if (normalisedHeader === r.needle) {
      best = Math.max(best, r.weight);
    } else if (!r.exactOnly && normalisedHeader.includes(r.needle)) {
      best = Math.max(best, r.weight * 0.8);
    }
  }
  return best;
}

/**
 * Score a header against the seeded `pay_code_aliases` `header_name` rows.
 * Returns the alias confidence, dropping by 20% for substring matches.
 */
function scorePayCodeHeader(
  rawHeader: string,
  aliases: PayCodeAliasRow[],
): number {
  const normalisedHeader = normaliseToken(rawHeader);
  let best = 0;
  for (const a of aliases) {
    if (a.pattern_kind !== "header_name") continue;
    if (a.bucket === "pii_strip") continue;
    const pattern = normaliseToken(a.pattern);
    if (!pattern) continue;
    if (normalisedHeader === pattern) {
      best = Math.max(best, a.confidence);
    } else if (normalisedHeader.includes(pattern)) {
      best = Math.max(best, a.confidence * 0.8);
    }
  }
  return best;
}

/**
 * Tie-break: when multiple headers tie for the pay-code column, the one
 * whose value cardinality falls in [PAY_CODE_CARDINALITY_MIN,
 * PAY_CODE_CARDINALITY_MAX] wins.
 */
function isInCardinalityRange(uniqueValueCount: number): boolean {
  return (
    uniqueValueCount >= PAY_CODE_CARDINALITY_MIN &&
    uniqueValueCount <= PAY_CODE_CARDINALITY_MAX
  );
}

function uniqueValueCountForColumn(
  columnIndex: number,
  sampleRows: SampleRow[],
): number {
  const set = new Set<string>();
  for (const row of sampleRows) {
    const cell = row[columnIndex];
    if (cell === null || cell === undefined || cell === "") continue;
    set.add(String(cell));
  }
  return set.size;
}

/**
 * Detect every column kind in one sheet's header row.
 *
 * @param headers The sheet's header row, in order.
 * @param sampleRows Optional sample rows for the value-cardinality tie-break
 *   on the pay-code column. Empty array disables the tie-break.
 * @param aliases System-level `pay_code_aliases` rows with
 *   `pattern_kind === 'header_name'` (caller pre-filters). Only the
 *   `payCode` detection uses these; other column kinds use the built-in
 *   vocabulary above.
 */
export function detectColumns(
  headers: string[],
  sampleRows: SampleRow[],
  aliases: PayCodeAliasRow[],
): DetectedColumns {
  if (headers.length === 0) return {};

  // ─── Score every header against every column kind in one pass ──────
  type HeaderScore = { index: number; header: string; score: number };
  const scoresByKind: Record<ColumnKind, HeaderScore[]> = {
    payCode: [],
    amount: [],
    units: [],
    employeeId: [],
    periodEnd: [],
    jurisdiction: [],
    frequency: [],
  };

  headers.forEach((rawHeader, index) => {
    const normalised = normaliseToken(rawHeader);
    if (!normalised) return;

    // payCode — driven by DB aliases.
    const payCodeScore = scorePayCodeHeader(rawHeader, aliases);
    if (payCodeScore > 0) {
      scoresByKind.payCode.push({ index, header: rawHeader, score: payCodeScore });
    }

    // All other kinds — driven by built-in vocabulary.
    for (const kind of Object.keys(BUILT_IN_VOCABULARY) as Array<
      Exclude<ColumnKind, "payCode">
    >) {
      const score = scoreBuiltIn(normalised, BUILT_IN_VOCABULARY[kind]);
      if (score > 0) {
        scoresByKind[kind].push({ index, header: rawHeader, score });
      }
    }
  });

  // ─── Pick the winner per kind, threshold-gated ──────────────────────
  const result: DetectedColumns = {};
  const claimedIndices = new Set<number>();

  // Pay-code first — has tie-break logic + we want it to "claim" its column
  // before other kinds (e.g. a 'Pay Code Description' shouldn't be picked
  // as the pay-code column when 'Pay Code' is also present).
  const payCodeCandidates = scoresByKind.payCode
    .filter((s) => s.score >= COLUMN_HEADER_PROPOSE_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  // Tie-break by cardinality + by header length (prefer exact 'Pay Code'
  // over 'Pay Code Description' — the description column has the same
  // alias match strength on substring but is longer).
  let pickedPayCode: HeaderScore | null = null;
  if (payCodeCandidates.length > 0) {
    const top = payCodeCandidates[0];
    const topScoreCandidates = payCodeCandidates.filter(
      (c) => Math.abs(c.score - top.score) < 1e-9,
    );

    if (topScoreCandidates.length === 1 || sampleRows.length === 0) {
      // Single winner — or no sample rows for cardinality tie-break:
      // prefer the shortest header (e.g. 'Pay Code' over 'Pay Code Description').
      pickedPayCode = [...topScoreCandidates].sort(
        (a, b) => a.header.length - b.header.length,
      )[0];
    } else {
      // Cardinality tie-break.
      const inRange = topScoreCandidates.filter((c) =>
        isInCardinalityRange(uniqueValueCountForColumn(c.index, sampleRows)),
      );
      pickedPayCode =
        inRange.length > 0
          ? [...inRange].sort((a, b) => a.header.length - b.header.length)[0]
          : [...topScoreCandidates].sort(
              (a, b) => a.header.length - b.header.length,
            )[0];
    }
  }

  if (pickedPayCode) {
    result.payCode = {
      header: pickedPayCode.header,
      index: pickedPayCode.index,
      confidence: pickedPayCode.score,
    };
    claimedIndices.add(pickedPayCode.index);
  }

  // Now the other kinds — first-best wins, threshold-gated. A column can
  // only be claimed by one kind (highest-scoring kind wins where two
  // kinds compete; rare in practice).
  for (const kind of [
    "employeeId",
    "periodEnd",
    "amount",
    "units",
    "jurisdiction",
    "frequency",
  ] as const) {
    const candidates = scoresByKind[kind]
      .filter((s) => !claimedIndices.has(s.index))
      .filter((s) => s.score >= COLUMN_HEADER_PROPOSE_THRESHOLD)
      .sort((a, b) => b.score - a.score);
    const winner = candidates[0];
    if (winner) {
      result[kind] = {
        header: winner.header,
        index: winner.index,
        confidence: winner.score,
      };
      claimedIndices.add(winner.index);
    }
  }

  return result;
}
