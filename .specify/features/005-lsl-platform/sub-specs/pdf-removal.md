# Feature Specification — Platform Companion · PDF Ingestion Removal

**Slug:** `lsl-platform-pdf-removal`
**Parent feature:** `005-lsl-platform` (umbrella platform spec v1.0 APPROVED 2026-05-26)
**Sub-epic:** Companion to E5 — sequenced **first**, ahead of E5.2 / E5.3 / E5.4 ingestion work
**Status:** **APPROVED 2026-05-27** (operator-locked decisions; no clarification loop required)
**Author:** Product Manager (drafted 2026-05-27 from operator brief 2026-05-27)
**Owner:** Tracy Angwin (austpayroll.com.au)
**Depends on:** Nothing in E5. Independent piece of work that unblocks LAUNCH-GUARD.
**Sequence:** Ship **before** E5.2 / E5.3 / E5.4 so the platform ingestion design starts from a CSV-only codebase rather than a CSV+PDF codebase.

---

## 0. Why this spec exists

The umbrella E5 spec already documents PDF ingestion as **out of v1 scope** (§5.4, §11). That is a forward statement: it tells the dev team not to build PDF into the new platform. It does not say anything about the **existing** PDF code that ships in the public calculator today.

The operator's decision 2026-05-27 goes further: **delete the existing PDF code outright.** This sub-spec captures that decision and bounds the deliverable.

Why now? Three reasons:

1. **It closes the LAUNCH-GUARD hard gate.** Today `docs/launch/LAUNCH-GUARD.md` blocks production cutover on `ANTHROPIC_API_KEY` being set in Vercel because `/api/extract-pdf` and `/api/normalize-csv` return 503 without it. Deleting the code that needs the key closes the gate by elimination — no Anthropic billing, no key rotation hygiene, no ZDR question, no privacy-notice line item.
2. **It de-risks E5.4 ingestion.** The platform's CSV ingestion path is being designed to a fresh schema (per-customer mapping, work-location-driven jurisdiction, versioned re-imports, audit log). Leaving the existing PDF→CSV LLM pipeline in the tree invites accidental reuse and design drift.
3. **It is a discrete, low-risk deliverable.** The PDF code is loosely coupled to CSV (verified by Explore agent 2026-05-27). It can be ripped out in one PR without touching the rules engines, the public calc's CSV path, or anything in `feat/E5.1-auth-slice`.

This is **not a feature**. It is a code deletion plus three small fall-outs (dependency removal, env-var removal, privacy-notice line removal). Spec is short on purpose.

---

## 1. Executive summary

Delete every PDF ingestion code path from the codebase. The public calculator continues to accept **CSV uploads only** for bulk mode. The single-employee form continues to accept manual entry (unchanged). The platform (E5) inherits a CSV-only codebase, which matches its v1 scope exactly.

After this sub-spec ships:

- `ANTHROPIC_API_KEY` has zero consumers in the codebase.
- `@anthropic-ai/sdk` is removed from `website/package.json`.
- The LAUNCH-GUARD hard gate closes by elimination.
- The privacy notice loses one paragraph (the one disclosing PDF-extraction LLM usage).
- The bulk calculator's UI loses the "PDF" tab / dropzone; the CSV tab becomes the only entry point.

No engine code changes. No rules-engine test changes. No new acceptance criteria for valuations or reports.

---

## 2. Background — what exists today vs what changes

| Area | Today | After this sub-spec |
|---|---|---|
| `/api/extract-pdf` route | Live. Calls Anthropic Claude via `@anthropic-ai/sdk`, returns parsed payroll data. | Deleted. |
| `/api/normalize-csv` route | Live. Calls Anthropic Claude to auto-normalise CSV column headers. | Deleted. The platform mapping wizard (E5.3) replaces this need. |
| `website/src/lib/lsl/parsers/pdf/*` | 7 files: `client.ts`, `confidence.ts`, `extract.ts`, `prompts.ts`, `schema.ts`, `pdfjs-subpath.d.ts`, `__tests__/extract.test.ts`. | Directory deleted. |
| `website/src/components/lsl/pdf-upload.tsx` | The dropzone UI for PDF uploads in the bulk form. | Deleted. |
| `website/src/server/anthropic.ts` | The Anthropic client wrapper. | Deleted (no remaining consumers — verified at impl-plan time). |
| Bulk calculator UI (`website/src/app/(calculator)/calculator/bulk/_components/bulk-mode-form.tsx`, `identity-form-dialog.tsx`) | Imports `pdf-upload.tsx`; offers PDF as an upload type alongside CSV. | PDF tab / dropzone removed; CSV is the only upload type. |
| Single calculator UI (`website/src/app/(calculator)/calculator/single/_components/single-mode-form.tsx`) | Imports something from the PDF path (verified by `grep`). | PDF import removed; manual entry stays as-is. |
| `@anthropic-ai/sdk` in `website/package.json` | `^0.98.0`. | Removed. |
| `ANTHROPIC_API_KEY` env var | Required in local-dev (`website/.env.local`) and a LAUNCH-GUARD hard gate for Production. | No consumers. Removed from `.env.example` and any docs that name it. LAUNCH-GUARD hard gate closes. |
| Privacy notice (`website/src/app/privacy/page.tsx`) | Discloses LLM-based PDF extraction via Anthropic. | Paragraph removed. PII-scrub test (`website/src/lib/observability/scrub-pii.test.ts`) updated only if it references the deleted module. |
| `docs/launch/LAUNCH-GUARD.md` | Lists `ANTHROPIC_API_KEY` as hard gate. | "PDF removal" listed as the preferred path to closing the gate. Once PDF removal ships, this gate is removed entirely (separate PM update — out of scope for this sub-spec to perform). |
| `docs/research/lsl-pay-components-deep-research.md`, `docs/learnings/*`, other research docs | May contain historical references to PDF extraction. | Untouched. Historical context is preserved verbatim. |
| `docs/engineering/pdf-extraction-calibration.md` | Original 50-PDF calibration plan, kept as historical context per LAUNCH-GUARD. | Untouched. Header note added: "Plan superseded by PDF Removal 2026-05-27." Optional — not load-bearing. |

**Loose-coupling note (verified by Explore agent 2026-05-27).** The PDF code paths import into two calculator form components but do not bleed into the rules engines, citation block, bulk-runner, or CSV pipeline. The deletion is mechanical, not architectural.

---

## 3. Scope boundary

### In scope

- Delete the files listed in §2 ("After this sub-spec").
- Update the bulk calculator UI to remove the PDF upload tab / dropzone — CSV remains the only upload mode.
- Update the single calculator UI to remove its PDF-path import.
- Remove `@anthropic-ai/sdk` from `website/package.json` and run a clean `pnpm install` / `npm install` (whichever the project uses) to refresh `pnpm-lock.yaml` / `package-lock.json`.
- Remove `ANTHROPIC_API_KEY` from `website/.env.example` (if listed). The dev agent will not touch the actual Vercel env var — that is operator-owned per global engineering rules.
- Remove the LLM-extraction disclosure paragraph from the privacy notice (`website/src/app/privacy/page.tsx`).
- Run the full existing test suite (2214 LSL unit tests + Playwright) to confirm zero regressions.
- Update LAUNCH-GUARD.md to indicate the gate has closed by elimination (separate PM step — captured in §6 below).

### Out of scope

- Any change to the rules engines.
- Any change to the public calculator's CSV upload path.
- Any change to `feat/E5.1-auth-slice` (the auth slice continues on its own branch; this sub-spec is independent).
- New platform features (E5.2 / E5.3 / E5.4 / E5.5 / E5.6 are all separate sub-specs).
- Removing the `ANTHROPIC_API_KEY` value from the actual Vercel Production environment. The operator owns Vercel env vars; the dev agent will not touch them.
- Calibration-plan archival (`docs/engineering/pdf-extraction-calibration.md` stays as historical context; optionally annotated as superseded).

---

## 4. Requirements (MUST / SHOULD / MAY)

- **MUST** delete `/api/extract-pdf` and `/api/normalize-csv` route handlers and their directories.
- **MUST** delete `website/src/lib/lsl/parsers/pdf/` (all files and the `__tests__` subdirectory).
- **MUST** delete `website/src/components/lsl/pdf-upload.tsx`.
- **MUST** delete `website/src/server/anthropic.ts` if no other consumer remains after the above deletions (dev agent verifies via `grep` at impl-plan time).
- **MUST** update `website/src/app/(calculator)/calculator/bulk/_components/bulk-mode-form.tsx` and `identity-form-dialog.tsx` to remove the PDF upload affordance — CSV becomes the only bulk upload type.
- **MUST** update `website/src/app/(calculator)/calculator/single/_components/single-mode-form.tsx` to remove its PDF-path import. The single-employee form continues to accept manual entry.
- **MUST** remove `@anthropic-ai/sdk` from `website/package.json` and refresh the lockfile.
- **MUST** remove `ANTHROPIC_API_KEY` from `website/.env.example`.
- **MUST** remove the LLM-extraction disclosure from the privacy notice.
- **MUST** keep the full existing engine test suite at 100% green.
- **MUST** keep the existing public-calc CSV upload path working (Playwright bulk-mode-CSV tests stay green).
- **SHOULD** add a brief paragraph to `docs/launch/LAUNCH-GUARD.md` recording that the hard gate has closed by elimination, with a date stamp.
- **SHOULD** annotate `docs/engineering/pdf-extraction-calibration.md` with a "superseded by PDF Removal 2026-05-27" header note, so a future agent doesn't try to execute the calibration plan against deleted code.
- **MAY** archive `docs/research/lsl-pay-components-deep-research.md` and other research docs that reference PDF extraction by adding a one-line "PDF extraction removed 2026-05-27 — references retained as historical context only." The research itself stays intact.

---

## 5. Acceptance criteria

- **AC-PDF-1** A `grep -r 'extract-pdf\|normalize-csv\|@anthropic-ai/sdk\|ANTHROPIC_API_KEY' website/src website/package.json` returns zero hits except in committed-history-only references (e.g. `.git/`).
- **AC-PDF-2** `pnpm install` (or the project's equivalent) succeeds with `@anthropic-ai/sdk` absent from `package.json` and the lockfile.
- **AC-PDF-3** Visiting `/calculator/bulk` shows a single CSV upload affordance — no PDF tab, no PDF dropzone, no "PDF" label visible to the user.
- **AC-PDF-4** Uploading a valid CSV to the bulk calculator continues to produce a correct results table (Playwright bulk-mode-CSV regression remains green).
- **AC-PDF-5** Uploading a PDF to the bulk calculator is impossible from the UI (no affordance). Any direct `POST /api/extract-pdf` returns 404.
- **AC-PDF-6** The single-employee calculator form renders and submits correctly with no PDF-path import in its component tree.
- **AC-PDF-7** The full LSL engine test suite (`pnpm test` or equivalent) passes at 2214/2214.
- **AC-PDF-8** The privacy notice no longer mentions Anthropic, LLM-based extraction, or PDF auto-normalisation.
- **AC-PDF-9** `LAUNCH-GUARD.md` records the gate closure with a date stamp (PM-owned update; included in this sub-spec's PR or immediately after).
- **AC-PDF-10** No file under `feat/E5.1-auth-slice` is modified by this deletion. The two work-streams are independent.

---

## 6. Risks and dependencies

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| RP-1 | A user who relied on the public calc's PDF upload is suddenly offered CSV-only. | Low | The PDF path was an optional convenience, not a load-bearing feature. CSV upload remains. Bulk calculator messaging can name CSV as the supported format. |
| RP-2 | Hidden consumer of `@anthropic-ai/sdk` outside the PDF code (e.g. an observability hook, a unit test helper). | Low | Dev agent's first task is a clean `grep` pass before deletion. If a hidden consumer surfaces, this spec is amended; no deletion proceeds. |
| RP-3 | Removing the Anthropic dependency churns the lockfile and could re-resolve unrelated transitive dependencies. | Low | Standard `pnpm install` discipline. Any unrelated dependency drift surfaces in CI; rollback is a single commit. |
| RP-4 | Privacy-notice change creates a regulatory delta (the public disclosure goes from "we use LLMs to read your PDFs" to silent). | Low | The change is **less** PII processing, not more. Notice updates to reflect that no LLM processing occurs on customer data. No regulator concern. |
| RP-5 | This sub-spec collides with `feat/E5.1-auth-slice` if PDF code lives in files that auth also touches. | Low | Explore agent confirmed the two surfaces don't overlap (auth touches `organisations`, `org_members`, `auth_audit_log`; PDF touches `lib/lsl/parsers/pdf`, `api/extract-pdf`, `api/normalize-csv`, `components/lsl/pdf-upload.tsx`, calculator form components). Two independent PRs against `main`. |
| RP-6 | `docs/engineering/pdf-extraction-calibration.md` becomes orphaned context. | Low | Header note marks it superseded. Historical value (the 50-PDF plan, the threshold tuning approach) is preserved for any future LLM-extraction revival. |

---

## 7. Open questions

None outstanding. The operator's brief is fully prescriptive: rip it out, remove the dependency, close the gate.

---

## 8. References

- `docs/launch/LAUNCH-GUARD.md` — the gate this sub-spec closes.
- `.specify/features/005-lsl-platform/spec.md` v1.0 §2 (existing-state table) and §5.4 (CSV-only platform ingestion).
- `website/src/app/api/extract-pdf/route.ts` — deletion target.
- `website/src/app/api/normalize-csv/route.ts` — deletion target.
- `website/src/lib/lsl/parsers/pdf/` — deletion target.
- `website/src/components/lsl/pdf-upload.tsx` — deletion target.
- `website/src/server/anthropic.ts` — deletion target (subject to no-other-consumer verification).
- `website/src/app/privacy/page.tsx` — disclosure paragraph removal target.
- `docs/engineering/pdf-extraction-calibration.md` — historical context, retained.

---

*End of pdf-removal sub-spec — approved 2026-05-27.*
