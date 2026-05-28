/**
 * design-tokens.test.ts — CSS ↔ TS sync guard
 *
 * E6.2 Task 2.4 AC: "Unit test confirms `lib/tokens.ts` values match
 * `tailwind.config.ts` source." Adapted to Tailwind v4 reality — source of
 * truth is `src/app/globals.css` `:root { … }` block (no
 * `tailwind.config.ts` exists; see Task 2.3 HANDOFF §2 SCOPE-NOTE).
 *
 * This test parses `globals.css` and asserts that every TS-side token in
 * `design-tokens.ts` matches the CSS-side declaration **exactly** (after
 * whitespace normalisation for multi-line shadow values).
 *
 * Load-bearing property: this test must FAIL when CSS and TS drift. Verified
 * manually during Task 2.4 development by mutating one value in
 * `design-tokens.ts` (e.g. changing `brand-navy` from `#48608a` to
 * `#48608b`) and confirming the test fails with a clear diff; then reverted.
 *
 * Parser strategy:
 *   - Read the file from disk (Node `fs`).
 *   - Extract only the `:root { … }` block — it carries literal values.
 *     The `@theme inline` block uses `var(--x)` references which would
 *     require a resolution pass to compare; the literal values live in
 *     `:root`.
 *   - For each token, match `--<name>: <value>;` with `<value>` allowed to
 *     span lines (shadow declarations stack two box-shadow rules across
 *     two lines for readability).
 *   - Normalise whitespace (collapse runs of \s+ to a single space) on both
 *     sides before equality check.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  colors,
  fontSizes,
  gradients,
  radii,
  shadows,
  spacing,
} from './design-tokens';

// Resolve from this test file → ../app/globals.css. Vitest runs from the
// `website/` directory so the relative path resolves the same way every
// time, regardless of which `npm test` invocation triggers it.
const GLOBALS_CSS_PATH = path.resolve(
  __dirname,
  '..',
  'app',
  'globals.css'
);

const cssSource = readFileSync(GLOBALS_CSS_PATH, 'utf8');

/**
 * Extract the `:root { … }` block from the CSS source. This is where the
 * literal token values live (the `@theme inline` block uses `var(--x)`
 * references and would require resolution to compare).
 */
function extractRootBlock(css: string): string {
  const match = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (!match) {
    throw new Error(
      'Could not locate :root { … } block in globals.css. ' +
        'Did the file structure change?'
    );
  }
  return match[1];
}

/**
 * Pull the value of a single CSS custom property out of the `:root` block.
 * The value can span multiple lines (e.g. multi-stop box-shadow) — match
 * everything up to the next semicolon. Whitespace is normalised on the
 * returned value so a CSS author can wrap a long declaration for
 * readability without breaking the test.
 *
 * Returns `null` if the token isn't declared in `:root` (lets the caller
 * produce a precise assertion failure naming the missing token).
 */
function readCssVar(rootBlock: string, name: string): string | null {
  // Anchor on `--<name>:` followed by lazy capture up to the next `;`.
  // The `\\b` after `<name>` prevents `--brand-navy` from also matching
  // `--brand-navy-gold`.
  const pattern = new RegExp(
    `--${escapeRegExp(name)}\\s*:\\s*([\\s\\S]*?);`,
    'm'
  );
  const match = rootBlock.match(pattern);
  if (!match) return null;
  return normaliseWhitespace(match[1]);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normaliseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

const rootBlock = extractRootBlock(cssSource);

describe('design-tokens.ts ↔ globals.css sync', () => {
  describe('colours', () => {
    for (const [name, expected] of Object.entries(colors)) {
      it(`--${name} matches globals.css`, () => {
        const cssValue = readCssVar(rootBlock, name);
        expect(
          cssValue,
          `Expected --${name} to be declared in :root of globals.css`
        ).not.toBeNull();
        expect(cssValue).toBe(normaliseWhitespace(expected));
      });
    }
  });

  describe('type scale', () => {
    for (const [name, expected] of Object.entries(fontSizes)) {
      const cssVarName = `text-${name}`;
      it(`--${cssVarName} matches globals.css`, () => {
        // Type-scale tokens live in @theme inline as direct literals (not
        // var() references), so scan the whole file rather than just :root.
        const cssValue = readCssVar(cssSource, cssVarName);
        expect(
          cssValue,
          `Expected --${cssVarName} to be declared in globals.css`
        ).not.toBeNull();
        expect(cssValue).toBe(normaliseWhitespace(expected));
      });
    }
  });

  describe('radii', () => {
    for (const [name, expected] of Object.entries(radii)) {
      const cssVarName = `radius-${name}`;
      it(`--${cssVarName} matches globals.css`, () => {
        const cssValue = readCssVar(rootBlock, cssVarName);
        expect(
          cssValue,
          `Expected --${cssVarName} to be declared in :root of globals.css`
        ).not.toBeNull();
        expect(cssValue).toBe(normaliseWhitespace(expected));
      });
    }
  });

  describe('shadows', () => {
    for (const [name, expected] of Object.entries(shadows)) {
      const cssVarName = `shadow-${name}`;
      it(`--${cssVarName} matches globals.css`, () => {
        const cssValue = readCssVar(rootBlock, cssVarName);
        expect(
          cssValue,
          `Expected --${cssVarName} to be declared in :root of globals.css`
        ).not.toBeNull();
        expect(cssValue).toBe(normaliseWhitespace(expected));
      });
    }
  });

  describe('gradients', () => {
    for (const [name, expected] of Object.entries(gradients)) {
      const cssVarName = `gradient-${name}`;
      it(`--${cssVarName} matches globals.css`, () => {
        const cssValue = readCssVar(rootBlock, cssVarName);
        expect(
          cssValue,
          `Expected --${cssVarName} to be declared in :root of globals.css`
        ).not.toBeNull();
        expect(cssValue).toBe(normaliseWhitespace(expected));
      });
    }
  });

  describe('spacing', () => {
    it('exports an empty record (no spacing tokens defined in Task 2.3)', () => {
      // AC compatibility surface — see design-tokens.ts header. If Task 2.6
      // adds a `--spacing-*` token to globals.css, this test must be updated
      // alongside the new entries in design-tokens.ts.
      expect(Object.keys(spacing)).toHaveLength(0);
    });

    it('asserts globals.css carries no --spacing-* declarations (so the empty TS mirror is correct)', () => {
      // Guard against the inverse drift: someone adds a --spacing-* token
      // to globals.css and forgets to mirror it here. Match in :root only —
      // Tailwind's internal spacing utilities are scoped under @theme.
      const spacingDecls = rootBlock.match(/--spacing-[a-z0-9-]+\s*:/g);
      expect(
        spacingDecls,
        'globals.css now declares --spacing-* tokens; mirror them in design-tokens.ts'
      ).toBeNull();
    });
  });

  describe('coverage guard', () => {
    it('every --brand-<colour> declared in :root is mirrored in colors', () => {
      const declared = Array.from(
        rootBlock.matchAll(/--brand-([a-z0-9-]+)\s*:/g)
      ).map((m) => `brand-${m[1]}`);
      const mirrored = Object.keys(colors);
      const missing = declared.filter((d) => !mirrored.includes(d));
      expect(
        missing,
        `globals.css declares brand colours not mirrored in design-tokens.ts: ${missing.join(', ')}`
      ).toEqual([]);
    });
  });
});
