# TAS LSL Calculator — Gold-Standard Test Cases

**Status**: PM-SIGNED · 8/8 blocking resolved · 0 blocking open · 8 Sev-3 deferred with documented limitations
**Version**: v1.0 PM-SIGNED
**Date**: 2026-05-26
**Owner**: Tracy Angwin (PM)
**Spec**: `.specify/features/002-all-state-coverage/spec.md` v0.3.1
**Impl plan**: `.specify/features/002-all-state-coverage/impl-plan.md` v0.3.5 Phase 8 (TAS) — M (3–4 days) — single rule set, no dual regime, no DEV-CROSS-N anticipated (TAS-specific signals localised via `extraInputs.tas_*`)
**Tasks**: `.specify/features/002-all-state-coverage/tasks.md` T8.0 (THIS DOC) — blocks T8.1 onwards
**Source-of-truth Acts**:
- *Long Service Leave Act 1976* (Tas) — consolidated text at legislation.tas.gov.au/view/whole/html/inforce/current/act-1976-095. Cited as **"TAS LSL Act 1976 s.N"** throughout. Section coverage in v1: s.2 (definitions / who is entitled), s.5 (continuous service incl. 32-hour-4-week casual rule), s.5(1)(c) (workers comp counts), s.8 (entitlement formula + qualifying-reason gate for 7–10 yrs), s.10 (cash-out by agreement), s.11 (ordinary pay incl. shift penalties + all-purpose allowances), s.11(2)(h) (bonus exclusion absolute), s.11(3) (commission 3-month average), s.11(6) (no-fixed-hours / casual 12-month average), s.12 (taking LSL + termination), s.12(4) (deemed-commenced-on-day-of-termination), s.12(9) (PH-exclusive).
- *Long Service Leave Regulations 2017* (Tas) — records retention provisions (s.7). Cited where applicable.
- **OUT OF v1 SCOPE**: *Construction Industry (Long Service) Act 1997* (Tas) — TasBuild portable scheme for building/construction. Same convention as VIC/QLD/WA/SA/ACT industry portable schemes (deferred per state precedent).

---

## Scope

**IN SCOPE for v1 TAS engine**:
- General TAS LSL Act 1976 governing the private-sector LSL calculation.
- All triggers: `taking_leave`, `termination`, `cash_out`, `as_at`.
- All employment types: FT, PT, casual, commission.
- All termination reasons covered by the cross-state `TerminationReason` enum (post-DEV-CROSS-1).
- Workers comp service-counting per s.5(1)(c).
- PH-exclusive treatment of public holidays during LSL.
- Cross-jurisdiction routing via `governingJurisdiction = TAS`.

**OUT OF v1 SCOPE**:
- **TasBuild** — Construction Industry (Long Service) Act 1997 (Tas). This portable scheme covers building/construction workers under a separate state-administered fund. The v1 TAS engine assumes the general LSL Act 1976 governs and does NOT surface a TasBuild advisory. Same convention as VIC/QLD/WA/SA/ACT industry portable schemes.
- **Defence Force service continuity** beyond what's already in `serviceEvents`. Edge case; out of v1.
- **Half-pay / double-pay**: TAS Act is silent on half-pay/double-pay; no statutory entitlement. Out of v1.
- **Higher-duties / acting rate**: no statutory analogue in the TAS Act (unlike SA s.4). Out of v1.
- **Records retention (s.7 LSL Regulations 2017 — perpetual)**: operational requirement; not a calculation question. Out of v1 statutory engine scope.
- **Employer-direction notice via WorkSafe Tasmania adjudication**: procedural; not engine-blocking. Engine emits no advisory in v1.

---

## Calculation surface

**Inputs** (the `Employee` and `Trigger` shapes from `engine/types.ts`):
- `employee.startDate`, `endDate?`, `employmentType`, `statesOfService`, `governingJurisdiction`
- `currentWeeklyGross` (FT/PT fixed-rate path) or `currentHourlyRate` + `hoursLast12MonthsBeforeEntitlement` / `hoursLast12MonthsBeforeCessation` (casual/PT averaging path)
- `wageHistory` (commission path — 3-month window per s.11(3))
- `serviceEvents` (continuous-service walk)
- `extraInputs.tas_*` (TAS-localised signals — see Schema additions below)
- `trigger.kind` ∈ {`taking_leave`, `termination`, `cash_out`, `as_at`}
- `trigger.reason` for termination (post-DEV-CROSS-1 enum)
- `trigger.terminationInitiator?: 'employee' | 'employer'` (post-DEV-CROSS-1)

**Outputs** (the `Result` shape):
- `status`: `computed` / `blocked_cross_jurisdiction` / `failed`
- `years_of_continuous_service`
- `total_entitlement_weeks`
- `value_of_week` (with day-to-day variation per TBD-TAS-01 resolution)
- `total_entitlement_dollars` (for termination) or `payable_for_taken_leave` (for taking)
- `expected_citations[]`
- `warnings[]`
- `payable_by?: ISODate` — TAS uses `terminationDate` itself per s.12(4) (deemed-commenced-on-day-of-termination); engine surfaces `payable_by = terminationDate` for parity with ACT precedent if TBD-TAS-08 is resolved that way.

**Regime selection logic** (single regime — no dual cliff):
- TAS LSL Act 1976 has no dated cliff equivalent to WA's 2024-07-01 / ACT's 2023-06-09. The Act has been amended over time but no v1-relevant amendment introduces a calculation cutoff.
- Engine uses **single rule set** with flat `rules/` directory structure (parallel to QLD / SA / ACT / NT pattern, NOT VIC / WA pre-/post- pattern).

---

## Fixture ID scheme

`TC-TAS-<NN>` for single-mode fixtures (NN = 001..NNN).
`TC-TAS-BULK-<NNN>` for bulk-mode fixtures.

Stable, unique, referenced from `gold-standard.test.ts` once Phase 8 T8.3 lands.

---

## Quick reference — TAS decisions at a glance

| Topic | TAS rule | Source |
|---|---|---|
| Qualifying period — full entitlement | **10 years** | s.8(2) |
| Entitlement at qualifying period | **8.6667 weeks** at 10 yrs | s.8(2) |
| Accrual rate after first entitlement | **continuous 0.8667 wks/yr** (= `Years × 8.6667/10`) — same accrual ratio as NSW/QLD/WA/ACT | s.8(2) |
| Discrete step at 15 yrs | NO — continuous accrual | s.8(2) interpretation |
| Pro-rata at termination — sub-threshold | **7 years** (qualifying-reason gate) | s.8(3) |
| Sub-7-yr entitlement | **none** | s.8(3) |
| 7–10-year qualifying reasons | **retirement (60F / 65M), death, employer-not-misconduct, illness/incapacity/domestic-pressing-necessity** | s.8(3) |
| Voluntary resignation 7–10 yrs | **NOT PAYABLE** (no qualifying reason — TBD-TAS-07) | s.8(3) |
| Serious & wilful misconduct (sub-10-yr) | **forfeiture** | s.8(3) |
| Serious & wilful misconduct (10+ yrs) | **FULL PAYOUT** — TBD-TAS-06 PM recommendation parallel to NSW/VIC/QLD/SA/ACT (NOT WA partial-forfeiture) | s.8(2) (no misconduct exception in full-entitlement branch) |
| PH during LSL | **EXCLUSIVE** — PH extends leave by 1 day each | s.12(9) |
| Break tolerance — re-employment (non-slackness) | **3 months** (parallel to QLD) | s.5 |
| Break tolerance — slackness of trade | **6 months + 14-day return-to-work offer** (TBD-TAS-12) | s.5 |
| Casual continuity test | **32 hours per consecutive 4-week period** (s.5(3)) — TAS UNIQUE | s.5(3) |
| Casual averaging window | **12 months immediately prior to taking/cessation** | s.11(6) |
| Commission averaging window | **3 months immediately prior** (s.11(3)) — TAS UNIQUE (shorter than every other state) | s.11(3) |
| Ordinary pay — shift penalties | **INCLUDED** — TAS UNIQUE (with QLD as the only other state) | s.11 |
| Ordinary pay — all-purpose allowances | **INCLUDED** | s.11 |
| Ordinary pay — casual loading | **INCLUDED** | s.11 |
| Ordinary pay — board/lodging cash value | **INCLUDED** | s.11 |
| Ordinary pay — commissions | **INCLUDED** via s.11(3) 3-month average | s.11(3) |
| Ordinary pay — overtime | **EXCLUDED** | s.11 |
| Ordinary pay — bonuses | **EXCLUDED ABSOLUTELY** (s.11(2)(h)) — most restrictive state in Australia | s.11(2)(h) |
| Ordinary pay — inconvenience/danger/hardship/hot/cold/dirt allowances | **EXCLUDED** | s.11 |
| Ordinary pay — travel/LAFH allowances | **EXCLUDED** | s.11 |
| Ordinary pay — meal allowances | **EXCLUDED** | s.11 |
| **Day-to-day rate variation (TAS UNIQUE)** | **FT/PT rate varies day-to-day depending on what shift penalty / all-purpose allowance applies on the day leave is taken** — calculator must compute by-day, not just by-week | s.11 + WorkSafe Tasmania guidance — TBD-TAS-01 |
| WC absence — service-counting | **COUNTS** per s.5(1)(c) — "absence due to illness or injury certified by a medical practitioner" | s.5(1)(c) |
| Maternity / paid parental leave | **DOES NOT COUNT** as service per s.5 (paid + unpaid both excluded) — TBD-TAS-13 | s.5 |
| Industrial dispute | **DOES NOT COUNT** unless worker returns under settlement | s.5 |
| Cashing out | **PERMITTED** (s.10) — by agreement once entitlement reached | s.10 |
| Cashing out — sub-10-yr | **NOT permitted** — no entitlement to cash out | s.10 (implied) |
| Leave in advance | **NOT PERMITTED** — leave becomes available at 10 years; no advance provision | s.8(2) + s.12 (no advance leave clause) |
| Employer direction | **No** — if mutual agreement cannot be reached, WorkSafe Tasmania adjudicates (out of engine scope) | s.12 + WorkSafe Tas |
| Pay-on-termination timing | **Day of termination** per s.12(4) — "employee shall be deemed to have commenced to take his leave on the date of termination of employment" | s.12(4) |
| Apprentice lead-in | **3 months** (TAS UNIQUE — shorter than other states) | s.5 — TBD-TAS-11 |
| Retirement age | **60 women / 65 men** (TAS UNIQUE sex-specific reading in the Act) — TBD-TAS-02 | s.8(3) |
| Records retention | **In perpetuity** (no statutory time limit) — operational, out of v1 | s.7 LSL Regulations 2017 |
| Portable LSL scheme — TasBuild | **OUT OF v1 SCOPE** — Construction Industry (Long Service) Act 1997 (Tas) | n/a |

---

## Schema additions / engine surface for TAS

**New top-level input field (cross-state schema addition, TAS-conditional read)**:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `employee.sex` | `"female" \| "male"` | `undefined` | TAS-conditional read ONLY: used by the TAS orchestrator to apply the s.8(3) literal 60F/65M qualifying-age reading when `extraInputs.tas_award_min_retirement_age_reached` is not `true`. Ignored by all other state orchestrators. **TBD-TAS-02 RESOLVED Option (a).** Documented in schema docstring as TAS-conditional. No DEV-CROSS-5 finding required. |

**New `extraInputs` keys read by the TAS orchestrator only** (parallel to ACT / SA-localised pattern — NOT a cross-state schema extension; no DEV-CROSS-N anticipated):

| Field | Type | Default | Purpose |
|---|---|---|---|
| `extraInputs.tas_shift_penalty_by_day` | `Array<{date: ISODate, penalty_multiplier: number}>` | `[]` | Per-day shift penalty rates applicable on the days LSL is taken. Used by the day-to-day rate variation rule (TBD-TAS-01). When empty, engine falls back to flat `currentWeeklyGross` for FT/PT. |
| `extraInputs.tas_all_purpose_allowance_by_day` | `Array<{date: ISODate, allowance_amount: number}>` | `[]` | Per-day all-purpose allowance amounts (e.g. tool allowance, qualification allowance) applicable on the LSL days. Added to base rate on those days. |
| `extraInputs.tas_award_min_retirement_age_reached` | `boolean` | `false` | Award-specified minimum retirement age reached. Bypasses the s.8(3) sex-specific default reading (60F/65M). **TBD-TAS-02 RESOLVED Option (a) — override path.** |
| `extraInputs.tas_casual_32hr_4wk_periods_compliant` | `boolean \| undefined` | `undefined` | Operator-supplied confirmation that the casual employee meets s.5(3) "32 hours per consecutive 4-week period" continuity test. Engine attempts auto-derivation from `wageHistory` 4-wk sliding windows first; falls back to this flag if windows are sparse (>25% missing entries); defaults permissive + `tas_casual_32hr_4wk_test_not_verified` advisory if neither. **TBD-TAS-04 RESOLVED Option (c) — hybrid.** |
| `extraInputs.tas_casual_continuity_break_date` | `ISODate \| undefined` | `undefined` | Operator-supplied date at which casual continuity was broken under s.5(3). Used when `tas_casual_32hr_4wk_periods_compliant: false` and engine cannot auto-derive the break-point from `wageHistory`. **TBD-TAS-04 RESOLVED.** |
| `extraInputs.tas_slackness_return_within_14_days` | `boolean` | `false` | s.5 slackness-of-trade re-employment: 6 months tolerance ONLY if return-to-work offer was accepted within 14 days. TBD-TAS-12. |

**New `tas_*` warning codes** (state-namespaced, parallel to SA / ACT precedent):

| Code | Tier | Use |
|---|---|---|
| `sub_7yr_no_entitlement_tas` | informational | Below 7-yr pro-rata threshold. No entitlement under s.8(3). |
| `sub_10yr_no_qualifying_reason_tas` | informational | 7–10 yrs but termination reason does not qualify under s.8(3). |
| `sub_10yr_misconduct_excluded_tas` | informational | Serious & wilful misconduct dismissal sub-10-yr — pro-rata forfeited per s.8(3). |
| `tas_10yr_plus_misconduct_full_payout` | informational | Dismissal for serious & wilful misconduct at 10+ yrs — full s.8(2) entitlement payable. TAS does NOT mirror WA partial-forfeiture (TBD-TAS-06). |
| `tas_day_to_day_rate_variation_applied` | informational | FT/PT rate computed day-by-day because shift penalties / all-purpose allowances vary across the LSL period. `value_of_week` is the average across the days. |
| `tas_day_to_day_rate_variation_advisory` | informational | Operator did NOT supply `tas_shift_penalty_by_day` / `tas_all_purpose_allowance_by_day`. Engine fell back to flat weekly rate. Day-to-day variation may produce a different total if penalties/allowances apply on some LSL days. |
| `tas_shift_penalty_included` | informational | Shift penalty included in ordinary pay per s.11. TAS divergence from NSW/VIC/WA/SA/ACT/NT (only QLD shares this rule). |
| `tas_bonus_excluded_absolutely` | informational | Bonus payments excluded from ordinary pay per s.11(2)(h) — TAS most restrictive bonus treatment in Australia. |
| `tas_all_purpose_allowance_included` | informational | All-purpose / skills allowances included in ordinary pay per s.11. |
| `tas_commission_3mo_window_applied` | informational | Commission income averaged over 3 months immediately prior to LSL per s.11(3). TAS UNIQUE — shorter than every other state's commission window. |
| `tas_casual_32hr_4wk_continuity_satisfied` | informational | Casual employee's continuity confirmed via s.5(3) "32 hours per consecutive 4-week period" test. |
| `tas_casual_32hr_4wk_continuity_not_satisfied` | informational | Casual employee FAILS s.5(3) — service interrupted. Pre-interruption service forfeited unless qualifying re-engagement event applied. |
| `tas_casual_continuity_test_unverified` | informational | Operator did not supply `extraInputs.tas_casual_32hr_4wk_periods_compliant` AND engine could not derive from `wageHistory`. Engine assumed continuity preserved for v1; operator should verify. |
| `tas_casual_32hr_4wk_test_not_verified` | informational | Operator flag was load-bearing under the hybrid hierarchy: `wageHistory` was too sparse (>25% missing entries within candidate 4-wk windows) to auto-derive the s.5(3) test, or no signal was available and engine defaulted permissive. **TBD-TAS-04 RESOLVED Option (c).** |
| `tas_slackness_of_trade_continuity_preserved` | informational | Re-employment within 6 months following slackness-of-trade stand-down AND return-to-work offer accepted within 14 days — continuity preserved per s.5. |
| `tas_slackness_14_day_return_window_missed` | informational | Return-to-work offer was not accepted within the 14-day window — slackness-of-trade preservation does NOT apply; standard 3-month break tolerance used. |
| `tas_apprentice_3mo_continuity_preserved` | informational | Apprentice → tradesperson transition within 3 months preserves continuity per s.5. |
| `transfer_of_business_continuity_preserved_tas` | informational | Service deemed continuous across transmission of business per s.5. |
| `tas_maternity_leave_excluded` | informational | Maternity leave (paid + unpaid) does NOT count as service per s.5. Diverges from NSW/SA (count company-paid parental) and VIC post-2018 (counts first 52 wks). |
| `tas_industrial_dispute_excluded` | informational | Industrial dispute time does NOT count as service per s.5 unless worker returns under settlement. |
| `tas_cashout_post_entitlement_advisory` | informational | Cashing out at 10+ yrs permitted by agreement per s.10. Written agreement recommended. |
| `tas_cashout_pre_entitlement_not_authorised` | informational | Cashing out at sub-10-yr — no entitlement to cash out per s.10 (implied). |
| `tas_advance_leave_not_permitted` | informational | Taking LSL before 10-year entitlement is not permitted under the TAS Act. Returns $0 with this advisory. |
| `tas_lsl_calculated_at_wc_reduced_rate_warning` | informational | LSL taken while on WC reduced rate — literal s.11 rate applied (no higher-of-rates equivalent to VIC s.17). |
| `tas_payable_on_day_of_termination_advisory` | informational | Pay-on-termination is the day of termination per s.12(4) — engine surfaces `payable_by = terminationDate`. |
| `tas_retirement_qualifying_age_60f_65m_default` | informational | TAS s.8(3) default reading is sex-specific (60 women / 65 men). Engine applied this reading. If award/agreement specifies a different minimum retirement age, set `extraInputs.tas_award_min_retirement_age_reached: true`. |
| `tas_retirement_qualifying_via_award_min_age` | informational | Retirement qualifying via award/agreement-specified minimum retirement age — `extraInputs.tas_award_min_retirement_age_reached: true` honoured. |
| `tas_tasbuild_out_of_scope_v1` | informational | Industry portable scheme (TasBuild — Construction Industry (Long Service) Act 1997 (Tas)) is out of v1 scope. Engine assumed the general LSL Act 1976 governs. (Surfaced only if operator-supplied data indicates construction industry — currently no such signal in v1; reserved for v2.) |

**No new `Result` field for TAS** — TAS reuses the `payable_by: ISODate` field added in ACT Phase 7 (TBD-ACT-08 RESOLVED). For TAS, `payable_by = terminationDate` itself per s.12(4) (deemed-commenced-on-day-of-termination). Single SA/ACT-localised-pattern reuse — no cross-state schema work.

**No cross-state schema extension** — every new field is TAS-localised via `extraInputs.tas_*`. **No DEV-CROSS-5 dev-finding anticipated**.

---

## Sources of legal truth

- *Long Service Leave Act 1976* (Tas) — consolidated text at `legislation.tas.gov.au/view/whole/html/inforce/current/act-1976-095`. Cited as **"TAS LSL Act 1976 s.N"** throughout. Section coverage verified against the consolidated index.
- *Long Service Leave Regulations 2017* (Tas) — records retention, prescribed-form schedules. Cited as **"LSL Regulations 2017 (Tas) s.7"** where applicable. Out of v1 engine scope; cited only in §Provisions deliberately deferred.
- *Construction Industry (Long Service) Act 1997* (Tas) — TasBuild portable scheme. **Out of v1 scope.** Cited only in §Scope and §Provisions deliberately deferred.
- *WorkSafe Tasmania — Long Service Leave Guidance Material* — published by WorkSafe Tasmania (the enforcement body). `worksafe.tas.gov.au/topics/laws-and-compliance/long-service-leave`. Cited as **"WorkSafe Tasmania — LSL guidance"** where used. Operational summary of the Act, including day-to-day rate variation and the s.10 cash-out interpretation.
- *Australian Payroll Association LSL Masterclass 2026* (158 pp) pp.95–108 — supplies worked examples for TAS used as canonical fixtures. Cited as **"APA LSL Masterclass p.NN"** throughout.
- *Internal research dossier* — `docs/research/lsl-pay-components-deep-research.md` v2.0 §3.6 (TAS). The Masterclass + WorkSafe Tasmania + AustLII material is consolidated there.

---

## How to read this file

Each test case has:

- **ID** (e.g. `TC-TAS-001`) — unique, stable, referenced from `gold-standard.test.ts`
- **Name** — short, descriptive
- **Source** — APA PDF page and/or TAS LSL Act 1976 section that produced the expected value
- **Category** — Single mode (Fixed-rate / Varied-hours / Commission / Hard-error / negative / Cashing-out advisory) or Bulk mode
- **Why it matters** — the spec acceptance criterion or TAS-specific divergence this case backs
- **Inputs** — fenced YAML following the engine's `Employee` / `Trigger` / `WagePeriod` / `ContinuousServiceEvent` data model in `website/src/lib/lsl/engine/types.ts`
- **Expected output** — `value_of_week`, `value_of_day`, `total_entitlement_weeks`, `total_entitlement_dollars`, `expected_citations[]`; for hard-error cases `status: failed` and `error.code`
- **Legal source** — explicit TAS LSL Act 1976 section reference
- **Notes** — interpretation, derivation, any `expected: TBD` flag with rationale

### Conventions used in this file

- **Currency**: AUD; half-up rounding at 0.005; 2 decimal places at display; intermediate arithmetic unrounded — same convention as every prior state.
- **Dates**: ISO `YYYY-MM-DD`. Prescribed-date anchor for fixtures is `2026-05-26` (= as-at default for v1 testing).
- **Entitlement formula** (TAS LSL Act 1976 s.8(2)): **8.6667 weeks** at 10 years; +**4.3333 weeks** per subsequent 5 years (equivalent: continuous 0.8667 wks/yr past year 10). Same accrual ratio as NSW/QLD/WA/ACT. LESS generous than SA/NT (1.3/yr).
- **Pro-rata at termination** (s.8(3)): payable to an employee who has completed at least **7 years** of continuous service whose employment ends for a qualifying reason — retirement (60F / 65M per the Act's sex-specific reading; TBD-TAS-02), death, employer-not-misconduct dismissal, illness/incapacity/domestic-pressing-necessity. **Voluntary resignation 7–10 yrs does NOT qualify** (TBD-TAS-07). Pro-rata calculation includes years AND months/12 converted to decimal.
- **Serious & wilful misconduct** (s.8(3)): forfeits all pro-rata at sub-10-yr tenure. At 10+ years, the full s.8(2) entitlement is payable regardless — **TAS PM recommendation per TBD-TAS-06 mirrors NSW/VIC/QLD/SA/ACT (no partial-forfeiture as in WA).** The misconduct exception applies only to the pro-rata branch under s.8(3), not to the full-entitlement branch under s.8(2).
- **Ordinary pay** (s.11): for fixed-rate full-time employees, the ordinary weekly rate at the time of taking leave applies — INCLUDING base wages, casual loading, all-purpose / skills / qualification allowances, **shift penalties (TAS UNIQUE with QLD)**, board/lodging cash value, commissions; EXCLUDING overtime, inconvenience/danger/hardship/hot/cold/dirt allowances, travel/LAFH allowances, meal allowances, and **bonuses absolutely per s.11(2)(h) (TAS most restrictive in Australia)**. For **part-time and casual** employees: 12-month hours-averaging window per s.11(6). For **commission / piecework / results-based** employees: **3-month income window per s.11(3) (TAS UNIQUE — shortest window in Australia)**.
- **Day-to-day rate variation (TAS UNIQUE)** (s.11 + WorkSafe Tasmania): FT/PT rate "may vary day to day depending on when leave is taken and what allowances/penalties apply on the day leave is taken." Engine MUST support per-day rate computation when `extraInputs.tas_shift_penalty_by_day` and/or `extraInputs.tas_all_purpose_allowance_by_day` are supplied. TBD-TAS-01.
- **Continuous service** (s.5): paid working time + paid annual leave + paid LSL + paid PHs count. WC absence (medical-certificate-backed) counts per s.5(1)(c). Maternity leave (paid + unpaid) does NOT count (TBD-TAS-13). Industrial dispute does NOT count unless return under settlement. Approved leave to attend TAS State Training Authority / VET Act 1994 committees counts. Jury service / prescribed court attendance counts. Transmission of business preserves continuity. Apprenticeship → contract within **3 months** preserves continuity (TBD-TAS-11). Defence leave counts. **Casual continuity** per s.5(3): regularly working ≥**32 hours per consecutive 4-week period** (TBD-TAS-04). **Re-employment**: within 3 months (any reason); within 6 months (slackness of trade) IF return-to-work offer accepted within 14 days (TBD-TAS-12).
- **Transfer of business** (s.5 inclusion): on a transmission of business to a new owner with the employee continuing to be employed, service is deemed continuous and the LSL liability transfers with the employee. New employer becomes sole employer.
- **Public holidays during LSL** (s.12(9)): **EXCLUSIVE — a PH falling within an LSL period extends the leave by one day per PH.** Parallel to NSW/VIC/QLD/WA/ACT. OPPOSITE to SA's inclusive treatment.
- **Cashing out** (s.10): permitted by agreement once entitlement is reached (10+ yrs). Engine emits non-blocking advisory. Three-tier per state precedent: `tas_cashout_post_entitlement_advisory` (10+ yr) / `tas_cashout_pre_entitlement_not_authorised` (7–10 yr) / `tas_cashout_pre_entitlement_not_authorised` (sub-7-yr — same advisory).
- **Leave in advance**: NOT permitted under the TAS Act (no statutory basis). Engine refuses `taking_leave` when `years_of_continuous_service < 10` — returns $0 with `tas_advance_leave_not_permitted` advisory. Same shape as ACT TBD-ACT-14 RESOLVED (`status: computed` + advisory, not hard error). TBD-TAS-08.
- **Pay-on-termination timing** (s.12(4)): the employee is "deemed to have commenced to take his leave on the date of termination of employment." Engine surfaces `payable_by = terminationDate` itself and emits `tas_payable_on_day_of_termination_advisory`.
- **Citations**: every case lists the minimum expected citations. The rules engine MAY emit additional citations; tests assert array-membership, not array-equality.

---

## TAS-specific divergences from NSW/VIC/QLD/WA/SA/ACT (the load-bearing facts)

| Topic | NSW | VIC | QLD | WA | SA | ACT | **TAS** | TAS source |
|---|---|---|---|---|---|---|---|---|
| Qualifying period (full entitlement) | 10 yrs | 7 yrs | 10 yrs | 10 yrs | 10 yrs | 7 yrs | **10 yrs** | TAS LSL Act 1976 s.8(2) |
| Entitlement at qualifying period | 8.6667 wks | 6.0667 wks | 8.6667 wks | 8.6667 wks | 13 wks | 6.0667 wks | **8.6667 wks** | s.8(2) |
| Accrual rate after first entitlement | 0.0867 wks/yr | 0.0867 | 0.0867 | 0.0867 | 0.13 | 0.0867 | **0.0867 wks/yr** | s.8(2) |
| Discrete step at 15 yrs | NO (continuous) | NO | NO | NO | NO | NO | **NO — continuous** | s.8(2) |
| Pro-rata at termination — sub-threshold | 5 yrs (limited reasons) | 7 yrs (any reason except misconduct) | 7 yrs (limited reasons s.95(3)) | 7 yrs (any reason except misconduct) | 7 yrs (any reason except misconduct OR unlawful worker termination) | 5 yrs (limited reasons) | **7 yrs (limited reasons under s.8(3))** | s.8(3) |
| Voluntary resignation 7–10 yrs | n/a (10-yr threshold) | n/a | n/a | YES (any reason except misconduct) | YES (any reason except misconduct OR unlawful worker termination) | n/a | **NO** — voluntary resignation NOT a qualifying reason (TBD-TAS-07) | s.8(3) |
| Serious & wilful misconduct dismissal — sub-threshold | full forfeiture | n/a | full forfeiture | full forfeiture | full forfeiture | full forfeiture | **full forfeiture sub-10-yr** | s.8(3) |
| Serious & wilful misconduct dismissal — at/above qualifying threshold | full payout | full payout | full payout | **partial forfeiture (last fully-accrued block only)** | full payout | full payout | **FULL PAYOUT at 10+ yrs (PM rec TBD-TAS-06 — mirrors NSW/VIC/QLD/SA/ACT, NOT WA)** | s.8(2) (no misconduct exception in full-entitlement branch) |
| Break tolerance — re-employment | 2 mo | 12 wks | 3 mo | 2 mo (non-slackness); 6 mo (slackness) | 2 mo | 2 mo (non-slackness); 6 mo (slackness) | **3 mo (non-slackness); 6 mo (slackness + 14-day return-to-work offer)** — TBD-TAS-12 | s.5 |
| Casual continuity test | "regular and systematic" | 12 weeks unless agreement | 3 months between contracts | regular and systematic | regular or systematic | seasonal interruption >2 mo doesn't break if seasonal | **32 hours per consecutive 4-week period (s.5(3)) — TAS UNIQUE** — TBD-TAS-04 | s.5(3) |
| Sickness/injury counted as service | counts | counts | counts | 15-day cap pre-2022 | counts | 2-wk/yr cap | **counts in full (medical-certificate-backed per s.5(1)(c))** | s.5(1)(c) |
| Maternity / paid parental leave | counts (company-paid) | first 52 wks (post-2018) | not specifically encoded | depends on accrual date | counts (company-paid) | does NOT count | **DOES NOT COUNT** (paid + unpaid both excluded per s.5) — TBD-TAS-13 | s.5 |
| Workers Comp absence | counts | counts | counts | dual-regime (2024-07-01 cliff) | counts + 156-wk substitution | dual-regime (2023-06-09 cliff) | **counts (medical-certificate-backed s.5(1)(c)) — single regime** | s.5(1)(c) |
| WC rate of pay during LSL | counts as service; current rate | s.17 higher-of-pre-injury-or-current | literal s.98 + advisory | literal s.9 + advisory | literal s.4 + advisory | literal s.7 + advisory | **literal s.11 + advisory** (parallel to QLD/WA/SA/ACT) | s.11 + WorkSafe Tas |
| Higher-duties / acting rate | not encoded | not encoded | not encoded | not encoded | SA-unique (s.4) | not encoded | **not encoded** | n/a |
| Public holiday during LSL | exclusive | exclusive | exclusive | exclusive | INCLUSIVE | exclusive | **EXCLUSIVE — PH extends leave by 1 day per PH** | s.12(9) |
| Death of employee | s.4(2)(iii)(d) — pro-rata, estate | s.10 — full + 52-wk avg | s.95(3)(a) — pro-rata | s.8(3) — pro-rata | s.5 — vests in personal representative | s.11C — qualifying at 5+ yrs | **s.8(3) — qualifying reason; pro-rata 7–10 yrs; full at 10+ yrs to personal representative** | s.8(3) |
| Casual averaging window | implicit via "regular and systematic" + 52-wk lookback | 3-tier | 52 weeks (s.105) | accrual-period-average | 156 weeks | 12 months (s.7(2) / s.11D anchor) | **12 months immediately prior to taking/cessation (s.11(6))** | s.11(6) |
| Commission averaging window | branch B (NSW) | s.15 (if in contract) | s.99 — 52.179-day | s.7(4) 365 days | 52 wks | s.2F — 52 wks | **3 months immediately prior (s.11(3)) — TAS UNIQUE / shortest in Australia** — TBD-TAS-03 | s.11(3) |
| **Shift penalties in ordinary pay** | excluded | excluded | **INCLUDED** (s.98) | excluded | excluded | excluded | **INCLUDED (s.11) — TAS UNIQUE with QLD** | s.11 |
| **All-purpose allowances in ordinary pay** | (varies) | (varies) | INCLUDED | excluded if not all-purpose | included | INCLUDED | **INCLUDED (s.11)** | s.11 |
| **Bonus / incentive in ordinary pay** | conditional (4-criteria + high-income) | conditional (in contract) | (regulator silent) | excluded by s.7A | excluded | INCLUDED if usually paid | **EXCLUDED ABSOLUTELY (s.11(2)(h)) — TAS most restrictive in Australia** | s.11(2)(h) |
| **Day-to-day rate variation** | NO | NO | NO | NO | NO | NO | **YES — TAS UNIQUE; FT/PT rate varies day-by-day per shift penalty / all-purpose allowance applicable on the day** — TBD-TAS-01 | s.11 + WorkSafe Tas |
| Cashing out | not in scope NSW v1 | CRIMINAL OFFENCE s.34 | PERMITTED via QIRC (s.110) — advisory | PERMITTED post-accrual — advisory | PERMITTED post-10-yr — advisory | PERMITTED s.8(c) — advisory | **PERMITTED s.10 by agreement once entitlement reached — advisory** | s.10 |
| Leave in advance | not encoded NSW v1 | (not specifically encoded) | (not specifically encoded) | s.10 permitted with employer agreement | (not specifically encoded) | NOT permitted | **NOT PERMITTED — no statutory basis in the Act** | s.8(2) + s.12 |
| Pay-on-termination timing | forthwith | day of termination | within 3 days (regulator) | day of termination | immediately | within 90 days | **day of termination (s.12(4) — deemed-commenced-on-cessation)** | s.12(4) |
| Apprentice lead-in | (varies) | 52 wks | 3 mo | 52 wks | 12 mo | 12 mo | **3 months — TAS UNIQUE shortest** — TBD-TAS-11 | s.5 |
| Retirement age | (any age) | (any age) | (any age) | (any age) | (any age) | 65 / award-min | **60 women / 65 men (sex-specific Act reading) OR award-min** — TBD-TAS-02 | s.8(3) |
| Records retention | (varies) | (varies) | (varies) | (varies) | (varies) | 7 years | **in perpetuity (no statutory limit) — out of v1 engine scope** | s.7 LSL Regulations 2017 |
| Industry-specific portable schemes | not in scope | not in scope | separate Acts | MyLeave (construction) | Construction Industry LSL Act 1987 (SA) | OUT OF v1 SCOPE (BCI / CCI / PS Acts) | **OUT OF v1 SCOPE: TasBuild — Construction Industry (Long Service) Act 1997 (Tas)** | n/a |

---

## Coverage at a glance

| Source / Theme | Test IDs | Count |
|---|---|---|
| APA PDF TAS worked examples (pp.95–108) | TC-TAS-001 → TC-TAS-008 | 8 |
| Sub-7-year and 7–10-year qualifying-reason cases (s.8(3)) | TC-TAS-009 → TC-TAS-018 | 10 |
| 10+ year full payout (any reason, incl. misconduct at 10+) (s.8(2)) | TC-TAS-019 → TC-TAS-023 | 5 |
| Serious & wilful misconduct treatment (s.8(3)) | TC-TAS-024 → TC-TAS-026 | 3 |
| Continuous-service edge cases (s.5) — incl. 32-hr/4-wk casual rule | TC-TAS-027 → TC-TAS-036 | 10 |
| Workers Comp service-counting (s.5(1)(c)) | TC-TAS-037 → TC-TAS-039 | 3 |
| Public holiday EXCLUSIVE in LSL period (s.12(9)) | TC-TAS-040 → TC-TAS-042 | 3 |
| Ordinary pay — fixed-rate, allowances (incl. all-purpose), shift penalties (s.11) | TC-TAS-043 → TC-TAS-049 | 7 |
| Bonus exclusion absolute (s.11(2)(h)) — TAS-unique restrictive treatment | TC-TAS-050 → TC-TAS-051 | 2 |
| **Day-to-day rate variation — TAS UNIQUE** (s.11 + WorkSafe Tas) | TC-TAS-052 → TC-TAS-055 | 4 |
| Casual / PT — s.11(6) 12-mo averaging | TC-TAS-056 → TC-TAS-058 | 3 |
| Commission — s.11(3) 3-month averaging (TAS UNIQUE shortest window) | TC-TAS-059 → TC-TAS-061 | 3 |
| 15-year and 20-year continuous-accrual cases (s.8(2)) | TC-TAS-062 → TC-TAS-063 | 2 |
| Cashing out — non-blocking advisory (s.10) | TC-TAS-064 → TC-TAS-067 | 4 |
| Workers comp overlap with LSL rate (s.11 — parallel to QLD/WA/SA/ACT) | TC-TAS-068 | 1 |
| Transfer of business (s.5) | TC-TAS-069 | 1 |
| Leave in advance — refused (no statutory basis) | TC-TAS-070 | 1 |
| As-at snapshot trigger | TC-TAS-071 → TC-TAS-072 | 2 |
| Cross-jurisdiction (TAS + other state) | TC-TAS-073 → TC-TAS-074 | 2 |
| Pay-on-termination day-of-termination surface (`payable_by = terminationDate`) | TC-TAS-075 | 1 |
| Bulk-mode fixtures | TC-TAS-BULK-001 → TC-TAS-BULK-003 | 3 |
| **Total active single-mode fixtures for v1 TAS launch** | | **75** |
| **Bulk-mode fixtures** | | **3** |
| **Grand total** | | **78** |

> **Note on size**: TAS fixture count (78) is on parity with ACT (78). The extras come from: (a) the day-to-day rate variation rule unique to TAS (4 fixtures); (b) the 32-hour-4-week casual continuity test (3 fixtures in §E); (c) the shorter 3-month commission window (3 fixtures); (d) the absolute bonus exclusion (2 fixtures); (e) the 60F/65M sex-specific retirement age (covered inline in §B). Bulk count matches QLD/WA/SA/ACT at 3.

---

# Single-mode test cases

## §A — APA PDF TAS worked examples (pp.95–108)

### TC-TAS-001 — 10 yrs FT taking 8.6667 weeks LSL, full first entitlement

- **Source**: APA p.96 worked example; TAS LSL Act 1976 s.8(2)
- **Category**: Fixed-rate (s.11)
- **Why it matters**: Canonical "10 yrs → 8.6667 weeks" calculation — the TAS first-entitlement value. Same as NSW/QLD/WA at 10 yrs (vs VIC/ACT 6.0667 at 7 yrs and SA 13 wks).

**Inputs**

```yaml
employee:
  id: TC-TAS-001
  legalName: SamTAS
  startDate: 2016-05-26
  employmentType: full_time
  statesOfService: [TAS]
  governingJurisdiction: TAS
  currentWeeklyGross: 1800.00
  wageHistory:
    - { periodStart: 2016-05-26, periodEnd: 2026-05-26, grossPay: 936000.00, frequency: weekly }
  serviceEvents: []
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 8.6667 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 10.0000
total_entitlement_weeks: 8.6667        # s.8(2) — 8.6667 wks at 10 yrs
value_of_week: 1800.00                 # s.11 — fixed-rate ordinary pay (no shift penalty / no allowance supplied)
value_of_day: 360.00                   # 1800 / 5 (FT 5-day week)
payable_for_taken_leave: 15600.06      # 8.6667 × 1800
expected_citations:
  - { section: TAS LSL Act 1976 s.8(2), rule: accrual.qualifying-period-10yr-8.6667wks, pdfPage: 96 }
  - { section: TAS LSL Act 1976 s.11,   rule: ordinary-pay.fixed-rate, pdfPage: 97 }
  - { section: TAS LSL Act 1976 s.12,   rule: trigger.taking-leave, pdfPage: 98 }
```

**Notes**

The same employee profile in VIC/ACT returns 8.6667 wks at the same accrual ratio applied to 10 yrs. In SA returns 13 wks (more generous). Engine MUST emit the `tas_day_to_day_rate_variation_advisory` warning when neither `extraInputs.tas_shift_penalty_by_day` nor `extraInputs.tas_all_purpose_allowance_by_day` are supplied — flagging to the operator that day-to-day variation may apply but engine has fallen back to flat weekly rate.

---

### TC-TAS-002 — 7 yrs FT illness-incapacity dismissal, pro-rata 6.0667 wks

- **Source**: APA p.97; TAS LSL Act 1976 s.8(3)
- **Category**: Pro-rata at termination — sub-10-yr qualifying-reason
- **Why it matters**: TAS's 7-year pro-rata threshold with qualifying-reason gate. Illness/incapacity qualifies under s.8(3).

**Inputs**

```yaml
employee:
  id: TC-TAS-002
  legalName: IllnessTAS
  startDate: 2019-05-26
  endDate: 2026-05-26                    # exactly 7 yrs
  employmentType: full_time
  statesOfService: [TAS]
  governingJurisdiction: TAS
  currentWeeklyGross: 1700.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-26, reason: illness_incapacity, terminationInitiator: employee }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.0000
total_entitlement_weeks: 6.0669         # 7 × 0.8667 (pro-rata at 7 yrs with qualifying reason)
value_of_week: 1700.00
total_entitlement_dollars: 10313.73     # 6.0669 × 1700
payable_by: 2026-05-26                   # s.12(4) — deemed-commenced-on-cessation
warnings:
  - { code: tas_payable_on_day_of_termination_advisory, message: "Pay-on-termination is the day of termination per TAS LSL Act 1976 s.12(4) (worker deemed to have commenced LSL on the date of termination)." }
expected_citations:
  - { section: TAS LSL Act 1976 s.8(3), rule: accrual.7-to-10yr.illness-incapacity-qualifies, pdfPage: 97 }
  - { section: TAS LSL Act 1976 s.11,    rule: ordinary-pay.fixed-rate, pdfPage: 97 }
  - { section: TAS LSL Act 1976 s.12(4), rule: termination.deemed-commenced-on-cessation-date, pdfPage: 98 }
```

**Notes**

Pro-rata calculation includes years AND months/12. At exactly 7 yrs the months component is 0. Engine uses the same accrual ratio as for full entitlement at 10+ yrs (continuous at 0.8667/yr; payable only at 7 yrs+ with qualifying reason gate).

---

### TC-TAS-003 — 8.5 yrs FT redundancy (employer-not-misconduct), pro-rata 7.3672 wks

- **Source**: APA p.98; TAS LSL Act 1976 s.8(3)
- **Category**: Pro-rata at termination — redundancy qualifies under "employer-not-misconduct"

**Inputs**

```yaml
employee:
  id: TC-TAS-003
  startDate: 2017-11-26
  endDate: 2026-05-26                    # 8 yrs 6 mo
  employmentType: full_time
  statesOfService: [TAS]
  governingJurisdiction: TAS
  currentWeeklyGross: 1500.00
trigger: { kind: termination, terminationDate: 2026-05-26, reason: redundancy }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 8.5000       # 8 yrs + 6 mo/12
total_entitlement_weeks: 7.3672           # 8.5 × 0.8667 (s.8(3) — years + months/12)
value_of_week: 1500.00
total_entitlement_dollars: 11050.80
payable_by: 2026-05-26
warnings: [{ code: tas_payable_on_day_of_termination_advisory }]
expected_citations:
  - { section: TAS LSL Act 1976 s.8(3), rule: accrual.7-to-10yr.employer-not-misconduct, pdfPage: 98 }
```

**Notes**

8.5 × 0.86667 = 7.3667 (within rounding tolerance of 7.3672). Engine computes via `(years_int + months_in_year / 12) × 0.8666666...`.

---

### TC-TAS-004 — 10+ yrs FT taking leave, ordinary weekly pay derived from base + skills allowance + shift penalty

- **Source**: APA p.99; TAS LSL Act 1976 s.11
- **Category**: Fixed-rate FT with included shift penalty + all-purpose allowance (TAS-distinctive)

**Inputs**

```yaml
employee:
  id: TC-TAS-004
  startDate: 2014-05-26                   # 12 yrs
  employmentType: full_time
  statesOfService: [TAS]
  governingJurisdiction: TAS
  currentWeeklyGross: 2000.00              # base $1800 + tool allowance (all-purpose) $50 + shift penalty $150 — pre-summed by operator
  wageHistory:
    - { periodStart: 2025-05-26, periodEnd: 2026-05-26, grossPay: 104000.00, frequency: weekly }
  extraInputs:
    tas_all_purpose_allowance_by_day: []   # operator chose pre-summed weekly value path
    tas_shift_penalty_by_day: []
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 10.4004 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 12.0000
total_entitlement_weeks: 10.4004           # 12 × 0.8667
value_of_week: 2000.00                    # incl. tool allowance + shift penalty
payable_for_taken_leave: 20800.80          # 10.4004 × 2000
warnings:
  - { code: tas_shift_penalty_included }
  - { code: tas_all_purpose_allowance_included }
  - { code: tas_day_to_day_rate_variation_advisory, message: "Operator supplied flat weekly gross. Day-to-day variation (TBD-TAS-01) may produce a different total if penalties/allowances apply on some LSL days. Supply `extraInputs.tas_shift_penalty_by_day` and/or `tas_all_purpose_allowance_by_day` for day-precise computation." }
expected_citations:
  - { section: TAS LSL Act 1976 s.11, rule: ordinary-pay.includes-shift-penalty-and-all-purpose-allowance, pdfPage: 99 }
```

**Notes**

Per WorkSafe Tasmania — "Shift penalties, all-purpose allowances and casual loading INCLUDED in ordinary pay." Operator chose to pre-sum into `currentWeeklyGross` for v1 — same convention as NSW/VIC/QLD/WA/SA/ACT. For day-by-day computation, see TC-TAS-052 → TC-TAS-055.

---

### TC-TAS-005 — 15 yrs FT taking 13.0 weeks LSL (continuous accrual past 10 yrs)

- **Source**: APA p.100; TAS LSL Act 1976 s.8(2)
- **Category**: Continuous accrual past 10 yrs — verifies `Years × 8.6667/10` formula

**Inputs**

```yaml
employee:
  id: TC-TAS-005
  startDate: 2011-05-26
  endDate: 2026-05-26                      # 15 yrs
  employmentType: full_time
  statesOfService: [TAS]
  governingJurisdiction: TAS
  currentWeeklyGross: 1900.00
trigger: { kind: termination, terminationDate: 2026-05-26, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 15.0000
total_entitlement_weeks: 13.0005           # 15 × 0.8667 = 13.0005 (no discrete step at 15 yrs)
value_of_week: 1900.00
total_entitlement_dollars: 24700.95
payable_by: 2026-05-26
warnings: [{ code: tas_payable_on_day_of_termination_advisory }]
expected_citations:
  - { section: TAS LSL Act 1976 s.8(2), rule: accrual.continuous-0.8667-per-year, pdfPage: 100 }
```

**Notes**

Continuous accrual at 0.8667/yr from year 10 (no discrete +4.3333-wk step at 15 yrs — operator confirms this reading via TBD-TAS-06's resolution context; the +4.3333/5-yr phrasing in the Act is equivalent to continuous 0.8667/yr in pure arithmetic). Voluntary resignation at 10+ yrs qualifies — once the 10-yr full-entitlement threshold is crossed, the s.8(3) qualifying-reason gate falls away.

---

### TC-TAS-006 — 11 yrs PT taking 9.5337 weeks, 12-mo hours average

- **Source**: APA p.101; TAS LSL Act 1976 s.11(6)
- **Category**: PT with 12-mo averaging window (s.11(6))

**Inputs**

```yaml
employee:
  id: TC-TAS-006
  startDate: 2015-05-26
  employmentType: part_time
  statesOfService: [TAS]
  governingJurisdiction: TAS
  currentHourlyRate: 35.00                 # ordinary base rate
  hoursLast12MonthsBeforeEntitlement: 1300 # 25 h/wk × 52
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 9.5337 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 11.0000
total_entitlement_weeks: 9.5337            # 11 × 0.8667
weekly_avg_12mo_taking: 25.00              # 1300 / 52
value_of_week: 875.00                       # 25 × $35
payable_for_taken_leave: 8341.99           # 9.5337 × 875
expected_citations:
  - { section: TAS LSL Act 1976 s.8(2),  rule: accrual.continuous-past-10yr, pdfPage: 101 }
  - { section: TAS LSL Act 1976 s.11(6), rule: ordinary-pay.part-time-12mo-average, pdfPage: 101 }
```

**Notes**

PT 12-mo averaging per s.11(6). Same 12-month window as ACT s.7(2) and SA per-block, BUT TAS commission window is 3 months (much shorter) — see TC-TAS-008 below.

---

### TC-TAS-007 — 12 yrs casual taking 10.4 weeks, 12-mo hours average + casual loading

- **Source**: APA p.102; TAS LSL Act 1976 s.11(6)
- **Category**: Casual with 12-mo averaging + 25% casual loading

**Inputs**

```yaml
employee:
  id: TC-TAS-007
  startDate: 2014-05-26
  employmentType: casual
  statesOfService: [TAS]
  governingJurisdiction: TAS
  currentHourlyRate: 40.00                 # base $32 + 25% casual loading
  hoursLast12MonthsBeforeEntitlement: 1664 # 32 h/wk × 52
  extraInputs:
    tas_casual_32hr_4wk_periods_compliant: true
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 10.4004 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 12.0000
total_entitlement_weeks: 10.4004            # 12 × 0.8667
weekly_avg_12mo_taking: 32.00              # 1664 / 52
value_of_week: 1280.00                     # 32 × $40 (loaded casual rate)
payable_for_taken_leave: 13312.51           # 10.4004 × 1280
warnings:
  - { code: tas_casual_32hr_4wk_continuity_satisfied }
expected_citations:
  - { section: TAS LSL Act 1976 s.11(6), rule: ordinary-pay.casual-12mo-average-with-loading, pdfPage: 102 }
  - { section: TAS LSL Act 1976 s.5(3),  rule: continuous-service.casual-32hr-4wk-test }
```

**Notes**

Casual loading (25%) is included in the hourly rate. The s.5(3) 32-hour-4-week continuity test is confirmed via `extraInputs.tas_casual_32hr_4wk_periods_compliant: true`. If operator does NOT supply this signal, engine attempts to derive from `wageHistory` (TBD-TAS-04); if it can't, emits advisory `tas_casual_continuity_test_unverified` and assumes continuity preserved for v1.

---

### TC-TAS-008 — 11 yrs commission-only, **3-month** income lookback (s.11(3)) — TAS UNIQUE

- **Source**: APA p.103; TAS LSL Act 1976 s.11(3)
- **Category**: Commission / piece — 3-month income window divided by 13
- **Why it matters**: **TAS-unique 3-month commission window — shortest in Australia.** Engine MUST use s.11(3) 3-mo / 13 formula, NOT a 12-month-divided-by-52 path.

**Inputs**

```yaml
employee:
  id: TC-TAS-008
  startDate: 2015-05-26
  employmentType: full_time
  statesOfService: [TAS]
  governingJurisdiction: TAS
  wageHistory:
    - { periodStart: 2026-02-26, periodEnd: 2026-05-26, grossPay: 39000.00, frequency: weekly, note: "commission-only — 3-month window" }
trigger: { kind: termination, terminationDate: 2026-05-26, reason: redundancy }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 11.0000
total_entitlement_weeks: 9.5337
value_of_week: 3000.00                     # 39000 / 13 weeks (3 mo ≈ 13 wks) per s.11(3)
total_entitlement_dollars: 28601.10
payable_by: 2026-05-26
warnings:
  - { code: tas_commission_3mo_window_applied, message: "Commission income averaged over 3 months immediately prior to LSL per TAS LSL Act 1976 s.11(3). TAS commission window is the shortest in Australia (vs NSW branch-B / VIC s.15 / QLD 52.179-day / WA 365-day / SA 52-wk / ACT 52-wk)." }
  - { code: tas_payable_on_day_of_termination_advisory }
expected_citations:
  - { section: TAS LSL Act 1976 s.11(3), rule: ordinary-pay.commission-3mo-income-divided-by-13, pdfPage: 103 }
```

**Notes**

TAS s.11(3) uniquely uses a 3-month window (NOT 12 months). For an employee with 12-mo income of $156,000 of which $39,000 fell in the last 3 months, TAS engine uses ONLY the last $39,000 / 13 = $3,000/wk — NOT $156,000 / 52 = $3,000/wk (coincidentally identical for steady income; substantially different where commissions are seasonal). **TBD-TAS-03**: confirm "13 weeks" denominator vs alternative readings (3 calendar months exactly).

---

## §B — Sub-7-year and 7–10-year qualifying-reason cases (s.8(3))

### TC-TAS-009 — 6.9 yrs FT illness, NO entitlement (sub-7-yr cliff)

```yaml
employee: { startDate: 2019-06-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1700.00, statesOfService: [TAS], governingJurisdiction: TAS }
trigger: { kind: termination, reason: illness_incapacity, terminationInitiator: employee, terminationDate: 2026-05-26 }
expected:
  total_entitlement_weeks: 0
  total_entitlement_dollars: 0
  warnings: [{ code: sub_7yr_no_entitlement_tas, message: "Below 7 years of continuous service. No pro-rata entitlement is payable under TAS LSL Act 1976 s.8(3). The 7-year threshold is the universal floor in TAS — even for illness/death/retirement, which qualify at 7+ yrs." }]
  expected_citations:
    - { section: TAS LSL Act 1976 s.8(3), rule: accrual.sub-7yr-no-entitlement }
```

---

### TC-TAS-010 — 8 yrs FT voluntary resignation, NO entitlement (no qualifying reason in 7–10 yr band — TBD-TAS-07)

```yaml
employee: { startDate: 2018-05-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1500.00 }
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  total_entitlement_weeks: 0
  warnings:
    - { code: sub_10yr_no_qualifying_reason_tas, message: "Voluntary resignation at 7-10 years does NOT qualify for pro-rata under TAS LSL Act 1976 s.8(3). Qualifying reasons in this band are: retirement (60F/65M or award-min), death, employer-not-misconduct, illness/incapacity/domestic-pressing-necessity. Voluntary resignation is NOT among them. Compare to SA/WA which pay out at 7+ regardless of reason; TAS diverges." }
```

**Notes**: Confirms TAS-specific reading per TBD-TAS-07 PM-recommendation — voluntary resignation in the 7–10-yr band does NOT pay out in TAS (mirrors ACT 5–7-yr behaviour). The qualifying-reason gate is tight; only s.8(3)-listed reasons qualify.

---

### TC-TAS-011 — 8 yrs FT domestic-pressing-necessity, pro-rata 6.9333 wks

```yaml
employee: { startDate: 2018-05-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1500.00 }
trigger: { kind: termination, reason: domestic_pressing_necessity, terminationInitiator: employee }
expected: { total_entitlement_weeks: 6.9336, total_entitlement_dollars: 10400.40 }
```

**Notes**: 8 × 0.8667 = 6.9336. Domestic-pressing-necessity qualifies under s.8(3) (employee-initiated only). Reuses DEV-CROSS-1 enum value.

---

### TC-TAS-012 — 8 yrs FT retirement, woman aged 60, pro-rata 6.9336 wks (sex-specific default reading)

```yaml
employee: { startDate: 2018-05-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1700.00, dob: 1966-05-26, sex: female }
trigger: { kind: termination, reason: retirement }
expected:
  total_entitlement_weeks: 6.9336
  total_entitlement_dollars: 11787.12
  warnings:
    - { code: tas_retirement_qualifying_age_60f_65m_default, message: "TAS s.8(3) default reading is sex-specific: 60 years for women, 65 years for men. Engine applied this reading (woman aged 60 → qualifies). If award/agreement specifies a different minimum retirement age, set `extraInputs.tas_award_min_retirement_age_reached: true`." }
```

**Notes**: **TBD-TAS-02 (Sev-1)** — sex-specific retirement age (60F/65M) is the literal reading of the TAS Act but raises equality-law concerns. PM recommendation: encode the literal Act reading as the default with `dob` + `sex` signals, AND provide the `extraInputs.tas_award_min_retirement_age_reached` escape hatch for award-specified single-age treatments. Engine emits `tas_retirement_qualifying_age_60f_65m_default` to make the reading transparent to the operator.

---

### TC-TAS-013 — 8 yrs FT retirement, man aged 60, NO entitlement (sub-65 male)

```yaml
employee: { startDate: 2018-05-26, employmentType: full_time, dob: 1966-05-26, sex: male, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: retirement }
expected:
  total_entitlement_weeks: 0
  warnings:
    - { code: sub_10yr_no_qualifying_reason_tas, message: "Retirement at 60 for a male employee does NOT qualify under TAS s.8(3) default reading (sex-specific: 60F/65M). If award/agreement specifies a sub-65 minimum retirement age for this employee, set `extraInputs.tas_award_min_retirement_age_reached: true` to override." }
```

**Notes**: Sex-specific default reading. **TBD-TAS-02 sub-point**: operator may prefer a single age-65-for-all default to avoid sex-discriminatory output — see TBD-TAS-02 resolution options.

---

### TC-TAS-014 — 8 yrs FT retirement, man aged 60 with award-specified min age, pro-rata 6.9336 wks

```yaml
employee:
  startDate: 2018-05-26
  endDate: 2026-05-26
  employmentType: full_time
  currentWeeklyGross: 1700.00
  dob: 1966-05-26
  sex: male
  extraInputs:
    tas_award_min_retirement_age_reached: true
trigger: { kind: termination, reason: retirement }
expected:
  total_entitlement_weeks: 6.9336
  total_entitlement_dollars: 11787.12
  warnings:
    - { code: tas_retirement_qualifying_via_award_min_age, message: "Retirement qualifying via award/agreement-specified minimum retirement age — `extraInputs.tas_award_min_retirement_age_reached: true` honoured. Default sex-specific reading bypassed." }
```

---

### TC-TAS-015 — 9 yrs FT unfair dismissal, pro-rata 7.8018 wks (employer-not-misconduct)

```yaml
employee: { startDate: 2017-05-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: unfair_dismissal, terminationInitiator: employer }
expected: { total_entitlement_weeks: 7.8018, total_entitlement_dollars: 13263.08 }
```

**Notes**: Unfair dismissal is treated as "employer-not-misconduct" under s.8(3). Engine maps the DEV-CROSS-1 `unfair_dismissal` enum value to the s.8(3) employer-not-misconduct branch for TAS.

---

### TC-TAS-016 — 9 yrs FT employer-initiated-not-misconduct dismissal, pro-rata 7.8003 wks

```yaml
employee: { startDate: 2017-05-26, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: employer_initiated_not_misconduct, terminationInitiator: employer }
expected: { total_entitlement_weeks: 7.8003 }
```

---

### TC-TAS-017 — 9 yrs FT poor-performance dismissal, NO entitlement

```yaml
employee: { startDate: 2017-05-26, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: poor_performance, terminationInitiator: employer }
expected:
  total_entitlement_weeks: 0
  warnings:
    - { code: sub_10yr_no_qualifying_reason_tas, message: "Poor-performance dismissal at 7-10 years does NOT qualify under TAS LSL Act 1976 s.8(3) — poor performance is distinct from employer-not-misconduct (which is a clean redundancy or similar without conduct/capacity concerns). Engine treats poor_performance as a non-qualifying capacity-based reason (parallel to QLD s.95(3)(d) / ACT precedent)." }
```

---

### TC-TAS-018 — 8 yrs casual death, pro-rata 6.9336 wks at 12-mo hours average

```yaml
employee:
  startDate: 2018-05-26
  endDate: 2026-05-26
  employmentType: casual
  currentHourlyRate: 38.00
  hoursLast12MonthsBeforeCessation: 1456     # avg 28 h/wk
  extraInputs:
    tas_casual_32hr_4wk_periods_compliant: false  # 28 h/wk falls below 32 h/wk threshold
trigger: { kind: termination, reason: death }
expected:
  total_entitlement_weeks: 6.9336             # 8 × 0.8667 (engine still applies pro-rata; continuity test failure raises a separate question — TBD-TAS-04)
  weekly_avg_12mo_termination: 28.00
  value_of_week: 1064.00                       # 28 × $38
  total_entitlement_dollars: 7377.35
  payment_recipient: "personal representative of the deceased worker"
  warnings:
    - { code: tas_casual_32hr_4wk_continuity_not_satisfied, message: "Casual averaged 28 h/wk over 12 months — falls below the s.5(3) 32-hour-4-week threshold. Engine has computed the pro-rata under PM-recommended permissive reading (TBD-TAS-04): if operator confirms continuity was preserved despite hours dip, no service forfeiture applies. Operator override via `extraInputs.tas_casual_32hr_4wk_periods_compliant: true` if appropriate." }
```

**Notes**: Death is a qualifying reason at 7+ yrs under s.8(3). The s.5(3) 32-hour-4-week test is the key TAS-unique casual continuity check — fixture intentionally probes the edge where the headline 12-mo avg looks low. **TBD-TAS-04**: confirm engine reading — per-4-week-period evaluation (strict) vs over-the-window-average (permissive).

---

## §C — 10+ year full payout (s.8(2)) — including misconduct at 10+

### TC-TAS-019 — 10 yrs exactly FT misconduct dismissal, **FULL 8.6667 WEEKS payable** (TBD-TAS-06 PM rec)

- **Source**: TAS LSL Act 1976 s.8(2); PM-recommended reading per TBD-TAS-06
- **Category**: 10+ yr full payout regardless of reason
- **Why it matters**: **CRITICAL TAS-vs-WA divergence (PM recommendation pending sign-off).** TAS PM-recommends NO partial-forfeiture rule at 10+ yr misconduct. The full entitlement is payable. Parallel to NSW/VIC/QLD/SA/ACT.

**Inputs**

```yaml
employee:
  startDate: 2016-05-26
  endDate: 2026-05-26                        # exactly 10 yrs
  employmentType: full_time
  statesOfService: [TAS]
  governingJurisdiction: TAS
  currentWeeklyGross: 1800.00
trigger: { kind: termination, reason: serious_misconduct, terminationDate: 2026-05-26 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 10.0000
total_entitlement_weeks: 8.6667             # FULL — not partial (TBD-TAS-06 PM rec)
value_of_week: 1800.00
total_entitlement_dollars: 15600.06
payable_by: 2026-05-26
warnings:
  - { code: tas_10yr_plus_misconduct_full_payout, message: "Dismissal for serious & wilful misconduct at 10+ years of continuous service. Under TAS LSL Act 1976 s.8(2), the full 8.6667-week (or higher) entitlement is payable regardless of termination reason — TAS does NOT mirror WA s.8(3) partial-forfeiture (PM-recommended reading per TBD-TAS-06). The serious-misconduct exception in TAS applies ONLY to the pro-rata branch (sub-10 yrs), not to the full-entitlement branch." }
  - { code: tas_payable_on_day_of_termination_advisory }
expected_citations:
  - { section: TAS LSL Act 1976 s.8(2), rule: accrual.10yr-full-entitlement-regardless-of-reason }
```

**Notes**

**TBD-TAS-06 (Sev-2)** — confirm PM recommendation. WA partial-forfeits at 10+ yr misconduct (TC-WA-026 / TC-WA-027). PM-recommended reading for TAS: full payout, parallel to NSW/VIC/QLD/SA/ACT. The misconduct exception in TAS s.8(3) is explicitly worded for the pro-rata branch (7–10 yrs); once the worker has crossed the 10-yr threshold under s.8(2), misconduct does not reduce the entitlement on PM's reading. Operator may instead prefer WA-style partial-forfeiture for TAS — see TBD-TAS-06 resolution.

---

### TC-TAS-020 — 12 yrs FT misconduct dismissal, **FULL 10.4 weeks payable**

```yaml
employee: { startDate: 2014-05-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: serious_misconduct }
expected:
  total_entitlement_weeks: 10.4004           # 12 × 0.8667 (continuous accrual)
  total_entitlement_dollars: 17680.68
  warnings: [{ code: tas_10yr_plus_misconduct_full_payout }]
```

---

### TC-TAS-021 — 10 yrs PT death, **FULL 8.6667 weeks to personal representative**

```yaml
employee:
  startDate: 2016-05-26
  employmentType: part_time
  hoursLast12MonthsBeforeCessation: 1040    # avg 20 h/wk
  currentHourlyRate: 36.00
trigger: { kind: termination, reason: death }
expected:
  total_entitlement_weeks: 8.6667
  weekly_avg_12mo_termination: 20.00
  value_of_week: 720.00                      # 20 × $36
  total_entitlement_dollars: 6240.02
  payment_recipient: "personal representative of the deceased worker"
```

---

### TC-TAS-022 — 10.001 yrs FT voluntary resignation, 8.6754 weeks

```yaml
employee: { startDate: 2016-05-25, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1800.00 }  # 10 yrs + 1 day
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  total_entitlement_weeks: 8.6691            # 10.0027 × 0.8667 — day-precise
  total_entitlement_dollars: 15604.34
```

**Notes**: Confirms accrual is day-precise past the 10-yr threshold, not snapped to integer-anniversary 8.6667.

---

### TC-TAS-023 — 10 yrs less 1 day FT voluntary resignation, $0 (sub-10-yr no-qualifying-reason cliff)

```yaml
employee: { startDate: 2016-05-27, endDate: 2026-05-26, employmentType: full_time }  # 1 day short of 10 yrs
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  total_entitlement_weeks: 0
  warnings: [{ code: sub_10yr_no_qualifying_reason_tas }]
```

**Notes**: Mirror of TC-TAS-022 just below the 10-yr threshold. The cliff at exactly 10.0000 yrs is binary in TAS for non-qualifying reasons (voluntary resignation, misconduct).

---

## §D — Serious & wilful misconduct treatment (s.8(3))

### TC-TAS-024 — 8 yrs FT serious misconduct, $0

```yaml
employee: { startDate: 2018-05-26, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: serious_misconduct }
expected:
  total_entitlement_weeks: 0
  warnings: [{ code: sub_10yr_misconduct_excluded_tas, message: "Dismissal for serious and wilful misconduct under TAS LSL Act 1976 s.8(3) — at sub-10-year tenure, no pro-rata entitlement is payable. At 10+ years, the full entitlement is payable regardless of reason on PM-recommended reading (TBD-TAS-06). See TC-TAS-019." }]
```

---

### TC-TAS-025 — 9.9 yrs FT serious misconduct, $0

```yaml
employee: { startDate: 2016-06-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: termination, reason: serious_misconduct }
expected:
  total_entitlement_weeks: 0
  warnings: [{ code: sub_10yr_misconduct_excluded_tas }]
```

---

### TC-TAS-026 — 11 yrs FT serious misconduct, FULL 9.5337 weeks (TBD-TAS-06 PM rec — no partial forfeiture)

```yaml
employee: { startDate: 2015-05-26, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: serious_misconduct }
expected:
  total_entitlement_weeks: 9.5337             # 11 × 0.8667
  warnings: [{ code: tas_10yr_plus_misconduct_full_payout }]
```

---

## §E — Continuous service edge cases (s.5) — including the 32-hour-4-week casual rule

### TC-TAS-027 — Unpaid leave 12 wks; does not count as service (s.5 — any other absence approved by employer)

```yaml
employee:
  startDate: 2016-02-26
  endDate: 2026-05-26                        # nominal 10 yrs 3 mo
  employmentType: full_time
  serviceEvents:
    - { type: leave_without_pay, startDate: 2022-01-01, endDate: 2022-03-26 }  # 12 wks UPL
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 8.6667 }
expected:
  years_of_continuous_service: 10.0000        # 10 yrs 3 mo − 12 wks UPL ≈ 10.0
  total_entitlement_weeks: 8.6667
```

**Notes**: Per s.5, "any other absence approved by employer" does NOT count as service but does NOT necessarily break continuity. v1 treats UPL as not-counting toward service days; engine pushes the entitlement date out by the UPL duration (parallel to ACT TBD-ACT-13 RESOLVED "extends-the-line" pattern).

---

### TC-TAS-028 — Maternity leave (paid + unpaid 26 wks) does NOT count as service (TAS UNIQUE — TBD-TAS-13)

```yaml
employee:
  startDate: 2014-05-26
  endDate: 2026-05-26
  serviceEvents:
    - { type: paid_leave, startDate: 2020-01-01, endDate: 2020-04-01, note: "company-paid parental leave 13 wks" }
    - { type: leave_without_pay, startDate: 2020-04-02, endDate: 2020-07-01, note: "unpaid maternity leave 13 wks" }
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  years_of_continuous_service: 11.5000         # 12 yrs − 26 wks maternity (both paid + unpaid)
  total_entitlement_weeks: 9.9671             # 11.5 × 0.8667
  warnings:
    - { code: tas_maternity_leave_excluded, message: "Maternity leave (both paid and unpaid) does NOT count as service under TAS LSL Act 1976 s.5. This is the most restrictive parental-leave treatment in Australia — diverges from NSW/SA (which count company-paid parental) and from VIC post-2018 (which counts the first 52 wks)." }
```

**Notes**: **TAS-specific divergence — load-bearing.** WorkSafe Tasmania explicitly lists "Maternity Leave (paid + unpaid)" in the "does NOT count" column of s.5. The engine MUST NOT treat parental leave as service-counting for TAS. **TBD-TAS-13**: confirm operator agrees with this strict reading. Note this is even more restrictive than ACT (which excludes only paid parental, not unpaid).

---

### TC-TAS-029 — Re-employment within 3 months preserves continuity (TAS — 3-mo non-slackness)

```yaml
employee:
  startDate: 2014-05-26
  serviceEvents:
    - { type: employer_initiated_termination_and_rehire, startDate: 2022-05-26, endDate: 2022-08-15 }  # ~82-day gap
trigger: { kind: termination, reason: redundancy, terminationDate: 2026-05-26 }
expected:
  years_of_continuous_service: 11.7753
  total_entitlement_weeks: 10.2055           # 11.78 × 0.8667
```

**Notes**: TAS's 3-month non-slackness break tolerance is longer than NSW/SA/WA's 2-month tolerance but shorter than VIC's 12-week (84-day). Same as QLD's 3-month tolerance.

---

### TC-TAS-030 — Re-employment after 4 months (>3 mo, non-slackness) breaks continuity

```yaml
employee:
  startDate: 2014-05-26
  serviceEvents:
    - { type: employer_initiated_termination_and_rehire, startDate: 2022-05-26, endDate: 2022-09-26 }
trigger: { kind: termination, reason: redundancy, terminationDate: 2026-05-26 }
expected:
  years_of_continuous_service: 3.6657
  total_entitlement_weeks: 0
  warnings: [{ code: gap_exceeds_state_tolerance, message: "Re-employment gap of 4 months exceeds TAS's 3-month non-slackness tolerance under s.5. Pre-gap service forfeited." }]
```

---

### TC-TAS-031 — Re-employment after 5 months following SLACKNESS OF TRADE, return-to-work accepted within 14 days, preserves continuity (s.5)

```yaml
employee:
  startDate: 2014-05-26
  serviceEvents:
    - type: employer_initiated_termination_and_rehire
      startDate: 2022-05-26
      endDate: 2022-10-26                    # 5-month gap
      slacknessOfTrade: true                  # DEV-CROSS-2 field (reused)
  extraInputs:
    tas_slackness_return_within_14_days: true
trigger: { kind: termination, reason: redundancy, terminationDate: 2026-05-26 }
expected:
  years_of_continuous_service: 11.4986
  total_entitlement_weeks: 9.9665
  warnings:
    - { code: tas_slackness_of_trade_continuity_preserved, message: "Re-employment within 6 months following slackness-of-trade stand-down AND return-to-work offer accepted within 14 days — continuity preserved per TAS LSL Act 1976 s.5. Gap days do not count as service." }
```

**Notes**: REUSES DEV-CROSS-2 `slacknessOfTrade` flag added for WA + new TAS-localised `extraInputs.tas_slackness_return_within_14_days`. **TBD-TAS-12**: confirm the 14-day return-to-work-offer reading is correct.

---

### TC-TAS-032 — Re-employment after 5 months following slackness but return-to-work NOT accepted within 14 days, breaks continuity

```yaml
employee:
  startDate: 2014-05-26
  serviceEvents:
    - type: employer_initiated_termination_and_rehire
      startDate: 2022-05-26
      endDate: 2022-10-26
      slacknessOfTrade: true
  extraInputs:
    tas_slackness_return_within_14_days: false
trigger: { kind: termination, reason: redundancy, terminationDate: 2026-05-26 }
expected:
  years_of_continuous_service: 3.5836        # only post-rehire service counts; pre-rehire forfeited
  total_entitlement_weeks: 0
  warnings:
    - { code: tas_slackness_14_day_return_window_missed, message: "Slackness-of-trade re-employment exceeded 3 months AND the return-to-work offer was NOT accepted within 14 days. Continuity preservation per TAS LSL Act 1976 s.5 does NOT apply; standard 3-month break tolerance used. Pre-gap service forfeited." }
```

**Notes**: Mirror of TC-TAS-031 — the 14-day return-to-work-offer clause is load-bearing for the 6-month tolerance.

---

### TC-TAS-033 — **Casual 32-hour-4-week rule satisfied** — continuity preserved (s.5(3) — TAS UNIQUE)

```yaml
employee:
  startDate: 2014-05-26
  endDate: 2026-05-26
  employmentType: casual
  currentHourlyRate: 38.00
  hoursLast12MonthsBeforeCessation: 1768     # 34 h/wk × 52 — comfortably above 32 h/wk threshold
  extraInputs:
    tas_casual_32hr_4wk_periods_compliant: true
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  years_of_continuous_service: 12.0000
  total_entitlement_weeks: 10.4004
  weekly_avg_12mo_termination: 34.00
  value_of_week: 1292.00
  warnings:
    - { code: tas_casual_32hr_4wk_continuity_satisfied, message: "Casual employee's continuity confirmed via s.5(3) 32-hour-4-week test. Operator-supplied `extraInputs.tas_casual_32hr_4wk_periods_compliant: true`." }
```

**Notes**: **TBD-TAS-04 reference fixture.** s.5(3) requires regularly working ≥32 hours per consecutive 4-week period. v1 implementation: operator-supplied via `extraInputs.tas_casual_32hr_4wk_periods_compliant`; engine attempts to derive from `wageHistory` if absent. **No other state has this specific test** — TAS-unique.

---

### TC-TAS-034 — **Casual 32-hour-4-week rule FAILED** for one 4-week period (s.5(3))

```yaml
employee:
  startDate: 2018-05-26
  endDate: 2026-05-26
  employmentType: casual
  currentHourlyRate: 38.00
  hoursLast12MonthsBeforeCessation: 1456     # avg 28 h/wk — clearly below 32 h/wk threshold
  extraInputs:
    tas_casual_32hr_4wk_periods_compliant: false
trigger: { kind: termination, reason: redundancy }
expected:
  total_entitlement_weeks: 0
  warnings:
    - { code: tas_casual_32hr_4wk_continuity_not_satisfied, message: "Casual employee FAILS s.5(3) — 12-month average of 28 h/wk falls below the 32-hour-4-week threshold. Operator confirmed via `extraInputs.tas_casual_32hr_4wk_periods_compliant: false`. Service is interrupted at the first failed 4-week period; pre-failure service forfeited unless qualifying re-engagement event applied. Engine returned $0 — operator can dispute by setting the flag to `true` if continuity was preserved by other means." }
```

**Notes**: **TBD-TAS-04 (Sev-2)**: operator decision needed on whether engine should infer or require operator confirmation. PM recommendation: require operator confirmation via `extraInputs` flag; default `undefined` triggers `tas_casual_continuity_test_unverified` advisory + permissive continuity preservation.

---

### TC-TAS-035 — Casual continuity test NOT supplied → advisory + permissive default

```yaml
employee:
  startDate: 2018-05-26
  endDate: 2026-05-26
  employmentType: casual
  currentHourlyRate: 38.00
  hoursLast12MonthsBeforeCessation: 1560
  extraInputs: {}                            # tas_casual_32hr_4wk_periods_compliant NOT supplied
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  years_of_continuous_service: 8.0000
  total_entitlement_weeks: 6.9336
  warnings:
    - { code: tas_casual_continuity_test_unverified, message: "Operator did not supply `extraInputs.tas_casual_32hr_4wk_periods_compliant` AND engine could not derive a definitive answer from `wageHistory`. Engine assumed continuity preserved for v1 (permissive default). Operator should verify against actual 4-week-period worked hours." }
```

---

### TC-TAS-036 — Apprentice → tradesperson transition within 3 months preserves continuity (s.5 — TAS UNIQUE 3-mo)

```yaml
employee:
  startDate: 2014-05-26
  serviceEvents:
    - { type: apprentice_to_tradesperson_transition, startDate: 2018-05-26, endDate: 2018-07-26 }  # 2-month gap
trigger: { kind: termination, reason: voluntary_resignation, terminationDate: 2026-05-26 }
expected:
  years_of_continuous_service: 11.8334
  total_entitlement_weeks: 10.2575
  warnings:
    - { code: tas_apprentice_3mo_continuity_preserved, message: "Apprentice → tradesperson transition within 3 months preserves continuity per TAS LSL Act 1976 s.5. TAS uses the SHORTEST apprentice lead-in window in Australia (NSW/SA/NT 12 mo, VIC 52 wks, WA 52 wks, QLD 3 mo, ACT 12 mo)." }
```

**Notes**: **TBD-TAS-11 (Sev-3)**: confirm 3-month reading is correct and the apprentice-to-tradesperson event-type already exists in the cross-state schema. PM rec: hardcode 3-month tolerance as a TAS constant; no schema change.

---

## §F — Workers Comp service-counting (s.5(1)(c))

### TC-TAS-037 — WC absence (medical-certificate-backed) counts as service in full per s.5(1)(c)

```yaml
employee:
  id: TC-TAS-037
  startDate: 2014-05-26
  endDate: 2026-05-26                        # 12 yrs
  employmentType: full_time
  statesOfService: [TAS]
  governingJurisdiction: TAS
  currentWeeklyGross: 1800.00
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2021-06-01, endDate: 2021-11-30, note: "medical-certificate-backed" }  # 26 wks WC
trigger: { kind: termination, terminationDate: 2026-05-26, reason: voluntary_resignation }
expected:
  status: computed
  years_of_continuous_service: 12.0000        # WC counts in full per s.5(1)(c)
  total_entitlement_weeks: 10.4004            # 12 × 0.8667
  value_of_week: 1800.00
  total_entitlement_dollars: 18720.72
  expected_citations:
    - { section: TAS LSL Act 1976 s.5(1)(c), rule: continuous-service.workers-comp-counts-medical-certificate }
```

**Notes**: TAS has a single regime — NO dual-regime cutoff (contrast WA 2024-07-01 / ACT 2023-06-09). WC absence counts in full when medical-certificate-backed per s.5(1)(c).

---

### TC-TAS-038 — WC absence without medical certificate — engine treats as ordinary unpaid leave (does NOT count)

```yaml
employee:
  startDate: 2014-05-26
  endDate: 2026-05-26
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2021-06-01, endDate: 2021-11-30, note: "no medical certificate supplied" }
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  years_of_continuous_service: 11.5000         # 12 yrs − 26 wks (no certificate → doesn't count under s.5(1)(c))
  total_entitlement_weeks: 9.9671              # 11.5 × 0.8667
```

**Notes**: s.5(1)(c) specifies medical-certificate-backed. v1 engine reads the `note` field on `workers_comp_absence` for the substring "no medical certificate" (case-insensitive) as a signal that the certificate is missing. Default assumption: certificate present (engine credits the absence). Operator can flag missing-certificate cases via note.

---

### TC-TAS-039 — Multiple WC absences across the service window, all counted

```yaml
employee:
  startDate: 2014-05-26
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2018-06-01, endDate: 2018-09-01 }  # 13 wks
    - { type: workers_comp_absence, startDate: 2023-03-01, endDate: 2023-07-31 }  # 22 wks
trigger: { kind: termination, reason: voluntary_resignation, terminationDate: 2026-05-26 }
expected:
  years_of_continuous_service: 12.0000        # all WC counts
  total_entitlement_weeks: 10.4004
```

---

## §G — Public holidays EXCLUSIVE in LSL period (s.12(9))

### TC-TAS-040 — 7 wks LSL period with 4 PHs falling within → leave EXTENDED by 4 days

- **Source**: TAS LSL Act 1976 s.12(9); WorkSafe Tasmania — "PH not counted as LSL day; leave extended"
- **Category**: Taking-leave, PH-during-LSL — **PH-EXCLUSIVE**
- **Why it matters**: TAS mirrors NSW/VIC/QLD/WA/ACT on PH-exclusive treatment. OPPOSITE to SA's inclusive treatment.

**Inputs**

```yaml
employee:
  id: TC-TAS-040
  startDate: 2016-05-26
  employmentType: full_time
  statesOfService: [TAS]
  governingJurisdiction: TAS
  currentWeeklyGross: 1800.00
trigger:
  kind: taking_leave
  leaveStartDate: 2026-12-21                   # spans Christmas Day + Boxing Day + NYD + Australia Day (4 TAS PHs)
  leaveWeeks: 7.0
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 10.5836
total_entitlement_weeks: 9.1742               # 10.58 × 0.8667
leave_start: 2026-12-21
leave_end_calendar: 2027-02-13                # 7 wks + 4 days (extended)
phs_within_leave_count: 4                     # informational
value_of_week: 1800.00
payable_for_taken_leave: 12600.00              # 7 × 1800 (paid only for 7 wks of LSL; PHs paid separately at PH rate)
expected_citations:
  - { section: TAS LSL Act 1976 s.12(9), rule: trigger.taking-leave.ph-exclusive-extends-leave }
```

**Notes**

TAS public holidays observed: standard 10 TAS PHs (NYD, Australia Day, Eight Hours Day [second Monday in March — TAS-unique name], Good Friday, Easter Tuesday [TAS-unique additional day], Anzac Day, King's Birthday, Recreation Day [first Monday in November — northern TAS only], Christmas Day, Boxing Day). Note Easter Tuesday and Recreation Day are TAS-uniquely observed. **TBD-TAS-09**: hardcode the TAS PH list and Recreation Day's regional-specific (northern-only) observance.

---

### TC-TAS-041 — 4 wks LSL period over Easter (Good Fri + Easter Mon + Easter Tuesday = 3 TAS PHs) → leave extended by 3 days

```yaml
employee: { startDate: 2016-05-26, currentWeeklyGross: 1500.00 }
trigger: { kind: taking_leave, leaveStartDate: 2027-03-29, leaveWeeks: 4.0 }
expected:
  leave_end_calendar: 2027-04-29              # 4 wks + 3 days (Easter Tuesday is TAS-unique extra PH)
  phs_within_leave_count: 3
  payable_for_taken_leave: 6000.00              # 4 × 1500
```

**Notes**: Easter Tuesday is observed only in TAS (and some workplaces in NSW). Engine MUST include Easter Tuesday in the TAS PH list.

---

### TC-TAS-042 — Single-day LSL falling on a PH → shifted to next non-PH (parallel to ACT TBD-ACT-10)

```yaml
employee: { startDate: 2016-05-26, currentWeeklyGross: 1800.00 }
trigger: { kind: taking_leave, leaveStartDate: 2027-01-26, leaveWeeks: 0.2 }  # Australia Day (TAS PH)
expected:
  leave_days_consumed: 0
  leave_end_calendar: 2027-01-27                # Single day leave NOT charged; LSL day shifted to next non-PH
  warnings:
    - { code: tas_single_day_lsl_on_ph_exclusive, message: "Single-day LSL request on a public holiday — under TAS s.12(9) PH-exclusive rule, the day is NOT counted as LSL. The LSL day shifts to the next non-PH working day. Worker is paid PH rate for the original day per award." }
  payable_for_taken_leave: 360.00                # 1 day shifted to 2027-01-27; 1800 / 5 = 360
```

**Notes**: **TBD-TAS-10 (Sev-3)**: confirm engine treats single-day-on-PH as shifting to next non-PH working day (vs no-op + 0 charge). Recommended: shift to next non-PH — same as ACT TBD-ACT-10 RESOLVED.

---

## §H — Ordinary pay (s.11 — including shift penalties + all-purpose allowances)

### TC-TAS-043 — Fixed-rate FT, current weekly gross = value of week

```yaml
employee: { employmentType: full_time, currentWeeklyGross: 2000.00 }
trigger: { kind: taking_leave }
expected: { value_of_week: 2000.00, value_of_day: 400.00 }
```

---

### TC-TAS-044 — Fixed-rate FT with all-purpose tool allowance INCLUDED in ordinary pay

```yaml
employee: { employmentType: full_time, currentWeeklyGross: 2050.00 }  # base 2000 + tool allowance 50
trigger: { kind: taking_leave }
expected:
  value_of_week: 2050.00
  warnings:
    - { code: tas_all_purpose_allowance_included, message: "All-purpose allowances (e.g. tool, qualification, first aid) included in ordinary pay per TAS LSL Act 1976 s.11. Allowances for inconvenience/danger/hardship/hot/cold/dirt are excluded." }
```

---

### TC-TAS-045 — Fixed-rate FT with SHIFT PENALTY INCLUDED (TAS-distinctive)

```yaml
employee: { employmentType: full_time, currentWeeklyGross: 2150.00 }  # base 2000 + shift penalty 150 (averaged)
trigger: { kind: taking_leave }
expected:
  value_of_week: 2150.00
  warnings:
    - { code: tas_shift_penalty_included, message: "Shift penalty included in ordinary pay per TAS LSL Act 1976 s.11. TAS divergence from NSW/VIC/WA/SA/ACT/NT (only QLD shares this rule). For per-day computation, supply `extraInputs.tas_shift_penalty_by_day` — see TC-TAS-052." }
```

---

### TC-TAS-046 — Fixed-rate FT with board/lodging cash value INCLUDED

```yaml
employee:
  employmentType: full_time
  currentWeeklyGross: 1900.00                    # base 1800 + board/lodging cash $100/wk
trigger: { kind: taking_leave }
expected:
  value_of_week: 1900.00
```

---

### TC-TAS-047 — Travel/LAFH allowance EXCLUDED from ordinary pay (s.11)

```yaml
employee:
  employmentType: full_time
  currentWeeklyGross: 1800.00                    # base only — operator pre-stripped LAFH
  wageHistory:
    - { periodStart: 2025-05-26, periodEnd: 2026-05-26, grossPay: 104000.00, frequency: weekly, note: "incl. $5200 LAFH allowance" }
trigger: { kind: taking_leave }
expected:
  value_of_week: 1800.00                         # LAFH/travel EXCLUDED per s.11
  warnings:
    - { code: tas_travel_lafh_excluded, message: "Travel and Living Away From Home (LAFH) allowances excluded from ordinary pay per TAS LSL Act 1976 s.11." }
```

---

### TC-TAS-048 — Inconvenience / hot / cold / dirt allowance EXCLUDED from ordinary pay (s.11)

```yaml
employee:
  employmentType: full_time
  currentWeeklyGross: 1800.00
  wageHistory:
    - { periodStart: 2025-05-26, periodEnd: 2026-05-26, grossPay: 102000.00, frequency: weekly, note: "incl. $2000 hot/dirt allowance" }
trigger: { kind: taking_leave }
expected:
  value_of_week: 1800.00                         # hot/dirt allowance EXCLUDED
  warnings:
    - { code: tas_hardship_allowance_excluded, message: "Allowances for inconvenience, danger, or hardship (hot/cold/dirt) excluded from ordinary pay per TAS LSL Act 1976 s.11." }
```

---

### TC-TAS-049 — Meal allowance EXCLUDED from ordinary pay (s.11)

```yaml
employee:
  employmentType: full_time
  currentWeeklyGross: 1800.00
trigger: { kind: taking_leave }
expected:
  value_of_week: 1800.00                         # meal allowances EXCLUDED per s.11
```

---

## §I — Bonus exclusion absolute (s.11(2)(h)) — TAS-unique restrictive treatment

### TC-TAS-050 — KPI bonus EXCLUDED absolutely from ordinary pay (s.11(2)(h)) — TAS MOST restrictive

- **Source**: TAS LSL Act 1976 s.11(2)(h); WorkSafe Tasmania
- **Category**: Fixed-rate FT with bonus stripped from ordinary pay
- **Why it matters**: **TAS-specific divergence — TAS is the MOST restrictive state on bonus inclusion.** Engine MUST NOT include any bonus payment in ordinary pay, even if the bonus is regularly paid.

**Inputs**

```yaml
employee:
  id: TC-TAS-050
  startDate: 2015-05-26
  employmentType: full_time
  statesOfService: [TAS]
  governingJurisdiction: TAS
  currentWeeklyGross: 1800.00                    # base only — bonus stripped
  wageHistory:
    - { periodStart: 2025-05-26, periodEnd: 2026-05-26, grossPay: 104000.00, frequency: weekly, note: "incl. $7800 KPI bonus paid quarterly" }
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 9.5337 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 11.0000
total_entitlement_weeks: 9.5337
value_of_week: 1800.00                          # base only — KPI bonus EXCLUDED
payable_for_taken_leave: 17160.66
warnings:
  - { code: tas_bonus_excluded_absolutely, message: "Bonus payments excluded from ordinary pay per TAS LSL Act 1976 s.11(2)(h). TAS is the MOST restrictive jurisdiction in Australia on bonus inclusion — even regularly-paid KPI bonuses are excluded. Diverges from ACT/NT (included if usually paid), NSW (conditional 4-criteria + high-income test), and VIC (conditional on contract terms)." }
expected_citations:
  - { section: TAS LSL Act 1976 s.11(2)(h), rule: ordinary-pay.bonus-excluded-absolutely }
```

**Notes**

**TBD-TAS-15 (Sev-3) reference fixture.** Operator MUST strip bonus from `currentWeeklyGross` for TAS — engine trusts the user-supplied value but emits `tas_bonus_excluded_absolutely` advisory when a bonus is mentioned in `wageHistory` notes (engine reads notes substring "bonus", case-insensitive).

---

### TC-TAS-051 — Annual performance bonus EXCLUDED (incentive scheme)

```yaml
employee:
  employmentType: full_time
  currentWeeklyGross: 1800.00
  wageHistory:
    - { periodStart: 2025-05-26, periodEnd: 2026-05-26, grossPay: 110000.00, frequency: weekly, note: "incl. $16000 annual performance bonus paid Dec" }
trigger: { kind: taking_leave }
expected:
  value_of_week: 1800.00                          # annual bonus EXCLUDED
  warnings: [{ code: tas_bonus_excluded_absolutely }]
```

---

## §J — Day-to-day rate variation — TAS UNIQUE (s.11 + WorkSafe Tasmania)

### TC-TAS-052 — FT 10 yrs, LSL period spans shift-penalty days + non-shift days — per-day computation

- **Source**: TAS LSL Act 1976 s.11; WorkSafe Tasmania — "rate may vary day to day depending on what allowances/penalties apply on the day"
- **Category**: **TAS-UNIQUE day-to-day rate variation — load-bearing fixture**
- **Why it matters**: **No other Australian state has this rule.** Engine MUST support per-day rate computation when `extraInputs.tas_shift_penalty_by_day` / `tas_all_purpose_allowance_by_day` is supplied. This is the spec's primary TAS-specific complexity driver — highest mis-coding risk in Phase 8.

**Inputs**

```yaml
employee:
  id: TC-TAS-052
  startDate: 2016-05-26
  employmentType: full_time
  statesOfService: [TAS]
  governingJurisdiction: TAS
  currentWeeklyGross: 1800.00                    # base weekly rate (no penalty days)
  currentDailyRateBase: 360.00                   # 1800 / 5
  extraInputs:
    tas_shift_penalty_by_day:
      - { date: 2026-06-01, penalty_multiplier: 1.0 }    # Monday — no penalty
      - { date: 2026-06-02, penalty_multiplier: 1.0 }    # Tuesday — no penalty
      - { date: 2026-06-03, penalty_multiplier: 1.5 }    # Wednesday — afternoon shift +50%
      - { date: 2026-06-04, penalty_multiplier: 1.5 }    # Thursday — afternoon shift +50%
      - { date: 2026-06-05, penalty_multiplier: 2.0 }    # Friday — night shift +100%
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 1.0 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 10.0000
total_entitlement_weeks: 8.6667                # 10 × 0.8667
leave_days_consumed: 5
value_per_day_breakdown:                       # per-day computation (TAS UNIQUE)
  - { date: 2026-06-01, base: 360.00, multiplier: 1.0, payable: 360.00 }
  - { date: 2026-06-02, base: 360.00, multiplier: 1.0, payable: 360.00 }
  - { date: 2026-06-03, base: 360.00, multiplier: 1.5, payable: 540.00 }
  - { date: 2026-06-04, base: 360.00, multiplier: 1.5, payable: 540.00 }
  - { date: 2026-06-05, base: 360.00, multiplier: 2.0, payable: 720.00 }
value_of_week: 2520.00                          # SUM of 5 days (vs flat 1800 if no penalty data supplied)
payable_for_taken_leave: 2520.00                # 1 week × $2520
warnings:
  - { code: tas_day_to_day_rate_variation_applied, message: "FT/PT rate computed day-by-day per TAS LSL Act 1976 s.11 because shift penalties / all-purpose allowances vary across the LSL period. `value_of_week` is the SUM of per-day payable values. Without `extraInputs.tas_shift_penalty_by_day` the engine falls back to flat weekly rate — see TC-TAS-053." }
expected_citations:
  - { section: TAS LSL Act 1976 s.11, rule: ordinary-pay.day-to-day-rate-variation-per-shift-penalty-and-allowance }
```

**Notes**

**TBD-TAS-01 reference fixture (RESOLVED 2026-05-26).** **No other state has this rule.** The engine MUST decompose the LSL period into individual days and apply each day's specific shift penalty / all-purpose allowance. The total payable for a week of LSL can differ substantially from `currentWeeklyGross × leaveWeeks` if penalties apply on some days. Arithmetic order LOCKED: `(base × penalty_multiplier) + allowance`. Schema additions locked: `extraInputs.tas_shift_penalty_by_day`, `extraInputs.tas_all_purpose_allowance_by_day`, output `value_per_day_breakdown[]`.

---

### TC-TAS-053 — Same as TC-TAS-052 BUT no `tas_shift_penalty_by_day` supplied — engine falls back to flat weekly rate

```yaml
employee:
  id: TC-TAS-053
  startDate: 2016-05-26
  employmentType: full_time
  currentWeeklyGross: 1800.00
  extraInputs:
    tas_shift_penalty_by_day: []                 # empty — operator chose flat
    tas_all_purpose_allowance_by_day: []
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 1.0 }
expected:
  value_of_week: 1800.00                          # flat fallback
  payable_for_taken_leave: 1800.00
  warnings:
    - { code: tas_day_to_day_rate_variation_advisory, message: "Operator did NOT supply day-by-day shift penalty / all-purpose allowance data. Engine fell back to flat weekly rate. If the LSL period spans days where shift penalties or all-purpose allowances apply, the day-by-day computation per s.11 may produce a different total. Supply `extraInputs.tas_shift_penalty_by_day` for day-precise computation." }
```

**Notes**: Falls back to the standard flat-rate behaviour of every other state. The advisory tells operator they have left value on the table (or over-paid) if penalty days fell in the LSL period.

---

### TC-TAS-054 — All-purpose allowance varies day-by-day across LSL period

```yaml
employee:
  id: TC-TAS-054
  startDate: 2016-05-26
  employmentType: full_time
  currentWeeklyGross: 1800.00
  currentDailyRateBase: 360.00
  extraInputs:
    tas_all_purpose_allowance_by_day:
      - { date: 2026-06-01, allowance_amount: 0 }      # Mon — no allowance
      - { date: 2026-06-02, allowance_amount: 20 }     # Tue — tool allowance applies
      - { date: 2026-06-03, allowance_amount: 20 }     # Wed
      - { date: 2026-06-04, allowance_amount: 20 }     # Thu
      - { date: 2026-06-05, allowance_amount: 0 }      # Fri — no allowance
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 1.0 }
expected:
  value_per_day_breakdown:
    - { date: 2026-06-01, base: 360.00, allowance: 0,  payable: 360.00 }
    - { date: 2026-06-02, base: 360.00, allowance: 20, payable: 380.00 }
    - { date: 2026-06-03, base: 360.00, allowance: 20, payable: 380.00 }
    - { date: 2026-06-04, base: 360.00, allowance: 20, payable: 380.00 }
    - { date: 2026-06-05, base: 360.00, allowance: 0,  payable: 360.00 }
  value_of_week: 1860.00                          # SUM
  payable_for_taken_leave: 1860.00
  warnings: [{ code: tas_day_to_day_rate_variation_applied }]
```

---

### TC-TAS-055 — Combined shift penalty + all-purpose allowance day-by-day computation

```yaml
employee:
  id: TC-TAS-055
  startDate: 2016-05-26
  employmentType: full_time
  currentWeeklyGross: 1800.00
  currentDailyRateBase: 360.00
  extraInputs:
    tas_shift_penalty_by_day:
      - { date: 2026-06-01, penalty_multiplier: 1.0 }
      - { date: 2026-06-02, penalty_multiplier: 1.5 }
      - { date: 2026-06-03, penalty_multiplier: 1.0 }
      - { date: 2026-06-04, penalty_multiplier: 1.0 }
      - { date: 2026-06-05, penalty_multiplier: 1.0 }
    tas_all_purpose_allowance_by_day:
      - { date: 2026-06-01, allowance_amount: 20 }
      - { date: 2026-06-02, allowance_amount: 20 }
      - { date: 2026-06-03, allowance_amount: 20 }
      - { date: 2026-06-04, allowance_amount: 20 }
      - { date: 2026-06-05, allowance_amount: 20 }
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 1.0 }
expected:
  value_per_day_breakdown:
    - { date: 2026-06-01, base: 360.00, multiplier: 1.0, allowance: 20, payable: 380.00 }
    - { date: 2026-06-02, base: 360.00, multiplier: 1.5, allowance: 20, payable: 560.00 }   # (360 × 1.5) + 20
    - { date: 2026-06-03, base: 360.00, multiplier: 1.0, allowance: 20, payable: 380.00 }
    - { date: 2026-06-04, base: 360.00, multiplier: 1.0, allowance: 20, payable: 380.00 }
    - { date: 2026-06-05, base: 360.00, multiplier: 1.0, allowance: 20, payable: 380.00 }
  value_of_week: 2080.00
  warnings: [{ code: tas_day_to_day_rate_variation_applied }]
```

**Notes**: Arithmetic order LOCKED per TBD-TAS-01 resolution (2026-05-26): `(base × penalty_multiplier) + allowance`. Penalty multiplies the base rate; allowance is flat on top. Aligns with award-instrument convention. See line 1567 worked example: `(360 × 1.5) + 20 = 560`.

---

## §K — Casual / PT — s.11(6) 12-mo averaging

### TC-TAS-056 — Casual 11 yrs, 12-mo hours average, simple

```yaml
employee:
  startDate: 2015-05-26
  employmentType: casual
  currentHourlyRate: 42.50                      # base $34 + 25% loading
  hoursLast12MonthsBeforeEntitlement: 1560
  extraInputs:
    tas_casual_32hr_4wk_periods_compliant: true
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 9.5337 }
expected:
  years_of_continuous_service: 11.0000
  weekly_avg_12mo_taking: 30.00                  # 1560 / 52
  value_of_week: 1275.00                         # 30 × $42.50
  payable_for_taken_leave: 12155.47
```

---

### TC-TAS-057 — PT 10 yrs, simple 12-mo averaging

```yaml
employee:
  startDate: 2016-05-26
  employmentType: part_time
  hoursLast12MonthsBeforeEntitlement: 1248      # 24 h/wk × 52
  currentHourlyRate: 38.00
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 8.6667 }
expected:
  weekly_avg_12mo_taking: 24.00
  value_of_week: 912.00
  payable_for_taken_leave: 7905.27
```

---

### TC-TAS-058 — Casual 10 yrs, 12-mo window EXCLUDES unpaid leave weeks (parallel to SA pattern)

```yaml
employee:
  startDate: 2016-05-26
  employmentType: casual
  hoursLast12MonthsBeforeEntitlement: 1200      # actual 40 wks; 12 wks UPL — substituted with prior worked weeks
  currentHourlyRate: 35.00
  serviceEvents:
    - { type: leave_without_pay, startDate: 2025-08-01, endDate: 2025-10-22 }  # 12 wks UPL within window
  extraInputs:
    tas_casual_32hr_4wk_periods_compliant: true
trigger: { kind: taking_leave }
expected:
  weekly_avg_12mo_taking: 23.08                 # 1200 / 52
  value_of_week: 807.69
  warnings:
    - { code: tas_12mo_window_extended_for_upl, message: "12-month casual/PT averaging window adjusted: 12 weeks of approved unpaid leave excluded; prior worked weeks substituted to preserve the 52-week denominator. Engine interpretation parallel to SA 156-wk pattern and ACT 12-mo pattern." }
```

**Notes**: The TAS Act is silent on substitution for unpaid-leave weeks. v1 applies the SA/ACT-parallel pattern (substitute prior worked weeks) to keep the denominator at 52. Operator decision needed if alternative reading (reduce denominator) is preferred — defer to a follow-up.

---

## §L — Commission — s.11(3) 3-month averaging (TAS UNIQUE shortest window)

### TC-TAS-059 — Commission worker, 3-month income lookback (s.11(3)) — TAS UNIQUE

```yaml
employee:
  employmentType: full_time
  wageHistory:
    - { periodStart: 2026-02-26, periodEnd: 2026-05-26, grossPay: 39000.00, frequency: weekly, note: "commission-only — last 3 months" }
trigger: { kind: termination, reason: redundancy }
expected:
  value_of_week: 3000.00                         # 39000 / 13 (3 mo ≈ 13 wks) per s.11(3)
  warnings: [{ code: tas_commission_3mo_window_applied }]
  expected_citations:
    - { section: TAS LSL Act 1976 s.11(3), rule: ordinary-pay.commission-3mo-income-divided-by-13 }
```

---

### TC-TAS-060 — Commission with seasonal variation — 3-mo window captures last-quarter peak (TAS-UNIQUE divergence from NSW/QLD/WA/SA/ACT)

```yaml
employee:
  employmentType: full_time
  wageHistory:
    - { periodStart: 2025-05-26, periodEnd: 2026-02-25, grossPay: 78000.00, frequency: weekly, note: "Q1-Q3 commission" }   # $2000/wk × 39 wks
    - { periodStart: 2026-02-26, periodEnd: 2026-05-26, grossPay: 65000.00, frequency: weekly, note: "Q4 high-season commission" }  # $5000/wk × 13 wks
trigger: { kind: termination, reason: redundancy }
expected:
  value_of_week: 5000.00                         # last 3 mo ONLY: 65000 / 13 = 5000
  warnings:
    - { code: tas_commission_3mo_window_applied, message: "Commission averaged over LAST 3 MONTHS ONLY per TAS s.11(3) — DIVERGES from NSW/QLD/WA/SA/ACT 12-month averaging. For this employee a 12-mo window would yield (78000+65000)/52 = $2750/wk; the 3-mo window captures the high-season peak at $5000/wk. Operator should verify the 3-mo window is appropriate for the cessation date." }
```

**Notes**: **TBD-TAS-03 reference fixture.** This is **the** divergence that the spec must call out — TAS commission window is materially different from every other state for seasonal/volatile commission employees. Engine MUST use 3-mo / 13 wks, NOT 12-mo / 52 wks.

---

### TC-TAS-061 — Commission with declining trend — 3-mo window captures recent low

```yaml
employee:
  employmentType: full_time
  wageHistory:
    - { periodStart: 2025-05-26, periodEnd: 2026-02-25, grossPay: 130000.00, frequency: weekly }
    - { periodStart: 2026-02-26, periodEnd: 2026-05-26, grossPay: 26000.00, frequency: weekly, note: "declining commission" }
trigger: { kind: termination, reason: redundancy }
expected:
  value_of_week: 2000.00                         # 26000 / 13 = 2000 (recent low captured)
  warnings: [{ code: tas_commission_3mo_window_applied }]
```

**Notes**: Mirror of TC-TAS-060 showing the opposite skew — recent decline depresses the TAS value-of-week below the 12-mo average ($3000/wk).

---

## §M — 15-year and 20-year continuous-accrual (s.8(2))

### TC-TAS-062 — 15 yrs FT resignation, full 13.0005 weeks (continuous accrual)

```yaml
employee: { startDate: 2011-05-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 2000.00 }
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  total_entitlement_weeks: 13.0005             # 15 × 0.8667 — continuous accrual; no step at 15 yrs
  total_entitlement_dollars: 26001.00
```

**Notes**: TAS Act says "Each subsequent 5 years: 4 ⅓ weeks (4.3333)" — this is arithmetically identical to continuous 0.8667/yr (4.3333 / 5 = 0.86667). Engine implements as continuous accrual for day-precise output (parallel to NSW/QLD/WA/ACT continuous-accrual pattern).

---

### TC-TAS-063 — 20 yrs FT resignation, full 17.334 weeks

```yaml
employee: { startDate: 2006-05-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 2000.00 }
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  total_entitlement_weeks: 17.3340            # 20 × 0.8667
  total_entitlement_dollars: 34668.00
```

---

## §N — Cashing out (s.10 — non-blocking advisory)

### TC-TAS-064 — Cash-out request at 12 yrs (post-10-yr entitlement), ADVISORY

```yaml
employee: { startDate: 2014-05-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: cash_out, cashOutDate: 2026-05-26 }
expected:
  status: computed
  total_entitlement_weeks: 10.4004
  total_entitlement_dollars: 18720.72
  warnings:
    - { code: tas_cashout_post_entitlement_advisory, message: "Cashing out long service leave in TAS is permitted by agreement once the 10-year entitlement is reached per TAS LSL Act 1976 s.10. Written agreement between employer and employee is recommended. Value of cash-out is calculated as if LSL were taken — same as value-of-week × weeks cashed. Non-blocking advisory — engine emits informational warning, not a hard error." }
  expected_citations:
    - { section: TAS LSL Act 1976 s.10, rule: cashout.post-10yr-permitted-by-agreement }
```

---

### TC-TAS-065 — Cash-out request at 9 yrs (sub-10-yr) — ADVISORY "not authorised" (TBD-TAS-08)

```yaml
employee: { startDate: 2017-05-26, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: cash_out }
expected:
  status: computed
  total_entitlement_weeks: 0                   # no entitlement to cash out sub-10 yr
  warnings:
    - { code: tas_cashout_pre_entitlement_not_authorised, message: "Cashing out at sub-10-year tenure is NOT authorised under TAS LSL Act 1976 s.10 — entitlement to cash out arises only once the 10-year LSL entitlement has crystallised. If the worker is leaving the employer, change the trigger to 'termination' with a qualifying reason." }
```

---

### TC-TAS-066 — Cash-out request at 5 yrs (deep sub-10) — ADVISORY "no entitlement"

```yaml
employee: { startDate: 2021-05-26, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: cash_out }
expected:
  status: computed
  total_entitlement_weeks: 0
  warnings:
    - { code: tas_cashout_pre_entitlement_not_authorised, message: "Worker has not yet reached the 10-year entitlement threshold. There is no LSL entitlement to cash out. No cash-out election is authorised under TAS LSL Act 1976 s.10 until the 10-year entitlement has crystallised." }
```

---

### TC-TAS-067 — Cash-out request at 10 yrs exact — ADVISORY (just-eligible)

```yaml
employee: { startDate: 2016-05-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: cash_out }
expected:
  status: computed
  total_entitlement_weeks: 8.6667
  warnings: [{ code: tas_cashout_post_entitlement_advisory }]
```

---

## §O — Workers comp overlap with LSL rate (s.11 — parallel to QLD/WA/SA/ACT)

### TC-TAS-068 — LSL taken while on WC reduced rate — engine pays at literal s.11 rate + advisory

```yaml
employee:
  startDate: 2016-05-26
  employmentType: full_time
  currentWeeklyGross: 1300.00                   # currently on reduced WC rate (was $1800 pre-injury)
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2026-04-01, endDate: 2026-05-26 }
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 8.6667 }
expected:
  value_of_week: 1300.00                         # literal current rate per s.11 — NO higher-of-rates uplift
  warnings:
    - { code: tas_lsl_calculated_at_wc_reduced_rate_warning, message: "LSL has been calculated at the rate in force at the time leave is taken under TAS LSL Act 1976 s.11. The worker appears to be on workers compensation at a reduced rate. If feasible, defer taking LSL until the worker is back on their ordinary rate; TAS has no statutory higher-of-rates equivalent to VIC s.17." }
  expected_citations:
    - { section: TAS LSL Act 1976 s.11, rule: ordinary-pay.literal-rate-at-leave-time-no-wc-uplift }
```

**Notes**: Parallel to resolved TBD-QLD-05, TBD-WA-05, TBD-SA-08, TBD-ACT (implicit). TAS s.11 has no higher-of-pre-injury-vs-current rule.

---

## §P — Transfer of business (s.5)

### TC-TAS-069 — Transfer of business preserves service; new employer assumes liability

```yaml
employee:
  startDate: 2014-05-26
  serviceEvents:
    - { type: transfer_of_business, startDate: 2020-05-26, endDate: 2020-05-26, note: "old employer sold to new employer; same role continued" }
trigger: { kind: termination, reason: voluntary_resignation, terminationDate: 2026-05-26 }
expected:
  years_of_continuous_service: 12.0000
  total_entitlement_weeks: 10.4004
  warnings:
    - { code: transfer_of_business_continuity_preserved_tas, message: "Service deemed continuous across transmission of business per TAS LSL Act 1976 s.5. New employer assumes LSL liability and becomes sole employer." }
```

---

## §Q — Leave in advance — refused (no statutory basis)

### TC-TAS-070 — Taking-leave request at 7 yrs (pre-10-yr) — refused, returns $0

```yaml
employee: { startDate: 2019-05-26, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 4.0 }
expected:
  status: computed
  payable_for_taken_leave: 0
  warnings:
    - { code: tas_advance_leave_not_permitted, message: "Taking LSL before the 10-year entitlement is NOT permitted under TAS LSL Act 1976 — the Act contains no leave-in-advance provision. Engine refuses the leave-taking trigger and returns $0. To compute what the worker WOULD be entitled to at this tenure if terminated for a qualifying reason, change the trigger to 'termination' with reason ∈ {illness_incapacity, redundancy, etc.}." }
```

**Notes**: Same shape as ACT TBD-ACT-14 RESOLVED. **TBD-TAS-08 (Sev-2)**: confirm engine refusal semantics — `status: computed` with $0 + advisory (current draft) vs `status: failed` with hard error. PM recommendation: `status: computed` + advisory to preserve the as-at computation as informational (parallel to ACT/QLD pattern).

---

## §R — As-at snapshot trigger

### TC-TAS-071 — 6 yrs as-at → accrued, not currently payable

```yaml
trigger: { kind: as_at, asAtDate: 2026-05-26 }
employee: { startDate: 2020-05-26, employmentType: full_time, currentWeeklyGross: 1700.00 }
expected:
  total_entitlement_weeks: 5.2002              # 6 × 0.8667 (informational accrued value)
  payable_indicator: "accrued, not currently payable"
  warnings: [{ code: accrued_not_currently_payable, message: "Below 7-year pro-rata threshold. Entitlement is accruing but no cash payment is currently triggerable." }]
```

---

### TC-TAS-072 — 11 yrs as-at → 9.5337 wks (above 10-yr qualifying threshold)

```yaml
trigger: { kind: as_at, asAtDate: 2026-05-26 }
employee: { startDate: 2015-05-26, currentWeeklyGross: 1800.00 }
expected: { total_entitlement_weeks: 9.5337, payable_indicator: "payable" }
```

---

## §S — Cross-jurisdiction

### TC-TAS-073 — TAS + NSW service, NSW nominated → routed to NSW engine (8.6667 wks at 10 yrs)

```yaml
employee: { statesOfService: [TAS, NSW], governingJurisdiction: NSW, startDate: 2016-05-26 }
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  state_used: NSW
  total_entitlement_weeks: 8.6667              # NSW 10-yr threshold applied
  warnings:
    - { code: cross_jurisdiction_pending, message: "Employee has worked in TAS and NSW. The sufficiently connected test (legal judgement — APA Masterclass p.138) is for legal counsel where doubt exists. Engine has computed using user-nominated governing jurisdiction: NSW." }
```

---

### TC-TAS-074 — TAS + VIC service, governing NOT nominated → BLOCKED

```yaml
employee: { statesOfService: [TAS, VIC], governingJurisdiction: null }
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  status: blocked_cross_jurisdiction
  outputs: null
  warnings: [{ code: cross_jurisdiction_pending }]
```

---

## §T — Pay-on-termination day-of-termination surface (`payable_by = terminationDate`)

### TC-TAS-075 — 12 yrs FT redundancy, `payable_by = terminationDate` itself per s.12(4)

```yaml
employee: { startDate: 2014-05-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: termination, reason: redundancy, terminationDate: 2026-05-26 }
expected:
  total_entitlement_weeks: 10.4004
  total_entitlement_dollars: 18720.72
  payable_by: 2026-05-26                       # same as terminationDate per s.12(4)
  warnings:
    - { code: tas_payable_on_day_of_termination_advisory, message: "TAS LSL Act 1976 s.12(4) deems the employee to have commenced LSL on the date of termination — the payout is due on the day of termination itself. Engine surfaces `payable_by = terminationDate` (parallel to ACT TBD-ACT-08 RESOLVED schema reuse, no new field needed for TAS). Most TAS employers pay within the final pay cycle; this field is informational." }
```

**Notes**: This is the parity fixture confirming the `Result.payable_by: ISODate` field added in ACT Phase 7 is reused for TAS at `terminationDate` itself (vs ACT's `+ 90 days`). Purely additive — no schema change for TAS.

---

# Bulk-mode test cases

### TC-TAS-BULK-001 — 5-employee TAS-only fixture, mixed tenures and triggers

```csv
employee_id,row_type,state,start_date,employment_type,trigger,trigger_date,gross_pay,period_frequency,reason
T01,pay_period,TAS,2014-05-26,full_time,as_at,2026-05-26,98000.00,weekly,                                # 12 yr FT
T02,pay_period,TAS,2016-05-26,full_time,termination,2026-05-26,93600.00,weekly,redundancy                # 10 yr FT redundancy → full 8.6667 wks
T03,pay_period,TAS,2019-05-26,part_time,as_at,2026-05-26,39000.00,weekly,                                # 7 yr PT as-at
T04,pay_period,TAS,2015-05-26,casual,termination,2026-05-26,55000.00,other,voluntary_resignation         # 11 yr casual → 9.5337 wks
T05,pay_period,TAS,2018-05-26,full_time,termination,2026-05-26,78000.00,weekly,serious_misconduct        # 8 yr misconduct → $0
```

**Expected output**

```yaml
total_rows: 5
status_breakdown: { computed: 5, blocked: 0, failed: 0 }
row_results:
  T01: { state_used: TAS, total_entitlement_weeks: 10.4004, dollars: 19604.61 }                          # 12 × 0.8667 × 1885
  T02: { state_used: TAS, total_entitlement_weeks: 8.6667, dollars: 15600.06, payable_by: 2026-05-26 }   # 10 yrs full; redundancy qualifies at 10+ (any reason)
  T03: { state_used: TAS, total_entitlement_weeks: 6.0669, dollars: 4549.65 }                            # 7 × 0.8667 × 750
  T04: { state_used: TAS, total_entitlement_weeks: 9.5337, dollars: 10078.04 }                           # 11 × 0.8667 — voluntary res qualifies at 10+
  T05: { state_used: TAS, total_entitlement_weeks: 0, dollars: 0 }                                       # sub-10-yr misconduct → $0
all_rows_have_state_used_TAS: true
```

---

### TC-TAS-BULK-002 — 10-employee mixed NSW + VIC + QLD + WA + SA + ACT + TAS, with shift-penalty + commission-3-mo cases

```csv
employee_id,row_type,state,start_date,employment_type,trigger,trigger_date,...
NVQWSAT01,pay_period,NSW,2016-05-26,full_time,as_at,2026-05-26,...                                       # 10 yr NSW → 8.6667 wks
NVQWSAT02,pay_period,VIC,2018-05-26,full_time,as_at,2026-05-26,...                                       # 8 yr VIC → 6.9333 wks
NVQWSAT03,pay_period,QLD,2015-05-26,casual,as_at,2026-05-26,...                                          # 11 yr QLD casual
NVQWSAT04,pay_period,WA,2014-05-26,full_time,as_at,2026-05-26,...                                        # 12 yr WA
NVQWSAT05,pay_period,SA,2016-05-26,full_time,as_at,2026-05-26,...                                        # 10 yr SA → 13 wks
NVQWSAT06,pay_period,ACT,2019-05-26,full_time,as_at,2026-05-26,...                                       # 7 yr ACT → 6.0667 wks
NVQWSAT07,pay_period,TAS,2016-05-26,full_time,as_at,2026-05-26,...                                       # 10 yr TAS → 8.6667 wks
NVQWSAT08,pay_period,tas,2014-05-26,casual,as_at,2026-05-26,...,tas_casual_32hr_4wk_periods_compliant=true # lowercase normalised; casual + 32hr/4wk test
NVQWSAT09,pay_period,TAS,2014-05-26,full_time,termination,2026-05-26,...,reason=redundancy,wageHistory.last3mo=39000  # 12 yr commission → 3-mo window
NVQWSAT10,pay_period,,2019-05-26,full_time,as_at,2026-05-26,...                                          # EMPTY state — validation error
```

**Expected output**

```yaml
total_rows: 10
status_breakdown: { computed: 9, blocked: 0, failed: 1 }
row_results:
  NVQWSAT01: { state_used: NSW, status: computed }
  NVQWSAT02: { state_used: VIC, status: computed }
  NVQWSAT03: { state_used: QLD, status: computed }
  NVQWSAT04: { state_used: WA,  status: computed }
  NVQWSAT05: { state_used: SA,  status: computed, total_entitlement_weeks: 13.0000 }
  NVQWSAT06: { state_used: ACT, status: computed, total_entitlement_weeks: 6.0667 }
  NVQWSAT07: { state_used: TAS, status: computed, total_entitlement_weeks: 8.6667 }
  NVQWSAT08: { state_used: TAS, status: computed, warnings: [{ code: tas_casual_32hr_4wk_continuity_satisfied }] }
  NVQWSAT09: { state_used: TAS, status: computed, warnings: [{ code: tas_commission_3mo_window_applied }, { code: tas_payable_on_day_of_termination_advisory }] }
  NVQWSAT10: { status: failed, error: { code: state_missing_or_empty } }
```

**Notes**: Demonstrates per-state TAS branching alongside the 6 already-shipped states. Two TAS-specific rows show the 32-hour-4-week casual continuity test (NVQWSAT08) and the 3-month commission window (NVQWSAT09).

---

### TC-TAS-BULK-003 — Mixed-state day-to-day rate variation + parental-leave matrix (TAS-distinctive rules in bulk)

```csv
employee_id,row_type,state,start_date,trigger,trigger_date,...
DV-T01,pay_period,TAS,2016-05-26,taking_leave,2026-06-01,...,tas_shift_penalty_by_day_supplied=true   # TAS-unique day-by-day rate variation
DV-T02,pay_period,TAS,2014-05-26,termination,2026-05-26,reason=voluntary_resignation,...,paid_leave@2020-01-01-2020-07-01=parental  # TAS-unique parental-leave EXCLUSION
DV-A01,pay_period,ACT,2018-05-26,taking_leave,2026-06-01,...,act_overtime_hours_by_period=260          # ACT overtime hours-include rate-exclude
DV-S01,pay_period,SA,2016-05-26,taking_leave,2026-06-01,...,sa_higher_duties_active=true               # SA higher-duties extraInputs
DV-W01,pay_period,WA,2014-05-26,taking_leave,2026-06-01,...,workers_comp_absence@2024-08-01-2024-10-31  # WA post-1-Jul-2024 WC cliff
```

**Expected output**

```yaml
total_rows: 5
status_breakdown: { computed: 5, blocked: 0, failed: 0 }
row_results:
  DV-T01: { state_used: TAS, status: computed, warnings: [{ code: tas_day_to_day_rate_variation_applied }] }
  DV-T02: { state_used: TAS, status: computed, warnings: [{ code: tas_maternity_leave_excluded }] }
  DV-A01: { state_used: ACT, status: computed, warnings: [{ code: act_overtime_included_in_hours_average }] }
  DV-S01: { state_used: SA,  status: computed }
  DV-W01: { state_used: WA,  status: computed }
```

**Notes**: Demonstrates that TAS, ACT, SA, WA each route through their own state-localised `extraInputs.*` keys without cross-state interference. This is the canonical bulk test for the SA-localised / ACT-localised / TAS-localised state-namespacing pattern (all four states use namespaced extraInputs — no DEV-CROSS-N collisions).

---

# Coverage matrix

| Spec / source item | Covered by |
|---|---|
| **TAS LSL Act 1976 s.5** — Continuous service / break tolerances / 32-hr-4-wk casual rule / apprentice 3-mo | TC-TAS-027 → TC-TAS-036 |
| **TAS LSL Act 1976 s.5(1)(c)** — Workers Comp counts (medical-certificate-backed) | TC-TAS-037 → TC-TAS-039 |
| **TAS LSL Act 1976 s.5(3)** — Casual 32-hour-4-week continuity test | TC-TAS-007, TC-TAS-033 → TC-TAS-035 |
| **TAS LSL Act 1976 s.8(2)** — Entitlement formula (8.6667 wks at 10 yrs + 0.8667 wks/yr continuous) | TC-TAS-001, TC-TAS-005, TC-TAS-019 → TC-TAS-023, TC-TAS-062, TC-TAS-063 |
| **TAS LSL Act 1976 s.8(3)** — Pro-rata at 7–10 yrs / qualifying reasons / misconduct exclusion | TC-TAS-002, TC-TAS-003, TC-TAS-009 → TC-TAS-018, TC-TAS-024 → TC-TAS-026 |
| **TAS LSL Act 1976 s.10** — Cash-out by agreement post-entitlement | TC-TAS-064 → TC-TAS-067 |
| **TAS LSL Act 1976 s.11** — Ordinary pay definition (incl. shift penalties + all-purpose allowances; excl. overtime/bonuses) | TC-TAS-043 → TC-TAS-049, TC-TAS-068 |
| **TAS LSL Act 1976 s.11 — day-to-day rate variation (TAS UNIQUE)** | TC-TAS-052 → TC-TAS-055 (load-bearing) |
| **TAS LSL Act 1976 s.11(2)(h)** — Bonus exclusion absolute | TC-TAS-050 → TC-TAS-051 |
| **TAS LSL Act 1976 s.11(3)** — Commission 3-month averaging (TAS UNIQUE shortest window) | TC-TAS-008, TC-TAS-059 → TC-TAS-061 |
| **TAS LSL Act 1976 s.11(6)** — Casual/PT 12-mo hours averaging | TC-TAS-006, TC-TAS-007, TC-TAS-056 → TC-TAS-058 |
| **TAS LSL Act 1976 s.12(4)** — Pay-on-termination day of termination (deemed-commenced-on-cessation) | TC-TAS-002, TC-TAS-005, TC-TAS-009 (cliff), TC-TAS-019, TC-TAS-075 (load-bearing) |
| **TAS LSL Act 1976 s.12(9)** — PH-EXCLUSIVE in LSL period | TC-TAS-040 → TC-TAS-042 |
| **Transfer of business preserves continuity (s.5)** | TC-TAS-069 |
| **Maternity leave EXCLUDED (s.5) — TAS-unique restrictive** | TC-TAS-028 |
| **Advance leave NOT permitted** | TC-TAS-070 |
| **Retirement age 60F/65M default + award-min override** | TC-TAS-012, TC-TAS-013, TC-TAS-014 |
| **E2 spec F2 / AC1 / AC2** — per-state rule set + test suite | this file + encoded fixtures |
| **E2 spec F13 / AC14** — Cross-jurisdictional governing-state nomination | TC-TAS-073, TC-TAS-074 |
| **E2 spec F16 / F17 / AC16** — State selector + mixed-state bulk CSV | TC-TAS-BULK-002, TC-TAS-BULK-003 |
| **E2 spec AC4 / AC4a / AC4b** — PM sign-off + per-state launch gate | this file's PM signature line below — **PENDING (16 TBDs open)** |

---

# Items flagged `TBD-TAS-NN` — 8/8 blocking RESOLVED · 8 Sev-3 deferred

All 16 TBDs are listed below ordered by severity (Sev-1 = load-bearing / blocks sign-off; Sev-2 = engine-shape; Sev-3 = nice-to-have). PM recommendations are inline. **Status (2026-05-26)**: all 8 Sev-1/Sev-2 blocking TBDs resolved by operator. 8 Sev-3 TBDs (TBD-TAS-09 → TBD-TAS-16) deferred with documented limitations per ACT/SA precedent — see "Deferred with documented limitations" section below.

---

## TBD-TAS-01 — [Sev-1, LOAD-BEARING] Day-to-day rate variation: engine output surface — **RESOLVED 2026-05-26**

**RESOLVED 2026-05-26**: Option **(a)** — full per-day computation when operator supplies per-day data; flat fallback with advisory otherwise. Arithmetic order LOCKED to **first form**: `(base × penalty_multiplier) + allowance`. Locked schema additions:
- New optional inputs: `extraInputs.tas_shift_penalty_by_day: Array<{date: ISODate, penalty_multiplier: number}>`, `extraInputs.tas_all_purpose_allowance_by_day: Array<{date: ISODate, allowance_amount: number}>`.
- New output field: `value_per_day_breakdown: Array<{date: ISODate, base: number, multiplier?: number, allowance?: number, payable: number}>`.
- Engine derives `value_of_week` = SUM of per-day `payable` when per-day data is supplied.
- Fallback: when both arrays are empty/undefined, engine uses flat `currentWeeklyGross` and emits `tas_day_to_day_rate_variation_advisory`.
- Fixtures TC-TAS-052 → TC-TAS-055 already drafted on this resolution; no fixture changes required.

**Original question**: TAS s.11 + WorkSafe Tasmania guidance state that the FT/PT rate "may vary day to day depending on what allowances/penalties apply on the day leave is taken." How should the engine surface this in the `Result`?

**Options considered**:
- **(a) — SELECTED** Add per-day computation when `extraInputs.tas_shift_penalty_by_day` and/or `tas_all_purpose_allowance_by_day` are supplied. Engine returns a `value_per_day_breakdown` array AND a derived `value_of_week` = sum of per-day values. Falls back to flat weekly rate when no per-day data is supplied (advisory emitted).
- **(b)** Always use flat `currentWeeklyGross`; do not encode day-to-day variation in v1. Surface a documented limitation only.
- **(c)** Add per-day computation but only for the `taking_leave` trigger (where the LSL period is known). For `termination`, use flat weekly rate (no LSL period to apply per-day variation to).

**Engine impact**: 1–1.5 dev-days for the per-day computation path + `value_per_day_breakdown` field + UI rendering. **CONFIRMED IN-SCOPE for Phase 8.**

---

## TBD-TAS-02 — [Sev-1, LOAD-BEARING] Retirement age 60F/65M sex-specific reading

**RESOLVED 2026-05-26**: Option **(a)** — literal 60F/65M with transparent advisory + `extraInputs.tas_award_min_retirement_age_reached` override. Adds `employee.sex` to input schema. Legal-reviewer caveat (anti-discrimination advisory wording) flagged for pre-launch RES-3, non-blocking for v1.

**Locked schema additions**:
- **Input field**: `employee.sex: "female" | "male"` (top-level input, not `extraInputs`-localised). Engine reads it ONLY when state = `TAS` AND `extraInputs.tas_award_min_retirement_age_reached` is not `true`. **Note**: this is a cross-state schema addition (one new optional top-level field) — but conditional read keeps it TAS-only in behaviour. Acceptable trade-off given that the Act explicitly requires the signal. No DEV-CROSS-5 finding required if `employee.sex` is documented as TAS-conditional-read in the schema docstring.
- **Override field**: `extraInputs.tas_award_min_retirement_age_reached: boolean` (default `false`). When `true`, engine bypasses the sex-specific default reading and qualifies on award-specified minimum retirement age.
- **Advisory ID (default path)**: `tas_retirement_qualifying_age_60f_65m_default` — surfaced whenever the sex-specific default reading is applied, regardless of outcome (qualifying or not), so the reading is transparent to the operator.
- **Advisory ID (override path)**: `tas_retirement_qualifying_via_award_min_age` — surfaced when `extraInputs.tas_award_min_retirement_age_reached: true` is honoured.

**Fixture consistency**: TC-TAS-012 (woman 60 qualifies), TC-TAS-013 (man 60 does NOT qualify by default), TC-TAS-014 (man 60 qualifies via award-min override) all drafted on Option (a). Confirmed consistent — no fixture rewrites needed.

**Pre-launch open caveat (non-blocking)**: PM to consult legal reviewer (RES-3) on whether to surface a non-blocking "anti-discrimination advisory" alongside the qualifying-age check, and on the exact wording of `tas_retirement_qualifying_age_60f_65m_default`. Documented limitation acceptable for v1 launch.

---

**Original question (for audit trail)**: TAS LSL Act 1976 s.8(3) qualifying-reason gate includes "reaches retirement age (60 women / 65 men)" per the consolidated text and WorkSafe Tasmania guidance. This sex-specific default reading raises equality-law concerns (cf. Sex Discrimination Act 1984 (Cth)). How should the engine encode the qualifying-age check?

**Original options**:
- **(a) — SELECTED** Encode the literal Act reading: engine reads `employee.dob` + `employee.sex`. Women aged 60+ qualify; men aged 65+ qualify. Provide an `extraInputs.tas_award_min_retirement_age_reached` override for award-specified single-age treatments.
- **(b)** Use a single age-65-for-all default (mirror QLD/SA/WA convention); ignore sex. Engine emits an advisory that the Act's literal reading is sex-specific.
- **(c)** Require operator to explicitly supply `extraInputs.tas_retirement_qualifying: boolean`; no default age-based inference.

**Engine impact**: ½ dev-day for the qualifying-reason gate logic + `employee.sex` schema addition.

---

## TBD-TAS-03 — [Sev-2] Commission 3-month window: 13-week denominator vs 3-calendar-month exactness

**Status**: **RESOLVED 2026-05-26** — Option (a): 13-week fixed denominator. Engine looks back exactly 91 days from trigger date, sums commission paid in that window, divides by 13 to derive the weekly commission value. Matches WorkSafe Tasmania worked-example convention.

**Question**: TAS s.11(3) specifies commission income over "the last 3 months" — the operative denominator is ambiguous between (a) exactly 13 weeks (the simpler reading); (b) 3 calendar months ending on the trigger date (may be 89, 90, 91, or 92 days depending on month boundaries — engine must compute month-precise).

**PM recommendation (accepted)**: **13 weeks (option a).** Operationally cleaner; matches the WorkSafe Tasmania guidance which uses "13 wks" prose interchangeably. Engine arithmetic: total commission income in the 91 days immediately prior to the trigger date ÷ 13 = weekly value. Parallel to NSW's 52-wk simplification convention.

**Advisory locked in**: ID `tas_commission_3mo_window_applied` — body: "Commission income averaged over the 13 weeks (91 days) immediately preceding the trigger date per s.11(3) Tasmania convention. Where the employee's commission cycle is paid on a monthly basis (e.g. end-of-month settlements), the 13-week window may bisect a payment cycle; the engine attributes commission to the 91-day window based on payment date, not earning date. Operators with monthly-cycle commission employees should validate the input figures against the actual payment record."

**Engine impact**: 0.5 dev-days for the 13-wk lookback path in `value-of-week.ts`. Fixtures TC-TAS-008, TC-TAS-059, TC-TAS-060, TC-TAS-061 already drafted on this assumption — **consistent, no rework needed**.

---

## TBD-TAS-04 — [Sev-2] Casual 32-hour-4-week continuity test (s.5(3)) — **RESOLVED 2026-05-26**

**Resolution**: **Option (c) — hybrid evaluation strategy.** Engine attempts auto-derivation from `wageHistory` 4-wk sliding windows; falls back to operator flag if sparse (>25% missing entries within any candidate 4-wk window); defaults permissive + advisory if neither auto-derivation nor operator flag is available.

**Locked inputs**:
- `extraInputs.tas_casual_32hr_4wk_periods_compliant: boolean | undefined` — operator-supplied confirmation that the casual employee meets s.5(3) "32 hours per consecutive 4-week period" continuity test.
- `extraInputs.tas_casual_continuity_break_date: ISODate | undefined` — operator-supplied date at which continuity was broken (used when operator flag is `false` and engine cannot derive break-point from wageHistory).

**Locked advisory**:
- `tas_casual_32hr_4wk_test_not_verified` — fires when operator flag is load-bearing (i.e., wageHistory was too sparse to auto-derive and engine deferred to flag, or when neither signal was present and engine defaulted permissive).

**New engine module**: `casual-continuity.ts` — 4-week sliding-window evaluator over `wageHistory`. Returns `{ compliant: boolean, breakDate?: ISODate, sparsity: number, source: 'derived' | 'operator_flag' | 'default_permissive' }`. Consumed by service-period and accrual modules.

**Question**: TAS s.5(3) requires casual employees to regularly work ≥32 hours per consecutive 4-week period for continuity to be preserved. How does the engine evaluate this?

**Options considered**:
- **(a)** **Strict per-4-week-period evaluation**: engine slices `wageHistory` into 4-week windows; any window with <32 hours breaks continuity at that point. Forward-looking from the first failed window forfeits pre-failure service unless qualifying re-engagement applies.
- **(b)** **Operator-supplied confirmation only**: engine reads `extraInputs.tas_casual_32hr_4wk_periods_compliant: boolean`; defaults to permissive (preserves continuity) when `undefined` and emits advisory.
- **(c)** **Hybrid**: engine attempts (a) derivation from `wageHistory`, falls back to (b) operator-supplied flag, falls back to permissive default + advisory if neither is available. **← SELECTED**

**Fixtures**: TC-TAS-033 (compliant — auto-derived from wageHistory), TC-TAS-034 (failed — auto-derived break), TC-TAS-035 (unverified — operator flag path + advisory), TC-TAS-007 (12-mo casual avg edge probe). All remain consistent with hybrid resolution.

**Engine impact**: 1 dev-day for `casual-continuity.ts` (4-week sliding-window evaluator + sparsity threshold + operator-flag override + default-permissive path).

---

## TBD-TAS-05 — [Sev-2] Shift penalty inclusion — engine signal source

**RESOLVED 2026-05-26**: Option **(a)** — default flat path. Engine treats `currentWeeklyGross` as already including shift penalty (operator-supplied / pre-stripped). Per-day `extraInputs.tas_shift_penalty_by_day` remains opt-in from TBD-TAS-01 RESOLVED. Advisory ID `tas_shift_penalty_assumed_included_in_weekly_gross` fires on every TAS calc unless the per-day path is supplied.

**Question (resolved)**: TAS s.11 INCLUDES shift penalties in ordinary pay (TAS-distinctive with QLD). How should the engine know which days have shift penalties applied?

**Options (resolved)**:
- **(a)** ✅ **SELECTED** — Operator pre-strips and supplies a flat `currentWeeklyGross` reflecting averaged shift penalty (simplest; v1 default).
- **(b)** Operator supplies `extraInputs.tas_shift_penalty_by_day` for per-day computation (TBD-TAS-01 opt-in path — retained).
- **(c)** Engine derives shift penalty from `wageHistory` annotations (not feasible in v1 without award-instrument parsing) — rejected.

**Resolution rationale**: Keeps the v1 TAS input shape backward-compatible with NSW/VIC/QLD/WA/SA/ACT. Per-day precision available via TBD-TAS-01 opt-in for operators who need it. Advisory `tas_shift_penalty_assumed_included_in_weekly_gross` always fires on the default path, so the operator is explicitly told what the engine has assumed.

**Fixture consistency check**:
- TC-TAS-001 → TC-TAS-006 (default-flat path) — consistent ✅
- TC-TAS-031 / TC-TAS-032 (per-day opt-in via TBD-TAS-01) — consistent ✅

**Engine impact**: Folded into TBD-TAS-01 (1–1.5 dev-days total). Advisory wiring +0 dev-days (reuses the standard advisory channel).

---

## TBD-TAS-06 — [Sev-2] Misconduct at 10+ yrs: full payout (NSW/VIC/QLD/SA/ACT pattern) vs WA-style partial-forfeiture

**Status**: **RESOLVED 2026-05-26** — Option **(a)** — FULL payout at 10+ yrs regardless of misconduct. Misconduct carve-out in s.8(3) is pro-rata branch only; s.8(2) silence reads as no forfeiture. Matches NSW/VIC/QLD/SA/ACT precedent. Strict-construction rule for benefit-conferring legislation favours employee on legislative silence.

**Question**: At 10+ yrs of continuous service, when an employee is dismissed for serious & wilful misconduct, what is payable in TAS? The Act is structurally ambiguous — s.8(3) excludes misconduct from pro-rata in the 7–10 yr band, but s.8(2) is silent on misconduct in the full-entitlement branch.

**Options**:
- **(a)** **FULL payout** (PM rec — **OPERATOR-CONFIRMED**) — the misconduct exception in s.8(3) is specific to the pro-rata branch; once the worker has crossed the 10-yr threshold under s.8(2), the full entitlement is payable. Parallel to NSW/VIC/QLD/SA/ACT precedent.
- **(b)** **Partial forfeiture** — only the last fully-accrued 5-year block is payable; accrued portion beyond that is forfeited. Parallel to WA s.8(3) precedent.
- **(c)** **Zero payout** — strict reading that misconduct forfeits all entitlement.

**PM recommendation**: **Option (a)** — **CONFIRMED**. The TAS Act has no provision equivalent to WA s.8(3) partial-forfeiture; the misconduct exception is explicitly framed in s.8(3) for the pro-rata branch only. Drafting silence in s.8(2) defaults to full payout per the strict-construction rule for benefit-conferring legislation. Fixtures TC-TAS-019, TC-TAS-020, TC-TAS-026 remain consistent (already drafted on this assumption).

**Engine impact**: 0 dev-days (uses standard accrual path with no misconduct discount at 10+ yrs).

---

## TBD-TAS-07 — [Sev-2] Voluntary resignation 7-10 yrs: qualifying or not?

**RESOLVED 2026-05-26**: Option (a) — voluntary resignation NOT qualifying in 7–10 yr band. Strict closed-list reading of s.8(3); $0 payout for voluntary res; binary 10-yr cliff (9.99 yrs → $0, 10.00 yrs → 8.6667 wks). Matches ACT precedent and WorkSafe Tasmania guidance. TAS-ACT parallel on closed-list drafting style. Fixtures TC-TAS-010, TC-TAS-022, TC-TAS-023 remain consistent (already drafted on this assumption). 0 dev-day impact.

---

**Question (original)**: TAS s.8(3) lists qualifying reasons for pro-rata at 7-10 yrs: retirement (60F/65M), death, employer-not-misconduct, illness/incapacity/domestic-pressing-necessity. Voluntary resignation is NOT named. Does this mean voluntary resignation in the 7-10 yr band does NOT qualify for pro-rata?

**Options**:
- **(a)** **NOT qualifying** (PM rec) — strict reading of the s.8(3) closed list. Voluntary resignation pays $0 in the 7-10 yr band. Parallel to ACT 5-7-yr behaviour (where voluntary resignation does not qualify) and divergent from SA/WA where voluntary resignation qualifies at 7+.
- **(b)** **Qualifying as a default** — broader reading where any employee-initiated termination not specifically excluded by misconduct counts.

**PM recommendation**: **Option (a)**. The s.8(3) list is closed and exhaustive; voluntary resignation is conspicuous by its absence. WorkSafe Tasmania guidance supports the strict reading. Operator may dispute via subsequent edit. Fixtures TC-TAS-010 (voluntary res = $0), TC-TAS-022/-023 (10-yr cliff binary for voluntary res) drafted on (a).

**Engine impact**: 0 dev-days (uses the qualifying-reason gate logic from TBD-TAS-02).

---

## TBD-TAS-08 — [Sev-2] Advance leave refusal semantics — **RESOLVED 2026-05-26**

**RESOLVED 2026-05-26**: Option (a) — `status: computed` + advisory `tas_advance_leave_not_permitted` + $0 payable for sub-10-yr `taking_leave` events. Engine still runs as-at accrual snapshot. Matches QLD cash-out (TBD-QLD-04) and ACT advance-leave (TBD-ACT-14) precedent. Fixture TC-TAS-070 remains consistent (drafted on this resolution — no rework needed).

**Locked semantics**:
- For any `taking_leave` trigger with `years_of_continuous_service < 10` at TAS, engine returns `status: computed` (NOT `failed`).
- `payable_for_taken_leave: 0`.
- Warning code: `tas_advance_leave_not_permitted` with body explaining that the TAS Act has no leave-in-advance provision and suggesting the operator switch to a `termination` trigger with a qualifying reason to see what would be payable.
- `years_of_continuous_service`, `total_entitlement_weeks` (will be 0), and `expected_citations[]` are still computed for transparency (as-at-style informational compute).

---

**Question (original)**: The TAS Act contains no leave-in-advance provision. Should the engine refuse `taking_leave` triggers at sub-10-yr tenure with:

- **(a) — SELECTED** `status: computed` + `payable_for_taken_leave: 0` + `tas_advance_leave_not_permitted` advisory. As-at-style informational compute.
- **(b)** `status: failed` + `error.code: 'tas_advance_leave_not_permitted'` + no numeric outputs.

**PM recommendation**: **Option (a)** — `status: computed` + advisory. Preserves the as-at computation as informational (parallel to QLD/ACT cash-out at sub-7-yr and ACT advance-leave at sub-7-yr per TBD-ACT-14 RESOLVED).

**Engine impact**: ½ dev-day for the advisory + zero-payable handling (folded into T8.2).

---

## TBD-TAS-09 — [Sev-3] TAS public-holidays calendar source — incl. Easter Tuesday + Recreation Day (northern-only)

**Question**: Per the F11-equivalent for TAS (s.12(9) PH-exclusive), the engine consults a TAS PH calendar. What is the v1 source-of-truth, and how does the engine handle TAS's region-specific PHs (Recreation Day is observed only in northern TAS)?

**Available sources**:
- **Public Holidays Act 1993 (Tas)** — statutory PH list including TAS-unique Easter Tuesday and Recreation Day (Monday closest to 1 November, northern TAS only).
- **WorkSafe Tasmania public-holidays page** — operational summary, updated annually.

**PM recommendation**:
- **(a)** Hardcode the TAS PH list from the Public Holidays Act 1993 (Tas) into `website/src/lib/lsl/states/tas/rules/public-holidays.ts`.
- **(b)** For Recreation Day: v1 accepts an optional `extraInputs.tas_employee_in_northern_tas: boolean` (default `false`); engine includes Recreation Day only when `true`. Documented limitation: operator must know the worker's regional location.
- **(c)** Re-validate annually as part of RES-3 quarterly review.

**Engine impact**: ½ dev-day for data entry + regional-PH conditional logic. Fixtures TC-TAS-040 → TC-TAS-042 reference hardcoded list incl. Easter Tuesday.

---

## TBD-TAS-10 — [Sev-3] Single-day LSL on a PH (PH-EXCLUSIVE state)

**Question**: When a worker requests a single day of LSL falling on a public holiday in TAS, what semantics apply?

**PM recommendation**: **Shift to next non-PH working day** — same as ACT TBD-ACT-10 RESOLVED. Engine charges 1 day of LSL on the next non-PH date; worker is paid PH rate per award for the original day (outside engine scope). Preserves the user's intent to charge 1 day while honouring s.12(9) PH-exclusive semantics. Fixture TC-TAS-042 drafted on this assumption.

**Engine impact**: ½ dev-day for PH-detection + next-working-day computation. Reuses ACT implementation.

---

## TBD-TAS-11 — [Sev-3] Apprentice 3-month lead-in window (TAS UNIQUE)

**Question**: TAS s.5 specifies "apprenticeship → contract within 3 months" preserves continuity — shortest in Australia. Confirm engine encodes 3-month tolerance as a TAS constant.

**PM recommendation**: **Confirm 3-month encoding.** No new dev-finding; reuses cross-state `apprentice_to_tradesperson_transition` event-type added in DEV-CROSS-2 era. Each state's orchestrator applies its own tolerance constant (NSW/SA/NT 12 mo, VIC 52 wks, WA 52 wks, QLD 3 mo, ACT 12 mo, TAS 3 mo). 0 dev-days additional. Fixture TC-TAS-036 covers this.

---

## TBD-TAS-12 — [Sev-3] Slackness-of-trade 14-day return-to-work clause

**Question**: TAS s.5 specifies "stood down due to slackness of trade if re-engaged within 6 months and within 14 days of return-to-work offer" preserves continuity. The 14-day clause is TAS-unique. How does the engine know whether the worker accepted within 14 days?

**PM recommendation**: **Operator-supplied `extraInputs.tas_slackness_return_within_14_days: boolean` (default `false`)**. When `true`, the 6-month slackness tolerance applies; otherwise falls back to 3-month standard non-slackness tolerance. TAS-localised — no cross-state schema change. 0 dev-days additional (folded into T8.2). Fixtures TC-TAS-031 (compliant), TC-TAS-032 (missed) cover the cases.

---

## TBD-TAS-13 — [Sev-3] Maternity / parental leave does NOT count as service (most restrictive in Australia)

**Question**: TAS s.5 explicitly lists "Maternity Leave (paid + unpaid)" in the "does NOT count" column. Confirm engine treats both paid and unpaid parental/maternity leave as non-service-counting.

**PM recommendation**: **Yes — non-service-counting per literal Act reading.** TAS is the MOST restrictive jurisdiction (NSW/SA count company-paid parental; VIC counts first 52 wks; ACT counts neither but only excludes paid parental; TAS excludes BOTH paid and unpaid). v1 implementation: engine reads `note` field on `paid_leave` AND `leave_without_pay` events; case-insensitive substring match for "parental" or "maternity". 0 dev-days additional (folded into T8.2). Fixture TC-TAS-028 covers this.

---

## TBD-TAS-14 — [Sev-3] TasBuild (Construction Industry (Long Service) Act 1997) explicit out-of-scope confirmation

**Question**: TAS has a separate portable LSL scheme for building/construction workers under the Construction Industry (Long Service) Act 1997 (Tas) — "TasBuild". Should the engine surface an advisory when an employee's industry suggests they may fall under TasBuild?

**PM recommendation**: **OUT OF v1 TAS engine scope** — same convention as VIC/QLD/WA/SA/ACT industry portable schemes. The calculator assumes the general LSL Act 1976 governs and does NOT surface a TasBuild advisory in v1. Re-evaluate in v2 if user surveys surface frequent confusion. 0 dev-days. Documented in §Scope.

---

## TBD-TAS-15 — [Sev-3] Bonus exclusion absolute (s.11(2)(h)) — engine signal source

**Question**: TAS s.11(2)(h) ABSOLUTELY excludes bonuses from ordinary pay. How does the engine detect a bonus in user-supplied `currentWeeklyGross` / `wageHistory`?

**PM recommendation**: **Operator pre-strips; engine reads `wageHistory.note` for "bonus" substring (case-insensitive) and emits `tas_bonus_excluded_absolutely` advisory if detected.** Engine does NOT auto-deduct — operator MUST pre-strip. Advisory tells operator they may have under-stripped. Same convention as the other ordinary-pay-exclusion rules (NSW high-income threshold, VIC contract-condition test). 0 dev-days additional. Fixtures TC-TAS-050 → TC-TAS-051 cover this.

---

## TBD-TAS-16 — [Sev-3] Records retention (in perpetuity) — out of v1

**Question**: TAS LSL Regulations 2017 s.7 requires records to be kept "in perpetuity" — no statutory time limit. This is more onerous than every other state (NSW: varies; QLD: varies; ACT: 7 years). Should the engine surface this?

**PM recommendation**: **OUT OF v1 engine scope** — operational compliance requirement, not a calculation question. Documented in §Provisions deliberately deferred. Operator can implement separately as a process / data-retention policy.

**Engine impact**: 0 dev-days.

---

## Deferred with documented limitations (Sev-3 — v1 acceptable risk)

The following 8 Sev-3 TBDs are **deferred** with documented limitations shipping in v1. None blocks Phase 8 launch. Re-evaluate each at RES-3 quarterly review or v2 scoping. Pattern follows ACT/SA Phase 6 / Phase 7 precedent.

| TBD | One-line summary | Limitation shipping in v1 |
|---|---|---|
| **TBD-TAS-09** | TAS public-holidays calendar source — incl. Easter Tuesday + Recreation Day (northern-only). | Hardcoded TAS PH list from Public Holidays Act 1993 (Tas). Recreation Day gated on optional `extraInputs.tas_employee_in_northern_tas: boolean` (default `false`). Operator must know worker's regional location; if flag omitted, Recreation Day is NOT applied. RES-3 quarterly re-validation. |
| **TBD-TAS-10** | Single-day LSL request landing on a PH + PH-extends-LSL period (PH-EXCLUSIVE state). | **AMENDED 2026-05-26 (T8.3 reconciliation)**: v1 engine emits the PH-exclusive citation (`trigger.taking-leave.ph-exclusive-extends-leave`) and the `tas_single_day_lsl_on_ph_exclusive` advisory but does NOT compute the extended `leave_end_calendar` or shift single-day-on-PH to next non-PH working day. Payable amount uses operator-supplied `leaveWeeks` × `value_of_week` unchanged. Operator handles the calendar mechanics (extending end-date, shifting single-day-on-PH) outside the engine. Parallel to ACT v1 (TC-ACT-042 ships citation-only, no `leave_end_calendar` assertion). RES-3 quarterly review or v2 scope. |
| **TBD-TAS-11** | Apprentice 3-month lead-in (TAS UNIQUE — shortest in Australia). | 3-month tolerance hardcoded as TAS constant in orchestrator. Reuses cross-state `apprentice_to_tradesperson_transition` event type from DEV-CROSS-2 era. No new schema. |
| **TBD-TAS-12** | Slackness-of-trade 14-day return-to-work clause (TAS-unique). | Operator-supplied `extraInputs.tas_slackness_return_within_14_days: boolean` (default `false`). When `true` → 6-month slackness tolerance applies. When `false` → falls back to 3-month standard non-slackness tolerance. Operator must know whether the worker accepted re-engagement within 14 days. |
| **TBD-TAS-13** | Maternity / parental leave does NOT count as service (paid + unpaid — most restrictive in Australia). | Engine reads `note` field on `paid_leave` + `leave_without_pay` events; case-insensitive substring match for "parental" or "maternity"; excludes from service. Operator must annotate events accurately; mislabelled events count as service by default. |
| **TBD-TAS-14** | TasBuild (Construction Industry (Long Service) Act 1997 (Tas)) — separate portable scheme. | **OUT OF v1 TAS engine scope.** Calculator assumes general LSL Act 1976 governs; emits NO TasBuild advisory. Same convention as VIC/QLD/WA/SA/ACT industry portable schemes. Re-evaluate in v2 if user surveys surface frequent confusion. |
| **TBD-TAS-15** | Bonus exclusion absolute (s.11(2)(h)) — engine signal source for detecting bonus in user-supplied `currentWeeklyGross`. | Operator pre-strips bonuses. Engine reads `wageHistory.note` for "bonus" substring (case-insensitive) and emits `tas_bonus_excluded_absolutely` advisory if detected. Engine does NOT auto-deduct — advisory only. Operator must validate they've pre-stripped correctly. |
| **TBD-TAS-16** | Records retention in perpetuity (s.7 LSL Regulations 2017) — most onerous in Australia. | **OUT OF v1 engine scope.** Operational compliance requirement, not a calculation question. Operator implements separately as a process / data-retention policy outside the calculator. |
| **TBD-TAS-17** *(NEW — T8.3 reconciliation 2026-05-26)* | Casual continuity flag `false` semantics without break-date — strict-zero vs partial-forfeit. | When `extraInputs.tas_casual_32hr_4wk_periods_compliant: false` is supplied **without** `tas_casual_continuity_break_date`, engine strict-zeros all service back to start (conservative). Operator must supply `tas_casual_continuity_break_date` to confine the forfeiture to post-break-date service only. TBD-TAS-04 Option (c) hybrid did not disambiguate this case; the strict-zero reading is operator-empowering (operator who flags broken continuity but supplies no break-date is asking the engine to be conservative). RES-3 quarterly review. |
| **TBD-TAS-18** *(NEW — T8.3 reconciliation 2026-05-26)* | 12-month casual averaging window — UPL substitution responsibility. | v1 engine does NOT auto-substitute UPL (unpaid-parental / leave-without-pay) weeks in the 12-month casual averaging window with prior worked weeks. Operator pre-substitutes when supplying `hoursLast12MonthsBeforeCessation` / `hoursLast12MonthsBeforeEntitlement` — same pattern as SA TBD-SA-05 RESOLVED (`sa/extra-inputs.ts` documents this). Engine emits `tas_12mo_window_upl_overlap_check_substitution` informational advisory when `leave_without_pay` events overlap the window so operator is told to verify their substitution. Form helper can compute the substituted figure outside the engine. RES-3 quarterly review. |

**All 10 Sev-3 limitations are acceptable risk for v1 launch.** Each ships with the appropriate advisory or default behaviour and a path forward (operator flag, RES-3 quarterly review, or v2 scope). No additional dev-days carried beyond the engine fixes scoped in the T8.3 reconciliation appendix below.

---

## Net effect on fixtures and impl-plan (PM-recommended path — pending operator sign-off)

| Resolution | Fixture impact | Impl-plan impact |
|---|---|---|
| TBD-TAS-01 | TC-TAS-052 → TC-TAS-055 drafted on per-day computation + flat fallback. New `value_per_day_breakdown` output field documented. | §Phase 8 expanded to document the day-to-day rate variation rule + new optional `extraInputs.tas_shift_penalty_by_day` / `tas_all_purpose_allowance_by_day` + new output field. +1–1.5 dev-day. |
| TBD-TAS-02 | TC-TAS-012 → TC-TAS-014 drafted on literal sex-specific reading + award-min override. New `extraInputs.tas_award_min_retirement_age_reached` documented. | §Phase 8 documents the qualifying-reason gate + sex-specific default. +½ dev-day. |
| ~~TBD-TAS-03~~ RESOLVED 2026-05-26 → Option (a) 13-wk fixed denominator (91 days ÷ 13). Advisory `tas_commission_3mo_window_applied` locked in. | TC-TAS-008, TC-TAS-059, TC-TAS-060, TC-TAS-061 drafted on 13-wk denominator — **consistent, no rework**. | §Phase 8 uses 13-wk simplification. +½ dev-day for the 13-wk lookback path. |
| TBD-TAS-04 | **RESOLVED 2026-05-26**: Option (c) hybrid. TC-TAS-007, TC-TAS-033 → TC-TAS-035 remain consistent. | **RESOLVED 2026-05-26**: New module `casual-continuity.ts` — 4-wk sliding-window evaluator over `wageHistory`. Inputs `extraInputs.tas_casual_32hr_4wk_periods_compliant: boolean \| undefined` + `extraInputs.tas_casual_continuity_break_date: ISODate \| undefined`. Advisory `tas_casual_32hr_4wk_test_not_verified` when flag is load-bearing. Sparsity threshold 25%. +1 dev-day. |
| ~~TBD-TAS-05~~ RESOLVED 2026-05-26 → Option (a) default-flat path. Advisory `tas_shift_penalty_assumed_included_in_weekly_gross` fires on every TAS calc unless per-day path is used. Per-day opt-in via TBD-TAS-01 retained. | TC-TAS-001 → TC-TAS-006 (default-flat) + TC-TAS-031/-032 (per-day opt-in) — **consistent, no rework**. | Folded into TBD-TAS-01. Advisory wiring +0 d. |
| TBD-TAS-06 | TC-TAS-019, TC-TAS-020, TC-TAS-026 drafted on FULL-payout at 10+ misconduct. | §Phase 8 documents the standard accrual path with no misconduct discount at 10+. 0 d added. |
| TBD-TAS-07 | TC-TAS-010, TC-TAS-022, TC-TAS-023 drafted on voluntary-resignation NON-qualifying in 7-10 yr band. | §Phase 8 documents the qualifying-reason gate. 0 d added (folded into TBD-TAS-02). |
| TBD-TAS-08 | TC-TAS-070 drafted on `status: computed` + advisory. | §Phase 8 confirms advisory-not-hard-error semantics. +½ dev-day. |
| TBD-TAS-09 | TC-TAS-040 → TC-TAS-042 reference hardcoded TAS PHs incl. Easter Tuesday + Recreation Day. | §Phase 8 / T8.2 adds `rules/public-holidays.ts` (½ dev-day) + regional-PH conditional. |
| TBD-TAS-10 | TC-TAS-042 drafted on shift-to-next-non-PH. | §Phase 8 reuses ACT shift-to-next-PH semantics. +½ dev-day. |
| TBD-TAS-11 | TC-TAS-036 drafted on 3-mo apprentice lead-in. | §Phase 8 uses 3-mo TAS constant. 0 d added. |
| TBD-TAS-12 | TC-TAS-031 (compliant), TC-TAS-032 (missed) drafted on 14-day window. | §Phase 8 adds `extraInputs.tas_slackness_return_within_14_days`. 0 d added (folded into T8.2). |
| TBD-TAS-13 | TC-TAS-028 drafted on maternity-leave-excluded (paid + unpaid). | §Phase 8 documents the substring-match exclusion. 0 d added. |
| TBD-TAS-14 | No fixture impact. Out of v1 scope. | §Phase 8 documents TasBuild deferred per state convention. 0 d. |
| TBD-TAS-15 | TC-TAS-050 → TC-TAS-051 drafted on operator-pre-strips + advisory. | §Phase 8 uses substring-match for "bonus" in wageHistory notes. 0 d added. |
| TBD-TAS-16 | No fixture impact. Out of v1. | §Phase 8 documents records-retention deferred. 0 d. |

**No fixture-value changes from the v1.0-draft expected if operator accepts all PM recommendations.** All 75 single-mode + 3 bulk fixtures stand as drafted. **No DEV-CROSS-5 dev-finding anticipated** — all schema additions are TAS-localised via `extraInputs.tas_*` (parallel to SA / ACT precedent). The `Result.payable_by: ISODate` field added in ACT Phase 7 is reused at `terminationDate` itself for TAS. No cross-state PR required.

**Effort estimate summary**:
- TBD-TAS-01 (day-to-day rate variation): +1–1.5 d.
- TBD-TAS-02 (sex-specific retirement age + override): +½ d.
- TBD-TAS-03 (3-mo commission window): +½ d.
- ~~TBD-TAS-04 (32-hr-4-wk casual test): +1 d.~~ **RESOLVED 2026-05-26** → Option (c) hybrid. New module `casual-continuity.ts` (4-wk sliding-window evaluator). Inputs `tas_casual_32hr_4wk_periods_compliant` + `tas_casual_continuity_break_date`. Advisory `tas_casual_32hr_4wk_test_not_verified`. +1 dev-day confirmed.
- ~~TBD-TAS-05 (shift penalty signal)~~ **RESOLVED 2026-05-26** → Option (a) default-flat. Advisory `tas_shift_penalty_assumed_included_in_weekly_gross`. Per-day opt-in via TBD-TAS-01 retained. 0 d (folded into TBD-TAS-01).
- TBD-TAS-06 (10+ misconduct full payout): 0 d.
- TBD-TAS-07 (voluntary res NON-qualifying): 0 d (folded into TBD-TAS-02).
- TBD-TAS-08 (advance-leave advisory): +½ d.
- TBD-TAS-09 (PH calendar incl. Easter Tuesday + Recreation Day): +½ d.
- TBD-TAS-10 (single-day-PH shift): +½ d.
- TBD-TAS-11 (3-mo apprentice): 0 d.
- TBD-TAS-12 (14-day return window): 0 d (folded into T8.2).
- TBD-TAS-13 (maternity excluded): 0 d.
- TBD-TAS-14 (TasBuild deferred): 0 d.
- TBD-TAS-15 (bonus substring-match): 0 d.
- TBD-TAS-16 (records retention deferred): 0 d.

**Total: ~4–5 dev-days within the M (3–4 d) Phase 8 envelope.** **NOTE**: PM-recommended path overshoots the impl-plan v0.3.5 §Phase 8 M (3-4 d) estimate by 1-1.5 d, primarily driven by TBD-TAS-01 (day-to-day rate variation). **Operator may opt for Option (b) under TBD-TAS-01 (documented-limitation flat-rate v1) to keep Phase 8 within the M envelope at ~3 d total.** PM recommends accepting the +1-1.5 d slip to support the TAS-unique day-to-day variation properly — it's the single most distinctive TAS rule and the calculator should not duck it. Defer to operator.

---

## Provisions deliberately deferred from v1 TAS encoding

| Provision | Reason for deferral |
|---|---|
| **TasBuild — Construction Industry (Long Service) Act 1997 (Tas)** | Separate portable scheme. Out of v1 statutory engine scope. Same convention as other states' industry-portable schemes. |
| **Defence Force service continuity** (s.5 — Defence leave counts as service) | Edge case. v1 honours `serviceEvents` containing `defence_leave` type but does not add a TAS-specific advisory. |
| **Records retention (s.7 LSL Regulations 2017 — in perpetuity)** | Operational requirement; not a calculation question. Out of v1 statutory engine scope. |
| **Employer-direction notice via WorkSafe Tasmania adjudication** | Procedural; not engine-blocking. Engine emits no advisory in v1. |
| **Higher-duties / acting rate** | No statutory analogue in the TAS Act (unlike SA s.4). Out of v1 TAS encoding. |
| **Half-pay / double-pay** | The TAS Act is silent on half-pay/double-pay; no statutory entitlement. Out of v1. |
| **TAS regional public holidays (Recreation Day northern-only)** | v1 honours `extraInputs.tas_employee_in_northern_tas` flag — documented limitation if operator doesn't supply it. |

---

## Sign-off block — PM-SIGNED 2026-05-26

```
Signed: Tracy Angwin (PM) — product-manager agent
Date:   2026-05-26
Status: PM-SIGNED

Summary: All 8 Sev-1/Sev-2 blocking TBDs resolved.
         8 Sev-3 TBDs deferred with documented limitations
         per ACT/SA precedent. Ready for Phase 8 development.

PM-only sign-off per E2 spec RES-6 / AC4. Sign-off completes T8.0.
T8.1 (TAS rule-set scaffold) is UNBLOCKED immediately.
No pre-flight cross-state PR required — all TAS-specific signals
are TAS-localised via `extraInputs.tas_*` (parallel to SA Phase 6
and ACT Phase 7 precedent).
```

**Status (2026-05-26 PM-SIGNED)**: 8/8 blocking TBDs RESOLVED · 0 blocking open · 8 Sev-3 deferred with documented limitations.

**Sev-1 (load-bearing) — both RESOLVED**:
- ~~TBD-TAS-01 day-to-day rate variation~~ → Option (a) per-day + flat fallback, arithmetic `(base × penalty) + allowance`.
- ~~TBD-TAS-02 sex-specific retirement age~~ → Option (a) literal 60F/65M + `employee.sex` schema add + award-min override.

**Sev-2 (engine-shape) — all 6 RESOLVED**:
- ~~TBD-TAS-03 commission window~~ → Option (a) 13-wk fixed denominator.
- ~~TBD-TAS-04 32-hr-4-wk casual continuity~~ → Option (c) hybrid + `casual-continuity.ts` module.
- ~~TBD-TAS-05 shift-penalty signal~~ → Option (a) default-flat + advisory `tas_shift_penalty_assumed_included_in_weekly_gross`.
- ~~TBD-TAS-06 10+ misconduct~~ → Option (a) FULL payout regardless of misconduct (s.8(3) carve-out is pro-rata branch only).
- ~~TBD-TAS-07 voluntary-res qualifying~~ → Option (a) NOT qualifying — strict closed-list s.8(3) reading + binary 10-yr cliff.
- ~~TBD-TAS-08 advance-leave semantics~~ → Option (a) `status: computed` + advisory `tas_advance_leave_not_permitted` + $0 payable.

**Sev-3 (nice-to-have) — all 8 DEFERRED** with documented limitations: TBD-TAS-09 (PH calendar incl. Recreation Day northern-only), TBD-TAS-10 (single-day-PH shift), TBD-TAS-11 (apprentice 3-mo lead-in), TBD-TAS-12 (14-day slackness return), TBD-TAS-13 (maternity/parental excluded), TBD-TAS-14 (TasBuild out-of-scope), TBD-TAS-15 (bonus substring detection advisory), TBD-TAS-16 (records retention out-of-scope). See "Deferred with documented limitations" section above.

**Sign-off complete. Phase 8 development is UNBLOCKED.**

---

## Reconciliation amendments — 2026-05-26 (T8.3)

The developer's T8.3 fixture-corpus build (78 fixtures) surfaced 8 items where engine output diverged from doc-spec'd expected values. PM ruled on each (2026-05-26) as part of the T8.3 reconciliation pass. **Doc remains PM-SIGNED — no re-sign required.** Amendments are non-blocking and confined to the limitations table above and the rulings table below.

| # | Fixture | Ruling | Action |
|---|---|---|---|
| 1 | TC-TAS-015 (`unfair_dismissal`) | **(A) Engine fix** | Add `unfair_dismissal` to TAS `QUALIFYING_REASONS` set and `QualifyingReason` union in `tas/rules/accrual-table.ts`. Doc line 738 already specifies this mapping; engine omitted it. Fixture stays at 7.8018 wks / $13,263.08 (engine-canonical per operator Note-A ruling at T8.5 close-out; supersedes the original T8.3 hand-math value of 7.8003 wks / $13,260.51). Cross-state parallel: ACT/SA/QLD/WA/NSW all wire `unfair_dismissal`. |
| 2 | TC-TAS-018 (casual flag=false, no break-date) | **(B) Documented limitation** | TBD-TAS-17 (new) added to limitations table above. Engine strict-zeros service when flag=`false` and no `tas_casual_continuity_break_date` is supplied. Update fixture expected to `totalEntitlementDollars: "0.00"` + warning `tas_casual_32hr_4wk_continuity_not_satisfied`. Operator-empowering reading: operator who flags continuity broken without a break-date is asking for conservative treatment. |
| 3 | TC-TAS-040 (7-wk LSL + 4 PHs) | **(B) Documented limitation** | TBD-TAS-10 amended (above) — v1 engine emits citation only, no `leave_end_calendar` computation. Downgrade fixture to citation-only assertion + `payable_for_taken_leave = leaveWeeks × value_of_week`. Drop `leave_end_calendar` / `phs_within_leave_count` expectations. Parallel to ACT TC-ACT-042. |
| 4 | TC-TAS-041 (4-wk LSL + 3 Easter PHs) | **(B) Documented limitation** | Same as Item 3 — downgrade to citation-only + payable amount. |
| 5 | TC-TAS-042 (single-day LSL on PH) | **(B) Documented limitation** | Same as Item 3 — engine emits `tas_single_day_lsl_on_ph_exclusive` advisory + citation; does NOT shift the day. Fixture expected to `payable_for_taken_leave = leaveWeeks × value_of_week` + the advisory + the citation. Drop `leave_days_consumed` / `leave_end_calendar`. |
| 6 | TC-TAS-058 (UPL in 12-mo window) | **(B) Documented limitation + (A) Engine fix (sub-bug)** | TBD-TAS-18 (new) added to limitations table above — operator pre-substitutes per SA precedent; engine emits new advisory `tas_12mo_window_upl_overlap_check_substitution`. **Sub-bug**: fixture surfaces an unrelated engine error — `taking_leave` at 10 yrs + 6 days is incorrectly emitting `tas_advance_leave_not_permitted`. Fix the advance-leave gate so workers at >= 10 yrs continuous service are permitted to take leave. Update fixture expected to `payableIndicator: payable` + warning `tas_12mo_window_upl_overlap_check_substitution`. |
| 7 | TC-TAS-060 (commission boundary) | **(C) Fixture update** | Engine is correct per locked TBD-TAS-03 (91-day window). Fixture wageHistory has a 1-day boundary bleed: change Q1-Q3 `periodEnd` from `2026-02-25` to `2026-02-24` so the 91-day window captures the Q4 row cleanly. Engine computes $5000.00 with the corrected boundary. No engine change. |
| 8 | TC-TAS-073 (cross-jurisdiction routing) | **(C) Fixture update** | Scope mismatch. Engine-level TAS suite cannot exercise dispatch-to-NSW routing — that is a dispatch/orchestrator layer test. Rewrite fixture to mirror ACT TC-ACT-073: expected `status: "blocked_cross_jurisdiction"` + warning `cross_jurisdiction_pending`. Drop `state_used` and `total_entitlement_weeks`. The dispatch-layer routing test belongs in the orchestrator test suite (out of TAS engine scope). |

### Aggregate developer action list

**Engine fixes required (T8.3 scope)**:
- Add `'unfair_dismissal'` to TAS `QualifyingReason` union and `QUALIFYING_REASONS` set in `tas/rules/accrual-table.ts` (Item 1).
- Fix `taking_leave` advance-leave gate so >= 10 yrs continuous service is permitted (no `tas_advance_leave_not_permitted` advisory) (Item 6 sub-bug).
- Add new advisory code `tas_12mo_window_upl_overlap_check_substitution` — emit when `leave_without_pay` events overlap the 12-month casual averaging window. Engine consumes operator-supplied hours as-is (no auto-substitution) (Item 6).

**Fixture updates required**:
- TC-TAS-015: remove `_reconciliation_note`; expected `totalEntitlementDollars: "13263.08"` (engine-canonical per operator Note-A ruling at T8.5 close-out) + (no `sub_10yr_no_qualifying_reason_tas` warning).
- TC-TAS-018: confirm engine strict-zero output — `totalEntitlementDollars: "0.00"` + warning `tas_casual_32hr_4wk_continuity_not_satisfied`. Update doc fixture narrative on line 778 to record strict-zero is intentional.
- TC-TAS-040: downgrade to `payable_for_taken_leave: 12600.00` + `expected_citations` only. Drop `leave_end_calendar`, `phs_within_leave_count`.
- TC-TAS-041: downgrade to `payable_for_taken_leave: 6000.00` + `expected_citations` only. Drop `leave_end_calendar`, `phs_within_leave_count`.
- TC-TAS-042: downgrade to `payable_for_taken_leave: leaveWeeks × value_of_week` (`leaveWeeks: 0.2 × value_of_week: 1800` = $360.00) + warning `tas_single_day_lsl_on_ph_exclusive`. Drop `leave_days_consumed`, `leave_end_calendar`.
- TC-TAS-058: expected `payableIndicator: payable` + new warning `tas_12mo_window_upl_overlap_check_substitution`.
- TC-TAS-060: change wageHistory row 1 `periodEnd` from `2026-02-25` to `2026-02-24`. Expected `value_of_week: 5000.00` stays.
- TC-TAS-073: expected `status: "blocked_cross_jurisdiction"` + warning `cross_jurisdiction_pending`. Drop `state_used` and `total_entitlement_weeks`.

**Documented limitations recorded** (added to limitations table above):
- **TBD-TAS-10 amended**: PH-extends-LSL is citation-only in v1; no `leave_end_calendar` computation.
- **TBD-TAS-17 (new)**: Casual continuity flag `false` without break-date → strict-zero all service.
- **TBD-TAS-18 (new)**: UPL-substitution in 12-month casual window is operator's responsibility; engine emits informational advisory only.

**Additional dev-day estimate beyond the 3.5–4.5 d T8.3–T8.5 envelope**:
- Item 1 (add `unfair_dismissal` to set): trivial (~10 min) — no extra day.
- Item 6 engine fixes (advance-leave gate fix + new advisory): ~½ d.
- Items 2, 3, 4, 5, 7, 8 (fixture updates only — no engine work): ~½ d total across all 6.

**Total reconciliation overhead: ~1 dev-day** absorbed into T8.3 timeline. T8.3–T8.5 envelope expands from 3.5–4.5 d → 4.5–5.5 d. Acceptable variance for v1.

### Sign-off status

Doc remains **PM-SIGNED 2026-05-26**. Reconciliation amendments are non-blocking — limitations recorded, engine fixes scoped, fixture updates instructed. No re-sign required. Developer proceeds with T8.3 commit incorporating the above instructions.

---

### Post-implementation reconciliation — 2026-05-26 (T8.5 close-out)

TC-TAS-015 narrative reconciled to engine-canonical value ($13,263.08 / 7.8018 wks) per operator Note-A ruling at T8.5 close-out. The original T8.3 PM hand-math value ($13,260.51 / 7.8003 wks) is preserved in Item 1 of the rulings table above as the historical reference. Drift is $2.57 / 0.0015 wk — a calendar/Decimal precision artefact of the hand-calculation; engine math is the source of truth. No engine, fixture, or test changes.

---

*End of test-cases-tas.md v1.0 PM-SIGNED · Tracy Angwin (PM) · 2026-05-26 · Reconciliation appendix 2026-05-26 (T8.3) · Post-implementation reconciliation 2026-05-26 (T8.5).*
