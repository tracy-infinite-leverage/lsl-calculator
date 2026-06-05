/**
 * PageNumber.tsx — "Page X of Y" pagination footer element for PDF reports.
 *
 * E6.5 Task 5.4 (spec §5.4 + §8.5). Renders the pagination counter that
 * appears on every page of every report alongside the MethodologyFooter.
 *
 * ----------------------------------------------------------------------------
 * Why a wrapped `<Text fixed render={...}/>` instead of a re-usable component
 * with a `pageNumber` prop
 * ----------------------------------------------------------------------------
 *
 * `@react-pdf/renderer` exposes per-page dynamic content through the `render`
 * callback prop on `<Text>` (and `<View>`). The callback receives
 * `{ pageNumber, totalPages, subPageNumber, subPageTotalPages }` from the
 * layout pass and returns the per-page string. Crucially, this is the ONLY
 * way to read the current page number from react-pdf — it is NOT exposed as
 * React context, hook, or prop on rendered children.
 *
 * Task 5.1 spike finding #4 codified this pattern: per-page content variants
 * inside a single `<Page>` MUST go through `render={...}`. Anything else
 * (splitting into multiple `<Page>` blocks, threading page numbers through
 * props, etc.) either breaks under content overflow or re-introduces the
 * footer-duplication risk the spike documented.
 *
 * The `<PageNumber />` component wraps that pattern as a single named import
 * so calling sites do not need to know the render-prop shape:
 *
 *   <View fixed style={...}>
 *     <PageNumber />
 *   </View>
 *
 * ----------------------------------------------------------------------------
 * Why `fixed` is owned by the PARENT
 * ----------------------------------------------------------------------------
 *
 * Page numbers belong inside a fixed footer band — but the band itself
 * carries other content (the methodology footer copy). The `A4Page` primitive
 * owns the band and applies `fixed` once at the band level. If `PageNumber`
 * applied `fixed` to itself as well, react-pdf would treat it as a separate
 * absolutely-positioned overlay and the alignment with the methodology footer
 * would drift across pages. The component therefore renders an inline `<Text>`
 * with the `render` prop only — positioning is the caller's responsibility.
 *
 * ----------------------------------------------------------------------------
 * Typography
 * ----------------------------------------------------------------------------
 *
 *   - fontSize 8pt — matches `MethodologyFooter` so the pagination counter
 *     sits visually flush with the methodology copy on the same band.
 *   - Source Sans 3 Regular — same family the footer uses.
 *   - colors['brand-grey'] — same low-contrast grey; signals "metadata".
 *
 * No `fontFeatureSettings: 'tnum'` (tabular numerals): the page-number string
 * is short enough that proportional figures are fine and react-pdf's font
 * embedding does not currently expose OpenType feature toggles.
 */

import { StyleSheet, Text } from '@react-pdf/renderer';
import * as React from 'react';
import { colors } from '../design-tokens';
import { registerPdfFonts } from './fonts';

// Register the PDF font families on module load. Idempotent — see fonts.ts.
registerPdfFonts();

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  pageNumber: {
    fontFamily: 'Source Sans 3',
    fontSize: 8,
    fontWeight: 400,
    color: colors['brand-grey'],
    lineHeight: 1.3,
  },
});

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Optional formatter so report templates can localise / re-style the counter
 * without copy-pasting the render-prop pattern. The default formatter is
 * `Page X of Y`. Templates that want a different style (e.g. `X / Y`, or a
 * localised variant for a future i18n pass) pass a `format` callback.
 *
 * The component does NOT support arbitrary children — the render-prop is the
 * only valid content source.
 */
export interface PageNumberProps {
  /**
   * Optional formatter. Defaults to `(pageNumber, totalPages) => 'Page X of Y'`.
   *
   * Why exposed: keeps the component a single-purpose primitive while
   * allowing templates that want different phrasing (the A5 / letter-size
   * variants reserved for future epics) to override without touching this
   * file.
   */
  format?: (pageNumber: number, totalPages: number) => string;
}

// ---------------------------------------------------------------------------
// Default formatter
// ---------------------------------------------------------------------------

/**
 * Default `Page X of Y` formatter. Exported so the snapshot test (and any
 * downstream template that wants to reuse the same phrasing without
 * re-importing `PageNumber`) can call it directly.
 */
export const defaultPageNumberFormat = (
  pageNumber: number,
  totalPages: number,
): string => `Page ${pageNumber} of ${totalPages}`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<PageNumber />` — wraps the react-pdf `<Text render={({ pageNumber,
 * totalPages }) => ...}/>` pattern into a single reusable primitive.
 *
 * Usage (inside an `A4Page`-style fixed footer band):
 *
 *   <View fixed style={footerBandStyles}>
 *     <MethodologyFooter variant="full" ... />
 *     <PageNumber />
 *   </View>
 *
 * The component does NOT carry `fixed` — the parent band owns positioning.
 * See header comment for the rationale.
 */
export function PageNumber({
  format = defaultPageNumberFormat,
}: PageNumberProps = {}) {
  return (
    <Text
      style={styles.pageNumber}
      render={({ pageNumber, totalPages }) => format(pageNumber, totalPages)}
    />
  );
}
