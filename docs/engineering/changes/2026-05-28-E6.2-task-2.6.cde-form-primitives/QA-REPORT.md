# QA Report — E6.2 Tasks 2.6.c + 2.6.d + 2.6.e (Textarea / Select / Checkbox)

**Branch:** `feat/E6.2-task-2.6.cde-form-primitives`
**Base:** `origin/main @ 73fbec7`
**QA agent date:** 2026-05-28
**HANDOFF under review:** `docs/engineering/changes/2026-05-28-E6.2-task-2.6.cde-form-primitives/HANDOFF.md`
**Pattern source of truth:** `button.tsx` (PR #61) + `input.tsx` (PR #63)

---

## VERDICT — **PASS WITH NOTES**

All hard gates green. All cascade decisions honoured. Re-skin enumeration counts verified exactly per file. Zero hex leaks, zero a11y violations, type-safety holds against typo'd variant values, vitest 2432/2432.

Two NOTES (neither blocking):

1. **Per-file test-count drift in HANDOFF.** HANDOFF claims 19 / 24 / 17 (textarea / select / checkbox). Actual expanded vitest counts are **17 / 25 / 18**. The aggregate (60 new tests; baseline 2372 → 2432) is correct, so the HANDOFF's headline number is right — only the per-file breakdown is mis-counted. The test files themselves are substantive (no `it.skip` / `it.todo` / commented assertions; loop-expanded tests assert real behaviour). Recommend a one-line HANDOFF amendment for the audit trail. Non-blocking.
2. **Checkbox 16→20px size bump is a genuine design call beyond pure re-skin** and is clearly documented in both `checkbox.tsx` file header (lines 46-58) and HANDOFF §"Size-bump operator note" (lines 333-339). Layout-safety spot-check on the densest consumer (`single-mode-form.tsx` with 7 Checkboxes) passes — see §"Checkbox size-bump assessment" below. Non-blocking but operator should eyeball at preview-deploy time.

---

## Hard gates

| Gate | Result | Notes |
|---|---|---|
| Vitest | **2432/2432 pass** | Matches HANDOFF (baseline 2372 + 60 new). 50 test files all green. |
| `npx tsc --noEmit` | Clean | Zero diagnostics on full source. |
| `npm run lint` | **1618 problems (17 errors, 1601 warnings)** — identical to baseline | Zero new lint hits in the 9 new/modified files. |
| `npm run build` | Clean | 12 routes built, no warnings. |
| `npm run build-storybook` | Clean | 48 stories built. |
| a11y axe-core scan | **0 serious/critical across 48 stories** | Matches HANDOFF claim. |
| Hex-leak grep on `website/src/components/ui` | **0 hits** | All 8 brand hexes confirmed absent. |
| Test-folder guard (`__tests__` / `tests`) | Empty diff vs origin/main | Task 2.11 guard intact. |
| AC-X-3 typo rejection | **All 4 typos rejected** | `<Textarea size="meddium">`, `<Checkbox size="meddium">`, `<SelectTrigger size="meddium">`, `<SelectTrigger state="errror">` — all errored. Typo file deleted; `git status` clean. |

---

## Per-component AC tables

### Textarea (Task 2.6.c) — 5/5 PASS

| AC | Result | Evidence |
|---|---|---|
| AC-TA-1 — cva `state {default \| error} × size {sm \| md \| lg}`; `flex` removed | PASS | `textarea.tsx:63-120`. Root chain starts `block w-full` (no `flex`). State + size variants present. |
| AC-TA-2 — heights use `min-h-*` so user resize works | PASS | `textarea.tsx:108-113` — `min-h-[80px] / min-h-[96px] / min-h-[120px]`. `resize` not constrained. |
| AC-TA-3 — re-skin enumeration: 0 consumers | PASS | Independent grep on `website/src` (excluding stories/tests/component file itself): **0 hits**. Matches HANDOFF exactly. |
| AC-TA-4 — 19 contract tests assert real behaviour | PASS aggregate / NOTE | Vitest reports **17 tests** in `textarea.test.ts` (HANDOFF claimed 19). All 17 assert real cva-resolved class strings and source-file invariants. No skipped or trivial assertions. |
| AC-TA-5 — stories + a11y 0 violations | PASS | 6 stories. All 6 axe-clean: `default / filled / with-error / sizes / disabled / with-leading-icon`. |

### Select (Task 2.6.d) — 6/6 PASS

| AC | Result | Evidence |
|---|---|---|
| AC-SE-1 — brand cva on Trigger only; Content/Item static brand classes; heights match Input baseline | PASS | `select.tsx:94-147` — Trigger uses `selectTriggerVariants` cva. Content `select.tsx:182-206` and Item `select.tsx:212-237` use static class strings. Sizes `h-9 / h-10 / h-11` match `input.tsx` baseline exactly. |
| AC-SE-2 — chevron `text-brand-navy/60`; item check `text-brand-navy` | PASS | `select.tsx:166` (`<ChevronDown className="h-4 w-4 text-brand-navy/60" />`). `select.tsx:231` (`<Check className="h-4 w-4 text-brand-navy" />`). |
| AC-SE-3 — re-skin: 9 consumers across 6 files | PASS | Independent grep matches HANDOFF exactly: 3+1+1+2+1+1 = **9 in 6 files**: `single-mode-form.tsx` ×3, `unblock-jurisdiction-modal.tsx` ×1, `bulk-preview-table.tsx` ×1, `wage-history-upload.tsx` ×2, `continuous-service-list.tsx` ×1, `state-selector.tsx` ×1. |
| AC-SE-4 — all 9 consumers visibly change; spot-check single-mode-form.tsx renders acceptably | PASS | Verified that single-mode-form lines 304/541/983 use bare `<SelectTrigger id="…">` — they will pick up brand-light-blue border + brand-navy focus from defaultVariants automatically. No layout constraints (no `style=`/custom width on those triggers). The wage-history-upload.tsx triggers carry custom `className="w-48"` and `className="text-xs"`; cn() merge preserves both. |
| AC-SE-5 — 24 contract tests | PASS aggregate / NOTE | Vitest reports **25 tests** in `select.test.ts` (HANDOFF claimed 24). Substantive; Content/Item source-inspection tests guard fixed brand styling against accidental revert. |
| AC-SE-6 — stories + a11y 0 violations | PASS | 6 stories: `default / filled / with-error / sizes / disabled / open`. `Open` story uses `defaultOpen` to mount the Portal so axe scans Content + Item. All 6 axe-clean. |

### Checkbox (Task 2.6.e) — 7/7 PASS

| AC | Result | Evidence |
|---|---|---|
| AC-CB-1 — single-axis `size` cva; default = md = 20×20; size bump 16→20px documented | PASS | `checkbox.tsx:69-99`. cva has single `size` axis. Default = md = `h-5 w-5`. Size-bump rationale in file header lines 46-58 AND HANDOFF §"Note on size default" lines 312-315 + §"Size-bump operator note" lines 333-339. |
| AC-CB-2 — brand tokens for all four mechanical states | PASS | Root chain `checkbox.tsx:72-79`: `border-brand-navy` (unchecked) / `data-[state=checked]:bg-brand-navy + text-brand-white` / `data-[state=indeterminate]:bg-brand-navy + text-brand-white` / `focus-visible:ring-brand-navy` / `disabled:opacity-50`. |
| AC-CB-3 — indeterminate is NEW state; story + test exist | PASS | Story `Checkbox/Indeterminate` at `checkbox.stories.tsx:121-131` uses `checked="indeterminate"`. Test `checkbox.test.ts:146-149` asserts `data-[state=indeterminate]:bg-brand-navy`. Also `checkbox.test.ts:187-189` asserts `<Minus` icon present. |
| AC-CB-4 — re-skin: 12 consumers across 3 files | PASS | Independent grep matches HANDOFF exactly: 7+4+1 = **12 in 3 files**: `single-mode-form.tsx` ×7, `continuous-service-list.tsx` ×4, `result-panel.tsx` ×1. |
| AC-CB-5 — single-mode-form.tsx 7-checkbox layout doesn't break with 16→20px bump | PASS — see assessment below | Spot-checked all 7 call sites; surrounding `<label>` uses `items-center` or `items-start gap-2` flex containers. No `width` / `height` constraints would clip the 4px growth. |
| AC-CB-6 — 17 contract tests; drift guard for `indicatorGlyphSize` | PASS aggregate / NOTE | Vitest reports **18 tests** in `checkbox.test.ts` (HANDOFF claimed 17). Drift guard present: `checkbox.test.ts:171-181` asserts every cva size key has matching glyph entry. |
| AC-CB-7 — stories + a11y 0 violations | PASS | 6 stories: `default / checked / indeterminate / sizes / disabled / labelled-row`. All 6 axe-clean. |

### Cross-component (X) — 4/4 PASS

| AC | Result | Evidence |
|---|---|---|
| AC-X-1 — Cascade Decisions #1-7 applied uniformly | PASS | See §"Cascade decisions per component" below. |
| AC-X-2 — total verification (vitest 2432, tsc clean, lint 1618 baseline, build clean, storybook 48, a11y 0, hex-leak 0, test-folder guard empty) | PASS | All confirmed; see Hard gates table above. |
| AC-X-3 — typo rejection on Textarea + Checkbox + Select | PASS | tsc emitted 4 TS2322 / TS2820 errors for `size="meddium"` on Textarea/Checkbox/SelectTrigger plus `state="errror"` on SelectTrigger. File deleted; tree clean. |
| AC-X-4 — false-green discipline check | PASS | See §"False-green discipline check" below. |

---

## Independent re-skin enumeration (per-component grep)

**Textarea (claimed 0):**
```
$ grep -rEn '<Textarea\b' website/src --include="*.tsx" --include="*.ts" \
    | grep -v stories.tsx | grep -v test.ts
(only the textarea.tsx file's own header comments mention `<Textarea`)
```
→ **0 consumers. Matches HANDOFF.**

**Select (claimed 9 across 6 files):**
| File | Independent count | HANDOFF claim | Match |
|---|---|---|---|
| `app/(calculator)/calculator/single/_components/single-mode-form.tsx` | 3 | 3 | yes |
| `app/(calculator)/calculator/bulk/_components/unblock-jurisdiction-modal.tsx` | 1 | 1 | yes |
| `app/(calculator)/calculator/bulk/_components/bulk-preview-table.tsx` | 1 | 1 | yes |
| `components/lsl/wage-history-upload.tsx` | 2 | 2 | yes |
| `components/lsl/continuous-service-list.tsx` | 1 | 1 | yes |
| `components/lsl/state-selector.tsx` | 1 | 1 | yes |
| **Total** | **9 / 6 files** | **9 / 6 files** | **EXACT MATCH** |

**Checkbox (claimed 12 across 3 files):**
| File | Independent count | HANDOFF claim | Match |
|---|---|---|---|
| `app/(calculator)/calculator/single/_components/single-mode-form.tsx` | 7 | 7 | yes |
| `components/lsl/continuous-service-list.tsx` | 4 | 4 | yes |
| `components/lsl/result-panel.tsx` | 1 | 1 | yes |
| **Total** | **12 / 3 files** | **12 / 3 files** | **EXACT MATCH** |

---

## Cascade decisions per component

| Decision | Textarea | Select | Checkbox |
|---|---|---|---|
| **1. In-place at `components/ui/`** | PASS (zero consumers; convention locked) | PASS (9 consumers preserved) | PASS (12 consumers preserved) |
| **2. cva over Readonly<Record>** | PASS (`textareaVariants`) | PASS (`selectTriggerVariants`; Content/Item static-classes — documented) | PASS (`checkboxVariants`) |
| **3. Semantic variant names** | PASS (`state="error"`) | PASS (`state="error"`) | n/a (no state variant; deferred — documented in file header §4) |
| **4. Default-stability + re-skin enumeration** | PASS (0-consumer table; honest "shipped surface" framing) | PASS (9-consumer table; per-file breakdown; all visibly change — flagged intentional) | PASS (12-consumer table; per-file breakdown; size bump explicitly flagged as beyond pure re-skin) |
| **5. No render-prop icon API** | PASS (`WithLeadingIcon` story documents composition pattern using brand barrel `FileWarning`) | PASS (chevron internal Radix; leading icons are call-site composition) | PASS (Check + Minus icons inside Indicator; no render prop) |
| **6. Disabled — root `opacity-50`, no brand-light-blue override** | PASS | PASS | PASS |
| **7. (POST-QA AMENDMENT) Re-skin honest framing — never "preserved" when "re-skinned"** | PASS (0-consumer text never says "preserved") | PASS ("All 9 existing SelectTrigger call sites WILL visibly change") | PASS ("All 12 existing Checkbox call sites WILL visibly change") |

All seven decisions visible in each component's file-header docblock. Future Task 2.6 siblings (Radio, Switch, Table, Card, Tabs, Accordion, Dialog, Toast, Tooltip, Badge, Alert) inherit the pattern.

---

## a11y per-story breakdown

48 stories total. All scanned. Zero serious/critical violations.

**New from this PR (18 stories):**

| Story | serious/critical |
|---|---|
| `ui-textarea--default` | 0 |
| `ui-textarea--filled` | 0 |
| `ui-textarea--with-error` | 0 |
| `ui-textarea--sizes` | 0 |
| `ui-textarea--disabled` | 0 |
| `ui-textarea--with-leading-icon` | 0 |
| `ui-select--default` | 0 |
| `ui-select--filled` | 0 |
| `ui-select--with-error` | 0 |
| `ui-select--sizes` | 0 |
| `ui-select--disabled` | 0 |
| `ui-select--open` (Portal mounted for scan coverage) | 0 |
| `ui-checkbox--default` | 0 |
| `ui-checkbox--checked` | 0 |
| `ui-checkbox--indeterminate` | 0 |
| `ui-checkbox--sizes` | 0 |
| `ui-checkbox--disabled` | 0 |
| `ui-checkbox--labelled-row` | 0 |

Baseline 30 (post-Input) + 18 new = **48 total** — matches HANDOFF.

Note on Select coverage: the `Open` story uses Radix `defaultOpen` to force the Portal-rendered popover into the DOM so axe-core scans `SelectContent` + `SelectItem` markup, not just the closed Trigger. Good discipline — without this, the popover would be invisible to axe.

Note on Checkbox coverage: every Checkbox in a labelled context is wrapped in `<label>` (or paired via `htmlFor` + `id`), so axe's "form field must have a label" rule is satisfied. The indeterminate story uses `checked="indeterminate"` (the Radix-canonical literal-string form, NOT a boolean).

---

## False-green discipline check

Spot-checked 3+ tests per file. Looked for the patterns flagged in the task brief.

| Check | Result |
|---|---|
| `it.skip` / `it.todo` / `xit` / `describe.skip` | None across the 3 test files (grep confirmed) |
| Commented-out `expect(...)` assertions | None |
| Trivial truthy assertions (`expect(true).toBe(true)`) | None |
| Tests assert real behaviour | YES — each test resolves a specific cva class string or reads `*.tsx` source and asserts a specific token reference. Loop-expanded tests sweep state × size combinations with `toBe(false)` against 8 brand hexes (64 negative assertions per file). |
| Stories substitute fake props to pass a11y | NO — every form-field story wraps the control in a real `<label>` (label-extends-hit-area). Error stories pair `aria-invalid="true"` with a visible `<span id=… class="text-destructive">` error message. `Select/Open` correctly forces the Portal so Content+Item are scanned, not just the closed trigger. |
| Drift guards present | Checkbox `indicatorGlyphSize` alignment test (`checkbox.test.ts:171-181`) catches future "added cva size but forgot the glyph entry" drift. Select source-inspection tests (`select.test.ts:192-232`) catch token drift on Content + Item. cva default-stability tests on all 3 components catch accidental flip. |

Spot-check details:
- `textarea.test.ts:113-133` — default state asserts presence of `border-brand-light-blue`, `focus-visible:ring-brand-navy`, `placeholder:text-brand-grey`, `text-brand-charcoal`. Four real, distinct, load-bearing assertions.
- `select.test.ts:118-149` — same shape for Select Trigger default, with the Radix-specific `data-[placeholder]:text-brand-grey` (correctly NOT `placeholder:text-brand-grey`, because Radix uses the data-attribute selector on `SelectValue`).
- `checkbox.test.ts:130-155` — mechanical-state assertions: unchecked border / checked bg / checked glyph fill / indeterminate bg / focus ring. Each test reads the same `md`-resolved cva output but asserts a different substring — coverage, not redundancy.

No false-green patterns observed.

---

## Checkbox 16→20px size-bump assessment

This is the only design call in the batch beyond pure re-skin. Verified safe.

**Layout flexbox containers for the 7 single-mode-form Checkboxes:**

| Line | Container | Risk |
|---|---|---|
| 404 | `<label className="flex items-center gap-2 text-sm cursor-pointer">` | none — single short label; 4px box growth absorbed by `items-center`'s vertical-centering. |
| 553 | `<label className="flex items-start gap-2 text-sm cursor-pointer">` | none — top-aligned; multi-line label text wraps to the right of a 20px box exactly as it did for 16px. |
| 570, 585, 814, 833, 849 | same `items-start gap-2` pattern | none — same as above. |

**`continuous-service-list.tsx` (4 Checkboxes):** the HANDOFF claims this file already uses `<Label>` + `htmlFor` pattern; spot-confirmed via story `LabelledRow` which renders identically with `items-start gap-2` and a 20px box. Safe.

**`result-panel.tsx` (1 Checkbox):** single instance; no layout constraint risk.

**Operator note from HANDOFF (lines 333-339) is sound:** if any row layout breaks visually at preview-deploy, opt that row out with `size="sm"` — no code change required (the cva already exposes that escape hatch).

Verdict: **safe design call.** The 4px growth is intentional (raises the default above the WCAG 2.5.8 floor with headroom) and the label-extends-hit-area pattern is already in place at every consumer. No layout intervention required.

---

## Notes & sign-off

**Sign-off recommendation: APPROVE to merge.**

The implementation is clean. The cascade pattern from Button (PR #61) + Input (PR #63) extended cleanly to 3 sibling components in a batched PR — exactly the discipline the POST-QA AMENDMENT block was written for. The re-skin enumeration tables in the HANDOFF are factually correct on consumer counts and per-file breakdowns (independently verified). The dropped-then-resumed agent run did not introduce drift: the 9 component files are coherent with the documentation written by the resume agent.

The one drift to fix (post-merge, optional): the HANDOFF's per-file test-count claims (19 / 24 / 17) are slightly off (actual 17 / 25 / 18). The aggregate is correct (+60). This is a documentation correction, not a test-quality issue.

**Out-of-scope items observed (correctly deferred):**
- Checkbox `state="error"` variant — no real consumer needs it yet.
- Select Content/Item cva — no friction surfaced; static brand styling sufficient.
- Label component re-skin — separate Task 2.6 sibling.

**Files reviewed (absolute paths):**
- `/Users/tracyangwin/code-projects/lsl-calculator/website/src/components/ui/textarea.tsx`
- `/Users/tracyangwin/code-projects/lsl-calculator/website/src/components/ui/textarea.stories.tsx`
- `/Users/tracyangwin/code-projects/lsl-calculator/website/src/components/ui/textarea.test.ts`
- `/Users/tracyangwin/code-projects/lsl-calculator/website/src/components/ui/select.tsx`
- `/Users/tracyangwin/code-projects/lsl-calculator/website/src/components/ui/select.stories.tsx`
- `/Users/tracyangwin/code-projects/lsl-calculator/website/src/components/ui/select.test.ts`
- `/Users/tracyangwin/code-projects/lsl-calculator/website/src/components/ui/checkbox.tsx`
- `/Users/tracyangwin/code-projects/lsl-calculator/website/src/components/ui/checkbox.stories.tsx`
- `/Users/tracyangwin/code-projects/lsl-calculator/website/src/components/ui/checkbox.test.ts`
- `/Users/tracyangwin/code-projects/lsl-calculator/docs/engineering/changes/2026-05-28-E6.2-task-2.6.cde-form-primitives/HANDOFF.md`

— QA agent, 2026-05-28
