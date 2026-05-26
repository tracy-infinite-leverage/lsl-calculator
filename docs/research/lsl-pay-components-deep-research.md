# LSL Pay Components — Deep Research Across the 8 Australian Jurisdictions

**Document version:** 2.0
**Date:** 2026-05-25
**Author:** Product / Research
**Purpose:** Drive engine design for all 8 Australian LSL jurisdictions + Commonwealth scheme. Surface every anomaly that needs to be coded into the calculator and every difference between "value of a week" when LSL is TAKEN as leave vs. PAID OUT on termination.

**v2.0 changelog:** Incorporates Australian Payroll Association LSL Masterclass 2026 (158 pp) and 8 state-overview PDFs (NSW/VIC/QLD/WA/SA/TAS/ACT/NT). Material corrections from v1.0:
- **QLD ordinary pay INCLUDES penalty rates** (shift penalties, weekend and public holiday loadings) — v1.0 had these excluded.
- **TAS ordinary pay INCLUDES shift penalties** and all-purpose allowances — v1.0 had these excluded.
- **NT Workers Compensation does NOT count as service** — v1.0 had it counted; the masterclass overview makes this explicit.
- **NSW high-income threshold for bonus inclusion is $183,100 p.a.** (changes 1 July annually) — v1.0 didn't quote a figure.
- **Dual-regime jurisdictions added**: VIC (pre/post 1 Nov 2018), WA (pre/post 20 June 2022 entitlement, plus Workers Comp from 1 July 2024), ACT (pre/post 9 June 2023 for Workers Comp).
- **Commonwealth LSL Act 1976** added as a 9th scheme that may apply to APS / public-sector / non-APS Commonwealth agencies.
- **Pre-modern award carve-out** added: federal pre-modern awards with LSL clauses can override state LSL Acts (e.g. Graphics Arts General Award 2000, Meat Award).

---

## 0. Source provenance and confidence

| Jurisdiction | Act | Primary source read | Confidence |
|---|---|---|---|
| **NSW** | Long Service Leave Act 1955 (No. 38) | NSW Government guidance + AustLII snippets + Australian Payroll Association masterclass (s4(11), s3(2), s8 records) | **High** (training cross-checks regulator) |
| **VIC** | Long Service Leave Act 2018 (No. 12 of 2018) — Auth Ver No. 004 | legislation.vic.gov.au PDF read directly through s34 + Masterclass dual-regime rules (LSL Act 1992 ss 62-63 still relevant for pre-1/11/2018 service) | **High** |
| **QLD** | Industrial Relations Act 2016, Pt 3 Div 9 (ss 93–110) | Business Queensland regulator + Masterclass + AustLII snippets (verbatim s95/s98 partial) | **Medium-High** (verify exact subsection text against legislation.qld.gov.au before shipping) |
| **WA** | Long Service Leave Act 1958 — As at 31 Jan 2025 (PCO 04-m0-00) | legislation.wa.gov.au PDF read directly (s4 through s10) + Masterclass dual-regime rules (pre/post 20 June 2022; Workers Comp from 1 July 2024) | **High** |
| **SA** | Long Service Leave Act 1987 — 1.1.2010 reprint (verify post-2010 amendments) | saasso.asn.au PDF read directly (ss 1–17 + Schedule) + Masterclass (156-week averaging detail) | **High** for read text; **Medium** for currency |
| **TAS** | Long Service Leave Act 1976 | legislation.tas.gov.au summary + Masterclass (s11 ordinary pay, s8 entitlement, s5 continuity, s12 termination) | **Medium-High** |
| **ACT** | Long Service Leave Act 1976 — Republication No 29 effective 19 Nov 2025 | legislation.act.gov.au PDF read directly (s2A through s12) + Masterclass dual-regime rules (Workers Comp from 9 June 2023) | **High** |
| **NT** | Long Service Leave Act 1981 — As in force 14 October 2015 | legislation.nt.gov.au PDF read directly + Masterclass (Workers Comp DOES NOT count) | **High** (verify post-2015 amendments) |
| **Commonwealth** | Long Service Leave (Commonwealth Employees) Act 1976 | Masterclass overview | **Medium** — verify before applying to any APS / Cth-agency employee |

> ⚠️ **Pre-implementation gate**: Before any WA/SA/TAS/ACT/NT engine ships, a payroll-qualified legal reviewer (Holding Redlich, Maddocks, or equivalent — or the Australian Payroll Association if Tracy already has a relationship) should sign off on this matrix. Section numbers and currency-of-version are the kind of thing a calculator must get right.

---

## 1. Executive summary — top 10 highest-impact differences a calculator MUST handle

1. **Accrual formulas split into 3 families:**
   - **NSW, QLD, WA, TAS**: `Years × (8.6667 / 10)` — 8.6667 wks at 10y, +4.3333 wks per subsequent 5y.
   - **VIC and ACT**: `Years × (6.0667 / 7)` — VIC: 1/60th of total continuous employment after 7y; ACT: 6.0667 wks at 7y, +0.8667 wks per year. Both formulas yield 8.6667 wks at 10y, which is why the Masterclass notes you can also use the NSW formula for VIC/ACT past year 10.
   - **SA and NT**: `Years × (13 / 10) = 1.3 wks/year` — 13 wks at 10y.
   - **Commonwealth**: `0.3 months/year` after 10y (= 3 months at 10y; 9 days per year thereafter; **calendar days, not working days**).

2. **Pro-rata triggers differ — both threshold and grounds.**
   - **NSW**: 5y (illness/incapacity/domestic-pressing-necessity/death) OR 10y (any reason).
   - **VIC**: 7y (any cessation — s9 treats termination as deemed leave start).
   - **QLD**: 7–10y on (a) death; (b) illness/domestic/pressing necessity; (c) employer dismisses for illness; (d) employer dismisses for reason other than conduct/capacity/performance; **(e) employer unfairly dismisses**. After 10y: any reason.
   - **WA**: 7y for any reason other than serious misconduct.
   - **SA**: 7y for any reason **except** (i) serious & wilful misconduct, (ii) worker unlawfully terminates (e.g. no notice).
   - **TAS**: 7y on retirement (60F/65M), death, employer-not-misconduct, illness/incapacity/domestic-pressing-necessity.
   - **ACT**: **5y** (lowest in country) on illness/incapacity/domestic-pressing-necessity, retirement, death, employer-not-misconduct.
   - **NT**: 7y on retirement (Age Pension age), employer-not-misconduct, illness/incapacity/domestic-pressing-necessity. (NOT death — death is covered separately under s10(3).)

3. **What counts as "ordinary pay" diverges most on penalty rates and allowances.** **Penalty rates excluded:** NSW, VIC, WA, SA, ACT, NT. **Penalty rates INCLUDED:** **QLD (shift penalties, weekend and PH loadings)** and **TAS (shift penalties + all-purpose allowances)**. **Bonuses:** NSW (only if under $183,100 high-income threshold + 4-criteria test), NT (if usually paid), ACT/VIC (if in contract); **TAS excludes bonuses absolutely (s11(2)(h))**. **Casual loading:** included in all jurisdictions where casuals get LSL (NSW/VIC/QLD/WA/SA/TAS/ACT/NT all include it).

4. **Averaging windows are bespoke per state.**
   | Jurisdiction | Window | Trigger |
   |---|---|---|
   | NSW | **Greater of 12 months OR 5 years** (each measured in days: 365/366 or 1825/1826/1827) | Varying-hours OR commission/result-based |
   | VIC | **Greatest of 52 wks / 260 wks / entire continuous employment** | Hours fixed but changed in last 104 wks OR no fixed hours |
   | QLD | 12 months (commission via `÷ 52.179`); total ordinary hours over service for casual/PT/Mixed (s105) | Casual/PT/Mixed (s105); commission earner |
   | WA | **365 days** for piecework/commission/bonus; entire-employment with **per-accrual-period averaging** (1st 10y separately from 11–15y, etc.); **overtime hours INCLUDED if regular** | Variable hours OR results-based |
   | SA | **156 weeks (3 years)** — disregard whole weeks of unpaid leave; substitute next-available working week; overtime hours included | Casual/PT/variable-hours (3-year window); commission (12-month window) |
   | TAS | **3 months** for commission; **12 months** for casual hours | Piecework/results-based; casual |
   | ACT | s7(2) **12 months before became entitled**; s7(3) **5 years** if FT→PT/casual within 2y of entitlement; s11D **12 months before cessation** | Casual/PT; mid-service transition; cessation pay-in-lieu |
   | NT | **per-year-of-service** (each year averaged separately, then summed); piecework: **12 months before leave/termination** | Hours vary; rate varies |
   | Commonwealth | Pay category determined by current employment status; formula = `(Annual Salary / 12) × LSL credits` | All scenarios |

5. **Public holidays during LSL — three different rules.**
   - **Extends LSL by 1 day each (Exclusive)**: NSW s4(4A), WA s9(4), TAS s12(9), ACT s9, VIC s7, QLD s95(5) — **6 jurisdictions follow this rule.**
   - **PH is part of LSL — NO extension (Inclusive)**: SA s7(7), NT s9 — **2 jurisdictions.**
   - **WA caveat**: extension only applies when LSL is being TAKEN under s8(2)(a)/(b). On s9(2) deemed termination payout, the rule does NOT apply.

6. **"Same rate, different date" is the dominant pattern for taken-vs-paid-out, with critical exceptions.**
   - **VIC s10 death override**: averaging collapses from "greatest of 52/260/entire" to **exactly 52 weeks before death**.
   - **ACT s7 vs s11D anchor**: the 12-month averaging window for *taking* LSL ends on the day employee became entitled; for *paying-in-lieu on cessation* it ends on the day of cessation. Different averages whenever hours changed in the interim.
   - **WA s7(4)**: 365-day piecework/commission average anchor moves between four reference dates: day before LSL commences / day before s5 cash-out agreement / day before last day employed / day before death.
   - **NSW prescribed date lock**: rate is locked at prescribed date — subsequent pay increases do NOT apply (regulator). Contrast VIC s21 which catches mid-leave pay increases.

7. **Cash-out / payment-in-lieu during employment splits 4-4.**
   - **Permitted**: WA s5 (written, signed, post-accrual, ≥ ordinary pay rate, no further accrual on cashed portion), SA s5(1a) (written individual agreement + written statement with worker name/date/entitlement/payment/period/remaining/employer name signed), QLD s110 (restricted — award/IA permits OR QIRC approves on compassionate or financial hardship grounds; once per entitlement), TAS s10 (by agreement once entitlement reached), ACT per WorkSafe ACT guidance under s8(c) "in another way".
   - **Forbidden**: NSW s4(8) (codified — payment in lieu only on termination), VIC s34 (offence; 12 penalty units natural / 60 body corporate), NT s10(4) (no other payment in lieu allowed).

8. **Half-pay / double-pay leave permitted in only 3 jurisdictions.**
   - **WA s9(1C/D)**: both half-pay (twice duration) and double-pay (half duration) allowed by request — employer not obligated.
   - **VIC s22**: half-pay only — request, employer must grant unless reasonable business grounds.
   - **Commonwealth LSL Act 1976**: half-pay allowed.
   - **Others silent / not permitted in statute.**

9. **NT's per-year formula is structurally unique.** NT s11(3) computes payment as `Σ over each completed year of service: RP_y × HWW_y × 1.3` — each year has its own hours average. If hours dropped in year 8 of 10, year 8 contributes its own weighted amount. Calculator must store hours-per-year history, not just current hours. Termination uses same per-year structure with `RP = rate immediately preceding cessation`.

10. **Dual-regime jurisdictions require date-of-entitlement / date-of-event branching.**
    - **VIC**: pre-1/11/2018 service governed by LSL Act 1992 (ss 62-63); post-1/11/2018 governed by LSL Act 2018. Rehire windows differ (3 months → 12 weeks), illness/injury cap differs (48 weeks/year → unlimited), parental leave casual treatment differs (none → 104 weeks).
    - **WA**: entitlement reached before 20 June 2022 — illness/injury ≤15 working days/year; LWOP doesn't count. From 20 June 2022 — broader paid leave (parental incl. GPPL, family violence) counts; ALL unpaid leave doesn't count.
    - **WA Workers Comp**: pre-1 July 2024 + entitlement pre-20 June 2022 → counts up to 15 days/year. Pre-1 July 2024 + entitlement post-20 June 2022 → does NOT count (unless casual). From 1 July 2024 → counts under s61(d) Workers Compensation & Injury Management Act 2023.
    - **ACT Workers Comp**: pre-9 June 2023 → only counts up to 2 weeks/year. From 9 June 2023 → counts as service per s46 Workers Compensation Act 1951.
    - **Calculator must record entitlement-reached date AND any continuity-impacting event date** so it can branch correctly.

---

## 2. Pay-component comparison matrix

Reading guide: ✓ = included in ordinary pay; ✗ = excluded; ◐ = conditional (see notes). Section references are to each jurisdiction's LSL Act unless stated.

### 2.1 Inclusion / exclusion of pay components

| Pay component | NSW | VIC | QLD | WA | SA | TAS | ACT | NT |
|---|---|---|---|---|---|---|---|---|
| Ordinary wages/salary | ✓ | ✓ | ✓ | ✓ | ✓ (incl. above-award) | ✓ | ✓ | ✓ |
| Overtime | ✗ | ✗ | ✗ | ✗ s7A | ✗ s3(2) | ✗ s11(2) | ✗ | ✗ s7(2) |
| **Penalty rates** (shift/weekend/PH loadings) | ✗ | ✗ | **✓ INCLUDED** | ✗ s7A | ✗ s3(2) | **✓ shift penalties INCLUDED** s11 | ✗ | ✗ s7(2) |
| Casual loading | ✓ | ✓ s15 | ✓ (loaded casual hourly rate) | ✓ s7B | ✓ s3(2)(b) (explicit — "casual not a penalty rate") | ✓ | ◐ via PT/casual averaging | ◐ (silent — practice include) |
| Commission / piecework | ✓ branch B s3(1)(b) | ✓ s15 (if in contract) | ✓ s99 — default `÷ 52.179` | ✓ s7(4) avg 365 days | ✓ s3(2)(a) | ✓ s11(3) avg 3 months | ✓ s2F (`total/52`) | ✓ s7(2)(b) (avg over year) |
| Bonus / incentive | ◐ — only if (a) in employment terms, (b) part of established scheme, (c) performance-based, (d) not main remuneration; **AND only if employee under $183,100 high-income threshold** | ◐ — only if in oral/written contract | (not detailed in regulator) | ✗ s7A excludes "any similar payments" but s7(4) catches piecework/bonus via averaging | ✗ s3(2) silent on bonus | **✗ s11(2)(h) explicit exclusion** | ✓ if usually paid with salary (e.g. KPI bonuses) | ✓ s7(2)(b) (explicit: "amounts usually paid with pay") |
| All-purpose / industry / leading hand / skill / qualification allowances | ✓ skill & qualifications | ✓ s15 (if part of contract) | (regulator silent) | ✗ s7A | (silent — likely included if all-purpose) | **✓ all-purpose allowances INCLUDED**; ✗ inconvenience/danger/hardship/hot/cold/dirt | ✓ skills + all-purpose allowances; ✗ allowances not paid for all purposes (i.e. non-overtime-counting) | ✓ s7(2)(a) (industry/leading hand/skill/qualification/service grant) |
| District/site/climatic allowances | (silent) | (silent) | (silent) | ✗ s7A | (silent) | ✗ s11(2) | (silent) | ✗ s7(2) explicit |
| Expense reimbursements / travel / vehicle / meal allowance | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ s11(2)(g) (travel + LAFH excluded); meal excluded | ✗ | ✗ |
| Cash value of board/lodging (provided in employment, NOT during leave) | ✓ | ✓ s15(1)(b) | (not detailed) | ✓ s7C | ✓ s3(2)(c) | ✓ | ✓ | ✓ s7(2)(c) ($15/wk board, $5/wk lodging fallback) |
| Salary sacrifice gross-up | Silent (use pre-sacrifice rate by industry practice; default in calculator, configurable) |
| FBT-grossed-up amounts | Silent in all jurisdictions; treat as cash equivalent where the Act explicitly addresses non-cash (NT s7(2)(c) for board/lodging only) |

### 2.2 Averaging windows for variable-pay or variable-hours workers

| Jurisdiction | Window for variable PAY | Window for variable HOURS | Reference date | Exclusions from average |
|---|---|---|---|---|
| **NSW** | Greater of **12 months OR 5 years** (in days — 365/366 OR 1825/1826/1827) | Same as pay (hours+pay merged) | Prescribed date = day before leave commences OR day before last day employed | Days NOT counted: (a) unpaid leave days (whether or not counted as service); (b) casuals' days not remunerated outside typical pattern; (c) days not wholly fixed-rate; (d) JobKeeper-direction days; (e) COVID-19 stand-down days |
| **VIC** | Greatest of **52 wks / 260 wks / entire continuous employment** (s15(2)) | Same windows for normal hours (s16): `A = (B+C)/(52−D)`, `(260−D)`, `(weeks of continuous employment − E)` where B = hours worked, C = paid leave hours, D = unpaid leave weeks | Day LSL starts; s10(3)(b) collapses to 52 weeks before DEATH | Unpaid leave weeks (D in formula); s14 absences (stand-down, employer-avoidance, industrial dispute) |
| **QLD** | 12 months (commission via `÷ 52.179`); s105: total ordinary hours over period of service `÷ 52` | s105 hours formula `(Total Ordinary Hours / 52) × (8.6667 / 10)` produces HOURS for casual/PT/Mixed | Time leave taken; **higher of ordinary rate vs award rate** under s98 | Unpaid leave; absences not counted as service |
| **WA** | **365 days** for piecework/commission/bonus (s7(4)); **per-accrual-period** for casual/varied-hours (each 10y / next 5y block averaged separately) | s7(2) average ascertainable hours over employment, excluding s6A(2) periods | s7(4) anchors at: day before LSL / day before s5 cash-out / day before last day employed / day before death | s6A(2): unpaid leave, stand-downs, transfer-of-business gaps, post-apprenticeship gaps |
| **SA** | **156 weeks (3 years)** s3(2)(b) — variable hours / hourly / casual / PT; 12 months s3(2)(a) — commission/result-based | Same 156-week window for hours; **disregard whole weeks of unpaid leave or workers comp; substitute next-available working week** so window remains 156 weeks of actual work | s3 "relevant date" = day LSL commences OR day payment-in-lieu arises | Unpaid leave weeks; workers-comp weeks (in averaging — note s6(1)(d) preserves continuity) |
| **TAS** | **3 months** for results-based (s11(3)); **12 months** for no-fixed-hours (s11(6)) — casuals | Same 12-month casual window | Day leave commences; s12(4) anchors at termination date if terminated before LSL taken | (not explicit in source) |
| **ACT** | s7(2) PT/casual: **12 months immediately before became entitled**; s7(3) FT→PT/casual within 2y: **5 years × salary/wages / 5**; s11D (cessation): **12 months immediately before cessation** | Same anchor as pay (s7 or s11D) | Entitlement date (for taking LSL); cessation date (for s11A/s11C payment in lieu) | (not explicit; assume unpaid leave excluded) |
| **NT** | s11(3) **per completed year of continuous service** — each year's `RP × HWW × 1.3` summed | s11(1): hours per year = fixed OR averaged over a year of continuous service, excluding overtime; s11(1)(b) for variable | Day immediately preceding cessation OR LSL start (RP definition) OR day agreed under s8(8)(a) | Overtime hours, district/site/climatic allowances, penalty rates |
| **Commonwealth** | n/a — formula is `(Annual Salary / 12) × LSL credits` | n/a — calendar days basis | Current employment status / pay category | n/a |

### 2.3 Differences between TAKEN vs PAID-OUT (the headline question)

| Jurisdiction | When TAKEN | When PAID OUT on termination | When CASHED OUT during employment | Key difference |
|---|---|---|---|---|
| **NSW** | Greater of: current rate × normal hours OR 5-year average ord. remuneration; OR (if varied hours) current hourly × 12mo hours OR 5-yr fixed rate / total days × 7; OR (if varied pay) greater of 12mo OR 5-yr average weekly wage | **Same calc; prescribed date = day before last day employed**; s4(5) "shall forthwith pay in full"; s4(11)(a1) covers casuals' continuity | No general cash-out (s4(8)) | Rate is **locked at prescribed date** — subsequent pay increases do NOT flow through (regulator) |
| **VIC** | Ordinary pay at start of LSL (s15); pay increases mid-leave catch up (s21) | **Same calc** — "calculated as at the day on which the employment ends" (s9(1)(b)) | **Forbidden** s34 | **s10(3)(b) DEATH override**: averaging collapses to 52 weeks before death |
| **QLD** | Ordinary rate at time leave taken; **higher of ordinary vs award rate** s98; commission via s99 default `÷ 52.179`; s105 for casual/PT/Mixed (total hours / 52 × 8.6667/10) | **Same calc**; payable within **3 days** of termination s373(6) | s110: award/IA permits OR QIRC approves (compassionate/financial-hardship); once per entitlement | **Same calc** — but cash-out gated by QIRC application |
| **WA** | Ordinary pay at LSL commencement (s7(1)); 365-day average for piecework/commission (s7(4)); per-accrual-period for casual/varied | **Same calc** — s9(2) deems LSL commences on day of termination | s5 cash-out: written agreement, signed both, post-accrual, ≥ ordinary pay rate, no further accrual on cashed portion | **PH extension (s9(4)) applies only when LSL is taken under s8(2)(a)/(b) — NOT on s9(2) termination payouts**; 365-day anchor moves between 4 reference dates depending on event |
| **SA** | Ordinary weekly rate of pay at "relevant date" (s3) — 156-week average for variable hours; commission 12-month average | s5(2)/(3) + s8(4): **at rate immediately before termination**; payable **immediately on termination** | s5(1a): written individual agreement post-accrual; s8(3a): calculated at rate **immediately before payment** + variation top-up if rate rises during covered period | Underlying formula identical; only reference date moves. **s8(3a)(b) variation top-up is unique to SA cash-out** |
| **TAS** | Ordinary pay per s11; casual: 12-month hours × current rate (incl. casual loading) immediately prior; commission: 3-month average; **rate day-to-day VARIES depending on what allowances/penalties apply on the day leave is taken** | **Same calc**; s12(4) deems leave commenced on termination date | s10 cash-out by agreement once entitlement reached | TAS day-to-day variation is unique — calculator must compute by-day, not just by-week |
| **ACT** | s7(1) ordinary remuneration; s7(2) PT/casual: avg hours **12 months before became entitled** × ordinary rate that day; s7(3) FT→PT within 2y: **5-yr salary total / 5** | s11A + s11D: rate **immediately before cessation**; PT/casual avg hours **12 months immediately before cessation**; pro-rata 5–7y under s11C uses years+months/12 | Per WorkSafe ACT guidance under s8(c) "in another way" | **ACT s7 vs s11D anchor moves** between entitlement date (taking) and cessation date (pay-in-lieu) — different averages when hours have changed |
| **NT** | s11(2)/(3): `Σ RP × HWW × 1.3` per completed year; RP = rate immediately preceding day LSL taken | **Same per-year formula**; RP = rate immediately preceding cessation | s10(4): **forbidden** | NT's per-year structure means rate at cessation is applied across all years (RP) but hours are per-year (HWW). **Calculator must keep HWW history per year of service** |
| **Commonwealth** | At current pay category | Same formula `(Annual Salary / 12) × LSL credits` | **Cannot be cashed out** | Same calc; cannot take in advance |

### 2.4 Public holidays during LSL

| Jurisdiction | Effect | Section |
|---|---|---|
| NSW | **Exclusive** — extends LSL by 1 day per PH | s4(4A) |
| VIC | **Exclusive** — LSL does not include PH | s7 |
| QLD | **Exclusive** — LSL does not include PH | s95(5) |
| **WA** | **Exclusive** — extends LSL by 1 day per PH **but only when LSL is taken under s8(2)(a)/(b); does NOT apply to s9(2) termination payouts** | s9(4) |
| SA | **Inclusive** — every day after LSL commencement (incl. PH) counted as LSL day | s7(7) |
| TAS | **Exclusive** — PH not counted as LSL day | s12(9) |
| ACT | **Exclusive** — extends LSL by 1 day per PH | s9 |
| NT | **Inclusive** — PH is part of LSL; period not increased | s9 |
| Commonwealth | Inclusive — calendar-day basis (weekends + PH counted) | LSL Act 1976 (Cth) |

### 2.5 Cash-out / payment-in-lieu

| Jurisdiction | Permitted? | Conditions |
|---|---|---|
| NSW | **No** (s4(8)) | Payment in lieu only on termination or portable scheme |
| VIC | **No** (s34) | Offence — penalties: 12 units natural / 60 body corporate |
| QLD | **Restricted** (s110) | Award/IA permits OR QIRC approves on compassionate or financial-hardship grounds; once per entitlement |
| **WA** | **Yes** (s5) | Written agreement, signed both, post-accrual; ≥ ordinary pay rate; details: amount of leave + dollar value; copy on file; **no further accrual on cashed portion** |
| SA | **Yes** (s5(1a)) | Written individual agreement post-accrual; signed both; copy on file; **written statement required** with: worker name, date, current entitlement (weeks/hours), payment amount, period covered, remaining days, employer name, signed/dated |
| TAS | **Yes** (s10) | By agreement once entitlement reached |
| ACT | **Yes** (per WorkSafe ACT guidance under s8(c)) | "in another way"; value calculated same as if LSL taken; best practice: written agreement, leave-in-weeks, remaining balance, governed by company policy |
| NT | **No** (s10(4)) | Except as s10(1)/(2) provides on cessation |
| Commonwealth | **No** | Cannot be cashed out |

### 2.6 Half-pay / double-pay leave

| Jurisdiction | Half pay? | Double pay? | Section |
|---|---|---|---|
| WA | ✓ employee request | ✓ employee request | s9(1C)/(1D) — employer not obligated to agree |
| VIC | ✓ employee request | ✗ | s22 — employer must grant unless reasonable business grounds |
| Commonwealth | ✓ | ✗ | LSL Act 1976 (Cth) |
| Others | Silent | Silent | — |

### 2.7 Pro-rata triggers on termination

| Jurisdiction | Threshold | Grounds | Exclusions |
|---|---|---|---|
| **NSW** | **5y** (illness/incapacity/domestic-pressing-necessity/death) OR **10y** (any reason) | s4(2) | Serious misconduct |
| **VIC** | **7y** | s9 — any cessation deemed leave start; full entitlement payable on termination day | (common law) Serious misconduct |
| **QLD** | **7y** | s95(3)/(4): death; illness/domestic/pressing necessity; employer dismisses for illness; employer dismisses for reason other than conduct/capacity/performance; **employer unfairly dismisses** | Serious misconduct |
| **WA** | **7y** | s8(3): death OR any termination "other than by the employer for serious misconduct" | Employer-initiated for serious misconduct |
| **SA** | **7y** | s5(3): any termination | (a) serious & wilful misconduct; (b) worker unlawfully terminates (e.g. not giving enough notice) |
| **TAS** | **7y** | s8(3): retirement (60F/65M); death; employer-not-misconduct; illness/incapacity/domestic-pressing-necessity | Serious & wilful misconduct |
| **ACT** | **5y** (lowest in country) | s11C: illness/incapacity/domestic-pressing-necessity; retirement (award/agreement OR 65); death; employer-not-misconduct | Serious & wilful misconduct |
| **NT** | **7y** | s10(2): retirement (Age Pension age); employer-not-misconduct; illness/incapacity/domestic/pressing-necessity | Serious misconduct; **death is covered separately under s10(3)** |

### 2.8 Accrual entitlement at common milestones

| Jurisdiction | Formula | At 7y | At 10y | At 15y |
|---|---|---|---|---|
| NSW | `Years × 8.6667/10` | n/a (no taking before 10y) | 8.6667 wks | 13 wks |
| VIC | `Years × 52 × 1/60` (= `Years × 8.6667/10`) — continuous accrual | 6.0667 wks | 8.6667 wks | 13 wks |
| QLD (FT) | `Years × 8.6667/10` (s95) | n/a | 8.6667 wks | 13 wks |
| QLD (Casual/PT/Mixed) | `(Total Ordinary Hours / 52) × 8.6667/10` (s105) — produces HOURS, divide by 38 for FT equivalent weeks | varies | varies | varies |
| QLD (Seasonal sugar/meat) | `8.6667 × (actual_service / 10)` where service = part-year (s107) | varies | varies | varies |
| WA | `Years × 8.6667/10` | n/a | 8.6667 wks | 13 wks |
| SA | `Years × 13/10 = 1.3 wks/yr` | 9.1 wks (pro-rata only on termination) | 13 wks | 19.5 wks |
| TAS | `Years × 8.6667/10` | n/a | 8.6667 wks | 13 wks |
| ACT | `((1/5 × years) / 12) × 52` (= `Years × 6.0667/7`) — continuous | 6.0667 wks | 8.6667 wks | 13 wks |
| NT | `Years × 13/10 = 1.3 wks/yr` (paid only after 10y trigger or 7y pro-rata) | n/a (no taking before 10y) | 13 wks | 19.5 wks |
| Commonwealth | 3 months after 10y, then 0.3 months (9 days) per year — **calendar days, not working days** | n/a | 3 months | 4.5 months |

> **Notes on Commonwealth scheme:** Provided in calendar days, so LSL must be taken in min blocks of 7 days inclusive of weekends/PH. Annual leave cannot break LSL (no Annual/LSL/Annual patterns; LSL/Annual/Annual is allowed). Agencies can require minimum 15 calendar days. Periods of unpaid leave don't count (except illness or defence service). Cannot be cashed out. Cannot be taken in advance. Can be taken at half pay. Termination formula: `(Annual Salary / 12) × LSL credits`.

---

## 3. Per-jurisdiction deep dives

### 3.1 NSW — Long Service Leave Act 1955 (No 38)

**Who is entitled** (s3(4) of Act + Industrial Relations Act 1996 Ch 1 s(5) definition): full-time, part-time, casual employees — same number of weeks regardless of current/prior status.

**Entitlement** (s4(2)): **2 months (8.6667 wks) after 10 years**; +1 month (4.3333 wks) per subsequent 5 years.
Formula: `Years of Continuous Service × (8.6667 / 10)`.

**Continuous service** (s4(11)):

| **Does count** | **Does not count** |
|---|---|
| Absence in accordance with terms of employment (e.g. paid annual leave, paid LSL, Christmas closedown paid parental leave) | Leave taken due to industrial action |
| Absence due to illness/injury (paid or unpaid) — incl. **Workers Compensation** (s49 of Workers Compensation Act 1987 NSW) | Stood down due to slackness of trade |
| Transmission of business (sold + employee retained doing same role) | Absence by employer with intent to avoid LSL/sick leave obligations |
| Transferring within a company or group | Any leave caused by employer with employee returning within 2 months (other than above 3 items) |
| Apprentice entering contract within 12 months of apprenticeship completion | Agreed unpaid leave (incl. unpaid parental leave) — unless company policy/contract treats as service |
| JobKeeper-enabling direction absences | — |
| COVID-19 stand-down absences | — |

**Casuals (s4(11)(a1)):** continuous if a "series or pattern" of engagements; analyse each gap to see if due to factors that wouldn't normally count as service.

**Terminated and re-employed:** within 2 months — only counts if **employer-instigated** termination. Resignation → service starts anew.

**Termination — what's payable** (s4(2)):
- Before 5 years: no entitlement.
- 5–10 years: pro-rata of 10y (2 months) if dismissed by employer not for serious & wilful misconduct (e.g. redundancy), OR illness, OR incapacity, OR domestic/other pressing necessity, OR death.
- 10+ years: pro-rata if terminated for any reason.

**"Domestic and Pressing Necessity" case law** (from masterclass):
- Pregnant employee leaving for "home duties" — Donnelly v South Maitland Railway Pty Ltd 1964 AILR 450
- Employee forced to leave to care for sick wife or children — Franks v Kembla Equipment Co Pty Ltd 1969 AILR 55
- Changing jobs to lessen travel expenses (financial necessity) — Crennan v Oliver Furniture Pty Ltd (1962) 17 IIB 799
- Taking a higher-paid job to cope with increasing financial commitments — Eyles v Cook (1967) 13 FLR 42
- Night-shift strain on family + repeated transfer requests refused — Williams v MacArthur Press (Sales) Pty Ltd 1990 AILR 137(14)
- Employer relocation requiring 2-hour commute or move — Kershaw v Electricity Commission of NSW 1991 AILR 91(7)

**Timing of payment on termination** (s4(5)(a)): "shall forthwith pay" = immediately, on termination date. To personal rep on death request (s4(5)(b)).

**Cash-out** (s4(8)): **Not allowed** — LSL entitlement must be taken as leave (other than upon termination or portable scheme).

**Taking LSL in advance** (s4(3A)): yes by agreement, ≥1 day.

**Leave splitting** (s4(3)):

| Amount of leave | How can it be taken |
|---|---|
| 2 months | In 2 separate periods |
| 2 months – 19.5 weeks | In 2 or 3 separate periods |
| > 19.5 weeks | In 2, 3, or 4 separate periods |

Each period must not be less than 1 day. Employer + employee can agree to shorter periods.

**Employer direction** (s4(10)): yes — at least 1 month written notice specifying amount of leave (in weeks) and start date.

**Public holidays during LSL** (s4(4A)): **Exclusive** — PH paid in addition to LSL and not counted as LSL day.

**Ordinary pay** (s3(2)):

| Include | Do Not Include |
|---|---|
| Salary and wages | Overtime |
| Casual loading | Penalty rates (shift, weekend, public holiday loadings) |
| Allowances for skills and qualifications (e.g. First Aid, Leading Hand, All-Purpose) | Expense allowances (meal, phone) |
| Allowances for board and lodging | — |
| **Bonus, performance pay, or incentive scheme** — usually paid with salary — **only if employee under high-income threshold ($183,100 p.a. as at 2026; changes 1 July annually)** | — |
| Commission and piece work | — |

**Value of a week — Prescribed date** = day before leave commences OR day before last day of employment. Rate is **locked at prescribed date**; subsequent pay increases do NOT apply.

**Three pay-calculation branches:**

**Branch A — Wholly fixed rate + fixed hours** (FT or PT with stable hours):
- Greater of:
  - `Fixed time rate of pay on prescribed date × normal weekly hours`
  - Average weekly ordinary remuneration over **last 5 years** = `Total ord. remuneration over 5y / (days in period — 1825/1826/1827) × 7`
- Days NOT counted in 5-year denominator: unpaid leave days, days subject to JobKeeper direction, days COVID-19 stood down without pay, casuals' days outside typical pattern, days not wholly at fixed rate.

**Branch B — Wholly fixed rate + varied hours** (Casual; PT performing extra non-overtime hours at same rate):
- Greater of:
  - `Current hourly rate × (Total hours over last 12 months / Total days in period — 365 or 366) × 7`
  - `(Total remuneration over 5y at fixed rate / Total days in period — 1825/1826/1827) × 7`

**Branch C — Otherwise than wholly in relation to fixed rate** (paid by results, commission, varying rates, paid retainer + commission, discretionary payment, OR at prescribed date receives bonus/incentive):
- Greater of:
  - Average weekly wage over 12 months = `Total amount paid in 12mo / (365 or 366 less days not counted) × 7`
  - Average weekly wage over last 5 years = `Total amount paid in 5y / (1825/1826/1827 less days not counted) × 7`

**Bonus payment 5-step rule:**
1. Is employee entitled to bonus on prescribed date? Yes → Step 2; No → Step 3.
2. Compute weekly rate using Branch C formula × 12-month total days / 7. If under $183,100 → Step 4; over → no bonus addition.
3. Compute weekly rate using Branch A or B formula × 12-month total days / 7. If under $183,100 → Step 4; over → no bonus addition.
4. Compute bonus weekly average: if using current/12-month rate → `Total bonus 12mo / total days (365/366) × 7`. If using 5-year rate → `Total bonus 5y / total days (1825/1826/1827) × 7`.
5. Add bonus amount to weekly rate of pay. NB: no double-counting in ordinary remuneration AND average weekly bonus.

**Value of a day:**
- Fixed rate + fixed hours: `Value of Day in Hours = Normal Weekly Hours / Days worked per week`; `Value of Day in Weeks = Value of Day in Hours / Normal Weekly Hours`.
- Fixed rate + varied hours: `Value of Day = A / B (Clause 4A(3B))` where A = higher of 12-mo or 5-yr avg weekly hours; B = avg days/week during period.
- Otherwise than wholly fixed: `Value of Day = Ordinary Pay × (1 / A)`.

**Records (s8 + masterclass):** Employer name + ABN, worker name, employment conditions, status (apprentice/FT/casual), dates of employment & termination. **Kept for at least 6 years after worker's employment ends.** Transferred to successor employer on transfer of business.

**Sources:**
- [Long Service Leave Act 1955 — NSW Legislation](https://legislation.nsw.gov.au/view/whole/html/inforce/current/act-1955-038)
- [NSW Government — Long service leave](https://www.nsw.gov.au/employment/rights-responsibilities/leave/long-service-leave)

---

### 3.2 VIC — Long Service Leave Act 2018 (No 12 of 2018)

**Who is entitled** (Part 1 s3): FT, PT, casual employees — including seasonal and fixed-term. Same weeks regardless of status.

**Entitlement** (Part 2 s6): **1/60th of total continuous employment after 7 years**.
Formulas (equivalent):
- `Years × 52 × 1/60`
- `Years × (8.6667 / 10)`
- `Years × (6.0667 / 7)`

VIC is **continuous accrual** — every additional day after year 7 adds to entitlement. No "weeks at year 10" milestone.

**⚠️ Dual regime — pre/post 1 November 2018:**

| Aspect | Pre-1/11/2018 (LSL Act 1992 ss 62-63) | Post-1/11/2018 (LSL Act 2018 ss 12-14) |
|---|---|---|
| Unpaid leave | Generally doesn't count as service (only certain types preserve continuity) | **Up to 52 weeks counts as service**; 104 weeks for casual/seasonal parental |
| Workers Compensation | **Only first 48 weeks per year** counts | Counts towards continuous employment (unlimited) |
| Termination + rehire window | 3 months | **12 weeks** |
| Illness/injury cap | 48 weeks/year | No cap |

**Continuous service post-1/11/2018:**

| **Does count** | **Does not count** |
|---|---|
| All forms of paid leave (annual, sick, LSL, company-funded parental, carer's) | Unpaid leave > 52 weeks (unless employment agreement, written pre-leave agreement, or illness/injury) |
| Up to 52 weeks unpaid leave (LWOP, unpaid parental); **104 weeks for casuals/seasonal parental** | Industrial action (e.g. strike) |
| Absence due to illness/injury (incl. Workers Comp) | Stood down due to slackness of trade |
| Transmission of business | Termination + ≥12-week gap before rehire |
| Transferring within a company/group | — |
| Apprentice entering contract within 52 weeks of apprenticeship completion | — |
| Employer-avoidance termination | — |

**Casual/seasonal workers** (s12(3) post-1/11/2018):
- Continuous if any of: absence agreed before start; absence per terms of engagement; absence caused by seasonal factors; OR regular & systematic with reasonable expectation of re-engagement.
- Casual or seasonal also entitled to take up to 104 weeks paid OR unpaid parental leave before continuous employment deemed interrupted.

**Terminated and re-employed:** post-1/11/2018 — within 12 weeks (whether resigned or dismissed). Pre-1/11/2018 was 3 months.

**Termination — what's payable** (s9): payable on day of termination.
- Before 7 years: no entitlement.
- 7+ years: all accrual paid out — "calculated as at the day on which the employment ends" (s9(1)(b)).
- Death: payable to personal representative as defined in Administration and Probate Act 1958 (s10).
- **⚠️ s10(3)(b) DEATH override**: any average that needs to be taken for s15 or s16 is taken over the **52 weeks immediately before death** — NOT the greatest of 52/260/entire.

**Cash-out** (s34): **Forbidden** — offence to give/receive payment in lieu of LSL except as permitted by another Act/relevant FW instrument. Penalties: 12 units natural person/day; 60 units body corporate/day.

**Taking LSL in advance** (s8): yes by agreement.

**Reasonable business grounds for refusing LSL request** (s3 definitions):
- No capacity to change working arrangements to accommodate the leave
- Impractical to accommodate the request
- Request likely to cause significant loss in efficiency or productivity
- Request likely to have significant negative impact on customer service

**Employer direction to take LSL** (s19): yes — **12 weeks' written notice** specifying amount of leave being taken and leave period.

**Public holidays** (s7): **Exclusive** — LSL does not include any PH during LSL period.

**Ordinary pay** (s15):

| Include (Fixed rate) | Do Not Include |
|---|---|
| Salary & wages | Overtime |
| Casual loading | Penalty rates (shift, weekend, PH loadings) |
| Cash value of board/lodging | — |
| Allowances that form part of contract (e.g. personal-use portion of phone/car allowance) | — |
| Bonus payments that form part of contract | — |

For employees without a fixed rate (piece workers, retainer + commission):
- Use the **greatest of 52 weeks / 260 weeks / period of continuous employment**.
- Commissions and bonuses included **only if** they form part of the employee's contract.

**Workers Comp override (s17):** for workers on suitable employment (return-to-work) or receiving WorkCover weekly payments — use the **greater of**:
- Rate/hours immediately before LSL starts; OR
- Rate/hours immediately before the illness/injury developed.

**Hours calculation:**
- FT/PT (hours unchanged in last 104 wks): normal weekly hours.
- Casual/PT with changed hours: greatest of 52w / 260w / entire continuous employment formulas (s16):
  - 52w: `A = (B+C) / (52 - D)`
  - 260w: `A = (B+C) / (260 - D)`
  - Entire: `A = (B+C) / (D - E)`
  where B = hours worked, C = paid leave hours, D = weeks of unpaid leave (or weeks of continuous employment in entire formula), E = unpaid leave weeks in entire formula.

**Pay timing** (s20): in full at start of LSL OR same time as if working; mid-leave pay increase top-up (s21).

**Half-pay leave** (s22): employee may request twice as long at half ordinary pay. Employer must grant unless reasonable business grounds.

**Working elsewhere during LSL:** prohibited (offence) — exception for pre-existing 2nd job where hours not in substitution for the job taking LSL from.

**Records:** kept for at least 7 years after employee's employment ends (s37).

**Sources:**
- [LSL Act 2018 — VIC Legislation](https://www.legislation.vic.gov.au/in-force/acts/long-service-leave-act-2018/004)
- [Business VIC — Long service leave](https://business.vic.gov.au/business-information/staff-and-hr/long-service-leave-victoria)

---

### 3.3 QLD — Industrial Relations Act 2016, Part 3 Division 9 (ss 93–110)

**Who is entitled** (s8): FT, PT, casual employees.

**Entitlement** — THREE accrual streams:

**Stream 1 — FT (s95):** 8.6667 wks after 10 years; +4.3333 wks at 15 years; thereafter access as it accrues.
Formula: `Years × (8.6667 / 10)`.

**Stream 2 — Casual/PT/Mixed (s105):** `(Total Ordinary Hours / 52) × (8.6667 / 10)` — produces HOURS, not weeks. To convert to FT equivalent: divide hours available by 38.

**Stream 3 — Seasonal workers in sugar & meat industries (s107):** `8.6667 × (actual_service / 10)` where service is expressed as a part-year. Pre-23/06/1990 service not counted; 23/06/1990–29/03/1994 counted only if ≥32 hours per consecutive 4-week period. Seasonal entitlements in other industries determined by QIRC.

**Continuous service** (Ch 2 Pt 4):

| **Does count** | **Does not count** |
|---|---|
| All paid leave (annual, sick, LSL, company-funded parental, carer's) | Unpaid leave |
| Reserve forces service (Army, Air Force, Navy Reserve) | Termination + ≥3-month gap before rehire (whether dismissed by employer or employee) |
| Paid Workers Compensation | Industrial action |
| Transmission of business | Stood down due to slackness of trade |
| Transferring within a company/group | — |
| Apprentice → contract within 3 months of apprenticeship completion | — |
| Employer-avoidance termination | — |
| Employer-let/lent service to another employer | — |
| Service with partnership where employer is/becomes partner | — |

**Casuals (s103):** continuous even if employment broken, not always FT, two+ contracts with same employer, or other employment during the period. Continuous service ends if employment broken by **>3 months** between contracts.

**Terminated and re-employed:** within 3 months — service recognised, gap doesn't count. Beyond 3 months — service starts anew.

**Termination — what's payable** (s95(3)/(4)):
- Before 7 years: no entitlement.
- 7–10 years pro-rata of 10y if:
  - Death.
  - Employee terminates because of illness OR domestic/pressing necessity.
  - Employer dismisses for employee's illness.
  - Employer dismisses for reason other than employee's conduct, capacity, or performance.
  - **Employer unfairly dismisses the employee.**
- 10+ years: all accrual paid out.

**Timing of payment on termination** (s373(6)): within **3 days** of termination.

**Cash-out** (s110): **Restricted**:
- Allowed if award/IA expressly permits, OR
- If employee applies to QIRC on grounds of compassionate reasons or financial hardship; **may only be applied for once an employee has qualified for entitlement**.

**Taking LSL in advance** (s97(2)): yes by agreement.

**Employer direction to take LSL** (s97(3)): yes — at least **3 months' written notice**; leave must be at least 4 weeks in length.

**Public holidays** (s95(5)): **Exclusive**.

**Ordinary pay** (s98):

| Include | Do Not Include |
|---|---|
| Salary and wages | Overtime |
| Casual loading | — |
| **Penalty rates (shift penalties, weekend and public holiday loadings)** | — |
| Commission (per s99) | — |

> ⚠️ **QLD is one of only TWO jurisdictions that INCLUDE penalty rates in ordinary pay** (the other is TAS). This is a major divergence from NSW/VIC/WA/SA/ACT/NT.

**Commission default average (s99):** `Total commissions in last 12 months ÷ 52.179 × weeks of leave being taken`.

**Hours calculation:**
- FT: normal weekly hours.
- Casual/PT/Mixed (s105): `(Total Ordinary Hours Worked / 52) × (8.6667 / 10)` → produces total LSL HOURS available; for taking leave can agree FT-equivalent by dividing hours by 38.

**Records** (s339(1)(d), s339(4)): total number of ordinary hours worked by each casual employee from start of service to 30 June each year. Kept for 6 years post-termination.

**Sources:**
- [Industrial Relations Act 2016 — QLD Legislation](https://www.legislation.qld.gov.au/view/html/inforce/current/act-2016-063)
- [Business Queensland — Long service leave](https://www.business.qld.gov.au/running-business/employing/legal-obligations/long-service-leave)

---

### 3.4 WA — Long Service Leave Act 1958 (As at 31 Jan 2025)

WA underwent modernisation via Industrial Relations Legislation Amendment Act 2021 (No 30 of 2021), inserting s4A, s5, s6, s6A, s7–7I.

**Who is entitled** (s4): FT, PT, casual employees (incl. seasonal). Same weeks regardless of status.

**Entitlement** (s8(2)):
- 10 years: **8 ⅔ weeks (8.6667)**.
- Each subsequent 5 years: **4 ⅓ weeks (4.3333)**.
- Pro-rata after 7 years on death OR any termination other than employer for serious misconduct.

Formula: `Years × (8.6667 / 10)`.

**⚠️ Dual regime — entitlement reached before/from 20 June 2022:**

| Aspect | Entitlement reached **before 20 June 2022** | Entitlement reached **from 20 June 2022** |
|---|---|---|
| Paid leave that counts | Annual, LSL, paid personal/sick/carers ≤15 working days/year, paid public holidays (worked + not worked) | Annual, LSL, paid personal/sick/carers (no cap), paid company-funded parental, **Government Paid Parental Leave**, paid compassionate/bereavement, paid family & domestic violence |
| Unpaid leave | LWOP/unpaid parental: doesn't count | **All unpaid leave: doesn't count** (incl. unpaid parental); GPPL: counts |
| Illness/injury cap | ≤15 working days/year | Generally unlimited (with paid status) |
| Service with Defence Force Reserves | Counts (paid or unpaid) | Counts (paid or unpaid) |
| Apprenticeship 52-week rule | s6(7) | s6(7) |

**⚠️ Dual regime — Workers Compensation:**

| When | Effect |
|---|---|
| From 1 July 2024 | Counts towards service per s61(d) Workers Compensation & Injury Management Act 2023 |
| Before 1 July 2024 + entitlement reached before 20 June 2022 | Counts up to 15 working days/year (incl. illness/injury) |
| Before 1 July 2024 + entitlement reached from 20 June 2022 | Does NOT count (unless casual) |

**Always excluded (both regimes):** Stood down due to slackness of trade ≤6 months (preserves continuity, doesn't count); stood down per award/agreement/order/determination; absence due to industrial dispute; absence due to reasonable legitimate union business where leave requested but refused.

**Apprentices (s6(7)):** apprenticeship + contract within 52 weeks → apprenticeship counted.

**Casual/seasonal (s6(5)/(6)):** continuous despite absences under employment terms, seasonal factors, or where employee has reasonable expectation of returning; can hold 2+ contracts; can be employed by another person during the period.

**Terminated and re-employed (s6(4)):** within 2 months for any reason (or 6 months for slackness of trade) — service is continuous. **Only applies if employer instigated termination.** Resignation → service starts anew.

**Transfer of business (Part II Div 3, ss 7D–7I):**
- s7E: transfer if (a) employment terminates, (b) employee employed by new employer within 3 months, (c) work same/substantially same, (d) "connection" between old + new employer (s7G).
- s7G connections: new employer owns/uses old employer's assets; outsourcing; reverse outsourcing; related body corporate.
- s7H: pre + post transfer = single continuous employment; new employer = sole employer for entire period.
- s7I: employment records must be transferred.

**Termination — what's payable** (s8):
- Before 7 years: no entitlement.
- 7–10 years: pro-rata of 10 years (2 months) **except** termination for serious misconduct (employer-initiated).
- 10+ years: **paid on completed years of service ONLY** (partial years not included).

**Timing of payment on termination** (s9(2A)): on day of termination. To personal rep on request if employee died.

**Cash-out (s5):** Yes, with conditions:
- Once entitlement has been reached.
- Paid same rate as if they had taken the leave (s5(2): "adequate benefit" = at least ordinary pay).
- Written agreement signed by both parties.
- Agreement details: amount of leave + dollar value.
- Copy on employee's file.
- **LSL does NOT accrue on the cashed-out leave** (employee not entitled to additional LSL for the cashed period until they've re-accrued).

**Taking LSL in advance (s10):** yes by agreement. Employer may deduct from final pay if terminated before accrued.

**Employer direction to take LSL:** NO — employer cannot direct an employee covered by the Act to take LSL at a particular time. Employee can give 2 weeks' notice if entitled >12 months prior.

**Public holidays (s9(4)):** **Exclusive — extends LSL by 1 day per PH BUT only when LSL is taken under s8(2)(a)/(b)**. Does NOT apply to s9(2) deemed-leave-on-termination payouts.

**Half-pay / double-pay (s9(1C)/(1D)):** employee may request double duration at half pay OR half duration at double pay. **Employer not obligated to agree.**

**Ordinary pay (s7, s7A, s7B, s7C):**

| Include | Do Not Include |
|---|---|
| Salary and wages | Overtime |
| Casual loading (s7B) | Penalty rates (shift, weekend, PH loadings) — s7A |
| Cash value of board/lodging (s7C) | Allowances (s7A) "or any similar payments" |

**Hours calculation:**
- FT/PT with hours unchanged: normal weekly hours; ordinary rate of pay.
- Casual or hours varied over employment:
  - **Average weekly hours over the whole of employment.**
  - Do NOT include hours for leave taken that did not count as service in averaging.
  - **Include overtime hours if overtime is worked regularly.** WA Government has advised that any overtime worked could be viewed as regular.
  - **Per-accrual-period averaging**: first 10-year average is worked out **separately** from the 10–15 year average, and so on.
  - **On termination**: average in the final period is worked out on **completed years of service only**.
- Commission/piecework/results (s7(4)): `((Total Commission/Earnings + Base ordinary Pay earnt 365 days before leave/termination) / 365) × 7`.

**Rate of pay:**
- FT/PT no variation: ordinary rate of pay.
- Casual / varied hours: ordinary rate (incl. casual loading for casuals).
- Commission/results: weekly pay formula above.

**Records (s26, s26A):** name, DOB if <21, commencement date, hours/week, gross+net pays, deductions, all leave taken (paid/partly paid/unpaid), s5 agreement details, all data for calculating LSL entitlement, occupation, rate, hours, entitlement, LSL taken, payment in lieu, manner of termination. **Kept throughout employment + at least 7 years after.**

**Sources:**
- [LSL Act 1958 — WA Legislation PDF](https://www.legislation.wa.gov.au/legislation/prod/filestore.nsf/FileURL/mrdoc_48247.pdf/$FILE/Long%20Service%20Leave%20Act%201958%20-%20%5B04-m0-00%5D.pdf)
- [WA Government — Overview of LSL](https://www.wa.gov.au/organisation/private-sector-labour-relations/overview-of-long-service-leave-wa)

---

### 3.5 SA — Long Service Leave Act 1987

**Who is entitled** (s5): FT, PT, casual workers. Same weeks regardless of status.

**Entitlement** (s5):
- 10 years: **13 weeks**.
- Each subsequent year: +1.3 weeks.
- Pro-rata after 7 years on any termination except (a) serious & wilful misconduct or (b) worker unlawfully terminates (e.g. no notice).

Formula: `Years × (13 / 10) = 1.3 wks/yr`. **Pro-rata and full payments calculated on completed years only.**

**Continuous service** (s6):

| **Does count** | **Does not count** |
|---|---|
| Any paid leave (incl. company-funded parental, if specific LSL terms in EA) | Parental leave (both company-funded AND government paid parental leave) |
| Unpaid sick leave or workers compensation | Any other kind of unpaid leave |
| Interruption/ending of service with intent to avoid LSL obligations | Stood down due to slackness of trade and re-employed |
| Apprenticeship → contract within 12 months | Industrial action where worker returns under settlement |
| Service in the Defence Force | — |

**Casuals (s6):** generally continuous unless prolonged time between contracts or clear termination. Time not rostered is still counted (but 0-hour weeks for averaging).

**Workers Comp (s6(1)(d)):** counts as service — "time off is due to illness or injury".

**Terminated and re-employed (s6(1)(i)):** within 2 months **and** employer-instigated → prior service recognised. Resignation → service does NOT carry over (even if rehired within 2 months).

**Transfer of business (s3(3)):** business sold/transferred/assigned + employee remains → new employer recognises prior service. Includes transfers to associated companies.

**Termination — what's payable** (s5(3)/(4)):
- Before 7 years: no entitlement.
- 7–10 years: pro-rata = 1.3 wks per completed year (Section 5(3) & (4)) except (a) serious or wilful misconduct or (b) employee unlawfully terminates.
- 10+ years: paid on completed years of service only.

**Timing of payment on termination (s8(4)(a)):** **immediately on termination.**

**Cash-out (s5(1a)):** Yes — by written agreement once entitlement reached. Signed by both parties; copy kept with employee's records.

**Cash-out written statement requirements (per masterclass):** worker's name; date of written statement; current entitlement (in weeks or fraction of week in hours); payment amount; period of leave in lieu of which payment made; number of LSL days remaining; employer name; employer must sign and date.

**Pre-payment top-up (s8(3)):** if rate increases mid-leave, payment must reflect; if paid in advance, adjustment on return.
**Cash-out variation top-up (s8(3a)(b)):** if rate varies during the period the cash-out payment covers → further payment to reflect variation.

**Taking LSL in advance (Clause 7(4)(d) & (6)):** by agreement, signed by both, copy on file. Employer can deduct from final pay if terminated before accrued (employer has right to recover negative leave).

**Employer direction:** the employer **should** give worker at least 60 days' written notice.

**Public holidays (s7(7)):** **Inclusive** — every day after LSL commencement (incl. PH and non-working days) counts as a day of LSL.

**Working elsewhere:** offence to work elsewhere without employer consent. Exception for pre-existing 2nd job where hours not in substitution.

**Ordinary pay (s3(2)):**

| Include | Do Not Include |
|---|---|
| Salary and wages (incl. any above-award payments) | Overtime |
| Casual loading | Penalty rates (e.g. night shift, weekend penalties) |
| Commissions | Shift premiums |
| Cash value of board/lodging | Allowances for work-related expenses (uniform, locality, car) |

If unsure about an allowance, can apply to SafeWork SA for a private ruling.

**Hours calculation (s3(2)):**

| Employment Type | Hours to Pay |
|---|---|
| FT/PT and no changes to hours in the last 3 years | Normal Weekly Hours |
| PT or FT with changes to hours in the last 3 years (mixed employment) | **Average Weekly Hours = Total Hours Worked in previous 3 years / 156** (include overtime hours). 156-week period excludes whole weeks of unpaid leave or workers comp; **substitute the next available working week** (so window remains 156 weeks of work). |
| Casual | Same 156-week formula; include overtime; any week worker did not request unpaid leave counts as working week (incl. weeks worker available but didn't get a shift; weeks worker made themselves unavailable but did not request leave) |
| Commission/Piece Work (incl. retainer + commission) | Weekly Rate = Total Income over 52 weeks / 52 |

**Records (s10):** date of commencement of service; occupation/duties; rate of pay; number of hours worked per week; entitlement to LSL; any LSL taken; payment in lieu of LSL; manner of termination + termination payment. Kept throughout service + at least 3 years after termination. Employer must determine average hours/week worked over preceding 12 months at 12-month intervals.

**Sources:**
- [LSL Act 1987 — SA Legislation](https://www.legislation.sa.gov.au/lz?path=%2Fc%2Fa%2Flong+service+leave+act+1987)
- [SafeWork SA — Long Service Leave](https://www.safework.sa.gov.au/workers/wages-conditions/long-service-leave)

---

### 3.6 TAS — Long Service Leave Act 1976

**Who is entitled** (s2): FT, PT, casual employees. Same weeks regardless of status.

**Entitlement** (s8(2)):
- 10 years: **8 ⅔ weeks (8.6667)**.
- Each subsequent 5 years: **4 ⅓ weeks (4.3333)**.

Formula: `Years × (8.6667 / 10)`.

**Continuous service** (s5):

| **Does count** | **Does not count** |
|---|---|
| Paid annual leave + paid LSL | Maternity Leave (paid + unpaid) |
| Public holidays paid + not worked | Industrial dispute (unless returns under settlement) |
| Absence due to illness/injury **certified as necessary by a medical practitioner** | Any other absence approved by employer |
| Interruption/termination of employment by employer if done to avoid annual/LSL obligations | Stood down due to slackness of trade if re-engaged within 6 months and within 14 days of return-to-work offer |
| Approved leave to attend Tasmanian State Training Authority committees or VET Act 1994 committees | Any other break in service where worker returns within 2 months |
| Jury service or other prescribed court attendance | — |
| Transmission of business | — |
| Apprenticeship → contract within 3 months | — |
| Defence leave | — |

**Casuals/PT (s5(3)):** continuous if regularly working **≥32 hours per consecutive 4-week period**. Employees engaged before 21/12/1979 considered continuous if regularly employed throughout (not subject to 32-hour rule).

**Workers Comp (s5(1)(c)):** counts as service — "absence due to illness or injury certified by a medical practitioner".

**Terminated and re-employed:** within 3 months for any reason other than slackness of trade (6 months for slackness). Time off doesn't count as service. **Applies to both employee and employer terminations.**

**Termination — what's payable** (s8):
- Before 7 years: no entitlement.
- 7–10 years pro-rata of 10y if:
  - Reaches retirement age (60 women / 65 men)
  - Death
  - Termination by employer for any reason other than serious & wilful misconduct
  - Illness, incapacity, domestic or pressing necessity
- 10+ years: pro-rata based on full period of continuous service.

**Timing of payment on termination** (s12(4)): on the day of termination — "employee shall be deemed to have commenced to take his leave on the date of termination of employment".

**Cash-out (s10):** Yes — by agreement once entitlement is reached.

**Taking LSL in advance:** No — leave becomes available at 10 years; advance leave not permitted.

**Employer direction:** No — if mutual agreement cannot be reached, WorkSafe Tasmania adjudicates.

**Public holidays (s12(9)):** **Exclusive** — PH not counted as LSL day.

**Ordinary pay (s11):**

| Include | Do Not Include |
|---|---|
| Salary and wages | Overtime |
| Casual and part-time loading | Allowances for inconvenience, danger or hardship (hot/cold/dirt) |
| Allowances which are generally paid for all hours worked and for all purposes (e.g. all-purpose allowances in an award) | Travel allowances and payments — incl. Living Away From Home |
| Cash value for board and lodging | Bonus payments |
| **Shift penalties** | Meal allowances |
| Commissions | — |

> ⚠️ **TAS is one of only TWO jurisdictions that INCLUDE shift penalties in ordinary pay** (the other is QLD). TAS also explicitly EXCLUDES bonuses (s11(2)(h)) — most permissive on penalties, most restrictive on bonuses.

**TAS day-to-day rate variation (unique):** Full-time/Part-time rate "day to day may vary depending on when leave is taken and what allowances/penalties apply on the day leave is taken." Calculator must compute by-day, not by-week.

**Hours calculation:**
- FT/PT: normal weekly hours.
- Casual: average weekly hours over the **last 12 months prior to taking leave/termination**.

**Rate of pay:**
- FT/PT: Base weekly rate + shift penalties/allowances applicable on the day.
- Casual: Base hourly rate incl. casual loading + shift penalties/allowances.
- Commission: total remuneration over **last 3 months / 13**.

**Records (s7 LSL Regulations 2017):** Employee name, address, position; date employment commenced; details of any additional period of employment served due to absence/interruption not counting as continuous; end date of qualifying period; details of leave taken (dates, amount paid, method of payment); termination details (date, reason, rate of ordinary pay at termination). **Legislation stipulates NO time limit on records — must be kept in perpetuity.**

**Sources:**
- [LSL Act 1976 — TAS Legislation](https://www.legislation.tas.gov.au/view/whole/html/inforce/current/act-1976-095)
- [WorkSafe Tasmania — Long Service Leave](https://worksafe.tas.gov.au/topics/laws-and-compliance/long-service-leave)

---

### 3.7 ACT — Long Service Leave Act 1976 (R29 effective 19/11/25)

**Who is entitled** (Dictionary def of employee): FT, PT, casual employees.

**Entitlement** (s3, s4):
- After **7 years** of continuous service with single employer: **6.0667 weeks**.
- Each subsequent year: +0.8667 weeks (1/5 month per year of service).

Formulas (all equivalent):
- `((1/5 × years) / 12) × 52`
- `Years × (8.6667 / 10)` (works past year 10 since both formulas give 8.6667 at 10y)
- `Years × (6.0667 / 7)`

**ACT has the lowest accrual threshold in Australia (7 years for full taking; 5 years for pro-rata).**

**Continuous service** (s2G & s10A):

| **Does count** | **Does not count** |
|---|---|
| Paid annual leave | Industrial action (e.g. strike) |
| Paid LSL | Stood down due to slackness of trade if re-employed within 6 months (3-month period does not count toward service) |
| **Leave due to illness or injury (paid or unpaid) up to 2 weeks (14 days) in any one year** | Any other period of absence with employer's leave (incl. unpaid parental leave, **Company-Paid** Parental Leave, **Government Paid Parental Leave**) |
| Interruption/ending of service with intent to avoid LSL | Leave due to illness or injury exceeding 2 weeks in any one year |
| Apprenticeship → contract within 12 months | Interruption to service or re-employment within 2 months after service interrupted (applies whether employer OR employee instigated) — prior service recognised, gap not counted |
| Service in Defence Force (non-FT continuous) where employed immediately before service | — |
| Service outside ACT if temporary AND would be continuous if working in ACT | — |
| **Absence due to workplace injury (incl. Workers Comp) from 9 June 2023** | — |

**⚠️ ACT Workers Comp dual regime:**

| When | Effect |
|---|---|
| Prior to 9 June 2023 | Workers Comp leave taken did NOT count as service once employee exceeded 2 weeks/year due to illness/injury |
| From 9 June 2023 | Workers Comp counts as service if employee would have otherwise been entitled to accrue LSL (per s46 Workers Compensation Act 1951 change) |

**Seasonal workers (s2G(3)):** interruption >2 months doesn't break continuity if caused by seasonal nature. Period in between doesn't count as service.

**Terminated and re-employed (s2G(2)(e)):** within 2 months → prior service recognised; gap doesn't count.

**Transfer of business (s10):** prior service recognised; new employer = sole employer.

**Termination — what's payable** (s3, s11A, s11C, s11D):
- Before 5 years: no entitlement.
- 5–7 years pro-rata of 7 years if (s11C):
  - Illness, incapacity, domestic or pressing necessity
  - Reaching minimum retirement age (per award/agreement, or 65)
  - Death
  - Termination by employer not for serious & wilful misconduct
- 7+ years: paid on completed years of service only — calculated under s3.

**Pro-rata calculation 5–7 years (s11C(2)):** includes **years AND months/12** converted to decimal years × (8.6667/10).
Example: 6 years 4 months → 6 + 4/12 = 6.33 → 6.33 × 0.86667 = 5.486 wks entitlement.

**Timing of payment on termination (s11A(4)(b)):** within **90 days** after the day employment ceases.

**Cash-out (per WorkSafe ACT guidance under s8(c)):** "The purpose of LSL is to allow the employee to take a break from work, however the Act enables the employer and employee to agree on how the employee will be paid. Section 8(c) says 'if the employer and the employee agree — in another way.'" Value of cash-out same as if LSL taken.

**Taking LSL in advance:** No — no provisions in the Act.

**Employer direction (s6(2)):** yes — at least **60 days' written notice** specifying amount of leave + leave period.

**Public holidays (s9):** **Exclusive** — PH not counted as LSL day.

**Ordinary pay (s7(1)):**

| Include | Do Not Include |
|---|---|
| Salary and wages | Overtime |
| Casual loading | Penalty rates (e.g. night shift, weekend penalties) |
| **Allowances for skills and qualifications** (e.g. First Aid, All Purpose Allowances) | Allowances which under an award/agreement are not taken into account in determining rate of remuneration in respect of overtime (i.e. allowances not paid for all purposes) |
| Allowances for board and lodging | — |
| **Bonus, performance pay, or incentive scheme that are usually paid with salary and wages** (e.g. KPI-based bonuses) | — |
| Commissions | — |
| Board and lodging (where provided by employer) | — |

**Hours calculation:**

| Employment Type | Hours to Pay |
|---|---|
| FT | Normal Weekly Hours |
| PT/casual — always been PT/casual; OR previously PT and now casual or vice versa; OR currently PT/casual for >2 years and was previously FT before entitlement — s7(2) | **Average Weekly Hours = Total Hours Worked before the entitlement date in the last 12 months / 52** (**include overtime hours**). NB: 12 months is prior to when they last reached an entitlement to LSL, NOT the date they are taking leave. |
| PT/casual <2 years and previously FT before entitlement — s7(3) | Value of Week = Total Salary & Wages in Last 5 Years before entitlement / 5 / 52. NB: no weekly hours calculation in this case, just monetary calculation. |
| **PT/casual — when TERMINATING (s11D)** | Weekly Hours = Total Hours Worked before in the **last 12 months before termination** / 52 |

**⚠️ Key divergence**: s7(2) anchors averaging at **entitlement date** (for taking LSL); s11D anchors at **cessation date** (for pay-in-lieu). Different averages whenever hours have changed in the interim — calculator must distinguish "still employed + taking leave" from "ceased + pay-in-lieu".

**Records (s12):** name, occupation, classification; FT/PT/casual; ordinary remuneration incl. base rate + any loading + purpose of loading; hours/week; commencement date; annual leave taken; LSL entitlement; LSL granted/paid in lieu; cessation date + reason; if overtime payable: daily hours + start/stop times; DOB; awards/agreements applicable. Kept for **7 years after employee's service ends** (or 7 years after final payment to personal rep if died).

**Portable scheme interaction (s2D, s2E, s2EA):**
- LSL (BCI) Act 1981: Building and Construction Industry portable scheme.
- LSL (CCI) Act 1999: Contract Cleaning Industry portable scheme.
- LSL (PS) Act 2009: Portable Schemes Act (other industries).
- Election to take benefits under portable scheme doesn't prevent benefits under main Act, BUT employee NOT entitled under main Act for the period for which portable-scheme benefits received.

**Sources:**
- [LSL Act 1976 — ACT Legislation Register](https://www.legislation.act.gov.au/a/1976-27/)
- [WorkSafe ACT — Long service leave](https://www.worksafe.act.gov.au/laws-and-compliance/long-service-leave/guidance-material)

---

### 3.8 NT — Long Service Leave Act 1981 (As in force 14 Oct 2015)

**Who is entitled** (s7): person under contract of service or apprenticeship — salary, wages, piecework rate, butty gang member, FT/PT/casual, outworker.

**Entitlement** (s8):
- 10 years: **13 weeks** (= 10 × 1.3).
- Each subsequent 5 years: **6.5 weeks** (= 5 × 1.3).

Formula: `Years × (13 / 10) = 1.3 wks/yr`. **Payment made on completed years only.**

**Continuous service** (s12):

| **Does count** | **Does not count** |
|---|---|
| Continuous full-time Reserve/Citizen Forces service | **Workers' compensation** |
| Defence/Naval/Air Force regulations service | **Unpaid maternity leave** |
| National service | **Unpaid sick leave** |
| Civil Construction Corps (National Security Act 1939) | **Absences on leave without pay** (general) |
| Apprenticeship → re-employment within 12 months | Absence due to slackness of trade |
| Employer-avoidance termination | Absence due to industrial dispute |
| Industrial dispute (where returns under settlement) | — |
| Stand-down for slackness of trade (continuity preserved, doesn't count for length) | — |
| Re-employment within 2 months for any reason | — |

> ⚠️ **Critical correction from v1.0**: NT **excludes** Workers Compensation, unpaid maternity, and unpaid sick leave from counting as service. v1.0 had Workers Comp included.

**Related corporations (s12(6)/(7)):** periods aggregated; "related corporation" per Corporations Act 2001.

**Transfer of business (s12(8)/(9)):** transfer = transmission, conveyance, assignment, or succession. Period with first employer deemed period with new employer if business transferred + employee transfers.

**Termination — what's payable** (s10):
- Before 7 years: no entitlement.
- 7–10 years pro-rata of 10y on completed years if (s10(2)):
  - **Reached retirement age (Age Pension age)**
  - Terminated by employer for reasons other than serious or wilful misconduct
  - Illness, incapacity, domestic or pressing necessity
- 10+ years (s10(1)): paid on completed years of service only.
- Serious misconduct s10(1A): only complete 10y/15y blocks counted.
- Death s10(3): payable to personal representative.

**Timing of payment on termination:** **as soon as practicable** after cessation.

**Cash-out:** **NOT allowed** (s10(4)).

**Taking LSL in advance:** No.

**Public holidays (s9):** **Inclusive** — PH is part of LSL; period not increased.

**Ordinary pay (s7(2)):**

| Include | Do Not Include |
|---|---|
| Over-award payment | District allowance |
| Industry / leading hand / skill / qualification allowance | Site allowance |
| Service grant | Climatic allowance |
| Bonus or incentive scheme amounts usually paid with pay | Any other allowance or payment in respect of overtime |
| Free board ($15/wk fallback) or lodging ($5/wk fallback) | Penalty rates of pay |
| Regulations-prescribed allowances | — |

**Hours and rate of pay (s11):**

| Scenario | Formula |
|---|---|
| Fixed rate, no variation in hours | `Current weekly rate of pay × LSL weeks` |
| **Variation in hours** | `Total ordinary hours in each completed year / total weeks in each completed year × current rate of pay × 1.3` per completed year, summed |
| **Rate of pay varies** | `Total income last 12 months / Total ordinary hours last 12 months × 1.3 × hours per year × completed years` |

**NT per-year formula (s11(3)):** `Amount per year = RP × HWW × 1.3`
- RP = rate of pay immediately preceding day employee ceases OR takes LSL OR day agreed under s8(8)(a).
- HWW = hours of work per week during the year of continuous service; excludes overtime hours.
- Sum across each completed year of continuous service.

**Working examples in statute (s11(4), s11(5)):** show per-year summation. Calculator must store hour history per year.

**Records (s14):** name; commencement date + wages/qualifying-service/salary/commission paid; **number of hours of work per week worked by employee**; accrued LSL credit; LSL/payment-in-lieu paid; absences of 2 months+; cessation date. Retained 3 years post-employment (6 years if died).

**Sources:**
- [LSL Act 1981 — NT Legislation](https://legislation.nt.gov.au/Legislation/LONG-SERVICE-LEAVE-ACT-1981)
- [LSL Act 1981 PDF (14 Oct 2015)](https://legislation.nt.gov.au/api/sitecore/Act/PDF?id=11975)

---

### 3.9 Commonwealth — Long Service Leave (Commonwealth Employees) Act 1976

**Who is covered:**
- Working in an Australian Public Service (APS) agency.
- Other Government agencies or working in the public service before commencing in the APS.
- Government service includes non-APS Commonwealth agencies (e.g. CSIRO, AFP).
- Previous employment with the public service of a State or Territory may also count towards LSL qualification and accrual.
- LSL (Commonwealth Employees) Regulation 2016 lists other organisations that may count towards service.

**Who is NOT covered:**
- Members of Parliament
- Ministers of State
- Judges
- Members of the Defence Forces
- Honorary capacity employment
- Public Service of a Territory
- ACT or NT teaching services
- Employees under Reserve Bank Act or Commonwealth Banks Act
- Employees engaged locally for employment outside Australia
- Employees remunerated by fees, allowances, or commissions

**Entitlement:**
- 3 months after 10 years of continuous service.
- 0.3 months (9 days) for each year thereafter.
- Can be taken on completed years only.
- Provided in **calendar days, NOT working days** — must be taken in min blocks of 7 days inclusive of weekends + PH.
- Annual leave cannot break LSL (no Annual/LSL/Annual patterns; LSL/Annual/Annual is allowed).
- Agencies can require minimum 15 calendar days rather than 7 days.

**What does not count as service:**
- Periods of unpaid leave (except illness or defence service).

**Other key points:**
- **Cannot be cashed out.**
- **Cannot be taken in advance** of entitlement.
- Can be taken at half pay.
- Rates of pay based on employee's pay category and current employment status.
- On termination, LSL is paid out using the formula `(Annual Salary / 12) × LSL credits`.

**Source:**
- [LSL (Cth Employees) Act 1976 — AustLII](https://www.austlii.edu.au/cgi-bin/viewdb/au/legis/cth/consol_act/lslea1976475/)

---

## 4. Federal & portable scheme overlap

### 4.1 Modern award / NES interaction

**LSL is covered by the NES** (Fair Work Act 2009 s113), but for modern awards from 1 January 2010, terms dealing with LSL **cannot be included**. Generally LSL comes from state/territory legislation based on where the employee is working — except where the carve-outs below apply.

### 4.2 Pre-Modern Award carve-out

If a federal **pre-modern award** (a workplace rule that existed before 1 January 2010) included LSL, then state/territory LSL legislation does NOT apply. The pre-modern award rules apply instead.

**Example 1 — Meat Award:** Real Meats Butchers in Melbourne VIC follows the Meat Award (pre-modern). PT employee Lesley has worked 12 years there. Her old federal pre-modern award includes a LSL clause; her entitlement comes from that award, not VIC state law.

**Example 2 — Graphics Arts - General - Award 2000:** Joan started as graphic designer at a NSW company on 1 March 2015. Company established before 1 January 2010 and Joan covered by the Graphics Arts General Award 2000. Her LSL is based on **that award**, not NSW state law:
- 13 weeks after 15 years of service
- +8 ⅔ weeks for each additional 10 years
- Pro-rata if leaves/dies before 15 years
- NSW state law (8.667 wks after 10 years) doesn't apply because of the pre-modern award carve-out
- Joan won't be eligible for LSL until 15 years of service.

**If Joan had joined a company that started after 1 January 2010**, she would be covered by NSW state laws instead.

### 4.3 When pre-modern award LSL does NOT apply

Modern awards (from 1 January 2010) cannot include LSL rules, with these exceptions where an employee's pre-modern entitlement **won't apply**:

1. A collective agreement, Australian Workplace Agreement (AWA), or Individual Transitional Employment Agreement (ITEA) was in place before NES started and applies.
2. Any of the following types of agreements was in place before NES started and deals with LSL:
   - Enterprise agreements (made after 1 July 2009 + approved by FWC)
   - Preserved State system agreements (made in State system before 26 March 2006)
   - Workplace determinations (decided by FWC)
   - Certified agreements (made before 26 March 2006)
   - AWAs (made before 26 March 2006)
   - Section 170MX awards (made by AIRC before 26 March 2006)
   - Old IR agreements (approved by AIRC before December 1996)

If any of these end (stop in effect), the employee is then entitled to LSL according to their **pre-modernised award**.

### 4.4 Enterprise Agreements

- Agreements made between 1 July 2009 – 31 December 2009 that have any LSL terms in the Agreement → **prevail over State/Territory LSL laws**.
- State/Territory LSL laws generally prevail over any provisions in an EA to the extent they are inconsistent.
- Employers with LSL provisions in registered agreements that came into effect after 1 January 2010 should seek legal advice regarding how their agreement interacts with state/territory LSL legislation.

### 4.5 Agreement-Derived LSL Entitlements

FWC can make an order preserving LSL entitlements in a collectively bargained agreement (EA, collective agreement, pre-reform certified agreements, old IR agreements). Conditions for FWC order:
- Agreement came into operation prior to 1 January 2010
- Agreement has terms dealing with LSL
- Agreement applies to employees in more than one State or Territory
- Agreement provides entitlements equal to or greater than relevant State/Territory LSL laws
- No applicable LSL entitlements derived from a pre-modernised award that applies to the employees

### 4.6 Portable LSL Schemes

| Industry | States/Territories Available |
|---|---|
| Building and Construction | All States and Territories |
| Contract Cleaning | ACT, NSW, QLD, VIC |
| Community Services | ACT, NSW, QLD, SA, VIC |
| Security | ACT, VIC |

Each scheme is administered by a state-based authority that collects levies and pays benefits. ACT's main Act explicitly handles portable scheme overlap (s2D, s2E, s2EA): election to take benefits under portable scheme doesn't prevent benefits under main Act, but no double-dip.

**Calculator implication:** Out of scope for the engine's core calculation. UI should warn users when their industry/role/state suggests portable scheme coverage and refer to the relevant authority.

---

## 5. Anomalies catalogue

### 5.1 Accrual structure anomalies

1. **VIC continuous accrual (1/60th per day).** *VIC.* Calculator should compute days of service, not just years.
2. **NT per-year formula.** *NT.* Each year's `RP × HWW × 1.3` stored and summed. NT engine needs per-year hour + rate history.
3. **ACT 1/5-month per year.** *ACT.* Use statutory unit `((1/5 × years) / 12) × 52` directly.
4. **SA 13 weeks at year 10** (vs 8.667 elsewhere). *SA.* Customer messaging must explain cross-state mobility differences.
5. **QLD has 3 accrual streams** (s95 FT, s105 casual/PT/Mixed in HOURS, s107 seasonal sugar/meat in part-year). *QLD.* Calculator must route to correct stream by employment-history pattern.
6. **Commonwealth scheme is in MONTHS (calendar days)**, not weeks. Distinct primitive.

### 5.2 Pay calculation anomalies

7. **VIC death-rule override.** *VIC s10(3)(b).* Averaging collapses from "greatest of 52/260/entire" to exactly 52 weeks before death.
8. **WA postponed-leave rate.** *WA s7(3).* If postponed by agreement, rate is either day of accrual OR day of commencement.
9. **WA 365-day vs 12-month.** *WA s7(4).* Piecework/commission/bonus uses literal 365 days (with unpaid leave excluded per s7(5)).
10. **WA per-accrual-period averaging.** *WA.* First 10-year average is separate from 11–15 year average. On termination, final period is on completed years only.
11. **WA overtime hours INCLUDED in averaging** where overtime is regular. *WA.* "Any overtime worked could be viewed as regular" per WA Government.
12. **SA 3-year (156-week) averaging with substituted weeks.** *SA.* If whole weeks of unpaid leave or workers comp in 156-week period, substitute next-available working week.
13. **NSW "prescribed date" rate lock.** *NSW.* Rate at prescribed date is fixed; subsequent pay increases do NOT flow through.
14. **VIC pay-increase top-up during leave.** *VIC s21.* If ordinary pay increases while on LSL, employee entitled to increased rate from time of increase.
15. **SA pay-variation top-up on cash-out.** *SA s8(3a)(b).* If rate varies during period the cash-out covers → further payment.
16. **ACT "taking" vs "cessation" 12-month anchor.** *ACT s7 vs s11D.* Different reference dates produce different averages when hours have changed.
17. **NSW two-branch ordinary pay** (Branch A vs Branch B) plus separate hours-varied calc within Branch A. *NSW s3(1)(a) vs (b).* Three formulas.
18. **TAS day-to-day rate variation.** *TAS s11.* FT/PT rate "may vary day to day depending on when leave is taken and what allowances/penalties apply on the day." Calculator must compute by-day.
19. **Casual loading inclusion is NOT universal.** WA s7B, SA s3(2)(b), QLD (regulator), TAS, NSW, VIC, ACT, NT explicit or implicit. Universal in practice but state-specific in code.
20. **Bonus inclusion has 4-part NSW test + $183,100 high-income threshold.** *NSW.* (a) Provided in employment terms; (b) Part of established scheme; (c) Performance/results-based; (d) Not main remuneration. Plus high-income threshold (changes 1 July).
21. **NT bonus inclusion is broader.** *NT s7(2)(b).* "Amounts payable under a bonus or incentive scheme, being amounts that are usually paid with pay."
22. **TAS bonus exclusion is absolute.** *TAS s11(2)(h).*
23. **QLD penalty rates INCLUDED.** *QLD s98.* Shift penalties, weekend, PH loadings — distinguishes QLD from NSW/VIC/WA/SA/ACT/NT.
24. **TAS shift penalties INCLUDED + all-purpose allowances INCLUDED.** *TAS s11.* TAS day-to-day variation makes calculator more complex.
25. **NT explicit-allowance exclusions.** *NT s7(2).* District, site, climatic, overtime, penalty rates excluded. Industry/leading hand/skill/qualification INCLUDED.
26. **WA all-allowance exclusion.** *WA s7A.* Broad exclusion of "any similar payments".
27. **Board and lodging inclusion** (provided in employment, NOT during leave). *Most jurisdictions.* WA s7C, SA s3(2)(c), VIC s15(1)(b), NT s7(2)(c).

### 5.3 Public holiday anomalies

28. **Public holiday extension rules differ** (Exclusive vs Inclusive). See §2.4.
29. **WA s9(4) extension ONLY applies to leave taken under s8(2)(a)/(b), NOT s9(2) termination payouts.** *WA.* Termination pay calc must NOT inflate for PH.

### 5.4 Continuous service / continuity anomalies

30. **Parental leave preservation differs by state and date.** VIC pre/post 1/11/2018: 48-wk cap vs unlimited; casuals get 104 wks. WA pre/post 20/06/2022: paid parental + GPPL inclusion. SA: parental leave (paid + GPPL) NEVER counts. NSW: unpaid parental leave doesn't count unless company policy. NT: unpaid maternity doesn't count.
31. **Unpaid leave treatment differs.** VIC s13/s14: ≤52 wks counted; >52 wks NOT (with exceptions). WA: counted toward continuity but NOT toward length (s6A). NT: not in service period. SA: preserves continuity but not in service period.
32. **Workers Comp treatment is highly state-specific.**
    - VIC pre 1/11/2018: only first 48 wks/year.
    - VIC from 1/11/2018: counts.
    - WA from 1/07/2024: counts (s61(d) Workers Comp & Injury Mgmt Act 2023).
    - WA pre 1/07/2024 + entitlement post 20/06/2022: doesn't count unless casual.
    - WA pre 1/07/2024 + entitlement pre 20/06/2022: counts up to 15 days/year.
    - ACT pre 9/06/2023: only up to 2 weeks/year.
    - ACT from 9/06/2023: counts.
    - NSW: counts (Workers Comp Act 1987 s49).
    - SA: counts (s6(1)(d)).
    - QLD: counts (paid Workers Comp).
    - TAS: counts (s5(1)(c)).
    - **NT: does NOT count.**
33. **Stand-down for slackness re-employment window varies.** WA: 6 months (s6(4)(b)); ACT: 6 months (s2G(2)(b)); TAS: 6 months for slackness, 3 months otherwise; QLD: no time limit for stand-down; others: 2 months.
34. **Transfer-of-business "connection" definitions vary.** WA s7G (4 forms incl. outsourcing reversal); VIC s11; SA s3(3); ACT s10; NT s12(8).
35. **Apprenticeship lead-in window varies.** WA s6(7): 52 weeks; SA s6(3): 12 months; NT s12(3): 12 months; VIC s13(2): 52 weeks; QLD: 3 months; ACT: 12 months; TAS: 3 months.

### 5.5 Pro-rata / termination anomalies

36. **ACT 5-year threshold** vs everyone else's 7y (or NSW's 5y-illness rule).
37. **NSW two-tier pro-rata** (5y for illness/death/domestic-pressing; 10y for any).
38. **WA serious-misconduct-only exclusion.** Other reasons including employee resignation → pro-rata payable.
39. **SA "unlawfully terminated" exclusion** (e.g. walks off without notice).
40. **QLD "unfair dismissal" inclusion.** QLD s95(4) explicitly lists employer unfair dismissal as a pro-rata trigger.
41. **NT death NOT in pro-rata triggers** (s10(2)) — death covered separately under s10(3).
42. **TAS retirement age**: 60 women / 65 men.
43. **ACT minimum retirement age**: per award/agreement OR 65 years.
44. **NT retirement age**: Age Pension age (currently 67 for both genders).

### 5.6 Cash-out / payment-in-lieu anomalies

45. **WA cash-out doesn't accrue** — LSL doesn't accrue on the cashed-out portion until re-accrued.
46. **WA s5(2) "adequate benefit"** — at least ordinary pay rate as floor.
47. **SA s8(3a)(b) variation top-up** — further payment if rate varies during covered period.
48. **SA cash-out written statement** has specific required fields (worker name, date, current entitlement, payment, period, remaining days, employer name, signed/dated).
49. **QLD cash-out gated by QIRC** approval (compassionate or financial-hardship).
50. **ACT cash-out via WorkSafe ACT guidance** — under s8(c) "in another way".

### 5.7 Half-pay / double-pay anomalies

51. **WA s9(1C/D)** half AND double pay (employer not obligated).
52. **VIC s22** half-pay only — employer must grant unless reasonable business grounds.
53. **Commonwealth** half-pay allowed.

### 5.8 Records / payment timing

54. **Termination payment timing varies dramatically.**
    - NSW: forthwith (day of termination).
    - VIC: day of termination.
    - QLD: within 3 days.
    - WA: day of termination.
    - SA: immediately on termination.
    - TAS: day of termination.
    - **ACT: within 90 days** (longest in country).
    - NT: as soon as practicable.
55. **Records retention varies.**
    - NSW: 6 years after employment ends.
    - VIC: 7 years.
    - QLD: 6 years.
    - WA: 7 years.
    - SA: throughout service + 3 years.
    - **TAS: in perpetuity** (no statutory time limit).
    - ACT: 7 years.
    - NT: 3 years (6 if died).
56. **SA 12-month interval reporting** — employer must determine avg hours/week at 12-month intervals (s10(3)).

### 5.9 Public/private sector & special rules

57. **VIC public sector employees** explicitly in scope (s3 def) with exception if other VIC Act applies.
58. **Commonwealth scheme excludes** APS where State LSL applies (e.g. ACT/NT teaching services).
59. **All jurisdictions exclude awards/EAs with equivalent separate LSL.** WA s4A, VIC s5(a)/(b), SA s16, etc.
60. **Pre-modern federal award carve-out** can override state LSL laws entirely (e.g. Graphics Arts General Award 2000 = 13 wks at 15 yrs in NSW).
61. **NSW $183,100 high-income threshold** for bonus inclusion (changes 1 July annually). Other jurisdictions don't have an equivalent threshold.

---

## 6. Calculator data model implications

### 6.1 Inputs required (per employee per jurisdiction)

**Always required:**
- Jurisdiction (one of 9: NSW/VIC/QLD/WA/SA/TAS/ACT/NT/Commonwealth) + portable scheme flag
- Award type: pre-modern federal award (with LSL clause) / modern award / enterprise agreement (pre/post 1/7/2009) / no award
- Start date with current employer
- End date / calculation date
- Termination reason (enum varies per jurisdiction — see §2.7)
- Employment type (FT / PT / casual / seasonal)
- Current ordinary hourly rate
- Current contracted hours per week
- Whether casual loading is paid (and rate)
- Cessation status (still employed / cashing out by agreement / terminated)
- **Entitlement-reached date** (critical for VIC pre/post 1/11/2018 and WA pre/post 20/06/2022)
- **Date-of-event** (workers comp date for WA 1/07/2024 and ACT 9/06/2023 branching)

**Required for variable pay:**
- Annual income for current year (for NSW $183,100 threshold check)
- Bonus / commission history (per NSW's 4-criteria test; per NT's "usually paid" test; per WA's piecework/result averaging)
- Allowance history (industry / leading hand / skill / qualification / board / lodging / district / site / climatic — itemised; inclusion rules differ by state)

**Required for variable hours:**
- Hours-per-week history (5 years for NSW; entire continuous employment for VIC; 365 days for WA; 156 weeks for SA; 12 months for QLD/TAS/ACT casual; **per-year for NT**)
- Year-by-year unpaid leave periods
- Stand-down periods
- Industrial dispute absences
- Workers Comp periods (with start dates for ACT/WA date-branching)

**Continuous service modifiers:**
- Parental leave periods (and total weeks for VIC 52-week / 104-week thresholds)
- Apprenticeship completion date (if applicable, for state-specific lead-in window)
- Transfer of business / transmission events (with prior employer service + connection type)
- Defence Force service (non-Permanent)
- Related-corporation employment periods (for WA s6, NT s12(6), SA s3(3))
- Casual/seasonal regular & systematic engagement pattern (NSW + VIC + QLD)
- TAS 32-hour-4-week rule satisfaction (per period)

**Jurisdiction-specific:**
- WA postponed-leave-by-agreement flag and date
- ACT FT→PT/casual transition within 2 years of entitlement flag and date
- VIC workplace illness/injury date (s17 override)
- NSW prescribed date (auto-derived but exposed)
- SA relevant date (auto-derived but exposed)
- Commonwealth: pay category + APS agency type

### 6.2 Engine architecture — recommended per-state file layout

Existing pattern (`website/src/lib/lsl/states/{nsw,vic,qld}/rules/`):
- `accrual-table.ts`
- `trigger-handlers.ts`
- `value-of-week.ts`

**Recommended additions for new engines:**
- `averaging-window.ts` — separate file because averaging logic varies materially (12mo / 5y / 3y / 260w / 365d / 3-month / per-year)
- `continuity-rules.ts` — what breaks continuity, what preserves it, what counts toward length
- `cashout-rules.ts` — only WA, SA, QLD, TAS, ACT
- `public-holiday-rules.ts` — Exclusive vs Inclusive
- `transfer-of-business.ts` — connection definitions, rehire windows
- `pay-component-classifier.ts` — given a pay component, is it in ordinary pay for this jurisdiction?
- `dual-regime.ts` — for VIC/WA/ACT date-branching

### 6.3 Cross-cutting type changes

```typescript
type Jurisdiction = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT' | 'Commonwealth'

type AwardCarveOut =
  | { kind: 'pre_modern_federal_award'; award_name: string; entitlement_overrides: true }
  | { kind: 'enterprise_agreement'; effective_date: Date; prevails_over_state?: boolean }
  | { kind: 'modern_award' }
  | { kind: 'no_award' }

type TerminationReason =
  | 'resignation_general'
  | 'resignation_illness'
  | 'resignation_incapacity'
  | 'resignation_domestic_necessity'
  | 'resignation_unlawful_no_notice'           // SA-excluded
  | 'employer_termination_general'
  | 'employer_termination_redundancy'
  | 'employer_termination_for_illness'         // QLD-specific
  | 'employer_termination_unfair'              // QLD-included
  | 'employer_termination_serious_misconduct'  // excluded everywhere
  | 'death'
  | 'retirement_age'

type PayComponent = {
  kind: 'ordinary_wages' | 'overtime' | 'penalty_rate_shift' | 'penalty_rate_weekend'
      | 'penalty_rate_ph' | 'shift_loading' | 'casual_loading' | 'commission'
      | 'bonus_kpi' | 'bonus_discretionary' | 'allowance_industry' | 'allowance_skill'
      | 'allowance_leading_hand' | 'allowance_qualification' | 'allowance_all_purpose'
      | 'allowance_district' | 'allowance_site' | 'allowance_climatic'
      | 'allowance_disability' | 'allowance_inconvenience' | 'allowance_danger'
      | 'travel_reimbursement' | 'lafh' | 'board' | 'lodging'
      | 'salary_sacrifice' | 'service_grant' | 'over_award_payment'
  amount: number
  frequency: 'per_week' | 'per_hour' | 'per_period' | 'one_off' | 'annual'
  period_start?: Date
  period_end?: Date
  all_purpose?: boolean   // matters for TAS, ACT
  paid_for_overtime?: boolean   // matters for ACT s7(1) inclusion test
}

type ServiceModifier = {
  kind: 'parental_leave_paid_company' | 'parental_leave_paid_govt'
      | 'parental_leave_unpaid' | 'workers_comp'
      | 'standdown_slackness' | 'standdown_industrial_action' | 'standdown_breakdown'
      | 'apprenticeship' | 'transfer_of_business' | 'defence_force_nonpermanent'
      | 'unpaid_leave_general' | 'jobkeeper_direction' | 'covid_standdown'
      | 'jury_service' | 'industrial_dispute_returned' | 'illness_injury_paid'
      | 'illness_injury_unpaid'
  start_date: Date
  end_date: Date
  weeks?: number    // for VIC 48-week cap, 52-week cap, ACT 2-week cap
  notes?: string
}
```

### 6.4 Test fixture coverage requirements

Per jurisdiction:
- Baseline 10-year case.
- 7-year (or 5-year ACT, 7-year NSW illness-only) pro-rata cases for each grounds.
- Variable hours case (averaging window exercised) — and for **VIC/WA/SA/NT**, multi-period variants.
- Variable pay case (commission / piecework / bonus averaging).
- Cash-out by agreement (WA, SA, QLD, TAS, ACT — different rule per state).
- Half-pay / double-pay request (WA, VIC).
- Death-during-leave override (VIC critical).
- Public holiday during LSL (all 8).
- Public holiday on termination payout (WA-critical — must NOT extend).
- Transfer of business (each jurisdiction's connection definition).
- Apprenticeship lead-in (state-specific window).
- Workers comp override (VIC critical; WA + ACT date-branching critical).
- FT→PT/casual transition (ACT s7(3), s11D divergence critical).
- Concurrent employment with related corporation (WA, NT).
- NT per-year formula (multi-year, varied hours each year).
- TAS day-to-day rate variation (rate when leave taken on a day with shift penalty).
- QLD 3-stream coverage (s95 FT, s105 casual/PT/Mixed in hours, s107 seasonal sugar/meat).
- NSW high-income threshold boundary case ($183,099 vs $183,101).
- NSW Branch A vs Branch B vs varied-hours sub-case routing.
- Pre-modern federal award carve-out (e.g. Graphics Arts General Award 2000 in NSW; Meat Award in VIC).
- VIC pre/post 1 Nov 2018 service span (employee straddling both regimes).
- WA pre/post 20 June 2022 entitlement span.
- WA Workers Comp pre/post 1 July 2024 date-branching.
- ACT Workers Comp pre/post 9 June 2023 date-branching.
- Commonwealth LSL Act 1976 employee (full + half-pay + termination payout).

---

## 7. Open questions / require legal verification before implementation

1. **NSW verbatim subsection numbering** (legislation.nsw.gov.au refused fetch). Confirm s3(1)(a) "ordinary remuneration" branch vs s3(1)(b) "average weekly wage" branch language, plus s4(2)(iii), s4(3), s4(3A), s4(4A), s4(5), s4(7), s4(8), s4(10), s4(11) subdivisions.

2. **NSW $183,100 high-income threshold** — confirm current value (changes 1 July annually) and which year's threshold applies on prescribed date.

3. **QLD ss 95/98/99/107/110 verbatim text**. Confirm: (a) s95(3) pro-rata trigger language; (b) s98 ordinary rate vs "higher rate" mechanics; (c) s99 casual averaging methodology; (d) s105 casual hours formula; (e) s107 seasonal worker scope (sugar/meat industry definitions); (f) s110 cash-out conditions.

4. **SA currency** — reprint read was 1.1.2010. Verify post-2010 amendments to s3(2) (3-year averaging), s5(1a) (cash-out), s7(7) ("every day counts"), and any amendments to s5 entitlement schedule.

5. **NT currency** — version read was 14 Oct 2015. Verify post-2015 amendments to s7 (pay definition), s10 (cessation), s11 (formula), s12 (qualifying service).

6. **TAS verbatim text + records** — verify s11 full list of exclusions (Inconvenience/danger/hardship + hot/cold/dirt + travel + LAFH), s10 cash-out, s12 termination + s12(9) PH rule + s12(4) deemed-on-termination, s5 continuity rules (esp. 32-hour/4-week + apprenticeship 3-month).

7. **ACT portable scheme overlap mechanics** — confirm exact s2D/2E/2EA operation when an employee has both main-Act and portable-scheme entitlement that has been partly drawn down.

8. **VIC s17 workers comp + s15 "greatest of"** — when an injured employee returns from WorkCover and then takes LSL, does s17 "greater of pre-LSL vs pre-injury" override apply ONLY to the rate AT s15(1), or modify the s15(2) averaging window too?

9. **VIC death override (s10(3)(b))** — confirm it applies symmetrically to BOTH the ordinary time rate of pay AND the normal weekly hours, not just one.

10. **Casual loading inclusion in TAS, NT, ACT** — all three Acts silent on whether casual loading is "ordinary pay" or a "penalty rate". Practical position varies; verify with regulator.

11. **Salary sacrifice treatment** — pre-sacrifice rate is industry default but no statutory rule. Verify the regulator position in each jurisdiction.

12. **Working directors paid via dividends/trust distributions** — are they "employees" under each Act? Fact-specific; provide ATO/regulator-aligned guidance in UI.

13. **Salary packaging / FBT grossed-up amounts** — not statutorily addressed; assume pre-sacrifice rate but confirm.

14. **38-hour week assumption** — confirm calculator should NOT assume 38 hours; ask user for contracted/actual hours.

15. **Public sector exclusion lists** — VIC, NSW, others may exclude specific public sector employees with separate LSL regimes (teachers, police, judges, ACT/NT teaching services). Calculator should warn and refer.

16. **NSW high-income threshold currency** — verify current threshold value and which date's threshold applies (prescribed date vs employment date).

17. **Portable scheme scope decision** — PM-level decision: does the calculator handle portable schemes (building/construction, contract cleaning, community services, security) or only main-Act calculations?

18. **Commonwealth LSL Act 1976 scope** — calculator decision: include APS / Cth-agency employees, or only state-jurisdiction employees? If included, verify pay-category enum and `(Annual Salary/12) × LSL credits` formula precision.

19. **Pre-modern federal award detection** — calculator UX question: ask user "are you covered by a pre-modern federal award?" Provide list of common ones (Graphics Arts, Meat) + escape hatch for legal review.

20. **NT retirement age "Age Pension age"** — currently 67 (men + women); confirm the calculator pulls current Age Pension age from a dated lookup rather than hard-coding.

---

## 8. References — primary sources

### Statutory (read directly from official PDF or compilation)
- **VIC** — [Long Service Leave Act 2018, Authorised Version No. 004](https://www.legislation.vic.gov.au/in-force/acts/long-service-leave-act-2018/004)
- **WA** — [Long Service Leave Act 1958, As at 31 January 2025](https://www.legislation.wa.gov.au/legislation/prod/filestore.nsf/FileURL/mrdoc_48247.pdf/$FILE/Long%20Service%20Leave%20Act%201958%20-%20%5B04-m0-00%5D.pdf)
- **SA** — Long Service Leave Act 1987 (1.1.2010 reprint — verify currency)
- **ACT** — [Long Service Leave Act 1976, R29 effective 19 November 2025](https://www.legislation.act.gov.au/DownloadFile/a/1976-27/current/PDF/1976-27.PDF)
- **NT** — [Long Service Leave Act 1981, As in force 14 October 2015](https://legislation.nt.gov.au/api/sitecore/Act/PDF?id=11975)
- **Commonwealth** — [Long Service Leave (Cth Employees) Act 1976 — AustLII](https://www.austlii.edu.au/cgi-bin/viewdb/au/legis/cth/consol_act/lslea1976475/)

### Statutory (referenced via AustLII / search summaries — verify before implementation)
- **NSW** — [LSL Act 1955 — NSW Legislation](https://legislation.nsw.gov.au/view/whole/html/inforce/current/act-1955-038)
- **QLD** — [Industrial Relations Act 2016 — QLD Legislation](https://www.legislation.qld.gov.au/view/whole/html/current/act-2016-063)
- **TAS** — [LSL Act 1976 — TAS Legislation](https://www.legislation.tas.gov.au/view/whole/html/inforce/current/act-1976-095)

### Authoritative training material
- **Australian Payroll Association — Long Service Leave Masterclass 2026** (158 pp). The masterclass cross-references each jurisdiction's Act with worked examples, regulator guidance, and a state-by-state matrix. Material in this v2.0 corrections list (QLD penalty rates, TAS shift penalties, NT workers comp exclusion, NSW $183,100 threshold, dual-regime branching) was sourced from this document where statutory text was unavailable or ambiguous.
- 8 supplementary state-overview PDFs (NSW/VIC/QLD/WA/SA/TAS/ACT/NT — 2 pp each, summary matrices from the masterclass).

### Regulator / interpretive guidance
- [NSW Government — Long service leave](https://www.nsw.gov.au/employment/rights-responsibilities/leave/long-service-leave)
- [Business VIC — Long service leave](https://business.vic.gov.au/business-information/staff-and-hr/long-service-leave-victoria)
- [Business Queensland — Long service leave](https://www.business.qld.gov.au/running-business/employing/legal-obligations/long-service-leave)
- [WA Government — Overview of long service leave](https://www.wa.gov.au/organisation/private-sector-labour-relations/overview-of-long-service-leave-wa)
- [SafeWork SA — Long Service Leave](https://www.safework.sa.gov.au/workers/wages-conditions/long-service-leave)
- [WorkSafe Tasmania — Long service leave](https://worksafe.tas.gov.au/topics/laws-and-compliance/long-service-leave)
- [WorkSafe ACT — Long service leave](https://www.worksafe.act.gov.au/laws-and-compliance/long-service-leave/guidance-material)
- [NT Government — Long Service Leave Act 1981](https://legislation.nt.gov.au/Legislation/LONG-SERVICE-LEAVE-ACT-1981)

---

*Document end. Suggested next steps: (1) PM to triage open questions in §7 against legal-counsel engagement budget; (2) Developer to use §6 to revise type definitions and engine file scaffolding for WA/SA/TAS/ACT/NT; (3) QA to design fixtures from §6.4 list before any engine implementation begins; (4) DevOps no action.*
