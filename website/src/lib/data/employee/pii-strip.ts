/**
 * PII strip — two-layer defence.
 *
 * Phase 2 (Task 2.3) per E5.2 Employee Masterfile + Customer Setup.
 *
 * Spec §5 mandates that any CSV column whose header looks like a TFN /
 * bank account / BSB / super-membership field is DROPPED before insert.
 * AC-EMP-7 verifies this at integration time. The pattern set lives here.
 *
 * Two layers (per impl-plan §1.5):
 *
 *   Layer A — column-name allowlist (`stripPiiHeaders`)
 *     Any header matching one of the family patterns below is stripped
 *     from the parsed output. Rows still process — only the offending
 *     column's values are discarded. The list of stripped column names
 *     is returned so the dry-run preview can surface the count.
 *
 *   Layer B — per-value regex defence (`flagSuspectTfn`)
 *     Any *value* matching `^\d{9}$` (the canonical AU TFN shape) is
 *     FLAGGED, not stripped. The masterfile parser surfaces the flags
 *     to the operator in the dry-run preview as a soft warning. We
 *     don't auto-strip because the same shape appears in legitimate
 *     employee-number columns.
 *
 * Refs:
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §5
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §1.5
 *   - AC-EMP-7
 */

/**
 * Result of layer-A header strip. `headers` and `rows` are the input with
 * PII columns removed in lockstep. `strippedColumns` carries the ORIGINAL
 * header names (as the user typed them) so the import audit log can record
 * exactly which columns were dropped.
 */
export interface StripPiiHeadersResult {
  headers: string[];
  rows: string[][];
  strippedColumns: string[];
}

/**
 * Canonical PII header patterns.
 *
 * Each pattern is matched against the header AFTER trim + lowercase + space
 * normalisation. We use word-boundary regexes (anchored either at start, end,
 * or via underscore / space boundaries) so e.g. `phone_number` does NOT match
 * the bank patterns but `account_number` does.
 *
 * The patterns are kept narrow and explicit — we'd rather miss a customer's
 * obscure column name (and surface the gap later) than over-strip a
 * legitimate column. RE-3 in spec §9 documents this trade-off.
 */
const PII_HEADER_PATTERNS: ReadonlyArray<RegExp> = [
  // TFN family — TFN / tax_file / taxfile / tax file / tax_id / taxid.
  // Match if any of the tokens appears as a substring on a word boundary.
  /(^|[_\s])tfn([_\s]|$)/,
  /^tfn$/,
  /tax[_\s]?file/,
  /(^|[_\s])tax[_\s]?id([_\s]|$)/,
  /^tax[_\s]?id$/,

  // Bank family — bank_account / account_number / bsb.
  /bank[_\s]?account/,
  /account[_\s]?number/,
  /(^|[_\s])bsb([_\s]|$)/,
  /^bsb$/,

  // Super family — super_member / super_membership / super_fund_member.
  /super[_\s]?member/,
  /super[_\s]?fund[_\s]?member/,
];

/**
 * Normalise a header to its canonical comparison form. Mirrors the
 * normalisation `core.ts`#`trimNormalise` performs at parse time, but we
 * accept the raw header here so the caller doesn't have to remember to
 * pre-normalise.
 */
function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Returns true if a header matches any of the PII family patterns.
 */
function isPiiHeader(header: string): boolean {
  // Normalise for matching but keep both space and underscore forms in mind —
  // the patterns above tolerate both because they include `[_\s]?` in
  // strategic places.
  const normalised = normaliseHeader(header);
  return PII_HEADER_PATTERNS.some((re) => re.test(normalised));
}

/**
 * Strip every column whose header matches a PII family pattern.
 *
 * Returns `{ headers, rows, strippedColumns }` with the PII columns removed.
 * Original ordering of the surviving columns is preserved.
 *
 * Rows of mismatched length are tolerated — missing cells render as `''`,
 * extra cells past the header count are simply dropped (the iteration is
 * driven by the header index list).
 */
export function stripPiiHeaders(
  headers: string[],
  rows: string[][],
): StripPiiHeadersResult {
  if (headers.length === 0) {
    return { headers: [], rows: [], strippedColumns: [] };
  }

  // Compute which header indices survive and which are stripped.
  const keepIndices: number[] = [];
  const stripIndices: number[] = [];
  for (let i = 0; i < headers.length; i++) {
    if (isPiiHeader(headers[i])) {
      stripIndices.push(i);
    } else {
      keepIndices.push(i);
    }
  }

  if (stripIndices.length === 0) {
    // No-op fast path — return the inputs unchanged (defensively cloned
    // would be safer, but service-layer callers don't mutate; an extra
    // array allocation per row on every import is not worth it).
    return { headers, rows, strippedColumns: [] };
  }

  const newHeaders = keepIndices.map((i) => headers[i]);
  const newRows = rows.map((row) => keepIndices.map((i) => row[i] ?? ''));
  const strippedColumns = stripIndices.map((i) => headers[i]);

  return { headers: newHeaders, rows: newRows, strippedColumns };
}

/**
 * Layer-B defence. Scan every value and return the deduplicated set of values
 * that look like a 9-digit TFN.
 *
 * The masterfile parser surfaces these flags in the dry-run preview as a
 * soft warning so the operator can choose to abort the import if a column
 * was misnamed (e.g. `tax_id` typo'd as `id` and slipped past layer A).
 *
 * We dedupe so the operator sees each suspect value once, not N times.
 */
export function flagSuspectTfn(values: ReadonlyArray<string>): string[] {
  const TFN_REGEX = /^\d{9}$/;
  const seen = new Set<string>();
  const flagged: string[] = [];
  for (const v of values) {
    if (v === undefined || v === null) continue;
    const trimmed = String(v).trim();
    if (trimmed.length === 0) continue;
    if (!TFN_REGEX.test(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    flagged.push(trimmed);
  }
  return flagged;
}
