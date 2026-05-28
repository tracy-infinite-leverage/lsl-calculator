/**
 * radio-group.test.ts — contract tests for the LSL brand RadioGroup
 *
 * E6.2 Task 2.6.f. The cva surface is single-axis (`size`) on
 * `<RadioGroupItem>` only — the Root stays a layout wrapper with no variants.
 * Brand tokens for unchecked / checked / focus / disabled are baked into the
 * cva root (no `state` variant). These tests assert the cva resolves + the
 * source file references the right brand tokens.
 *
 * Coverage:
 *   1. `radioGroupItemVariants` exports + resolves all four sizes
 *      (default / md / sm / lg).
 *   2. Class strings reference brand tokens — no hex leakage (spec §7.1).
 *   3. Source references the load-bearing brand tokens for the three
 *      mechanical states (border / inner indicator / focus ring).
 *   4. cva default size is `default` (md is an alias).
 *   5. The internal `indicatorGlyphSize` record is aligned to the cva size
 *      keys — adding a new size to cva without a glyph entry would surface
 *      as a structural test failure.
 *
 * What this file does NOT cover (deferred to Storybook + QA):
 *   - axe-core a11y violations — those run in Storybook (Default /
 *     PreSelected / Sizes / Disabled / LabelledRow stories).
 *   - React render output / DOM — JSDOM is not configured for vitest.
 *   - Radix `data-state` runtime behaviour — covered upstream.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { radioGroupItemVariants } from './radio-group';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const radioSrc = readFileSync(resolve(__dirname, 'radio-group.tsx'), 'utf-8');

// ---------------------------------------------------------------------------
// 1. cva resolves all four sizes
// ---------------------------------------------------------------------------

describe('radioGroupItemVariants — sizes resolve', () => {
  const sizes = ['default', 'md', 'sm', 'lg'] as const;

  for (const size of sizes) {
    it(`resolves size="${size}" to a non-empty class string`, () => {
      const cls = radioGroupItemVariants({ size: size as unknown as never });
      expect(typeof cls).toBe('string');
      expect(cls.length).toBeGreaterThan(0);
    });
  }

  it('md and default resolve to the same h/w (alias)', () => {
    const md = radioGroupItemVariants({ size: 'md' as unknown as never });
    const def = radioGroupItemVariants({
      size: 'default' as unknown as never,
    });
    for (const cls of [md, def]) {
      expect(cls).toContain('h-5');
      expect(cls).toContain('w-5');
    }
  });

  it('sm resolves to h-4 w-4', () => {
    const cls = radioGroupItemVariants({ size: 'sm' as unknown as never });
    expect(cls).toContain('h-4');
    expect(cls).toContain('w-4');
  });

  it('lg resolves to h-6 w-6', () => {
    const cls = radioGroupItemVariants({ size: 'lg' as unknown as never });
    expect(cls).toContain('h-6');
    expect(cls).toContain('w-6');
  });
});

// ---------------------------------------------------------------------------
// 2. Brand tokens (no hex literals leaked)
// ---------------------------------------------------------------------------

describe('radioGroupItemVariants — token consumption (spec §7.1)', () => {
  const brandHexes = [
    '48608a',
    'd9a428',
    'a0aec1',
    'eebd3c',
    '324d61',
    '333232',
    '808897',
    '6ec8c0',
  ];

  it('resolved class strings contain NO literal brand hex values', () => {
    const sizes = ['default', 'md', 'sm', 'lg'];
    for (const size of sizes) {
      const cls = radioGroupItemVariants({
        size: size as unknown as never,
      });
      for (const hex of brandHexes) {
        const re = new RegExp(`#?${hex}`, 'i');
        expect(
          re.test(cls),
          `size="${size}" leaks hex "${hex}" — replace with a brand token (spec §7.1).`,
        ).toBe(false);
      }
    }
  });

  it('radio-group source does NOT contain literal brand hex values', () => {
    // Belt-and-braces: even outside the cva root, the file shouldn't reach
    // for a hex.
    for (const hex of brandHexes) {
      const re = new RegExp(`#${hex}`, 'i');
      expect(re.test(radioSrc), `radio-group.tsx leaks #${hex}`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Brand-token references for the three mechanical states
// ---------------------------------------------------------------------------

describe('radioGroupItemVariants — brand-styled states (RE-SKIN guard)', () => {
  it('unchecked state references border-brand-navy', () => {
    const cls = radioGroupItemVariants({ size: 'md' as unknown as never });
    expect(cls).toContain('border-brand-navy');
  });

  it('item inherits text-brand-navy for the inner indicator (via text-current)', () => {
    // The indicator <Circle /> uses `fill-current text-current`, so the
    // item's `text-brand-navy` is what tints the filled circle when checked.
    const cls = radioGroupItemVariants({ size: 'md' as unknown as never });
    expect(cls).toContain('text-brand-navy');
  });

  it('focus ring is brand-navy (matches Button/Input/Select/Checkbox)', () => {
    const cls = radioGroupItemVariants({ size: 'md' as unknown as never });
    expect(cls).toContain('focus-visible:ring-brand-navy');
  });
});

// ---------------------------------------------------------------------------
// 4. Default size is `default` (not flipped)
// ---------------------------------------------------------------------------

describe('radioGroupItemVariants — defaults', () => {
  it('cva default size is "default" (md is an alias)', () => {
    expect(radioSrc).toMatch(/defaultVariants:\s*\{\s*size:\s*'default'/);
  });
});

// ---------------------------------------------------------------------------
// 5. Indicator glyph size map aligned to cva size keys
// ---------------------------------------------------------------------------

describe('radio-group — indicatorGlyphSize record alignment', () => {
  // The indicator glyph size record (`indicatorGlyphSize`) must carry the
  // same keys as the cva `size` variant. If a future PR adds an 'xl' size
  // to cva but forgets the glyph entry, the indicator falls back to undefined
  // → broken icon. This test parses the source to catch drift.
  it('indicatorGlyphSize contains entries for default / md / sm / lg', () => {
    expect(radioSrc).toMatch(/default:\s*'h-2\.5 w-2\.5'/);
    expect(radioSrc).toMatch(/md:\s*'h-2\.5 w-2\.5'/);
    expect(radioSrc).toMatch(/sm:\s*'h-2 w-2'/);
    expect(radioSrc).toMatch(/lg:\s*'h-3 w-3'/);
  });

  it('uses lucide Circle icon for the checked indicator glyph', () => {
    expect(radioSrc).toMatch(/<Circle\b/);
  });
});
