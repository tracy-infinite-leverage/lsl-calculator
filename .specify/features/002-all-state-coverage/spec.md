# Spec: All-State LSL Coverage (E2)

**Version**: 0.3.0
**Status**: Draft — all clarifications resolved, ready for plan + tasks
**Date**: 2026-05-23
**Owner**: Tracy (PM)
**Branch**: `002-all-state-coverage`
**Source**:
- `docs/product/epics.md` § E2
- `docs/product/product.md`
- `docs/features/LSL-training.pdf` (APA LSL Masterclass, January 2026)
- Each state/territory's Long Service Leave legislation (8 Acts — see §Constraints)
- `.specify/features/001-nsw-calculator/spec.md` v0.5.0 — architectural template

> **Pattern-dependency notice.** This spec is written *in parallel with* E1 NSW shipping. The NSW rules-engine pattern (state-agnostic engine + per-state rule set in `website/src/lib/lsl/states/{state}/`, citation accumulator, classifier function, gold-standard test suite) is the foundation E2 builds on. NSW is currently shipping Phases 1–6 on branch `001-nsw-calculator`; Phase 3+ (PDF extraction, bulk mode, telemetry) is implemented but not yet on `main`. If the NSW pattern shifts during Phase 3–7 (post-launch logins), E2 acceptance criteria F2 / F12 may need re-work. The operator has explicitly accepted this risk to keep E2 specced in parallel.

---

## Clarification Summary (v0.3.0)

All six v0.1.0 open questions have been resolved across two operator clarification rounds (2026-05-23). The resolutions are applied throughout this spec; this section is the source-of-record for the decisions, ordered RES-1 through RES-6.

- **RES-1 (was OQ-1, priority order)** — **Resolved 2026-05-23 by operator (Tracy).** Encoding priority is **VIC → QLD → WA → SA → ACT → TAS → NT** (population-weighted, VIC first on divergence-risk). Operator agreed with the v0.1.0 working default; option (b) risk-weighted and option (c) demand-driven are rejected. Applied to § Design / Approach → "One state at a time, in priority order" (working-default caveat removed) and to AC4a.

- **RES-2 (was OQ-2, sub-epic split)** — **Resolved 2026-05-23 by operator (Tracy).** E2 ships as **one bundled epic** on the roadmap, not seven sub-epics. **Test boundary is per-state**: each of VIC, QLD, WA, SA, TAS, ACT, NT must pass its own gold-standard suite at 100% before it is marked done within E2. The epic completes when all seven per-state gates are green. Applied to § Acceptance Criteria (AC4a sequence-gate, AC4b per-state launch gate) and § Success Criteria (SC1 — every state's suite must independently pass; partial coverage is not a partial-ship of E2).

- **RES-3 (was OQ-5 + RES-3-PENDING, source-of-truth maintenance — full resolution)** — **Resolved 2026-05-23 by operator (Tracy).** Legislation monitoring is **manual**, with **Tracy as the named owner** for all 8 jurisdictions personally (no APA-engaged delegate, no shared rota). **Cadence: quarterly review on 1 March / 1 June / 1 September / 1 December** of each state's LSL Act, plus an **on-trigger override** whenever any state announces an amendment via parliamentary gazette or media notice. No automated watch, no RSS feed, no scraper. Applied to § Constraints (legislation monitoring constraint updated with owner + cadence committed) and § Dependencies (the "Nominated owner of manual legislation monitoring" hard pre-flight blocker is removed — owner is now named).

- **RES-4 (was OQ-A, mixed-state bulk timing)** — **Resolved 2026-05-23 by operator (Tracy).** **Mixed-state CSV bulk uploads are accepted from v1 (day one).** There is no single-state-only-per-state interim mode. Each CSV row MUST contain a `state` column nominating the governing state for that employee; the bulk upload step MUST validate that this column is present and non-empty before processing the batch. As VIC ships, a bulk CSV containing NSW + VIC rows is accepted. As QLD ships, NSW + VIC + QLD is accepted. The supported state set in `state` column values grows with the encoding sequence (RES-1). Applied to F17 (bulk-validation rule made mandatory; per-row `state` column, header variants, row-level validation, no upload-time primary-state fallback), AC16 (mixed-state scope clarified — from-VIC-ship onward), and § Design / Approach → "Bulk mode mixed-state from day one" (pending-decision caveat removed).

- **RES-5 (was OQ-B, cross-jurisdictional advisory heuristic)** — **Resolved 2026-05-23 by operator (Tracy) — delegated to PM recommendation, PM call applied.** **F13 (manual user-nomination of governing state) remains a MUST in v1; the heuristic advisory is removed from v1 scope and deferred to v2.** Rationale: (a) product.md §12 sets a "100% match to legislation" quality gate, and the `sufficiently connected` test (PDF p.138) is legal judgement — by definition no heuristic can satisfy that gate; (b) F14 already mandates the legal-judgement caveat on every cross-jurisdictional result, which means the marginal UX gain of a heuristic above the existing nomination workflow is small; (c) the downside is asymmetric and persistent — a wrong heuristic ("VIC governs") cited against the product in a contested tribunal matter is discoverable forever; (d) the v2 escape valve remains intact — the advisory layer can be added later without re-architecting anything, gated on production demand signal from APA auditors. Applied: F25 (was a v1 MAY) **removed from v1 scope** and recorded in § Deferred to v2 below. F13 remains as MUST.

- **RES-6 (was OQ-C, gold-standard sign-off authority)** — **Resolved 2026-05-23 by operator (Tracy).** **PM-only sign-off per state. No APA-engaged payroll specialist co-signer is required.** Operator explicitly does not want a human-in-the-loop beyond PM. This means the per-state launch gate (AC4b) depends solely on **(a) PM signoff on `test-cases.md` for that state, and (b) the automated test suite (engine + that state's gold-standard suite) passing 100% green in CI on the merge commit.** Applied to AC4 (sign-off rule clarified PM-only), AC4b (launch gate components made explicit), and § Constraints (Quality gate description tightened to remove the implicit "specialist review" assumption inherited from product.md §14).

### Deferred to v2

- **Cross-jurisdictional governing-state advisory heuristic (formerly F25, removed under RES-5).** An advisory layer that proposes a governing state on cross-jurisdictional service (proportion of service per state, anchor of employment relationship, etc.) as advisory text only — never determinative. Re-evaluation gate: surface in v2 planning *if and only if* APA auditor demand signal (via E3 audit replay) shows mixed-state employees are the majority of audit-replay rows AND no contested-matter risk has materialised against the current manual-nomination flow.

---

## Executive Summary

Encode the long-service-leave legislation for the seven remaining Australian jurisdictions — Victoria, Queensland, Western Australia, South Australia, Tasmania, ACT, and Northern Territory — using the same deterministic rules-engine pattern proven on NSW in E1. Each state is a per-state rule set under `website/src/lib/lsl/states/{state}/` with its own gold-standard test suite; the engine, classifier, citation accumulator, and UI shells are reused unchanged. The UI gains a state selector and the citation block dynamically references the active state's Act.

This is the customer-base-expansion epic. After E2, the LSL Calculator is no longer "NSW-only" — it is the only Australian product that produces defensible, citation-backed LSL values across all 8 jurisdictions. The primary users are unchanged from E1: payroll managers (single mode, daily LSL events) and APA-engaged auditors (bulk mode, periodic verification), but the addressable base widens to every Australian employer regardless of location.

The expansion carries encoding risk that NSW did not. Three states diverge from NSW in ways that are dangerous to mis-encode:

- **VIC** criminalises cashing out (LSL Act 2018 (Vic) s.67) and operates two continuous-service regimes either side of 1 November 2018.
- **ACT** counts overtime hours for part-time/casual ordinary-pay calculation, *inverting* NSW's rule. A NSW-trained mental model produces wrong answers in ACT.
- **WA** operates two continuous-service regimes either side of 20 June 2022, and Workers Comp counts as service only from 1 July 2024. A single WA employee whose tenure spans 2022 may have both regimes applied across different segments of their service.

The encoding effort is therefore not "seven copies of NSW" — it is seven distinct legislative encodings sharing one engine. The gold-standard test suite for each state is the load-bearing artifact; per-state PM sign-off on the suite is the gate to encoding that state.

## Context & Problem Statement

### Current state

E1 ships an NSW-only calculator. A payroll manager whose company operates in multiple states — which describes most APA member organisations of any meaningful size — can use the calculator for NSW employees and must revert to her spreadsheet, the state Act PDF, and an accountant for every other state. The wedge ("deterministic, defensible, legislation-traceable across Australia") is half-delivered. An auditor running a national variance report through E3 (CSV audit replay) can only verify NSW rows in v1.

### Problem

Each remaining state has its own LSL Act with structural differences from NSW that prevent a "tweak the constants" approach. Specific known divergences (sourced from `docs/features/LSL-training.pdf` and each state's Act):

- **VIC** (LSL Act 2018 (Vic); PDF pp.32–48): 7-year qualifying period (vs NSW 10), 12-week break tolerance (vs NSW 2 months), **cashing out is a criminal offence** (s.67) — must surface as a hard error on any user attempt; pre- and post-November 2018 continuous-service regimes for employees with service straddling that date.

- **QLD** (Industrial Relations Act 2016 (Qld) Ch.2 Pt.3 Div.9; PDF pp.49–64): 10-year qualifying period, restricted cashing out (requires award/enterprise agreement permission OR Queensland Industrial Relations Commission approval), 3-month break tolerance.

- **WA** (LSL Act 1958 (WA); PDF pp.65–79): 10-year qualifying period, **dual continuous-service regimes either side of 20 June 2022**, Workers Comp counts as service **only from 1 July 2024**. Same employee may have two regimes applied across different segments of their tenure.

- **SA** (LSL Act 1987 (SA); PDF pp.80–94): 10-year qualifying period → **13 weeks** entitlement (most generous accrual in Australia, vs NSW 8.6667), public holidays *inclusive* of LSL (vs NSW exclusive — extending the leave), cashing out permitted with written agreement.

- **TAS** (LSL Act 1976 (Tas); PDF pp.95–108): 10-year qualifying period, cashing out permitted *after* entitlement accrues (not in advance), no advance leave, 3-month break tolerance.

- **ACT** (LSL Act 1976 (ACT); PDF pp.109–123): 7-year qualifying period (lowest in Australia, equal with VIC), **overtime hours count for part-time/casual ordinary-pay calculation** (inverts NSW), termination payment within 90 days (vs NSW "forthwith").

- **NT** (LSL Act 1981 (NT); PDF pp.124–136): 10-year qualifying period → 13 weeks (equal with SA), cashing out **prohibited** (s.12) — hard error on user attempt, strongest restriction on working elsewhere during LSL (s.16).

Most Australian employers also operate across more than one state. Cross-jurisdictional service raises a "sufficiently connected" test (PDF p.138) that is legal judgement, not arithmetic — the calculator must surface ambiguity rather than choose silently. E1 already specs a governing-jurisdiction nomination (F10); E2 must complete that workflow so the user can actually choose any of the 8 states, not just NSW.

### Constraints

- **Legal source-of-truth per state**:
  - VIC: Long Service Leave Act 2018 (Vic) — `legislation.vic.gov.au`
  - QLD: Industrial Relations Act 2016 (Qld), Chapter 2 Part 3 Division 9 — `legislation.qld.gov.au`
  - WA: Long Service Leave Act 1958 (WA) — `legislation.wa.gov.au`
  - SA: Long Service Leave Act 1987 (SA) — `legislation.sa.gov.au`
  - TAS: Long Service Leave Act 1976 (Tas) — `legislation.tas.gov.au`
  - ACT: Long Service Leave Act 1976 (ACT) — `legislation.act.gov.au`
  - NT: Long Service Leave Act 1981 (NT) — `legislation.nt.gov.au`

- **Quality gate (unchanged from E1)**: per `product.md` §12 — 100% of calculations must match the relevant section of legislation. Each state's gold-standard suite is **PM-signed-off (PM only — no APA-specialist co-signer per RES-6) before that state's development starts**; a single failing case in any state's suite blocks deployment of that state. The per-state launch gate is satisfied by **(a) PM signoff on `test-cases.md` + (b) automated suite passing 100% green in CI on the merge commit** — no additional human review step.

- **Architecture (unchanged from E1)**: state-agnostic engine + per-state rule set in `website/src/lib/lsl/states/{state}/`. E2 does not modify the engine; it adds rule sets and tests.

- **No UI rewrite**: the existing single-mode form and bulk-mode results table are reused. The only UI change is the state selector and the dynamic citation-block source (state Act vs. NSW LSA).

- **No new input modes**: CSV + PDF + form (the three E1 input mechanisms) are sufficient. E2 does not introduce new input mechanisms.

- **Pricing / business model unchanged**: still distributed via APA portal (deep-link) + non-member licences. E2 widens the addressable base; it does not change the unit economics.

- **Legislation monitoring is manual, owned by Tracy (RES-3, 2026-05-23)**: each of the 8 jurisdictions' LSL Acts is checked manually by **Tracy (PM/operator) personally for all 8 jurisdictions** — no APA-engaged delegate, no shared rota. Cadence is **quarterly: 1 March / 1 June / 1 September / 1 December**, plus an **on-trigger override** whenever any state announces an amendment via parliamentary gazette or media notice. No automated watch, RSS feed, or scraper is built. The quarterly cadence is committed (no working-default caveat). A missed quarterly review or unhandled gazetted amendment is treated as a P0 operational incident against the calculator's "100% match to legislation" quality gate.

### Dependencies

- **E1 (NSW Calculator) must be at Stage 3 or 4 minimum** for the rules-engine pattern to be stable enough to copy. *Note: the operator has explicitly overridden this gate — E1 is currently at Stage 2 (in-flight, Phases 1–6 implemented but not yet PM-signed Stage 3). E2 is being specced in parallel; the risk that NSW Phase 3–7 work shifts the engine pattern is accepted and called out in the pattern-dependency notice above.*
- **APA LSL Masterclass PDF** (`docs/features/LSL-training.pdf`) — supplies worked examples used as canonical test cases for each state.
- **Legislation update cadence and owner** — fully resolved by RES-3 (2026-05-23): manual monitoring, owned by Tracy personally, quarterly (1 Mar / 1 Jun / 1 Sep / 1 Dec) + on-trigger. No longer a pre-flight blocker — mechanism, owner, and cadence are all committed.

## Requirements

### Functional — MUST

#### Per-state rule encoding

- **F1.** The system MUST encode the LSL rules for each of the seven remaining jurisdictions (VIC, QLD, WA, SA, TAS, ACT, NT) as a sibling rule set under `website/src/lib/lsl/states/{state}/`, following the same module shape as the NSW rule set in E1.

- **F2.** Each per-state rule set MUST implement, at minimum:
  - A **pay-pattern classifier** (or the state's equivalent — some states do not use NSW's A/B/C categories; the classifier may collapse to fewer categories where the state Act does not distinguish).
  - A **qualifying-period rule** (VIC=7y, ACT=7y, all others=10y) and an **entitlement-weeks accrual table** specific to that state (NSW/VIC/QLD/WA/TAS/ACT = 8.6667 weeks at first entitlement; SA/NT = 13 weeks).
  - A **continuous-service rule** specific to that state's Act, including break tolerances (NSW=2mo, VIC=12wk, QLD=3mo, TAS=3mo, etc.).
  - A **pro-rata-on-termination rule** specific to that state's Act, including which termination reasons unlock pro-rata at < full entitlement.
  - A **value-of-week formula** matching the state's "ordinary pay" definition. For ACT specifically, the part-time/casual ordinary-pay formula MUST include overtime hours per ACT LSL Act 1976 s.4 (inverts NSW).
  - A **citation emitter** that names: (a) the state Act section, (b) the rule name, (c) the LSL-training PDF page where applicable. The citation block displayed to the user MUST dynamically reflect the active state's Act, not NSW.

- **F3.** Each per-state rule set MUST include a **gold-standard test suite** under `website/src/lib/lsl/states/{state}/__tests__/`. Minimum content per state:
  - Every worked example for that state in `docs/features/LSL-training.pdf` (state-specific PDF page ranges per §Context).
  - At least 5 edge cases unique to that state (e.g., for VIC: pre/post Nov-2018 service-straddling employee; for WA: 2022-straddling employee; for ACT: part-time-with-overtime ordinary-pay; for SA: PH-during-leave extension test).
  - At least 1 bulk-mode multi-employee fixture (≥5 employees) for that state.

- **F4.** PM MUST sign off each state's gold-standard test suite (a separate `test-cases.md` artifact per state, per the NSW pattern) **before development of that state begins**. A state may not enter `In Flight` until its suite is signed.

#### State-specific hard rules

- **F5.** When the active state is **VIC** and the user attempts to compute a cashing-out scenario (trigger = `cash_out` if added in v2, or any user action implying cashing out without leave being taken), the system MUST display a hard error citing LSL Act 2018 (Vic) s.67 and MUST NOT produce a numeric result. Cashing out in VIC is a criminal offence; the calculator MUST NOT compute a value that could be used to facilitate one.

- **F6.** When the active state is **NT** and the user attempts cashing out, the system MUST display a hard error citing LSL Act 1981 (NT) s.12 and MUST NOT produce a numeric result.

- **F7.** When the active state is **WA** and the employee's continuous service straddles 20 June 2022, the system MUST apply the dual-regime logic: pre-20-June-2022 service computed under the prior regime, post-20-June-2022 service under the current regime, with citations to both. Where the user's wage history does not distinguish service across that date (insufficient granularity), the system MUST surface an ambiguity warning before calculating and offer the user the choice to (a) supply the data with sufficient granularity, or (b) accept the single-regime result with a "regime split could not be applied — single-regime fallback used" caveat in the citation block.

- **F8.** When the active state is **WA** and the employee has a Workers Comp absence, the system MUST count the absence as service **only from 1 July 2024 onward**; days before that date MUST NOT count.

- **F9.** When the active state is **ACT** and the employee is part-time or casual, the value-of-week formula MUST include overtime hours in the ordinary-pay computation per ACT LSL Act 1976 s.4. The citation block MUST explicitly note this is the inverse of NSW behaviour to assist users transitioning between state contexts.

- **F10.** When the active state is **SA** or **NT**, the first-entitlement accrual MUST return **13 weeks** at 10 years of continuous service (not 8.6667). The accrual table for these states is separate from the NSW/VIC/QLD/WA/TAS/ACT path.

- **F11.** When the active state is **SA**, public holidays falling within a period of LSL MUST be counted *inclusive* (i.e., do not extend the leave) per LSA 1987 (SA), in contrast to NSW where PHs *extend* the leave per s.4(4A).

- **F12.** When the active state is **VIC** and the employee's continuous service straddles **1 November 2018**, the system MUST apply the dual-regime logic equivalent to F7 (regime split with citations to both; ambiguity warning + single-regime fallback when data is insufficiently granular).

#### Cross-jurisdictional service

- **F13.** The cross-jurisdictional governing-state nomination (E1 F10) MUST extend to all 8 states. When the user selects more than one state in the `Jurisdictional history` field (E1 F2), the calculator MUST require the user to nominate a governing jurisdiction from the selected states before computing. The nominated state's rules MUST run; the citation block MUST note the cross-jurisdictional service is governed by the nominated state's Act.

- **F14.** The system MUST surface, alongside the result of any cross-jurisdictional calculation, a non-blocking advisory: *"This employee has worked in multiple jurisdictions. The `sufficiently connected` test (PDF p.138) is a legal judgement, not a computed default. Confirm with legal counsel where doubt exists."* The calculator MUST NOT attempt to compute the `sufficiently connected` test itself.

- **F15.** In bulk mode, employees with cross-jurisdictional service MUST surface in the editable preview as rows requiring governing-state nomination before the calculation runs, per the E1 F6c pattern. The bulk batch MUST process all unambiguous-jurisdiction employees and surface the ambiguous ones separately.

#### UI — state selector

- **F16.** The single-mode form MUST include a **state selector** as the first input field, with options `NSW / VIC / QLD / WA / SA / TAS / ACT / NT`. The selected state drives:
  - Which per-state rule set is invoked.
  - The citation block's source-of-truth references (state Act vs NSW LSA).
  - State-specific input field labels where they differ (e.g., for ACT casuals, the form MUST prompt for overtime hours; for NSW it MUST NOT).
  - State-specific validation (e.g., cashing-out hard error for VIC + NT).

- **F17 (RES-4, mixed-state from day one).** The bulk-mode upload MUST accept mixed-state CSVs from v1 (from the moment VIC ships onward — i.e., a CSV containing rows for NSW + VIC). Per-row state nomination is **mandatory**:
  - The CSV MUST contain a `state` column (case-insensitive header match: `state`, `State`, `STATE`, `jurisdiction`, `Jurisdiction`).
  - Every row MUST have a non-empty `state` value drawn from the set of currently-encoded states (e.g., `NSW`, `VIC` after VIC ships; `NSW`, `VIC`, `QLD` after QLD ships; and so on per the RES-1 sequence).
  - The bulk normaliser MUST validate that the `state` column is present and that every row has a non-empty value in the set of encoded states before the calculation batch starts. Missing column, empty cell, or unrecognised state value MUST surface in the editable preview as a row-level validation error (per the E1 F6c pattern) and block calculation for that row only — other rows in the batch continue to process.
  - There is **no fallback to a "primary state" set at upload time** and no single-state-only bulk mode — mixed-state is the only bulk mode, and the row-level `state` value is the sole driver of which per-state rule set runs for that employee.
  - PDFs uploaded in bulk mode MUST have the state nominated at upload time (form input alongside the PDF) or inferred per-employee where the PDF clearly identifies the jurisdiction (e.g., a header naming the state). If neither path resolves a state, the row surfaces as ambiguous in the editable preview.

- **F18.** The state selector MUST persist in browser-local state so repeat single-mode calculations default to the user's most-recently-used state.

#### Cross-state regression suite

- **F19.** The CI test pipeline MUST run **every state's gold-standard suite on every change** to any file under `website/src/lib/lsl/`. A failing case in any state's suite blocks merge to `main` and blocks deployment.

- **F20.** When a shared engine file (under `website/src/lib/lsl/engine/` or `website/src/lib/lsl/citations/`) changes, the CI test pipeline MUST report which states' suites were affected — passed, failed, or unchanged — in the PR comment.

### Functional — SHOULD

- **F21.** Each state's documentation page (linked from a "Why this number?" UI affordance, see E1 F24) SHOULD include a plain-English summary of the key divergences from NSW, suitable for a payroll manager transitioning context between states.

- **F22.** The state selector SHOULD remember the last 3 states used and present them as quick-pick chips above the full selector, for users handling repeat multi-state calculations.

- **F23.** The bulk-mode export PDF SHOULD include a state-coverage summary header listing how many employees fell under each state's calculation, with subtotals.

### Functional — MAY

- **F24.** The system MAY support a "comparison mode" where the same employee's facts are run against two or more states (e.g., to model a transfer scenario). Output is two-or-more parallel result blocks. Out of v1 scope unless customer demand surfaces during E3 audit replay.

> **Removed at v0.3.0 under RES-5.** F25 (an advisory `sufficiently connected` heuristic for cross-jurisdictional service) was a MAY in v0.1.0 / v0.2.0. It is **out of v1 scope** and deferred to v2 — see § Clarification Summary RES-5 and § Deferred to v2. F13 (manual user-nomination of governing state) remains the sole cross-jurisdictional resolution mechanism in v1; F14 (legal-judgement caveat) is the only advisory text surfaced.

### Performance

- **P1.** Single-mode calculation latency (P95) MUST remain ≤ 2 seconds across all 8 states. State selection MUST NOT add observable latency.

- **P2.** Bulk-mode calculation latency (P95) MUST remain ≤ 60 seconds for 500 employees across mixed states. State selector branching MUST NOT compound multiplicatively.

- **P3.** CI test pipeline (F19) running all 8 state suites + the engine suite MUST complete in under 5 minutes on the project's standard CI runner. (If this is breached, parallelisation per state is permitted.)

### Security

- **S1.** All E1 security constraints apply unchanged. State selection MUST NOT bypass S1 (no server-side PII persistence in v1), S2 (HTTPS), S3 (no third-party analytics on calculator pages), S4 (LLM data-handling policy), or S5 (LLM request minimisation).

- **S2.** The state-specific hard errors (F5 VIC, F6 NT) MUST be displayed without logging the user's input data to any telemetry endpoint — the existence of the attempt is logged at the page-event level (page = `vic_cashout_hard_error`); the inputs are not.

### Accessibility

- **A1.** The state selector MUST meet WCAG 2.2 Level AA: keyboard-accessible, screen-reader-labelled, focus-visible, with a visible-text option list (not icon-only).

- **A2.** State-specific input fields (e.g., the ACT-only overtime-hours field) MUST appear and announce themselves to the screen reader when the state selector changes, without requiring a page reload.

- **A3.** The cross-jurisdictional governing-state nomination dialog MUST meet WCAG 2.2 AA, including focus trap, escape-to-cancel, and screen-reader-announced state-of-current-selection.

## Success Criteria

- **SC1.** Every state's gold-standard suite passes independently at 100% in CI before that state is marked done within E2 (RES-2 per-state gate). A single failing case in any one state's suite blocks that state from being marked done and blocks deployment of that state's rules to production. E2 itself is marked done only when all seven new states (VIC, QLD, WA, SA, TAS, ACT, NT) have each passed their per-state gate.

- **SC2.** A payroll manager in a multi-state employer can compute LSL for any employee in any of the 8 states by selecting the state and completing the same form they use for NSW today, in ≤ 30 seconds per employee (single mode, post wage-history confirmation).

- **SC3.** The APA worked examples for VIC, QLD, WA, SA, TAS, ACT, and NT in the LSL-training PDF all return exact-match values through the calculator. Specifically, the cross-state edge cases identified in `docs/features/LSL-training.pdf` (see per-state page ranges in §Context) are all in the gold-standard suite and pass at 100%.

- **SC4.** The bulk-mode results table accepts a mixed-state CSV (≥ 5 distinct states, ≥ 50 employees) and returns one row per employee with the correct per-state citation block, in under 60 seconds.

- **SC5.** An attempt to cash out an LSL entitlement in VIC or NT surfaces a hard error citing the relevant Act section, and no numeric result is produced. The error is logged at the page-event level but no input data is persisted.

- **SC6.** A WA employee whose service straddles 20 June 2022 produces a citation block showing both the pre-2022 and post-2022 regime contributions to the entitlement, with explicit reference to the LSL Act 1958 (WA) sections that drove each.

- **SC7.** An ACT casual employee whose ordinary pay includes overtime returns a value-of-week computation that includes the overtime hours, with the citation block explicitly noting the divergence from NSW behaviour.

- **SC8.** Every state's documentation page is linked from the "Why this number?" affordance on the result panel, with the linked content current as of the deployment date.

- **SC9.** A WCAG 2.2 AA automated scan + manual keyboard run-through passes zero violations on the state-selector flow, the state-specific input fields, and the cross-jurisdictional nomination dialog.

## Design / Approach (Outline)

### High-level strategy

- **Same architecture as E1.** State-agnostic engine + per-state rule sets under `website/src/lib/lsl/states/{state}/`. E2 adds seven sibling directories. Engine unchanged.

- **One state at a time, in priority order.** State priority (operator-confirmed 2026-05-23, RES-1): **VIC → QLD → WA → SA → ACT → TAS → NT** — population-weighted, VIC first on divergence-risk (cashing-out criminalisation + dual regime). This sequence is committed; later re-ordering requires a new clarification round.

- **One bundled epic, per-state test gate (RES-2).** E2 is a single epic on the roadmap. Each of the seven states ships incrementally inside that epic, gated by its own gold-standard suite at 100% and PM-signed. A state is not "done" within E2 until its suite passes; E2 is not "done" until all seven states have passed. Sub-state branching strategy (whether each state lands on its own feature branch under `002-all-state-coverage` or as commits on the epic branch) is an engineering decision — see dev-findings.

- **No UI rewrite.** The existing E1 UI gains a state selector (F16) and state-specific field conditionals (F2 — e.g., ACT overtime-hours). No new pages.

- **Bulk mode mixed-state from day one (RES-4 committed).** F17 mandates a per-row `state` column in CSV from v1. The CSV normaliser built in E1 (commit `d446026`) already accepts arbitrary CSV shapes; extending it to (a) detect the `state` column under common header variants, (b) validate every row carries a non-empty recognised state value, and (c) surface row-level validation errors in the editable preview is a normaliser extension, not a rewrite. There is no single-state-only bulk mode — mixed-state is the only bulk mode shipped.

### Key decisions (proposed; subject to clarification)

- **TypeScript per-state modules, not a JSON DSL.** Same reason as E1: rules have conditional logic awkward to express as data. Each state's rule set is a sibling TypeScript module with its own tests.

- **Per-state PM sign-off gate.** The launch gate (100% gold-standard suite) is enforced per-state. PM signs the test-cases.md for each state before that state's encoding starts.

- **Dual-regime states (VIC, WA) encoded as two rule sets per state, selected by date.** VIC pre-Nov-2018 and post-Nov-2018 are two `RuleSet` objects; the engine picks based on the employee's service window. WA pre/post-20-June-2022 the same. This is cleaner than `if (date < X) { ... }` branching inside one rule set.

- **State selector defaults to last-used state from browser-local state.** Same persistence model as E1 F20 / F22.

- **Cross-jurisdictional service stays a user-nomination workflow (RES-5 committed).** F13 (manual nomination) is MUST in v1; F14 (legal-judgement caveat) is the only advisory text shown. The calculator does not attempt to resolve the legal `sufficiently connected` test. The previously-MAY advisory heuristic (F25) is removed from v1 scope and deferred to v2 — see § Clarification Summary RES-5 and § Deferred to v2.

### Integration points

- **E1 (NSW Calculator)**: E2 reuses the engine, the citation block, the pay-pattern classifier shell, the input form, the bulk results table. Any change to the engine for E1 (Phase 3+ PDF extraction, Phase 7 logins) must be reviewed for E2 impact via the cross-state regression suite (F19).

- **E3 (Audit Upload and Variance Report)**: E3 v1 audits NSW only. As each state in E2 completes, E3's coverage extends automatically — the audit replay invokes the same per-state rule set the calculator does. *This is the principal reason E3 cross-state work is gated on E2 progress, not engine progress.*

- **E4 (Payroll Integrations)**: E4 depends on E2 having ≥ 2–3 states encoded before connector design begins, per `epics.md` § E4. E2's state-selector contract becomes E4's per-vendor field-mapping target.

### Data flow (state-aware, single mode)

```
[ State selector ]
        ↓
[ Form inputs (state-specific fields appear/hide) ]
        ↓
[ Pay-cycle normaliser ] → weekly_gross per period
        ↓
[ Per-state pay-pattern classifier ] → state-specific category set
        ↓
[ Per-state rules engine ] (sibling module under website/src/lib/lsl/states/{state}/)
        ├── compute continuous service (state Act § X)
        ├── compute entitlement weeks (state-specific accrual table)
        ├── compute value-of-week (state-specific formula)
        └── apply trigger logic
        ↓
[ Result + citations (state-specific) ]
        ↓
[ Result panel  |  PDF export ]
```

### Data flow (state-aware, bulk mode)

```
[ Bulk CSV/PDF upload (with optional per-row state column) ]
        ↓
[ CSV normaliser / LLM extractor ] → employee list (state per employee)
        ↓
[ Editable preview table (state shown per row) ]
        ↓
[ For each employee → per-state rules engine ]
        ↓
[ Aggregate results table (state shown per row, mixed-state support) ]
        ↓
[ Citation block per row (state-specific)  |  CSV export  |  PDF export ]
```

## Acceptance Criteria

### Per-state encoding

- **AC1.** Each of VIC, QLD, WA, SA, TAS, ACT, NT has a rule set at `website/src/lib/lsl/states/{state}/` exposing the same interface as the NSW rule set.

- **AC2.** Each state's `__tests__/` directory contains a gold-standard suite covering: every APA-PDF worked example for that state, at least 5 state-unique edge cases, at least 1 bulk-mode multi-employee fixture.

- **AC3.** Each state's gold-standard suite passes 100% in CI. A single failing case in any state blocks deployment.

- **AC4 (RES-6 PM-only sign-off).** Each state has a **PM-signed** `test-cases.md` artifact (per the NSW pattern) before development of that state began. Sign-off is **PM only** — there is no APA-engaged specialist co-signer requirement. The signature line in `test-cases.md` reads `Signed: Tracy (PM) — YYYY-MM-DD` and that is the sole human signature required.

- **AC4a (RES-1 priority order).** States are encoded in the operator-confirmed sequence **VIC → QLD → WA → SA → ACT → TAS → NT**. A state may not enter development until the immediately-prior state in the sequence is at 100% gold-standard pass + PM-signed test-cases.md + deployed. Out-of-sequence development requires explicit operator override recorded against the standup or epic-status.md.

- **AC4b (RES-2 per-state test gate + RES-6 sign-off authority).** Each state's gold-standard suite is the **per-state launch gate**, satisfied by **exactly two components and no others**: **(1) PM signoff on `test-cases.md` for that state**, and **(2) the automated test suite (engine suite + that state's gold-standard suite) passing 100% green in CI on the merge commit being deployed**. No human-in-the-loop step beyond PM is required — no APA specialist review, no second-signer pair. That state's rules MUST NOT be deployed to production until both components are satisfied. The aggregate E2 epic is marked done in `epic-status.md` only when all seven new states have independently met this gate. Partial completion (e.g., VIC + QLD live, WA in flight) is reported as E2 being in flight at the appropriate percentage — never as E2 done.

### State-specific hard rules

- **AC5.** Attempting a cashing-out scenario with `state = VIC` returns a hard error citing LSL Act 2018 (Vic) s.67. No numeric result is produced. Page event `vic_cashout_hard_error` is logged with no input PII.

- **AC6.** Attempting a cashing-out scenario with `state = NT` returns a hard error citing LSL Act 1981 (NT) s.12. No numeric result is produced.

- **AC7.** A WA employee whose continuous service spans 20 June 2022 with sufficient wage-history granularity returns a result with citation references to both pre-2022 and post-2022 LSL Act 1958 (WA) regime sections.

- **AC8.** A WA employee whose continuous service spans 20 June 2022 with insufficient wage-history granularity surfaces an ambiguity warning offering (a) supply finer data, or (b) accept single-regime fallback with caveat in citation.

- **AC9.** A WA employee with a Workers Comp absence before 1 July 2024 has those absence days excluded from continuous service; days from 1 July 2024 onward are included.

- **AC10.** A VIC employee whose continuous service spans 1 November 2018 with sufficient data returns a result with citation references to both pre- and post-Nov-2018 LSL Act 2018 (Vic) regime sections.

- **AC11.** An ACT casual employee with overtime hours returns a value-of-week computation that includes overtime in the ordinary-pay base, with a citation explicitly noting the divergence from NSW.

- **AC12.** An SA or NT employee at exactly 10 years of continuous service returns first-entitlement = 13 weeks (not 8.6667).

- **AC13.** An SA employee whose LSL period includes a public holiday returns total leave duration *inclusive* of the public holiday (does NOT extend the leave by the PH).

### Cross-jurisdictional

- **AC14.** Selecting two or more states in the `Jurisdictional history` field surfaces the governing-state nomination dialog before any calculation runs.

- **AC15.** The cross-jurisdictional advisory text (F14) is shown alongside every result of a calculation where the employee's jurisdictional history includes more than one state.

- **AC16 (RES-4, mixed-state from day one).** Mixed-state bulk CSV is supported from v1 onward:
  - From the moment VIC ships, a CSV containing NSW + VIC employees processes successfully end-to-end with one citation block per employee referencing the correct state Act.
  - A CSV missing the `state` column entirely returns a batch-level validation error before any row is calculated.
  - A CSV with the `state` column present but with one or more rows holding an empty or unrecognised state value surfaces those specific rows in the editable preview as row-level validation errors; valid rows in the same batch continue to process to completion.
  - Once all seven new states are encoded, a CSV containing employees across ≥ 5 states processes to completion with one citation block per employee referencing the correct state Act, in under 60 seconds for 50 employees (P2).

### UI

- **AC17.** The state selector appears as the first input field on the single-mode form and is keyboard-accessible per WCAG 2.2 AA.

- **AC18.** Changing the state selector causes state-specific input fields (e.g., ACT overtime-hours, VIC pre/post-Nov-2018 regime indicator if needed) to appear or hide without a page reload, with screen-reader announcement.

- **AC19.** The state selector persists the user's last selection in browser-local state across sessions.

- **AC20.** The citation block on the result panel dynamically references the active state's Act (text, section numbers, PDF pages).

### Cross-state regression

- **AC21.** CI runs every state's suite on every change to `website/src/lib/lsl/`. A failure in any state's suite blocks the PR merge.

- **AC22.** Engine-file changes (under `website/src/lib/lsl/engine/` or `website/src/lib/lsl/citations/`) produce a PR comment listing which state suites passed, failed, or were unchanged.

- **AC23.** Total CI runtime for all 8 state suites + engine suite is under 5 minutes on the standard CI runner.

## Open Questions

**None at v0.3.0.** All six v0.1.0 open questions are resolved — see § Clarification Summary (RES-1 through RES-6). The spec is ready to enter `dev-feature-plan` (speckit-plan → speckit-tasks).

Dev-layer items remain routed via `pm-analyze-split` into `.specify/features/002-all-state-coverage/dev-findings.md`. These are not blockers on the PM spec — they are engineering decisions for the developer to resolve during Phase 0 of `dev-feature-plan`:
- WA dual-regime data-structure design (single rule set with date branching vs. two rule sets selected by date)
- Engine-vs-rule-set boundary contract (what stays in the shared engine, what moves to per-state)
- Test-suite parallelisation strategy for CI runtime (F19 / AC23 / P3)
- Per-state telemetry event taxonomy (page events for state-specific hard errors etc.)
- Bulk CSV per-row state-column schema and the LLM extraction prompt update to detect state from PDFs (now firmed up by RES-4 — header detection variants, row-level validation, no fallback to upload-time primary state)

## Glossary

Most terms inherit from E1 (see `.specify/features/001-nsw-calculator/spec.md` § Glossary). E2-specific additions:

- **Per-state rule set** — a TypeScript module under `website/src/lib/lsl/states/{state}/` implementing the engine-facing interface (classifier, qualifying period, entitlement table, continuous-service rule, pro-rata rule, value-of-week formula, citation emitter) for one Australian jurisdiction.
- **Cross-state regression suite** — the CI step that runs every state's gold-standard suite on every change to engine or rule-set code.
- **Dual-regime state** — a jurisdiction whose Act has been amended with effect from a specific date such that employees whose service straddles that date are subject to different rules across different segments of their tenure. v1: VIC (Nov 2018), WA (June 2022).
- **Governing jurisdiction** — the state whose LSL Act governs a multi-state employee's calculation, nominated by the user per E1 F10 / E2 F13. The `sufficiently connected` test (PDF p.138) is legal judgement; the calculator surfaces ambiguity, the user (or their counsel) resolves it.
- **State-specific hard error** — a calculator response that refuses to produce a numeric result because the requested operation is legally prohibited in the active state (VIC F5 cashing out, NT F6 cashing out).
