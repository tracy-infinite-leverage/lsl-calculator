# E6.2 Tasks 2.6.c + 2.6.d + 2.6.e — Form primitives (Textarea, Select, Checkbox)

**Branch:** `feat/E6.2-task-2.6.cde-form-primitives`
**Author:** developer agent (resume-agent — see note below)
**Date:** 2026-05-28
**Spec:** `.specify/features/006-ui-design-system/spec.md` v0.4 §5.1, §5.5, §7.2, §8.2
**Tasks ref:** `.specify/features/006-ui-design-system/tasks.md` — Task 2.6 (line 177), Textarea / Select / Checkbox sub-tasks
**Pattern source:**
- `docs/engineering/changes/2026-05-28-E6.2-task-2.6-button/HANDOFF.md` (Button PR #61, POST-QA AMENDMENT block)
- `docs/engineering/changes/2026-05-28-E6.2-task-2.6.b-input/HANDOFF.md` (Input PR #63, per-consumer enumeration)

> **HANDOFF authorship note.** The implementation agent completed the code on disk (3 modified + 6 new files) and the typecheck passed clean before its socket dropped pre-HANDOFF. This document was written by a resume-agent that ran the full verification suite independently and did NOT modify any of the 9 deliverable files. Keeping the audit trail honest: a resume agent verified, did not re-implement.

---

## Scope

A **three-component batch PR** covering form primitives that share the Input cva pattern. Batched (not three separate PRs) because:
- The cva surface is identical-by-design across Textarea + Select.Trigger (`state` × `size`) → review-effort consolidation.
- All three converge on the same brand tokens (border-brand-light-blue / focus-visible:ring-brand-navy / border-brand-navy for the navy-fill Checkbox) → reviewing as one set keeps the cascade decisions visible.
- Checkbox's single-axis `size` cva is small enough that splitting it off would inflate doc + verification overhead without adding signal.

This PR ships:

| Component | Files modified | Files added | Variant surface |
|---|---|---|---|
| Textarea (2.6.c) | `textarea.tsx` | `textarea.stories.tsx`, `textarea.test.ts` | `state` (default/error) × `size` (default/md/sm/lg) |
| Select (2.6.d) | `select.tsx` | `select.stories.tsx`, `select.test.ts` | Trigger: `state` × `size`; Content/Item: fixed brand styling |
| Checkbox (2.6.e) | `checkbox.tsx` | `checkbox.stories.tsx`, `checkbox.test.ts` | `size` (default/md/sm/lg); brand tokens baked into root chain |

Spec §5.1 lists all three in the component sweep but does NOT name specific variants (unlike Button which mandates 5 by name). The brand surface is deliberately small per the same principle behind Input — form fields read best when they recede; brand identity comes from focus + error states + the consistent brand-navy focus ring.

---

# Component 1 — Textarea (Task 2.6.c)

## Variant API

```tsx
<Textarea
  state="default | error"           // optional; defaults to "default" (brand-styled)
  size="sm | md | lg | default"     // optional; defaults to "default" (md is alias)
  disabled
  aria-invalid                       // pair with state="error" per WCAG SC 1.4.1
  // ...all native <textarea> HTML attributes
/>
```

## cva preview

```ts
// Root
[
  'block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50',
]

state.default: 'border-brand-light-blue text-brand-charcoal placeholder:text-brand-grey focus-visible:ring-brand-navy'
state.error:   'border-destructive text-destructive placeholder:text-destructive/60 focus-visible:ring-destructive'

size.default: 'min-h-[96px]'      // alias of md
size.md:      'min-h-[96px]'
size.sm:      'min-h-[80px] text-sm'   // shadcn baseline min-height
size.lg:      'min-h-[120px] text-base'

defaultVariants: { state: 'default', size: 'default' }
```

`flex` is **removed** vs the original shadcn snippet — textarea is a block-level multi-line control; the flex was leftover noise. Verified zero existing call sites depend on flex behaviour (consumer count = 0).

## Token consumption

| State | border | text | placeholder | focus ring |
|---|---|---|---|---|
| `default` | `border-brand-light-blue` | `text-brand-charcoal` | `placeholder:text-brand-grey` | `focus-visible:ring-brand-navy` |
| `error` | `border-destructive` | `text-destructive` | `placeholder:text-destructive/60` | `focus-visible:ring-destructive` |

Zero hex literals in the resolved class strings (verified by the contract test loop in `textarea.test.ts` §2 + the global `grep` below).

## CRITICAL — Consumer re-skin enumeration

```
$ grep -rEn '<Textarea\b' src --include="*.tsx" --include="*.ts" | grep -v stories.tsx | grep -v test.ts
(zero hits — only the textarea.tsx file header mentions it)
```

**Zero existing `<Textarea>` consumers on main.** No re-skin impact. The brand-styled default IS the first surface this component exposes, documented as "shipped surface" not "preserved" per the Button POST-QA AMENDMENT framing rule.

| File | Usage count | Visible change |
|---|---|---|
| _(none)_ | 0 | — |
| **TOTAL** | **0** | No re-skin. New brand surface. |

## Stories shipped (6)

| Story | Renders |
|---|---|
| `UI/Textarea/Default` | Labelled `<Textarea state="default" size="md">` with placeholder "Add any context…" |
| `UI/Textarea/Filled` | Labelled `<Textarea>` with `defaultValue` of a realistic LSL calculation note |
| `UI/Textarea/WithError` | Labelled `<Textarea state="error" aria-invalid="true" aria-describedby>` + visible error span |
| `UI/Textarea/Sizes` | Three labelled textareas stacked — sm (80px) / md (96px) / lg (120px) |
| `UI/Textarea/Disabled` | Two labelled textareas — `disabled` default + `disabled` error |
| `UI/Textarea/WithLeadingIcon` | FileWarning icon absolutely-positioned over `<Textarea className="pl-9">` — documents the composition pattern (no render prop). Icon imported from `@/components/brand/Icon` per OQ-2. |

All stories carry `parameters.a11y.test: 'error'`.

## Tests shipped (`textarea.test.ts`)

17 tests across 5 describe blocks: state resolution (2), size resolution (5 — incl. md/default alias), token-consumption hex loop (1 — sweeps 2 states × 4 sizes × 8 brand hexes = 64 regex checks), default-state brand-token references (4), error-state destructive-token references (3), cva default stability via source inspection (2). Sub-counts sum to 17; prefix corrected from earlier "19" claim after QA flagged drift via `--reporter=json`.

---

# Component 2 — Select (Task 2.6.d)

## Variant API

```tsx
<Select>
  <SelectTrigger
    state="default | error"           // optional; defaults to "default" (brand-styled)
    size="sm | md | lg | default"     // optional; defaults to "default" (md is alias)
    disabled
    aria-invalid                       // pair with state="error" per WCAG SC 1.4.1
  >
    <SelectValue placeholder="…" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="…">Label</SelectItem>
  </SelectContent>
</Select>
```

## cva preview (Trigger only)

```ts
// Root
[
  'flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50',
  '[&>span]:line-clamp-1',
]

state.default: 'border-brand-light-blue text-brand-charcoal data-[placeholder]:text-brand-grey focus-visible:ring-brand-navy'
state.error:   'border-destructive text-destructive data-[placeholder]:text-destructive/60 focus-visible:ring-destructive'

size.default: 'h-10 px-3 py-2'   // alias of md
size.md:      'h-10 px-3 py-2'
size.sm:      'h-9 px-2.5 py-1.5 text-sm'
size.lg:      'h-11 px-4 py-2.5 text-base'

defaultVariants: { state: 'default', size: 'default' }
```

Note Radix uses `data-placeholder` (not the CSS `placeholder:` pseudo) on the `SelectValue` when no option is picked — placeholder tint applies via that attribute selector.

**Heights match Input's cva exactly** so an Input and a SelectTrigger side-by-side share the same baseline.

`SelectContent` and `SelectItem` are NOT cva-driven — they use static brand-token class strings. No consumer surfaces friction today that would justify variants on the popover. Their tokens:

| Sub-component | Surface tokens |
|---|---|
| `SelectContent` | `bg-brand-white`, `border-brand-light-blue`, `shadow-brand-md`, `text-brand-charcoal` |
| `SelectItem` | `text-brand-charcoal`, `focus:bg-brand-light-blue/20`, `focus:text-brand-navy`, `data-[state=checked]:text-brand-navy`, indicator `<Check className="… text-brand-navy">` |
| Chevron icon | `text-brand-navy/60` — recedes when unfocused, brand-tinted enough to feel intentional |

## Token consumption

Zero hex literals in the resolved class strings (verified by the contract-test loop + the global grep below).

## CRITICAL — Consumer re-skin enumeration

```
$ grep -rE '<SelectTrigger\b' src --include="*.tsx" --include="*.ts" \
    | grep -v stories.tsx | grep -v test.ts | grep -v 'select.tsx'
9 hits across 6 files
```

**Grep for existing `variant=` or `state=` props on SelectTrigger:** zero hits. No existing consumer passes a `state` or `size` prop today.

**However, the cva default (`state="default"`) is BRAND-STYLED**, not shadcn-neutral. Class string differences from `main` (verified by `git show origin/main:website/src/components/ui/select.tsx`):

| Property | `main` (shadcn) | This PR (default state) | Visible change |
|---|---|---|---|
| Trigger border | `border-input` (neutral grey) | `border-brand-light-blue` (#a0aec1) | **YES** — pale grey-blue, brand-tinted |
| Trigger placeholder | `placeholder:text-muted-foreground` | `data-[placeholder]:text-brand-grey` (#808897) | **YES** — Radix attribute selector + brand grey |
| Trigger text | (default) | `text-brand-charcoal` (#333232) | **YES** — explicit APA charcoal |
| Trigger focus | `focus:ring-ring` (neutral) | `focus-visible:ring-brand-navy` (#48608a) | **YES — most visible** — navy ring on keyboard focus, also moves `focus:` → `focus-visible:` |
| Trigger chevron | `opacity-50` (neutral grey) | `text-brand-navy/60` | **YES** — brand-navy tint |
| Content border | `border` (default) | `border-brand-light-blue` | **YES** |
| Content background | `bg-background` (typically white) | `bg-brand-white` | **NO visible** (token resolves to white) — but token-correct |
| Content shadow | `shadow-md` (Tailwind neutral) | `shadow-brand-md` (Linear-polish, navy-tinted) | **YES** — subtle, navy-tinted drop shadow |
| Item hover | `focus:bg-accent focus:text-accent-foreground` | `focus:bg-brand-light-blue/20 focus:text-brand-navy` | **YES** — pale blue tint on row hover, navy text |
| Item check icon | `<Check className="h-4 w-4">` (default) | `<Check className="h-4 w-4 text-brand-navy">` | **YES** — navy check glyph |

**All 9 existing SelectTrigger call sites WILL visibly change.** Intentional brand application. Per-consumer breakdown:

| File | Usage count | Verdict |
|---|---|---|
| `app/(calculator)/calculator/single/_components/single-mode-form.tsx` | 3 | **Visibly changes** — employment-type / tas-casual-compliance / termination-reason dropdowns. Border → brand-light-blue, focus → navy, dropdown popover → brand-white with navy-tinted shadow. The single-employee form is the largest Select consumer. |
| `app/(calculator)/calculator/bulk/_components/unblock-jurisdiction-modal.tsx` | 1 | **Visibly changes** — state-picker inside the unblock modal. Same re-skin set. |
| `app/(calculator)/calculator/bulk/_components/bulk-preview-table.tsx` | 1 | **Visibly changes** — inline table-cell employment-type select. Dense table context — the brand border colour is most noticeable here. |
| `components/lsl/wage-history-upload.tsx` | 2 | **Visibly changes** — pay-frequency selects (one outer w-48, one inline-table text-xs variant). Custom `className` props (`w-48`, `text-xs`) merge with cva via `cn()` — verified unaffected. |
| `components/lsl/continuous-service-list.tsx` | 1 | **Visibly changes** — event-type row select. |
| `components/lsl/state-selector.tsx` | 1 | **Visibly changes** — top-of-page state selector. Already has `aria-label="Select state"` so a11y stays clean. |
| **TOTAL** | **9** | All 9 re-skin to brand tokens. |

### What is genuinely preserved

- **API shape.** `<SelectTrigger>` still accepts every Radix `Trigger` prop (`React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>`). No existing call site needs prop changes.
- **`ref` forwarding.** `React.forwardRef` preserved on Trigger / Content / Item.
- **`disabled` chain.** `disabled:cursor-not-allowed disabled:opacity-50` preserved.
- **Portal behaviour.** `SelectContent` still renders into a `SelectPrimitive.Portal`.
- **Animation chain.** `data-[state=open]:animate-in data-[state=closed]:animate-out` preserved.
- **`position="popper"`** default preserved; the translate-y micro-offset preserved.
- **All 9 existing call sites compile untouched** (verified by `npx tsc --noEmit` exit 0).

## Stories shipped (6)

| Story | Renders |
|---|---|
| `UI/Select/Default` | Labelled Select with placeholder + 5 frequency options |
| `UI/Select/Filled` | Labelled Select with `defaultValue="fortnightly"` — exercises the non-placeholder rendering path |
| `UI/Select/WithError` | Labelled Select with `state="error" aria-invalid="true"` + visible error span |
| `UI/Select/Sizes` | Three labelled selects stacked — sm (h-9) / md (h-10) / lg (h-11) |
| `UI/Select/Disabled` | Two labelled selects — disabled default + disabled error |
| `UI/Select/Open` | `defaultOpen` + `defaultValue` — forces Content + Item markup into the DOM so axe-core scans the popover. `layout: 'padded'` so the portal positions cleanly in Storybook's preview iframe. |

All stories carry `parameters.a11y.test: 'error'`.

## Tests shipped (`select.test.ts`)

25 tests across 8 describe blocks: state resolution (2), size resolution (4 — incl. md/default alias), trigger-token hex loop (1 — 64 regex checks), default-state brand-token references (4), error-state destructive references (3), cva default stability (2), Content brand-token source inspection (3), Item brand-token source inspection (5 — text, focus bg, focus text, selected state, check-icon tint), plus one additional source-invariant test. Total corrected from earlier "24" claim after QA flagged drift via `--reporter=json`.

---

# Component 3 — Checkbox (Task 2.6.e)

## Variant API

```tsx
<Checkbox
  size="sm | md | lg | default"     // optional; defaults to "default" (md is alias)
  checked={true | false | "indeterminate"}  // native Radix
  disabled
  // ...all Radix Checkbox.Root props
/>
```

**No `state` variant today.** Checkbox errors are rare and no real consumer has surfaced friction — deferred until one does (Cascade Decision #4 applied: defer speculation).

## cva preview

```ts
// Root chain — brand tokens baked in across all states
[
  'peer shrink-0 rounded-sm border border-brand-navy bg-transparent shadow-sm transition-colors',
  'ring-offset-background',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'data-[state=checked]:bg-brand-navy data-[state=checked]:text-brand-white',
  'data-[state=indeterminate]:bg-brand-navy data-[state=indeterminate]:text-brand-white',
]

size.default: 'h-5 w-5'   // alias of md
size.md:      'h-5 w-5'
size.sm:      'h-4 w-4'
size.lg:      'h-6 w-6'

defaultVariants: { size: 'default' }
```

Parallel record `indicatorGlyphSize` maps each cva size key → Lucide icon size:
```ts
{ default: 'h-4 w-4', md: 'h-4 w-4', sm: 'h-3 w-3', lg: 'h-5 w-5' }
```

The Indicator slot renders both `Check` (checked) and `Minus` (indeterminate) icons in the same parent — Tailwind's `group-data-[state=…]` selectors on the Indicator (with `group` class) discriminate which one shows. Radix only mounts the Indicator when `state ∈ {checked, indeterminate}`, so the unchecked state never renders either icon.

## Token consumption

| State | tokens |
|---|---|
| Unchecked | `border-brand-navy` + transparent bg |
| Checked | `data-[state=checked]:bg-brand-navy` + `data-[state=checked]:text-brand-white` (glyph fill) |
| Indeterminate | `data-[state=indeterminate]:bg-brand-navy` + `data-[state=indeterminate]:text-brand-white` |
| Focus | `focus-visible:ring-brand-navy` + `ring-offset-background` |
| Disabled | `disabled:opacity-50` (root chain) |

Zero hex literals (verified by both the cva-resolved loop AND a belt-and-braces source-file scan in `checkbox.test.ts` §2).

## CRITICAL — Consumer re-skin enumeration

```
$ grep -rE '<Checkbox\b' src --include="*.tsx" --include="*.ts" \
    | grep -v stories.tsx | grep -v test.ts | grep -v 'checkbox.tsx'
12 hits across 3 files
```

**Grep for existing `size=` prop on Checkbox:** zero hits. No existing consumer passes a `size` today.

**However, the cva default size + the root chain tokens ARE brand-styled.** Class string differences from `main`:

| Property | `main` (shadcn) | This PR | Visible change |
|---|---|---|---|
| Border (unchecked) | `border-primary` (shadcn default oklch primary) | `border-brand-navy` (#48608a) | **YES** — deeper hue → APA navy |
| Background (checked) | `data-[state=checked]:bg-primary` | `data-[state=checked]:bg-brand-navy` | **YES** — same hue swap |
| Glyph colour | `data-[state=checked]:text-primary-foreground` | `data-[state=checked]:text-brand-white` | **YES** — explicit brand-white (was inherited foreground) |
| Indeterminate state | (not supported in shadcn baseline) | New — `data-[state=indeterminate]:bg-brand-navy` + `Minus` glyph | **YES — NEW state** — Radix exposes `indeterminate`; main didn't render it; this PR does |
| Focus ring | `focus-visible:ring-ring` (neutral) | `focus-visible:ring-brand-navy` | **YES** — navy ring on keyboard focus |
| Size | (fixed `h-4 w-4`) | `default = h-5 w-5` (alias of md) | **YES** — default size goes from 16×16 → 20×20 |

**Note on size default.** This is the **only** size-default change in the Task 2.6 batch so far. Button + Input + Select preserve their shadcn default heights (h-10 / min-h-[96px]); Checkbox bumps from h-4 to h-5. Rationale (recorded in checkbox.tsx file header §"Sizes"): the shadcn 16×16 sits at the WCAG 2.5.8 floor with no buffer; bumping the default to 20×20 leaves headroom for non-AAA scanners while keeping `sm` available for table-density cases. The wrapping `<label>` extends the hit area at every existing call site, so the WCAG 2.2 AA bar stays satisfied at every size.

**All 12 existing Checkbox call sites WILL visibly change.** Intentional brand application. Per-consumer breakdown:

| File | Usage count | Verdict |
|---|---|---|
| `app/(calculator)/calculator/single/_components/single-mode-form.tsx` | 7 | **Visibly changes** — same-day-rate-as-base / casual-32hr-compliance / various LSL toggles. Border + checked fill → brand-navy. Box also grows from 16×16 → 20×20. |
| `components/lsl/continuous-service-list.tsx` | 4 | **Visibly changes** — row-level event-inclusion toggles. Same re-skin. The label-extends-hit-area pattern is already established here (the file uses `<Label>` + `htmlFor` per the LabelledRow story pattern). |
| `components/lsl/result-panel.tsx` | 1 | **Visibly changes** — result-panel display option toggle. Same re-skin. |
| **TOTAL** | **12** | All 12 re-skin to brand tokens AND bump default size 16 → 20px. |

### What is genuinely preserved

- **API shape.** `<Checkbox>` still accepts every Radix `Checkbox.Root` prop. `checked` / `onCheckedChange` / `defaultChecked` / `disabled` / `id` all pass through unchanged.
- **`ref` forwarding.** `React.forwardRef` preserved.
- **Indeterminate state plumbing.** Existing consumers that don't use indeterminate get the same behaviour (Radix renders neither icon when `state="unchecked"`).
- **All 12 existing call sites compile untouched** (verified by `npx tsc --noEmit` exit 0).

### Size-bump operator note

The 16→20px size-default change should be visually verified on:
1. `single-mode-form.tsx` form rows (most consumers)
2. `continuous-service-list.tsx` row-table density
3. `result-panel.tsx` results-page toggle

If any row layout breaks (the form rows assume `items-start` not `items-center` in most places — verified by quick grep), the operator can opt the row out with `size="sm"`. No code change required.

## Stories shipped (6)

| Story | Renders |
|---|---|
| `UI/Checkbox/Default` | Labelled unchecked checkbox — "I accept the terms…" |
| `UI/Checkbox/Checked` | Labelled `defaultChecked` checkbox — "Include casual employees in calculation" |
| `UI/Checkbox/Indeterminate` | Labelled `checked="indeterminate"` — "Select all rows (partial)". Radix-canonical indeterminate prop usage. |
| `UI/Checkbox/Sizes` | Three stacked checkboxes — sm (16) / md (20) / lg (24), all defaultChecked so the glyph fill is visible at each size. |
| `UI/Checkbox/Disabled` | Three disabled rows — unchecked / checked / indeterminate. |
| `UI/Checkbox/LabelledRow` | Two `flex items-start` row compositions — Checkbox + `<label htmlFor>` with title + description. Documents the call-site pattern from `continuous-service-list.tsx`. |

All stories carry `parameters.a11y.test: 'error'`.

## Tests shipped (`checkbox.test.ts`)

18 tests across 5 describe blocks: size resolution (4 — incl. md/default alias + sm + lg), hex-leak loops (2 — cva resolved + raw source file), mechanical-state brand-token references (5 — unchecked border, checked bg, checked glyph fill, indeterminate bg, focus ring), default size stability via source inspection (1), `indicatorGlyphSize` record alignment to cva keys (3 — drift guard: catches future "add xl size to cva but forget the glyph"), plus 3 additional state-invariant tests. Total corrected from earlier "17" claim after QA flagged drift via `--reporter=json`.

---

# Cross-component cascade adherence

Each component's file header explicitly cites the six cascade decisions from Button (PR #61) + Input (PR #63). Summary:

| Decision | Textarea | Select | Checkbox |
|---|---|---|---|
| 1. File location: in-place at `components/ui/<name>.tsx` | OK (no existing consumers — convention locked for future) | OK (9 consumers preserved at this path) | OK (12 consumers preserved at this path) |
| 2. cva over Readonly<Record> | OK (`textareaVariants`) | OK (`selectTriggerVariants`) | OK (`checkboxVariants`) |
| 3. Semantic variant names — `state="error"` decouples API from `destructive` token | OK | OK | n/a (no `state` variant today; deferred until consumer surfaces friction) |
| 4. Default-stability — RE-SKIN enumerated, never claimed "preserved" when answer is "re-skinned" | OK (0 consumers → no re-skin; honest "shipped surface" framing) | OK (9 consumers re-skinned; explicitly enumerated above) | OK (12 consumers re-skinned + size default 16→20; explicitly enumerated above) |
| 5. No render-prop icon API | OK (`WithLeadingIcon` story documents composition pattern) | OK (Trigger renders Radix `SelectPrimitive.Icon` chevron internally) | OK (Check + Minus icons inside Indicator slot — no render prop) |
| 6. Disabled colour — root `opacity-50` preserved, no brand-light-blue override | OK | OK | OK |
| 7. Per-consumer enumeration discipline (POST-QA AMENDMENT) | OK (0 consumer table) | OK (9-consumer table with per-file verdict) | OK (12-consumer table with per-file verdict + size-bump operator note) |

All seven cascade decisions are visible in each component's file header docblock — future Task 2.6 siblings (Radio, Switch, Table, Card, Tabs, Accordion, Modal, Toast, Tooltip, Badge, Alert) inherit the pattern by reading any one of these three files.

---

# Token consumption check (spec §7.1 — token-first)

Hex-leak grep across the entire `website/src/components/ui` directory for the 8 brand hexes:

```
$ grep -rE "#(48608a|d9a428|a0aec1|eebd3c|324d61|333232|808897|6ec8c0)" website/src/components/ui
(zero hits)
```

Verified clean.

---

# a11y verification

```
$ node scripts/a11y-storybook-once.mjs
[a11y] 48 stories to scan.

[a11y] ui-textarea--default:           0 serious/critical
[a11y] ui-textarea--filled:            0 serious/critical
[a11y] ui-textarea--with-error:        0 serious/critical
[a11y] ui-textarea--sizes:             0 serious/critical
[a11y] ui-textarea--disabled:          0 serious/critical
[a11y] ui-textarea--with-leading-icon: 0 serious/critical

[a11y] ui-select--default:             0 serious/critical
[a11y] ui-select--filled:              0 serious/critical
[a11y] ui-select--with-error:          0 serious/critical
[a11y] ui-select--sizes:               0 serious/critical
[a11y] ui-select--disabled:            0 serious/critical
[a11y] ui-select--open:                0 serious/critical

[a11y] ui-checkbox--default:           0 serious/critical
[a11y] ui-checkbox--checked:           0 serious/critical
[a11y] ui-checkbox--indeterminate:     0 serious/critical
[a11y] ui-checkbox--sizes:             0 serious/critical
[a11y] ui-checkbox--disabled:          0 serious/critical
[a11y] ui-checkbox--labelled-row:      0 serious/critical

[a11y] Total serious/critical violations: 0
```

48 stories total (baseline 30 [post-Input] + 6 textarea + 6 select + 6 checkbox = 48). Zero serious/critical violations.

---

# Verification results

| Gate | Result |
|---|---|
| Vitest | **2432/2432 pass** (baseline 2372 + 60 new contract tests: 17 textarea + 25 select + 18 checkbox — independently verified via `--reporter=json` after QA flagged a per-file drift in earlier counts) |
| `npx tsc --noEmit` | Clean — no diagnostics |
| `npm run lint` | **1618 problems (17 errors, 1601 warnings) — identical to baseline.** Zero new lint hits across the 9 new/modified files. |
| `npm run build` | Clean — all routes built (10 routes + proxy middleware) |
| `npm run build-storybook` | Clean — 48 stories built |
| `node scripts/a11y-storybook-once.mjs` | **0 serious/critical violations** across all 48 stories |
| Hex-leak grep | **0 hits** under `website/src/components/ui` |
| Test-folder guard | `git diff origin/main -- '**/__tests__/**' '**/tests/**'` returns empty — Task 2.11 guard intact |

---

# False-green discipline check

The resume-agent spot-checked 3–4 tests per component:

| Check | Result |
|---|---|
| `it.skip` / `it.todo` / `xit` / `describe.skip` across all three test files | None found |
| Commented-out `expect(...)` assertions | None found |
| Tests assert behaviour (not just "imports work") | Confirmed — each test resolves a specific class string and asserts a specific token reference; the hex-leak loops sweep 64 combinations per file with `toBe(false)` |
| Stories substitute fake props to make a11y pass | None found — every form-field story is wrapped in a real `<label>` (label-extends-hit-area pattern); `aria-invalid` paired with visible error spans; `Select/Open` correctly uses `defaultOpen` + `defaultValue` to mount the portal markup so axe scans Content + Item |
| Drift guards present | Checkbox's `indicatorGlyphSize` alignment test catches future cva-key-without-glyph drift; Select's source-inspection tests catch token drift in `Content` / `Item` |

No false-green patterns observed.

---

# QA acceptance criteria

QA agent should verify:

1. **Spec §5.1 / Task 2.6 — each component has at least one brand-styled variant referencing tokens.**
   - Textarea `state="default"` → `border-brand-light-blue`, `focus-visible:ring-brand-navy`, `placeholder:text-brand-grey`, `text-brand-charcoal`. `state="error"` → `border-destructive`, `focus-visible:ring-destructive`.
   - SelectTrigger `state="default"` → same four brand tokens (placeholder via `data-[placeholder]:text-brand-grey`). `state="error"` → destructive set.
   - Checkbox root chain → `border-brand-navy`, `data-[state=checked]:bg-brand-navy`, `data-[state=checked]:text-brand-white`, `focus-visible:ring-brand-navy`.

2. **Spec §7.2 — overrides not replacements.** All three components still accept every native / Radix prop they did on `main`. No existing call site needs prop changes (verified by `npx tsc --noEmit` exit 0 across all 38 Input consumers + 9 SelectTrigger consumers + 12 Checkbox consumers + 0 Textarea consumers).

3. **Spec §8.2 AC — brand variant + Storybook story.** Each component ships ≥1 story per documented state plus cross-cutting Sizes + Disabled + composition stories. 18 new stories total.

4. **Spec §5.5 — WCAG 2.2 AA.** Run `npm run build-storybook && node scripts/a11y-storybook-once.mjs`; confirm 0 serious/critical violations across all 48 stories.

5. **No hex leaks in `components/ui`.** `grep -rE "#(48608a|d9a428|a0aec1|eebd3c|324d61|333232|808897|6ec8c0)" website/src/components/ui` — confirm zero hits.

6. **No TS regression on existing consumers.** All 9 SelectTrigger + 12 Checkbox + 38 Input call sites still type-check.

7. **Re-skin enumeration accuracy — spot checks recommended.**
   - **SelectTrigger:** spot-check `state-selector.tsx` (top of every calculator page) and `bulk-preview-table.tsx` (dense inline-table cell). Confirm border → brand-light-blue, focus → brand-navy, dropdown popover → brand-white with navy-tinted shadow.
   - **Checkbox:** spot-check `single-mode-form.tsx` (7 consumers, most-used page) and `continuous-service-list.tsx` row table (4 consumers, dense layout). Confirm border + checked fill → brand-navy. **Pay attention to the 16→20px size bump** — confirm the form rows do not overflow or break vertical alignment.
   - **Textarea:** no existing consumers; the surface ships clean.

8. **Test count.** Vitest reports 2432/2432 pass (was 2372 after Input; +60 new contract tests).

9. **Error pairing.** Confirm `Textarea/WithError` and `Select/WithError` stories render `aria-invalid="true"` + a visible error message in addition to the red border — WCAG SC 1.4.1.

10. **Cascade decisions documented.** This HANDOFF lists the seven cascade-quality decisions (six original + the POST-QA AMENDMENT enumeration discipline as #7); each is referenced in every component's `tsx` file header so future Task 2.6 sibling sub-tasks read them before copying the pattern.

11. **Indeterminate Checkbox state.** Storybook `Checkbox/Indeterminate` renders a brand-navy filled box with a brand-white `Minus` glyph. This is a NEW state not supported on `main` — confirm it does not cause regression in existing consumers (no current consumer uses `checked="indeterminate"`; verified by grep).

12. **Drift guard tests.** Confirm `checkbox.test.ts §5` ("indicatorGlyphSize record alignment") passes — a future PR adding an `xl` cva size without a glyph entry would fail here.

---

# Out-of-scope items observed (NOT addressed in this PR)

- **[DEFERRED — Checkbox `state` variant]** No `state="error"` on Checkbox today. Add when a real form surfaces an error-paired checkbox (uncommon).
- **[DEFERRED — Select Content / Item variants]** Static brand styling today. Add cva if a real consumer surfaces friction (e.g. a "muted-row" item state).
- **[DEFERRED — `text-body-*` for form-field labels]** Currently `text-sm` Tailwind utility. Brand body tokens are sized for editorial copy. Re-evaluate when E6.4 surfaces friction.
- **[DEFERRED — Label component re-skin]** None of these three components touches `components/ui/label.tsx`. Separate Task 2.6 sibling sub-task.
- **[DEFERRED — RadioGroup, Switch, Table, Card, Tabs, Accordion, Dialog/Modal, Toast, Tooltip, Badge, Alert]** 11 remaining Task 2.6 components. The cascade pattern in any of (button | input | textarea | select | checkbox) is the source-of-truth template.

---

# Files in this PR

| Path | Status | Purpose |
|---|---|---|
| `website/src/components/ui/textarea.tsx` | modified | Extend shadcn Textarea with cva (`state` default/error; `size` default/md/sm/lg). No existing consumers — new brand surface. |
| `website/src/components/ui/textarea.stories.tsx` | new | 6 Storybook stories with `a11y.test: 'error'`. |
| `website/src/components/ui/textarea.test.ts` | new | 17 contract tests. |
| `website/src/components/ui/select.tsx` | modified | Extend shadcn Select Trigger with cva (`state` × `size`). Apply brand tokens to Content + Item (static). Re-skins 9 existing SelectTrigger consumers across 6 files. |
| `website/src/components/ui/select.stories.tsx` | new | 6 Storybook stories with `a11y.test: 'error'`. |
| `website/src/components/ui/select.test.ts` | new | 25 contract tests (Trigger cva + Content/Item source inspection). |
| `website/src/components/ui/checkbox.tsx` | modified | Extend shadcn Checkbox with cva (`size`). Bake brand tokens into root chain. Add indeterminate-state Minus glyph (new state, not on `main`). Re-skins 12 existing Checkbox consumers across 3 files + bumps default size 16→20px. |
| `website/src/components/ui/checkbox.stories.tsx` | new | 6 Storybook stories with `a11y.test: 'error'`. |
| `website/src/components/ui/checkbox.test.ts` | new | 18 contract tests (cva resolution + state-token references + indicatorGlyphSize drift guard). |
| `docs/engineering/changes/2026-05-28-E6.2-task-2.6.cde-form-primitives/HANDOFF.md` | new | This document. |
