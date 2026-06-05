/**
 * MethodologyFooter.tsx — methodology + legal disclosure footer for the
 * PDF report pipeline.
 *
 * E6.5 Task 5.3 (spec §5.4 + §8.5, resolves OQ-10). The footer is the
 * "this is how the number was made + this is a calculation, not advice"
 * disclosure block that appears on every page of every report.
 *
 * ----------------------------------------------------------------------------
 * Composition (top-to-bottom inside the footer band)
 * ----------------------------------------------------------------------------
 *
 *  FULL variant (page 1):
 *   1. Calculation methodology: <version>
 *   2. State engine: <version>
 *   3. Data as at <human-readable date>
 *   4. Calculated, not advice.
 *   5. Australian Payroll Association · <email> · <url>
 *
 *  SHORT variant (pages 2+, per OQ-10):
 *   1. State engine: <version>
 *   2. Calculated, not advice.
 *   3. <url>
 *
 * ----------------------------------------------------------------------------
 * Why two variants in one component
 * ----------------------------------------------------------------------------
 *
 * OQ-10 (resolved 2026-05-27, v0.4) — full block on page 1, short block on
 * pages 2+. The component renders WHICHEVER variant the caller passes in;
 * the page-aware logic (`pageNumber === 1 ? 'full' : 'short'`) lives in
 * the `A4Page` primitive (Task 5.4), not here. That keeps the footer
 * presentation-only and lets the page primitive own the "I am page N"
 * decision.
 *
 * ----------------------------------------------------------------------------
 * "Calculated, not advice." byte-identical voice
 * ----------------------------------------------------------------------------
 *
 * The exact phrase `Calculated, not advice.` (capital C, comma after
 * "Calculated", period) is byte-identical to the public-calc web footer
 * (`website/src/components/shell/footer.tsx` line 38) and to the
 * card / accordion design-system surfaces. Keeping the wording stable
 * across web + PDF is a brand-voice contract — auditors and stakeholders
 * read the same disclosure verbatim regardless of which surface served
 * the number. The web copy continues "— verify on the source statute for
 * edge cases" inline; the PDF footer renders the standalone disclosure
 * with no continuation because the methodology block already supplies
 * the version + data context.
 *
 * ----------------------------------------------------------------------------
 * No watermarks (spec §5.4 MUST NOT)
 * ----------------------------------------------------------------------------
 *
 * This module deliberately does NOT render a "DRAFT", "PREVIEW", or any
 * other diagonal-text watermark. Watermarks are explicitly out of scope
 * (spec §5.4: "MUST NOT ship draft / preview watermarks"). If the operator
 * ever asks for one, that's a spec amendment — not a one-off addition here.
 */

import { StyleSheet, Text, View } from '@react-pdf/renderer';
import * as React from 'react';
import { colors } from '../design-tokens';
import { registerPdfFonts } from './fonts';
import { formatGeneratedAt } from './Letterhead';
import type { ApaContact, MethodologyFooterFields } from './types';

// Register the PDF font families on module load. Idempotent — see fonts.ts.
registerPdfFonts();

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Props for the MethodologyFooter component.
 *
 * Accepts only the narrow slice of `ReportContext` that the footer reads
 * (calc + state versions, data-as-at, APA contact). Templates that already
 * hold a full `ReportContext` can spread it directly:
 *
 *   <MethodologyFooter
 *     calcMethodologyVersion={ctx.calcMethodologyVersion}
 *     stateEngineVersion={ctx.stateEngineVersion}
 *     dataAsAtIso={ctx.dataAsAtIso}
 *     apaContact={ctx.apaContact}
 *     variant="full"
 *   />
 *
 * The narrow shape (rather than `ReportContext` itself) gives the footer
 * a clearly typed contract that documents which fields it depends on — a
 * future refactor that moves a field out of `ReportContext` will surface
 * here as a typecheck failure rather than a runtime "field is undefined".
 */
export interface MethodologyFooterProps extends MethodologyFooterFields {
  apaContact: ApaContact;
  /**
   * Which variant to render:
   *   - `'full'`   — page 1 — all 5 fields
   *   - `'short'`  — pages 2+ — 3 fields (state-engine + disclaimer + URL)
   *
   * The COMPONENT does not infer the variant from page number — the
   * caller (the `A4Page` primitive in Task 5.4) decides which variant
   * is appropriate for the page being rendered.
   */
  variant: 'full' | 'short';
}

// ---------------------------------------------------------------------------
// Disclosure copy (byte-identical to web — see header comment)
// ---------------------------------------------------------------------------

/**
 * The standalone "Calculated, not advice." disclosure phrase. Defined as a
 * module-level constant so the test file can import + assert byte-identity
 * against the web footer's text content. If the web copy ever changes,
 * `brand.test.ts`-style cross-surface assertions will flag the divergence.
 *
 * Capital C / comma after "Calculated" / period — matches
 * `website/src/components/shell/footer.tsx` line 38.
 */
export const DISCLOSURE_PHRASE = 'Calculated, not advice.';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/**
 * Footer StyleSheet. Sizing per APA Brand Guide caption scale (~8pt):
 *
 *   - fontSize 8pt — caption-grade, the smallest readable size at A4. Keeps
 *     the footer band compact so it doesn't eat into report content space.
 *   - Source Sans 3 Regular — same family the Letterhead uses for live text,
 *     so the brand voice is consistent across header + footer bands.
 *   - colors['brand-grey'] — same low-contrast grey the Letterhead uses
 *     for the timestamp; signals "metadata, not content".
 *   - line height ~1.3 (`lineHeight: 1.3`) — comfortable for the
 *     multi-line full variant without bloating the band.
 *   - top border 0.5pt — a hairline rule visually separates the footer
 *     band from body content. Thinner than the 2pt navy underline on the
 *     letterhead because the footer is a quieter element.
 *
 * The band uses `paddingTop` rather than `marginTop` so when the parent
 * `<Page>` positions the footer with `fixed` (Task 5.4), the padding is
 * part of the footer's box and the border sits at the correct visual top.
 */
const styles = StyleSheet.create({
  band: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: colors['brand-grey'],
  },
  line: {
    fontFamily: 'Source Sans 3',
    fontSize: 8,
    fontWeight: 400,
    color: colors['brand-grey'],
    lineHeight: 1.3,
  },
  /**
   * Disclosure line gets the slightly darker `brand-charcoal` color and a
   * tiny top spacing so it pops out from the version metadata above it.
   * It's the line a reader is most likely to need to find — the rest is
   * traceability metadata.
   */
  disclosure: {
    fontFamily: 'Source Sans 3',
    fontSize: 8,
    fontWeight: 400,
    color: colors['brand-charcoal'],
    lineHeight: 1.3,
    marginTop: 2,
  },
});

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/**
 * Format the data-as-at ISO timestamp for the footer. Reuses the
 * Letterhead's `formatGeneratedAt` helper for timezone determinism, then
 * strips the trailing time-of-day component so the footer shows the
 * snapshot DATE only (the data-as-at is a date, not an instant — minute-
 * level precision would be misleading for a snapshot like "EOFY 2025-26").
 *
 * Examples:
 *   `'2026-05-31T05:42:00Z'` → "31 May 2026" (drops `, 3:42 pm AEST`)
 *   `'2026-05-31'`           → "31 May 2026" (treats as midnight UTC)
 *
 * Why not a separate Intl.DateTimeFormat call: keeping a single timezone-
 * aware formatter (Letterhead's) keeps the Sydney-timezone contract in
 * one place — no chance of the footer and the letterhead drifting to
 * different IANA zones.
 */
function formatDataAsAt(iso: string): string {
  const full = formatGeneratedAt(iso);
  // formatGeneratedAt output: "31 May 2026, 3:42 pm AEST" → split on the
  // comma we hand-stitched in and keep just the date half.
  return full.split(',')[0];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * MethodologyFooter — renders one of two variants per OQ-10.
 *
 * Composition is page-context-agnostic — the parent template / `A4Page`
 * primitive (Task 5.4) is responsible for positioning the footer (typically
 * as a `<Text fixed>` or absolute-positioned band at the bottom of every
 * page) AND for choosing the variant based on `pageNumber`.
 */
export function MethodologyFooter({
  calcMethodologyVersion,
  stateEngineVersion,
  dataAsAtIso,
  apaContact,
  variant,
}: MethodologyFooterProps) {
  if (variant === 'short') {
    // SHORT variant — pages 2+. Three fields only:
    //   1. State engine version (preserves traceability mid-report)
    //   2. "Calculated, not advice." (preserves the disclaimer)
    //   3. APA URL (preserves wayfinding)
    return (
      <View style={styles.band}>
        <Text style={styles.line}>State engine: {stateEngineVersion}</Text>
        <Text style={styles.disclosure}>{DISCLOSURE_PHRASE}</Text>
        <Text style={styles.line}>{apaContact.url}</Text>
      </View>
    );
  }

  // FULL variant — page 1. Five fields in order:
  //   1. Calculation methodology version
  //   2. State engine version
  //   3. Data as at <date>
  //   4. "Calculated, not advice."
  //   5. Australian Payroll Association · email · url
  const dataAsAt = formatDataAsAt(dataAsAtIso);

  return (
    <View style={styles.band}>
      <Text style={styles.line}>
        Calculation methodology: {calcMethodologyVersion}
      </Text>
      <Text style={styles.line}>State engine: {stateEngineVersion}</Text>
      <Text style={styles.line}>Data as at {dataAsAt}</Text>
      <Text style={styles.disclosure}>{DISCLOSURE_PHRASE}</Text>
      <Text style={styles.line}>
        Australian Payroll Association · {apaContact.email} · {apaContact.url}
      </Text>
    </View>
  );
}
