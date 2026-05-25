# ACT LSL Calculator — Gold-Standard Test Cases

**Status**: DRAFT v1.0 · awaiting PM sign-off
**Version**: v1.0-draft
**Date**: 2026-05-26
**Spec**: `.specify/features/002-all-state-coverage/spec.md` v0.3.1
**Impl plan**: `.specify/features/002-all-state-coverage/impl-plan.md` v0.3.3 Phase 7 (ACT) — pending Phase 7 amendment after TBD resolutions
**Tasks**: `.specify/features/002-all-state-coverage/tasks.md` T7.0 BLOCKING — PM sign-off pending
**Source-of-truth Acts**:
- *Long Service Leave Act 1976* (ACT) — Republication No 29 effective 19 November 2025. Cited as **"ACT LSL Act 1976 s.N"** throughout. Section coverage in v1: s.2F (commission/results-based pay definition), s.2G (continuous service), s.3 (entitlement period), s.4 (entitlement formula), s.6 (taking LSL), s.7 (ordinary pay), s.8 (payment for LSL), s.9 (public holidays exclusive), s.10 (transfer of business), s.10A (workers compensation absence), s.11A (cessation pay-in-lieu), s.11C (pro-rata at 5–7 yrs), s.11D (cessation hours averaging), s.12 (records).
- *Workers Compensation Act 1951* (ACT) s.46 — amended effective 9 June 2023 to make workers-compensation absence count toward LSL service. Cited as **"WC Act 1951 (ACT) s.46"** where the date-aware override applies. Note v1 citation form is Act-level only; sub-section detail to be verified during quarterly review (parallel to TBD-WA-02 / TBD-SA-03 documented limitation).
- *Public Holidays Act 1958* (ACT) — source-of-truth for ACT public holidays (Canberra Day, Reconciliation Day are ACT-unique). Cited as **"Public Holidays Act 1958 (ACT)"**.

---

## Quick reference — ACT decisions at a glance

| Topic | ACT rule | Source |
|---|---|---|
| Qualifying period — full entitlement | **7 years** (equal-lowest with VIC) | s.3, s.4 |
| Entitlement at qualifying period | **6.0667 weeks** (= 1/5 month × 7 yrs ÷ 12 × 52) | s.4 |
| Accrual rate after first entitlement | **0.8667 wks/yr continuous** (= 1/5 month/yr); equivalent to `Years × 8.6667/10` past year 10 | s.4 |
| Pro-rata at termination — sub-7-yr threshold | **5 years** (LOWEST in Australia) | s.11C |
| Pro-rata qualifying reasons (5–7 yrs) | illness, incapacity, domestic or pressing necessity, retirement (award/agreement OR 65), death, employer-not-misconduct | s.11C |
| Serious & wilful misconduct (sub-7-yr) | **forfeiture** — no pro-rata | s.11C (excluded) |
| Serious & wilful misconduct (7+ yrs) | **FULL PAYOUT** — same as NSW/VIC/QLD/SA (NOT WA partial-forfeiture) | s.3, s.4 (no misconduct exception in full-entitlement branch) |
| PH during LSL | **EXCLUSIVE** — PH extends leave by 1 day each | s.9 |
| Break tolerance — re-employment (non-slackness) | **2 months** (parallel to NSW/SA/WA) | s.2G(2)(e) |
| Break tolerance — slackness of trade | **6 months** (parallel to WA — REUSES DEV-CROSS-2 `slacknessOfTrade` flag) | s.2G(2)(b) |
| Casual averaging window — taking leave | **12 months immediately before entitlement date** | s.7(2) |
| Casual averaging window — pay-in-lieu on cessation | **12 months immediately before cessation date** | s.11D |
| FT→PT/casual within 2 yrs of entitlement | **5-year salary total ÷ 5** (no hours averaging) — SA-UNIQUE-like ACT path | s.7(3) |
| Overtime — hours in averaging window | **INCLUDED** in hours-averaging window for casual/PT (per WorkSafe ACT + Masterclass) | s.7(2) |
| Overtime — rate in ordinary pay | **EXCLUDED** from ordinary-pay rate | s.7(1) |
| Bonus / incentive | **INCLUDED** if usually paid with salary (e.g. KPI bonuses) — same direction as NT | s.7(1) + WorkSafe ACT |
| All-purpose / skills / qualification allowances | **INCLUDED**; non-all-purpose allowances **EXCLUDED** | s.7(1) |
| Board and lodging (cash value) | **INCLUDED** where provided in employment | s.7(1) |
| Penalty rates (shift/weekend/PH loadings) | **EXCLUDED** | s.7(1) |
| Commission / piecework | **INCLUDED** via `total ÷ 52` (s.2F) | s.2F |
| WC absence (pre-9 June 2023) | counts as service **only up to 2 weeks per service year** | s.2G + s.10A (pre-amendment) |
| WC absence (from 9 June 2023) | **counts as service in full** per WC Act 1951 (ACT) s.46 amendment | s.10A + WC Act 1951 (ACT) s.46 |
| Cashing out | **PERMITTED** per WorkSafe ACT guidance s.8(c) "in another way" — non-statutory advisory | s.8(c) + WorkSafe ACT guidance |
| Leave in advance | **NOT PERMITTED** — no statutory basis in the Act | s.6 (no advance leave provision) |
| Employer direction | **60 days' written notice** (advisory; not engine-blocking) | s.6(2) |
| Pay-on-termination timing | **WITHIN 90 DAYS** of cessation — LONGEST in Australia | s.11A(4)(b) |
| Apprentice lead-in | 12 months (parallel to NSW/SA/NT) | s.2G |
| Defence Force / service-outside-ACT continuity | Defence: counts where employed immediately before; outside-ACT: temporary secondment counts. **Out of v1 scope** | s.2G |
| Records retention | 7 years after cessation | s.12 |
| Portable LSL schemes | **OUT OF v1 SCOPE** — LSL (BCI) Act 1981, LSL (CCI) Act 1999, LSL (PS) Act 2009 | s.2D, s.2E, s.2EA |

---

## Schema additions / engine surface for ACT

**New `extraInputs` keys read by the ACT orchestrator only** (SA-precedent localised pattern — NOT a cross-state schema extension; no DEV-CROSS-4):

| Field | Type | Default | Purpose |
|---|---|---|---|
| `extraInputs.act_overtime_hours_by_period` | `Array<{periodStart, periodEnd, hours}>` | `[]` | Overtime hours per pay period — added to base hours in the s.7(2) 12-month casual/PT averaging window. Excluded from rate. Already drafted in impl-plan §P0.6 / DEV-E2-M6 as `overtimeHoursByPeriod`; for v1 ACT the namespaced form `act_overtime_hours_by_period` is preferred to stay consistent with the SA pattern of state-namespaced extraInputs. Engine accepts either form during the v1 dev pass. |
| `extraInputs.act_ft_to_pt_transition_date` | `ISODate` (optional) | `undefined` | When the employee transitioned from FT to PT/casual. Engine checks if the transition was within **2 years prior to the 7-yr entitlement anniversary**; if so, routes to s.7(3) 5-yr-salary-total path instead of s.7(2) hours-averaging path. |
| `extraInputs.act_award_min_retirement_age_reached` | `boolean` | `false` | True when the employee has reached the award- or agreement-specified minimum retirement age (sub-65). Used by s.11C qualifying-reason gate. When `reason === 'retirement'` AND age >= 65 OR this flag is true → retirement qualifies for pro-rata at 5–7 yrs. |

**New `act_*` warning codes** (state-namespaced):

| Code | Tier | Use |
|---|---|---|
| `sub_5yr_no_entitlement_act` | informational | Below 5-yr pro-rata floor. No entitlement under s.11C. |
| `sub_7yr_no_qualifying_reason_act` | informational | 5–7 yrs but termination reason does not qualify under s.11C (e.g. voluntary resignation without illness/incapacity/etc.). |
| `sub_7yr_misconduct_excluded_act` | informational | Serious & wilful misconduct dismissal sub-7-yr — pro-rata forfeited. |
| `act_7yr_plus_misconduct_full_payout` | informational | Dismissal for serious & wilful misconduct at 7+ yrs — full s.4 entitlement payable. ACT does NOT mirror WA partial-forfeiture. |
| `act_workers_comp_pre_9jun2023_capped` | informational | WC absence pre-9 June 2023 counted only up to 2 weeks per service year per s.10A (pre-amendment). |
| `act_workers_comp_post_9jun2023_counts` | informational | WC absence from 9 June 2023 counted in full per WC Act 1951 (ACT) s.46 amendment. |
| `act_workers_comp_regime_split_applied` | informational | WC absence straddles 9 June 2023 — pre-cutoff portion capped per s.10A, post-cutoff portion counts in full per WC Act 1951 (ACT) s.46. |
| `act_overtime_included_in_hours_average` | informational | Overtime hours included in s.7(2) 12-month casual/PT hours-averaging window; rate excludes overtime premium per s.7(1). |
| `act_s7_3_ft_to_pt_within_2yr_path` | informational | Employee transitioned FT→PT/casual within 2 yrs of 7-yr entitlement anniversary — s.7(3) 5-year-salary-total path applied instead of s.7(2) hours-averaging path. |
| `act_taking_anchor_vs_termination_anchor_diverged` | informational | Trigger drives averaging anchor: `taking_leave` uses 12-mo-before-entitlement-date; `termination` uses 12-mo-before-cessation. Surfaced when the two anchors would yield different averages (i.e. employee hours changed between entitlement and cessation). |
| `act_cashout_post_accrual_advisory` | informational | Cash-out at 7+ yrs — non-statutory; per WorkSafe ACT guidance s.8(c) "in another way". Written agreement recommended. |
| `act_cashout_pre_accrual_not_authorised` | informational | Cash-out at 5–7 yrs (pro-rata band) — no statutory basis; not authorised even via s.8(c). |
| `act_cashout_no_entitlement_to_cash_out` | informational | Sub-5-yr — no entitlement to cash out. |
| `act_lsl_calculated_at_wc_reduced_rate_warning` | informational | LSL taken while on WC reduced rate — literal s.7(1) rate applied (no higher-of-rates equivalent to VIC s.17). |
| `act_advance_leave_not_permitted` | informational | Taking LSL before 7-yr entitlement is not permitted under the ACT Act. Returns $0 with this advisory. |
| `act_termination_payable_within_90_days_advisory` | informational | Pay-on-termination window is 90 days per s.11A(4)(b) — LONGEST in Australia. Engine surfaces `payable_by` field (informational). |
| `act_higher_duties_or_acting_rate_not_encoded_v1` | informational | ACT has no statutory higher-duties rule analogous to SA s.4 — not encoded in v1. (Provision deferred per analogue of SA TBD-SA-11.) |

**New `Result` field** (additive, optional):

| Field | Type | Purpose |
|---|---|---|
| `payable_by` | `ISODate` (optional) | When the engine has computed a termination payout for ACT, this is `terminationDate + 90 days`. Surfaced in the result UI as informational; no behaviour effect on dollar values. Available to other states' future engines if needed (single-state localised pattern initially; cross-state if surfaced elsewhere). |

**No cross-state schema extension** — every new field is ACT-localised via `extraInputs` or is a purely additive optional output field. **No DEV-CROSS-4 dev-finding** (parallel to SA's no-DEV-CROSS-3 outcome).

---

## Sources of legal truth

- *Long Service Leave Act 1976* (ACT) — Republication No 29 effective 19 November 2025. Available at `legislation.act.gov.au/a/1976-27/`. Cited as **"ACT LSL Act 1976 s.N"** throughout. Section coverage verified against the legislation.act.gov.au consolidated index.
- *Workers Compensation Act 1951* (ACT) — s.46 amended effective 9 June 2023 to include LSL accrual on workers-compensation absences (parallel to WA's 2024-07-01 WCIM Act 2023 amendment).
- *Public Holidays Act 1958* (ACT) — source-of-truth for ACT public holidays. Includes Canberra Day (second Monday in March) and Reconciliation Day (Monday closest to 27 May) — both ACT-unique.
- *WorkSafe ACT — Long Service Leave Guidance Material* — published by WorkSafe ACT (the enforcement body). `worksafe.act.gov.au/laws-and-compliance/long-service-leave/guidance-material`. Cited as **"WorkSafe ACT — LSL guidance"** where used. Operational summary of the Act incl. cash-out under s.8(c) "in another way" interpretation.
- *Australian Payroll Association LSL Masterclass 2026* (158 pp) pp.109–123 — supplies worked examples for ACT used as canonical fixtures. Cited as **"APA LSL Masterclass p.NN"** throughout.
- *Internal research dossier* — `docs/research/lsl-pay-components-deep-research.md` v2.0 §3.7 (ACT). The Masterclass + WorkSafe ACT + AustLII material is consolidated there.

---

## How to read this file

Each test case has:

- **ID** (e.g. `TC-ACT-001`) — unique, stable, referenced from `gold-standard.test.ts`
- **Name** — short, descriptive
- **Source** — APA PDF page and/or ACT LSL Act 1976 section that produced the expected value
- **Category** — Single mode (Fixed-rate / Varied-hours / Commission / Hard-error / negative / Cashing-out advisory) or Bulk mode
- **Why it matters** — the spec acceptance criterion or ACT-specific divergence this case backs
- **Inputs** — fenced YAML following the engine's `Employee` / `Trigger` / `WagePeriod` / `ContinuousServiceEvent` data model in `website/src/lib/lsl/engine/types.ts`
- **Expected output** — `value_of_week`, `value_of_day`, `total_entitlement_weeks`, `total_entitlement_dollars`, `expected_citations[]`; for hard-error cases `status: failed` and `error.code`
- **Legal source** — explicit ACT LSL Act 1976 section reference
- **Notes** — interpretation, derivation, any `expected: TBD` flag with rationale

### Conventions used in this file

- **Currency**: AUD; half-up rounding at 0.005; 2 decimal places at display; intermediate arithmetic unrounded — same convention as every prior state.
- **Dates**: ISO `YYYY-MM-DD`. Prescribed-date anchor for fixtures is `2026-05-26` (= as-at default for v1 testing).
- **Entitlement formula** (ACT LSL Act 1976 s.4): **6.0667 weeks** at 7 years; **0.8667 wks/yr continuous** thereafter (= 1/5 month/yr). Equivalent expression past year 10: `Years × (8.6667 / 10)`. Same accrual ratio as NSW/VIC/QLD/WA/TAS — LESS generous than SA/NT (1.3/yr).
- **Pro-rata at termination** (s.11C): payable to an employee who has completed at least **5 years** of continuous service whose employment ends for a qualifying reason — illness/incapacity, domestic or pressing necessity, retirement (award/agreement OR 65 years), death, employer-not-misconduct dismissal. **ACT's 5-year threshold is the LOWEST in Australia.** Sub-5-yr returns $0 always. Voluntary resignation 5–7 yrs **does NOT qualify** (unlike SA/WA which pay out at 7+ regardless). Pro-rata calculation includes years AND months/12 converted to decimal (s.11C(2)).
- **Serious & wilful misconduct** (s.11C): forfeits all pro-rata at sub-7-yr tenure. At 7+ years, the full s.4 entitlement is payable regardless — **ACT mirrors NSW/VIC/QLD/SA on this point (no partial-forfeiture as in WA).** The misconduct exception applies only to the pro-rata branch under s.11C, not to the full-entitlement branch under s.3 / s.4.
- **Ordinary pay** (s.7(1)): for fixed-rate full-time employees, the ordinary weekly rate at the time of taking leave applies — INCLUDING base wages, casual loading, all-purpose / skills / qualification allowances, board/lodging cash value, commissions, bonuses usually paid with salary; EXCLUDING overtime, penalty rates (shift/weekend/PH loadings), and allowances not paid for all purposes. For **part-time and casual** employees: 12-month hours-averaging window per s.7(2) (for `taking_leave`) or s.11D (for `termination`) — anchored at entitlement date or cessation date respectively. **Hours in the average INCLUDE overtime hours; the rate does NOT include overtime premium.** (Asymmetric — parallel to SA 156-wk pattern.) For **FT→PT/casual within 2 yrs of 7-yr entitlement**, s.7(3) applies — 5-year total salary divided by 5 (no hours averaging). For **commission / piece / payment-by-result** employees, s.2F applies — total income divided by 52.
- **Continuous service** (s.2G + s.10A + WorkSafe ACT guidance): paid working time and paid leave count (annual leave, paid personal/sick leave, LSL). **Workers compensation absences** count per the dual-regime cliff at **9 June 2023** — pre-cutoff: up to 2 weeks per service year (parallel to WA pre-2022 15-day cap pattern, per TBD-WA-09 RESOLVED working-days-proportionate interpretation); from 9 June 2023: counts in full per WC Act 1951 (ACT) s.46 amendment. **Re-employment within 2 months** of a termination preserves continuity (same threshold as NSW/SA/WA non-slackness). **Re-employment within 6 months following slackness-of-trade stand-down** preserves continuity (parallel to WA slackness — REUSES the DEV-CROSS-2 `slacknessOfTrade` flag). **Unpaid leave** (other than sick): doesn't count toward service but doesn't necessarily break continuity (s.2G). **Illness/injury absence** (paid or unpaid) up to **2 weeks per year** counts; excess does NOT count. **Apprenticeship → contract within 12 months** preserves continuity. **Defence Force service** where employed immediately before counts (out of v1 scope; documentary).
- **Transfer of business** (s.10 + s.2G): on a transmission of business to a new owner with the employee continuing to be employed, service is deemed continuous and the LSL liability transfers with the employee. New employer becomes sole employer.
- **Public holidays during LSL** (s.9): **EXCLUSIVE — a PH falling within an LSL period extends the leave by one day per PH.** Parallel to NSW/VIC/QLD/WA/TAS. OPPOSITE to SA's inclusive treatment.
- **Cashing out** (s.8(c) + WorkSafe ACT guidance — non-statutory): per WorkSafe ACT, the Act enables the employer and employee to agree on how the employee will be paid; s.8(c) says "if the employer and the employee agree — in another way." Value of cash-out same as if LSL taken. Engine emits non-blocking advisory. Three-tier per impl-plan pattern: `act_cashout_post_accrual_advisory` (7+ yr) / `act_cashout_pre_accrual_not_authorised` (5–7 yr) / `act_cashout_no_entitlement_to_cash_out` (sub-5-yr).
- **Leave in advance**: NOT permitted under the ACT Act (no statutory basis). Engine refuses `taking_leave` when `years_of_continuous_service < 7` — returns $0 with `act_advance_leave_not_permitted` advisory. Same shape as TAS Phase 8 (see TBD-ACT-14 below for confirmation).
- **Pay-on-termination timing** (s.11A(4)(b)): within **90 days** after the day employment ceases — **LONGEST in Australia.** Engine surfaces a new `payable_by` field (informational) on `Result` and emits `act_termination_payable_within_90_days_advisory`. v1 accepts the 90-day window in line with the literal Act text; operator can over-ride.
- **Citations**: every case lists the minimum expected citations. The rules engine MAY emit additional citations; tests assert array-membership, not array-equality.

---

## ACT-specific divergences from NSW/VIC/QLD/WA/SA (the load-bearing facts)

| Topic | NSW | VIC | QLD | WA | SA | ACT | ACT source |
|---|---|---|---|---|---|---|---|
| Qualifying period (full entitlement) | 10 yrs | 7 yrs | 10 yrs | 10 yrs | 10 yrs | **7 yrs (equal-lowest with VIC)** | ACT LSL Act 1976 s.3, s.4 |
| Entitlement at qualifying period | 8.6667 wks | 6.0667 wks (at 7) | 8.6667 wks | 8.6667 wks | 13 wks | **6.0667 wks at 7 yrs** | ACT LSL Act 1976 s.4 |
| Accrual rate after first entitlement | 1/60 = 0.0867 wks/yr | 1/60 | 1/60 | 1/60 | 1.3/yr | **0.8667 wks/yr** (= 1/5 month/yr) | ACT LSL Act 1976 s.4 |
| Equivalent past year 10 | `× 8.6667/10` | `× 8.6667/10` | `× 8.6667/10` | `× 8.6667/10` | `× 1.3` | **`× 8.6667/10`** — same as NSW/VIC/QLD/WA/TAS | ACT LSL Act 1976 s.4 + APA Masterclass |
| 15-year additional accrual | continuous 1/60 | continuous 1/60 | continuous 1/60 | continuous 1/60 | continuous 1.3/yr | **continuous 0.8667/yr — NO discrete step**. At 15 yrs: 6.0667 + 8 × 0.8667 = 13.0003 ≈ 13.0 wks | ACT LSL Act 1976 s.4 |
| Pro-rata at termination — sub-threshold | 5 yrs (limited reasons) | 7 yrs (any reason except misconduct) | 7 yrs (limited reasons s.95(3)) | 7 yrs (any reason except misconduct) | 7 yrs (any reason except misconduct OR unlawful worker termination) | **5 yrs (LIMITED qualifying reasons under s.11C)** — LOWEST in Australia | ACT LSL Act 1976 s.11C |
| Sub-5-yr entitlement | none (some 5-yr limited reasons trigger) | none | none | none | none | **none** | ACT LSL Act 1976 s.11C |
| 5–7-year qualifying reasons | illness, death, domestic-pressing-necessity, employer-not-misconduct | n/a (full 7-yr threshold) | n/a (full 10-yr threshold) | n/a (full 10-yr threshold) | n/a (full 10-yr threshold) | **illness/incapacity, domestic or pressing necessity, retirement (award/agreement OR 65), death, employer-not-misconduct** | ACT LSL Act 1976 s.11C |
| Voluntary resignation 5–7 yrs | not payable | n/a | n/a | n/a | n/a | **NOT PAYABLE** (no qualifying reason) | ACT LSL Act 1976 s.11C |
| Serious & wilful misconduct dismissal — sub-threshold | full forfeiture | full payout (any reason at 7+) | full forfeiture | full forfeiture | full forfeiture | **full forfeiture sub-7-yr** | ACT LSL Act 1976 s.11C |
| Serious & wilful misconduct dismissal — at/above qualifying threshold | full payout | full payout | full payout | **partial forfeiture (last fully-accrued block only)** | full payout | **FULL PAYOUT at 7+ yrs — same as NSW/VIC/QLD/SA; ACT does NOT mirror WA partial-forfeiture** | ACT LSL Act 1976 s.4 (no misconduct exception in full-entitlement branch) |
| Break tolerance — re-employment | 2 mo (≤60 days) | 12 wks | 3 mo | 2 mo (non-slackness); 6 mo (slackness) | 2 mo | **2 mo (non-slackness); 6 mo (slackness of trade)** — REUSES DEV-CROSS-2 `slacknessOfTrade` | ACT LSL Act 1976 s.2G(2)(e), s.2G(2)(b) |
| Casual continuity test | "regular and systematic" | 12 weeks unless agreement, seasonal, etc. | 3 months between contracts | regular and systematic | regular or systematic | **seasonal interruption >2 mo doesn't break continuity if caused by seasonal nature; gap doesn't count** | ACT LSL Act 1976 s.2G(3) |
| Sickness/injury counted as service | counts | counts | counts | 15-day cap pre-2022; counts in full post-2022 | counts | **counts up to 2 wks per year; excess does NOT count (per s.2G)** | ACT LSL Act 1976 s.2G |
| Unpaid leave (other than sick) | excluded | first 52 wks count | does not count but no break | excluded pre-2022; depends post-2022 | "extends-the-line" | **does NOT count as service; treatment of continuity-break is case-by-case under s.2G** | ACT LSL Act 1976 s.2G |
| Workers Comp absence | counts (NSW LSA s.4(11)) | counts (s.13(1)(b)) | counts (s.134) | depends on accrual date (cliffs at 2022-06-20 + 2024-07-01) | counts | **DUAL-REGIME**: pre-9 June 2023 = up to 2 wks/yr; from 9 June 2023 = counts in full per WC Act 1951 (ACT) s.46 amendment | ACT LSL Act 1976 s.10A + WC Act 1951 (ACT) s.46 |
| WC rate of pay during LSL | counts as service; current ordinary rate | s.17 higher-of-pre-injury-or-current | literal s.98 ordinary rate + advisory | literal s.9 ordinary rate + advisory | literal s.4 ordinary rate + advisory | **literal s.7(1) ordinary rate + advisory** (parallel to QLD/WA/SA pattern) | ACT LSL Act 1976 s.7 + WorkSafe ACT |
| Higher-duties / acting rate | not encoded | not encoded | not encoded | not encoded | SA-unique (s.4) | **not encoded in ACT v1** — no statutory analogue identified in the ACT Act | n/a |
| Public holiday during LSL | exclusive | exclusive | exclusive | exclusive | INCLUSIVE | **EXCLUSIVE — PH extends leave by 1 day per PH** | ACT LSL Act 1976 s.9 |
| Death of employee | s.4(2)(iii)(d) — pro-rata, estate | s.10 — full + 52-wk avg | s.95(3)(a) — pro-rata | s.8(3) — pro-rata | s.5 — vests in personal representative | **s.11C — qualifying reason for pro-rata 5+ yrs; full at 7+ yrs to personal representative** | ACT LSL Act 1976 s.11C |
| Casual averaging window | implicit via "regular and systematic" + 52-wk lookback (E1) | 3-tier: weekly_avg_12mo / weekly_avg_5yr / whole | 52 weeks (s.105) | accrual-period-average per block | 156 weeks (3 yrs) | **12 months immediately before entitlement date (s.7(2)) for taking; 12 months immediately before cessation (s.11D) for pay-in-lieu** — anchor moves with trigger kind | ACT LSL Act 1976 s.7(2), s.11D |
| FT→PT/casual mid-service window | n/a | n/a | n/a | n/a | n/a | **ACT-UNIQUE: when FT→PT/casual within 2 yrs of 7-yr entitlement, s.7(3) applies — 5-yr total salary ÷ 5 (no hours averaging)** | ACT LSL Act 1976 s.7(3) |
| Overtime hours in averaging window | not encoded | not encoded | not encoded | included if regular | included | **INCLUDED in s.7(2) 12-mo casual/PT hours-average; EXCLUDED from rate per s.7(1)** | ACT LSL Act 1976 s.7(1), s.7(2) + WorkSafe ACT |
| Bonus / incentive in ordinary pay | conditional (4-criteria + high-income threshold) | conditional (in contract) | (regulator silent) | excluded by s.7A | excluded | **INCLUDED if usually paid with salary (e.g. KPI bonus)** — same direction as NT | ACT LSL Act 1976 s.7(1) + WorkSafe ACT |
| Penalty rates in ordinary pay | excluded | excluded | INCLUDED (s.98) | excluded | excluded | **EXCLUDED** | ACT LSL Act 1976 s.7(1) |
| Commission / piece-rate | branch B (NSW) | s.15 (if in contract) | s.99 — 52.179-day | s.7(4) 365 days | 52 wks | **s.2F — `total ÷ 52` (12-mo income window)** | ACT LSL Act 1976 s.2F |
| Cashing out | not in scope NSW v1 | CRIMINAL OFFENCE s.34 | PERMITTED via QIRC/instrument (s.110) — advisory | PERMITTED post-accrual — advisory | PERMITTED post-10-yr — advisory | **PERMITTED per WorkSafe ACT guidance s.8(c) "in another way" — non-statutory advisory** | ACT LSL Act 1976 s.8(c) + WorkSafe ACT |
| Leave in advance | not encoded NSW v1 | (not specifically encoded) | (not specifically encoded) | s.10 permitted with employer agreement | (not specifically encoded) | **NOT PERMITTED — no statutory basis in the Act** | ACT LSL Act 1976 (no advance leave provision) |
| Pay-on-termination timing | forthwith | day of termination | within 3 days (regulator interpretation) | day of termination | immediately | **WITHIN 90 DAYS of cessation — LONGEST in Australia** | ACT LSL Act 1976 s.11A(4)(b) |
| Employer direction notice | n/a (not encoded) | (in Act; not encoded v1) | (in Act; not encoded v1) | s.5 written agreement | (not encoded v1) | **60 days' written notice (s.6(2)) — advisory; not engine-blocking** | ACT LSL Act 1976 s.6(2) |
| Apprenticeship lead-in | (varies) | 52 wks | 3 mo | 52 wks | 12 mo | **12 months** | ACT LSL Act 1976 s.2G |
| Industry-specific portable schemes | not in scope | not in scope | separate Acts | MyLeave (construction) | Construction Industry LSL Act 1987 (SA) | **OUT OF v1 SCOPE: LSL (BCI) Act 1981 (construction); LSL (CCI) Act 1999 (contract cleaning); LSL (PS) Act 2009 (other)** | ACT LSL Act 1976 s.2D, s.2E, s.2EA |

---

## Coverage at a glance

| Source / Theme | Test IDs | Count |
|---|---|---|
| APA PDF ACT worked examples (pp.109–123) | TC-ACT-001 → TC-ACT-009 | 9 |
| Sub-5-year and 5–7-year qualifying-reason cases (s.11C) | TC-ACT-010 → TC-ACT-019 | 10 |
| 7+ year full payout (any reason, incl. misconduct at 7+) (s.4) | TC-ACT-020 → TC-ACT-024 | 5 |
| Serious & wilful misconduct treatment (s.11C) | TC-ACT-025 → TC-ACT-027 | 3 |
| Continuous-service edge cases (s.2G) | TC-ACT-028 → TC-ACT-035 | 8 |
| Workers Comp dual regime (9 June 2023 cliff — F8-equivalent) | TC-ACT-036 → TC-ACT-041 | 6 |
| Public holiday EXCLUSIVE in LSL period (s.9) | TC-ACT-042 → TC-ACT-044 | 3 |
| Ordinary pay — fixed-rate, allowances, bonus, commission (s.7) | TC-ACT-045 → TC-ACT-050 | 6 |
| Casual / PT — s.7(2) 12-mo averaging with overtime hours included (F9/AC11) — the headliner | TC-ACT-051 → TC-ACT-055 | 5 |
| s.7(3) FT→PT/casual within 2 yrs — 5-yr salary path (ACT-unique) | TC-ACT-056 → TC-ACT-058 | 3 |
| s.7 vs s.11D anchor divergence (taking vs cessation) | TC-ACT-059 → TC-ACT-061 | 3 |
| 15-year and 20-year continuous-accrual cases (s.4) | TC-ACT-062 → TC-ACT-063 | 2 |
| Cashing out — non-blocking advisory (s.8(c) + WorkSafe ACT) | TC-ACT-064 → TC-ACT-067 | 4 |
| Workers comp overlap with LSL rate (s.7 — parallel to QLD/WA/SA) | TC-ACT-068 | 1 |
| Transfer of business (s.10) | TC-ACT-069 | 1 |
| Leave in advance — refused (no statutory basis) | TC-ACT-070 | 1 |
| As-at snapshot trigger | TC-ACT-071 → TC-ACT-072 | 2 |
| Cross-jurisdiction (ACT + other state) | TC-ACT-073 → TC-ACT-074 | 2 |
| Pay-on-termination 90-day window — `payable_by` surface | TC-ACT-075 | 1 |
| Bulk-mode fixtures | TC-ACT-BULK-001 → TC-ACT-BULK-003 | 3 |
| **Total active single-mode fixtures for v1 ACT launch** | | **75** |
| **Bulk-mode fixtures** | | **3** |
| **Grand total** | | **78** |

> **Note on size**: ACT fixture count (78) is the largest of any state to date, exceeding WA (73) and SA (67). The extras come from: (a) the dual-regime WC cliff at 9 June 2023 (6 fixtures, parallel to WA's 2024-07-01 sub-cliff coverage), (b) the ACT-unique s.7(3) FT→PT/casual within 2 yrs path (3 fixtures — no parallel in other states), (c) the s.7 vs s.11D anchor divergence (3 fixtures — anchor moves with trigger kind), (d) the 5-yr pro-rata threshold opens a wider sub-7-yr territory than other states (10 fixtures in §B vs SA's 8), and (e) the new `payable_by` 90-day pay-on-termination surface (1 fixture). Bulk count matches QLD/WA/SA at 3.

---

# Single-mode test cases

## §A — APA PDF ACT worked examples (pp.109–123)

### TC-ACT-001 — 7 yrs FT taking 6.0667 weeks LSL, full first entitlement

- **Source**: APA p.110 worked example; ACT LSL Act 1976 s.4
- **Category**: Fixed-rate (s.7(1))
- **Why it matters**: Canonical "7 yrs → 6.0667 weeks" calculation — the ACT first-entitlement value. 7-year threshold is equal-lowest with VIC, but ACT's entitlement at 7 yrs (6.0667 wks) is below VIC's at-10-yrs (8.6667 wks) since VIC's 7-yr threshold pays out at the same 1/60 ratio applied to 7 yrs = 6.0667 wks.

**Inputs**

```yaml
employee:
  id: TC-ACT-001
  legalName: SamACT
  startDate: 2019-05-26
  employmentType: full_time
  statesOfService: [ACT]
  governingJurisdiction: ACT
  currentWeeklyGross: 1800.00
  wageHistory:
    - { periodStart: 2019-05-26, periodEnd: 2026-05-26, grossPay: 655200.00, frequency: weekly }
  serviceEvents: []
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 6.0667 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.0000
total_entitlement_weeks: 6.0667        # s.4 — 6.0667 wks at 7 yrs
value_of_week: 1800.00                 # s.7(1) — fixed-rate ordinary pay
value_of_day: 360.00                   # 1800 / 5 (FT 5-day week)
payable_for_taken_leave: 10920.06      # 6.0667 × 1800 (rounded to display)
expected_citations:
  - { section: ACT LSL Act 1976 s.4,  rule: accrual.qualifying-period-7yr-6.0667wks, pdfPage: 110 }
  - { section: ACT LSL Act 1976 s.7,  rule: ordinary-pay.fixed-rate, pdfPage: 111 }
  - { section: ACT LSL Act 1976 s.6,  rule: trigger.taking-leave, pdfPage: 110 }
```

**Notes**

This is the load-bearing test for the ACT 7-year qualifying threshold. The same employee profile in NSW/QLD/SA/WA returns $0 (sub-10-yr); in VIC returns 6.0667 wks at the same 1/60 ratio applied to 7 yrs. Note ACT entitlement is `(1/5 × 7) / 12 × 52 = 6.0667 wks` — derived from the statutory 1/5-month-per-year formula. Past year 10, this is equivalent to `Years × 8.6667/10`.

---

### TC-ACT-002 — 5 yrs FT illness-incapacity dismissal, pro-rata 4.3333 wks

- **Source**: APA p.111; ACT LSL Act 1976 s.11C
- **Category**: Pro-rata at termination — sub-7-yr qualifying-reason
- **Why it matters**: ACT's 5-year pro-rata threshold is the LOWEST in Australia. Illness/incapacity qualifies under s.11C.

**Inputs**

```yaml
employee:
  id: TC-ACT-002
  legalName: IllnessACT
  startDate: 2021-05-26
  endDate: 2026-05-26                    # exactly 5 yrs
  employmentType: full_time
  statesOfService: [ACT]
  governingJurisdiction: ACT
  currentWeeklyGross: 1700.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-26, reason: illness_incapacity, terminationInitiator: employee }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 5.0000
total_entitlement_weeks: 4.3333         # 5 × 0.8667 = 4.3333 (= 1/5 × 5 × 52 / 12)
value_of_week: 1700.00
total_entitlement_dollars: 7366.61       # 4.3333 × 1700
payable_by: 2026-08-24                   # terminationDate + 90 days per s.11A(4)(b)
warnings:
  - { code: act_termination_payable_within_90_days_advisory, message: "Pay-on-termination window is 90 days per ACT LSL Act 1976 s.11A(4)(b) — longest in Australia. Engine surfaces `payable_by = terminationDate + 90 days` as informational." }
expected_citations:
  - { section: ACT LSL Act 1976 s.11C, rule: accrual.5-to-7yr.illness-incapacity-qualifies, pdfPage: 111 }
  - { section: ACT LSL Act 1976 s.7,    rule: ordinary-pay.fixed-rate, pdfPage: 111 }
  - { section: ACT LSL Act 1976 s.11A(4)(b), rule: termination.payable-within-90-days, pdfPage: 112 }
```

**Notes**

Pro-rata calculation includes years AND months/12 (s.11C(2)). At exactly 5 yrs the months component is 0. Engine uses the same accrual ratio as for full entitlement at 7+ yrs (continuous at 0.8667/yr from day 0 of service in arithmetic terms; payable only at 5 yrs+ with qualifying reason gate).

---

### TC-ACT-003 — 6.33 yrs FT redundancy (employer-not-misconduct), pro-rata 5.4862 wks

- **Source**: APA p.112; ACT LSL Act 1976 s.11C
- **Category**: Pro-rata at termination — redundancy qualifies under "employer-not-misconduct"

**Inputs**

```yaml
employee:
  id: TC-ACT-003
  startDate: 2020-01-26
  endDate: 2026-05-26                    # 6 yrs 4 mo
  employmentType: full_time
  statesOfService: [ACT]
  governingJurisdiction: ACT
  currentWeeklyGross: 1500.00
trigger: { kind: termination, terminationDate: 2026-05-26, reason: redundancy }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 6.3333       # 6 yrs + 4 mo/12
total_entitlement_weeks: 5.4889           # 6.3333 × 0.8667 ≈ 5.49 (s.11C(2) — years + months/12)
value_of_week: 1500.00
total_entitlement_dollars: 8233.33
payable_by: 2026-08-24
warnings: [{ code: act_termination_payable_within_90_days_advisory }]
expected_citations:
  - { section: ACT LSL Act 1976 s.11C, rule: accrual.5-to-7yr.employer-not-misconduct, pdfPage: 112 }
```

**Notes**

APA Masterclass example (p.112): "6 years 4 months → 6 + 4/12 = 6.33 → 6.33 × 0.86667 = 5.486 wks." Fixture asserts structural correctness using months-precise input; engine MUST compute via `(years_int + months_in_year / 12) × 0.8666666...`.

---

### TC-ACT-004 — 7+ yrs FT taking leave, ordinary weekly pay derived from base + skills allowance + KPI bonus

- **Source**: APA p.113; ACT LSL Act 1976 s.7(1)
- **Category**: Fixed-rate FT with included allowances and bonus

**Inputs**

```yaml
employee:
  id: TC-ACT-004
  startDate: 2017-05-26
  employmentType: full_time
  statesOfService: [ACT]
  governingJurisdiction: ACT
  currentWeeklyGross: 2000.00              # base $1800 + skills allowance $50 + averaged KPI bonus $150
  wageHistory:
    - { periodStart: 2025-05-26, periodEnd: 2026-05-26, grossPay: 104000.00, frequency: weekly }
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 7.8 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 9.0000
total_entitlement_weeks: 7.8003           # 9 × 0.8667
value_of_week: 2000.00                    # incl. skills allowance + KPI bonus
payable_for_taken_leave: 15600.00          # 7.8 × 2000
expected_citations:
  - { section: ACT LSL Act 1976 s.7(1), rule: ordinary-pay.includes-skills-allowance-and-usually-paid-bonus, pdfPage: 113 }
```

**Notes**

Allowance and bonus inclusion documentation: WorkSafe ACT — "**Bonus, performance pay, or incentive scheme that are usually paid with salary and wages (e.g. KPI-based bonuses)**" included. Skills/qualifications allowances included. Engine trusts user-supplied `currentWeeklyGross` for v1 (no decomposition) — same convention as NSW/VIC/QLD/WA/SA.

---

### TC-ACT-005 — 10 yrs FT taking 8.6667 weeks LSL

- **Source**: APA p.114; ACT LSL Act 1976 s.4
- **Category**: Full entitlement past year 10 — verifies equivalent expression `Years × 8.6667/10`

**Inputs**

```yaml
employee:
  id: TC-ACT-005
  startDate: 2016-05-26
  endDate: 2026-05-26                      # 10 yrs
  employmentType: full_time
  statesOfService: [ACT]
  governingJurisdiction: ACT
  currentWeeklyGross: 1900.00
trigger: { kind: termination, terminationDate: 2026-05-26, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 10.0000
total_entitlement_weeks: 8.6667           # 10 × 0.8667 = 8.6667
value_of_week: 1900.00
total_entitlement_dollars: 16466.73
payable_by: 2026-08-24
warnings: [{ code: act_termination_payable_within_90_days_advisory }]
expected_citations:
  - { section: ACT LSL Act 1976 s.4, rule: accrual.continuous-0.8667-per-year, pdfPage: 114 }
```

**Notes**

At 10 yrs the ACT formula `Years × (8.6667/10)` produces 8.6667 wks — identical to NSW/QLD/WA/TAS first-entitlement. APA Masterclass note: "Both formulas yield 8.6667 wks at 10y, which is why you can also use the NSW formula for VIC/ACT past year 10." This is the boundary fixture confirming engine arithmetic produces matched outputs at the 10-year crossover regardless of which equivalent formula it internally uses. **Voluntary resignation at 10 yrs qualifies in ACT** — once the 7-yr full-entitlement threshold is crossed, the s.11C qualifying-reason gate falls away.

---

### TC-ACT-006 — 7 yrs PT taking 6.0667 weeks, 12-mo hours average

- **Source**: APA p.115; ACT LSL Act 1976 s.7(2)
- **Category**: PT with 12-mo averaging window (s.7(2))
- **Why it matters**: PT/casual averaging anchored at entitlement date per s.7(2). Hours include overtime; rate excludes overtime.

**Inputs**

```yaml
employee:
  id: TC-ACT-006
  startDate: 2019-05-26
  employmentType: part_time
  statesOfService: [ACT]
  governingJurisdiction: ACT
  currentHourlyRate: 35.00                 # ordinary base rate (no overtime, no penalty)
  hoursLast12MonthsBeforeEntitlement: 1300 # base hours 1200 + 100 overtime hours
  extraInputs:
    act_overtime_hours_by_period:
      - { periodStart: 2025-05-26, periodEnd: 2026-05-26, hours: 100 }
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 6.0667 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.0000
total_entitlement_weeks: 6.0667
weekly_avg_12mo_taking: 25.00              # 1300 / 52 = 25 h/wk (INCLUDES overtime hours)
value_of_week: 875.00                      # 25 × $35 (rate EXCLUDES overtime premium)
payable_for_taken_leave: 5308.36           # 6.0667 × 875
warnings:
  - { code: act_overtime_included_in_hours_average, message: "Overtime hours (100 hrs) included in the s.7(2) 12-month casual/PT hours-averaging window. Rate excludes overtime premium per s.7(1). Window anchored at the date the employee first reached the 7-year LSL entitlement." }
expected_citations:
  - { section: ACT LSL Act 1976 s.4,    rule: accrual.qualifying-period-7yr-6.0667wks, pdfPage: 115 }
  - { section: ACT LSL Act 1976 s.7(2), rule: ordinary-pay.part-time-12mo-average-hours-include-overtime-rate-excludes, pdfPage: 115 }
```

**Notes**

**F9/AC11 reference fixture.** Per WorkSafe ACT — "Average Weekly Hours = Total Hours Worked before the entitlement date in the last 12 months / 52 (**include overtime hours**)" — note this is hours-averaging only; the rate applied (s.7(1)) does NOT include overtime premium. **Asymmetric — parallel to SA 156-wk pattern.** Engine MUST sum `act_overtime_hours_by_period` hours into the 12-mo window total alongside base hours, but apply only the base hourly rate (excluding penalty/overtime premium). This is the load-bearing fixture for the spec's F9/AC11 ACT-overtime-inclusive rule.

---

### TC-ACT-007 — 8 yrs casual taking 6.9333 weeks, 12-mo hours average + casual loading

- **Source**: APA p.116; ACT LSL Act 1976 s.7(2)
- **Category**: Casual with 12-mo averaging + 25% casual loading

**Inputs**

```yaml
employee:
  id: TC-ACT-007
  startDate: 2018-05-26
  employmentType: casual
  statesOfService: [ACT]
  governingJurisdiction: ACT
  currentHourlyRate: 40.00                 # base $32 + 25% casual loading
  hoursLast12MonthsBeforeEntitlement: 1664 # 32 h/wk × 52 wks
  extraInputs:
    act_overtime_hours_by_period: []        # no overtime in window
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 6.9333 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 8.0000
total_entitlement_weeks: 6.9333            # 8 × 0.8667
weekly_avg_12mo_taking: 32.00              # 1664 / 52
value_of_week: 1280.00                     # 32 × $40 (loaded casual rate)
payable_for_taken_leave: 8874.62            # 6.9333 × 1280
expected_citations:
  - { section: ACT LSL Act 1976 s.7(2), rule: ordinary-pay.casual-12mo-average-with-loading, pdfPage: 116 }
```

**Notes**

Casual loading (25%) is included in the hourly rate. The averaging is over the 12 months immediately before the entitlement date — for an employee whose 7-yr entitlement crystallised on 2025-05-26, the window is 2024-05-26 → 2025-05-26. **NOTE for engine implementation**: if entitlement date is unclear (e.g. the user hasn't supplied a precise milestone date), the orchestrator MUST resolve "the date the employee first reached the 7-year LSL entitlement" as `startDate + 7 years` (the natural anniversary). This decision is captured in TBD-ACT-03.

---

### TC-ACT-008 — 8 yrs commission-only, 12-mo income lookback (s.2F)

- **Source**: APA p.117; ACT LSL Act 1976 s.2F
- **Category**: Commission / piece — 12-mo income window divided by 52

**Inputs**

```yaml
employee:
  id: TC-ACT-008
  startDate: 2018-05-26
  employmentType: full_time
  statesOfService: [ACT]
  governingJurisdiction: ACT
  wageHistory:
    - { periodStart: 2025-05-26, periodEnd: 2026-05-26, grossPay: 156000.00, frequency: weekly, note: "commission-only" }
trigger: { kind: termination, terminationDate: 2026-05-26, reason: redundancy }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 8.0000
total_entitlement_weeks: 6.9333
value_of_week: 3000.00                     # 156000 / 52 per s.2F
total_entitlement_dollars: 20800.00
payable_by: 2026-08-24
warnings: [{ code: act_termination_payable_within_90_days_advisory }]
expected_citations:
  - { section: ACT LSL Act 1976 s.2F, rule: ordinary-pay.commission-12mo-income-divided-by-52, pdfPage: 117 }
```

**Notes**

s.2F formula per WorkSafe ACT — "Commission included via `total / 52`". Bonuses already paid as part of regular salary remain in the figure; if the user supplies a $7000 KPI bonus separately, it MAY be added to the commission income; v1 conservatively trusts the user-supplied `wageHistory.grossPay` and does not decompose.

---

### TC-ACT-009 — 11 yrs FT death, 9.5333 wks payable to personal representative within 90 days

- **Source**: APA p.118; ACT LSL Act 1976 s.11C (death qualifying reason) + s.11A(4)(b)
- **Category**: Death termination

**Inputs**

```yaml
employee:
  id: TC-ACT-009
  startDate: 2015-05-26
  endDate: 2026-05-26
  employmentType: full_time
  statesOfService: [ACT]
  governingJurisdiction: ACT
  currentWeeklyGross: 1700.00
trigger: { kind: termination, terminationDate: 2026-05-26, reason: death }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 11.0000
total_entitlement_weeks: 9.5337            # 11 × 0.8667 (continuous past 7 yrs)
value_of_week: 1700.00
total_entitlement_dollars: 16207.29
payment_recipient: "personal representative of the deceased worker"
payable_by: 2026-08-24                     # cessationDate + 90 days
warnings: [{ code: act_termination_payable_within_90_days_advisory }]
expected_citations:
  - { section: ACT LSL Act 1976 s.11C, rule: trigger.termination.death, pdfPage: 118 }
  - { section: ACT LSL Act 1976 s.11A(4)(b), rule: termination.payable-within-90-days, pdfPage: 112 }
```

**Notes**

Death is a qualifying reason for pro-rata at 5+ yrs under s.11C; at 7+ yrs the full s.4 entitlement is payable. The 90-day window applies. Engine MUST surface `payable_by` informationally — the executor/estate has 90 days to receive the payment per the Act, not the day of death.

---

## §B — Sub-5-year and 5–7-year qualifying-reason cases (s.11C)

### TC-ACT-010 — 4.9 yrs FT illness, NO entitlement (sub-5-yr cliff)

```yaml
employee: { startDate: 2021-06-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1700.00, statesOfService: [ACT], governingJurisdiction: ACT }
trigger: { kind: termination, reason: illness_incapacity, terminationInitiator: employee, terminationDate: 2026-05-26 }
expected:
  total_entitlement_weeks: 0
  total_entitlement_dollars: 0
  warnings: [{ code: sub_5yr_no_entitlement_act, message: "Below 5 years of continuous service. No pro-rata entitlement is payable under ACT LSL Act 1976 s.11C. The 5-year threshold is the universal floor in ACT — even for illness/death/retirement, which qualify at 5+ yrs." }]
  expected_citations:
    - { section: ACT LSL Act 1976 s.11C, rule: accrual.sub-5yr-no-entitlement }
```

---

### TC-ACT-011 — 5.5 yrs FT voluntary resignation, NO entitlement (no qualifying reason in 5–7 yr band)

```yaml
employee: { startDate: 2020-11-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1500.00 }
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  total_entitlement_weeks: 0
  warnings:
    - { code: sub_7yr_no_qualifying_reason_act, message: "Voluntary resignation at 5-7 years does NOT qualify for pro-rata under ACT LSL Act 1976 s.11C. Qualifying reasons in this band are: illness/incapacity, domestic or pressing necessity, retirement (award/agreement OR 65), death, employer-not-misconduct. Voluntary resignation is NOT among them. Compare to SA/WA which pay out at 7+ regardless of reason; ACT diverges." }
```

**Notes**: Confirms ACT-specific divergence from SA/WA — voluntary resignation in the 5–7-yr band does NOT pay out in ACT. The qualifying-reason gate is tighter than SA/WA but the threshold is LOWER (5 yrs vs 7).

---

### TC-ACT-012 — 6 yrs FT domestic-pressing-necessity, pro-rata 5.2 wks

```yaml
employee: { startDate: 2020-05-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1500.00 }
trigger: { kind: termination, reason: domestic_pressing_necessity, terminationInitiator: employee }
expected: { total_entitlement_weeks: 5.2000, total_entitlement_dollars: 7800.00 }
```

**Notes**: 6 × 0.8667 = 5.2000. Domestic-pressing-necessity qualifies under s.11C (employee-initiated only).

---

### TC-ACT-013 — 6.5 yrs FT retirement at 65, pro-rata 5.6333 wks

```yaml
employee: { startDate: 2019-11-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1700.00, dob: 1961-05-26 }
trigger: { kind: termination, reason: retirement }
expected: { total_entitlement_weeks: 5.6333, total_entitlement_dollars: 9576.61 }
```

**Notes**: Retirement at 65 qualifies under s.11C (per the "minimum retirement age — per award/agreement, or 65" rule). Engine reads `employee.dob` (when provided) — if dob makes the employee 65+ at the termination date, retirement qualifies. v1: requires `dob` to be supplied; if absent, falls back to `extraInputs.act_award_min_retirement_age_reached: boolean` for sub-65 award-based cases. See TBD-ACT-07.

---

### TC-ACT-014 — 6 yrs FT retirement under award-specified min age 60, pro-rata 5.2 wks

```yaml
employee:
  startDate: 2020-05-26
  endDate: 2026-05-26
  employmentType: full_time
  currentWeeklyGross: 1700.00
  dob: 1965-05-26
  extraInputs:
    act_award_min_retirement_age_reached: true
trigger: { kind: termination, reason: retirement }
expected: { total_entitlement_weeks: 5.2000, total_entitlement_dollars: 8840.00 }
```

**Notes**: Sub-65 retirement qualifying via award/agreement minimum age. Engine reads `extraInputs.act_award_min_retirement_age_reached` as the qualifying signal.

---

### TC-ACT-015 — 5.5 yrs FT retirement at 62 (no award-specified min age), NO entitlement

```yaml
employee: { startDate: 2020-11-26, employmentType: full_time, dob: 1964-05-26, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: retirement }
expected:
  total_entitlement_weeks: 0
  warnings:
    - { code: sub_7yr_no_qualifying_reason_act, message: "Retirement at 62 does not qualify under s.11C — minimum retirement age is per award/agreement OR 65. No award-specified minimum retirement age reached signal (`extraInputs.act_award_min_retirement_age_reached`) was supplied." }
```

---

### TC-ACT-016 — 6 yrs FT unfair dismissal, pro-rata 5.2 wks (employer-not-misconduct)

```yaml
employee: { startDate: 2020-05-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: unfair_dismissal, terminationInitiator: employer }
expected: { total_entitlement_weeks: 5.2000, total_entitlement_dollars: 8840.00 }
```

**Notes**: Unfair dismissal is treated as "employer-not-misconduct" under s.11C. Engine maps the existing `unfair_dismissal` enum value (introduced in DEV-CROSS-1) to the s.11C employer-not-misconduct branch for ACT.

---

### TC-ACT-017 — 6 yrs FT employer-initiated-not-misconduct dismissal, pro-rata 5.2 wks

```yaml
employee: { startDate: 2020-05-26, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: employer_initiated_not_misconduct, terminationInitiator: employer }
expected: { total_entitlement_weeks: 5.2000 }
```

---

### TC-ACT-018 — 6 yrs FT poor-performance dismissal, NO entitlement

```yaml
employee: { startDate: 2020-05-26, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: poor_performance, terminationInitiator: employer }
expected:
  total_entitlement_weeks: 0
  warnings:
    - { code: sub_7yr_no_qualifying_reason_act, message: "Poor-performance dismissal at 5–7 years does NOT qualify under ACT LSL Act 1976 s.11C — poor performance is distinct from employer-not-misconduct (which is a clean redundancy or similar without conduct/capacity concerns). Engine treats poor_performance as a non-qualifying capacity-based reason." }
```

**Notes**: Interpretation parallel to QLD s.95(3)(d) which explicitly excludes performance from the qualifying-reason list. ACT s.11C does not name performance among qualifying reasons; engine treats it as non-qualifying. **TBD-ACT-07 secondary interpretation point**: confirm operator agrees with the QLD-parallel treatment.

---

### TC-ACT-019 — 6 yrs casual death, pro-rata 5.2 wks at 12-mo hours average

```yaml
employee:
  startDate: 2020-05-26
  endDate: 2026-05-26
  employmentType: casual
  currentHourlyRate: 38.00
  hoursLast12MonthsBeforeCessation: 1456     # avg 28 h/wk
trigger: { kind: termination, reason: death }
expected:
  total_entitlement_weeks: 5.2000             # 6 × 0.8667
  weekly_avg_12mo_termination: 28.00          # s.11D anchor (12 mo before cessation, not entitlement)
  value_of_week: 1064.00                       # 28 × $38
  total_entitlement_dollars: 5532.80
  payment_recipient: "personal representative of the deceased worker"
```

**Notes**: Death is a qualifying reason at 5+ yrs under s.11C. Engine routes casual averaging via **s.11D** (cessation anchor — 12 mo before cessation), NOT s.7(2). This is the first fixture demonstrating the trigger-kind-drives-anchor rule (TBD-ACT-03).

---

## §C — 7+ year full payout (s.4) — including misconduct at 7+

### TC-ACT-020 — 7 yrs exactly FT misconduct dismissal, **FULL 6.0667 WEEKS payable**

- **Source**: ACT LSL Act 1976 s.4; WorkSafe ACT — "full entitlement vests after 7 years"
- **Category**: 7+ yr full payout regardless of reason
- **Why it matters**: **CRITICAL ACT-vs-WA divergence.** ACT does NOT have a partial-forfeiture rule at 7+ yr misconduct. The full entitlement is payable. Parallel to NSW/VIC/QLD/SA.

**Inputs**

```yaml
employee:
  startDate: 2019-05-26
  endDate: 2026-05-26                        # exactly 7 yrs
  employmentType: full_time
  statesOfService: [ACT]
  governingJurisdiction: ACT
  currentWeeklyGross: 1800.00
trigger: { kind: termination, reason: serious_misconduct, terminationDate: 2026-05-26 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.0000
total_entitlement_weeks: 6.0667             # FULL — not partial
value_of_week: 1800.00
total_entitlement_dollars: 10920.06
payable_by: 2026-08-24
warnings:
  - { code: act_7yr_plus_misconduct_full_payout, message: "Dismissal for serious & wilful misconduct at 7+ years of continuous service. Under ACT LSL Act 1976 s.4, the full 6.0667-week (or higher) entitlement is payable regardless of termination reason — ACT does NOT mirror WA s.8(3) partial-forfeiture. The serious-misconduct exception in ACT applies ONLY to the pro-rata branch (5-7 yrs), not to the full-entitlement branch." }
  - { code: act_termination_payable_within_90_days_advisory }
expected_citations:
  - { section: ACT LSL Act 1976 s.4, rule: accrual.7yr-full-entitlement-regardless-of-reason }
```

**Notes**

Critical divergence. WA partial-forfeits at 10+ yr misconduct (TC-WA-026 / TC-WA-027). ACT does NOT — ACT pays out the full s.4 entitlement, including continuous-accrual portion past the 7-yr milestone. The misconduct exception in ACT s.11C is explicitly worded for the pro-rata branch (5–7 yrs); once the worker has crossed the 7-yr threshold under s.4, misconduct does not reduce the entitlement.

---

### TC-ACT-021 — 12 yrs FT misconduct dismissal, **FULL 10.4 weeks payable**

```yaml
employee: { startDate: 2014-05-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: serious_misconduct }
expected:
  total_entitlement_weeks: 10.4004           # 12 × 0.8667 (continuous accrual)
  total_entitlement_dollars: 17680.68
  warnings: [{ code: act_7yr_plus_misconduct_full_payout }]
```

---

### TC-ACT-022 — 7 yrs PT death, **FULL 6.0667 weeks to personal representative**

```yaml
employee:
  startDate: 2019-05-26
  employmentType: part_time
  hoursLast12MonthsBeforeCessation: 1040    # avg 20 h/wk
  currentHourlyRate: 36.00
trigger: { kind: termination, reason: death }
expected:
  total_entitlement_weeks: 6.0667
  weekly_avg_12mo_termination: 20.00
  value_of_week: 720.00                      # 20 × $36 (s.11D anchor — cessation)
  total_entitlement_dollars: 4368.02
  payment_recipient: "personal representative of the deceased worker"
```

---

### TC-ACT-023 — 7.001 yrs FT voluntary resignation, 6.0754 weeks

```yaml
employee: { startDate: 2019-05-25, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1800.00 }  # 7 yrs + 1 day
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  total_entitlement_weeks: 6.0754            # 7.0027 × 0.8667 — day-precise
  total_entitlement_dollars: 10935.66
```

**Notes**: Confirms accrual is day-precise past the 7-yr threshold, not snapped to integer-anniversary 6.0667.

---

### TC-ACT-024 — 7 yrs less 1 day FT voluntary resignation, $0 (sub-7-yr no-qualifying-reason cliff)

```yaml
employee: { startDate: 2019-05-27, endDate: 2026-05-26, employmentType: full_time }  # 1 day short of 7 yrs
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  total_entitlement_weeks: 0
  warnings: [{ code: sub_7yr_no_qualifying_reason_act }]
```

**Notes**: Mirror of TC-ACT-023 just below the 7-yr threshold. The cliff at exactly 7.0000 yrs is binary in ACT for non-qualifying reasons (voluntary resignation, misconduct).

---

## §D — Serious & wilful misconduct treatment (s.11C)

### TC-ACT-025 — 5.5 yrs FT serious misconduct, $0

```yaml
employee: { startDate: 2020-11-26, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: serious_misconduct }
expected:
  total_entitlement_weeks: 0
  warnings: [{ code: sub_7yr_misconduct_excluded_act, message: "Dismissal for serious and wilful misconduct under ACT LSL Act 1976 s.11C — at sub-7-year tenure, no pro-rata entitlement is payable. At 7+ years, the full entitlement is payable regardless of reason (ACT mirrors NSW/VIC/QLD/SA; ACT does NOT mirror WA partial-forfeiture). See TC-ACT-020." }]
```

---

### TC-ACT-026 — 6.9 yrs FT serious misconduct, $0

```yaml
employee: { startDate: 2019-06-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: termination, reason: serious_misconduct }
expected:
  total_entitlement_weeks: 0
  warnings: [{ code: sub_7yr_misconduct_excluded_act }]
```

---

### TC-ACT-027 — 8 yrs FT serious misconduct, FULL 6.9333 weeks (10+yr WA partial-forfeiture does NOT apply)

```yaml
employee: { startDate: 2018-05-26, employmentType: full_time, currentWeeklyGross: 1700.00 }
trigger: { kind: termination, reason: serious_misconduct }
expected:
  total_entitlement_weeks: 6.9333             # 8 × 0.8667
  warnings: [{ code: act_7yr_plus_misconduct_full_payout }]
```

---

## §E — Continuous service edge cases (s.2G)

### TC-ACT-028 — Unpaid leave 12 wks; doesn't count as service but does not break continuity

```yaml
employee:
  startDate: 2019-02-26
  endDate: 2026-05-26                        # nominal 7 yrs 3 mo
  employmentType: full_time
  serviceEvents:
    - { type: leave_without_pay, startDate: 2022-01-01, endDate: 2022-03-26 }  # 12 wks UPL
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 6.0667 }
expected:
  years_of_continuous_service: 7.0000        # 7 yrs 3 mo − 12 wks UPL ≈ 7.0
  total_entitlement_weeks: 6.0667
```

**Notes**: Per s.2G, unpaid leave does NOT count as service but does NOT necessarily break continuity (case-by-case). v1 treats UPL as not-counting toward service days; engine pushes the entitlement date out by the UPL duration. **TBD-ACT-13** (Sev-3): confirm engine heuristic for case-by-case break test.

---

### TC-ACT-029 — Paid parental leave does NOT count as service (ACT divergence from SA/VIC)

```yaml
employee:
  startDate: 2016-05-26
  endDate: 2026-05-26
  serviceEvents:
    - { type: paid_leave, startDate: 2020-01-01, endDate: 2020-07-01, note: "paid parental — company-paid parental + Government Paid Parental Leave" }  # 26 wks
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  years_of_continuous_service: 9.5000         # 10 yrs − 26 wks paid parental
  total_entitlement_weeks: 8.2334             # 9.5 × 0.8667
  warnings:
    - { code: sa_or_act_parental_leave_excluded, message: "Paid parental leave (Company-Paid Parental + Government Paid Parental Leave) does NOT count as service under ACT LSL Act 1976 s.2G. This diverges from NSW/SA (which count company-paid parental) and from VIC post-2018 (which counts the first 52 wks)." }
```

**Notes**: **ACT-specific divergence — load-bearing.** WorkSafe ACT explicitly lists paid parental leave (Company-paid AND Government-paid) in the "does NOT count" column of s.2G. This is the second ACT divergence beyond overtime — the engine MUST NOT treat parental leave as service-counting for ACT. **TBD-ACT-15** (Sev-2): confirm operator agrees with this strict reading, and that the warning code naming (act_parental_leave_excluded vs the proposed cross-state form) is correct.

---

### TC-ACT-030 — Re-employment within 2 months preserves continuity

```yaml
employee:
  startDate: 2017-05-26
  serviceEvents:
    - { type: employer_initiated_termination_and_rehire, startDate: 2022-05-26, endDate: 2022-07-15 }  # 51-day gap
trigger: { kind: termination, reason: redundancy, terminationDate: 2026-05-26 }
expected:
  years_of_continuous_service: 8.8603
  total_entitlement_weeks: 7.6797            # 8.86 × 0.8667
```

---

### TC-ACT-031 — Re-employment after 3 months (>2 mo, non-slackness) breaks continuity

```yaml
employee:
  startDate: 2017-05-26
  serviceEvents:
    - { type: employer_initiated_termination_and_rehire, startDate: 2022-05-26, endDate: 2022-09-26 }
trigger: { kind: termination, reason: redundancy, terminationDate: 2026-05-26 }
expected:
  years_of_continuous_service: 3.6657
  total_entitlement_weeks: 0
  warnings: [{ code: gap_exceeds_state_tolerance, message: "Re-employment gap of 4 months exceeds ACT's 2-month non-slackness tolerance under s.2G(2)(e). Pre-gap service forfeited." }]
```

---

### TC-ACT-032 — Re-employment after 5 months following SLACKNESS OF TRADE, preserves continuity (s.2G(2)(b))

```yaml
employee:
  startDate: 2017-05-26
  serviceEvents:
    - type: employer_initiated_termination_and_rehire
      startDate: 2022-05-26
      endDate: 2022-10-26                    # 5-month gap
      slacknessOfTrade: true                  # DEV-CROSS-2 field
trigger: { kind: termination, reason: redundancy, terminationDate: 2026-05-26 }
expected:
  years_of_continuous_service: 8.5836
  total_entitlement_weeks: 7.4399
  warnings:
    - { code: act_slackness_of_trade_continuity_preserved, message: "Re-employment within 6 months following slackness-of-trade stand-down preserves continuity per ACT LSL Act 1976 s.2G(2)(b). Gap days do not count as service." }
```

**Notes**: REUSES DEV-CROSS-2 `slacknessOfTrade` flag added for WA. Same 6-month tolerance as WA. **No new schema work for ACT** — the cross-state field already exists. **TBD-ACT-16** (Sev-3): confirm new warning code name `act_slackness_of_trade_continuity_preserved` is preferred over reusing the WA code.

---

### TC-ACT-033 — Sickness 2 wks/year counted in full; excess does NOT count

```yaml
employee:
  startDate: 2018-05-26
  endDate: 2026-05-26                         # 8 yrs
  serviceEvents:
    - { type: paid_leave, startDate: 2024-01-01, endDate: 2024-03-31, note: "sick leave 90 days = ~13 wks" }
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  years_of_continuous_service: 7.7882         # 8 yr − 11 wks (= 13 wks − 2 wks counted)
  total_entitlement_weeks: 6.7493
  warnings:
    - { code: act_sickness_excess_2wk_excluded, message: "Sick leave in excess of 2 weeks per year does NOT count toward continuous service per ACT LSL Act 1976 s.2G. 2 weeks counted; 11 weeks excluded." }
```

**Notes**: ACT-specific. The 2-wks/year cap is uncommon — only NT also caps sickness at 2 wks/yr; most states count it in full. **TBD-ACT-17** (Sev-2): confirm engine arithmetic — "per service year" (calendar year aligned with start date) vs "per calendar year". Recommend service-year aligned (matches WA pre-2022 15-day cap pattern per TBD-WA-09 RESOLVED).

---

### TC-ACT-034 — Apprentice → contract within 12 months preserves continuity

```yaml
employee:
  startDate: 2017-05-26
  serviceEvents:
    - { type: apprentice_to_tradesperson_transition, startDate: 2022-05-26, endDate: 2022-12-26 }  # 7-month gap
trigger: { kind: termination, reason: voluntary_resignation, terminationDate: 2026-05-26 }
expected:
  years_of_continuous_service: 8.4192
  total_entitlement_weeks: 7.2998
  warnings: []
```

---

### TC-ACT-035 — Industrial action does NOT count toward service, does NOT break continuity

```yaml
employee:
  startDate: 2018-05-26
  serviceEvents:
    - { type: industrial_action, startDate: 2024-06-01, endDate: 2024-07-01 }   # 4 weeks
trigger: { kind: termination, reason: voluntary_resignation, terminationDate: 2026-05-26 }
expected:
  years_of_continuous_service: 7.9231         # 8 yr − 4 wks
  total_entitlement_weeks: 6.8678
```

---

## §F — Workers Comp dual regime — 9 June 2023 cliff (F8-equivalent for ACT)

### TC-ACT-036 — WC absence entirely PRE-9-June-2023 — 2-week-per-year cap applied

- **Source**: ACT LSL Act 1976 s.2G + s.10A (pre-9-June-2023); WorkSafe ACT
- **Category**: Workers Comp dual regime — pre-cutoff
- **Why it matters**: ACT WC dual regime mirrors WA's pre/post-2024-07-01 pattern. Pre-9-June-2023 WC absences count only up to 2 weeks per service year.

**Inputs**

```yaml
employee:
  id: TC-ACT-036
  startDate: 2016-05-26
  endDate: 2026-05-26                        # 10 yrs
  employmentType: full_time
  statesOfService: [ACT]
  governingJurisdiction: ACT
  currentWeeklyGross: 1800.00
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2021-06-01, endDate: 2021-11-30 }  # 26 wks WC, pre-cutoff
trigger: { kind: termination, terminationDate: 2026-05-26, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 9.5385          # 10 yr − (26 wks − 2 wks counted) = 10 − 24 wks
total_entitlement_weeks: 8.2700              # 9.5385 × 0.8667
value_of_week: 1800.00
total_entitlement_dollars: 14886.00
warnings:
  - { code: act_workers_comp_pre_9jun2023_capped, message: "Workers compensation absence of 26 weeks pre-9-June-2023 — 2 weeks counted as service per ACT LSL Act 1976 s.2G; 24 weeks excluded. From 9 June 2023, WC absences count as service in full per WC Act 1951 (ACT) s.46 amendment." }
expected_citations:
  - { section: ACT LSL Act 1976 s.2G, rule: continuous-service.workers-comp-pre-9jun2023-capped-at-2wks-per-yr }
```

**Notes**

Per WorkSafe ACT: "Prior to 9 June 2023, Workers Comp leave taken did NOT count as service once employee exceeded 2 weeks/year due to illness/injury." Engine arithmetic: 2 weeks counted in service-year 2021–22; 24 weeks excluded. **TBD-ACT-05** (Sev-2): confirm cap interpretation — "per service year" (aligned with start anniversary) vs "per calendar year". Recommend service-year aligned.

---

### TC-ACT-037 — WC absence entirely POST-9-June-2023 — counts in full

```yaml
employee:
  startDate: 2016-05-26
  endDate: 2026-05-26
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2024-06-01, endDate: 2024-11-30 }  # 26 wks WC, post-cutoff
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  years_of_continuous_service: 10.0000        # WC counts in full
  total_entitlement_weeks: 8.6667
  warnings:
    - { code: act_workers_comp_post_9jun2023_counts, message: "Workers compensation absence of 26 weeks from 9 June 2023 counts as service in full per ACT LSL Act 1976 s.10A and WC Act 1951 (ACT) s.46 amendment." }
  expected_citations:
    - { section: WC Act 1951 (ACT) s.46, rule: workers-comp-counts-from-9jun2023, note: "Act-level citation only in v1 per documented limitation pending RES-3 quarterly review (parallel to TBD-WA-02)" }
```

---

### TC-ACT-038 — WC absence STRADDLING 9 June 2023 — split into pre/post segments

```yaml
employee:
  startDate: 2016-05-26
  endDate: 2026-05-26
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2023-03-01, endDate: 2023-09-30 }  # 31 wks straddling
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  years_of_continuous_service: 9.7308          # 10 yr − (14 wks pre-cutoff − 2 wks counted) = 10 − 12 wks
  warnings:
    - { code: act_workers_comp_regime_split_applied, message: "Workers compensation absence straddles 9 June 2023. Pre-cutoff portion (14 wks, 2 wks counted) capped per s.2G; post-cutoff portion (17 wks) counts in full per WC Act 1951 (ACT) s.46." }
  expected_citations:
    - { section: ACT LSL Act 1976 s.2G, rule: workers-comp-pre-9jun2023-capped }
    - { section: WC Act 1951 (ACT) s.46, rule: workers-comp-counts-from-9jun2023 }
```

**Notes**: Parallel to WA's TC-WA-046–049 fixtures for the 2024-07-01 sub-cutoff. ACT date-aware override is simpler than WA's because there are only two rules (pre-cap, post-counts-in-full), not three (pre-2022, post-2022, WCIM 2024).

---

### TC-ACT-039 — WC absence on the cutoff date 9 June 2023 — first day counts as post-cutoff (strict "on or after")

```yaml
employee:
  startDate: 2016-05-26
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2023-06-09, endDate: 2023-12-09 }  # 26 wks starting on cutoff
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  years_of_continuous_service: 10.0000         # all 26 wks count in full from cutoff onwards
  warnings: [{ code: act_workers_comp_post_9jun2023_counts }]
```

**Notes**: Cutoff inclusivity follows WA TBD-WA-11 RESOLVED pattern — ON the cutoff date is treated as post-cutoff (strict "on or after"). **TBD-ACT-05 sub-point**: confirm.

---

### TC-ACT-040 — Multiple WC absences pre + post cutoff

```yaml
employee:
  startDate: 2016-05-26
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2021-06-01, endDate: 2021-11-30 }  # 26 wks pre-cutoff
    - { type: workers_comp_absence, startDate: 2024-06-01, endDate: 2024-09-01 }  # 13 wks post-cutoff
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  years_of_continuous_service: 9.5385           # 10 yr − 24 wks pre-cutoff excess (2 counted from 26)
  warnings:
    - { code: act_workers_comp_pre_9jun2023_capped }
    - { code: act_workers_comp_post_9jun2023_counts }
```

---

### TC-ACT-041 — WC absence with paidConcurrent flag (DEV-CROSS-2) — does it apply to ACT?

```yaml
employee:
  startDate: 2018-05-26
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2022-01-01, endDate: 2022-03-31, paidConcurrent: true }   # 13 wks pre-cutoff, paid concurrently
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  years_of_continuous_service: 8.0000           # WA's paidConcurrent exception doesn't apply to ACT's regime — pre-cutoff 13 wks reduced to 2 wks counted
  warnings:
    - { code: act_workers_comp_pre_9jun2023_capped }
```

**Notes**: **Engine policy decision (TBD-ACT-06, Sev-2)**: WA's `paidConcurrent` and `returnToWorkProgram` DEV-CROSS-2 flags do NOT apply to ACT's pre-9-June-2023 regime — they're WA-specific exceptions to the pre-2024-07-01 WA exclusion rule. ACT's pre-9-June-2023 cap is hard-anchored to the 2-wk/year limit regardless. v1 ACT orchestrator ignores `paidConcurrent` / `returnToWorkProgram`.

---

## §G — Public holidays EXCLUSIVE in LSL period (s.9)

### TC-ACT-042 — 7 wks LSL period with 4 PHs falling within → leave EXTENDED by 4 days

- **Source**: ACT LSL Act 1976 s.9; WorkSafe ACT — "PH not counted as LSL day; leave extended"
- **Category**: Taking-leave, PH-during-LSL — **PH-EXCLUSIVE**
- **Why it matters**: ACT mirrors NSW/VIC/QLD/WA/TAS on PH-exclusive treatment. OPPOSITE to SA's inclusive treatment.

**Inputs**

```yaml
employee:
  id: TC-ACT-042
  startDate: 2019-05-26
  employmentType: full_time
  statesOfService: [ACT]
  governingJurisdiction: ACT
  currentWeeklyGross: 1800.00
trigger:
  kind: taking_leave
  leaveStartDate: 2026-12-21                   # spans Christmas Day + Boxing Day + NYD + Australia Day (4 ACT PHs)
  leaveWeeks: 7.0
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.5836
total_entitlement_weeks: 6.5755               # 7.58 × 0.8667
leave_start: 2026-12-21
leave_end_calendar: 2027-02-13                # 7 wks + 4 days (extended)
phs_within_leave_count: 4                     # informational
value_of_week: 1800.00
payable_for_taken_leave: 12600.00              # 7 × 1800 (paid only for 7 wks of LSL; PHs paid separately at PH rate)
expected_citations:
  - { section: ACT LSL Act 1976 s.9, rule: trigger.taking-leave.ph-exclusive-extends-leave }
```

**Notes**

This is the F11-equivalent for ACT. ACT public holidays observed: 12 standard ACT PHs (NYD, Australia Day, Canberra Day [second Monday in March — ACT-unique], Good Friday, Easter Saturday, Easter Sunday, Easter Monday, Anzac Day, Reconciliation Day [Monday closest to 27 May — ACT-unique], King's Birthday, Labour Day, Christmas Day, Boxing Day). **TBD-ACT-09**: hardcode the ACT PH list from Public Holidays Act 1958 (ACT) into `website/src/lib/lsl/states/act/rules/public-holidays.ts`. Re-validate annually per RES-3 quarterly review.

---

### TC-ACT-043 — 4 wks LSL period over Easter (Good Fri + Easter Mon = 2 ACT PHs) → leave extended by 2 days

```yaml
employee: { startDate: 2019-05-26, currentWeeklyGross: 1500.00 }
trigger: { kind: taking_leave, leaveStartDate: 2027-03-29, leaveWeeks: 4.0 }
expected:
  leave_end_calendar: 2027-04-28
  phs_within_leave_count: 2
  payable_for_taken_leave: 6000.00              # 4 × 1500
```

---

### TC-ACT-044 — Single-day LSL falling on a PH → NOT consumed (PH-exclusive)

```yaml
employee: { startDate: 2019-05-26, currentWeeklyGross: 1800.00 }
trigger: { kind: taking_leave, leaveStartDate: 2027-01-26, leaveWeeks: 0.2 }  # Australia Day (ACT PH)
expected:
  leave_days_consumed: 0
  leave_end_calendar: 2027-01-27                # Single day leave NOT charged; LSL day shifted to next non-PH
  warnings:
    - { code: act_single_day_lsl_on_ph_exclusive, message: "Single-day LSL request on a public holiday — under ACT s.9 PH-exclusive rule, the day is NOT counted as LSL. The LSL day shifts to the next non-PH working day. Worker is paid PH rate for the original day per award." }
  payable_for_taken_leave: 360.00                # 1 day shifted to 2027-01-27; 1800 / 5 = 360
```

**Notes**: TBD-ACT-10 (Sev-3): confirm engine treats single-day-on-PH as shifting to next non-PH working day (vs no-op + 0 charge). Recommended: shift to next non-PH. The "engine charges the LSL day on a different day" semantics is a slight engine complexity. Operator decision needed.

---

## §H — Ordinary pay (s.7 — including allowances + bonus inclusion)

### TC-ACT-045 — Fixed-rate FT, current weekly gross = value of week

```yaml
employee: { employmentType: full_time, currentWeeklyGross: 2000.00 }
trigger: { kind: taking_leave }
expected: { value_of_week: 2000.00, value_of_day: 400.00 }
```

---

### TC-ACT-046 — Fixed-rate FT with skills + first-aid allowance INCLUDED in ordinary pay

```yaml
employee: { employmentType: full_time, currentWeeklyGross: 2050.00 }  # base 2000 + first-aid 50
trigger: { kind: taking_leave }
expected:
  value_of_week: 2050.00
  warnings:
    - { code: act_skills_allowance_included, message: "Skills/qualifications allowances (e.g. First Aid, All-Purpose Allowances) included in ordinary pay per ACT LSL Act 1976 s.7(1). Allowances not paid for all purposes are excluded." }
```

---

### TC-ACT-047 — Fixed-rate FT with KPI bonus usually paid with salary INCLUDED

```yaml
employee: { employmentType: full_time, currentWeeklyGross: 2150.00 }  # base 2000 + averaged KPI bonus 150
trigger: { kind: taking_leave }
expected:
  value_of_week: 2150.00
  warnings:
    - { code: act_bonus_usually_paid_with_salary_included, message: "Bonus/performance pay/incentive scheme usually paid with salary and wages (e.g. KPI bonuses) included in ordinary pay per ACT LSL Act 1976 s.7(1). Diverges from NSW (4-criteria + high-income test) and TAS (absolute exclusion s.11(2)(h))." }
```

---

### TC-ACT-048 — Fixed-rate FT with board/lodging cash value INCLUDED

```yaml
employee:
  employmentType: full_time
  currentWeeklyGross: 1900.00                    # base 1800 + board/lodging cash $100/wk
trigger: { kind: taking_leave }
expected:
  value_of_week: 1900.00
  warnings:
    - { code: act_board_and_lodging_cash_value_included }
```

---

### TC-ACT-049 — Commission worker, 12-mo income lookback (s.2F)

```yaml
employee:
  employmentType: full_time
  wageHistory:
    - { periodStart: 2025-05-26, periodEnd: 2026-05-26, grossPay: 156000.00, frequency: weekly }
trigger: { kind: termination, reason: redundancy }
expected:
  value_of_week: 3000.00                         # 156000 / 52 (s.2F)
  warnings:
    - { code: act_commission_12mo_lookback_applied }
```

---

### TC-ACT-050 — Penalty rates (weekend / shift) EXCLUDED from ordinary pay

```yaml
employee:
  employmentType: full_time
  currentWeeklyGross: 1800.00                    # base — penalty rates excluded
  wageHistory:
    - { periodStart: 2025-05-26, periodEnd: 2026-05-26, grossPay: 104000.00, frequency: weekly, note: "incl. $2000 weekend penalty" }
trigger: { kind: taking_leave }
expected:
  value_of_week: 1800.00                         # penalty rates EXCLUDED per s.7(1)
  warnings:
    - { code: act_penalty_rates_excluded, message: "Penalty rates (shift, weekend, PH loadings) excluded from ordinary pay per ACT LSL Act 1976 s.7(1). Diverges from QLD (s.98 includes shift penalties) and TAS (s.11 includes shift penalties + all-purpose allowances)." }
```

---

## §I — Casual / PT — s.7(2) 12-mo averaging with overtime hours included (F9/AC11 — the headliner)

### TC-ACT-051 — Casual 8 yrs, 12-mo hours average with overtime INCLUDED in hours, EXCLUDED from rate

- **Source**: ACT LSL Act 1976 s.7(2) + WorkSafe ACT; APA Masterclass p.119
- **Category**: **F9/AC11 reference fixture — the headliner divergence from NSW**
- **Why it matters**: F9/AC11 are the spec's load-bearing acceptance criteria for ACT. The asymmetric overtime treatment (hours in, rate out) is the highest mis-coding risk in the entire E2 epic per impl-plan §Phase 7.

**Inputs**

```yaml
employee:
  id: TC-ACT-051
  startDate: 2018-05-26
  employmentType: casual
  statesOfService: [ACT]
  governingJurisdiction: ACT
  currentHourlyRate: 42.50                      # base $34 + 25% loading
  hoursLast12MonthsBeforeEntitlement: 1560      # base 1300 + 260 overtime
  extraInputs:
    act_overtime_hours_by_period:
      - { periodStart: 2024-05-26, periodEnd: 2025-05-26, hours: 260 }
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 6.0667 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 8.0000
total_entitlement_weeks: 6.9333                # 8 × 0.8667
weekly_avg_12mo_taking: 30.00                  # 1560 / 52 (INCLUDES 260 overtime hours)
value_of_week: 1275.00                          # 30 × $42.50 (loaded base rate — EXCLUDES overtime premium)
payable_for_taken_leave: 7735.04                # 6.0667 × 1275
warnings:
  - { code: act_overtime_included_in_hours_average, message: "Overtime hours (260 hrs over 12 mo) included in s.7(2) hours average. Rate $42.50/hr is the loaded casual base rate; overtime premium is excluded from rate per s.7(1)." }
expected_citations:
  - { section: ACT LSL Act 1976 s.7(1), rule: ordinary-pay.casual-base-rate-includes-loading-excludes-overtime-premium }
  - { section: ACT LSL Act 1976 s.7(2), rule: ordinary-pay.casual-12mo-average-hours-include-overtime }
```

**Notes**

**This is the spec's F9/AC11 anchor.** The asymmetry — hours include overtime but rate excludes overtime — must be encoded carefully. Engine arithmetic: total hours in 12-mo window (base + overtime) ÷ 52 → weekly avg hours; weekly avg hours × **base** hourly rate (incl. casual loading) → value-of-week. If the engine multiplied by the overtime premium rate instead, the result would be inflated.

---

### TC-ACT-052 — PT 7 yrs, 12-mo hours average, NO overtime, simple case

```yaml
employee:
  startDate: 2019-05-26
  employmentType: part_time
  currentHourlyRate: 38.00
  hoursLast12MonthsBeforeEntitlement: 1248     # 24 h/wk × 52
  extraInputs:
    act_overtime_hours_by_period: []
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 6.0667 }
expected:
  weekly_avg_12mo_taking: 24.00
  value_of_week: 912.00                         # 24 × 38
  payable_for_taken_leave: 5532.84
```

---

### TC-ACT-053 — Casual 12 yrs, 12-mo hours window with mixed overtime + casual loading

```yaml
employee:
  startDate: 2014-05-26
  employmentType: casual
  currentHourlyRate: 40.00
  hoursLast12MonthsBeforeEntitlement: 2080     # 1820 base + 260 overtime
  extraInputs:
    act_overtime_hours_by_period:
      - { periodStart: 2025-05-26, periodEnd: 2026-05-26, hours: 260 }
trigger: { kind: taking_leave }
expected:
  years_of_continuous_service: 12.0000
  total_entitlement_weeks: 10.4004              # 12 × 0.8667
  weekly_avg_12mo_taking: 40.00                # 2080 / 52
  value_of_week: 1600.00
  warnings: [{ code: act_overtime_included_in_hours_average }]
```

---

### TC-ACT-054 — PT 8 yrs, overtime hours zero, sanity check that warning does NOT fire

```yaml
employee:
  startDate: 2018-05-26
  employmentType: part_time
  hoursLast12MonthsBeforeEntitlement: 1300
  currentHourlyRate: 35.00
  extraInputs:
    act_overtime_hours_by_period: []
trigger: { kind: taking_leave }
expected:
  weekly_avg_12mo_taking: 25.00
  value_of_week: 875.00
  warnings: []                                  # no overtime → warning does NOT fire
```

---

### TC-ACT-055 — PT 7 yrs, hours-averaging window EXCLUDES unpaid leave weeks (parallel to SA pattern)

```yaml
employee:
  startDate: 2019-05-26
  employmentType: part_time
  hoursLast12MonthsBeforeEntitlement: 1200      # actual 52 wks; 12 wks UPL — substituted with prior worked weeks
  currentHourlyRate: 35.00
  serviceEvents:
    - { type: leave_without_pay, startDate: 2025-08-01, endDate: 2025-10-22 }  # 12 wks UPL within 12-mo window
trigger: { kind: taking_leave }
expected:
  weekly_avg_12mo_taking: 23.08                # 1200 / 52
  value_of_week: 807.69
  warnings:
    - { code: act_12mo_window_extended_for_upl, message: "12-month casual/PT averaging window adjusted: 12 weeks of approved unpaid leave excluded; prior worked weeks substituted to preserve the 52-week denominator. Engine interpretation parallel to SA 156-wk pattern per TBD-SA-05 RESOLVED." }
```

**Notes**: **TBD-ACT-08** (Sev-2): the ACT Act is silent on substitution for unpaid-leave weeks (unlike SA's explicit SafeWork SA rule). Recommend applying the SA-parallel pattern (substitute prior worked weeks) for v1 to keep the denominator at 52; alternative is to reduce denominator by UPL weeks. Operator decision needed.

---

## §J — s.7(3) FT→PT/casual within 2 yrs — 5-year salary path (ACT-unique)

### TC-ACT-056 — FT→PT transition 18 mo before 7-yr entitlement, s.7(3) applies

- **Source**: ACT LSL Act 1976 s.7(3); APA Masterclass p.120
- **Category**: ACT-unique mid-service transition rule
- **Why it matters**: When employee transitions from FT to PT/casual within 2 years of reaching the 7-yr entitlement, s.7(3) applies — 5-year total salary ÷ 5 ÷ 52. No hours averaging. **No other Australian state has this rule.**

**Inputs**

```yaml
employee:
  id: TC-ACT-056
  startDate: 2019-05-26                          # 7-yr entitlement = 2026-05-26
  employmentType: part_time                       # currently PT after FT→PT transition on 2024-11-26 (1.5 yrs before entitlement)
  statesOfService: [ACT]
  governingJurisdiction: ACT
  currentHourlyRate: 35.00                        # currently PT
  wageHistory:                                    # 5-yr salary history (2021-05-26 → 2026-05-26)
    - { periodStart: 2021-05-26, periodEnd: 2024-11-25, grossPay: 312000.00, frequency: weekly, note: "FT salary" }
    - { periodStart: 2024-11-26, periodEnd: 2026-05-26, grossPay: 65000.00, frequency: weekly, note: "PT salary" }
  extraInputs:
    act_ft_to_pt_transition_date: 2024-11-26
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 6.0667 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.0000
total_entitlement_weeks: 6.0667
five_year_total_salary: 377000.00               # 312000 + 65000
value_of_week: 1450.00                          # 377000 / 5 / 52 = $1450
payable_for_taken_leave: 8796.71                # 6.0667 × 1450
warnings:
  - { code: act_s7_3_ft_to_pt_within_2yr_path, message: "Employee transitioned FT→PT/casual on 2024-11-26 (1.5 yrs before 7-yr LSL entitlement on 2026-05-26). Engine routed to ACT LSL Act 1976 s.7(3) 5-year-total-salary path instead of s.7(2) hours-averaging path. value_of_week = 5-yr total salary / 5 / 52." }
expected_citations:
  - { section: ACT LSL Act 1976 s.7(3), rule: ordinary-pay.ft-to-pt-within-2yr-of-entitlement-5yr-salary-divided-by-5 }
```

**Notes**

This is the load-bearing fixture for the ACT-unique s.7(3) path. Engine MUST check `extraInputs.act_ft_to_pt_transition_date` and, if present AND within 2 yrs of `startDate + 7 years`, route to the s.7(3) formula. The 5-year window is the 5 years immediately preceding the entitlement date — NOT 12 months. **TBD-ACT-04** (Sev-1): confirm operator agrees with s.7(3) trigger condition encoding via `extraInputs.act_ft_to_pt_transition_date`.

---

### TC-ACT-057 — FT→casual transition exactly 2 yrs before entitlement, s.7(3) applies at boundary

```yaml
employee:
  startDate: 2019-05-26
  employmentType: casual
  currentHourlyRate: 40.00
  wageHistory:
    - { periodStart: 2021-05-26, periodEnd: 2024-05-26, grossPay: 270000.00, frequency: weekly }
    - { periodStart: 2024-05-26, periodEnd: 2026-05-26, grossPay: 80000.00, frequency: weekly }
  extraInputs:
    act_ft_to_pt_transition_date: 2024-05-26     # exactly 2 yrs before entitlement
trigger: { kind: taking_leave }
expected:
  value_of_week: 1346.15                         # 350000 / 5 / 52
  warnings: [{ code: act_s7_3_ft_to_pt_within_2yr_path }]
```

**Notes**: Boundary case — exactly 2 yrs is treated as "within 2 yrs" (inclusive at 2.0000 yrs). **TBD-ACT-04 sub-point**: confirm inclusivity at exact 2-yr boundary.

---

### TC-ACT-058 — FT→PT transition 2 yrs + 1 day before entitlement, s.7(2) applies (NOT s.7(3))

```yaml
employee:
  startDate: 2019-05-26
  employmentType: part_time
  currentHourlyRate: 35.00
  hoursLast12MonthsBeforeEntitlement: 1300
  extraInputs:
    act_ft_to_pt_transition_date: 2024-05-25     # 2 yrs + 1 day before entitlement → OUTSIDE 2-yr window
trigger: { kind: taking_leave }
expected:
  value_of_week: 875.00                          # 25 × 35 — s.7(2) hours-averaging applies
  warnings: []                                    # no s.7(3) warning
```

**Notes**: The boundary mirror of TC-ACT-057 — 1 day outside the 2-yr window routes to s.7(2) hours-averaging path.

---

## §K — s.7 vs s.11D anchor divergence (taking vs cessation)

### TC-ACT-059 — Hours UNCHANGED between entitlement and cessation — anchor divergence is moot

```yaml
employee:
  startDate: 2018-05-26
  endDate: 2026-05-26
  employmentType: part_time
  hoursLast12MonthsBeforeEntitlement: 1300       # entitlement date 2025-05-26; window 2024-05-26 → 2025-05-26
  hoursLast12MonthsBeforeCessation: 1300          # cessation date 2026-05-26; window 2025-05-26 → 2026-05-26 — SAME HOURS
  currentHourlyRate: 35.00
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  total_entitlement_weeks: 6.9333                # 8 × 0.8667 = 6.9333
  weekly_avg_12mo_termination: 25.00              # s.11D anchor applies on termination
  value_of_week: 875.00                           # 25 × 35
  warnings: []                                     # both anchors yield same avg — no divergence warning
```

---

### TC-ACT-060 — Hours INCREASED between entitlement and cessation — s.11D anchor applies on termination

- **Source**: ACT LSL Act 1976 s.11D
- **Category**: Anchor divergence — taking vs cessation

**Inputs**

```yaml
employee:
  id: TC-ACT-060
  startDate: 2018-05-26
  endDate: 2026-05-26
  employmentType: part_time
  hoursLast12MonthsBeforeEntitlement: 1040       # 20 h/wk in year ending 2025-05-26
  hoursLast12MonthsBeforeCessation: 1820          # 35 h/wk in year ending 2026-05-26 (took on extra hours after entitlement)
  currentHourlyRate: 35.00
trigger: { kind: termination, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
total_entitlement_weeks: 6.9333
weekly_avg_12mo_termination: 35.00              # 1820 / 52 — s.11D anchor (cessation)
value_of_week: 1225.00                           # 35 × 35
total_entitlement_dollars: 8493.29
warnings:
  - { code: act_taking_anchor_vs_termination_anchor_diverged, message: "Trigger drives averaging anchor: `taking_leave` would use 12 mo before entitlement date (2024-05-26 → 2025-05-26 — avg 20 h/wk); current `termination` trigger uses 12 mo before cessation per s.11D (2025-05-26 → 2026-05-26 — avg 35 h/wk). Engine applied s.11D anchor — yields higher entitlement than s.7(2) would have." }
```

**Notes**

**Load-bearing fixture for the s.7 vs s.11D anchor split.** This is **THE** divergence that the spec calls out as a high mis-coding risk. Engine MUST select anchor by trigger kind: `taking_leave` → s.7(2) anchor (entitlement date); `termination` → s.11D anchor (cessation date). The two windows are different 12-month spans and produce different averages whenever the employee's hours have changed in the interim.

---

### TC-ACT-061 — Hours DECREASED between entitlement and cessation — s.11D anchor applies on termination

```yaml
employee:
  startDate: 2018-05-26
  endDate: 2026-05-26
  employmentType: part_time
  hoursLast12MonthsBeforeEntitlement: 1820       # 35 h/wk pre-entitlement
  hoursLast12MonthsBeforeCessation: 1040          # 20 h/wk (reduced after entitlement)
  currentHourlyRate: 35.00
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  weekly_avg_12mo_termination: 20.00              # 1040 / 52
  value_of_week: 700.00                            # 20 × 35
  warnings: [{ code: act_taking_anchor_vs_termination_anchor_diverged }]
```

**Notes**: Mirror of TC-ACT-060 — when hours decrease, the s.11D anchor produces a LOWER entitlement than s.7(2) would. Engine MUST still use s.11D for termination.

---

## §L — 15-year and 20-year continuous-accrual (s.4)

### TC-ACT-062 — 15 yrs FT resignation, full 13.0005 weeks (continuous accrual; no discrete step)

```yaml
employee: { startDate: 2011-05-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 2000.00 }
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  total_entitlement_weeks: 13.0005             # 15 × 0.8667 — continuous accrual; no step at 15 yrs
  total_entitlement_dollars: 26001.00
```

**Notes**: No discrete step at 15 yrs in ACT — continuous accrual at 0.8667/yr from day 7-yr threshold. Parallel to NSW/QLD/WA/TAS continuous-accrual pattern.

---

### TC-ACT-063 — 20 yrs FT resignation, full 17.334 weeks

```yaml
employee: { startDate: 2006-05-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 2000.00 }
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  total_entitlement_weeks: 17.3340            # 20 × 0.8667
  total_entitlement_dollars: 34668.00
```

---

## §M — Cashing out (s.8(c) — non-blocking advisory)

### TC-ACT-064 — Cash-out request at 9 yrs (post-7-yr accrual), ADVISORY

```yaml
employee: { startDate: 2017-05-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: cash_out, cashOutDate: 2026-05-26 }
expected:
  status: computed
  total_entitlement_weeks: 7.8003             # 9 × 0.8667
  total_entitlement_dollars: 14040.54
  warnings:
    - { code: act_cashout_post_accrual_advisory, message: "Cashing out long service leave in ACT is permitted per WorkSafe ACT guidance under s.8(c) 'in another way'. Written agreement between employer and employee is recommended. Value of cash-out is calculated as if LSL were taken — same as value-of-week × weeks cashed. Non-statutory — engine emits advisory, not a hard error." }
  expected_citations:
    - { section: ACT LSL Act 1976 s.8(c), rule: cashout.post-7yr-permitted-by-agreement, note: "v1 cites s.8(c); WorkSafe ACT operational guidance interprets this clause as the cash-out authority" }
```

**Notes**: Per TBD-ACT-12: cite as `ACT LSL Act 1976 s.8(c)` — same Act-level-only documented-limitation pattern as TBD-WA-02 (WCIM Act citation) / TBD-SA-03 (SA s.5 cash-out citation). The s.8(c) interpretation is from WorkSafe ACT guidance, not a verbatim Act sub-section saying "cashing out is permitted."

---

### TC-ACT-065 — Cash-out request at 6 yrs (5–7 yr pro-rata band) — ADVISORY "not authorised"

```yaml
employee: { startDate: 2020-05-26, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: cash_out }
expected:
  status: computed
  total_entitlement_weeks: 5.2000             # the engine still surfaces what the pro-rata WOULD be
  warnings:
    - { code: act_cashout_pre_accrual_not_authorised, message: "Cashing out at sub-7-year tenure is NOT authorised under ACT LSL Act 1976 — the pro-rata under s.11C is payable on termination only, not as a cash-out election. If the worker is leaving the employer, change the trigger to 'termination' with a qualifying reason." }
```

---

### TC-ACT-066 — Cash-out request at 4 yrs (sub-5-yr) — ADVISORY "no entitlement"

```yaml
employee: { startDate: 2022-05-26, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: cash_out }
expected:
  status: computed
  total_entitlement_weeks: 0
  warnings:
    - { code: act_cashout_no_entitlement_to_cash_out, message: "Worker has not yet reached the 5-year pro-rata threshold. There is no LSL entitlement to cash out. No cash-out election is authorised under ACT LSL Act 1976 until 7+ years of continuous service have been completed." }
```

---

### TC-ACT-067 — Cash-out request at 7 yrs exact — ADVISORY (just-eligible)

```yaml
employee: { startDate: 2019-05-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: cash_out }
expected:
  status: computed
  total_entitlement_weeks: 6.0667
  warnings: [{ code: act_cashout_post_accrual_advisory }]
```

---

## §N — Workers comp overlap with LSL rate (s.7 — parallel to QLD/WA/SA)

### TC-ACT-068 — LSL taken while on WC reduced rate — engine pays at literal s.7 rate + advisory

```yaml
employee:
  startDate: 2019-05-26
  employmentType: full_time
  currentWeeklyGross: 1300.00                   # currently on reduced WC rate (was $1800 pre-injury)
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2026-04-01, endDate: 2026-05-26 }
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 6.0667 }
expected:
  value_of_week: 1300.00                         # literal current rate per s.7 — NO higher-of-rates uplift
  warnings:
    - { code: act_lsl_calculated_at_wc_reduced_rate_warning, message: "LSL has been calculated at the rate in force at the time leave is taken under ACT LSL Act 1976 s.7. The worker appears to be on workers compensation at a reduced rate. If feasible, defer taking LSL until the worker is back on their ordinary rate; ACT has no statutory higher-of-rates equivalent to VIC s.17." }
  expected_citations:
    - { section: ACT LSL Act 1976 s.7, rule: ordinary-pay.literal-rate-at-leave-time-no-wc-uplift }
```

**Notes**: Parallel to resolved TBD-QLD-05, TBD-WA-05, TBD-SA-08. ACT s.7 has no higher-of-pre-injury-vs-current rule.

---

## §O — Transfer of business (s.10)

### TC-ACT-069 — Transfer of business preserves service; new employer assumes liability

```yaml
employee:
  startDate: 2017-05-26
  serviceEvents:
    - { type: transfer_of_business, startDate: 2022-05-26, endDate: 2022-05-26, note: "old employer sold to new employer; same role continued" }
trigger: { kind: termination, reason: voluntary_resignation, terminationDate: 2026-05-26 }
expected:
  years_of_continuous_service: 9.0000
  total_entitlement_weeks: 7.8003                # 9 × 0.8667
  warnings:
    - { code: transfer_of_business_continuity_preserved_act, message: "Service deemed continuous across transfer of business per ACT LSL Act 1976 s.10. New employer assumes LSL liability and becomes sole employer." }
```

**Notes**: TBD-ACT-16 sub-point: reuse SA's `transfer_of_business_continuity_preserved_sa` style (state-namespaced) — confirm new `..._act` warning code is preferred over reusing the SA code.

---

## §P — Leave in advance — refused (s.6 has no statutory basis)

### TC-ACT-070 — Taking-leave request at 5 yrs (pre-7-yr) — refused, returns $0

```yaml
employee: { startDate: 2021-05-26, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 4.0 }
expected:
  status: computed
  payable_for_taken_leave: 0
  warnings:
    - { code: act_advance_leave_not_permitted, message: "Taking LSL before the 7-year entitlement is NOT permitted under ACT LSL Act 1976 — the Act contains no leave-in-advance provision. Engine refuses the leave-taking trigger and returns $0. To compute what the worker WOULD be entitled to at this tenure if terminated for a qualifying reason, change the trigger to 'termination' with reason ∈ {illness_incapacity, redundancy, etc.}." }
```

**Notes**: Same shape as TAS Phase 8 (per impl-plan §Phase 8). **TBD-ACT-14** (Sev-2): confirm engine refusal semantics — `status: computed` with $0 + advisory (current draft) vs `status: failed` with hard error. Recommend `status: computed` + advisory to preserve the as-at computation as informational (parallel to QLD's cash-out at sub-7-yr pattern).

---

## §Q — As-at snapshot trigger

### TC-ACT-071 — 4 yrs as-at → accrued, not currently payable

```yaml
trigger: { kind: as_at, asAtDate: 2026-05-26 }
employee: { startDate: 2022-05-26, employmentType: full_time, currentWeeklyGross: 1700.00 }
expected:
  total_entitlement_weeks: 3.4668              # 4 × 0.8667 (informational accrued value)
  payable_indicator: "accrued, not currently payable"
  warnings: [{ code: accrued_not_currently_payable, message: "Below 5-year pro-rata threshold. Entitlement is accruing but no cash payment is currently triggerable." }]
```

---

### TC-ACT-072 — 8 yrs as-at → 6.9333 wks (above 7-yr qualifying threshold)

```yaml
trigger: { kind: as_at, asAtDate: 2026-05-26 }
employee: { startDate: 2018-05-26, currentWeeklyGross: 1800.00 }
expected: { total_entitlement_weeks: 6.9333, payable_indicator: "payable" }
```

---

## §R — Cross-jurisdiction

### TC-ACT-073 — ACT + NSW service, NSW nominated → routed to NSW engine (8.6667 wks at 10 yrs, not ACT's 6.0667 at 7)

```yaml
employee: { statesOfService: [ACT, NSW], governingJurisdiction: NSW, startDate: 2016-05-26 }
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  state_used: NSW
  total_entitlement_weeks: 8.6667              # NSW 10-yr threshold applied, NOT ACT's 7-yr
  warnings:
    - { code: cross_jurisdiction_pending, message: "Employee has worked in ACT and NSW. The sufficiently connected test (legal judgement — APA Masterclass p.138) is for legal counsel where doubt exists. Engine has computed using user-nominated governing jurisdiction: NSW." }
```

---

### TC-ACT-074 — ACT + VIC service, governing NOT nominated → BLOCKED

```yaml
employee: { statesOfService: [ACT, VIC], governingJurisdiction: null }
trigger: { kind: termination, reason: voluntary_resignation }
expected:
  status: blocked_cross_jurisdiction
  outputs: null
  warnings: [{ code: cross_jurisdiction_pending }]
```

---

## §S — Pay-on-termination 90-day window — `payable_by` surface

### TC-ACT-075 — 9 yrs FT redundancy, `payable_by = terminationDate + 90 days`

```yaml
employee: { startDate: 2017-05-26, endDate: 2026-05-26, employmentType: full_time, currentWeeklyGross: 1800.00 }
trigger: { kind: termination, reason: redundancy, terminationDate: 2026-05-26 }
expected:
  total_entitlement_weeks: 7.8003
  total_entitlement_dollars: 14040.54
  payable_by: 2026-08-24                       # 2026-05-26 + 90 days
  warnings:
    - { code: act_termination_payable_within_90_days_advisory, message: "ACT LSL Act 1976 s.11A(4)(b) provides up to 90 days from cessation for the employer to pay the LSL amount — the LONGEST pay-on-termination window in Australia. The `payable_by` field surfaces the statutory outer-bound date. Most ACT employers pay within the next ordinary pay cycle; this field is informational." }
```

**Notes**: This is the load-bearing fixture for the new `payable_by` Result field. **TBD-ACT-08** (Sev-2): confirm operator agrees with surfacing `payable_by` as a new optional `Result` field (purely additive, no breaking change). Alternative: surface only via warning message text (no schema change).

---

# Bulk-mode test cases

### TC-ACT-BULK-001 — 5-employee ACT-only fixture, mixed tenures and triggers

```csv
employee_id,row_type,state,start_date,employment_type,trigger,trigger_date,gross_pay,period_frequency,reason
A01,pay_period,ACT,2014-05-26,full_time,as_at,2026-05-26,98000.00,weekly,                                # 12 yr FT
A02,pay_period,ACT,2019-05-26,full_time,termination,2026-05-26,93600.00,weekly,redundancy                # 7 yr FT redundancy → full 6.0667 wks
A03,pay_period,ACT,2020-05-26,part_time,as_at,2026-05-26,39000.00,weekly,                                # 6 yr PT as-at
A04,pay_period,ACT,2015-05-26,casual,termination,2026-05-26,55000.00,other,voluntary_resignation         # 11 yr casual → 9.5337 wks
A05,pay_period,ACT,2021-05-26,full_time,termination,2026-05-26,78000.00,weekly,serious_misconduct        # 5 yr misconduct → $0
```

**Expected output**

```yaml
total_rows: 5
status_breakdown: { computed: 5, blocked: 0, failed: 0 }
row_results:
  A01: { state_used: ACT, total_entitlement_weeks: 10.4004, dollars: 19577.74 }                            # 12 × 0.8667 × 1885
  A02: { state_used: ACT, total_entitlement_weeks: 6.0667, dollars: 10920.06, payable_by: 2026-08-24 }     # 7 yrs full; redundancy qualifies at 7+
  A03: { state_used: ACT, total_entitlement_weeks: 5.2000, dollars: 3900.00 }                              # 6 × 0.8667 × 750
  A04: { state_used: ACT, total_entitlement_weeks: 9.5337, dollars: 10078.04 }                             # 11 × 0.8667 — voluntary res qualifies at 7+
  A05: { state_used: ACT, total_entitlement_weeks: 0, dollars: 0 }                                          # sub-7-yr misconduct → $0
all_rows_have_state_used_ACT: true
```

---

### TC-ACT-BULK-002 — 10-employee mixed NSW + VIC + QLD + WA + SA + ACT, with overtime + s.7(3) cases

```csv
employee_id,row_type,state,start_date,employment_type,trigger,trigger_date,...
NVQWSA01,pay_period,NSW,2016-05-26,full_time,as_at,2026-05-26,...                                          # 10 yr NSW → 8.6667 wks
NVQWSA02,pay_period,VIC,2018-05-26,full_time,as_at,2026-05-26,...                                          # 8 yr VIC → 6.9333 wks
NVQWSA03,pay_period,QLD,2015-05-26,casual,as_at,2026-05-26,...                                             # 11 yr QLD casual
NVQWSA04,pay_period,WA,2014-05-26,full_time,as_at,2026-05-26,...                                           # 12 yr WA
NVQWSA05,pay_period,SA,2016-05-26,full_time,as_at,2026-05-26,...                                           # 10 yr SA → 13 wks
NVQWSA06,pay_period,ACT,2019-05-26,full_time,as_at,2026-05-26,...                                          # 7 yr ACT → 6.0667 wks
NVQWSA07,pay_period,act,2018-05-26,casual,as_at,2026-05-26,...,act_overtime_hours_by_period=260            # lowercase normalised; casual + overtime
NVQWSA08,pay_period,ACT,2018-05-26,part_time,termination,2026-05-26,...,reason=voluntary_resignation,act_ft_to_pt_transition_date=2024-11-26  # s.7(3) path triggered
NVQWSA09,pay_period,ACT,2021-05-26,full_time,termination,2026-05-26,...,reason=voluntary_resignation       # 5 yr res sub-7-yr no-qualifying → $0
NVQWSA10,pay_period,,2019-05-26,full_time,as_at,2026-05-26,...                                             # EMPTY state — validation error
```

**Expected output**

```yaml
total_rows: 10
status_breakdown: { computed: 8, blocked: 0, failed: 1 }
row_results:
  NVQWSA01: { state_used: NSW, status: computed }
  NVQWSA02: { state_used: VIC, status: computed }
  NVQWSA03: { state_used: QLD, status: computed }
  NVQWSA04: { state_used: WA, status: computed }
  NVQWSA05: { state_used: SA, status: computed, total_entitlement_weeks: 13.0000 }
  NVQWSA06: { state_used: ACT, status: computed, total_entitlement_weeks: 6.0667 }
  NVQWSA07: { state_used: ACT, status: computed, warnings: [{ code: act_overtime_included_in_hours_average }] }
  NVQWSA08: { state_used: ACT, status: computed, warnings: [{ code: act_s7_3_ft_to_pt_within_2yr_path }] }
  NVQWSA09: { state_used: ACT, status: computed, total_entitlement_weeks: 0, warnings: [{ code: sub_7yr_no_qualifying_reason_act }] }
  NVQWSA10: { status: failed, error: { code: state_missing_or_empty } }
```

**Notes**: Demonstrates per-state ACT branching alongside the 5 already-shipped states. Two ACT-specific rows show the overtime-inclusive hours average (NVQWSA07) and the s.7(3) FT→PT path (NVQWSA08).

---

### TC-ACT-BULK-003 — Mixed-state WC-overlap matrix (5 states)

```csv
employee_id,row_type,state,start_date,trigger,trigger_date,...
WC-A01,pay_period,ACT,2017-05-26,taking_leave,2026-06-01,...,workers_comp_absence@2025-10-01-2025-12-31  # post-9-Jun-2023; counts in full
WC-A02,pay_period,ACT,2017-05-26,taking_leave,2026-06-01,...,workers_comp_absence@2023-05-01-2023-07-31  # straddles 9-Jun-2023
WC-W01,pay_period,WA,2014-05-26,taking_leave,2026-06-01,...,workers_comp_absence@2024-08-01-2024-10-31   # post-1-Jul-2024 WA cliff; counts in full
WC-S01,pay_period,SA,2016-05-26,taking_leave,2026-06-01,...,workers_comp_absence@2025-01-01-2025-03-31    # SA WC counts as service + 156-wk substitution
WC-Q01,pay_period,QLD,2015-05-26,taking_leave,2026-06-01,...,workers_comp_absence@2025-08-01-2025-10-31   # QLD WC always counts
```

**Expected output**

```yaml
total_rows: 5
status_breakdown: { computed: 5, blocked: 0, failed: 0 }
row_results:
  WC-A01: { state_used: ACT, status: computed, warnings: [{ code: act_workers_comp_post_9jun2023_counts }] }
  WC-A02: { state_used: ACT, status: computed, warnings: [{ code: act_workers_comp_regime_split_applied }] }
  WC-W01: { state_used: WA, status: computed }
  WC-S01: { state_used: SA, status: computed, warnings: [{ code: sa_156wk_window_extended_for_wc }] }
  WC-Q01: { state_used: QLD, status: computed }
```

---

# Coverage matrix

| Spec / source item | Covered by |
|---|---|
| **ACT LSL Act 1976 s.2F** — Commission / piecework — total ÷ 52 | TC-ACT-008, TC-ACT-049 |
| **ACT LSL Act 1976 s.2G** — Continuous service / break tolerances / sickness 2-wk/yr cap | TC-ACT-028 → TC-ACT-035 |
| **ACT LSL Act 1976 s.3 / s.4** — Entitlement formula (6.0667 wks at 7 yrs + 0.8667 wks/yr continuous) | TC-ACT-001, TC-ACT-005, TC-ACT-020 → TC-ACT-024, TC-ACT-062, TC-ACT-063 |
| **ACT LSL Act 1976 s.6** — Leave taken; advance leave not permitted; 60-day employer notice | TC-ACT-070 (advance leave refused) |
| **ACT LSL Act 1976 s.7(1)** — Ordinary pay definition (incl. + excl. components) | TC-ACT-045 → TC-ACT-050 |
| **ACT LSL Act 1976 s.7(2)** — PT/casual 12-mo averaging at entitlement-date anchor (incl. overtime hours; excl. overtime rate) | TC-ACT-006, TC-ACT-007, TC-ACT-051 → TC-ACT-055 |
| **ACT LSL Act 1976 s.7(3)** — FT→PT/casual within 2 yrs of entitlement: 5-yr salary ÷ 5 | TC-ACT-056, TC-ACT-057, TC-ACT-058 |
| **ACT LSL Act 1976 s.8(c)** — Cash-out by agreement "in another way" | TC-ACT-064 → TC-ACT-067 |
| **ACT LSL Act 1976 s.9** — PH-EXCLUSIVE in LSL period | TC-ACT-042 → TC-ACT-044 |
| **ACT LSL Act 1976 s.10** — Transfer of business | TC-ACT-069 |
| **ACT LSL Act 1976 s.10A + WC Act 1951 (ACT) s.46** — Workers Comp dual regime (9 June 2023 cliff) | TC-ACT-036 → TC-ACT-041, TC-ACT-068, TC-ACT-BULK-003 |
| **ACT LSL Act 1976 s.11A(4)(b)** — Pay-on-termination within 90 days | TC-ACT-002, TC-ACT-005, TC-ACT-008, TC-ACT-009, TC-ACT-020, TC-ACT-075 (load-bearing) |
| **ACT LSL Act 1976 s.11C** — Pro-rata at 5–7 yrs / qualifying reasons / misconduct exclusion | TC-ACT-002, TC-ACT-003, TC-ACT-010 → TC-ACT-019, TC-ACT-025 → TC-ACT-027 |
| **ACT LSL Act 1976 s.11D** — Cessation 12-mo hours-averaging anchor (≠ s.7(2) entitlement anchor) | TC-ACT-019, TC-ACT-022, TC-ACT-059, TC-ACT-060, TC-ACT-061 |
| **E2 spec F2 / AC1 / AC2** — per-state rule set + test suite | this file + encoded fixtures |
| **E2 spec F9 / AC11** — ACT overtime-inclusive hours in casual/PT ordinary-pay base | TC-ACT-006, TC-ACT-051, TC-ACT-053 (load-bearing) |
| **E2 spec F13 / AC14** — Cross-jurisdictional governing-state nomination | TC-ACT-073, TC-ACT-074 |
| **E2 spec F16 / F17 / AC16** — State selector + mixed-state bulk CSV | TC-ACT-BULK-002 |
| **E2 spec AC4 / AC4a / AC4b** — PM sign-off + per-state launch gate | this file's PM signature line below — **PENDING** |

---

# Items flagged `TBD-ACT-NN` — to be resolved by operator

Ordered by severity (Sev-1 = load-bearing; Sev-2 = engine-shape; Sev-3 = nice-to-have). PM recommendations are provided inline; operator decision binds the v1 ACT engine.

## TBD-ACT-01 — [Sev-1, LOAD-BEARING] Dual-regime architecture for Workers Comp pre/post 9 June 2023

**Question**: Does ACT need a pre/post-9-June-2023 dual-regime for Workers Compensation (parallel to WA's 2024-07-01 architectural pattern, with a WC-override-only date-aware module sitting on top of the single rule set)?

**PM recommendation**: **YES, single rule set with date-aware WC handling — same architectural pattern as WA's TBD-WA-01 RESOLUTION.** The 9 June 2023 cliff is WC-specific only — the s.3, s.4, s.7, s.11C accrual / pay / termination formulas are unchanged across the cutoff. Engine layout:

```
website/src/lib/lsl/states/act/
├── index.ts                                       # calculateACT orchestrator — single entitlement path
├── extra-inputs.ts                                # ACTExtraInputs interface (overtime, ft_to_pt_transition_date, etc.)
├── continuous-service-rules.ts                    # general continuous-service profile
├── rules/
│   ├── accrual-table.ts                           # s.3, s.4 — 6.0667 at 7 yrs, +0.8667/yr continuous
│   ├── value-of-week.ts                           # s.7(1) fixed-rate + s.7(2) 12-mo casual/PT incl. overtime + s.7(3) FT→PT 5-yr + s.11D cessation anchor + s.2F commission
│   ├── trigger-handlers.ts                        # s.11C 5–7 yr pro-rata + s.4 7+ full payout + s.8(c) cash-out advisory + s.6 advance-leave refusal + s.11A(4)(b) 90-day payable_by + s.9 PH-exclusive
│   ├── public-holidays.ts                         # 12 ACT PHs from Public Holidays Act 1958 (ACT)
│   └── workers-comp-override.ts                   # date-aware override at 9 June 2023 — pre-cutoff: 2-wk/yr cap; post-cutoff: counts in full
└── __tests__/{gold-standard.test.ts, fixtures/{single, straddling, workers-comp, bulk}/}
```

**Engine impact**: ~½ dev-day for the WC override module. NO `rules-pre-X.ts` / `rules-post-X.ts` split for the rest of the rule set (parallel to WA). Phase 7 effort estimate stays at L (5–7 days) per impl-plan v0.3.3 §Phase 7 — primary driver is the overtime asymmetry + s.7 vs s.11D anchor split, not the WC dual regime.

**Reversal impact**: If operator chooses two parallel rule sets (`rules-pre-9jun2023/` + `rules-post-9jun2023/`), +1–2 dev-days for scaffolding the second rule set, plus an additional fixture group. PM strongly recommends single-rule-set pattern given the cutoff affects WC only.

---

## TBD-ACT-02 — [Sev-1, LOAD-BEARING] Overtime hours-vs-rate asymmetry interpretation

**Question**: The spec/impl-plan/F9 wording is "ACT casuals require overtime hours per ACT LSL Act 1976 s.4 ... value-of-week formula MUST include overtime hours in the ordinary-pay computation." Is the correct read:

- **(a)** Hours-averaging window includes overtime hours; rate applied is base hourly rate excluding overtime premium. (Asymmetric — parallel to SA 156-wk pattern.)
- **(b)** Both hours AND rate include overtime — value-of-week is effectively a fully-loaded overtime-included weekly figure.

**PM recommendation**: **Option (a) — asymmetric.** WorkSafe ACT guidance under s.7(1) explicitly EXCLUDES overtime from ordinary pay; s.7(2) hours-averaging explicitly INCLUDES overtime hours. The asymmetric reading matches both WorkSafe ACT and the APA Masterclass. Option (b) would double-count the overtime premium relative to the worker's pre-LSL pay pattern. Fixture TC-ACT-051 is drafted on assumption (a).

**Engine impact**: Option (a) is the more complex implementation but the correct one. Engine MUST decompose total hours into base + overtime and apply only the base rate. **Spec/impl-plan/F9 wording should be clarified in a follow-up v0.3.4 amendment** to make the asymmetry explicit. v1 cite: `ACT LSL Act 1976 s.7(1)` (rate excludes overtime) + `s.7(2)` (hours average includes overtime).

---

## TBD-ACT-03 — [Sev-1, LOAD-BEARING] s.7(2) vs s.11D averaging-anchor disambiguation

**Question**: ACT s.7(2) anchors the 12-month casual/PT hours-averaging window at "12 months immediately before the employee became entitled to long service leave" (i.e. the date the worker first reached 7-yr qualifying period). s.11D anchors at "12 months immediately before cessation". The trigger kind determines which anchor applies:

- `taking_leave` → s.7(2) entitlement-date anchor
- `termination` → s.11D cessation-date anchor

How does the engine know "the date the worker became entitled to LSL" — is it `startDate + 7 years` (the natural anniversary), or is it a separately-supplied milestone date?

**PM recommendation**: **Compute entitlement date as `startDate + 7 years` (the natural 7-yr anniversary of continuous service).** No new input field required for v1. If the employee's record contains service-interrupting events (UPL, WC > 2 wks/yr, etc.), the entitlement date shifts out by the day-count of excluded days. Engine MUST track the day-precise entitlement date during the continuous-service walk and use it as the s.7(2) anchor when trigger is `taking_leave`.

**Engine impact**: ½–1 dev-day for the anchor-selection logic. Fixtures TC-ACT-059, TC-ACT-060, TC-ACT-061 are the load-bearing test set.

---

## TBD-ACT-04 — [Sev-1] s.7(3) FT→PT/casual within 2 yrs — 5-yr salary path

**Question**: ACT s.7(3) applies when the employee transitions from full-time to part-time/casual within 2 years prior to reaching the 7-yr LSL entitlement. The formula is total salary over 5 years (the 5 years immediately preceding the entitlement date) divided by 5, divided by 52. How does the engine know about the transition?

**PM recommendation**: **Add `extraInputs.act_ft_to_pt_transition_date: ISODate` (optional).** When present AND `(entitlement_date − act_ft_to_pt_transition_date) <= 2 years`, route to s.7(3) formula. Otherwise route to s.7(2). The optional field defaults to undefined; if a user does not supply it, the engine treats the employee as having had a consistent employment type throughout and applies s.7(2) for casual/PT or fixed-rate for FT.

Boundary inclusivity: exactly 2-yr boundary is INCLUSIVE — `act_ft_to_pt_transition_date == entitlement_date − 2y` routes to s.7(3). Outside the 2-yr window routes to s.7(2). Fixtures TC-ACT-056 (within), TC-ACT-057 (boundary), TC-ACT-058 (outside) cover these.

**Engine impact**: 1 dev-day for the s.7(3) formula + the conditional routing logic.

---

## TBD-ACT-05 — [Sev-2] WC pre/post 9 June 2023 — 2-wk/yr cap interpretation

**Question**: ACT s.2G and s.10A cap pre-9-June-2023 WC absence at 2 weeks per year. Is "per year" calendar-year aligned or service-year aligned (= aligned with employee's start anniversary)? Strict reading of "in any one year" in the WorkSafe ACT guidance is ambiguous.

**PM recommendation**: **Service-year aligned.** Matches WA's pre-2022 15-day sickness cap interpretation per TBD-WA-09 RESOLVED. Also operationally cleaner — engine doesn't need calendar arithmetic against an arbitrary calendar-year boundary. The "year" runs from the employee's startDate anniversary; each service year may carry up to 2 weeks of WC absence that counts. Excess in any service year is excluded from service.

**Cutoff inclusivity at exact-day boundary**: ON 9 June 2023 → post-cutoff (strict "on or after"). Same convention as TBD-WA-11 RESOLVED.

**Engine impact**: ½ dev-day for the per-service-year cap arithmetic. Fixtures TC-ACT-036 (pre-cutoff), TC-ACT-037 (post-cutoff), TC-ACT-038 (straddling), TC-ACT-039 (on-cutoff) cover the cases.

---

## TBD-ACT-06 — [Sev-2] WC DEV-CROSS-2 flags (paidConcurrent, returnToWorkProgram) — do they apply to ACT?

**Question**: WA's DEV-CROSS-2 schema additions include `paidConcurrent?: boolean` and `returnToWorkProgram?: boolean` on `workers_comp_absence` events. These were added for WA's pre-2024-07-01 WC exclusion exceptions. Do these flags affect ACT's pre-9-June-2023 2-wk/yr cap?

**PM recommendation**: **NO — the flags are WA-specific exceptions, not state-agnostic.** ACT's pre-9-June-2023 cap is hard-anchored at 2 weeks per year regardless. v1 ACT orchestrator IGNORES `paidConcurrent` and `returnToWorkProgram` fields on WC events. Fixture TC-ACT-041 verifies this — a WC absence with `paidConcurrent: true` in the pre-cutoff window is still capped at 2 weeks counted.

**Engine impact**: 0 dev-days (no action needed — ignore the fields). Documentary clarification only.

---

## TBD-ACT-07 — [Sev-2] Retirement-age qualifying-reason interpretation

**Question**: ACT s.11C lists "minimum retirement age (per award/agreement, or 65)" as a qualifying reason for pro-rata at 5–7 yrs. How does the engine determine whether retirement qualifies?

**PM recommendation**: **Two-signal check.** Engine reads:
- `employee.dob` (if supplied) — if `age_at_termination >= 65`, retirement qualifies automatically.
- `extraInputs.act_award_min_retirement_age_reached: boolean` (default `false`) — if `true`, retirement qualifies via award/agreement-specified minimum.

When both signals are absent and `reason === 'retirement'`, retirement is treated as NON-qualifying and warning `sub_7yr_no_qualifying_reason_act` fires. Fixtures TC-ACT-013 (age 65), TC-ACT-014 (award-min sub-65), TC-ACT-015 (no signals) cover the cases.

**Engine impact**: ½ dev-day for the qualifying-reason gate logic.

**Sub-question**: Poor-performance dismissal — is it "employer-not-misconduct" (qualifies) or distinct (non-qualifying)? **PM recommendation**: Treat as non-qualifying (parallel to QLD s.95(3)(d) which explicitly excludes performance). Fixture TC-ACT-018 covers this; warning `sub_7yr_no_qualifying_reason_act` fires.

---

## TBD-ACT-08 — [Sev-2] Pay-on-termination 90-day window — engine surface

**Question**: ACT s.11A(4)(b) provides up to 90 days from cessation for the employer to pay the LSL amount. How should the engine surface this in the `Result`?

**Options**:
- **(a)** Add a new optional `payable_by: ISODate` field to `Result`. Purely additive; no breaking change. Available to other states' future engines if they encode similar windows.
- **(b)** Surface only via warning message text — no schema change.

**PM recommendation**: **Option (a) — add `payable_by: ISODate` to `Result`.** Same SA-localised-pattern philosophy: low cost, clear UI affordance, available cross-state if other jurisdictions later need it. The field is undefined for states that don't compute a window (NSW = "forthwith" — no payable_by surfaced).

**Engine impact**: ½ dev-day for the engine surface + UI rendering of the field on the result panel. Fixture TC-ACT-075 is the load-bearing test.

---

## TBD-ACT-09 — [Sev-3] ACT public-holidays calendar source

**Question**: Per the F11-equivalent for ACT (s.9 PH-exclusive), the engine consults an ACT PH calendar. What is the v1 source-of-truth?

**Available sources**:
- **Public Holidays Act 1958 (ACT)** — statutory PH list (NYD, Australia Day, Canberra Day, Good Friday, Easter Saturday, Easter Sunday, Easter Monday, Anzac Day, Reconciliation Day, King's Birthday, Labour Day, Christmas Day, Boxing Day). Canberra Day (second Monday in March) and Reconciliation Day (Monday closest to 27 May) are ACT-unique.
- **Fair Work Ombudsman ACT public holidays page** — operational summary, updated annually.

**PM recommendation**: Hardcode the ACT PH list from the Public Holidays Act 1958 (ACT) into `website/src/lib/lsl/states/act/rules/public-holidays.ts`. Include Canberra Day + Reconciliation Day as ACT-unique PHs. Re-validate annually as part of RES-3 quarterly review. ½ dev-day.

---

## TBD-ACT-10 — [Sev-3] Single-day LSL on a PH (PH-EXCLUSIVE state)

**Question**: When a worker requests a single day of LSL falling on a public holiday in ACT (a PH-exclusive state), what semantics apply?

**PM recommendation**: **The LSL day shifts to the next non-PH working day** — engine charges 1 day of LSL but on a different calendar date. Worker is paid PH rate per award for the original day (outside engine scope). Fixture TC-ACT-044 covers this.

Alternative reading: the engine returns "0 days of LSL consumed" because the requested day was a PH already paid as PH. PM recommends the shift approach because it preserves the user's intent to charge 1 day of LSL.

**Engine impact**: ½ dev-day if shift semantics are implemented (PH-detection + next-working-day computation). 0 dev-days if no-op semantics are accepted.

---

## TBD-ACT-11 — [Sev-3] Portable LSL schemes — out of v1 scope

**Question**: ACT has three separate portable LSL schemes that override the LSL Act 1976 for specific industries — (1) LSL (BCI) Act 1981 (construction); (2) LSL (CCI) Act 1999 (contract cleaning); (3) LSL (PS) Act 2009 (other industries). Should the engine surface an advisory when an employee's industry suggests they may fall under a portable scheme?

**PM recommendation**: **OUT OF v1 ACT engine scope** — same convention as VIC/QLD/WA/SA industry portable schemes. The calculator assumes the LSL Act 1976 (ACT) governs and does NOT surface an industry-portable-scheme advisory in v1. Re-evaluate in v2 if user surveys surface frequent confusion. 0 dev-days.

---

## TBD-ACT-12 — [Sev-3] Cashing-out section reference

**Question**: ACT cash-out is per WorkSafe ACT guidance s.8(c) "in another way" — non-statutory. The s.8(c) interpretation is operational, not verbatim Act text. What citation form should the engine use?

**PM recommendation**: Cite as `ACT LSL Act 1976 s.8(c)` — same Act-level / sub-section pattern; documented limitation that the verbatim Act text does not name cashing out. Documented limitation pending RES-3 quarterly review (parallel to TBD-WA-02 / TBD-SA-03 precedent).

**Engine impact**: No engine-code impact. The citation in `trigger-handlers.ts` will use `section: 'ACT LSL Act 1976 s.8(c)'` until verified.

---

## TBD-ACT-13 — [Sev-3] Unpaid leave continuity-break interpretation

**Question**: ACT s.2G handles unpaid leave as "does not count toward service" without an explicit duration cap (unlike VIC's 52-wk cap). How does the engine determine whether an unpaid-leave event breaks continuity vs merely doesn't count toward service?

**PM recommendation**: For v1, treat all unpaid-leave events as **continuity-preserving but not service-counting** (the "extends-the-line" pattern from SA TBD-SA-04 RESOLVED). The engine pushes the effective entitlement date out by the UPL duration. Operator can dispute via subsequent edit. 0 new dev-days — reuses the SA continuous-service-rules pattern.

---

## TBD-ACT-14 — [Sev-2] Advance leave — engine refusal semantics

**Question**: The ACT Act contains no leave-in-advance provision. Should the engine refuse `taking_leave` triggers at sub-7-yr tenure with:

- **(a)** `status: computed` + `payable_for_taken_leave: 0` + advisory warning. As-at-style informational compute.
- **(b)** `status: failed` + `error.code: 'act_advance_leave_not_permitted'` + no numeric outputs.

**PM recommendation**: **Option (a) — `status: computed` + advisory.** Preserves the as-at computation as informational (parallel to QLD's cash-out at sub-7-yr pattern). User can see what the entitlement WOULD be at their tenure but cannot actually take it. Fixture TC-ACT-070 is drafted on this assumption.

**Engine impact**: ½ dev-day for the advisory + zero-payable handling.

---

## TBD-ACT-15 — [Sev-2] Paid parental leave does NOT count as service

**Question**: WorkSafe ACT guidance explicitly lists paid parental leave (Company-Paid Parental + Government Paid Parental Leave) in the "does NOT count" column of s.2G. Should the engine treat paid parental leave as service-counting (matching NSW/SA/VIC-post-2018) or as non-service-counting (matching the ACT-specific WorkSafe guidance)?

**PM recommendation**: **Non-service-counting per WorkSafe ACT.** This is an ACT divergence from the other states. The engine MUST NOT auto-treat `paid_leave` events labelled as "parental" as service-counting for ACT. v1: engine reads the `note` field on `paid_leave` events; if the note contains "parental" (case-insensitive substring match), the event does not count toward ACT service. Alternative: a more explicit event-type `paid_parental_leave` already exists in the schema; engine treats THAT event-type as non-service-counting for ACT (and falls back to the substring match on generic paid_leave for backward compatibility).

**Engine impact**: ½ dev-day for the event-type / substring handling. Fixture TC-ACT-029 covers this.

---

## TBD-ACT-16 — [Sev-3] Warning-code naming — `act_slackness_of_trade_continuity_preserved` vs WA reuse

**Question**: WA already has a similar slackness-of-trade preservation pattern. Should ACT reuse the WA warning code or introduce an ACT-namespaced equivalent (parallel to SA's `transfer_of_business_continuity_preserved_sa` precedent)?

**PM recommendation**: **Introduce ACT-namespaced code `act_slackness_of_trade_continuity_preserved`.** Same convention as SA's state-namespaced warning codes. Keeps the warning taxonomy state-localised; the engine can swap citations and messages cleanly. Same applies to `transfer_of_business_continuity_preserved_act` (TC-ACT-069) — new ACT-namespaced code.

**Engine impact**: 0 dev-days additional (parallel pattern to SA).

---

## TBD-ACT-17 — [Sev-2] Sickness 2-wk/yr cap interpretation

**Question**: ACT s.2G caps sickness/injury absence at 2 weeks per year. Per service year or per calendar year? Same as TBD-ACT-05 (WC) which was resolved per-service-year.

**PM recommendation**: **Per service year** (same as TBD-ACT-05). Operationally cleaner; matches WA pre-2022 cap pattern. Fixture TC-ACT-033 is drafted on this assumption.

**Engine impact**: ½ dev-day (folded into the s.2G continuous-service profile work).

---

## Net effect on fixtures and impl-plan (if all 17 TBDs are resolved per PM recommendations)

| Resolution | Fixture impact | Impl-plan impact |
|---|---|---|
| TBD-ACT-01 | Fixtures unchanged. WC-override module added to engine layout. | §Phase 7 expanded to document WC date-aware override at 9 June 2023 (parallel to WA's 2024-07-01 module). No re-scope — effort stays at L (5–7 d). |
| TBD-ACT-02 | TC-ACT-006, TC-ACT-051, TC-ACT-053 are drafted on the asymmetric (a) interpretation. Spec wording clarification recommended in v0.3.4 amendment. | §Phase 7 documents the asymmetric ordinary-pay interpretation. F9 wording corrected in spec v0.3.4 follow-up. |
| TBD-ACT-03 | TC-ACT-059 → TC-ACT-061 are the s.7 vs s.11D anchor split fixtures. | §Phase 7 documents the entitlement-date computation rule (`startDate + 7 years` adjusted for excluded days). |
| TBD-ACT-04 | TC-ACT-056 → TC-ACT-058 cover the s.7(3) routing. `extraInputs.act_ft_to_pt_transition_date` field documented. | §Phase 7 documents the ACT-localised `extraInputs.act_*` keys (no DEV-CROSS-4). |
| TBD-ACT-05 | TC-ACT-036 → TC-ACT-041 use per-service-year cap. | §Phase 7 reuses the WA pre-2022 cap pattern. |
| TBD-ACT-06 | TC-ACT-041 verifies WA DEV-CROSS-2 fields are ignored by ACT orchestrator. | §Phase 7 documents the cross-state-field-ignored decision. |
| TBD-ACT-07 | TC-ACT-013, TC-ACT-014, TC-ACT-015, TC-ACT-018 use the two-signal retirement gate + poor-performance non-qualifying treatment. | §Phase 7 documents `extraInputs.act_award_min_retirement_age_reached` and `employee.dob` reads. |
| TBD-ACT-08 | TC-ACT-002, TC-ACT-005, TC-ACT-009, TC-ACT-020, TC-ACT-075 surface `payable_by`. | §Phase 7 adds `payable_by: ISODate (optional)` to `Result` interface in `engine/types.ts`. Purely additive. |
| TBD-ACT-09 | TC-ACT-042 → TC-ACT-044 reference hardcoded ACT PHs from Public Holidays Act 1958 (ACT). | §Phase 7 / T7.2 adds `rules/public-holidays.ts` (½ dev-day). |
| TBD-ACT-10 | TC-ACT-044 uses the shift-to-next-non-PH semantics. | §Phase 7 confirms shift-to-next-PH semantics on single-day-LSL-on-PH cases. |
| TBD-ACT-11 | No fixture impact. Out of v1 scope. | §Phase 7 documents portable schemes as deferred per state convention. |
| TBD-ACT-12 | TC-ACT-064 → TC-ACT-067 cite `ACT LSL Act 1976 s.8(c)`. | §Phase 7 documents the documented-limitation citation form. |
| TBD-ACT-13 | TC-ACT-028 is drafted on "extends-the-line" UPL. | §Phase 7 reuses the SA `extends-the-line` pattern. |
| TBD-ACT-14 | TC-ACT-070 uses `status: computed` + advisory. | §Phase 7 confirms advisory-not-hard-error semantics. |
| TBD-ACT-15 | TC-ACT-029 covers paid parental leave non-counting. | §Phase 7 documents the ACT-specific paid-parental-leave exclusion (engine read on event note or new event-type). |
| TBD-ACT-16 | TC-ACT-032, TC-ACT-069 use ACT-namespaced warning codes. | §Phase 7 documents the state-namespaced warning-code convention. |
| TBD-ACT-17 | TC-ACT-033 uses per-service-year sickness cap. | §Phase 7 reuses the WA pre-2022 cap pattern. |

**No fixture-value changes are expected from the v1.0-draft assuming operator accepts all PM recommendations.** All 75 single-mode + 3 bulk fixtures stand as drafted. If operator overrides PM recommendations on TBD-ACT-02, TBD-ACT-04, TBD-ACT-08, TBD-ACT-14, or TBD-ACT-15, some fixture values may need to shift.

**Effort estimate summary**:
- TBD-ACT-01 (single-rule-set + WC override): ½ d added; total Phase 7 stays at L (5–7 d).
- TBD-ACT-02 (asymmetric interpretation): 0 d added (engine already needs the decomposition under PM-recommended (a)).
- TBD-ACT-03 (anchor-by-trigger): ½–1 d (folded into T7.2).
- TBD-ACT-04 (s.7(3) routing): 1 d (folded into T7.2).
- TBD-ACT-05 (per-service-year cap): ½ d (folded into T7.2).
- TBD-ACT-06 (ignore WA flags): 0 d.
- TBD-ACT-07 (retirement gate): ½ d (folded into T7.2).
- TBD-ACT-08 (payable_by surface): ½ d (engine + UI).
- TBD-ACT-09 (PH calendar): ½ d.
- TBD-ACT-10 (single-day-PH shift): ½ d.
- TBD-ACT-11 (portable schemes deferred): 0 d.
- TBD-ACT-12 (citation form): 0 d.
- TBD-ACT-13 (UPL extends-the-line): 0 d.
- TBD-ACT-14 (advance-leave advisory): ½ d (folded into T7.2).
- TBD-ACT-15 (paid parental excluded): ½ d (folded into T7.2).
- TBD-ACT-16 (state-namespaced codes): 0 d.
- TBD-ACT-17 (sickness cap): 0 d (same module as TBD-ACT-05).

**Total: ~4–6 dev-days within the L (5–7 d) Phase 7 envelope.** No effort re-scope required if PM recommendations are accepted in full. **No DEV-CROSS-4 dev-finding is created** — all schema additions are ACT-localised via `extraInputs` and one additive optional `Result` field. **T7.1 will be unblocked immediately on PM sign-off** — no pre-flight cross-state PR required.

---

## Provisions deliberately deferred from v1 ACT encoding

| Provision | Reason for deferral |
|---|---|
| **Defence Force service continuity** (s.2G — employed immediately before Defence Force service) | Edge case. Out of v1 scope. Operator-supplied note can drive a workaround if a customer surfaces the case. |
| **Service outside ACT — temporary inter-state secondment** (s.2G — would be continuous if working in ACT) | Defer to F13 cross-jurisdictional handling. Out of v1 scope as a separate continuity rule. |
| **LSL (BCI) Act 1981 (construction)** + **LSL (CCI) Act 1999 (contract cleaning)** + **LSL (PS) Act 2009 (other portable schemes)** | Separate portable schemes. Out of v1 statutory engine scope. Same convention as other states' industry-portable schemes. |
| **Employer direction 60-day notice (s.6(2))** | Procedural; not engine-blocking. Engine emits no advisory in v1. |
| **Records retention (s.12 — 7 yrs)** | Operational requirement; not a calculation question. Out of v1 statutory engine scope. |
| **Higher-duties / acting rate** | No statutory analogue in the ACT Act (unlike SA s.4 which has an explicit rule). Out of v1 ACT encoding. |
| **Half-pay / double-pay** | The ACT Act is silent on half-pay/double-pay; no statutory entitlement. Out of v1. |

---

## Sign-off summary

This contract proposes 17 TBDs for operator resolution:
- **3 Sev-1 (LOAD-BEARING)**: TBD-ACT-01 (architecture), TBD-ACT-02 (overtime asymmetry), TBD-ACT-03 (anchor split).
- **1 Sev-1**: TBD-ACT-04 (s.7(3) FT→PT routing).
- **6 Sev-2**: TBD-ACT-05, -07, -08, -14, -15, -17.
- **7 Sev-3**: TBD-ACT-06, -09, -10, -11, -12, -13, -16.

All 17 carry PM recommendations. Operator decision binds the v1 ACT engine. If operator accepts all PM recommendations:
- Phase 7 effort estimate stays at **L (5–7 dev-days)** per impl-plan v0.3.3 §Phase 7.
- **No DEV-CROSS-4** dev-finding is created. All schema additions are ACT-localised via `extraInputs` (parallel to SA TBD-SA-04 / -07 RESOLVED pattern). One purely-additive optional `Result.payable_by: ISODate` field is added (TBD-ACT-08).
- **T7.1 unblocked immediately on PM sign-off** — no pre-flight cross-state PR required.

---

## Signature line

```
Signed: __________________________ (PM)
Date:   __________________________
```

> PM-only sign-off per E2 spec RES-6 / AC4. Sign-off completes T7.0. **T7.1 (ACT rule-set scaffold) is UNBLOCKED on PM sign-off.** No pre-flight cross-state PR required — all ACT-specific signals are ACT-localised via `extraInputs` (parallel to SA Phase 6 precedent).

---

*End of test-cases-act.md v1.0 DRAFT · awaiting PM sign-off.*
