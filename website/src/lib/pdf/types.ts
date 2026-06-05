/**
 * types.ts — shared types for the PDF report pipeline (E6.5).
 *
 * Single source of truth for the `ReportContext` shape that every report
 * template inherits. Each PDF building block (Letterhead, MethodologyFooter,
 * A4Page) consumes a narrowed view of this interface; the route handler
 * (Task 5.5) constructs the full object once per report and threads it
 * through to whichever blocks compose that template.
 *
 * Defined in its own module — not inside `Letterhead.tsx` or
 * `MethodologyFooter.tsx` — so neither component owns the type contract.
 * That keeps cross-cutting fields (calc methodology version, data-as-at
 * date) from being conceptually anchored to a single block.
 *
 * ----------------------------------------------------------------------------
 * Relationship to `ReportLetterheadContext`
 * ----------------------------------------------------------------------------
 *
 * `Letterhead.tsx` already exports `ReportLetterheadContext` (Task 5.2). To
 * avoid breaking that public type, this module re-uses it as a base via
 * intersection — the full `ReportContext` is a superset that adds the four
 * fields the methodology footer needs. Templates that compose both blocks
 * (E6.6 / E5.5 / E5.6 in Task 5.5+) construct a single `ReportContext` and
 * pass it to both components.
 */

import type { ReportLetterheadContext } from './Letterhead';

/**
 * `MethodologyFooterFields` — the fields the methodology footer needs that
 * are NOT already on the Letterhead context.
 *
 * Each field is stored as a string (not a structured type) because:
 *   - Versions are opaque identifiers — the footer renders them verbatim.
 *     The calc/state-engine modules own the semver discipline.
 *   - The data-as-at date is rendered as a human-readable string; the
 *     `dataAsAtIso` field is the ISO 8601 source of truth that
 *     `formatGeneratedAt` (from Letterhead.tsx) re-formats to the Sydney
 *     timezone for display.
 */
export interface MethodologyFooterFields {
  /**
   * Calculation methodology version — the version stamp emitted by the
   * LSL engine itself. Rendered on the FULL variant only.
   *
   * Format: a free-form opaque string. Examples:
   *   - "lsl-engine-v1.4.2"
   *   - "lsl-engine-v2.0.0-rc.1"
   *
   * Stored as a free string because (a) the engine module owns the actual
   * semver string + bump cadence, and (b) the footer's job is to render
   * the identifier verbatim without parsing or validation.
   */
  calcMethodologyVersion: string;
  /**
   * State-engine version — the version stamp from the jurisdiction
   * rules-engine. Rendered on BOTH variants. The footer carries this on
   * pages 2+ so a reader who lands mid-report can still answer the
   * question "which statutory rules-set produced these numbers?".
   *
   * Format: free-form opaque string. Examples:
   *   - "rules-engine-v1.2"
   *   - "rules-engine-v2.0.0"
   */
  stateEngineVersion: string;
  /**
   * Data-as-at date — the cut-off date for the underlying employee
   * masterfile / pay-period data used in the calculation. Rendered on
   * the FULL variant only.
   *
   * ISO 8601 (`YYYY-MM-DD` or full timestamp). The footer re-formats via
   * the shared `formatGeneratedAt` helper so the output is in the
   * `Australia/Sydney` timezone regardless of the machine that renders.
   *
   * Why a separate field from `generatedAtIso`: "when was the PDF
   * generated" and "when was the data snapshot taken" can differ by
   * minutes (live calculator) or days (E5.5 valuation report run against
   * EOFY snapshot). Both are meaningful to the auditor reading the PDF.
   */
  dataAsAtIso: string;
}

/**
 * `ApaContact` — APA contact details rendered in the methodology footer.
 *
 * Stored as a structured pair (email + URL) rather than a single concatenated
 * string because the SHORT variant renders the URL only — having the fields
 * separately means the footer doesn't need to parse out one half of a glued
 * string.
 *
 * Source of truth: brand context owns these strings. The values are passed
 * in from the route handler (Task 5.5) so they live with the rest of the
 * report context, not as hardcoded constants in the footer module.
 */
export interface ApaContact {
  /**
   * APA contact email — rendered on the FULL variant only.
   * Current value: `admin@austpayroll.com.au`.
   */
  email: string;
  /**
   * APA URL — rendered on BOTH variants. The "always render" pattern
   * mirrors the spec §5.4 rule that the SHORT variant on pages 2+
   * keeps the URL as a stable wayfinding signal even when the email
   * is dropped.
   *
   * Current value: `www.austpayroll.com.au`. Stored without protocol
   * because the footer renders plain text — no live link from a PDF.
   */
  url: string;
}

/**
 * `ReportContext` — the full per-report context object every PDF template
 * receives. Composed by intersection:
 *
 *   - `ReportLetterheadContext` — page-1 letterhead fields (Task 5.2)
 *   - `MethodologyFooterFields` — calc + state versions, data-as-at (Task 5.3)
 *   - `apaContact` — APA email + URL (Task 5.3)
 *
 * Templates in Task 5.5+ build ONE `ReportContext` and pass it to whichever
 * blocks compose that template. The blocks each accept their own narrow
 * slice; `ReportContext` is the canonical superset.
 */
export type ReportContext = ReportLetterheadContext &
  MethodologyFooterFields & {
    apaContact: ApaContact;
  };
