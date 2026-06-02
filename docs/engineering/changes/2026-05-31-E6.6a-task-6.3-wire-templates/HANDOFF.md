# Task 6.3 — Wire templates to API endpoint + flip PDF download flag

**Epic:** E6.6a (LSL Phase 5a — public-calc PDF download)
**Date:** 2026-06-02
**Branch:** `feat/E6.6a-6.3-wire-templates`
**Worktree:** `/Users/tracyangwin/code-projects/lsl-e6-5`
**Spec refs:** `.specify/features/006-ui-design-system/spec.md` v0.5 §5.3 / §8.4 / §8.6 / OQ-6, `tasks.md` lines 767-779.

## Summary

Wired the `SingleEmployee` + `BulkSummary` react-pdf templates (shipped in PRs #139/#140) into the canonical `POST /api/reports/[family]` dispatcher. The 501 `template-not-shipped` stub is now a 200 `application/pdf` response for the two public families. Flipped the public-calc PDF CTAs to point at the new endpoint and turned the bulk-summary feature flag on by default.

## Changes

### Part A — dispatcher wiring (`website/src/app/api/reports/[family]/route.ts`)

- Added imports: `Document` + `renderToBuffer` from `@react-pdf/renderer`, `Decimal` from `decimal.js`, `SingleEmployee` + `BulkSummary` from `@/lib/pdf/templates`, `Result` from `@/lib/lsl/engine/types`.
- Replaced the dispatch `TODO` block with a per-family branch:
  - `single-employee` → narrows the JSON payload via `narrowSingleEmployeePayload`, renders `<Document><SingleEmployee context payload /></Document>` via `renderToBuffer`, streams back as `application/pdf` with `Content-Disposition: attachment; filename="LSL-single-employee-{id?}-{date}.pdf"`.
  - `bulk-summary` → narrows via `narrowBulkSummaryPayload`, renders `<Document><BulkSummary context payload /></Document>`, streams back as `LSL-bulk-summary-{date}.pdf`.
  - `liability` + `reconciliation` → STILL 501 `template-not-shipped` (Phase 5b — lands with E5.5 / E5.6).
- Added `PayloadNarrowError` sentinel: thrown by the family narrowers when shape is invalid; caught at the dispatch site and surfaced as `400 invalid-payload` (distinct from the route-level Zod 400, which validates `context`).
- Added `rehydrateResult` helper to walk the engine `Result` and re-wrap string Decimal fields (`outputs.{valueOfWeek,valueOfDay,totalEntitlement.{weeks,dollars}}.value`, `diagnostics.{yearsOfContinuousService,weeklyAvg12mo,weeklyAvg5yr}`, `outputs.systemFormula.{value,variance,variancePct}`) back into real `Decimal` instances. **Why:** `decimal.js`'s `Decimal.toJSON()` emits strings, so `JSON.stringify` + `JSON.parse` round-trip loses the `.plus()`/`.toFixed()` method surface. `BulkSummary.sumComputedEntitlement` calls those methods on `dollars.value` to compute the banner total — without rehydration the route would 500 on the first multi-employee bulk render. The walk is shallow (only fields the templates touch); unknown fields pass through verbatim so future engine-side additive changes don't break this path.
- Added `buildFilename(family, identifier?)` for the `Content-Disposition` header.

### Part B — bulk CTA wiring (`website/src/app/(calculator)/calculator/bulk/_components/bulk-mode-form.tsx`)

- Swapped `fetch('/api/export-bulk-pdf')` → `fetch('/api/reports/bulk-summary')`.
- New payload shape `{ context: ReportContext, payload: { results, namesById, summary } }` matching `BulkSummaryPayload`.
- Imports `buildReportContext` from new helper `@/lib/pdf/report-context`.

### Part C — single-employee CTA wiring (`website/src/app/(calculator)/calculator/single/_components/single-mode-form.tsx`)

**Operator decision: Option 1 — swap immediately.** The legacy `/api/export-pdf` shape (flat, pre-stringified) is meaningfully different from the new `{ context, payload: { result, identity } }` contract. I rewrote the `downloadPDF` body to send the raw engine `Result` verbatim (no pre-stringification) — the route handler rehydrates Decimals on receipt. The legacy `/api/export-pdf/route.tsx` is left untouched in this PR; it can be deleted in a follow-up cleanup PR (no remaining callers in the codebase).

**Why option 1 is safe here:** the engine `Result` carries `.display` strings for every numeric field the legacy endpoint pre-stringified, so no information is lost. The Decimal rehydration handles the JSON round-trip for the BulkSummary aggregation path. No regression in the single-employee surface.

### Part D — feature flag flip (`website/.env.example`)

- `NEXT_PUBLIC_PDF_DOWNLOAD_ENABLED=false` → `=true` (with updated comment block documenting the 2026-06-02 flip).
- This unblocks the bulk-summary CTA on screen.

### Part E — new helper (`website/src/lib/pdf/report-context.ts` — NEW)

- Exports `CALC_METHODOLOGY_VERSION` (`'lsl-engine-v1.4.2'`), `STATE_ENGINE_VERSION` (`'rules-engine-v1.2'`), `APA_CONTACT_EMAIL`, `APA_CONTACT_URL`, and `buildReportContext({ reportTitle, organisationName?, generatedAtIso?, dataAsAtIso? }): ReportContext`.
- Centralises the version stamps + APA contact pair both CTAs need to construct a `ReportContext`. Values match the literals already used in the snapshot test fixtures (`A4Page.test.ts`, `MethodologyFooter.test.ts`, `templates/__tests__/*`) so prod renders and test renders embed identical stamps.

### Part F — test updates

- `website/src/app/api/reports/[family]/route.test.ts`: replaced the two 501-asserting public-family tests with 400-asserting tests (payload now narrows per family; opaque `{ whatever: '...' }` correctly 400s). Added two NEW positive-path tests — one per public family — that exercise the full react-pdf render via the real route handler, asserting 200 + `application/pdf` content-type + `attachment` content-disposition + `%PDF-`…`%%EOF` byte envelope (size > 1 KB). The OQ-6 Supabase-never-called invariant is reasserted on each positive-path test as belt-and-braces alongside the dedicated invariant test.
- `website/src/app/api/reports/__tests__/posture.test.ts`: updated the `VALID_BODY` fixture to carry both the single-employee `result` AND the bulk-summary `results` slice so the SAME fixture satisfies per-family narrowing for either target. The **assertions are unchanged** — they still assert `[200, 501]` for public families and `401` for authenticated families, preserving the OQ-6 contract. Inline doc comment explains the dual-payload pattern.

## Acceptance criteria — Task 6.3 (tasks.md L744-748)

- [x] **Single-employee CTA download produces a valid PDF** — verified via `route.test.ts > POST /api/reports/single-employee — PUBLIC posture (OQ-6) > returns 200 application/pdf for a valid single-employee payload (Task 6.3 dispatch)`. Real react-pdf render through the actual route handler; assertions on PDF byte envelope (`%PDF-` start, `%%EOF` end, >1 KB).
- [x] **Bulk-summary CTA download produces a valid PDF** — verified via `route.test.ts > POST /api/reports/bulk-summary — PUBLIC posture (OQ-6) > returns 200 application/pdf for a valid bulk-summary payload (Task 6.3 dispatch)`. Same byte-envelope assertions.
- [ ] **Both PDFs render cleanly across Chrome / Firefox / Safari / Edge print preview** — **MANUAL GATE.** Belongs to Task 6.4 (acceptance gate) per the dispatch brief. Not blocked by this PR.

## Local gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run test` (vitest run) | **3137 passed / 32 skipped / 0 failed** across 86 test files |
| `npm run build` | clean Next.js production build |
| `audit-bundle` (postbuild) | **PASS — no third-party origins, no dev-only imports, no SVG @import leaks** |
| `npm run lint` | **No new errors or warnings on files I touched.** Pre-existing 11 errors / 21 warnings unchanged (all in files outside this task's scope: legacy `/api/export-pdf`, state engines, observability). One pre-existing warning eliminated as a side effect (`ReportContext` unused import removed). |
| **Posture contract test (CRITICAL)** | `npx vitest run posture.test.ts` — **5/5 passed.** OQ-6 wire invariant holds: public families never 401; authenticated families always 401 without session. |

## Operator decisions

- **Single-employee CTA route migration: Option 1 (swap immediately).** Default per dispatch. Documented in `single-mode-form.tsx::downloadPDF` doc-comment. Legacy `/api/export-pdf/route.tsx` left in place; safe to delete in a follow-up cleanup PR (no callers).
- **PR cadence: 1-PR-per-task.** This dispatch is Task 6.3 ONLY. Task 6.4 (acceptance gate) will be a separate dispatch.

## Files touched

- **MAY-touch (per scope)**:
  - `website/src/app/api/reports/[family]/route.ts` — modified (dispatcher + rehydration + narrowing)
  - `website/src/app/(calculator)/calculator/bulk/_components/bulk-mode-form.tsx` — modified (CTA URL + payload)
  - `website/src/app/(calculator)/calculator/single/_components/single-mode-form.tsx` — modified (CTA URL + payload)
  - `website/.env.example` — modified (`NEXT_PUBLIC_PDF_DOWNLOAD_ENABLED=true`)
- **In-scope companion changes**:
  - `website/src/app/api/reports/[family]/route.test.ts` — modified (new positive-path tests, replaced obsolete 501 assertions with 400)
  - `website/src/app/api/reports/__tests__/posture.test.ts` — **fixture only** updated (VALID_BODY now carries `result` + `results` so the same fixture satisfies per-family narrowing). **Assertions unchanged** — the OQ-6 contract is preserved verbatim.
  - `website/src/lib/pdf/report-context.ts` — NEW (centralised `buildReportContext` helper + version constants)
- **MUST-NOT-touch (verified untouched)**:
  - `website/src/lib/pdf/templates/{SingleEmployee,BulkSummary,index}*` — consumed only
  - `website/src/lib/pdf/{Letterhead,MethodologyFooter,PageNumber,A4Page,fonts,types,families}*` — consumed only
  - `website/src/components/lsl/citation-block.{tsx,test.ts}` — untouched
  - `website/src/lib/lsl/**` — engine consumed only
  - `website/tests/**`, `website/e2e/**`, `website/src/__tests__/**` — untouched

## Follow-up items (not in this PR)

1. **Retire `/api/export-pdf` route** (option 1 cleanup). No callers remain after this PR. Trivial follow-up — single-file deletion + remove route from `app/api/`.
2. **Task 6.4 acceptance gate** — manual cross-browser print preview check (Chrome, Firefox, Safari, Edge) for both single-employee and bulk-summary PDFs.
3. **Vercel Production env**: set `NEXT_PUBLIC_PDF_DOWNLOAD_ENABLED=true` in the Vercel dashboard. The `.env.example` flip documents intent; the live value must be set by an operator with dashboard access.

## QA notes for next reviewer

- The posture contract test fixture now carries dual payload (single-employee + bulk-summary in one body). This is intentional and documented inline — it lets the same fixture satisfy per-family narrowing without bloating the test surface.
- The end-to-end PDF render path is exercised by route.test.ts positive-path tests — these run real react-pdf renders (font registration, page layout, content stream) through the real route handler. They take ~30-50 ms each. If they ever time out, lift the per-test `timeout` from 30000 ms.
- The `rehydrateResult` walk is shallow and defensive. If a future engine change adds a new Decimal-typed field to `Result`, BulkSummary's aggregation path will silently treat the string as opaque (the `total.plus(stringValue)` would still work because Decimal's constructor accepts strings) — but the cleanest fix is to extend `rehydrateResult` to cover the new field.
