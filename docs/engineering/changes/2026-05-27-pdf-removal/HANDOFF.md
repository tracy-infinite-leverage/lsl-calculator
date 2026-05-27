# HANDOFF — PDF Removal (E5.0)

**Date:** 2026-05-27
**From:** Developer (this session)
**To:** QA
**Branch:** `feat/E5.0-pdf-removal`
**PR:** https://github.com/tracy-infinite-leverage/lsl-calculator/pull/50
**Spec:** `.specify/features/005-lsl-platform/sub-specs/pdf-removal.md`
**Commits in PR:**
- `4f67acd` docs(E5): scope E5.2/E5.3/E5.4 sub-specs + PDF removal slice
- `c161872` feat(E5.0-pdf-removal): delete PDF ingestion + close LAUNCH-GUARD gate

---

## What shipped

The PDF Removal sub-spec is fully implemented. Every PDF ingestion path is deleted; the public calculator is now CSV-only (canonical schema). The `ANTHROPIC_API_KEY` LAUNCH-GUARD hard gate closes by elimination.

41 files changed, +99 / -4700 lines.

## What QA must verify (priority order)

### P0 — load-bearing regression

1. **Bulk calculator end-to-end on canonical CSV**
   - Visit `/calculator/bulk`. Click "Load sample CSV (3 employees)".
   - Expect: preview shows 3 employees (E001 Alice Nguyen / E002 Bob Smith / E003 Carol Lee), no errors.
   - Click "Calculate 3 employees" → results table appears with valid LSL outputs.
   - This is the AC-PDF-4 happy path and matches the existing Playwright bulk-CSV regression.

2. **Single calculator manual entry path**
   - Visit `/calculator/single`. Confirm the page opens directly to "Employee details" — there is NO PDF upload card at the top (previously the first card).
   - Fill in: legal name, start date 2014-03-01, employment type full_time, current weekly gross 1500, governing jurisdiction NSW, single wage row 2025-05-22 → 2026-05-21 / 78000 / weekly, trigger as_at.
   - Calculate → result panel + citation block render.
   - Click "Download PDF" → result PDF downloads. (This is the **export** path — distinct from PDF *extraction* — and it stays.)

3. **Hard 404 on deleted routes**
   - `curl https://<preview-url>/api/extract-pdf -X POST` → 404
   - `curl https://<preview-url>/api/normalize-csv -X POST` → 404

### P1 — copy + content sweeps

4. **Privacy notice**
   - Visit `/privacy`. Confirm: no mention of Anthropic, Claude, LLM, or PDF anywhere on the page. Updated date shows "27 May 2026".

5. **Bulk page copy**
   - On `/calculator/bulk`, confirm Card 1 reads: "Upload a CSV in the canonical schema shown below. Dates are YYYY-MM-DD; the frequency column is required per wage row."
   - Schema tab includes a `frequency` row (Yes-required column documenting weekly | fortnightly | monthly | other).
   - No "Pay frequency for this file" dropdown above the tabs (removed).
   - No "PDF" tab anywhere.

6. **Non-canonical CSV handling**
   - Paste a CSV with bad headers (e.g. `employee,start,gross` instead of `employee_id,start_date,gross_pay`). Click Parse.
   - Expect: clear error in a destructive alert. Specifically the error should come from `parseBulkCSV` — not "Reading your CSV with Claude…" (which was removed).

### P2 — confirm what stays

7. **Result-download PDF still works**
   - On `/calculator/single` after a successful calculation, click Download PDF. Expect a real A4 PDF file with the calculation result, citations, and methodology.
   - This is `/api/export-pdf` using `@react-pdf/renderer` — intentionally NOT removed.

8. **WCAG 2.2 AA**
   - Run `npx playwright test e2e/a11y.spec.ts` locally if possible.
   - Or visually confirm the `/calculator/bulk` preview state still passes axe-core (the test still exists; it just no longer needs the `/api/normalize-csv` mock).

## What I deleted (full list)

**Code paths** — `/api/extract-pdf`, `/api/normalize-csv`, `lib/lsl/parsers/pdf/*` (7 files), `lib/lsl/parsers/csv/normalize-*.ts` (4 files), `components/lsl/pdf-upload.tsx`, `components/lsl/editable-preview-table.tsx`, `server/anthropic.ts`, `bulk/_components/identity-form-dialog.tsx`, `e2e/pdf-extract.spec.ts`, `e2e/bulk-identity-dialog.spec.ts`, `e2e/fixtures/sample-payroll.pdf`, `scripts/copy-pdfjs-worker.cjs`.

**Dependencies** — `@anthropic-ai/sdk`, `pdf-lib`, `pdfjs-dist`, `postinstall` hook. Lockfile refreshed (-13 packages).

**Env + CI** — `ANTHROPIC_API_KEY` from `.env.example` x2 and 4 occurrences in `.github/workflows/ci.yml`.

**Docs** — LAUNCH-GUARD closure, launch/README, launch/pm-signoff, launch/vercel-production-setup, engineering/vercel-config, engineering/pdf-extraction-calibration banner.

## Scope decision worth flagging to QA

The PM spec lists `/api/normalize-csv` route deletion but doesn't enumerate the `lib/lsl/parsers/csv/normalize-*.ts` library files. AC-PDF-1 requires `grep` returns zero hits across `website/src` for `normalize-csv`. To satisfy AC-PDF-1 cleanly and avoid leaving orphan library code that no caller invokes, I also deleted those 4 library files and reworked `bulk-mode-form.tsx` to feed canonical CSV directly to `parseBulkCSV`. The platform E5.3 mapping wizard is the planned replacement; the public calc is now canonical-only. This is the **only** non-mechanical decision in the slice.

## Verification I already ran (developer side)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean |
| `npm test` (vitest) | 43/43 files, 2304/2304 tests green |
| `npm run build` (next build) | Clean. Routes: `/api/export-pdf` only remains. |
| AC-PDF-1 grep | Zero hits |
| AC-PDF-3 / AC-PDF-6 (browser) | Verified — preview screenshots taken |
| AC-PDF-5 (404 on deleted routes) | Verified via `fetch()` |
| AC-PDF-8 (privacy copy) | Verified — body text scan returns 0 hits for anthropic / llm / pdf / claude |
| ESLint baseline | 19 errors → 17 errors (removed 2, added 0) |

Baseline tests pre-deletion: 49 files / 2369 tests. Post-deletion: 43/43 / 2304/2304. Delta: exactly the 6 deleted test files (extract.test, prompts.test, schema.test, confidence.test, client.test for PDF + normalize-apply.test for csv) = 65 tests. No regressions in surviving suites.

## What QA cannot test from the dev side

- **Vercel preview deploy.** Once CI passes, the operator should verify a preview URL builds without `ANTHROPIC_API_KEY` set in Vercel. (Per LAUNCH-GUARD, that variable is no longer required.)
- **Production cutover.** Operator follow-up after merge: delete `ANTHROPIC_API_KEY` from Vercel Production / Preview / Development scopes via dashboard. Documented in PR description and LAUNCH-GUARD.md.

## Out of scope (intentional)

- `@react-pdf/renderer` + `/api/export-pdf` — different feature (result download), stays.
- Any change to E5.1 auth slice (`feat/E5.1-auth-slice`). Verified: zero file overlap.
- Any change to the rules engines or per-state test fixtures. Verified: 2214 LSL tests still pass identically.
- Vercel env var deletion — operator-owned per global engineering rules.

## Branch hygiene note

The local working tree has uncommitted E6 spec work (a parallel PM session added `.specify/features/006-ui-design-system/` and edited `docs/product/epics.md` + `epic-status.md` with E6 entries). I stashed those changes before committing PDF removal so they're NOT in this PR, then restored them to the working tree post-commit. Operator / PM should review and commit the E6 work in a separate slice.

## Open follow-ups (none blocking)

- `docs/engineering/changes/2026-05-23-phase-3-pdf-extraction/` (HANDOFF.md + QA-REPORT.md) — historical PDF Phase 3 docs reference deleted code. Left untouched per spec §6 RP-6: "Historical context is preserved verbatim." No action needed.
- Old `e2e/fixtures/` directory still has subfolders for non-PDF fixtures (NSW/VIC/etc). Only `sample-payroll.pdf` was removed.

— Developer
