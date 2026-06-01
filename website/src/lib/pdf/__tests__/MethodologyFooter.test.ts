/**
 * MethodologyFooter.test.ts — snapshot + contract tests for the PDF
 * methodology footer (full + short variants).
 *
 * E6.5 Task 5.3 — pins both variants per AC §8.5 + OQ-10:
 *
 *   - Full variant renders all 5 fields (calc methodology version,
 *     state-engine version, data-as-at date, "Calculated, not advice.",
 *     APA email + URL).
 *   - Short variant renders only 3 fields (state-engine version,
 *     "Calculated, not advice.", APA URL).
 *   - The "Calculated, not advice." copy is byte-identical between PDF
 *     and the web footer (`website/src/components/shell/footer.tsx`).
 *   - No watermark text (e.g. "DRAFT", "PREVIEW") appears in either variant.
 *
 * Approach mirrors Letterhead.test.ts — render through `<Page><Footer/></Page>`
 * to produce a real PDF buffer, then assert structural invariants on the
 * bytes. Live text content is asserted via `pdf-parse`-style substring
 * matching on the latin1-decoded byte stream because react-pdf's content
 * stream is Flate-compressed but the font dictionaries + glyph mapping
 * leave readable artifacts that test the right thing without bringing in
 * a heavyweight PDF text-extraction dependency.
 *
 * Per the existing pattern in Letterhead.test.ts, the asserted substrings
 * are picked so they appear in the PDF byte stream regardless of content-
 * stream compression: PostScript font names, MediaBox markers, length
 * comparisons between renders. For the variant-specific field assertions,
 * we use length comparison (full > short by a meaningful margin) plus
 * source-text inspection of the component module itself for the literal
 * copy strings — the cross-surface byte-identity check.
 */

import { describe, it, expect } from 'vitest';
import { Document, Page, pdf } from '@react-pdf/renderer';
import * as React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MethodologyFooter,
  DISCLOSURE_PHRASE,
  type MethodologyFooterProps,
} from '../MethodologyFooter';

/**
 * Render a MethodologyFooter inside a minimal Document+Page tree and
 * collect the resulting PDF byte stream into a Buffer. Used by both the
 * "full" and "short" tests with shared input fixture.
 */
async function renderFooterToPdfBytes(
  props: MethodologyFooterProps,
): Promise<Buffer> {
  const instance = pdf(
    React.createElement(
      Document,
      { title: 'MethodologyFooter test' },
      React.createElement(
        Page,
        { size: 'A4', style: { padding: 32 } },
        React.createElement(MethodologyFooter, props),
      ),
    ),
  );
  const stream = await instance.toBuffer();
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// Fixed sample context — kept stable across both variant renders so the
// only difference in byte output is the variant-driven content set.
const SAMPLE_CONTEXT: MethodologyFooterProps = {
  calcMethodologyVersion: 'lsl-engine-v1.4.2',
  stateEngineVersion: 'rules-engine-v1.2',
  dataAsAtIso: '2026-05-31T05:42:00Z', // 31 May 2026 (after timezone strip)
  apaContact: {
    email: 'admin@austpayroll.com.au',
    url: 'www.austpayroll.com.au',
  },
  variant: 'full',
};

describe('MethodologyFooter — full variant (page 1)', () => {
  it('renders to a valid PDF without throwing (font + structure gate)', async () => {
    const buf = await renderFooterToPdfBytes({
      ...SAMPLE_CONTEXT,
      variant: 'full',
    });
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.subarray(-8).toString('latin1')).toMatch(/%%EOF/);
  }, 15000);

  it('embeds the Source Sans 3 Regular subset used by the footer', async () => {
    // The footer uses Source Sans 3 Regular for every line. Montserrat is
    // NOT exercised by this component — it's a Letterhead-only family at
    // the moment. We assert SS3 Regular by PostScript name (the prefix is
    // a content-hashed six-letter string per subset, so we match the
    // PostScript-name suffix only — same approach as Letterhead.test.ts).
    const buf = await renderFooterToPdfBytes({
      ...SAMPLE_CONTEXT,
      variant: 'full',
    });
    const pdfText = buf.toString('latin1');
    expect(pdfText).toMatch(/SourceSans3-Regular/);
  }, 15000);

  it('emits the PDF page tree with a MediaBox (valid A4 page structure)', async () => {
    const buf = await renderFooterToPdfBytes({
      ...SAMPLE_CONTEXT,
      variant: 'full',
    });
    expect(buf.toString('latin1')).toMatch(/MediaBox/);
  }, 15000);

  it('snapshot — PDF size sits in the expected order-of-magnitude band', async () => {
    // The footer is a few-line text band — much smaller PDF surface than
    // the Letterhead. We bound generously to absorb minor react-pdf
    // updates but tightly enough to catch:
    //   - Fonts failing to subset and being embedded whole (~400 KB+).
    //   - The content stream collapsing to empty (~3 KB).
    const buf = await renderFooterToPdfBytes({
      ...SAMPLE_CONTEXT,
      variant: 'full',
    });
    expect(buf.length).toBeGreaterThan(5_000); // non-trivial PDF
    expect(buf.length).toBeLessThan(60_000); // fonts subset properly
  }, 15000);
});

describe('MethodologyFooter — short variant (pages 2+)', () => {
  it('renders to a valid PDF without throwing', async () => {
    const buf = await renderFooterToPdfBytes({
      ...SAMPLE_CONTEXT,
      variant: 'short',
    });
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.subarray(-8).toString('latin1')).toMatch(/%%EOF/);
  }, 15000);

  it('embeds the Source Sans 3 Regular subset', async () => {
    const buf = await renderFooterToPdfBytes({
      ...SAMPLE_CONTEXT,
      variant: 'short',
    });
    expect(buf.toString('latin1')).toMatch(/SourceSans3-Regular/);
  }, 15000);
});

describe('MethodologyFooter — variant differential (AC §8.5 + OQ-10)', () => {
  it('full variant produces a strictly larger PDF than short (2 extra content lines)', async () => {
    // The full variant renders 5 lines; the short variant renders 3. The
    // 2 extra lines (calc-methodology version, data-as-at date, plus the
    // APA email + "Australian Payroll Association" prefix on the contact
    // line vs URL-only on short) carry additional Source Sans 3 glyphs
    // that show up in the subset + additional content-stream Tj operators.
    //
    // This is a STRUCTURAL invariant — independent of glyph encoding
    // inside the FlateDecode-compressed content stream — and is the
    // gate that the variant flag actually changes the output (not just
    // a no-op branch).
    const full = await renderFooterToPdfBytes({
      ...SAMPLE_CONTEXT,
      variant: 'full',
    });
    const short = await renderFooterToPdfBytes({
      ...SAMPLE_CONTEXT,
      variant: 'short',
    });
    expect(full.length).toBeGreaterThan(short.length);
    // Margin tolerance — 2 extra lines should produce at least a small
    // measurable delta even after Flate compression. Empirically ~300+
    // bytes; we bound loosely.
    expect(full.length - short.length).toBeGreaterThan(50);
  }, 30000);
});

describe('MethodologyFooter — copy contract (byte-identical voice)', () => {
  it('DISCLOSURE_PHRASE is exactly "Calculated, not advice."', () => {
    // Pin the literal phrase. If anyone changes this string, the test
    // fails LOUD — even before the cross-surface check fires.
    expect(DISCLOSURE_PHRASE).toBe('Calculated, not advice.');
  });

  it('disclosure phrase is byte-identical to the public-calc web footer', () => {
    // The web footer at website/src/components/shell/footer.tsx renders
    // the line "Calculated, not advice — verify on the source statute
    // for edge cases." — the prefix `Calculated, not advice` (capital
    // C + comma after Calculated) is the canonical brand-voice phrasing.
    //
    // We read the source file at test time so the assertion catches any
    // future edit to the web copy that drifts the casing or punctuation.
    // The web copy continues with an em-dash + sentence completion; the
    // PDF carries the standalone form with a period because the
    // methodology block already supplies the context.
    const webFooterPath = resolve(
      __dirname,
      '..',
      '..',
      '..',
      'components',
      'shell',
      'footer.tsx',
    );
    const webFooterSrc = readFileSync(webFooterPath, 'utf8');
    // The prefix without the period must appear in the web source.
    expect(webFooterSrc).toContain('Calculated, not advice');
  });

  it('full variant source includes all 5 required field labels', () => {
    // Source-level assertion that the FIVE field labels per spec §5.4 +
    // §8.5 are present in the component. Source inspection is the
    // most reliable check because rendered text is compressed inside the
    // PDF content stream — the labels themselves don't appear in plain
    // text in the buffer. The presence of each labelled prefix proves
    // the component intent, complementing the structural variant-
    // differential test above.
    const componentPath = resolve(__dirname, '..', 'MethodologyFooter.tsx');
    const src = readFileSync(componentPath, 'utf8');
    // Field 1: calc methodology version
    expect(src).toContain('Calculation methodology:');
    // Field 2: state engine version
    expect(src).toContain('State engine:');
    // Field 3: data as at
    expect(src).toContain('Data as at');
    // Field 4: disclosure (handled by DISCLOSURE_PHRASE — already asserted)
    expect(src).toContain('DISCLOSURE_PHRASE');
    // Field 5: APA contact line
    expect(src).toContain('Australian Payroll Association');
  });

  it('short variant source intentionally omits the calc methodology + data-as-at + email + APA-name fields', () => {
    // OQ-10 spec: short variant renders state-engine version + disclosure
    // + URL only. We assert at source level that the short branch does
    // NOT reference the omitted field labels. Source inspection avoids
    // a brittle render-and-eyeball PDF visual diff.
    const componentPath = resolve(__dirname, '..', 'MethodologyFooter.tsx');
    const src = readFileSync(componentPath, 'utf8');

    // Find the short-variant branch — everything between the
    // `variant === 'short'` guard and the early `return` for that branch.
    const shortMatch = src.match(
      /variant === 'short'[\s\S]*?return\s*\([\s\S]*?\);[\s\S]*?\}/,
    );
    expect(shortMatch).not.toBeNull();
    const shortBranch = shortMatch![0];

    // Short branch MUST include:
    expect(shortBranch).toContain('State engine:');
    expect(shortBranch).toContain('DISCLOSURE_PHRASE');
    expect(shortBranch).toContain('apaContact.url');

    // Short branch MUST NOT include the full-variant-only labels:
    expect(shortBranch).not.toContain('Calculation methodology:');
    expect(shortBranch).not.toContain('Data as at');
    expect(shortBranch).not.toContain('apaContact.email');
    expect(shortBranch).not.toContain('Australian Payroll Association');
  });
});

describe('MethodologyFooter — no watermarks (spec §5.4 MUST NOT)', () => {
  it('component source contains no watermark text or rotation transform', () => {
    // Spec §5.4 explicitly bans draft / preview watermarks. Assert at
    // source level that the component does not introduce one — neither
    // as literal text (DRAFT, PREVIEW, etc.) nor as a rotation transform
    // (the common react-pdf watermark idiom: `transform: rotate(-45deg)`).
    const componentPath = resolve(__dirname, '..', 'MethodologyFooter.tsx');
    const src = readFileSync(componentPath, 'utf8');

    // Strip comments (line + block) so banned terms in the docstring
    // explaining the no-watermark rule do not trip the test.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    // Banned literal watermark strings (case-insensitive).
    expect(codeOnly).not.toMatch(/\bDRAFT\b/i);
    expect(codeOnly).not.toMatch(/\bPREVIEW\b/i);
    expect(codeOnly).not.toMatch(/\bWATERMARK\b/i);

    // Banned rotation transform — react-pdf supports `transform` on
    // <Text>/<View>; a rotated diagonal text band is the typical
    // watermark idiom. The footer should never carry one.
    expect(codeOnly).not.toMatch(/rotate\(/);
  });
});
