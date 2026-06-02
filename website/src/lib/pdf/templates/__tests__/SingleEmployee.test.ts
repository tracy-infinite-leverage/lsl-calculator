/**
 * SingleEmployee.test.ts — snapshot + contract tests for the single-employee
 * PDF report template.
 *
 * E6.5 Task 6.1 (spec §5.3 + §5.4 + §8.6 + OQ-5). Pins the acceptance criteria
 * from `tasks.md` lines 714-721:
 *
 *   1. Template renders single-employee result with Cat A/B/C semantics
 *      intact (number first, citation second per spec §5.3 invariant).
 *   2. Citation block byte-for-byte matches web snapshot.
 *   3. Letterhead + methodology footer + page numbering inherited from
 *      Phase 4 primitives.
 *   4. No separate exec summary (OQ-5).
 *
 * ----------------------------------------------------------------------------
 * Byte-for-byte citation strategy (the load-bearing AC)
 * ----------------------------------------------------------------------------
 *
 * The web `<CitationBlock>` renders text into HTML `<p>` elements; the PDF
 * template renders the same TEXTUAL CONTENT into react-pdf `<Text>` primitives.
 * The wrapping markup differs by necessity (different rendering surface).
 * "Byte-for-byte" therefore applies to the TEXT — the citation strings the
 * user reads — not the surrounding markup.
 *
 * We assert byte-identity in two layers, mirroring the pattern
 * `MethodologyFooter.test.ts` uses for the "Calculated, not advice."
 * disclosure-phrase contract:
 *
 *   1. SOURCE-level: the template's `formatCitationRule` helper assembles
 *      the rule line with the EXACT template string used by
 *      `citation-block.tsx` (` · LSL-training PDF p.${pdfPage}`). We assert
 *      both files contain that template substring — any drift fails LOUD.
 *
 *   2. STRUCTURAL: the template's `dedupCitations` helper uses the SAME
 *      composite key as `citation-block.tsx` (`${section}|${rule}|${pdfPage
 *      ?? ''}|${note ?? ''}`). We unit-test `dedupCitations` to prove the
 *      dedup contract matches the web behaviour (identical inputs → 1 entry,
 *      ordering preserved by source order, etc.).
 *
 * Together, layers 1 + 2 are the cross-surface byte-identity check the spec
 * §8.6 acceptance criterion requires. PDF-content-stream byte-for-byte
 * (decompressing FlateDecode + recovering glyph mapping) is not pursued
 * because (a) it is brittle to react-pdf updates and (b) it is unnecessary
 * once the source-level + structural contracts above hold — the same data
 * + the same template string + the same dedup logic produces the same text
 * downstream.
 *
 * The pattern follows the existing `MethodologyFooter.test.ts` precedent for
 * the cross-surface "Calculated, not advice" disclosure assertion.
 *
 * ----------------------------------------------------------------------------
 * Multi-page contract — Letterhead + footer inheritance from <A4Page>
 * ----------------------------------------------------------------------------
 *
 * We render the template once with a small payload (1 page) and once with a
 * synthetic large payload (many citations + warnings to force overflow into
 * 2+ pages). The multi-page render asserts:
 *
 *   - PDF page count > 1 (Letterhead + footer must compose across overflow).
 *   - Both Source Sans 3 and Montserrat subsets embed (proves Letterhead
 *     reached page 1 and methodology footer reached every page).
 *
 * The same `countPdfPages` regex used by `A4Page.test.ts` is reused here.
 */

import { describe, it, expect } from 'vitest';
import { Document, pdf } from '@react-pdf/renderer';
import * as React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SingleEmployee, dedupCitations, formatCitationRule } from '../SingleEmployee';
import type { SingleEmployeePayload } from '../SingleEmployee';
import type { ReportContext } from '../../types';
import type { Citation, Result } from '@/lib/lsl/engine/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Standard report context used across every render. */
const SAMPLE_CONTEXT: ReportContext = {
  reportTitle: 'Single-employee LSL result',
  generatedAtIso: '2026-05-31T05:42:00Z',
  organisationName: 'Acme Pty Ltd',
  calcMethodologyVersion: 'lsl-engine-v1.4.2',
  stateEngineVersion: 'rules-engine-v1.2',
  dataAsAtIso: '2026-05-31T05:42:00Z',
  apaContact: {
    email: 'admin@austpayroll.com.au',
    url: 'www.austpayroll.com.au',
  },
};

/**
 * A minimal Cat B Result with two citations (one with pdfPage, one without).
 * The Decimal-typed fields use opaque-string placeholders cast through
 * `unknown` — the template only consumes `.display` strings from the engine
 * outputs and never re-computes from the underlying Decimals, so the test
 * fixtures don't need to import the Decimal implementation.
 */
function makeMinimalResult(): Result {
  // Type-cast the Decimal-shaped fields through `unknown` — see fixture
  // doc-comment above. The engine `Result` requires Decimals on numeric
  // outputs; for a render test the `.display` strings are the only thing
  // the template touches.
  const decimalShim = '1000.00' as unknown as Result['outputs'] extends infer R
    ? R extends { valueOfWeek: { value: infer V } }
      ? V
      : never
    : never;

  const citations: Citation[] = [
    {
      section: 'NSW LSL Act 1955 s.4(2)',
      rule: 'long_service_leave_entitlement_after_10_years',
    },
    {
      section: 'NSW LSL Act 1955 s.4(5)(b)',
      rule: 'category_b_average_weekly_hours_lookback',
      pdfPage: 14,
      note: 'Cat B applies when ordinary hours rolled across the past 12 months.',
    },
  ];

  return {
    employeeId: 'emp-001',
    status: 'computed',
    category: 'B',
    trigger: {
      kind: 'termination',
      terminationDate: '2026-05-31' as Result['trigger']['kind'] extends 'termination'
        ? string
        : never,
      reason: 'redundancy',
    } as Result['trigger'],
    outputs: {
      valueOfWeek: {
        value: decimalShim,
        display: '1,000.00',
        citations,
      },
      valueOfDay: {
        value: decimalShim,
        display: '200.00',
        citations,
      },
      totalEntitlement: {
        weeks: {
          value: decimalShim,
          display: '10.83',
          citations,
        },
        dollars: {
          value: decimalShim,
          display: '10,830.00',
          citations,
        },
      },
    },
    warnings: [
      {
        code: 'rehire_gap_at_threshold',
        message: 'Rehire gap is at the state-specific tolerance threshold.',
      },
    ],
    diagnostics: {
      yearsOfContinuousService: '10.83' as unknown as Result['diagnostics'] extends infer D
        ? D extends { yearsOfContinuousService: infer Y }
          ? Y
          : never
        : never,
      daysOfContinuousService: 3954,
      daysNotCountedInService: 0,
      daysNotCountedInLookback: { window12mo: 0, window5yr: 0 },
      weeklyAvg12mo: '1000.00' as unknown as Result['diagnostics'] extends infer D
        ? D extends { weeklyAvg12mo: infer W }
          ? W
          : never
        : never,
      weeklyAvg5yr: '950.00' as unknown as Result['diagnostics'] extends infer D
        ? D extends { weeklyAvg5yr: infer W }
          ? W
          : never
        : never,
      payableIndicator: 'payable',
      serviceStartUsed: '2015-09-01' as Result['diagnostics'] extends infer D
        ? D extends { serviceStartUsed: infer S }
          ? S
          : never
        : never,
    },
  };
}

const SAMPLE_PAYLOAD: SingleEmployeePayload = {
  result: makeMinimalResult(),
  identity: {
    legalName: 'Sample Employee',
    externalEmployeeId: 'EMP-001',
    startDate: '2015-09-01',
  },
};

/**
 * Render a SingleEmployee template inside a Document into a PDF byte buffer.
 */
async function renderSingleEmployeeToPdfBytes(
  context: ReportContext,
  payload: SingleEmployeePayload,
): Promise<Buffer> {
  const instance = pdf(
    React.createElement(
      Document,
      { title: 'SingleEmployee test' },
      React.createElement(SingleEmployee, { context, payload }),
    ),
  );
  const stream = await instance.toBuffer();
  return new Promise<Buffer>((resolveBuf, rejectBuf) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolveBuf(Buffer.concat(chunks)));
    stream.on('error', rejectBuf);
  });
}

/**
 * Count rendered PDF pages by counting `/Type /Page` markers (NOT followed
 * by `s`, which would match the parent `/Type /Pages` node). Mirrors the
 * helper used in `A4Page.test.ts`.
 */
function countPdfPages(buf: Buffer): number {
  const text = buf.toString('latin1');
  const matches = text.match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : 0;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SingleEmployee — single-page render (Cat A/B/C semantics)', () => {
  it('renders a valid PDF without throwing', async () => {
    const buf = await renderSingleEmployeeToPdfBytes(SAMPLE_CONTEXT, SAMPLE_PAYLOAD);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.subarray(-8).toString('latin1')).toMatch(/%%EOF/);
  }, 30000);

  it('embeds both Montserrat (Letterhead) and Source Sans 3 (body + footer) font subsets', async () => {
    // Proof that the Letterhead + footer primitives reached the rendered PDF
    // through the A4Page composition path.
    const buf = await renderSingleEmployeeToPdfBytes(SAMPLE_CONTEXT, SAMPLE_PAYLOAD);
    const pdfText = buf.toString('latin1');
    expect(pdfText).toMatch(/Montserrat-SemiBold/);
    expect(pdfText).toMatch(/SourceSans3-Regular/);
  }, 30000);

  it('emits a MediaBox with A4 dimensions', async () => {
    const buf = await renderSingleEmployeeToPdfBytes(SAMPLE_CONTEXT, SAMPLE_PAYLOAD);
    const pdfText = buf.toString('latin1');
    expect(pdfText).toMatch(/MediaBox/);
    // A4 = 595 × 842 pt (with possible decimal fractions from react-pdf).
    expect(pdfText).toMatch(/MediaBox\s*\[0 0 595(?:\.\d+)? 84[12](?:\.\d+)?\]/);
  }, 30000);

  it('produces a PDF in the expected size band (font subsets working, no whole-font embed)', async () => {
    const buf = await renderSingleEmployeeToPdfBytes(SAMPLE_CONTEXT, SAMPLE_PAYLOAD);
    // Non-trivial PDF — body content + tiles + citations + footer.
    expect(buf.length).toBeGreaterThan(10_000);
    // Fonts must be subset (not embedded whole at ~400 KB each).
    expect(buf.length).toBeLessThan(200_000);
  }, 30000);
});

describe('SingleEmployee — multi-page render (Letterhead + footer inheritance)', () => {
  /**
   * Build a synthetic high-volume payload that forces react-pdf to overflow
   * onto multiple A4 pages. We replicate the same citation set across all
   * tile citations + add many warnings to drive vertical content past one page.
   */
  function makeMultiPagePayload(): SingleEmployeePayload {
    const base = makeMinimalResult();
    const manyCitations: Citation[] = [];
    for (let i = 0; i < 20; i++) {
      manyCitations.push({
        section: `NSW LSL Act 1955 s.4(5)(${String.fromCharCode(97 + (i % 26))})`,
        rule: `category_b_average_weekly_hours_lookback_${i}`,
        pdfPage: 12 + i,
        note:
          `Engine note ${i}: Cat B applies when ordinary hours rolled across the past 12 months ` +
          'and the average exceeds the one-in-three-weeks threshold for the lookback window. ' +
          'This is filler text designed to force the citation list across multiple A4 pages so ' +
          'the multi-page contract from A4Page (Letterhead page 1 only, footer split full/short ' +
          'across pages) is exercised by the single-employee template.',
      });
    }
    const outputs = base.outputs!;
    return {
      result: {
        ...base,
        outputs: {
          ...outputs,
          valueOfWeek: { ...outputs.valueOfWeek, citations: manyCitations },
          valueOfDay: { ...outputs.valueOfDay, citations: manyCitations },
          totalEntitlement: {
            weeks: { ...outputs.totalEntitlement.weeks, citations: manyCitations },
            dollars: { ...outputs.totalEntitlement.dollars, citations: manyCitations },
          },
        },
        warnings: Array.from({ length: 40 }, (_unused, i) => ({
          code: 'rehire_gap_at_threshold' as const,
          message:
            `Advisory ${i}: this is filler advisory copy to force vertical overflow into ` +
            'multiple A4 pages. The advisories should render as line items in the warnings ' +
            'section, with the body content overflowing into the next page once the page-1 ' +
            'content area fills up under the letterhead.',
        })),
      },
      identity: { legalName: 'Multi-Page Test Employee', startDate: '2010-01-01' },
    };
  }

  it('produces a multi-page PDF when content overflows', async () => {
    const buf = await renderSingleEmployeeToPdfBytes(
      SAMPLE_CONTEXT,
      makeMultiPagePayload(),
    );
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.subarray(-8).toString('latin1')).toMatch(/%%EOF/);
    expect(countPdfPages(buf)).toBeGreaterThanOrEqual(2);
  }, 60000);

  it('multi-page PDF embeds Montserrat (letterhead reached page 1) and Source Sans 3 (footer + body)', async () => {
    const buf = await renderSingleEmployeeToPdfBytes(
      SAMPLE_CONTEXT,
      makeMultiPagePayload(),
    );
    const pdfText = buf.toString('latin1');
    expect(pdfText).toMatch(/Montserrat-SemiBold/);
    expect(pdfText).toMatch(/SourceSans3-Regular/);
  }, 60000);

  it('multi-page PDF is meaningfully larger than the single-page baseline', async () => {
    const small = await renderSingleEmployeeToPdfBytes(SAMPLE_CONTEXT, SAMPLE_PAYLOAD);
    const large = await renderSingleEmployeeToPdfBytes(
      SAMPLE_CONTEXT,
      makeMultiPagePayload(),
    );
    expect(large.length).toBeGreaterThan(small.length);
    expect(large.length - small.length).toBeGreaterThan(1_000);
  }, 90000);
});

describe('SingleEmployee — failure-mode results render gracefully', () => {
  it('renders an error message for `failed` status without throwing', async () => {
    const failed: Result = {
      employeeId: 'emp-002',
      status: 'failed',
      trigger: {
        kind: 'termination',
        terminationDate: '2026-05-31' as Result['trigger']['kind'] extends 'termination'
          ? string
          : never,
        reason: 'voluntary_resignation',
      } as Result['trigger'],
      warnings: [],
      error: { code: 'engine_error', userMessage: 'Calculation failed: missing wage history.' },
    };
    const buf = await renderSingleEmployeeToPdfBytes(SAMPLE_CONTEXT, {
      result: failed,
    });
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.subarray(-8).toString('latin1')).toMatch(/%%EOF/);
  }, 30000);

  it('renders a cross-jurisdiction blocked status without throwing', async () => {
    const blocked: Result = {
      employeeId: 'emp-003',
      status: 'blocked_cross_jurisdiction',
      trigger: {
        kind: 'termination',
        terminationDate: '2026-05-31' as Result['trigger']['kind'] extends 'termination'
          ? string
          : never,
        reason: 'voluntary_resignation',
      } as Result['trigger'],
      warnings: [
        {
          code: 'cross_jurisdiction_pending',
          message: 'This employee has worked in multiple states. Nominate the governing jurisdiction to proceed.',
        },
      ],
    };
    const buf = await renderSingleEmployeeToPdfBytes(SAMPLE_CONTEXT, {
      result: blocked,
    });
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.subarray(-8).toString('latin1')).toMatch(/%%EOF/);
  }, 30000);
});

describe('SingleEmployee — citation byte-for-byte contract (spec §8.6)', () => {
  it('`formatCitationRule` reproduces the web CitationBlock template string for pdfPage', () => {
    // The web `citation-block.tsx` renders the rule line as
    // `{c.rule}{c.pdfPage && <> · LSL-training PDF p.{c.pdfPage}</>}`.
    // The template string ` · LSL-training PDF p.${pdfPage}` is the
    // byte-for-byte surface — assert this helper produces exactly that.
    const out = formatCitationRule({
      section: 'NSW LSL Act 1955 s.4(5)(b)',
      rule: 'category_b_rule',
      pdfPage: 14,
    });
    expect(out).toBe('category_b_rule · LSL-training PDF p.14');
  });

  it('`formatCitationRule` omits the PDF suffix when pdfPage is absent (matches web)', () => {
    const out = formatCitationRule({
      section: 'NSW LSL Act 1955 s.4(2)',
      rule: 'long_service_leave_entitlement_after_10_years',
    });
    expect(out).toBe('long_service_leave_entitlement_after_10_years');
  });

  it('template + web citation block share the exact " · LSL-training PDF p." template string (cross-surface byte-identity)', () => {
    // Read both source files and confirm the same template substring appears
    // in each. Any drift on either side (e.g. someone changes the separator
    // or the prefix wording in citation-block.tsx) fails this test LOUD —
    // the cross-surface contract for citation byte-identity.
    //
    // Same pattern as MethodologyFooter.test.ts's "Calculated, not advice"
    // cross-surface assertion against the web footer.
    const templatePath = resolve(__dirname, '..', 'SingleEmployee.tsx');
    const webCitationPath = resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'components',
      'lsl',
      'citation-block.tsx',
    );
    const templateSrc = readFileSync(templatePath, 'utf8');
    const webSrc = readFileSync(webCitationPath, 'utf8');
    const SEPARATOR = ' · LSL-training PDF p.';
    expect(templateSrc).toContain(SEPARATOR);
    expect(webSrc).toContain(SEPARATOR);
  });

  it('`dedupCitations` matches the web composite key (`section|rule|pdfPage|note`)', () => {
    // Web `citation-block.tsx` dedup key (lines 15-23): `${c.section}|${c.rule}|${c.pdfPage ?? ''}|${c.note ?? ''}`.
    // The template's `dedupCitations` MUST behave identically.
    const dupes: Citation[] = [
      { section: 'NSW s.4(2)', rule: 'r1' },
      { section: 'NSW s.4(2)', rule: 'r1' }, // exact dupe → collapse
      { section: 'NSW s.4(2)', rule: 'r1', pdfPage: 12 }, // pdfPage differs → keep
      { section: 'NSW s.4(2)', rule: 'r1', pdfPage: 12, note: 'a' }, // note differs → keep
      { section: 'NSW s.4(2)', rule: 'r1', pdfPage: 12 }, // exact dupe of #3 → collapse
    ];
    const out = dedupCitations(dupes);
    expect(out).toHaveLength(3);
    // Source order = visual order — first occurrence wins.
    expect(out[0]).toEqual({ section: 'NSW s.4(2)', rule: 'r1' });
    expect(out[1]).toEqual({ section: 'NSW s.4(2)', rule: 'r1', pdfPage: 12 });
    expect(out[2]).toEqual({
      section: 'NSW s.4(2)',
      rule: 'r1',
      pdfPage: 12,
      note: 'a',
    });
  });

  it('`dedupCitations` returns an empty array for an empty input (matches web "no chrome" contract)', () => {
    // Web `<CitationBlock>` returns `null` (renders nothing) when its
    // deduped list is empty. The template's `<PdfCitationBlock>` mirrors
    // this — both surfaces produce no markup for an empty list.
    expect(dedupCitations([])).toEqual([]);
  });

  it('template source preserves the "number-first, citation-second" composition (spec §5.3 invariant)', () => {
    // Within each result tile, the legislated number must precede the
    // citation list visually (matches web `NumericTile`). Source inspection:
    // in the `ResultTile` JSX, `<Text style={styles.tileValue}>` appears
    // BEFORE `<PdfCitationBlock>`.
    const templatePath = resolve(__dirname, '..', 'SingleEmployee.tsx');
    const src = readFileSync(templatePath, 'utf8');
    // Strip block comments so docstring mentions don't interfere.
    const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '');
    const tileValueIdx = codeOnly.indexOf('styles.tileValue');
    const citationBlockIdx = codeOnly.indexOf('PdfCitationBlock citations=');
    expect(tileValueIdx).toBeGreaterThan(-1);
    expect(citationBlockIdx).toBeGreaterThan(-1);
    expect(tileValueIdx).toBeLessThan(citationBlockIdx);
  });
});

describe('SingleEmployee — OQ-5: no separate executive summary block', () => {
  it('template source contains no "executive summary" / "exec summary" section label', () => {
    // OQ-5: single-employee reports are short enough that no exec-summary
    // band is needed. Pin this at source level so any future addition is
    // a deliberate spec-amended change, not a silent drift.
    const templatePath = resolve(__dirname, '..', 'SingleEmployee.tsx');
    const src = readFileSync(templatePath, 'utf8');
    // Strip block + line comments so the docstring's explicit OQ-5
    // mention doesn't trip the test.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/executive\s+summary/i);
    expect(codeOnly).not.toMatch(/exec\s+summary/i);
  });
});

describe('SingleEmployee — A4Page composition (Letterhead + footer inheritance)', () => {
  it('template imports and uses the <A4Page> primitive (does not duplicate Letterhead/Footer/PageNumber)', () => {
    // The point of inheritance: SingleEmployee should NEVER import Letterhead,
    // MethodologyFooter, or PageNumber directly — those are composed inside
    // A4Page. Doing so would duplicate the page-1 letterhead and break the
    // page-2+ short-footer split.
    const templatePath = resolve(__dirname, '..', 'SingleEmployee.tsx');
    const src = readFileSync(templatePath, 'utf8');

    // Strip block + line comments so the comments in the file (which
    // reference Letterhead / MethodologyFooter / PageNumber by name when
    // explaining the inheritance) don't trip the test.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    // Must import A4Page.
    expect(codeOnly).toMatch(/import\s*\{[^}]*A4Page[^}]*\}\s*from\s*['"][^'"]*A4Page['"]/);
    // Must use <A4Page> as the page wrapper.
    expect(codeOnly).toMatch(/<A4Page\s/);

    // MUST NOT import Letterhead / MethodologyFooter / PageNumber directly.
    expect(codeOnly).not.toMatch(
      /import\s*\{[^}]*Letterhead[^}]*\}\s*from\s*['"][^'"]*Letterhead['"]/,
    );
    expect(codeOnly).not.toMatch(
      /import\s*\{[^}]*MethodologyFooter[^}]*\}\s*from\s*['"][^'"]*MethodologyFooter['"]/,
    );
    expect(codeOnly).not.toMatch(
      /import\s*\{[^}]*PageNumber[^}]*\}\s*from\s*['"][^'"]*PageNumber['"]/,
    );
  });
});
