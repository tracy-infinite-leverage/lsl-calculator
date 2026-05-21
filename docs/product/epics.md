# Epics — LSL Calculator

These are thematic bundles of work. Each epic makes a bet on user behavior — a specific problem that, if solved, unlocks a meaningful outcome. Epics are not a sprint backlog.

> **Sources**: APA *Long Service Leave Masterclass* (January 2026, 158pp, in `docs/features/LSL-training.pdf`) + each state's LSL legislation as primary source. Citations in the form `(NSW LSA s.4(2); PDF p.13)` refer to the relevant Act section and PDF page.
>
> **Sequence**: build order is E1 → (E3 NSW slice) → E2 → (E3 expansion) → E4. Epic numbers are identities, not strict build order; see the Sequence Argument at the end.

---

## E1 · NSW Calculator

**The problem:** Australian payroll managers calculating LSL for an NSW employee — and auditors verifying it after the fact — currently work from the *Long Service Leave Act 1955* (NSW) by hand. The Act defines three distinct pay-pattern categories (fixed-rate-fixed-hours, fixed-rate-varied-hours, varied-rate), each with its own "greater of" comparison between current rate, 12-month average, and 5-year average. APA's own training shows that mainstream payroll systems, which compute `hours × hourly rate`, produce errors of 3–34% against the correct figure: in one worked example, a 12-year casual-to-FT transition is **underpaid $3,316.64 on a correct $9,880.04 payout** (PDF pp.139–141).

**The mechanism:** Encode the NSW LSA as a deterministic rules engine that selects the correct pay-pattern category, runs the lookback comparisons, and returns the legislated "value of a week" with a citation block linking each computed value to the section of the Act that produced it. Expose it through two modes inside the APA portal (working default: standalone + deep-link): a single-employee form for a specific event, and a bulk-employee upload (CSV or PDF of any payroll report) for snapshot / audit calculations across many employees in one pass.

**What it bundles:**
- **Pay-pattern classifier**: identifies which of the three NSW categories applies (NSW LSA s.4(5); PDF pp.18–23)
- **NSW rules engine**: lookback comparisons (current weekly gross / 12-month average / 5-year average); accrual table (10 yrs → 8.6667 wks, +4.3333 wks per 5 yrs); pro-rata thresholds on termination (5 yrs limited grounds, 10 yrs any reason) (NSW LSA s.4(2); PDF pp.13, 25)
- **Continuous-service rules**: paid leave + Workers Comp + transmission-of-business count; unpaid parental leave + industrial action + employer-initiated re-hire gap >2 months do not (NSW LSA s.4(11), s.4(6); Workers Comp Act 1987 s.49; PDF pp.14–16)
- **Single mode**: form-based entry for one employee with a specific trigger (taking leave / termination / as-at). Output: value of a week + value of a day + total entitlement with citation block.
- **Bulk mode**: CSV or PDF upload of any payroll report containing many employees' wage histories. Output: results table with one row per employee, per-row citation expansion, CSV + multi-page-PDF export. Default trigger = `as_at` (snapshot at upload date), user can override per row.
- **Pay-cycle normalisation**: weekly / fortnightly / monthly / other gross totals normalised to weekly averages before the rules engine runs.
- **PDF extraction**: vendor-agnostic LLM-based extraction (default vendor: Anthropic Claude API, no-retention enterprise tier) with mandatory editable preview before any calculation.
- **Gross-only inputs**: the calculator does NOT decompose into pay components. The user provides gross figures consistent with NSW LSA s.3(2) "ordinary pay"; pay-component decomposition / bonus high-income-threshold / salary sacrifice handling are OUT of v1.
- **Citation block**: every numeric output traces to the rule that fired, the LSA section, and the PDF page.
- **NSW gold-standard test suite**: PDF worked examples + 8 edge cases from the research brief + ≥2 bulk-mode multi-employee fixtures. PM signs off before development. Single failing case blocks deploy.

**What success looks like:** A payroll manager handling an NSW LSL event opens the calculator, completes a defensible single-employee calculation in ≤30 seconds; an auditor running bulk verification across 100 NSW employees gets a citation-backed results table in under 90 seconds. **100% accuracy on the gold-standard test suite is the launch gate; a single failing case blocks deployment.** Specifically: the APA training's worked example for the 12-year casual-to-FT transition (PDF p.141) must return $9,880.04 exactly, not the $6,563.40 a system formula returns.

**Why it goes first:** It is the smallest end-to-end slice that proves the wedge. The NSW LSA contains every structural element that recurs across the other seven states (lookback comparison, pay-pattern categories, pro-rata thresholds), so a working NSW engine is the architectural template for E2. Bulk mode in E1 is the foundation E3 (audit variance) builds on. Until NSW works end-to-end with citations, the wedge ("deterministic, defensible, legislation-traceable") is a claim, not a product.

_Spec: `.specify/features/001-nsw-calculator/spec.md` (v0.4.0)_
_Dev findings: `.specify/features/001-nsw-calculator/dev-findings.md`_

---

## E3 · Audit Upload and Variance Report

**The problem:** Once a payroll manager has confidence in the calculation for a single employee, the more valuable use-case is replaying the calculation across a year or more of historical LSL payments — to find out whether the company has been over- or under-paying. APA's training material frames LSL as a *chronic* payroll-data-quality problem (Health Check, PDF p.137), with system-driven errors that compound over many employees. The auditor persona (internal audit, external audit, APA-engaged consultants) buys differently from the payroll-manager persona, and the audit deliverable — a variance report by employee — is the primary artefact they need.

**The mechanism:** Ingest a CSV of historical LSL payments + a CSV of wage history (with the schema derived from NSW LSA s.8 record-keeping requirements). For each historical payment, run the rules engine forward from the relevant prescribed date and compare to the amount actually paid. Produce a variance report (PDF for human reading, CSV for downstream ingestion) listing every payment with: employee, period, calculated correct amount, actual amount paid, variance ± $, the rule(s) that fired, and the LSA section(s).

**What it bundles:**
- **CSV import schema**: aligned to NSW LSA s.8 records (employer + ABN, employee, start/end dates, classification, leave taken with dates and gross payments, entitlement records at 10y and every 5y, bonuses included, termination payments) (NSW LSA s.8; PDF p.26)
- **Wage history schema**: per-pay-period gross + pay-component breakdown granular enough to reconstruct 12-month and 5-year averages with day-precision (denominators 365/366/1825/1826/1827, less "days not counted")
- **Import validation**: typed parsing, schema validation, fuzzy column-name matching for common payroll-export formats, ambiguity report before any calc runs
- **Replay engine**: for each historical LSL payment, recompute through the NSW rules engine at the prescribed date; surface any disagreement
- **Variance report (PDF)**: human-readable, one row per historical payment with verdict (correct / under by $X / over by $Y / cannot verify), grouped by employee, with a top-level summary
- **Variance report (CSV)**: same content, machine-readable for downstream audit workpapers
- **Citation block per row**: the rule that fired and the LSA section that drove the result, so the auditor can defend each finding
- **Auditor workspace**: separate landing page from the single-calc UI, designed for batch uploads and downloadable reports, not interactive calculation
- **NSW-first scope**: E3 v1 audits NSW only; cross-state audit waits on E2

**What success looks like:** An APA member or APA-engaged auditor uploads a year of NSW LSL payments + the corresponding wage history, and within minutes receives a variance report with one row per payment, citation-backed, that they can hand to a CFO or external auditor without further rework. The known APA worked example (PDF p.141 — 12-year casual-to-FT employee) when fed through E3 returns variance = +$3,316.64 (underpaid) against the correct $9,880.04.

**Why it goes second in build order (third in numbering):** The audit use-case sits on the same rules engine as E1. Once NSW calculation is correct, the marginal cost of audit replay on NSW is a CSV importer + a variance report generator. Shipping audit on NSW before expanding to all states proves the second buyer (the auditor) is reachable within Phase 1, and it does so at a fraction of the cost of expanding the calc UI to seven more states first.

_Spec: `.specify/features/003-audit-upload-variance-report/spec.md` (not yet written)_

---

## E2 · All-State Coverage

**The problem:** Most Australian employers operate across multiple states. A NSW-only calculator + audit is a credible Phase-1 wedge but an incomplete product. Each remaining state has its own legislation with structural differences from NSW — including some that are dangerous to mis-encode (VIC criminalises cashing out; ACT counts overtime hours for part-time/casual ordinary-pay calc, *inverting* NSW's rule; WA has dual continuous-service regimes either side of 20 June 2022).

**The mechanism:** Replicate the E1 NSW rules-engine pattern for each of the remaining seven jurisdictions (VIC, QLD, WA, SA, TAS, ACT, NT), with per-state gold-standard test suites derived from each state's LSA + the worked examples in the APA training. Each new state is a content/data milestone, not a UI rewrite. The UI gains a state selector; the citation block updates to reference the relevant state's Act.

**What it bundles:**
- **VIC** rules: 7-year qualifying period, 12-week break tolerance, cashing-out as criminal offence (s.67), pre/post Nov-2018 continuous-service regimes (LSL Act 2018 (Vic); PDF pp.32–48). *Highest behavioural divergence from NSW.*
- **QLD** rules: 10-year, restricted cashing-out (requires award/EA permission or QIRC approval), 3-month break tolerance (IR Act 2016 (Qld) Ch.2 Pt.3 Div.9; PDF pp.49–64)
- **WA** rules: 10-year, dual continuous-service regimes either side of 20 Jun 2022, Workers Comp counting only from 1 Jul 2024 (LSL Act 1958 (WA); PDF pp.65–79). *Encoding risk: same employee may have two regimes applied across their tenure.*
- **SA** rules: 10-year → **13 weeks** (most generous accrual), PHs inclusive of LSL (vs NSW exclusive), cashing-out permitted in writing (LSA 1987 (SA); PDF pp.80–94)
- **TAS** rules: 10-year, cashing-out permitted after entitlement, no advance leave, 3-month break tolerance (LSL Act 1976 (Tas); PDF pp.95–108)
- **ACT** rules: 7-year qualifying period (lowest), **overtime hours count for part-time/casual ordinary-pay** (inverts NSW), termination paid within 90 days vs NSW immediate (LSL Act 1976 (ACT); PDF pp.109–123). *High mis-coding risk.*
- **NT** rules: 10-year → 13 weeks, cashing-out prohibited (s.12), strongest restriction on working elsewhere during LSL (s.16) (LSL Act 1981 (NT); PDF pp.124–136)
- **Per-state gold-standard test suites**: each suite derived from that state's worked APA examples + edge cases unique to that state
- **Multi-state employer support**: a "governing jurisdiction" selector that lets the user nominate which state's law applies for an employee with cross-jurisdictional service (the "sufficiently connected" test — PDF p.138 — is legal judgement, not arithmetic; calculator must surface ambiguity rather than choose silently)
- **Cross-state regression suite**: every change runs every state's suite; any break blocks merge
- **State selector in UI**: extended from NSW-only to all 8; citation block dynamically references the active state's Act
- **State-prioritisation order**: VIC second (highest population + highest divergence drives encoding maturity); then QLD, WA, SA, ACT, TAS, NT (population-weighted), unless E3 audit data from the field reveals a different demand signal

**What success looks like:** All 8 states encoded; each state's gold-standard suite passes at 100%; the UI state selector exposes every state; the multi-state-employer governing-jurisdiction selector is in production with explicit "this is a legal judgement, not a computed default" framing.

**Why it goes third in build order:** Cross-state expansion is the obvious customer-base expansion path, but it should follow E3 because audit demand from APA members (Phase 1) provides real-world signal about which states are most-asked-for. Expanding state-by-state in the order the market actually asks for them beats expanding in any pre-decided order.

_Spec: `.specify/features/002-all-state-coverage/spec.md` (not yet written)_

---

## E4 · Payroll System Integrations

**The problem:** Manual CSV uploads (E3) and manual single-employee data entry (E1) are friction that scale linearly with calculation volume. They also create a data-quality risk: every hand-typed start date, hand-entered pay component, or hand-edited CSV is a place where the calculator's correctness can be undermined by bad inputs to a correct rules engine. The eventual mature product reads directly from the payroll system of record.

**The mechanism:** Build read-only OAuth/API connectors to the major Australian payroll platforms. Map payroll-platform fields to the NSW-LSA-s.8-derived schema used by E1 + E3. On each calculation or audit run, pull live data from the payroll system rather than asking the user to enter it.

**What it bundles:**
- **First payroll-vendor connector** (vendor TBD; selection based on APA-member share — likely Xero, MYOB, KeyPay, or ADP)
- **OAuth/API authentication flow** per vendor
- **Field-mapping engine**: payroll-platform field → rules-engine input. Includes telemetry on missing/ambiguous fields by vendor so the gaps are visible across the customer base
- **Connectors for second and third vendors**
- **Refresh model**: explicit user-triggered refresh (not background sync) so the auditor's report is reproducible from a specific timestamp
- **Read-only by design**: API tokens scoped to read; no write-back into client payroll under any circumstance (see §7 of `product.md`)
- **Fallback to CSV**: every customer can still use the E3 CSV flow if their vendor isn't supported

**What success looks like:** A payroll manager whose company runs on a supported platform completes an LSL calculation or audit run with zero manual data entry beyond selecting the employee(s) and the trigger. The rules engine receives the same inputs it would receive from a perfect CSV, traced by field provenance ("this current rate came from vendor X's `current_pay_rate` field at timestamp T").

**Why it goes last:** API integrations are higher engineering cost, require vendor partnerships, and depend on E2 (cross-state) being mature so the connector design doesn't have to be reworked when the rules engine changes shape. Until E2 ships, CSV (E3) covers the ingest need at lower fidelity but full state coverage.

_Spec: `.specify/features/004-payroll-integrations/spec.md` (not yet written)_

---

## Sequence argument

The four epics ship in this build order:

1. **E1 (NSW Calculator)** — Phase 1, first. Proves the rules engine + citation block + 100% accuracy gate on a single state. No other epic has a foundation until this works.
2. **E3 v1 (NSW audit replay)** — Phase 1, immediately after E1 reaches Stage 4 (Tested). Reuses the E1 rules engine; adds CSV import + replay + variance report. Reaches the auditor persona within Phase 1 at low marginal cost. Provides real-world demand signal about which states are most-asked-for, which informs E2 prioritisation.
3. **E2 (All-state coverage)** — Phase 2, expanded state-by-state in the order E3 audit demand reveals. VIC is the most likely second state by population + divergence-risk-as-encoding-value; ACT and WA are the highest mis-coding risk states and warrant disproportionate test-suite investment when encoded.
4. **E3 v2 (cross-state audit)** — Phase 2, in parallel with E2. As each state is added in E2, audit coverage for that state lands automatically.
5. **E4 (Payroll integrations)** — Phase 3. Removes the CSV friction once the rules engine and audit replay are mature across multiple states.

Why not the obvious "E1 → E2 → E3 → E4" order? Because expanding state coverage before proving the second buyer (the auditor) leaves the more differentiated revenue stream (audit replay) un-validated for an extra phase. CSV-based audit is achievable today against NSW alone and is the strongest evidence that the product solves a problem worth paying for outside the payroll-manager persona.
