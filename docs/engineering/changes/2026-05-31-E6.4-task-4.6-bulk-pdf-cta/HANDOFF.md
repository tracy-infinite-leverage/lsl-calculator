# E6.4 Task 4.6 — Bulk-summary PDF download CTA (feature-flag path)

**Date**: 2026-05-31
**Branch**: `feat/E6.4-4.6-bulk-pdf-cta`
**Base**: `origin/main` @ `5ddaf46`
**Spec**: `.specify/features/006-ui-design-system/spec.md` §5.3, §8.4
**Task**: `.specify/features/006-ui-design-system/tasks.md` lines 549–567 (Task 4.6)
**Sequencing-guard (G-5)**: Feature-flag path — operator decision recorded inline below.

---

## What landed

1. **New module** `website/src/lib/feature-flags.ts` — central reader for non-sidebar feature flags. First flag: `isBulkPdfDownloadEnabled()`.
2. **New tests** `website/src/lib/feature-flags.test.ts` — 6 cases covering the strict-string `'true'` contract.
3. **New env var** `NEXT_PUBLIC_PDF_DOWNLOAD_ENABLED=false` in `website/.env.example` with explanatory comment.
4. **Bulk-summary CTA wired** in `website/src/app/(calculator)/calculator/bulk/_components/bulk-mode-form.tsx`:
   - `Download` icon added to brand `Icon` import (already exported there).
   - `downloadBulkPdf` handler POSTs `{ results, parsed, summary }` to `/api/export-bulk-pdf`.
   - `pdfDownloading` state mirrors single-employee CTA wiring.
   - `<Button>Download bulk summary PDF</Button>` rendered only when `isBulkPdfDownloadEnabled()` returns `true`. Default: not rendered.

## G-5 sequencing decision (FEATURE-FLAG PATH)

Per operator decision recorded at task kickoff (and in the brief):

> Gate the bulk-summary CTA behind `NEXT_PUBLIC_PDF_DOWNLOAD_ENABLED`. Default it to `false` in `.env.example`. The flag flips to `true` on the future Phase 5a merge PR (E6.6 templates ship the real bulk PDF endpoint). Until that happens: the bulk CTA renders nothing in prod — no dead CTA, no "coming soon" label. The wiring is in place but the gate is closed. Single-employee CTA is unchanged — already wired to `/api/export-pdf`, stays as-is.

This implementation honours that exactly:

- Flag is `false` by default in `.env.example`.
- When `false` → bulk CTA renders nothing (not "disabled", not "coming soon").
- When Phase 5a ships `/api/export-bulk-pdf` and flips the flag, no further client code change is required.
- Single-employee CTA in `single-mode-form.tsx` / `result-panel.tsx` is untouched.

## Why a central `lib/feature-flags.ts` (and why this pattern)

Mirrors the convention already established in `src/components/app-shell/sidebar-routes.ts` (PR #100, Task 3.2): each flag accessed through a static literal `process.env.NEXT_PUBLIC_X === 'true'` so Next.js's build-time inliner can rewrite the read. A dynamic accessor would leave a runtime no-op (env vars don't exist in the browser). Adding a new flag means adding a named getter — that's the right friction.

Why a separate module rather than reusing `sidebar-routes.ts`:
- `sidebar-routes.ts` is sidebar-specific (couples flags to nav entries).
- Future report-pipeline / liability flags need a domain-agnostic home.
- Co-locating with `redirect-url.ts` style helpers in `lib/` keeps the existing convention.

## Acceptance criteria — verification

Per Task 4.6 AC (spec §8.4 + OQ-6):

- [x] **PDF CTA visible on both result screens** — single-employee CTA was already wired (PR pre-dating this task) and untouched. Bulk-summary CTA wired here, visible iff the flag is `true`.
- [x] **No email-capture gate** — neither CTA gates on email.
- [x] **One of the two sequencing-guard paths chosen and recorded inline** — feature-flag path, recorded in this HANDOFF + spec §8.4 alignment.
- [x] **No "visible-but-disabled" or "coming soon" CTA state ships to `main`** — when the flag is `false` (default for prod until Phase 5a merge), the bulk Button does not render at all. Confirmed by code review (the `{isBulkPdfDownloadEnabled() && (...)}` guard).

## Local gates

Run from `website/`:

| Gate | Result |
| --- | --- |
| `npx vitest run src/lib/feature-flags.test.ts` | 6 passed |
| `npx vitest run src/components/lsl/citation-block.test.ts` | 5 passed — byte-for-byte snapshot intact |
| `npx vitest run` (full suite) | **62 files, 2575 passed**, 32 skipped — comfortably above the 2214/2214 LSL gate |
| `npx eslint src/lib/feature-flags.ts src/lib/feature-flags.test.ts` | 0 problems |
| `npx eslint .` (full repo) | 31 problems — identical count on origin/main (verified by stashing changes and re-running). Zero new violations introduced. |
| `npx next build` | Green — `/` + `/calculator/single` + `/calculator/bulk` all prerender. |
| `npx tsc --noEmit` (changed files) | Clean for my edits. Pre-existing errors in `UserMenu.tsx` + `dropdown-menu.tsx` are upstream from PR #100 and exist on `origin/main` independently. |

## Files touched

```
website/.env.example                                                                        (M)
website/src/lib/feature-flags.ts                                                            (N)
website/src/lib/feature-flags.test.ts                                                       (N)
website/src/app/(calculator)/calculator/bulk/_components/bulk-mode-form.tsx                 (M)
docs/engineering/changes/2026-05-31-E6.4-task-4.6-bulk-pdf-cta/HANDOFF.md                   (N)
```

## Files explicitly NOT touched (scope discipline)

- `website/tests/**` — Task 2.11 diff guard.
- `website/src/lib/lsl/**` — engine sacrosanct.
- `website/src/app/app/**` — Phase 3a parallel agent's territory.
- `website/src/components/{ui,brand,shell,lsl/citation-block.test.ts}/**` — consume only.
- `website/src/lib/{format,text-rules,design-tokens,auth/session-claims}.ts` — consume only.
- `website/e2e/`, `website/src/lib/lsl/**` — diff-guard protected / engine.
- E5.1 auth code anywhere — §4 carve-out.

## What happens at Phase 5a flip

In the Phase 5a (E6.6) merge PR:
1. Implement `/api/export-bulk-pdf` route accepting `{ results, parsed, summary }` and returning a PDF blob.
2. Set `NEXT_PUBLIC_PDF_DOWNLOAD_ENABLED=true` in Vercel Production env.
3. Update `.env.example` default to `true` (optional — defaults are mostly cosmetic since Vercel is the source of truth).
4. No client code change required — this PR's wiring already POSTs to the right URL with the right payload.

## Follow-on tasks in this dispatch

This is Task 4.6 of 3 (4.6, 4.7, 4.8). Per the brief's "1-PR-per-task small cadence" and "STOP after each PR is opened + local-clean":

→ Orchestrator dispatches QA on this PR.
→ Next: Task 4.7 (Lighthouse CI on `/`) on a fresh branch from `origin/main`.
→ Then: Task 4.8 (Phase 3b acceptance gate) on a fresh branch from `origin/main`.
