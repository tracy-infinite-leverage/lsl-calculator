# E6.2 Task 2.6.b — Input (first Task 2.6 sibling after Button)

**Branch:** `feat/E6.2-task-2.6.b-input`
**Author:** developer agent
**Date:** 2026-05-28
**Spec:** `.specify/features/006-ui-design-system/spec.md` v0.4 §5.1, §5.5, §7.2, §8.2
**Tasks ref:** `.specify/features/006-ui-design-system/tasks.md` — Task 2.6 (line 177), Input sub-task
**Pattern source:** `docs/engineering/changes/2026-05-28-E6.2-task-2.6-button/HANDOFF.md` (Button PR #61, POST-QA AMENDMENT block)

---

## Scope

The FIRST sibling component PR after Button. This PR extends shadcn Input with brand-styled `state` (`default` | `error`) and `size` (`sm` | `md` | `lg` | `default`) variants via `cva`, mirroring the Button cascade-quality decisions and applying the POST-QA AMENDMENT discipline on consumer re-skin enumeration.

Spec §5.1 lists Input in the component sweep but does NOT name specific variants (unlike Button which mandates 5 by name). The brand surface here is deliberately small — form fields read best when they recede; the brand identity comes from focus + error states.

This PR ships:
- `website/src/components/ui/input.tsx` — shadcn Input extended with `cva` (`state`: default/error; `size`: default/md/sm/lg). All 38 existing `<Input>` consumers re-skin to brand tokens.
- `website/src/components/ui/input.stories.tsx` — 6 Storybook stories with `a11y.test: 'error'`.
- `website/src/components/ui/input.test.ts` — 17 contract tests (state resolution + size resolution + token consumption + re-skin guard + error-token guard + default stability).

---

## CRITICAL — Consumer re-skin enumeration

Per the Button POST-QA AMENDMENT cascade rule:
> *Adding a brand variant whose NAME COLLIDES with an existing shadcn variant silently re-skins existing consumers. […] the HANDOFF MUST explicitly enumerate the re-skinned call sites — never claim "preserved" when the answer is "re-skinned."*

**Grep result for existing variant props on Input** (`grep -rEn 'variant=|state=' website/src --include='*.tsx' --include='*.ts' | grep -i input`): **zero hits**. No existing `<Input>` call site passes `variant=` or `state=` today.

**However, the cva default state (`state: 'default'`) is BRAND-STYLED, not shadcn-neutral.** Class string differences from `main`:

| Property | `main` (shadcn baseline) | This PR (`state="default"`) | Visible change |
|---|---|---|---|
| border | `border-input` (neutral grey) | `border-brand-light-blue` (#a0aec1 — APA pale grey-blue) | **YES** — softer, brand-tinted |
| placeholder | `placeholder:text-muted-foreground` | `placeholder:text-brand-grey` (#808897) | **YES** — different muted hue |
| text | (inherits — typically dark neutral) | `text-brand-charcoal` (#333232) | **YES** — explicit APA charcoal |
| focus ring | `focus-visible:ring-ring` (neutral) | `focus-visible:ring-brand-navy` (#48608a) | **YES — most visible change** — navy ring on keyboard focus |

**All 38 existing `<Input>` call sites WILL visibly change after this PR merges.** This is intentional brand application (the whole point of Phase 2) — but it must be enumerated explicitly so the operator and the next 14 sub-task developers don't inherit a wrong mental model.

### Per-consumer breakdown (8 files, 38 usages)

| File | Usage count | Visible change |
|---|---|---|
| `app/app/signup/signup-form.tsx` | 3 | Re-skins: border → brand-light-blue, placeholder → brand-grey, focus → brand-navy. Form context. Matches the brand identity rollout. |
| `app/app/login/login-form.tsx` | 2 | Same as signup. Email + password fields. |
| `app/(calculator)/calculator/bulk/_components/bulk-mode-form.tsx` | 1 | Same. Single text input in the bulk mode form. |
| `app/(calculator)/calculator/bulk/_components/bulk-preview-table.tsx` | 5 | Same. **Inline table-cell inputs** — visual change most noticeable here because dense table cells highlight border colour. Worth a spot-check post-merge. |
| `app/(calculator)/calculator/bulk/_components/bulk-results-table.tsx` | 1 | Same. |
| `app/(calculator)/calculator/single/_components/single-mode-form.tsx` | 18 | Same. The single-employee form is the largest consumer — the brand identity rolls out across the most-used page. |
| `components/lsl/wage-history-upload.tsx` | 5 | Same. |
| `components/lsl/continuous-service-list.tsx` | 3 | Same. |
| **TOTAL** | **38** | All re-skin to brand tokens. |

**Operator sign-off requested at QA acceptance.** This re-skin is intentional and is exactly what Phase 2 / Task 2.6 is supposed to deliver — but, per the Button POST-QA discipline, it must be acknowledged explicitly, not framed as "preserved."

### What is genuinely preserved

- **API shape.** `<Input>` still accepts every native `<input>` HTML attribute via `React.InputHTMLAttributes<HTMLInputElement>`. No existing call site needs prop changes.
- **`type` prop.** `type="email"`, `type="password"`, etc., pass through unchanged.
- **`ref` forwarding.** `React.forwardRef` preserved.
- **`disabled` chain.** `disabled:cursor-not-allowed disabled:opacity-50` preserved from shadcn baseline.
- **File-input chain.** `file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground` preserved.

### Native HTML `size` attribute shadow (deliberate)

The cva `size` variant collides with the native HTML `<input size={N}>` numeric attribute. We `Omit<…, 'size'>` from `React.InputHTMLAttributes` so the cva variant takes over. Grep confirmed **zero** existing consumers pass a numeric `size=` attribute today — safe.

---

## Variant API (the load-bearing surface)

```tsx
<Input
  state="default | error"           // optional; defaults to "default" (brand-styled)
  size="sm | md | lg | default"     // optional; defaults to "default" (md is alias)
  type="text | email | password..." // native; pass-through
  disabled
  aria-invalid                       // pair with state="error" per WCAG SC 1.4.1
  // ...all other native <input> HTML attributes
/>
```

Defaults: `state="default"`, `size="default"`. There is no "default flip deferred to E6.4" here because Input has no other variant for the default to slide between — the brand surface IS the default.

---

## Six cascade-quality decisions (mirrored from Button)

1. **File location: `src/components/ui/input.tsx` (in place).** Same shadcn-cli convention as Button. Preserves the existing 38 consumer imports across 8 files.

2. **`cva` over `Readonly<Record>`.** Input variants resolve to class strings → cva. Same as Button. Brand-asset components (Wordmark, Lockup, Icon) keep using literal-record maps because their variants resolve to SVG asset paths.

3. **Semantic variant names.** `state="error"` decouples the API from the destructive token. A future re-tint changes `--destructive`; consumers never touch their props.

4. **Default-stability framing — RE-SKIN enumerated above.** Unlike Button where the cva default (`variant="default"`) was preserved exactly to avoid silent re-skin of 17 legacy consumers, Input has no parallel legacy variant — the default state IS the brand-styled one. The re-skin of all 38 consumers is enumerated in the section above per the POST-QA discipline.

5. **No `leadingIcon` / `trailingIcon` props.** Per icon-direction.md §3, "Search inside an input" is a real pattern, but it's a composition concern at the call site, not a render prop. The `WithLeadingIcon` Storybook story documents the pattern: relative wrapper + absolute-positioned icon + `pl-9` on the Input. Future Task 2.6 siblings (Textarea, Select) should follow the same children-with-positioning pattern until a real consumer surfaces friction.

6. **Disabled colour.** Root `disabled:cursor-not-allowed disabled:opacity-50` (shadcn baseline) preserved. icon-direction.md §3's `brand-light-blue` for disabled is the icon-glyph rule, not the input-surface rule. opacity-50 is enough.

---

## Locked-in technical decisions

- **Focus ring is `brand-navy`, matching Button.** Consistency across the design system matters more than per-component uniqueness. When a user tabs from a Button to an Input, the focus indicator should feel familiar. Contrast: navy/white 6.33:1 (≥3:1 non-text UI per WCAG SC 1.4.11).
- **Border is `brand-light-blue` (#a0aec1), not `brand-grey` (#808897).** icon-direction.md §3 explicitly nominates pale grey-blue for "secondary structural lines" and disabled state. Grey reads as metadata. Light-blue reads as a form-field affordance.
- **Error state uses shadcn `destructive` token, not a parallel `brand-red-destructive`.** Mirrors Button. There is one red in the system today.
- **Error must be paired with `aria-invalid="true"` + visible error text.** WCAG SC 1.4.1 — error cannot be communicated by colour alone. The `WithError` story models this explicitly. The Input itself does NOT render error strings — that's the form layer's job (matches `signup-form.tsx` / `login-form.tsx` patterns).

---

## Token consumption check (spec §7.1 — token-first)

Hex-leak grep across `website/src/components/ui` for the 8 brand hexes:

```
$ grep -rEn "#(48608a|d9a428|a0aec1|eebd3c|324d61|333232|808897|6ec8c0)" website/src/components/ui
(zero hits)
```

Brand tokens referenced by each state:

| State | border | text | placeholder | focus ring |
|---|---|---|---|---|
| `default` | `border-brand-light-blue` | `text-brand-charcoal` | `placeholder:text-brand-grey` | `focus-visible:ring-brand-navy` |
| `error` | `border-destructive` (shadcn semantic) | `text-destructive` | `placeholder:text-destructive/60` | `focus-visible:ring-destructive` |

No parallel `brand-red-*` tokens introduced. Single red across the system (mirrors Button destructive).

---

## Storybook coverage (6 new stories)

| Story | Renders |
|---|---|
| `UI/Input/Default` | Labelled `<Input state="default" size="md">` with placeholder "e.g. Jane Smith" |
| `UI/Input/Filled` | Labelled `<Input>` with `defaultValue="Jane Smith"` — covers the non-placeholder rendering path |
| `UI/Input/WithError` | Labelled `<Input type="email" state="error" aria-invalid="true" aria-describedby="email-error">` with visible error message |
| `UI/Input/Sizes` | Three labelled inputs side-by-side — sm / md / lg |
| `UI/Input/Disabled` | Two labelled inputs — `disabled` default + `disabled` error |
| `UI/Input/WithLeadingIcon` | Search icon absolutely-positioned over `<Input className="pl-9">` — documents the composition pattern (no render prop) |

All stories carry `parameters.a11y.test: 'error'` (matches Button per spec §5.5 / §8.2). Every Input is wrapped in a `<label>` so axe-core's "form field must have a label" rule is satisfied.

---

## a11y verification

```
$ node scripts/a11y-storybook-once.mjs
[a11y] 30 stories to scan.
[a11y] ui-input--default:          0 serious/critical
[a11y] ui-input--filled:           0 serious/critical
[a11y] ui-input--with-error:       0 serious/critical
[a11y] ui-input--sizes:            0 serious/critical
[a11y] ui-input--disabled:         0 serious/critical
[a11y] ui-input--with-leading-icon: 0 serious/critical
[a11y] Total serious/critical violations: 0
```

30 stories scanned (24 prior + 6 new Input), 0 serious/critical violations total.

---

## Verification results

| Gate | Result |
|---|---|
| Vitest | **2372/2372 pass** (baseline 2355 + 17 new contract tests in `input.test.ts`) |
| `npx tsc --noEmit` | Clean — no diagnostics |
| `npm run lint` | 1618 problems (17 errors, 1601 warnings) — **identical to baseline**. Zero new lint hits across the 3 new files. |
| `npm run build` | Clean — all 12 routes built |
| `npm run build-storybook` | Clean — 30 stories built |
| `node scripts/a11y-storybook-once.mjs` | **0 serious/critical violations** across all 30 stories |
| Hex-leak grep | **0 hits** under `website/src/components/ui` |

---

## QA acceptance criteria

QA agent should verify:

1. **Spec §5.1 / Task 2.6 — Input has at least one brand-styled variant referencing tokens.** `state="default"` resolves to a class string containing `border-brand-light-blue`, `focus-visible:ring-brand-navy`, `placeholder:text-brand-grey`, `text-brand-charcoal`. `state="error"` references `border-destructive` and `focus-visible:ring-destructive`.
2. **Spec §7.2 — overrides not replacements.** `<Input>` still accepts every native `<input>` HTML attribute. No consumer needs prop changes (verified by `npx tsc --noEmit` clean across all 38 call sites).
3. **Spec §8.2 AC — brand variant + Storybook story.** Each of the two states (default / error) has at least one Storybook story (Default / Filled / WithError). Plus 3 cross-cutting (Sizes / Disabled / WithLeadingIcon).
4. **Spec §5.5 — WCAG 2.2 AA.** Run `npm run build-storybook && node scripts/a11y-storybook-once.mjs`; confirm 0 serious/critical violations across all 30 stories.
5. **No hex leaks in `components/ui`.** `grep -rEn "#(48608a|d9a428|a0aec1|eebd3c|324d61|333232|808897|6ec8c0)" website/src/components/ui` — confirm zero hits.
6. **No TS regression on existing consumers.** All 38 existing `<Input>` call sites still type-check. Verify via `npx tsc --noEmit` exit 0.
7. **Re-skin enumeration accuracy.** Spot-check one consumer (recommend: `signup-form.tsx`) in Storybook or a local build screenshot — confirm border is brand-light-blue and focus ring is brand-navy. The 38-consumer re-skin is intentional brand application; QA should sign off explicitly.
8. **Test count.** Vitest reports 2372/2372 pass (was 2355; +17 new contract tests).
9. **Error pairing.** Confirm the `WithError` story renders `aria-invalid="true"` + a visible error message in addition to the red border — WCAG SC 1.4.1.
10. **Cascade decisions documented.** This HANDOFF lists the six cascade-quality decisions; each is referenced in the `input.tsx` file header so future Task 2.6 sibling sub-tasks read them before copying the pattern.

---

## Out-of-scope items observed (NOT addressed in this PR)

- **[DEFERRED — brand-red token]** Same as Button. icon-direction.md §5 references `#a23a3a` red but the token is not defined in globals.css. Input uses the shadcn `destructive` semantic. A separate task can introduce `--brand-red-destructive`.
- **[DEFERRED — `text-body-*` for input labels]** Currently uses `text-sm` / `text-base` Tailwind utilities. Brand body tokens are sized for editorial copy. Re-evaluate when E6.4 surfaces a call-site friction point.
- **[DEFERRED — `Label` component re-skin]** This PR does NOT touch `website/src/components/ui/label.tsx`. The label brand-styling is a separate Task 2.6 sibling sub-task.
- **[DEFERRED — icon-affix as a first-class component]** The `WithLeadingIcon` story documents the call-site composition pattern. If a future consumer (e.g. a real search box) surfaces friction, consider a thin `<InputWithIcon>` wrapper at the consumer's call site — NOT a render prop on Input itself.
- **[NEXT SUB-TASKS]** 14 remaining Task 2.6 components to ship as parallel-able sibling PRs: Textarea, Select, Checkbox, Radio, Switch, Table, Card, Tabs, Accordion, Modal/Dialog, Toast, Tooltip, Badge, Alert.

---

## Files in this PR

| Path | Status | Purpose |
|---|---|---|
| `website/src/components/ui/input.tsx` | modified | Extend shadcn Input with `cva` (state: default/error; size: default/md/sm/lg). Re-skins all 38 existing consumers to brand tokens. |
| `website/src/components/ui/input.stories.tsx` | new | 6 Storybook stories with `a11y.test: 'error'` |
| `website/src/components/ui/input.test.ts` | new | 17 contract tests (state + size resolution, token consumption, re-skin guard, error-token guard, default stability) |
| `docs/engineering/changes/2026-05-28-E6.2-task-2.6.b-input/HANDOFF.md` | new | This document |
