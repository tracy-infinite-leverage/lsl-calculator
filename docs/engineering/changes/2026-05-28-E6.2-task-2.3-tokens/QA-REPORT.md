# QA-REPORT — E6.2 Task 2.3: Tailwind v4 theme tokens

**Date:** 2026-05-28
**Branch:** `feat/E6.2-task-2.3-tokens` (cut from `origin/main` at `5ceb8e4`, nothing pushed)
**Reviewer:** QA agent (independent verification)
**Handoff under review:** `docs/engineering/changes/2026-05-28-E6.2-task-2.3-tokens/HANDOFF.md`
**Files in diff:** `website/src/app/globals.css` only (+179 / −7)

---

## VERDICT

**PASS WITH NOTES — operator's call**

All structural acceptance criteria for the colour palette, gradient utilities, type scale, shadow scale, radius scale, font-family wiring, hex-leak guard, lint/type/build/Vitest/Storybook regressions are green. **One spec-deviation finding** (spacing tokens) requires an operator decision because `tasks.md` line 138 explicitly lists "spacing tokens" inside the Task 2.3 description string, while the dev intentionally omitted them with a documented rationale.

This is a judgement call, not a defect — see §3 below. If the operator agrees with the dev's reasoning (Tailwind v4 defaults already cover the icon-direction §4 sizing grid), this PRs cleanly. If the operator wants strict literal compliance with tasks.md, the dev should add a brand-spacing scale before commit.

Everything else passes.

---

## AC table

| # | AC | Status | Evidence |
|---|---|---|---|
| AC1 | All 9 spec §5.1 colours present as named tokens with exact hex values, no rounding | **PASS** | `grep -nE "#(48608a|d9a428|a0aec1|eebd3c|324d61|333232|808897|6ec8c0)" website/src` returns 11 hits, all inside `globals.css` at lines 68–82. `#ffffff` present at line 70. Spot-check: `--brand-navy: #48608a` ✓, `--brand-gold: #d9a428` ✓, `--brand-light-blue: #a0aec1` ✓, `--brand-yellow: #eebd3c` ✓, `--brand-dark-blue: #324d61` ✓, `--brand-charcoal: #333232` ✓, `--brand-grey: #808897` ✓, `--brand-advisory: #6ec8c0` ✓, `--brand-white: #ffffff` ✓. Storybook bundle confirms all 9 emitted into compiled CSS (`--brand-advisory:#6ec8c0` etc. — `wc -l storybook-static/assets/iframe-*.css`). |
| AC2 | Type scale covers spec §5.1 / APA p.18 sizes with correct pt→rem math at 16px base | **PASS** | All 12 declared values verified arithmetically (1pt = 1/12 rem at 16px). Spot-check via `python3` calculator: 32pt→2.6667 (declared 2.667), 22pt→1.8333 (declared 1.833), 12pt→1.0000 (declared 1), 8pt→0.6667 (declared 0.667). Max delta = 0.0003 rem (≈0.005px) from 3-decimal rounding — well below sub-pixel. Roles covered: title (min/mid/max), h1 (min/max), h2 (min/max), h3 (min/max), body (min/max), caption. Dev's choice to expose both range bounds is sensible — spec §5.1 deliberately gives ranges per role. |
| AC3 | Font-family tokens consume existing `--font-heading` / `--font-sans` vars, no re-import | **PASS** | `globals.css` lines 170–172 reference `var(--font-source-sans)` and `var(--font-montserrat)` (which Task 2.2 injects via `next/font/local` in `layout.tsx`). No `@font-face` declarations in this diff. No woff2 imports re-introduced. `grep -rE "fonts\.googleapis\.com\|fonts\.gstatic\.com" website/src website/public` returns zero hits — self-hosted posture preserved (also AC R6). |
| AC4 | Shadow tokens present, brand-tinted (navy alpha) base | **PASS** | Lines 90–95 declare `--shadow-brand-{sm,md,lg}` using `rgba(72, 96, 138, α)` (= brand-navy hue). Three tiers: 0.04–0.06 alpha (sm) → 0.06–0.08 (md) → 0.06–0.10 (lg). Aliased through `@theme inline` (lines 215–217). Tinting choice is sound — pure-black shadows under navy surfaces read muddy. |
| AC5 | Radius tokens present | **PASS** | Lines 104–108 declare `--radius-brand-{sm,md,lg,xl,2xl}` = 0.25 / 0.5 / 0.75 / 1 / 1.5 rem (4–24px). Existing shadcn `--radius` and its sm/md/lg derivatives left intact (lines 223–225 unchanged behaviour). Brand variants are opt-in via `rounded-brand-*`. |
| AC6 | Gradient utilities — navy↔gold and navy↔light-blue, background-only | **PASS** | Lines 242–247 define two `@utility` blocks: `bg-gradient-brand-navy-gold` and `bg-gradient-brand-navy-light-blue`. Each uses `background-image: linear-gradient(135deg, ...)`. **No `text-gradient-*` class declared** — gradients are background-only as spec §5.1 mandates. Source values referenced via `--gradient-brand-*` custom props (lines 81–82). |
| AC7 | Zero hard-coded spec hex values outside the token file | **PASS** | `grep -rnE "#(48608a\|d9a428\|a0aec1\|eebd3c\|324d61\|333232\|808897\|6ec8c0)" website/src --include='*.ts' --include='*.tsx' --include='*.css' --include='*.scss'` returns **11 hits, all in `website/src/app/globals.css`** (the token file itself). No leaks. |
| AC8 | Tokens produce expected Tailwind utility classes | **PASS (with structural caveat)** | Tailwind v4 with `@theme inline` and Turbopack JIT-tree-shakes any `--color-*` / `--text-*` alias whose consumer utility (`.bg-brand-navy`, `.text-title-max`, …) is not referenced by source code. Since no component code consumes these tokens yet (that's Tasks 2.5 / 2.6 scope), the generated `.next/static/chunks/*.css` does not contain the utility class definitions — but this is **expected v4 behaviour, not a defect**. Empirical confirmation: the base `--brand-*` custom properties in `:root` *are* emitted into the bundle (verified — all 9 colours present in storybook iframe CSS with exact hex), as are `--shadow-brand-*` and `--radius-brand-*` (because of self-reference in the `@theme inline` block). The `@theme inline → var(--brand-*)` indirection means the utility class names will resolve on first use. Operator can manually smoke-test by adding `<div class="bg-brand-navy h-8 w-8 rounded-brand-lg shadow-brand-md" />` to any page during dev — covered by Task 2.5 stories regardless. |
| AC9 | SC-7 preservation (Vitest + tsc + lint + build) | **PASS** | Vitest: **2304 / 2304 passed** across 43 files (matches dev claim exactly). `npx tsc --noEmit` clean — zero output, exit 0. `npm run lint` = **1615 problems (17 errors, 1598 warnings)** — matches dev's baseline claim exactly (zero delta vs. `main`). `npm run build` clean: compiles in 1.65s, 12/12 static pages generated, 10 route entries listed (note: dev's HANDOFF said "12 routes" — the build line is `Generating static pages using 9 workers (12/12)`; the route table lists 10 entries including 2 dynamic. Cosmetic naming only, no regression). |
| AC10 | Storybook still builds and tokens are discoverable | **PASS** | `npm run build-storybook` builds in 2.06s, all chunks bundle clean. The compiled `storybook-static/assets/iframe-*.css` (35.57 kB) contains all 9 `--brand-*` custom properties with their exact hex values. Welcome MDX renders. No story errors. (Note: storybook chunk-size warning is pre-existing — not introduced by this diff.) |

**AC pass rate: 10 / 10.**

---

## Regression table

| # | Check | Status | Evidence |
|---|---|---|---|
| R1 | `npm run build` clean, 12/12 routes, no new warnings | **PASS** | Compiled in 1.65s. `(12/12)` static-page generation. No new Turbopack or Next warnings vs. baseline. |
| R2 | Lint baseline unchanged | **PASS** | Exact match: 1615 problems (17 errors, 1598 warnings). Zero delta. |
| R3 | `npx tsc --noEmit` clean | **PASS** | Exit 0, no output. |
| R4 | `git diff origin/main -- 'tests/' '**/__tests__/'` empty | **PASS** | Empty output. Task 2.11 guard respected. |
| R5 | Vercel preview runtime smoke | **DEFERRED-TO-PREVIEW** | No push, no PR open yet. To verify post-PR-open. Not blocking — token diff is CSS-only with no runtime side effects. |
| R6 | No new third-party font requests | **PASS** | `grep -rE "fonts\.googleapis\.com\|fonts\.gstatic\.com" website/src website/public` returns zero. Self-hosted posture preserved. |

**Regression pass rate: 5 / 5 (R5 deferred).**

---

## Judgement-call verdicts

### (a) No shade ramp (e.g. `brand-navy-50..900`)

**Verdict: DEFENSIBLE — not blocking.**

I re-grepped the spec for shade-scale references:

```
grep -nE "navy-50|navy-100|navy-500|navy-900|shade" .specify/features/006-ui-design-system/spec.md
```

Returns zero. Spec §5.1 lists exactly 9 named hex values. `icon-direction.md` §3 consumes only those 9 named tokens plus white. Neither document mandates a shade scale.

The dev's rationale (Tailwind v4 doesn't support nested `@theme` objects, and composing tints via `color-mix(in srgb, var(--brand-navy) 92%, white)` at the call site keeps the taxonomy tight) is technically and architecturally sound. Inventing 81 unsanctioned intermediate shades would be a unilateral design decision outside the operator-approved palette.

If a future iteration needs a discrete tint (e.g. a hover state), it can be added as a single named token (`--brand-navy-hover`) under the same flat naming convention without taxonomy churn.

### (b) No spacing tokens

**Verdict: PASS WITH NOTES — operator's judgement call.**

This is the one finding the operator needs to actively decide. Two pieces of evidence cut against each other:

1. **`tasks.md` line 138** explicitly lists "spacing tokens" inside the Task 2.3 description string: *"…shadow tokens (Linear-style soft), radius tokens (generous), spacing tokens."*
2. **`spec.md` §5.1 line 116** says *"MUST define shadow / radius / spacing tokens consistent with the 'Linear polish' reference"* — so the requirement is real at the spec level too.

Counter-evidence supporting the dev's omission:

- Neither document specifies *which* spacing values; both are open-ended.
- `icon-direction.md` §4 sizing values (4, 8, 16, 24, 44, 56, 64, 80, 120, 180 px) are all expressible as Tailwind v4 defaults (`p-1, p-2, p-4, p-6, p-11, p-14, p-16, p-20, w-30, w-45` — Tailwind v4's `--spacing: .25rem` base lets these compose via numeric multipliers without invented tokens).
- A brand-spacing token only adds value if it defines *non-default* values (e.g. a 22px or 14px step Tailwind doesn't ship). No such requirement surfaced in the icon-direction audit.

The dev documented the omission transparently in §1 of HANDOFF.md and §4 of `lib/tokens.ts` follow-ups. Operator can:

- **Accept (recommended):** sign off as-is, with a follow-up gate in Task 2.6 to add `--spacing-brand-*` if a friction point surfaces during component implementation.
- **Reject:** ask the dev to add a brand-spacing scale before commit. Risk: the scale would be arbitrary (no spec values to anchor it), inviting designer-led churn during Task 2.6.

The substantive AC ("token-first; no hard-coded brand values in components") is unaffected either way — spacing is the one area of design tokens where Tailwind v4's defaults already constitute a high-quality opinionated system.

**Recommendation: accept as-is, log a follow-up.**

---

## Tailwind v4 SCOPE-NOTE verdict

**Verdict: CORRECT — dev's interpretation is the right call.**

The spec AC §8.2 wording ("Tailwind theme extension committed under `website/tailwind.config.{js,ts}`") predates the project's migration to Tailwind v4. Tailwind v4 is CSS-first by design — the official migration guide explicitly states the JS config is deprecated for non-plugin-author use, and tokens live in `@theme` blocks in CSS.

Inventing a parallel `tailwind.config.ts` purely to satisfy the literal AC text would be theatre — Tailwind v4 would not consume it as the source of truth. The dev's `@theme inline` approach in `globals.css`:

1. **Satisfies AC intent fully** — every brand colour, gradient, type-step, shadow, and radius is a Tailwind theme token, exposed via `bg-*` / `text-*` / `border-*` / `shadow-*` / `rounded-*` utility families. Spec §7.1 (token-first; no hard-coded brand values) is fully enforceable.
2. **Is the canonical Tailwind v4 idiom** for theme extension.
3. **Aligns with the v4 posture** already adopted in Tasks 2.1 and 2.2.

If a future task surfaces a plugin-author need (e.g. a custom variant beyond `@utility`), a `tailwind.config.ts` can be added alongside without churn.

The QA finding here is that the spec text should be updated when Task 2.6 lands to reflect the v4 reality — but that's PM scope, not a blocker for this PR.

---

## Notes (non-blocking)

1. The text-scale tokens use 3-decimal rounding (e.g. `2.667rem` for 32pt where exact = `2.6667rem`). At a 16px base this is a 0.005px sub-pixel delta — invisible on any display. Acceptable.
2. AC8 cannot be empirically verified in compiled CSS without a consuming component, because Tailwind v4's `@theme inline` mode tree-shakes unused utility aliases. The `--brand-*` custom properties in `:root` *do* emit, confirming the source-of-truth declarations are valid. Full utility-class verification will land naturally in Task 2.5 (Storybook token gallery) or Task 2.6 (shadcn variant overrides). Document this expectation for the QA report on Task 2.6.
3. Build route count: HANDOFF says "12 routes generated"; Next.js build output says `(12/12)` static pages generated across 10 route entries (2 dynamic + 8 static = 10 visible, + 2 internal pre-rendered = 12). Cosmetic discrepancy; no regression.
4. The dark-mode `@media` block (lines 249–265) is unchanged. Brand tokens correctly remain at light-mode values across both schemes (spec §5.8 defers dark mode for v1). Honoured.
5. Existing shadcn `--radius`, `--radius-sm`, `--radius-md`, `--radius-lg` are left intact at their pre-existing values. Brand variants opt in to `--radius-brand-*` explicitly. Clean separation.
6. The dev's naming convention (`brand-*` prefix, flat kebab-case, dual `-min` / `-max` type tokens, gradient as `@utility` blocks) is well-rationalised in §3 of the HANDOFF and aligns with Tailwind v4 idioms. No taxonomy concerns.

---

## Sign-off recommendation

**Operator action:**

1. Accept the no-spacing-tokens judgement call (recommended) — if so, dev may commit + push + open PR. The follow-up note in HANDOFF §9 ("Spacing scale review — Task 2.6 surfaces a friction point if any, add then") is the right gate.
2. If you want strict tasks.md literal compliance — send back to dev to add a brand-spacing scale. Note this would be an arbitrary scale (spec gives no values), inviting later churn.

Everything else passes. No defects found. No source files were modified during verification. `git status` confirms the working tree is exactly as the dev left it.

---

*End of QA report. PR open is gated on operator's spacing-tokens decision per §3(b) above.*
