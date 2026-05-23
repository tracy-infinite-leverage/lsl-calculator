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

