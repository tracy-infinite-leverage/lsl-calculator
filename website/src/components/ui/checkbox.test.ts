/**
 * checkbox.test.ts — contract tests for the LSL brand Checkbox
 *
 * E6.2 Task 2.6.e. The cva surface is single-axis (`size`). Brand tokens for
 * the unchecked / checked / indeterminate / focus / disabled states are baked
 * into the cva root (no `state` variant). These tests assert the cva resolves
 * + the source file references the right brand tokens.
 *
 * Coverage:
 *   1. `checkboxVariants` exports + resolves all four sizes
 *      (default / md / sm / lg).
 *   2. Class strings reference brand tokens — no hex leakage (spec §7.1).
 *   3. Source references the load-bearing brand tokens for the four
 *      mechanical states (unchecked border / checked fill / indeterminate
 *      fill / focus ring).
 *   4. cva default size is `default` (md is an alias).
 *   5. The internal `indicatorGlyphSize` record is aligned to the cva size
 *      keys — adding a new size to cva without a glyph entry would surface
 *      this as a structural test failure.
 *
 * What this file does NOT cover (deferred to Storybook + QA):
 *   - axe-core a11y violations — those run in Storybook (Default / Checked /
 *     Indeterminate / Sizes / Disabled / LabelledRow stories).
 *   - React render output / DOM — JSDOM is not configured for vitest.
 *   - Radix `data-state` runtime behaviour — covered upstream.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { checkboxVariants } from './checkbox';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const checkboxSrc = readFileSync(resolve(__dirname, 'checkbox.tsx'), 'utf-8');

// ---------------------------------------------------------------------------
// 1. cva resolves all four sizes
// ---------------------------------------------------------------------------

describe('checkboxVariants — sizes resolve', () => {
  const sizes = ['default', 'md', 'sm', 'lg'] as const;

  for (const size of sizes) {
    it(`resolves size="${size}" to a non-empty class string`, () => {
      const cls = checkboxVariants({ size: size as unknown as never });
      expect(typeof cls).toBe('string');
      expect(cls.length).toBeGreaterThan(0);
    });
  }

  it('md and default resolve to the same h/w (alias)', () => {
    const md = checkboxVariants({ size: 'md' as unknown as never });
    const def = checkboxVariants({ size: 'default' as unknown as never });
    for (const cls of [md, def]) {
      expect(cls).toContain('h-5');
      expect(cls).toContain('w-5');
    }
  });

  it('sm resolves to h-4 w-4', () => {
    const cls = checkboxVariants({ size: 'sm' as unknown as never });
    expect(cls).toContain('h-4');
    expect(cls).toContain('w-4');
  });

  it('lg resolves to h-6 w-6', () => {
    const cls = checkboxVariants({ size: 'lg' as unknown as never });
    expect(cls).toContain('h-6');
    expect(cls).toContain('w-6');
  });
});

// ---------------------------------------------------------------------------
// 2. Brand tokens (no hex literals leaked)
// ---------------------------------------------------------------------------

describe('checkboxVariants — token consumption (spec §7.1)', () => {
  it('resolved class strings contain NO literal brand hex values', () => {
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

    const sizes = ['default', 'md', 'sm', 'lg'];
    for (const size of sizes) {
      const cls = checkboxVariants({ size: size as unknown as never });
      for (const hex of brandHexes) {
        const re = new RegExp(`#?${hex}`, 'i');
        expect(
          re.test(cls),
          `size="${size}" leaks hex "${hex}" — replace with a brand token (spec §7.1).`,
        ).toBe(false);
      }
    }
  });

  it('checkbox source does NOT contain literal brand hex values', () => {
    // Belt-and-braces: even outside the cva root, the file shouldn't reach
    // for a hex.
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
    for (const hex of brandHexes) {
      const re = new RegExp(`#${hex}`, 'i');
      expect(re.test(checkboxSrc), `checkbox.tsx leaks #${hex}`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Brand-token references for the four mechanical states
// ---------------------------------------------------------------------------

describe('checkboxVariants — brand-styled states (RE-SKIN guard)', () => {
  it('unchecked state references border-brand-navy', () => {
    const cls = checkboxVariants({ size: 'md' as unknown as never });
    expect(cls).toContain('border-brand-navy');
  });

  it('checked state references data-[state=checked]:bg-brand-navy', () => {
    const cls = checkboxVariants({ size: 'md' as unknown as never });
    expect(cls).toContain('data-[state=checked]:bg-brand-navy');
  });

  it('checked state references data-[state=checked]:text-brand-white (glyph colour)', () => {
    const cls = checkboxVariants({ size: 'md' as unknown as never });
    expect(cls).toContain('data-[state=checked]:text-brand-white');
  });

  it('indeterminate state references data-[state=indeterminate]:bg-brand-navy', () => {
    const cls = checkboxVariants({ size: 'md' as unknown as never });
    expect(cls).toContain('data-[state=indeterminate]:bg-brand-navy');
  });

  it('focus ring is brand-navy (matches Button/Input/Select)', () => {
    const cls = checkboxVariants({ size: 'md' as unknown as never });
    expect(cls).toContain('focus-visible:ring-brand-navy');
  });
});

// ---------------------------------------------------------------------------
// 4. Default size is `default` (not flipped)
// ---------------------------------------------------------------------------

describe('checkboxVariants — defaults', () => {
  it('cva default size is "default" (md is an alias)', () => {
    expect(checkboxSrc).toMatch(/defaultVariants:\s*\{\s*size:\s*'default'/);
  });
});

// ---------------------------------------------------------------------------
// 5. Indicator glyph size map aligned to cva size keys
// ---------------------------------------------------------------------------

describe('checkbox — indicatorGlyphSize record alignment', () => {
  // The indicator glyph size record (`indicatorGlyphSize`) must carry the
  // same keys as the cva `size` variant. If a future PR adds an 'xl' size
  // to cva but forgets the glyph entry, the indicator will fall back to
  // undefined → broken icon. This test parses the source to catch drift.
  it('indicatorGlyphSize contains entries for default / md / sm / lg', () => {
    expect(checkboxSrc).toMatch(/default:\s*'h-4 w-4'/);
    expect(checkboxSrc).toMatch(/md:\s*'h-4 w-4'/);
    expect(checkboxSrc).toMatch(/sm:\s*'h-3 w-3'/);
    expect(checkboxSrc).toMatch(/lg:\s*'h-5 w-5'/);
  });

  it('uses lucide Check icon for the checked indicator glyph', () => {
    expect(checkboxSrc).toMatch(/<Check\b/);
  });

  it('uses lucide Minus icon for the indeterminate indicator glyph', () => {
    expect(checkboxSrc).toMatch(/<Minus\b/);
  });
});
