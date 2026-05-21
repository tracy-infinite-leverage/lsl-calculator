# Dev Layer Findings — 001-nsw-calculator

**Generated**: 2026-05-21
**Source**: speckit-analyze on `spec.md` v0.4.0 + pm-analyze-split routing
**Consumed by**: `dev-feature-plan` skill (Phase 0 of developer agent workflow)

These findings are technical/implementation concerns surfaced by analyze. They do not require PM input to resolve; the developer agent owns them and produces `impl-plan.md` that addresses each one.

PM-layer items (mobile scope, bulk trigger semantics, LLM vendor confirmation) are documented separately at the top of `spec.md` as `PM-A`, `PM-B`, and `OQ-B`.

> v0.4.0 scope simplification removed several v0.3.0 findings — `D11` (edge-case attestation) and the `$183,100 HIT test` items are no longer relevant. v0.4.0 bulk mode adds new findings (`D17–D22`).

---

## Findings table

| ID | Issue | Section | Severity | Suggested Resolution |
|----|-------|---------|----------|---------------------|
| D01 | Engine must enforce unrounded intermediate arithmetic. | F12, AC25 | MEDIUM | Use a decimal library (e.g. `decimal.js` or native `BigInt`-backed fixed-point) for all monetary computation. Round to 2dp half-up at display only. Property-based test: no displayed value differs from engine's internal value by more than 0.005. |
| D02 | Continuous-service event input structure (F4) is specified at the model level but not at the form-rendering level. | F4, AC9, AC10 | MEDIUM | Render as an expandable list of rows with `{event_type, start_date, end_date, optional_note}` per row, grouped by event_type. end_date optional for transfer-of-business and apprentice-transition; required otherwise. |
| D03 | PDF size + format constraints (F5: 50 pages, 50 MB, PDF-only) need enforcement at the file picker level. | F5, AC27, AC28 | LOW | `accept="application/pdf,text/csv"` on the input; pre-validate file.size before any upload begins; pre-count pages client-side via pdf.js before sending to the LLM. |
| D04 | LLM service unavailability fallback needs defined timeouts. F5 says "one automatic retry" without per-attempt timeout. | F5, AC26 | MEDIUM | Single-mode per-attempt timeout = 30s (aligned with P3 95th-percentile). Total budget = 70s. Bulk-mode per-attempt = 5 minutes (aligned with P3 bulk). Surface failure within 10s of last attempt (AC26). |
| D05 | Extraction-confidence threshold (F5) has no v1 default value. | F5 | MEDIUM | Default per-field aggregate threshold = 0.85 (as reported by the LLM). Below this, refuse display and force CSV path. Calibrate against a labelled set of 50 payroll PDFs sourced from APA member contributions before launch. |
| D06 | Classifier (F7) "ambiguous" threshold is undefined. | F7 | MEDIUM | Build a deterministic decision tree from `{employment_type, hours_variability_over_lookback}`. Mark category B "ambiguous" when `employment_type ∈ {part-time, casual}` AND `stddev(hours_per_period_in_lookback) > 10% of mean`. Show category-confirmation modal (single mode) or row prompt (bulk mode) when ambiguous. |
| D07 | "Prescribed date" application in F14 differs by trigger. The engine must thread the active trigger through to the lookback windows. | F11, F14 | LOW | Pass `Trigger` through the rules engine as a typed parameter. Compute `prescribed_date` once at the top of the calculation; reuse for all lookback-window endpoints. |
| D08 | Pay-pattern category override (F7) must persist through re-classification on input change. | F2, F7 | LOW | When user overrides the auto-classified category, mark the choice as "user-confirmed" and disable re-classification on subsequent input edits. Reset only on explicit re-confirmation. |
| D09 | "Mixed-frequency wage history" warning (F3a) needs detection logic. | F3a | LOW | Detect by gap-analysis on `period_start_date` sequences. If the modal gap differs between any contiguous run of ≥4 periods and the rest of the history, flag mixed-frequency. |
| D10 | Citation block (F13) — multiple citations per value rendering not defined. | F13, AC11 | LOW | Render as a stacked list under the value; first citation is the LSA section, subsequent citations are PDF page references. Screen-reader source order matches visual order. |
| D12 | F21 (system-formula comparison) and AC12 reference the comparison value; v0.4.0 specifies `current_weekly_gross × entitlement_weeks`. | F21, AC12 | LOW | Implement directly; label clearly so the user understands what they're comparing against. Include the dollar variance prominently. |
| D13 | Browser local state (S1, F20) storage scope for the unauthenticated deep-link context. | F20, S1 | LOW | `localStorage` keyed by an anonymous session UUID; surface a "clear this calculation" button; auto-clear after 7 days of inactivity. Bulk-mode results may be larger than localStorage limit — fall back to in-memory only when oversize. |
| D14 | Telemetry: the spec is silent on what runtime data is collected. | (gap) | MEDIUM | Add minimal anonymous telemetry: calc counts by trigger and mode (single/bulk), extraction success/failure counts, time-to-result distribution, error rates. **Must not log any employee-identifying fields** (per S3, S5). Use a privacy-respecting service or self-hosted. |
| D15 | Uncaught engine exceptions are not addressed. | (gap) | MEDIUM | Wrap the engine call in a top-level error boundary. On uncaught throw: display a generic message, log the exception to error-tracking (with employee-data scrubbed), do not produce a number. Bulk mode: row-level error isolation — one failing employee MUST NOT fail the whole batch. |
| D16 | Test-data fixtures for the gold-standard suite (SC2) need to be encoded from the LSL-training PDF. | SC2, AC24 | MEDIUM | Before development begins, produce `.specify/features/001-nsw-calculator/test-cases.md` enumerating each PDF worked example with input values, expected output, and citation references. Include at least 2 bulk-mode fixtures with multi-employee CSVs of ≥10 employees. PM signs off. |
| D17 | Bulk-mode CSV schema needs definition. | F3, F6 | MEDIUM | Define a canonical CSV schema with: `employee_id`, `employee_name` (optional), `start_date`, `end_date` (optional), `employment_type`, `state_of_service` (semicolon-delimited if multiple), `period_start`, `period_end`, `gross_pay`, `period_frequency` (weekly/fortnightly/monthly/other), `period_days` (required when frequency=other), `trigger` (optional, defaults to as_at), `trigger_date` (optional), `service_event_type` (optional), `service_event_start` (optional), `service_event_end` (optional). One row per pay period + one row per service event. Document inline on the upload page. |
| D18 | Bulk-mode results table needs row-level UX for citation expansion + per-row jurisdictional unblock. | F6b, AC19 | MEDIUM | Each row in the results table has an expand chevron that reveals the citation block in place. Rows with cross-jurisdiction-pending have an inline "nominate jurisdiction" affordance that opens a modal; resolving it re-runs only that row. Keyboard-navigable per A4. |
| D19 | Bulk-mode PDF extraction for multi-employee payroll reports needs employee-grouping logic. | F5, F6 | MEDIUM | LLM prompt design: ask the model to return a JSON list of `{employee, periods[]}` rather than a flat list. Validate the response shape; on shape failure, retry with corrective prompt; on second failure, route to CSV path. |
| D20 | Bulk-mode `as_at` snapshot semantics: accrued weeks for sub-10-year employees (F11). | F11 | LOW | For `as_at` mode, compute accrued weeks pro-rata regardless of tenure — `years_of_service × (8.6667/10)`. This deliberately differs from termination mode (which applies the s.4(2)(iii) thresholds). Mark each output's citation with "as-at snapshot — pro-rata thresholds not applied". |
| D21 | Bulk-mode export needs to scale to 500+ employees. | F6b, P2 | LOW | Generate the multi-page PDF server-side using a streaming PDF library (e.g., `pdfkit`) rather than client-side rendering. CSV export is plain-text and trivial. |
| D22 | Single↔bulk routing: should the user be able to switch modes mid-task without losing inputs? | F1, AC15 | LOW | Routes are independent (`/calculator/single`, `/calculator/bulk`); switching navigates to the other route and warns "your current inputs will be discarded — continue?" Inputs are not migrated. |
| D-OQ7 | Expected concurrent user load at launch — informs Vercel allocation. | (carried OQ7) | LOW | Default to "tens at peak, single-digit average" given APA member base + niche LSL-event cadence. Use Vercel's default serverless allocation; no infra special-casing. Bulk-mode requests are heavier — set per-route function memory to 1024MB and timeout to 5 minutes. Revisit if telemetry shows sustained >20 concurrent bulk runs. |

---

## Resolution gates

- **D14** (telemetry) and **D15** (error handling — including bulk row-level isolation) are MEDIUM and must be addressed before E1 ships.
- **D16** (test-data fixtures, single + bulk) is a launch gate — `test-cases.md` must exist and be PM-signed-off before development on the rules engine starts.
- **D17** (bulk CSV schema) is a launch gate — schema must be documented before bulk-mode CSV is implemented.
- All other items can be incorporated into `impl-plan.md` and `tasks.md` during the developer agent's planning phase.

## Cross-reference

Acceptance criteria affected by these findings:

- AC9, AC10 → D02
- AC11 → D10
- AC12 → D12
- AC16–AC22 (bulk) → D17, D18, D19, D21
- AC23 → D18 (jurisdiction unblock UX)
- AC24 → D16
- AC25 → D01
- AC26 → D04
- AC27, AC28 → D03

Open questions transferred from spec:

- F7 classifier ambiguity → D06
- F5 extraction confidence threshold → D05
- OQ7 concurrent load → D-OQ7
