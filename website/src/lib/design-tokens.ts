/**
 * design-tokens.ts — typed TypeScript mirror of the LSL Calculator design tokens
 *
 * E6.2 Task 2.4 — typed re-export of the Tailwind v4 theme tokens defined in
 * `src/app/globals.css`. The CSS file is the single source of truth; this
 * module mirrors the same names + resolved values so non-CSS contexts can
 * consume the brand palette / type scale / shadow + radius scales with full
 * TypeScript autocomplete + type-checking on token names.
 *
 * Primary consumer: `@react-pdf/renderer` templates in Phase 4 (impl-plan
 * §1.1 decision 1) — react-pdf renders to a PDF binary outside the browser
 * and cannot read CSS custom properties, so it needs the literal hex / rem
 * values at build time. Secondary consumer: `cva` variant authors in Task
 * 2.6 who want the `BrandColour` union type as a `cva` variant key set
 * (autocomplete instead of free-form string literals).
 *
 * Sync contract (CRITICAL — see design-tokens.test.ts):
 *   This file is HAND-AUTHORED. If you add, rename, or re-value a token in
 *   `src/app/globals.css`, you MUST update this file in the same commit. The
 *   companion test (`design-tokens.test.ts`) parses `globals.css` and fails
 *   the build if the two go out of sync.
 *
 * Why not auto-generate from globals.css?
 *   1. Tailwind v4's `@theme inline` block expresses values as `var(--x)`
 *      references that resolve at CSS compile time. Auto-generating literal
 *      values requires a CSS parser + variable-resolution pass — heavyweight
 *      for a ~30-token surface that changes once a quarter at most.
 *   2. The sync test parses the raw `:root` declarations (which carry the
 *      literal values) and asserts equality — same protection, no build-time
 *      generator.
 *
 * Sources of truth:
 *   - spec §5.1 — palette + typography pairing + type-scale ranges
 *   - spec §7.1 — token-first principle ("every component reads from tokens")
 *   - impl-plan §1.1 — "lib/tokens.ts = typed mirror for PDF context"
 *   - tasks.md Task 2.4 AC — `colors`, `fontSizes`, `spacing`, `radii`,
 *     `shadows` exports + unit test that asserts CSS ↔ TS parity
 *
 * NOT in this mirror (deliberate omissions):
 *   - `spacing` — Task 2.3 explicitly did not add spacing tokens (default
 *     Tailwind scale is adequate per icon-direction §4). `spacing` is exported
 *     as an empty `Readonly<Record<never, never>>` to honour the AC contract
 *     surface while not inventing tokens the CSS doesn't carry. If Task 2.6
 *     surfaces a friction point, both `globals.css` and this file get a
 *     synchronised `--spacing-*` token in the same PR.
 *   - shadcn semantic tokens (`--background`, `--primary`, …) — those use
 *     `oklch()` colour spaces and are dark-mode-aware. PDF context never
 *     renders them; component code reads them via Tailwind utilities. No
 *     value in mirroring them as TS literals.
 *   - Gradient utilities — exposed as TS literals (`gradients`) for
 *     completeness; PDF context can use them as background-image strings.
 *   - `--text-*` — exposed under `fontSizes` (the spec's role naming) rather
 *     than `textSizes` so the export name matches the AC wording exactly.
 */

// ---------------------------------------------------------------------------
// Colour tokens — APA sub-brand palette (spec §5.1)
// ---------------------------------------------------------------------------

/**
 * The 9 named brand colours. Each maps to a CSS custom property
 * `--brand-<name>` defined in `src/app/globals.css` and to a Tailwind utility
 * `bg-brand-<name>` / `text-brand-<name>` / `border-brand-<name>` / …
 *
 * Use the union type as a `cva` variant key set, or as the prop type for a
 * component that accepts a brand-colour selection.
 */
export type BrandColour =
  | 'brand-navy'
  | 'brand-gold'
  | 'brand-white'
  | 'brand-light-blue'
  | 'brand-yellow'
  | 'brand-dark-blue'
  | 'brand-charcoal'
  | 'brand-grey'
  | 'brand-advisory';

/**
 * Hex values for each brand colour. Exact spec §5.1 values — no rounding,
 * no derived shade scales. Renaming a key here without updating
 * `globals.css` (or vice versa) is a build break: see `design-tokens.test.ts`.
 */
export const colors: Readonly<Record<BrandColour, string>> = {
  'brand-navy': '#48608a',
  'brand-gold': '#d9a428',
  'brand-white': '#ffffff',
  'brand-light-blue': '#a0aec1',
  'brand-yellow': '#eebd3c',
  'brand-dark-blue': '#324d61',
  'brand-charcoal': '#333232',
  'brand-grey': '#808897',
  'brand-advisory': '#6ec8c0',
} as const;

// ---------------------------------------------------------------------------
// Type-scale tokens (spec §5.1 — APA Brand Guidelines p.18)
// ---------------------------------------------------------------------------

/**
 * Type-scale role + step. Each maps to a CSS custom property `--text-<name>`
 * and to a Tailwind utility `text-<name>` (e.g. `text-h1-min`,
 * `text-body-max`, `text-caption`).
 *
 * Title carries `-min` / `-mid` / `-max` because its 32–72pt range is
 * poster-scale (52pt midpoint = natural hero step). Other roles get
 * `-min` / `-max` since spec §5.1 publishes ranges, not single values.
 */
export type BrandTextSize =
  | 'title-min'
  | 'title-mid'
  | 'title-max'
  | 'h1-min'
  | 'h1-max'
  | 'h2-min'
  | 'h2-max'
  | 'h3-min'
  | 'h3-max'
  | 'body-min'
  | 'body-max'
  | 'caption';

/**
 * Rem values for each type step. Conversion: 1pt = 1/12 rem at 16px base
 * (spec §5.1). Rounded to 3 decimal places — same precision as the
 * `globals.css` declarations.
 */
export const fontSizes: Readonly<Record<BrandTextSize, string>> = {
  'title-min': '2.667rem', // 32pt — Montserrat Semibold
  'title-mid': '4.333rem', // 52pt — Montserrat Semibold
  'title-max': '6rem', // 72pt — Montserrat Semibold
  'h1-min': '1.833rem', // 22pt — Source Sans 3 Semibold
  'h1-max': '2.333rem', // 28pt — Source Sans 3 Semibold
  'h2-min': '1.5rem', // 18pt — Source Sans 3 Regular
  'h2-max': '1.667rem', // 20pt — Source Sans 3 Regular
  'h3-min': '1.167rem', // 14pt — Source Sans 3 Semibold
  'h3-max': '1.333rem', // 16pt — Source Sans 3 Semibold
  'body-min': '0.833rem', // 10pt — Source Sans 3 Regular
  'body-max': '1rem', // 12pt — Source Sans 3 Regular
  caption: '0.667rem', // 8pt — Source Sans 3 Regular
} as const;

// ---------------------------------------------------------------------------
// Radius tokens (spec §5.1 + icon-direction §4.3)
// ---------------------------------------------------------------------------

export type BrandRadius =
  | 'brand-sm'
  | 'brand-md'
  | 'brand-lg'
  | 'brand-xl'
  | 'brand-2xl';

export const radii: Readonly<Record<BrandRadius, string>> = {
  'brand-sm': '0.25rem', // 4px  — chip, badge
  'brand-md': '0.5rem', // 8px  — input, small card
  'brand-lg': '0.75rem', // 12px — card, modal panel
  'brand-xl': '1rem', // 16px — section panel
  'brand-2xl': '1.5rem', // 24px — hero surface, app-icon-grade
} as const;

// ---------------------------------------------------------------------------
// Shadow tokens (spec §7.3 — "Linear polish", brand-navy-tinted)
// ---------------------------------------------------------------------------

export type BrandShadow = 'brand-sm' | 'brand-md' | 'brand-lg';

/**
 * Three-tier soft-shadow scale. Tinted with `rgba(72, 96, 138, α)` — the
 * brand-navy hex at low alpha — so shadows under navy / gold / advisory
 * surfaces read true rather than muddy.
 *
 * Each value carries two stacked `box-shadow` rules separated by a comma,
 * matching the CSS declaration verbatim. Whitespace is normalised in the
 * sync test before comparison so the source can wrap declarations across
 * multiple lines for readability.
 */
export const shadows: Readonly<Record<BrandShadow, string>> = {
  'brand-sm':
    '0 1px 2px 0 rgba(72, 96, 138, 0.06), 0 1px 2px 0 rgba(72, 96, 138, 0.04)',
  'brand-md':
    '0 4px 6px -1px rgba(72, 96, 138, 0.08), 0 2px 4px -2px rgba(72, 96, 138, 0.06)',
  'brand-lg':
    '0 10px 24px -6px rgba(72, 96, 138, 0.10), 0 4px 10px -4px rgba(72, 96, 138, 0.06)',
} as const;

// ---------------------------------------------------------------------------
// Gradient utilities (spec §5.1 — backgrounds only, never under text)
// ---------------------------------------------------------------------------

export type BrandGradient = 'brand-navy-gold' | 'brand-navy-light-blue';

export const gradients: Readonly<Record<BrandGradient, string>> = {
  'brand-navy-gold': 'linear-gradient(135deg, #48608a 0%, #d9a428 100%)',
  'brand-navy-light-blue': 'linear-gradient(135deg, #48608a 0%, #a0aec1 100%)',
} as const;

// ---------------------------------------------------------------------------
// Spacing (AC compatibility surface — no tokens defined in Task 2.3)
// ---------------------------------------------------------------------------

/**
 * Spacing tokens — empty by design.
 *
 * Task 2.3 explicitly did not add spacing tokens to `globals.css` (default
 * Tailwind scale is adequate per icon-direction §4). This export exists to
 * honour the Task 2.4 AC contract ("export `spacing` …") with zero risk of
 * inventing values the CSS doesn't carry. If Task 2.6 surfaces a friction
 * point (e.g. a 14px step the Tailwind default scale lacks), add the token
 * to `globals.css` first, then mirror it here — the sync test enforces
 * parity in both directions.
 */
export type BrandSpacing = never;
export const spacing: Readonly<Record<BrandSpacing, string>> = {} as const;
