/**
 * A4Page.tsx — the A4 page primitive that composes every report template.
 *
 * E6.5 Task 5.4 (spec §5.4 + §8.5, resolves OQ-10). The single `<Page>` that
 * every report family (single-employee, bulk-summary, liability,
 * reconciliation) wraps its body content inside.
 *
 * ----------------------------------------------------------------------------
 * Composition (the load-bearing pattern from Task 5.1 spike finding #4)
 * ----------------------------------------------------------------------------
 *
 *   <Page size="A4">
 *     <Letterhead />   ← in document flow, top of page 1 ONLY (react-pdf
 *                        auto-paginates body content past it; the letterhead
 *                        does NOT repeat on pages 2+ because it is not
 *                        `fixed`). This is the pattern the Task 5.1 spike
 *                        proved end-to-end in spike-output.pdf.
 *     {children}        ← body content, normal flow, may span N pages
 *     ← Footer band — `<View fixed>` containing the MethodologyFooter
 *                     (full variant on page 1, short on pages 2+ — via
 *                     a single `render` callback that toggles on
 *                     `pageNumber === 1`) AND the PageNumber primitive.
 *                     This is the load-bearing render-prop pattern from
 *                     Task 5.1 spike finding #4.
 *   </Page>
 *
 * ----------------------------------------------------------------------------
 * Why a SINGLE `<Page>` block (Task 5.1 spike finding #4 — CRITICAL)
 * ----------------------------------------------------------------------------
 *
 * The spike explicitly tested + rejected splitting into multiple `<Page>`
 * blocks (one for page 1 with full footer, one for pages 2+ with short
 * footer). That approach does NOT work because page 1's body content can
 * overflow into a second auto-paginated page that INHERITS page 1's footer
 * — producing "full footer" on page 2 against the OQ-10 contract.
 *
 * Single `<Page>` + `<View fixed render={...}/>` for the FOOTER is the only
 * pattern that reliably keeps the page-1-vs-pages-2+ footer split aligned
 * with the actual rendered page number, regardless of how the body content
 * overflows.
 *
 * The `render` prop on a `<View fixed>` lets the SAME fixed band emit
 * different children on different pages — react-pdf re-invokes the
 * callback per page during the layout pass.
 *
 * ----------------------------------------------------------------------------
 * Why the LETTERHEAD is in document flow (NOT fixed)
 * ----------------------------------------------------------------------------
 *
 * The Letterhead appears on page 1 only — but we DO NOT use the fixed
 * render-prop pattern for it. Two reasons:
 *
 *   1. Inline-flow placement at the top of the Page is exactly what the
 *      spike (`scripts/e6-pdf-spike.tsx`) used and what `spike-output.pdf`
 *      validated end-to-end. React-pdf's pagination naturally renders the
 *      letterhead at the top of page 1 only and continues body content
 *      onto pages 2+ without it.
 *   2. Empirical testing shows the `<View fixed render={pageNumber === 1
 *      ? <Letterhead/> : null}/>` pattern can drop the letterhead under
 *      heavy multi-page content loads — the Montserrat font subset goes
 *      missing from the embedded PDF, suggesting the render-prop returns
 *      null in cases react-pdf does not fully isolate. Inline-flow has no
 *      such failure mode.
 *
 * The footer split STILL needs the fixed render-prop pattern (different
 * content on different pages, repeating band across all pages) — that's
 * the load-bearing finding #4 contract.
 *
 * ----------------------------------------------------------------------------
 * Margins (A4 = 210 × 297 mm = 595 × 842 pt at 72 dpi)
 * ----------------------------------------------------------------------------
 *
 * The spike validated:
 *   - paddingTop: 24pt    — letterhead is in document flow on page 1
 *                           via a fixed-but-page-1-only render-prop. The
 *                           top padding accommodates the band's height
 *                           (~50pt for wordmark + tagline + report title
 *                           + bottom border) without crowding the page
 *                           edge. On pages 2+ the letterhead is null so
 *                           body content sits closer to the top edge.
 *   - paddingBottom: 60pt — leaves room for the fixed footer band
 *                           (~50pt high in the full variant: 5 lines of
 *                           caption + the disclosure line) + 10pt safe
 *                           area between body content and the footer.
 *   - paddingHorizontal: 32pt — leaves 531pt of content width, which is
 *                           comfortable for body copy at 11pt Source Sans
 *                           and matches the letterhead's content rail.
 *
 * APA Brand Guide reference: the print PDF margin token in the brand
 * docs is "comfortable" — left undefined as numeric pt. The spike's 32pt
 * horizontal aligns with the brand's "generous breathing room" guidance
 * for letter-grade documents without ballooning the content rail.
 *
 * NOTE: paddingTop is intentionally tight (24pt). On pages 2+ this means
 * body content sits 24pt below the top edge — slightly tight but allows
 * the content area to extend higher when the letterhead is not in view.
 * If a future spec amendment wants a "header band" on every page, this
 * is where it would live.
 *
 * ----------------------------------------------------------------------------
 * Footer slot composition (the render-prop dance)
 * ----------------------------------------------------------------------------
 *
 * The footer band is a single `<View fixed>` positioned via absolute
 * coordinates at the bottom of every page. Inside the band:
 *
 *   - The methodology footer is rendered via a `<View render={({ pageNumber
 *     }) => pageNumber === 1 ? <Full/> : <Short/>}/>` callback. This is the
 *     pattern from the spike. Because the parent band already carries
 *     `fixed`, the inner render-prop view does NOT — it just emits per-page
 *     children inside the already-fixed band.
 *   - The page number sits to the right via the `<PageNumber />` primitive,
 *     which also uses a `render` callback internally.
 *
 * The footer band uses `flexDirection: 'row'` with `justifyContent:
 * 'space-between'` and `alignItems: 'flex-end'` so the multi-line
 * methodology block sits at the left and the page-number counter sits
 * at the bottom-right. The page-number "flex-end" baseline alignment
 * keeps the counter on the SAME bottom line as the methodology footer's
 * last line — independent of how many lines the footer carries on a
 * given page (5 on page 1, 3 on pages 2+).
 */

import { Page, StyleSheet, View } from '@react-pdf/renderer';
import * as React from 'react';
import { colors } from '../design-tokens';
import { registerPdfFonts } from './fonts';
import { Letterhead } from './Letterhead';
import { MethodologyFooter } from './MethodologyFooter';
import { PageNumber } from './PageNumber';
import type { ReportContext } from './types';

// Register the PDF font families on module load. Idempotent — see fonts.ts.
registerPdfFonts();

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Props for `<A4Page>`. Accepts the full `ReportContext` (the canonical
 * superset from `types.ts`) so a template only has to construct ONE context
 * object and hand it to the page primitive. The primitive narrows the
 * context internally when forwarding to Letterhead + MethodologyFooter.
 *
 * Why accept the full `ReportContext` rather than the narrow slices: keeps
 * the calling-site ergonomics simple. Every report template builds a
 * single context object; this primitive is the place where the field-level
 * splits happen.
 */
export interface A4PageProps {
  /**
   * Per-report context — letterhead fields + methodology fields + APA
   * contact. See `types.ts` for the full shape.
   */
  context: ReportContext;
  /**
   * Body content of the page. May span multiple A4 pages — react-pdf will
   * auto-paginate when content overflows, and the Letterhead + footer
   * render-prop guards ensure the page-1-only vs every-page semantics
   * hold across the overflow.
   */
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/**
 * A4Page styles. All values in PDF points (1pt = 1/72 inch).
 *
 *   - Page-level padding sets the content "safe area" — top is tight (24pt)
 *     because the letterhead band carries its own marginBottom for breathing
 *     room; bottom is generous (60pt) to reserve space for the fixed footer
 *     band.
 *   - Body font defaults to Source Sans 3 Regular at 11pt — the body-min/max
 *     sweet spot for A4 caption + body density per the APA Brand Guide.
 *     Templates that want a larger body size override on the inner content.
 *   - Footer band sits 18pt above the page bottom, leaving a small margin
 *     between the bottom border of the band and the page edge. Border-top
 *     0.5pt hairline matches the MethodologyFooter's internal styling.
 */
const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 60,
    paddingHorizontal: 32,
    fontFamily: 'Source Sans 3',
    fontSize: 11,
    fontWeight: 400,
    color: colors['brand-charcoal'],
  },
  /**
   * The fixed footer band that anchors at the bottom of every page.
   *
   * Two children laid out as a row:
   *   - left flex column: the MethodologyFooter (full or short)
   *   - right column: the PageNumber counter
   *
   * `alignItems: 'flex-end'` keeps the page-number's baseline on the LAST
   * line of the methodology footer — so "Page 1 of N" sits next to the
   * APA contact line on page 1, and next to the URL line on pages 2+.
   *
   * `position: 'absolute'` + bottom/left/right coordinates rather than
   * relying on the page's `paddingBottom` alone is the canonical react-pdf
   * pattern for fixed-position footer bands. The page padding reserves the
   * space; this absolute positioning places the band inside that space.
   */
  footerBand: {
    position: 'absolute',
    bottom: 18,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  /**
   * Left column inside the footer band — holds the methodology footer.
   * `flex: 1` claims the space the page-number column leaves; the
   * methodology footer's column-flex layout inside this cell renders
   * top-down (calc → state → data → disclosure → APA).
   */
  footerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  /**
   * Right column inside the footer band — holds the PageNumber primitive.
   * No flex; the column shrinks to fit the "Page X of Y" string and the
   * bottom-baseline alignment keeps it flush with the methodology footer's
   * last line.
   */
  footerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<A4Page>` — A4 page primitive composed of:
 *   - Page-1-only Letterhead (render-prop guard on `pageNumber === 1`)
 *   - Body content (the `children` prop) in normal flow, auto-paginated
 *   - Every-page fixed footer band containing:
 *       - MethodologyFooter (full variant on page 1, short on pages 2+)
 *       - PageNumber counter ("Page X of Y" on every page)
 *
 * Renders inside a SINGLE `<Page size="A4">` — see header comment for
 * the spike finding that rules out multi-`<Page>` approaches.
 *
 * Usage:
 *
 *   <Document>
 *     <A4Page context={ctx}>
 *       <Text style={...}>Executive summary…</Text>
 *       <Text style={...}>Per-state breakdown…</Text>
 *       ...
 *     </A4Page>
 *   </Document>
 */
export function A4Page({ context, children }: A4PageProps) {
  const {
    reportTitle,
    generatedAtIso,
    organisationName,
    calcMethodologyVersion,
    stateEngineVersion,
    dataAsAtIso,
    apaContact,
  } = context;

  return (
    <Page size="A4" style={styles.page}>
      {/*
        Letterhead — rendered inline as the first child of the page so it
        sits in document flow at the top of page 1 only. React-pdf does
        NOT repeat it on pages 2+ because the component is not `fixed`.

        Spike pattern: this is exactly what `scripts/e6-pdf-spike.tsx`
        used and what `spike-output.pdf` validated. See the header
        comment "Why the LETTERHEAD is in document flow" for the
        rationale on NOT using the fixed render-prop here.
      */}
      <Letterhead
        reportTitle={reportTitle}
        generatedAtIso={generatedAtIso}
        organisationName={organisationName}
      />

      {/* Body content — normal flow, auto-paginated by react-pdf */}
      {children}

      {/*
        Footer band — fixed at the bottom of every page. Two cells:
          - Left: MethodologyFooter, full on page 1 / short on pages 2+
          - Right: PageNumber

        The OUTER `<View fixed>` owns the every-page repeat behaviour and
        the absolute positioning. The INNER methodology-footer cell uses
        a `render` callback (no `fixed` of its own — it's already inside
        a fixed band) to toggle the variant by pageNumber.
      */}
      <View fixed style={styles.footerBand}>
        <View style={styles.footerLeft}>
          <View
            render={({ pageNumber }) => (
              <MethodologyFooter
                calcMethodologyVersion={calcMethodologyVersion}
                stateEngineVersion={stateEngineVersion}
                dataAsAtIso={dataAsAtIso}
                apaContact={apaContact}
                variant={pageNumber === 1 ? 'full' : 'short'}
              />
            )}
          />
        </View>
        <View style={styles.footerRight}>
          <PageNumber />
        </View>
      </View>
    </Page>
  );
}
