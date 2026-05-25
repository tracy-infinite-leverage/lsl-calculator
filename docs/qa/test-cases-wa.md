# WA LSL Calculator — Gold-Standard Test Cases

**Status**: SIGNED OFF · Tracy Angwin (PM) · 2026-05-25
**Version**: v1.0
**Date**: 2026-05-25
**Spec**: `.specify/features/002-all-state-coverage/spec.md` v0.3.1
**Impl plan**: `.specify/features/002-all-state-coverage/impl-plan.md` v0.3.2 Phase 5 (WA) — re-scoped per TBD-WA-01 resolution to single rule set with date-aware continuous-service handling
**Tasks**: `.specify/features/002-all-state-coverage/tasks.md` T5.0 ✅ SIGNED OFF; T5.0.5 (WA schema extension via DEV-CROSS-2) added; T5.1 blocked on DEV-CROSS-2
**Source-of-truth Acts**:
- *Long Service Leave Act 1958* (WA) — sections 4, 4A, 5, 6, 7, 8, 9, 10, 11, 26, 26A, 27. Cited as **"WA LSL Act 1958 s.N"**.
- *Industrial Relations Legislation Amendment Act 2021* (WA) — commenced 20 June 2022; the amending instrument that produced today's WA LSL Act 1958 (as in force). Cited as **"IR Legislation Amendment Act 2021 (WA)"** only where the historical change point is relevant.
- *Workers Compensation and Injury Management Act 2023* (WA) — commenced 1 July 2024. Drives the WC-counts-as-service rule from 2024-07-01 onward. Cited as **"WCIM Act 2023 (WA)"**. The specific section that effects the consequential amendment to LSL Act 1958 s.6 is most likely s.709 (the consequential-amendments part of the 2023 Act), but this has not been independently verified against the legislation text during the v1.0 research pass — see TBD-WA-02 resolution and the documented limitation in the Resolutions section.

---

## Resolutions (2026-05-25 — PM Tracy Angwin)

All 16 TBDs are resolved as listed below. The verbatim resolution text is the authority — where individual fixtures elsewhere in this document still carry "TBD" markers in inline prose, treat the Resolutions section here as binding and the inline marker as historical context to be ignored.

### TBD-WA-01 (Sev-1, LOAD-BEARING) — Dual-regime architecture

**RESOLVED: Accept PM's reading. Single rule set with date-aware continuous-service handling.** Mirrors the resolved TBD-VIC-01 VIC re-scope. The accrual formula (s.8) and pro-rata rules (s.8(3)) are unchanged across the 2022-06-20 cutoff — the IR Legislation Amendment Act 2021 changed continuous-employment rules only. Two `continuous-service-rule` modules (pre-2022 + post-2022) feed the same s.8 accrual formula; a third date-aware override at 2024-07-01 for WC absences (via WCIM Act 2023) sits on top of the post-2022 module. Impl-plan v0.3.1 §5 must be re-scoped from "two parallel rule sets" to "one WA rule set with date-aware continuous-service handling" — see impl-plan v0.3.2. Effort estimate L (5–8 d) → M–L (4–6 d).

### TBD-WA-02 (Sev-2) — WCIM Act 2023 (WA) section number for the continuous-employment override

**RESOLVED: Cite as "WCIM Act 2023 (WA)" without sub-section reference in v1.** One targeted research pass (2026-05-25) on legislation.wa.gov.au, AustLII, Lexology, and Ability Group confirmed the WCIM Act 2023 (WA) is the conferring instrument and that the consequential-amendments part is most likely s.709, but the precise section text could not be independently verified within the v1.0 research window (the legislation pages did not load via WebFetch). Engine cites "WCIM Act 2023 (WA)" with rule key `workers-comp-counts-from-2024-07-01`. The exact sub-section may be added in a quarterly legislation review (RES-3) once verified against the consolidated Act text. **Documented limitation** — citation accuracy is to Act level, not section level. Acceptable for launch.

### TBD-WA-03 (Sev-2) — Cashing-out advisory granularity

**RESOLVED: Three distinct codes** (`wa_cashout_post_accrual_advisory`, `wa_cashout_pre_accrual_not_authorised`, `wa_cashout_no_entitlement_to_cash_out` + `sub_7yr_no_entitlement_wa`). Parallel to QLD's resolved TBD-QLD-04 granularity. Stronger user awareness; modest engine complexity.

### TBD-WA-04 (Sev-2) — 15-year accrual continuous + threshold inclusivity

**RESOLVED: Continuous accrual at 1/60 (no discrete step at 15 yrs); thresholds at 7, 10, 15, 20, 25 yrs inclusive at exact-day boundary.** Same as resolved TBD-QLD-01. Engine: `years_of_continuous_service >= 7.0000`, `>= 10.0000`, `>= 15.0000` etc. 13-week figure at 15 yrs = 15 × 8.6667 / 10 = 13.00005 ≈ 13.0.

### TBD-WA-05 (Sev-2) — Workers Comp rate of pay during LSL

**RESOLVED: Apply literal s.9 ordinary rate at leave time.** Same as resolved TBD-QLD-05. WA has NO equivalent of VIC's s.17 higher-of-pre-injury-or-current rule. Engine emits `wa_lsl_calculated_at_wc_reduced_rate_warning` advisory when a `workers_comp_absence` event overlaps the LSL trigger date, suggesting LSL deferral if feasible.

### TBD-WA-06 (Sev-2) — Accrual-period averaging methodology, partial-block handling

**RESOLVED: Average over the partial duration only.** For an employee 12 yrs in, the partial second-block average covers years 10 → 12 only, not extrapolated to 5 yrs. Aligns with DEMIRS "average weekly hours worked by the employee during the accrual period". This is a value-of-week computation rule; no schema extension required.

### TBD-WA-07 (Sev-1) — 10+ yr misconduct partial-forfeiture, interaction with leave already taken

**RESOLVED: Accept PM's reading. Only the LAST FULLY-ACCRUED BLOCK is payable; engine subtracts prior leave taken against that block.** Formula: `payable_weeks = max(0, last_fully_accrued_block_weeks - leave_already_taken_against_that_block)`. Post-milestone accrual is forfeited entirely (the 2.5 yrs × 8.6667/10 = 2.1667 wks in TC-WA-026 stays forfeited). For TC-WA-026, if the employee had previously taken 4 wks of LSL against the first 10-yr block, the engine would pay 4.6667 wks (8.6667 − 4.0000), not 8.6667 wks.

### TBD-WA-08, TBD-WA-12, TBD-WA-13, TBD-WA-14 + slackness-of-trade signal (Sev-2/3 schema extensions) — Deferred to DEV-CROSS-2

**RESOLVED: Bundle as separate WA-schema-extension PR (DEV-CROSS-2).** Same pattern as DEV-CROSS-1 (the termination-reason enum refactor). The state-agnostic `engine/types.ts` extensions (slackness-of-trade signal on `employer_initiated_termination_and_rehire`, WC `paidConcurrent` + `returnToWorkProgram` fields on `workers_comp_absence`, casual UPL `reasonableExpectationOfReturn` on `unpaid_parental_leave`, meals/accommodation cash value on `Employee`) land in a single cross-state schema extension PR before WA engine code (T5.1) begins. See `.specify/features/002-all-state-coverage/dev-findings.md` DEV-CROSS-2 for the full scope. The affected fixtures (TC-WA-029, TC-WA-049, TC-WA-052, TC-WA-060) remain in this document as **active launch-gate fixtures** — they exercise schema fields that DEV-CROSS-2 will introduce, and will pass on the engine gold-standard run once DEV-CROSS-2 has landed and T5.1 onwards is unblocked. The fixtures are listed in the "Deferred to DEV-CROSS-2 (WA schema extension)" appendix below for traceability, but they are not REMOVED from the active suite — they are PENDING the schema extension that DEV-CROSS-2 delivers.

### TBD-WA-09 (Sev-2) — Pre-2022 sickness cap working days vs calendar days

**RESOLVED: Working days, proportionate to the employee's normal pattern.** FT 5-day-week: 15 working days/year. PT 3-day-week: 9 working days/year (proportionate). Casual: based on the regular pattern over the prior 52 weeks. Aligns with the DEMIRS pre-2022 language and is more accurate than a flat calendar-day interpretation. The calendar-day alternative would understate the effect for FT employees and over-state it for low-day-count PT employees.

### TBD-WA-10 (Sev-3) — Pre-2022 casual continuity, applying general rules

**RESOLVED: Apply the general s.6 rules (2-mo non-slackness / 6-mo slackness re-employment tolerances) to any casual gap > 0 days for pre-2022 accrual blocks.** Surface the `wa_pre_2022_casual_no_specific_rules` advisory so the user is informed that the engine's choice may be more restrictive than reality (case law may have rescued some continuity that the engine does not). The user retains the option to dispute via WA Industrial Magistrates Court.

### TBD-WA-11 (Sev-3) — Cutoff inclusivity at exactly 2022-06-20

**RESOLVED: A block that fully accrued ON 2022-06-20 falls under POST-2022 rules** (strict reading of "on or after 20 June 2022"). PM-recommended path. This is opposite to the threshold-inclusivity convention at year-boundaries (TBD-WA-04) because the wording differs: year-boundaries are "completed N years" (inclusive at N.0000 in the qualifying set); the cutoff is "on or after 20 June 2022" (inclusive of the boundary date in the post-2022 set). Fixture TC-WA-042 (block fully accrued 2022-06-20) → first_block_rules = `post_2022`. Fixture TC-WA-043 unchanged.

### TBD-WA-15 (Sev-3) — Pre-first-milestone cash-out, hard-error or advisory

**RESOLVED: Advisory (status: computed + warning).** Parallel to QLD's universal advisory model and the broader WA cash-out advisory granularity (TBD-WA-03). The engine does not police lawfulness; it informs. PM-recommended path accepted.

### TBD-WA-16 (Sev-3) — Death-of-employee, sub-7-yr no carve-out

**RESOLVED: No carve-out. Death at sub-7-yr returns $0** (same as resignation at sub-7-yr). Engine emits the `sub_7yr_no_entitlement_wa` warning. Aligns with VIC and QLD on this point. No WA equivalent of NSW LSA s.4(2)(iii)(d) sub-5-yr death carve-out — DEMIRS guidance is silent on this and the strict reading of s.8(3) is that the 7-yr threshold applies to death as it does to other qualifying reasons.

### Net effect on fixtures

| Resolution | Fixture impact |
|---|---|
| TBD-WA-01 | Re-scope is architectural — fixtures TC-WA-001 → TC-WA-070 unchanged (PM's option (b) was the basis the fixtures were drafted on) |
| TBD-WA-02 | Citation form unchanged — `WCIM Act 2023 (WA)` already used at Act level |
| TBD-WA-03 | Three-tier advisory codes confirmed — TC-WA-063/064/065 unchanged |
| TBD-WA-04 | Continuous + inclusive confirmed — TC-WA-022, TC-WA-027, TC-WA-061, TC-WA-062 unchanged |
| TBD-WA-05 | Literal s.9 + advisory confirmed — no fixture change; the advisory is a trigger-handler concern that fires automatically on `workers_comp_absence` overlap |
| TBD-WA-06 | Partial-duration averaging confirmed — TC-WA-009, TC-WA-051 expected outputs unchanged |
| TBD-WA-07 | "Last fully-accrued block minus prior leave taken against it" confirmed — TC-WA-026 (no prior leave taken) unchanged; future fixtures with prior-leave interaction can be added in v2 |
| TBD-WA-08/12/13/14 + slackness | Schema extension deferred to DEV-CROSS-2 — fixtures TC-WA-029, TC-WA-049, TC-WA-052, TC-WA-060 remain in active suite, pass once DEV-CROSS-2 lands |
| TBD-WA-09 | Working-days proportionate confirmed — TC-WA-036 expected days_excluded_from_service (10) unchanged because the fixture employee is FT |
| TBD-WA-10 | General-rule application confirmed — TC-WA-039, TC-WA-054 unchanged |
| TBD-WA-11 | 2022-06-20 → post-2022 — TC-WA-042 `first_block_rules` updated to `post_2022` (was previously inline-noted as "pre_2022" pending resolution); see fixture amendment below |
| TBD-WA-15 | Advisory confirmed — TC-WA-064 status: computed + warning, unchanged from draft |
| TBD-WA-16 | No carve-out confirmed — no sub-7-yr death-specific fixture; the general sub-7-yr warning applies |

The only fixture-value change from the draft is **TC-WA-042**: `first_block_rules: pre_2022` → `first_block_rules: post_2022` (per TBD-WA-11 resolution). All other fixtures stand as drafted.

---

---

## Sources of legal truth

- *Long Service Leave Act 1958* (WA) — authorised consolidation, current at 31 January 2025, available at `legislation.wa.gov.au` (PCO `[04-m0-00]`, `mrdoc_48247.pdf`). Cited as **"WA LSL Act 1958 s.N"** throughout. Section numbers and headings verified against the legislation.wa.gov.au consolidated index and against the WA Government's "Overview of long service leave in WA" plain-English summary at `wa.gov.au/organisation/private-sector-labour-relations/overview-of-long-service-leave-wa`.
- *Industrial Relations Legislation Amendment Act 2021* (WA) — Act No. 30 of 2021. Commenced 20 June 2022. **Substantially amended** ss.4, 5, 6, 8, 9 of the LSL Act 1958 (and inserted s.4A). Did NOT change the underlying entitlement formula (8.6667 weeks at 10 years; 4.3333 weeks per further 5 years remain unchanged across the cutoff). Source: legislation.wa.gov.au `mrdoc_44481.pdf`. Cited as **"IR Legislation Amendment Act 2021 (WA)"** only where historical context is required.
- *Workers Compensation and Injury Management Act 2023* (WA) — Act No. 17 of 2023. Commenced 1 July 2024. Confers continuous-employment counting for periods of income compensation **on or after 1 July 2024**. Cited as **"WCIM Act 2023 (WA)"**.
- *WA Government plain-English guidance* at `wa.gov.au/organisation/private-sector-labour-relations/` (formerly `commerce.wa.gov.au/labour-relations/`) — operational summary published by the Department of Energy, Mines, Industry Regulation and Safety (DEMIRS). Cited as **"DEMIRS — LSL guidance"** where used. The Department publishes separate pages for: overview, continuous-employment (pre-2022 vs post-2022), casual and seasonal, workers compensation, payment, and end-of-employment scenarios — each authoritative for its scope.
- *APA LSL Masterclass* PDF (`docs/features/LSL-training.pdf`) pp.65–79 — supplies worked examples for WA used as canonical fixtures. Cited as **"APA LSL Masterclass p.NN"**.
- *Industrial Magistrates Court of WA* (`imc.wa.gov.au`) — authoritative for s.11 LSL disputes.

---

## How to read this file

Each test case has:

- **ID** (e.g. `TC-WA-001`) — unique, stable, referenced from `gold-standard.test.ts`
- **Name** — short, descriptive
- **Source** — APA PDF page and/or WA LSL Act 1958 section that produced the expected value
- **Category** — Single mode (Fixed-rate / Varied-hours / Commission / Hard-error / negative) or Bulk mode
- **Why it matters** — the spec acceptance criterion or WA-specific divergence this case backs
- **Inputs** — fenced YAML following the engine's `Employee` / `Trigger` / `WagePeriod` / `ContinuousServiceEvent` data model in `website/src/lib/lsl/engine/types.ts`
- **Expected output** — `value_of_week`, `value_of_day`, `total_entitlement_weeks`, `total_entitlement_dollars`, `expected_citations[]`; for hard-error cases `status: failed` and `error.code`
- **Legal source** — explicit WA LSL Act 1958 / WCIM Act 2023 / IR Legislation Amendment Act 2021 section reference
- **Notes** — interpretation, derivation, any `expected: TBD` flag with rationale

### Conventions used in this file

- **Currency**: AUD; half-up rounding at 0.005; 2 decimal places at display; intermediate arithmetic is unrounded — same convention as NSW (F12, AC25 in E1 spec), VIC, and QLD.
- **Dates**: ISO `YYYY-MM-DD`. Prescribed-date anchor for fixtures is `2026-05-25` (= as-at default for v1 testing).
- **Entitlement formula** (WA LSL Act 1958 s.8): `8.6667 weeks` at 10 years of continuous employment, plus `4.3333 weeks` for each further 5 years. Same accrual ratio as NSW, VIC, and QLD (1/60 = 8.6667/10). **This formula is unchanged across the 20 June 2022 cutoff** — the IR Legislation Amendment Act 2021 did NOT change the entitlement-weeks calculation; it changed only the continuous-employment rules (which absences count, casual/seasonal definition, parental leave treatment, transfer-of-business scope). See TBD-WA-01 RESOLUTION for the single-rule-set-with-date-aware-continuous-service architecture.
- **Pro-rata at termination** (s.8(3)): payable to an employee who has completed **at least 7 years** of continuous employment whose employment ends for any reason **other than serious misconduct**. Death is treated equivalently to other qualifying terminations (s.8(3) extends pro-rata to "the death of the employee"). Resignation, dismissal (not for serious misconduct), redundancy, and death all qualify at 7+ years. **This rule is unchanged across the 20 June 2022 cutoff**.
- **Serious misconduct** (s.8): forfeits all pro-rata at sub-10-years; at 10+ years, the employee retains the most recent fully-accrued block (8.6667 wks at the 10-yr mark, or +4.3333 wks at each subsequent 5-yr mark) but forfeits any **unpaid accrual since the last full milestone**. This is a critical WA-specific divergence from VIC (no misconduct exception) and from NSW (sub-10-yr-only forfeiture).
- **Ordinary pay** (s.9): for fixed-rate employees, the ordinary-time rate of pay at the time of the leave applies. For casual / seasonal / varied-hours employees, the **average weekly hours during the accrual period** are used (first 10 years = one accrual period; each subsequent 5 years = its own accrual period). Casual loading is **included** in ordinary pay. For commission / piece / results-based pay, the **365-day pre-leave average** applies (`total earnings in previous 365 days ÷ 365 × 7`).
- **Continuous employment** (s.6): paid leave (annual, LSL, paid personal, paid carer's, public holidays, paid parental, paid compassionate, paid family-and-domestic-violence) counts; unpaid leave (including unpaid parental leave) does not count but does not break continuity in most cases. **Casual / seasonal employees**: continuous despite absences "permitted under the terms of the employment", "caused by seasonal factors", or "any other absence where the employee, due to the regular and systematic nature of the work, has a reasonable expectation of returning to work". **All of these provisions changed materially on 20 June 2022** — handled via the single-rule-set + two date-aware continuous-service modules per TBD-WA-01 RESOLUTION.
- **Workers compensation** (s.6 + WCIM Act 2023): WC absences **on or after 1 July 2024** count as continuous employment (WCIM Act 2023 (WA) — section TBD per TBD-WA-02 RESOLUTION; Act-level citation only in v1.0, exact sub-section pending quarterly review). WC absences **before 1 July 2024** depend on when the entitlement fully accrued — if the entitlement fully accrued on or after 20 June 2022, WC days before 2024-07-01 do NOT count; if fully accrued before 20 June 2022, the legacy 15-day-per-year sickness/injury cap applies. **Crucially, the 1 July 2024 cutoff applies to the date of the absence, not to the date the entitlement accrued** (per DEMIRS guidance).
- **Public holidays during LSL** (s.9): **EXCLUSIVE** — a PH falling within an LSL window extends the leave by one day per PH (matches NSW, VIC, QLD; differs from SA which is inclusive).
- **Cashing out** (s.5): permitted **only after the entitlement has been fully accrued** (i.e. after each completed 10-yr or 5-yr block). Cannot be cashed out in advance, cannot be substituted by topped-up hourly rates or commission. Must be a **written agreement signed by both parties**. The employee must be paid at least what they would have received at ordinary pay. Engine emits a **non-blocking advisory** when a `cash_out` trigger is received (parallel to QLD; contrast VIC's hard error). Three distinct advisory codes per TBD-WA-03 RESOLUTION.
- **Transfer of business** (s.6 amended 2022): from 20 June 2022, when a business changes ownership, the employee's period of continuous employment with the old employer **transfers to the new employer**, and the accrued leave (if any) is also transferred. This applies regardless of any sale-of-business contract terms — broader than the pre-2022 "transmission of business" wording.
- **Citations**: every case lists the minimum expected citations. The rules engine MAY emit additional citations; tests assert array-membership, not array-equality.

---

## WA-specific divergences from NSW + VIC + QLD (the load-bearing facts)

| Topic | NSW | VIC | QLD | WA | WA source |
|---|---|---|---|---|---|
| Qualifying period (full entitlement) | 10 yrs | 7 yrs | 10 yrs | **10 yrs** | WA LSL Act 1958 s.8(1) |
| Pro-rata at termination (sub-10-yr threshold) | 5 yrs (limited reasons) | 7 yrs (any reason, incl. misconduct) | 7 yrs (limited reasons under s.95(3)) | **7 yrs — any reason EXCEPT serious misconduct** | WA LSL Act 1958 s.8(3) |
| Sub-7-yr entitlement | none on resignation; pro-rata at 5 yrs for limited reasons | none | none | **none — no sub-7-yr entitlement under any reason** | WA LSL Act 1958 s.8(3) |
| Resignation between 7–10 yrs | not payable | full payout | not payable (only qualifying reasons) | **PAYABLE — pro-rata** | WA LSL Act 1958 s.8(3); DEMIRS — "resignation, dismissal, redundancy or if the employee dies" |
| Redundancy at 7–10 yrs | pro-rata (limited at 5+) | full payout | pro-rata (s.95(3)(d)) | **pro-rata payable** | WA LSL Act 1958 s.8(3) |
| Serious-misconduct dismissal — sub-10-yr | full forfeiture | full payout | full forfeiture (s.95(3)(d)) | **full forfeiture — NO pro-rata** | WA LSL Act 1958 s.8(3) |
| Serious-misconduct dismissal — 10+ yrs | full payout | full payout | full payout | **PARTIAL FORFEITURE — only last fully-accrued block payable; accrual since last milestone forfeited** | WA LSL Act 1958 s.8(3); DEMIRS — "only entitled to be paid for any part of a last fully accrued entitlement which has not been taken and is not entitled to receive payment of pro rata long service leave" |
| Accrual ratio | 1/60 (8.6667 wk per 10 yr) | 1/60 | 1/60 | **1/60 (same)** | WA LSL Act 1958 s.8 |
| 15-year additional accrual | continuous 1/60 (no step) | continuous 1/60 | continuous 1/60 (per resolved TBD-QLD-01) | **continuous 1/60** (4.3333 wks/5 yr is the proportionate phrasing; not a discrete step) — TBD-WA-04 RESOLVED | WA LSL Act 1958 s.8(1) |
| Break tolerance — employer/employee-initiated | 2 mo (≤60 days) | 12 weeks | 3 months | **2 months (other reasons); 6 months (slackness of trade)** | WA LSL Act 1958 s.6; DEMIRS — "Re-employment within 2 months (non-slackness terminations); Re-employment within 6 months (slackness-of-trade terminations)" |
| Casual continuity (post-2022) | "regular and systematic" + research §1.4 | 12 weeks unless agreement, seasonal, etc. (s.12(3)) | 3 months between contracts (s.103) | **No specific gap duration — continuity preserved where absence is "permitted under the terms of the employment", "caused by seasonal factors", or "regular and systematic" with reasonable expectation of return** | WA LSL Act 1958 s.6 (as amended 2022); DEMIRS — casuals & seasonal |
| Casual continuity (pre-2022) | n/a | n/a | n/a | **NO SPECIFIC RULES — general s.6 absences-counted/not-counted regime applied to casuals** | DEMIRS — "there were no specific rules in place for determining casual and seasonal employees' continuous employment prior to June 2022" |
| Casual loading | included | included | included (s.105) | **included (s.9 as amended 2022) — "ordinary pay for long service leave purposes includes their casual loading"** | DEMIRS — casual ordinary pay |
| Historical cliffs | none | 1 Nov 2018 (dual-regime via s.57) | 23 Jun 1990 (general); 30 Mar 1994 (casual) | **20 June 2022** — IR Legislation Amendment Act 2021 commenced; applies to entitlements that **fully accrued** on/after that date | DEMIRS — "different rules can still apply for entitlements fully accrued before 20 June 2022" |
| Sickness / injury counted as service (pre-2022) | counts | counts | counts | **15 working days per year cap; excess does NOT count** | WA LSL Act 1958 s.6 (pre-2022); DEMIRS pre-2022 guidance |
| Sickness / injury counted as service (post-2022) | counts | counts | counts | **counts in full IF paid; unpaid sickness/injury follows general unpaid-leave rules** | WA LSL Act 1958 s.6 (as amended 2022); DEMIRS post-2022 guidance |
| Unpaid parental leave (pre-2022) | excluded | first 52 wks count (s.13(1)(b)) | does not count but no break (s.134) | **DOES NOT count toward service** (pre-2022 rule for casual/seasonal: parental leave entirely excluded) | DEMIRS pre-2022 guidance — "a period of parental leave does not count" |
| Unpaid parental leave (post-2022 — casual) | n/a | (52-wk cap) | n/a | **COUNTS where the employee has reasonable expectation of return** | DEMIRS post-2022 casual guidance |
| Workers Comp — pre-2024-07-01 | counts (NSW LSA s.4(11)) | counts (s.13(1)(b)) | counts (s.134) | **DEPENDS ON ACCRUAL DATE**: if accrued before 20 June 2022 → 15-day-per-year cap; if accrued on/after 20 June 2022 → does NOT count unless employee was on paid leave concurrently or returning-to-work | WA LSL Act 1958 s.6 + DEMIRS guidance |
| Workers Comp — on/after 2024-07-01 | counts | counts | counts | **COUNTS regardless of accrual date** — WCIM Act 2023 (WA) overrides | WCIM Act 2023 (WA) (section TBD per TBD-WA-02 RESOLUTION — Act-level citation in v1.0); DEMIRS — "An absence from work on income compensation on or after 1 July 2024 counts towards the length of an employee's period of continuous employment" |
| WC rate of pay during LSL | counts as service; current ordinary rate | s.17 higher of pre-injury or current | literal s.98 ordinary rate at leave time + advisory (per TBD-QLD-05) | **literal s.9 ordinary rate at leave time + advisory (parallel to QLD)** — TBD-WA-05 RESOLVED | WA LSL Act 1958 s.9; DEMIRS — silent on WC pay rate |
| Transfer of business — pre-2022 | NSW LSA s.4(6) | s.11(3)–(11) | s.134 | **s.6 transmission-of-business — prior employment counts where there was a transmission of the business** | WA LSL Act 1958 s.6 (pre-2022); DEMIRS pre-2022 |
| Transfer of business — post-2022 | as pre-2022 | as pre-2022 | as pre-2022 | **BROADER — Fair Work Act standards apply; covers insourcing/outsourcing/related-company arrangements; accrued leave transfers regardless of contract** | DEMIRS — "From 20 June 2022, when a business changes ownership, an employee's period of continuous employment with the old employer transfers to the new employer and the employee's accrued leave, if any, is also transferred. This applies regardless of anything written in a sale of business contract." |
| Cashing out | not in scope NSW v1 | **CRIMINAL OFFENCE — s.34** | **PERMITTED via instrument or QIRC order (s.110)** — advisory | **PERMITTED only after entitlement is fully accrued; written agreement required** — non-blocking advisory | WA LSL Act 1958 s.5 (as amended 2022); DEMIRS — cash-out post-2022 |
| Public holiday during LSL | exclusive | exclusive (s.7) | exclusive (s.97) | **Exclusive (s.9) — "the period of long service leave is increased by one day for each such public holiday"** | WA LSL Act 1958 s.9 |
| Death of employee | NSW LSA s.4(2)(iii)(d) — pro-rata, estate on request | s.10 — full accrued + 52-wk avg | s.95(3)(a) — pro-rata to legal personal rep | **s.8(3) — pro-rata payable on death (parallel treatment to other qualifying terminations); pay to legal personal representative** | WA LSL Act 1958 s.8(3) |
| Working elsewhere during LSL | not encoded | OFFENCE under s.35 | not encoded | **s.27 — employee forfeits unexpired LSL if working elsewhere during LSL** | WA LSL Act 1958 s.27 |
| Pay-on-termination timing | "forthwith" | "on the day on which the employment ends" (s.9(1)(b)) | payable on termination (s.95) | **payable on termination — s.8(3); s.9 governs payment method** (no specific "forthwith" timing language; DEMIRS treats next-pay-cycle as compliant) | WA LSL Act 1958 s.8(3), s.9 |
| Apprentice → tradesperson | within 12 mo | within 52 wks post-2018 | n/a (not modelled) | **Apprenticeship/traineeship completion gaps — up to 52 weeks permitted** | DEMIRS — continuous employment list |
| Industrial action / dispute | doesn't break / doesn't count | continuous but excluded from accrual (s.12(8) + s.14(d)) | s.134 — continuous; doesn't count | **counts as continuous (returning per settlement terms); industrial dispute absences do not break continuity** | WA LSL Act 1958 s.6; DEMIRS |
| Stand down | not specifically encoded | continuous (s.12(7)) but excluded from accrual (s.14(c)) | s.134 | **continuous — "Stand downs per award/agreement/order"** | WA LSL Act 1958 s.6; DEMIRS |
| Local Government employees | not in scope | n/a | n/a | **DIFFERENT scheme — Local Government LSL guidelines (`dlgsc.wa.gov.au`); out of v1 statutory engine scope** | WA Local Government LSL guidelines |
| Construction industry portable scheme | not in scope | n/a | separate Acts (s.110 cross-ref) | **OUT OF v1** — MyLeave portable scheme governs WA construction industry | MyLeave WA — out of v1 |

---

## TBD-WA-01 (LOAD-BEARING) — Dual-regime architecture: ✅ RESOLVED 2026-05-25

**RESOLUTION**: Single rule set with date-aware continuous-service handling (PM-recommended option (b)). See the binding Resolutions section near the top of this document. The detail below is retained as the reasoning that produced the resolution.

The original impl-plan v0.3.1 §5 assumed WA needs two parallel rule sets (`rules-pre-2022/` + `rules-post-2022/`). After full research into the IR Legislation Amendment Act 2021 changes, the PM's reading is that **WA follows the VIC pattern — one rule set with date-aware continuous-service handling** (the pattern adopted in resolved TBD-VIC-01), not two parallel entitlement engines.

### Evidence

1. **Accrual formula unchanged across the cutoff.** WA LSL Act 1958 s.8 was textually amended in 2022 (per the Industrial Relations Legislation Amendment Act 2021), but DEMIRS and multiple legal commentaries confirm the change "did not make substantive changes which affect the analysis that there is only one comprehensive entitlement" (paraphrased from the Industrial Magistrates Court reasoning). The 8.6667-wks-at-10-yrs and +4.3333-wks-per-further-5-yrs formula is unchanged.

2. **Pro-rata rules unchanged across the cutoff.** Both pre-2022 and post-2022 versions of s.8(3) apply pro-rata at the 7-year threshold with the same exception for serious misconduct. There is no transitional rule that says "an entitlement that fully accrued before 20 June 2022 uses a different pro-rata threshold."

3. **What ACTUALLY changed in 2022 (per DEMIRS):**
   - **Continuous-employment rules** — which absences count, casual/seasonal definitions, parental leave treatment.
   - **Cash-out rules** — clarified to post-accrual-only, written agreement required.
   - **Ordinary pay clarification** — casual loading explicitly included, results-based pay 365-day averaging codified.
   - **Transfer of business scope** — broadened to Fair Work Act standards.
   - **Penalty alignment** — LSL contraventions now attract IR Act-level penalties.

4. **The "fully accrued" transitional test** is itself evidence of single-regime architecture. The test asks "did this employee's 10-yr or 5-yr accrual block complete before 20 June 2022?" — it doesn't ask "which entitlement-weeks formula applies?" Both formulas are identical; the test routes only the continuous-service rule selection.

5. **The 1 July 2024 Workers Comp change is a *separate* date-aware override** — completely independent of the 20 June 2022 cutoff. WCIM Act 2023 (WA) confers WC counting "on or after 1 July 2024" regardless of when the LSL entitlement accrued. This is a one-line override in the continuous-service module, not a third rule set.

### Three options

| Option | Description | Effort | PM verdict |
|---|---|---|---|
| **(a)** | True dual-regime — two parallel rule sets (`rules-pre-2022/` + `rules-post-2022/`), one accrual table per side, regime selector by `entitlement.accrualDate`. Matches original impl-plan §5. | L (5–8 days) | **REJECTED** — accrual formula is identical pre vs post 2022; two rule sets would be 95% duplicated code. |
| **(b)** | Single rule set with **date-aware continuous-service handling** — VIC pattern. Two `continuous-service-rule` modules selected by accrual-block completion date (pre or on/after 2022-06-20). Same s.8 accrual formula, same s.9 ordinary-pay, same s.8(3) pro-rata. PLUS a third date-aware override at 2024-07-01 for WC absences via WCIM Act 2023. | M–L (4–6 days) | **RECOMMENDED** — parallel to VIC's re-scope; ~2 dev-days saved vs (a). |
| **(c)** | Single regime + advisory warning — the 2022 changes are minor enough that the calculator could treat all employees under post-2022 rules and emit an advisory warning when service straddles 2022-06-20. | S–M (2–4 days) | **REJECTED** — the pre-2022 sickness 15-day cap and casual treatment differences are material for long-tenure employees with disputed accrual milestones. The calculator must compute correctly, not just advise. |

### PM recommendation

**Adopt option (b) — single rule set with date-aware continuous-service handling.**

### Engine encoding (if (b) adopted)

- `website/src/lib/lsl/states/wa/index.ts` — single WA `RuleSet` (entitlement.ts, value-of-week.ts, trigger-handlers.ts, continuous-service/index.ts, accrual-table.ts).
- `website/src/lib/lsl/states/wa/rules/continuous-service/rules-pre-20jun2022.ts` — pre-2022 s.6 absences (15-day sickness cap; UPL excluded; casual continuity = no specific rules → general s.6).
- `website/src/lib/lsl/states/wa/rules/continuous-service/rules-post-20jun2022.ts` — post-2022 s.6 absences (no sickness cap if paid; casual continuity expanded; paid parental counts; broader transfer-of-business).
- `website/src/lib/lsl/states/wa/rules/continuous-service/index.ts` — walks `serviceEvents`; for each event, determines whether the accrual block in which the event sits **fully accrued** before 2022-06-20 (pre-2022 rules) or on/after (post-2022 rules). The "fully accrued" test is the rule selector, not the absence start date itself.
- `website/src/lib/lsl/states/wa/rules/continuous-service/workers-comp-override.ts` — applied AFTER the pre/post-2022 module selects. For any `workers_comp_absence` event, days on or after 2024-07-01 count regardless of which pre/post-2022 module is active. Pre-2024-07-01 portions follow the selected module's rule.

### Ambiguity warnings to surface (post-(b) adoption)

- `wa_regime_split_applied` — at least one accrual block straddles 2022-06-20 such that different continuous-service rules applied to different segments.
- `wa_regime_split_data_insufficient` — the user-supplied wage history lacks date granularity to determine which side of 2022-06-20 an accrual block completed on. Engine emits a `regime_split_data_insufficient` page event and offers single-regime fallback (post-2022 rules applied to entire tenure, with caveat).
- `wa_workers_comp_pre_2024_excluded` — at least one WC absence had pre-2024-07-01 days excluded from service.

**RES-1 #3 stays intact** — WA remains the third state encoded after VIC + QLD; the re-scope is structural inside Phase 5, not a re-ordering of phases.

---

## "Fully accrued" interpretation — what 20 June 2022 actually means for the engine

The 20 June 2022 cutoff applies to **when an LSL entitlement BLOCK fully accrued**, not to individual days of service. Per DEMIRS:

> "The 2022 changes apply for entitlements that fully accrue on or after 20 June 2022. If an entitlement fully accrued before 20 June 2022, different (older) rules can still apply for that entitlement."

**Accrual blocks**:
- The **first 10 years** of continuous employment is one accrual block. The block "fully accrues" on the employee's 10-year anniversary date (subject to absences that delayed the milestone).
- Each subsequent **5-year period** is its own accrual block. The block "fully accrues" on the 15-year, 20-year, 25-year, ... anniversaries.

**Engine implication (under TBD-WA-01 RESOLVED option (b))**:
- For each accrual block on an employee's record, determine whether that block's "fully accrued" date is before or on/after 2022-06-20.
- For blocks that fully accrued **before 2022-06-20**: pre-2022 continuous-service rules (15-day sickness cap; UPL excluded; etc.) apply to that block's contributing service.
- For blocks that fully accrued **on or after 2022-06-20**: post-2022 rules apply.

**Worked example**:
- Employee A started 2010-01-01. Reached 10 yrs on 2020-01-01 (block 1 fully accrued — pre-2022 rules). Reached 15 yrs on 2025-01-01 (block 2 fully accrued — post-2022 rules).
- A's first 8.6667 wks of LSL is governed by pre-2022 rules; the next 4.3333 wks of LSL is governed by post-2022 rules.
- Why this matters: A took 12 days of unpaid sick leave each year for 4 years between 2015 and 2019. Under pre-2022 rules, 3 days/year (over the 15-day cap is moot here — under cap, all 12 days/year count) all counts. Under post-2022 rules, same days same outcome (counts in full if paid). So in this example, the regime split makes no numerical difference.
- Where it WOULD matter: an employee whose sickness/injury exceeded 15 working days per year during their first-10-years block.

The engine MUST surface the regime-split via the `wa_regime_split_applied` warning when an employee's tenure straddles 2022-06-20, even when the numerical outcome is identical (so the user sees the engine made the determination, not glossed over it).

---

## Coverage at a glance

| Source / Theme | Test IDs | Count |
|---|---|---|
| APA PDF WA worked examples (pp.65–79) | TC-WA-001 → TC-WA-010 | 10 |
| Sub-7-year and 7–10-year qualifying-reason cases (s.8(3)) | TC-WA-011 → TC-WA-018 | 8 |
| 10+ year payout (any reason except misconduct) (s.8(1)/(3)) | TC-WA-019 → TC-WA-023 | 5 |
| Serious-misconduct treatment (sub-10-yr full forfeiture; 10+-yr partial forfeiture) | TC-WA-024 → TC-WA-027 | 4 |
| Continuous-service edge cases — post-2022 (s.6 as amended 2022) | TC-WA-028 → TC-WA-035 | 8 |
| Continuous-service edge cases — pre-2022 (s.6 pre-amendment, via "fully accrued before 2022" test) | TC-WA-036 → TC-WA-039 | 4 |
| Regime-split fixtures (service straddles 2022-06-20) | TC-WA-040 → TC-WA-043 | 4 |
| Insufficient-granularity fallback (AC8) | TC-WA-044 → TC-WA-045 | 2 |
| Workers Comp — pre/on/after 2024-07-01 (s.6 + WCIM Act 2023) | TC-WA-046 → TC-WA-049 | 4 |
| Casual employees — post-2022 (s.6 casual continuity; s.9 loaded rate) | TC-WA-050 → TC-WA-053 | 4 |
| Casual employees — pre-2022 (no specific casual rules) | TC-WA-054 | 1 |
| Ordinary pay — fixed, varied hours, commission, results-based (s.9) | TC-WA-055 → TC-WA-060 | 6 |
| 15-year continuous accrual (s.8(1)) | TC-WA-061 → TC-WA-062 | 2 |
| Cashing out — non-blocking advisory (s.5) | TC-WA-063 → TC-WA-065 | 3 |
| Public holiday during LSL (s.9) | TC-WA-066 | 1 |
| As-at snapshot trigger | TC-WA-067 → TC-WA-068 | 2 |
| Cross-jurisdiction (WA + other state) | TC-WA-069 → TC-WA-070 | 2 |
| Bulk-mode fixtures | TC-WA-BULK-001 → TC-WA-BULK-003 | 3 |
| **Total active single-mode fixtures for v1 WA launch** | | **70** |
| **Bulk-mode fixtures** | | **3** |
| **Grand total** | | **73** |

> **Note on size**: WA has the largest fixture count of any state to date (NSW 60, VIC 61, QLD 60) because of the regime-split arithmetic (4 dedicated fixtures + 2 insufficient-granularity fallback), the four-way serious-misconduct matrix (sub-7, 7–10, 10+ with last-block-fully-accrued, 10+ within-block), and the WC pre/post-2024 cutoff (4 fixtures). PM has resolved TBD-WA-01 to option (b), so the count stands at 73 — option (a) would have demanded ~10 more cross-cutoff fixtures.

---

# Single-mode test cases

## §A — APA PDF WA worked examples (pp.65–79)

### TC-WA-001 — 10 yrs FT resignation, full entitlement 8.6667 weeks

- **Source**: APA p.65 worked example; WA LSL Act 1958 s.8(1)
- **Category**: Fixed-rate (s.9)
- **Why it matters**: Canonical "10 yrs × 1/60" calculation. Employee resigned at 10+ yrs — payable under s.8(1) regardless of reason (except serious misconduct).

**Inputs**

```yaml
employee:
  id: TC-WA-001
  legalName: SamWA
  startDate: 2016-05-25
  endDate: 2026-05-25
  employmentType: full_time
  statesOfService: [WA]
  governingJurisdiction: WA
  currentWeeklyGross: 1800.00
  wageHistory:
    - { periodStart: 2016-05-25, periodEnd: 2026-05-25, grossPay: 936000.00, frequency: weekly }
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 10.0000
total_entitlement_weeks: 8.6667         # s.8(1) — first entitlement at 10 yrs
value_of_week: 1800.00                   # s.9 — fixed-rate ordinary pay
value_of_day: 360.00                     # 1800 / 5 (FT 5-day week)
total_entitlement_dollars: 15600.06      # 8.6667 × 1800
warnings:
  - { code: wa_regime_split_applied, message: "Service spans 20 June 2022. First 10-year block fully accrued on 2026-05-25 (post-2022); post-2022 continuous-service rules applied." }
expected_citations:
  - { section: WA LSL Act 1958 s.8(1), rule: accrual.qualifying-period-10yr, pdfPage: 65 }
  - { section: WA LSL Act 1958 s.9,    rule: ordinary-pay.fixed-rate, pdfPage: 66 }
  - { section: WA LSL Act 1958 s.8(3), rule: trigger.termination.any-reason-except-misconduct, pdfPage: 65 }
```

**Notes**

Identical accrual outcome to NSW TC-NSW-001 and QLD TC-QLD-001 (same 1/60 ratio). The WA-specific characteristic is the regime-split warning: because Sam's first 10-yr block fully accrued on 2026-05-25 (after 2022-06-20), post-2022 continuous-service rules apply. The warning is emitted even when the numerical outcome is identical to a single-regime calculation (transparency over silent uniformity).

---

### TC-WA-002 — 9 yrs FT resignation, no misconduct → pro-rata payout

- **Source**: APA p.66; WA LSL Act 1958 s.8(3); DEMIRS "Long service leave when employment ends"
- **Category**: Pro-rata at termination — voluntary resignation 7–10 yrs
- **Why it matters**: **Critical divergence from NSW + QLD** — under WA s.8(3), voluntary resignation at 7–10 yrs DOES pay out pro-rata (only serious misconduct disqualifies). Contrast NSW (no payout) and QLD (no payout — only qualifying reasons). WA aligns with VIC on this point.

**Inputs**

```yaml
employee:
  id: TC-WA-002
  legalName: ResignationWAFixture
  startDate: 2017-05-25
  endDate: 2026-05-25                   # 9 yrs
  employmentType: full_time
  statesOfService: [WA]
  governingJurisdiction: WA
  currentWeeklyGross: 1700.00
  wageHistory:
    - { periodStart: 2017-05-25, periodEnd: 2026-05-25, grossPay: 795600.00, frequency: weekly }
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 9.0000
total_entitlement_weeks: 7.8000          # 9 × 8.6667/10
value_of_week: 1700.00
total_entitlement_dollars: 13260.00
expected_citations:
  - { section: WA LSL Act 1958 s.8(3), rule: accrual.7-to-10yr.any-reason-except-misconduct, pdfPage: 66 }
  - { section: WA LSL Act 1958 s.9,    rule: ordinary-pay.fixed-rate, pdfPage: 66 }
```

**Notes**

This is the **first critical engine branching point** distinguishing WA from NSW + QLD. Engine MUST NOT apply NSW's "voluntary resignation = no payout" semantics when state = WA. Per DEMIRS "Long service leave when employment ends": "[employees] receive pro rata long service leave when their employment ends" at 7–10 yrs — "resignation, dismissal, redundancy or if the employee dies. The only exception is where the employee has been dismissed for serious misconduct."

---

### TC-WA-003 — 8 yrs FT redundancy, pro-rata payout

- **Source**: APA p.66; WA LSL Act 1958 s.8(3)
- **Category**: Fixed-rate, redundancy

**Inputs**

```yaml
employee:
  id: TC-WA-003
  legalName: RedundancyWAFixture
  startDate: 2018-05-25
  endDate: 2026-05-25
  employmentType: full_time
  statesOfService: [WA]
  governingJurisdiction: WA
  currentWeeklyGross: 1500.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: redundancy }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 8.0000
total_entitlement_weeks: 6.9333         # 8 × 8.6667/10
value_of_week: 1500.00
total_entitlement_dollars: 10399.95
expected_citations:
  - { section: WA LSL Act 1958 s.8(3), rule: accrual.7-to-10yr.any-reason-except-misconduct, pdfPage: 66 }
```

**Notes**

Numerically identical to QLD redundancy at 8 yrs (s.95(3)(d)) and NSW redundancy at 8 yrs (NSW LSA s.4(2)(a)(iii)). WA-specific characteristic: the citation cites s.8(3) directly; there is no separate qualifying-reason taxonomy at the statute level (unlike QLD's s.95(3)(a)/(b)/(c)/(d)/(e) sub-paragraph structure).

---

### TC-WA-004 — 7 yrs FT death, pro-rata payable to legal personal representative

- **Source**: APA p.67; WA LSL Act 1958 s.8(3); DEMIRS — "if the employee dies"
- **Category**: Pro-rata at termination — death

**Inputs**

```yaml
employee:
  id: TC-WA-004
  legalName: DeathWAFixture
  startDate: 2019-05-25
  endDate: 2026-05-25                   # exactly 7 yrs
  employmentType: full_time
  statesOfService: [WA]
  governingJurisdiction: WA
  currentWeeklyGross: 1700.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: death }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.0000
total_entitlement_weeks: 6.0667          # 7 × 8.6667/10
value_of_week: 1700.00
total_entitlement_dollars: 10313.39
payment_recipient: "legal personal representative of the deceased employee"
expected_citations:
  - { section: WA LSL Act 1958 s.8(3), rule: trigger.termination.death-pro-rata, pdfPage: 67 }
  - { section: WA LSL Act 1958 s.9,    rule: ordinary-pay.fixed-rate, pdfPage: 66 }
```

**Notes**

WA does NOT have a separate s.10-style provision (as VIC does) with a special 52-week averaging rule for death-of-employee. The standard s.9 ordinary-rate-at-leave-time applies, with the leave-time anchor for a death trigger being the date of death. Same simple treatment as QLD.

---

### TC-WA-005 — 7 yrs FT serious-misconduct dismissal → $0

- **Source**: APA p.67; WA LSL Act 1958 s.8(3); DEMIRS — serious misconduct exception
- **Category**: Negative — sub-10-yr misconduct
- **Why it matters**: WA s.8(3) bars pro-rata for serious misconduct at any sub-10-yr tenure. Aligns with NSW + QLD on this; diverges from VIC (which pays out regardless).

**Inputs**

```yaml
employee:
  id: TC-WA-005
  legalName: MisconductSub10WAFixture
  startDate: 2019-05-25
  endDate: 2026-05-25                   # 7 yrs
  employmentType: full_time
  statesOfService: [WA]
  governingJurisdiction: WA
  currentWeeklyGross: 1700.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: serious_misconduct }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.0000
total_entitlement_weeks: 0.0000
total_entitlement_dollars: 0.00
warnings:
  - { code: sub_10yr_misconduct_excluded_wa, message: "Dismissal for serious misconduct under WA LSL Act 1958 s.8(3) — at sub-10-year tenure, no pro-rata entitlement is payable. Note: at 10+ years, the last fully-accrued block remains payable but accrual since the last milestone is forfeited (see TC-WA-026)." }
expected_citations:
  - { section: WA LSL Act 1958 s.8(3), rule: accrual.7-to-10yr.serious-misconduct-excluded, pdfPage: 67 }
```

**Notes**

Critical engine branching: at sub-10-yr, misconduct returns $0 (parallel to NSW + QLD). At 10+ yrs, partial-forfeiture rule applies (TC-WA-026) — this is the WA-unique mid-band treatment.

---

### TC-WA-006 — 8 yrs PT dismissal not for misconduct, pro-rata payable

- **Source**: APA p.68; WA LSL Act 1958 s.8(3)
- **Category**: Pro-rata at termination — PT employer dismissal not misconduct

**Inputs**

```yaml
employee:
  id: TC-WA-006
  legalName: PTDismissalWAFixture
  startDate: 2018-05-25
  endDate: 2026-05-25
  employmentType: part_time
  statesOfService: [WA]
  governingJurisdiction: WA
  currentWeeklyGross: 800.00              # 25 h/wk × $32/hr
  normalWeeklyHours: 25
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: employer_initiated_not_misconduct }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 8.0000
total_entitlement_weeks: 6.9333
value_of_week: 800.00
value_of_day: 160.00
total_entitlement_dollars: 5546.64
expected_citations:
  - { section: WA LSL Act 1958 s.8(3), rule: accrual.7-to-10yr.any-reason-except-misconduct, pdfPage: 68 }
  - { section: WA LSL Act 1958 s.9,    rule: ordinary-pay.fixed-rate-pt, pdfPage: 66 }
```

---

### TC-WA-007 — Casual 12 yrs continuous, taking 8.6667 wks at $40/hr × avg 32 h/wk

- **Source**: APA p.69; WA LSL Act 1958 s.6 (as amended 2022), s.8(1), s.9
- **Category**: Casual — accrual-period averaged hours × loaded hourly rate
- **Why it matters**: Verifies casual continuity under post-2022 rules and the **accrual-period-average** hours methodology (NOT a 52-wk-only or 260-wk-only lookback).

**Inputs**

```yaml
employee:
  id: TC-WA-007
  legalName: CasualWATaking
  startDate: 2014-05-25                       # 12 yrs to 2026-05-25
  employmentType: casual
  statesOfService: [WA]
  governingJurisdiction: WA
  currentHourlyRate: 40.00                    # loaded casual rate (incl. casual loading per DEMIRS)
  hoursLast52Weeks: 1664                      # avg 32 h/wk
  hoursAccrualBlock1: 16640                   # first 10 yrs (2014-05-25 → 2024-05-25), avg 32 h/wk × 520 wks
  hoursAccrualBlock2:  3328                   # current 2-yr partial of second block, avg 32 h/wk × 104 wks
  wageHistory:
    - { periodStart: 2025-05-26, periodEnd: 2026-05-25, grossPay: 66560.00, frequency: other, periodDays: 365 }
  serviceEvents: []
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 8.6667 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 12.0000
total_entitlement_weeks: 10.4000             # 12 × 8.6667/10 — continuous accrual per TBD-WA-04 RESOLVED
weekly_avg_hours_block1: 32.00               # 16640 / 520 = 32 h/wk (first 10-yr accrual block)
value_of_week_block1: 1280.00                # 32 × $40
weekly_avg_hours_partial_block2: 32.00       # 3328 / 104 = 32 h/wk
value_of_week_partial_block2: 1280.00
value_of_week_taken: 1280.00                 # taking from block1 first per s.9 accrual-period methodology
payable_for_taken_leave: 11093.76            # 8.6667 × 1280
warnings:
  - { code: wa_regime_split_applied, message: "Service spans 20 June 2022. First accrual block (10 yrs ending 2024-05-25) fully accrued post-2022 — post-2022 continuous-service rules applied." }
expected_citations:
  - { section: WA LSL Act 1958 s.8(1), rule: accrual.qualifying-period-10yr, pdfPage: 65 }
  - { section: WA LSL Act 1958 s.6,    rule: continuous-service.casual-regular-systematic-post-2022, pdfPage: 69 }
  - { section: WA LSL Act 1958 s.9,    rule: ordinary-pay.casual-accrual-period-average-with-loading, pdfPage: 70 }
```

**Notes**

Per DEMIRS "Payment for long service leave" guidance: "If an employee's normal weekly number of hours of work have varied during a period of employment, the normal weekly number of hours is the average weekly hours worked by the employee during the accrual period (a period of employment means the accrual period for a long service leave entitlement rather than the entire period an employee has been employed with an employer)." The **accrual period** is the load-bearing concept here — averaging is done within each 10-yr or 5-yr accrual block, NOT over the entire tenure.

---

### TC-WA-008 — 7.5 yrs FT, 6 wks of paid LSL previously taken

- **Source**: APA p.71; WA LSL Act 1958 s.8(3) + s.9
- **Category**: Termination + prior leave deduction

**Inputs**

```yaml
employee:
  id: TC-WA-008
  startDate: 2018-11-25
  endDate: 2026-05-25                     # 7.5 yrs
  employmentType: full_time
  statesOfService: [WA]
  governingJurisdiction: WA
  currentWeeklyGross: 1600.00
  serviceEvents:
    - { type: paid_leave, startDate: 2024-05-01, endDate: 2024-06-12, note: "6 wks paid LSL previously taken" }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.5000
gross_entitlement_weeks: 6.5000          # 7.5 × 8.6667/10
less_leave_taken_weeks: 6.0000
total_entitlement_weeks: 0.5000
value_of_week: 1600.00
total_entitlement_dollars: 800.00
expected_citations:
  - { section: WA LSL Act 1958 s.8(3), rule: accrual.7-to-10yr.any-reason-except-misconduct, pdfPage: 71 }
  - { section: WA LSL Act 1958 s.9,    rule: ordinary-pay.fixed-rate, pdfPage: 66 }
```

**Notes**

Paid LSL previously taken (a `paid_leave` event of type LSL) is deducted from gross entitlement before payment — same convention as NSW (TC-NSW-002) and VIC (TC-VIC-014). Engine subtracts weeks, not dollars.

---

### TC-WA-009 — Long-tenure varied-hours PT with hours change at year 5

- **Source**: APA p.72; WA LSL Act 1958 s.9 — hours averaging
- **Category**: PT — varied hours; accrual-period averaging

**Inputs**

```yaml
employee:
  id: TC-WA-009
  startDate: 2014-05-25                   # 12 yrs to 2026-05-25
  endDate: 2026-05-25
  employmentType: part_time
  statesOfService: [WA]
  governingJurisdiction: WA
  currentHourlyRate: 35.00
  hoursAccrualBlock1: 13520                 # first 10 yrs — avg 26 h/wk × 520 wks
  hoursPartialBlock2:  2496                 # 2 yrs of second block — avg 24 h/wk × 104 wks (hours reduced)
  wageHistory: [/* periodised */]
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 12.0000
total_entitlement_weeks: 10.4000
weekly_avg_hours_block1: 26.00              # first-10-yr accrual block average
value_of_week_block1: 910.00                # 26 × $35
weekly_avg_hours_partial_block2: 24.00      # current 2-yr partial of second block
value_of_week_partial_block2: 840.00
# Engine applies block1 average to first 8.6667 wks, partial-block2 average to next 1.7333 wks
total_entitlement_dollars: 9341.69          # 8.6667×910 + 1.7333×840 = 7886.7 + 1455.97 = 9342.67 (rounded)
expected_citations:
  - { section: WA LSL Act 1958 s.9, rule: ordinary-pay.varied-hours-accrual-period-average, pdfPage: 72 }
```

**Notes**

The "accrual period" averaging is materially different from VIC's 3-tier (52w/260w/whole) and from QLD's single-52-week lookback. WA averages within each completed or partial accrual block. TBD-WA-06 RESOLVED: partial-block averaging covers the partial duration only — the partial second block is averaged from the second 10-yr-anniversary to the leave/termination date, not extrapolated to 5 yrs.

---

### TC-WA-010 — Walid-equivalent: apprentice → tradesperson re-employed within 52 wks

- **Source**: APA p.73 (Walid-equivalent for WA); WA LSL Act 1958 s.6 (apprentice/traineeship gaps)
- **Category**: Continuous service — apprentice transition
- **Why it matters**: DEMIRS lists "Apprenticeship/traineeship completion gaps (up to 52 weeks permitted)" — same 52-wk allowance as VIC's s.12(6)(c).

**Inputs**

```yaml
employee:
  id: TC-WA-010
  legalName: WalidWA
  startDate: 2018-07-01
  employmentType: full_time
  statesOfService: [WA]
  governingJurisdiction: WA
  currentWeeklyGross: 1900.00
  serviceEvents:
    - type: apprentice_to_tradesperson_transition
      startDate: 2024-06-30
      endDate:   2024-10-01
      note: "Apprenticeship ends; re-employed as qualified tradesperson within 13 wks — within 52-wk apprentice-transition allowance"
trigger: { kind: as_at, asAtDate: 2026-05-25 }
```

**Expected output**

```yaml
status: computed
prior_apprentice_service_preserved: true
days_in_gap_not_counted: 93                  # gap excluded from accrual, but continuity preserved
years_of_continuous_service: 7.6452          # elapsed less 93-day gap
total_entitlement_weeks: 6.6260
value_of_week: 1900.00
total_entitlement_dollars: 12589.40
warnings:
  - { code: accrued_not_currently_payable, message: "Accrued snapshot per as_at trigger; employee remains employed." }
expected_citations:
  - { section: WA LSL Act 1958 s.6, rule: continuous-service.apprentice-to-trade-within-52wks, pdfPage: 73 }
```

---

## §B — Sub-7-year and 7–10-year cases (s.8(3))

### TC-WA-011 — 6.99 yrs FT redundancy → $0 (sub-7yr threshold)

- **Source**: WA LSL Act 1958 s.8(3); DEMIRS — "less than 7 years … do not have an entitlement"
- **Category**: Negative — sub-7-yr threshold

**Inputs**

```yaml
employee:
  id: TC-WA-011
  startDate: 2019-06-01
  endDate: 2026-05-25                       # 6.98 yrs
  employmentType: full_time
  statesOfService: [WA]
  governingJurisdiction: WA
  currentWeeklyGross: 1800.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: redundancy }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 6.9802
total_entitlement_weeks: 0.0000
total_entitlement_dollars: 0.00
warnings:
  - { code: sub_7yr_no_entitlement_wa, message: "No LSL entitlement under WA LSL Act 1958 s.8(3) — sub-7-year service. Review applicable industrial instrument, EA, or contract — these may provide more favourable terms than the statutory minimum." }
expected_citations:
  - { section: WA LSL Act 1958 s.8(3), rule: accrual.sub-7yr-no-entitlement, pdfPage: 66 }
```

**Notes**

Same numeric outcome as VIC sub-7-yr and QLD sub-7-yr. Engine MUST cite WA LSL Act 1958 s.8(3) specifically. Reuses the cross-state `sub_7yr_*` warning pattern with WA-specific code suffix.

---

### TC-WA-012 — Exactly 7 yrs FT voluntary resignation → pro-rata payable

- **Source**: WA LSL Act 1958 s.8(3); boundary case
- **Category**: Boundary — 7-yr threshold inclusivity (parallel to TBD-VIC-06 / TBD-QLD-01 inclusivity)
- **Why it matters**: At exactly 7 yrs, voluntary resignation pays out — **WA divergence from NSW + QLD**, alignment with VIC.

**Inputs**

```yaml
employee:
  id: TC-WA-012
  startDate: 2019-05-25
  endDate: 2026-05-25                       # exactly 7 yrs
  employmentType: full_time
  statesOfService: [WA]
  governingJurisdiction: WA
  currentWeeklyGross: 1500.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.0000
total_entitlement_weeks: 6.0667
value_of_week: 1500.00
total_entitlement_dollars: 9100.05
expected_citations:
  - { section: WA LSL Act 1958 s.8(3), rule: accrual.7-to-10yr.any-reason-except-misconduct, pdfPage: 66 }
```

**Notes**

Threshold inclusivity at exactly 7.0000 yrs — same convention as VIC (TBD-VIC-06 RESOLVED inclusive) and QLD (TBD-QLD-01 RESOLVED inclusive). Engine: `years_of_continuous_service >= 7.0000`. TBD-WA-04 RESOLVED extends inclusivity to the 10-yr and 15-yr thresholds.

---

### TC-WA-013 — 6 yrs 364 days FT redundancy → $0

```yaml
employee: { id: TC-WA-013, startDate: 2019-05-26, endDate: 2026-05-25, /* 6.997 yrs */ employmentType: full_time, currentWeeklyGross: 1500.00 }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: redundancy }
expected:
  status: computed
  years_of_continuous_service: 6.9973
  total_entitlement_weeks: 0.0000
  total_entitlement_dollars: 0.00
```

---

### TC-WA-014 — 9 yrs FT dismissal not for misconduct → pro-rata payable

```yaml
employee: { startDate: 2017-05-25, endDate: 2026-05-25, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: employer_initiated_not_misconduct }
expected:
  total_entitlement_weeks: 7.8000
  total_entitlement_dollars: 14040.00
```

---

### TC-WA-015 — 8 yrs FT unfair dismissal → pro-rata payable

- **Source**: WA LSL Act 1958 s.8(3) — DEMIRS treats unfair dismissal as a qualifying termination unless serious misconduct is the substantiated reason
- **Category**: Pro-rata at termination — unfair dismissal

```yaml
trigger: { kind: termination, terminationDate: 2026-05-25, reason: unfair_dismissal }
expected:
  total_entitlement_weeks: 6.9333
```

**Notes**

In WA, `unfair_dismissal` is a sub-class of "dismissal not for serious misconduct" — qualifies under s.8(3). Compare QLD where `unfair_dismissal` qualifies via the specific s.95(3)(e). The engine accepts the cross-state enum value and routes WA to the s.8(3) general qualifying path.

---

### TC-WA-016 — 7.5 yrs FT illness resignation → pro-rata payable

```yaml
trigger: { kind: termination, terminationDate: 2026-05-25, reason: illness_incapacity }
extraInputs: { terminationInitiator: employee }
expected:
  total_entitlement_weeks: 6.5000
```

**Notes**

WA does NOT distinguish s.95(3)(b)/(c) sub-paragraphs as QLD does — both employee-initiated and employer-initiated illness termination qualify equivalently under the general s.8(3) "any reason except serious misconduct" rule. Engine accepts the `terminationInitiator` field but does not branch on it for WA.

---

### TC-WA-017 — 8 yrs FT domestic pressing necessity (employee resignation) → pro-rata payable

```yaml
trigger: { kind: termination, terminationDate: 2026-05-25, reason: domestic_pressing_necessity }
extraInputs: { terminationInitiator: employee }
expected:
  total_entitlement_weeks: 6.9333
```

---

### TC-WA-018 — 9 yrs FT poor-performance dismissal → pro-rata payable (NOT misconduct)

- **Source**: WA LSL Act 1958 s.8(3); DEMIRS — only serious misconduct disqualifies
- **Category**: Pro-rata at termination — performance dismissal (NOT misconduct)
- **Why it matters**: **WA divergence from QLD.** Under QLD s.95(3)(d), "capacity or performance" dismissal is EXCLUDED from pro-rata (TC-QLD-015). Under WA s.8(3), only "serious misconduct" disqualifies — poor performance does NOT bar pro-rata. This is the second-most-important misconduct-related divergence.

**Inputs**

```yaml
employee:
  id: TC-WA-018
  startDate: 2017-05-25
  endDate: 2026-05-25                       # 9 yrs
  employmentType: full_time
  statesOfService: [WA]
  governingJurisdiction: WA
  currentWeeklyGross: 1700.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: poor_performance }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 9.0000
total_entitlement_weeks: 7.8000
value_of_week: 1700.00
total_entitlement_dollars: 13260.00
expected_citations:
  - { section: WA LSL Act 1958 s.8(3), rule: accrual.7-to-10yr.poor-performance-qualifies, pdfPage: 67 }
```

**Notes**

This is the critical fixture proving WA's narrower misconduct exception. DEMIRS defines serious misconduct as "unacceptable or improper behaviour of a substantial nature" — poor performance per se does not satisfy that. Engine MUST treat `poor_performance` as qualifying in WA (contrast: blocking in QLD per TC-QLD-015).

---

## §C — 10+ year payout (s.8(1)/(3))

### TC-WA-019 — 10 yrs FT redundancy, full payout 8.6667 wks

```yaml
employee: { startDate: 2016-05-25, endDate: 2026-05-25, /* 10 yrs */ employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: redundancy }
expected:
  total_entitlement_weeks: 8.6667
  total_entitlement_dollars: 15600.06
```

---

### TC-WA-020 — 10 yrs FT voluntary resignation, full payout

```yaml
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
expected: { total_entitlement_weeks: 8.6667 }
```

---

### TC-WA-021 — 12 yrs FT death, continuous accrual payout 10.4 wks

```yaml
employee: { startDate: 2014-05-25, /* 12 yrs */ employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: death }
expected:
  total_entitlement_weeks: 10.4000          # 12 × 8.6667/10 — continuous accrual per TBD-WA-04
  payment_recipient: "legal personal representative"
```

---

### TC-WA-022 — 14 yrs FT redundancy, continuous accrual payout 12.1333 wks

```yaml
employee: { startDate: 2012-05-25, /* 14 yrs */ employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: redundancy }
expected:
  total_entitlement_weeks: 12.1334          # 14 × 8.6667/10
  total_entitlement_dollars: 20626.78
```

---

### TC-WA-023 — 11 yrs PT voluntary resignation

```yaml
employee: { startDate: 2015-05-25, employmentType: part_time, currentWeeklyGross: 800.00, normalWeeklyHours: 25 }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
expected:
  total_entitlement_weeks: 9.5333
  total_entitlement_dollars: 7626.64
```

---

## §D — Serious-misconduct treatment (the WA-unique matrix)

> **Critical WA divergence**: WA has the most complex misconduct treatment of any encoded state. At sub-10-yr → FULL forfeiture (parallel to NSW + QLD). At 10+ yrs → PARTIAL forfeiture: last fully-accrued block retained; accrual since that milestone forfeited. This is the only state with mid-band partial-forfeiture.

### TC-WA-024 — 9 yrs FT serious-misconduct → $0 (sub-10-yr full forfeiture)

```yaml
employee: { startDate: 2017-05-25, /* 9 yrs */ employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: serious_misconduct }
expected:
  total_entitlement_weeks: 0.0000
  warnings: [{ code: sub_10yr_misconduct_excluded_wa }]
```

---

### TC-WA-025 — 10 yrs 0 days FT serious-misconduct → 8.6667 wks (last block fully accrued, no excess since)

- **Source**: WA LSL Act 1958 s.8(3); DEMIRS — "only entitled to be paid for any part of a last fully accrued entitlement"
- **Category**: 10+ yr misconduct — boundary at exactly 10 yrs

**Inputs**

```yaml
employee:
  id: TC-WA-025
  startDate: 2016-05-25
  endDate: 2026-05-25                       # exactly 10 yrs
  employmentType: full_time
  currentWeeklyGross: 1800.00
trigger: { kind: termination, terminationDate: 2026-05-25, reason: serious_misconduct }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 10.0000
last_fully_accrued_block_weeks: 8.6667
accrual_since_last_milestone_weeks: 0.0000
forfeited_weeks: 0.0000
total_entitlement_weeks: 8.6667             # last fully-accrued block payable
total_entitlement_dollars: 15600.06
warnings:
  - { code: wa_10yr_plus_misconduct_partial_forfeiture, message: "Dismissal for serious misconduct at 10+ years. Last fully-accrued entitlement block (8.6667 wks at 10-yr milestone) is payable. Accrual since the last milestone is forfeited. WA-specific rule per LSL Act 1958 s.8(3)." }
expected_citations:
  - { section: WA LSL Act 1958 s.8(3), rule: trigger.termination.10yr-plus-misconduct-last-block-only, pdfPage: 67 }
```

**Notes**

At exactly the 10-yr milestone, the entire 8.6667 wks block has just fully accrued and there is zero pro-rata since then to forfeit. The forfeiture rule still applies in principle (the 0.0000 wks forfeited line) — the warning is emitted for transparency.

---

### TC-WA-026 — 12.5 yrs FT serious-misconduct → 8.6667 wks (last block from 10-yr milestone; 2.5 yrs of post-milestone accrual forfeited)

- **Source**: WA LSL Act 1958 s.8(3); DEMIRS — partial-forfeiture explicit
- **Category**: 10+ yr misconduct — mid-block (between 10-yr and 15-yr milestones)
- **Why it matters**: This is the **WA-unique mid-band partial-forfeiture** fixture. The employee retains the 10-yr block (8.6667 wks) but FORFEITS the 2.5 yrs of accrual that has not yet reached the 15-yr milestone (would have been 2.1667 additional weeks).

**Inputs**

```yaml
employee:
  id: TC-WA-026
  startDate: 2013-11-25                     # 12.5 yrs to 2026-05-25
  endDate: 2026-05-25
  employmentType: full_time
  currentWeeklyGross: 1800.00
trigger: { kind: termination, terminationDate: 2026-05-25, reason: serious_misconduct }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 12.5000
last_fully_accrued_block_weeks: 8.6667      # 10-yr milestone block
accrual_since_last_milestone_weeks: 2.1667  # 2.5 × 8.6667/10 — would have accrued; FORFEITED
forfeited_weeks: 2.1667
total_entitlement_weeks: 8.6667             # last fully-accrued block ONLY
total_entitlement_dollars: 15600.06
warnings:
  - { code: wa_10yr_plus_misconduct_partial_forfeiture, message: "Dismissal for serious misconduct at 12.5 years. Last fully-accrued entitlement block (8.6667 wks at the 10-year milestone) is payable. 2.1667 wks of accrual since that milestone has been forfeited under WA LSL Act 1958 s.8(3)." }
expected_citations:
  - { section: WA LSL Act 1958 s.8(3), rule: trigger.termination.10yr-plus-misconduct-last-block-only, pdfPage: 67 }
```

**Notes**

This is the WA-specific divergence from EVERY OTHER encoded state. NSW pays full at 10+; VIC pays full regardless; QLD pays full at 10+ (per resolved s.95(2) misconduct exception drop). Only WA carries the partial-forfeiture at 10+ via s.8(3) wording "only entitled to be paid for any part of a last fully accrued entitlement which has not been taken and is not entitled to receive payment of pro rata long service leave". TBD-WA-07 RESOLVED: compute as `(last_fully_accrued_block - leave_already_taken_against_that_block)`; forfeit post-milestone accrual entirely.

---

### TC-WA-027 — 15 yrs FT serious-misconduct → 13.0 wks (15-yr milestone just reached, both blocks fully accrued)

```yaml
employee: { startDate: 2011-05-25, endDate: 2026-05-25, /* exactly 15 yrs */ employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: serious_misconduct }
expected:
  last_fully_accrued_blocks_weeks: 13.0000   # 8.6667 (10-yr) + 4.3333 (15-yr) — both fully accrued
  accrual_since_last_milestone_weeks: 0.0000
  total_entitlement_weeks: 13.0000
  total_entitlement_dollars: 23400.00
```

**Notes**

At exactly 15 yrs, both the 10-yr block (8.6667 wks) and the 15-yr block (4.3333 wks) have fully accrued at the moment of termination. Both are payable under the partial-forfeiture rule — nothing has accrued since the 15-yr milestone, so nothing is forfeited.

---

## §E — Continuous-service edge cases — post-2022 (s.6 as amended 2022)

### TC-WA-028 — Voluntary resignation + 6-wk gap, prior service preserved (within 2-mo non-slackness re-employment)

- **Source**: WA LSL Act 1958 s.6 (as amended); DEMIRS — "Re-employment within 2 months (non-slackness terminations)"
- **Category**: Continuous service — employee-initiated rehire within 2 mo

**Inputs**

```yaml
employee:
  id: TC-WA-028
  startDate: 2017-05-25
  employmentType: full_time
  currentWeeklyGross: 1700.00
  serviceEvents:
    - type: employer_initiated_termination_and_rehire
      startDate: 2026-03-01
      endDate:   2026-04-12
      note: "Voluntary resignation; reinstated 6 wks later — within 2-mo window, prior service preserved"
trigger: { kind: as_at, asAtDate: 2026-05-25 }
```

**Expected output**

```yaml
status: computed
prior_service_preserved: true
days_in_gap_not_counted: 42
years_of_continuous_service: 8.8830
total_entitlement_weeks: 7.6997
warnings:
  - { code: accrued_not_currently_payable }
expected_citations:
  - { section: WA LSL Act 1958 s.6, rule: continuous-service.rehire-within-2mo-non-slackness, pdfPage: 36 }
```

---

### TC-WA-029 — Slackness-of-trade termination + 5-mo gap, prior service preserved (within 6-mo slackness re-employment)

- **Source**: WA LSL Act 1958 s.6 (as amended); DEMIRS — "Re-employment within 6 months (slackness-of-trade terminations)"
- **Category**: Continuous service — slackness-of-trade rehire within 6 mo
- **Why it matters**: WA-unique 6-mo tolerance specifically for slackness-of-trade terminations. NSW + VIC + QLD do not distinguish slackness-of-trade.

**Inputs**

```yaml
employee:
  id: TC-WA-029
  startDate: 2017-05-25
  employmentType: full_time
  currentWeeklyGross: 1700.00
  serviceEvents:
    - type: employer_initiated_termination_and_rehire
      startDate: 2025-09-01
      endDate:   2026-02-01
      slacknessOfTrade: true                   # signals 6-mo tolerance
      note: "Stood down due to slackness of trade; rehired 5 mo later — within 6-mo window"
trigger: { kind: as_at, asAtDate: 2026-05-25 }
```

**Expected output**

```yaml
status: computed
prior_service_preserved: true
days_in_gap_not_counted: 153
years_of_continuous_service: 8.5808
total_entitlement_weeks: 7.4366
expected_citations:
  - { section: WA LSL Act 1958 s.6, rule: continuous-service.rehire-within-6mo-slackness, pdfPage: 36 }
```

**Notes**

TBD-WA-08 — RESOLVED (deferred to DEV-CROSS-2): new optional `slacknessOfTrade?: boolean` field on the existing `employer_initiated_termination_and_rehire` event type, defaulting to `false`. Lands as part of the state-agnostic WA schema extension PR (DEV-CROSS-2) before WA engine code (T5.1) begins. Same pattern as DEV-CROSS-1.

---

### TC-WA-030 — Termination + 3-mo gap (non-slackness) → service resets

```yaml
employee: { startDate: 2014-05-25, employmentType: full_time }
serviceEvents:
  - type: employer_initiated_termination_and_rehire
    startDate: 2026-01-01
    endDate:   2026-04-01                     # 3-mo gap exceeds 2-mo non-slackness limit
    slacknessOfTrade: false
expected:
  prior_service_preserved: false
  service_start_used: 2026-04-01
  years_of_continuous_service: 0.1505
  warnings:
    - { code: gap_exceeds_state_tolerance, message: "Re-hire gap exceeded WA's 2-month limit (non-slackness termination) — prior service not preserved per WA LSL Act 1958 s.6." }
```

**Notes**

Reuses the cross-state `gap_exceeds_state_tolerance` warning code (introduced in VIC Phase 3 per TBD-VIC-03; reused in QLD Phase 4) with WA-specific message text "2 months". Same enum value across states.

---

### TC-WA-031 — Transfer of business post-2022 — service + accrued leave preserved

- **Source**: WA LSL Act 1958 s.6 (as amended 2022); DEMIRS — "From 20 June 2022, when a business changes ownership"
- **Category**: Continuous service — transfer of business under broader 2022 rules

```yaml
employee:
  id: TC-WA-031
  startDate: 2014-05-25                   # 12 yrs
  employmentType: full_time
  currentWeeklyGross: 1500.00
  serviceEvents:
    - type: transfer_of_business
      startDate: 2023-07-01                # post-2022 transfer
      note: "Business sold; Fair Work Act standards apply — accrued leave transfers with employee regardless of sale-of-business contract"
trigger: { kind: as_at, asAtDate: 2026-05-25 }
expected:
  years_of_continuous_service: 12.0000
  total_entitlement_weeks: 10.4000
  total_entitlement_dollars: 15600.00
```

**Notes**

Post-2022 transfer-of-business is BROADER than pre-2022 "transmission of business" wording. Specifically covers insourcing, outsourcing, and related-company arrangements per DEMIRS. Engine treats post-2022 `transfer_of_business` events as fully preserving continuity + accrued leave (no carve-out for contractual disclaimers).

---

### TC-WA-032 — Sickness/injury 30 days/yr post-2022 — counts in full (paid sick leave)

- **Source**: WA LSL Act 1958 s.6 (as amended 2022); DEMIRS — paid personal leave counts
- **Category**: Continuous service — sickness post-2022 (no 15-day cap)

```yaml
employee:
  id: TC-WA-032
  startDate: 2018-05-25
  employmentType: full_time
  currentWeeklyGross: 1700.00
  serviceEvents:
    - { type: paid_leave, startDate: 2023-07-01, endDate: 2023-07-30, note: "30 days paid sick leave (above former 15-day cap)" }
    - { type: paid_leave, startDate: 2024-08-01, endDate: 2024-08-30, note: "30 days paid sick leave" }
trigger: { kind: as_at, asAtDate: 2026-05-25 }
expected:
  days_excluded_from_service: 0          # post-2022: paid sickness counts in full
  years_of_continuous_service: 8.0000
  warnings:
    - { code: wa_regime_split_applied, message: "Service spans 20 June 2022. Accrual block fully accrued post-2022; post-2022 continuous-service rules applied — no 15-day sickness cap." }
expected_citations:
  - { section: WA LSL Act 1958 s.6, rule: continuous-service.paid-sickness-counts-post-2022, pdfPage: 36 }
```

---

### TC-WA-033 — Unpaid leave 8 weeks post-2022 — does NOT count but does NOT break continuity

```yaml
employee:
  id: TC-WA-033
  startDate: 2018-05-25
  serviceEvents:
    - { type: leave_without_pay, startDate: 2024-01-01, endDate: 2024-02-29, note: "8 wks unpaid leave — doesn't count toward accrual but no break" }
expected:
  days_excluded_from_service: 60
  years_of_continuous_service: 7.8358    # less 60-day exclusion
  continuity_preserved: true
```

---

### TC-WA-034 — Paid parental leave post-2022 — counts as service

```yaml
serviceEvents:
  - { type: unpaid_parental_leave, startDate: 2023-08-01, endDate: 2024-01-29, note: "26 wks paid parental leave (employer or Govt funded) — counts post-2022" }
expected:
  days_excluded_from_service: 0          # paid parental counts in full post-2022
```

---

### TC-WA-035 — Unpaid parental leave post-2022 (permanent) — does NOT count, but no break

```yaml
employee: { employmentType: full_time }
serviceEvents:
  - { type: unpaid_parental_leave, startDate: 2023-08-01, endDate: 2024-01-29, paid: false }
expected:
  days_excluded_from_service: 182
  continuity_preserved: true
```

**Notes**

Permanent employees on UNPAID parental leave: post-2022 rules still exclude UPL from accrual (matches general unpaid-leave treatment). The post-2022 expansion specifically benefited CASUAL/seasonal UPL where "reasonable expectation of return" applies — see TC-WA-052 below.

---

## §F — Continuous-service edge cases — pre-2022 (service whose accrual block fully accrued before 2022-06-20)

### TC-WA-036 — Sickness/injury 20 days/yr pre-2022 — only 15 days/yr count (cap applies)

- **Source**: WA LSL Act 1958 s.6 (pre-2022); DEMIRS pre-2022 guidance — 15-day cap
- **Category**: Continuous service — pre-2022 sickness cap
- **Why it matters**: Demonstrates the **single most material pre-vs-post-2022 numerical difference**. Pre-2022, sickness/injury was capped at 15 days/yr for continuity-counting purposes; excess did not count. Post-2022, no cap if paid.

**Inputs**

```yaml
employee:
  id: TC-WA-036
  startDate: 2005-05-25                     # 21 yrs to 2026-05-25
  endDate: 2026-05-25
  employmentType: full_time
  statesOfService: [WA]
  governingJurisdiction: WA
  currentWeeklyGross: 1600.00
  serviceEvents:
    - { type: paid_leave, startDate: 2010-07-01, endDate: 2010-07-20, note: "20 days paid sick (year 6, pre-2015 milestone) — 15 count, 5 excluded under pre-2022 cap" }
    - { type: paid_leave, startDate: 2012-08-01, endDate: 2012-08-20, note: "20 days paid sick (year 8, pre-2015 milestone) — 5 excluded" }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
days_excluded_from_service: 10              # 2 × 5 excess days under pre-2022 15-day cap
years_of_continuous_service: 20.9726
total_entitlement_weeks: 18.1762            # 20.9726 × 8.6667/10 — continuous accrual
warnings:
  - { code: wa_regime_split_applied, message: "Service spans 20 June 2022. First 10-yr block fully accrued 2015-05-25 (pre-2022); 15-day-per-year sickness cap applied. Subsequent 5-yr block fully accrued 2020-05-25 (also pre-2022). Second 5-yr block fully accrued 2025-05-25 (post-2022)." }
expected_citations:
  - { section: WA LSL Act 1958 s.6, rule: continuous-service.pre-2022.sickness-15-day-cap, pdfPage: 36 }
  - { section: WA LSL Act 1958 s.6, rule: continuous-service.post-2022.sickness-no-cap, pdfPage: 36 }
```

**Notes**

This fixture exercises the regime-split engine path materially. Sick days excluded under the pre-2022 cap; if these same days had fallen in a post-2022 accrual block they would have been fully counted (paid sickness). TBD-WA-09 RESOLVED: 15-day cap is "working days" proportionate to the employee's normal pattern (FT 5-day-week: 15 working days/year; PT 3-day-week: 9 working days/year; casual: based on prior 52-wk pattern). For this fixture employee (FT), this resolves to the days in the event.

---

### TC-WA-037 — UPL during pre-2022 block — does NOT count (no transitional rescue)

```yaml
employee:
  id: TC-WA-037
  startDate: 2010-05-25                     # 16 yrs to 2026-05-25
  endDate: 2026-05-25
  employmentType: full_time
  currentWeeklyGross: 1600.00
  serviceEvents:
    - { type: leave_without_pay, startDate: 2017-01-01, endDate: 2017-04-29, note: "4 mo UPL during 2010-2020 first-10-yr block — pre-2022 rules: excluded" }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
expected:
  days_excluded_from_service: 119
  years_of_continuous_service: 15.6743
  total_entitlement_weeks: 13.5843
```

---

### TC-WA-038 — Transfer of business pre-2022 — preserved per transmission-of-business rule

```yaml
employee:
  id: TC-WA-038
  startDate: 2014-05-25
  serviceEvents:
    - { type: transfer_of_business, startDate: 2020-07-01, note: "Pre-2022 transmission of business — preserved under former s.6" }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
expected:
  years_of_continuous_service: 12.0000
  total_entitlement_weeks: 10.4000
```

---

### TC-WA-039 — Casual employee with pre-2022 service: no specific casual rules apply pre-2022

- **Source**: DEMIRS — "there were no specific rules in place for determining casual and seasonal employees' continuous employment prior to June 2022"
- **Category**: Continuous service — pre-2022 casual gap, general s.6 applies

**Notes**

This is a subtle edge case: a casual employee whose first 10-yr accrual block fully accrued before 2022-06-20 has their pre-2022 continuity determined under the **general** s.6 rules (no specific casual continuity test). The post-2022 "regular and systematic / reasonable expectation" framework does not retroactively apply. TBD-WA-10 RESOLVED: apply the general 2-mo non-slackness / 6-mo slackness re-employment tolerances to any casual gap > 0 days for pre-2022 casual blocks. Engine surfaces the `wa_pre_2022_casual_no_specific_rules` advisory so the user is informed the engine's choice may be more restrictive than reality.

```yaml
employee:
  id: TC-WA-039
  startDate: 2010-05-25
  employmentType: casual
  serviceEvents:
    - { type: leave_without_pay, startDate: 2014-11-01, endDate: 2015-01-31, note: "3-mo casual gap during pre-2015 (pre-2022) block — exceeds 2-mo general limit" }
expected:
  pre_2022_casual_continuity_broken: true
  service_start_used: 2015-02-01
  warnings:
    - { code: wa_pre_2022_casual_no_specific_rules, message: "Casual gap of 3 months falls within a pre-2022 accrual block. Pre-2022 WA LSL Act had no specific casual continuity rules; the general 2-month re-employment rule applies. Prior casual service before this gap not preserved." }
```

---

## §G — Regime-split fixtures (service straddles 2022-06-20)

> These fixtures exercise the dual-regime engine path materially. PM has resolved TBD-WA-01 to option (b) — single rule set with date-aware continuous-service handling. Expected outputs reflect that resolution.

### TC-WA-040 — 13-yr employee straddling 2022-06-20, no absences → numerical outcome identical to single-regime

- **Source**: spec F7 / AC7; impl-plan v0.3.2 §5 (re-scoped per TBD-WA-01 RESOLUTION)
- **Category**: Regime split — identical-outcome path

**Inputs**

```yaml
employee:
  id: TC-WA-040
  startDate: 2013-05-25                     # 13 yrs to 2026-05-25 — first 10-yr block fully accrued 2023-05-25 (post-2022)
  endDate: 2026-05-25
  employmentType: full_time
  currentWeeklyGross: 1800.00
  serviceEvents: []                          # no absences — split has no numerical effect
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 13.0000
total_entitlement_weeks: 11.2667           # 13 × 8.6667/10 — continuous accrual
total_entitlement_dollars: 20280.06
warnings:
  - { code: wa_regime_split_applied, message: "Service spans 20 June 2022. First 10-yr accrual block fully accrued 2023-05-25 (post-2022 rules apply); subsequent 3-yr accrual is on a partial second block, also under post-2022 rules. No absences — regime split has no numerical effect for this employee." }
expected_citations:
  - { section: WA LSL Act 1958 s.8(1), rule: accrual.qualifying-period-10yr, pdfPage: 65 }
  - { section: WA LSL Act 1958 s.6,    rule: continuous-service.post-2022, pdfPage: 36 }
```

**Notes**

Emits the regime-split warning for transparency even though the numerical outcome is identical to a hypothetical single-regime calculation. **This is the operational contract** — the warning surfaces the engine's split-handling, not the absence of one.

---

### TC-WA-041 — 18-yr employee, first-10-yr block fully accrued pre-2022, second 5-yr block fully accrued post-2022 — regime split is material

- **Source**: spec F7 / AC7; impl-plan §5
- **Category**: Regime split — material outcome difference

**Inputs**

```yaml
employee:
  id: TC-WA-041
  startDate: 2008-05-25                     # 18 yrs to 2026-05-25
  endDate: 2026-05-25
  employmentType: full_time
  currentWeeklyGross: 1700.00
  serviceEvents:
    - { type: paid_leave, startDate: 2012-07-01, endDate: 2012-07-30, note: "30 days paid sick within first 10-yr block (fully accrued 2018-05-25, pre-2022) — pre-2022 15-day cap applies, 15 days excluded" }
    - { type: paid_leave, startDate: 2024-06-01, endDate: 2024-06-30, note: "30 days paid sick within second 5-yr block (fully accrued 2023-05-25, pre-2022) — same pre-2022 rules, 15 days excluded" }
    - { type: paid_leave, startDate: 2025-09-01, endDate: 2025-09-30, note: "30 days paid sick within third partial block (post-2022) — no cap, fully counted" }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
days_excluded_from_service: 30              # 15 from first block + 15 from second block (cap); 0 from third block (post-2022)
years_of_continuous_service: 17.9179
total_entitlement_weeks: 15.5288            # 17.9179 × 8.6667/10
value_of_week: 1700.00
total_entitlement_dollars: 26398.96
warnings:
  - { code: wa_regime_split_applied, message: "Service spans 20 June 2022. First 10-yr block (fully accrued 2018-05-25) and 5-yr block (fully accrued 2023-05-25) governed by pre-2022 sickness 15-day cap. Subsequent partial block governed by post-2022 rules (no cap). 30 days of paid sick excluded under pre-2022 cap; 30 days counted in full under post-2022 rules." }
expected_citations:
  - { section: WA LSL Act 1958 s.6, rule: continuous-service.pre-2022.sickness-15-day-cap, pdfPage: 36 }
  - { section: WA LSL Act 1958 s.6, rule: continuous-service.post-2022.sickness-no-cap, pdfPage: 36 }
  - { section: WA LSL Act 1958 s.8(1), rule: accrual.qualifying-period-10yr, pdfPage: 65 }
```

**Notes**

This is the **diagnostic regime-split fixture**. Under TBD-WA-01 RESOLVED option (b) — single rule set with date-aware continuous-service handling — the days_excluded_from_service value is 30 (15+15+0); a single accrual table runs across the entire 17.92 yrs of countable service.

---

### TC-WA-042 — 11-yr employee, first 10-yr block fully accrued ON 2022-06-20

```yaml
employee: { startDate: 2012-06-20, /* first 10-yr block fully accrued 2022-06-20 */, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
expected:
  first_block_accrual_date: 2022-06-20
  first_block_rules: post_2022                # accrued ON the cutoff — post-2022 rules apply per "on or after 20 June 2022" strict reading (TBD-WA-11 RESOLVED)
  years_of_continuous_service: 13.9233
  total_entitlement_weeks: 12.0668
```

**Notes**

TBD-WA-11 (boundary inclusivity) RESOLVED: when an accrual block fully accrued at midnight on 2022-06-20, post-2022 rules apply (strict reading of the DEMIRS "on or after 20 June 2022" phrasing — the boundary date itself is in the post-2022 set). Mirror question to TBD-WA-04 inclusivity at year-boundary thresholds — note the convention differs because the statutory wording differs (year-boundaries are "completed N years" inclusive at N.0000 in the qualifying set; the 2022 cutoff is "on or after" inclusive of the boundary date in the post-2022 set).

---

### TC-WA-043 — 11-yr employee, first 10-yr block fully accrued just after 2022-06-20

```yaml
employee: { startDate: 2012-06-21, /* first 10-yr block fully accrued 2022-06-21 */ }
expected:
  first_block_rules: post_2022                 # accrued one day AFTER the cutoff
```

---

## §H — Insufficient-granularity fallback (spec AC8)

### TC-WA-044 — Tenure straddles 2022-06-20 but wage history is annual-only → fallback to single-regime (post-2022)

- **Source**: spec F7 / AC8; impl-plan §5
- **Category**: Regime-split fallback — insufficient data granularity

**Inputs**

```yaml
employee:
  id: TC-WA-044
  startDate: 2015-05-25
  employmentType: full_time
  currentWeeklyGross: 1700.00
  wageHistory:
    - { periodStart: 2015-05-25, periodEnd: 2026-05-25, grossPay: 940000.00, frequency: annual_aggregate, note: "Single 11-yr aggregate — no monthly/quarterly breakdown to verify pre vs post 2022 milestone exposure" }
  serviceEvents:
    - { type: paid_leave, startDate: 2021-12-01, endDate: 2021-12-30, note: "30 days sick — but data granularity insufficient to confirm whether this was during a pre or post 2022 accrual block" }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
regime_split_data_insufficient: true
fallback_rules_used: post_2022
years_of_continuous_service: 11.0000         # all 30 days excluded under post-2022 rules — paid sick counts in full → 0 excluded
total_entitlement_weeks: 9.5333
total_entitlement_dollars: 16206.61
warnings:
  - { code: wa_regime_split_data_insufficient, message: "Service spans 20 June 2022 but the supplied wage history lacks the date granularity to determine the pre/post 2022 status of historical absences. The engine has applied post-2022 continuous-service rules to the entire tenure as a single-regime fallback. To obtain the dual-regime calculation, re-upload with at least monthly wage-history granularity." }
expected_citations:
  - { section: WA LSL Act 1958 s.6, rule: continuous-service.post-2022, pdfPage: 36 }
```

**Notes**

The single-regime fallback is **post-2022 rules** (the rules currently in force). This is the most user-favourable choice (post-2022 rules are generally more permissive than pre-2022) and aligns with the default-to-current-law convention. The warning makes the fallback explicit — the user is informed they can re-upload with finer-grained data to access the dual-regime calculation.

---

### TC-WA-045 — Long-tenure employee with paid-sick events but no per-day breakdown → fallback + advisory

```yaml
employee: { startDate: 2010-01-01, currentWeeklyGross: 1600.00 }
serviceEvents: [{ type: paid_leave, year: 2018, totalSickDays: 25, note: "Aggregate sick days for 2018 — engine cannot determine which 5-day block straddles a milestone" }]
expected:
  regime_split_data_insufficient: true
  fallback_rules_used: post_2022
  warnings:
    - { code: wa_regime_split_data_insufficient }
```

---

## §I — Workers Comp (s.6 + WCIM Act 2023)

### TC-WA-046 — WC absence ENTIRELY pre-2024-07-01, entitlement fully accrued post-2022 → does NOT count

- **Source**: WA LSL Act 1958 s.6 (post-2022); DEMIRS — WC pre-2024 + post-2022 accrual
- **Category**: WC — pre-2024 absence + post-2022 accrual block

**Inputs**

```yaml
employee:
  id: TC-WA-046
  startDate: 2015-05-25                       # first 10-yr block fully accrued 2025-05-25 (post-2022)
  endDate: 2026-05-25
  employmentType: full_time
  currentWeeklyGross: 1700.00
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2023-09-01, endDate: 2024-02-29, note: "6 mo WC absence entirely pre-2024-07-01, during post-2022 accrual block" }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
days_excluded_from_service: 182              # all 6 mo of WC excluded (no concurrent paid leave, no RTW program)
years_of_continuous_service: 10.5014
total_entitlement_weeks: 9.1013
total_entitlement_dollars: 15472.21
warnings:
  - { code: wa_workers_comp_pre_2024_excluded, message: "Workers compensation absence from 2023-09-01 to 2024-02-29 (entirely pre-2024-07-01) — does not count toward continuous employment under WA LSL Act 1958 s.6 for entitlements accrued on/after 20 June 2022 (WCIM Act 2023 confers counting only from 1 July 2024 onward)." }
  - { code: wa_regime_split_applied }
expected_citations:
  - { section: WA LSL Act 1958 s.6, rule: continuous-service.workers-comp-pre-2024-excluded, pdfPage: 36 }
  - { section: WCIM Act 2023 (WA), rule: workers-comp-counts-from-2024-07-01 }
```

---

### TC-WA-047 — WC absence ENTIRELY post-2024-07-01 → counts in full

- **Source**: WCIM Act 2023 (WA); DEMIRS — "An absence from work on income compensation on or after 1 July 2024 counts towards the length of an employee's period of continuous employment"
- **Category**: WC — post-2024 absence

**Inputs**

```yaml
employee:
  id: TC-WA-047
  startDate: 2015-05-25
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2024-08-01, endDate: 2025-01-29, note: "6 mo WC entirely post-2024-07-01 — counts in full" }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
days_excluded_from_service: 0
years_of_continuous_service: 11.0000
total_entitlement_weeks: 9.5333
total_entitlement_dollars: 16206.61
expected_citations:
  - { section: WCIM Act 2023 (WA), rule: workers-comp-counts-from-2024-07-01 }
```

---

### TC-WA-048 — WC absence SPANNING 2024-07-01 → partial counted (post-cutoff portion counts, pre-cutoff excluded)

- **Source**: WCIM Act 2023 (WA); DEMIRS — date-of-absence cutoff
- **Category**: WC — straddling 2024-07-01

**Inputs**

```yaml
employee:
  id: TC-WA-048
  startDate: 2014-05-25
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2024-04-01, endDate: 2024-09-30, note: "6 mo WC straddling 2024-07-01 — 91 days pre-cutoff excluded, 92 days post-cutoff counted" }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
days_excluded_from_service: 91               # 2024-04-01 → 2024-06-30 pre-cutoff
days_counted_as_service: 92                  # 2024-07-01 → 2024-09-30 post-cutoff
years_of_continuous_service: 11.7508
total_entitlement_weeks: 10.1843
warnings:
  - { code: wa_workers_comp_pre_2024_excluded, message: "Workers compensation absence partially pre-2024-07-01: 91 days excluded from continuous employment (pre-WCIM Act 2023 commencement); 92 days post-cutoff counted in full." }
```

**Notes**

**Critical engine logic**: the WCIM Act 2023 cutoff (2024-07-01) applies to the **date of the absence**, NOT to the date the entitlement accrued. This is independent of the 20 June 2022 cutoff (which applies to the date the entitlement BLOCK fully accrued). The engine must apply BOTH cutoffs independently.

---

### TC-WA-049 — WC absence pre-2024 with concurrent paid leave → counts (paid-leave concurrence exception)

- **Source**: DEMIRS — "unless the employee was receiving paid annual leave or long service leave while receiving workers compensation"
- **Category**: WC — paid-concurrent exception

```yaml
serviceEvents:
  - { type: workers_comp_absence, startDate: 2024-03-01, endDate: 2024-06-30, paidConcurrent: true, note: "WC + paid annual leave concurrent — counts under DEMIRS exception" }
expected:
  days_excluded_from_service: 0
  warnings:
    - { code: wa_workers_comp_paid_concurrent, message: "Workers compensation absence overlapped paid leave — counts as continuous employment per WA LSL Act 1958 s.6 exception (employee receiving paid leave concurrent with WC)." }
```

**Notes**

TBD-WA-12 — RESOLVED (deferred to DEV-CROSS-2): new optional fields on the `workers_comp_absence` event type (`paidConcurrent?: boolean`, `returnToWorkProgram?: boolean`). Both default `false`. Lands as part of DEV-CROSS-2 before WA T5.1 begins.

---

## §J — Casual employees — post-2022

### TC-WA-050 — Casual 8 yrs continuous with seasonal absences (post-2022 reasonable-expectation test)

- **Source**: WA LSL Act 1958 s.6 (as amended 2022); DEMIRS — casuals & seasonal post-2022
- **Category**: Casual — post-2022 continuity preserved despite seasonal gaps

```yaml
employee:
  id: TC-WA-050
  startDate: 2018-05-25
  employmentType: casual
  currentHourlyRate: 38.00                   # incl. loading
  hoursAccrualBlock1: 8736                   # 8 yrs of avg 21 h/wk (seasonal worker — fewer hours per week than full FT casual)
  serviceEvents:
    - { type: leave_without_pay, startDate: 2023-11-01, endDate: 2024-03-31, note: "Seasonal absence — under post-2022 s.6, casual continuity preserved despite 5-mo gap due to reasonable expectation of return" }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
casual_continuity_preserved: true
years_of_continuous_service: 8.0000
days_excluded_from_service: 152              # seasonal absence excluded from accrual but continuity unbroken
total_entitlement_weeks: 6.5793
weekly_avg_hours: 21.00                      # accrual-period average
value_of_week: 798.00                        # 21 × 38
total_entitlement_dollars: 5250.30
expected_citations:
  - { section: WA LSL Act 1958 s.6, rule: continuous-service.casual-seasonal-reasonable-expectation-post-2022, pdfPage: 35 }
  - { section: WA LSL Act 1958 s.9, rule: ordinary-pay.casual-loaded-rate-accrual-period-avg, pdfPage: 70 }
```

---

### TC-WA-051 — Casual 12 yrs taking 8.6667 wks, accrual-period averaging

```yaml
employee: { startDate: 2014-05-25, employmentType: casual, currentHourlyRate: 40.00, hoursAccrualBlock1: 16640, hoursPartialBlock2: 3328 }
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 8.6667 }
expected:
  total_entitlement_weeks_accrued: 10.4000
  weeks_taken: 8.6667
  weeks_remaining: 1.7333
  value_of_week: 1280.00                    # accrual-block-1 average rate
  payable_for_taken_leave: 11093.76
```

---

### TC-WA-052 — Casual post-2022, unpaid parental leave with reasonable expectation → counts

- **Source**: DEMIRS post-2022 casual — "parental leave for which a casual employee did not receive payment is an absence that counts towards continuous employment for long service leave where an employee has a reasonable expectation of returning to work"

```yaml
employee: { employmentType: casual, startDate: 2020-05-25 }
serviceEvents:
  - { type: unpaid_parental_leave, startDate: 2024-08-01, endDate: 2025-01-29, paid: false, reasonableExpectationOfReturn: true, note: "Casual unpaid parental — post-2022 counts due to expectation" }
expected:
  days_excluded_from_service: 0              # post-2022 casual rule — counts
```

**Notes**

TBD-WA-13 — RESOLVED (deferred to DEV-CROSS-2): new optional `reasonableExpectationOfReturn?: boolean` field on `unpaid_parental_leave` events. Defaults to `false`. The user (or pre-fill from prior employment-pattern analysis) asserts the expectation. Lands as part of DEV-CROSS-2 before WA T5.1 begins.

---

### TC-WA-053 — Casual 7 yrs voluntary resignation → pro-rata payable

```yaml
employee: { startDate: 2019-05-25, employmentType: casual, currentHourlyRate: 40.00, hoursAccrualBlock1: 9100 /* 7 yrs × ~25 h/wk × 52 */ }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
expected:
  years_of_continuous_service: 7.0000
  total_entitlement_weeks: 6.0667
  weekly_avg_hours: 25.00
  value_of_week: 1000.00
  total_entitlement_dollars: 6066.69
```

**Notes**

WA casual at 7-yr boundary qualifies the same as any other employee under s.8(3) — voluntary resignation pays out pro-rata. Aligns with VIC s.9, diverges from QLD s.95(3) (which requires a qualifying reason).

---

## §K — Casual — pre-2022

### TC-WA-054 — Casual employee whose entire tenure pre-dates 2022-06-20

- **Source**: DEMIRS — pre-2022 no specific casual continuity rules

```yaml
employee: { startDate: 2010-05-25, employmentType: casual, endDate: 2020-05-25 /* tenure entirely pre-2022 */ }
trigger: { kind: as_at, asAtDate: 2026-05-25 }   # historical reconstruction
expected:
  warnings:
    - { code: wa_pre_2022_casual_no_specific_rules, message: "Casual employment tenure entirely pre-2022-06-20. WA LSL Act 1958 (as in force pre-amendment) had no specific casual continuity rules — general s.6 absences-counted/not-counted regime applies. Gap tolerances: 2 months (non-slackness), 6 months (slackness of trade)." }
```

---

## §L — Ordinary pay (s.9)

### TC-WA-055 — Fixed-rate FT (s.9) — current weekly rate at leave time

```yaml
employee: { id: TC-WA-055, employmentType: full_time, currentWeeklyGross: 2000.00, /* stable for full tenure */ }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
expected:
  value_of_week: 2000.00                     # s.9 fixed rate
expected_citations:
  - { section: WA LSL Act 1958 s.9, rule: ordinary-pay.fixed-rate }
```

---

### TC-WA-056 — Varied-hours PT, accrual-period averaging within first 10-yr block

```yaml
employee: { startDate: 2016-05-25, employmentType: part_time, hoursAccrualBlock1: 13520 /* avg 26 h/wk */, currentHourlyRate: 35.00 }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
expected:
  weekly_avg_hours: 26.00
  value_of_week: 910.00
```

---

### TC-WA-057 — Commission-only employee — 365-day average per DEMIRS

- **Source**: DEMIRS — results-based pay: "average weekly rate earned by the employee during the previous 365 days"
- **Category**: Commission

```yaml
employee:
  id: TC-WA-057
  startDate: 2014-05-25
  employmentType: full_time
  commissionEarningsLast365Days: 84000.00     # average $1,615.38/wk
  wageHistory: [/* 365-day rolling window */]
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
expected:
  value_of_week: 1610.96                     # 84000 / 365 × 7
  total_entitlement_weeks: 10.4000
  total_entitlement_dollars: 16753.98
expected_citations:
  - { section: WA LSL Act 1958 s.9, rule: ordinary-pay.results-based-pay-365-day-average }
```

---

### TC-WA-058 — Piecework employee — 365-day average

```yaml
expected:
  value_of_week_method: 365-day-average
```

---

### TC-WA-059 — Casual loaded rate — incl. casual loading per s.9 (as amended 2022)

```yaml
employee: { employmentType: casual, currentHourlyRate: 40.00 /* incl. 25% loading */, hoursLast52Weeks: 1664 }
expected:
  weekly_avg_hours: 32.00
  value_of_week: 1280.00                     # loaded rate × avg hours
```

---

### TC-WA-060 — Allowances and meals/accommodation cash value — included where normally provided

- **Source**: DEMIRS — "may include the cash value of meals/accommodation normally provided"

```yaml
employee:
  id: TC-WA-060
  currentWeeklyGross: 1800.00
  mealsAndAccommodationCashValueWeekly: 120.00   # normally provided when working
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 8.6667 }
expected:
  value_of_week: 1920.00                     # 1800 + 120 (meals/accom not provided during leave)
```

**Notes**

TBD-WA-14 — RESOLVED (deferred to DEV-CROSS-2): new optional `mealsAndAccommodationCashValueWeekly?: number` field on `Employee`. If user-supplied AND normally provided (asserted by user), add to weekly gross for LSL computation. Defaults to 0. Lands as part of DEV-CROSS-2 before WA T5.1 begins.

---

## §M — 15-year continuous accrual

### TC-WA-061 — Exactly 15 yrs FT voluntary resignation → 13.0 wks (full payout)

```yaml
employee: { startDate: 2011-05-25, /* exactly 15 yrs */ employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
expected:
  total_entitlement_weeks: 13.0000           # 8.6667 + 4.3333
  total_entitlement_dollars: 23400.00
```

---

### TC-WA-062 — 13 yrs FT voluntary resignation → 11.2667 wks (continuous accrual between 10-yr and 15-yr milestones)

```yaml
employee: { startDate: 2013-05-25, /* 13 yrs */ }
expected:
  total_entitlement_weeks: 11.2667           # 13 × 8.6667/10 — continuous
```

**Notes**

Continuous accrual between milestones (parallel to QLD TBD-QLD-01 RESOLVED continuous reading). NOT a discrete step — the 13-week figure at 15 yrs is the arithmetic outcome of 15 × 8.6667/10 = 13.00005, not a separate accrual step. TBD-WA-04 RESOLVED confirms this for WA.

---

## §N — Cashing out (s.5)

### TC-WA-063 — 12 yrs cash-out request → ADVISORY (non-blocking) + computed value

- **Source**: WA LSL Act 1958 s.5 (as amended 2022); DEMIRS — cash-out post-accrual only
- **Category**: Cashing out — post-accrual, lawful

```yaml
employee: { startDate: 2014-05-25, /* 12 yrs */ employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: cash_out, cashOutDate: 2026-05-25, cashOutWeeks: 4.0 }
expected:
  status: computed
  cashed_out_weeks: 4.0000
  value_of_week: 1800.00
  cashed_out_dollars: 7200.00
  warnings:
    - { code: wa_cashout_post_accrual_advisory, message: "Cashing out of long service leave under WA LSL Act 1958 s.5 (as amended 2022) is permitted ONLY after the entitlement has been fully accrued (10-yr or subsequent 5-yr milestone). Must be a written agreement signed by both employer and employee. Employee must be paid at least what they would have received at ordinary pay. Employer must keep records." }
expected_citations:
  - { section: WA LSL Act 1958 s.5, rule: cash-out.post-accrual-written-agreement }
```

**Notes**

Aligns with QLD's non-blocking advisory model (contrast VIC's hard error). The advisory is the engine's compliance signal — the cash-out value is computed, but the legal authority is the user's responsibility.

---

### TC-WA-064 — 9 yrs cash-out attempt (pre-first-milestone) → ADVISORY: not yet authorised

```yaml
employee: { startDate: 2017-05-25, /* 9 yrs — below first 10-yr milestone */ }
trigger: { kind: cash_out, cashOutDate: 2026-05-25, cashOutWeeks: 2.0 }
expected:
  status: computed
  cashed_out_weeks: 2.0000
  value_of_week: 1700.00
  cashed_out_dollars: 3400.00
  warnings:
    - { code: wa_cashout_pre_accrual_not_authorised, message: "Cashing out before the first 10-year accrual milestone is not authorised under WA LSL Act 1958 s.5 (as amended 2022). The calculator has computed the dollar value as requested, but the cash-out cannot be lawfully effected until the employee completes their first 10-year accrual block." }
```

**Notes**

Engine computes the value but warns the user the transaction is not authorised. TBD-WA-15 RESOLVED: advisory (status: computed + warning), parallel to QLD's universal advisory model. The engine does not police legality; it informs.

---

### TC-WA-065 — 6 yrs cash-out attempt → $0 + double-advisory

```yaml
employee: { startDate: 2020-05-25, /* 6 yrs — sub-7-yr */ }
trigger: { kind: cash_out, cashOutDate: 2026-05-25 }
expected:
  status: computed
  cashed_out_weeks: 0.0000
  cashed_out_dollars: 0.00
  warnings:
    - { code: sub_7yr_no_entitlement_wa }
    - { code: wa_cashout_no_entitlement_to_cash_out }
```

---

## §O — Public holiday during LSL (s.9)

### TC-WA-066 — WA Day PH falls during LSL → extends leave by 1 day

```yaml
employee: { id: TC-WA-066, /* 12-yr FT */ }
trigger:
  kind: taking_leave
  leaveStartDate: 2026-06-01                  # Mon
  leaveWeeks: 1
extraInputs:
  publicHolidaysInWindow: [2026-06-01]         # WA Day (first Monday in June)
expected:
  lsl_days_consumed: 4                        # Tue-Fri of that week — Mon is PH
  calendar_leave_end_date: 2026-06-08
expected_citations:
  - { section: WA LSL Act 1958 s.9, rule: trigger.taking-leave.public-holiday-exclusive }
```

**Notes**

DEMIRS verbatim: "If a public holiday falls during LSL and the employee would otherwise be entitled to that public holiday, WA guidance says the LSL period is increased by one day for each such public holiday." Identical PH-exclusive behaviour to NSW, VIC, QLD.

---

## §P — As-at snapshot trigger

### TC-WA-067 — 5 yrs as-at → 4.3333 wks accrued (regardless of payout eligibility)

```yaml
employee: { startDate: 2021-05-25, /* 5 yrs */ employmentType: full_time, currentWeeklyGross: 1500.00 }
trigger: { kind: as_at, asAtDate: 2026-05-25 }
expected:
  total_entitlement_weeks: 4.3334            # 5 × 8.6667/10
  payable_indicator: "accrued, not currently payable"
  warnings:
    - { code: accrued_not_currently_payable }
```

---

### TC-WA-068 — 11 yrs as-at → 9.5333 wks (above qualifying threshold)

```yaml
expected: { total_entitlement_weeks: 9.5333, payable_indicator: "payable" }
```

---

## §Q — Cross-jurisdiction

### TC-WA-069 — WA + NSW service, NSW nominated → routed to NSW engine

```yaml
employee: { statesOfService: [WA, NSW], governingJurisdiction: NSW }
expected:
  state_used: NSW
  warnings:
    - { code: cross_jurisdiction_pending, message: "Employee has worked in WA and NSW. The sufficiently connected test (legal judgement — see APA LSL Masterclass p.138) is for legal counsel where doubt exists. Engine has computed using user-nominated governing jurisdiction: NSW." }
```

---

### TC-WA-070 — WA + VIC service, governing NOT nominated → BLOCKED

```yaml
employee: { statesOfService: [WA, VIC], governingJurisdiction: null }
expected:
  status: blocked_cross_jurisdiction
  outputs: null
  warnings: [{ code: cross_jurisdiction_pending }]
```

---

# Bulk-mode test cases

### TC-WA-BULK-001 — 5-employee WA-only fixture, mixed tenures and triggers

```csv
employee_id,row_type,state,start_date,employment_type,trigger,trigger_date,gross_pay,period_frequency,reason
W01,pay_period,WA,2014-05-25,full_time,as_at,2026-05-25,98000.00,weekly,                          # 12 yr FT
W02,pay_period,WA,2018-05-25,full_time,termination,2026-05-25,78000.00,weekly,voluntary_resignation # 8 yr FT resignation → pro-rata (WA divergence from NSW/QLD)
W03,pay_period,WA,2017-05-25,part_time,as_at,2026-05-25,39000.00,weekly,                           # 9 yr PT as-at
W04,pay_period,WA,2015-05-25,casual,termination,2026-05-25,55000.00,other,voluntary_resignation    # 11 yr casual → full payout
W05,pay_period,WA,2020-05-25,full_time,termination,2026-05-25,78000.00,weekly,serious_misconduct   # 6 yr misconduct → $0
```

**Expected output**

```yaml
total_rows: 5
status_breakdown: { computed: 5, blocked: 0, failed: 0 }
row_results:
  W01: { state_used: WA, total_entitlement_weeks: 10.4000, dollars: 19600.00, warnings: [{ code: wa_regime_split_applied }] }
  W02: { state_used: WA, total_entitlement_weeks: 6.9333,  dollars: 10399.95 }    # resignation = qualifying in WA
  W03: { state_used: WA, total_entitlement_weeks: 7.8000,  dollars: 5850.00 }
  W04: { state_used: WA, total_entitlement_weeks: 9.5333,  dollars: 10086.62 }    # 11yr casual, loaded rate
  W05: { state_used: WA, total_entitlement_weeks: 0.0000,  dollars: 0.00 }        # sub-10-yr misconduct → $0
all_rows_have_state_used_WA: true
```

---

### TC-WA-BULK-002 — 10-employee mixed NSW + VIC + QLD + WA, with case-normalisation

```csv
employee_id,row_type,state,start_date,employment_type,trigger,trigger_date,...
NVQW01,pay_period,NSW,2014-05-25,full_time,as_at,2026-05-25,...
NVQW02,pay_period,VIC,2018-05-25,full_time,as_at,2026-05-25,...
NVQW03,pay_period,QLD,2015-05-25,casual,as_at,2026-05-25,...
NVQW04,pay_period,WA,2014-05-25,full_time,as_at,2026-05-25,...
NVQW05,pay_period,wa,2017-05-25,part_time,as_at,2026-05-25,...           # lowercase — normalise
NVQW06,pay_period,WA,2014-05-25,full_time,termination,2026-05-25,...,reason=serious_misconduct  # 12 yr misconduct → PARTIAL (last block)
NVQW07,pay_period,WA,2018-05-25,full_time,termination,2026-05-25,...,reason=serious_misconduct  # 8 yr misconduct → $0
NVQW08,pay_period,,2019-05-25,full_time,as_at,2026-05-25,...              # EMPTY state — validation error
NVQW09,pay_period,XYZ,2019-05-25,full_time,as_at,2026-05-25,...           # UNRECOGNISED — validation error
NVQW10,pay_period,WA,2017-05-25,full_time,termination,2026-05-25,...,reason=voluntary_resignation  # 9 yr resignation → PAYABLE (WA divergence)
```

**Expected output**

```yaml
total_rows: 10
status_breakdown: { computed: 8, blocked: 0, failed: 2 }
row_results:
  NVQW01: { state_used: NSW, status: computed }
  NVQW02: { state_used: VIC, status: computed }
  NVQW03: { state_used: QLD, status: computed }
  NVQW04: { state_used: WA, status: computed }
  NVQW05: { state_used: WA, status: computed }    # normalised
  NVQW06: { state_used: WA, status: computed, total_entitlement_weeks: 8.6667, warnings: [{ code: wa_10yr_plus_misconduct_partial_forfeiture }] }
  NVQW07: { state_used: WA, status: computed, total_entitlement_dollars: 0.00, warnings: [{ code: sub_10yr_misconduct_excluded_wa }] }
  NVQW08: { status: failed, error: { code: state_missing_or_empty } }
  NVQW09: { status: failed, error: { code: state_unrecognised_or_not_yet_encoded, userMessage: "Currently encoded: NSW, VIC, QLD, WA. Set the row's state and re-upload, OR remove the row." } }
  NVQW10: { state_used: WA, status: computed, total_entitlement_weeks: 7.8000 }    # WA divergence: resignation qualifies
```

---

### TC-WA-BULK-003 — Mixed-state cash-out advisory + hard-error matrix

```csv
employee_id,row_type,state,trigger,trigger_date,...
CO-W01,pay_period,WA,cash_out,2026-05-25,...                  # ADVISORY (post-accrual)
CO-W02,pay_period,WA,cash_out,2026-05-25,...                  # ADVISORY (pre-first-milestone)
CO-V01,pay_period,VIC,cash_out,2026-05-25,...                 # HARD ERROR — s.34
CO-Q01,pay_period,QLD,cash_out,2026-05-25,...                 # ADVISORY — s.110
CO-W03,pay_period,WA,termination,2026-05-25,...               # normal
```

**Expected output**

```yaml
total_rows: 5
status_breakdown: { computed: 4, blocked: 0, failed: 1 }
row_results:
  CO-W01: { state_used: WA, status: computed, warnings: [{ code: wa_cashout_post_accrual_advisory }] }
  CO-W02: { state_used: WA, status: computed, warnings: [{ code: wa_cashout_pre_accrual_not_authorised }] }
  CO-V01: { state_used: VIC, status: failed, error: { code: vic_cashout_prohibited } }
  CO-Q01: { state_used: QLD, status: computed, warnings: [{ code: qld_cashout_requires_instrument_or_qirc }] }
  CO-W03: { state_used: WA, status: computed }
```

**Notes**

Demonstrates per-state cash-out branching across the 4 encoded states: WA = advisory (post or pre); VIC = hard error; QLD = advisory (s.110); NSW = not modelled (would also hard-error if requested).

---

# Coverage matrix

| Spec / source item | Covered by |
|---|---|
| **WA LSL Act 1958 s.4** — Interpretation (employee, employer, continuous employment, ordinary pay) | All TC-WA-NNN (implicit) |
| **WA LSL Act 1958 s.4A** — inserted by 2022 amendment | Covered via post-2022 continuous-service rules |
| **WA LSL Act 1958 s.5** — Limited contracting-out / cash-out | TC-WA-063, TC-WA-064, TC-WA-065 |
| **WA LSL Act 1958 s.6 (post-2022)** — Continuous employment as amended | TC-WA-028 → TC-WA-035, TC-WA-050 → TC-WA-053 |
| **WA LSL Act 1958 s.6 (pre-2022)** — Continuous employment legacy | TC-WA-036 → TC-WA-039, TC-WA-054 |
| **WA LSL Act 1958 s.7** — Employment before commencement of Act | Out of v1 (pre-1958 employment moot for current calculations) |
| **WA LSL Act 1958 s.8(1)** — 8.6667 wks at 10 yrs; +4.3333 wks per 5 yrs | TC-WA-001, TC-WA-019, TC-WA-020, TC-WA-022, TC-WA-061, TC-WA-062 |
| **WA LSL Act 1958 s.8(3)** — Pro-rata at termination + serious-misconduct exception | TC-WA-002 → TC-WA-018, TC-WA-024 → TC-WA-027 |
| **WA LSL Act 1958 s.9** — Ordinary pay / PH during LSL | TC-WA-055 → TC-WA-060, TC-WA-066 |
| **WA LSL Act 1958 s.10** — Leave in advance | Deferred from v1 (parallel to VIC TBD-VIC-13) |
| **WA LSL Act 1958 s.11** — Industrial magistrates' courts | Out of v1 statutory engine scope (dispute resolution) |
| **WA LSL Act 1958 s.26 / s.26A** — Employment records | Out of v1 scope (record-keeping obligation, not calculation) |
| **WA LSL Act 1958 s.27** — Working elsewhere during LSL | Out of v1 (offence provision, not calculation) |
| **WCIM Act 2023 (WA)** — WC counts as service from 2024-07-01 | TC-WA-046, TC-WA-047, TC-WA-048, TC-WA-049 |
| **E2 spec F1 / F2 / AC1 / AC2** — per-state rule set + test suite | this file + encoded fixtures |
| **E2 spec F7 / AC7** — WA dual-regime split with citations to both | TC-WA-040, TC-WA-041, TC-WA-042, TC-WA-043 (under TBD-WA-01 RESOLVED option (b) re-scope) |
| **E2 spec F7 / AC8** — Insufficient-granularity ambiguity warning + single-regime fallback | TC-WA-044, TC-WA-045 |
| **E2 spec F8 / AC9** — WA Workers Comp pre-2024-07-01 excluded | TC-WA-046, TC-WA-048 |
| **E2 spec F13 / AC14** — Cross-jurisdictional governing-state nomination | TC-WA-069, TC-WA-070 |
| **E2 spec F17 / AC16** — Mixed-state bulk CSV with per-row state column | TC-WA-BULK-002 |
| **E2 spec AC4 / AC4a / AC4b** — PM sign-off + per-state launch gate | this file's PM signature line (pending) |

---

# Items flagged `TBD-WA-NN` — ALL RESOLVED 2026-05-25

All 16 TBDs are resolved in the **Resolutions** section near the top of this document. The historical detail and rationale that produced each resolution is preserved in the inline notes against the fixtures themselves (TC-WA-NNN entries). The Resolutions section is the binding authority.

| TBD | Severity | Status | Resolution location |
|---|---|---|---|
| TBD-WA-01 | Sev-1 (load-bearing) | ✅ RESOLVED | Resolutions §TBD-WA-01 — single rule set with date-aware continuous-service handling |
| TBD-WA-02 | Sev-2 | ✅ RESOLVED (with documented limitation) | Resolutions §TBD-WA-02 — Act-level citation only, section TBD via quarterly review |
| TBD-WA-03 | Sev-2 | ✅ RESOLVED | Resolutions §TBD-WA-03 — three distinct advisory codes |
| TBD-WA-04 | Sev-2 | ✅ RESOLVED | Resolutions §TBD-WA-04 — continuous 1/60 + inclusive thresholds |
| TBD-WA-05 | Sev-2 | ✅ RESOLVED | Resolutions §TBD-WA-05 — literal s.9 + WC-overlap advisory |
| TBD-WA-06 | Sev-2 | ✅ RESOLVED | Resolutions §TBD-WA-06 — partial-duration averaging |
| TBD-WA-07 | Sev-1 | ✅ RESOLVED | Resolutions §TBD-WA-07 — last fully-accrued block minus prior leave taken |
| TBD-WA-08 | Sev-2 | ⏳ Deferred to DEV-CROSS-2 | See "Deferred to DEV-CROSS-2" appendix |
| TBD-WA-09 | Sev-2 | ✅ RESOLVED | Resolutions §TBD-WA-09 — working days proportionate to pattern |
| TBD-WA-10 | Sev-3 | ✅ RESOLVED | Resolutions §TBD-WA-10 — general s.6 rules + advisory |
| TBD-WA-11 | Sev-3 | ✅ RESOLVED | Resolutions §TBD-WA-11 — 2022-06-20 → post-2022 (strict "on or after") |
| TBD-WA-12 | Sev-3 | ⏳ Deferred to DEV-CROSS-2 | See "Deferred to DEV-CROSS-2" appendix |
| TBD-WA-13 | Sev-3 | ⏳ Deferred to DEV-CROSS-2 | See "Deferred to DEV-CROSS-2" appendix |
| TBD-WA-14 | Sev-3 | ⏳ Deferred to DEV-CROSS-2 | See "Deferred to DEV-CROSS-2" appendix |
| TBD-WA-15 | Sev-3 | ✅ RESOLVED | Resolutions §TBD-WA-15 — advisory (status: computed + warning) |
| TBD-WA-16 | Sev-3 | ✅ RESOLVED | Resolutions §TBD-WA-16 — no sub-7-yr death carve-out |

---

## Deferred to DEV-CROSS-2 (WA schema extension)

The following four TBDs require a state-agnostic `engine/types.ts` refactor — they all introduce new optional fields on existing event types or on `Employee`. Per the operator's decision (2026-05-25), this is bundled as a separate cross-state PR (DEV-CROSS-2) that lands BEFORE WA engine code (T5.1) commences. Same pattern as DEV-CROSS-1 (termination-reason enum refactor that landed at `bd2d284` between QLD launch and WA Phase 5).

See `.specify/features/002-all-state-coverage/dev-findings.md` DEV-CROSS-2 for the full scope, sequencing, and pre-flight blocker statement.

### Scope of DEV-CROSS-2 (the state-agnostic refactor)

| Field | Event type / interface | Purpose | Default | Fixtures unblocked |
|---|---|---|---|---|
| `slacknessOfTrade?: boolean` | `employer_initiated_termination_and_rehire` | Distinguish 6-mo slackness-of-trade re-employment tolerance from 2-mo non-slackness tolerance under WA LSL Act 1958 s.6 | `false` | TC-WA-029, TC-WA-030 |
| `paidConcurrent?: boolean` | `workers_comp_absence` | Signal WC absence overlapped paid leave (annual or LSL) — DEMIRS paid-concurrent exception under WA LSL Act 1958 s.6 | `false` | TC-WA-049 |
| `returnToWorkProgram?: boolean` | `workers_comp_absence` | Signal employee was on a return-to-work program during the WC absence — DEMIRS RTW exception | `false` | (future fixtures in v2; surfaced for completeness) |
| `reasonableExpectationOfReturn?: boolean` | `unpaid_parental_leave` | Signal a casual employee on UPL had a reasonable expectation of return — DEMIRS post-2022 casual rule | `false` | TC-WA-052 |
| `mealsAndAccommodationCashValueWeekly?: number` | `Employee` | Optional weekly cash value of meals/accommodation normally provided when working — DEMIRS ordinary-pay inclusion rule | `0` | TC-WA-060 |

### Fixtures pending DEV-CROSS-2 (remain ACTIVE in launch-gate suite)

| Fixture | Schema field needed | Note |
|---|---|---|
| TC-WA-029 | `slacknessOfTrade: true` on `employer_initiated_termination_and_rehire` | Will pass once DEV-CROSS-2 lands |
| TC-WA-030 | `slacknessOfTrade: false` on the same event type (default-falsy, but the field must exist on the type for the engine to consult it) | Will pass once DEV-CROSS-2 lands |
| TC-WA-049 | `paidConcurrent: true` on `workers_comp_absence` | Will pass once DEV-CROSS-2 lands |
| TC-WA-052 | `reasonableExpectationOfReturn: true` on `unpaid_parental_leave` | Will pass once DEV-CROSS-2 lands |
| TC-WA-060 | `mealsAndAccommodationCashValueWeekly: 120.00` on `Employee` | Will pass once DEV-CROSS-2 lands |

**Total deferred fixtures: 5** (out of 73). These remain in the active launch-gate suite — same pattern as the 5 QLD fixtures that were temporarily deferred to DEV-CROSS-1 and reinstated at v1.1 after DEV-CROSS-1 merged at `bd2d284`. WA T5.1 (rule-set scaffold) is BLOCKED on DEV-CROSS-2 just as it would have been blocked on DEV-CROSS-1 if those two refactors had been bundled.

### Why this is a separate PR (not bundled into WA per-state PR)

Same logic as DEV-CROSS-1:
1. Bundling would inflate the WA per-state PR with code that has no WA-specific behaviour (the new fields are state-agnostic types).
2. Bundling would force NSW, VIC, QLD orchestrators to be updated inside the WA PR (cross-cutting change inside a per-state PR).
3. Bundling would couple the WA launch gate (AC4b) to a refactor that touches every state's surface.

The cleaner path: DEV-CROSS-2 as a state-agnostic refactor PR, then WA Phase 5 per-state PR consuming the new fields.

---

## Provisions deliberately deferred from v1 WA encoding

| Provision | Reason for deferral |
|---|---|
| **WA LSL Act 1958 s.7 (pre-1958 employment)** | Moot for current calculations — no employee on the platform has pre-1958 service. |
| **WA LSL Act 1958 s.10 (leave in advance)** | Parallel to VIC TBD-VIC-13 deferral. Engine recognises the trigger exists but does NOT compute scenarios. Re-evaluate in v2. |
| **WA LSL Act 1958 s.11 (industrial magistrates' courts)** | Dispute-resolution — not a calculation question. |
| **WA LSL Act 1958 s.26, s.26A (employment records)** | Record-keeping obligations — not calculation. |
| **WA LSL Act 1958 s.27 (working elsewhere during LSL)** | Offence/forfeiture provision. Engine could emit advisory but does not adjudicate fact of working elsewhere. Re-evaluate in v2 if signal becomes available. |
| **Local Government LSL** | Separate scheme — `dlgsc.wa.gov.au` Local Government LSL guidelines. Out of v1 statutory engine scope. |
| **MyLeave WA portable scheme (construction industry)** | Separate portable LSL scheme. Out of v1 — same convention as VIC industry awards (TBD-VIC industry awards deferred). |
| **CITS WA (Construction Industry Training Scheme)** | Industry training body — not LSL relevant. |
| **Case-law-driven serious-misconduct interpretation** | The calculator does not adjudicate whether a given dismissal was for serious misconduct. The user asserts the reason; the calculator computes accordingly. |

---

## Signature line

```
Signed: Tracy Angwin (PM)
Date:   2026-05-25
```

> PM-only sign-off per E2 spec RES-6 / AC4. No APA-specialist co-signer required. Sign-off completes T5.0. T5.1 (WA rule-set scaffold) remains BLOCKED on DEV-CROSS-2 (the state-agnostic WA schema extension PR) per the operator's decision to bundle TBD-WA-08, -12, -13, -14 + the slackness-of-trade signal as a single cross-state refactor. Same pattern as DEV-CROSS-1.
>
> **TBD-WA-01 (load-bearing) RESOLVED**: single rule set with date-aware continuous-service handling. Impl-plan re-scoped at v0.3.2.

---

*End of test-cases-wa.md v1.0 — PM-signed-off 2026-05-25.*
