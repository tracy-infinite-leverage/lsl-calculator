/**
 * Letterhead.tsx — production Letterhead block for the report PDF pipeline.
 *
 * E6.5 Task 5.2 (impl-plan §1.1, spec §5.4 + §8.5). Renders the page-1
 * letterhead band for every report family (E6.6 + E5.5 / E5.6 templates).
 *
 * ----------------------------------------------------------------------------
 * Composition (top-to-bottom, left-to-right within the band)
 * ----------------------------------------------------------------------------
 *
 *  ┌───────────────────────────────────────────────────────────────────┐
 *  │  ┌─────────────────────────┐         ┌────────────────────────┐  │
 *  │  │ <Wordmark>              │         │ <Report title>         │  │
 *  │  │ "LSL Calculator" mark   │         │ Montserrat SemiBold    │  │
 *  │  │ inline outlined paths   │         │                        │  │
 *  │  │ + gold accent rule      │         │ <Generated timestamp>  │  │
 *  │  ├─────────────────────────┤         │ Source Sans 3 Regular  │  │
 *  │  │ "by Australian Payroll  │         │                        │  │
 *  │  │  Association"           │         │ <"for: org name">      │  │
 *  │  │ Source Sans 3 Regular   │         │ (optional)             │  │
 *  │  └─────────────────────────┘         └────────────────────────┘  │
 *  ├───────────────────────────────────────────────────────────────────┤
 *  │  2pt navy border bottom — anchors letterhead from body content   │
 *  └───────────────────────────────────────────────────────────────────┘
 *
 * The "by Australian Payroll Association" tagline is rendered as live PDF
 * text (NOT baked into the wordmark SVG) so screen readers + PDF text
 * extraction surface it correctly. This matches the same accessibility
 * pattern used in `website/src/components/brand/Lockup.tsx` for the web
 * rendering — single source of truth on the tagline copy (asserted by
 * `brand.test.ts`).
 *
 * ----------------------------------------------------------------------------
 * Wordmark SVG provenance
 * ----------------------------------------------------------------------------
 *
 * The `<Path d="…" />` data below is transcribed verbatim from
 * `docs/brand/final/wordmark/wordmark-master.svg` — specifically the
 * "primary mark" path that draws the outlined "LSL Calculator" glyphs.
 * Per PR #62 (Task 2.5.1), the wordmark glyphs were outlined to `<path>`
 * data so the SVG has no external font dependency — which means we can
 * embed the SAME glyph data into a PDF via `<Path>` with full fidelity,
 * without registering Montserrat for the wordmark itself.
 *
 * The viewBox is cropped to `0 0 1000 210` (the primary-mark path lives in
 * y≈98–172 + gold accent rule at y=205). The tagline path data from the
 * master SVG (y≈246–270 region) is intentionally excluded — we render the
 * tagline as live text instead.
 *
 * ----------------------------------------------------------------------------
 * Why @react-pdf/renderer's <Line> for the gold accent rule
 * ----------------------------------------------------------------------------
 *
 * The master SVG uses `<line x1="380" y1="205" x2="620" y2="205" stroke=
 * "#d9a428" stroke-width="4"/>` for the gold rule under the wordmark.
 * react-pdf supports `<Line>` natively inside `<Svg>` — keeps the wordmark
 * vector + rule together as a single visual unit at any render size.
 */

import {
  Line,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer';
import * as React from 'react';
import { colors } from '../design-tokens';
import { registerPdfFonts } from './fonts';

// Register the PDF font families on module load. Idempotent — see fonts.ts.
registerPdfFonts();

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * `ReportContext` — the minimal context shape every PDF template inherits.
 *
 * Wider-scope `ReportContext` (calc methodology version, state-engine
 * version, data-as-at date for the MethodologyFooter) will be defined when
 * Task 5.3 lands; Task 5.2's Letterhead only needs the four fields below.
 *
 * Defining the interface here keeps Letterhead self-contained for the
 * snapshot test. The Task 5.3 / 5.4 work will widen this into a shared
 * `types.ts` and Letterhead will re-export from there.
 */
export interface ReportLetterheadContext {
  /**
   * Report title rendered top-right in Montserrat SemiBold (spec §5.4:
   * "report title"). Examples:
   *   - "Single-employee LSL result"
   *   - "Bulk LSL summary — 247 employees"
   *   - "LSL liability valuation 2026-Q2"
   *   - "LSL reconciliation — 2025-26 EOFY"
   */
  reportTitle: string;
  /**
   * Generated-at timestamp as an **ISO 8601** string. Examples:
   *   - "2026-05-31T15:42:00+10:00" (AEST, UTC+10)
   *   - "2026-05-31T05:42:00Z"      (same moment, expressed in UTC)
   * Rendered in `Australia/Sydney` timezone for human display — see
   * `formatGeneratedAt` below for the deterministic output format.
   *
   * Why ISO 8601 in the API instead of a `Date`: the PDF route handler
   * (Task 5.5) receives input as JSON, which does not have a native Date
   * type. ISO 8601 is the canonical interchange format and is what the
   * route handler will hand to the template.
   */
  generatedAtIso: string;
  /**
   * Optional organisation name. When provided, renders a "for: <name>" line
   * beneath the timestamp. Spec §5.4: "for: <organisation name> line where
   * applicable". Calculator runs by anonymous users on the public site do
   * NOT pass this; B2B clients via the authenticated `/app/*` posture do.
   */
  organisationName?: string;
}

// ---------------------------------------------------------------------------
// Wordmark — inline outlined paths from docs/brand/final/wordmark/wordmark-master.svg
// ---------------------------------------------------------------------------

/**
 * Outlined "LSL Calculator" glyph data — verbatim from
 * `docs/brand/final/wordmark/wordmark-master.svg` primary-mark path. If the
 * master wordmark changes, replace this constant in lockstep — the file is
 * the source of truth.
 *
 * Stored as a module-level constant rather than read from the filesystem
 * because (a) react-pdf renders in Node where reading + parsing SVG at
 * render time is slow + adds an `fs` round-trip per PDF, and (b) the
 * wordmark is part of the brand contract that we WANT a code-review eyeball
 * on whenever it changes.
 */
const WORDMARK_PRIMARY_PATH_D =
  'M212.92 170L165.30 170L165.30 102.80L177.78 102.80L177.78 159.44L212.92 159.44 M242.14 170.96Q234.27 170.96 227.07 168.70Q219.87 166.45 215.64 162.90L219.96 153.20Q223.99 156.46 229.95 158.53Q235.90 160.59 242.14 160.59Q250.01 160.59 253.51 158.10Q257.02 155.60 257.02 151.86Q257.02 148.78 254.86 146.91Q252.70 145.04 249.15 143.94Q245.59 142.83 241.32 141.87Q237.05 140.91 232.78 139.62Q228.51 138.32 224.95 136.26Q221.40 134.19 219.24 130.74Q217.08 127.28 217.08 121.90Q217.08 116.43 220.01 111.87Q222.94 107.31 228.94 104.58Q234.94 101.84 244.15 101.84Q250.20 101.84 256.15 103.38Q262.11 104.91 266.52 107.79L262.59 117.49Q258.07 114.80 253.27 113.50Q248.47 112.21 244.06 112.21Q236.28 112.21 232.87 114.90Q229.47 117.58 229.47 121.33Q229.47 124.40 231.63 126.22Q233.79 128.05 237.34 129.20Q240.89 130.35 245.16 131.26Q249.43 132.18 253.66 133.42Q257.88 134.67 261.43 136.78Q264.99 138.90 267.15 142.30Q269.31 145.71 269.31 150.99Q269.31 156.37 266.38 160.93Q263.45 165.49 257.40 168.22Q251.35 170.96 242.14 170.96 M327.81 170L280.19 170L280.19 102.80L292.67 102.80L292.67 159.44L327.81 159.44 M392.29 170.96Q384.61 170.96 378.04 168.42Q371.46 165.87 366.61 161.22Q361.77 156.56 359.08 150.22Q356.39 143.89 356.39 136.40Q356.39 128.91 359.08 122.58Q361.77 116.24 366.61 111.58Q371.46 106.93 378.04 104.38Q384.61 101.84 392.39 101.84Q400.65 101.84 407.46 104.72Q414.28 107.60 418.98 113.07L410.92 120.66Q403.62 112.78 392.97 112.78Q385.96 112.78 380.53 115.81Q375.11 118.83 372.04 124.16Q368.97 129.49 368.97 136.40Q368.97 143.31 372.04 148.64Q375.11 153.97 380.53 156.99Q385.96 160.02 392.97 160.02Q403.72 160.02 410.92 152.05L418.98 159.73Q414.28 165.20 407.46 168.08Q400.65 170.96 392.29 170.96 M470.38 170L459.05 170L459.05 163.86Q454.44 170.67 442.92 170.67Q434.09 170.67 428.95 166.35Q423.82 162.03 423.82 155.31Q423.82 150.99 425.88 147.54Q427.95 144.08 432.65 142.06Q437.35 140.05 445.13 140.05L458.38 140.05L458.38 139.28Q458.38 134 455.21 131.07Q452.04 128.14 445.61 128.14Q441.29 128.14 437.11 129.49Q432.94 130.83 430.06 133.23L425.35 124.50Q429.48 121.33 435.19 119.74Q440.91 118.16 447.05 118.16Q458.19 118.16 464.28 123.49Q470.38 128.82 470.38 139.95L470.38 170M458.38 153.97L458.38 148.02L445.99 148.02Q439.85 148.02 437.74 150.03Q435.63 152.05 435.63 154.83Q435.63 158.10 438.22 160.02Q440.81 161.94 445.42 161.94Q449.83 161.94 453.34 159.92Q456.84 157.90 458.38 153.97 M496.24 170L484.24 170L484.24 98.77L496.24 98.77 M534 170.67Q525.94 170.67 519.65 167.26Q513.36 163.86 509.81 157.95Q506.26 152.05 506.26 144.37Q506.26 136.69 509.81 130.78Q513.36 124.88 519.65 121.52Q525.94 118.16 534 118.16Q541.49 118.16 547.20 121.18Q552.91 124.21 555.89 130.06L546.67 135.44Q544.37 131.79 541.06 130.06Q537.75 128.34 533.91 128.34Q527.28 128.34 522.82 132.66Q518.35 136.98 518.35 144.37Q518.35 151.86 522.82 156.13Q527.28 160.40 533.91 160.40Q537.75 160.40 541.06 158.67Q544.37 156.94 546.67 153.30L555.89 158.67Q552.91 164.43 547.20 167.55Q541.49 170.67 534 170.67 M586.45 170.67Q576.66 170.67 570.52 165.15Q564.37 159.63 564.37 148.02L564.37 118.74L576.37 118.74L576.37 146.38Q576.37 153.39 579.54 156.75Q582.71 160.11 588.37 160.11Q594.71 160.11 598.55 156.22Q602.39 152.34 602.39 144.66L602.39 118.74L614.39 118.74L614.39 170L602.97 170L602.97 163.47Q600.09 166.93 595.77 168.80Q591.45 170.67 586.45 170.67 M640.63 170L628.63 170L628.63 98.77L640.63 98.77 M697.79 170L686.46 170L686.46 163.86Q681.85 170.67 670.33 170.67Q661.50 170.67 656.37 166.35Q651.23 162.03 651.23 155.31Q651.23 150.99 653.29 147.54Q655.36 144.08 660.06 142.06Q664.77 140.05 672.54 140.05L685.79 140.05L685.79 139.28Q685.79 134 682.62 131.07Q679.45 128.14 673.02 128.14Q668.70 128.14 664.53 129.49Q660.35 130.83 657.47 133.23L652.77 124.50Q656.89 121.33 662.61 119.74Q668.32 118.16 674.46 118.16Q685.60 118.16 691.69 123.49Q697.79 128.82 697.79 139.95L697.79 170M685.79 153.97L685.79 148.02L673.41 148.02Q667.26 148.02 665.15 150.03Q663.04 152.05 663.04 154.83Q663.04 158.10 665.63 160.02Q668.22 161.94 672.83 161.94Q677.25 161.94 680.75 159.92Q684.25 157.90 685.79 153.97 M730.95 170.67Q722.50 170.67 717.89 166.30Q713.28 161.94 713.28 153.39L713.28 128.34L704.83 128.34L704.83 118.74L713.28 118.74L713.28 107.41L725.28 107.41L725.28 118.74L739.01 118.74L739.01 128.34L725.28 128.34L725.28 153.10Q725.28 156.85 727.11 158.82Q728.93 160.78 732.39 160.78Q736.32 160.78 739.11 158.67L742.47 167.22Q740.26 168.94 737.23 169.81Q734.21 170.67 730.95 170.67 M773.89 170.67Q766.02 170.67 759.88 167.26Q753.73 163.86 750.18 157.95Q746.63 152.05 746.63 144.37Q746.63 136.69 750.18 130.78Q753.73 124.88 759.88 121.52Q766.02 118.16 773.89 118.16Q781.86 118.16 788.05 121.52Q794.25 124.88 797.75 130.78Q801.25 136.69 801.25 144.37Q801.25 152.05 797.75 157.95Q794.25 163.86 788.05 167.26Q781.86 170.67 773.89 170.67M773.89 160.40Q780.52 160.40 784.84 156.08Q789.16 151.76 789.16 144.37Q789.16 136.98 784.84 132.66Q780.52 128.34 773.89 128.34Q769.57 128.34 766.17 130.30Q762.76 132.27 760.74 135.87Q758.73 139.47 758.73 144.37Q758.73 149.26 760.74 152.86Q762.76 156.46 766.17 158.43Q769.57 160.40 773.89 160.40 M823.27 170L811.27 170L811.27 118.74L822.70 118.74L822.70 126.22Q827.98 118.16 840.94 118.16L840.94 129.58Q840.17 129.49 839.50 129.39Q838.83 129.30 838.15 129.30Q831.34 129.30 827.31 133.28Q823.27 137.26 823.27 145.14';

/**
 * The wordmark <Svg> — width is the only sizing input; height is computed
 * from the viewBox aspect ratio to keep the wordmark proportional.
 *
 * viewBox `0 0 1000 210` crops the master SVG to the primary mark + gold
 * rule region only (master SVG is `0 0 1000 360`, including the tagline
 * region). Aspect ratio 1000:210 ≈ 4.76:1 — at the default width of 180pt
 * this yields ~37.8pt height, which sits comfortably alongside the
 * Montserrat-SemiBold 16pt report title at the same band height.
 */
function PdfWordmark({ width = 180 }: { width?: number }) {
  const height = (width * 210) / 1000;
  return (
    <Svg width={width} height={height} viewBox="0 0 1000 210">
      <Path d={WORDMARK_PRIMARY_PATH_D} fill={colors['brand-navy']} />
      <Line
        x1={380}
        y1={205}
        x2={620}
        y2={205}
        stroke={colors['brand-gold']}
        strokeWidth={4}
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Timestamp formatting
// ---------------------------------------------------------------------------

/**
 * Format an ISO 8601 timestamp into the human-readable form rendered on the
 * letterhead. Always renders in `Australia/Sydney` (the business-facing
 * timezone for an Australian payroll product) so reports are reproducible
 * regardless of the machine that runs the route handler.
 *
 * Output format: `"31 May 2026, 3:42 pm AEST"` — long-month + 12-hour with
 * lowercase am/pm + the IANA short-name suffix. Built via Intl.DateTimeFormat
 * pieces (not a single `format()` call) so we can hand-stitch the comma
 * separator (`'en-AU'` defaults to `"31 May 2026 at 3:42 pm AEST"` — replace
 * the literal " at " with a comma).
 *
 * Throws `RangeError` if the input is not a parseable ISO 8601 string; the
 * caller (route handler) should validate input before construction.
 */
export function formatGeneratedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(
      `[Letterhead] generatedAtIso is not a parseable ISO 8601 timestamp: ${iso}`,
    );
  }
  // Intl.DateTimeFormat with 'en-AU' produces "31 May 2026 at 3:42 pm AEST".
  // We replace " at " with ", " to match the dispatch's preferred format.
  const formatted = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(date);
  return formatted.replace(' at ', ', ');
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/**
 * StyleSheet for the Letterhead. Values are PDF points (1pt = 1/72 inch).
 *
 * Sizing rationale:
 *   - wordmark width 180pt — tested against the spike layout; reads well at
 *     A4 margins (32pt horizontal padding leaves 531pt content width).
 *   - report title 16pt (h3-max in design-tokens) — Montserrat SemiBold.
 *     Title roles in the design system scale higher (22–72pt) but those are
 *     poster-grade; 16pt is the right step for a single line in a band.
 *   - timestamp + org name 10pt (caption / body-min) — Source Sans 3 Regular.
 *   - tagline 9pt — slightly smaller than caption (matches `Lockup.tsx`
 *     `text-body-min tracking-wide` web rendering at ~10pt with kerning).
 *   - bottom border 2pt navy — anchors letterhead from body content.
 *
 * Source Sans 3 + Montserrat are the registered families from `fonts.ts`.
 */
const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors['brand-navy'],
    marginBottom: 16,
  },
  left: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  tagline: {
    fontFamily: 'Source Sans 3',
    fontSize: 9,
    fontWeight: 400,
    color: colors['brand-charcoal'],
    marginTop: 4,
    letterSpacing: 0.4,
  },
  right: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    // Tight max-width so long titles wrap to the right column rather than
    // pushing into the wordmark area. A4 content width is 531pt; we cap the
    // right column at ~280pt to preserve at least 180pt for the wordmark
    // and a 70pt visual gap between columns.
    maxWidth: 280,
  },
  reportTitle: {
    fontFamily: 'Montserrat',
    fontSize: 16,
    fontWeight: 600,
    color: colors['brand-navy'],
    textAlign: 'right',
  },
  timestamp: {
    fontFamily: 'Source Sans 3',
    fontSize: 10,
    fontWeight: 400,
    color: colors['brand-grey'],
    marginTop: 6,
    textAlign: 'right',
  },
  forLine: {
    fontFamily: 'Source Sans 3',
    fontSize: 10,
    fontWeight: 400,
    color: colors['brand-charcoal'],
    marginTop: 2,
    textAlign: 'right',
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Letterhead — sub-brand wordmark + APA lockup + report title + timestamp +
 * optional organisation name. Renders ONCE on page 1 of every report.
 *
 * Composition is page-context-agnostic — the parent template (E6.6 / E5.5 /
 * E5.6) is responsible for placing Letterhead inside a `<Page>` such that
 * it appears on page 1 only (e.g. as the first child of `<Page>`, not as a
 * `fixed` element).
 */
export function Letterhead({
  reportTitle,
  generatedAtIso,
  organisationName,
}: ReportLetterheadContext) {
  const generatedAt = formatGeneratedAt(generatedAtIso);

  return (
    <View style={styles.band}>
      <View style={styles.left}>
        <PdfWordmark width={180} />
        {/* Tagline is live text (not baked into wordmark) so PDF text
            extraction + screen readers surface it correctly. Mirrors the
            web Lockup component's accessibility contract. Spec §5.1 + §5.4
            require this exact phrasing. */}
        <Text style={styles.tagline}>by Australian Payroll Association</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.reportTitle}>{reportTitle}</Text>
        <Text style={styles.timestamp}>Generated {generatedAt}</Text>
        {organisationName !== undefined && organisationName.length > 0 && (
          <Text style={styles.forLine}>for: {organisationName}</Text>
        )}
      </View>
    </View>
  );
}
