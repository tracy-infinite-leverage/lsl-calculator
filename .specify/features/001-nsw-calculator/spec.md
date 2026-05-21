# Spec: NSW Long Service Leave Calculator (E1)

**Version**: 0.4.0
**Status**: Draft — PM-directed scope simplification; bulk-employee mode added
**Date**: 2026-05-21
**Owner**: Tracy (PM)
**Branch**: `001-nsw-calculator`
**Source**:
- `docs/product/epics.md` § E1
- `docs/product/product.md`
- `context/source-material/lsl-legislation/research-brief-2026-05-21.md`
- `docs/features/LSL-training.pdf` (APA LSL Masterclass, January 2026)
- Long Service Leave Act 1955 (NSW)

> Prior spec versions (v0.1.0 → v0.3.0) are preserved in git history. The v0.4.0 reset below replaces them — read this version end-to-end. Earlier Clarification Summaries are no longer load-bearing.

---

## Clarification Summary (v0.4.0)

**Date**: 2026-05-21
**Source**: PM correction of v0.3.0.

**PM-directed scope changes**:

1. **Bulk-employee mode added.** v1 supports two modes:
   - **Single mode** — one employee per session, with a specific event (taking leave / termination)
   - **Bulk mode** — many employees in one upload, calculated together
2. **Gross values only.** The calculator does NOT decompose the user's input into pay components (base / overtime / bonus / allowance / etc.). The user provides gross pay per period; the calculator does the NSW lookback math on those gross values. As a consequence:
   - The `$183,100 high-income threshold` bonus-inclusion test is OUT of v1. (Was F7.)
   - Detection of salary sacrifice, retrospective pay rises, and pre-modern-award employees is OUT of v1. (Was F13.)
   - The "v1-unsupported edge-case flags" added in v0.3.0 are removed from F1.
   - F2 (pay-component breakdown) is removed.
3. **Split-leave** remains OUT of v1 (confirms v0.2.0 default).
4. **"Any payroll report" in CSV or PDF.** Confirms v0.2.0 — vendor-agnostic LLM-based extraction with editable preview. No vendor-specific templates required in v1.

**Resolved / defaulted from v0.3.0 that survive into v0.4.0**:
- NSW only.
- Standalone Next.js app + deep-link from APA portal (hosting working default).
- 100% accuracy bar against the gold-standard test suite as launch gate.
- Pay frequencies: weekly / fortnightly / monthly / other (with user-supplied period length), normalised to weekly average before the rules engine runs.
- Cross-jurisdictional service detection (multi-state input) still required (this is law-of-which-state, not pay-component logic).
- AUD half-up rounding at 0.005, two decimal places at display, unrounded intermediate arithmetic.
- Browser support: latest two stable versions of Chrome / Safari / Edge / Firefox; responsive but desktop-optimised.
- LLM vendor: default = Anthropic Claude API, no-retention enterprise tier. PM signs off vendor + data-handling policy before E1 ships.
- Gold-standard test suite: enumerated in a separate artifact (`.specify/features/001-nsw-calculator/test-cases.md`), PM-signed-off before development.

**Open for PM (only the genuinely-undecided items)**:

- **PM-A** — Mobile scope: v0.4.0 keeps v0.3.0's default of "responsive, best-effort, desktop-optimised". Confirm, or make mobile an explicit non-goal in `product.md` §7.
- **PM-B** — Bulk-mode trigger semantics: v0.4.0 defaults to **"as-at"** snapshot mode (compute current accrued LSL value for each employee at a user-supplied date, default = today). The user MAY override per row to "taking leave" or "termination" if their input includes a per-employee trigger column. Confirm, or change the default to something else (e.g., always require the user to choose).

---

## Executive Summary

Build a long-service-leave calculator that returns the correct value of LSL for a New South Wales employee, with every output traceable back to the section of the NSW *Long Service Leave Act 1955* that produced it. The calculator supports two modes — a single-employee form for a specific LSL event (taking leave or termination), and a bulk-employee upload (CSV or PDF of any payroll report) for snapshot / audit calculations across many employees in one pass. v1 takes gross pay per period as input and does not decompose it into pay components.

This is the first end-to-end slice of the LSL Calculator product (epic E1) and the architectural template for the seven additional state engines in E2. The primary users are Australian payroll managers (single mode, daily LSL events) and APA-engaged auditors (bulk mode, periodic verification). The primary business value is replacing manual calculations that — per APA's own training — produce errors of 3–34% when payroll-system formulas (`hours × rate`) are used in place of the legislated `greater of (current rate, 12-month average, 5-year average)` test.

## Context & Problem Statement

### Current state

A payroll manager calculating LSL for an NSW employee today opens a spreadsheet, the NSW *Long Service Leave Act 1955*, and the employee's payroll history. She:

1. Determines which of three NSW pay-pattern categories the employee falls into (fixed-rate-fixed-hours, fixed-rate-varied-hours, varied-rate);
2. Computes both a 12-month and a 5-year average weekly gross from the payroll history;
3. Compares those against the current weekly gross and selects the "greater of" per the relevant formula in s.4(5);
4. Determines continuous service per s.4(11), accounting for paid leave, Workers Comp, transmission-of-business, and any service-breaking events;
5. Reads off the entitlement table (10 years → 8.6667 weeks; +4.3333 weeks per additional 5 years) or applies pro-rata-on-termination rules per s.4(2)(iii);
6. Writes a number on the payslip.

She does this once a fortnight, sometimes more, and has no automated way to defend the result if challenged. Auditors verifying LSL across a workforce face the same problem scaled by the number of employees.

### Problem

Mainstream payroll systems (Xero, MYOB, KeyPay, ADP) do not auto-calculate LSL because the legislated method does not compress into a single formula. Where vendors expose any LSL value at all, they compute `hours_worked × current_hourly_rate`, which silently disagrees with the legislated `greater of (current rate, 12-month average, 5-year average)` test. APA's own training material quantifies the error: in one worked example, a 10-year NSW casual is **overpaid by $179.99** (3.4% over) when calculated by the system formula; the same employee transitioning to full-time in years 11–12 is **underpaid by $3,316.64** (33.6% under the correct $9,880.04) (LSL-training.pdf pp.139–141).

The result is that LSL is a chronic payroll-data-quality risk for every Australian employer — APA's Health Check (PDF p.137) frames it as a quarterly review item, not a one-off compliance task — and there is no available tool that produces a defensible, citation-backed LSL value for a payroll manager or auditor to use.

### Constraints

- **Legal**: every output must be derivable from a specific section of the NSW LSA 1955. The calculator does not give legal advice; it computes the legislated value.
- **Distribution**: the calculator must be reachable from the Australian Payroll Association member portal. Working default is **standalone + deep-link** (a separate Next.js app at its own URL, linked from the APA portal).
- **Quality gate**: per `docs/product/product.md` §12 — **100% of calculations must match the relevant section of legislation**. A single failing case in the gold-standard test suite blocks deployment.
- **Tech stack** (per `CLAUDE.md`): Next.js + Tailwind + shadcn for the web app; Supabase for any persistent state; Vercel auto-deploy on push to `main`.
- **Currency**: AUD; half-up rounding at 0.005, two decimal places at display, unrounded intermediate arithmetic.
- **Scope**: NSW only in v1; gross-pay-only inputs (no pay-component decomposition); no split-leave; no payroll-system write-back.

### Dependencies

- The NSW LSA 1955 text (publicly available at `legislation.nsw.gov.au`) is the source of truth for rules.
- The APA LSL Masterclass PDF (`docs/features/LSL-training.pdf`) supplies worked examples used as canonical test cases.

## Requirements

### Functional — MUST

#### Inputs and modes

- **F1.** The system MUST support two modes selectable on entry:
  - **Single mode** — one employee, one event (taking leave / termination / as-at), entered via a form.
  - **Bulk mode** — many employees in one upload (CSV or PDF), processed together.

- **F2.** In **single mode**, the system MUST accept the following inputs:
  - **Identity (optional, display-only)**: full legal name, employee ID.
  - **Employment**: start date, end date (required when trigger = termination), employment type (full-time / part-time / casual).
  - **Current pay**: current gross weekly pay (an "ordinary pay" gross figure consistent with NSW LSA s.3(2) — the user is responsible for providing this; the calculator does not decompose components).
  - **Wage history**: gross pay per pay period over the lookback windows, via the modes in F3.
  - **Continuous-service events**: per F4.
  - **Jurisdictional history**: states in which the employee has worked during continuous service — multi-select over `{NSW, VIC, QLD, WA, SA, TAS, ACT, NT}`. Selecting more than one state triggers F10 blocking until the user nominates the governing jurisdiction.
  - **Trigger**: one of `taking_leave` (with leave start date) / `termination` (with termination date and reason) / `as_at` (with as-at date, defaults to today).

- **F3.** Wage history MUST be acceptable via one of two input mechanisms in single mode:
  - **CSV upload**: a structured file with columns covering pay-period start date, pay-period end date, gross pay, optional notes.
  - **PDF upload**: any payroll report PDF (vendor-agnostic), extracted via an LLM-based vision/text pipeline (F5), with a mandatory editable preview step that surfaces extracted values to the user for confirmation before any calculation runs.

  Either mechanism MUST support transaction totals at **weekly, fortnightly, monthly, or other (user-supplied period length in days)**. The user MUST nominate the pay frequency, or the system MUST infer it from input date gaps and present the inferred value for confirmation.

- **F3a.** The system MUST normalise pay-period gross totals to a weekly average before running the rules engine:
  - **Weekly**: weekly_gross = period_total
  - **Fortnightly**: weekly_gross = period_total / 2
  - **Monthly**: weekly_gross = period_total × 12 / 52 (average of 4.333 weeks per period)
  - **Other**: weekly_gross = period_total × 7 / user-supplied period length in days
  - Days falling within continuous-service exclusions (e.g. unpaid leave, JobKeeper days, COVID stand-down per research brief §1.2) MUST be removed from the denominator before averaging.
  - Mixed-frequency wage histories MUST be normalised per segment and surface a "mixed-frequency" warning to the user.

- **F4.** The system MUST accept a list of continuous-service events as a structured list per employee. Each row has `{event_type, start_date, end_date, optional_note}`. The `event_type` enum is:
  - `paid_leave` — paid annual leave, paid LSL taken, paid sick/personal, paid parental leave, Christmas closedown paid leave
  - `workers_comp_absence`
  - `unpaid_parental_leave`
  - `leave_without_pay`
  - `industrial_action`
  - `employer_stand_down` (slackness)
  - `transfer_of_business` — start_date is the transfer effective date; end_date may be omitted
  - `employer_initiated_termination_and_rehire` — start_date is the termination date; end_date is the re-hire date
  - `apprentice_to_tradesperson_transition` — start_date is the trade transition date; end_date may be omitted
  - `jobkeeper_or_covid_standdown` (no-pay period that counts as service for casuals per research brief §1.4)

- **F5.** The PDF extraction pipeline (used in both single and bulk modes) MUST:
  - Run vendor-agnostic LLM-based extraction.
  - Display extracted values in an editable preview before any calculation runs. In bulk mode, the preview is a table grouped by employee.
  - Refuse to display extracted values when extraction confidence falls below an internal threshold. The threshold value is calibrated by the dev team during build; the user-facing "we couldn't extract this" message is PM-signed-off before E1 ships.
  - Tag the calculation's audit metadata with `input source: PDF (extracted, user-confirmed)`.
  - Not transmit extracted employee data to any third-party logging/analytics endpoint (see S1, S3).
  - Reject PDFs above 50 pages or 50 MB with a clear in-page message asking the user to slice the file or switch to CSV. (Bulk mode commonly has larger files than single mode; the limit is set above single-mode P2 to give bulk users room.)
  - Accept only `.pdf` file format. `.doc`, `.docx`, image formats, and `.xls` / `.xlsx` are not accepted in v1 (Excel users export to CSV).
  - On LLM service unavailability (down, rate-limited, network error), display a clear in-page message naming the failure mode and route the user to the CSV path without losing already-entered inputs. One automatic retry; then surface failure.

#### Bulk mode

- **F6.** In **bulk mode**, the system MUST accept a single CSV or PDF upload containing wage history for multiple employees. The upload must include enough information to identify each employee distinctly and to compute LSL for each. Minimum per-employee data required:
  - Employee identifier (name or employee ID)
  - Employment start date
  - Employment type (full-time / part-time / casual)
  - State(s) of service
  - Wage history (period rows: start, end, gross)
  - Optional: trigger and trigger-specific date(s) per employee; defaults to `as_at` with date = upload date if no per-employee trigger column is supplied
  - Optional: continuous-service events per employee; defaults to "none recorded" if absent

  Where any required per-employee field is missing or ambiguous after extraction, the row MUST surface in the editable preview (F5) for user correction before the rules engine runs on that employee. The calculator MUST NOT silently assume defaults for missing required fields.

- **F6a.** The system MUST produce one calculation per employee in the bulk upload, using the same rules engine as single mode (F7–F11). Citation blocks (F12) MUST be produced per employee. The aggregate output is a results table with one row per employee; each row is independently citable and exportable.

- **F6b.** The bulk-mode results table MUST support:
  - Per-row expansion to show the citation block
  - Filter / sort by employee, state, accrued weeks, total value, variance vs. system formula
  - Export of the full table as CSV and as a multi-page PDF report (one page per employee plus a summary header)
  - Per-row warnings surfaced inline (mixed-frequency, cross-jurisdiction-pending-decision)

- **F6c.** If any employee in the bulk upload triggers a cross-jurisdiction block (F10), the calculator MUST process all other employees and surface the blocked rows separately, asking the user to resolve them before they can be exported. The bulk batch MUST NOT fail entirely because some rows need a jurisdiction decision.

#### Rules engine (used by single and bulk)

- **F7.** The system MUST classify each employee into exactly one of three NSW pay-pattern categories per s.4(5):
  - **Category A**: fixed rate, fixed hours (full-time, stable part-time)
  - **Category B**: fixed rate, varied hours (casuals, part-time doing extra ordinary hours)
  - **Category C**: varied rate (piece work, commission, results-based, retainer + commission)

  When the classifier's signal is unambiguous, the system MAY proceed silently. When the inputs do not clearly resolve to a single category, the system MUST ask the user to confirm (single mode: inline modal; bulk mode: row-level prompt in the editable preview). The system MUST NOT default silently on ambiguous inputs.

- **F8.** For each category, the system MUST compute the "value of a week" as the **greater of** the two formulas defined in NSW LSA s.4(5) for that category, operating on the gross values provided:
  - **Category A**: greater of (current_weekly_gross) or (5-year average weekly gross)
  - **Category B**: greater of (current_hourly_rate × average_ordinary_hours_12mo) or (5-year average weekly gross)
  - **Category C**: greater of (12-month average weekly gross) or (5-year average weekly gross)

  The lookback denominator MUST be in days, less "days not counted" (per research brief §1.2). The lookback windows are anchored at the prescribed date (F11). For Category B, when the user has not provided hourly rate + hours separately (e.g., they uploaded gross-only), the system MUST treat the period as a fall-through to Category C math (whichever is greater of 12-month or 5-year averages on gross weekly).

- **F9.** The system MUST compute continuous service per s.4(11). Specifically:
  - Paid annual leave, paid LSL, paid sick/personal leave, Workers Comp absence (per Workers Comp Act 1987 s.49), paid parental leave, and Christmas closedown paid leave MUST count as service.
  - Transmission/transfer of business (s.4(6)) MUST preserve prior service.
  - Unpaid parental leave, leave without pay, industrial action, and gaps > 2 months after employer-initiated termination MUST NOT count as service.
  - Employee voluntary resignation MUST reset prior service to zero.

- **F10.** The system MUST detect cross-jurisdictional service from the multi-state input in F2 / F6. When more than one state is selected, the system MUST **block the calculation for that employee** until the user nominates the governing jurisdiction. For v1, only `governing_jurisdiction = NSW` runs to completion; selecting another state surfaces a "v1 supports NSW only; this employee will be skipped" message.

- **F11.** The system MUST compute the entitlement weeks using the s.4(2) accrual table:
  - Accrual: years_of_continuous_service × (8.6667 / 10)
  - Full entitlement at 10 years = 8.6667 weeks; +4.3333 weeks per additional 5 years
  - **Pro-rata on termination (NSW LSA s.4(2)(iii))**:
    - < 5 years: $0
    - 5 to < 10 years: pro-rata only if termination reason is (a) employer-initiated termination other than serious misconduct (incl. redundancy), (b) illness/incapacity, (c) domestic or pressing necessity, (d) death
    - 10+ years: pro-rata for any reason
  - **As-at (snapshot) mode**: accrued LSL is computed as `accrual_weeks_at_as_at_date × value_of_week_at_as_at_date`. The pro-rata thresholds do NOT apply in as-at mode — the snapshot reports current accrued value regardless of whether the employee would actually be paid out today.

- **F12.** The system MUST return three numeric outputs per employee:
  - **Value of a week** (AUD)
  - **Value of a day** (AUD, = value_of_week / 5 for full-time; / equivalent ordinary days for other categories)
  - **Total entitlement** (weeks and dollars)

  All intermediate computation uses unrounded decimal arithmetic; display rounded to two decimal places (AUD cents) using half-up rounding at 0.005.

- **F13.** The system MUST display a **citation block** alongside every numeric output, per employee. Each citation MUST reference: (a) the NSW LSA section that drove the value, (b) the rule name in the rules engine, (c) the page of the LSL-training PDF where applicable.

- **F14.** The system MUST handle the trigger correctly per s.4(5)–(7):
  - **`taking_leave`**: formula is per F8, entitlement is paid in the pay period when leave falls, public holidays during the leave period extend the leave (s.4(4A)). v1 supports a single LSL period only — split-period support (s.4(3)) is OUT of v1.
  - **`termination`**: formula is per F8, payment is "forthwith" (s.4(5)(a)) — the calculator notes this in the citation block.
  - **`as_at`**: a snapshot calculation. The prescribed date is the as-at date; the lookback windows end at that date.

#### Cross-cutting

- **F15.** The calculator MUST be reachable from the APA member portal via a deep-link. The exact link contract (URL pattern, optional token) is an open decision (see `product.md` §14).
- **F16.** The system MUST NOT depend on any APA-portal API in v1.
- **F17.** The system MUST run on the latest two stable major versions of Chrome, Safari, Edge, and Firefox at the time of release. Older versions MAY display a "browser unsupported" banner but MUST NOT silently produce incorrect results.

### Functional — SHOULD

- **F18.** The system SHOULD provide an input-validation pass before running any calculation: missing or contradictory dates, wage history gaps, employment-type vs. pay-pattern mismatches.
- **F19.** The system SHOULD allow the user to download a single-employee PDF report (single mode) or a multi-employee PDF report (bulk mode) suitable for attaching to a payslip, audit file, or finance workpaper.
- **F20.** The system SHOULD persist the most recent single-mode calculation in browser-local state so the user can refresh without losing inputs. Bulk-mode results MAY be persisted similarly (size-permitting) with an auto-clear after 7 days.
- **F21.** The system SHOULD surface a "what the system formula would have given" comparison value alongside the legislated value — to make the variance visible and reinforce the wedge. System formula = `current_weekly_gross × entitlement_weeks`.
- **F22.** The single-calc form SHOULD be responsive and usable on a mobile-browser viewport down to 360px width. Desktop is the optimal-experience target. (PM-A in Clarification Summary.)

### Functional — MAY

- **F23.** The system MAY pre-fill bonus high-income-threshold logic if a future epic re-introduces pay-component decomposition. (Not in v1.)
- **F24.** The system MAY include a per-rule "why is this in/out?" hover that opens the relevant LSA section text.
- **F25.** The system MAY support saving named calculations to a user account (deferred to a separate epic; requires auth).

### Performance

- **P1.** Once all inputs are confirmed (post-CSV import or post-PDF preview confirmation), a **single-mode** calculation MUST complete in under 2 seconds (95th percentile) on a typical office laptop with a stable internet connection.
- **P2.** **Bulk-mode** calculation MUST complete in under 60 seconds (95th percentile) for up to 500 employees with up to 5 years of weekly wage history each (≈260 rows per employee). Above 500 employees, the system MAY chunk results or refuse with a clear message.
- **P3.** **PDF extraction** MUST complete in under 30 seconds (95th percentile) for files of ≤20 pages in single mode, and under 5 minutes for files of ≤50 pages in bulk mode.
- **P4.** **CSV import** MUST complete in under 5 seconds (95th percentile) for 5 years × 260 rows of weekly data in single mode, and under 30 seconds for 500-employee bulk uploads.

### Security

- **S1.** No personally-identifiable employee data MUST be persisted server-side in v1 (browser-local only). When server persistence is added (out of scope for E1), Australian Privacy Principles compliance MUST be reviewed.
- **S2.** All transport MUST be HTTPS-only.
- **S3.** No third-party analytics that track employee inputs (names, IDs, wages) MUST be loaded on the calculator page.
- **S4.** PDF extraction (F5) via an LLM MUST be subject to a documented data-handling policy: which LLM vendor, where requests are routed, what request/response data is retained or logged, and how the policy complies with Australian Privacy Principles. **Default vendor (per PM-B Clarification Summary): Anthropic Claude API, no-retention enterprise tier.** Policy documented before E1 ships.
- **S5.** The LLM extraction request MUST NOT include any field beyond what is needed to extract pay data. When the user uploads a multi-section PDF, the system MAY pre-strip identifying non-payroll sections before sending the remainder to the LLM.

### Accessibility

- **A1.** The calculator MUST meet WCAG 2.2 Level AA on both the single-mode UI and the bulk-mode results table.
- **A2.** All form inputs MUST be keyboard-navigable and screen-reader-labelled.
- **A3.** Citation blocks MUST be readable by a screen reader in source order alongside the value they cite.
- **A4.** The bulk-mode results table MUST support keyboard navigation between rows, with the citation block accessible via a row-level expand command.

## Success Criteria

- **SC1.** In **single mode**, a payroll manager handling an NSW LSL event can produce a defensible LSL value in **≤30 seconds from confirming the wage history** (CSV imported, or PDF preview accepted) to seeing the result. PDF extraction time (P3) is excluded from this 30s figure and communicated separately to the user with a progress indicator.

- **SC2.** The calculator passes **100% of cases** in the NSW gold-standard test suite. The suite is enumerated in `.specify/features/001-nsw-calculator/test-cases.md` (a separate artifact, signed off by PM before development starts). It covers, at minimum:
  - Every worked example in the LSL-training PDF (NSW section, pp.13–31)
  - The bulk APA examples on PDF pp.139–141 (system vs. manual)
  - 8 edge cases from research brief §5 items 1–8 and 10–11
  - At least 2 bulk-mode test fixtures with multi-employee CSVs of ≥10 employees each

  **A single failing case blocks deployment.**

- **SC3.** The APA-training worked example of the 12-year casual-to-FT transition (PDF p.141) returns **$9,880.04 ± $0.00** for the total entitlement under single mode with the user-supplied gross inputs — not the $6,563.40 a system formula returns.

- **SC4.** Every numeric output on the result screen (single or bulk) is accompanied by a citation block naming the LSA section and rule that produced it.

- **SC5.** The single-mode UI and the bulk-mode results table both pass WCAG 2.2 AA on an automated accessibility scan and a manual keyboard-only run-through.

- **SC6.** The calculator is reachable from a working deep-link inside the APA member portal.

- **SC7.** In **bulk mode**, a 100-employee CSV upload (5 years of weekly wage history each, NSW only, mixed pay-pattern categories) processes end-to-end and produces a results table with citation blocks for every row in under 90 seconds (95th percentile). The variance versus the system formula is shown for every row.

## Design / Approach (Outline)

### High-level strategy

- **Architecture**: standalone Next.js + Tailwind + shadcn app (per `CLAUDE.md`). Two routes: `/calculator/single` and `/calculator/bulk`. No auth in v1; no server-side employee-data persistence in v1.

- **Rules engine**: pure TypeScript module under `website/src/lib/lsl/`. State-agnostic *engine* (the lookback math, the "greater of" comparison, the citation block accumulator, the entitlement table) + state-specific *rule sets* (NSW rule set in `website/src/lib/lsl/states/nsw/`). E2 adds sibling directories for VIC, QLD, etc.

- **Citation model**: every rule emits a `Citation { section, rule, pdfPage? }`. The engine accumulates citations per computed value.

- **Pay-pattern classifier**: deterministic function from inputs (employment type + hours variability over the lookback). User-overridable per employee.

- **Single vs. bulk**: the same rules-engine entry point is invoked once per employee. Single mode invokes the engine with a single employee object; bulk mode iterates over a parsed list of employee objects.

- **PDF extraction**: server-side route (`/api/extract-pdf`) that proxies to the Anthropic Claude API with the configured no-retention key. Streams extracted values back to the client for editable preview. Per-vendor templates are NOT v1 scope but the architecture leaves a hook for them (a pre-LLM template-match attempt that, if successful, skips LLM round-trip).

- **Test harness**: gold-standard suite under `website/src/lib/lsl/states/nsw/__tests__/`, including bulk-mode fixtures. Test failure = CI failure = no deploy.

### Key decisions

- **TypeScript pure functions for the rules engine, not a JSON DSL.** Reason: rules require conditional logic that's awkward to express as data. Mitigated by per-rule citation metadata and an exhaustive test suite.
- **Gross-only inputs in v1.** Reason: PM-directed simplification. The user is responsible for providing a gross figure consistent with NSW LSA s.3(2) "ordinary pay". The calculator's value is in the lookback math, not the component classification.
- **Bulk mode as a peer of single mode, not an extension.** Reason: bulk has its own UX (results table, per-row citations, exports). Sharing the rules engine is enough — sharing the UI is not.
- **Standalone + deep-link before SSO.** Reason: faster to ship; defers APA-tech-team integration cost.
- **Browser-local state, no server persistence in v1.** Reason: avoids Australian Privacy Principles overhead at v1.

### Integration points

- APA member portal: receives a deep-link; no API contract in v1.
- Future E3 (audit upload + variance report): the rules engine is the integration point — same engine powers E1's bulk mode and E3's payment-replay variance.
- Future E2 (other states): rule sets are siblings under `website/src/lib/lsl/states/`.
- Future E4 (payroll integrations): adds API-driven ingest as a third input mode alongside CSV and PDF.

### Data flow (single mode)

```
[ Form inputs (incl. trigger, wage history) ]
        ↓
[ Pay-cycle normaliser ] → weekly_gross per period
        ↓
[ Pay-pattern classifier ] → Category A | B | C  (confirmed if ambiguous)
        ↓
[ NSW rules engine ]
        ├── compute continuous service (s.4(11))
        ├── compute entitlement weeks (s.4(2))
        ├── compute value-of-week (s.4(5), greater-of)
        │     ├── current_weekly_gross
        │     ├── 12-month avg weekly gross
        │     └── 5-year avg weekly gross
        └── apply trigger logic (taking-leave | termination | as-at, s.4(5)-(7))
        ↓
[ Result + citations ]
        ↓
[ Result panel  |  PDF export ]
```

### Data flow (bulk mode)

```
[ Single CSV/PDF upload ]
        ↓
[ Parser / LLM extractor ] → employee list
        ↓
[ Editable preview table ] → user confirms / corrects
        ↓
[ For each employee → rules engine ] (same engine as single mode)
        ↓
[ Aggregate results table ]
        ↓
[ Citation block per row  |  CSV export  |  PDF export ]
```

## Acceptance Criteria

### Single mode

- **AC1.** Single-mode entry: a user can navigate from the APA-portal deep-link to `/calculator/single` in one click.
- **AC2.** All inputs in F2 are present in the form.
- **AC3.** The form accepts wage history via CSV upload OR PDF upload. CSV columns are documented inline; PDF upload triggers the editable preview step before any calculation runs.
- **AC4.** Pay-period totals at weekly, fortnightly, and monthly frequencies all normalise to the same weekly value (within rounding) when fed identical underlying gross-pay data. Test: an employee with $5,200/week over 52 weeks, $10,400/fortnight over 26 fortnights, and $22,533.33/month over 12 months all produce weekly_gross = $5,200.00.
- **AC5.** Submitting a full-time fixed-rate-fixed-hours employee with 12 years of service triggers a Category A calculation; the result includes three numeric outputs with citations referencing NSW LSA s.4(5)(b), s.4(2)(b), and the relevant PDF page.
- **AC6.** Submitting the APA worked example of the 12-year casual-to-FT employee (PDF p.141 — inputs encoded in the gold-standard test suite) returns total entitlement = $9,880.04.
- **AC7.** Submitting a 7-year employee with `trigger = termination, reason = voluntary_resignation` returns entitlement = $0 with a citation referencing s.4(2)(iii).
- **AC8.** Submitting a 7-year employee with `trigger = termination, reason = redundancy` returns the pro-rata entitlement with a citation referencing s.4(2)(iii)(a).
- **AC9.** Submitting an employee with a 6-month unpaid parental leave entry mid-tenure correctly excludes those days from both continuous service AND the lookback denominator.
- **AC10.** Submitting an employee with a Workers Comp absence correctly counts those days as service but excludes them from the average-hours/gross denominator.
- **AC11.** Every numeric value in the single-mode result panel has at least one citation block visible to a sighted user and readable by a screen reader.
- **AC12.** The "system formula comparison" toggle (F21) shows `current_weekly_gross × entitlement_weeks` alongside the legislated value and the dollar variance.
- **AC13.** The single-employee PDF export (F19) contains the result panel + citations + variance.
- **AC14.** Automated WCAG 2.2 AA scan reports zero violations on the single-mode result panel.

### Bulk mode

- **AC15.** Bulk-mode entry: a user can navigate from the APA-portal deep-link to `/calculator/bulk` in one click (or via a "switch to bulk" toggle on the single-mode page).
- **AC16.** Uploading a CSV containing 50 employees produces a results table with 50 rows, each with the three numeric outputs and a per-row citation block.
- **AC17.** Uploading a payroll-report PDF in bulk mode triggers the editable preview grouped by employee. The user can correct any row before running the calculation.
- **AC18.** Bulk-mode default trigger is `as_at` with the as-at date = upload date. The user can override per row to `taking_leave` or `termination` if the CSV/PDF includes per-employee trigger columns.
- **AC19.** A bulk batch with one cross-jurisdiction-blocked employee successfully processes all other employees; the blocked row is surfaced separately with a "needs jurisdiction nominated" call-to-action.
- **AC20.** The bulk results table supports filter / sort by employee, state, accrued weeks, total value, and variance.
- **AC21.** The bulk export produces a CSV of all rows and a multi-page PDF (one page per employee with summary header).
- **AC22.** Automated WCAG 2.2 AA scan reports zero violations on the bulk results table.

### Cross-mode

- **AC23.** Inputs that indicate cross-jurisdictional service MUST block the calculation (for that employee) until the user nominates the governing state. The calculator MUST NOT default silently.
- **AC24.** The full NSW gold-standard test suite (single + bulk fixtures) passes at 100% in CI. A single failing case fails the build and blocks deploy.
- **AC25.** Intermediate calculations are unrounded; only display values are rounded. The 12-year casual-to-FT test (PDF p.141) returns exactly $9,880.04 — not $9,880.03 or $9,880.05.
- **AC26.** When the LLM extraction service is unavailable, the system surfaces the failure within 10 seconds of the upload, retains any other form inputs, and routes the user to the CSV path.
- **AC27.** An attempt to upload a `.docx`, `.xlsx`, or image file is rejected at the file picker; only PDF and CSV are accepted.
- **AC28.** Uploading a PDF exceeding 50 pages or 50 MB is rejected with a clear in-page message.

## Open Questions

- **PM-A** — Mobile scope: default = responsive, best-effort, desktop-optimised (F22). PM may override to make mobile a stated non-goal in `product.md` §7.
- **PM-B** — Bulk-mode trigger semantics: default = `as_at` snapshot with optional per-row override. PM may change the default (e.g., require explicit user choice on every bulk upload).
- **OQ-A** — High-income threshold verification: now out of v1 scope (no HIT test). Re-opens if a future epic re-introduces pay-component decomposition.
- **OQ-B** — LLM vendor + data-handling policy: default = Anthropic Claude API no-retention tier; PM signs off vendor + policy doc before E1 ships.
- **OQ-C** — Test-suite enumeration: `.specify/features/001-nsw-calculator/test-cases.md` to be written before development starts, PM-signed-off. Routes to PM (signer) + dev (encoder).

Dev-layer items are tracked in `dev-findings.md`.

## Glossary

- **LSL** — Long Service Leave.
- **LSA** — NSW *Long Service Leave Act 1955*.
- **APA** — Australian Payroll Association.
- **Prescribed date** — the date applicable to the active trigger: the day before LSL commences for `taking_leave`; the termination date for `termination`; the as-at date for `as_at` (LSA s.4(5)).
- **Value of a week** — the legislated weekly LSL rate computed per LSA s.4(5).
- **Continuous service** — service that counts toward LSL accrual per LSA s.4(11).
- **Pay-pattern category** — one of A (fixed rate, fixed hours), B (fixed rate, varied hours), C (varied rate). Determines which formula applies per LSA s.4(5).
- **Trigger** — the event causing the calculation: `taking_leave`, `termination`, or `as_at` (snapshot).
- **As-at mode** — a snapshot calculation that reports accrued LSL value at a date without applying pro-rata-on-termination thresholds. Used for finance / liability reporting and for periodic audit checks.
- **Single mode** — one employee, one event, form-based entry.
- **Bulk mode** — many employees, one upload (CSV or PDF), results in a table.
- **Citation block** — explanatory text shown alongside a numeric output, naming the LSA section and the rule that produced it.
- **Gold-standard test suite** — the curated set of (input, expected output, citation) cases the calculator must pass 100% of, signed off by PM before development.
- **System formula** — the simple `current_weekly_gross × entitlement_weeks` calculation that mainstream payroll systems would produce. Used in F21 / AC12 as a visible-variance comparison against the legislated method.
