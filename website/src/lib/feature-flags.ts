/**
 * Central feature-flag reader.
 *
 * Mirrors the strict-string convention used by `src/components/app-shell/sidebar-routes.ts`:
 * a flag is "on" iff `process.env.NEXT_PUBLIC_<FLAG>` is exactly the literal string `'true'`.
 * Vercel's env var dashboard stores values as strings, so this is the safest contract —
 * no truthy-string footguns (e.g. `'false'` is truthy in JavaScript).
 *
 * Each flag must be referenced by its static literal name. Next.js's build-time
 * `process.env.NEXT_PUBLIC_*` inliner only rewrites accesses where the key is a
 * compile-time string literal — a dynamic accessor like `process.env[key]` would
 * leave a runtime lookup that returns `undefined` in the browser. Adding a new
 * flag means adding a named getter here; that is the right kind of friction.
 *
 * Source: Spec §8.4 (E6 Sub-Brand UI System), Task 4.6 sequencing-guard G-5
 * (feature-flag path). Default is `false` — the gate is closed until Phase 5a
 * (E6.6 report templates) ships the real bulk PDF endpoint, at which point the
 * flag is flipped to `'true'` in the merge PR's env update.
 */

/**
 * Bulk-summary PDF download CTA visibility.
 *
 * Returns `true` only when `NEXT_PUBLIC_PDF_DOWNLOAD_ENABLED === 'true'`.
 * Default (unset, empty, `'false'`, or any other value): `false`.
 *
 * When `false`, the bulk-summary CTA must render NOTHING — no disabled button,
 * no "coming soon" label. Per operator decision recorded in Task 4.6 kickoff:
 * "the bulk CTA renders nothing in prod — no dead CTA, no 'coming soon' label.
 * The wiring is in place but the gate is closed."
 */
export function isBulkPdfDownloadEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PDF_DOWNLOAD_ENABLED === 'true';
}
