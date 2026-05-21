# Spec: NSW Long Service Leave Calculator (E1)

**Version**: 0.3.0
**Status**: Draft — clarified + analyzed, pending PM sign-off on residual policy items
**Date**: 2026-05-21
**Owner**: Tracy (PM)
**Source**:
- `docs/product/epics.md` § E1
- `docs/product/product.md`
- `context/source-material/lsl-legislation/research-brief-2026-05-21.md`
- `docs/features/LSL-training.pdf` (APA LSL Masterclass, January 2026)
- Long Service Leave Act 1955 (NSW)

---

## Clarification Summary (v0.3.0)

**Date**: 2026-05-21
**Source**: speckit-analyze findings + PM defaults (Tracy directed PM to make calls on resolvable items).

**Changes applied without PM input** (PM may override):
- **A01 (HIGH→resolved)**: Added explicit input fields needed to detect the unsupported edge cases F13 blocks on (salary sacrifice flag, retrospective pay rise flag, modern-award transition date). Without these, F13 was not implementable. (Affects F1, F3, AC19.)
- **A02 (HIGH→resolved)**: Added an input field "states in which the employee has worked during continuous service" so F14 cross-jurisdictional detection is implementable. The form blocks until the user nominates the governing state when more than one state is selected. (Affects F1, F14, AC20.)
- **A04**: Specified rounding strategy — all intermediate computation uses unrounded decimal arithmetic; rounding to $0.01 AUD (half-up at 0.005) occurs only at display. (Affects F10, new F22.)
- **A05**: Specified continuous-service event input structure — a list with rows of `{event type (enum), start date, end date, optional note}`. Event-type enum defined. (Affects F3.)
- **A06**: Defined annualised base for the high-income threshold test as `current_weekly_base × 52`, evaluated on the prescribed date applicable to the active trigger. (Affects F7.)
- **A07**: Added PDF constraints — max 20 pages, max 20 MB, PDF format only (no .doc, .docx, image formats) in v1. (Affects F1a, P2.)
- **A08**: Added LLM-service unavailability fallback — when the extraction service is down, rate-limited, or returns an error, the system shows a clear in-page message and routes the user to CSV/form mode. (New F1d.)
- **A09**: Clarified extraction confidence threshold ownership — calibrated by dev during build; the user-facing "we couldn't extract this" message wording is PM-signed-off. (Affects F1c, OQ12.)
- **A10**: Specified browser support — latest two stable versions of Chrome, Safari, Edge, Firefox. (New constraint.)
- **A11**: v1 SHOULD be responsive (usable on mobile); desktop is the optimal experience. (New F23.)
- **A13**: Tightened SC1 — clock starts when wage history is confirmed (CSV imported, or PDF preview accepted), not when the user lands on the page. (Affects SC1.)
- **A14**: Clarified that "prescribed date" application differs by trigger — leave start date for "taking leave"; termination date for "termination". (Affects F7, Glossary.)
- **A15**: Specified AUD half-up rounding at 0.005, two decimal places at display. (Affects F10.)
- **A03**: Added a note that the enumeration of gold-standard test cases is produced as a separate artifact `.specify/features/001-nsw-calculator/test-cases.md` before development starts, signed off by PM. (Affects SC2.)

**Defaulted by PM (revisit before E1 ships)**:
- **OQ9** — High-income threshold verification: PM (Tracy) verifies the threshold value against NSW IR guidance at financial-year-end (June each year) and before any E1 release that crosses 1 July. Documented in a tiny `docs/operations/threshold-review.md` once E1 is closer to launch.
- **OQ11** — LLM vendor: default = **Anthropic API (Claude)** with no-retention enterprise tier, requests routed to whichever Anthropic region best meets Australian Privacy Principles. PM signs off the vendor + the policy doc before E1 ships.
- **OQ13** — Per-calculation cost ceiling: **no per-calc budget cap in v1**; cost-per-call instrumented in telemetry for v2 review. If cost-per-call exceeds $0.50 in production observation, escalate to PM.

**Open for PM** (the only items truly needing your call):

- **PM-1** — Mobile support scope: v0.3.0 defaults to "responsive but desktop-optimised" as a SHOULD. Confirm or reject. If rejected, mobile becomes a non-goal explicitly stated in `product.md` §7.
- **PM-2** — LLM vendor confirmation: default is Anthropic Claude API with no-retention tier (per OQ11 above). Confirm, override (e.g., OpenAI, Google, on-prem), or defer to a written data-handling policy before E1 ships.

Everything else listed in this clarification block has been applied to the spec body below.

---

## Clarification Summary (v0.2.0)

**Date**: 2026-05-21
**Clarifications resolved**:
- **OQ1 — wage-history entry UX**: accept **CSV import** or **PDF of payroll report**, with transaction totals at **weekly, fortnightly, or monthly** frequency. The system normalises to a weekly average before running the rules engine. (Affects F1; adds F1a, F1b.)
- **OQ2 — pay-pattern category ambiguity**: when the classifier is unsure, **ask the user to confirm** the category with a "here's why we asked" tooltip; never default silently. (Affects F5.)
- **OQ3 — multiple employees per session**: **no — one employee per session** in v1. Multi-employee workflow belongs to E3 (audit upload). (Removes F19's auth-driven save-named-calc scope.)
- **OQ4 — split leave in v1**: **deferred to a follow-up**. v1 supports a single LSL period only. NSW LSA s.4(3) split-period support is a v2 addition. (Tightens F12 and AC6/AC7.)
- **OQ5 — unsupported edge-case UX**: **block the calculation** and surface the unsupported scenario to the user with a clear explanation of why. Strict gate; protects the 100% accuracy bar. (Tightens F13, F14.)
- **OQ6 — APA Health Check checklist**: **not in E1**. Stay narrow.
- **OQ8 — gold-standard test suite sign-off**: **PM (Tracy) signs off the v1 suite** as authoritative; an APA-tech sign-off pass is added as a v2 follow-up.

**Open questions remaining (carried into analyze)**:
- **OQ7** — concurrent user load + infra footprint (technical; routes to dev layer)
- **OQ9** — verification process for the $183,100 high-income threshold value before launch
- **NEW OQ10** — PDF extraction approach: vendor-specific templates vs. LLM-based vision/text extraction. *Resolved by PM 2026-05-21: LLM-based extraction (vendor-agnostic) with a mandatory editable-preview step before the rules engine runs. Vendor templates can be added incrementally as a perf/accuracy optimisation without changing the architecture.*
- **NEW OQ11** — privacy/data-residency of the LLM extraction pipeline: where does the LLM run, what data does it see, what is logged, how does it square with Australian Privacy Principles? (Routes to dev layer for technical design; PM layer for policy decision on which LLM vendor is acceptable.)
- **NEW OQ12** — extraction-confidence threshold: at what confidence level does the system refuse to display extracted values and require manual entry instead?
- **NEW OQ13** — per-calculation cost ceiling: PDF extraction via an LLM has a real cost. Is there a per-calc budget?

---

## Executive Summary

Build a single-employee, single-state long-service-leave calculator that returns the correct value of LSL for a New South Wales employee, with every output traceable back to the section of the NSW *Long Service Leave Act 1955* that produced it. The calculator is the first end-to-end slice of the LSL Calculator product (epic E1) and is the architectural template for the seven additional state engines in E2. The primary user is an Australian payroll manager handling an NSW LSL event; the primary business value is replacing manual calculations that — per APA's own training — produce errors of 3–34% when payroll-system formulas (`hours × rate`) are used in place of the legislated method.

## Context & Problem Statement

### Current state

A payroll manager calculating LSL for an NSW employee today opens a spreadsheet, the NSW *Long Service Leave Act 1955*, and the employee's payroll history. She manually:

1. Determines which of three NSW pay-pattern categories the employee falls into (fixed-rate-fixed-hours, fixed-rate-varied-hours, varied-rate);
2. Computes both a 12-month and a 5-year average weekly remuneration;
3. Compares those against the current weekly rate and selects the "greater of" per the relevant formula in s.4(5);
4. Decides whether each pay component (bonus, allowance, commission, overtime, penalty rate) is included per s.3(2), including the $183,100 high-income threshold test for bonuses;
5. Determines continuous service per s.4(11), accounting for paid leave, Workers Comp, transmission-of-business, and any service-breaking events;
6. Reads off the entitlement table (10 years → 8.6667 weeks; +4.3333 weeks per additional 5 years) or applies pro-rata-on-termination rules per s.4(2)(iii);
7. Writes a number on the payslip.

She does this once a fortnight, sometimes more, and has no automated way to defend the result if challenged.

### Problem

Mainstream payroll systems (Xero, MYOB, KeyPay, ADP) do not auto-calculate LSL because the legislated method does not compress into a single formula. Where vendors expose any LSL value at all, they compute `hours_worked × current_hourly_rate`, which silently disagrees with the legislated `greater of (current rate, 12-month average, 5-year average)` test. APA's own training material quantifies the error: in one worked example, a 10-year NSW casual is **overpaid by $179.99** (3.4% over) when calculated by the system formula; the same employee transitioning to full-time in years 11–12 is **underpaid by $3,316.64** (33.6% under the correct $9,880.04) (LSL-training.pdf pp.139–141).

The result is that LSL is a chronic payroll-data-quality risk for every Australian employer — APA's Health Check (PDF p.137) frames it as a quarterly review item, not a one-off compliance task — and there is no available tool that produces a defensible, citation-backed LSL value for a payroll manager to use.

### Constraints

- **Legal**: every output must be derivable from a specific section of the NSW LSA 1955. The calculator does not give legal advice; it computes the legislated value.
- **Distribution**: the calculator must be reachable from the Australian Payroll Association member portal. Working default is **standalone + deep-link** (a separate Next.js app at its own URL, linked from the APA portal). SSO with APA member auth is a possible upgrade if friction warrants.
- **Quality gate**: per `docs/product/product.md` §12 — **100% of calculations must match the relevant section of legislation**. A single failing case in the gold-standard test suite blocks deployment.
- **Tech stack** (per `CLAUDE.md`): Next.js + Tailwind + shadcn for the web app; Supabase for any persistent state; Vercel auto-deploy on push to `main`.
- **Currency**: AUD; round to the nearest cent ($0.01) for display.

### Dependencies

- The NSW LSA 1955 text (publicly available at `legislation.nsw.gov.au`) is the source of truth.
- The APA LSL Masterclass PDF supplies worked examples used as canonical test cases.
- The $183,100 high-income threshold for bonus inclusion is a policy figure that requires a verification process before E1 ships (flagged in `research-brief-2026-05-21.md` cross-check flags).

## Requirements

### Functional — MUST

- **F1.** The system MUST accept the following inputs for a single NSW employee:
  - **Identity (optional, display-only)**: full legal name, date of birth
  - **Employment**: start date, end date (required when trigger = termination), employment type (full-time / part-time / casual), pay-pattern category (auto-classified per F5, user-confirmed when ambiguous)
  - **Current rate**: current weekly base rate (used as the input to `current_weekly_base × 52` annualised-base test in F7), current ordinary hours per week (where applicable)
  - **Wage history**: via the modes in F1a
  - **Continuous-service events**: per F3
  - **Jurisdictional history**: `states in which the employee has worked during continuous service` — multi-select over `{NSW, VIC, QLD, WA, SA, TAS, ACT, NT}`. Selecting more than one state triggers F14 blocking until the user nominates the governing jurisdiction.
  - **v1-unsupported edge-case flags** (used by F13 detection):
    - `salary_sacrifice_in_lookback_window` (yes/no): does the employee have any salary-sacrifice / packaged-remuneration arrangement during the relevant lookback window?
    - `retrospective_pay_rise_applied` (yes/no): has any back-paid wage adjustment been applied to past periods within the lookback window?
    - `modern_award_transition_date` (optional date): for employees with start dates before 1 January 2010, the date their employment transitioned to a modern award. If start date is before 1 January 2010 AND this field is empty, F13 blocks per AC19.
- **F1a.** Wage history MUST be accepted via one of two input modes:
  - **CSV import**: structured columns covering pay-period dates, gross pay, and pay-component breakdown
  - **PDF import**: a payroll report PDF (vendor-agnostic), extracted via an LLM-based vision/text pipeline, with a **mandatory editable preview step** that surfaces extracted values to the user for confirmation before any rules-engine work runs

  Either mode MUST support transaction totals at **weekly, fortnightly, or monthly** pay frequencies. The user MUST nominate the pay frequency, or the system MUST infer it from input date gaps and present the inferred value for user confirmation before running.

- **F1b.** The system MUST normalise pay-period totals to a weekly average before running the rules engine. Conversion rules:
  - **Weekly**: weekly_gross = period_total
  - **Fortnightly**: weekly_gross = period_total / 2
  - **Monthly**: weekly_gross = period_total × 12 / 52 (average of 4.333 weeks per period)
  - **Other / 4-weekly**: the user MUST nominate the period length in days; weekly_gross = period_total × 7 / period_days
  - Where pay periods overlap with continuous-service exclusions (e.g. unpaid leave, JobKeeper days, COVID stand-down per research brief §1.2), the excluded days MUST be removed from the denominator before averaging.
  - Where the wage history contains mixed pay frequencies (e.g., monthly for years 1–3, fortnightly for years 4–5), the system MUST normalise per segment and surface a "mixed-frequency" warning.

- **F1c.** The PDF extraction pipeline MUST:
  - Run vendor-agnostic LLM-based extraction
  - Display extracted values in an editable preview before any calculation runs
  - Refuse to display extracted values when extraction confidence falls below an internal threshold. The threshold value is calibrated by the dev team during build; **the user-facing "we couldn't extract this" message is PM-signed-off** before E1 ships.
  - Tag the calculation's audit metadata with `input source: PDF (extracted, user-confirmed)`
  - Not transmit extracted employee data to any third-party logging/analytics endpoint (see S1, S3)
  - Reject PDFs above 20 pages or 20 MB with a clear in-page message asking the user to slice the file or switch to CSV. PDFs are the only supported PDF-mode format; `.doc`/`.docx`/image formats are not accepted in v1.

- **F1d.** When the LLM extraction service is unavailable (down, rate-limited, network error), the system MUST:
  - Display a clear in-page message naming the failure mode
  - Route the user to the CSV/form path without losing any inputs already entered
  - Not silently retry indefinitely; one automatic retry only, then surface the failure

- **F2.** The system MUST accept pay-component breakdowns (base, casual loading, skill/qualification allowances, board-and-lodging allowance, commission, piece work rate, bonus / incentive / performance pay, overtime, penalty rates, expense allowances) per pay period — applied to whichever mode (CSV or PDF-preview) the wage history was entered via.
- **F3.** The system MUST accept a list of continuous-service events as a structured list. Each row has fields `{event_type, start_date, end_date, optional_note}`. The `event_type` enum is:
  - `paid_leave` — paid annual leave, paid LSL taken, paid sick/personal leave, paid parental leave, Christmas closedown paid leave
  - `workers_comp_absence`
  - `unpaid_parental_leave`
  - `leave_without_pay`
  - `industrial_action`
  - `employer_stand_down` (slackness)
  - `transfer_of_business` — start_date is the transfer effective date; end_date may be omitted
  - `employer_initiated_termination_and_rehire` — start_date is the termination date; end_date is the re-hire date
  - `apprentice_to_tradesperson_transition` — start_date is the trade transition date; end_date may be omitted
  - `jobkeeper_or_covid_standdown` (no-pay period that counts as service for casuals per research brief §1.4)
- **F4.** The system MUST accept a trigger selector: **"taking leave"** (with leave start date) or **"termination"** (with termination date and reason — voluntary resignation, employer-initiated dismissal not for serious misconduct, redundancy, illness/incapacity, domestic or pressing necessity, death, retirement).
- **F5.** The system MUST classify the employee into exactly one of three NSW pay-pattern categories per s.4(5):
  - **Category A**: fixed rate, fixed hours (full-time, stable part-time)
  - **Category B**: fixed rate, varied hours (casuals, part-time doing extra ordinary hours)
  - **Category C**: varied rate (piece work, commission, results-based, retainer + commission, bonus on prescribed date)

  When the classifier's signal is unambiguous, the system MAY proceed silently. When the inputs do not clearly resolve to a single category (per OQ2), the system MUST ask the user to confirm the category, with an explanatory tooltip naming why the inputs were ambiguous. The system MUST NOT default silently on ambiguous inputs.
- **F6.** For each category, the system MUST compute the "value of a week" as the **greater of** the two formulas defined in s.4(5) for that category (see research brief §1.2). The lookback denominator MUST be in days, less "days not counted" per the research brief §1.2.
- **F7.** The system MUST include or exclude each pay component per s.3(2) (see research brief §1.3). Bonuses MUST be included only if the employee's **annualised base remuneration on the prescribed date** is below the $183,100 high-income threshold. Annualised base is defined as `current_weekly_base × 52` from F1. **Prescribed date** is the date applicable to the active trigger: the day before LSL commences for trigger = "taking leave"; the termination date for trigger = "termination". The threshold value MUST be a single-place-to-update constant in the codebase.
- **F8.** The system MUST compute continuous service per s.4(11). Specifically:
  - Paid annual leave, paid LSL, paid sick/personal leave, Workers Comp absence (per Workers Comp Act 1987 s.49), paid parental leave, and Christmas closedown paid leave MUST count as service.
  - Transmission/transfer of business (s.4(6)) MUST preserve prior service.
  - Unpaid parental leave, leave without pay, industrial action, and gaps > 2 months after employer-initiated termination MUST NOT count as service.
  - Employee resignation MUST reset prior service to zero.
- **F9.** The system MUST compute the entitlement (in weeks) using the s.4(2) accrual table: 10 years → 8.6667 weeks; +4.3333 weeks per additional 5 years; pro-rata on termination per s.4(2)(iii) — 5–<10 years for the four limited grounds, 10+ years for any reason.
- **F10.** The system MUST return three numeric outputs: **value of a week**, **value of a day**, and **total entitlement** (weeks and dollars). All intermediate computation MUST use unrounded decimal arithmetic (no per-step rounding). Final display values MUST be rounded to two decimal places (AUD cents) using **half-up rounding at 0.005** (e.g., $9,880.045 → $9,880.05; $9,880.044 → $9,880.04).
- **F11.** The system MUST display a **citation block** alongside every numeric output. Each citation MUST reference: (a) the NSW LSA section that drove the value, (b) the rule name in the rules engine, (c) the page of the LSL-training PDF where applicable.
- **F12.** The system MUST handle the "taking leave" vs. "termination" trigger correctly per s.4(5)–(7): the formula is identical, but on termination the entitlement is paid as a lump sum "forthwith" and public holidays during the leave period do not extend the leave (they would for "taking leave" per s.4(4A)). **v1 supports a single LSL period only** — NSW LSA s.4(3) split-period support is deferred to v2.
- **F13.** The system MUST handle the edge cases listed in the research brief §5 items 1–8 and 10–11. For items 9, 12, and 13 (salary sacrifice, retrospective pay rises, pre-modern award employees), the system MUST **block the calculation** and surface the unsupported scenario with a clear explanation. Detection signals (from F1 inputs):
  - Item 9 → `salary_sacrifice_in_lookback_window = yes`
  - Item 12 → `retrospective_pay_rise_applied = yes`
  - Item 13 → `employment_start_date < 2010-01-01` AND `modern_award_transition_date` is empty
  The system MUST NOT produce a partial or warning-flagged result for these cases.

- **F14.** The system MUST detect cross-jurisdictional service from the `states in which the employee has worked` input (F1). When more than one state is selected, the system MUST **block the calculation** until the user nominates the governing jurisdiction. The calculator does not choose silently. For v1, only `governing_jurisdiction = NSW` runs to completion; selecting another state surfaces a "v1 supports NSW only" message and the user is asked to wait for E2.

### Functional — SHOULD

- **F15.** The system SHOULD provide an input-validation pass before running any calculation: missing or contradictory dates, wage history gaps, employment type vs. pay-pattern mismatches.
- **F16.** The system SHOULD allow the user to download a single-page PDF report of the calculation suitable for attaching to a payslip or audit file.
- **F17.** The system SHOULD persist the most recent calculation in browser-local state so the user can refresh without losing inputs.
- **F18.** The system SHOULD surface a "what the system formula would have given" comparison value alongside the legislated value — to make the variance visible to the payroll manager and reinforce the wedge.

- **F22.** The system MUST run on the latest two stable major versions of Chrome, Safari, Edge, and Firefox at the time of release. Older versions MAY display a "browser unsupported" banner but MUST NOT silently produce incorrect results.
- **F23.** The single-calc form SHOULD be responsive and usable on a mobile-browser viewport down to 360px width. Desktop is the optimal-experience target; mobile is best-effort.

### Functional — MAY

- **F19.** The system MAY support saving named calculations to a user account (deferred to a separate epic; requires auth).
- **F20.** The system MAY include a per-component "why is this in/out?" hover that opens the relevant LSA section text.
- **F21.** The system MAY pre-fill bonus high-income-threshold value from a maintained configuration file rather than hard-coding.

### Performance

- **P1.** Once all inputs are confirmed (post-CSV import, or post-PDF preview confirmation), a single calculation MUST complete in under 2 seconds (95th percentile) on a typical office laptop with a stable internet connection.
- **P2.** PDF extraction (F1c) MUST complete in under 30 seconds (95th percentile) for a payroll report of ≤20 pages. Above 20 pages, the system MAY either chunk the input or refuse with a clear message asking the user to slice the PDF.
- **P3.** CSV import (F1a) MUST complete in under 5 seconds (95th percentile) for a wage history of up to 5 years of weekly periods (≈260 rows).

### Security

- **S1.** No personally-identifiable employee data MUST be persisted server-side in v1 (browser-local only). When server persistence is added (out of scope for E1), Australian Privacy Principles compliance MUST be reviewed.
- **S2.** All transport MUST be HTTPS-only.
- **S3.** No third-party analytics that track inputs (employee names, wages) MUST be loaded on the calculator page.
- **S4.** PDF extraction (F1c) via an LLM MUST be subject to a documented data-handling policy: which LLM vendor is used, where requests are routed, what request/response data is retained or logged by the vendor, and how that policy complies with Australian Privacy Principles. This policy MUST be drafted before E1 ships and surfaced as a PM-layer decision (see OQ11).
- **S5.** The LLM extraction request MUST NOT include any field beyond what is needed to extract pay data (no notes, no comments, no IDs that are not on the payroll report). When the user uploads a multi-section PDF, the system MAY pre-strip identifying sections before sending the remainder to the LLM.

### Accessibility

- **A1.** The calculator MUST meet WCAG 2.2 Level AA on the single-calc UI.
- **A2.** All form inputs MUST be keyboard-navigable and screen-reader-labelled.
- **A3.** Citation blocks MUST be readable by a screen reader in source order alongside the value they cite.

### Integration

- **I1.** The calculator MUST be reachable from the APA member portal via a deep-link. The exact link contract (URL pattern, optional token) is an open decision (see `product.md` §14).
- **I2.** The calculator MUST NOT depend on any APA-portal API in v1.

## Success Criteria

- **SC1.** A payroll manager handling an NSW LSL event can produce a defensible LSL value in **≤30 seconds from confirming the wage history** (CSV imported, or PDF preview accepted) to seeing the result. PDF extraction time (P2) is excluded from this 30s figure and is communicated separately to the user with a progress indicator.
- **SC2.** The calculator passes **100% of cases** in the NSW gold-standard test suite. The suite is enumerated in `.specify/features/001-nsw-calculator/test-cases.md` (a separate artifact, signed off by PM before development starts). It covers, at minimum, every worked example in the LSL-training PDF (NSW section, pp.13–31) plus the 8 edge cases in the research brief §5 items 1–8 and 10–11. **A single failing case blocks deployment.**
- **SC3.** The APA-training worked example of the 12-year casual-to-FT transition (PDF p.141) returns **$9,880.04 ± $0.01** for the total entitlement — not the $6,563.40 a system formula would return.
- **SC4.** Every numeric output on the result screen is accompanied by a citation block naming the LSA section and rule that produced it.
- **SC5.** The single-calc UI passes WCAG 2.2 AA on an automated accessibility scan and a manual keyboard-only run-through.
- **SC6.** The calculator is reachable from a working deep-link inside the APA member portal.

## Design / Approach (Outline)

### High-level strategy

- **Architecture**: standalone Next.js + Tailwind + shadcn app (per `CLAUDE.md`). Single page for the calculator; no auth in v1; no server-side persistence in v1.
- **Rules engine**: pure TypeScript module under `website/src/lib/lsl/`. State-agnostic *engine* (the lookback math, the "greater of" comparison, the citation block) + state-specific *rule sets* (NSW rule set in `website/src/lib/lsl/states/nsw/`). E2 adds sibling directories for VIC, QLD, etc.
- **Citation model**: every rule emits a `Citation { section: string; rule: string; pdfPage?: number }`. The engine accumulates citations per computed value.
- **Pay-pattern classifier**: deterministic function from inputs (employment type + pay-component presence + hours variability) to one of `Category.A | B | C`. User-overridable via UI.
- **Test harness**: gold-standard suite under `website/src/lib/lsl/states/nsw/__tests__/gold-standard.test.ts`, with one test case per worked example + each edge case. Test failure = CI failure = no deploy.
- **UI**: single-page form (inputs sectioned by employee → wage history → continuous-service events → trigger) → submit → result panel with the three numeric outputs + citation blocks + optional "system formula comparison" toggle.
- **PDF export**: server-side route that renders the result panel + citations to PDF (library TBD by developer).

### Key decisions

- **TypeScript pure functions for the rules engine, not a JSON DSL.** Reason: rules require conditional logic (the "greater of" test, the bonus threshold test, the continuous-service event sequencing) that is awkward to express as data and easy to express as typed functions. Trade-off: rule discoverability is lower; mitigated by per-rule citation metadata and an exhaustive test suite.
- **Standalone + deep-link before SSO.** Reason: faster to ship; defers the APA-tech-team integration cost; the user friction of a second login is acceptable for v1.
- **Browser-local state, no server persistence in v1.** Reason: avoids Australian Privacy Principles overhead at v1; the calculation is single-use anyway.

### Integration points

- APA member portal: receives a deep-link; no API contract in v1.
- Future E3 (audit upload): the rules engine module is the integration point; the same engine that powers E1's single-calc powers E3's batch replay.
- Future E2 (other states): rule sets are siblings under `website/src/lib/lsl/states/`; the engine is unchanged.

### Data flow

```
[ Form inputs ]
      ↓
[ Input validator ]
      ↓
[ Pay-pattern classifier ] → Category A | B | C
      ↓
[ NSW rules engine ]
      ├── compute continuous service (s.4(11))
      ├── compute entitlement weeks (s.4(2))
      ├── compute value-of-week (s.4(5), greater-of)
      │     ├── current rate * hours
      │     ├── 12-month average
      │     └── 5-year average
      ├── apply pay-component inclusion (s.3(2))
      └── apply trigger logic (taking-leave vs. termination, s.4(5)-(7))
      ↓
[ Result + citations ]
      ↓
[ UI render | PDF export ]
```

## Acceptance Criteria

- **AC1.** A user can navigate from the APA-portal deep-link to the calculator landing page in one click.
- **AC2.** All inputs in F1–F4 are present in the form.
- **AC3a.** The form accepts wage history via CSV import OR PDF upload. CSV columns are documented inline; PDF upload triggers the editable preview step before any calculation runs.
- **AC3b.** Pay-period totals at weekly, fortnightly, and monthly frequencies all normalise to the same weekly value (within rounding) when fed identical underlying gross-pay data. Test: an employee with $5,200/week over 52 weeks, $10,400/fortnight over 26 fortnights, and $22,533.33/month over 12 months all produce weekly_gross = $5,200.00.
- **AC4.** Submitting the form with a fixed-rate-fixed-hours full-time employee with 12 years of service triggers a Category A calculation and returns three numeric outputs with citation blocks referencing NSW LSA s.4(5)(b), s.3(2), and s.4(2)(b).
- **AC5.** Submitting the APA worked example of the 12-year casual-to-FT employee (PDF p.141 — inputs to be encoded in the gold-standard test suite) returns total entitlement = $9,880.04.
- **AC6.** Submitting an employee with 7 years of service and a "voluntary resignation" termination trigger returns entitlement = $0 with a citation referencing s.4(2)(iii) (no pro-rata for resignation < 10 years).
- **AC7.** Submitting an employee with 7 years of service and a "redundancy" termination trigger returns the pro-rata entitlement with a citation referencing s.4(2)(iii)(a).
- **AC8.** Submitting an employee with bonus pay where annualised base is below $183,100 includes the bonus in the value-of-week; submitting the same inputs with annualised base above the threshold excludes the bonus. Both cases emit citations referencing s.3(2).
- **AC9.** Submitting an employee with a 6-month unpaid parental leave entry mid-tenure correctly excludes those days from both continuous service AND the lookback denominator.
- **AC10.** Submitting an employee with service in NSW and VIC triggers the "sufficiently connected" warning per F14, asking the user to nominate the governing jurisdiction; the calculator does not run until the choice is made.
- **AC11.** Submitting an employee with a Workers Comp absence correctly counts those days as service but excludes them from the average-hours denominator.
- **AC12.** Every value in the result panel has at least one citation block visible to a sighted user and readable by a screen reader.
- **AC13.** The full NSW gold-standard test suite passes at 100% in CI. A single failing case fails the build and blocks deploy.
- **AC14.** The "system formula comparison" toggle (F18) shows the `hours × rate` value alongside the legislated value and the dollar variance.
- **AC15.** The single-page PDF export (F16) contains all citations from the result panel.
- **AC16.** Automated WCAG 2.2 AA scan reports zero violations on the result panel.
- **AC17.** Uploading a payroll PDF triggers the editable preview (F1c). The user can correct each extracted value; the calculation runs only on user-confirmed inputs. The calculation's audit metadata records `input source: PDF (extracted, user-confirmed)`.
- **AC18.** Uploading a PDF whose extraction confidence falls below the threshold refuses to display extracted values and prompts the user to enter the wage history manually via the CSV/form path.
- **AC19.** Inputs that match an OQ5 unsupported edge case (salary sacrifice present, retrospective pay rise in the lookback window, pre-2010 employment start without a recorded modern-award transition) MUST block the calculation with a clear in-page explanation. No "partial" result is shown.
- **AC20.** Inputs that indicate cross-jurisdictional service MUST block the calculation until the user nominates the governing state. The calculator MUST NOT default silently.
- **AC21.** When the LLM extraction service is unavailable, the system surfaces the failure within 10 seconds of the upload, retains any other form inputs, and routes the user to the CSV path.
- **AC22.** An attempt to upload a `.docx` or image file is rejected at the file picker; only PDF is accepted in v1.
- **AC23.** Uploading a PDF exceeding 20 pages or 20 MB is rejected with a clear in-page message.
- **AC24.** Intermediate calculations are unrounded; only display values are rounded. A test confirms that the 12-year casual-to-FT example (PDF p.141) returns exactly $9,880.04 — not $9,880.03 or $9,880.05 — when the engine runs.

## Open Questions

OQ1–OQ6 and OQ8 are resolved — see Clarification Summary at the top.

All OQ items raised in v0.2.0 are now either applied to the spec body or carried forward as named open items:

- **OQ7** — Concurrent user load + infra footprint: *Routes to dev layer.* See `dev-findings.md` D-OQ7.
- **OQ9** — High-income threshold verification: *PM-defaulted in v0.3.0* — verified at financial-year-end (June) and before any release crossing 1 July, owned by PM.
- **OQ10** — PDF extraction approach: *Resolved in v0.2.0* — LLM-based vendor-agnostic with editable preview.
- **OQ11** — LLM vendor + data-handling policy: *PM-defaulted in v0.3.0 to Anthropic Claude no-retention tier*. PM signs off the vendor + policy doc before E1 ships. See PM-2 in Clarification Summary v0.3.0.
- **OQ12** — Extraction-confidence threshold: *PM-defaulted in v0.3.0* — calibrated by dev; user-facing message is PM-signed-off.
- **OQ13** — Per-calc cost ceiling: *PM-defaulted in v0.3.0* — no v1 cap; instrumented for v2 review; $0.50/calc triggers PM escalation.

The only items genuinely awaiting PM sign-off are **PM-1 (mobile scope)** and **PM-2 (LLM vendor confirmation)**, both listed in Clarification Summary v0.3.0.

## Glossary

- **LSL** — Long Service Leave.
- **LSA** — NSW *Long Service Leave Act 1955*.
- **APA** — Australian Payroll Association.
- **Prescribed date** — the day applicable to the active trigger: the day before LSL commences for trigger = "taking leave"; the termination date for trigger = "termination" (LSA s.4(5)).
- **Value of a week** — the legislated weekly LSL rate computed per LSA s.4(5).
- **Continuous service** — service that counts toward LSL accrual per LSA s.4(11).
- **High-income threshold** — the annualised base remuneration figure (currently $183,100) above which bonus is excluded from ordinary pay (LSA s.3(2), reviewed 1 July annually).
- **Pay-pattern category** — one of A (fixed rate, fixed hours), B (fixed rate, varied hours), C (varied rate). Determines which formula applies per LSA s.4(5).
- **Trigger** — the event causing the calculation: "taking leave" or "termination".
- **Citation block** — the explanatory text shown alongside a numeric output, naming the LSA section and the rule that produced it.
- **Gold-standard test suite** — the curated set of (input, expected output, citation) cases the calculator must pass 100% of.
