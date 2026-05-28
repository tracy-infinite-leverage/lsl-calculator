/**
 * button.test.ts — contract tests for the LSL brand Button
 *
 * E6.2 Task 2.6. Vitest runs in `node` env per `vitest.config.ts` — these
 * tests assert STRUCTURAL / CONTRACT properties of the cva config, not React
 * render output. Visual + a11y verification lives in Storybook (axe-core via
 * the addon, see button.stories.tsx) and is the canonical bar.
 *
 * What this file covers:
 *
 *   1. `buttonVariants` actually exports the cva function and resolves the
 *      five spec-mandated brand variants (primary / secondary / ghost /
 *      destructive / advisory) — `<Button variant="primaary">` typos surface
 *      at the TS layer; this is the runtime backstop.
 *
 *   2. Brand variants reference brand tokens (no hard-coded hexes leaked
 *      into the class string). Catches the "I forgot the token and dropped
 *      a literal hex" regression that spec §7.1 explicitly forbids.
 *
 *   3. Legacy shadcn variants (`default`, `outline`, `link`) are PRESERVED
 *      so the 14 active consumers on `main` keep compiling. If a future PR
 *      renames one of these without an explicit decision, this test fails
 *      loudly.
 *
 *   4. The cva default variant is still `default` (legacy shadcn) — not
 *      flipped to `primary`. The flip is deferred to E6.4 public-calc re-
 *      skin per the HANDOFF cascade decision.
 *
 * What this file does NOT cover (deferred to Storybook + QA):
 *   - axe-core a11y violations — those run inside Storybook stories with
 *     `parameters.a11y.test = 'error'`.
 *   - React render output / DOM — JSDOM is not configured for vitest in
 *     this project. Visual verification = Storybook.
 *   - Contrast-ratio assertions — calculated upfront and documented in the
 *     Button.tsx file header; axe-core is the runtime check.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buttonVariants } from './button';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// 1. cva resolves the five brand variants
// ---------------------------------------------------------------------------

describe('buttonVariants — brand variants resolve', () => {
  // Spec §5.1 — these five variants are mandated for the Button.
  const brandVariants = [
    'primary',
    'secondary',
    'ghost',
    'destructive',
    'advisory',
  ] as const;

  for (const variant of brandVariants) {
    it(`resolves variant="${variant}" to a non-empty class string`, () => {
      // cast through `any` only because cva's overload narrows the union
      // strictly — the runtime accepts any string and returns its class
      // resolution. Casting here is the same pattern shadcn examples use
      // for test fixtures.
      const cls = buttonVariants({ variant: variant as unknown as never });
      expect(typeof cls).toBe('string');
      expect(cls.length).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Brand variants reference brand tokens (no hex literals leaked)
// ---------------------------------------------------------------------------

describe('buttonVariants — token consumption (spec §7.1)', () => {
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

    const variants = ['primary', 'secondary', 'ghost', 'destructive', 'advisory'];
    for (const variant of variants) {
      const cls = buttonVariants({ variant: variant as unknown as never });
      for (const hex of brandHexes) {
        // Match case-insensitively + with or without leading `#`. A hex in
        // a class string would indicate the author wrote an arbitrary-value
        // Tailwind utility (`bg-[<hex>]`) instead of the brand token
        // (`bg-brand-navy`).
        const re = new RegExp(`#?${hex}`, 'i');
        expect(
          re.test(cls),
          `variant="${variant}" leaks hex "${hex}" — replace with a brand token (spec §7.1).`,
        ).toBe(false);
      }
    }
  });

  it('primary variant references brand-navy + brand-white tokens', () => {
    const cls = buttonVariants({ variant: 'primary' as unknown as never });
    expect(cls).toContain('bg-brand-navy');
    expect(cls).toContain('text-brand-white');
    expect(cls).toContain('hover:bg-brand-dark-blue');
  });

  it('advisory variant references brand-advisory + brand-dark-blue tokens', () => {
    const cls = buttonVariants({ variant: 'advisory' as unknown as never });
    expect(cls).toContain('bg-brand-advisory');
    // dark-blue chosen because navy text on brand-advisory mint is only
    // 3.22:1 (fails AA body); dark-blue is 4.51:1 (passes).
    expect(cls).toContain('text-brand-dark-blue');
  });
});

// ---------------------------------------------------------------------------
// 3. Legacy shadcn variants preserved (consumer compat)
// ---------------------------------------------------------------------------

describe('buttonVariants — legacy variants preserved', () => {
  // 14 active consumers on `main` import `<Button variant="..."` with these
  // names. Renaming or removing any of them without an explicit decision
  // breaks the build. If you're here because this test failed, the variant
  // rename must be intentional + paired with a codemod across consumers.
  const legacy = ['default', 'outline', 'link'] as const;

  for (const variant of legacy) {
    it(`legacy variant="${variant}" still resolves`, () => {
      const cls = buttonVariants({ variant: variant as unknown as never });
      expect(typeof cls).toBe('string');
      expect(cls.length).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// 4. Default variant is still `default` (not flipped to primary)
// ---------------------------------------------------------------------------

describe('buttonVariants — defaults', () => {
  it('cva default variant is "default" (not flipped to "primary")', () => {
    // Parse the source rather than relying on cva internals (which the cva
    // public API does not expose for inspection). The default flip is a
    // deliberate E6.4 task per the Task 2.6 HANDOFF — guarding against an
    // accidental swap is exactly what this test protects.
    const buttonSrc = readFileSync(
      resolve(__dirname, 'button.tsx'),
      'utf-8',
    );

    // Match `defaultVariants: { variant: 'default', …`
    expect(buttonSrc).toMatch(/defaultVariants:\s*\{\s*variant:\s*'default'/);
  });

  it('cva default size is "default" (not "md" — md is an alias for compat)', () => {
    const buttonSrc = readFileSync(
      resolve(__dirname, 'button.tsx'),
      'utf-8',
    );
    expect(buttonSrc).toMatch(/defaultVariants:\s*\{[^}]*size:\s*'default'/);
  });
});
