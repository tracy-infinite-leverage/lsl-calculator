# HANDOFF — E6.2 Tasks 2.6.f + 2.6.g — RadioGroup + Switch

**Date**: 2026-05-29
**Branch**: `feat/E6.2-task-2.6.fg-radio-switch` (off `main` @ a3fb6aa)
**Developer**: Claude (Opus 4.7) for Tracy

## Scope

Second batched component PR in the E6.2 Phase 2 component sweep. Closes the
**form-control half** of Task 2.6 by shipping the two remaining selection
primitives:

- **Task 2.6.f** — `RadioGroup` / `RadioGroupItem` brand override
- **Task 2.6.g** — `Switch` brand component (first-shipped surface)

Together with PR #61 (Button), PR #63 (Input), PR #64 (Textarea + Select +
Checkbox), this PR completes the form-controls subset of the 16-component
sweep. Remaining post-merge: Table, Card, Tabs, Accordion, Modal/Dialog,
Toast, Tooltip, Badge, Alert (9 components).

## Cascade decisions (mechanical from PR #61 → #63 → #64)

All decisions inherit from the prior three PRs:

1. **File location**: existing shadcn paths preserved
   (`components/ui/radio-group.tsx`, `components/ui/switch.tsx`).
2. **`cva` over `Readonly<Record>`**: variants resolve to class strings → cva.
3. **Semantic variant names**: `size="sm | md | lg | default"` mirrors the
   sibling family.
4. **No `state` variant** on either component — error states are rare on
   binary/radio selections; defer until a real consumer surfaces friction
   (same call as Checkbox in PR #64).
5. **No render-prop indicator/thumb** — fixed `lucide.Circle` for Radio,
   plain `<Switch.Thumb>` for Switch.
6. **Disabled colour**: shadcn-baseline `opacity-50 + cursor-not-allowed` on
   the root chain.

## Consumer re-skin enumeration

### RadioGroup — 11 existing `<RadioGroupItem>` call sites WILL change

All 11 live in `src/app/(calculator)/calculator/single/_components/single-mode-form.tsx`
(NT engine override controls).

Verified by grep:

```bash
$ grep -rn "RadioGroupItem" website/src --include="*.tsx" | wc -l
11
```

The `<RadioGroup>` Root is layout-only (no variants), so the only visible
change is on the `<RadioGroupItem>`:

| State       | Before (main)                            | After (this PR)              |
|-------------|-------------------------------------------|------------------------------|
| Unchecked   | `border-primary` (shadcn-default oklch)   | `border-brand-navy` (#48608a)|
| Checked dot | `text-primary` (deeper hue)               | `text-brand-navy`            |
| Focus ring  | `ring-ring` (shadcn-default)              | `ring-brand-navy`            |
| Sizes       | Always 16×16                              | sm 16 / md 20 / lg 24        |

No call site passes `size`, so all 11 land on the new `md` default (20×20) —
a +25% bump from the previous fixed 16×16. This matches Checkbox's `md`
default (PR #64) so radio + checkbox rows in the NT panel will visually
align row-for-row. Intentional consistency win.

### Switch — 0 existing call sites

```bash
$ grep -rn "from '@/components/ui/switch'" website/src
(no matches)
```

First-shipped surface. The brand-styled default IS the first exposed
surface — no re-skin enumeration needed. Framed as "shipped surface" per the
Textarea cascade (PR #64).

## Token consumption

Zero hex literals (spec §7.1, verified by `*.test.ts` hex-leak guard).

### RadioGroup tokens
- `border-brand-navy` — unchecked border
- `text-brand-navy` — inherited by the inner `<Circle />` via `text-current`
- `focus-visible:ring-brand-navy` — focus chain (matches Button + Input +
  Select + Checkbox)

### Switch tokens
- `data-[state=unchecked]:bg-brand-light-blue` — off-state track
- `data-[state=checked]:bg-brand-navy` — on-state track
- `border-brand-charcoal/40` — 1px bounding edge (supplies the WCAG SC 1.4.11
  non-text contrast for the off-state; light-blue alone falls below 3:1 vs
  white)
- `bg-brand-white` — thumb (applied imperatively on `<Switch.Thumb>`, not
  via cva)
- `focus-visible:ring-brand-navy` — focus chain

## Storybook coverage

5 stories per component (10 new total). All carry
`parameters.a11y.test = 'error'` so axe-core fails the story on serious /
critical violations.

### RadioGroup
- `UI/RadioGroup/Default` — 3-option group, no preselection
- `UI/RadioGroup/PreSelected` — `defaultValue="auto"` lights one option
- `UI/RadioGroup/Sizes` — sm / md / lg side-by-side
- `UI/RadioGroup/Disabled` — disabled unchecked + disabled checked
- `UI/RadioGroup/LabelledRow` — mirrors the `single-mode-form.tsx`
  hit-area-extension pattern (label + caption row, click anywhere)

### Switch
- `UI/Switch/Default` — off, labelled
- `UI/Switch/On` — `defaultChecked`, labelled
- `UI/Switch/Sizes` — grid of sm / md / lg in both states
- `UI/Switch/Disabled` — disabled off + disabled on
- `UI/Switch/LabelledRow` — settings-style row (title + caption + flush-right
  switch, full row clickable)

## Test surface

Two new contract test files (32 tests total):

- `radio-group.test.ts` — 12 tests: cva resolves, hex-leak guard, brand
  tokens on the three mechanical states, default size is `default`, glyph
  size record alignment.
- `switch.test.ts` — 20 tests: cva resolves, hex-leak guard (caught one
  documentation-comment hex on first pass — fixed), brand tokens on the
  four mechanical states + thumb, default size is `default`, thumb-size
  record alignment + translate-x sanity.

What is intentionally NOT covered in unit tests (per the established
cascade): axe-core a11y (deferred to Storybook), React render output
(JSDOM not configured), Radix `data-state` runtime behaviour (covered
upstream).

## Verification

| Gate                                              | Result          |
|---------------------------------------------------|-----------------|
| `npx vitest run` (full unit suite)                | 2464/2464 pass  |
| `npx tsc --noEmit`                                | clean           |
| `npx eslint <new files>`                          | clean           |
| `npm run build` (Next.js production build)        | success         |
| `npm run build` postbuild audit (`audit-bundle`)  | PASS            |
| `npm run build-storybook`                         | success         |
| Storybook indexes new stories                     | 10/10 listed    |
| `playwright test e2e/a11y.spec.ts --project=chromium` | 5/5 pass    |

The real-page axe-core guard covers `/calculator/single` — the route that
hosts the 11 re-skinned RadioGroupItem call sites — confirming zero
serious/critical violations after the brand-navy re-skin.

## Follow-ups

None for this PR. Remaining E6.2 Phase 2 task-2.6 components: Table, Card,
Tabs, Accordion, Modal/Dialog, Toast, Tooltip, Badge, Alert — each a
separate PR.

## Files changed

```
website/package.json
website/package-lock.json
website/src/components/ui/radio-group.tsx           (refactor: shadcn-baseline → cva + brand tokens)
website/src/components/ui/radio-group.stories.tsx   (new)
website/src/components/ui/radio-group.test.ts       (new)
website/src/components/ui/switch.tsx                (new)
website/src/components/ui/switch.stories.tsx        (new)
website/src/components/ui/switch.test.ts            (new)
docs/engineering/changes/2026-05-29-E6.2-task-2.6.fg-radio-switch/HANDOFF.md      (this file)
docs/engineering/changes/2026-05-29-E6.2-task-2.6.fg-radio-switch/QA-REPORT.md
```

New dependency: `@radix-ui/react-switch@^1.2.6` (pulls only Radix peers
already present; no third-party CDN risk per spec §5.7).
