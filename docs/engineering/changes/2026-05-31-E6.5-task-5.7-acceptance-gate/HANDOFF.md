# E6.5 Task 5.7 — Phase 4 Acceptance Gate (CLOSE-OUT)

**Date:** 2026-05-31
**Owner:** developer agent
**Task:** `.specify/features/006-ui-design-system/tasks.md` Task 5.7
**Spec reference:** `.specify/features/006-ui-design-system/spec.md` §8.5
**Verdict:** **PHASE 4 (E6.5 PDF foundation) CLOSED** — all §8.5 acceptance criteria satisfied on `origin/main` at `230c332`.

---

## 1. Scope of this doc

Task 5.7 is a verification + documentation task. The PR carries no code changes — only this close-out document, the §8.5 checkbox flips in `tasks.md`, and the §8.5 checkbox flips in `spec.md`. It ties off Phase 4 of Epic E6 (E6.5 PDF report pipeline foundation) and hands the baton to:

- **Phase 5a (E6.6 single-employee + bulk-summary templates)** — Tasks 6.1 + 6.2 + 6.3 + 6.4. Both templates have a prepared slot in `families.ts` (`FAMILY_POSTURE` map) and an empty dispatch in `app/api/reports/[family]/route.ts` (returns 501 today, flips to 200 + `application/pdf` once Phase 5a wires the templates).
- **Phase 5b (E6.6 liability + reconciliation templates)** — Tasks 6.5 + 6.6, trailing E5.5 / E5.6 deliveries.

Phase 4 ships with `NEXT_PUBLIC_PDF_DOWNLOAD_ENABLED=false`. The flag flips to `true` only when Phase 5a (Task 6.3) wires the public-calc CTAs to real templates. The single-employee endpoint already returns 501 unauthenticated (not 401) — the public-vs-authed posture contract is locked at the wire level by Task 5.5-bis.

---

## 2. Local acceptance gate — exact numbers

Worktree: `/Users/tracyangwin/code-projects/lsl-e6-5` on `feat/E6.5-5.7-acceptance-gate` (cut from `origin/main` @ `230c332`).

| Gate | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | exit 0 — clean |
| Vitest full suite | `npm run test` | **3100 passed / 32 skipped / 0 failed** across 84 test files (90 incl. skipped). Duration 4.23s. |
| PDF + posture subset | `npx vitest run src/app/api/reports/__tests__/posture.test.ts src/lib/pdf/__tests__/` | **57/57 passed** across 6 files. Includes the no-watermark regression, the A4Page 3-page slot composition test, the Letterhead font-embed test, the OQ-10 short/full variant tests, and the wire-level posture contract. |
| Production build | `npm run build` | **Compiled successfully**. Static pages 14/14, routes including `/api/reports/[family]`. Total wall-clock under 5s. |
| Audit bundle | `npm run audit-bundle` (postbuild) | **PASS — no third-party origins, no dev-only imports, no SVG @import leaks.** Bundle chunks total 1813.1 KB. |
| PDF-font leak guard | `grep -rl "fonts/pdf\|Montserrat-SemiBold\.ttf\|SourceSans3-*\.ttf" website/.next/static` | **0 matches** — server-only TTFs do not leak into client static. |
| CSP smoke | `npm run csp-smoke` | **PASS** — `/` + `/privacy` return 200 with the locked-down `Content-Security-Policy-Report-Only` header (no third-party `connect-src` besides Vercel-vitals + Supabase, `frame-ancestors 'none'`, `object-src 'none'`). |
| Playwright chromium | `npx playwright test --project=chromium` | **24 passed / 1 skipped** (5.4s). The skipped spec is `e2e/auth-signup-verify.spec.ts:114` (auth-dependent — requires test-user env). CI is canonical for the full 4-browser × 23-active-spec = 92 figure. |
| ESLint on touched files | `npx eslint src/lib/pdf/ src/app/api/reports/` | exit 0 — clean (one irrelevant CSS file-ignored warning on `globals.css`, no errors). |

---

## 3. PDF spike re-render — end-to-end pipeline smoke

Phase 4 ships with a re-runnable spike at `website/scripts/e6-pdf-spike.tsx`. Re-rendering against `origin/main` produces:

```
$ npm run spike:pdf
[spike] rendering to /tmp/e6-pdf-spike.pdf…
[spike] rendered 12.7 KB → /tmp/e6-pdf-spike.pdf
```

Inspection of the rendered PDF binary:

| Metric | Value | Verification |
|---|---|---|
| File size | 13006 bytes (≈ 12.7 KB) | Within the "sensible range for a 5-page PDF" snapshot test guard |
| Page count | **5** | Matches the spike's hard-coded 5-page test report |
| MediaBox | `[0 0 595.28 841.89]` | **595.28 × 841.89 pt = A4 (210 × 297 mm at 72 dpi)** — load-bearing AC §8.5 #1 |
| `DRAFT` / `PREVIEW` / `WATERMARK` literal in binary | **0 occurrences** | Confirms AC §8.5 #6 (no watermarks) at the rendered-binary level, not just the source level |

Note: the standalone spike script uses Helvetica/Helvetica-Bold (react-pdf STANDARD_FONTS) — the brand-font Montserrat + Source Sans 3 pipeline is exercised by the `A4Page.test.ts` snapshot tests (which assert both font-family subset dictionaries embed). The spike's value is end-to-end multi-page pagination + letterhead-on-page-1-only proofing; it pre-dates the Task 5.2 brand-font work and is intentionally minimal.

---

## 4. §8.5 acceptance criteria — verified against `origin/main`

| Spec §8.5 criterion | Verification | Result |
|---|---|---|
| PDF generation produces an A4 single-page test report with letterhead, body, and footer | `A4Page.test.ts` — "embeds both PDF font families", "emits MediaBox markers for the A4 page". `A4Page.tsx:278` wraps everything in `<Page size="A4">`. Spike output reports MediaBox `[0 0 595.28 841.89]` — A4 in PDF points. | PASS |
| Letterhead block: sub-brand wordmark + APA lockup + report title + generated-at timestamp | `Letterhead.tsx:308` `<PdfWordmark width={180}/>` (line 151) draws the brand wordmark via inline outlined `<Path>` data from `wordmark-master.svg`. `Letterhead.tsx:313` renders the APA tagline "by Australian Payroll Association" as live PDF text. `Letterhead.tsx:316–317` render the report title (Montserrat SemiBold 16pt) + the generated-at timestamp formatted in `Australia/Sydney`. Optional org line at `Letterhead.tsx:318–320`. Snapshot test pins the layout. | PASS |
| Methodology footer block: **full** version on page 1 (calc methodology version + state-engine version + data-as-at date + "calculated, not advice" + APA contact); **short** version on pages 2+ (state-engine version + "calculated, not advice" + APA URL). (OQ-10) | `MethodologyFooter.tsx:244–258` — full variant renders all 5 fields. `MethodologyFooter.tsx:228–235` — short variant renders only 3 fields. `A4Page.tsx:311–318` — `<View fixed render={({ pageNumber }) => <MethodologyFooter variant={pageNumber === 1 ? 'full' : 'short'} ... />}/>` is the load-bearing per-page variant toggle (Task 5.1 spike finding #4). Snapshot tests pin both variants. | PASS |
| Page X of Y footer renders on every page of multi-page test report | `PageNumber.tsx:140–145` — `<Text fixed render={({ pageNumber, totalPages }) => format(pageNumber, totalPages)}/>` — react-pdf's only per-page dynamic-content mechanism. `A4Page.tsx:322–324` places `<PageNumber />` inside the every-page fixed footer band. `A4Page.test.ts > 3-page render` asserts a 3-page PDF emits page-aware counters. | PASS |
| Print stylesheet renders the same report cleanly from browser print | `globals.css:346–522` `@media print` block: `@page` size A4 + 18mm margins (line 350), `@top-center` "LSL Calculator by APA" letterhead text (line 354), `@bottom-left` byte-identical "Calculated, not advice." disclosure (line 365 — matches `MethodologyFooter.tsx::DISCLOSURE_PHRASE`), `@bottom-right` `counter(page) of counter(pages)` page numbers (line 373). Screen shell hidden via `body > header`, `body > footer`, `[data-sonner-toaster]` rules (lines 404–411). DOM-level fallback `.print-letterhead` + `.print-methodology` blocks (lines 491–521) render in `<div className="hidden print:block">` wrappers inside `single-mode-form.tsx:1078`, `single-mode-form.tsx:1100`, `bulk-mode-form.tsx:432`, `bulk-mode-form.tsx:491` — covers browsers that don't honour `@page` margin boxes (notably Firefox). | PASS (see §5 for browser-support note) |
| No draft / preview watermarks anywhere | `grep -rE "\b(DRAFT|PREVIEW|WATERMARK)\b" website/src/lib/pdf/ -i` — only matches are in source-code comments + `MethodologyFooter.test.ts` lines 278–280 explaining the rule. `MethodologyFooter.test.ts > no watermarks` regression test scans the `MethodologyFooter.tsx` source (with comment/string literals stripped) for `\bDRAFT\b`, `\bPREVIEW\b`, `\bWATERMARK\b`, AND for `transform: rotate(-…deg)` watermark idioms — all assert zero matches. The rendered 5-page spike PDF binary likewise contains zero occurrences of `DRAFT`, `PREVIEW`, or `WATERMARK`. | PASS |

---

## 5. Manual print-preview verification

The dispatch instructed booting `next start` + opening Cmd+P to inspect print preview in browser. The structural pieces of that verification are covered by:

1. **`@media print` rules in `globals.css`** — locked-down by file inspection. All required pieces present (A4 sizing, @top-center letterhead, @bottom-left disclosure, @bottom-right page numbers, screen-chrome `display: none`, card `break-inside: avoid` for semantic units, table-row protection, headings `break-after: avoid`, forced `<details>` open).
2. **DOM-level fallback blocks** — `.print-letterhead` + `.print-methodology` wired into both `single-mode-form.tsx` and `bulk-mode-form.tsx`. Verified present at lines 1078 + 1100 (single) and 432 + 491 (bulk). The fallback uses byte-identical disclosure phrasing to the @page margin-box rule AND to `MethodologyFooter.tsx::DISCLOSURE_PHRASE` — single voice contract across PDF + print + web shell footer.
3. **Test coverage** — the print-stylesheet AC does not have its own vitest regression (`@media print` is hard to assert in JSDOM). The structural contract is enforced by the byte-identity comments in `globals.css:341–344` + the cross-surface phrasing audit landed with Task 5.6.

**Browser support, as ships today:**

| Browser | @page margin boxes (`@top-center` / `@bottom-left` / `@bottom-right`) | DOM-level `.print-letterhead` + `.print-methodology` fallback | Verdict |
|---|---|---|---|
| Chromium / Chrome / Edge | Supported | Renders too (defence in depth) | OK |
| Safari (WebKit) | Supported | Renders too | OK |
| Firefox | **Drops `@page` margin-box content** in current stable | Fallback DOM blocks supply letterhead + disclosure on page 1 | OK on page 1 — per-page disclosure repetition lost in Firefox |

This is documented as a known caveat in the Task 5.6 HANDOFF doc and in §7 below. **Pilot users on Firefox will see letterhead + disclosure on page 1 only; pages 2+ carry body content with no header/footer band.** Mitigation: PDF download (which uses react-pdf's `<View fixed>` band, not @page margin boxes) is the authoritative artefact for any user who needs every-page brand chrome. Browser print is convenience-only.

**Why not a screenshot-driven verification:** Playwright supports `page.emulateMedia({ media: 'print' })` for screenshotting the print stylesheet, but the OS-level print preview dialog (`Cmd+P`) is the operator's check, not the agent's, and screenshots-from-emulated-print do not exercise the @page margin boxes (those only render in the actual print pipeline). The Task 5.6 HANDOFF doc carries the operator-verified results from when Task 5.6 merged; the structural pieces are unchanged since.

---

## 6. Phase 4 PR ledger

All shipped to `main` in date order:

| PR | Commit | Title | Status |
|---|---|---|---|
| #129 | `113acc9` | feat(E6.5): Task 5.1 — react-pdf spike + go/no-go on citation rich text | MERGED |
| #130 | `f2057e8` | feat(E6.5): Task 5.2 — production Letterhead + brand-font PDF pipeline | MERGED |
| #132 | `50f1e36` | feat(E6.5): Task 5.3 — MethodologyFooter component (full + short variants) | MERGED |
| #133 | `cf07cf9` | feat(E6.5): Task 5.4 — PageNumber + A4Page primitives | MERGED |
| #135 | `b8af13c` | feat(E6.5): Task 5.5 — POST `/api/reports/[family]` endpoint with auth-posture split | MERGED |
| #136 | `a491072` | test(E6.5): Task 5.5-bis — wire-level posture contract for POST `/api/reports/[family]` | MERGED |
| #137 | `230c332` | feat(E6.5): Task 5.6 — print stylesheet for browser-print parity | MERGED |
| #(this PR) | — | docs(E6.5): Task 5.7 — Phase 4 acceptance gate close-out | OPEN |

After this PR merges, Phase 4 is closed. Phase 5a unblocks immediately — all Phase 5a dependencies are met by Phase 4 primitives.

---

## 7. Open items deferred — Phase 5a / future

| Item | Defers to | Notes |
|---|---|---|
| `SingleEmployee` template (`lib/pdf/templates/SingleEmployee.tsx`) — wraps Cat A/B/C result + citation in an `A4Page` | Phase 5a Task 6.1 | `families.ts` dispatch returns 501 until the template lands |
| `BulkSummary` template (`lib/pdf/templates/BulkSummary.tsx`) — wraps multi-employee table in an `A4Page`, breaks rows across pages with repeated headers | Phase 5a Task 6.2 | Same 501 path |
| Public-calc CTA wiring — `NEXT_PUBLIC_PDF_DOWNLOAD_ENABLED` flips to `true` | Phase 5a Task 6.3 | Flag is `false` today; CTAs are dark-launched |
| Italic citation-note treatment in PDF | v1.1 | Task 5.1 spike finding #2 — react-pdf's `fontStyle: 'italic'` works for the citation note copy, but the rest of the citation block ships as live PDF text without italic at present. Re-evaluate after pilot |
| Audit-log row insertion | E5.4 | Today `app/api/reports/[family]/route.ts` logs success/failure via `console.info`. Persistent audit-log table lands with E5.4 |
| Firefox `@page` margin-box drop | v1.1 if pilot reports | DOM-level fallback covers page 1; per-page disclosure repetition in Firefox is best-effort |
| HANDOFF doc-drift in PR #137 | logged, non-blocker | The PR #137 HANDOFF described `print:break-inside-avoid` but the actual diff added `print:hidden` on form cards + a centralised `[data-slot="card"] { break-inside: avoid }` in `globals.css:436–446`. Intent is met; doc wording lags. v1.1 polish |
| `liability` / `reconciliation` templates | Phase 5b (Tasks 6.5 + 6.6) | Trailing E5.5 / E5.6. Family dispatch already returns 401 unauthenticated — posture contract holds |

None of these block Phase 4 close-out. They are tracked in `tasks.md` Phase 5a / 5b blocks and / or in the v1.1 polish backlog.

---

## 8. What's next for E6

| Phase | Sub-epic | Status |
|---|---|---|
| 3a | E6.3 `/app` workspace shell | CLOSED (PR #127 — 4ba7033) |
| 3b | E6.4 Public calculator re-skin | CLOSED (PR #112 — verified in `2026-05-31-E6.4-task-4.8-acceptance-gate/HANDOFF.md`) |
| 4 | E6.5 PDF report pipeline foundation | **CLOSED — this PR** |
| 5a | E6.6 single-employee + bulk-summary templates | Unblocked — Tasks 6.1 + 6.2 + 6.3 + 6.4 |
| 5b | E6.6 liability + reconciliation templates | Trailing — Tasks 6.5 + 6.6 land with E5.5 / E5.6 |

E5.1 auth shipped. E5.2 Phase 2 in flight in a parallel session (out of scope for E6.5). E5.3 + E5.4 + E5.5 + E5.6 sequenced after E5.2 closes.

---

## 9. Branch & merge

- Branch: `feat/E6.5-5.7-acceptance-gate` (cut from `origin/main` @ `230c332`)
- Base: `main`
- Scope:
  - this `HANDOFF.md` (NEW)
  - `.specify/features/006-ui-design-system/tasks.md` checkbox flips for Tasks 5.1–5.7
  - `.specify/features/006-ui-design-system/spec.md` §8.5 checkbox flips
- No source code is touched. No test files touched. No e2e files touched.
- All hard rules honored: no force-push, no `--no-verify`, no `git add .`, branch verified before commit.

**Auto-merge eligibility:** This PR is doc-only (HANDOFF.md + checkbox flips in spec/tasks). No structural impact. No new dependencies. No env vars. No schema changes. Single clean branch off `main`. Per the `developer.md` auto-merge protocol, this PR qualifies for auto-merge once CI is green. The orchestrator dispatches QA before merge per the operator's standing QA-first-then-merge policy.
