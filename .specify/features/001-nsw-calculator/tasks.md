# Tasks: NSW Long Service Leave Calculator (E1)

**Version**: 0.1
**Status**: Draft — for Tracy (PM) review
**Date**: 2026-05-21
**Owner**: Developer agent
**Spec**: `.specify/features/001-nsw-calculator/spec.md` v0.4.1
**Impl plan**: `.specify/features/001-nsw-calculator/impl-plan.md`
**Branch**: `001-nsw-calculator`

> Phases are sequential by default. Tasks within a phase may parallelise unless an explicit dependency is noted. Estimates: **S** = under one day; **M** = 1–3 days; **L** = a week or more.

---

## Phase 0 — Test-data fixtures (launch gate per D16)

**Goal**: enumerate every gold-standard case before any engine code is written. PM signs off `test-cases.md` before Phase 1 starts.

### 0.1 Author `test-cases.md` — single-mode NSW cases — **L**
- Catalogue every NSW worked example from `docs/features/LSL-training.pdf` pp.13–31. For each: input values (start date, employment type, current weekly gross, wage history rows, service events, trigger), expected category, expected value-of-week / value-of-day / total entitlement (weeks + dollars, to the cent), expected citations (LSA section + rule key + PDF page).
- Include the 8 edge cases from research brief §5 items 1–8 and 10–11 (cross-state employee is item 8; expect blocked status).
- Include the bulk APA examples from PDF pp.139–141 — single-employee form, used as the SC3 test ($9,880.04 exactly).
- Refs: SC2, SC3, AC24, AC25, D16.
- Depends on: nothing.

### 0.2 Author `test-cases.md` — bulk-mode fixtures — **M**
- Two CSV fixtures, ≥ 10 employees each: `10-employee-mixed.csv` (mixed categories, one cross-jurisdiction-blocked, one with unpaid parental leave) and `50-employee-payroll-export.csv` (NSW only, weekly, simulates a real payroll export).
- Per-row expected output enumerated in `test-cases.md`.
- Refs: SC2, AC16, AC19, D16, D17.
- Depends on: 0.1 (vocabulary alignment).

### 0.3 PM sign-off on `test-cases.md` — **S** (PM time, not dev)
- Tracy reviews; once signed off, the file is frozen as the launch gate. Any later additions require an explicit PM update.
- Refs: D16 resolution gate.
- Depends on: 0.1, 0.2.

---

## Phase 1 — Rules engine (pure TypeScript, no UI)

**Goal**: gold-standard suite passing 100%. No UI yet. End-state: `vitest` green on every case in `test-cases.md`.

### 1.0 Initialise dependencies — **S**
- Add: `decimal.js`, `zod`, `date-fns`, `vitest`, `@vitest/coverage-v8`, `fast-check`, `@anthropic-ai/sdk` (used in Phase 3 but installed now to keep package.json moves grouped), `pdfkit` (Phase 4 export), `@tanstack/react-table`, `@tanstack/react-virtual`.
- Add `vitest.config.ts` with the right path aliases.
- Refs: D01.
- Depends on: 0.3.

### 1.1 Engine types and decimal wrapper — **S**
- Implement `lib/lsl/engine/types.ts`: `Employee`, `WagePeriod`, `ContinuousServiceEvent`, `Trigger`, `Result`, `Citation`, `Warning`, branded `ISODate`.
- Implement `lib/lsl/engine/decimal.ts`: thin wrapper over `decimal.js` with `add/sub/mul/div/cmp/displayAUD()` (half-up at 0.005, 2 dp).
- Property tests for the rounder (`fast-check`) per D01.
- Refs: F12, AC25, D01.
- Depends on: 1.0.

### 1.2 Citation accumulator — **S**
- Implement `lib/lsl/engine/citation.ts`: append-only list with dedup-on-render semantics. Each rule emits `{ value, citations }`; engine concatenates per-output.
- Refs: F13, AC11, D10.
- Depends on: 1.1.

### 1.3 Pay-cycle normaliser — **M**
- Implement `lib/lsl/engine/normalise.ts`: weekly / fortnightly / monthly / other → weekly average. Days-not-counted removed from denominator. Mixed-frequency detection via gap analysis (D09) emits `Warning`.
- Unit tests: AC4 (weekly = fortnightly = monthly all yield $5,200), mixed-frequency detection, days-not-counted subtraction.
- Refs: F3a, AC4, D09.
- Depends on: 1.1.

### 1.4 Lookback math — **M**
- Implement `lib/lsl/engine/lookback.ts`: `weeklyAverageOverWindow(wages, end, windowDays, daysNotCounted)`. Handle leap years (windowDays parameter as 365/366/1825/1826/1827).
- Unit tests against fixtures derived from research brief §1.2 (denominator with JobKeeper days excluded).
- Refs: F8, F3a, research brief §1.2.
- Depends on: 1.1, 1.3.

### 1.5 Continuous-service computation — **M**
- Implement `lib/lsl/engine/continuous-service.ts` (engine plumbing) and `states/nsw/rules/continuous-service.ts` (NSW classification: which events count, which don't).
- Voluntary resignation resets service (F9). Transfer-of-business preserves (F9). Workers Comp counts as service but excludes from denominator (AC10). Unpaid parental leave excludes from both (AC9).
- Unit tests for AC9, AC10, every event type in F4.
- Refs: F9, AC9, AC10, F4, D02 (event types).
- Depends on: 1.1.

### 1.6 Pay-pattern classifier — **M**
- Implement `lib/lsl/engine/classifier.ts`: decision tree per D06. Returns `{ category, ambiguous, signals }`. CV > 0.10 → Category B; > 0.05 ≤ 0.10 → borderline (ambiguous flag set).
- Test against fixtures: full-time stable → A; casual variable hours → B (unambiguous); 5–10% CV part-time → A with `ambiguous: true`.
- Refs: F7, D06.
- Depends on: 1.1, 1.3.

### 1.7 NSW value-of-week rules (A / B / C) — **L**
- Implement `states/nsw/rules/value-of-week-{a,b,c}.ts`. Each rule: takes prescribed date + employee + window data, returns `{ value, citations }` per the "greater of" comparison.
- Category B fall-through to C math when hourly-rate + hours not separately supplied (F8). Citation language per spec gap #1 in impl-plan §11.
- Unit tests bound to `test-cases.md` fixtures.
- Refs: F8, AC5, AC6, NSW LSA s.4(5).
- Depends on: 1.1, 1.4.

### 1.8 NSW accrual table + pro-rata — **M**
- Implement `states/nsw/rules/accrual-table.ts`: `years × (8.6667 / 10)`; 10y → 8.6667 weeks; +4.3333 per additional 5 years; s.4(2)(iii) pro-rata thresholds per termination reason. As-at mode: pro-rata accrual regardless of tenure (D20).
- Unit tests: AC7 (7y voluntary = $0), AC8 (7y redundancy = pro-rata), 12y casual-to-FT (SC3).
- Refs: F11, AC7, AC8, SC3, D20.
- Depends on: 1.1, 1.5.

### 1.9 Trigger handlers + prescribed-date resolver — **M**
- Implement `lib/lsl/engine/trigger.ts` (resolver: prescribed date from trigger kind per D07) and `states/nsw/rules/trigger-handlers.ts` (taking_leave: s.4(7) timing note; termination: s.4(5)(a) "forthwith" citation; as_at: snapshot semantics + D20 note).
- Unit tests for each trigger.
- Refs: F14, D07, D20.
- Depends on: 1.7, 1.8.

### 1.10 NSW RuleSet assembly + engine `calculate()` — **M**
- Wire all NSW rules together in `states/nsw/index.ts`. Implement `lib/lsl/engine/index.ts` `calculate(employee, trigger, ruleset)` that orchestrates: classifier → continuous service → accrual → value-of-week → trigger handler → assemble `Result` with all citations.
- Cross-jurisdiction block check (F10): non-NSW governing jurisdiction returns `Result { status: 'blocked_cross_jurisdiction' }` without throwing.
- Refs: F10, F12, AC23.
- Depends on: 1.6, 1.7, 1.8, 1.9.

### 1.11 Engine error handling + bulk-mode isolation contract — **S**
- Implement `lib/lsl/engine/errors.ts`: `EngineError` subtypes. Engine throws typed errors that bulk-mode catches per-row (D15).
- Unit tests: each error type produces the right `Result { status: 'failed', error }` when caught by a wrapper function.
- Refs: D15.
- Depends on: 1.10.

### 1.12 Gold-standard test suite — **L**
- Implement `states/nsw/__tests__/gold-standard.test.ts` that loads each fixture from `__tests__/fixtures/{single,bulk}/` and asserts: exact category, exact displayed values (string equality), citation list membership.
- Materialise every fixture from `test-cases.md` into JSON / CSV files.
- All cases must pass. Run on every PR. (Phase 6 wires this into CI as the deploy gate.)
- Refs: SC2, SC3, AC24, AC25, D16.
- Depends on: 1.10, 1.11.

### 1.13 System-formula comparison computation — **S**
- Implement `lib/lsl/engine/system-formula.ts`: `current_weekly_gross × entitlement_weeks` + variance vs. legislated. Returns `{ value, variance }` for `Result.outputs.systemFormula`.
- Unit tests against PDF pp.139–141 examples.
- Refs: F21, AC12.
- Depends on: 1.10.

### 1.14 Property tests for AC4 + rounding — **S**
- `fast-check` tests: equivalent gross at weekly / fortnightly / monthly yields identical weekly_gross within 1 cent; displayed value differs from engine value by < 0.005.
- Refs: AC4, AC25, D01.
- Depends on: 1.3, 1.1.

**Phase 1 exit criteria**: every test in `test-cases.md` passes via the gold-standard suite. 100% coverage of the engine code by unit and gold-standard tests.

---

## Phase 2 — Single-mode UI

**Goal**: `/calculator/single` end-to-end with CSV upload, form, result panel, citations, comparison toggle, single-employee PDF export. PDF *input* lands in Phase 3.

### 2.1 Next.js shell + shadcn init — **S**
- Verify Next.js 16 + Tailwind v4 scaffold; initialise shadcn (New York style) with the brand palette from `context/brand/palette.md`; set up next/font (Inter Tight + JetBrains Mono).
- Configure path aliases (`@/lib`, `@/components`, `@/server`).
- Refs: project tech stack (`CLAUDE.md`).
- Depends on: 1.0.

### 2.2 Calculator layout + landing page — **S**
- Implement `app/page.tsx` (landing: two CTAs) and `app/(calculator)/layout.tsx` (shared shell, no auth).
- Refs: AC1.
- Depends on: 2.1.

### 2.3 Single-mode form scaffold — **M**
- Implement `app/(calculator)/calculator/single/page.tsx` and form components: identity, employment, current pay, wage-history upload tab (CSV active in Phase 2; PDF wired in Phase 3), jurisdiction multi-select, trigger group, continuous-service list.
- React state (no form library required for single mode). Validate on submit per F18.
- Refs: F1, F2, AC2.
- Depends on: 2.1.

### 2.4 `ContinuousServiceList` component — **S**
- Repeating row UI per D02. Rows grouped by event_type. `end_date` optional for `transfer_of_business` + `apprentice_to_tradesperson_transition`; required otherwise.
- Refs: F4, D02, AC9, AC10.
- Depends on: 2.3.

### 2.5 Single-mode CSV upload + parser — **M**
- Implement `lib/lsl/parsers/csv/single.ts` (Zod-validated) and the `WageHistoryUpload` component's CSV tab.
- File picker constraint: `accept=".csv,text/csv"` (D03).
- AC4 test passes end-to-end through the parser.
- Refs: F3, AC4, D03.
- Depends on: 2.3, 1.3.

### 2.6 Frequency inference UI — **S**
- After CSV parse, infer pay frequency from period gaps; present inferred value for user confirmation per F3.
- Refs: F3.
- Depends on: 2.5.

### 2.7 Classifier-confirm modal — **S**
- `ClassifierConfirmModal` shown when engine returns `ambiguous: true` (D06). Selection sticks per D08.
- Refs: F7, D06, D08.
- Depends on: 2.3, 1.6.

### 2.8 Jurisdiction-block banner — **S**
- `JurisdictionBlockBanner` shown when `Result.status === 'blocked_cross_jurisdiction'`. Inline "nominate jurisdiction" affordance.
- Refs: F10, AC23.
- Depends on: 2.3, 1.10.

### 2.9 `ResultPanel` + `CitationBlock` — **M**
- Three numeric outputs each with `CitationBlock`. Citations stacked per D10; screen-reader source order matches visual (A3).
- Refs: F12, F13, AC5, AC11, D10.
- Depends on: 2.3, 1.10.

### 2.10 System-formula toggle — **S**
- `SystemFormulaToggle` in the result panel: legislated value vs. system formula + dollar variance + plain-English copy.
- Refs: F21, AC12.
- Depends on: 2.9, 1.13.

### 2.11 Browser-local state persistence — **S**
- Persist last single-mode calculation to `localStorage` per D13. Auto-clear after 7 days. "Clear this calculation" button.
- Refs: F20, S1, D13.
- Depends on: 2.9.

### 2.12 Single-employee PDF export — **M**
- API route `app/api/export-pdf/route.ts` using `pdfkit` server-side; renders the result panel content + citations + variance.
- "Download PDF report" button on result panel.
- Refs: F19, AC13.
- Depends on: 2.9.

### 2.13 Mobile responsive pass — **S** (carries into Phase 5 audit)
- Tailwind responsive classes; usable down to 360px (F22).
- Refs: F22, PM-A.
- Depends on: 2.9.

### 2.14 Single-mode Playwright happy-path test — **S**
- E2E: navigate to /calculator/single → fill form → upload CSV → see result + citations → toggle system-formula comparison → download PDF.
- Refs: SC1.
- Depends on: 2.12.

**Phase 2 exit criteria**: AC1–AC14 met (AC3's PDF input deferred to Phase 3); Playwright happy path green.

---

## Phase 3 — PDF extraction

**Goal**: PDF input mode in single-mode; foundation for Phase 4 bulk-mode PDF.

### 3.0 Anthropic API key + no-retention contract confirmation — **S** (DevOps action)
- Confirm enterprise no-retention contract is in place; `ANTHROPIC_API_KEY` provisioned in Vercel env; document key rotation policy.
- Refs: OQ-B, S4, Risk R5.
- Depends on: nothing (DevOps escalation).

### 3.1 Anthropic SDK singleton + server wrapper — **S**
- Implement `src/server/anthropic.ts` (SDK singleton, model pinned to `claude-sonnet-4-7-YYYYMMDD`).
- Refs: S4, S5, impl-plan §4.1.
- Depends on: 3.0, 1.0.

### 3.2 PDF extraction prompt templates with cache control — **M**
- Implement `lib/lsl/parsers/pdf/prompts.ts`: system + user messages for single and bulk extraction. Mark system prompt + schema spec with `cache_control: { type: 'ephemeral' }` per project's `claude-api` skill / impl-plan §4.2.
- Includes worked input → output example to anchor the format.
- Refs: impl-plan §4.2, claude-api skill.
- Depends on: 3.1.

### 3.3 Extraction JSON schema (Zod) — **S**
- Implement `lib/lsl/parsers/pdf/schema.ts` per impl-plan §2.3.
- Refs: D19, impl-plan §2.3.
- Depends on: 3.1.

### 3.4 `/api/extract-pdf` route — **M**
- Node-runtime route. Accept multipart upload; validate size + pages; call Anthropic; validate response with Zod; on shape failure, one corrective retry (D19); on second failure, return error to client.
- Per-attempt timeouts per D04 (single 30s; bulk 5min). Retry policy per impl-plan §4.6.
- Refs: F5, AC26, AC27, AC28, D04, D05, D19.
- Depends on: 3.2, 3.3.

### 3.5 Client-side PDF page count + size check — **S**
- Use `pdf.js` to pre-count pages and pre-validate size client-side before upload (D03).
- File-picker `accept="application/pdf"`.
- Refs: AC27, AC28, D03.
- Depends on: 2.5.

### 3.6 Confidence-threshold gate — **S**
- `lib/lsl/parsers/pdf/confidence.ts`: aggregate confidence ≥ 0.85 → render preview; below → refuse + route to CSV (D05).
- Per-field < 0.7 → yellow highlight in preview.
- Refs: F5, D05.
- Depends on: 3.4.

### 3.7 `EditablePreviewTable` (single-mode) — **M**
- Post-extraction preview UI: one section per employee (in single-mode this is one section); every field editable; low-confidence badges inline; "confirm and calculate" button.
- Refs: F5, AC3.
- Depends on: 3.6.

### 3.8 LLM service unavailability fallback — **S**
- On timeout / network / 5xx / second-failure: surface error within 10s (AC26) + route to CSV preserving form state.
- Refs: F5, AC26, D04.
- Depends on: 3.4, 2.5.

### 3.9 Calibration set collection + threshold tuning — **L** (cross-functional)
- Source 50 labelled real-world payroll PDFs from APA member contributions (PM facilitates). Run extraction; measure aggregate confidence + field-accuracy; tune the threshold (D05). Document results in `docs/engineering/`.
- Refs: D05, Risk R1.
- Depends on: 3.4, 3.6.

### 3.10 PDF extraction integration test (Playwright) — **S**
- Happy path: upload PDF → preview → edit one field → calculate. Failure path: mocked Anthropic 503 → error within 10s → CSV fallback.
- Refs: AC3, AC26.
- Depends on: 3.7, 3.8.

**Phase 3 exit criteria**: AC3 fully met for single mode; AC26, AC27, AC28 verified; D05 calibration written up.

---

## Phase 4 — Bulk-mode UI

**Goal**: `/calculator/bulk` end-to-end. CSV + PDF upload, editable preview grouped by employee, results table with per-row citations + filter/sort, CSV + multi-page PDF exports.

### 4.1 Bulk-mode page scaffold — **S**
- `app/(calculator)/calculator/bulk/page.tsx`. Upload card (CSV or PDF tabs).
- Refs: F1, AC15, D22 ("switching navigates and warns").
- Depends on: 2.2.

### 4.2 Bulk CSV schema + parser — **M**
- Implement `lib/lsl/parsers/csv/bulk.ts` per impl-plan §2.2 / D17. Group rows by `employee_id`; produce `Employee[]`; surface validation errors per-row (not throw).
- Document the schema inline on the upload page (D17).
- Refs: F3, F6, D17.
- Depends on: 1.10.

### 4.3 Bulk-mode `EditablePreviewTable` (multi-employee) — **M**
- Grouped by employee; expand/collapse per group; inline-edit per cell; warning badges per row.
- Per-row trigger override editable (AC18 / D17). Defaults to `as_at` with date = upload date.
- Refs: F5, F6, AC17, AC18, D17.
- Depends on: 4.2, 3.7.

### 4.4 Bulk-mode PDF extraction integration — **M**
- Reuse `/api/extract-pdf` with `mode=bulk`. Multi-employee grouping prompt (D19). Preview renders per-employee groups.
- Refs: F5, F6, D19.
- Depends on: 4.3, 3.4.

### 4.5 Bulk engine orchestration + chunked execution — **M**
- `lib/lsl/bulk-runner.ts`: iterate `Employee[]`; chunk into `Promise.all` batches of 25; per-row try/catch isolating failures (D15). Track progress for UI.
- Refs: F6a, P2, D15.
- Depends on: 1.11.

### 4.6 `BulkResultsTable` component — **L**
- TanStack Table on shadcn `Table`. Virtualisation via TanStack Virtual for 500+ rows (P2). Columns per impl-plan §5.4. Expand chevron per row reveals citation block (D18). Status badges (computed / blocked / failed).
- Filter + sort per AC20.
- Keyboard navigation per A4 / D18.
- Refs: F6b, AC16, AC20, AC22, D18, A4.
- Depends on: 4.5, 2.9.

### 4.7 Per-row jurisdiction-unblock UX — **S**
- Inline "nominate jurisdiction" affordance opens modal; resolving re-runs only that row (D18).
- Refs: AC19, AC23, D18, F6c.
- Depends on: 4.6.

### 4.8 Bulk CSV export — **S**
- `lib/lsl/parsers/exports/csv.ts`: serialise all rows (computed + failed + blocked) to a single CSV.
- Refs: F6b, AC21.
- Depends on: 4.5.

### 4.9 Bulk multi-page PDF export — **M**
- `lib/lsl/parsers/exports/pdf.ts`: `pdfkit` streaming PDF, one page per employee + summary header (D21). Run via `/api/export-pdf` for memory/time safety on 500-employee uploads.
- Refs: F6b, AC21, D21, P2.
- Depends on: 4.5, 2.12.

### 4.10 Bulk-mode browser-local state — **S**
- Persist results to `localStorage` per D13; fall back to in-memory only when > 4 MB.
- Refs: F20, D13.
- Depends on: 4.6.

### 4.11 Bulk-mode Playwright tests — **M**
- E2E paths: 10-employee CSV happy path; 50-employee CSV (test virtualisation); cross-jurisdiction row blocked while others compute; PDF upload + preview + correction; CSV + PDF export.
- Refs: SC7, AC16–AC22.
- Depends on: 4.9.

**Phase 4 exit criteria**: AC15–AC22 met; SC7 perf budget hit on 100-employee CSV (< 90s end-to-end).

---

## Phase 5 — Hardening

**Goal**: production-ready. Accessibility, errors, telemetry, browser matrix, performance.

### 5.1 WCAG 2.2 AA audit (automated) — **S**
- `axe-core` via `@axe-core/playwright` runs on single-mode result panel + bulk-mode results table. Zero violations.
- Refs: A1, AC14, AC22, SC5.
- Depends on: 4.6.

### 5.2 WCAG manual keyboard-only walkthrough — **S**
- Manual run-through; document in `docs/qa/wcag-walkthrough.md`. Fix any keyboard-trap or focus-management issues.
- Refs: A2, A4, SC5.
- Depends on: 5.1.

### 5.3 Mobile responsive pass (full audit) — **S**
- Test all routes at 360px, 768px, 1024px+. Tweak layout. Result panel + bulk table need horizontal scroll on narrow viewports.
- Refs: F22, PM-A.
- Depends on: 4.6.

### 5.4 Telemetry instrumentation — **M**
- Implement `src/server/telemetry.ts` wrapper. Wire Plausible for page views + custom events; Sentry for errors with PII scrubber in `server/errors.ts`. No employee data ever logged (S3, S5).
- Document in `docs/engineering/`.
- Refs: D14, S3, S5.
- Depends on: 4.6.

### 5.5 Error boundaries + scrubbed exception logging — **S**
- Next.js `error.tsx` boundaries on calculator routes. Top-level uncaught throws caught + scrubbed before Sentry send (D15).
- Refs: D15.
- Depends on: 5.4.

### 5.6 Browser matrix verification — **S**
- Playwright runs on Chromium / WebKit / Firefox. Manual smoke on Edge (Chromium-based). Older browsers: feature-detect ES2022 and surface "browser unsupported" banner per F17.
- Refs: F17.
- Depends on: 4.11.

### 5.7 Performance benchmarks — **M**
- Single-mode: confirm P1 (< 2s 95p). Bulk-mode: 500-employee fixture confirms P2 (< 60s). PDF extraction: single ≤ 20 pages confirms P3 single (< 30s).
- If P2 misses: consider Web Worker offload for the engine. If P3 misses: investigate prompt-cache hit rate.
- Refs: P1, P2, P3, P4, Risk R2.
- Depends on: 4.5.

### 5.8 Spec-gap resolution — **S**
- Walk through `impl-plan.md` §11 with PM; resolve any items requiring sign-off (Category B fall-through citation copy, as-at banner copy, bulk trigger override UX, classifier ambiguity bands, privacy notice copy, telemetry vendor).
- Refs: impl-plan §11.
- Depends on: 4.6.

**Phase 5 exit criteria**: A1, A2, F17, F22, P1–P4 verified; all `impl-plan.md` §11 spec gaps resolved.

---

## Phase 6 — Pre-launch

**Goal**: live in production with deep-link from APA portal.

### 6.1 Data-handling policy doc finalisation — **M**
- Lift `impl-plan.md` §8 into a standalone `docs/engineering/data-handling-policy.md`. Re-verify Anthropic no-retention contract with their account team (impl-plan §8.6 checklist).
- Refs: S4, OQ-B, impl-plan §8.
- Depends on: 3.0, 5.4.

### 6.2 User-facing privacy notice — **S**
- Draft copy linked from `/calculator/single` and `/calculator/bulk`. PM signs off.
- Refs: APP 1 (impl-plan §8.5).
- Depends on: 6.1.

### 6.3 PM sign-off on policy + privacy notice — **S** (PM time)
- Tracy reviews both; both signed off before production traffic.
- Refs: S4 resolution gate, impl-plan §8.6.
- Depends on: 6.1, 6.2.

### 6.4 APA portal deep-link integration — **S** (cross-functional)
- Coordinate with APA technical lead on the link contract (URL + any optional token per spec F15). Implement any required token-handling on the calculator side (likely no-op in v1: anonymous landing).
- Refs: F15, F16, AC1, AC15, SC6.
- Depends on: 5.6.

### 6.5 CI deploy gate on gold-standard suite — **S**
- GitHub Actions (or Vercel-attached) workflow: PR checks run `vitest`; failure blocks merge to `main`. Document in `docs/engineering/`.
- Refs: AC24, D16.
- Depends on: 1.12, 4.11.

### 6.6 Vercel preview deploy + smoke tests — **S**
- Push branch → Vercel preview URL. Manual smoke run on both routes + an extraction; manual sanity on deep-link from a staging APA link.
- Set per-route function memory to 1024MB and timeout to 5 minutes for `/api/extract-pdf` and `/api/export-pdf` per D-OQ7.
- Refs: D-OQ7.
- Depends on: 6.5.

### 6.7 Production cutover — **S**
- Merge to `main` (Tracy pushes per engineering rules — no direct push from dev agent). Vercel auto-deploys. Confirm telemetry receives first events.
- Refs: deployment rules (`~/.claude/rules/global-engineering.md`).
- Depends on: 6.6, 6.3, 6.4.

**Phase 6 exit criteria**: production URL live; deep-link works from APA portal; gold-standard suite green in CI; policy + privacy notice live and PM-signed.

---

## Task summary

| Phase | Tasks | Notes |
|---|---|---|
| 0 — Test-data fixtures | 3 | Launch gate; PM sign-off blocks Phase 1 |
| 1 — Rules engine | 15 | Pure TS; gold-standard 100% on exit |
| 2 — Single-mode UI | 14 | CSV-only input; PDF input deferred to Phase 3 |
| 3 — PDF extraction | 10 | Anthropic SDK + prompt cache; calibration set required |
| 4 — Bulk-mode UI | 11 | Reuses Phase 3 extraction |
| 5 — Hardening | 8 | WCAG, telemetry, errors, perf, spec-gap resolution |
| 6 — Pre-launch | 7 | Policy, privacy notice, deep-link, CI gate, deploy |
| **Total** | **68** | |

## Dependencies between phases

- **Phase 0 → 1**: `test-cases.md` PM-signed-off (D16 launch gate).
- **Phase 1 → 2**: engine green before any UI is bound to it.
- **Phase 2 → 3**: extraction integrates with the existing form (CSV fallback path).
- **Phase 3 → 4**: bulk reuses extraction route.
- **Phase 4 → 5**: hardening covers both routes.
- **Phase 5 → 6**: all spec gaps resolved before policy + cutover.

## Cross-cutting references

- All git/deploy discipline rules: `~/.claude/rules/global-engineering.md`. No `--no-verify`, no `git add .`, no direct push to `main`, no `vercel deploy`, no `.env` commits. Every commit explicit-files staged; commits only when Tracy requests.
- spec-kit artifacts stay under `.specify/features/001-nsw-calculator/`. The two files this plan owns are `impl-plan.md` and `tasks.md`; `test-cases.md` is co-owned by dev (author) and PM (signer).
