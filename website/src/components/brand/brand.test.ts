/**
 * brand.test.ts — contract tests for the brand barrel components
 *
 * E6.2 Task 2.5. Vitest runs in `node` env (see `vitest.config.ts`) — these
 * tests therefore assert structural / contract properties, not React render
 * output. Visual verification lives in Storybook (`brand.stories.tsx`) where
 * the axe-core addon scans each story for WCAG 2.2 AA violations.
 *
 * What this file covers:
 *
 *   1. The Wordmark variant → asset URL map points at files that the
 *      sync-brand-assets script declares it copies into `public/`. Catches
 *      the "I added a variant but forgot to wire the sync mapping" regression.
 *
 *   2. The Icon barrel re-exports every identifier listed in
 *      icon-direction.md §5 (the "Lucide v1 styling map" — the 15 brand-v1
 *      icons). New icons can be added to the barrel; removing one from §5
 *      without removing it here surfaces the drift.
 *
 *   3. The Lockup default tagline matches spec §5.1 / §5.4 verbatim:
 *      "by Australian Payroll Association".
 *
 * What this file does NOT cover (deferred to Storybook + QA):
 *   - Visual rendering / DOM output. JSDOM is not configured for vitest;
 *     adding it for three tiny components is heavy.
 *   - axe-core a11y assertions — those run inside Storybook stories.
 *   - Lucide icon image output — that's lucide-react's own test surface.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// 1. Wordmark variant → asset URL contract
// ---------------------------------------------------------------------------

describe('Wordmark', () => {
  it('every variant URL maps to a file the sync script copies into /public/', () => {
    // Read the Wordmark source — it carries `VARIANT_TO_SRC` as a literal
    // object. Read sync-brand-assets.mjs — it carries the canonical mapping
    // table. Assert every URL on the right-hand side of `VARIANT_TO_SRC`
    // appears in the sync script's mapping. Drift here = 404 in production.
    const wordmarkSrc = readFileSync(
      resolve(__dirname, 'Wordmark.tsx'),
      'utf-8',
    );
    const syncSrc = readFileSync(
      resolve(__dirname, '../../../scripts/sync-brand-assets.mjs'),
      'utf-8',
    );

    // Extract the `default | mono | inverse` → URL pairs from Wordmark.
    // Greedy enough to handle re-ordering or whitespace changes.
    const variantUrlPairs = [
      ...wordmarkSrc.matchAll(
        /^\s*(default|mono|inverse):\s*'(\/brand\/[^']+)'/gm,
      ),
    ].map((m) => ({ variant: m[1], url: m[2] }));

    expect(variantUrlPairs).toHaveLength(3);

    for (const { variant, url } of variantUrlPairs) {
      // The sync script maps `[srcRel, destRel]` tuples. `destRel` is the
      // public-tree-relative path (without leading `/`). Strip the leading
      // slash and assert presence as a quoted string. Cheap, robust.
      const destRel = url.replace(/^\//, '');
      expect(
        syncSrc.includes(`'${destRel}'`),
        `Wordmark variant '${variant}' references '${url}' but sync-brand-assets.mjs has no mapping for '${destRel}'.`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Icon barrel ↔ icon-direction.md §5 sync
// ---------------------------------------------------------------------------

describe('Icon barrel', () => {
  it('re-exports every identifier listed in icon-direction.md §5', () => {
    const iconSrc = readFileSync(
      resolve(__dirname, 'Icon.tsx'),
      'utf-8',
    );

    // icon-direction.md §5 — the "Lucide v1 styling map". The full v1
    // minimum is mirrored here; the doc is the source of truth and the
    // barrel MUST be a superset of this list (OQ-2 swap contract). If a new
    // identifier is added to §5, append it here AND to Icon.tsx in the same
    // PR. Spec-mandated icons stay in the assertion array even when no
    // consumer currently imports them — that is the whole point of the
    // contract.
    const brandV1Icons = [
      'Calculator',
      'User',
      'Users',
      'CalendarRange',
      'CheckCircle2',
      'DollarSign',
      'FileText',
      'Settings',
      'Search',
      'ArrowUpDown',
      'Filter',
      'Plus',
      'Trash2',
      'Building2',
      'HelpCircle',
      'AlertTriangle',
    ];

    for (const name of brandV1Icons) {
      // Match `\bIcon,\b` or `\bIcon\n` in the export list. Tolerates
      // whitespace variation but rejects substring false positives.
      const re = new RegExp(`(^|\\s)${name}(,|\\s|$)`, 'm');
      expect(
        re.test(iconSrc),
        `Icon barrel is missing brand-v1 icon '${name}' (icon-direction.md §5).`,
      ).toBe(true);
    }
  });

  it('is the only file in src/ that imports from lucide-react', () => {
    // Walk src/ and check `import … from 'lucide-react'`. Two known
    // exceptions: Icon.tsx itself, and the shadcn `ui/` primitives (eslint
    // override documented; spec §7.2 "preserve upgrade path"). Anything else
    // means a stray direct import has slipped in.
    //
    // We re-use the eslint config's exempt set as the test's expected set —
    // not a substring grep into eslint.config.mjs (brittle), but a literal
    // path-prefix check against a small allowlist. If a new exempt path is
    // added to eslint.config.mjs without updating this test, the test fails
    // — that's the desired behaviour, prompting the reader to re-confirm
    // the upgrade-path rationale.
    const allowed = [
      'src/components/brand/Icon.tsx',
      'src/components/ui/accordion.tsx',
      'src/components/ui/button.tsx',
      'src/components/ui/checkbox.tsx',
      'src/components/ui/dialog.tsx',
      'src/components/ui/dropdown-menu.tsx',
      'src/components/ui/radio-group.tsx',
      'src/components/ui/select.tsx',
    ];

    // Tiny recursive walker; vitest's `node:fs` is fine for ~50 files.
    const srcRoot = resolve(__dirname, '../../..');

    function walk(dir: string, hits: string[] = []): string[] {
      for (const entry of readdirSync(dir)) {
        const full = `${dir}/${entry}`;
        const s = statSync(full);
        if (s.isDirectory()) {
          if (entry === 'node_modules' || entry === '.next') continue;
          walk(full, hits);
        } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.(ts|tsx)$/.test(entry)) {
          // Skip test files — this test itself contains the literal regex
          // string `'lucide-react'` which the walker would otherwise flag.
          hits.push(full);
        }
      }
      return hits;
    }

    const offenders: string[] = [];
    for (const file of walk(resolve(srcRoot, 'src'))) {
      const content = readFileSync(file, 'utf-8');
      // Match `from 'lucide-react'` (single or double quote, named or
      // default import). Skip pure `import 'lucide-react'` side-effect
      // imports — none exist today but they would be syntactically allowed.
      if (/from\s+['"]lucide-react['"]/.test(content)) {
        // Normalise to the src-relative path the allowlist uses.
        const rel = file.replace(`${srcRoot}/`, '');
        if (!allowed.includes(rel)) {
          offenders.push(rel);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Lockup default tagline matches spec
// ---------------------------------------------------------------------------

describe('Lockup', () => {
  it('default tagline is the brand-mandated "by Australian Payroll Association"', () => {
    const lockupSrc = readFileSync(
      resolve(__dirname, 'Lockup.tsx'),
      'utf-8',
    );
    // The default is a string literal in the prop destructure — easy to
    // grep. Spec §5.1 ("MUST ship a sub-brand wordmark ... with explicit
    // 'by Australian Payroll Association' lockup") and §5.4 (footer)
    // both require this exact phrasing.
    expect(lockupSrc).toMatch(/tagline = 'by Australian Payroll Association'/);
  });
});
