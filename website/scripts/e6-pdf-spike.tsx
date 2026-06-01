/**
 * e6-pdf-spike.tsx — Phase 4 Task 5.1 react-pdf feasibility spike
 *
 * THROWAWAY VALIDATION HARNESS. Do not import from application code.
 *
 * Purpose (per .specify/features/006-ui-design-system/impl-plan.md §PD-1 and
 * dev-findings.md PD-1): prove that `@react-pdf/renderer@^4.5.1` can cleanly
 * render the load-bearing E6.5 paths before Tasks 5.2–5.7 commit to building
 * production components on top of it:
 *
 *   1. A4 page dimensions (210 × 297 mm — Page size="A4").
 *   2. Multi-page layout with Letterhead on page 1 only.
 *   3. Full methodology footer on page 1; short version on pages 2–5 (OQ-10).
 *   4. Page X of Y on every page (react-pdf <Text render={...}/> pattern).
 *   5. Font embedding — see findings #1–#3 below. The woff2 files in
 *      public/fonts/ are pre-subset (~15-18 KB) and crash fontkit's
 *      TTFSubset path. The spike uses Helvetica + Helvetica-Bold (built-in
 *      Standard 14 PDF fonts) to prove the rest of the pipeline works and
 *      records the operational requirement that Task 5.2 must ship
 *      unsubset TTF/OTF source files for the PDF pipeline.
 *   6. **Citation block rich-text** — the documented Phase 4 risk per
 *      dev-findings PD-1. Renders cleanly via nested <Text> components for
 *      inline styling + <View borderLeftWidth=...> for the bordered-rule
 *      pattern. See finding #2: italic font-style must drop to a weight
 *      or layout treatment because no italic woff2 ships.
 *
 * Run:
 *   cd website && npm run spike:pdf   # → /tmp/e6-pdf-spike.pdf
 *   # or
 *   cd website && npx tsx scripts/e6-pdf-spike.tsx [output-path]
 *
 * Output:
 *   /tmp/e6-pdf-spike.pdf — 5-page A4 test report. Inspect manually + via
 *   metadata grep for page count + page dimensions.
 *
 * The spike intentionally does NOT import from website/src/ — verifying the
 * primitive surface in isolation before promoting any patterns into the
 * production tree (that work belongs to Task 5.2).
 */

import {
  Document,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToFile,
} from '@react-pdf/renderer';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';

// ---------------------------------------------------------------------------
// 1. Font registration — woff2 from website/public/fonts/, file:// URL
//    Per spec v0.5 substitution, family name is 'Source Sans 3' (NOT
//    'Source Sans Pro'). Validation: registerFontWithCheck logs the path
//    and asserts existence before handing off to Font.register.
// ---------------------------------------------------------------------------

const FONT_DIR = resolve(__dirname, '..', 'public', 'fonts');

// Spike finding #3 (HOW-TO for production):
// In Node, pass react-pdf an absolute filesystem path — NOT a file:// URL.
// react-pdf's FontSource._load() routes file://... through fetch(), which
// Node's undici rejects with "not implemented... yet...". The bare path
// hits the fontkit.open() branch, which reads the file directly.
// Browser-context registration (e.g. client component) uses a relative URL
// like '/fonts/source-sans-3-regular.woff2'. The serverless edge function
// in Task 5.4 will need the absolute filesystem path resolved against the
// Next.js .next/server bundle.
function fontFilePath(name: string): string {
  const abs = resolve(FONT_DIR, name);
  if (!existsSync(abs)) {
    throw new Error(`[spike] font file not found: ${abs}`);
  }
  return abs;
}

// Spike finding #1 (CRITICAL — see HANDOFF.md): the woff2 files in
// website/public/fonts/ are PRE-SUBSET latin-only files (~15-18 KB each
// vs the canonical ~80-95 KB unsubset originals). They serve the browser
// perfectly via Next.js localFont, but fontkit cannot RE-subset them
// for PDF embedding and crashes in TTFSubset._addGlyph with
// "Offset is outside the bounds of the DataView". Production E6.5
// requires the unsubset TTF/OTF source files alongside the woff2 web
// assets (decision recorded in handoff §findings + recommended Task 5.2
// pre-work). The spike below uses Helvetica + Helvetica-Bold (react-pdf
// "Standard 14" PDF built-ins) to prove the rest of the pipeline works.
const _fontProbe = {
  montserratSemibold: fontFilePath('montserrat-semibold.woff2'),
  sourceSans3Regular: fontFilePath('source-sans-3-regular.woff2'),
  sourceSans3Semibold: fontFilePath('source-sans-3-semibold.woff2'),
};
void _fontProbe; // existence-checked only — see finding #1

// Standard PDF fonts (Helvetica / Times / Courier) are built into the PDF
// spec and require no font registration. react-pdf treats them as
// STANDARD_FONTS in font/lib/index.js:246.
// PRODUCTION INTENT for Task 5.2:
//   Font.register({ family: 'Montserrat', fonts: [
//     { src: pathTo('Montserrat-SemiBold.ttf'), fontWeight: 600 }] });
//   Font.register({ family: 'Source Sans 3', fonts: [
//     { src: pathTo('SourceSans3-Regular.ttf'), fontWeight: 400 },
//     { src: pathTo('SourceSans3-SemiBold.ttf'), fontWeight: 600 }] });
//   …using TTF (not woff2) so fontkit can subset cleanly.

// ---------------------------------------------------------------------------
// 2. Design tokens (subset for the spike — production templates consume from
//    src/lib/design-tokens.ts; this duplication is intentional to keep the
//    spike standalone + provable in isolation).
// ---------------------------------------------------------------------------

const colors = {
  navy: '#48608a',
  gold: '#d9a428',
  charcoal: '#333232',
  grey: '#808897',
  lightBlue: '#a0aec1',
  white: '#ffffff',
} as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 60, // leave room for footer
    paddingHorizontal: 32,
    fontFamily: 'Helvetica',
    fontSize: 11, // body-max ≈ 12pt; 11 for spike density
    color: colors.charcoal,
  },
  // Letterhead block (page 1 only)
  letterheadBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
    marginBottom: 16,
  },
  letterheadLeft: { flexDirection: 'column' },
  letterheadTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18,
    color: colors.navy,
  },
  letterheadSubtitle: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: colors.navy,
    marginTop: 2,
  },
  letterheadRight: { flexDirection: 'column', alignItems: 'flex-end' },
  letterheadReportTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    color: colors.navy,
  },
  letterheadTimestamp: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: colors.grey,
    marginTop: 2,
  },
  // Body
  h2: {
    fontFamily: 'Helvetica',
    fontWeight: 400,
    fontSize: 15,
    color: colors.navy,
    marginTop: 12,
    marginBottom: 6,
  },
  bodyParagraph: { marginBottom: 8, lineHeight: 1.45 },
  // Citation block — the load-bearing rich-text path
  citationList: { marginTop: 8 },
  citationItem: {
    flexDirection: 'row',
    borderLeftWidth: 2,
    borderLeftColor: colors.navy,
    paddingLeft: 8,
    marginBottom: 6,
  },
  citationIconCell: { width: 12, marginRight: 4 },
  citationBody: { flex: 1 },
  citationSection: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: colors.charcoal,
  },
  citationRule: {
    fontFamily: 'Helvetica', // intentionally NOT a monospace family in spike — see findings
    fontSize: 9,
    color: colors.grey,
  },
  // Spike finding #2: react-pdf font resolution is strict — no font-style
  // synthesis. We do not ship an italic woff2 in public/fonts/, so the
  // citation note uses light-weight + leading-margin treatment instead of
  // italic. Production CitationBlock (Task 5.3) makes the same call.
  citationNote: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: colors.grey,
    marginTop: 2,
  },
  // Footer — full (page 1) + short (pages 2+)
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 32,
    right: 32,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: colors.lightBlue,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    fontSize: 8,
    color: colors.grey,
  },
  footerLeft: { flex: 1, paddingRight: 12 },
  footerLine: { marginBottom: 1 },
  footerPageNumber: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: colors.grey,
  },
});

// ---------------------------------------------------------------------------
// 3. Wordmark SVG — paths inlined from docs/brand/final/wordmark/
//    wordmark-master.svg. Using a SHORT subset (the "LSL" portion only) for
//    the spike — full wordmark is ~10kB of path data; the spike just needs
//    to prove <Svg> + <Path> renders in react-pdf without an external dep.
// ---------------------------------------------------------------------------

function SpikeWordmark() {
  // Tiny placeholder svg — three navy bars stacked, gold rule beneath.
  // Production Letterhead (Task 5.2) inlines the real wordmark path data
  // from docs/brand/final/wordmark/wordmark-master.svg.
  return (
    <Svg width="90" height="32" viewBox="0 0 90 32">
      {/* Three bars representing LSL */}
      <Path d="M 0 4 L 24 4 L 24 8 L 4 8 L 4 24 L 24 24 L 24 28 L 0 28 Z" fill={colors.navy} />
      <Path d="M 30 4 L 54 4 L 54 8 L 34 8 L 34 14 L 54 14 L 54 28 L 30 28 L 30 24 L 50 24 L 50 18 L 30 18 Z" fill={colors.navy} />
      <Path d="M 60 4 L 84 4 L 84 8 L 64 8 L 64 24 L 84 24 L 84 28 L 60 28 Z" fill={colors.navy} />
      {/* Gold rule */}
      <Path d="M 24 30 L 60 30 L 60 32 L 24 32 Z" fill={colors.gold} />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// 4. Letterhead — page 1 only
// ---------------------------------------------------------------------------

function Letterhead() {
  return (
    <View style={styles.letterheadBlock}>
      <View style={styles.letterheadLeft}>
        <SpikeWordmark />
        <Text style={styles.letterheadSubtitle}>by Australian Payroll Association</Text>
      </View>
      <View style={styles.letterheadRight}>
        <Text style={styles.letterheadReportTitle}>LSL Liability — Spike Test Report</Text>
        <Text style={styles.letterheadTimestamp}>Generated 2026-05-31 14:00 AEST</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 5. Methodology footers — full (page 1) + short (pages 2+) per OQ-10
// ---------------------------------------------------------------------------

/**
 * Single methodology footer fixed across all pages. Uses the parent <Text>'s
 * `render` callback to switch content based on pageNumber. Per react-pdf
 * dynamic-content docs, this is the canonical pattern for per-page content
 * variants in a single Page block.
 *
 * Spike finding #4: a `fixed` <View> child rendered with `render={...}` is
 * the cleanest way to express "full footer on page 1, short on pages 2+"
 * in a single <Page>. We tried splitting into two <Page> blocks first; that
 * approach DOES NOT WORK reliably because page 1's body content can
 * overflow into a second page that inherits page 1's footer — producing
 * "full footer" on page 2 against the OQ-10 contract. Single-page +
 * render-prop is the safe pattern. Recorded for Task 5.2 implementation.
 */
function MethodologyFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text
        style={styles.footerLeft}
        render={({ pageNumber }) =>
          pageNumber === 1
            ? 'Calculation methodology v0.7.2 · State engine v2.4.1 · Data as at 2026-05-31\nCalculated, not advice. Contact: support@austpayroll.com.au · www.austpayroll.com.au'
            : 'State engine v2.4.1 · Calculated, not advice · www.austpayroll.com.au'
        }
      />
      <Text
        style={styles.footerPageNumber}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// 6. Citation block — the load-bearing rich-text path
//    Exercises: bordered-left rule + multi-paragraph item + mixed inline
//    styling (semibold section, "monospaced" rule, italic note). The
//    citation-block.tsx production component uses:
//      <li class="border-l-2 ..."> ← Renderable as <View> with borderLeft.
//      <p class="font-semibold">    ← Renderable as <Text style={fontWeight: 600}>.
//      <p class="font-mono">        ← Tricky — no mono font registered; we
//                                     test the fontFamily fallback path.
//      <p class="italic">           ← Renderable as <Text style={fontStyle: 'italic'}>.
// ---------------------------------------------------------------------------

interface Citation {
  section: string;
  rule: string;
  pdfPage?: number;
  note?: string;
}

const SAMPLE_CITATIONS: Citation[] = [
  {
    section: 'NSW Long Service Leave Act 1955',
    rule: 's.4(1)(a) · accrual rate 2/12',
    pdfPage: 14,
    note: 'Applies to employees completing 10 years continuous service.',
  },
  {
    section: 'VIC Long Service Leave Act 2018',
    rule: 's.6(2) · 13/60 weeks per year of service',
    pdfPage: 22,
    note: 'Continuous service includes unpaid parental leave up to 12 months (s.10).',
  },
  {
    section: 'QLD Industrial Relations Act 2016',
    rule: 's.95 · 8.6667 weeks at 10 years',
    pdfPage: 37,
  },
];

function CitationListItem({ citation }: { citation: Citation }) {
  return (
    <View style={styles.citationItem} wrap={false}>
      <View style={styles.citationIconCell}>
        {/* Tiny book glyph proxy */}
        <Svg width="9" height="9" viewBox="0 0 9 9">
          <Path d="M 1 1 L 8 1 L 8 8 L 1 8 Z M 4.5 1 L 4.5 8" fill="none" stroke={colors.navy} strokeWidth={0.8} />
        </Svg>
      </View>
      <View style={styles.citationBody}>
        <Text style={styles.citationSection}>{citation.section}</Text>
        <Text style={styles.citationRule}>
          {citation.rule}
          {citation.pdfPage !== undefined && (
            <Text> · LSL-training PDF p.{citation.pdfPage}</Text>
          )}
        </Text>
        {citation.note && <Text style={styles.citationNote}>{citation.note}</Text>}
      </View>
    </View>
  );
}

function CitationBlock({ citations }: { citations: Citation[] }) {
  return (
    <View style={styles.citationList}>
      {citations.map((c, i) => (
        <CitationListItem key={i} citation={c} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 7. Body content — long enough to span page 2..5
// ---------------------------------------------------------------------------

const LOREM_PARAGRAPH =
  'This is a spike body paragraph intended to exercise multi-page layout in @react-pdf/renderer. ' +
  'Each paragraph carries enough text to force the layout engine to break across pages, validating ' +
  'that the fixed footer renders on every page and the letterhead does not duplicate. ' +
  'Long-service-leave liability calculations frequently produce 4–6 page reports for organisations ' +
  'with 200+ employees, so the multi-page footer-split behaviour (OQ-10) is the load-bearing ' +
  'pagination concern. The methodology footer carries the full regulatory disclosure on page 1 ' +
  'and a short version on pages 2+ to keep the document readable without sacrificing the ' +
  '"calculated, not advice" disclaimer on every page.';

function BodySection({ heading }: { heading: string }) {
  return (
    <View>
      <Text style={styles.h2}>{heading}</Text>
      <Text style={styles.bodyParagraph}>{LOREM_PARAGRAPH}</Text>
      <Text style={styles.bodyParagraph}>{LOREM_PARAGRAPH}</Text>
      <Text style={styles.bodyParagraph}>{LOREM_PARAGRAPH}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 8. Document composition
//
// Single <Page> block with continuous body content. The footer uses the
// `render` callback to switch between full (page 1) and short (pages 2+)
// variants. The Letterhead is in the document flow (not fixed) and so
// appears at the natural top-of-content position on page 1 only.
//
// "Page X of Y" totals are document-wide and reported by react-pdf via the
// `totalPages` callback argument.
// ---------------------------------------------------------------------------

function SpikeDocument() {
  return (
    <Document title="E6.5 Spike Report" author="LSL Calculator">
      <Page size="A4" style={styles.page}>
        <Letterhead />
        <BodySection heading="1. Executive summary" />
        <Text style={styles.h2}>Legislative citations</Text>
        <CitationBlock citations={SAMPLE_CITATIONS} />
        <BodySection heading="2. Per-state breakdown" />
        <BodySection heading="3. Continuous service notes" />
        <BodySection heading="4. Accrual rates" />
        <BodySection heading="5. Limitations" />
        <Text style={styles.h2}>Trailing citations</Text>
        <CitationBlock citations={SAMPLE_CITATIONS} />
        <MethodologyFooter />
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// 9. Render + validation
// ---------------------------------------------------------------------------

async function main() {
  const outPath = process.argv[2] ?? '/tmp/e6-pdf-spike.pdf';
   
  console.log(`[spike] rendering to ${outPath}…`);
   
  console.log(`[spike] fonts: using react-pdf STANDARD_FONTS (Helvetica/Helvetica-Bold).`);
   
  console.log(`[spike] brand-font probe (existence only — see HANDOFF.md finding #1):`);
   
  console.log(`        Montserrat Semibold  → ${_fontProbe.montserratSemibold}`);
   
  console.log(`        Source Sans 3 Reg    → ${_fontProbe.sourceSans3Regular}`);
   
  console.log(`        Source Sans 3 Semi   → ${_fontProbe.sourceSans3Semibold}`);

  await renderToFile(<SpikeDocument />, outPath);

  const stat = statSync(outPath);
   
  console.log(`[spike] rendered ${(stat.size / 1024).toFixed(1)} KB → ${outPath}`);
   
  console.log(`[spike] done. Inspect with:`);
   
  console.log(`        open ${outPath}`);
   
  console.log(`        # or extract metadata:`);
   
  console.log(`        node -e "const f=require('fs').readFileSync('${outPath}','latin1');`);
   
  console.log(`        console.log('pages='+(f.match(/\\/Type\\s*\\/Page[^s]/g)||[]).length,`);
   
  console.log(`                    'mediaBox='+(f.match(/\\/MediaBox\\s*\\[[^\\]]+\\]/)||[])[0])"`);
}

main().catch((err) => {
  console.error('[spike] FAILED:', err);
  process.exit(1);
});
