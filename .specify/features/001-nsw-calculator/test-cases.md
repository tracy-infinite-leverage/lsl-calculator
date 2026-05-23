# NSW LSL Calculator — Gold-Standard Test Cases

**Status**: ✅ PM-signed-off (Tracy, 2026-05-21) — Phase 1 unlocked
**Date**: 2026-05-21
**Spec**: spec.md v0.5.0

> **PM sign-off — 2026-05-21 (Tracy)**: all 8 TBDs at the bottom of this file are resolved; resolutions inline below and summarised in the TBD section. Phase 1 (rules engine implementation) may proceed.

**Original draft status**: Draft v1
**Spec at original drafting**: v0.4.1
**Impl plan**: impl-plan.md v0.1 (data model §2.1)
**Research brief**: research-brief-2026-05-21.md
**Source**: APA LSL Masterclass PDF (pp.13-31, pp.139-141) + NSW *Long Service Leave Act 1955*

> Gate: this file MUST be PM-signed-off before Phase 1 (rules engine) development starts. The rules-engine CI suite encodes every case below as a parameterised test; a single failing case blocks deploy (per spec SC2 / AC24 + product.md §12).

---

## How to read this file

Each test case has:

- **ID** (e.g. `TC-NSW-001`) — unique, stable, referenced from `gold-standard.test.ts`
- **Name** — short, descriptive
- **Source** — PDF page and/or NSW LSA section that produced the expected value
- **Category** — Single mode (A / B / C / negative) or Bulk mode
- **Why it matters** — the spec acceptance criterion or research-brief edge case this case backs (one sentence)
- **Inputs** — fenced JSON-ish block following the impl-plan §2.1 data model (`Employee`, `Trigger`, `WagePeriod`, `ContinuousServiceEvent`)
- **Expected output** — `value_of_week`, `value_of_day`, `total_entitlement_weeks`, `total_entitlement_dollars`, `expected_citations[]`, and (where relevant) `system_formula_value` + `variance` (per F21 / AC12)
- **Notes** — assumptions, derivations, anything where the PDF leaves something implicit, and any `expected: TBD` flags

### Conventions used in this file

- **Currency**: AUD; half-up rounding at 0.005; 2 decimal places at display; intermediate arithmetic is unrounded (per F12, AC25).
- **Dates**: ISO `YYYY-MM-DD`. Where the PDF uses a relative "Year 1 (most recent)" the test fixture uses concrete dates anchored at prescribed date `2026-05-21` (=as-at default for v1 testing).
- **Lookback denominators**: per F8 + research brief §1.2. 12-month = 365 (366 if leap year in window). 5-year = 1826 (1825 if no leap year, 1827 if 2 leap years). Days-not-counted subtracted before division.
- **Entitlement formula**: `years_of_continuous_service × (8.6667 / 10)` weeks (F11, LSA s.4(2)).
- **System formula** (the comparison value, F21): `current_weekly_gross × entitlement_weeks` — included on every case as `system_formula_value` so the variance assertion is auto-derived.
- **Citations**: every case lists the minimum expected citations. The rules engine MAY emit additional citations; tests assert array-membership, not array-equality.
- **`expected: TBD`** — flagged where the PDF gives a worked answer to a different sub-question than the calculator's main outputs, or where v1's gross-only scope means the PDF example cannot be reproduced verbatim. Each TBD case has a Notes block explaining what to confirm with PM.

---

## Coverage at a glance

| Source / Theme | Test IDs | Count |
|---|---|---|
| PDF NSW worked examples (pp.13–24) | TC-NSW-001 → TC-NSW-019 | 19 |
| PDF Practice Activities (pp.27–29) | TC-NSW-020 → TC-NSW-022 | 3 |
| PDF System vs Manual (pp.139–141) — load-bearing headline | TC-NSW-023 → TC-NSW-026 | 4 |
| Pay-cycle normalisation (AC4 / F3a) | TC-NSW-027 → TC-NSW-030 | 4 |
| Trigger handling — taking_leave / termination / as_at | TC-NSW-031 → TC-NSW-038 | 8 |
| Continuous-service edge cases (research brief §5) | TC-NSW-039 → TC-NSW-047 | 9 |
| Classifier — A/B/C boundary + ambiguous | TC-NSW-048 → TC-NSW-051 | 4 |
| Cross-jurisdiction blocking (AC23) | TC-NSW-052 → TC-NSW-053 | 2 |
| Negative / file-validation (AC22, AC26, AC27, AC28) | TC-NSW-054 → TC-NSW-057 | 4 |
| Bulk-mode fixtures (D17 / SC7) | TC-BULK-001 → TC-BULK-003 | 3 |
| **Total** | | **60** |

---

# Single-mode test cases

## §A — PDF NSW worked examples (pp.13–24)

### TC-NSW-001 — Alicia, 5.75 yrs redundancy, pro-rata entitlement weeks

- **Source**: PDF p.13 Example 1; NSW LSA s.4(2)(iii)(a)
- **Category**: Category A — entitlement-weeks calculation
- **Why it matters**: AC8 — 5-to-<10-yr employee with redundancy qualifies for pro-rata; backs the s.4(2)(iii) accrual table.

**Inputs**

```yaml
employee:
  id: TC-NSW-001
  legalName: Alicia
  startDate: 2020-08-21        # → exactly 5.75 yrs at termination
  endDate: 2026-05-21
  employmentType: full_time
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentWeeklyGross: 1500.00  # placeholder; PDF supplies no rate
  wageHistory:
    - { periodStart: 2020-08-21, periodEnd: 2026-05-21, grossPay: 449500.00, frequency: weekly }  # $1500/wk × 299.67 wks
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-21, reason: redundancy }
```

**Expected output**

```yaml
category: A
total_entitlement_weeks: 4.9833    # 5.75 × (8.6667/10) — PDF p.13 verbatim
value_of_week: 1500.00              # current = 5yr avg (flat history)
value_of_day: 300.00                # 1500 / 5
total_entitlement_dollars: 7474.95  # 4.9833 × 1500
expected_citations:
  - { section: NSW LSA s.4(2)(iii)(a), rule: accrual.pro-rata.5-to-10.redundancy, pdfPage: 13 }
  - { section: NSW LSA s.4(2),         rule: accrual.years-x-8.6667-over-10,     pdfPage: 13 }
  - { section: NSW LSA s.4(5)(b),      rule: value-of-week.A.current,            pdfPage: 18 }
system_formula_value: 7474.95
variance: 0.00
```

**Notes**

PDF p.13 explicitly states `5.75 × (8.6667/10) = 4.9833 weeks`. The PDF does not supply a wage rate for Alicia — `$1,500/wk` is a clean placeholder; what's load-bearing is the entitlement weeks. Variance is zero because the inputs collapse Category A current and 5-year average to the same value.

---

### TC-NSW-002 — Will, 11 yrs resigned, 3 wks already taken

- **Source**: PDF p.13 Example 2; NSW LSA s.4(2)
- **Category**: Category A — entitlement-weeks-net-of-leave-taken
- **Why it matters**: backs the entitlement-table arithmetic for 10+ years with prior leave drawn down.

**Inputs**

```yaml
employee:
  id: TC-NSW-002
  legalName: Will
  startDate: 2015-05-21
  endDate: 2026-05-21
  employmentType: full_time
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentWeeklyGross: 1800.00
  wageHistory:
    - { periodStart: 2015-05-21, periodEnd: 2026-05-21, grossPay: 1029600.00, frequency: weekly }
  serviceEvents:
    - { type: paid_leave, startDate: 2024-01-08, endDate: 2024-01-26 }   # 3 wks paid LSL previously taken
trigger: { kind: termination, terminationDate: 2026-05-21, reason: voluntary_resignation }
```

**Expected output**

```yaml
category: A
gross_entitlement_weeks: 9.5333        # 11 × (8.6667/10)
less_leave_taken_weeks: 3.0000
total_entitlement_weeks: 6.5333        # PDF p.13 verbatim
value_of_week: 1800.00
value_of_day: 360.00
total_entitlement_dollars: 11759.94
expected_citations:
  - { section: NSW LSA s.4(2),    rule: accrual.10yr-plus.any-reason,   pdfPage: 13 }
  - { section: NSW LSA s.4(2),    rule: accrual.net-of-leave-taken,     pdfPage: 13 }
  - { section: NSW LSA s.4(5)(b), rule: value-of-week.A.current,        pdfPage: 18 }
```

**Notes**

Voluntary resignation at 10+ years still produces pro-rata in NSW (s.4(2)(iii)(b) full-entitlement plus any-reason rule). Engine must surface `prior_leave_taken` on the input form (per F2) and subtract before reporting net weeks.

---

### TC-NSW-003 — Natal, paid annual leave counts as service (continuous service rule)

- **Source**: PDF p.14 "Counting as Service" Example
- **Category**: Category A — continuous service rule
- **Why it matters**: backs F9 (paid annual leave counts), part of research brief §1.4.

**Inputs**

```yaml
employee:
  id: TC-NSW-003
  legalName: Natal
  startDate: 2016-05-21
  employmentType: full_time
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentWeeklyGross: 1500.00
  wageHistory:
    - { periodStart: 2016-05-21, periodEnd: 2026-05-21, grossPay: 781200.00, frequency: weekly }
  serviceEvents:
    - { type: paid_leave, startDate: 2026-01-05, endDate: 2026-01-23 }   # 3 wks paid annual leave in last 12 mo
trigger: { kind: as_at, asAtDate: 2026-05-21 }
```

**Expected output**

```yaml
category: A
total_entitlement_weeks: 8.6667        # 10.00 yrs × 8.6667/10
value_of_week: 1500.00
value_of_day: 300.00
total_entitlement_dollars: 13000.05
days_counted_as_service: 3653          # full elapsed
days_not_counted_in_lookback: 0        # paid leave is NOT excluded from lookback denominator
expected_citations:
  - { section: NSW LSA s.4(11), rule: continuous-service.paid-leave-counts,    pdfPage: 14 }
  - { section: NSW LSA s.4(2),  rule: accrual.10yr-milestone,                  pdfPage: 13 }
  - { section: NSW LSA s.4(5)(b), rule: value-of-week.A.current,                pdfPage: 18 }
```

**Notes**

Paid annual leave both **counts as service** AND is **paid time** — so it is NOT excluded from the lookback denominator (contrast TC-NSW-005 / TC-NSW-006). Critical engine distinction: `days_counted_as_service` vs `days_not_counted_in_lookback` are not the same field.

---

### TC-NSW-004 — Soria, 1 yr unpaid parental leave pushes entitlement date

- **Source**: PDF p.14 "Does Not Count" Example
- **Category**: Category A — continuous service rule
- **Why it matters**: AC9 — UPL excludes days from continuous service AND from lookback denominator; backs research brief §5.2.

**Inputs**

```yaml
employee:
  id: TC-NSW-004
  legalName: Soria
  startDate: 2014-07-01
  employmentType: full_time
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentWeeklyGross: 1400.00
  wageHistory:
    - { periodStart: 2014-07-01, periodEnd: 2026-05-21, grossPay: 794570.00, frequency: weekly }  # excludes UPL year
  serviceEvents:
    - { type: unpaid_parental_leave, startDate: 2017-07-01, endDate: 2018-07-01 }
trigger: { kind: as_at, asAtDate: 2025-07-01 }   # PDF says entitlement date pushed from 2024-07-01 to 2025-07-01
```

**Expected output**

```yaml
category: A
years_of_continuous_service: 10.0000   # 11 elapsed − 1 UPL
total_entitlement_weeks: 8.6667
value_of_week: 1400.00
value_of_day: 280.00
total_entitlement_dollars: 12133.38
days_not_counted_in_service: 365
days_not_counted_in_lookback: 0        # UPL was 8 yrs before prescribed date — outside 5-yr window
expected_citations:
  - { section: NSW LSA s.4(11), rule: continuous-service.unpaid-parental-leave-excluded, pdfPage: 14 }
  - { section: NSW LSA s.4(2),  rule: accrual.10yr-milestone-deferred-by-excluded-days, pdfPage: 13 }
```

**Notes**

PDF p.14 verbatim: "her entitlement date is now 1/07/2025" (vs. 1/07/2024 had she not taken UPL). Engine must defer the 10-year milestone by the count of days-not-counted. This is the simpler variant of TC-NSW-006 (Michelle) where the UPL also falls inside the 5-year window.

---

### TC-NSW-005 — Yamala, 2 wks Workers Comp absence (counts as service, excluded from average hours)

- **Source**: PDF p.16 Example 2 (Yamala); NSW Workers Comp Act 1987 s.49
- **Category**: Category B — continuous service + lookback denominator
- **Why it matters**: AC10 — Workers Comp counts as service but excluded from average-hours denominator; backs research brief §5.5.

**Inputs**

```yaml
employee:
  id: TC-NSW-005
  legalName: Yamala
  startDate: 2014-05-21
  employmentType: casual
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentWeeklyGross: 1200.00            # current hourly × normal weekly hours
  currentHourlyRate: 40.00
  wageHistory:
    - # 12 months excluding 2 wks Workers Comp — gross over 351 paid days
      periodStart: 2025-05-21
      periodEnd:   2026-05-21
      grossPay:    60151.20     # = $40 × 1503.78 ordinary hrs over 351 days
      frequency:   other
      periodDays:  351          # 365 − 14 days WC
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2026-03-01, endDate: 2026-03-15 }
trigger: { kind: as_at, asAtDate: 2026-05-21 }
```

**Expected output**

```yaml
category: B
years_of_continuous_service: 12.0000   # WC counts toward service
total_entitlement_weeks: 10.4000       # 12 × 8.6667/10
days_in_lookback: 351                  # 365 − 14 per PDF p.16: "(365 − 14) × 7"
value_of_week_12mo_avg: 1200.00        # $40 × (1503.78 hrs / 351 days) × 7
value_of_day: 240.00
total_entitlement_dollars: 12480.00
expected_citations:
  - { section: NSW LSA s.4(11),       rule: continuous-service.workers-comp-counts,   pdfPage: 16 }
  - { section: Workers Comp Act 1987 s.49, rule: continuous-service.wca-cross-ref,    pdfPage: 16 }
  - { section: NSW LSA s.4(5)(c),     rule: value-of-week.B.12mo-greater-of,          pdfPage: 19 }
  - { section: NSW LSA s.4(5),        rule: lookback.days-not-counted.workers-comp,   pdfPage: 19 }
```

**Notes**

PDF p.16 verbatim: "the average weekly hours over 12 months would be in a 365 day period, total ordinary hours worked / (365 − 14) × 7." Engine MUST subtract WC days from the lookback denominator while leaving them in the service-day count. Wage figures synthesised to give a clean weekly result ($1,200/wk).

---

### TC-NSW-006 — Michelle, PT 22.8 h/wk fixed-rate, 52 wks UPL in Year 3

- **Source**: PDF p.20 "Fixed Rate No Varied Hours Example" (Michelle)
- **Category**: Category A
- **Why it matters**: Verbatim PDF example — backs F8 Category A "greater of (current rate, 5yr avg)" with UPL exclusion from lookback denominator (research brief §5.3, item 3).

**Inputs**

```yaml
employee:
  id: TC-NSW-006
  legalName: Michelle
  startDate: 2018-05-21
  employmentType: part_time
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentWeeklyGross: 1235.00       # PDF "Last Pay Weekly Rate"
  normalWeeklyHours: 22.8           # PDF: PT 3 days/wk
  wageHistory:                       # PDF gives yearly totals; encoded as yearly periods
    - { periodStart: 2025-05-22, periodEnd: 2026-05-21, grossPay: 63600.00,  frequency: other, periodDays: 365 }   # Yr 1
    - { periodStart: 2024-05-22, periodEnd: 2025-05-21, grossPay: 62800.00,  frequency: other, periodDays: 366 }   # Yr 2 (leap)
    - { periodStart: 2023-05-22, periodEnd: 2024-05-21, grossPay: 0.00,      frequency: other, periodDays: 365 }   # Yr 3 UPL
    - { periodStart: 2022-05-22, periodEnd: 2023-05-21, grossPay: 61950.00,  frequency: other, periodDays: 365 }   # Yr 4
    - { periodStart: 2021-05-22, periodEnd: 2022-05-21, grossPay: 61040.00,  frequency: other, periodDays: 365 }   # Yr 5
  serviceEvents:
    - { type: unpaid_parental_leave, startDate: 2023-05-22, endDate: 2024-05-21 }   # 364 days UPL
trigger: { kind: as_at, asAtDate: 2026-05-21 }
```

**Expected output**

```yaml
category: A
days_in_5yr_window: 1826
days_not_counted_in_lookback: 364                # 52 × 7 per PDF
five_year_average_weekly: 1194.07                # (63600+62800+0+61950+61040) / (1826−364) × 7 = 249390/1462×7 — PDF p.20
value_of_week: 1235.00                            # current > 5yr avg
value_of_day: 247.00                              # 1235 / 5  (NB: PDF p.23 gives per-day-in-weeks = 0.3333)
years_of_continuous_service: 6.9973               # ≈ (2026-05-21 − 2018-05-21 − 364d) / 365.25
total_entitlement_weeks: 6.0641                   # 6.9973 × (8.6667/10) — PM-confirmed accrual snapshot
total_entitlement_dollars: 7489.16                # 6.0641 × $1,235 — round-half-up to cents
payable_indicator: "accrued, not currently payable"  # service < 10y + no qualifying termination per spec v0.5.0 §1
expected_citations:
  - { section: NSW LSA s.4(5)(b), rule: value-of-week.A.current-wins,           pdfPage: 20 }
  - { section: NSW LSA s.4(5),    rule: lookback.days-not-counted.upl,          pdfPage: 19 }
  - { section: NSW LSA s.4(11),   rule: continuous-service.upl-excluded,        pdfPage: 14 }
  - { section: NSW LSA s.4(2),    rule: accrual.snapshot.no-pro-rata-threshold, pdfPage: 13, note: "as-at snapshot per D20 / F11" }
```

**Notes**

The PDF stops at value-of-week ($1,235) and does not compute total entitlement. The denominator math `(1826 − 52×7) = 1462` is PDF verbatim — this is the gold-test for the engine's days-not-counted handling.

`total_entitlement_*` flagged TBD because the PDF doesn't carry the example through to a payout. In `as_at` mode the engine MUST report accrued weeks regardless of the s.4(2)(iii) thresholds (per F11 + D20): expected `6.9973 × 8.6667/10 = 6.0668 weeks × $1,235 = $7,492.50` — **PM to confirm this is the intended as-at presentation** rather than "zero until 10 yrs" (since Michelle is under the 10-yr milestone for *taking* leave).

---

### TC-NSW-007 — Liam, 12-yr casual, varied hours, 5 wks unpaid sick — TAKING 3 WEEKS

- **Source**: PDF p.20 "Fixed Rate Hours Vary Example" (Liam, 3-week variant)
- **Category**: Category B
- **Why it matters**: Verbatim PDF — backs F8 Category B "current hourly × (12mo hrs/days × 7) vs 5yr-avg-gross/days × 7" greater-of test. Research brief §5.1.

**Inputs**

```yaml
employee:
  id: TC-NSW-007
  legalName: Liam
  startDate: 2014-05-21
  employmentType: casual
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentWeeklyGross: 1163.46        # PDF gross-equivalent: $60,500 / 52 = $1,163.46 (year-1 avg) — used for F21 comparison only; Cat B legislated formula uses 12-month avg weekly gross directly per spec v0.5.0 §F8
  # currentHourlyRate / hoursLast12Months not collected in v1 (per spec v0.5.0 §5 — hours irrelevant)
  wageHistory:
    - { periodStart: 2025-05-22, periodEnd: 2026-05-21, grossPay: 60500.00, frequency: other, periodDays: 365 }   # Yr 1
    - { periodStart: 2024-05-22, periodEnd: 2025-05-21, grossPay: 60000.00, frequency: other, periodDays: 366 }   # Yr 2 (leap)
    - { periodStart: 2023-05-22, periodEnd: 2024-05-21, grossPay: 57000.00, frequency: other, periodDays: 365 }   # Yr 3
    - { periodStart: 2022-05-22, periodEnd: 2023-05-21, grossPay: 56500.00, frequency: other, periodDays: 365 }   # Yr 4
    - { periodStart: 2021-05-22, periodEnd: 2022-05-21, grossPay: 54000.00, frequency: other, periodDays: 365 }   # Yr 5
  serviceEvents:
    - { type: leave_without_pay, startDate: 2023-09-04, endDate: 2023-09-22 }    # 2 of 5 wks unpaid sick in Yr 3
    - { type: leave_without_pay, startDate: 2022-10-03, endDate: 2022-11-04 }    # 3 of 5 wks unpaid sick in Yr 4
trigger: { kind: taking_leave, leaveStartDate: 2026-05-22 }
```

**Expected output**

```yaml
category: B
value_of_week_12mo: 1160.27               # $37.50 × (1613.33 / 365) × 7 — PDF p.20
value_of_week_5yr:  1125.63               # (60500+60000+57000+56500+54000)/(1826−35) × 7 — PDF p.20
value_of_week:      1160.27               # 12mo > 5yr — PDF p.20: "as the 12 month average is the higher"
value_of_day:       232.05                # 1160.27 / 5
total_entitlement_weeks: 3.0000           # taking 3 weeks per request
total_entitlement_dollars: 3480.81        # PDF p.20 verbatim: "$1,160.27 × 3 = $3,480.81"
expected_citations:
  - { section: NSW LSA s.4(5)(c), rule: value-of-week.B.12mo-greater-of,   pdfPage: 20 }
  - { section: NSW LSA s.4(5),    rule: lookback.days-not-counted.lwop,    pdfPage: 19 }
  - { section: NSW LSA s.4(7),    rule: trigger.taking-leave.payable,      pdfPage: 24 }
system_formula_value: 3490.38           # F21 formula: current_weekly_gross × entitlement_weeks = $1,163.46 × 3 (per spec v0.5.0 §2 — weeks-based, not hours)
variance:                -9.57           # legislated $3,480.81 − system $3,490.38 — system slightly OVER for this case
```

**Notes**

`currentWeeklyGross` is TBD because Category B's current-rate formula is `hourly × (hours/days × 7)`, not a stable weekly figure — the engine MUST accept `currentHourlyRate + hoursLast12Months` and compute. PM to confirm UI presents these as separate inputs (per F8 + impl-plan §3.3 fall-through caveat).

The two LWOP service events sum to 35 days, matching the PDF's `1826 − 35 = 1791` denominator.

---

### TC-NSW-008 — Liam, 12-yr casual, varied hours — TAKING 3 DAYS (value-of-day)

- **Source**: PDF p.24 "Working Out Leave Taken in Weeks for 1 day - Varied Hours" (Liam, 3-day variant)
- **Category**: Category B — value-of-day arithmetic
- **Why it matters**: Backs F12 value_of_day output for varied-hours casuals; the underlying day-in-weeks formula per Clause 4A(3B).

**Inputs**

Same `Employee` as TC-NSW-007 except `hoursLast12Months = 1560` and PDF supplies *days* per year as Part B (Hours = Part A):

```yaml
hours_part_a:
  yr1: 1560, yr2: 1300, yr3: 1450, yr4: 675, yr5: 804  # 12mo: 29.92 hrs/wk; 5yr: 22.63 hrs/wk
days_part_b:
  yr1: 208,  yr2: 173,  yr3: 194,  yr4: 90,  yr5: 108  # 12mo: 3.99 days/wk; 5yr: 3.02 days/wk
service_events:
  - leave_without_pay × 5 weeks (35 days) across yrs 3 & 4
trigger: { kind: taking_leave, leaveStartDate: 2026-05-22 }
leave_amount: 3 days
```

**Expected output**

```yaml
category: B
hours_12mo_per_week: 29.92                 # 1560 / 365 × 7 — PDF p.24
days_12mo_per_week:  3.99                  # 208 / 365 × 7 — PDF p.24
value_of_day_in_hours: 7.4987              # 29.92 / 3.99 — PDF p.24
value_of_day_in_weeks: 0.2506              # 7.4987 / 29.92 — PDF p.24
leave_taken_in_weeks:  0.7518              # 0.2506 × 3 — PDF p.24
expected_citations:
  - { section: NSW LSA s.4(5)(c),       rule: value-of-week.B.12mo-greater-of,    pdfPage: 24 }
  - { section: NSW LSA Clause 4A(3B),   rule: value-of-day.formula-A-over-B,      pdfPage: 23 }
```

**Notes**

Tests the dollarised payout = `0.7518 × current_weekly_gross`. PDF p.24 only computes `Leave Entitlement Remaining = 8.6667 − 0.7518 = 7.9149`. Engine MUST emit both the weeks-taken figure AND the dollar amount; the dollar amount falls out from TC-NSW-007's value-of-week × 0.7518 (per the gold-standard fixture file).

---

### TC-NSW-009 — Rinaldo, 11-yr Category C piece worker

- **Source**: PDF p.21 "Otherwise Wholly Remunerated in Relation to a Fixed Rate of Pay Example" (Rinaldo)
- **Category**: Category C
- **Why it matters**: Verbatim PDF — backs F8 Category C "greater of (12mo avg, 5yr avg)" on gross-only inputs.

**Inputs**

```yaml
employee:
  id: TC-NSW-009
  legalName: Rinaldo
  startDate: 2015-05-21
  employmentType: full_time            # but varied rate → Category C
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentWeeklyGross: 1373.15
  wageHistory:
    - { periodStart: 2025-05-22, periodEnd: 2026-05-21, grossPay: 71600.00, frequency: other, periodDays: 365 }
    - { periodStart: 2024-05-22, periodEnd: 2025-05-21, grossPay: 75000.00, frequency: other, periodDays: 366 }
    - { periodStart: 2023-05-22, periodEnd: 2024-05-21, grossPay: 69997.00, frequency: other, periodDays: 365 }
    - { periodStart: 2022-05-22, periodEnd: 2023-05-21, grossPay: 75102.00, frequency: other, periodDays: 365 }
    - { periodStart: 2021-05-22, periodEnd: 2022-05-21, grossPay: 68363.00, frequency: other, periodDays: 365 }
  serviceEvents: []
trigger: { kind: taking_leave, leaveStartDate: 2026-05-22 }
```

**Expected output**

```yaml
category: C
value_of_week_12mo: 1373.15                 # 71600 / 365 × 7 — PDF p.21
value_of_week_5yr:  1380.30                 # 360062 / 1826 × 7 — PDF p.21
value_of_week:      1380.30                 # 5yr > 12mo — PDF p.21: "as the 5-year average of $1,380.30 is higher"
value_of_day:       276.06
total_entitlement_weeks: 9.5333             # 11 × 8.6667/10
total_entitlement_dollars: 13157.46         # 9.5333 × 1380.30
expected_citations:
  - { section: NSW LSA s.4(5)(d), rule: value-of-week.C.5yr-greater-of, pdfPage: 21 }
```

**Notes**

PDF p.21 stops at value-of-week; total derived as `9.5333 × $1,380.30 = $13,157.46`. PM to confirm leave amount taken (PDF does not state); test fixture assumes "full remaining entitlement" — adjust if PM wants a partial draw.

---

### TC-NSW-010 — Walid, apprentice → tradesperson within 12 months

- **Source**: PDF p.14 "Apprenticeship" Example (Walid)
- **Category**: Category A — continuous service preservation
- **Why it matters**: Backs F9 (apprentice→trade transition preserves prior service); research brief §5.10.

**Inputs**

```yaml
employee:
  id: TC-NSW-010
  legalName: Walid
  startDate: 2018-07-01           # original apprenticeship start
  employmentType: full_time
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentWeeklyGross: 1800.00
  wageHistory:
    - { periodStart: 2018-07-01, periodEnd: 2024-06-30, grossPay: 374400.00, frequency: weekly }  # apprentice years
    - { periodStart: 2024-10-01, periodEnd: 2026-05-21, grossPay: 156000.00, frequency: weekly }  # tradesperson years
  serviceEvents:
    - type: apprentice_to_tradesperson_transition
      startDate: 2024-06-30      # apprenticeship end
      endDate:   2024-10-01      # re-employed as tradesperson (within 12 months ⇒ counts)
      note: "Walid (PDF p.14): apprenticeship ceases 30/6/24, returns 1/10/24 as qualified tradesperson — re-employed within 12 months"
trigger: { kind: as_at, asAtDate: 2026-05-21 }
```

**Expected output**

```yaml
category: A
prior_apprentice_service_preserved: true
years_of_continuous_service: 7.6411       # 2018-07-01 → 2026-05-21 less 93-day gap
total_entitlement_weeks: 6.6219           # snapshot (D20 — no pro-rata threshold applied in as_at)
value_of_week: 1800.00
total_entitlement_dollars: 11919.42
expected_citations:
  - { section: NSW LSA s.4(11), rule: continuous-service.apprentice-to-trade-within-12mo, pdfPage: 14 }
  - { section: NSW LSA s.4(2),  rule: accrual.snapshot.no-pro-rata-threshold,             pdfPage: 13, note: "as-at snapshot per D20 / F11" }
```

**Notes**

PDF stipulates the apprentice→trade transition with re-employment within 12 months preserves the apprentice service. The 93-day gap between roles is NOT counted as service per the PDF (only the prior apprentice service is preserved, the gap itself does not count). PM to confirm presentation: snapshot says "accrued so far including preserved apprentice service".

---

### TC-NSW-011 — Candice, casual marked NA'd for 1 week

- **Source**: PDF p.15 Example 1 (Candice)
- **Category**: Category B — casual gap handling
- **Why it matters**: Establishes that worker-initiated unavailability is excluded from BOTH service AND average-hours denominator (contrast WC and JobKeeper).

**Inputs**

```yaml
employee:
  id: TC-NSW-011
  legalName: Candice
  startDate: 2016-05-21
  employmentType: casual
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentHourlyRate: 38.00
  hoursLast12Months: 1456    # 28 hrs/wk for 52 wks
  wageHistory:
    - { periodStart: 2025-05-22, periodEnd: 2026-05-21, grossPay: 55328.00, frequency: other, periodDays: 358 }  # 365 - 7 days NA'd
  serviceEvents:
    - { type: leave_without_pay, startDate: 2026-05-01, endDate: 2026-05-08, note: "Worker self-declared NA'd — PDF p.15" }
trigger: { kind: as_at, asAtDate: 2026-05-21 }
```

**Expected output**

```yaml
category: B
days_in_lookback: 358
value_of_week_12mo: 1064.00      # $38 × (1456 / 358) × 7
days_not_counted_in_service: 7
expected_citations:
  - { section: NSW LSA s.4(11), rule: continuous-service.worker-initiated-na-excluded, pdfPage: 15 }
  - { section: NSW LSA s.4(5),  rule: lookback.days-not-counted.outside-pattern,        pdfPage: 19 }
```

**Notes**

PDF p.15 verbatim: "Time off will not count towards service, and is not included in her average hours calculation." This is the key contrast with TC-NSW-005 (WC counts as service; excluded only from hours denominator) and TC-NSW-013 (JobKeeper counts as service; excluded from hours).

---

### TC-NSW-012 — Ying, voluntary resignation + 6-wk gap + rehire (service resets)

- **Source**: PDF p.16 "Terminated and Re-employed" Example 1 (Ying)
- **Category**: Negative test — service reset on voluntary resignation
- **Why it matters**: Backs F9 "Employee voluntary resignation MUST reset prior service to zero"; AC7 boundary.

**Inputs**

```yaml
employee:
  id: TC-NSW-012
  legalName: Ying
  startDate: 2019-04-15        # original start
  rehireDate: 2025-12-01       # re-instatement after 6-wk voluntary gap
  employmentType: full_time
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentWeeklyGross: 1600.00
  wageHistory:
    - { periodStart: 2025-12-01, periodEnd: 2026-05-21, grossPay: 38400.00, frequency: weekly }   # post-rehire only
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-21, reason: voluntary_resignation }
```

**Expected output**

```yaml
category: A
service_start_used: 2025-12-01           # PDF p.16: "her service will start from her re-instatement date, as Ying resigned"
years_of_continuous_service: 0.4712
total_entitlement_weeks: 0.0000
total_entitlement_dollars: 0.00
expected_citations:
  - { section: NSW LSA s.4(11), rule: continuous-service.voluntary-resignation-resets, pdfPage: 16 }
  - { section: NSW LSA s.4(2),  rule: accrual.less-than-5-yrs-no-entitlement,          pdfPage: 25 }
```

**Notes**

Engine MUST recognise that the employee's UI-supplied `startDate: 2019-04-15` is not the load-bearing date when prior resignation is on file — the rehire date overrides. PM to confirm UI exposes this clearly (workflow: `Employee.startDate` is original date for display; `serviceEvents` of type `employer_initiated_termination_and_rehire` is the marker for *preserving* prior service. Absent that event, voluntary resignation defaults to "reset" — confirmed by PM before Phase 1).

---

### TC-NSW-013 — Vince, employer-initiated termination + 4-wk gap + rehire (service preserved)

- **Source**: PDF p.16 "Terminated and Re-employed" Example 2 (Vince)
- **Category**: Category A — continuous service preservation
- **Why it matters**: Backs F9 "gap ≤ 2 months after employer-initiated termination preserves prior service"; research brief §5.7.

**Inputs**

```yaml
employee:
  id: TC-NSW-013
  legalName: Vince
  startDate: 2015-04-01
  employmentType: full_time
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentWeeklyGross: 1700.00
  wageHistory:
    - { periodStart: 2015-04-01, periodEnd: 2026-03-15, grossPay: 938400.00, frequency: weekly }   # pre-termination
    - { periodStart: 2026-04-12, periodEnd: 2026-05-21, grossPay: 10200.00,  frequency: weekly }   # post-rehire
  serviceEvents:
    - type: employer_initiated_termination_and_rehire
      startDate: 2026-03-15
      endDate:   2026-04-12
      note: "Vince (PDF p.16): terminated 15/3/26 by employer for poor performance, rehired 12/4/26 in sales role"
trigger: { kind: as_at, asAtDate: 2026-05-21 }
```

**Expected output**

```yaml
category: A
prior_service_preserved: true
years_of_continuous_service: 11.0805       # 2015-04-01 → 2026-05-21 less 28-day gap
days_not_counted_in_service: 28            # gap doesn't count toward service
total_entitlement_weeks: 9.6031            # snapshot accrual
value_of_week: 1700.00
total_entitlement_dollars: 16325.27
expected_citations:
  - { section: NSW LSA s.4(11), rule: continuous-service.employer-init-rehire-within-2mo, pdfPage: 16 }
  - { section: NSW LSA s.4(2),  rule: accrual.snapshot.no-pro-rata-threshold,             pdfPage: 13 }
```

**Notes**

The PDF emphasises "the period of 4 weeks will not count towards service." This is the contrast pair with TC-NSW-012 (Ying) and TC-NSW-014 (Renuka).

---

### TC-NSW-014 — Renuka, redundancy + 3-month gap (service NOT preserved)

- **Source**: PDF p.16 "Terminated and Re-employed" Example 3 (Renuka)
- **Category**: Negative test — gap > 2 months breaks service
- **Why it matters**: NSW's 2-month cap on employer-initiated re-hire (contrast VIC 12 wks, QLD/TAS 3 mo per research brief §2).

**Inputs**

```yaml
employee:
  id: TC-NSW-014
  legalName: Renuka
  startDate: 2014-07-15
  employmentType: full_time
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentWeeklyGross: 1900.00
  wageHistory:
    - { periodStart: 2026-02-22, periodEnd: 2026-05-21, grossPay: 24700.00, frequency: weekly }   # post-rehire only
  serviceEvents:
    - type: employer_initiated_termination_and_rehire
      startDate: 2025-11-22       # redundancy
      endDate:   2026-02-22       # rehired 3 mo later — too long
trigger: { kind: as_at, asAtDate: 2026-05-21 }
```

**Expected output**

```yaml
category: A
prior_service_preserved: false                   # gap > 2 months in NSW
service_start_used: 2026-02-22
years_of_continuous_service: 0.2410
total_entitlement_weeks: 0.2089                  # snapshot
value_of_week: 1900.00
total_entitlement_dollars: 397.00
warnings:
  - { code: gap_exceeds_2mo, message: "Employer-initiated re-hire gap exceeded 2 months — NSW prior service not preserved" }
expected_citations:
  - { section: NSW LSA s.4(11), rule: continuous-service.gap-exceeds-2mo-breaks-service, pdfPage: 16 }
```

**Notes**

PDF p.16 verbatim: "her prior service is not recognised as she is returning after 2 months." Engine MUST emit the warning even though the calculation succeeds. PM to confirm UI surfaces "prior service lost" prominently.

---

### TC-NSW-015 — Raj, transfer of business preserves service

- **Source**: PDF p.16 "Transfer of Service / Sale of a Business" Example (Raj)
- **Category**: Category A — continuous service preservation
- **Why it matters**: AC23-adjacent — backs F9 transmission-of-business rule (NSW LSA s.4(6)); research brief §5.4.

**Inputs**

```yaml
employee:
  id: TC-NSW-015
  legalName: Raj
  startDate: 2014-05-21            # original start with Allambie Software
  employmentType: full_time
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentWeeklyGross: 2100.00
  wageHistory:
    - { periodStart: 2014-05-21, periodEnd: 2026-05-21, grossPay: 1310400.00, frequency: weekly }
  serviceEvents:
    - type: transfer_of_business
      startDate: 2021-07-01
      note: "Allambie Software sold to Tech Kings; Raj continues in same role"
trigger: { kind: as_at, asAtDate: 2026-05-21 }
```

**Expected output**

```yaml
category: A
years_of_continuous_service: 12.0000
total_entitlement_weeks: 10.4000
value_of_week: 2100.00
total_entitlement_dollars: 21840.00
expected_citations:
  - { section: NSW LSA s.4(6),  rule: continuous-service.transfer-of-business-preserves, pdfPage: 16 }
  - { section: NSW LSA s.4(11), rule: continuous-service.deemed-continuous,              pdfPage: 16 }
```

**Notes**

The fixture has the same employer-of-record for the entire payroll history because employer identity isn't in the v1 input model — what matters is the `transfer_of_business` event marker. PM to confirm wording on the UI ("did this employee come from a sold business?").

---

### TC-NSW-016 — Value-of-day, FT 38h/wk over 5 days (standard formula)

- **Source**: PDF p.23 Value-of-Day Example 1 (38 / 5 = 7.6 hrs/day)
- **Category**: Category A — value-of-day math
- **Why it matters**: Sanity-test for F12 "value of a day" = value_of_week / 5 for standard FT.

**Inputs**

```yaml
employee: { id: TC-NSW-016, employmentType: full_time, normalWeeklyHours: 38, daysWorkedPerWeek: 5, currentWeeklyGross: 1900.00, /* ... 10-yr stable */ }
trigger:  { kind: as_at, asAtDate: 2026-05-21 }
```

**Expected output**

```yaml
value_of_day_in_hours: 7.6           # 38 / 5 — PDF p.23
value_of_day_in_weeks: 0.2           # 7.6 / 38 — PDF p.23
value_of_day_dollars: 380.00         # value_of_week / 5
expected_citations:
  - { section: NSW LSA Clause 4A,  rule: value-of-day.fixed-rate-fixed-hours.formula, pdfPage: 23 }
```

**Notes**

Synthetic case; what's load-bearing is the formula not the wage figure. Use this as the canary for the value-of-day implementation.

---

### TC-NSW-017 — Value-of-day, PT 22.8h/wk over 3 days

- **Source**: PDF p.23 Value-of-Day Example 2 (22.8 / 3 = 7.6 hrs/day)
- **Category**: Category A — value-of-day math (part-time variant)
- **Why it matters**: Confirms part-time 3-day-week conversion: 1 day of LSL = 0.3333 weeks.

**Inputs**

Same `Employee` as TC-NSW-006 (Michelle) but reduced to value-of-day fixture.

**Expected output**

```yaml
value_of_day_in_hours: 7.6           # 22.8 / 3 — PDF p.23
value_of_day_in_weeks: 0.3333        # 7.6 / 22.8 — PDF p.23
```

**Notes**

Per p.23, the PT case has a *different* value-of-day-in-weeks than FT (0.3333 vs 0.2). Engine MUST NOT hard-code "÷5".

---

### TC-NSW-018 — Public holiday during LSL extends leave by 1 day (Jan-24 example)

- **Source**: PDF p.17 "Are Public Holidays Included in the LSL Taken?" Example
- **Category**: Single mode — `taking_leave` trigger edge
- **Why it matters**: Backs F14 / s.4(4A) — PH during LSL is **exclusive**.

**Inputs**

```yaml
employee: { id: TC-NSW-018, /* FT 10-yr employee */ }
trigger:
  kind: taking_leave
  leaveStartDate: 2024-01-24    # Wed
  leaveDays: 5                   # Wed 24, Thu 25, Mon 29, Tue 30, +1 PH bump
  publicHolidaysInWindow: [2024-01-26]   # Australia Day (Friday)
```

**Expected output**

```yaml
lsl_days_consumed: 4             # Wed, Thu, Mon, Tue — Fri is PH so not counted
calendar_leave_end_date: 2024-01-30
expected_citations:
  - { section: NSW LSA s.4(4A), rule: trigger.taking-leave.public-holiday-exclusive, pdfPage: 17 }
```

**Notes**

This is a service-level test, not a dollar test. PDF p.17 calendar example: leave 24-Jan to 30-Jan, only LSL on the 24, 25, 29, 30 (Friday 26 is PH). Engine MUST treat the `publicHolidaysInWindow` array as authoritative (no built-in holiday calendar in v1; user provides).

---

### TC-NSW-019 — Stand-down due to slackness (no service, no break)

- **Source**: PDF p.14 "Does not Count" table — "Stood down due to slackness of trade"; PDF p.31 Matrix
- **Category**: Category A — continuous service rule
- **Why it matters**: Establishes the slackness-stand-down rule: doesn't break service, doesn't count toward it.

**Inputs**

```yaml
employee:
  id: TC-NSW-019
  legalName: SlacknessFixture
  startDate: 2014-05-21
  employmentType: full_time
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentWeeklyGross: 1600.00
  wageHistory:
    - { periodStart: 2014-05-21, periodEnd: 2026-05-21, grossPay: 998400.00, frequency: weekly }
  serviceEvents:
    - { type: employer_stand_down, startDate: 2024-03-01, endDate: 2024-05-01 }   # 61 days
trigger: { kind: as_at, asAtDate: 2026-05-21 }
```

**Expected output**

```yaml
years_of_continuous_service: 11.8329     # 12 elapsed − 61 days slackness
total_entitlement_weeks: 10.2553
expected_citations:
  - { section: NSW LSA s.4(11), rule: continuous-service.slackness-no-service-no-break, pdfPage: 14 }
```

**Notes**

Contrast pair with TC-NSW-046 (JobKeeper — also a stand-down but DOES count as service for casuals per research brief §1.4 / PDF p.15 row). PM to verify the slackness/JobKeeper distinction is preserved (PDF treats them differently: slackness=no-count, JobKeeper-direction=counts).

---

## §B — PDF Practice Activities (pp.27–29)

### TC-NSW-020 — Practice 1(A): Kate, FT 13.5 yrs, $2,000/wk + bonus (bonus is v1-out)

- **Source**: PDF p.27 Practice Activity 1(A) (Kate)
- **Category**: Category A
- **Why it matters**: Verbatim PDF practice — backs F8 Category A; tests v1 gross-only scope handling of bonus-bearing examples.

**Inputs**

```yaml
employee:
  id: TC-NSW-020
  legalName: Kate
  startDate: 2012-11-21         # 13.5 yrs to 2026-05-21
  employmentType: full_time
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentWeeklyGross: 2000.00   # PDF: "$2,000/wk current rate, higher than 5yr avg"
  normalWeeklyHours: 38
  wageHistory:
    - { periodStart: 2012-11-21, periodEnd: 2026-05-21, grossPay: 1404000.00, frequency: weekly }
  serviceEvents: []
trigger: { kind: taking_leave, leaveStartDate: 2026-05-22 }
leaveWeeks: 5
```

**Expected output (v1 — no bonus)**

```yaml
category: A
years_of_continuous_service: 13.5000
total_entitlement_weeks_full: 11.7000     # 13.5 × 8.6667/10
value_of_week: 2000.00                     # PDF: current > 5yr avg
value_of_day: 400.00
leave_taken_dollars: 10000.00              # 5 × 2000
expected_citations:
  - { section: NSW LSA s.4(2),    rule: accrual.10yr-plus.any-reason,    pdfPage: 13 }
  - { section: NSW LSA s.4(5)(b), rule: value-of-week.A.current-wins,    pdfPage: 18 }
```

**Notes — bonus inclusion is v1-out**

PDF gives bonus = $15,600 in 12 mo → adds $15,600/365×7 = $299.18/wk to make $2,299.18/wk × 5 wks = $11,495.90. v1 gross-only scope (Clarification Summary §2 / spec PM-directed scope) excludes bonus-vs-HIT logic, so the v1 expected payout is the no-bonus value. `expected: TBD — PM confirm` whether the test fixture should reject Kate as "bonus included = not v1-supported" with a warning, OR proceed with the no-bonus path silently. Recommended: warning surfaced if `wageHistory.notes` mention "bonus" / "incentive".

---

### TC-NSW-021 — Practice 1(B): Josephine, PT 7-yr redundancy + 1-yr UPL 6 yrs ago

- **Source**: PDF p.28 Practice Activity 1(B) (Josephine)
- **Category**: Category A — pro-rata on redundancy at 5-to-<10 yrs WITH historical UPL
- **Why it matters**: Backs AC8 + research brief §5.3 (PT stable hours with historical UPL).

**Inputs**

```yaml
employee:
  id: TC-NSW-021
  legalName: Josephine
  startDate: 2018-05-22         # 7 yrs continuous service excluding 1 yr UPL = 8 yrs elapsed
  endDate: 2026-05-21
  employmentType: part_time
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentWeeklyGross: 750.00    # PDF: "$750/wk ($30/hr)"
  normalWeeklyHours: 25
  wageHistory:
    - { periodStart: 2021-05-22, periodEnd: 2026-05-21, grossPay: 188500.00, frequency: other, periodDays: 1826 }   # PDF: "5 yrs (1,826 days): $188,500"
  serviceEvents:
    - { type: unpaid_parental_leave, startDate: 2020-05-22, endDate: 2021-05-22, note: "1 yr UPL 6 yrs ago" }
trigger: { kind: termination, terminationDate: 2026-05-21, reason: redundancy }
```

**Expected output**

```yaml
category: A
years_of_continuous_service: 7.0000             # 8 elapsed − 1 UPL
days_not_counted_in_lookback: 0                  # UPL is outside the 5-yr window
total_entitlement_weeks: 6.0667                 # 7 × 8.6667/10
value_of_week_current: 750.00
value_of_week_5yr_avg:  722.45                  # 188500 / 1826 × 7
value_of_week:          750.00                  # current wins
value_of_day:           150.00                  # 750 / 5 (NB: PT 25h/5d = 5h/day)
total_entitlement_dollars: 4550.03              # 6.0667 × 750
expected_citations:
  - { section: NSW LSA s.4(2)(iii)(a), rule: accrual.pro-rata.5-to-10.redundancy, pdfPage: 25 }
  - { section: NSW LSA s.4(5)(b),      rule: value-of-week.A.current-wins,        pdfPage: 18 }
  - { section: NSW LSA s.4(11),        rule: continuous-service.upl-excluded,     pdfPage: 14 }
```

**Notes**

Critical edge case — service tenure of 8 elapsed years collapses to 7 yrs of continuous service, which JUST clears the 5-yr threshold. If the engine mis-applied UPL to also shrink the lookback window (it shouldn't — UPL was 6 years ago, outside the 5-yr window), the 5-yr-avg denominator would shift. PM to confirm displayed `years_of_continuous_service` is the post-UPL figure.

---

### TC-NSW-022 — Practice 1(C): Bevan, 16-yr casual resigned, 9 wks taken

- **Source**: PDF p.29 Practice Activity 1(C) (Bevan)
- **Category**: Category B
- **Why it matters**: Verbatim PDF practice — 10+ yr casual resignation with prior leave drawdown; backs Category B greater-of test on real wage figures.

**Inputs**

```yaml
employee:
  id: TC-NSW-022
  legalName: Bevan
  startDate: 2010-05-22
  endDate: 2026-05-21
  employmentType: casual
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentHourlyRate: 40.00
  hoursLast12Months: 1664
  wageHistory:
    - { periodStart: 2025-05-22, periodEnd: 2026-05-21, grossPay: 66560.00,  frequency: other, periodDays: 365 }
    - { periodStart: 2021-05-22, periodEnd: 2026-05-21, grossPay: 345792.23, frequency: other, periodDays: 1826 }
  serviceEvents:
    - { type: paid_leave, startDate: 2023-06-01, endDate: 2023-08-04, note: "9 wks paid LSL previously taken" }
trigger: { kind: termination, terminationDate: 2026-05-21, reason: voluntary_resignation }
```

**Expected output**

```yaml
category: B
years_of_continuous_service: 16.0000
gross_entitlement_weeks: 13.8667                 # 16 × 8.6667/10
less_leave_taken_weeks: 9.0000
total_entitlement_weeks: 4.8667
value_of_week_12mo: 1276.49                      # $40 × (1664/365) × 7
value_of_week_5yr:  1325.36                      # 345792.23 / 1826 × 7
value_of_week:      1325.36                      # 5yr > 12mo
value_of_day:       265.07                       # 1325.36 / 5
total_entitlement_dollars: 6451.51               # 4.8667 × 1325.36
expected_citations:
  - { section: NSW LSA s.4(2),    rule: accrual.10yr-plus.any-reason,            pdfPage: 13 }
  - { section: NSW LSA s.4(5)(c), rule: value-of-week.B.5yr-greater-of,          pdfPage: 19 }
  - { section: NSW LSA s.4(5)(a), rule: trigger.termination.forthwith,           pdfPage: 26 }
```

**Notes**

PDF practice page is intentionally blank (a quiz). Expected values derived per the PDF p.19 formulas. Engine output must match the worked answer to within the AUD half-up rounding rule. PM to spot-check the value-of-week computations independently as part of sign-off.

---

## §C — PDF System vs Manual (pp.139–141) — LOAD-BEARING

> These three cases are the headline business-case examples and the *direct* basis for AC6 / AC25 / SC3 ($9,880.04 ± $0.00). A regression on any of them fails CI per AC24.

### TC-NSW-023 — 10-yr NSW casual, system formula over-pays by $179.99

- **Source**: PDF p.139–140 "Example 1" (10-yr NSW casual @ $28/hr)
- **Category**: Category B — system-formula variance check
- **Why it matters**: F21 / AC12 — backs the variance display; calibrates the +$179.99 over-payment surface.

**Inputs**

```yaml
employee:
  id: TC-NSW-023
  legalName: SysVsManual-Ex1
  startDate: 2016-05-22
  endDate:   2026-05-21
  employmentType: casual
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentHourlyRate: 28.00
  hoursLast12Months: 1038        # PDF: "1038 hours / 52 weeks = 19.9615 hrs/wk"
  wageHistory: # PDF gives monthly hours grid; encoded as 10 yearly periods (sum of months)
    - { periodStart: 2025-05-22, periodEnd: 2026-05-21, grossPay: 29064.00, frequency: other, periodDays: 365 }   # Yr 10: 1038 hrs × $28
    - { periodStart: 2024-05-22, periodEnd: 2025-05-21, grossPay: 39998.76, frequency: other, periodDays: 366 }   # Yr 9
    - { periodStart: 2023-05-22, periodEnd: 2024-05-21, grossPay: 32144.00, frequency: other, periodDays: 365 }   # Yr 8
    - { periodStart: 2022-05-22, periodEnd: 2023-05-21, grossPay: 29064.00, frequency: other, periodDays: 365 }   # Yr 7
    # ... (years 1-6 follow same pattern per PDF)
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-21, reason: voluntary_resignation }
```

**Expected output**

```yaml
category: B
total_entitlement_weeks: 8.6667                   # 10 × 8.6667/10 — PDF p.140
value_of_week_12mo: 558.92                        # 1038/52 × 28 — PDF p.139
value_of_week_5yr:  614.64                        # 5707.34/52/5 × 28 — PDF p.139
value_of_week:      614.64                        # 5yr > 12mo
total_entitlement_dollars: 5326.90                # 8.6667 × 614.64 — PDF p.140 verbatim

# System-formula comparison (F21 / AC12)
system_formula_value: 5506.89                     # 11,800.02 hrs / 10 yrs / 52 wks × 8.667 wks × $28 — PDF p.139
variance: -179.99                                  # system overpays by $179.99
variance_label: "system overpays by $179.99 (3.4%)"

expected_citations:
  - { section: NSW LSA s.4(2),    rule: accrual.10yr-milestone,                     pdfPage: 139 }
  - { section: NSW LSA s.4(5)(c), rule: value-of-week.B.5yr-greater-of,             pdfPage: 140 }
  - { section: NSW LSA s.4(5)(a), rule: trigger.termination.forthwith,              pdfPage: 26 }
```

**Notes**

PDF p.139–140 give the answer end-to-end at high precision. The 12-month hours = 1,038 and 5-year hours = 5,707.34 are PDF verbatim. Engine MUST emit BOTH the legislated total ($5,326.90) AND the system-formula comparison ($5,506.89) per F21. The variance line is the wedge.

---

### TC-NSW-024 — 12-yr casual-to-FT transition, $9,880.04 EXACT (SC3)

- **Source**: PDF p.140–141 "Example 2" (12-yr casual-to-FT @ years 11-12)
- **Category**: Category A (FT in final 2 yrs — 5yr avg dominates)
- **Why it matters**: **AC6 / AC25 / SC3** — exact $9,880.04 ± $0.00; single failing case blocks deploy.

**Inputs**

```yaml
employee:
  id: TC-NSW-024
  legalName: SysVsManual-Ex2
  startDate: 2014-05-22
  endDate:   2026-05-21
  employmentType: full_time        # FT at termination per PDF
  employmentTypeHistory:           # not in v1 schema — surfaced via classifier as Category A
    - { from: 2014-05-22, to: 2024-05-21, type: casual }
    - { from: 2024-05-22, to: 2026-05-21, type: full_time }
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentHourlyRate: 25.00          # PDF p.140: "current hourly rate is $25.00"
  currentWeeklyGross: 950.00        # PDF p.140: "$25 × 38 hrs = $950"
  normalWeeklyHours: 38
  wageHistory: # Years 1-10 casual hours grid + Years 11-12 FT @ 164.67 hrs/mo = 1976 hrs/yr
    - { periodStart: 2025-05-22, periodEnd: 2026-05-21, grossPay: 49400.00, frequency: weekly, note: "Yr 12 FT" }
    - { periodStart: 2024-05-22, periodEnd: 2025-05-21, grossPay: 49400.00, frequency: weekly, note: "Yr 11 FT" }
    - { periodStart: 2023-05-22, periodEnd: 2024-05-21, grossPay: 29064.00, frequency: other, periodDays: 366, note: "Yr 10 casual" }
    - { periodStart: 2022-05-22, periodEnd: 2023-05-21, grossPay: 39998.76, frequency: other, periodDays: 365, note: "Yr 9 casual" }
    - { periodStart: 2021-05-22, periodEnd: 2022-05-21, grossPay: 32144.00, frequency: other, periodDays: 365, note: "Yr 8 casual" }
    # Years 1-7 omitted from 5-yr lookback (outside window) but in wageHistory for full record
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-21, reason: voluntary_resignation }
```

**Expected output**

```yaml
category: A                                       # PDF: FT at prescribed date → Category A
years_of_continuous_service: 12.0000
total_entitlement_weeks: 10.4000                  # 12 × 8.6667/10 — PDF p.141 verbatim
value_of_week_current: 950.00                     # $25 × 38 — PDF p.140
value_of_week_5yr_avg: 950.00                     # "$525 average pay over the last 5 years" → PDF says "the last pay is the greater of the two, so we will use that"
value_of_week: 950.00                             # current = winner (PDF p.141: "the last pay is the greater")
total_entitlement_dollars: 9880.04                # 10.4000 × 950 — PDF p.141 EXACT

# System-formula comparison (F21 / AC12)
system_formula_value: 6563.40                     # 15,752.10 hrs / 12 yrs / 52 wks × (8.6667 × 12/10) × 25 — PDF p.140
variance: 3316.64                                 # system underpays by $3,316.64 (33.6%)
variance_label: "system underpays by $3,316.64 (33.6%)"

expected_citations:
  - { section: NSW LSA s.4(2),    rule: accrual.10yr-plus.any-reason,         pdfPage: 141 }
  - { section: NSW LSA s.4(5)(b), rule: value-of-week.A.current-wins,         pdfPage: 141 }
  - { section: NSW LSA s.4(5)(a), rule: trigger.termination.forthwith,        pdfPage: 26 }
```

**Notes — DO NOT MODIFY EXPECTED FIGURES**

PDF p.141 verbatim arithmetic: `10.40004 weeks × $950.00 = $9,880.04`. This is the gold-standard "the calculator gets the right answer" case. AC25 requires "$9,880.04 — not $9,880.03 or $9,880.05". The `10.4000` weeks figure comes from PDF p.141 (it shows `10.40004` truncated to 4dp; engine MUST keep full precision internally and round only at display).

Employment-type history (casual→FT mid-tenure) is NOT directly in the v1 `Employee` schema (only `employmentType: 'full_time' | 'part_time' | 'casual'`). PM to confirm: for v1, the user enters current employment type only; the classifier evaluates pay-pattern from wage history (per impl-plan §3.3). Mid-tenure type-changes are out of v1 scope.

---

### TC-NSW-025 — 12-yr casual-to-FT — variant with 1 wk LSL already taken when casual

- **Source**: PDF p.141 trailing variant
- **Category**: Category A
- **Why it matters**: Verbatim PDF — backs the "less leave taken" arithmetic when the prior leave was drawn at a different (casual) rate.

**Inputs**

Same as TC-NSW-024 with prior service event:

```yaml
serviceEvents:
  - { type: paid_leave, startDate: 2023-08-01, endDate: 2023-08-07, note: "1 week LSL taken when casual @ 21.9513 hrs/wk × $25 = $548.78" }
```

**Expected output**

```yaml
gross_entitlement_weeks: 10.4004
less_leave_taken_weeks: 1.0000
total_entitlement_weeks: 9.4004                   # PDF p.141
value_of_week: 950.00
total_entitlement_dollars: 8930.38                # 9.4004 × 950 — PDF p.141 verbatim
expected_citations:
  - { section: NSW LSA s.4(2), rule: accrual.net-of-leave-taken,       pdfPage: 141 }
  # NB: prior leave drawn at the THEN-prescribed-date rate ($548.78) is not "refunded" — the
  # net weeks figure is the engine's output. PDF does not re-evaluate.
```

**Notes**

This case verifies the engine subtracts prior leave taken in WEEKS, not in DOLLARS. The casual-era $548.78 paid out is fully consumed; the remaining 9.4004 weeks are priced at the current rate ($950).

---

### TC-NSW-026 — 12-yr casual-to-FT — bulk-results-table variance display

- **Source**: derived from TC-NSW-024 for the bulk-mode results table
- **Category**: Bulk-mode UX (AC20)
- **Why it matters**: F21 / AC12 — the variance column in `BulkResultsTable` must surface the $3,316.64 wedge.

**Inputs**

Identical to TC-NSW-024 but submitted via the bulk-mode CSV (one-row fixture).

**Expected output**

```yaml
bulk_table_row:
  employee_id: TC-NSW-026
  category: A
  value_of_week: 950.00
  total_entitlement_weeks: 10.4000
  total_entitlement_dollars: 9880.04
  system_formula_value: 6563.40
  variance: 3316.64
  variance_sign: under
  variance_pct: 33.6
  status: computed
expected_citations: (as TC-NSW-024)
```

**Notes**

Ensures the bulk results table renders the variance column with sign and percentage. PM to sign off the sign convention (positive = system pays more = overpayment vs. legislated).

---

## §D — Pay-cycle normalisation (AC4 / F3a)

### TC-NSW-027 — Weekly $5,200, fortnightly $10,400, monthly $22,533.33 all → $5,200/wk

- **Source**: spec AC4 verbatim
- **Category**: Single mode — normalisation
- **Why it matters**: AC4 — three frequencies same underlying income produce the same weekly_gross.

**Inputs (three sibling fixtures, same employee shell)**

```yaml
A: { wageHistory: [ { ..., grossPay: 5200,      frequency: weekly,      periodDays: null } × 52 ] }
B: { wageHistory: [ { ..., grossPay: 10400,     frequency: fortnightly, periodDays: null } × 26 ] }
C: { wageHistory: [ { ..., grossPay: 22533.33,  frequency: monthly,     periodDays: null } × 12 ] }
```

**Expected output**

```yaml
weekly_gross_A: 5200.00
weekly_gross_B: 5200.00
weekly_gross_C: 5200.00
delta_AB: 0.00
delta_AC: <= 0.01   # monthly rounding floor — see Notes
```

**Notes**

AC4 specifies `$22,533.33/month × 12 / 52 = $5,200.0007/wk → $5,200.00 display`. Engine MUST keep unrounded intermediate; round at display per F12. Property-based test (impl-plan §6.4) generalises this.

---

### TC-NSW-028 — "Other" frequency, 28-day period, $20,800 → $5,200/wk

- **Source**: spec F3a "other" branch
- **Category**: Single mode — normalisation
- **Why it matters**: AC4 extension — confirms "other" path with `periodDays`.

**Inputs**

```yaml
wageHistory: [ { periodStart: ..., periodEnd: ..., grossPay: 20800.00, frequency: other, periodDays: 28 } ]
```

**Expected output**

```yaml
weekly_gross: 5200.00      # 20800 × 7 / 28
```

---

### TC-NSW-029 — Mixed-frequency wage history surfaces warning

- **Source**: F3a "Mixed-frequency wage histories MUST be normalised per segment and surface a 'mixed-frequency' warning"
- **Category**: Single mode — normalisation + warning
- **Why it matters**: Backs the mixed-frequency warning UX.

**Inputs**

```yaml
wageHistory:
  - { ..., grossPay: 5200,  frequency: weekly,      periodDays: null } × 26   # first 6 mo
  - { ..., grossPay: 10400, frequency: fortnightly, periodDays: null } × 13   # next 6 mo
```

**Expected output**

```yaml
weekly_gross: 5200.00
warnings:
  - { code: mixed_frequency, message: "Wage history contains 2 distinct pay frequencies; normalised per segment." }
```

---

### TC-NSW-030 — Pay frequency inference confirmation prompt

- **Source**: F3 "The user MUST nominate the pay frequency, or the system MUST infer it from input date gaps and present the inferred value for confirmation"
- **Category**: Single mode — input validation
- **Why it matters**: Backs the inference-confirm UX.

**Inputs**

```yaml
wageHistory: # 52 rows, gaps consistently 7 days
  - { periodStart: 2025-05-22, periodEnd: 2025-05-28, grossPay: 5200.00, frequency: <not supplied> }
  # ...
```

**Expected output**

```yaml
inferred_frequency: weekly
inference_confidence: high
ui_state: awaiting_user_confirmation
```

**Notes**

Unit test for `parsers/csv/single.ts` inference path. PM to sign off the user-facing copy on the confirm dialog.

---

## §E — Trigger handling (taking_leave / termination / as_at)

### TC-NSW-031 — `taking_leave`, single period, payable at commencement

- **Source**: F14 taking_leave + s.4(7)
- **Category**: Single mode — trigger
- **Why it matters**: Backs F14 paid "in the pay period when leave falls" semantics; citation must reference s.4(7).

**Inputs**

```yaml
employee: { /* 10-yr FT, $1500/wk */ }
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01 }
leaveWeeks: 4
```

**Expected output**

```yaml
total_entitlement_weeks: 4.0000
total_entitlement_dollars: 6000.00
payment_timing: "paid in the pay period when leave falls"
expected_citations:
  - { section: NSW LSA s.4(7), rule: trigger.taking-leave.payable-in-pay-period, pdfPage: 24 }
```

---

### TC-NSW-032 — `taking_leave`, split-period attempt REJECTED (v1)

- **Source**: F14 "v1 supports a single LSL period only — split-period support (s.4(3)) is OUT of v1"
- **Category**: Negative
- **Why it matters**: Backs the v1 scope guard for split leave.

**Inputs**

```yaml
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01 }
leavePeriods: [ { weeks: 2 }, { weeks: 2 } ]    # two periods
```

**Expected output**

```yaml
status: rejected
error:
  code: split_leave_not_supported_v1
  userMessage: "Splitting a single LSL request across multiple periods is not supported in v1. Take the leave as one continuous period, or run separate calculations for each period."
```

---

### TC-NSW-033 — `termination, voluntary_resignation`, 7 yrs → $0

- **Source**: AC7
- **Category**: Negative (zero entitlement) — Category A
- **Why it matters**: AC7 verbatim — 7-yr employee voluntary resignation returns $0 with citation to s.4(2)(iii).

**Inputs**

```yaml
employee: { startDate: 2019-05-21, endDate: 2026-05-21, employmentType: full_time, currentWeeklyGross: 1500.00, /* ... */ }
trigger:  { kind: termination, terminationDate: 2026-05-21, reason: voluntary_resignation }
```

**Expected output**

```yaml
total_entitlement_weeks: 0.0000
total_entitlement_dollars: 0.00
expected_citations:
  - { section: NSW LSA s.4(2)(iii), rule: accrual.5-to-10.no-special-reason-no-entitlement, pdfPage: 25 }
```

---

### TC-NSW-034 — `termination, redundancy`, 7 yrs → pro-rata

- **Source**: AC8
- **Category**: Category A — pro-rata on termination
- **Why it matters**: AC8 verbatim — backs s.4(2)(iii)(a) redundancy qualification.

**Inputs**

```yaml
employee: { startDate: 2019-05-21, endDate: 2026-05-21, employmentType: full_time, currentWeeklyGross: 1500.00, /* ... */ }
trigger:  { kind: termination, terminationDate: 2026-05-21, reason: redundancy }
```

**Expected output**

```yaml
total_entitlement_weeks: 6.0667        # 7 × 8.6667/10
value_of_week: 1500.00
total_entitlement_dollars: 9100.05
expected_citations:
  - { section: NSW LSA s.4(2)(iii)(a), rule: accrual.pro-rata.5-to-10.redundancy, pdfPage: 25 }
  - { section: NSW LSA s.4(5)(a),      rule: trigger.termination.forthwith,       pdfPage: 26 }
```

---

### TC-NSW-035 — `termination, death`, 6 yrs → pro-rata; payment to estate

- **Source**: PDF p.25 (death qualifies); s.4(5)(b)
- **Category**: Category A — pro-rata + payment-recipient semantics
- **Why it matters**: Backs s.4(2)(iii)(d) and s.4(5)(b) "estate paid on request" — both must appear in citation block.

**Inputs**

```yaml
employee: { startDate: 2020-05-21, endDate: 2026-05-21, employmentType: full_time, currentWeeklyGross: 1500.00, /* ... */ }
trigger:  { kind: termination, terminationDate: 2026-05-21, reason: death }
```

**Expected output**

```yaml
total_entitlement_weeks: 5.2000        # 6 × 8.6667/10
total_entitlement_dollars: 7800.00
payment_recipient: "estate, on request"
expected_citations:
  - { section: NSW LSA s.4(2)(iii)(d), rule: accrual.pro-rata.5-to-10.death,           pdfPage: 25 }
  - { section: NSW LSA s.4(5)(b),      rule: trigger.termination.estate-on-request,    pdfPage: 26 }
```

---

### TC-NSW-036 — `termination, serious_misconduct`, 12 yrs → still pays out (10+ rule)

- **Source**: PDF p.25 "10+ years — Pro rata amount if employment ends for any reason"
- **Category**: Category A
- **Why it matters**: Edge case — at 10+ yrs the "any reason" rule overrides the serious-misconduct exclusion that applies at 5-to-<10.

**Inputs**

```yaml
employee: { startDate: 2014-05-21, endDate: 2026-05-21, employmentType: full_time, currentWeeklyGross: 1700.00, /* ... */ }
trigger:  { kind: termination, terminationDate: 2026-05-21, reason: serious_misconduct }
```

**Expected output**

```yaml
total_entitlement_weeks: 10.4000        # 12 × 8.6667/10
total_entitlement_dollars: 17680.00
expected_citations:
  - { section: NSW LSA s.4(2)(iii),  rule: accrual.10yr-plus.any-reason-incl-misconduct, pdfPage: 25 }
  - { section: NSW LSA s.4(5)(a),    rule: trigger.termination.forthwith,                pdfPage: 26 }
```

**Notes**

PM to confirm reading: PDF p.25 says "10 Years or more — Pro rata amount if employment ends for **any reason**." Serious misconduct is the canonical exclusion in the 5-to-<10 band but is NOT named as an exclusion at 10+. Engine must NOT apply the 5-to-<10 misconduct exclusion to 10+ yr employees.

---

### TC-NSW-037 — `as_at` snapshot, 6 yrs, accrued value WITHOUT pro-rata thresholds

- **Source**: F11 + D20 — "pro-rata thresholds do NOT apply in as-at mode"
- **Category**: Category A — `as_at` trigger
- **Why it matters**: Spec acceptance: snapshot reports accrued value regardless of whether the employee would actually be paid out today.

**Inputs**

```yaml
employee: { startDate: 2020-05-21, employmentType: full_time, currentWeeklyGross: 1500.00, /* 6 yrs no events */ }
trigger:  { kind: as_at, asAtDate: 2026-05-21 }
```

**Expected output**

```yaml
years_of_continuous_service: 6.0000
total_entitlement_weeks: 5.2000        # 6 × 8.6667/10
value_of_week: 1500.00
total_entitlement_dollars: 7800.00
snapshot_disclaimer: "This is an accrued-value snapshot for liability/audit reporting. The employee is NOT entitled to take or be paid out this value on resignation."
expected_citations:
  - { section: NSW LSA s.4(2),  rule: accrual.snapshot.no-pro-rata-threshold, pdfPage: 13, note: "as-at snapshot per D20 / F11 — pro-rata thresholds NOT applied" }
```

**Notes**

The contrast pair: this 6-yr employee in `as_at` mode shows $7,800 accrued; in `termination, voluntary_resignation` mode they would show $0 (TC-NSW-033 logic at 6 yrs). PM to confirm UI surfaces the snapshot disclaimer prominently (impl-plan §11 item 2).

---

### TC-NSW-038 — `as_at` snapshot, 3 yrs → still reports accrued (no 5-yr floor in as_at)

- **Source**: F11 + D20
- **Category**: Single mode — as-at trigger
- **Why it matters**: Confirms there is no "floor" on as-at snapshot — even sub-5-yr employees have an accrued figure for liability reporting.

**Inputs**

```yaml
employee: { startDate: 2023-05-21, employmentType: full_time, currentWeeklyGross: 1500.00, /* 3 yrs no events */ }
trigger:  { kind: as_at, asAtDate: 2026-05-21 }
```

**Expected output**

```yaml
total_entitlement_weeks: 2.6000        # 3 × 8.6667/10
total_entitlement_dollars: 3900.00
snapshot_disclaimer: (as TC-NSW-037)
```

---

## §F — Continuous-service edge cases (research brief §5)

### TC-NSW-039 — Item 1: Casual with varying hours over 5+ years (Liam pattern)

Covered by TC-NSW-007 / TC-NSW-008. Cross-referenced here.

### TC-NSW-040 — Item 2: Unpaid parental leave >52 wks NSW (days excluded from denominator)

Covered by TC-NSW-006 (Michelle, 52 wks UPL in 5-yr window). Adding boundary variant:

**Inputs**

```yaml
employee: { startDate: 2014-05-21, employmentType: full_time, /* ... */ }
serviceEvents:
  - { type: unpaid_parental_leave, startDate: 2024-05-22, endDate: 2025-08-22, note: "65 wks UPL — exceeds 52 wk PDF example" }
trigger: { kind: as_at, asAtDate: 2026-05-21 }
```

**Expected output**

```yaml
days_not_counted_in_service: 457          # 65 × 7 + 2
days_not_counted_in_lookback: 457
years_of_continuous_service: 10.7479      # 12 elapsed − 457 days
total_entitlement_weeks: 9.3149
expected_citations:
  - { section: NSW LSA s.4(11), rule: continuous-service.upl-excluded.no-cap, pdfPage: 14 }
  - { section: NSW LSA s.4(5),  rule: lookback.days-not-counted.upl,          pdfPage: 19 }
```

**Notes**

Confirms NSW imposes no cap on UPL exclusion (research brief §5.2). The 52-wk number is a PDF illustrative figure, not a legislative cap.

---

### TC-NSW-041 — Item 3: PT stable hours + historical UPL (Josephine pattern)

Covered by TC-NSW-021. Cross-referenced.

### TC-NSW-042 — Item 4: Transfer of business (Raj pattern)

Covered by TC-NSW-015. Cross-referenced.

### TC-NSW-043 — Item 5: Workers Comp absence (Yamala pattern)

Covered by TC-NSW-005. Cross-referenced.

### TC-NSW-044 — Item 7: Employer-init termination + rehire within 2 mo (Vince pattern)

Covered by TC-NSW-013. Boundary variant:

**Inputs**

```yaml
serviceEvents:
  - type: employer_initiated_termination_and_rehire
    startDate: 2026-03-15
    endDate:   2026-05-14         # 60 days = EXACTLY 2 months (boundary)
```

**Expected output**

```yaml
prior_service_preserved: true              # ≤ 2 months
days_not_counted_in_service: 60
warnings:
  - { code: rehire_gap_at_threshold, message: "Re-hire gap is exactly 2 months — at the NSW preservation threshold." }
expected_citations:
  - { section: NSW LSA s.4(11), rule: continuous-service.employer-init-rehire-within-2mo, pdfPage: 16 }
```

**Notes**

PM to confirm "≤2 months" vs "<2 months" interpretation. PDF p.16 wording is "within 2 months" — engine reads as inclusive. The warning is defensive.

---

### TC-NSW-045 — Item 8: Cross-jurisdiction (NSW + VIC) — BLOCKED

- **Source**: F10 + AC23 + research brief §5.8
- **Category**: Negative — cross-jurisdiction block
- **Why it matters**: AC23 verbatim — calculator MUST block; surface the "needs governing jurisdiction nominated" affordance.

**Inputs**

```yaml
employee:
  id: TC-NSW-045
  legalName: CrossJurisdictionFixture
  startDate: 2018-05-21
  employmentType: full_time
  statesOfService: [NSW, VIC]      # multi-select triggers block
  governingJurisdiction: null       # not nominated
  currentWeeklyGross: 1800.00
  wageHistory: [ /* ... */ ]
  serviceEvents: []
trigger: { kind: as_at, asAtDate: 2026-05-21 }
```

**Expected output**

```yaml
status: blocked_cross_jurisdiction
outputs: null
warnings:
  - code: cross_jurisdiction_pending
    message: "Employee has worked in NSW and VIC. Nominate the governing jurisdiction to proceed. (v1 supports NSW only — VIC will be skipped.)"
expected_citations: []
# Bulk mode: this row surfaces separately per AC19 / F6c
```

---

### TC-NSW-046 — Item 11: JobKeeper / COVID stand-down (counts as service, excluded from denom)

- **Source**: PDF p.15 table + research brief §5.11
- **Category**: Category B — casual + JobKeeper
- **Why it matters**: Backs the JobKeeper-counts-as-service distinction; contrast with employer-stand-down (TC-NSW-019).

**Inputs**

```yaml
employee:
  id: TC-NSW-046
  legalName: JobKeeperFixture
  startDate: 2018-03-15
  employmentType: casual
  statesOfService: [NSW]
  governingJurisdiction: NSW
  currentHourlyRate: 38.00
  hoursLast12Months: 1820        # 35 hrs/wk × 52 wks
  wageHistory:
    - { periodStart: 2025-05-22, periodEnd: 2026-05-21, grossPay: 69160.00, frequency: other, periodDays: 365 }
    # Years 2-5 reflect JobKeeper period
    - { periodStart: 2020-04-01, periodEnd: 2020-09-27, grossPay: 0.00,     frequency: other, periodDays: 180, note: "JobKeeper stand-down" }
    # ... other periods normal
  serviceEvents:
    - { type: jobkeeper_or_covid_standdown, startDate: 2020-04-01, endDate: 2020-09-27 }
trigger: { kind: as_at, asAtDate: 2026-05-21 }
```

**Expected output**

```yaml
category: B
service_includes_jobkeeper_days: true       # PDF p.15: "Counts Toward Period of Service? Yes"
lookback_excludes_jobkeeper_days: true      # PDF p.19: "Days subject to JobKeeper direction"
years_of_continuous_service: 8.1808         # 8.18 elapsed — JobKeeper still counts
expected_citations:
  - { section: NSW LSA s.4(11), rule: continuous-service.jobkeeper-counts,          pdfPage: 15 }
  - { section: NSW LSA s.4(5),  rule: lookback.days-not-counted.jobkeeper,          pdfPage: 19 }
```

**Notes**

The dichotomy is the key gotcha: service count includes JobKeeper, lookback denominator excludes it. Same row in two different ledgers.

---

### TC-NSW-047 — Industrial action (does NOT count as service; not in lookback)

- **Source**: PDF p.14 + p.15 — "Industrial action breaks continuous service"
- **Category**: Category A — service exclusion
- **Why it matters**: Distinguishes industrial action from employer stand-down (both don't count toward service but industrial action also doesn't break it per PDF p.14 narrative — engine must treat consistently).

**Inputs**

```yaml
employee: { /* 10-yr FT, $1500/wk */ }
serviceEvents:
  - { type: industrial_action, startDate: 2025-06-01, endDate: 2025-06-08, note: "1 wk strike" }
trigger: { kind: as_at, asAtDate: 2026-05-21 }
```

**Expected output**

```yaml
days_not_counted_in_service: 7
days_not_counted_in_lookback: 7
expected_citations:
  - { section: NSW LSA s.4(11), rule: continuous-service.industrial-action-excluded, pdfPage: 14 }
```

---

## §G — Classifier — A/B/C boundary + ambiguous (D06)

### TC-NSW-048 — Classifier: clean FT 38h/wk → Category A unambiguously

```yaml
inputs: { employmentType: full_time, hours_per_period_stddev: 0, hours_per_period_mean: 38 }
expected: { category: A, ambiguous: false }
```

### TC-NSW-049 — Classifier: casual with CV=0.40 hours → Category B unambiguously

```yaml
inputs: { employmentType: casual, hours_per_period_cv: 0.40 }
expected: { category: B, ambiguous: false }
```

### TC-NSW-050 — Classifier: PT with CV=0.08 hours → Category A but ambiguous (borderline)

```yaml
inputs: { employmentType: part_time, hours_per_period_cv: 0.08 }
expected: { category: A, ambiguous: true, ui_action: show_ClassifierConfirmModal }
```

**Notes**: Per impl-plan §3.3, 0.05 < CV ≤ 0.10 is borderline.

### TC-NSW-051 — Classifier: varied rate detected (gross/hour varies >5%) → Category C

```yaml
inputs: { gross_per_hour_variance_pct: 8.0 }
expected: { category: C, ambiguous: false }
```

---

## §H — Cross-jurisdiction blocking (AC23)

### TC-NSW-052 — Single NSW state → no block (control)

```yaml
inputs: { statesOfService: [NSW], governingJurisdiction: null }
expected: { status: computed, no_block: true }
# Engine infers governingJurisdiction = NSW when only one state supplied.
```

### TC-NSW-053 — NSW nominated as governing for NSW+VIC service → computes as NSW

```yaml
inputs: { statesOfService: [NSW, VIC], governingJurisdiction: NSW }
expected: { status: computed, governing_jurisdiction_used: NSW, warning: "VIC service treated as NSW per user nomination." }
```

---

## §I — Negative / file-validation tests

### TC-NSW-054 — AC27: `.docx` upload rejected at picker

- **Source**: AC27
- **Category**: Negative — file-format gate
- **Inputs**: `WageHistoryUpload` receives a `payroll.docx` file via the file picker.
- **Expected**: file picker accept attribute prevents selection; if forced (programmatic), explicit rejection toast: "Only PDF and CSV files are supported. Excel users should export to CSV."
- **Citations**: spec F5; AC27.

### TC-NSW-055 — AC27: `.xlsx` upload rejected

- **Source**: AC27
- **Inputs**: `payroll.xlsx`
- **Expected**: same as TC-NSW-054.

### TC-NSW-056 — AC28: 60-page PDF rejected with clear message

- **Source**: AC28 + F5 "Reject PDFs above 50 pages"
- **Inputs**: a 60-page PDF (pre-counted client-side via `pdf.js` per D03)
- **Expected**: in-page error: "This PDF has 60 pages. The calculator accepts PDFs up to 50 pages. Please split the file or export to CSV."
- **Citations**: F5; AC28.

### TC-NSW-057 — AC26: LLM extraction service unavailable → routed to CSV within 10s

- **Source**: AC26
- **Inputs**: simulate Anthropic API 503 response on `/api/extract-pdf` POST
- **Expected**:
  - within ≤ 10 seconds: error banner "PDF extraction is temporarily unavailable. Please upload your wage history as CSV. Your other form inputs are preserved."
  - form state preserved (employee details + service events still in localStorage)
  - automatic single retry attempted before surfacing failure (per F5)
- **Citations**: F5; AC26; impl-plan §4.6.

---

# Bulk-mode test cases

### TC-BULK-001 — Mixed 10-employee CSV (NSW only, `as_at` default)

- **Source**: spec SC2 + AC16; impl-plan §6.3 `10-employee-mixed.csv`
- **Category**: Bulk mode
- **Why it matters**: Backs SC7 (bulk results table with citations) and the architectural shape — 10 distinct employees, mixed pay-pattern categories.

**Inputs (CSV — abbreviated)**

```csv
employee_id,row_type,start_date,employment_type,states_of_service,trigger,trigger_date,period_start,period_end,gross_pay,period_frequency,service_event_type,service_event_start,service_event_end
E01,pay_period,2014-05-21,full_time,NSW,as_at,2026-05-21,2025-05-22,2026-05-21,98800.00,weekly,,,        # Cat A — FT 12yr
E02,pay_period,2017-05-21,full_time,NSW,as_at,2026-05-21,...,...,...,weekly,,,                          # Cat A — FT 9yr
E03,pay_period,2014-05-21,part_time,NSW,as_at,2026-05-21,...,...,64220.00,weekly,,,                     # Cat A — PT stable
E04,pay_period,2020-05-21,part_time,NSW,as_at,2026-05-21,...,...,39000.00,weekly,,,                     # Cat A — PT 6yr
E05,pay_period,2015-05-21,casual,NSW,as_at,2026-05-21,2025-05-22,2026-05-21,55000.00,other,,,           # Cat B — casual 11yr
E06,pay_period,2018-05-21,casual,NSW,as_at,2026-05-21,...,...,42500.00,other,,,                         # Cat B — casual 8yr
E07,pay_period,2012-05-21,casual,NSW,as_at,2026-05-21,...,...,68800.00,other,,,                         # Cat B — casual 14yr
E08,pay_period,2014-05-21,full_time,NSW,as_at,2026-05-21,...,...,71600.00,other,,,                      # Cat C — piece worker (Rinaldo-shape)
E09,pay_period,2017-05-21,full_time,NSW,as_at,2026-05-21,...,...,60000.00,other,,,                      # Cat C — commission
E10,pay_period,2010-05-21,full_time,NSW,as_at,2026-05-21,...,...,85000.00,other,,,                      # Cat C — commission 16yr
```

**Expected output (results table — abbreviated)**

```yaml
total_rows: 10
status_breakdown: { computed: 10, blocked: 0, failed: 0 }
processing_time_p95_ms: <= 90000                  # SC7
row_results:
  E01: { category: A, value_of_week: 1900.00, weeks: 10.4000, dollars: 19760.00 }
  E02: { category: A, value_of_week: 1500.00, weeks:  7.8000, dollars: 11700.00 }
  E03: { category: A, value_of_week: 1235.00, weeks: 10.4000, dollars: 12844.00 }   # Michelle pattern
  E04: { category: A, value_of_week:  750.00, weeks:  5.2000, dollars:  3900.00 }
  E05: { category: B, value_of_week: 1100.00, weeks:  9.5333, dollars: 10486.63 }
  E06: { category: B, value_of_week:  850.00, weeks:  6.9333, dollars:  5893.31 }
  E07: { category: B, value_of_week: 1325.36, weeks: 12.1333, dollars: 16081.20 }   # Bevan-shape
  E08: { category: C, value_of_week: 1380.30, weeks: 10.4000, dollars: 14355.12 }   # Rinaldo
  E09: { category: C, value_of_week: 1150.00, weeks:  7.8000, dollars:  8970.00 }
  E10: { category: C, value_of_week: 1630.00, weeks: 13.8667, dollars: 22602.71 }
```

**Notes**

The exact per-row dollar figures are derived from the supplied wage rows; the fixture file is the source of truth for inputs and expected outputs. PM to confirm the distribution (4×A, 3×B, 3×C) — adjust if PM wants different proportions.

The 10-row CSV file lives at `website/src/lib/lsl/states/nsw/__tests__/fixtures/bulk/10-employee-mixed.csv` per impl-plan §6.3.

---

### TC-BULK-002 — Cross-jurisdiction mid-batch (5 employees, 1 blocked)

- **Source**: AC19 + F6c
- **Category**: Bulk mode — partial completion
- **Why it matters**: AC19 verbatim — "A bulk batch with one cross-jurisdiction-blocked employee successfully processes all other employees; the blocked row is surfaced separately."

**Inputs (CSV — abbreviated)**

```csv
employee_id,row_type,start_date,employment_type,states_of_service,trigger,trigger_date,...
X01,pay_period,2014-05-21,full_time,NSW,as_at,2026-05-21,...                # NSW only
X02,pay_period,2016-05-21,full_time,NSW,as_at,2026-05-21,...                # NSW only
X03,pay_period,2015-05-21,full_time,NSW;VIC,as_at,2026-05-21,...            # BLOCKED — multi-state, no governing nominated
X04,pay_period,2018-05-21,casual,NSW,as_at,2026-05-21,...                   # NSW only
X05,pay_period,2010-05-21,part_time,NSW,as_at,2026-05-21,...                # NSW only
```

**Expected output**

```yaml
total_rows: 5
status_breakdown: { computed: 4, blocked: 1, failed: 0 }
row_results:
  X01: { status: computed, /* ... */ }
  X02: { status: computed, /* ... */ }
  X03:
    status: blocked_cross_jurisdiction
    outputs: null
    cta: "Nominate governing jurisdiction (NSW or VIC) — only NSW will calculate in v1"
  X04: { status: computed, /* ... */ }
  X05: { status: computed, /* ... */ }
export_csv_includes_blocked_row: true   # blocked row surfaced separately with status column
```

**Notes**

CSV file at `website/src/lib/lsl/states/nsw/__tests__/fixtures/bulk/cross-jurisdiction-mid-batch.csv`.

---

### TC-BULK-003 — 50-employee performance fixture (P2 / SC7 benchmark)

- **Source**: SC7 + P2 + impl-plan §6.3 `50-employee-payroll-export.csv`
- **Category**: Bulk mode — performance
- **Why it matters**: SC7 verbatim — "a 100-employee CSV upload ... processes in under 90 seconds (95th percentile)." Per impl-plan, the 50-row fixture is the 10× sample of P2's 500-row budget.

**Inputs**

A 50-employee CSV at `website/src/lib/lsl/states/nsw/__tests__/fixtures/bulk/50-employee-payroll-export.csv` — 5 yrs of weekly wage history each (~13,000 total rows), all NSW, mixed categories. Per-row inputs NOT enumerated in this document (machine-generated; checksum recorded in fixture header).

**Expected output**

```yaml
total_rows: 50
status_breakdown: { computed: 50, blocked: 0, failed: 0 }
processing_time_p95_ms: <= 90000   # SC7 — 10× sample of 500-employee budget = scaled assertion
per_row_citation_block_present: true       # AC11 / F13
expected_per_row_assertions: none           # perf-only fixture per PM sign-off 2026-05-21 (TBD #8)
```

**Notes**

PM-signed-off as a **performance-only fixture**. Per-row correctness is covered by the 60 enumerated single-mode cases above. The test asserts: (a) all 50 rows complete in ≤ 90s p95, (b) per-row citation blocks are structurally present, (c) no rows fail or block. No per-row dollar assertions.

---

# Coverage matrix

| Spec / source item | Covered by |
|---|---|
| **AC4** — pay-cycle normalisation | TC-NSW-027, TC-NSW-028, TC-NSW-029, TC-NSW-030 |
| **AC5** — Category A FT 12-yr with full citations | TC-NSW-002 |
| **AC6** — 12-yr casual-to-FT returns $9,880.04 | TC-NSW-024 |
| **AC7** — 7-yr voluntary resignation = $0 | TC-NSW-033 |
| **AC8** — 7-yr redundancy = pro-rata | TC-NSW-034 |
| **AC9** — UPL excluded from both service AND lookback denom | TC-NSW-004, TC-NSW-006, TC-NSW-021, TC-NSW-040 |
| **AC10** — Workers Comp service + denominator | TC-NSW-005 |
| **AC11** — citation block per numeric output | every NSW case (citation list mandatory) |
| **AC12** — system formula comparison + variance | TC-NSW-023, TC-NSW-024, TC-NSW-026 |
| **AC13** — single-employee PDF export contents | not unit-tested here — Playwright in impl-plan §6.6 |
| **AC14** — WCAG 2.2 AA single mode | not unit-tested here — `axe-core` in impl-plan §6.7 |
| **AC15** — bulk-mode entry deep-link | not unit-tested here — Playwright in impl-plan §6.6 |
| **AC16** — 50-employee CSV bulk result with citations | TC-BULK-003 (50 rows); TC-BULK-001 (10 rows) |
| **AC17** — bulk-PDF editable preview grouped by employee | not unit-tested here — Playwright in impl-plan §6.6 |
| **AC18** — bulk-mode default trigger `as_at` | TC-BULK-001, TC-BULK-002, TC-BULK-003 |
| **AC19** — cross-jurisdiction mid-batch partial completion | TC-BULK-002 |
| **AC20** — bulk table filter/sort | not unit-tested here — RTL in impl-plan §6.6 |
| **AC21** — bulk CSV/PDF export | not unit-tested here — Playwright in impl-plan §6.6 |
| **AC22** — WCAG 2.2 AA bulk mode | not unit-tested here — `axe-core` in impl-plan §6.7 |
| **AC23** — cross-jurisdiction block (single mode) | TC-NSW-045, TC-NSW-052, TC-NSW-053 |
| **AC24** — 100% gold-standard pass in CI | enforced by the entire fixture set being CI-gated |
| **AC25** — unrounded intermediates; $9,880.04 exact | TC-NSW-024 + property test (impl-plan §6.4) |
| **AC26** — LLM unavailable → CSV within 10s | TC-NSW-057 |
| **AC27** — `.docx`/`.xlsx` rejected at picker | TC-NSW-054, TC-NSW-055 |
| **AC28** — 60-page PDF rejected | TC-NSW-056 |
| **SC1** — single-mode ≤ 30s once inputs confirmed | not unit-tested here — Playwright timing assertion |
| **SC2** — 100% gold-standard pass | this entire document |
| **SC3** — 12-yr casual-to-FT = $9,880.04 ± $0.00 | TC-NSW-024 (verbatim assertion) |
| **SC4** — every numeric output has a citation | enforced by every fixture's `expected_citations` |
| **SC5** — WCAG AA | impl-plan §6.7 |
| **SC6** — APA deep-link works | impl-plan §6.6 Playwright |
| **SC7** — 100-employee bulk in 90s | TC-BULK-003 (scaled to 50; PM sign-off pending) |
| **F11 / D20** — `as_at` snapshot bypasses pro-rata thresholds | TC-NSW-037, TC-NSW-038 |
| **F14** — split leave OUT of v1 | TC-NSW-032 |
| **Research brief §5.1** — casual varying hours (Liam) | TC-NSW-007, TC-NSW-008 |
| **Research brief §5.2** — UPL >52 wks NSW | TC-NSW-006, TC-NSW-040 |
| **Research brief §5.3** — PT stable hours + historical UPL (Practice 1B) | TC-NSW-021 |
| **Research brief §5.4** — transfer of business | TC-NSW-015 |
| **Research brief §5.5** — Workers Comp (Yamala) | TC-NSW-005 |
| **Research brief §5.7** — employer-init termination + rehire within 2 mo | TC-NSW-013, TC-NSW-014, TC-NSW-044 |
| **Research brief §5.8** — cross-jurisdiction blocked | TC-NSW-045 |
| **Research brief §5.10** — apprentice → tradesperson (Walid) | TC-NSW-010 |
| **Research brief §5.11** — JobKeeper / COVID stand-down | TC-NSW-046 |
| **Research brief §5.6, §5.9, §5.12, §5.13** | OUT of v1 per Clarification Summary §2 — flagged in Notes on TC-NSW-020 only |

---

# Items flagged `expected: TBD` — ✅ RESOLVED by PM 2026-05-21

All 8 items below are resolved. Resolutions are folded into the relevant test cases above; this section is the audit record.

1. **TC-NSW-006 (Michelle)** — ✅ `as_at` mode reports accrued value regardless of milestone. Expected: total_entitlement_weeks = `6.99 × (8.6667/10) ≈ 6.0668 weeks`; total_entitlement_dollars ≈ `6.0668 × $1,235 ≈ $7,492.50`. UI presentation MUST include an **"accrued, not currently payable"** indicator because Michelle is under 10 yrs and has no qualifying termination reason. (Per spec v0.5.0 Clarification #1.)
2. **TC-NSW-007 (Liam taking 3 wks)** — ✅ F21 stays. `system_formula_value` uses `current_weekly_gross × entitlement_weeks` (weeks-based, per F21), NOT the hourly-based formula proposed in v1 draft. LSL is calculated in weeks, not hours. Payroll systems compute by hours (which is wrong) — the comparison surfaces the variance. (Per spec v0.5.0 Clarification #2.)
3. **TC-NSW-009 (Rinaldo)** — ✅ Full entitlement, as encoded.
4. **TC-NSW-020 (Kate Practice 1A)** — ✅ The system surfaces a warning when wage-history notes mention "bonus", "incentive", "back-pay", or "retrospective" tokens. The calculation still runs on the user-provided gross. Expected output: legislated value computed on gross-only + a warning banner. (Per spec v0.5.0 Clarification #4 → F18 amended.)
5. **TC-NSW-024 (12-yr casual-to-FT)** — ✅ `Employee` schema is unchanged. Single `employmentType` field is fine. Classifier resolves pay-pattern from wage history characteristics (gross variability + period count). Hours-per-week is NOT collected. (Per spec v0.5.0 Clarification #5 → F8 Category B simplified to weekly averages only.)
6. **TC-NSW-036 (serious misconduct at 12 yrs)** — ✅ Follow the literal reading of NSW LSA s.4(2)(iii): 10+ years pays out for any reason, including serious misconduct. Full payout. (Per spec v0.5.0 Clarification #6.)
7. **TC-NSW-044 ("within 2 months")** — ✅ Inclusive (≤ 60 days). (Per spec v0.5.0 Clarification #7.)
8. **TC-BULK-003** — ✅ Performance-only fixture. Per-row correctness is covered by the 60 enumerated single-mode cases above. (Per spec v0.5.0 Clarification #8.)

---

*End of test-cases.md v1.1 — PM-signed-off 2026-05-21.*
