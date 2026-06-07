/**
 * Icon — single barrel for every brand icon used in the app.
 *
 * E6.2+ OQ-2 production icon set (the load-bearing PR that flips Lucide OFF).
 * Until this PR, the barrel re-exported names from `lucide-react`; now it
 * renders the in-house "Encircled Stamp" set (Candidate C, selected
 * 2026-06-05) from `docs/brand/icons/{default,active,disabled}/*.svg`.
 *
 * Implementation strategy (per `docs/brand/icons/README.md` §"Barrel swap"):
 *
 *   1. A single sprite at `/icons/sprite.svg` (built by
 *      `scripts/build-icon-sprite.mjs`) contains 126 `<symbol>` definitions —
 *      one per (state × icon) pair, keyed by `<state>--<kebab-name>`.
 *   2. Each named export here is a thin `forwardRef` wrapper that renders
 *      `<svg><use href="/icons/sprite.svg#<state>--<name>" /></svg>`.
 *   3. The wrapper accepts `variant?: 'default' | 'active' | 'disabled'`
 *      (default = `'default'`). Sizing comes from `className` (`h-4 w-4`,
 *      `h-6 w-6`, …) — same convention every Lucide consumer already used.
 *   4. `aria-hidden="true"` is the default when neither `aria-hidden` nor
 *      `aria-label` is provided. Consumers that need an announced icon pass
 *      `aria-label` explicitly (e.g. a standalone icon-only button).
 *
 * Brand styling rules (`docs/brand/icon-direction.md` §3):
 *   Each SVG ships with its own hex-coded fills and strokes. The wrapper
 *   does NOT recolour at the consumer level — gold accents, navy stroke, and
 *   disabled grey-blue are baked into the source SVGs because the design is
 *   restraint-driven and `text-brand-*` Tailwind classes would let a careless
 *   consumer override the design system. Consumers control SIZE (via
 *   `className`) and STATE (via `variant`), not colour.
 *
 * Lint rule (`website/eslint.config.mjs`):
 *   Every file in `src/` (except shadcn primitives in `src/components/ui/**`)
 *   must import icons from this barrel. Direct `lucide-react` imports fail
 *   the build. The shadcn exemption is preserved because (a) shadcn upgrade
 *   commands re-emit `lucide-react` imports and (b) the burn-in window for
 *   the barrel swap is still open. The `Minus` icon was added in the
 *   follow-up extension PR (`design/oq-2-minus-icon`) so the indeterminate
 *   checkbox state has a brand-set glyph; the `ui/checkbox.tsx` migration
 *   to import `Minus` from this barrel is mechanical and lands with the
 *   cleanup PR that drops `lucide-react` from `package.json` and removes
 *   this exemption.
 *
 * One-release burn-in posture:
 *   `lucide-react` STAYS in `package.json` for at least one production
 *   release after this PR. If a real consumer surface reveals a glyph that
 *   needs to be redrawn, we can revert that one named export to Lucide
 *   while we redraw. The lint exemption for shadcn primitives keeps that
 *   path open mechanically. Drop the package after 7 days of clean prod.
 *
 * Usage:
 *   ```tsx
 *   import { Calculator, CheckCircle2 } from '@/components/brand/Icon';
 *
 *   <Calculator className="h-6 w-6" />
 *   <CheckCircle2 variant="active" className="h-4 w-4" />
 *   <Trash2 className="h-4 w-4" aria-label="Delete row" />
 *   ```
 */

import * as React from 'react';

/**
 * Sprite asset URL. Resolved against the public root — Next 16 serves
 * `public/icons/sprite.svg` at `/icons/sprite.svg`.
 *
 * The leading slash is required for SSR — `<use href="/…">` resolves
 * relative to the document origin both on the server (Next inlines an
 * absolute reference) and in the browser (the request is made once and
 * cached aggressively after the first paint).
 */
const SPRITE_HREF = '/icons/sprite.svg';

/**
 * Variant union. The three states are intrinsic to the brand stamp design
 * (navy / gold / muted) and ship as separate symbols in the sprite — the
 * wrapper does not transform colour on the fly.
 */
export type IconVariant = 'default' | 'active' | 'disabled';

/**
 * Props accepted by every brand icon component.
 *
 * Modelled after Lucide's `LucideProps` shape so the v1 swap was a pure
 * type-name rename. The `Omit<…, 'size'>` pattern used by `Spinner`
 * (see `src/components/ui/spinner.tsx`) keeps working because we expose the
 * same `className` + ref-forwarding + SVG-attribute spread surface.
 *
 * Notably ABSENT from Lucide's `LucideProps` here: `size`, `color`,
 * `strokeWidth`, `absoluteStrokeWidth`. The OQ-2 set is intentionally
 * non-recolourable (per direction §3) and non-resizeable-via-prop (per
 * shadcn ergonomics — size comes from Tailwind classes on `className`).
 * That removes four overrides a consumer might reach for that have no
 * runtime effect on the sprite — better to omit the props than silently
 * ignore them.
 */
export interface LslIconProps
  extends Omit<React.SVGAttributes<SVGSVGElement>, 'children'> {
  /**
   * State variant. Defaults to `'default'` (navy disc, white glyph).
   *
   *   - `'default'`  — canonical state (navy + white + selective gold)
   *   - `'active'`   — selected / pressed (gold disc, navy glyph)
   *   - `'disabled'` — feature-gated / no-permission (grey-blue + 60% opacity)
   */
  variant?: IconVariant;
}

/**
 * Backwards compatibility shim for the `LucideProps` type name. Three
 * consumers reference it (`Spinner`, `sidebar-routes`, `EmptyState`) and
 * codemodding the import sites is part of this PR. The alias stays exported
 * for a brief deprecation window so any downstream branch that imports
 * `LucideProps` from the barrel does not break — `LslIconProps` is the
 * preferred name going forward.
 *
 * @deprecated Use `LslIconProps`. Removed when `lucide-react` is removed
 * from `package.json` (one release after this PR ships).
 */
export type LucideProps = LslIconProps;

/**
 * Factory for the named icon components. Each invocation returns a
 * `forwardRef` component bound to a specific sprite symbol family
 * (e.g. `"users"` → renders `default--users`, `active--users`, or
 * `disabled--users` depending on the `variant` prop).
 *
 * Centralising the wrapper logic here (rather than duplicating it 43 times)
 * keeps the per-export footprint to a single line at the bottom of this
 * file and ensures the accessibility-default behaviour is identical across
 * every icon.
 */
function createIcon(spriteName: string, displayName: string) {
  const Component = React.forwardRef<SVGSVGElement, LslIconProps>(
    function BrandIcon(
      { variant = 'default', className, ...rest },
      ref,
    ) {
      // Accessibility default: if the consumer supplied neither `aria-label`
      // nor an explicit `aria-hidden`, treat the icon as decorative and hide
      // it from assistive tech. Consumers that need announcement pass
      // `aria-label="…"`; consumers that want to force visibility to a/t
      // pass `aria-hidden={false}` explicitly.
      const hasAriaLabel = typeof rest['aria-label'] === 'string';
      const hasExplicitAriaHidden = 'aria-hidden' in rest;
      const ariaHidden = hasExplicitAriaHidden
        ? rest['aria-hidden']
        : hasAriaLabel
          ? undefined
          : true;

      return (
        <svg
          ref={ref}
          className={className}
          // viewBox + xmlns mirror the symbol's intrinsic 24×24 canvas.
          // Without an explicit viewBox here, some user agents (notably
          // Safari < 14 fallback paths) refuse to scale `<use>` references.
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          // fill="none" matches the source SVG quality bar — strokes carry
          // the artwork. Overriding the wrapper's fill would break the
          // brand stamp (the disc would lose its navy/gold fill).
          fill="none"
          {...rest}
          aria-hidden={ariaHidden}
        >
          <use href={`${SPRITE_HREF}#${variant}--${spriteName}`} />
        </svg>
      );
    },
  );
  Component.displayName = displayName;
  return Component;
}

// ---------------------------------------------------------------------------
// Icon exports — the 43 components in the OQ-2 production set
// (42 original + Minus, added to close the checkbox indeterminate-state gap).
//
// Order mirrors `docs/brand/icons/production-inventory.md` so a reader can
// scan top-to-bottom and trace each export back to its semantic + consumer
// surface. Each `createIcon(...)` call pairs the sprite symbol name
// (kebab-case, matches the source SVG filename) with the PascalCase
// TypeScript export name (matches what every consumer already imports).
//
// Adding a new icon: drop the three state SVGs into `docs/brand/icons/`,
// run `node scripts/build-icon-sprite.mjs`, then add a line here.
// ---------------------------------------------------------------------------

// Calculator / measurement
export const Calculator = createIcon('calculator', 'Calculator');

// People / tenancy
export const User = createIcon('user', 'User');
export const Users = createIcon('users', 'Users');
export const Building2 = createIcon('building-2', 'Building2');
export const LogOut = createIcon('log-out', 'LogOut');

// Status / signals
export const CheckCircle2 = createIcon('check-circle-2', 'CheckCircle2');
export const AlertCircle = createIcon('alert-circle', 'AlertCircle');
export const AlertTriangle = createIcon('alert-triangle', 'AlertTriangle');
export const Info = createIcon('info', 'Info');
export const HelpCircle = createIcon('help-circle', 'HelpCircle');
export const FileWarning = createIcon('file-warning', 'FileWarning');
export const Lock = createIcon('lock', 'Lock');
export const Unlock = createIcon('unlock', 'Unlock');
export const Bell = createIcon('bell', 'Bell');

// Navigation / motion
export const ArrowRight = createIcon('arrow-right', 'ArrowRight');
export const ArrowUpDown = createIcon('arrow-up-down', 'ArrowUpDown');
export const ChevronDown = createIcon('chevron-down', 'ChevronDown');
export const ChevronRight = createIcon('chevron-right', 'ChevronRight');
export const RotateCcw = createIcon('rotate-ccw', 'RotateCcw');
export const Menu = createIcon('menu', 'Menu');

// Editing / IO
export const Plus = createIcon('plus', 'Plus');
export const Minus = createIcon('minus', 'Minus');
export const X = createIcon('x', 'X');
export const Trash2 = createIcon('trash-2', 'Trash2');
export const Check = createIcon('check', 'Check');
export const Circle = createIcon('circle', 'Circle');

// Files / reports
export const FileText = createIcon('file-text', 'FileText');
export const FileUp = createIcon('file-up', 'FileUp');
export const Download = createIcon('download', 'Download');
export const Upload = createIcon('upload', 'Upload');
export const BookOpen = createIcon('book-open', 'BookOpen');

// Process
export const Play = createIcon('play', 'Play');
export const Loader2 = createIcon('loader-2', 'Loader2');
export const Scale = createIcon('scale', 'Scale');
export const TrendingDown = createIcon('trending-down', 'TrendingDown');
export const TrendingUp = createIcon('trending-up', 'TrendingUp');
export const GitCompareArrows = createIcon(
  'git-compare-arrows',
  'GitCompareArrows',
);

// Taxonomy / categorisation
export const Tag = createIcon('tag', 'Tag');

// Brand-v1 §5 — present for OQ-2 surface parity
export const CalendarRange = createIcon('calendar-range', 'CalendarRange');
export const DollarSign = createIcon('dollar-sign', 'DollarSign');
export const Settings = createIcon('settings', 'Settings');
export const Search = createIcon('search', 'Search');
export const Filter = createIcon('filter', 'Filter');
