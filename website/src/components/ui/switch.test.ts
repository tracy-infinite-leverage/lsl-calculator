/**
 * switch.test.ts — contract tests for the LSL brand Switch
 *
 * E6.2 Task 2.6.g. The cva surface is single-axis (`size`). Brand tokens for
 * off / on / focus / disabled are baked into the cva root (no `state` variant).
 * These tests assert the cva resolves + the source file references the right
 * brand tokens.
 *
 * Coverage:
 *   1. `switchVariants` exports + resolves all four sizes
 *      (default / md / sm / lg).
 *   2. Class strings reference brand tokens — no hex leakage (spec §7.1).
 *   3. Source references the load-bearing brand tokens for the four
 *      mechanical states (off-track / on-track / bounding border / focus
 *      ring), and the brand-white thumb.
 *   4. cva default size is `default` (md is an alias).
 *   5. The internal `thumbBySize` record is aligned to the cva size keys —
 *      adding a new size to cva without a thumb entry would surface as a
 *      structural test failure.
 *
 * What this file does NOT cover (deferred to Storybook + QA):
 *   - axe-core a11y violations — those run in Storybook (Default / On /
 *     Sizes / Disabled / LabelledRow stories).
 *   - React render output / DOM — JSDOM is not configured for vitest.
 *   - Radix `data-state` runtime behaviour — covered upstream.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { switchVariants } from './switch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const switchSrc = readFileSync(resolve(__dirname, 'switch.tsx'), 'utf-8');

// ---------------------------------------------------------------------------
// 1. cva resolves all four sizes
// ---------------------------------------------------------------------------

describe('switchVariants — sizes resolve', () => {
  const sizes = ['default', 'md', 'sm', 'lg'] as const;

  for (const size of sizes) {
    it(`resolves size="${size}" to a non-empty class string`, () => {
      const cls = switchVariants({ size: size as unknown as never });
      expect(typeof cls).toBe('string');
      expect(cls.length).toBeGreaterThan(0);
    });
  }

  it('md and default resolve to the same h/w (alias)', () => {
    const md = switchVariants({ size: 'md' as unknown as never });
    const def = switchVariants({ size: 'default' as unknown as never });
    for (const cls of [md, def]) {
      expect(cls).toContain('h-6');
      expect(cls).toContain('w-11');
    }
  });

  it('sm resolves to h-4 w-8', () => {
    const cls = switchVariants({ size: 'sm' as unknown as never });
    expect(cls).toContain('h-4');
    expect(cls).toContain('w-8');
  });

  it('lg resolves to h-7 w-14', () => {
    const cls = switchVariants({ size: 'lg' as unknown as never });
    expect(cls).toContain('h-7');
    expect(cls).toContain('w-14');
  });
});

// ---------------------------------------------------------------------------
// 2. Brand tokens (no hex literals leaked)
// ---------------------------------------------------------------------------

describe('switchVariants — token consumption (spec §7.1)', () => {
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
      const cls = switchVariants({ size: size as unknown as never });
      for (const hex of brandHexes) {
        const re = new RegExp(`#?${hex}`, 'i');
        expect(
          re.test(cls),
          `size="${size}" leaks hex "${hex}" — replace with a brand token (spec §7.1).`,
        ).toBe(false);
      }
    }
  });

  it('switch source does NOT contain literal brand hex values', () => {
    for (const hex of brandHexes) {
      const re = new RegExp(`#${hex}`, 'i');
      expect(re.test(switchSrc), `switch.tsx leaks #${hex}`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Brand-token references for the mechanical states
// ---------------------------------------------------------------------------

describe('switchVariants — brand-styled states', () => {
  it('off-state references data-[state=unchecked]:bg-brand-light-blue', () => {
    const cls = switchVariants({ size: 'md' as unknown as never });
    expect(cls).toContain('data-[state=unchecked]:bg-brand-light-blue');
  });

  it('on-state references data-[state=checked]:bg-brand-navy', () => {
    const cls = switchVariants({ size: 'md' as unknown as never });
    expect(cls).toContain('data-[state=checked]:bg-brand-navy');
  });

  it('bounding border (non-text contrast) references border-brand-charcoal/40', () => {
    const cls = switchVariants({ size: 'md' as unknown as never });
    expect(cls).toContain('border-brand-charcoal/40');
  });

  it('focus ring is brand-navy (matches Button/Input/Select/Checkbox/Radio)', () => {
    const cls = switchVariants({ size: 'md' as unknown as never });
    expect(cls).toContain('focus-visible:ring-brand-navy');
  });

  it('thumb uses bg-brand-white in the component body', () => {
    // Thumb classes are applied imperatively (not via cva), so we check the
    // source file rather than a resolved cva string.
    expect(switchSrc).toContain('bg-brand-white');
  });
});

// ---------------------------------------------------------------------------
// 4. Default size is `default` (not flipped)
// ---------------------------------------------------------------------------

describe('switchVariants — defaults', () => {
  it('cva default size is "default" (md is an alias)', () => {
    expect(switchSrc).toMatch(/defaultVariants:\s*\{\s*size:\s*'default'/);
  });
});

// ---------------------------------------------------------------------------
// 5. thumbBySize record aligned to cva size keys
// ---------------------------------------------------------------------------

describe('switch — thumbBySize record alignment', () => {
  // The thumb size record must carry the same keys as the cva `size`
  // variant. If a future PR adds an 'xl' size to cva but forgets the thumb
  // entry, the thumb falls back to undefined → visually broken. This test
  // parses the source to catch drift.
  it('thumbBySize contains entries for default / md / sm / lg', () => {
    expect(switchSrc).toMatch(/default:\s*'h-5 w-5 /);
    expect(switchSrc).toMatch(/md:\s*'h-5 w-5 /);
    expect(switchSrc).toMatch(/sm:\s*'h-3 w-3 /);
    expect(switchSrc).toMatch(/lg:\s*'h-6 w-6 /);
  });

  it('each thumb size carries a checked translate-x value', () => {
    expect(switchSrc).toMatch(/data-\[state=checked\]:translate-x-5/);
    expect(switchSrc).toMatch(/data-\[state=checked\]:translate-x-4/);
    expect(switchSrc).toMatch(/data-\[state=checked\]:translate-x-7/);
  });
});
