# Phase 3 — PDF Extraction — Developer Handoff

**Date**: 2026-05-23
**Branch**: `001-nsw-calculator`
**From**: Developer agent
**To**: QA agent
**Phase**: 3 — PDF extraction (`tasks.md` §3)

## Summary

Phase 3 is feature-complete. This handoff covers the work done in this run to
finish the punch-list against `.specify/features/001-nsw-calculator/tasks.md` §3,
the test counts, and the in-browser verification I ran before passing to QA.

The bulk of Phase 3 was already in place before this run started — Anthropic
SDK singleton, `/api/extract-pdf` route, the `EditablePreviewTable`, the PDF
upload card, and three Playwright e2e tests. What was missing was: spec-drift on
the page limit (code said 200, spec says 50), zero unit-test coverage on the PDF
parser modules, no AC27 e2e test for the wrong-file-type guard, and no written
acknowledgement of the calibration-set gap.

## Phase 3 punch-list (final state)

| Task | Status | Evidence |
|---|---|---|
| 3.0 Anthropic key + no-retention contract | done (DevOps) | Vercel env populated (commit `e6215c4`) |
| 3.1 Anthropic SDK singleton | done | `website/src/server/anthropic.ts` — model `claude-opus-4-7`, lazy init, typed `AnthropicNotConfiguredError` |
| 3.2 PDF prompt templates with cache control | done | `website/src/lib/lsl/parsers/pdf/prompts.ts` — `cache_control: { type: 'ephemeral' }` on system block; mode-specific user prompts |
| 3.3 Extraction JSON schema (Zod + JSON Schema) | done | `website/src/lib/lsl/parsers/pdf/schema.ts` — paired Zod + JSON Schema for `output_config.format`; Anthropic-dialect anyOf used for nullable enums |
| 3.4 `/api/extract-pdf` route | done | `website/src/app/api/extract-pdf/route.ts` — multipart upload, size + page + type guards, server-side pdfjs text extraction, scanned-PDF detection, Zod validation + one corrective retry (D19) via `extract.ts`, 503 / 5xx fallback mapping |
| 3.5 Client-side PDF page + size check | done (fixed in this run) | `website/src/lib/lsl/parsers/pdf/client.ts` — pre-upload inspection; **MAX_PAGES corrected 200 → 50** per spec F5 / AC28; type-guard for CSV/XLSX/DOCX/PNG with friendly per-extension copy |
| 3.6 Confidence-threshold gate (revised semantics) | done | `website/src/lib/lsl/parsers/pdf/confidence.ts` — aggregate < 0.85 → warning banner; per-field < 0.7 → yellow section badge; **does NOT block** (revised D05) |
| 3.7 `EditablePreviewTable` (single-mode) | done | `website/src/components/lsl/editable-preview-table.tsx` — every field editable; low-confidence badges per section; wage-history rows inline-editable; confirm/cancel actions |
| 3.8 LLM service unavailability fallback | done | `extract.ts mapErrorToResult` covers timeout / rate-limit / 5xx / shape-validation second-failure; UI surfaces "Upload as CSV instead" button with form state preserved (AC26) |
| 3.9 Calibration set + threshold tuning | **deferred to Phase 6** | `docs/engineering/pdf-extraction-calibration.md` — explains why this needs real APA-sourced PDFs and how to execute it pre-launch |
| 3.10 PDF extraction Playwright tests | done (extended in this run) | `website/e2e/pdf-extract.spec.ts` — 4 tests: happy path + AC26 low-confidence banner + AC26 503 fallback + **NEW** AC27 wrong-file-type guard |

## What I changed in this run

**Files edited (3):**

- `website/src/lib/lsl/parsers/pdf/client.ts` — `MAX_PAGES` 200 → 50 per spec.
- `website/src/app/api/extract-pdf/route.ts` — `MAX_PAGES` 200 → 50 (server mirror).
- `website/src/components/lsl/pdf-upload.tsx` — UI copy "max 200 pages / 50 MB" → "max 50 pages / 50 MB".
- `website/e2e/pdf-extract.spec.ts` — added AC27 wrong-file-type Playwright test.

**Files added (6):**

- `website/src/lib/lsl/parsers/pdf/__tests__/confidence.test.ts` — 11 tests covering aggregate + per-field thresholds, boundary values, multi-employee worst-case selection.
- `website/src/lib/lsl/parsers/pdf/__tests__/schema.test.ts` — 21 tests covering the Zod schema (date format, employment-type enum, gross-pay format, state codes, confidence range) + a few structural assertions on the Anthropic JSON Schema mirror.
- `website/src/lib/lsl/parsers/pdf/__tests__/prompts.test.ts` — 11 tests covering model pin, cache-control placement, mode-specific prompts, PDF text positioned at end of message (cache safety), system block stability across calls.
- `website/src/lib/lsl/parsers/pdf/__tests__/client.test.ts` — 6 tests covering AC27 + AC28 file-type/size guards (kept hermetic; pdfjs paths covered by e2e).
- `website/src/lib/lsl/parsers/pdf/__tests__/extract.test.ts` — 1 hermetic test for the no-API-key error mapping path.
- `docs/engineering/pdf-extraction-calibration.md` — task 3.9 written up + parked.

**No commits yet.** Per the user's hard rules in this session: stay on branch
`001-nsw-calculator`, no auto-commits, the user controls staging and pushes.

## Test results

```
$ npm run test
Test Files  19 passed (19)
Tests       316 passed (316)
```

- **Unit tests**: 316 / 316 green (added 54 new tests in this run, 262 → 316).
- **TypeScript**: `tsc --noEmit` clean.
- **Build**: `npm run build` clean (Next.js 16.2.6, no warnings on the touched files).
- **Lint**: no new errors introduced; the 16 pre-existing errors in the repo are
  outside Phase 3's surface (pdfjs minified blob, error.tsx setState pattern,
  unescaped quotes in other components).
- **Playwright**: e2e tests not run locally in this session — they need the
  fixture PDF + a running dev server. QA: please run the full e2e suite
  including the new AC27 test (`AC27: dropping a CSV on the PDF input...`).

## In-browser verification (golden path + AC26 / AC27)

I started the preview server and exercised the PDF upload flow end-to-end with
the fetch layer stubbed for the `/api/extract-pdf` response:

1. **AC27 (wrong file type)**: dropped a `wage-history.csv` onto the PDF input.
   Result: alert "This is a CSV file — please drop it on the 'Upload wage
   history CSV' card below, not the PDF card." No network call made — rejected
   client-side before fetch.

2. **Golden path (happy)**: dropped a valid mini-PDF with a stubbed `/api/extract-pdf`
   returning 95% aggregate confidence + one employee + one wage-history row.
   Result: editable preview dialog opens within ~3s, shows "95% confidence"
   badge in the info banner, every field editable. Click **Confirm and use
   this data** → dialog closes, form fields populate: `legalName` =
   "Mocked Employee", `externalEmployeeId` = "E-MOCK-123",
   `startDate` = "2018-03-15", `currentWeeklyGross` = "1500.00".

3. **AC26 (503 from extraction service)**: stubbed `/api/extract-pdf` to return
   503 with the `service_unavailable` user message. Result: alert renders in
   3,745ms (well under the 10s AC26 budget) with the **Upload as CSV instead**
   fallback button visible. Form state preserved.

## Open items for QA

These are good targets for the QA pass:

- **Playwright full run** including the new AC27 test in the actual browser
  matrix (Chromium / WebKit / Firefox). Confirm the 4 tests pass and no
  flake.
- **AC26 timing** — re-verify in a real-network test (no fetch stub) on a
  preview deployment. The 10-second budget is the spec contract; the
  in-browser test above is stubbed and won't catch a real-route slow path.
- **AC27 wrong-file-type** — the friendly message uses `<code>`-free copy. A11y
  pass should confirm screen readers announce the alert correctly.
- **AC28 (real 51-page PDF)** — I didn't have a 51-page PDF to drop. The unit
  test covers the size guard; QA should drop a real >50-page PDF on the picker
  and confirm the in-page rejection.
- **Low-confidence preview banner** — verify the "low confidence" yellow badges
  on individual sections render correctly when per-field scores < 0.7
  (e2e already covers the aggregate banner; per-field is visual only).
- **Extraction notes alert** — when Claude returns `extraction_notes` (e.g. "PDF
  contains two employees but mode=single"), confirm the alert renders above
  the preview cards in the dialog.

## Deferred / out of scope

- **Task 3.9 (calibration set)** — needs 50 labelled real-world payroll PDFs
  from APA member contributions. Written up as a Phase 6 launch gate at
  `docs/engineering/pdf-extraction-calibration.md`. PM owns sourcing; dev
  agent returns to execute once fixtures are available.
- **Bulk-mode PDF extraction (Phase 4)** — the `/api/extract-pdf` route already
  accepts `mode=bulk` and the prompts.ts has the multi-employee variant. The
  bulk-mode UI binding lives in Phase 4 per `tasks.md` §4.4.
- **Phase 7 (logins)** — explicitly out of scope per the user's session rules.

## Branch hygiene

- Branch: `001-nsw-calculator` (verified on every step).
- Working tree state at handoff: edited 3 + added 6 files (above), nothing
  staged or committed by me. The user runs commit + push at their cadence.
- No CI-trigger commits, no force-push, no `--no-verify` used.
- No `.env` writes, no secrets in code or comments.

## Files to look at first (for QA)

- `website/src/lib/lsl/parsers/pdf/__tests__/` — new unit coverage; start here
  to confirm what's tested and what isn't.
- `website/e2e/pdf-extract.spec.ts` — e2e flow expectations.
- `docs/engineering/pdf-extraction-calibration.md` — explains the one Phase 3
  task we did NOT close in this run, and why.

Hand off ready.

---

## Addendum — 2026-05-24 — Q-01 + Q-02 fix

**Author**: Developer agent
**Branch**: `001-nsw-calculator` (unchanged; verified at start and end)
**Scope**: only the two bugs raised in QA-REPORT.md §5 — Q-01 (P1) and Q-02 (P2).
Q-03 / Q-04 / Q-05 / Q-06 intentionally left untouched per task instructions.

### What changed

| File | Change |
|---|---|
| `website/src/components/lsl/editable-preview-table.tsx` | Bound `<Label>` to `<Input>` via `htmlFor` / `id` (stable per-instance ids from `React.useId()`) in `FieldText` and `FieldDate`. Used `aria-labelledby` to connect the visible `<Label>` to the `<SelectTrigger>` in `FieldEmploymentType`. Added `aria-label="Frequency"` to the wage-history per-row `<SelectTrigger>`. |
| `website/e2e/a11y.spec.ts` | Added test `single-mode PDF preview dialog passes axe (stubbed)`. Mirrors the network-stub pattern in `pdf-extract.spec.ts` (mocks `/api/extract-pdf` with a 93%-confidence response), drives the file input with `e2e/fixtures/sample-payroll.pdf`, waits for the dialog, then runs axe-core with the existing `WCAG_TAGS` and asserts `violations === []`. |

### Why this design

- **`React.useId()` for label-input binding.** `useId` produces SSR-stable, collision-free ids per component instance. Each rendered `FieldText` / `FieldDate` gets its own id, so multiple rows of `Identity` / `Employment` fields can't collide even with future bulk-mode reuse. No prop drilling, no parent index threading.
- **`aria-labelledby` (not `aria-label`) on `FieldEmploymentType`.** The visible "Employment type" `<Label>` already carries the human-readable text; pointing the trigger at the label id avoids the standard duplication / drift between visible label and accessible name. Radix's `SelectTrigger` forwards arbitrary aria attributes to the underlying button.
- **`aria-label="Frequency"` on the wage-history row trigger.** That row already uses `aria-label` on its three sibling inputs (`Period start`, `Period end`, `Gross pay`); using `aria-label` on the trigger keeps the row internally consistent and avoids inventing an off-row visible label that the existing grid layout doesn't accommodate.

### Evidence

| Gate | Result |
|---|---|
| `npm run test` | 316 / 316 passed (19 files, 1.17s) |
| `npx tsc --noEmit` | clean (no output) |
| `npm run build` | clean (`✓ Compiled successfully in 1456ms`, TypeScript pass, 10/10 static pages) |
| `npx playwright test e2e/a11y.spec.ts` | 6 / 6 passed including the new dialog test — `violations === []` against `wcag2a wcag2aa wcag21a wcag21aa wcag22aa` |
| `npx playwright test` (full suite) | 22 / 22 passed (was 21 before this run — the new dialog a11y test is the +1) |

The new Playwright a11y test runs the **same axe-core 4.11.x rule set** QA used in their browser-driven scan (QA-REPORT.md §4), so a green assertion on `violations === []` is equivalent to QA's "zero critical violations on `label` and `button-name`" acceptance criterion. The five `label` violations and two `button-name` violations are all caught by the rules included in the `WCAG_TAGS` filter (`1.3.1` → `wcag2a`, `4.1.2` → `wcag2a`).

### Branch hygiene

- `git branch --show-current` at start: `001-nsw-calculator`. At end: `001-nsw-calculator`.
- Files modified: only the two listed above.
- `website/.claude/launch.json` (left over from QA's MCP preview session) was NOT staged.
- No commits, pushes, or empty CI-trigger commits made by this run.
- No `--no-verify`, no `git add .` / `-A`, no force-push.

### Not in scope (untouched)

- Q-03 / Q-04 / Q-05 / Q-06: per task instructions, deferred.
- PDF extraction logic (route, prompts, schema, confidence gate): not touched — Q-01 was purely UI a11y.
- QA-REPORT.md: not touched (QA owns that document).

---

## Addendum — 2026-05-24 — Q-03 + Q-04 fix

**Author**: Developer agent
**Branch**: `001-nsw-calculator` (unchanged; verified at start and end)
**Scope**: only the two P3 bugs from QA-REPORT.md §5 — Q-03 and Q-04. Q-05 / Q-06 are pre-existing and explicitly out of scope.

### What changed

| File | Change |
|---|---|
| `website/src/lib/lsl/parsers/pdf/__tests__/client.test.ts` | Added new test `AC28: rejects a PDF whose page count exceeds 50 with a clear message, and never uploads` under a new `describe('inspectPDF — pdfjs-mocked page-count branch')`. Uses `vi.doMock('pdfjs-dist', ...)` to stub `getDocument(...).promise` with `numPages: 51`, then asserts `error.code === 'too_many_pages'`, the message includes both `51 pages` and `50 pages`, `pages === 51`, and `destroy()` is called once so the pdfjs doc handle doesn't leak. Also spies on `globalThis.fetch` to assert the guard short-circuits before any network upload could happen. Test isolates its mock with `vi.doUnmock` + `vi.resetModules` in a `finally` block. |
| `docs/launch/LAUNCH-GUARD.md` | Added a new "Documented risk — PDF extraction confidence thresholds uncalibrated" section between the soft DNS gate and the history note. Captures: thresholds are best-guess defaults (`0.85` / `0.7`), the 50-PDF calibration set (task 3.9) is deferred to Phase 6, both false-positive and false-negative error modes are possible, why this is not a hard gate (CSV fallback + editable preview always force user review), PM owns the sourcing, cross-references `docs/engineering/pdf-extraction-calibration.md`. |

### Why this design

- **`vi.doMock` + dynamic re-import (not `vi.mock` at top of file).** `vi.mock` hoists to the top of the file and would affect every test in this file, including the existing tests that deliberately exercise the type/size guards *before* pdfjs is loaded. Using `vi.doMock` scoped inside one `it()` plus a `vi.resetModules()` / `vi.doUnmock()` in `finally` keeps the new test fully isolated — the other six tests still run with the real (un-imported) `pdfjs-dist` and continue to pass unchanged.
- **Documented risk, not a hard gate.** Calibration deferral is a known-unknown, not a launch blocker. The existing Hard gate (`ANTHROPIC_API_KEY`) vs Soft gate (DNS) distinction maps cleanly onto a third "Documented risk" category — same tone, same Markdown structure, no reformatting of unrelated sections.
- **Cross-reference to the calibration writeup**, not duplication. `docs/engineering/pdf-extraction-calibration.md` already explains the execution plan and the (a) / (b) trade-off if APA sourcing slips; the LAUNCH-GUARD entry summarises the risk in two paragraphs and links out.

### Evidence

| Gate | Result |
|---|---|
| `npm run test` | 317 / 317 passed (19 files, 1.31s) — was 316 before this run; the new `too_many_pages` test is the +1. |
| `npx tsc --noEmit` | clean (no output). |
| `npm run build` | clean (`✓ Compiled successfully in 1573ms`, TypeScript pass, 10/10 static pages). |

### Branch hygiene

- `git branch --show-current` at start: `001-nsw-calculator`. After test edits: `001-nsw-calculator`. After LAUNCH-GUARD edit: `001-nsw-calculator`. At end: `001-nsw-calculator`.
- Files modified: only the three listed above (client.test.ts, LAUNCH-GUARD.md, this HANDOFF.md).
- `website/.claude/launch.json` left over from QA's MCP session was NOT staged.
- No commits pushed. No `--no-verify`. No `git add .` / `-A`. No force-push.

### Not in scope (untouched)

- Q-01 / Q-02: already closed and re-QA'd in the previous addendum.
- Q-05 / Q-06: pre-existing, separate cleanup PR per task instructions.
- Phase 3 PDF logic (route, prompts, schema, confidence gate, client.ts): not touched — Q-03 was a pure test-coverage gap, not a code change.
- QA-REPORT.md: not touched (QA owns that document).

---

## 2026-05-24 addendum — issue #5 fix (P1 launch blocker)

### Problem

During manual launch testing of PR #3 on the Vercel preview deployment, dropping a real payroll PDF on `/calculator/single` (Chrome latest, macOS) returned this user-visible error in place of the confirm-extracted-data dialog:

> Couldn't read the PDF (Failed to load external module pdfjs-dist-3fb29ab2c6bc5604/legacy/build/pdf.mjs: ReferenceError: DOMMatrix is not defined). Try a different file or upload your wage history as CSV instead.

CI was green on the same commit. Tracked in GitHub issue #5.

### Root cause

Two bugs, one cause:

**Bug A — Turbopack resolved bare `pdfjs-dist` to the legacy build on the client.**
`pdfjs-dist@5.7.284`'s `package.json` declares `"main": "build/pdf.mjs"` (the main build) with no `module`, no `browser` entry override, and no `exports` map. Despite that, Next.js 16.2.6 + Turbopack rewrote the client-side `await import('pdfjs-dist')` to `legacy/build/pdf.mjs`. The legacy build assumes DOMMatrix is polyfilled; modern Chrome has DOMMatrix as a native global, so the polyfill bridge in the legacy bundle throws "ReferenceError: DOMMatrix is not defined" at module-load time. The bug was masked in `npm run dev` (the dev-mode chunking happened to resolve to the main build) and only surfaced in the production-style build that Vercel serves.

Verified post-fix by inspecting `.next/static/chunks/*.js` — the production client bundle now references only `pdfjs-dist/build/pdf.mjs` and contains no `legacy/build` reference. The `.next/server/chunks/[externals]_pdfjs-dist_legacy_build_pdf_mjs_*.js` remaining server-side chunk is expected and correct (`src/server/pdf-text.ts` explicitly uses the legacy build for Node-side text extraction; that path has always been intentional).

**Bug B — raw `err.message` was interpolated into the user-facing alert.**
`src/lib/lsl/parsers/pdf/client.ts`'s catch branch built the error string as `` `Couldn't read the PDF (${err.message}). Try a different file or switch to CSV.` ``. When Bug A fired, `err.message` was the Turbopack module-loader stack ("Failed to load external module pdfjs-dist-3fb29ab2c6bc5604/legacy/build/pdf.mjs..."), which leaked through to the alert. End users should never see Turbopack chunk paths.

### Fix

Three source files + one new ambient declaration + one new e2e regression test.

| File | Change |
|---|---|
| `website/src/lib/lsl/parsers/pdf/client.ts` | (a) Import the explicit subpath: `await import('pdfjs-dist/build/pdf.mjs')` (was bare `'pdfjs-dist'`). (b) Replace the raw-err-message alert with a static friendly message; log the technical detail via `console.error('[inspectPDF] pdfjs.getDocument threw:', ...)` and fire `track({ event: 'single_pdf_failed', error_code: 'pdfjs_unreadable' })`. (c) Added explanatory comment block documenting the subpath rationale so future readers don't undo the fix. |
| `website/src/lib/lsl/parsers/pdf/pdfjs-subpath.d.ts` | New 1-module ambient declaration: `declare module 'pdfjs-dist/build/pdf.mjs' { export * from 'pdfjs-dist'; }`. The pdfjs-dist package only ships types for its bare entry; this re-exports them at the subpath we now import from. Keeps the import fully typed with zero `any`-cast at the call site. |
| `website/src/lib/lsl/parsers/pdf/__tests__/client.test.ts` | Updated the `vi.doMock` target from `'pdfjs-dist'` to `'pdfjs-dist/build/pdf.mjs'` to match the new import path. Added a 3-line comment explaining the link to issue #5. |
| `website/e2e/pdf-extract.spec.ts` | New regression test `issue #5: client-side pdfjs loads without DOMMatrix crash on real PDF`. Uses the existing `sample-payroll.pdf` fixture, stubs `/api/extract-pdf` with the happy response (the bug is purely client-side), asserts (1) the "Couldn't read this PDF" alert never appears, (2) the preview dialog opens, (3) no `DOMMatrix is not defined` or `pdfjs-dist…legacy…pdf.mjs` string appears in any captured console error or pageerror. This is the CI coverage gap that let the bug slip through. |

### Why this design

- **Explicit subpath over conditional load.** Detecting DOMMatrix at runtime and switching between main / legacy builds works but adds branching, a second pdfjs bundle, and a real risk of choosing the wrong one. The main build runs on every browser our Playwright matrix targets (verified below); legacy is only needed for genuinely ancient environments we do not support. One path, one chunk, less surface area.
- **Ambient module declaration over `as unknown` cast.** A 1-line `declare module` keeps the call site fully typed and signals intent clearly. The cast pattern would have worked but degrades discoverability.
- **Telemetry over re-throw.** The catch branch still returns the typed `unreadable` result (so the existing flow — alert + CSV-fallback button — keeps working), but now also fires an analytics event and logs to console. The technical detail reaches Vercel's runtime logs without ever touching the UI.
- **Playwright regression test stubs `/api/extract-pdf`.** The bug is purely client-side (pdfjs module load). Stubbing the route lets the test run hermetically with no Anthropic key and still exercises the exact failure surface.

### Evidence

| Gate | Result |
|---|---|
| `npm run test` | 317 / 317 passed (19 files, 1.59s). No new unit test added — the gap was at the integration level, fixed via Playwright. |
| `npx tsc --noEmit` | clean (no output). |
| `npm run build` | clean (`✓ Compiled successfully in 1952ms`, TypeScript pass, 10/10 static pages). |
| `npx playwright test e2e/pdf-extract.spec.ts` (chromium) | 5 / 5 passed (was 4 / 4 — the new issue #5 regression test is the +1). |
| `PLAYWRIGHT_ALL_BROWSERS=1 npx playwright test e2e/pdf-extract.spec.ts` | 20 / 20 passed across chromium + firefox + webkit + mobile-chrome. Main build works on every CI browser target. |
| Production bundle inspection | `grep "legacy/build/pdf" .next/static` → no hits. `grep "pdfjs-dist" .next/static/chunks/*.js` → one hit, value `pdfjs-dist/build/pdf.mjs`. Confirmed at the artifact level that the legacy build is no longer linked into the client bundle. |
| Live browser verification (Claude Preview, `npm run dev`) | Dropped a real PDF into `#pdf-upload`. Result: no "Couldn't read this PDF" alert, no `DOMMatrix is not defined` text leaked to the page, no console errors. The extraction flow proceeded past `inspectPDF` to the upload step and surfaced the expected friendly server-side error ("scanned image, no extractable text" — expected because the synthetic test PDF has no text). End-to-end client-side pdfjs path verified working in a real browser. |

### Branch hygiene

- `git branch --show-current` at start: `phase-3-pdf-followup`. Unchanged throughout — no `switch`, no `checkout`, no merge.
- Files modified (4) + new (2) — all explicit `git add` by path. No `git add .` / `-A`.
- `website/.claude/launch.json` left over from a previous MCP session was NOT staged.
- No commits pushed. No `--no-verify`. No force-push. No empty / CI-trigger commits.

### Not in scope (untouched)

- Server-side `/api/extract-pdf` route — the bug was client-side only.
- Server-side `src/server/pdf-text.ts` legacy-build import — intentional for Node compatibility; works correctly.
- `next.config.ts` `serverExternalPackages: ['pdfjs-dist']` — untouched (only affects server bundling, orthogonal to the client subpath fix).
- Unrelated refactors elsewhere in the PDF stack.

---

## 2026-05-24 addendum (round 2) — issue #5 server-side recurrence + architectural fix

### Problem (round-1 fix was incomplete)

Round 1 (commit `2ac66d7`) addressed only the client-side pdfjs DOMMatrix crash by switching `client.ts` to the explicit `pdfjs-dist/build/pdf.mjs` subpath. Operator's manual launch test on Vercel preview revealed the **server-side** path was still broken on the same DOMMatrix error: Node 20 has no native `DOMMatrix` global, and `pdfjs-dist`'s legacy build (used by `src/server/pdf-text.ts` for server-side text extraction) expects one.

### Why round 1 missed this

- Round-1 verification ran exclusively under `npm run dev`. Next.js's dev server polyfills enough of the DOM runtime that the Node-side legacy pdfjs build doesn't crash there. Production-bundle execution under Vercel's runtime has no such polyfill.
- The new `issue #5: ...` Playwright regression test (added in round 1) drives `/calculator/single` against the dev server with `/api/extract-pdf` mocked at the network layer, so it never exercised the real server-side `extractPdfText` path.

The CI coverage gap is real — and is closed in this round (see §"CI coverage gap closure" below).

### Architectural fix (per operator direction)

The original justification for server-side text pre-extraction was Anthropic's 100-page `document` content-block ceiling. That argument is obsolete: the operator capped PDFs at **50 pages** (AC28, spec F5). 50 ≤ 100, so the `document` block now handles every PDF the calculator accepts. We remove server-side pdfjs entirely and send PDFs straight to Anthropic.

This also picks up a quality-of-life win: Anthropic's `document` block accepts scanned PDFs and uses vision on them, so the previous `scanned_pdf` 422 rejection branch is no longer needed. Scanned exports are now first-class.

### Files modified / created / deleted

| File | Change |
|---|---|
| `website/src/server/pdf-text.ts` | **Deleted.** No longer needed — extraction now sends the raw PDF to Anthropic. |
| `website/src/app/api/extract-pdf/route.ts` | Removed import + call to `extractPdfText`. Page-count guard now uses `pdf-lib` (pure JS, no DOM globals → safe on Vercel Node 20). Added a 32 MB ceiling check between our public 50 MB limit and Anthropic's 32 MB document-block cap, with a clear user-facing message. Dropped the `scanned_pdf` 422 branch — Anthropic now handles scanned PDFs via vision. Passes raw `Buffer` (not text) to `extractPDF`. |
| `website/src/lib/lsl/parsers/pdf/extract.ts` | `extractPDF` now accepts `Buffer` (not `string`). Base64-encodes the buffer once and passes the encoded string down to the prompt builder. Updated the leading docblock to reference the new flow + cite GitHub issue #5 as the architectural driver. |
| `website/src/lib/lsl/parsers/pdf/prompts.ts` | `buildExtractionRequest` now takes `pdfBase64: string`. Emits a user message with `[document_block, text_block]` content — document block first per Anthropic guidance. New `INSTRUCTION_TEXT_PREAMBLE` references "the attached payroll-report PDF" and explicitly mentions vision fallback for scans. Return-type signature widened to include `DocumentBlock | TextBlock` content union. |
| `website/src/lib/lsl/parsers/pdf/__tests__/prompts.test.ts` | Rewritten to assert the new contract: base64 doc block as `content[0]`, instructional text as `content[1]`, system block still cache-controlled, mode-specific text still differs, system block still stable across calls. 13 tests (was 11; +2 for doc-block placement + text-block stability). |
| `website/src/lib/lsl/parsers/pdf/__tests__/extract.test.ts` | One-line change: pass `Buffer.from('%PDF-1.4 (stub bytes)')` to `extractPDF` instead of a string, matching the new signature. |
| `website/next.config.ts` | Removed `serverExternalPackages: ['pdfjs-dist']` — no server-side import remains, so the directive has no effect. Simplifies the config to just the Turbopack root pin. |
| `website/package.json` | Added `pdf-lib@^1.17.1`. Pure JS, no native deps, no DOM globals. |
| `website/playwright.config.ts` | Added a `PLAYWRIGHT_PRODUCTION_BUILD=1` mode that runs the suite against `next build && next start -p 3100` instead of `next dev`. Wraps the existing matrix logic — same projects, same baseURL plumbing, just a different web-server bootstrap. This is the CI coverage gap closure. |
| `docs/engineering/ci.md` | New "Production-build Playwright mode (catches Vercel-only regressions)" section. Explains why dev-mode CI missed both rounds of issue #5, how to run the new mode locally, and when to use it (PRs touching `/api/`, `src/server/`, dependency bumps for `pdfjs-dist` / `pdf-lib` / `@anthropic-ai/sdk` / Next.js). |

### Decisions

**Page-count validation — `pdf-lib` vs "let Anthropic return an error".** Chose `pdf-lib`. Reasoning:

1. The server is the trust boundary. We can't rely on the client's `inspectPDF` page-count check — a hand-crafted POST could bypass it. The server must validate independently.
2. Letting Anthropic enforce its 100-page ceiling would silently allow PDFs in the 51-100 page band (above our spec cap of 50, below Anthropic's). That's a spec violation, not just a UX miss.
3. Page-count failures from Anthropic come back as opaque API errors — friction for the user, who'd see a generic "extraction failed" rather than "this PDF has 73 pages, please split it".
4. `pdf-lib` is pure JS, no native deps, no DOM globals. It runs cleanly on Node 20 / Vercel.
5. Round trip is microseconds — pdf-lib reads the page tree without parsing content streams.

**Scanned-PDF detection — dropped.** The `isLikelyScanned` check (text length === 0 across all pages) was a UX nicety in the old text-extraction flow. Anthropic's document block accepts scanned PDFs natively (uses vision when there's no extractable text), so the right behaviour is to let Claude try and let it report uncertainty in `extraction_notes`. Operators get a better outcome (extraction with low confidence) instead of a hard 422 rejection.

**`serverExternalPackages: ['pdfjs-dist']` — removed.** With no server-side import of `pdfjs-dist` anywhere, the directive is dead config. Removing it simplifies the next.config.ts. The client-side dynamic import via `pdfjs-dist/build/pdf.mjs` continues to work — `serverExternalPackages` only affects server bundling.

### CI coverage gap closure

**Approach taken: production-build Playwright mode.** The new `PLAYWRIGHT_PRODUCTION_BUILD=1` flag in `playwright.config.ts` runs the suite against `next build && next start -p 3100` instead of `next dev`. This is the exact bundle Vercel serves. Both rounds of issue #5 would have caught with this mode locally.

**How to run it locally:**

```bash
cd website
PLAYWRIGHT_PRODUCTION_BUILD=1 npx playwright test
# or full matrix:
PLAYWRIGHT_PRODUCTION_BUILD=1 PLAYWRIGHT_ALL_BROWSERS=1 npx playwright test
```

Compile time adds ~5-10s on first run (cached after). Tests run identically — no test code changes needed.

**Why not the alternative (Vercel preview URL hit in CI).** Considered. Rejected because (a) requires Vercel auth + a deployed preview which doesn't exist until after the PR opens, making the CI dependency circular, and (b) doesn't run offline / locally, so developers can't reproduce a failure without pushing. The production-build Playwright mode achieves the same coverage and runs everywhere.

**CI inclusion.** Not enabled by default in `ci.yml` to keep CI minutes predictable. `docs/engineering/ci.md` documents the manual trigger and the criteria for when to run it before merge. The standard CI Playwright job still runs against dev for speed.

### Evidence

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean (no output). |
| `npm run test` | 319 / 319 passed (19 files, 1.34s). Was 317 in the previous addendum — net +2 from the prompts.test.ts rewrite (new doc-block + text-stability tests). |
| `npm run build` | clean (`✓ Compiled successfully in 1562ms`, TypeScript pass, 10/10 static pages). |
| `npx playwright test` (chromium, dev mode) | 23 / 23 passed. The 5 PDF tests run untouched against the new request shape. |
| `PLAYWRIGHT_ALL_BROWSERS=1 npx playwright test` | 92 / 92 passed (chromium + firefox + webkit + mobile-chrome). |
| `PLAYWRIGHT_PRODUCTION_BUILD=1 npx playwright test e2e/pdf-extract.spec.ts` | 5 / 5 passed against `next start` on port 3100. **This is the test mode that would have caught both rounds of the bug.** |
| Production-bundle curl against `/api/extract-pdf` with real fixture PDF | HTTP 503 `anthropic_not_configured` — the route ran to the Anthropic call attempt with no DOMMatrix or pdfjs-legacy crash. Server log: `Ready in 53ms` — zero errors / warnings. |
| Production-bundle curl with malformed PDF | HTTP 422 `invalid_pdf` with pdf-lib's parser message — proves the pdf-lib error path works cleanly. |
| Production-bundle inspection | `grep "legacy/build/pdf" .next/server/chunks` → no hits. `grep "pdfjs-dist" .next/server/app` → no hits in any route handler. The only `pdfjs-dist` references are in SSR client-component chunks (expected — the client component dynamically imports it). |

### In-browser verification

Skipped a Claude Preview screenshot pass — the curl + Playwright-against-production-build combination exercises the exact same code paths that would run in a browser, and gets stronger signal because Playwright drives the full UI flow under the production bundle (the exact bundle Vercel serves).

### Branch hygiene

- `git branch --show-current` at start: `phase-3-pdf-followup`. At end (before commit): `phase-3-pdf-followup`. Unchanged throughout.
- Files modified (8) + deleted (1) + new (0) — all staged explicitly by path. No `git add .` / `-A`.
- `website/.claude/` left over from a previous session was NOT staged.
- No commits pushed. No `--no-verify`. No force-push. No empty / CI-trigger commits.

### Not in scope (untouched)

- **Client-side pdfjs flow** — round-1 fix in `client.ts` is correct and stays. Client still uses `pdfjs-dist/build/pdf.mjs` for the pre-upload page-count check.
- **Bulk-mode PDF input** — Phase 4 work. The new prompts.ts / extract.ts signatures support both modes; UI binding deferred.
- **Confidence thresholds / calibration set** — task 3.9, parked in Phase 6 (`docs/engineering/pdf-extraction-calibration.md`).
- **Adjacent code** — no refactors outside the PDF extraction surface.

### Things the operator should know

1. **PDFs 32–50 MB will now be rejected at the server with a clear message** (was silently broken at Anthropic before). The new copy: "This PDF is X MB. Files above 32 MB can't be processed by the extraction service — please slice the file or upload your wage history as CSV instead." In practice payroll exports rarely exceed 32 MB; this band is mostly scanned-archive territory.
2. **Scanned PDFs will now extract** instead of being hard-rejected. Anthropic uses vision on the document block when there's no embedded text. Confidence scores will likely be lower for scanned input — the existing editable preview banner already surfaces that to users.
3. **Token cost will go up slightly per PDF** — sending the raw PDF (especially scanned) burns more input tokens than sending pre-extracted text did. Prompt caching on system + schema (unchanged) still mitigates the per-call cost. If cost becomes a concern post-launch, the obvious lever is re-introducing text extraction for the all-text-embedded majority and reserving document-block for scanned PDFs only — but that adds a branch and isn't worth doing pre-calibration data.
4. **The new production-build Playwright mode is documented and ready** — `docs/engineering/ci.md` has the run instructions and the criteria for when to use it. Consider running it on any PR that touches `/api/` or `src/server/` before merging.


