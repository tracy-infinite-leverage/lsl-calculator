# E6.6a Task 6.2 — BulkSummary react-pdf template — HANDOFF

**Branch:** `feat/E6.6a-6.2-bulk-summary-template`
**Worktree:** `/Users/tracyangwin/code-projects/lsl-e6-5`
**Status:** Implementation complete; tests green; ready for PR review.
**Spec:** `.specify/features/006-ui-design-system/spec.md` v0.5 §5.4, §8.6, OQ-5.
**Tasks:** `.specify/features/006-ui-design-system/tasks.md` lines 726-739 (Task 6.2).

---

## What landed

Three files (one new template, one new snapshot test, one barrel update):

- `website/src/lib/pdf/templates/BulkSummary.tsx` — new react-pdf template
  that wraps a multi-employee bulk-summary table inside an `<A4Page>`.
- `website/src/lib/pdf/templates/__tests__/BulkSummary.test.ts` — 18 tests
  covering single-page render, multi-page render (50-row fixture), header
  repeat-on-every-page contract, column model, formatters, OQ-5 no-exec-
  summary, and A4Page composition inheritance.
- `website/src/lib/pdf/templates/index.ts` — barrel export adds
  `BulkSummary` + `BulkSummaryAggregates` / `BulkSummaryPayload` /
  `BulkSummaryProps` type exports alongside the SingleEmployee surface.

Mirrors Task 6.1 (SingleEmployee) in structure: same `<A4Page>` composition
pattern, same source-level "no exec summary" assertion, same multi-page
PDF byte-stream assertions via the `countPdfPages` helper from
`A4Page.test.ts`.

---

## Engine type consumed (READ-ONLY)

`Result` from `@/lib/lsl/engine/types`. The template consumes:

- `result.employeeId` — employee identifier column
- `result.status` — for the status column (formatted via `formatStatus`)
- `result.category` — Cat. column
- `result.diagnostics?.yearsOfContinuousService` — Years column (Decimal)
- `result.outputs?.totalEntitlement.weeks.display` — Weeks column
- `result.outputs?.totalEntitlement.dollars.display` — `$ Entitlement` column
- `result.outputs?.totalEntitlement.dollars.value` — Decimal aggregate in
  the banner total (summed via `.plus()` to preserve cent-accuracy).

The optional `namesById` map carries form-supplied legal names (the engine
`Result` does NOT carry the name — `bulk-mode-form.tsx` keeps it in
`parsed[].legalName` and projects via `namesById`; the template mirrors that).

The optional `summary` slice mirrors `bulk-mode-form.tsx::recountSummary`:
`{ computed: number; blocked: number; failed: number; elapsedMs?: number }`.
When absent, the template derives counts inline from the results array.

---

## Multi-page header repetition strategy

**Approach 1 (chosen): render-prop `<View fixed>` for the header.**

The table header is wrapped in `<View fixed>` at the top of the table body.
react-pdf re-renders fixed views on every page, which gives "header on
every page" behaviour for free when the row list overflows. Each body row
carries `wrap={false}` so a row never half-breaks across a page edge.

This mirrors the OQ-10 footer pattern Task 5.4 established for the
methodology footer band — `<View fixed>` for "per-page chrome that
repeats". The single `<Page>` block contract from Task 5.1 spike finding
#4 is preserved (the template renders inside ONE `<A4Page>` — no manual
page splitting).

Approach 2 (manual row batching across multiple `<Page>` elements) was
explicitly rejected — it's brittle (row heights are not knowable in
advance) and would break the `<A4Page>` composition contract.

---

## 50-row test result

```
✓ produces a multi-page PDF when row content overflows           125ms
✓ multi-page PDF embeds Montserrat (page 1) and Source Sans 3    123ms
✓ multi-page PDF is meaningfully larger than the single-page     151ms
  baseline (50 rows vs 3 rows; >2 KB delta)
```

- Single-page render (3 rows): 1 page, ~17 KB.
- Multi-page render (50 rows): 2+ pages (asserted via `countPdfPages` —
  `/Type /Page` regex from `A4Page.test.ts`); page count varies with
  row-height pagination but consistently ≥ 2.

The source-level "header repeats" contract is asserted via two regex
checks against the template source:

```
1. /<View\s+fixed[^>]*>\s*<BulkHeaderRow/   — header wrapped in <View fixed>
2. /styles\.bodyRow[^>]*wrap=\{false\}/      — row carries wrap={false}
```

These mirror the SingleEmployee byte-for-byte cross-surface assertion
pattern from `MethodologyFooter.test.ts` — structural contract at the
source level, sanity-checked by the rendered output.

---

## Tests run

- `npx tsc --noEmit` — clean.
- `npx eslint src/lib/pdf/templates/BulkSummary.tsx ...` — clean.
- `npx vitest run src/lib/pdf/` — 86 / 86 passed (7 files; includes the
  18 new BulkSummary tests + the 21 existing SingleEmployee tests + 47
  Phase 4 primitive tests).
- `npm test -- --run` — 3135 passed / 32 skipped / 0 failed across 86
  test files. No regressions.
- `npm run build` — clean Next.js production build.
- `audit-bundle.mjs` (postbuild) — PASS, no third-party origins, no
  dev-only imports, no SVG @import leaks.

---

## OQ-5 conformance

Per spec §5.4 + §8.6: "Single-employee and bulk-summary reports do NOT
carry a separate exec summary — they are already short enough that a
separate exec summary is noise."

The BulkSummary template renders ONE body section (`Bulk LSL summary`) with
a count banner + aggregate $ total + multi-employee table. No separate
"Executive summary" block. Asserted at the source level by stripping
block/line comments and grepping for `executive summary` / `exec summary`
in the code — same pattern as `SingleEmployee.test.ts`.

---

## Out-of-scope

Task 6.3 (next dispatch — NOT in this PR) wires both templates into the
`/api/reports/[family]/route.ts` dispatcher and flips the 501
"template-not-shipped" stub to a 200 `application/pdf` for both public
families. This PR only ships the template module + its tests.

The public-calc `bulk-mode-form.tsx` already sends `{ results, parsed,
summary }` to `/api/export-bulk-pdf` (Task 4.6 G-5 feature-flag CTA);
Task 6.3 will reconcile this with the canonical `/api/reports/[family]`
route + the template's `BulkSummaryPayload` envelope.

---

## File scope (auditor verification)

**Touched (allowed by dispatch brief):**
- `website/src/lib/pdf/templates/BulkSummary.tsx` (new, 478 lines)
- `website/src/lib/pdf/templates/__tests__/BulkSummary.test.ts` (new, 324 lines)
- `website/src/lib/pdf/templates/index.ts` (one barrel addition — 7 lines)
- `docs/engineering/changes/2026-05-31-E6.6a-task-6.2-bulk-summary-template/HANDOFF.md` (this file, new)

**Confirmed UNTOUCHED:**
- `website/src/lib/pdf/templates/SingleEmployee.tsx` (Task 6.1 shipped surface; consume only)
- `website/src/lib/pdf/{Letterhead,MethodologyFooter,PageNumber,A4Page,fonts,types,families}*` (Phase 4 shipped)
- `website/src/app/api/reports/[family]/route.ts` (Task 6.3 owns dispatcher wiring)
- `website/src/lib/lsl/**` (engine read-only)
- E5.1 auth paths, E5.2 parallel-session paths

---

## QA path

Per dispatch brief: stop after PR opened + local CI clean. No QA delegation
this dispatch. The next operator step is PR review + merge; Task 6.3 then
wires the template to the API route and end-to-end CTA tests run there.
