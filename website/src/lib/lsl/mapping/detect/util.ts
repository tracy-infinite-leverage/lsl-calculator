/**
 * Internal helpers for the detect layer. Not exported from the barrel.
 *
 * Header + value normalisation rules — case-fold + collapse whitespace +
 * canonicalise underscore/hyphen variance.
 */

/**
 * Normalise a header or value string for case + whitespace + underscore
 * tolerant matching:
 *   - trim outer whitespace
 *   - lowercase
 *   - collapse runs of whitespace, `_`, or `-` to a single space
 */
export function normaliseToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
}

/**
 * Strict normalisation that *preserves* hyphens — used by value-normalisation
 * surface-form matches that need to distinguish `bi-weekly` from `biweekly`.
 * Hyphen is preserved; underscore + whitespace collapse only.
 */
export function normaliseValuePreservingHyphen(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s_]+/g, " ")
    .trim();
}
