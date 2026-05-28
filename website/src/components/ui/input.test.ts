/**
 * input.test.ts — contract tests for the LSL brand Input
 *
 * E6.2 Task 2.6.b. Vitest runs in `node` env per `vitest.config.ts` — these
 * tests assert STRUCTURAL / CONTRACT properties of the cva config, not React
 * render output. Visual + a11y verification lives in Storybook (axe-core via
 * the addon, see input.stories.tsx) and is the canonical bar.
 *
 * What this file covers:
 *
 *   1. `inputVariants` exports the cva function and resolves the two states
 *      (default / error) plus all four sizes (default / md / sm / lg). Typos
 *      surface at the TS layer; this is the runtime backstop.
 *
 *   2. State variants reference brand tokens (no hard-coded hexes leaked
 *      into the class string). Catches "I forgot the token and dropped a
 *      literal hex" regression per spec §7.1.
 *
 *   3. Default state IS brand-styled (re-skin enumeration). The cva default
 *      resolves to a class string containing `border-brand-light-blue` +
 *      `focus-visible:ring-brand-navy` + `placeholder:text-brand-grey`. This
 *      assertion is the runtime backstop for the HANDOFF's documented
 *      re-skin — if someone accidentally reverts the default state to
 *      shadcn-neutral border-input, this test fails loudly.
 *
 *   4. Error state uses the destructive token (not a parallel brand-red).
 *      Mirrors Button destructive — single red across the design system.
 *
 *   5. The cva default variants are `state: 'default'` and `size: 'default'`
 *      (not flipped to `md` — `md` is an explicit alias for compatibility
 *      with the Button cascade).
 *
 * What this file does NOT cover (deferred to Storybook + QA):
 *   - axe-core a11y violations — those run inside Storybook stories with
 *     `parameters.a11y.test = 'error'`.
 *   - React render output / DOM — JSDOM is not configured for vitest in
 *     this project. Visual verification = Storybook.
 *   - Contrast-ratio assertions — pre-computed and documented in the
 *     input.tsx file header; axe-core is the runtime check.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { inputVariants } from './input';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// 1. cva resolves the two states + four sizes
// ---------------------------------------------------------------------------

describe('inputVariants — states resolve', () => {
  const states = ['default', 'error'] as const;

  for (const state of states) {
    it(`resolves state="${state}" to a non-empty class string`, () => {
      // cast through `never` — same pattern as button.test.ts. cva's overload
      // narrows the union strictly; runtime accepts any string.
      const cls = inputVariants({ state: state as unknown as never });
      expect(typeof cls).toBe('string');
      expect(cls.length).toBeGreaterThan(0);
    });
  }
});

describe('inputVariants — sizes resolve', () => {
  const sizes = ['default', 'md', 'sm', 'lg'] as const;

  for (const size of sizes) {
    it(`resolves size="${size}" to a non-empty class string`, () => {
      const cls = inputVariants({ size: size as unknown as never });
      expect(typeof cls).toBe('string');
      expect(cls.length).toBeGreaterThan(0);
    });
  }

  it('md and default resolve to the same height/padding (alias)', () => {
    const md = inputVariants({ size: 'md' as unknown as never });
    const def = inputVariants({ size: 'default' as unknown as never });
    // Both contain h-10 px-3 py-2 — the alias contract from the Button cascade.
    for (const cls of [md, def]) {
      expect(cls).toContain('h-10');
      expect(cls).toContain('px-3');
      expect(cls).toContain('py-2');
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Brand tokens (no hex literals leaked)
// ---------------------------------------------------------------------------

describe('inputVariants — token consumption (spec §7.1)', () => {
  it('resolved class strings contain NO literal brand hex values', () => {
    // The exact nine APA palette hexes from globals.css. If any appears
    // verbatim in a resolved class string, the cva config is leaking raw
    // values instead of referencing tokens.
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
        const cls = inputVariants({
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
// 3. Default state IS brand-styled (re-skin assertion)
// ---------------------------------------------------------------------------

describe('inputVariants — default state is brand-styled (RE-SKIN guard)', () => {
  // This is the runtime backstop for the documented re-skin of all 38
  // existing `<Input>` consumers. If someone accidentally reverts the default
  // state to shadcn-neutral (`border-input` etc.), these assertions fail
  // loudly and the cascade discipline is preserved.
  it('default state references border-brand-light-blue', () => {
    const cls = inputVariants({ state: 'default' as unknown as never });
    expect(cls).toContain('border-brand-light-blue');
  });

  it('default state references focus-visible:ring-brand-navy', () => {
    const cls = inputVariants({ state: 'default' as unknown as never });
    expect(cls).toContain('focus-visible:ring-brand-navy');
  });

  it('default state references placeholder:text-brand-grey', () => {
    const cls = inputVariants({ state: 'default' as unknown as never });
    expect(cls).toContain('placeholder:text-brand-grey');
  });

  it('default state references text-brand-charcoal (body text colour)', () => {
    const cls = inputVariants({ state: 'default' as unknown as never });
    expect(cls).toContain('text-brand-charcoal');
  });
});

// ---------------------------------------------------------------------------
// 4. Error state uses the destructive token (not parallel brand-red)
// ---------------------------------------------------------------------------

describe('inputVariants — error state uses destructive token', () => {
  it('error state references border-destructive', () => {
    const cls = inputVariants({ state: 'error' as unknown as never });
    expect(cls).toContain('border-destructive');
  });

  it('error state references focus-visible:ring-destructive', () => {
    const cls = inputVariants({ state: 'error' as unknown as never });
    expect(cls).toContain('focus-visible:ring-destructive');
  });

  it('error state does NOT leak a parallel brand-red token', () => {
    // Mirrors Button — there is one red in the system (the shadcn destructive
    // semantic). If a future PR introduces `--brand-red-destructive`, this
    // test should be updated deliberately; otherwise it catches drift.
    const cls = inputVariants({ state: 'error' as unknown as never });
    expect(cls).not.toContain('brand-red');
  });
});

// ---------------------------------------------------------------------------
// 5. Defaults are `default` / `default` (not flipped)
// ---------------------------------------------------------------------------

describe('inputVariants — defaults', () => {
  it('cva default state is "default" (not flipped)', () => {
    // Parse the source — cva does not expose default-variant introspection
    // via its public API.
    const inputSrc = readFileSync(
      resolve(__dirname, 'input.tsx'),
      'utf-8',
    );
    expect(inputSrc).toMatch(/defaultVariants:\s*\{\s*state:\s*'default'/);
  });

  it('cva default size is "default" (md is an alias)', () => {
    const inputSrc = readFileSync(
      resolve(__dirname, 'input.tsx'),
      'utf-8',
    );
    expect(inputSrc).toMatch(/defaultVariants:\s*\{[^}]*size:\s*'default'/);
  });
});
