/**
 * Shared CSV parsing primitives.
 *
 * Extracted from `bulk.ts` per E5.2 Phase 2 Task 2.1 (DEV-EMP-5) so the same
 * low-level CSV machinery can be reused by:
 *   - the existing public bulk-mode parser (`bulk.ts`)
 *   - the upcoming authenticated masterfile parser (`website/src/lib/data/employee/masterfile-csv.ts`)
 *   - the future pay-period parser (E5.4)
 *
 * Scope of this module is deliberately tight — only header detection,
 * quote-aware line splitting, and string-normalise helpers. Anything
 * domain-specific (LSL field mapping, masterfile column allowlists,
 * PII strip rules) lives in the parser that owns the concern, not here.
 *
 * Refs:
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-tasks.md §Task 2.1
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §0 DEV-EMP-5
 */

/**
 * Quote-aware CSV line splitter.
 *
 * Handles:
 *   - Quoted fields containing commas (e.g. `"NSW,VIC"` → one field `NSW,VIC`).
 *   - Doubled-quote escapes inside quoted fields (`""` → literal `"`).
 *   - Empty fields (`a,,b` → `['a', '', 'b']`).
 *   - Unterminated quotes are tolerated — the unfinished field is closed at
 *     end-of-line. We prefer leniency over throwing because real-world payroll
 *     exports are often hand-edited.
 *
 * Does NOT handle:
 *   - Newlines embedded inside quoted fields. Bulk + masterfile schemas don't
 *     require this; the parsers split on `\n` before calling this function.
 *     If a future caller needs embedded newlines, refactor to a stream-aware
 *     tokeniser — out of scope for v1.
 */
export function splitQuotedRow(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

/**
 * Normalise a header cell to its canonical form:
 *   - strip surrounding whitespace
 *   - lowercase
 *   - collapse runs of internal whitespace into a single underscore
 *
 * Both `bulk.ts` and `masterfile-csv.ts` use this to make header matching
 * case-insensitive and tolerant of `employee id` vs `Employee_ID`.
 */
export function trimNormalise(cell: string): string {
  return cell.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parse the first non-empty line of a CSV as the header row.
 *
 * Returns an empty array if `csv` is empty. Strips a UTF-8 BOM if present
 * (Excel-exported CSVs frequently carry one).
 *
 * Header cells are normalised via `trimNormalise` so downstream code can
 * `indexOf` against canonical names.
 */
export function parseCsvHeader(csv: string): string[] {
  if (!csv) return [];
  const bomStripped = csv.replace(/^﻿/, '');
  const firstLineEnd = bomStripped.search(/\r?\n/);
  const firstLine = firstLineEnd === -1 ? bomStripped : bomStripped.slice(0, firstLineEnd);
  if (firstLine.trim().length === 0) return [];
  return splitQuotedRow(firstLine).map(trimNormalise);
}

/**
 * Split a CSV body into non-empty lines, stripping a UTF-8 BOM if present.
 *
 * Lines are not yet split into cells — callers must run `splitQuotedRow` per
 * line as needed. Returns an empty array for empty input.
 */
export function splitCsvLines(csv: string): string[] {
  if (!csv) return [];
  return csv
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
}
