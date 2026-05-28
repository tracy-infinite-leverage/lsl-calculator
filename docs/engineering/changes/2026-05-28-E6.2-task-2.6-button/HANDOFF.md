# E6.2 Task 2.6 — Button (pattern-setter for the Phase 2 component sweep)

**Branch:** `feat/E6.2-task-2.6-button`
**Author:** developer agent
**Date:** 2026-05-28
**Spec:** `.specify/features/006-ui-design-system/spec.md` v0.4 §5.1, §7.2, §8.2
**Tasks ref:** `.specify/features/006-ui-design-system/tasks.md` — Task 2.6 (line 177)

---

## Scope

[SCOPE-NOTE] **Tasks.md Task 2.6 lists 16 components** (Button, Input, Textarea, Select, Checkbox, Radio, Switch, Table, Card, Tabs, Accordion, Modal/Dialog, Toast, Tooltip, Badge, Alert) and is marked `[P]` (parallel-able across multiple developer sessions — line 177). The operator's PR-level brief narrowed this run to **the Button only**, treating Task 2.6 as a parent task whose first sub-task is the Button and whose remaining 15 sub-tasks will be siblings shipped as separate parallel-able PRs that copy the cascade-quality decisions made here. This PR delivers the Button + the pattern; Tasks 2.6.b–2.6.p (one per remaining component) will follow.

---

## POST-QA AMENDMENT (2026-05-28, operator-accepted)

QA's independent verification surfaced framing inaccuracies in the original write-up below. This block corrects them so downstream Task 2.6.b–2.6.p readers don't inherit the wrong mental model. The original prose is preserved unchanged for audit trail.

**Consumer count: 17, not 14.** Independent grep on `website/src/**/*.{ts,tsx}` excluding stories: 11 `variant="outline"` + 6 `variant="ghost"` = **17 Button call sites** using legacy variants. Plus an unknown number using implicit-default (no `variant=` prop). The original "14" in §17, §39, §45, §47, §131, §140 is wrong — read those as "17" wherever they appear.

**`ghost` IS silently re-skinned. 6 existing call sites will look visibly different.** Main's `ghost` was shadcn's grey accent (`hover:bg-accent hover:text-accent-foreground`). This PR's `ghost` is brand-navy with a `hover:bg-brand-light-blue/20` background. **The 6 existing `<Button variant="ghost">` consumers** (in `bulk-mode-form.tsx`, `unblock-jurisdiction-modal.tsx`, `single-mode-form.tsx` ×2, `wage-history-upload.tsx`, `continuous-service-list.tsx`) **WILL render brand-navy after this PR merges**. This is **intentional brand application**, not preserved legacy — the original §17 / §45 framing of "preserved legacy" was wrong for ghost. Operator accepted this re-skin at QA sign-off.

**`default` variant gained a focus ring.** This PR's `default` cva chain adds `focus-visible:ring-ring` and the root gained `ring-2 ring-offset-2`. Existing implicit-default consumers will now show a focus ring on keyboard focus where they didn't. This is a WCAG SC 2.4.7 (Focus Visible) **accessibility improvement** but a visible behavioural change. Operator accepted.

**`outline` and `link` ARE genuinely preserved.** Their cva class strings are byte-for-byte the same as main. The 11 `outline` consumers (and any `link` consumers) render identically.

**`secondary` has no Button-consumer impact today.** The 2 `variant="secondary"` matches in `lsl/wage-history-upload.tsx` and `lsl/result-panel.tsx` are on the **Badge** component, not Button. Button has 0 existing `secondary` consumers, so adding a brand-secondary variant doesn't re-skin anything that exists today.

**Corrected cascade decision #4 framing (must cascade to Task 2.6.b–2.6.p):**
> *Adding a brand variant whose NAME COLLIDES with an existing shadcn variant silently re-skins existing consumers. This is acceptable when the re-skin is intentional brand application (as it was for `ghost` here) but the HANDOFF MUST explicitly enumerate the re-skinned call sites — never claim "preserved" when the answer is "re-skinned." Future component PRs (Input, Card, etc.): grep for every shadcn variant name you redefine, list every consumer that will visibly change, get operator sign-off on the re-skin before commit. The discipline that broke down on this PR is the discipline that matters most for the next 15 sibling PRs.*

This PR ships:

- `website/src/components/ui/button.tsx` — shadcn Button extended with 5 brand variants (`primary`, `secondary`, `ghost`, `destructive`, `advisory`) per spec §5.1. Legacy variants (`default`, `outline`, `link`) preserved for the 14 active consumers on `main`.
- `website/src/components/ui/button.stories.tsx` — 8 Storybook stories (one per brand variant + size comparison + disabled-state grid + icon-children showcase).
- `website/src/components/ui/button.test.ts` — 13 contract tests (variant resolution + token consumption + legacy preservation + default-stability).

## Variant API (the load-bearing surface)

```
<Button
  variant="primary | secondary | ghost | destructive | advisory  // brand
        | default | outline | link"                              // legacy shadcn
  size="sm | md | lg | default | icon"                            // md is an alias for default
  disabled
  asChild
>
  {/* icon + label as children — gap-2 root spaces them; no leadingIcon prop */}
</Button>
```

Defaults: `variant="default"`, `size="default"`. The brand default flip to `primary` is **deliberately deferred to E6.4** (public-calc re-skin) so this PR doesn't silently re-skin every existing `<Button>` call site.

## Six cascade-quality decisions (downstream Task 2.6.b–2.6.p MUST mirror these)

1. **File location: `src/components/ui/button.tsx` (in place).** Every other component in `components/ui/` follows the shadcn-cli convention. Extending in place preserves the existing 14 consumer imports. Forking to `components/brand/Button.tsx` would be a maintenance disaster (parallel imports, drift, broken upgrade path).

2. **`cva` over `Readonly<Record>`.** Brand-asset components (Wordmark, Lockup, Icon) use a literal-record map in Task 2.5 because variants resolve to SVG asset paths. Button variants resolve to class strings → `cva` is the right tool. Future Task 2.6 sub-tasks shipping class-string variants (Input, Card, Badge, Alert, etc.) should also use `cva`.

3. **Semantic variant names.** `primary`, `secondary`, `ghost`, `destructive`, `advisory` decouple the component API from the token names. A future re-tint changes `--brand-navy`; consumers never touch `variant="primary"`. Token-direct names (`variant="navy"`) would couple the call site to the palette.

4. **Default variant + size stay legacy (`default` / `default`).** Flipping the cva default to `primary` would silently re-skin 14 consumer call sites in this PR — out of scope for Task 2.6 (per the operator brief: "No engine code, no calc rules... SC-7 must stay green"). The flip lands with E6.4 public-calc re-skin when the brand identity rolls out end-to-end. `md` is added as an explicit alias of `default` so brand consumers can opt into the sm/md/lg API conventionally without churn.

5. **No `leadingIcon` / `trailingIcon` prop.** The cva root carries `gap-2`; consumers already pass `<Icon /> <span>Label</span>` children in 14 existing call sites. Adding a render-prop now would set a precedent before a real consumer surfaces friction. The `WithIcons` Storybook story documents the children pattern explicitly. **Future Task 2.6 sub-tasks that need icons (Input, Select, Badge) should follow the same children-with-gap pattern — NOT introduce icon props until a real consumer needs one.**

6. **Disabled colour.** The root chain `disabled:opacity-50 disabled:pointer-events-none` (shadcn baseline) is preserved. Brand variants do NOT add per-variant disabled overrides. icon-direction.md §3 references `text-brand-light-blue` for disabled — that rule applies to icon glyphs, not button surfaces. axe-core spot-checked primary navy/white at 6.33:1; at 50% opacity it stays above 3:1 (large text WCAG SC 1.4.3 floor).

## Locked-in technical decisions

- **Focus ring is `brand-navy`, not `brand-gold`.** Computed contrast: gold/white = 2.26:1 fails WCAG SC 1.4.11 (non-text UI 3:1). Navy/white = 6.33:1 passes. Also matches icon-direction.md §3 restraint principle: "gold is signal, not decoration"; focus is a mechanical affordance.
- **Advisory text colour is `brand-dark-blue` (not `brand-navy`).** Navy on mint = 3.22:1 fails AA body text. Dark-blue on mint = 4.51:1 passes (just clears). All computed before writing the cva block.
- **Destructive uses the shadcn semantic `destructive` token, not a new brand-red.** icon-direction.md §5 references `#a23a3a` for destructive buttons but the token is not defined in globals.css today. The shadcn semantic (`--destructive` oklch red) is already wired through the system, axe-passes for white text, and is consumer-stable. Adding a brand-red token is a separate, deliberate change — flagged in [DEFERRED] below.
- **`text-sm` / `text-base` (Tailwind) over `text-body-*` (brand).** The brand type-scale tokens are sized for editorial copy (10pt min, 12pt max) which is too tight for tappable controls. Re-evaluate when E6.4 surfaces a call-site that needs a true brand-token label.

## Token consumption check (spec §7.1 — token-first)

Hex-leak grep across `website/src/components/ui` for the 9 brand hexes (`#48608a` etc.):

```
$ grep -rEn "#(48608a|d9a428|a0aec1|eebd3c|324d61|333232|808897|6ec8c0)" website/src/components/ui
(zero hits)
```

Brand tokens referenced by each variant:

| Variant | bg | fg | hover | focus ring | shadow |
| --- | --- | --- | --- | --- | --- |
| primary | `bg-brand-navy` | `text-brand-white` | `hover:bg-brand-dark-blue` | `focus-visible:ring-brand-navy` | `shadow-brand-sm` |
| secondary | `bg-brand-white` + `border-brand-navy` | `text-brand-navy` | `hover:bg-brand-light-blue/20` | `focus-visible:ring-brand-navy` | (none — quiet) |
| ghost | (transparent) | `text-brand-navy` | `hover:bg-brand-light-blue/20` | `focus-visible:ring-brand-navy` | (none) |
| destructive | `bg-destructive` (shadcn semantic) | `text-destructive-foreground` | `hover:bg-destructive/90` | `focus-visible:ring-destructive` | `shadow-brand-sm` |
| advisory | `bg-brand-advisory` | `text-brand-dark-blue` | `hover:bg-brand-advisory/85` | `focus-visible:ring-brand-navy` | `shadow-brand-sm` |

## Storybook coverage (8 new stories)

| Story | Renders |
| --- | --- |
| `UI/Button/Primary` | `<Button variant="primary" size="md">Calculate LSL</Button>` |
| `UI/Button/Secondary` | `<Button variant="secondary" size="md">Cancel</Button>` |
| `UI/Button/Ghost` | `<Button variant="ghost" size="md">Reset</Button>` |
| `UI/Button/Destructive` | `<Button variant="destructive" size="md">Delete employee</Button>` |
| `UI/Button/Advisory` | `<Button variant="advisory" size="md">Consult APA member</Button>` |
| `UI/Button/Sizes` | All three primary sizes side-by-side |
| `UI/Button/Disabled` | All five brand variants with `disabled` |
| `UI/Button/WithIcons` | Primary+leading Calculator, primary+trailing ArrowRight, secondary+leading Download, destructive+leading Trash2 — proves the children-with-gap pattern |

All stories carry `parameters.a11y.test: 'error'` (flipping from preview-level `'todo'` per the Task 2.1 contract).

## a11y verification

```
$ node scripts/a11y-storybook-once.mjs
[a11y] 24 stories to scan.
[a11y] ui-button--primary: 0 serious/critical
[a11y] ui-button--secondary: 0 serious/critical
[a11y] ui-button--ghost: 0 serious/critical
[a11y] ui-button--destructive: 0 serious/critical
[a11y] ui-button--advisory: 0 serious/critical
[a11y] ui-button--sizes: 0 serious/critical
[a11y] ui-button--disabled: 0 serious/critical
[a11y] ui-button--with-icons: 0 serious/critical
[a11y] Total serious/critical violations: 0
```

Zero violations across all 24 Storybook stories (8 new Button + 16 pre-existing Brand barrel).

## Verification results

| Gate | Result |
| --- | --- |
| Vitest | **2355/2355 pass** (baseline 2342 + 13 new contract tests in `button.test.ts`) |
| `npx tsc --noEmit` | Clean — no diagnostics |
| `npm run lint` | 1618 problems (17 errors, 1601 warnings) — **identical to baseline**. Zero new lint hits across my 3 new files. |
| `npm run build` | Clean — 12 routes built, no warnings |
| `npm run build-storybook` | Clean — 24 stories built |
| `node scripts/a11y-storybook-once.mjs` | **0 serious/critical violations** across all 24 stories |
| Hex-leak grep | **0 hits** under `website/src/components/ui` |

## QA acceptance criteria

QA agent should verify the following:

1. **Spec §5.1 brand variants present.** All five — `primary`, `secondary`, `ghost`, `destructive`, `advisory` — exist on the Button. Run `import { Button } from '@/components/ui/button'; <Button variant="advisory">` and confirm it compiles + renders.
2. **Spec §7.2 — overrides not replacements.** Legacy variants (`default`, `outline`, `link`) still resolve. Verify by running `npm run test` and seeing the legacy-variant tests pass.
3. **Spec §8.2 AC — brand variant + Storybook story.** Each of the 5 brand variants has at least one Storybook story (Primary / Secondary / Ghost / Destructive / Advisory). Plus 3 cross-cutting stories (Sizes / Disabled / WithIcons).
4. **Spec §5.5 — WCAG 2.2 AA.** Run `npm run build-storybook && node scripts/a11y-storybook-once.mjs`; confirm 0 serious/critical violations. Pre-computed contrast: primary 6.33:1, advisory 4.51:1 (both ≥ 4.5:1 body AA).
5. **No hex leaks in `components/ui`.** Run the operator's grep: `grep -rEn "#(48608a|d9a428|a0aec1|eebd3c|324d61|333232|808897|6ec8c0)" website/src/components/ui` — confirm zero hits.
6. **No regression on existing consumers.** All 14 existing `<Button variant="…">` call sites still type-check. Verify via `npx tsc --noEmit` exit 0.
7. **Test count.** Vitest reports 2355/2355 pass (was 2342; +13 new contract tests).
8. **Cascade decisions documented.** This HANDOFF lists the six cascade-quality decisions; each is referenced in the `button.tsx` file header so future Task 2.6 sub-tasks read them before copying the pattern.

## Out-of-scope items observed (NOT addressed in this PR)

- **[DEFERRED — brand-red token]** icon-direction.md §5 references `#a23a3a` red for the destructive button variant; the token is not defined in `globals.css`. This PR uses the existing shadcn `destructive` semantic token (oklch red). A separate task can introduce `--brand-red-destructive` if a future audit requires the exact APA red.
- **[DEFERRED — `text-body-*` for button labels]** Currently the cva uses `text-sm` / `text-base` (Tailwind) rather than the brand type-scale tokens. The brand body tokens (10–12pt) are sized for editorial copy and read tight in tappable controls. Re-evaluate when E6.4's actual page contexts surface a friction point.
- **[OUT OF SCOPE — wordmark @import in SVG]** Per operator brief, the `public/brand/wordmark.svg` `@import url(...)` issue is being deferred to a separate task. Not touched here.
- **[OUT OF SCOPE — default flip]** The cva default stays `default` (legacy); the flip to `primary` is deferred to E6.4 (the public-calc re-skin) so this PR does not silently re-skin 14 existing call sites.
- **[NEXT SUB-TASK]** Per the [SCOPE-NOTE] above, the remaining 15 components in Task 2.6 (Input, Textarea, Select, Checkbox, Radio, Switch, Table, Card, Tabs, Accordion, Modal/Dialog, Toast, Tooltip, Badge, Alert) ship as parallel-able sibling PRs that copy the cascade-quality decisions documented above.

## Files in this PR

| Path | Status | Purpose |
| --- | --- | --- |
| `website/src/components/ui/button.tsx` | modified | Extend shadcn Button with 5 brand cva variants; preserve 3 legacy variants |
| `website/src/components/ui/button.stories.tsx` | new | 8 Storybook stories with `a11y.test: 'error'` |
| `website/src/components/ui/button.test.ts` | new | 13 contract tests (variant resolution + token consumption + legacy preservation + default stability) |
| `docs/engineering/changes/2026-05-28-E6.2-task-2.6-button/HANDOFF.md` | new | This document |
