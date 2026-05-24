# Phase 3 — PDF Extraction — QA Report

**Date**: 2026-05-24
**Reviewer**: QA agent
**Branch**: `001-nsw-calculator` (verified at start and end; no commits made)
**HEAD reviewed**: `5be8526 feat(pdf): NSW Phase 3 — Anthropic PDF extraction feature-complete`
**Inputs**: Developer HANDOFF, spec.md ACs (AC3, AC26, AC27, AC28), tasks.md §3, calibration writeup

## Overall verdict

**PASSES WITH NOTES.**

All four Phase 3 ACs (AC3, AC26, AC27, AC28) functionally pass in browser-driven verification. Unit and Playwright suites are green (316/316 unit, 21/21 e2e). The implementation is sound and the calibration deferral is justified as a Phase 6 launch gate.

**Two notes that should be addressed before customer traffic** (not blockers for the branch's merge, but they belong in the launch-gate punch list):

1. **P1 — A11y violations in the PDF preview dialog (`EditablePreviewTable`).** Five form inputs are not associated with their labels (`Label` has no `htmlFor`, `Input` has no `id`), and two Radix `Select` triggers have no accessible name. WCAG 2.1 A criteria `1.3.1` and `4.1.2`. Caught via axe-core 4.11.4 in the browser; the existing `a11y.spec.ts` doesn't open the dialog so CI does not catch it.
2. **P3 — Coverage gaps in the new unit suite.** Two narrow gaps worth a follow-up; both have e2e fallbacks today.

Calibration (task 3.9) deferral to Phase 6: **valid**. Reasoning in §7.

---

## 1. Branch hygiene

| Check | Start of QA | End of QA |
|---|---|---|
| `git branch --show-current` | `001-nsw-calculator` | `001-nsw-calculator` |
| Modified files outside scope | none | none |
| New commits by QA | — | none |
| Untracked added by QA | — | `website/.claude/launch.json` (preview-server config; small, not part of Phase 3 — leave staging decision to the developer) |

I did not stage, commit, or push anything. The single touched file is `website/.claude/launch.json`, created so I could drive the Claude Preview MCP tools — not a code change to Phase 3 logic.

## 2. Test results

### Unit (vitest)

- **Result**: 316 / 316 passed (19 files). Matches developer claim.
- **Duration**: 1.59s.
- **New Phase 3 test files reviewed**:
  - `confidence.test.ts` (11 tests) — solid; covers boundary values at thresholds, multi-employee worst-case selection, threshold constants exported. Good.
  - `schema.test.ts` (21 tests) — thorough; covers Zod date format, employment-type enum, gross-pay format (currency + thousands separators), state codes, confidence range boundaries, JSON Schema mirror structural assertions. Good.
  - `prompts.test.ts` (11 tests) — protects the prompt-cache invariants well: model pin, system-block stability across calls, PDF text positioned at end of user message, mode-specific differences. Good — this guards against silent cache-rate regressions.
  - `client.test.ts` (6 tests) — covers AC27 wrong-file-type branches (CSV / XLSX / DOCX / PNG) and AC28 size guard. Notes the deliberate omission of pdfjs paths (handled by e2e). Reasonable; see §6 for one missing branch.
  - `extract.test.ts` (1 test) — hermetic no-API-key path only. Honestly labelled; says all other paths live in e2e.

### Playwright e2e

- **Result**: 21 / 21 passed, no flakes, chromium project only (CI runs full matrix).
- **PDF-extract specs**: 4 / 4 green — happy path, low-confidence banner, AC27 wrong-file-type, AC26 503 fallback.
- **Other specs**: a11y (5), responsive (9), single-mode (3) — all green.
- **Browser-warning surfaced from React during run**: `Select is changing from uncontrolled to controlled` — appears in single-mode page e2e logs. Pre-existing, not introduced by Phase 3. Flagged as P3 (§5).

## 3. Browser-verified ACs

All verified against the running dev server via the Claude Preview MCP tools (Chromium). Stubs simulate `/api/extract-pdf` responses at the `fetch` layer.

| AC | Flow | Result | Evidence |
|---|---|---|---|
| **AC3** | Form accepts PDF; preview opens before calculation | PASS | Dialog renders within 110ms of upload (stubbed). Editable fields present for all employee + wage-history values. |
| **AC26** | 503 from extraction service → fallback within 10s + CSV button + form state preserved | PASS | Alert visible in **618 ms** (well under the 10s budget). "Upload as CSV instead" button visible. Form fields outside the PDF card untouched. |
| **AC26 (low-conf preview)** | Aggregate confidence 0.55 → preview opens with warning banner | PASS | Banner reads "Low overall confidence (55%)". Per-field "low confidence — please verify" badges visible on Identity, Employment, and Wage history sections. Extraction-notes alert renders when present. Banner uses `role="alert"` (assertive live region). |
| **AC27** | Drop a `.csv` on the PDF input | PASS | Alert "This is a CSV file — please drop it on the 'Upload wage history CSV' card below, not the PDF card." Zero network calls (`window.fetch` interceptor logged none). Reject is client-side, ahead of pdfjs. |
| **AC28 (size)** | Drop a 51 MB file | PASS | Alert "This PDF is 51.0 MB. The calculator accepts PDFs up to 50 MB. Please slice the file or switch to CSV." No network call. |
| **AC28 (pages)** | Drop a >50-page PDF | NOT TESTED IN BROWSER | No fixture available. Unit test covers the size branch but **not** the `too_many_pages` branch in `client.test.ts`. Logic mirrors the size path (same `inspectPDF` function) so risk is low, but a fixture-based e2e test would close the gap. See bug Q-04. |
| **Golden path** | Stubbed 93%-confidence response → Confirm → form populated | PASS | Dialog → click "Confirm and use this data" → fields `#legalName`, `#externalEmployeeId`, `#startDate`, `#currentWeeklyGross` populated with extracted values. |
| **Esc closes dialog** | Press Escape inside the open preview | PASS | Radix focus management closes the dialog as expected. |

Detail observed in the preview state: the info banner shows "93% confidence" badge when not low-confidence, hides the percentage in the info banner when the warning banner is shown (avoids redundancy). Good UX detail.

## 4. A11y findings (axe-core 4.11.4, same version as CI)

### Bare single-mode page (no dialog)

axe reports 2 violations in the browser (`button-name` on Radix Select × 2, `target-size` on Radix Checkbox × 7). The Playwright a11y suite using `@axe-core/playwright` (same axe version) reports **zero** violations on the same page.

This delta is **pre-existing** (these controls predate Phase 3) and not in this phase's scope to investigate or fix. Flagging as **Q-05 / P3** so the developer can confirm whether `@axe-core/playwright` is suppressing rules unintentionally — could be a real CI hole if the Select / Checkbox controls really are inaccessible. Out of scope for Phase 3 sign-off.

### Preview dialog (NEW in Phase 3)

axe reports **2 critical violations** when the preview dialog is open:

1. **`button-name` × 2** — The Radix `Select` triggers for `Employment type` and the per-row `Frequency` (wage history) have no accessible name. They expose `role="combobox"` but no `aria-label`, no `aria-labelledby`, no visible text inside the trigger when value is `null`/empty.
   - File: `website/src/components/lsl/editable-preview-table.tsx` — `FieldEmploymentType` and the inline `Select` inside the wage-history `.map(...)`.
   - WCAG 2.1 A `4.1.2 Name, Role, Value` — screen readers will announce these as "combobox" with no description of what they control.
2. **`label` × 5** — Five `<Input>` elements inside the dialog have no associated `<label>` (no `htmlFor`/`id` linkage). The inputs in question:
   - Legal name (FieldText)
   - Employee ID (FieldText)
   - Start date (FieldDate)
   - End date (FieldDate)
   - Current weekly gross (AUD) (FieldText)
   - File: `website/src/components/lsl/editable-preview-table.tsx` — helpers `FieldText`, `FieldDate` render `<Label>` and `<Input>` but never bind them.
   - WCAG 2.1 A `1.3.1 Info and Relationships` and `4.1.2`.

The wage-history per-row inputs (`period_start`, `period_end`, `gross_pay`) have `aria-label`s, so those pass.

### Keyboard / focus

- File input on the card: keyboard-reachable (`tabIndex=0`, `<label for="pdf-upload">` properly linked). PASS.
- Dialog: Radix focuses the first interactive element on open (observed `INPUT` focused). PASS.
- Escape closes the dialog. PASS.
- Tab order inside the dialog: not exhaustively tested manually, but Radix's `Dialog` provides a focus trap by default; no manual override observed in source.

### Recommendation

Bug **Q-01** (below) covers both dialog violations. Adding a new test to `e2e/a11y.spec.ts` named `single-mode PDF preview dialog passes axe (stubbed)` that mirrors the `bulk-mode preview state passes axe (sample CSV loaded)` pattern would close the CI hole for future regressions.

## 5. Bugs / findings (triaged)

| ID | Severity | Title | Description | File / Surface |
|---|---|---|---|---|
| Q-01 | **P1** | Dialog form inputs and Select triggers have no accessible names | 5 `<Input>`s in the PDF preview dialog have unlinked `<Label>`s (no `htmlFor`/`id`); 2 Radix `Select` triggers (Employment type, Frequency) have no `aria-label`. Critical-impact axe violations under WCAG 2.1 A `1.3.1` + `4.1.2`. Pre-launch fix: bind labels in `FieldText` / `FieldDate` / `FieldEmploymentType` and add `aria-label` to the wage-history frequency Select. | `website/src/components/lsl/editable-preview-table.tsx` |
| Q-02 | **P2** | a11y CI does not cover the PDF preview dialog | The existing `a11y.spec.ts` covers `bulk-mode preview state` (`Load sample CSV` → preview) but not `single-mode PDF preview state`. As a result Q-01 slipped through. Add a parallel test that stubs `/api/extract-pdf` and asserts no axe violations once the dialog is open. | `website/e2e/a11y.spec.ts` |
| Q-03 | **P3** | `client.test.ts` missing the `too_many_pages` branch | The unit suite covers `too_large` (file > 50 MB) and the four wrong-file-type branches but not the `too_many_pages` path. That branch depends on pdfjs which the test deliberately avoids — fine, but the e2e suite also doesn't have a >50-page fixture. Net: AC28's page-limit half is covered only by manual review of the code path, not an automated test. Add either (a) a hermetic test that mocks `pdfjs.getDocument(...).numPages` or (b) commit a small >50-page fixture PDF for an e2e check. | `website/src/lib/lsl/parsers/pdf/__tests__/client.test.ts` |
| Q-04 | **P3** | Phase 3 calibration not yet executed | Task 3.9 deferred to Phase 6 launch gate. **The deferral is valid** (no data-corruption risk — confidence gate is informational; CSV fallback works). It does, however, mean the warning-banner thresholds (0.85 / 0.7) are unverified against real payroll PDFs. Surface in the launch-gate checklist alongside `ANTHROPIC_API_KEY` per `docs/launch/LAUNCH-GUARD.md`. | `docs/engineering/pdf-extraction-calibration.md` |
| Q-05 | **P3** | Pre-existing single-mode a11y delta between browser axe and CI axe | Browser-driven axe-core 4.11.4 reports `button-name` (2 nodes, Radix Select) and `target-size` (7 nodes, Radix Checkbox WCAG 2.2 AA) on `/calculator/single` outside any dialog. The Playwright `a11y.spec.ts` with `@axe-core/playwright` 4.11.3 reports zero. Investigate whether `@axe-core/playwright` is silently suppressing the rules or whether timing differences (hydration vs. axe scan order) are responsible. **Pre-existing, not Phase 3**, but worth understanding before SC5 / A1 are signed off. | `website/e2e/a11y.spec.ts` |
| Q-06 | **P3** | React "controlled-to-uncontrolled Select" warning in dev | E2E console captures `Select is changing from uncontrolled to controlled. Components should not switch from controlled to uncontrolled (or vice versa).` Indicates a `<Select>` mounted with `value={undefined}` then receives a defined value on rerender. Doesn't break functionality but indicates a state-management bug that may surface as a brief visual flicker on first render. Likely lives in `single-page.tsx` (Employment type / Trigger group). Out of Phase 3's surface — flagging because I noticed it during Phase 3 e2e runs. | `website/src/app/(calculator)/calculator/single/page.tsx` (likely) |

No P0 bugs found.

## 6. Test-pyramid commentary (per qa-best-practices)

The Phase 3 test layout is balanced and pragmatic:

- **Unit layer (50+ new tests)**: covers pure logic (schema validation, confidence math, prompt builder cache invariants, client-side file-type/size guards). Good. The deliberate omission of pdfjs parsing from unit is the right call — that needs a browser.
- **E2E layer (4 PDF-specific Playwright tests)**: covers the user-visible flow with the route stubbed. Network mocking is the right move — calling Anthropic in CI would be expensive, slow, and non-deterministic. Good.
- **Missing middle**: there is **no integration test** that exercises `/api/extract-pdf` end-to-end with a real PDF text body and a mocked Anthropic SDK. The handoff acknowledges this and routes that coverage through e2e. Acceptable for now; revisit if extraction logic gets more branches.

**No anti-patterns observed.** No tests for implementation details, no brittle DOM-text assertions, no test-only code in production. The mocks are at the boundary (`/api/extract-pdf` for browser tests; Anthropic SDK key absence for `extract.test.ts`).

## 7. Verdict on task 3.9 deferral

**Valid as a Phase 6 launch gate.** Reasoning:

1. **No data-corruption risk today.** The revised D05 design (confidence gate is informational, never blocks; CSV fallback always available) means a wrongly-tuned threshold cannot ship bad LSL values to a customer — the editable preview forces user review on every extraction.
2. **The calibration genuinely depends on inputs we don't have.** Real, labelled APA-sourced PDFs are gated on PM-led sourcing. Doing it earlier on synthetic fixtures would produce a falsely-precise threshold.
3. **Risk R1 has an explicit mitigation chain** (impl-plan §7 risk table): calibration set + tuning + CSV fallback. Two of three are live; the third is the deferred work.
4. **The deferral writeup** (`docs/engineering/pdf-extraction-calibration.md`) is honest about the (a)/(b) trade-off if APA sourcing slips, and assigns the call to PM. That's the right governance.

What I would NOT accept as a "deferral":
- If the confidence gate blocked extractions silently (data loss risk) — but it doesn't; it just decorates.
- If there were no CSV fallback — but there is, fully wired and verified above.

**Recommendation**: add task 3.9 to `docs/launch/LAUNCH-GUARD.md` alongside the existing `ANTHROPIC_API_KEY` gate so PM can't accidentally cut over without it.

## 8. Files reviewed

- Handoff: `docs/engineering/changes/2026-05-23-phase-3-pdf-extraction/HANDOFF.md`
- Spec ACs: `.specify/features/001-nsw-calculator/spec.md` (AC3, AC26, AC27, AC28, F5, P3, S4, S5)
- Tasks: `.specify/features/001-nsw-calculator/tasks.md` §3.0 – §3.10
- Impl plan risks: `.specify/features/001-nsw-calculator/impl-plan.md` (R1, R7)
- Calibration deferral: `docs/engineering/pdf-extraction-calibration.md`
- Implementation:
  - `website/src/app/api/extract-pdf/route.ts`
  - `website/src/lib/lsl/parsers/pdf/client.ts`
  - `website/src/lib/lsl/parsers/pdf/confidence.ts`
  - `website/src/lib/lsl/parsers/pdf/extract.ts`
  - `website/src/lib/lsl/parsers/pdf/prompts.ts` (header only — covered by tests)
  - `website/src/lib/lsl/parsers/pdf/schema.ts` (header only — covered by tests)
  - `website/src/components/lsl/pdf-upload.tsx`
  - `website/src/components/lsl/editable-preview-table.tsx`
- New unit tests: all 5 files in `website/src/lib/lsl/parsers/pdf/__tests__/`
- E2E: `website/e2e/pdf-extract.spec.ts`, `website/e2e/a11y.spec.ts`, `website/playwright.config.ts`

## 9. Outstanding before customer traffic (launch-gate punch list)

For PM / DevOps:

- [x] Q-01 — fix dialog label associations + Select accessible names. **CLOSED 2026-05-24** (commit `2c9c469`, re-verified §10).
- [x] Q-02 — add `a11y.spec.ts` test for the PDF preview dialog. **CLOSED 2026-05-24** (commit `2c9c469`, re-verified §10).
- [ ] Q-03 — add `too_many_pages` coverage (mocked pdfjs or fixture PDF).
- [ ] Q-04 — execute task 3.9 calibration once APA-sourced PDFs are available; PM signs off threshold.
- [ ] `ANTHROPIC_API_KEY` in Vercel production (already gated by `LAUNCH-GUARD.md`).
- [ ] Real-network re-verify of AC26 timing on a preview deployment (handoff item).

---

## 10. Re-QA — 2026-05-24 — Q-01 + Q-02 fix verification

**Reviewer**: QA agent
**Branch**: `001-nsw-calculator` (verified at start and end; no commits made)
**HEAD reviewed**: `2c9c469 fix(a11y): bind preview dialog labels + add a11y CI coverage — Q-01, Q-02`
**Inputs**: developer addendum in HANDOFF.md (2026-05-24); modified files `website/src/components/lsl/editable-preview-table.tsx`, `website/e2e/a11y.spec.ts`.

### 10.1 Verdict

- **Q-01 — CLOSED.** Independently re-verified in-browser with axe-core 4.11.4 against the open dialog: 7 critical violations → 0. Label bindings and Select accessible names all wired correctly. No regression in dialog behaviour.
- **Q-02 — CLOSED.** New Playwright test exercises the open dialog (not a closed page); Playwright debug trace proves the axe scan runs after `getByRole('dialog')` and the "Confirm extracted data" text are visible.
- **Phase 3 final verdict: PASSES WITH NOTES.** Only the P3 items (Q-03, Q-04, Q-05, Q-06) remain; none block branch merge. Same overall posture as the original report — but with the two pre-launch P1/P2 items now closed.

### 10.2 Branch hygiene

| Check | Start | End |
|---|---|---|
| `git branch --show-current` | `001-nsw-calculator` | `001-nsw-calculator` |
| Working tree | clean apart from untracked `website/.claude/` (incidental, ignored) | unchanged |
| New commits by QA | — | none |
| Files staged by QA | — | none |
| Force-push / `--no-verify` / `git add .` | — | none |

### 10.3 Test results

| Suite | Result |
|---|---|
| `npm run test` (vitest) | 316 / 316 passed (19 files, 1.27s) — matches dev claim |
| `npx playwright test` (full e2e) | 22 / 22 passed (was 21; +1 = new dialog a11y test) — matches dev claim |
| `npx playwright test e2e/a11y.spec.ts -g "PDF preview dialog"` (isolated) | 1 / 1 passed in 595 ms |

No flake, no new browser warnings beyond the pre-existing controlled/uncontrolled Select warning (Q-06 — pre-existing, not in this fix's surface).

### 10.4 Q-01 in-browser axe scan (gold reference)

Method: same as original §4 — preview server, `/calculator/single`, fetch stub on `/api/extract-pdf` returning a 93%-confidence response, drove the file input with a minimal valid PDF, waited for the dialog to mount, then ran `axe.run(dialog, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })` against the dialog DOM only.

| Metric | Before (5be8526) | After (2c9c469) |
|---|---|---|
| axe version | 4.11.4 | 4.11.4 |
| Total violations on open dialog | 7 (2 critical) | **0** |
| `label` violations | 5 (Legal name, Employee ID, Start date, End date, Current weekly gross) | 0 |
| `button-name` violations | 2 (Employment type Select, Frequency Select) | 0 |

**Confirms dev's claim of 7 → 0.** No new violations introduced.

### 10.5 Q-01 binding semantics (DOM spot-check)

Inspected the live DOM in the open dialog:

- 5 `Input` elements have `React.useId()` ids, each linked to a visible `<label htmlFor>`. Texts resolve to: "Legal name", "Employee ID", "Start date", "End date (optional)", "Current weekly gross (AUD)". All 5 ids are **unique** — `useId()` per-instance means future bulk-mode reuse cannot collide.
- 3 wage-history row inputs use `aria-label` (Period start / Period end / Gross pay) — unchanged, still correct.
- `FieldEmploymentType` `SelectTrigger` has `aria-labelledby` resolving to the visible "Employment type" label id. Radix forwards aria attributes to the underlying `<button>`.
- Per-row Frequency `SelectTrigger` has `aria-label="Frequency"` — consistent with the row's sibling inputs.

**Edge case checked**: multiple rows in the wage-history table — currently 1 row in the stub. The pattern uses `aria-label` (not id) on row inputs, so multi-row reuse would not generate id collisions either way. `useId()` is only used on the per-employee field components above the table.

### 10.6 Q-02 — does the new test actually exercise the dialog?

Read the new test (`a11y.spec.ts:54–117`). Verified the assertion order:

1. `page.route('**/api/extract-pdf', ...)` — stubs the route with a 93%-confidence response.
2. `page.goto('/calculator/single')` — navigates.
3. `page.setInputFiles('#pdf-upload', FIXTURE_PDF)` — drives the file input with the real fixture PDF (`e2e/fixtures/sample-payroll.pdf` — confirmed present).
4. `await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 })` — **dialog must be visible** before proceeding.
5. `await expect(page.getByText('Confirm extracted data')).toBeVisible()` — dialog **content rendered**, not just the wrapper.
6. `new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()` — scans the whole page (dialog is in the DOM).
7. `expect(results.violations).toEqual([])` — strict equality, no allowed exceptions.

Could the test false-pass scanning the closed-dialog DOM? **No.** Steps 4 and 5 would fail before axe ever runs. Playwright debug trace (`DEBUG=pw:api`) confirms: `getByRole('dialog')` resolves to a `<div role="dialog" data-state="open" aria-labelledby=...>` — the actual open Radix dialog — and axe runs AFTER both visibility assertions pass.

Minor strengthening note: the test scans the full page rather than just the dialog. That's fine and slightly stronger than dialog-only — if a future page-level a11y regression surfaces, this test would catch it too. The existing `single-mode calculator passes axe` page-level test runs first, so the dialog test does meaningful additional work.

### 10.7 Regression check — golden path

1. Drop fixture PDF on the PDF input → preview dialog opens (stubbed 93% conf).
2. Verify dialog renders all fields with proper labels (§10.5).
3. Click "Confirm and use this data" → dialog closes, form fields populate:
   - `#legalName` = "A11y Test Employee"
   - `#externalEmployeeId` = "E-PDF-A11Y"
   - `#startDate` = "2018-03-15"
   - `#currentWeeklyGross` = "1500.00"

**PASS.** Dialog functional behaviour unchanged.

### 10.8 Keyboard navigation / focus

Re-opened the dialog and walked Tab order. Radix `Dialog` continues to trap focus and place initial focus on the first interactive element (an `<input>` inside the dialog, confirmed).

Tab stops 1–6 in order, with accessible names resolved as a screen reader would:

| # | Element | Accessible name (resolves via) |
|---|---|---|
| 1 | INPUT text | "Legal name" (via `label[for]`) |
| 2 | INPUT text | "Employee ID" (via `label[for]`) |
| 3 | INPUT date | "Start date" (via `label[for]`) |
| 4 | INPUT date | "End date (optional)" (via `label[for]`) |
| 5 | BUTTON combobox | "Employment type" (via `aria-labelledby`) |
| 6 | INPUT text | "Current weekly gross (AUD)" (via `label[for]`) |

Every stop has a meaningful accessible name. Escape still closes the dialog (unchanged from original §4). **PASS.**

### 10.9 New bugs / findings from re-verification

None. The fix is narrow and well-scoped; no collateral damage detected.

### 10.10 Phase 3 final verdict

**PASSES WITH NOTES** — same posture as the original report, but with the two pre-launch P1/P2 items (Q-01, Q-02) now closed. Remaining items are all P3, all listed in §9 above. Branch is in good shape for merge once the launch-gate items in §9 are scheduled.
