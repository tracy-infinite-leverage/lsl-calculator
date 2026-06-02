/**
 * report-context.ts — small helper that constructs a `ReportContext` for the
 * public-calc PDF CTAs (Task 6.3).
 *
 * E6.6a Task 6.3. The single-employee + bulk-summary CTAs need to pass a
 * `ReportContext` to `POST /api/reports/[family]` (the canonical Phase 5a
 * endpoint). Both CTAs need the SAME letterhead + methodology fields. Rather
 * than duplicate the constants across two component files, this helper
 * centralises:
 *
 *   - the canonical version stamps (`CALC_METHODOLOGY_VERSION`,
 *     `STATE_ENGINE_VERSION`) — kept as constants here because no engine
 *     module emits a version stamp today. When the engine starts emitting
 *     its own version, swap these for the engine-owned identifiers.
 *   - the canonical APA contact pair — already documented as the source-of-
 *     truth values in `MethodologyFooter` doc-comments (see Letterhead.tsx
 *     + types.ts).
 *
 * The helper accepts only the per-call inputs (report title, optional
 * organisation name) and produces the full `ReportContext`. `generatedAtIso`
 * and `dataAsAtIso` are stamped to "now" — that is the spec semantic for the
 * public-calc paths (the data IS the form input the user just submitted; the
 * generation IS the click).
 *
 * Why these values are not co-located with the engine: the engine is a pure
 * computational module — it has no opinion on "what version stamp ends up in
 * a PDF". The PDF pipeline owns presentational constants. Tests in this folder
 * (`__tests__/A4Page.test.ts`, `__tests__/MethodologyFooter.test.ts`,
 * `templates/__tests__/SingleEmployee.test.ts`,
 * `templates/__tests__/BulkSummary.test.ts`) all use the literal strings
 * 'lsl-engine-v1.4.2' / 'rules-engine-v1.2' as fixture context — the
 * constants below match those fixtures so the prod renders and the test
 * renders embed the same stamps. If a future engine version bumps, update
 * here AND the fixtures together.
 */

import type { ReportContext } from './types';

/**
 * Canonical calculation methodology version emitted by the LSL engine.
 *
 * Format: free-form opaque string (see `types.ts::MethodologyFooterFields`).
 * Bumped manually as engine logic changes. Matches the literal used in the
 * snapshot test fixtures (`lsl-engine-v1.4.2`) so prod + test renders agree.
 */
export const CALC_METHODOLOGY_VERSION = 'lsl-engine-v1.4.2';

/**
 * Canonical state-engine (jurisdiction rules) version.
 *
 * Format: free-form opaque string. Matches the snapshot fixtures
 * (`rules-engine-v1.2`).
 */
export const STATE_ENGINE_VERSION = 'rules-engine-v1.2';

/**
 * APA contact email — full variant of the methodology footer renders this.
 * Stored without a `mailto:` prefix; the footer is plain text.
 */
export const APA_CONTACT_EMAIL = 'admin@austpayroll.com.au';

/**
 * APA URL — both full and short footer variants render this. Stored without
 * a protocol prefix; the footer is plain text.
 */
export const APA_CONTACT_URL = 'www.austpayroll.com.au';

/**
 * Build a fresh `ReportContext` for a public-calc PDF CTA invocation.
 *
 * `generatedAtIso` and `dataAsAtIso` both default to the current UTC instant
 * — that is the public-calc semantic (the form input IS the data; the click
 * IS the generation). The two fields are populated identically by design;
 * E5.5 / E5.6 valuation reports decouple them when the data snapshot is
 * older than the generation time.
 *
 * @param opts.reportTitle      Required — rendered in the letterhead band.
 * @param opts.organisationName Optional — appears in the letterhead when set.
 * @param opts.generatedAtIso   Optional override — defaults to `new Date().toISOString()`.
 * @param opts.dataAsAtIso      Optional override — defaults to `generatedAtIso`.
 */
export function buildReportContext(opts: {
  reportTitle: string;
  organisationName?: string;
  generatedAtIso?: string;
  dataAsAtIso?: string;
}): ReportContext {
  const generatedAtIso = opts.generatedAtIso ?? new Date().toISOString();
  const dataAsAtIso = opts.dataAsAtIso ?? generatedAtIso;
  return {
    reportTitle: opts.reportTitle,
    generatedAtIso,
    organisationName: opts.organisationName,
    calcMethodologyVersion: CALC_METHODOLOGY_VERSION,
    stateEngineVersion: STATE_ENGINE_VERSION,
    dataAsAtIso,
    apaContact: {
      email: APA_CONTACT_EMAIL,
      url: APA_CONTACT_URL,
    },
  };
}
