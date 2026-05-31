/**
 * citation-block.test.ts — byte-for-byte markup snapshot for CitationBlock.
 *
 * E6.4 Task 4.4 acceptance criterion (spec §8.4):
 *
 *   "Cat A/B/C result semantics + citation block content unchanged
 *    byte-for-byte (snapshot test)."
 *
 * This file is the load-bearing guard. CitationBlock is the surface that
 * carries every legislative citation rendered next to a numeric output across
 * the public calculator + the upcoming E6.5 PDF report. Any structural change
 * to its HTML — element order, class names, aria attributes, plain-text
 * wording — risks breaking:
 *
 *   1. The "number first, citation second" presentation hierarchy that
 *      `ResultPanel.NumericTile` depends on for layout.
 *   2. The Cat A/B/C semantics that the LSL engine emits citation-by-citation
 *      (section + rule + optional pdfPage + optional note).
 *   3. The downstream PDF letterhead + body rendering that re-uses the same
 *      Citation shape (E6.5 / E6.6).
 *
 * The snapshot is rendered via `react-dom/server`'s `renderToStaticMarkup` so
 * vitest's `node` environment can run it without JSDOM. Markup is compared
 * verbatim — no whitespace normalisation, no class-name reordering. The
 * test will fail on any change. To intentionally amend the markup, update the
 * inline snapshot below in the SAME PR as the component change, with an
 * explicit reviewer call-out — the diff is the audit trail.
 *
 * Test inputs deliberately span the three Citation shapes the engine emits:
 *   - Single-citation, no pdfPage, no note (the bare minimum from a rules
 *     engine that does not cite the training PDF).
 *   - Multi-citation set with pdfPage + note (the maximum shape: section +
 *     rule + LSL-training PDF page reference + italicised engine note).
 *   - Duplicate-citation input (asserts the dedup branch — same section+
 *     rule+pdfPage+note collapses to one rendered <li>).
 *   - Empty array → renders nothing (returns `null`).
 *
 * Per the test-sanctity guard (`.github/workflows/ci.yml` §test-sanctity),
 * THIS file lives under `src/components/lsl/` — explicitly NOT under the
 * four protected paths (`website/e2e`, `website/src/lib/lsl/engine`,
 * `website/src/lib/lsl/states`, `website/src/__tests__`). It is a new
 * file, not a modification of any protected suite, and so does not
 * trigger the guard. See `docs/qa/e6-test-sanctity.md` for the rule.
 */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CitationBlock } from './citation-block';
import type { Citation } from '@/lib/lsl/engine/types';

/**
 * Wrap rendering in a tiny helper so the snapshot is just the citation
 * markup itself — not the test-author's createElement scaffolding.
 */
function renderCitationBlock(citations: Citation[]): string {
  return renderToStaticMarkup(createElement(CitationBlock, { citations }));
}

describe('CitationBlock — byte-for-byte markup contract (spec §8.4)', () => {
  it('renders the bare-minimum single citation (section + rule, no pdfPage, no note)', () => {
    const html = renderCitationBlock([
      {
        section: 'NSW LSL Act 1955 s.4(2)',
        rule: 'long_service_leave_entitlement_after_10_years',
      },
    ]);
    expect(html).toMatchInlineSnapshot(
      `"<ol class="space-y-2 mt-2" aria-label="Legislative citations"><li class="border-l-2 border-primary/40 pl-3 text-xs leading-relaxed"><div class="flex items-start gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open h-3.5 w-3.5 text-primary mt-0.5 shrink-0" aria-hidden="true"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg><div><p class="font-semibold text-foreground">NSW LSL Act 1955 s.4(2)</p><p class="text-muted-foreground font-mono text-[11px]">long_service_leave_entitlement_after_10_years</p></div></div></li></ol>"`,
    );
  });

  it('renders the maximum-shape citation (section + rule + pdfPage + note)', () => {
    const html = renderCitationBlock([
      {
        section: 'NSW LSL Act 1955 s.4(5)(b)',
        rule: 'category_a_one_in_three_weeks_rule',
        pdfPage: 12,
        note: 'Cat A applies when ordinary weekly hours fall within the one-in-three-weeks band.',
      },
    ]);
    expect(html).toMatchInlineSnapshot(
      `"<ol class="space-y-2 mt-2" aria-label="Legislative citations"><li class="border-l-2 border-primary/40 pl-3 text-xs leading-relaxed"><div class="flex items-start gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open h-3.5 w-3.5 text-primary mt-0.5 shrink-0" aria-hidden="true"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg><div><p class="font-semibold text-foreground">NSW LSL Act 1955 s.4(5)(b)</p><p class="text-muted-foreground font-mono text-[11px]">category_a_one_in_three_weeks_rule · LSL-training PDF p.12</p><p class="text-muted-foreground italic mt-0.5">Cat A applies when ordinary weekly hours fall within the one-in-three-weeks band.</p></div></div></li></ol>"`,
    );
  });

  it('renders multiple citations in source order (visual order = source order)', () => {
    const html = renderCitationBlock([
      {
        section: 'NSW LSL Act 1955 s.4(2)',
        rule: 'long_service_leave_entitlement_after_10_years',
      },
      {
        section: 'NSW LSL Act 1955 s.4(5)(c)',
        rule: 'category_b_average_weekly_hours_lookback',
        pdfPage: 14,
      },
      {
        section: 'NSW LSL Act 1955 s.4(5)(d)',
        rule: 'category_c_five_year_average_floor',
        pdfPage: 15,
        note: 'Cat C is the highest-of-three averages floor.',
      },
    ]);
    expect(html).toMatchInlineSnapshot(
      `"<ol class="space-y-2 mt-2" aria-label="Legislative citations"><li class="border-l-2 border-primary/40 pl-3 text-xs leading-relaxed"><div class="flex items-start gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open h-3.5 w-3.5 text-primary mt-0.5 shrink-0" aria-hidden="true"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg><div><p class="font-semibold text-foreground">NSW LSL Act 1955 s.4(2)</p><p class="text-muted-foreground font-mono text-[11px]">long_service_leave_entitlement_after_10_years</p></div></div></li><li class="border-l-2 border-primary/40 pl-3 text-xs leading-relaxed"><div class="flex items-start gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open h-3.5 w-3.5 text-primary mt-0.5 shrink-0" aria-hidden="true"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg><div><p class="font-semibold text-foreground">NSW LSL Act 1955 s.4(5)(c)</p><p class="text-muted-foreground font-mono text-[11px]">category_b_average_weekly_hours_lookback · LSL-training PDF p.14</p></div></div></li><li class="border-l-2 border-primary/40 pl-3 text-xs leading-relaxed"><div class="flex items-start gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open h-3.5 w-3.5 text-primary mt-0.5 shrink-0" aria-hidden="true"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg><div><p class="font-semibold text-foreground">NSW LSL Act 1955 s.4(5)(d)</p><p class="text-muted-foreground font-mono text-[11px]">category_c_five_year_average_floor · LSL-training PDF p.15</p><p class="text-muted-foreground italic mt-0.5">Cat C is the highest-of-three averages floor.</p></div></div></li></ol>"`,
    );
  });

  it('dedups citations by section + rule + pdfPage + note', () => {
    const html = renderCitationBlock([
      {
        section: 'NSW LSL Act 1955 s.4(2)',
        rule: 'long_service_leave_entitlement_after_10_years',
      },
      {
        section: 'NSW LSL Act 1955 s.4(2)',
        rule: 'long_service_leave_entitlement_after_10_years',
      },
    ]);
    // Two identical inputs collapse to one rendered <li>. If dedup changes
    // (e.g. someone adds a new key to Citation but forgets to add it to the
    // dedup key in citation-block.tsx), this snapshot diverges and the test
    // fails — surfacing the regression at PR time.
    expect(html).toMatchInlineSnapshot(
      `"<ol class="space-y-2 mt-2" aria-label="Legislative citations"><li class="border-l-2 border-primary/40 pl-3 text-xs leading-relaxed"><div class="flex items-start gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open h-3.5 w-3.5 text-primary mt-0.5 shrink-0" aria-hidden="true"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg><div><p class="font-semibold text-foreground">NSW LSL Act 1955 s.4(2)</p><p class="text-muted-foreground font-mono text-[11px]">long_service_leave_entitlement_after_10_years</p></div></div></li></ol>"`,
    );
  });

  it('renders nothing when the citation array is empty', () => {
    // CitationBlock returns `null` when there are no citations to render.
    // renderToStaticMarkup of `null` is the empty string — confirms the
    // "no chrome around an empty list" contract.
    expect(renderCitationBlock([])).toBe('');
  });
});
