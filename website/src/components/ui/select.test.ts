/**
 * select.test.ts — contract tests for the LSL brand Select
 *
 * E6.2 Task 2.6.d. The cva surface is on the **Trigger** only (Content + Item
 * have fixed brand styling, no variants today). These tests assert the
 * Trigger's structural/contract properties + the Content/Item brand-token
 * usage via source-file inspection.
 *
 * Coverage:
 *   1. `selectTriggerVariants` exports + resolves both states (default /
 *      error) and all four sizes (default / md / sm / lg).
 *   2. State variants reference brand tokens — no hex leakage (spec §7.1).
 *   3. Default state IS brand-styled — runtime backstop against accidental
 *      revert to shadcn-neutral `border-input`.
 *   4. Error state uses the destructive token (single red across the system).
 *   5. cva defaults are `state: 'default'` and `size: 'default'`.
 *   6. SelectContent + SelectItem source references brand tokens directly —
 *      these are fixed-styled so the structural test parses source rather
 *      than resolving cva.
 *
 * What this file does NOT cover (deferred to Storybook + QA):
 *   - axe-core a11y violations — those run in Storybook (the Open story
 *     forces the popover into the DOM so the scanner sees Content + Item).
 *   - React render output / DOM — JSDOM is not configured for vitest.
 *   - Radix Portal behaviour — covered by Radix's own test suite upstream.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { selectTriggerVariants } from './select';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// 1. cva resolves the two states + four sizes
// ---------------------------------------------------------------------------

describe('selectTriggerVariants — states resolve', () => {
  const states = ['default', 'error'] as const;

  for (const state of states) {
    it(`resolves state="${state}" to a non-empty class string`, () => {
      const cls = selectTriggerVariants({ state: state as unknown as never });
      expect(typeof cls).toBe('string');
      expect(cls.length).toBeGreaterThan(0);
    });
  }
});

describe('selectTriggerVariants — sizes resolve', () => {
  const sizes = ['default', 'md', 'sm', 'lg'] as const;

  for (const size of sizes) {
    it(`resolves size="${size}" to a non-empty class string`, () => {
      const cls = selectTriggerVariants({ size: size as unknown as never });
      expect(typeof cls).toBe('string');
      expect(cls.length).toBeGreaterThan(0);
    });
  }

  it('md and default resolve to the same height/padding (alias)', () => {
    const md = selectTriggerVariants({ size: 'md' as unknown as never });
    const def = selectTriggerVariants({
      size: 'default' as unknown as never,
    });
    for (const cls of [md, def]) {
      expect(cls).toContain('h-10');
      expect(cls).toContain('px-3');
      expect(cls).toContain('py-2');
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Brand tokens (no hex literals leaked) — Trigger cva
// ---------------------------------------------------------------------------

describe('selectTriggerVariants — token consumption (spec §7.1)', () => {
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

    const states = ['default', 'error'];
    const sizes = ['default', 'md', 'sm', 'lg'];
    for (const state of states) {
      for (const size of sizes) {
        const cls = selectTriggerVariants({
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
// 3. Default state IS brand-styled (Trigger)
// ---------------------------------------------------------------------------

describe('selectTriggerVariants — default state is brand-styled (RE-SKIN guard)', () => {
  it('default state references border-brand-light-blue', () => {
    const cls = selectTriggerVariants({
      state: 'default' as unknown as never,
    });
    expect(cls).toContain('border-brand-light-blue');
  });

  it('default state references focus-visible:ring-brand-navy', () => {
    const cls = selectTriggerVariants({
      state: 'default' as unknown as never,
    });
    expect(cls).toContain('focus-visible:ring-brand-navy');
  });

  it('default state references data-[placeholder]:text-brand-charcoal/70 (WCAG 1.4.3 AA fix — Playwright a11y PR #64)', () => {
    // Radix uses `data-placeholder` (not `placeholder:` pseudo) on the
    // SelectValue when no option is picked. Previously asserted
    // `data-[placeholder]:text-brand-grey` (#808897), which fails WCAG SC 1.4.3
    // against white (3.57:1 — below the 4.5:1 normal-text floor). Switched to
    // brand-charcoal at 70% alpha (effective ~#707070, 4.95:1).
    // See HANDOFF.md §"Placeholder contrast fix" for math + audit trail.
    const cls = selectTriggerVariants({
      state: 'default' as unknown as never,
    });
    expect(cls).toContain('data-[placeholder]:text-brand-charcoal/70');
    expect(cls).not.toContain('data-[placeholder]:text-brand-grey');
  });

  it('default state references text-brand-charcoal (body text colour)', () => {
    const cls = selectTriggerVariants({
      state: 'default' as unknown as never,
    });
    expect(cls).toContain('text-brand-charcoal');
  });
});

// ---------------------------------------------------------------------------
// 4. Error state uses the destructive token
// ---------------------------------------------------------------------------

describe('selectTriggerVariants — error state uses destructive token', () => {
  it('error state references border-destructive', () => {
    const cls = selectTriggerVariants({ state: 'error' as unknown as never });
    expect(cls).toContain('border-destructive');
  });

  it('error state references focus-visible:ring-destructive', () => {
    const cls = selectTriggerVariants({ state: 'error' as unknown as never });
    expect(cls).toContain('focus-visible:ring-destructive');
  });

  it('error state does NOT leak a parallel brand-red token', () => {
    const cls = selectTriggerVariants({ state: 'error' as unknown as never });
    expect(cls).not.toContain('brand-red');
  });
});

// ---------------------------------------------------------------------------
// 5. Defaults are `default` / `default` (not flipped)
// ---------------------------------------------------------------------------

describe('selectTriggerVariants — defaults', () => {
  it('cva default state is "default"', () => {
    const src = readFileSync(resolve(__dirname, 'select.tsx'), 'utf-8');
    expect(src).toMatch(/defaultVariants:\s*\{\s*state:\s*'default'/);
  });

  it('cva default size is "default" (md is an alias)', () => {
    const src = readFileSync(resolve(__dirname, 'select.tsx'), 'utf-8');
    expect(src).toMatch(/defaultVariants:\s*\{[^}]*size:\s*'default'/);
  });
});

// ---------------------------------------------------------------------------
// 6. SelectContent + SelectItem brand-token usage (source inspection)
// ---------------------------------------------------------------------------

describe('SelectContent — brand-styled surface', () => {
  const src = readFileSync(resolve(__dirname, 'select.tsx'), 'utf-8');

  it('Content references bg-brand-white (popover surface)', () => {
    expect(src).toContain('bg-brand-white');
  });

  it('Content references border-brand-light-blue (hairline)', () => {
    expect(src).toContain('border-brand-light-blue');
  });

  it('Content references shadow-brand-md (Linear-polish per spec §7.3)', () => {
    expect(src).toContain('shadow-brand-md');
  });
});

describe('SelectItem — brand-styled rows', () => {
  const src = readFileSync(resolve(__dirname, 'select.tsx'), 'utf-8');

  it('Item references text-brand-charcoal (default text)', () => {
    expect(src).toContain('text-brand-charcoal');
  });

  it('Item references focus:bg-brand-light-blue/20 (hover/focus tint)', () => {
    expect(src).toContain('focus:bg-brand-light-blue/20');
  });

  it('Item references focus:text-brand-navy (hover/focus text)', () => {
    expect(src).toContain('focus:text-brand-navy');
  });

  it('Item selected state references text-brand-navy', () => {
    expect(src).toContain('data-[state=checked]:text-brand-navy');
  });

  it('Item indicator Check icon references text-brand-navy', () => {
    // The check icon inside `<SelectPrimitive.ItemIndicator>` should be
    // navy-tinted (matches the selected-state text colour).
    expect(src).toMatch(/<Check\b[^>]*text-brand-navy/);
  });
});
