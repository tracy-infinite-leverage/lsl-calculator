# Epics — LSL Calculator

These are thematic bundles of work. Each epic makes a bet on user behavior — a specific problem that, if solved, unlocks a meaningful outcome. Epics are not a sprint backlog.

> **Status**: skeleton entries written from the client interview on 2026-05-21. Specs under `.specify/features/{slug}/spec.md` will be written by `pm-epic-writing` (full speckit workflow) when an epic enters discovery.

---

## E1 · One-State Calculator

**The problem:** A payroll manager needs to calculate LSL for one Australian state and currently does it by hand from legislation PDFs, knowing she will probably get it wrong by an amount no-one will ever audit.
**The mechanism:** Encode one state's LSL rules as a deterministic rules engine with a citation block, expose them through a single-calc UI inside the APA portal, and the manager opens the tool instead of her spreadsheet.
**What it bundles:**
- Rules engine for one state (legislation → named rules → tested code path)
- Single-calc UI: state selector, employee inputs, take-leave vs. termination toggle
- Citation block under every output: the rule that fired and the section of legislation
- Test harness with ≥100 gold-standard cases for the chosen state
- Deployment into the APA member portal (auth + hosting model — see Open Decisions in product.md)

**What success looks like:** A payroll manager in the chosen first state can produce a defensible LSL number in ≤30 seconds, with ≥99% accuracy against the gold-standard test suite, by 2026-08-21 (90 days).
**Why it goes first:** It is the smallest end-to-end slice that proves the wedge (deterministic rules engine + citation block). Until one state works end-to-end inside the APA portal, no other epic has a foundation.

_Spec: `.specify/features/001-one-state-calculator/spec.md` (not yet written)_

---

## E2 · All-State Coverage

**The problem:** Most Australian employers operate across multiple states, and a single-state tool is a partial answer. Expanding state-by-state is also the slowest, riskiest way to reach a defensible product.
**The mechanism:** Replicate the E1 rules-engine pattern for each of the remaining seven states/territories, with per-state gold-standard test cases. Each new state is a content/data milestone, not a UI rewrite.
**What it bundles:**
- Rules sets for VIC, NSW, QLD, WA, SA, TAS, ACT, NT (excluding whichever is chosen in E1)
- Per-state gold-standard test suites
- UI state selector extended to all 8 states
- Regression test pipeline that runs every state's suite on every change

**What success looks like:** All 8 states encoded with ≥99% accuracy on each state's gold-standard suite; UI single-calc available for every state.
**Why it goes second:** Cross-state employer support is the obvious customer expansion path from E1. The rules engine is already proven; this epic is incremental risk only.

_Spec: `.specify/features/002-all-state-coverage/spec.md` (not yet written)_

---

## E3 · Payroll System Integrations

**The problem:** Manual entry of employee start date, wage history, and pay components per calculation is friction that scales linearly with calculation volume. Audit replay is impractical without bulk wage history.
**The mechanism:** Read-only API integrations with the major Australian payroll platforms (Xero, MYOB, KeyPay, ADP, etc.) to ingest employee data and wage history on demand.
**What it bundles:**
- Connector for first payroll platform (vendor TBD — likely the highest-share platform among APA members)
- Authentication / OAuth flow per vendor
- Data mapping: payroll-platform fields → rules-engine inputs
- Connector for second and third payroll platforms
- Telemetry on which fields are missing / ambiguous, by vendor

**What success looks like:** A payroll manager whose company runs on a supported platform completes an LSL calculation with zero manual data entry beyond selecting the employee and the trigger.
**Why it goes third:** API integrations are higher engineering cost and require vendor partnerships. Pre-E3, CSV import covers the same data-ingest problem at lower fidelity. E3 is the path to scaling beyond the early-adopter cohort.

_Spec: `.specify/features/003-payroll-integrations/spec.md` (not yet written)_

---

## E4 · Audit Upload and Variance Report

**The problem:** A payroll manager or external auditor needs to verify that previously-paid LSL transactions were correct. Doing this by hand across a year of payments is impractical, and the data lives across multiple systems.
**The mechanism:** CSV upload of historical LSL payments plus wage history; replay each payment against the encoded rules engine; produce a variance report (PDF + CSV) showing correct, under-paid, and over-paid lines with amounts and citations.
**What it bundles:**
- CSV import flows: LSL payments, wage history (template + validation)
- Replay engine: each payment → rules-engine recalculation → variance row
- Variance report output: PDF for human reading, CSV for ingestion
- Auditor workspace (separate from payroll workspace) — sees variance reports, not individual calculations

**What success looks like:** An auditor uploads a year's LSL payments + wage history and receives a variance report identifying every under/over-payment with the rule and legislation section that drove the discrepancy.
**Why it goes fourth (per client sequencing):** Tracy ordered API integrations before CSV/audit, presumably because once API integrations exist the CSV step gets shorter and the audit experience improves. *Note: this ordering is flagged as an Open Decision in `product.md` — the audit feature is the more differentiated wedge against payroll vendors, and there is a defensible case for moving E4 ahead of E3.*

_Spec: `.specify/features/004-audit-upload-variance-report/spec.md` (not yet written)_

---

## Sequence argument

E1 first because nothing else has a foundation until one state works end-to-end inside the APA portal. The wedge (deterministic rules + citation block) has to be proven on a real state before duplicating effort across the remaining seven.

E2 second because cross-state coverage is the obvious customer expansion path from E1, and the rules engine already exists — this is incremental risk only.

E3 third (per the client's stated order) because read-only payroll API integrations reduce friction across both single-calc and audit use cases. The CSV path covers the same ingest need at lower fidelity until E3 ships, so the audit work in E4 is unblocked even without E3.

E4 fourth (per the client's stated order). Note: there is a credible alternative sequencing where E4 ships before E3 because audit replay is the more differentiated wedge against payroll vendors and is achievable with CSV alone. This sequencing decision is logged in `product.md` Open Decisions and should be revisited before E3 enters discovery.
