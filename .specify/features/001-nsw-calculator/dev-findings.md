# Dev Layer Findings — 001-nsw-calculator

**Generated**: 2026-05-21
**Source**: speckit-analyze on `spec.md` v0.3.0 + pm-analyze-split routing
**Consumed by**: `dev-feature-plan` skill (Phase 0 of developer agent workflow)

These findings are technical/implementation concerns surfaced by analyze. They do not require PM input to resolve; the developer agent owns them and produces `impl-plan.md` that addresses each one.

PM-layer findings (mobile scope, LLM vendor confirmation) are documented separately at the top of `spec.md` as `PM-1` and `PM-2`.

---

## Findings table

| ID | Issue | Section | Severity | Suggested Resolution |
|----|-------|---------|----------|---------------------|
| D01 | Rounding strategy not explicit in spec until v0.3.0; engine must enforce unrounded intermediate arithmetic. | F10, AC24 | MEDIUM | Use a decimal library (e.g. `decimal.js` or native `BigInt`-backed fixed-point) for all monetary computation. Round to 2dp half-up at display only. Add a property-based test that no value displayed differs from the engine's internal value by more than 0.005. |
| D02 | Continuous-service event input UI structure is specified at the model level (F3) but not at the form-rendering level. | F3, AC9, AC11 | MEDIUM | Render as an expandable list of rows with `{event_type, start_date, end_date, optional_note}` per row. Group rows by event_type in the visual layout. Defaults: end_date optional for transfer-of-business and apprentice-transition; required for everything else. |
| D03 | PDF file size + format constraints are stated in F1c/F1a (20 pages, 20 MB, PDF-only) but not enforced at the file picker level. | F1a, F1c, AC22, AC23 | LOW | Set `accept="application/pdf"` on the input; pre-validate file.size before any upload begins; pre-count pages client-side via pdf.js before sending to the LLM. |
| D04 | LLM service unavailability fallback (F1d) needs a defined timeout. Spec says "one automatic retry" but no per-attempt timeout. | F1d, AC21 | MEDIUM | Per-attempt timeout = 30s (aligned with P2 95th-percentile target). Total budget = 70s (2 × 30s + 10s overhead). Surface failure within 10s of last attempt (AC21). |
| D05 | Extraction-confidence threshold (F1c) is a calibration parameter without a v1 default value. | F1c, OQ12 | MEDIUM | Default threshold = 0.85 (per-field aggregate confidence reported by the LLM). Below this, refuse display and force CSV/form path. Calibrate against a labelled set of 50 payroll PDFs sourced from APA member contributions. |
| D06 | The classifier (F5) "ambiguous" threshold is undefined in the spec. | F5, OQ2 | MEDIUM | Build a deterministic decision tree from `{employment_type, hours_variability, pay-component_presence, varied_rate_indicators}`. Mark category B "ambiguous" when employment_type ∈ {part-time, casual} AND `stddev(hours_per_period_in_lookback) > 10%` AND `varied_rate_indicators = false`. Show category-confirmation modal when ambiguous. |
| D07 | "Prescribed date" application in F7 differs by trigger. The engine must thread the active trigger through to the bonus-inclusion test. | F7, F12 | LOW | Pass `Trigger` through the rules engine as a typed parameter. Compute `prescribed_date` once at the top of the calculation; reuse for both the bonus test and the lookback-window endpoints. |
| D08 | Pay-pattern category override (F5) must persist through re-classification on input change. | F1, F5 | LOW | When user overrides the auto-classified category, mark the choice as "user-confirmed" and disable re-classification on subsequent input edits. Reset on category re-confirmation. |
| D09 | "Mixed-frequency wage history" warning (F1b) needs a definition of how to detect mixed frequencies. | F1b | LOW | Detect by gap-analysis on `period_start_date` sequences. If the modal gap differs between any contiguous run of ≥4 periods and the rest of the history, flag mixed-frequency. |
| D10 | Citation block (F11) renders a `Citation { section, rule, pdfPage? }` structure but the spec doesn't define how multiple citations per value are rendered. | F11, AC12 | LOW | Render as a stacked list under the value; first citation is the LSA section, subsequent citations are PDF page references. Screen-reader source order matches visual order. |
| D11 | Edge-case detection signals (F13) treat the salary_sacrifice and retrospective flags as user-attested yes/no. The system has no way to verify either claim. | F13, AC19 | LOW | Accept the user's attestation as-is in v1. Log the attestation in the calculation's audit metadata. A future epic may add detection from wage-history patterns (e.g., a single-period anomaly that looks like a back-pay). |
| D12 | F18 (system-formula comparison) and AC14 reference the comparison value but the spec does not define which "system formula" to compare against — there are several. | F18, AC14 | LOW | Use `hours_worked × current_hourly_rate × entitlement_weeks` as the comparison. This is the formula APA explicitly calls out as the system-driven error source (PDF p.139). Label it clearly so the user understands what they're comparing to. |
| D13 | Browser local state (S1, F17) — when the user reloads the page, the data should still be there. But for an APP+deep-link context (no auth), what's the storage scope? | S1, F17 | LOW | Use `localStorage` keyed by an anonymous session UUID. Surface a "clear this calculation" button. Auto-clear after 7 days of inactivity. |
| D14 | Telemetry: the spec is silent on what runtime data is collected for product analytics (calc count, error rates, extraction success rate). | (gap) | MEDIUM | Add minimal anonymous telemetry: calc counts by trigger, extraction success/failure counts, time-to-result distribution. **Must not log any employee-identifying fields** (per S3, S5). Use a privacy-respecting service (e.g. Plausible) or self-hosted. |
| D15 | Error handling: uncaught engine exceptions are not addressed. | (gap) | MEDIUM | Wrap the engine call in a top-level error boundary. On uncaught throw: display a generic "the calculator hit an unexpected condition" message, log the exception to error-tracking (with employee-data scrubbed), do not produce a number. |
| D16 | Test-data fixtures for the gold-standard suite (SC2) need to be encoded from the LSL-training PDF. This is a manual task. | SC2, AC13 | MEDIUM | Before development begins, the developer agent produces `.specify/features/001-nsw-calculator/test-cases.md` enumerating each PDF worked example with input values, expected output, and citation references. PM signs off this file as the launch gate. |
| D-OQ7 | Expected concurrent user load at launch — single-digit, tens, hundreds? | OQ7 | LOW | Default to "tens at peak, single-digit average" given APA member base + the niche nature of LSL events. Use Vercel's default serverless allocation; no infra special-casing in v1. Revisit if telemetry shows sustained >50 concurrent. |

---

## Resolution gates

- **D14** (telemetry) and **D15** (error handling) are MEDIUM and should be addressed before E1 ships, not deferred to a v2 release.
- **D16** (test-data fixtures) is a launch gate — `test-cases.md` must exist and be PM-signed-off before development on the rules engine starts.
- All other items can be incorporated into `impl-plan.md` and `tasks.md` during the developer agent's planning phase.

## Cross-reference

Acceptance criteria affected by these findings:

- AC9, AC11 → D02
- AC12 → D10
- AC13 → D16
- AC14 → D12
- AC17, AC18 → D04, D05
- AC19 → D11
- AC21 → D04
- AC22, AC23 → D03
- AC24 → D01

Open questions transferred from spec:

- OQ7 → D-OQ7
- OQ12 → D05
- OQ2 (classifier ambiguity) → D06
