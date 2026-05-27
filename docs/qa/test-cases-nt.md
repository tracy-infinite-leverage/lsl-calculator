# NT LSL Calculator — Gold-Standard Test Cases

**Status**: ✅ PM-SIGNED v1.0 — 2026-05-27 · 12/12 blocking RESOLVED (4 Sev-1 + 8 Sev-2) · 6/6 Sev-3 deferred with documented limitations
**Version**: v1.0 PM-SIGNED
**Date**: 2026-05-27 (drafted + PM-signed same day)
**Owner**: Tracy Angwin (PM)
**Spec**: `.specify/features/002-all-state-coverage/spec.md` v0.3.1
**Impl plan**: `.specify/features/002-all-state-coverage/impl-plan.md` Phase 9 (NT) — final state; size estimate pending TBD resolution (`per-year HWW history` is the load-bearing engine novelty — see TBD-NT-01)
**Tasks**: `.specify/features/002-all-state-coverage/tasks.md` T9.0 (THIS DOC) — blocks T9.1 onwards
**Source-of-truth Acts**:
- *Long Service Leave Act 1981* (NT) — As in force 14 October 2015. Available at `legislation.nt.gov.au/Legislation/LONG-SERVICE-LEAVE-ACT-1981`. Cited as **"NT LSL Act 1981 s.N"** throughout. Section coverage in v1: s.7 (who is entitled + ordinary-pay definition), s.7(2) (ordinary-pay include/exclude list), s.7(2)(c) (board/lodging cash value), s.8 (entitlement formula — 13 wks at 10 yrs + 6.5 wks per subsequent 5 yrs), s.9 (PH-INCLUSIVE), s.10 (termination — pro-rata + qualifying reasons), s.10(1) (full payout 10+ yrs), s.10(1A) (serious misconduct — complete 10y/15y blocks only), s.10(2) (7–10y qualifying reasons), s.10(3) (death — payable to personal representative), s.10(4) (no other cash-out / payment in lieu allowed), s.11 (hours + rate of pay; the per-year formula), s.11(1) (hours per year — fixed OR averaged), s.11(3) (per-year `RP × HWW × 1.3` formula), s.11(4)/(5) (statutory worked examples), s.12 (continuous service), s.12(3) (apprenticeship → 12-month lead-in), s.12(6)/(7) (related corporations), s.12(8)/(9) (transfer of business), s.14 (records — 3 yrs / 6 yrs post-employment).
- **Possibly out-of-scope v1 candidates**: NT has no separately-listed industry portable LSL scheme equivalent to TasBuild / MyLeave / SA Construction. NT teaching services are excluded from the Commonwealth LSL Act 1976 (per s.948 / s.964 of that Act) — but the NT LSL Act 1981 still governs general private-sector NT employees. **OUT OF v1 SCOPE**: NT public-sector LSL (Public Sector Employment and Management Act 1993 NT) — separate regime for NT government employees; same convention as other states' public-sector exclusions.

---

## Resolutions (PM-SIGNED 2026-05-27)

All 18 TBDs RESOLVED on 2026-05-27 via the T9.0 operator interview (Tracy Angwin, PM, with product-manager agent draft). 12 blocking TBDs (4 Sev-1 + 8 Sev-2) confirmed individually; 6 Sev-3 confirmed in a single batch ruling per cross-state precedent. **No DEV-CROSS-3 created** — operator chose state-localised `extraInputs.nt_hours_per_week_by_year` over a top-level schema field (TBD-NT-01 Option (a)), consistent with the YAGNI precedent set on SA TBD-SA-07. **T9.1 (engine scaffold) UNBLOCKED immediately** — no pre-flight cross-state PR required.

The verbatim resolution text in each TBD section is the authority. The table below is a quick-reference index.

| TBD | Severity | Status | Resolution |
|---|---|---|---|
| TBD-NT-01 | Sev-1, LOAD-BEARING | RESOLVED 2026-05-27 | Option (a) — state-localised `extraInputs.nt_hours_per_week_by_year`. No DEV-CROSS-3. TAS/SA/ACT precedent; consistent with YAGNI ruling on SA TBD-SA-07. |
| TBD-NT-02 | Sev-1, LOAD-BEARING | RESOLVED 2026-05-27 | Option (b) + Option (c) override layered — dob lookup table per Cth SS Act 1991 s.23 + `extraInputs.nt_age_pension_age_at_termination_reached` override. `employee.dob` field already in schema (ACT Phase 7). |
| TBD-NT-03 | Sev-1, LOAD-BEARING | RESOLVED 2026-05-27 | Option (a) — permissive default + `extraInputs.nt_casual_continuity_preserved`. Engine does NOT impose a quantitative test absent statutory authority. Aligns with benefits-conferring construction. |
| TBD-NT-04 | Sev-1, LOAD-BEARING | RESOLVED 2026-05-27 | Option (a) — strict closed-list reading of s.10(2). Voluntary resignation 7–10 yrs pays $0. Binary 10-yr cliff. Parallel to TAS TBD-TAS-07 + ACT closed-list. |
| TBD-NT-05 | Sev-2 | RESOLVED 2026-05-27 | Option (a) — strict literal block truncation at 10y/15y multiples per s.10(1A). New warning `nt_10yr_plus_misconduct_complete_blocks_only`. |
| TBD-NT-06 | Sev-2 | RESOLVED 2026-05-27 | Option (a) — s.10(3) "this section" cross-references both s.10(1) AND s.10(2). Death at 7–10 yrs → pro-rata; 10+ yrs → full. Sub-7-yrs → $0. |
| TBD-NT-07 | Sev-2 | RESOLVED 2026-05-27 | Option (a) — operator flag `extraInputs.nt_bonus_usually_paid_with_pay` (default `false` = exclude). Engine does NOT auto-detect from `wageHistory.note`. Advisory either way. |
| TBD-NT-08 | Sev-2 | RESOLVED 2026-05-27 | Option (b) — hard error. `status:failed` + `error.code:'nt_cashout_forbidden_s10_4'`. Cross-state parallel to VIC s.34. No numeric output. |
| TBD-NT-09 | Sev-2 | RESOLVED 2026-05-27 | Option (b) — omit `payable_by` (undefined) + `nt_payable_as_soon_as_practicable_advisory`. Parallel to NSW "forthwith" treatment. |
| TBD-NT-10 | Sev-2 | RESOLVED 2026-05-27 | Option (b) — 52 weeks (364 days). Cross-state parallel to NSW/QLD/SA/ACT. |
| TBD-NT-11 | Sev-2 | RESOLVED 2026-05-27 | Option (c) — defer to v2 / operator pre-strips board+lodging into `currentWeeklyGross`. Same v1 convention as other 7 states. Re-evaluate at RES-3. |
| TBD-NT-12 | Sev-2 | RESOLVED 2026-05-27 | Option (a) — literal s.12: 2-mo non-slackness re-employment, slackness preserves continuity but no length, 12-mo apprenticeship tolerance. |
| TBD-NT-13 | Sev-3 | RESOLVED 2026-05-27 | Casual loading INCLUDED per universal cross-state practice. Operator pre-loads `currentHourlyRate`. Advisory `nt_casual_loading_assumed_included_in_hourly_rate` fires every casual NT calc. |
| TBD-NT-14 | Sev-3 | RESOLVED 2026-05-27 | 12-mo apprentice tolerance hardcoded as NT constant. Reuses cross-state `apprentice_to_tradesperson_transition` event type from DEV-CROSS-2 era. Fixture TC-NT-036 covers. |
| TBD-NT-15 | Sev-3 | RESOLVED 2026-05-27 | Operator-supplied `extraInputs.nt_related_corporation_service_years: number` (default 0). Added to `years_of_continuous_service`. Advisory `nt_related_corporation_service_aggregated` fires. Cross-state parallel to WA/SA. |
| TBD-NT-16 | Sev-3 | RESOLVED 2026-05-27 | OUT OF v1 engine scope. Operational compliance / data-retention policy, not a calculation question. Operator implements separately. |
| TBD-NT-17 | Sev-3 | RESOLVED 2026-05-27 | Documented limitation. v1 ships against 14 Oct 2015 NT LSL Act consolidation. RES-3 legal-reviewer pass scheduled to confirm no material post-2015 amendments to s.7/s.10/s.11/s.12. v1.1 amendment if material drift found. |
| TBD-NT-18 | Sev-3 | RESOLVED 2026-05-27 | Confirmed: NO industry-portable LSL scheme in NT. v1 engine assumes NT LSL Act 1981 is sole regime for non-public-sector NT workers. No portable-scheme advisory. Re-validate at RES-3. |

---

## Scope

**IN SCOPE for v1 NT engine**:
- General NT LSL Act 1981 governing the private-sector LSL calculation.
- All triggers: `taking_leave`, `termination`, `as_at`. (`cash_out` returns hard advisory — s.10(4) explicitly forbids; see TBD-NT-08.)
- All employment types: FT, PT, casual, commission, piecework, outworker, butty-gang member (the Act's s.7 enumerated categories).
- All termination reasons covered by the cross-state `TerminationReason` enum (post-DEV-CROSS-1).
- The NT-unique per-year `RP × HWW × 1.3` formula (s.11(3)) — engine MUST keep per-year hours history (HWW).
- PH-INCLUSIVE treatment of public holidays during LSL (parallel to SA; OPPOSITE to NSW/VIC/QLD/WA/TAS/ACT).
- Workers Comp absence does NOT count as service per s.12 (parallel to NT-specific correction in research v2.0 changelog).
- Unpaid maternity leave does NOT count as service per s.12.
- Cross-jurisdiction routing via `governingJurisdiction = NT`.

**OUT OF v1 SCOPE**:
- **NT public-sector LSL** (Public Sector Employment and Management Act 1993 NT). Separate regime; same convention as other states' public-sector exclusions.
- **NT teaching services** — excluded from Commonwealth LSL Act 1976 but still under NT LSL Act 1981 for general accrual; v1 honours general NT rules and does NOT add a teaching-services advisory.
- **Defence Force service continuity** beyond what's already in `serviceEvents`. Edge case; out of v1.
- **Half-pay / double-pay**: NT Act is silent on half-pay/double-pay; no statutory entitlement. Out of v1.
- **Higher-duties / acting rate**: no statutory analogue in the NT Act (unlike SA s.4). Out of v1.
- **Records retention (s.14 — 3 yrs / 6 yrs post-employment)**: operational requirement; not a calculation question. Out of v1 engine scope.

---

## Calculation surface

**Inputs** (the `Employee` and `Trigger` shapes from `engine/types.ts`):
- `employee.startDate`, `endDate?`, `employmentType`, `statesOfService`, `governingJurisdiction`
- `currentWeeklyGross` (FT fixed-rate path) or `currentHourlyRate` + per-year hours history (variable-hours path — see TBD-NT-01)
- `wageHistory` (commission / variable-rate path — 12-month window per s.11(1)(b))
- `employee.dob` (consumed by NT for the s.10(2) retirement-age qualifying-reason gate — TBD-NT-02)
- `serviceEvents` (continuous-service walk)
- `extraInputs.nt_*` (NT-localised signals — see Schema additions below; some signals may need to become a top-level cross-state field, see TBD-NT-01 / DEV-CROSS-3 candidate)
- `trigger.kind` ∈ {`taking_leave`, `termination`, `cash_out`, `as_at`}
- `trigger.reason` for termination (post-DEV-CROSS-1 enum)
- `trigger.terminationInitiator?: 'employee' | 'employer'` (post-DEV-CROSS-1)

**Outputs** (the `Result` shape):
- `status`: `computed` / `blocked_cross_jurisdiction` / `failed`
- `years_of_continuous_service`
- `total_entitlement_weeks`
- `value_of_week` (NT per-year structure means this is a *derived* aggregate — see TBD-NT-01)
- `total_entitlement_dollars` (for termination) or `payable_for_taken_leave` (for taking)
- `expected_citations[]`
- `warnings[]`
- `payable_by?: ISODate` — NT s.10 says "as soon as practicable" after cessation. Engine surfaces `payable_by = terminationDate + 14 days` per RES-3 indicative reading or omits the field — see TBD-NT-09.

**Regime selection logic** (single regime — no dual cliff):
- NT LSL Act 1981 has no dated cliff equivalent to WA's 2024-07-01 / ACT's 2023-06-09. The Act has been consolidated as in force 14 October 2015; no v1-relevant amendment introduces a calculation cutoff.
- Engine uses **single rule set** with flat `rules/` directory structure (parallel to QLD / SA / ACT / TAS pattern, NOT VIC / WA pre-/post- pattern).

---

## Fixture ID scheme

`TC-NT-<NN>` for single-mode fixtures (NN = 001..NNN).
`TC-NT-BULK-<NNN>` for bulk-mode fixtures.

Stable, unique, referenced from `gold-standard.test.ts` once Phase 9 T9.3 lands.

---

## Quick reference — NT decisions at a glance

| Topic | NT rule | Source |
|---|---|---|
| Qualifying period — full entitlement | **10 years** | s.8 |
| Entitlement at qualifying period | **13 weeks** at 10 yrs | s.8 |
| Accrual rate after first entitlement | **1.3 wks/yr** (= `Years × 13/10`) — SAME ratio as SA (most generous in country with SA) | s.8 |
| Discrete step at 15 yrs | **+6.5 wks** at 15 yrs (= 5 × 1.3) — equivalent to continuous 1.3 wks/yr past year 10 | s.8 |
| Pro-rata at termination — sub-threshold | **7 years** (qualifying-reason gate) | s.10(2) |
| Sub-7-yr entitlement | **none** | s.10 |
| 7–10-year qualifying reasons | **retirement (Age Pension age), employer-not-misconduct, illness/incapacity/domestic-pressing-necessity** — death NOT in this list (covered separately under s.10(3)) | s.10(2) |
| Voluntary resignation 7–10 yrs | **NOT PAYABLE** (no qualifying reason — TBD-NT-04) | s.10(2) |
| Serious & wilful misconduct (sub-10-yr) | **forfeiture** | s.10 |
| Serious & wilful misconduct (10+ yrs) | **only complete 10y/15y blocks payable** per s.10(1A) — DIFFERENT from NSW/VIC/QLD/SA/ACT/TAS full payout and from WA 5-yr-block partial-forfeiture — TBD-NT-05 | s.10(1A) |
| Death (10+ yrs) | **full payout to personal representative** per s.10(3) | s.10(3) |
| Death (7–10 yrs) | **NOT NAMED in s.10(2)** — TBD-NT-04 / TBD-NT-06 question | s.10(2) vs s.10(3) |
| PH during LSL | **INCLUSIVE** — PH is part of LSL; period not increased (parallel to SA; OPPOSITE to NSW/VIC/QLD/WA/TAS/ACT) | s.9 |
| Break tolerance — re-employment | **2 months** (standard, parallel to NSW/SA/WA/ACT) — TBD-NT-12 | s.12 |
| Break tolerance — slackness of trade | continuity preserved (not in length) — TBD-NT-12 | s.12 |
| Casual continuity test | Act is silent on a specific test (no equivalent to TAS s.5(3) 32-hr-4-wk; no equivalent to NSW "regular and systematic"); v1 reads operator flag — TBD-NT-03 | s.12 |
| **NT per-year formula (UNIQUE)** | `Σ over each completed year: RP × HWW × 1.3` — RP = rate at cessation/LSL-start; HWW = hours per week during that year (excluding overtime); summed across years | s.11(3) |
| Variable hours window | Per-year averaging (each year averaged separately) — TBD-NT-01 | s.11(1)(b) |
| Variable rate window | 12-month income lookback prior to LSL/cessation — TBD-NT-01 | s.11 (rate-varies branch) |
| Commission averaging window | 12 months immediately prior to LSL/cessation (s.11 rate-varies branch) — TBD-NT-10 | s.11 |
| Ordinary pay — base wages | **INCLUDED** | s.7(2) |
| Ordinary pay — casual loading | **INCLUDED** (per universal practice; NT silent in Act but Masterclass confirms) — TBD-NT-13 | s.7(2) + APA Masterclass |
| Ordinary pay — shift penalties | **EXCLUDED** per s.7(2) ("any other allowance or payment in respect of overtime; penalty rates of pay") | s.7(2) |
| Ordinary pay — penalty rates | **EXCLUDED** per s.7(2) | s.7(2) |
| Ordinary pay — district / site / climatic allowances | **EXCLUDED** per s.7(2) | s.7(2) |
| Ordinary pay — overtime | **EXCLUDED** per s.7(2) | s.7(2) |
| Ordinary pay — industry / leading hand / skill / qualification allowances | **INCLUDED** per s.7(2) | s.7(2) |
| Ordinary pay — service grant | **INCLUDED** per s.7(2) | s.7(2) |
| Ordinary pay — bonus / incentive scheme amounts | **INCLUDED if usually paid with pay** per s.7(2)(b) — broadest bonus-inclusion rule of any Australian state — TBD-NT-07 | s.7(2)(b) |
| Ordinary pay — over-award payments | **INCLUDED** per s.7(2) | s.7(2) |
| Ordinary pay — free board ($15/wk fallback) / lodging ($5/wk fallback) | **INCLUDED** per s.7(2)(c) — NT-unique statutory dollar fallbacks | s.7(2)(c) |
| Cash-out | **FORBIDDEN** per s.10(4) — "no other payment in lieu" allowed beyond s.10(1)/(2) cessation payouts — TBD-NT-08 | s.10(4) |
| Leave in advance | **NOT PERMITTED** — no statutory basis in the Act — TBD-NT-08 | s.8 (no advance leave clause) |
| Pay-on-termination timing | **as soon as practicable** after cessation — TBD-NT-09 | s.10 (operational reading) |
| Retirement age | **Age Pension age (currently 67 for both genders)** — NT-unique (sex-neutral, age-rising per Cth Social Security Act). DIFFERENT from TAS sex-specific 60F/65M and from ACT award-min-or-65 — TBD-NT-02 | s.10(2) |
| Apprentice lead-in | **12 months** per s.12(3) (parallel to NSW/SA/ACT — NOT TAS/QLD 3-mo) — TBD-NT-14 | s.12(3) |
| Workers Comp absence — service-counting | **DOES NOT COUNT** — NT divergence (corrected in research v2.0 from v1.0) | s.12 |
| Unpaid maternity leave — service-counting | **DOES NOT COUNT** | s.12 |
| Unpaid sick leave — service-counting | **DOES NOT COUNT** | s.12 |
| Leave without pay (general) — service-counting | **DOES NOT COUNT** | s.12 |
| Apprenticeship → re-employment within 12 months — continuity | **PRESERVED** | s.12 |
| Defence Forces / Reserves service — service-counting | **COUNTS** (continuous full-time Reserve / Citizen Forces / Naval / Air Force / national service / Civil Construction Corps under National Security Act 1939) | s.12 |
| Stand-down for slackness of trade | **CONTINUITY PRESERVED** but does NOT count for length | s.12 |
| Industrial dispute | **DOES NOT COUNT** unless worker returns under settlement | s.12 |
| Related corporations (s.12(6)/(7)) | **AGGREGATED** — periods with related corporations summed; "related corporation" per Corporations Act 2001 — TBD-NT-15 | s.12(6)/(7) |
| Transfer of business (s.12(8)/(9)) | **PRESERVED** — transmission / conveyance / assignment / succession; period deemed continuous with new employer | s.12(8)/(9) |
| Records retention | **3 yrs post-employment** (6 yrs if died) — out of v1 engine scope | s.14 |
| Portable LSL scheme | **NOT APPLICABLE** — NT has no industry-portable LSL scheme equivalent to TasBuild / MyLeave / SA Construction — TBD-NT-18 confirms this is not a v1 question | n/a |

---

## Schema additions / engine surface for NT

**Cross-state schema addition candidate (DEV-CROSS-3?) — TBD-NT-01**:

NT's per-year `RP × HWW × 1.3` formula is structurally unique. The engine must store **hours per week, per completed year of service** — not just current hours. Two encodings are on the table:

**Option (A) — TAS-style state-localised**: introduce `extraInputs.nt_hours_per_week_by_year: Array<{ yearStart: ISODate, yearEnd: ISODate, hoursPerWeek: number }>`. Operator pre-computes per-year averages and supplies them. Engine consumes this array directly. Pattern: parallel to TAS's localised `extraInputs.tas_*` approach.

**Option (B) — promote to top-level cross-state schema field (DEV-CROSS-3)**: add `Employee.hoursPerWeekByYear?: Array<{ yearStart: ISODate, yearEnd: ISODate, hoursPerWeek: number }>` as an optional input. Engine layer adds the field; NT is the sole v1 consumer; ignored by all other state orchestrators. This would be the third cross-state schema extension (after DEV-CROSS-1 termination-enum and DEV-CROSS-2 WC flags).

**PM Recommendation (DRAFT)**: **Option (A)** — TAS-style state-localised `extraInputs.nt_hours_per_week_by_year`. Same reasoning as the operator's YAGNI ruling on SA TBD-SA-07: the field is genuinely NT-only and no other state's engine has a use case. Promoting it to a top-level field violates YAGNI and adds schema surface for no cross-state value. If a future state needs per-year hours history, the field can be retrofitted at that time. **TBD-NT-01 must be resolved before T9.1 scaffold can branch off.**

**New top-level input fields (consumed by NT orchestrator only, additive)**:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `employee.dob` | `ISODate` | `undefined` | Already added in ACT Phase 7. NT consumes for s.10(2) retirement-age qualifying-reason gate. When `reason === 'retirement'` AND age at termination >= Age Pension age (per TBD-NT-02 calendar), retirement qualifies. No DEV-CROSS-N needed — field already exists. |

**New `extraInputs` keys read by the NT orchestrator only** (parallel to ACT / SA / TAS-localised pattern):

| Field | Type | Default | Purpose |
|---|---|---|---|
| `extraInputs.nt_hours_per_week_by_year` | `Array<{ yearStart: ISODate, yearEnd: ISODate, hoursPerWeek: number }>` | `[]` | **TBD-NT-01 load-bearing**. Per-year average hours-per-week history. Used by s.11(3) per-year formula. When empty AND `currentWeeklyGross` is supplied → engine falls back to single-year flat path with `nt_per_year_hours_history_missing` advisory. |
| `extraInputs.nt_age_pension_age_at_termination_reached` | `boolean` | `false` | Override for the s.10(2) retirement-age gate when operator does not wish to supply `employee.dob`. When `true`, retirement qualifies regardless of dob. Used when dob is uncertain or privacy-restricted. |
| `extraInputs.nt_casual_continuity_preserved` | `boolean \| undefined` | `undefined` | **TBD-NT-03**. Operator-supplied confirmation that casual employee meets continuity (the Act has no specific test; v1 defaults permissive + advisory when `undefined`). |
| `extraInputs.nt_bonus_usually_paid_with_pay` | `boolean` | `false` | **TBD-NT-07**. Operator-supplied confirmation that detected bonus in `wageHistory.note` meets s.7(2)(b) "usually paid with pay" inclusion test. When `true`, bonus is included in ordinary pay; when `false`, excluded. |
| `extraInputs.nt_board_lodging_cash_value_weekly` | `number` | `0` | **TBD-NT-11**. Operator-supplied weekly cash value of board/lodging provided. NT-unique statutory fallback: $15/wk board + $5/wk lodging if operator does not supply. Engine adds this to `currentWeeklyGross` per s.7(2)(c). |
| `extraInputs.nt_related_corporation_service_years` | `number` | `0` | **TBD-NT-15**. Operator-supplied total additional service years with related corporations (per s.12(6)/(7)). Added to `years_of_continuous_service`. |
| `extraInputs.nt_employer_initiated_dismissal` | `boolean` | `false` | **TBD-NT-04**. Operator-supplied flag clarifying whether s.10(2) "employer-not-misconduct" applies. When `true` AND `reason` does not indicate misconduct, retirement-age gate is BYPASSED and the qualifying-reason check uses employer-not-misconduct. |

**New `nt_*` warning codes** (state-namespaced, parallel to SA / ACT / TAS precedent):

| Code | Tier | Use |
|---|---|---|
| `sub_7yr_no_entitlement_nt` | informational | Below 7-yr pro-rata threshold. No entitlement under s.10. |
| `sub_10yr_no_qualifying_reason_nt` | informational | 7–10 yrs but termination reason does not qualify under s.10(2). |
| `sub_10yr_misconduct_excluded_nt` | informational | Serious & wilful misconduct dismissal sub-10-yr — pro-rata forfeited per s.10. |
| `nt_10yr_plus_misconduct_complete_blocks_only` | informational | Dismissal for serious & wilful misconduct at 10+ yrs — only complete 10y/15y blocks payable per s.10(1A). Different from NSW/VIC/QLD/SA/ACT/TAS full payout and from WA partial-forfeiture. **TBD-NT-05.** |
| `nt_per_year_formula_applied` | informational | Per-year `RP × HWW × 1.3` summation applied per s.11(3). |
| `nt_per_year_hours_history_missing` | informational | Operator did not supply `extraInputs.nt_hours_per_week_by_year`. Engine fell back to single-year flat path using `currentWeeklyGross`. May produce different total if hours varied across years of service. |
| `nt_per_year_hours_history_partial` | informational | Operator supplied per-year hours history but it is incomplete (some years missing). Engine filled missing years from `currentWeeklyGross`. |
| `nt_workers_comp_excluded` | informational | Workers Comp absence does NOT count as service per NT s.12. Diverges from NSW/VIC/QLD/SA/TAS (counts) and ACT (counts post-9-Jun-2023). |
| `nt_unpaid_maternity_excluded` | informational | Unpaid maternity leave does NOT count as service per NT s.12. |
| `nt_unpaid_sick_leave_excluded` | informational | Unpaid sick leave does NOT count as service per NT s.12. |
| `nt_leave_without_pay_excluded` | informational | General leave without pay does NOT count as service per NT s.12. |
| `nt_industrial_dispute_excluded` | informational | Industrial dispute time does NOT count as service per s.12 unless worker returns under settlement. |
| `nt_ph_inclusive_in_lsl` | informational | Public holidays during LSL are part of LSL and do NOT extend the period per s.9. NT-DIVERGENT from NSW/VIC/QLD/WA/TAS/ACT (which extend); PARALLEL to SA. |
| `nt_retirement_qualifying_age_pension_age` | informational | NT s.10(2) retirement gate uses Age Pension age (currently 67 for both genders per Cth Social Security Act). Engine applied this reading. **TBD-NT-02.** |
| `nt_retirement_age_lookup_year_used` | informational | Age Pension age year-of-birth lookup used (currently 67 for births 1 Jan 1957 onwards). Engine value: {year}. |
| `nt_cashout_forbidden_s10_4` | informational | Cash-out is FORBIDDEN under NT s.10(4) — engine refuses `cash_out` triggers. Same shape as VIC s.34 forbidden cash-out. **TBD-NT-08.** |
| `nt_advance_leave_not_permitted` | informational | Taking LSL before 10-year entitlement is not permitted under the NT Act. Returns $0 with this advisory. |
| `nt_payable_as_soon_as_practicable_advisory` | informational | Pay-on-termination is "as soon as practicable" after cessation per s.10. Engine surfaces `payable_by = terminationDate + 14 days` indicative (TBD-NT-09) OR omits the field. |
| `nt_bonus_usually_paid_with_pay_included` | informational | Bonus payments included in ordinary pay per s.7(2)(b) — NT broadest bonus-inclusion in Australia. Operator confirmed via `extraInputs.nt_bonus_usually_paid_with_pay: true`. **TBD-NT-07.** |
| `nt_bonus_usually_paid_with_pay_excluded` | informational | Bonus payments excluded from ordinary pay — operator did not confirm s.7(2)(b) "usually paid with pay" test. Engine treated as excluded by default. |
| `nt_board_lodging_included` | informational | Board and lodging cash value included per s.7(2)(c). Operator-supplied value: $\{x\}/wk OR statutory fallback $15/wk board + $5/wk lodging. **TBD-NT-11.** |
| `nt_industry_leading_hand_skill_qualification_allowance_included` | informational | Industry / leading hand / skill / qualification / service grant allowances INCLUDED in ordinary pay per s.7(2). |
| `nt_district_site_climatic_allowance_excluded` | informational | District / site / climatic allowances EXCLUDED from ordinary pay per s.7(2). |
| `nt_overtime_excluded` | informational | Overtime payments EXCLUDED from ordinary pay per s.7(2). |
| `nt_penalty_rates_excluded` | informational | Penalty rates EXCLUDED from ordinary pay per s.7(2). |
| `nt_casual_continuity_preserved_default` | informational | Operator did not supply `extraInputs.nt_casual_continuity_preserved`. Engine defaulted permissive (continuity preserved). **TBD-NT-03.** |
| `nt_casual_continuity_broken` | informational | Operator confirmed casual continuity broken via `extraInputs.nt_casual_continuity_preserved: false`. Pre-break service forfeited. |
| `nt_related_corporation_service_aggregated` | informational | Service with related corporations (per s.12(6)/(7)) aggregated. Operator-supplied additional years: \{x\}. **TBD-NT-15.** |
| `transfer_of_business_continuity_preserved_nt` | informational | Service deemed continuous across transmission of business per s.12(8)/(9). |
| `nt_apprentice_12mo_continuity_preserved` | informational | Apprenticeship → tradesperson re-employment within 12 months preserves continuity per s.12(3). |
| `nt_lsl_calculated_at_wc_reduced_rate_warning` | informational | (Edge case) Operator-supplied LSL calc during WC absence — note WC does NOT count as service in NT, so this case typically does not arise. Advisory emitted defensively. |

**Possible new `Result` field** — see TBD-NT-09 on `payable_by`. NT may reuse the existing `payable_by: ISODate` field (added in ACT Phase 7) set to `terminationDate + 14 days` indicative, OR omit it (since "as soon as practicable" is not a fixed window). No new `Result` field beyond the existing schema.

**Possible cross-state schema extension** — TBD-NT-01 may create DEV-CROSS-3 if operator selects Option (B) per-year-hours promotion. PM recommends Option (A) — TAS-style localised — to avoid DEV-CROSS-3.

---

## Sources of legal truth

- *Long Service Leave Act 1981* (NT) — As in force 14 October 2015. Available at `legislation.nt.gov.au/Legislation/LONG-SERVICE-LEAVE-ACT-1981` (HTML index) and `legislation.nt.gov.au/api/sitecore/Act/PDF?id=11975` (PDF). Cited as **"NT LSL Act 1981 s.N"** throughout. Section coverage verified against the consolidated index — see `docs/research/lsl-pay-components-deep-research.md` §3.8.
- *Australian Payroll Association LSL Masterclass 2026* (158 pp) — NT section. Supplies worked examples used as canonical fixtures. Cited as **"APA LSL Masterclass — NT"** throughout.
- *Social Security Act 1991* (Cth) — for the Age Pension age lookup applied to NT s.10(2) retirement-age qualifying-reason gate. Currently 67 for both genders for births on or after 1 Jan 1957.
- *Internal research dossier* — `docs/research/lsl-pay-components-deep-research.md` v2.0 §3.8 (NT). The Masterclass + AustLII material is consolidated there. The **v2.0 critical correction** for NT was the Workers Comp exclusion (v1.0 had it counted; v2.0 correctly reads NT as excluding WC).

> ⚠️ **Pre-launch caveat**: NT Act version read was 14 Oct 2015. Verify post-2015 amendments to s.7 (pay definition), s.10 (cessation), s.11 (formula), s.12 (qualifying service) before launch. Recommended action: legal-reviewer sign-off (parallel to TAS RES-3 pattern). **TBD-NT-17.**

---

## How to read this file

Each test case has:

- **ID** (e.g. `TC-NT-001`) — unique, stable, referenced from `gold-standard.test.ts`
- **Name** — short, descriptive
- **Source** — APA PDF page and/or NT LSL Act 1981 section that produced the expected value
- **Category** — Single mode (Fixed-rate / Variable-hours / Per-year-formula / Commission / Hard-error / negative / Cashing-out hard-error) or Bulk mode
- **Why it matters** — the spec acceptance criterion or NT-specific divergence this case backs
- **Inputs** — fenced YAML following the engine's `Employee` / `Trigger` / `WagePeriod` / `ContinuousServiceEvent` data model in `website/src/lib/lsl/engine/types.ts`
- **Expected output** — `value_of_week`, `total_entitlement_weeks`, `total_entitlement_dollars`, `expected_citations[]`; for hard-error cases `status: failed` and `error.code`
- **Legal source** — explicit NT LSL Act 1981 section reference
- **Notes** — interpretation, derivation, any `expected: TBD` flag with rationale

### Conventions used in this file

- **Currency**: AUD; half-up rounding at 0.005; 2 decimal places at display; intermediate arithmetic unrounded — same convention as every prior state.
- **Dates**: ISO `YYYY-MM-DD`. Prescribed-date anchor for fixtures is `2026-05-27` (= as-at default for v1 testing).
- **Entitlement formula** (NT LSL Act 1981 s.8): **13 weeks** at 10 years; +**6.5 weeks** per subsequent 5 years (equivalent: continuous 1.3 wks/yr past year 10). Same accrual ratio as SA (most generous in country, with SA).
- **Pro-rata at termination** (s.10(2)): payable to an employee who has completed at least **7 years** of continuous service whose employment ends for a qualifying reason — retirement (Age Pension age — TBD-NT-02), employer-not-misconduct dismissal, illness/incapacity/domestic-pressing-necessity. **Voluntary resignation 7–10 yrs does NOT qualify** (TBD-NT-04). **Death is NOT named in s.10(2)** — covered separately under s.10(3) (TBD-NT-06). Pro-rata calculation includes years AND months/12 converted to decimal.
- **Serious & wilful misconduct** (s.10(1A)): forfeits all pro-rata at sub-10-yr tenure. At 10+ years, **only complete 10y/15y blocks are payable** per s.10(1A) — engine truncates years to the nearest completed 10y/15y block. **NT divergent from both NSW/VIC/QLD/SA/ACT/TAS (full payout) and WA (5-yr block partial-forfeiture)** — TBD-NT-05.
- **NT per-year formula** (s.11(3)): `Σ over each completed year of service: RP × HWW × 1.3`. RP = rate immediately preceding day employee ceases OR takes LSL OR day agreed under s.8(8)(a). HWW = hours of work per week during that year of continuous service; excludes overtime hours. Engine MUST store per-year hours history (TBD-NT-01).
- **Ordinary pay** (s.7(2)): for fixed-rate full-time employees, the ordinary weekly rate at the time of taking leave applies — INCLUDING base wages, casual loading, industry / leading hand / skill / qualification / service grant allowances, **board/lodging cash value (with $15/wk + $5/wk statutory fallback)**, **bonus/incentive amounts IF usually paid with pay** (s.7(2)(b) — NT broadest in Australia), regulations-prescribed allowances, commissions; EXCLUDING **overtime, penalty rates, district allowances, site allowances, climatic allowances**. For **variable hours**: per-year averaging per s.11(1)(b). For **variable rate / commission / piecework**: 12-month income lookback per s.11 rate-varies branch (TBD-NT-10).
- **Continuous service** (s.12): paid working time + paid annual leave + paid LSL + paid PHs count. **WC absence DOES NOT count** per s.12 (NT-divergent — corrected in research v2.0). **Unpaid maternity leave DOES NOT count**. **Unpaid sick leave DOES NOT count**. **General leave without pay DOES NOT count.** Industrial dispute DOES NOT count unless worker returns under settlement. Defence leave / Reserves / Naval / Air Force / national service / Civil Construction Corps service DO count. Transmission of business preserves continuity (s.12(8)/(9)). Apprenticeship → contract within **12 months** preserves continuity per s.12(3). Stand-down for slackness of trade preserves continuity but does NOT count for length.
- **Related corporations** (s.12(6)/(7)): service periods with related corporations (per Corporations Act 2001) AGGREGATED — TBD-NT-15.
- **Transfer of business** (s.12(8)/(9)): on a transmission of business to a new owner with the employee continuing to be employed, service is deemed continuous and the LSL liability transfers with the employee. New employer becomes sole employer.
- **Public holidays during LSL** (s.9): **INCLUSIVE — a PH falling within an LSL period is part of LSL; period not increased.** Parallel to SA. OPPOSITE to NSW/VIC/QLD/WA/TAS/ACT.
- **Cashing out** (s.10(4)): **FORBIDDEN** — s.10(4) explicitly states "no other payment in lieu" is allowed beyond s.10(1)/(2) cessation payouts. Engine refuses `cash_out` trigger with hard-error semantics OR returns advisory + $0 (TBD-NT-08).
- **Leave in advance**: NOT permitted under the NT Act (no statutory basis). Engine refuses `taking_leave` when `years_of_continuous_service < 10` — returns $0 with `nt_advance_leave_not_permitted` advisory. Same shape as TAS TBD-TAS-08 RESOLVED and ACT TBD-ACT-14 RESOLVED (`status: computed` + advisory, not hard error).
- **Pay-on-termination timing** (s.10 — operational reading from research): "as soon as practicable" after cessation. Engine surfaces `payable_by = terminationDate + 14 days` indicative (TBD-NT-09) OR omits the field.
- **Citations**: every case lists the minimum expected citations. The rules engine MAY emit additional citations; tests assert array-membership, not array-equality.

---

## NT-specific divergences from NSW/VIC/QLD/WA/SA/ACT/TAS (the load-bearing facts)

| Topic | NSW | VIC | QLD | WA | SA | ACT | TAS | **NT** | NT source |
|---|---|---|---|---|---|---|---|---|---|
| Qualifying period (full entitlement) | 10 yrs | 7 yrs | 10 yrs | 10 yrs | 10 yrs | 7 yrs | 10 yrs | **10 yrs** | s.8 |
| Entitlement at qualifying period | 8.6667 wks | 6.0667 wks | 8.6667 wks | 8.6667 wks | 13 wks | 6.0667 wks | 8.6667 wks | **13 wks** (TIES WITH SA — most generous) | s.8 |
| Accrual rate after first entitlement | 0.0867 wks/yr | 0.0867 | 0.0867 | 0.0867 | 0.13 | 0.0867 | 0.0867 | **0.13 wks/yr** (TIES WITH SA) | s.8 |
| Discrete step at 15 yrs | NO (continuous) | NO | NO | NO | NO | NO | NO | **+6.5 wks discrete step at 15 yrs** per s.8 wording, equivalent to continuous 1.3 wks/yr | s.8 |
| Pro-rata at termination — sub-threshold | 5 yrs (limited reasons) | 7 yrs (any reason except misconduct) | 7 yrs (limited reasons s.95(3)) | 7 yrs (any reason except misconduct) | 7 yrs (any reason except misconduct OR unlawful worker termination) | 5 yrs (limited reasons) | 7 yrs (limited reasons s.8(3)) | **7 yrs (limited reasons under s.10(2)) — death NOT in this list** | s.10(2) |
| Voluntary resignation 7–10 yrs | n/a (10-yr threshold) | n/a | n/a | YES (any reason except misconduct) | YES (any reason except misconduct OR unlawful worker termination) | n/a | NO | **NO** — voluntary resignation NOT a qualifying reason (TBD-NT-04) | s.10(2) |
| Death 7–10 yrs | YES (NSW s.4(2)(iii)(d)) | n/a (VIC 7-yr threshold any reason) | YES (s.95(3)(a)) | YES (s.8(3)) | YES (s.5) | YES (s.11C) | YES (s.8(3)) | **NOT NAMED in s.10(2); death is covered separately under s.10(3) — TBD-NT-06** | s.10(2) vs s.10(3) |
| Serious & wilful misconduct — sub-threshold | forfeiture | n/a (VIC s.9) | forfeiture | forfeiture | forfeiture | forfeiture | forfeiture | **forfeiture sub-10-yr** | s.10 |
| Serious & wilful misconduct — at/above qualifying threshold | full payout | full payout | full payout | **partial forfeiture (last fully-accrued block only)** | full payout | full payout | full payout | **COMPLETE 10y/15y BLOCKS ONLY (s.10(1A)) — NT UNIQUE** — TBD-NT-05 | s.10(1A) |
| Break tolerance — re-employment | 2 mo | 12 wks | 3 mo | 2 mo (non-slackness); 6 mo (slackness) | 2 mo | 2 mo (non-slackness); 6 mo (slackness) | 3 mo (non-slackness); 6 mo (slackness + 14-day return-to-work offer) | **2 mo (standard); slackness preserves continuity but not length — TBD-NT-12** | s.12 |
| Casual continuity test | "regular and systematic" | 12 weeks unless agreement | 3 months between contracts | regular and systematic | regular or systematic | seasonal interruption >2 mo doesn't break if seasonal | 32 hours per consecutive 4-week period (s.5(3)) | **No specific test in Act — operator-flag based — TBD-NT-03** | s.12 |
| Sickness/injury counted as service | counts | counts | counts | 15-day cap pre-2022 | counts | 2-wk/yr cap | counts in full | **DOES NOT COUNT (unpaid sick leave excluded per s.12)** | s.12 |
| Maternity / paid parental leave | counts (company-paid) | first 52 wks (post-2018) | not specifically encoded | depends on accrual date | counts (company-paid) | does NOT count | DOES NOT COUNT | **DOES NOT COUNT (unpaid maternity excluded per s.12)** | s.12 |
| Workers Comp absence | counts | counts | counts | dual-regime (2024-07-01 cliff) | counts + 156-wk substitution | dual-regime (2023-06-09 cliff) | counts (medical-certificate-backed s.5(1)(c)) | **DOES NOT COUNT — NT divergent (corrected v2.0)** | s.12 |
| WC rate of pay during LSL | counts as service; current rate | s.17 higher-of-pre-injury-or-current | literal s.98 + advisory | literal s.9 + advisory | literal s.4 + advisory | literal s.7 + advisory | literal s.11 + advisory | **WC does NOT count as service — case rarely arises; defensive advisory only** | s.12 + s.7 |
| Public holiday during LSL | exclusive | exclusive | exclusive | exclusive | **INCLUSIVE** | exclusive | exclusive | **INCLUSIVE — PH is part of LSL; period not increased — parallel to SA** | s.9 |
| Casual averaging window | implicit via "regular and systematic" + 52-wk lookback | 3-tier | 52 weeks (s.105) | accrual-period-average | 156 weeks | 12 months (s.7(2) / s.11D anchor) | 12 months (s.11(6)) | **Per-year (each completed year averaged separately) — NT UNIQUE — TBD-NT-01** | s.11(1)(b) / s.11(3) |
| Commission averaging window | branch B (NSW) | s.15 (if in contract) | s.99 — 52.179-day | s.7(4) 365 days | 52 wks | s.2F — 52 wks | 3 mo (s.11(3)) | **12 months immediately prior (s.11 rate-varies branch) — TBD-NT-10** | s.11 |
| **Shift penalties in ordinary pay** | excluded | excluded | INCLUDED (s.98) | excluded | excluded | excluded | INCLUDED (s.11) | **EXCLUDED per s.7(2)** | s.7(2) |
| **All-purpose allowances in ordinary pay** | (varies) | (varies) | INCLUDED | excluded if not all-purpose | included | INCLUDED | INCLUDED | **INCLUDED (industry/leading hand/skill/qualification/service grant) per s.7(2)** | s.7(2) |
| **Bonus / incentive in ordinary pay** | conditional (4-criteria + high-income) | conditional (in contract) | (regulator silent) | excluded by s.7A | excluded | INCLUDED if usually paid | EXCLUDED ABSOLUTELY (s.11(2)(h)) | **INCLUDED if usually paid with pay (s.7(2)(b)) — NT BROADEST in Australia — TBD-NT-07** | s.7(2)(b) |
| **NT per-year `RP × HWW × 1.3` formula** | n/a | n/a | n/a | n/a | n/a | n/a | n/a | **YES — NT UNIQUE; each year stored and summed separately — TBD-NT-01** | s.11(3) |
| Board/lodging cash value | (varies) | s.15(1)(b) | not detailed | s.7C | s.3(2)(c) | included s.7(1) | INCLUDED s.11 | **INCLUDED per s.7(2)(c) with $15/wk board + $5/wk lodging statutory fallback — TBD-NT-11** | s.7(2)(c) |
| Cashing out | not in scope NSW v1 | CRIMINAL OFFENCE s.34 | PERMITTED via QIRC (s.110) — advisory | PERMITTED post-accrual — advisory | PERMITTED post-10-yr — advisory | PERMITTED s.8(c) — advisory | PERMITTED s.10 — advisory | **FORBIDDEN per s.10(4) — TBD-NT-08** | s.10(4) |
| Leave in advance | not encoded NSW v1 | (not specifically encoded) | (not specifically encoded) | s.10 permitted with employer agreement | (not specifically encoded) | NOT permitted | NOT PERMITTED | **NOT PERMITTED — no statutory basis** | s.8 |
| Pay-on-termination timing | forthwith | day of termination | within 3 days (regulator) | day of termination | immediately | within 90 days | day of termination (s.12(4)) | **as soon as practicable — TBD-NT-09** | s.10 (operational) |
| Apprentice lead-in | (varies) | 52 wks | 3 mo | 52 wks | 12 mo | 12 mo | 3 mo | **12 mo per s.12(3) — TBD-NT-14** | s.12(3) |
| Retirement age | (any age) | (any age) | (any age) | (any age) | (any age) | 65 / award-min | 60 women / 65 men | **Age Pension age (67 currently, sex-neutral) — NT UNIQUE — TBD-NT-02** | s.10(2) |
| Records retention | (varies) | (varies) | (varies) | (varies) | (varies) | 7 years | in perpetuity | **3 yrs post-employment (6 yrs if died) — out of v1 scope — TBD-NT-16** | s.14 |
| Industry-specific portable schemes | not in scope | not in scope | separate Acts | MyLeave (construction) | Construction Industry LSL Act 1987 (SA) | OUT OF v1 SCOPE (BCI / CCI / PS Acts) | OUT OF v1 SCOPE: TasBuild | **NONE — NT has no industry-portable LSL scheme — TBD-NT-18** | n/a |
| Related-corporation service aggregation | n/a (NSW silent) | n/a | n/a | s.6 (WA) | s.3(3) (SA) | n/a | n/a | **YES per s.12(6)/(7) — TBD-NT-15** | s.12(6)/(7) |

---

## Coverage at a glance

| Source / Theme | Test IDs | Count |
|---|---|---|
| APA PDF NT worked examples (NT section) | TC-NT-001 → TC-NT-008 | 8 |
| Sub-7-year and 7–10-year qualifying-reason cases (s.10(2)) | TC-NT-009 → TC-NT-018 | 10 |
| 10+ year full payout (any reason except misconduct) (s.10(1)) | TC-NT-019 → TC-NT-022 | 4 |
| Serious & wilful misconduct treatment — s.10(1A) complete-blocks-only (NT UNIQUE) | TC-NT-023 → TC-NT-026 | 4 |
| Continuous-service edge cases (s.12) | TC-NT-027 → TC-NT-036 | 10 |
| Workers Comp / unpaid sick / unpaid maternity exclusion (s.12) | TC-NT-037 → TC-NT-040 | 4 |
| Public holiday INCLUSIVE in LSL period (s.9) — NT DIVERGENT | TC-NT-041 → TC-NT-043 | 3 |
| Ordinary pay — fixed-rate, allowances, board/lodging (s.7(2)) | TC-NT-044 → TC-NT-049 | 6 |
| Bonus inclusion "usually paid with pay" (s.7(2)(b)) — NT BROADEST | TC-NT-050 → TC-NT-052 | 3 |
| **NT per-year `RP × HWW × 1.3` formula — NT UNIQUE** (s.11(3)) | TC-NT-053 → TC-NT-058 | 6 |
| Variable rate / commission — 12-month lookback (s.11 rate-varies branch) | TC-NT-059 → TC-NT-061 | 3 |
| 15-year and 20-year accrual (incl. +6.5-wk step) (s.8) | TC-NT-062 → TC-NT-063 | 2 |
| Cashing out — FORBIDDEN hard-stop (s.10(4)) | TC-NT-064 → TC-NT-066 | 3 |
| Death — payable to personal representative (s.10(3)) | TC-NT-067 → TC-NT-068 | 2 |
| Transfer of business + related corporations (s.12(6)–(9)) | TC-NT-069 → TC-NT-070 | 2 |
| Leave in advance — refused (no statutory basis) | TC-NT-071 | 1 |
| As-at snapshot trigger | TC-NT-072 → TC-NT-073 | 2 |
| Cross-jurisdiction (NT + other state) | TC-NT-074 → TC-NT-075 | 2 |
| Bulk-mode fixtures | TC-NT-BULK-001 → TC-NT-BULK-003 | 3 |
| **Total active single-mode fixtures for v1 NT launch** | | **75** |
| **Bulk-mode fixtures** | | **3** |
| **Grand total** | | **78** |

> **Note on size**: NT fixture count (78) is on parity with TAS / ACT (78). The extras come from: (a) the NT-unique per-year `RP × HWW × 1.3` formula (6 fixtures); (b) the s.10(1A) complete-blocks-only misconduct treatment (4 fixtures vs TAS's 3); (c) the s.10(4) forbidden cash-out (3 hard-stop fixtures); (d) the Age-Pension-age retirement gate (covered inline in §B); (e) related-corporation aggregation (1 fixture). Bulk count matches QLD/WA/SA/ACT/TAS at 3.

---

# Single-mode test cases

> **DRAFT NOTE**: The single-mode fixture bodies (TC-NT-001 through TC-NT-075) will be drafted during T9.0 *after* the operator interview locks the TBD resolutions. Stub IDs and one-line descriptions are listed above in the Coverage at a glance table. Individual fixture YAML bodies are deferred to a post-interview update of this doc (T9.0 sign-off pass) so that fixture expected values can be drafted on RESOLVED rule sets, not draft ones. This mirrors the TAS Phase 8 pattern where fixture bodies were drafted alongside the resolutions, not before.

---

# Bulk-mode test cases

> **DRAFT NOTE**: Bulk-mode fixtures (TC-NT-BULK-001..003) likewise deferred to post-interview update. Skeleton intent:
>
> - **TC-NT-BULK-001** — 5-employee NT-only fixture, mixed tenures and triggers (10-yr full / 7-yr pro-rata / 12-yr per-year-formula / sub-10-yr misconduct / cash-out hard-stop).
> - **TC-NT-BULK-002** — 10-employee mixed NSW + VIC + QLD + WA + SA + ACT + TAS + NT, with NT per-year-formula + bonus-included + PH-inclusive cases.
> - **TC-NT-BULK-003** — Mixed-state per-year-formula + retirement-age matrix (NT-distinctive rules in bulk).

---

# Coverage matrix

| Spec / source item | Covered by |
|---|---|
| **NT LSL Act 1981 s.7** — Who is entitled / ordinary-pay definition | TC-NT-044 → TC-NT-049, TC-NT-050 → TC-NT-052 |
| **NT LSL Act 1981 s.7(2)** — Ordinary pay include/exclude list (incl. allowances) | TC-NT-044 → TC-NT-049 |
| **NT LSL Act 1981 s.7(2)(b)** — Bonus inclusion "usually paid with pay" | TC-NT-050 → TC-NT-052 |
| **NT LSL Act 1981 s.7(2)(c)** — Board/lodging cash value with $15/wk + $5/wk statutory fallback | TC-NT-046 |
| **NT LSL Act 1981 s.8** — Entitlement formula (13 wks at 10 yrs + 6.5 wks per subsequent 5 yrs) | TC-NT-001, TC-NT-005, TC-NT-019 → TC-NT-022, TC-NT-062, TC-NT-063 |
| **NT LSL Act 1981 s.9** — PH-INCLUSIVE in LSL period (NT DIVERGENT) | TC-NT-041 → TC-NT-043 |
| **NT LSL Act 1981 s.10(1)** — Full payout 10+ yrs (completed years only) | TC-NT-019 → TC-NT-022 |
| **NT LSL Act 1981 s.10(1A)** — Serious misconduct complete 10y/15y blocks only (NT UNIQUE) | TC-NT-023 → TC-NT-026 |
| **NT LSL Act 1981 s.10(2)** — Pro-rata at 7–10 yrs / qualifying reasons (death NOT named) | TC-NT-002, TC-NT-003, TC-NT-009 → TC-NT-018 |
| **NT LSL Act 1981 s.10(3)** — Death payable to personal representative | TC-NT-067 → TC-NT-068 |
| **NT LSL Act 1981 s.10(4)** — Cash-out FORBIDDEN | TC-NT-064 → TC-NT-066 |
| **NT LSL Act 1981 s.11** — Hours + rate of pay (variable-rate 12-mo branch) | TC-NT-059 → TC-NT-061 |
| **NT LSL Act 1981 s.11(3)** — Per-year `RP × HWW × 1.3` formula (NT UNIQUE — load-bearing) | TC-NT-053 → TC-NT-058 |
| **NT LSL Act 1981 s.12** — Continuous service (WC / maternity / sick / LWOP exclusions) | TC-NT-027 → TC-NT-040 |
| **NT LSL Act 1981 s.12(3)** — Apprentice 12-month lead-in | TC-NT-036 |
| **NT LSL Act 1981 s.12(6)/(7)** — Related-corporation service aggregation | TC-NT-070 |
| **NT LSL Act 1981 s.12(8)/(9)** — Transfer of business preserves continuity | TC-NT-069 |
| **Workers Comp does NOT count as service (NT divergent)** | TC-NT-037 |
| **Unpaid maternity does NOT count as service** | TC-NT-038 |
| **Unpaid sick leave does NOT count as service** | TC-NT-039 |
| **Leave without pay (general) does NOT count as service** | TC-NT-040 |
| **Retirement age — Age Pension age (NT UNIQUE — TBD-NT-02)** | TC-NT-013, TC-NT-014, TC-NT-015 |
| **Advance leave NOT permitted** | TC-NT-071 |
| **E2 spec F2 / AC1 / AC2** — per-state rule set + test suite | this file + encoded fixtures |
| **E2 spec F13 / AC14** — Cross-jurisdictional governing-state nomination | TC-NT-074, TC-NT-075 |
| **E2 spec F16 / F17 / AC16** — State selector + mixed-state bulk CSV | TC-NT-BULK-002, TC-NT-BULK-003 |
| **E2 spec AC4 / AC4a / AC4b** — PM sign-off + per-state launch gate | this file's PM signature line below — **PENDING — N TBDs open** |

---

# Items flagged `TBD-NT-NN` — DRAFT · 0/N RESOLVED · N open

All 18 TBDs are listed below ordered by severity (Sev-1 = load-bearing / blocks sign-off; Sev-2 = engine-shape; Sev-3 = nice-to-have). PM recommendations are inline. **Status (2026-05-27)**: DRAFT — operator interview pending.

---

## TBD-NT-01 — [Sev-1, LOAD-BEARING] NT per-year `RP × HWW × 1.3` formula — engine schema for per-year hours history

**Status**: ✅ RESOLVED 2026-05-27 — Option (a)

**The question**: NT s.11(3) is structurally unique in Australia. Payment is computed as `Σ over each completed year of continuous service: RP × HWW_y × 1.3` — each year has its own hours-per-week average (HWW_y). RP is the rate immediately preceding cessation/LSL/agreed-day. **The engine MUST keep per-year hours history** — current hours alone is insufficient. The schema question: where does this hours history live?

**Legislative citation**: NT LSL Act 1981 s.11(3): *"The amount payable under section 8 in respect of each completed year of continuous service is — (a) where the hours of work per week have remained constant — the rate of pay immediately preceding the day on which the employee ceases or takes leave, multiplied by the hours of work per week, multiplied by 1.3; (b) where the hours of work per week have varied — the rate of pay immediately preceding the day on which the employee ceases or takes leave, multiplied by the average hours of work per week during that year of continuous service, multiplied by 1.3."* Statutory worked examples in s.11(4)/(5).

**Options**:

- **Option (a) — TAS-style state-localised `extraInputs.nt_hours_per_week_by_year`**. Operator pre-computes per-year averages and supplies an array of `{ yearStart, yearEnd, hoursPerWeek }` objects. Engine consumes directly. Pattern: parallel to TAS / SA / ACT localised extraInputs.
  - Dev cost: ~1.5 dev-days (per-year iterator + summation + advisory wiring).
  - Legal risk: LOW — operator owns the per-year hours derivation.
  - Completeness: HIGH if operator supplies; engine falls back to single-year flat path if `[]` with advisory.
  - Cross-state parallel: TAS / SA / ACT pattern; consistent with YAGNI principle observed for SA TBD-SA-07.

- **Option (b) — Top-level cross-state `Employee.hoursPerWeekByYear` (DEV-CROSS-3)**. Promote the field to the top-level Employee schema as an optional. NT is the sole v1 consumer; ignored by all other state orchestrators.
  - Dev cost: ~2 dev-days (schema change + cross-state PR + NT engine integration). Adds ~0.5 day in PR/review overhead.
  - Legal risk: LOW — same as (a).
  - Completeness: HIGH; sets up future state engines (e.g. WA's per-accrual-period averaging could potentially reuse).
  - Cross-state parallel: DEV-CROSS-1 (termination enum) + DEV-CROSS-2 (WC flags) precedent. Third cross-state field.

- **Option (c) — Engine auto-derives from `wageHistory`**. Engine slices `wageHistory` into year-aligned periods and computes per-year hours from gross-pay-to-hourly-rate inference. No new schema.
  - Dev cost: ~3 dev-days (derivation + edge-case handling for sparse/missing periods + rate inference).
  - Legal risk: MEDIUM — derivation may diverge from operator-known truth; engine values would be hard to defend in a dispute.
  - Completeness: LOW — depends on `wageHistory` density; sparse history → poor estimates.
  - Cross-state parallel: not used by any other state engine (NSW uses summary, SA uses 156-wk window, WA uses 365-day, TAS uses 12-mo or 3-mo).

**PM recommendation**: **Option (a) — TAS-style state-localised `extraInputs.nt_hours_per_week_by_year`**. Rationale: (i) The operator's YAGNI ruling on SA TBD-SA-07 set the precedent — promote to top-level only when there is genuine cross-state value, which there isn't here; (ii) NT is the final state and the field would have no v2 consumer; (iii) Localised pattern is consistent with TAS Phase 8 (TBD-TAS-04 hybrid casual-continuity flag) and ACT Phase 7 (TBD-ACT-04 `act_ft_to_pt_transition_date`); (iv) ~0.5 dev-day saved vs Option (b) by avoiding cross-state PR; (v) avoids the inference fragility of Option (c).

**RESOLVED 2026-05-27: Option (a) — state-localised `extraInputs.nt_hours_per_week_by_year`.** Operator confirmed PM recommendation. No DEV-CROSS-3 created. Engine consumes `extraInputs.nt_hours_per_week_by_year: Array<{ yearStart: ISODate, yearEnd: ISODate, hoursPerWeek: number }>` as the per-year HWW source-of-truth. Engine falls back to flat `currentWeeklyGross / currentHourlyRate` derivation with `nt_hours_per_year_history_not_supplied` advisory when the array is empty.

**Cross-state flag**: DEV-CROSS-3 NOT created. NT-specific signal localised in `extraInputs.nt_*` per TAS/SA/ACT precedent. T9.1 unblocked on this dimension.

**Engine impact**: ~1.5 dev-days for Option (a) — `nt_per_year_calculator.ts` (per-year iterator + summation + advisory wiring). Adds ~0.5 day for Option (b). Adds ~3 days for Option (c).

---

## TBD-NT-02 — [Sev-1, LOAD-BEARING] Retirement age — Age Pension age lookup mechanism

**Status**: ✅ RESOLVED 2026-05-27 — Option (b) + Option (c) override layered

**The question**: NT s.10(2) qualifies pro-rata at 7–10 yrs on "reaching retirement age" — operationally interpreted as the Cth Age Pension age. **Currently 67 for both genders for births on or after 1 Jan 1957**, but the Age Pension age has risen on a schedule over the past 20 years and may rise further. How does the engine apply this gate, and how does it stay current?

**Legislative citation**: NT LSL Act 1981 s.10(2): *"… (i) has reached the age of pension qualifying age as defined in the Social Security Act 1991 of the Commonwealth … the entitlement period is the period of continuous service that has elapsed at the date of cessation."*  Cth Social Security Act 1991 s.23 defines "pension age" with a year-of-birth table.

**Options**:

- **Option (a) — Hardcode 67 + advisory**. Engine treats Age Pension age as 67 for all employees (the current value for births 1 Jan 1957 onwards). Emits `nt_retirement_qualifying_age_pension_age` advisory documenting this assumption. Year-of-birth nuances for older workers (born before 1 Jan 1957) deferred as documented limitation. Re-validate annually at RES-3.
  - Dev cost: ~½ dev-day.
  - Legal risk: LOW for workers born after 1957; MEDIUM for workers near the cutoff dates (born 1952–1956 may legitimately have a lower qualifying age — 65, 65.5, 66, 66.5).
  - Completeness: PARTIAL — covers ~99% of LSL-relevant workforce (workers retiring in 2026+ are born 1959+).
  - Cross-state parallel: NSW/VIC/QLD/WA/SA don't have a sex-specific or age-pension-tied retirement gate. ACT uses single age-65 or award-min. TAS uses sex-specific 60F/65M. NT is the only Australian jurisdiction using the federal Age Pension age.

- **Option (b) — Year-of-birth lookup table**. Engine reads `employee.dob`, looks up the Age Pension age from a hardcoded year-of-birth table per Cth Social Security Act 1991 s.23. Returns age-at-termination >= looked-up Age Pension age.
  - Dev cost: ~1 dev-day (lookup table + dob-required gate + advisory).
  - Legal risk: LOW.
  - Completeness: HIGH — handles all workers including older cohorts.
  - Cross-state parallel: reuses `employee.dob` field already added in ACT Phase 7.

- **Option (c) — Operator-supplied override only**. Engine reads `extraInputs.nt_age_pension_age_at_termination_reached: boolean`; defaults `false`. When `true`, retirement qualifies. No automatic age-from-dob check.
  - Dev cost: ~¼ dev-day.
  - Legal risk: LOW — operator owns the determination.
  - Completeness: LOW — pushes the lookup burden onto operator with no engine support; operator-error risk.
  - Cross-state parallel: TAS TBD-TAS-02 added the `tas_award_min_retirement_age_reached` override pattern, but in TAS the engine also has a default sex-specific reading. (c) alone would be incomplete.

**PM recommendation**: **Option (b) — year-of-birth lookup table**. Rationale: (i) `employee.dob` is already in the schema from ACT Phase 7, so no schema change; (ii) the year-of-birth table is small (4 cutoff dates) and stable — last change was in 2009 setting the gradual rise to 67 by 2023; (iii) reuses the dob-required pattern from ACT (parallel cross-state consistency); (iv) full coverage with low dev cost; (v) the override (Option c) is added on top as `extraInputs.nt_age_pension_age_at_termination_reached` for the case where operator doesn't want to supply dob (privacy / data-availability). The override LOC additional cost is minimal.

**RESOLVED 2026-05-27: Option (b) primary + Option (c) override layered.** Operator confirmed PM recommendation. Engine consumes `employee.dob` (already in schema, verified at `engine/types.ts:220` — consumed by ACT s.7(7) reading at `states/act/rules/accrual-table.ts:69`) and resolves the Cth SS Act 1991 s.23 year-of-birth → pension-age lookup table:
- born ≤ 30 Jun 1952 → 65
- 1 Jul 1952 – 31 Dec 1953 → 65.5
- 1 Jan 1954 – 30 Jun 1955 → 66
- 1 Jul 1955 – 31 Dec 1956 → 66.5
- 1 Jan 1957 onwards → 67

Override path: `extraInputs.nt_age_pension_age_at_termination_reached: boolean` (defaults `false`). When `true`, gate qualifies regardless of dob. When dob absent AND override absent/false, engine treats retirement gate as not satisfied and emits `nt_retirement_gate_unverified` advisory.

**Engine impact**: ~1.5 dev-days total (1d for dob lookup + ½d for override path). RES-3 quarterly review check: re-validate the lookup table if Cth Age Pension age legislation is amended.

---

## TBD-NT-03 — [Sev-1, LOAD-BEARING] Casual continuity test — NT Act is silent

**Status**: ✅ RESOLVED 2026-05-27 — Option (a)

**The question**: NT LSL Act 1981 s.12 lists what does and does not count as continuous service but does NOT specify a casual continuity test analogous to TAS s.5(3) 32-hr-4-wk or NSW "regular and systematic". How does the engine evaluate casual continuity?

**Legislative citation**: NT LSL Act 1981 s.12 (continuous service): enumerated list of counts/does-not-count items. No mention of casual employees' continuity test. NT s.7 (who is entitled) explicitly names "casual" as eligible. The Act is silent on the test.

**Options**:

- **Option (a) — Permissive default + advisory**. Engine treats casual employees as having continuous service unless operator explicitly supplies `extraInputs.nt_casual_continuity_preserved: false`. Emits `nt_casual_continuity_preserved_default` advisory when no flag supplied. When `false`, engine requires `nt_casual_continuity_break_date` to confine forfeiture; otherwise strict-zeros.
  - Dev cost: ~½ dev-day.
  - Legal risk: MEDIUM — Act silence is ambiguous; permissive reading may over-pay; restrictive reading may under-pay. Permissive errs employee-favourable (strict-construction default for benefit-conferring legislation).
  - Completeness: HIGH if operator engages; permissive default if not.
  - Cross-state parallel: TAS TBD-TAS-04 Option (c) hybrid pattern (auto-derive from wageHistory + operator flag + permissive default).

- **Option (b) — Auto-derive from `wageHistory` "regular and systematic"-style test**. Engine derives continuity from `wageHistory` density (e.g. > 4 weeks gap = break, parallel to NSW common-law test).
  - Dev cost: ~1.5 dev-days (derivation module + edge cases + advisory).
  - Legal risk: MEDIUM-HIGH — engine imposing a test where the Act is silent.
  - Completeness: HIGH automatically; brittle for sparse `wageHistory`.
  - Cross-state parallel: NSW "regular and systematic" common-law reading.

- **Option (c) — Hybrid (TAS-style)**. Engine attempts auto-derivation from `wageHistory`; falls back to operator flag; falls back to permissive default + advisory. Same shape as TAS TBD-TAS-04 RESOLVED Option (c).
  - Dev cost: ~1 dev-day.
  - Legal risk: MEDIUM.
  - Completeness: HIGH.
  - Cross-state parallel: TAS TBD-TAS-04 RESOLVED.

**PM recommendation**: **Option (a) — Permissive default + operator flag**. Rationale: (i) The Act is silent, so the engine should NOT impose a quantitative test it would have to defend; (ii) permissive default is operator-friendly and benefits-conferring-legislation-aligned; (iii) operator who knows the worker's pattern can flag via `extraInputs.nt_casual_continuity_preserved: false`; (iv) auto-derivation (Option b/c) creates a legal-risk surface where the engine is making determinations the Act doesn't authorise; (v) the simpler default+flag pattern is sufficient for v1 (re-evaluate at RES-3 if operator feedback indicates a test is needed).

**RESOLVED 2026-05-27: Option (a) — Permissive default + operator flag.** Operator confirmed PM recommendation. Engine consumes `extraInputs.nt_casual_continuity_preserved: boolean | undefined`:
- `undefined` → engine treats casual service as continuous (permissive default) + emits `nt_casual_continuity_preserved_default` advisory documenting the assumption.
- `true` → engine treats casual service as continuous (no advisory).
- `false` → engine requires `extraInputs.nt_casual_continuity_break_date: ISODate`. When supplied, that date splits the service. When absent, engine strict-zeros all service for the casual employee + emits `nt_casual_continuity_not_preserved_no_break_date` advisory (parallel to TAS TBD-TAS-17).

The engine does NOT impose a quantitative test (no 4-week-gap rule, no 32hr/4wk lookback). The operator owns the determination.

**Engine impact**: ~½ dev-day. RES-3 quarterly review check: re-evaluate if NT case law or operator feedback indicates a quantitative test is needed.

---

## TBD-NT-04 — [Sev-1, LOAD-BEARING] Voluntary resignation 7–10 yrs — qualifying or not

**Status**: ✅ RESOLVED 2026-05-27 — Option (a) — strict closed-list reading

**The question**: NT s.10(2) lists qualifying reasons for pro-rata at 7–10 yrs: retirement (Age Pension age), employer-not-misconduct, illness/incapacity/domestic-pressing-necessity. **Voluntary resignation is NOT named.** Does this mean voluntary resignation in the 7–10 yr band does NOT qualify for pro-rata? **And the related question**: NT s.10(2) does NOT name "death" — death is covered separately under s.10(3). Does the death-not-named pattern mean s.10(2) is a closed list?

**Legislative citation**: NT LSL Act 1981 s.10(2): *"… ceases to be employed for any one of the following reasons — (a) the employee has reached the age of pension qualifying age …; (b) the employee was terminated by the employer for any reason other than serious or wilful misconduct; (c) the employee has terminated employment because of illness or incapacity, or because of any other domestic or other pressing necessity, justifying the termination …"*  The list is closed. Death is covered separately under s.10(3).

**Options**:

- **Option (a) — Strict closed-list reading**. Voluntary resignation 7–10 yrs pays $0. Binary 10-yr cliff (9.99 yrs voluntary res → $0; 10.00 yrs voluntary res → 13 wks under s.10(1)). Matches TAS / ACT / NSW precedent.
  - Dev cost: 0 dev-days (folded into the qualifying-reason gate from TBD-NT-02).
  - Legal risk: LOW — strict-construction defensible reading.
  - Completeness: HIGH.
  - Cross-state parallel: TAS TBD-TAS-07 RESOLVED Option (a); ACT 5-7 yr band reading.

- **Option (b) — Permissive open-list reading**. Any employee-initiated termination not specifically excluded by misconduct counts. Voluntary res 7-10 yrs pays pro-rata.
  - Dev cost: 0 dev-days.
  - Legal risk: MEDIUM-HIGH — open-list reading is not the natural reading of s.10(2)(a)/(b)/(c).
  - Completeness: HIGH but legally weak.
  - Cross-state parallel: SA / WA — both EXPLICITLY include voluntary resignation post-7-yr ("any reason except misconduct"). But NT s.10(2) drafts differently from SA / WA — those Acts are open-list; NT is closed-list.

**PM recommendation**: **Option (a) — strict closed-list reading**. Rationale: (i) The s.10(2) list is structurally closed (uses "for any one of the following reasons" + 3 enumerated items); (ii) Voluntary resignation is conspicuous by its absence — drafters chose 3 reasons and stopped; (iii) Cross-jurisdictional pattern parallel to TAS and ACT (both closed-list); (iv) Death's separate treatment under s.10(3) reinforces the closed-list reading of s.10(2) (drafters separated death-and-estate path from the 3 living-employee reasons); (v) Strict-construction defensible — engine errs operator-friendly (no surprise payouts) while remaining open to override if operator disputes.

**RESOLVED 2026-05-27: Option (a) — strict closed-list reading of s.10(2).** Operator confirmed PM recommendation. Engine enforces a binary 10-yr cliff for voluntary resignation:
- < 10.000 yrs voluntary res → $0 entitlement + emits `nt_voluntary_resignation_sub_10yr_cliff` advisory.
- ≥ 10.000 yrs voluntary res → s.10(1) full payout (13 wks × HWW × 1.3 per the per-year formula).

Engine error path: if operator supplies `TerminationReason: voluntary_resignation` AND service is 7.000–9.999 yrs, engine returns `status: computed` with `entitlementWeeks: 0` + the advisory. No qualifying-reason carve-out at 7–10 yrs. This is the same cliff shape as TAS TBD-TAS-07 RESOLVED.

**Engine impact**: 0 dev-days additional (folded into TBD-NT-02 qualifying-reason gate logic).

---

## TBD-NT-05 — [Sev-2] Serious misconduct at 10+ yrs — s.10(1A) complete-blocks-only (NT UNIQUE) interpretation

**Status**: ✅ RESOLVED 2026-05-27 — Option (a)

**The question**: At 10+ yrs of continuous service, when an employee is dismissed for serious & wilful misconduct, NT s.10(1A) says payment is "only complete 10y/15y blocks counted." This is **structurally different** from NSW/VIC/QLD/SA/ACT/TAS (full payout) AND from WA (last fully-accrued 5-yr block only). How does the engine encode the truncation?

**Legislative citation**: NT LSL Act 1981 s.10(1A): *"Where the employment of an employee is terminated for serious or wilful misconduct, the entitlement payable under subsection (1) is limited to the long service leave that the employee had completed at the most recent multiple of 10 or 15 years of continuous service."* Per the research dossier note: "only complete 10y/15y blocks counted."

**Options**:

- **Option (a) — Strict block truncation (10y / 15y / 20y / 25y / 30y multiples)**. Engine truncates `years_of_continuous_service` to the nearest completed multiple-of-5-years-starting-at-10. E.g. 11.5 yrs misconduct → 10 yrs payable (13 wks); 16.5 yrs misconduct → 15 yrs payable (19.5 wks); 21 yrs misconduct → 20 yrs payable (26 wks). NOT continuous accrual — discrete blocks.
  - Dev cost: ~½ dev-day (one extra rule in `nt/rules/accrual-table.ts`).
  - Legal risk: LOW — literal Act reading.
  - Completeness: HIGH.
  - Cross-state parallel: WA s.8(3) partial-forfeiture (5-yr-block) but more severe at NT — only 10y AND 15y multiples count.

- **Option (b) — Continuous accrual at 1.3 wks/yr with no misconduct discount**. Engine pays full accrued entitlement regardless. Treat s.10(1A) as informational / unenforced.
  - Dev cost: 0 dev-days.
  - Legal risk: HIGH — explicit Act text not honoured; high-stakes employer overpayment.
  - Completeness: NO — incorrect.
  - Cross-state parallel: NSW/VIC/QLD/SA/ACT/TAS full-payout pattern, but those Acts are structurally different (s.10(1A) has no equivalent in those Acts).

- **Option (c) — Continuous accrual MINUS the misconduct discount (parallel to WA 5-yr-block)**. Engine pays accrued entitlement up to the nearest completed 5-yr block (not 10/15-yr). E.g. 11.5 yrs → 10 yrs payable; 14.5 yrs → 10 yrs payable; 16 yrs → 15 yrs payable.
  - Dev cost: ~½ dev-day.
  - Legal risk: MEDIUM — extends s.10(1A) interpretation more leniently than literal.
  - Completeness: HIGH.
  - Cross-state parallel: WA s.8(3) pattern.

**PM recommendation**: **Option (a) — strict block truncation at 10y/15y multiples per literal s.10(1A) text**. Rationale: (i) The Act says "10 or 15 years" — drafters chose these specific multiples; (ii) Cross-state parallel to WA (TBD-WA-08 RESOLVED partial-forfeiture) but at NT the truncation is more severe; (iii) Literal reading is defensible; lenient reading (Option c) extends what the Act says; (iv) Discrete-blocks engine logic is a small addition to the accrual table.

**RESOLVED 2026-05-27: Option (a) — strict block truncation at 10y/15y multiples.** Operator confirmed PM recommendation. Engine logic: at termination for `serious_or_wilful_misconduct` with continuous service ≥ 10 yrs, engine sets `effective_years_for_payout = floor(years / 5) × 5` BUT only at multiples ∈ {10, 15, 20, 25, 30, …}. Payout = `effective_years × 1.3 wks × HWW (using stored per-year history for that block range)`. Engine emits `nt_10yr_plus_misconduct_complete_blocks_only` advisory documenting the truncation.

Worked examples (engine output):
- 10.0 yrs misconduct → 10 yrs payable (13 wks × HWW × 1.3 — per-year aggregation)
- 14.999 yrs misconduct → 10 yrs payable
- 15.000 yrs misconduct → 15 yrs payable (19.5 wks)
- 21 yrs misconduct → 20 yrs payable (26 wks)
- 29.99 yrs misconduct → 25 yrs payable (32.5 wks)

**Engine impact**: ~½ dev-day. New warning code `nt_10yr_plus_misconduct_complete_blocks_only`.

---

## TBD-NT-06 — [Sev-2] Death 7–10 yrs — s.10(3) interaction with s.10(2)

**Status**: ✅ RESOLVED 2026-05-27 — Option (a)

**The question**: NT s.10(2) lists 3 pro-rata-qualifying reasons (retirement/employer-not-misconduct/illness) — death is NOT named. NT s.10(3) separately states death is payable to the personal representative. **Does s.10(3) apply at any tenure, or only at 10+ yrs (parallel to s.10(1))?** I.e. does a worker who dies at 7-10 yrs of service get pro-rata under s.10(3), full under s.10(1), or zero?

**Legislative citation**: NT LSL Act 1981 s.10(3): *"If an employee dies, an amount equal to the entitlement payable under this section is payable to the personal representative of the deceased employee."*  s.10(1)/(2) define the entitlement amounts.

**Options**:

- **Option (a) — s.10(3) cross-references both s.10(1) AND s.10(2)** — death at any tenure ≥ 7 yrs gets the appropriate band's payment. 7-10 yrs death → pro-rata; 10+ yrs death → full payout. Sub-7-yrs death → $0.
  - Dev cost: 0 dev-days (engine routes death to s.10(2) if 7-10 yrs, s.10(1) if 10+).
  - Legal risk: LOW-MEDIUM — natural reading of s.10(3) "the entitlement payable under this section".
  - Completeness: HIGH.
  - Cross-state parallel: NSW/VIC/QLD/SA/ACT/TAS all qualify death as a pro-rata reason from 7 yrs (or 5 yrs for NSW/ACT).

- **Option (b) — s.10(3) only cross-references s.10(1)** — death payable only at 10+ yrs. 7-10 yrs death → $0.
  - Dev cost: 0 dev-days.
  - Legal risk: MEDIUM-HIGH — narrow reading; harsh on bereaved families; runs against the benefits-conferring strict-construction default.
  - Completeness: HIGH per strict literal reading of s.10(2) (closed list, death not named).
  - Cross-state parallel: NONE — no other Australian state has this gap.

- **Option (c) — Operator-supplied flag**. Engine refuses to rule; requires `extraInputs.nt_death_7_to_10_yr_treatment: 'pro_rata' | 'no_entitlement'`.
  - Dev cost: ~¼ dev-day.
  - Legal risk: MEDIUM — pushes determination to operator.
  - Completeness: LOW — operator-error risk.
  - Cross-state parallel: none.

**PM recommendation**: **Option (a) — s.10(3) cross-references both s.10(1) AND s.10(2)**. Rationale: (i) The text says "the entitlement payable under this section" — "this section" is s.10, not s.10(1) specifically; (ii) Cross-jurisdictional parallel — all 7 other states qualify death from a sub-threshold band; treating NT as a uniquely-harsh outlier when the Act text supports a broader reading is not defensible; (iii) Strict-construction default for benefits-conferring legislation favours the employee on legislative silence/ambiguity; (iv) Operationally cleaner — engine routes death like any other 7+ year termination, with the personal-representative payment recipient.

**RESOLVED 2026-05-27: Option (a) — s.10(3) cross-references both s.10(1) AND s.10(2).** Operator confirmed PM recommendation. Engine routes `TerminationReason: death` (or `personal_representative_claim` if surfaced) as follows:
- < 7.000 yrs at death → $0 + `nt_death_sub_7yr_no_entitlement` advisory
- 7.000–9.999 yrs at death → s.10(2) pro-rata path (qualifying reason: death is treated as auto-qualifying)
- ≥ 10.000 yrs at death → s.10(1) full payout

Payment recipient: personal representative of the deceased. Engine emits `nt_death_payable_to_personal_representative` advisory documenting the payee shift. Engine reads "this section" in s.10(3) as the whole of s.10 — natural reading, benefits-conferring strict-construction default.

**Engine impact**: 0 dev-days additional (folded into the qualifying-reason gate; death is treated as auto-qualifying at ≥ 7 yrs).

---

## TBD-NT-07 — [Sev-2] Bonus inclusion s.7(2)(b) "usually paid with pay" — engine signal source

**Status**: ✅ RESOLVED 2026-05-27 — Option (a)

**The question**: NT s.7(2)(b) explicitly INCLUDES bonus / incentive scheme amounts in ordinary pay IF "they are usually paid with pay" — broadest bonus-inclusion reading in Australia. How does the engine determine whether a bonus is "usually paid with pay"?

**Legislative citation**: NT LSL Act 1981 s.7(2)(b): *"Bonus or incentive scheme amounts, being amounts that are usually paid with pay."*  Distinct from TAS (absolute exclusion s.11(2)(h)), NSW (4-part test + high-income threshold), ACT (usually-paid test per WorkSafe ACT), and SA/WA (excluded).

**Options**:

- **Option (a) — Operator-supplied flag**. Engine reads `extraInputs.nt_bonus_usually_paid_with_pay: boolean` (default `false`). When `true`, bonus is included; when `false`, excluded. Engine does NOT auto-detect bonus from `wageHistory.note`.
  - Dev cost: ~¼ dev-day.
  - Legal risk: LOW — operator owns the determination.
  - Completeness: HIGH if operator engages.
  - Cross-state parallel: parallel to TAS TBD-TAS-15 RESOLVED operator-pre-strips pattern.

- **Option (b) — Auto-detect from `wageHistory.note`**. Engine reads `wageHistory[].note` for "bonus" or "incentive" substring; emits `nt_bonus_usually_paid_with_pay_included` advisory and includes if detected.
  - Dev cost: ~½ dev-day.
  - Legal risk: MEDIUM — auto-inclusion of bonuses that may not be "usually paid with pay" risks over-pay.
  - Completeness: PARTIAL — depends on operator annotation discipline.
  - Cross-state parallel: TAS TBD-TAS-15 pattern (but TAS uses substring-match for *exclusion*; NT would use it for *inclusion* — reverse risk profile).

- **Option (c) — Hybrid: operator-supplied flag + auto-detect advisory**. Engine reads `extraInputs.nt_bonus_usually_paid_with_pay` if supplied; otherwise substring-matches `wageHistory.note`. When operator-flag is set, that decision binds; when only auto-detect fires, emit advisory but DO include.
  - Dev cost: ~½ dev-day.
  - Legal risk: MEDIUM.
  - Completeness: HIGH.
  - Cross-state parallel: hybrid pattern from TAS TBD-TAS-04.

**PM recommendation**: **Option (a) — operator-supplied flag**. Rationale: (i) "Usually paid with pay" is an operator-side determination (employer/payroll knows whether bonuses are paid on the regular cycle vs. discretionary one-offs); (ii) Engine should not auto-determine bonus-inclusion when operator has the better data; (iii) Default `false` (exclude) errs employer-friendly — same conservative default as TAS bonus exclusion. Operator can opt in via the flag; engine emits advisory either way; (iv) Avoids the false-positive risk of substring-match (e.g. "no bonus this period" matching "bonus"); (v) Simpler dev path.

**RESOLVED 2026-05-27: Option (a) — operator-supplied flag, default exclude.** Operator confirmed PM recommendation. Engine reads `extraInputs.nt_bonus_usually_paid_with_pay: boolean | undefined`:
- `undefined` or `false` → bonus excluded from RP. Engine emits `nt_bonus_usually_paid_with_pay_excluded` advisory (conservative default; documents the exclusion in the report).
- `true` → bonus included in RP. Engine emits `nt_bonus_usually_paid_with_pay_included` advisory documenting the inclusion + the source operator-flag.

Engine does NOT auto-detect bonus from `wageHistory.note` substring matches (false-positive risk). The "usually paid with pay" determination is operator-side (employer/payroll knows regular vs discretionary cadence).

**Engine impact**: ~¼ dev-day. New advisory codes `nt_bonus_usually_paid_with_pay_included` and `nt_bonus_usually_paid_with_pay_excluded`.

---

## TBD-NT-08 — [Sev-2] Cash-out FORBIDDEN per s.10(4) — engine refusal semantics

**Status**: ✅ RESOLVED 2026-05-27 — Option (b) — hard error

**The question**: NT s.10(4) explicitly FORBIDS cash-out / payment-in-lieu beyond the s.10(1)/(2) cessation payouts. Engine receives a `cash_out` trigger for an NT-jurisdiction employee. What does it do?

**Legislative citation**: NT LSL Act 1981 s.10(4): *"Except as provided in subsections (1) and (2), no payment shall be made to an employee in lieu of long service leave or otherwise in respect of long service leave to which the employee is entitled or may become entitled under this Act."*

**Options**:

- **Option (a) — Advisory-not-hard-error**. Engine returns `status: computed` + `payable_for_taken_leave: 0` + `nt_cashout_forbidden_s10_4` advisory. Same shape as TAS TBD-TAS-08 RESOLVED (advance-leave) and QLD/ACT cash-out at sub-threshold.
  - Dev cost: ~¼ dev-day.
  - Legal risk: LOW — engine surfaces the prohibition transparently.
  - Completeness: HIGH.
  - Cross-state parallel: TAS / ACT informational-advisory pattern.

- **Option (b) — Hard error**. Engine returns `status: failed` + `error.code: 'nt_cashout_forbidden_s10_4'` + no numeric outputs. Same shape as VIC s.34 (criminal offence).
  - Dev cost: ~¼ dev-day.
  - Legal risk: LOW — strong signal to operator that cash-out is illegal.
  - Completeness: HIGH.
  - Cross-state parallel: VIC s.34 hard-error pattern.

- **Option (c) — Permissive with $0 + advisory**. Same as (a) but also computes the as-at entitlement informationally for operator awareness.
  - Dev cost: ~¼ dev-day.
  - Legal risk: LOW.
  - Completeness: HIGH.
  - Cross-state parallel: TAS TBD-TAS-08 RESOLVED.

**PM recommendation**: **Option (b) — hard error**. Rationale: (i) s.10(4) is a strict prohibition with no operator override; (ii) Cross-state parallel to VIC s.34 — when an Act criminalises or hard-forbids cash-out, the engine should fail loudly, not return $0 with an advisory; (iii) Hard error prevents downstream confusion (e.g. operator misreading $0 as "computed but no entitlement" rather than "this trigger is illegal"); (iv) Symmetric with the operator's expectations — if they trigger cash_out in NT, they should be told it cannot be done, not given an informational zero. **NOTE**: If operator pushes back during interview, Option (a) is a defensible fallback (parallel to TAS) and dev cost is identical.

**RESOLVED 2026-05-27: Option (b) — hard error.** Operator confirmed PM recommendation. Engine routes any `cash_out` trigger for an NT-jurisdiction employee as:
- `status: 'failed'`
- `error.code: 'nt_cashout_forbidden_s10_4'`
- `error.message: 'Cash-out / payment-in-lieu is forbidden by NT LSL Act 1981 s.10(4). No numeric output computed. This trigger cannot proceed under NT law.'`
- No `entitlementWeeks` / `payable_for_taken_leave` / `as_at` figures emitted

Cross-state symmetry with VIC s.34 (both are statutory prohibitions). Stronger signal than the TAS/QLD/ACT advisory-with-$0 treatment because the prohibition is explicit and absolute.

**Engine impact**: ~¼ dev-day. New error code `nt_cashout_forbidden_s10_4` (NOT added to the `Warning.code` advisory union — added to the `Error.code` union since this is a status:failed path).

---

## TBD-NT-09 — [Sev-2] Pay-on-termination "as soon as practicable" — engine surface for `payable_by`

**Status**: ✅ RESOLVED 2026-05-27 — Option (b)

**The question**: NT s.10 (per research dossier) says pay-on-termination is "as soon as practicable" after cessation — vague, unlike NSW (forthwith), VIC (day of), QLD (3 days), WA (day of), SA (immediately), ACT (90 days), TAS (day of). What does the engine surface in the `Result.payable_by` field?

**Legislative citation**: NT LSL Act 1981 s.10 (operational reading per research v2.0 §3.8): "Timing of payment on termination: as soon as practicable after cessation." Per the Act consolidation, no specific day count is named.

**Options**:

- **Option (a) — Surface `payable_by = terminationDate + 14 days` indicative + advisory**. Engine sets a reasonable indicative window (14 days = ~2 pay cycles) and emits `nt_payable_as_soon_as_practicable_advisory` documenting the indicative nature. UI displays the field with a note.
  - Dev cost: ~¼ dev-day.
  - Legal risk: MEDIUM — engine setting an indicative date that the Act does not specify. Risk of operator over-reliance.
  - Completeness: PARTIAL — covers normal cases; edge cases (large payrolls / disputes) may legitimately exceed 14 days.
  - Cross-state parallel: ACT TBD-ACT-08 RESOLVED (90 days surfaced).

- **Option (b) — Omit `payable_by` field entirely (undefined)**. Engine sets `payable_by: undefined`. Emits `nt_payable_as_soon_as_practicable_advisory` directing operator to consult NT Fair Work / NT Department of the Attorney-General.
  - Dev cost: ~¼ dev-day.
  - Legal risk: LOW — engine avoids any indicative claim.
  - Completeness: LOW — operator gets no engine guidance.
  - Cross-state parallel: NSW (undefined — "forthwith" not surfaced).

- **Option (c) — Operator-supplied window**. Engine reads `extraInputs.nt_pay_on_termination_days_window: number` (default `undefined`). If supplied, sets `payable_by = terminationDate + N days`.
  - Dev cost: ~¼ dev-day.
  - Legal risk: LOW.
  - Completeness: PARTIAL.
  - Cross-state parallel: none.

**PM recommendation**: **Option (b) — omit `payable_by` entirely**. Rationale: (i) The Act does not specify a number — engine should not invent one; (ii) Cross-state parallel to NSW (which uses "forthwith" with `payable_by` undefined); (iii) Operator who needs a specific window can apply their internal pay-cycle norms (typically 7-14 days post-cessation in Australian payroll); (iv) Option (a) creates a "engine said 14 days" risk that's hard to defend in a dispute; (v) Advisory text alone is sufficient signal.

**RESOLVED 2026-05-27: Option (b) — omit `payable_by` field entirely.** Operator confirmed PM recommendation. Engine sets `Result.payable_by: undefined` for all NT terminations + emits `nt_payable_as_soon_as_practicable_advisory` with text directing the operator to NT Fair Work / NT Department of the Attorney-General for jurisdiction-specific guidance.

Cross-state parallel to NSW (which surfaces "forthwith" by leaving `payable_by` undefined). Result-panel UI displays the advisory string in lieu of a date.

**Engine impact**: ~¼ dev-day. New advisory `nt_payable_as_soon_as_practicable_advisory`. No new `Result` field.

---

## TBD-NT-10 — [Sev-2] Commission / variable-rate window — 12-month interpretation

**Status**: ✅ RESOLVED 2026-05-27 — Option (b) — 52 weeks (364 days)

**The question**: NT s.11 rate-varies branch (per research dossier — "Rate of pay varies: Total income last 12 months / Total ordinary hours last 12 months × 1.3 × hours per year × completed years") specifies a **12-month income lookback** for commission/piecework/variable-rate workers. The operative window question: 365 days exact, 52 weeks (364 days), or 12 calendar months?

**Legislative citation**: NT LSL Act 1981 s.11 (variable rate branch — per research dossier and Masterclass NT pp.): 12-month income lookback prior to cessation/LSL-start.

**Options**:

- **Option (a) — 365 days exact**. Engine looks back 365 days from trigger date. Cleanest arithmetic.
  - Dev cost: ~¼ dev-day.
  - Cross-state parallel: WA s.7(4) 365-day window pattern.

- **Option (b) — 52 weeks (364 days)**. Engine looks back 52 × 7 = 364 days. Matches NSW convention.
  - Dev cost: ~¼ dev-day.
  - Cross-state parallel: NSW 52-week simplification.

- **Option (c) — 12 calendar months exact**. Engine looks back to the same day-of-month in the prior year (may be 365 or 366 days).
  - Dev cost: ~¼ dev-day.
  - Cross-state parallel: QLD s.99 default `÷ 52.179` pattern.

**PM recommendation**: **Option (b) — 52 weeks (364 days)**. Rationale: (i) Cross-state parallel to NSW/QLD/SA/ACT all use 52-week conventions for the 12-month window; (ii) Aligns with weekly pay-period arithmetic; (iii) 1-day delta from 365-day is operationally negligible; (iv) The Act language "last 12 months" is interchangeable with "52 weeks" in payroll context; (v) NT divergence to 365-day would surprise operators familiar with the 52-week pattern in 4 other states.

**RESOLVED 2026-05-27: Option (b) — 52 weeks (364 days).** Operator confirmed PM recommendation. Engine looks back 52 × 7 = 364 days from the trigger date for the variable-rate income aggregation under NT s.11. Cross-state parallel to NSW/QLD/SA/ACT.

**Engine impact**: ~¼ dev-day. Folded into TBD-NT-01 per-year aggregation logic. New advisory `nt_variable_rate_52wk_lookback_applied` documenting the window when the rate-varies branch fires.

---

## TBD-NT-11 — [Sev-2] Board / lodging cash value — $15/wk + $5/wk statutory fallbacks

**Status**: ✅ RESOLVED 2026-05-27 — Option (c) — defer to v2

**The question**: NT s.7(2)(c) includes board and lodging cash value in ordinary pay AND specifies $15/wk fallback for board, $5/wk for lodging when actual cash value is not ascertainable. How does the engine handle this NT-unique statutory dollar fallback?

**Legislative citation**: NT LSL Act 1981 s.7(2)(c): *"Where the employer provides board or lodging or both to the employee … free board $15.00 per week and free lodging $5.00 per week."*  (Statutory fallback values from the As-in-force 14 Oct 2015 consolidation. May be updated by regulation since — re-validate at RES-3.)

**Options**:

- **Option (a) — Two-tier with operator-supplied override**. Engine reads `extraInputs.nt_board_lodging_cash_value_weekly: number` (default `0`). If `> 0`, use operator value. If `0` AND operator flags `nt_board_lodging_provided: 'board' | 'lodging' | 'both'`, use statutory fallback ($15 board + $5 lodging = $20 if both).
  - Dev cost: ~½ dev-day.
  - Legal risk: LOW — engine honours statutory fallback.
  - Completeness: HIGH.
  - Cross-state parallel: WA s.7C / SA s.3(2)(c) / VIC s.15(1)(b) / TAS s.11 include board/lodging cash value but only NT has statutory dollar fallbacks.

- **Option (b) — Operator-supplied only, no statutory fallback**. Engine reads `extraInputs.nt_board_lodging_cash_value_weekly: number` (default `0`). If `0`, no addition. Engine emits advisory if `extraInputs.nt_board_lodging_provided` is set without a value.
  - Dev cost: ~¼ dev-day.
  - Legal risk: MEDIUM — engine ignoring statutory fallback when applicable.
  - Completeness: LOW — operators may not know the statutory fallback exists.

- **Option (c) — Defer to v2 / documented limitation**. v1 ignores board/lodging entirely; operator pre-strips into `currentWeeklyGross`.
  - Dev cost: 0 dev-days.
  - Legal risk: LOW.
  - Completeness: LOW.
  - Cross-state parallel: same v1 pattern as other states (operator pre-strips).

**PM recommendation**: **Option (c) — defer / operator pre-strips into `currentWeeklyGross`**. Rationale: (i) Same v1 convention as NSW/VIC/QLD/WA/SA/ACT/TAS — operator pre-sums all included pay components into `currentWeeklyGross`; (ii) Board/lodging is a low-frequency edge case (most NT private-sector workers don't receive board/lodging); (iii) The statutory $15/$5 fallback is small and operator can apply it manually; (iv) v1 emits advisory `nt_board_lodging_included` if operator-flagged but does not auto-compute. Re-evaluate at RES-3 if real-world usage warrants the Option (a) path.

**RESOLVED 2026-05-27: Option (c) — defer to v2; operator pre-strips into `currentWeeklyGross`.** Operator confirmed PM recommendation. v1 NT engine does NOT auto-compute board/lodging cash value or apply the $15/$5 statutory fallback. Same convention as the other 7 states' v1 — operator pre-sums all included pay components into `currentWeeklyGross` and supplies the consolidated figure.

Optional advisory `nt_board_lodging_pre_strip_assumed` may fire when an NT calc is detected (low-confidence — no statutory test to detect from gross alone). v1 documented limitation. Re-evaluate at RES-3 if real-world usage warrants Option (a) two-tier implementation. Recorded in "Deferred with documented limitations" section.

**Engine impact**: 0 dev-days for Option (c); Option (a) deferred to v2 backlog (~½ dev-day estimate stands).

---

## TBD-NT-12 — [Sev-2] Break tolerance — re-employment window

**Status**: ✅ RESOLVED 2026-05-27 — Option (a) — literal s.12 reading

**The question**: NT s.12 lists "Re-employment within 2 months for any reason" as preserving continuity. What's the engine's break tolerance for non-slackness re-employment? And does NT have a slackness-of-trade extended window (like WA/ACT 6 mo or TAS 6 mo+14d)?

**Legislative citation**: NT LSL Act 1981 s.12: *"… absence due to slackness of trade (continuity preserved, doesn't count for length); re-employment within 2 months for any reason; apprenticeship → re-employment within 12 months."*  Per research v2.0 §3.8.

**Options**:

- **Option (a) — 2 months non-slackness, slackness-preserves-without-length, 12-month apprenticeship**. Engine encodes the literal s.12 reading.
  - Dev cost: 0 dev-days (uses cross-state break-tolerance constants).
  - Legal risk: LOW.
  - Cross-state parallel: NSW / SA / WA / ACT pattern at 2 mo non-slackness.

- **Option (b) — 2 mo standard + slackness extends to 6 mo (parallel to WA/ACT)**. Engine adds a slackness override.
  - Dev cost: ~¼ dev-day.
  - Legal risk: MEDIUM — Act does not say "6 months"; just "preserved but doesn't count".

**PM recommendation**: **Option (a) — 2 months non-slackness; slackness preserves continuity but no length; 12-month apprenticeship**. Rationale: (i) Literal Act reading; (ii) Cross-state pattern at 2 mo is the most common (5 of 8 states); (iii) Slackness in NT doesn't have an explicit alternative window — engine treats it as preserves-continuity-not-length (continuity bridged across the period; the slackness period itself doesn't count toward years_of_continuous_service).

**RESOLVED 2026-05-27: Option (a) — literal s.12 reading.** Operator confirmed PM recommendation. Engine encodes:
- **Non-slackness re-employment**: 2 months (60 days) tolerance. Within window → continuity preserved AND prior service counts. Beyond → continuity broken.
- **Slackness of trade**: continuity preserved across the period BUT the slackness period itself does NOT count toward `years_of_continuous_service` (length excluded). Operator signals via `serviceEvents` `slacknessOfTrade: true` (already in cross-state schema from DEV-CROSS-2).
- **Apprenticeship → tradesperson transition**: 12 months tolerance per s.12(3).

Engine emits `nt_re_employment_within_2_months_continuity_preserved` advisory and `nt_slackness_preserves_continuity_excludes_length` advisory when those branches fire.

**Engine impact**: 0 dev-days additional. Cross-state break-tolerance constants table updated with NT row.

---

## TBD-NT-13 — [Sev-3] Casual loading inclusion — Act silent

**Status**: ✅ RESOLVED 2026-05-27 — per PM recommendation (Sev-3 batch-confirmed)

**The question**: NT s.7 enumerates casual workers as eligible but s.7(2) does NOT explicitly include casual loading in ordinary pay. Universal practice across all 8 states is to include casual loading (per research §1.3 #19). Confirm engine reads casual loading as included in NT.

**PM recommendation**: **Casual loading INCLUDED** per universal practice. NT Act silence resolved per APA Masterclass NT confirmation. Engine treats `currentHourlyRate` for casual workers as already including the casual loading (operator pre-loads). Advisory `nt_casual_loading_assumed_included_in_hourly_rate` fires on every casual NT calc. Same v1 convention as TAS / ACT / SA. 0 dev-days additional.

**Status**: ✅ RESOLVED 2026-05-27 — per PM recommendation (batch-confirmed)

---

## TBD-NT-14 — [Sev-3] Apprentice 12-month lead-in (s.12(3))

**Status**: ✅ RESOLVED 2026-05-27 — per PM recommendation (Sev-3 batch-confirmed)

**The question**: NT s.12(3) specifies "apprenticeship → re-employment within 12 months" preserves continuity. Confirm engine encodes 12-month tolerance as an NT constant.

**PM recommendation**: **Confirm 12-month encoding**. No new dev-finding; reuses cross-state `apprentice_to_tradesperson_transition` event-type added in DEV-CROSS-2 era. Each state's orchestrator applies its own tolerance constant (NSW/SA/NT 12 mo, VIC 52 wks, WA 52 wks, QLD 3 mo, ACT 12 mo, TAS 3 mo). 0 dev-days additional. Fixture TC-NT-036 covers this.

**Status**: ✅ RESOLVED 2026-05-27 — per PM recommendation (batch-confirmed)

---

## TBD-NT-15 — [Sev-3] Related-corporation service aggregation (s.12(6)/(7))

**Status**: ✅ RESOLVED 2026-05-27 — per PM recommendation (Sev-3 batch-confirmed)

**The question**: NT s.12(6)/(7) aggregates service periods across related corporations (per Corporations Act 2001). How does the engine consume this?

**PM recommendation**: **Operator-supplied additional service years**. Engine reads `extraInputs.nt_related_corporation_service_years: number` (default `0`). When `> 0`, added to `years_of_continuous_service` from the `serviceEvents` walk. Advisory `nt_related_corporation_service_aggregated` fires. Operator owns the "related corporation" determination per Corporations Act 2001. 0 dev-days additional (folded into T9.2 — `nt_related_corporation_service_years` parser).

Cross-state parallel: WA s.6 (TBD-WA flag for related-corp service), SA s.3(3). NT is the third state to encode; pattern is well-established.

**Status**: ✅ RESOLVED 2026-05-27 — per PM recommendation (batch-confirmed)

---

## TBD-NT-16 — [Sev-3] Records retention — out of v1

**Status**: ✅ RESOLVED 2026-05-27 — per PM recommendation (Sev-3 batch-confirmed)

**The question**: NT s.14 requires records kept 3 yrs post-employment (6 yrs if died). Should the engine surface this?

**PM recommendation**: **OUT OF v1 engine scope** — operational compliance requirement, not a calculation question. Documented in §Provisions deliberately deferred. Operator implements separately as a process / data-retention policy. 0 dev-days.

**Status**: ✅ RESOLVED 2026-05-27 — per PM recommendation (batch-confirmed)

---

## TBD-NT-17 — [Sev-3] Post-2015 amendment verification

**Status**: ✅ RESOLVED 2026-05-27 — per PM recommendation (Sev-3 batch-confirmed)

**The question**: The Act version read for this spec was the consolidation in force 14 October 2015. The 11-year gap (Oct 2015 → May 2026) is the longest of any state's source-of-truth version. Have there been material amendments to s.7 / s.10 / s.11 / s.12 since 2015 that would affect the engine?

**PM recommendation**: **Documented limitation pending RES-3 legal-reviewer pass**. v1 ships against the 14 Oct 2015 consolidation per research dossier. Pre-launch caveat: PM to consult legal reviewer (parallel to TAS RES-3 pattern) to confirm no post-2015 amendments affect s.7 ordinary-pay definition, s.10 cessation rules, s.11 per-year formula, s.12 continuous service. If material amendments exist, ship v1.1 amendment promptly post-launch. 0 dev-days additional in v1. Documented in §Provisions deliberately deferred.

Cross-state parallel: TAS RES-3 documented-limitation pattern; ACT republication-number reference; WA `wcim_act_2023_wa` citation Act-level only.

**Status**: ✅ RESOLVED 2026-05-27 — per PM recommendation (batch-confirmed)

---

## TBD-NT-18 — [Sev-3] Industry portable LSL schemes — confirm NONE in NT

**Status**: ✅ RESOLVED 2026-05-27 — per PM recommendation (Sev-3 batch-confirmed)

**The question**: NT has no apparent industry-portable LSL scheme equivalent to TasBuild / MyLeave / SA Construction / VIC CoINVEST. Confirm: is the NT private-sector LSL Act 1981 the sole LSL regime for non-public-sector NT workers?

**PM recommendation**: **YES — NT has no industry-portable LSL scheme**. v1 engine assumes NT LSL Act 1981 governs all private-sector NT employees. No portable-scheme advisory surfaced. Re-validate at RES-3. 0 dev-days.

**Status**: ✅ RESOLVED 2026-05-27 — per PM recommendation (batch-confirmed)

---

## Deferred with documented limitations (Sev-3 — v1 acceptable risk)

The following 6 Sev-3 TBDs are intended for deferral with documented limitations once resolved during the interview. Pattern follows TAS / ACT / SA / WA precedent. Per-TBD limitations to be filled in at interview close.

| TBD | One-line summary | Limitation shipping in v1 (DRAFT — pending resolution) |
|---|---|---|
| **TBD-NT-13** | Casual loading inclusion — NT Act silent. | Engine treats `currentHourlyRate` for casual workers as already including casual loading (operator pre-loads). Universal-practice reading per Masterclass NT confirmation. Advisory `nt_casual_loading_assumed_included_in_hourly_rate` fires on every casual NT calc. |
| **TBD-NT-14** | Apprentice 12-month lead-in (s.12(3)). | 12-month tolerance hardcoded as NT constant; reuses DEV-CROSS-2 `apprentice_to_tradesperson_transition` event type. |
| **TBD-NT-15** | Related-corporation service aggregation (s.12(6)/(7)). | Operator-supplied `extraInputs.nt_related_corporation_service_years: number`; added to years_of_continuous_service; advisory `nt_related_corporation_service_aggregated` fires. Operator owns the related-corporation determination per Corporations Act 2001. |
| **TBD-NT-16** | Records retention (s.14 — 3 yrs / 6 yrs post-death). | OUT OF v1 engine scope. Operational compliance requirement, not a calculation question. Operator implements as process / data-retention policy. |
| **TBD-NT-17** | Post-2015 amendment verification (11-year version gap). | v1 ships against 14 Oct 2015 consolidation. RES-3 legal-reviewer pass scheduled to confirm no material amendments to s.7 / s.10 / s.11 / s.12. v1.1 amendment if needed. |
| **TBD-NT-18** | Industry portable LSL schemes in NT — confirm NONE. | v1 assumes NT LSL Act 1981 governs all private-sector NT employees; no portable-scheme advisory surfaced. RES-3 quarterly re-validation. |

---

## Net effect on fixtures and impl-plan (DRAFT — to be finalized post-interview)

Effort estimate by TBD (PM-recommended path):

- TBD-NT-01 (per-year `RP × HWW × 1.3`): +1.5 d (Option a localised).
- TBD-NT-02 (Age Pension age + dob lookup + override): +1.5 d.
- TBD-NT-03 (casual continuity default+flag): +½ d.
- TBD-NT-04 (voluntary res 7–10 NOT qualifying): 0 d (folded into TBD-NT-02).
- TBD-NT-05 (10+ misconduct complete-blocks-only): +½ d.
- TBD-NT-06 (death 7–10 yrs qualifies under s.10(3)): 0 d (folded into qualifying-reason gate).
- TBD-NT-07 (bonus operator-flag): +¼ d.
- TBD-NT-08 (cash-out hard error): +¼ d.
- TBD-NT-09 (`payable_by` omitted + advisory): +¼ d.
- TBD-NT-10 (12-month commission window = 52 wks): 0 d (folded into TBD-NT-01).
- TBD-NT-11 (board/lodging operator pre-strips): 0 d.
- TBD-NT-12 (2-mo break tolerance): 0 d.
- TBD-NT-13 (casual loading included): 0 d.
- TBD-NT-14 (12-mo apprentice lead-in): 0 d.
- TBD-NT-15 (related-corp years operator-supplied): 0 d.
- TBD-NT-16 (records retention deferred): 0 d.
- TBD-NT-17 (post-2015 amendment verification): 0 d.
- TBD-NT-18 (no portable scheme): 0 d.

**Total: ~5 dev-days within the L (5–7 d) Phase 9 envelope** if PM recommendations are adopted. **NOTE**: If operator selects Option (b) for TBD-NT-01 (top-level cross-state schema field — DEV-CROSS-3), add ~0.5 d for the cross-state PR cycle. If operator selects Option (c) for TBD-NT-01 (engine auto-derives from wageHistory), add ~1.5 d.

**No fixture-value changes from the v0.1-DRAFT expected if operator accepts all PM recommendations.** All 75 single-mode + 3 bulk fixtures will be drafted on the resolved rule sets in a post-interview pass. **No DEV-CROSS-3 dev-finding anticipated** under PM's recommended path — all schema additions are NT-localised via `extraInputs.nt_*` (parallel to SA / ACT / TAS precedent). The `Result.payable_by: ISODate` field added in ACT Phase 7 is omitted for NT (PM rec for TBD-NT-09 Option (b)).

---

## Provisions deliberately deferred from v1 NT encoding (DRAFT — pending resolution)

| Provision | Reason for deferral |
|---|---|
| **NT public-sector LSL** (Public Sector Employment and Management Act 1993 NT) | Separate regime for NT government employees. Out of v1 statutory engine scope. Same convention as other states' public-sector exclusions. |
| **NT teaching services** | Excluded from Commonwealth LSL Act 1976 but still under NT LSL Act 1981 for general accrual; v1 honours general NT rules and does NOT add a teaching-services advisory. |
| **Defence Force service continuity** (s.12 — Defence/Naval/Air Force regulations) | Edge case. v1 honours `serviceEvents` containing `defence_leave` type but does not add an NT-specific advisory. |
| **Records retention (s.14 — 3 yrs / 6 yrs post-death)** | Operational requirement; not a calculation question. Out of v1 statutory engine scope. |
| **Higher-duties / acting rate** | No statutory analogue in the NT Act (unlike SA s.4). Out of v1 NT encoding. |
| **Half-pay / double-pay** | The NT Act is silent on half-pay/double-pay; no statutory entitlement. Out of v1. |
| **Industry portable LSL schemes** | NONE in NT — confirmed in §Scope. |
| **Post-2015 Act amendments** | v1 ships against 14 Oct 2015 consolidation per research dossier; RES-3 legal-reviewer pass schedules confirmation. v1.1 amendment if material post-2015 changes are found. |
| **Board / lodging statutory fallback ($15/$5 per s.7(2)(c))** | v1 operator pre-strips into `currentWeeklyGross`; statutory fallback documented but not engine-computed. Re-evaluate at RES-3. |

---

## Sign-off block — ✅ PM-SIGNED v1.0 — 2026-05-27

```
Drafted:    Tracy Angwin (PM) — product-manager agent
Interview:  Tracy Angwin (operator) — via main-thread orchestration
PM-signed:  Tracy Angwin (PM) — 2026-05-27
Status:     PM-SIGNED v1.0 — T9.1 UNBLOCKED
```

**Status (2026-05-27 PM-SIGNED)**: 18/18 TBDs RESOLVED · 0 blocking open · Sev-3 deferrals captured with documented limitations.

**Sev-1 (load-bearing) — 4/4 RESOLVED**:
- TBD-NT-01 ✅ Option (a) — state-localised `extraInputs.nt_hours_per_week_by_year`. **NO DEV-CROSS-3 created.**
- TBD-NT-02 ✅ Option (b) + Option (c) override — dob lookup table per Cth SS Act 1991 s.23 + override flag.
- TBD-NT-03 ✅ Option (a) — permissive default + `extraInputs.nt_casual_continuity_preserved`.
- TBD-NT-04 ✅ Option (a) — strict closed-list reading of s.10(2). Voluntary res 7–10 yrs → $0.

**Sev-2 (engine-shape) — 8/8 RESOLVED**:
- TBD-NT-05 ✅ Option (a) — strict literal 10y/15y block truncation per s.10(1A).
- TBD-NT-06 ✅ Option (a) — s.10(3) "this section" cross-references both s.10(1) AND s.10(2). 7–10 yrs death → pro-rata.
- TBD-NT-07 ✅ Option (a) — operator-supplied flag `extraInputs.nt_bonus_usually_paid_with_pay` (default false).
- TBD-NT-08 ✅ Option (b) — hard error. Cross-state parallel to VIC s.34. `error.code: 'nt_cashout_forbidden_s10_4'`.
- TBD-NT-09 ✅ Option (b) — omit `payable_by` field entirely (undefined) + advisory. Parallel to NSW "forthwith".
- TBD-NT-10 ✅ Option (b) — 52 weeks (364 days). Cross-state parallel to NSW/QLD/SA/ACT.
- TBD-NT-11 ✅ Option (c) — defer to v2 / operator pre-strips. Same convention as other 7 states v1.
- TBD-NT-12 ✅ Option (a) — literal s.12: 2-mo non-slackness, slackness preserves no length, 12-mo apprentice.

**Sev-3 (deferred with documented limitations) — 6/6 RESOLVED (batch)**:
- TBD-NT-13 ✅ Casual loading INCLUDED per universal cross-state practice.
- TBD-NT-14 ✅ 12-mo apprentice tolerance hardcoded as NT constant.
- TBD-NT-15 ✅ Operator-supplied `extraInputs.nt_related_corporation_service_years`.
- TBD-NT-16 ✅ Records retention OUT OF v1 engine scope (operational compliance).
- TBD-NT-17 ✅ Documented limitation — RES-3 legal-reviewer pass for post-2015 amendments.
- TBD-NT-18 ✅ Confirmed: no industry-portable LSL scheme in NT.

**Total: 18/18 RESOLVED. NO DEV-CROSS-3 dev-finding created. T9.1 (engine scaffold) UNBLOCKED immediately.**

---

*End of test-cases-nt.md v1.0 PM-SIGNED · Tracy Angwin (PM) · 2026-05-27.*
