/**
 * textarea.test.ts — contract tests for the LSL brand Textarea
 *
 * E6.2 Task 2.6.c. Vitest runs in `node` env per `vitest.config.ts` — these
 * tests assert STRUCTURAL / CONTRACT properties of the cva config, not React
 * render output. Visual + a11y verification lives in Storybook (axe-core via
 * the addon, see textarea.stories.tsx) and is the canonical bar.
 *
 * Coverage mirrors `input.test.ts`:
 *
 *   1. `textareaVariants` exports the cva function and resolves both states
 *      (default / error) plus all four sizes (default / md / sm / lg).
 *   2. State variants reference brand tokens — no hex leakage (spec §7.1).
 *   3. Default state IS brand-styled — runtime backstop against accidental
 *      revert to shadcn-neutral `border-input`.
 *   4. Error state uses the destructive token (single red across the system).
 *   5. cva defaults are `state: 'default'` and `size: 'default'` (md is alias).
 *
 * What this file does NOT cover (deferred to Storybook + QA):
 *   - axe-core a11y violations — those run inside Storybook with
 *     `parameters.a11y.test = 'error'`.
 *   - React render output / DOM — JSDOM is not configured for vitest.
 *   - Contrast-ratio assertions — pre-computed in the textarea.tsx header;
 *     axe-core is the runtime check.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { textareaVariants } from './textarea';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// 1. cva resolves the two states + four sizes
// ---------------------------------------------------------------------------

describe('textareaVariants — states resolve', () => {
  const states = ['default', 'error'] as const;

  for (const state of states) {
    it(`resolves state="${state}" to a non-empty class string`, () => {
      const cls = textareaVariants({ state: state as unknown as never });
      expect(typeof cls).toBe('string');
      expect(cls.length).toBeGreaterThan(0);
    });
  }
});

describe('textareaVariants — sizes resolve', () => {
  const sizes = ['default', 'md', 'sm', 'lg'] as const;

  for (const size of sizes) {
    it(`resolves size="${size}" to a non-empty class string`, () => {
      const cls = textareaVariants({ size: size as unknown as never });
      expect(typeof cls).toBe('string');
      expect(cls.length).toBeGreaterThan(0);
    });
  }

  it('md and default resolve to the same min-height (alias)', () => {
    const md = textareaVariants({ size: 'md' as unknown as never });
    const def = textareaVariants({ size: 'default' as unknown as never });
    for (const cls of [md, def]) {
      expect(cls).toContain('min-h-[96px]');
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Brand tokens (no hex literals leaked)
// ---------------------------------------------------------------------------

describe('textareaVariants — token consumption (spec §7.1)', () => {
  it('resolved class strings contain NO literal brand hex values', () => {
    const brandHexes = [
      '48608a', // navy
      'd9a428', // gold
      'a0aec1', // light-blue
      'eebd3c', // yellow
      '324d61', // dark-blue
      '333232', // charcoal
      '808897', // grey
      '6ec8c0', // advisory
    ];

    const states = ['default', 'error'];
    const sizes = ['default', 'md', 'sm', 'lg'];
    for (const state of states) {
      for (const size of sizes) {
        const cls = textareaVariants({
          state: state as unknown as never,
          size: size as unknown as never,
        });
        for (const hex of brandHexes) {
          const re = new RegExp(`#?${hex}`, 'i');
          expect(
            re.test(cls),
            `state="${state}" size="${size}" leaks hex "${hex}" — replace with a brand token (spec §7.1).`,
          ).toBe(false);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Default state IS brand-styled
// ---------------------------------------------------------------------------

describe('textareaVariants — default state is brand-styled', () => {
  it('default state references border-brand-light-blue', () => {
    const cls = textareaVariants({ state: 'default' as unknown as never });
    expect(cls).toContain('border-brand-light-blue');
  });

  it('default state references focus-visible:ring-brand-navy', () => {
    const cls = textareaVariants({ state: 'default' as unknown as never });
    expect(cls).toContain('focus-visible:ring-brand-navy');
  });

  it('default state references placeholder:text-brand-charcoal/70 (WCAG 1.4.3 AA fix — Playwright a11y PR #64)', () => {
    // Previously asserted `placeholder:text-brand-grey` (#808897), which fails
    // WCAG SC 1.4.3 against white (3.57:1 — below the 4.5:1 normal-text floor).
    // Switched to brand-charcoal at 70% alpha (effective ~#707070, 4.95:1).
    // See HANDOFF.md §"Placeholder contrast fix" for math + audit trail.
    const cls = textareaVariants({ state: 'default' as unknown as never });
    expect(cls).toContain('placeholder:text-brand-charcoal/70');
    expect(cls).not.toContain('placeholder:text-brand-grey');
  });

  it('default state references text-brand-charcoal (body text colour)', () => {
    const cls = textareaVariants({ state: 'default' as unknown as never });
    expect(cls).toContain('text-brand-charcoal');
  });
});

// ---------------------------------------------------------------------------
// 4. Error state uses the destructive token
// ---------------------------------------------------------------------------

describe('textareaVariants — error state uses destructive token', () => {
  it('error state references border-destructive', () => {
    const cls = textareaVariants({ state: 'error' as unknown as never });
    expect(cls).toContain('border-destructive');
  });

  it('error state references focus-visible:ring-destructive', () => {
    const cls = textareaVariants({ state: 'error' as unknown as never });
    expect(cls).toContain('focus-visible:ring-destructive');
  });

  it('error state does NOT leak a parallel brand-red token', () => {
    const cls = textareaVariants({ state: 'error' as unknown as never });
    expect(cls).not.toContain('brand-red');
  });
});

// ---------------------------------------------------------------------------
// 5. Defaults are `default` / `default` (not flipped)
// ---------------------------------------------------------------------------

describe('textareaVariants — defaults', () => {
  it('cva default state is "default" (not flipped)', () => {
    const src = readFileSync(resolve(__dirname, 'textarea.tsx'), 'utf-8');
    expect(src).toMatch(/defaultVariants:\s*\{\s*state:\s*'default'/);
  });

  it('cva default size is "default" (md is an alias)', () => {
    const src = readFileSync(resolve(__dirname, 'textarea.tsx'), 'utf-8');
    expect(src).toMatch(/defaultVariants:\s*\{[^}]*size:\s*'default'/);
  });
});
