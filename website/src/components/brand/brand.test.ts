/**
 * brand.test.ts — contract tests for the brand barrel components
 *
 * E6.2 Task 2.5, refreshed by the E6.2+ OQ-2 barrel-swap PR. Vitest runs in
 * `node` env (see `vitest.config.ts`) — these tests therefore assert
 * structural / contract properties + lightweight server-rendered HTML output.
 * Visual verification lives in Storybook (`brand.stories.tsx`) where the
 * axe-core addon scans each story for WCAG 2.2 AA violations.
 *
 * What this file covers:
 *
 *   1. The Wordmark variant → asset URL map points at files that the
 *      sync-brand-assets script declares it copies into `public/`. Catches
 *      the "I added a variant but forgot to wire the sync mapping" regression.
 *
 *   2. The Icon barrel re-exports every identifier listed in
 *      icon-direction.md §5 (the brand-v1 minimum). Drift here breaks the
 *      documented v1 surface contract.
 *
 *   3. The brand barrel is the ONLY file in `src/` that imports from
 *      `lucide-react` — outside the shadcn `ui/**` exemption documented in
 *      `eslint.config.mjs`. Actually, after the OQ-2 swap, Icon.tsx no
 *      longer imports `lucide-react` at all — the only allowed importers
 *      are the shadcn primitives.
 *
 *   4. **NEW (E6.2+ barrel swap)**: every named icon export renders
 *      `<use href="/icons/sprite.svg#<variant>--<name>">` with the right
 *      symbol id. Snapshot the 42 default-variant renders + spot-check
 *      active/disabled with a representative subset. Uses
 *      `react-dom/server`'s `renderToStaticMarkup` to render without DOM.
 *
 *   5. The Lockup default tagline matches spec §5.1 / §5.4 verbatim:
 *      "by Australian Payroll Association".
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Icon from './Icon';

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

// The brand-v1 minimum from icon-direction.md §5. New §5 additions must be
// appended here AND to Icon.tsx in the same PR.
const BRAND_V1_ICONS = [
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
] as const;

// The 43-icon OQ-2 production set (42 original + Minus, added to close the
// checkbox indeterminate-state gap). Mirrors `docs/brand/icons/production-inventory.md`.
// `[exportName, kebab-spriteName]` pairs — keeping both forms means a future
// rename in either dimension surfaces the drift here.
const OQ2_ICONS: ReadonlyArray<readonly [string, string]> = [
  ['Calculator', 'calculator'],
  ['User', 'user'],
  ['Users', 'users'],
  ['Building2', 'building-2'],
  ['LogOut', 'log-out'],
  ['CheckCircle2', 'check-circle-2'],
  ['AlertCircle', 'alert-circle'],
  ['AlertTriangle', 'alert-triangle'],
  ['Info', 'info'],
  ['HelpCircle', 'help-circle'],
  ['FileWarning', 'file-warning'],
  ['Lock', 'lock'],
  ['Unlock', 'unlock'],
  ['Bell', 'bell'],
  ['ArrowRight', 'arrow-right'],
  ['ArrowUpDown', 'arrow-up-down'],
  ['ChevronDown', 'chevron-down'],
  ['ChevronRight', 'chevron-right'],
  ['RotateCcw', 'rotate-ccw'],
  ['Menu', 'menu'],
  ['Plus', 'plus'],
  ['Minus', 'minus'],
  ['X', 'x'],
  ['Trash2', 'trash-2'],
  ['Check', 'check'],
  ['Circle', 'circle'],
  ['FileText', 'file-text'],
  ['FileUp', 'file-up'],
  ['Download', 'download'],
  ['Upload', 'upload'],
  ['BookOpen', 'book-open'],
  ['Play', 'play'],
  ['Loader2', 'loader-2'],
  ['Scale', 'scale'],
  ['TrendingDown', 'trending-down'],
  ['TrendingUp', 'trending-up'],
  ['GitCompareArrows', 'git-compare-arrows'],
  ['Tag', 'tag'],
  ['CalendarRange', 'calendar-range'],
  ['DollarSign', 'dollar-sign'],
  ['Settings', 'settings'],
  ['Search', 'search'],
  ['Filter', 'filter'],
] as const;

describe('Icon barrel', () => {
  it('re-exports every identifier listed in icon-direction.md §5', () => {
    for (const name of BRAND_V1_ICONS) {
      expect(
        typeof (Icon as Record<string, unknown>)[name],
        `Icon barrel is missing brand-v1 icon '${name}' (icon-direction.md §5).`,
      ).toBe('object');
    }
  });

  it('exports exactly the 43 components in the OQ-2 production inventory', () => {
    // Cross-check: every name in the inventory exists as a barrel export,
    // and no extra export has slipped in unannounced. "Unannounced" matters
    // because the sprite has a finite symbol set — an extra export would
    // render an icon whose symbol does not exist, leading to a broken
    // `<use>` ref at runtime.
    const exportedNames = Object.keys(Icon).filter(
      // Exported types (IconVariant, LslIconProps, LucideProps) are NOT
      // runtime values — they appear in Icon's export shape but not in the
      // runtime module object. Filter to component-shaped exports only.
      // forwardRef returns an object with `$$typeof` symbol; `typeof` returns
      // 'object'. Pre-filter to objects.
      (n) =>
        typeof (Icon as Record<string, unknown>)[n] === 'object' &&
        (Icon as Record<string, unknown>)[n] !== null,
    );

    const inventoryNames = OQ2_ICONS.map(([name]) => name);
    expect(exportedNames.sort()).toEqual([...inventoryNames].sort());
  });

  it('is the only file in src/ (outside shadcn ui/**) that imports from lucide-react', () => {
    // After the OQ-2 swap, Icon.tsx no longer imports `lucide-react` — the
    // sprite-based render path replaces every Lucide identifier. The only
    // remaining importers are the shadcn primitives in `src/components/ui/`,
    // documented in `eslint.config.mjs` as the "shadcn upgrade-path"
    // exemption. The Minus-icon gap that originally made the
    // `ui/checkbox.tsx` exemption load-bearing was closed by the follow-up
    // `design/oq-2-minus-icon` extension PR; the exemption stays only until
    // the burn-in cleanup PR migrates `ui/checkbox.tsx` to the brand barrel
    // and drops `lucide-react` from `package.json`.
    //
    // We re-use the eslint config's exempt set as the test's expected set.
    // If a new exempt path is added to eslint.config.mjs without updating
    // this list, the test fails — that's the desired behaviour, prompting
    // the reviewer to re-confirm the exemption's rationale.
    const allowed = [
      'src/components/ui/accordion.tsx',
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
// 3. Icon sprite-render contract — E6.2+ barrel swap
// ---------------------------------------------------------------------------

describe('Icon sprite render', () => {
  it('every default-variant icon renders <use href="/icons/sprite.svg#default--<name>">', () => {
    // The OQ-2 contract: rendering `<Users />` produces a `<use>` referencing
    // `/icons/sprite.svg#default--users`. If a future barrel change drifts
    // the sprite name away from the kebab-case of the export, this test
    // fails for the affected icon.
    for (const [exportName, spriteName] of OQ2_ICONS) {
      const Comp = (Icon as Record<string, React.ComponentType>)[exportName];
      const markup = renderToStaticMarkup(React.createElement(Comp));
      expect(
        markup,
        `Icon '${exportName}' did not render the expected sprite href`,
      ).toContain(`href="/icons/sprite.svg#default--${spriteName}"`);
      // Decorative-by-default a11y contract — when no aria-label is passed,
      // the wrapper sets aria-hidden="true". The Storybook RoundedSquareSurface
      // story exercises the aria-label override path; this test pins the
      // default.
      expect(markup).toContain('aria-hidden="true"');
      // viewBox 24×24 is the sprite's intrinsic canvas; the wrapper must
      // declare it for `<use>` to scale correctly in Safari fallback paths.
      expect(markup).toContain('viewBox="0 0 24 24"');
    }
  });

  it('active variant routes to the active-- sprite id', () => {
    // Spot-check three icons across the family — one with a gold accent
    // (Bell), one without (Users), one with state-specific semantics
    // (ArrowUpDown — active = active-sort indicator).
    for (const exportName of ['Bell', 'Users', 'ArrowUpDown']) {
      const Comp = (Icon as Record<string, React.ComponentType<{ variant?: string }>>)[
        exportName
      ];
      const markup = renderToStaticMarkup(
        React.createElement(Comp, { variant: 'active' }),
      );
      const [, spriteName] = OQ2_ICONS.find(([n]) => n === exportName)!;
      expect(markup).toContain(`href="/icons/sprite.svg#active--${spriteName}"`);
    }
  });

  it('disabled variant routes to the disabled-- sprite id', () => {
    for (const exportName of ['Settings', 'Calculator', 'Lock']) {
      const Comp = (Icon as Record<string, React.ComponentType<{ variant?: string }>>)[
        exportName
      ];
      const markup = renderToStaticMarkup(
        React.createElement(Comp, { variant: 'disabled' }),
      );
      const [, spriteName] = OQ2_ICONS.find(([n]) => n === exportName)!;
      expect(markup).toContain(`href="/icons/sprite.svg#disabled--${spriteName}"`);
    }
  });

  it('passes through className and aria-label overrides', () => {
    // The size mechanism is `className` — `h-{n} w-{n}` Tailwind utilities.
    // Aria-label overrides the decorative-by-default aria-hidden. Both
    // surfaces are exercised by real consumers (e.g. `<Trash2 className="h-4
    // w-4" aria-label="Delete row" />`); regress them here.
    const markup = renderToStaticMarkup(
      React.createElement(Icon.Trash2, {
        className: 'h-4 w-4',
        'aria-label': 'Delete row',
      }),
    );
    expect(markup).toContain('class="h-4 w-4"');
    expect(markup).toContain('aria-label="Delete row"');
    // With aria-label provided, aria-hidden should be ABSENT from the
    // output. (`aria-hidden` would mask the label from assistive tech.)
    expect(markup).not.toContain('aria-hidden');
  });

  it('sprite file at public/icons/sprite.svg contains all 129 expected symbol ids', () => {
    // Belt-and-braces: confirm the committed sprite asset matches the
    // inventory. If a contributor edits a source SVG and forgets to re-run
    // the sprite builder, this test fails — surfacing the drift before CI.
    const spritePath = resolve(__dirname, '../../../public/icons/sprite.svg');
    const sprite = readFileSync(spritePath, 'utf-8');
    for (const [, spriteName] of OQ2_ICONS) {
      for (const state of ['default', 'active', 'disabled']) {
        expect(
          sprite.includes(`id="${state}--${spriteName}"`),
          `Sprite is missing symbol '${state}--${spriteName}'. Did you forget to run 'node scripts/build-icon-sprite.mjs'?`,
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Lockup default tagline matches spec
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
