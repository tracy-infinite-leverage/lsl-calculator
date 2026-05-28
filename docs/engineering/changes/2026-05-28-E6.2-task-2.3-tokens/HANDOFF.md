# HANDOFF — E6.2 Task 2.3: Tailwind theme tokens

**Date:** 2026-05-28
**Branch:** `feat/E6.2-task-2.3-tokens` (cut from `origin/main` at `5ceb8e4`)
**Status:** Implementation complete; awaiting QA verification before commit / push / PR.
**Author:** developer agent
**Predecessors merged:** PR #55 (Task 2.1 — Storybook 9 + axe-core), PR #56 (Task 2.2 — self-hosted fonts)
**Successor (next):** Task 2.4 — `lib/tokens.ts` typed mirror for PDF context

---

## 1. Scope

Implement the **APA sub-brand token layer** for the LSL Calculator design system. Per the spec §8.2 AC: "Tailwind theme extension committed with all brand colour tokens, gradient utilities, type-scale tokens, shadow tokens, radius tokens." No component code, no shadcn variants, no story authoring — those land in Tasks 2.5 and 2.6.

Specifically, Task 2.3 lands:

1. **Brand palette** — 9 named colours from spec §5.1 as Tailwind v4 colour tokens.
2. **Gradient utilities** — 2 background-only gradients (navy↔gold, navy↔light-blue).
3. **Type-scale tokens** — 12 size tokens covering Title / H1 / H2 / H3 / Body / Caption per APA p.18.
4. **Font-family tokens** — `--font-heading` (Montserrat) and `--font-sans` (Source Sans 3) already wired in Task 2.2; Task 2.3 leaves them in place and adds the type-scale that consumes them.
5. **Shadow scale** — 3-tier soft shadow tinted with brand-navy for "Linear polish".
6. **Radius scale** — 5-step (sm / md / lg / xl / 2xl) brand-rounded geometry.

Out of scope (per tasks.md):
- `lib/tokens.ts` typed mirror → Task 2.4
- Component code, shadcn variants → Task 2.6
- Storybook stories for the tokens → Task 2.5 or follow-up (the Welcome MDX already flags "Tokens added in Task 2.3")
- Spacing scale extension → Tailwind v4's default spacing scale is already adequate; no opinionated override needed (verified against icon-direction §4 sizing conventions, which use Tailwind defaults: 4, 8, 16, 24, 44, 56, 64, 80, 120, 180px — all expressible as `w-*` / `h-*` / `p-*` without new tokens).

---

## 2. [SCOPE-NOTE] Tailwind v4 architecture vs spec wording

**Spec §8.2 AC reads:** "Tailwind theme extension committed under `website/tailwind.config.{js,ts}` with all brand colour tokens, gradient utilities, type-scale tokens, shadow tokens, radius tokens."

**Reality on `main`:** the website is on **Tailwind v4** (verified — `tailwindcss@^4`, `@tailwindcss/postcss@^4`, no `tailwind.config.ts` exists). Tailwind v4 adopted a **CSS-first config** — theme tokens are defined in CSS via the `@theme inline { ... }` block, not in a JavaScript / TypeScript config file. The official Tailwind v4 migration guide deprecates the JS config except for plugin authors.

**Decision:** I land the tokens in `website/src/app/globals.css` under the existing `@theme inline { ... }` block — the same block Task 2.2 used for font tokens. This:

1. Satisfies the AC **intent** in full — every brand colour, gradient, type-step, shadow, and radius is now a Tailwind theme token, exposed via the `bg-*`, `text-*`, `border-*`, `shadow-*`, `rounded-*` utility families. Spec §7.1 ("token-first; no hard-coded brand values in component CSS") is fully enforceable.
2. Avoids inventing a `tailwind.config.ts` file that Tailwind v4 would not consume — that would be theatre, not architecture.
3. Keeps the Tailwind v4 single-source-of-truth posture the project already adopted in Tasks 2.1 and 2.2.

**Risk assessment:** zero. The AC wording is incidental — the substantive requirement is "tokens exist as Tailwind theme extensions and components consume them via utility classes." That requirement is fully met. Operator / QA can re-grep `website/src/app/globals.css` against spec §5.1 hexes for a 1-to-1 audit.

If a future maintainer wants a parallel `tailwind.config.ts` for plugin-author reasons, it can be added alongside without churn — the CSS `@theme` block is the source of truth either way.

---

## 3. Naming convention chosen + rationale

**Convention:** flat kebab-case under a `brand-` prefix.

| Layer | Pattern | Example utility |
|---|---|---|
| Colour | `bg-brand-{colour}` / `text-brand-{colour}` / `border-brand-{colour}` | `bg-brand-navy`, `text-brand-gold`, `border-brand-light-blue` |
| Gradient | `bg-gradient-brand-{from}-{to}` | `bg-gradient-brand-navy-gold` |
| Type scale | `text-{role}-{step}` | `text-title-max`, `text-h1-min`, `text-body-max`, `text-caption` |
| Shadow | `shadow-brand-{step}` | `shadow-brand-sm`, `shadow-brand-md`, `shadow-brand-lg` |
| Radius | `rounded-brand-{step}` | `rounded-brand-sm` … `rounded-brand-2xl` |
| Font family | `font-{role}` | `font-sans`, `font-heading`, `font-mono` |

**Why not `apa-*`?** The product is the *sub-brand* "LSL Calculator by APA", not APA itself. `brand-*` reads as "this product's brand tokens", which scales cleanly: if a future epic introduces tokens that genuinely *override* APA defaults (e.g. an advisory teal surface), those still sit naturally under `brand-advisory` without taxonomy churn. `apa-*` would imply the tokens *are* the APA primary palette, which is misleading (we extend it with advisory teal per spec §5.1; charcoal and grey are LSL-app-specific role choices).

**Why not nested shade scales (`brand.navy.500`)?** Two reasons:

1. **Tailwind v4 doesn't support nested object syntax in `@theme`** — only flat CSS custom properties. Trying to express `brand.navy.50..900` as `--color-brand-navy-50: ...` etc. would require inventing 9 intermediate shades for each of 9 base colours = **81 invented tokens**, none of which appear in spec §5.1 or `icon-direction.md`.
2. **The spec deliberately does not specify a shade scale.** Icon-direction §3 consumes only the 9 named hexes plus white. Introducing a shade scale here would be a unilateral design decision outside the operator-approved palette. If a future component needs a tint (e.g. navy at 92% for a hover state), it can compose via `color-mix(in srgb, var(--brand-navy) 92%, white)` at the call site — that's one line, doesn't pollute the token taxonomy, and the designer can review the resulting tint per-surface.

**Why dual `-min` / `-max` type-step tokens?** Spec §5.1 gives **ranges** per role (e.g. "Body Regular 10–12pt"). Committing to a single number prescribes a design decision the spec deliberately left to consumers. Each role exposes both bounds — components select the right step per surface. Title gets `-min` / `-mid` / `-max` because its 32–72pt range is poster-scale (52pt midpoint is the natural hero step). This pattern mirrors how Stripe and Linear publish their type scales.

---

## 4. Files modified

| Path | Purpose |
|---|---|
| `website/src/app/globals.css` | Sole file modified. Adds palette / gradient / type-scale / shadow / radius tokens to the existing `:root` and `@theme inline` blocks. Adds two `@utility` directives for the gradient utilities. No removals; existing shadcn semantic tokens untouched. |
| `docs/engineering/changes/2026-05-28-E6.2-task-2.3-tokens/HANDOFF.md` | This document. |
| `docs/engineering/changes/2026-05-28-E6.2-task-2.3-tokens/QA-REPORT.md` | (to be written by QA agent) |

No other files touched. No new dependencies. No `tests/` modifications (Task 2.11 guard respected). No engine code modifications (SC-7 respected). No `layout.tsx` / `proxy.ts` / `globals.css` body-section modifications outside the token blocks.

---

## 5. Token table preview (key additions)

### 5.1 Colour tokens

| Token | Hex | Tailwind utility examples | Spec source |
|---|---|---|---|
| `--brand-navy` | `#48608a` | `bg-brand-navy`, `text-brand-navy`, `border-brand-navy`, `ring-brand-navy` | §5.1 primary (Pantone 2154 U) |
| `--brand-gold` | `#d9a428` | `bg-brand-gold`, `text-brand-gold`, … | §5.1 primary (Pantone 110 U) |
| `--brand-white` | `#ffffff` | `bg-brand-white`, `text-brand-white`, … | §5.1 primary |
| `--brand-light-blue` | `#a0aec1` | `bg-brand-light-blue`, … | §5.1 extended |
| `--brand-yellow` | `#eebd3c` | `bg-brand-yellow`, … | §5.1 extended (yellow accent — distinct from gold) |
| `--brand-dark-blue` | `#324d61` | `bg-brand-dark-blue`, … | §5.1 extended |
| `--brand-charcoal` | `#333232` | `text-brand-charcoal`, … | §5.1 extended |
| `--brand-grey` | `#808897` | `text-brand-grey`, … | §5.1 extended |
| `--brand-advisory` | `#6ec8c0` | `bg-brand-advisory`, … | §5.1 advisory variant |

### 5.2 Gradient utilities

| Utility class | CSS value | Use |
|---|---|---|
| `bg-gradient-brand-navy-gold` | `linear-gradient(135deg, #48608a 0%, #d9a428 100%)` | Hero panel, brand-surface backgrounds. **Never under text.** |
| `bg-gradient-brand-navy-light-blue` | `linear-gradient(135deg, #48608a 0%, #a0aec1 100%)` | Secondary brand surface, advisory hero backgrounds. **Never under text.** |

### 5.3 Type-scale tokens

| Token | Value | pt equivalent | Spec role | Family pairing |
|---|---|---|---|---|
| `--text-title-min` | `2.667rem` | 32pt | Title (min) | Montserrat Semibold |
| `--text-title-mid` | `4.333rem` | 52pt | Title (mid) | Montserrat Semibold |
| `--text-title-max` | `6rem` | 72pt | Title (max) | Montserrat Semibold |
| `--text-h1-min` | `1.833rem` | 22pt | H1 (min) | Source Sans 3 Semibold |
| `--text-h1-max` | `2.333rem` | 28pt | H1 (max) | Source Sans 3 Semibold |
| `--text-h2-min` | `1.5rem` | 18pt | H2 (min) | Source Sans 3 Regular |
| `--text-h2-max` | `1.667rem` | 20pt | H2 (max) | Source Sans 3 Regular |
| `--text-h3-min` | `1.167rem` | 14pt | H3 (min) | Source Sans 3 Semibold |
| `--text-h3-max` | `1.333rem` | 16pt | H3 (max) | Source Sans 3 Semibold |
| `--text-body-min` | `0.833rem` | 10pt | Body (min) | Source Sans 3 Regular |
| `--text-body-max` | `1rem` | 12pt | Body (max) | Source Sans 3 Regular |
| `--text-caption` | `0.667rem` | 8pt | Caption | Source Sans 3 Regular |

Conversion: 1pt = 1/12 rem at 16px base (spec §5.1 — "pt→rem at the standard 1pt ≈ 0.083rem at 16px base"). All values rounded to 3 decimal places.

### 5.4 Shadow tokens (tinted with `--brand-navy` alpha)

| Token | Value | Use |
|---|---|---|
| `--shadow-brand-sm` | `0 1px 2px 0 rgba(72,96,138,0.06), 0 1px 2px 0 rgba(72,96,138,0.04)` | Subtle elevation — chips, badges |
| `--shadow-brand-md` | `0 4px 6px -1px rgba(72,96,138,0.08), 0 2px 4px -2px rgba(72,96,138,0.06)` | Cards, dropdowns |
| `--shadow-brand-lg` | `0 10px 24px -6px rgba(72,96,138,0.10), 0 4px 10px -4px rgba(72,96,138,0.06)` | Modals, hero panels |

### 5.5 Radius tokens

| Token | Value | Use |
|---|---|---|
| `--radius-brand-sm` | `0.25rem` (4px) | chip, badge |
| `--radius-brand-md` | `0.5rem` (8px) | input, small card |
| `--radius-brand-lg` | `0.75rem` (12px) | card, modal panel |
| `--radius-brand-xl` | `1rem` (16px) | section panel |
| `--radius-brand-2xl` | `1.5rem` (24px) | hero surface, app-icon-grade rounded square |

Existing shadcn `--radius` (0.5rem) and its `--radius-{sm,md,lg}` derivatives are **untouched** — default shadcn components retain their current radii. Brand variants opt into `rounded-brand-*` explicitly.

---

## 6. Verification results (self-check)

| Gate | Command | Result |
|---|---|---|
| LSL unit suite | `npm test` | **2304 / 2304 passed** (43 files) — SC-7 satisfied |
| Type-check | `npx tsc --noEmit` | clean (no output) |
| Lint | `npm run lint` | **1615 problems** (17 errors, 1598 warnings) — **zero delta** vs. `main` baseline |
| Next.js build | `npm run build` | clean — all 12 routes compile, both static + dynamic |
| Storybook build | `npm run build-storybook` | clean — Welcome MDX renders, no story errors |
| Playwright e2e | not run by developer | deferred to QA (CI runs full 92 × 4 = 368 spec matrix; no test-folder changes in this PR) |

`tests/` folder confirmed untouched (`git diff origin/main -- tests/` → empty — but the project has no `tests/` directory; the LSL suite lives under `src/lib/lsl/engine/*.test.ts`, the suite this PR did not touch).

---

## 7. QA acceptance criteria

QA should confirm the following before signing off (these mirror spec §8.2 ACs that fall in Task 2.3 scope):

1. **Palette completeness** — all 9 named hexes from spec §5.1 are present in `globals.css` at their exact spec values, with no rounding (`#48608a`, `#d9a428`, `#a0aec1`, `#eebd3c`, `#324d61`, `#333232`, `#808897`, `#6ec8c0`, `#ffffff`).
2. **Gradient utilities** — both `bg-gradient-brand-navy-gold` and `bg-gradient-brand-navy-light-blue` apply correctly when used as a Tailwind class (smoke-test by adding `<div class="bg-gradient-brand-navy-gold w-32 h-32" />` to a Storybook scratch story or a temporary page — render via `npm run dev` if browser verification is requested by the operator, otherwise CSS inspection of the compiled output is sufficient).
3. **Type scale** — each `--text-*` token maps to a Tailwind utility (`text-title-max`, `text-body-min`, etc.) that resolves to the documented rem value. Spot-check via DevTools on any Storybook story or by inspecting the `.next/static/css/*.css` output for the `--text-*` custom property declarations.
4. **Shadow + radius utilities** — `shadow-brand-md` and `rounded-brand-lg` are usable as Tailwind classes; the underlying CSS variables resolve correctly.
5. **No hard-coded brand values introduced anywhere outside `globals.css`** — `grep -rE "#48608a|#d9a428|#a0aec1|#eebd3c|#324d61|#333232|#808897|#6ec8c0" website/src/ --exclude="globals.css"` should return zero hits.
6. **Lint delta is exactly zero** — total problem count must remain 1615 (17 errors, 1598 warnings). No new directives, no new disables.
7. **Suites still green** — `npm test` returns 2304/2304; CI runs the 92 × 4 Playwright matrix on PR open and that must come back green before merge.
8. **`tests/` (and `__tests__/`) untouched** — `git diff origin/main -- "**/__tests__/" "tests/"` returns empty.
9. **Dark-mode `@media` block** is unchanged — no brand tokens leak into dark-mode overrides (dark mode is out of scope per spec §5.8).
10. **Self-hosted font posture** preserved — no new external font CDN requests; Task 2.2's font wiring untouched.

---

## 8. Verification steps for QA

```bash
# From repo root
cd website

# 1. Type-check
npx tsc --noEmit

# 2. Lint (expect 1615 problems — zero delta)
npm run lint

# 3. Unit suite
npm test

# 4. Production build
npm run build

# 5. Storybook build
npm run build-storybook

# 6. Hex-leak audit (acceptance criterion 5)
grep -rnE "#48608a|#d9a428|#a0aec1|#eebd3c|#324d61|#333232|#808897|#6ec8c0" \
  src/ --exclude="globals.css" || echo "no leaks — pass"

# 7. tests/ folder diff guard (Task 2.11 contract)
git fetch origin main
git diff origin/main -- 'tests/' '**/__tests__/'
# expect: empty output
```

If all eight commands pass, QA may sign off and the developer will then commit + push + open PR for operator merge.

---

## 9. Open follow-ups (NOT for this task)

- **Task 2.4** — generate `website/src/lib/tokens.ts` typed mirror of these tokens so react-pdf templates (Phase 4) can consume them. Add a unit test that asserts the TS values match the `globals.css` source. Suggest pinning the test against a snapshot of the rgb/rem values, not a string-grep of the CSS file, so designer-led tweaks to the underlying CSS variable definitions still pass without test churn provided the resolved values match.
- **Task 2.5** — Wordmark / Lockup / Icon barrel components, plus a `Tokens.mdx` Storybook story that visualises the palette + type scale + shadow + radius for designer-agent review.
- **Task 2.6** — shadcn variant overrides via `cva`. Each variant references these tokens by name (no inline colours).
- **Spacing scale review** — current Tailwind defaults are adequate per icon-direction §4. If Task 2.6 surfaces a friction point (e.g. a 14px or 22px spacing step the default scale lacks), add it then under `--spacing-*` in `globals.css` with a one-line justification.

---

## 10. Decision log (inline)

| Decision | Rationale |
|---|---|
| Tokens land in `globals.css`, not a new `tailwind.config.ts` | Project is on Tailwind v4 (CSS-first config). See [SCOPE-NOTE] §2. |
| Flat kebab-case under `brand-*` prefix | Tailwind v4 doesn't support nested object syntax in `@theme`. See §3. |
| No invented shade scale (no `brand-navy-50..900`) | Spec §5.1 and icon-direction §3 consume only the 9 named hexes plus white. Composing tints via `color-mix()` at the call site keeps the taxonomy tight. See §3. |
| Dual `-min` / `-max` type tokens | Spec §5.1 gives ranges per role; range-respecting tokens let downstream components pick the right step per surface. See §3. |
| Shadows tinted with `rgba(72,96,138, α)` not `rgba(0,0,0, α)` | Pure-black shadows under brand surfaces (navy-on-navy cards, gold-on-navy callouts) read muddy. Hue-matched shadows hold up under all brand-palette compositions. |
| Default shadcn `--radius` left untouched | Per spec §7.2 — shadcn defaults are extended, not replaced. Brand variants opt into `rounded-brand-*` explicitly; existing shadcn components keep their current radii. |
| Gradient utilities as `@utility` blocks, not `--color-*` tokens | Tailwind v4 generates colour utilities from `--color-*` tokens automatically, but **gradient utilities require an explicit `@utility` declaration** — `--color-*` only produces solid-colour utilities. Two `@utility` blocks (one per gradient direction) is the canonical Tailwind v4 idiom for this. |
| Dark-mode `@media` block left empty for brand tokens | Spec §5.8 explicitly defers dark mode. The existing dark-mode block continues to override only the shadcn semantic tokens (`--background`, `--foreground`, etc.); brand tokens remain at their light-mode hex values across both schemes (acceptable for v1 — the public calc and `/app/*` are light-mode-only). |

---

*End of HANDOFF. Next step: dispatch QA agent for verification per the hard constraint in the operator brief. On QA pass, developer commits → pushes → opens PR.*
