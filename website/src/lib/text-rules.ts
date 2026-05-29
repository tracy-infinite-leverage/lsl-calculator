/**
 * text-rules.ts — brand-voice copy helpers
 *
 * E6.2 Task 2.7 — heading + label normalisation per APA brand voice rules.
 *
 * Spec §5.1 contract: "apply brand voice rules from APA guide: **sentence
 * case** default for headings and body, left-aligned body, em dashes for
 * breaks, commas in 1000+ numerals". The headline rule for v1: sentence
 * case for headings.
 *
 * Two helpers ship because "sentence case" needs different semantics in
 * different contexts:
 *
 *   1. `toSentenceCase(input)` — aggressive: lowercase the whole string,
 *      then capitalise the first letter. Use this to convert TITLE-CASED
 *      or `ALL CAPS` input (e.g. data coming from a CSV header, a constant
 *      enum, a third-party label) into sentence case.
 *
 *   2. `capitaliseFirst(input)` — conservative: capitalise only the first
 *      letter; leave the rest unchanged. Use this when the input already
 *      contains proper nouns or acronyms that must survive (e.g.
 *      `"NSW long service leave"` — `toSentenceCase` would break `NSW`).
 *
 * Both helpers:
 *   - trim leading/trailing whitespace (a heading with stray spaces is a
 *     bug; collapse it at the helper rather than push it to the caller)
 *   - treat empty / whitespace-only input as an empty string (no throw —
 *     a missing label should render as empty, not crash)
 *   - operate on Unicode code points via String.prototype methods, which
 *     handle the Latin Basic Multilingual Plane correctly. Non-BMP
 *     (emoji, etc.) is not in scope for product copy.
 *
 * Anti-scope: this module deliberately does NOT ship a generic
 * `toTitleCase`. The brand voice rule is sentence case; offering a
 * title-case helper would invite drift. If a designer needs title case in
 * a single one-off place (e.g. a third-party widget label), they should
 * hard-code the string.
 */

/**
 * Capitalises the first character of the input and lowercases the rest.
 *
 * Use when the input may arrive in arbitrary casing and proper nouns are
 * NOT a concern (e.g. converting a constant key like `"PAY_HISTORY"`
 * into a heading via a prior `replace(/_/g, ' ')`).
 *
 * Examples:
 *   toSentenceCase("PAY HISTORY")   → "Pay history"
 *   toSentenceCase("Pay History")   → "Pay history"
 *   toSentenceCase("pay history")   → "Pay history"
 *   toSentenceCase("  spaced  ")    → "Spaced"
 *   toSentenceCase("")              → ""
 */
export function toSentenceCase(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return '';
  const lower = trimmed.toLocaleLowerCase('en-AU');
  return lower.charAt(0).toLocaleUpperCase('en-AU') + lower.slice(1);
}

/**
 * Capitalises the first character of the input. Leaves the rest unchanged.
 *
 * Use when the input is already correctly cased but the first letter may
 * be lowercase (e.g. a sentence fragment that begins with `"new..."`),
 * AND the body of the string may contain proper nouns or acronyms that
 * must survive untouched.
 *
 * Examples:
 *   capitaliseFirst("nSW long service leave") → "NSW long service leave"
 *   capitaliseFirst("pay history")            → "Pay history"
 *   capitaliseFirst("Pay history")            → "Pay history"  (idempotent)
 *   capitaliseFirst("  spaced  ")             → "Spaced"
 *   capitaliseFirst("")                       → ""
 */
export function capitaliseFirst(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return '';
  return trimmed.charAt(0).toLocaleUpperCase('en-AU') + trimmed.slice(1);
}
