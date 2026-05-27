# QA-REPORT — PDF Removal (E5.0)

**Date:** 2026-05-27
**QA agent:** qa
**PR:** https://github.com/tracy-infinite-leverage/lsl-calculator/pull/50
**Branch:** `feat/E5.0-pdf-removal`
**Spec:** `.specify/features/005-lsl-platform/sub-specs/pdf-removal.md`
**Handoff:** `docs/engineering/changes/2026-05-27-pdf-removal/HANDOFF.md`
**CI status:** All checks green (TS/Vitest/Build + 8 state suites + Playwright matrix + Vercel)

---

## Verdict

**PASS-WITH-NOTES — 2 P2 copy-regression bugs.**

The PDF ingestion slice is functionally and architecturally complete. All ten acceptance criteria pass against code, tests, and the rendered surface. The full 2304/2304 vitest suite is green, the full 24/24 Playwright suite (including a11y, single-mode end-to-end, responsive, and the kept `/api/export-pdf` PDF generation test) is green, TypeScript compiles clean, and the scope-decision to delete the orphan `normalize-csv` library layer is justified and clean.

Two stale-copy regressions slipped through — both promise/imply PDF ingestion to the user. They are independent of the deletion itself (the dev's grep targeted `extract-pdf|normalize-csv|@anthropic-ai/sdk|ANTHROPIC_API_KEY` per the spec, which does not catch user-facing word "PDF"). Severity is P2 (cosmetic / SEO) — not a merge blocker, but they should be fixed before any external marketing push points users at the site.

---

## Per-AC results

| AC | Description | Status | Evidence |
|---|---|---|---|
| **AC-PDF-1** | Zero hits for `extract-pdf|normalize-csv|@anthropic-ai/sdk|ANTHROPIC_API_KEY` in `website/src` + `website/package.json` | PASS | `grep -rn -E 'extract-pdf\|normalize-csv\|@anthropic-ai/sdk\|ANTHROPIC_API_KEY' website/src website/package.json` returns zero hits. The single "CLAUDE.md" reference at `website/src/app/app/login/login-form.tsx:10` is a documentation pointer in a comment, not an Anthropic SDK call. |
| **AC-PDF-2** | `npm install` succeeds with `@anthropic-ai/sdk` absent | PASS | `cat website/package.json | grep -iE 'anthropic\|pdf-lib\|pdfjs'` returns zero rows. `@react-pdf/renderer` (the kept export path) is present at `^4.5.1`. Lockfile refreshed in commit `c161872` (-13 packages). |
| **AC-PDF-3** | `/calculator/bulk` shows a single CSV upload affordance — no PDF tab/dropzone/label visible | **PASS-WITH-NOTE** | UI components are clean — no PDF tab, no dropzone, no PDF entry card. Card 1 reads correctly: "Upload a CSV in the canonical schema shown below. Dates are `YYYY-MM-DD`; the `frequency` column is required per wage row." **However** the page's `<meta name="description">` still reads `"Upload a CSV (or PDF)..."` — see Bug #1. The literal string "PDF" appears 2x in the rendered HTML head as a result. |
| **AC-PDF-4** | Bulk CSV upload happy path produces correct results table | PASS | Playwright `bulk-mode preview state passes axe (sample CSV loaded)` test: green, 897ms. Loads canonical 3-employee sample via direct `parseBulkCSV` (no `/api/normalize-csv` mock needed — hermetic). |
| **AC-PDF-5** | `POST /api/extract-pdf` → 404; `POST /api/normalize-csv` → 404 | PASS | Local dev `curl` results: `extract-pdf POST: 404`, `extract-pdf GET: 404`, `normalize-csv POST: 404`, `normalize-csv GET: 404`. `/api/export-pdf` returns `405` on GET and `500` on empty POST (route exists, validates input). NB: Vercel preview URL is SSO-protected (returns 401 to anonymous curl) — could not verify against preview deploy directly. The build artifact and route table from `next build` confirm the routes are deleted; production preview parity is implied by green CI. |
| **AC-PDF-6** | Single-employee calc renders + submits with no PDF-path imports | PASS | Source: `single-mode-form.tsx` no longer imports `PdfUpload`. Page render: zero "pdf" matches in rendered HTML on initial load. Playwright `TC-NSW-024 produces $9,880.04 end-to-end` test: green, 568ms. The page opens directly on "Employee details" — no PDF entry card. |
| **AC-PDF-7** | Full engine test suite at 100% | PASS | `npm test` (vitest): **43 files, 2304/2304 tests passed**, 3.96s. Matches dev's claim exactly. Delta from baseline (49/2369 → 43/2304) = exactly the 6 deleted test files / 65 tests. No regressions in surviving suites. |
| **AC-PDF-8** | Privacy notice has no mention of Anthropic / LLM / PDF | PASS | Rendered HTML of `/privacy` (31350 bytes): `grep -o -i anthropic` → 0 hits; `grep -o -i claude` → 0 hits; `grep -o -i pdf` → 0 hits; `grep -o -i llm` → 0 hits. Updated date "27 May 2026" appears 2x (in `<header>` and inside the body). Source: `website/src/app/privacy/page.tsx` lines 13 (`UPDATED` constant) + 29 (rendered). |
| **AC-PDF-9** | LAUNCH-GUARD records gate closure with date stamp | PASS | `docs/launch/LAUNCH-GUARD.md:11` reads: *"STATUS 2026-05-27 — GATE CLOSED BY ELIMINATION."* with full enumeration of the deleted code paths. The ZDR section also closed (line 60). |
| **AC-PDF-10** | No file under `feat/E5.1-auth-slice` modified | PASS | `git diff --name-only c161872^ c161872` (the actual PDF-removal commit, not the cumulative branch diff) shows 41 files — zero overlap with auth-slice files (organisations migration, login/signup routes, auth components). Verified independently. |

---

## P0 / P1 / P2 verification per HANDOFF table

| # | Pri | Task | Status | Evidence |
|---|---|---|---|---|
| 1 | P0 | Bulk calculator end-to-end on canonical CSV | PASS | Playwright bulk-mode preview test green. `SAMPLE_CSV` in `bulk-mode-form.tsx:37-40` matches the spec's 3-employee fixture exactly (E001 Alice Nguyen, E002 Bob Smith, E003 Carol Lee). |
| 2 | P0 | Single calculator manual entry path | PASS | Playwright `TC-NSW-024 produces $9,880.04 end-to-end` test green (568ms). Page opens on "Employee details" — no PDF entry card. The `PDF export endpoint returns a valid PDF` Playwright test (482ms) confirms the result-download path. |
| 3 | P0 | Hard 404 on deleted routes | PASS | Local: `/api/extract-pdf` → 404, `/api/normalize-csv` → 404 (both POST + GET). Vercel preview check blocked by SSO (401); inferred from green CI + clean build manifest. **Recommend:** operator does a one-off curl against production after merge to lock this down. |
| 4 | P1 | Privacy notice copy | PASS | See AC-PDF-8 evidence above. |
| 5 | P1 | Bulk page copy | **PASS-WITH-NOTE** | Card 1 wording correct. Schema tab includes `frequency` row. No "Pay frequency for this file" dropdown above tabs. No "PDF" tab anywhere in body. **However** the meta description still mentions PDF — Bug #1. |
| 6 | P1 | Non-canonical CSV handling | PASS | `parseBulkCSV` returns `"CSV header missing required columns: <list>. See on-page schema docs."` at `website/src/lib/lsl/parsers/csv/bulk.ts:178-184`. The legacy "Reading your CSV with Claude…" copy has been fully removed: `grep -rn "Reading your CSV with Claude" website/src` → 0 hits; `grep -o "Reading your CSV with Claude" /tmp/bulk.html` → 0 hits. |
| 7 | P2 | Result-download PDF still works | PASS | Playwright `PDF export endpoint returns a valid PDF` test green (482ms). `@react-pdf/renderer` present in `package.json`. `/api/export-pdf` returns 405 (GET — method not allowed) / 500 (POST empty — validation) → confirms route exists. |
| 8 | P2 | WCAG 2.2 AA | PASS | `npx playwright test e2e/a11y.spec.ts --project=chromium`: 5/5 green. Routes audited: `/`, `/calculator/single`, `/calculator/bulk`, `/privacy`, `/calculator/bulk` (preview-state with sample CSV loaded). Zero axe violations on `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` tags. |

---

## Bugs found

### Bug #1 — Stale meta description on bulk page (P2 / cosmetic / SEO)

**File:** `website/src/app/(calculator)/calculator/bulk/page.tsx:7`

**Current:**
```ts
description: `Upload a CSV (or PDF) and run Long Service Leave calculations across many employees at once. ${ENCODED_STATES.join(', ')} supported.`,
```

**Why it matters:** The `(or PDF)` parenthetical promises a feature that has been explicitly deleted. It appears in `<meta name="description">` (search engine previews, Slack/iMessage unfurls, etc.). Not visible in the calculator UI itself, but is visible to any user/crawler who sees the page metadata.

**Suggested fix:** Delete the `(or PDF)` parenthetical.
```ts
description: `Upload a payroll CSV and run Long Service Leave calculations across many employees at once. ${ENCODED_STATES.join(', ')} supported.`,
```

**Owner:** Developer. Single-line change.

---

### Bug #2 — Homepage promises "PDF extraction coming soon" (P2 / cosmetic / user-visible)

**File:** `website/src/app/page.tsx:37`

**Current:**
```tsx
<CardDescription>
  One employee, one event. Taking leave, termination, or a LSL liability
  snapshot. Enter wage history by CSV (PDF extraction coming soon).
</CardDescription>
```

**Why it matters:** Homepage hero card for the single-employee calculator explicitly tells users PDF extraction is "coming soon" — but PDF extraction has been deleted, is not on the roadmap, and the platform's E5.4 ingestion spec is CSV-only. This is a direct contradiction of the spec the PR ships, visible on the landing page.

**Suggested fix:** Remove the "(PDF extraction coming soon)" parenthetical entirely.
```tsx
<CardDescription>
  One employee, one event. Taking leave, termination, or a LSL liability
  snapshot. Enter wage history by CSV.
</CardDescription>
```

**Owner:** Developer or Writer. Single-line copy fix.

---

## Scope concerns — assessment of the `normalize-csv` library deletion

The dev deleted four library files (`lib/lsl/parsers/csv/normalize-{schema,apply,prompt}.ts` + `normalize-apply.test.ts`) that the PM spec did not explicitly list. The dev rationale: AC-PDF-1 requires `grep` for `normalize-csv` returns zero hits across `website/src`, which forced removing the underlying library, not just the API route.

**Verdict: justified and clean.**

- Independent verification: `grep -rn -E "normalize-apply|normalizeApply|normalizeSchema|normalizePrompt|normalize-schema|normalize-prompt"` across `website/src` returns zero hits — no orphan callers left behind.
- `parseBulkCSV` is the sole CSV entry point: `grep -rn parseBulkCSV` shows exactly two consumers (`bulk-mode-form.tsx` at line 75 + the test file), and `bulk-to-engine.ts` references it in a comment only.
- The bulk-mode-form rework feeds the raw CSV directly to `parseBulkCSV` with a clear `Canonical CSV ingestion` comment at lines 61-72 pointing to the sub-spec.
- The PM spec §3 "In scope" includes "Update the bulk calculator UI to remove the PDF upload tab / dropzone — CSV remains the only upload mode." Removing the `normalize-csv` lib layer is the natural mechanical consequence of removing the route and its UI affordance.
- The forthcoming E5.3 platform mapping wizard is the documented replacement for column-mapping convenience — this matches the spec's stated direction.

The decision was the only non-mechanical call in the slice. It is correctly flagged in the PR description and the HANDOFF. Approve.

---

## Recommended action for operator

**MERGE.** (Already merged at `e4bd7db` per `git log origin/main`.)

The two P2 copy bugs do NOT block the LAUNCH-GUARD gate closure — they're pre-existing stale copy that the PDF-removal grep didn't catch. They are independent fix-forward items:

- **Recommended next step:** spin Bug #1 + Bug #2 into a single trivial follow-up commit (or one of the dev's next-feature commits) — they're each one-line copy fixes.
- **No need to revert.** The PR achieves its stated outcome: LAUNCH-GUARD hard gate is closed by elimination, the platform inherits a CSV-only codebase, and zero regressions in the 2304-test engine suite.
- **Operator-owned follow-up (per PR description):** delete `ANTHROPIC_API_KEY` from Vercel Production / Preview / Development scopes via dashboard. Optional: revoke key at console.anthropic.com.

---

## Notes on uncommitted-tree hygiene

The working tree has uncommitted E6 spec work (the parallel PM session) that is **out of scope for this QA run**:

- Untracked: `.specify/features/006-ui-design-system/`
- Modified: `docs/product/epics.md`, `docs/product/epic-status.md`

These were correctly stashed/restored by the dev and are not in PR #50. I did not commit or modify them. I also did not flip `docs/product/epic-status.md` E5.0 status lines per the QA-documentation skill convention — because those lines may already be entangled with the E6 leftover work in the unstaged diff, and surgical edits there carry a real risk of accidentally staging E6 work alongside the E5.0 status flip. **Operator action:** when committing the E6 spec slice separately, flip the E5.0-PDF-removal status line to "QA verified, PASS-WITH-NOTES" at the same time. The verdict above is the canonical record.

---

*End of QA-REPORT — verified 2026-05-27.*
