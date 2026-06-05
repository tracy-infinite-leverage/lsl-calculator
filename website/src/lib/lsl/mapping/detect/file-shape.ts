// E5.3 Phase 2 / Task T2.2 — file-shape detection (Pass 1, deterministic).
//
// Refs:
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md §5.1
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping-impl-plan.md §3 Phase 2 / step 2.2
//   - .specify/features/005-lsl-platform/sub-specs/pay-code-mapping-tasks.md §T2.2
//
// What this module does
// ─────────────────────
// Given the parsed bytes of one-or-more uploaded files (CSV or Excel), classify
// the upload into one of four shapes and surface the per-sheet / per-file
// metadata the wizard needs in step 1:
//
//   1. `csv`                     — single CSV file, single sheet.
//   2. `excel-single`            — single Excel workbook, exactly one sheet.
//   3. `excel-multi`             — single Excel workbook with 2+ sheets;
//                                  detector picks the highest-scoring sheet
//                                  (`proposedSheet`).
//   4. `multi-file-relational`   — 2–4 CSV files uploaded together; detector
//                                  finds the shared join key and proposes a
//                                  primary file + companions.
//
// This file is a PURE FUNCTION. It does not read bytes from disk, hit the
// network, or touch the database. The caller (E5.4 ingestion) hydrates
// `DetectorFileInput.sheets[*]` from whichever parser opened the file
// (`xlsx`, `csv-parse`, etc.) and passes the result here.
//
// Scoring scheme (§5.1)
// ─────────────────────
// For Excel multi-sheet detection, we score each sheet's headers against the
// `pay_code_aliases` rows where `pattern_kind === 'header_name'`. PII-strip
// aliases (`bucket === 'pii_strip'`) are excluded — they signal the presence
// of sensitive columns, not "this sheet looks like a payroll export".
//
// For each header, the per-header score is the MAX `confidence` across all
// non-PII `header_name` aliases whose normalised `pattern` matches the
// normalised header. Header normalisation is lower-case + whitespace collapse
// + `_`→` ` (so `pay_code`, `Pay Code`, `PAY_CODE` all collapse to the same
// surface).
//
// The sheet's overall score is the **mean of the top-5 header scores** —
// reflecting the spec language "the sheet whose top 5 headers match the
// payroll-export pattern wins". When a sheet has fewer than 5 headers we
// pad with zeros, so very narrow sheets cannot accidentally win.
//
// Multi-file relational detection (§5.1 last bullet)
// ──────────────────────────────────────────────────
// 2–4 CSV files arrive in the same upload. We:
//   1. Normalise every header in every file.
//   2. Find headers shared across ≥ 2 files.
//   3. Score each shared header — `employee_id`-family names get a boost
//      (the typical join key); ties broken by "appears in more files".
//   4. Highest-scoring shared header → `joinKey`. The file whose headers most
//      resemble per-pay-period payroll (highest sheet-signature score)
//      becomes `primaryFile`; the rest become `companionFiles`.
//
// If no shared header surfaces, we return `confidence: 0` on the relationship
// so the wizard can surface its relationship-picker (caller responsibility).

import type {
  DetectorFileInput,
  FileRelationship,
  FileShape,
  FileShapeDetection,
  PayCodeAliasRow,
  SheetInfo,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lower-case + collapse internal whitespace + treat `_` as space + trim.
 * Makes `pay_code`, `Pay Code`, ` PAY  CODE `, and `pay code` collide.
 */
function normaliseHeader(raw: string): string {
  return raw.toLowerCase().replace(/[_\s]+/g, ' ').trim();
}

/** Sheet-signature score: mean of top-5 header scores (pads with 0). */
function scoreSheet(
  headers: ReadonlyArray<string>,
  headerAliases: ReadonlyArray<PayCodeAliasRow>,
): number {
  if (headers.length === 0 || headerAliases.length === 0) return 0;

  const aliasIndex: ReadonlyArray<{ pattern: string; confidence: number }> =
    headerAliases.map((a) => ({
      pattern: normaliseHeader(a.pattern),
      confidence: a.confidence,
    }));

  const perHeader = headers.map((h) => {
    const n = normaliseHeader(h);
    if (n === '') return 0;
    let best = 0;
    for (const a of aliasIndex) {
      if (a.pattern === n && a.confidence > best) best = a.confidence;
    }
    return best;
  });

  const TOP_K = 5;
  const sorted = perHeader.slice().sort((a, b) => b - a);
  const top = sorted.slice(0, TOP_K);
  while (top.length < TOP_K) top.push(0);
  return top.reduce((s, v) => s + v, 0) / TOP_K;
}

/**
 * Build a SheetInfo from a raw sheet payload + the alias index.
 * The score reuses `scoreSheet` so the Excel-multi proposed-sheet pick and the
 * surfaced `sheets[*].score` stay consistent.
 */
function buildSheetInfo(
  raw: { name: string; headers: string[]; sampleRows: ReadonlyArray<ReadonlyArray<string>> },
  headerAliases: ReadonlyArray<PayCodeAliasRow>,
): SheetInfo {
  return {
    name: raw.name,
    headers: raw.headers,
    sampleRows: raw.sampleRows,
    score: scoreSheet(raw.headers, headerAliases),
  };
}

/** Heuristic boost for the canonical employee-id family. */
function joinKeyAffinity(normalisedHeader: string): number {
  // Highest: exact employee-id surfaces. Lower: weaker employee-only signals.
  const exact = new Set([
    'employee id',
    'employeeid',
    'emp id',
    'empid',
    'staff id',
    'staffid',
    'person id',
    'personid',
    'payee id',
    'payeeid',
  ]);
  if (exact.has(normalisedHeader)) return 1.0;
  // Trailing "id" with employee/staff/payee context.
  if (/^(employee|emp|staff|payee|person)\b.*\bid\b/.test(normalisedHeader)) return 0.9;
  // Bare "id" is a weak signal — many tables have one; keep low.
  if (normalisedHeader === 'id') return 0.4;
  return 0;
}

/**
 * For multi-file relational uploads, find the best shared join-key column.
 *
 * Returns null when no header is shared across ≥ 2 files.
 */
function detectRelationship(
  files: ReadonlyArray<DetectorFileInput>,
  headerAliases: ReadonlyArray<PayCodeAliasRow>,
): FileRelationship | null {
  // Build per-file normalised header sets, preserving the original spelling
  // of the first occurrence (so we can surface the user's spelling back).
  const fileHeaders = files.map((f) => {
    const map = new Map<string, string>();
    const sheet = f.sheets[0]; // CSVs are always single-sheet.
    if (sheet) {
      for (const h of sheet.headers) {
        const n = normaliseHeader(h);
        if (n !== '' && !map.has(n)) map.set(n, h);
      }
    }
    return { filename: f.filename, headers: map };
  });

  // For each normalised header, count how many files it appears in.
  const occurrences = new Map<string, { count: number; firstSpelling: string }>();
  for (const fh of fileHeaders) {
    for (const [n, original] of fh.headers) {
      const cur = occurrences.get(n);
      if (cur) {
        cur.count += 1;
      } else {
        occurrences.set(n, { count: 1, firstSpelling: original });
      }
    }
  }

  // Filter to shared candidates (appear in ≥ 2 files) and score them.
  const candidates: Array<{ key: string; spelling: string; score: number; count: number }> = [];
  for (const [n, info] of occurrences) {
    if (info.count < 2) continue;
    const affinity = joinKeyAffinity(n);
    // Score: heavily weight the join-key affinity; reward broader sharing.
    // affinity 1.0 alone is enough to clear the 0.7 propose threshold.
    const breadth = info.count / files.length; // 1.0 when present in every file.
    const score = affinity * 0.85 + breadth * 0.15;
    candidates.push({ key: n, spelling: info.firstSpelling, score, count: info.count });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break: prefer the one that appears in more files; then alphabetical.
    if (b.count !== a.count) return b.count - a.count;
    return a.key.localeCompare(b.key);
  });
  const winner = candidates[0];

  // Pick the primary file = the one whose headers score highest against the
  // payroll-header signature. Stable tie-break: input order.
  const filesWithScore = files.map((f, idx) => ({
    f,
    idx,
    score: scoreSheet(f.sheets[0]?.headers ?? [], headerAliases),
  }));
  filesWithScore.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.idx - b.idx;
  });

  const primary = filesWithScore[0].f.filename;
  const companions = files
    .filter((f) => f.filename !== primary)
    .map((f) => f.filename);

  return {
    joinKey: winner.spelling,
    primaryFile: primary,
    companionFiles: companions,
    confidence: Math.min(1, winner.score),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine the file shape and (for Excel multi-sheet or multi-file relational
 * drops) propose the primary sheet / join key.
 *
 * Algorithm (per §5.1):
 *
 *   1. Empty input → throws (caller bug; never expected).
 *   2. Exactly one CSV file → `{ shape: 'csv', sheets }`.
 *   3. Exactly one Excel file (xlsx/xlsm) with one sheet →
 *      `{ shape: 'excel-single', sheets }`.
 *   4. Exactly one Excel file with 2+ sheets → `{ shape: 'excel-multi',
 *      sheets, proposedSheet }`. The proposed sheet is the one with the
 *      highest signature score against `pay_code_aliases.header_name`.
 *   5. 2–4 CSV files → `{ shape: 'multi-file-relational', fileRelationship }`.
 *      The relationship's `joinKey` is the highest-scoring shared header;
 *      `primaryFile` is whichever file looks most like a payroll export.
 *
 * Pure function — no I/O, no env reads, no DB calls.
 *
 * @param files   The uploaded file payload(s), already parsed into header
 *                rows + sample rows by the caller.
 * @param aliases System-managed `pay_code_aliases`. Caller can pass the full
 *                set; this function filters to `pattern_kind === 'header_name'`
 *                internally.
 */
export function detectFileShape(
  files: ReadonlyArray<DetectorFileInput>,
  aliases: ReadonlyArray<PayCodeAliasRow>,
): FileShapeDetection {
  if (files.length === 0) {
    throw new Error('detectFileShape: at least one input file is required');
  }

  // Restrict to non-PII header aliases up front — used by all sheet scoring.
  const headerAliases = aliases.filter(
    (a) => a.pattern_kind === 'header_name' && a.bucket !== 'pii_strip',
  );

  // Multi-file path. By design only CSVs participate in the relational shape;
  // mixed CSV + Excel uploads are out of scope for v1 (single Excel takes
  // precedence — see `excel-multi` below).
  if (files.length > 1) {
    const allCsv = files.every((f) => f.kind === 'csv');
    if (allCsv) {
      const sheets: SheetInfo[] = files.map((f) =>
        buildSheetInfo(
          f.sheets[0] ?? { name: f.filename, headers: [], sampleRows: [] },
          headerAliases,
        ),
      );
      const rel = detectRelationship(files, headerAliases);
      const result: FileShapeDetection = {
        shape: 'multi-file-relational',
        sheets,
      };
      if (rel) result.fileRelationship = rel;
      return result;
    }

    // Mixed-kind multi-file or multi-Excel is not a v1 shape. Fall through
    // to single-file handling against the first file — the wizard will
    // surface the residual files via the relationship-picker.
    // (Defensive — E5.4 ingestion validates upload composition before this
    // function is called.)
  }

  // Single-file path.
  const file = files[0];

  if (file.kind === 'csv') {
    const sheet = file.sheets[0] ?? { name: file.filename, headers: [], sampleRows: [] };
    const shape: FileShape = 'csv';
    return {
      shape,
      sheets: [buildSheetInfo(sheet, headerAliases)],
    };
  }

  // Excel (xlsx / xlsm).
  const sheetInfos: SheetInfo[] = file.sheets.map((s) =>
    buildSheetInfo(s, headerAliases),
  );

  if (sheetInfos.length <= 1) {
    return {
      shape: 'excel-single',
      sheets: sheetInfos,
    };
  }

  // 2+ sheets → pick the highest-scoring as proposed. Stable tie-break:
  // input order (so the user's first sheet wins on identical signatures).
  let topIdx = 0;
  for (let i = 1; i < sheetInfos.length; i += 1) {
    if (sheetInfos[i].score > sheetInfos[topIdx].score) topIdx = i;
  }
  return {
    shape: 'excel-multi',
    sheets: sheetInfos,
    proposedSheet: sheetInfos[topIdx].name,
  };
}
