# VIC LSL Calculator — Gold-Standard Test Cases

**Status**: SIGNED OFF · Tracy Angwin (PM) · 2026-05-24 — Phase 3 T3.1 unblocked
**Version**: v1.0
**Date**: 2026-05-24
**Spec**: `.specify/features/002-all-state-coverage/spec.md` v0.3.1
**Impl plan**: `.specify/features/002-all-state-coverage/impl-plan.md` Phase 3 (VIC) — re-scoped per TBD-VIC-01 resolution
**Tasks**: `.specify/features/002-all-state-coverage/tasks.md` T3.0 (SIGNED OFF)

> **PM sign-off — 2026-05-24 (Tracy)**: all 13 TBDs at the bottom of this file are resolved; resolutions inline below and summarised in the Resolutions section. T3.1 (VIC rule-set scaffold) may proceed. Per E2 AC4b, the per-state launch gate is (1) PM sign-off on this file + (2) the gold-standard suite passing 100% green on the merge commit. No additional human review is required.

**Original draft status**: Draft v1 (HEAD `d7d78ca`, 2026-05-24)
**Spec at original drafting**: v0.3.0

---

## Resolutions (PM sign-off 2026-05-24)

All 13 TBDs flagged in the original draft are resolved. Resolutions are folded into the relevant test cases above; this section is the audit record. The full TBD register at the bottom of this document is preserved (each item annotated `RESOLVED`) so the rationale remains discoverable.

| TBD | Severity | Resolution |
|---|---|---|
| **TBD-VIC-01** — Dual-regime interpretation | 1 | **Single rule set with date-aware continuous-service handling.** PM's reading accepted: VIC LSL Act 2018 s.6 calculates entitlement on the employee's *total* period of continuous employment (singular, undivided). The transitional rules in s.57 affect *which absences count* toward continuous employment, not the entitlement-weeks formula. The "dual rule sets" language in the original impl-plan §3 is re-scoped to "two continuous-service-rule modules feeding the same accrual formula". The pre/post-1-November-2018 split applies to *per-absence rule selection* (absences started pre-1/11/2018 → 1992 Act continuous-service rules; absences started on/after → 2018 Act rules), not to two parallel entitlement engines. See impl-plan v0.3.1 §3. |
| **TBD-VIC-02** — Casual under-12-wk gap and accrual | 2 | **Hours-based accrual confirmed.** For casuals, the gap preserves continuity (s.12(3)) but does NOT add hours to the s.16 averaging numerator. TC-VIC-006 expected output unchanged. Engine treats the gap as days excluded from accrual but NOT a break of service. |
| **TBD-VIC-03** — Engine warning code for VIC 12-wk gap | 2 | **State-agnostic code `gap_exceeds_state_tolerance` with state-specific message text.** The existing `gap_exceeds_2mo` enum value in `engine/types.ts` is NSW-specific by name; a small follow-up refactor renames it to `gap_exceeds_state_tolerance` and parameterises the message per state. Tracked as a Phase 1 engine-types refactor task (developer to schedule alongside T3.2). TC-VIC-010 expected `warnings[0].code` updated to `gap_exceeds_state_tolerance`. |
| **TBD-VIC-04 / TBD-VIC-05** — APA practice activities expected values | 2 | **(a) Accepted as PM-derived gold-standard.** Same model used for NSW Practice 1(C) (Bevan). The gold-standard suite covers the calculation logic, not the APA training's specific worked answer. TC-VIC-012/013/014 expected values stand as PM-derived. Fixture notes already label these "PM-derived" — no additional flagging required. |
| **TBD-VIC-06** — 7-year boundary inclusivity | 2 | **Inclusive at exactly 7 years 0 days.** PM's reading accepted: "after completing 7 years of continuous employment" is read inclusive of the exact 7-year boundary. The engine threshold is `years_of_continuous_service >= 7.0000`. TC-VIC-016 stands. |
| **TBD-VIC-07** — Sub-7-year UI advisory for death/illness | 3 | **Yes — non-blocking advisory.** When trigger = death or illness at sub-7-yr tenure, the engine emits a UI advisory: "No LSL entitlement under VIC LSL Act 2018 s.6. Review applicable industrial instrument, EA, or contract — these may provide more favourable terms than the statutory minimum." Implemented in T3.5 (UI integration). TC-VIC-018 expected output gains a `warnings[]` entry with code `sub_7yr_review_industrial_instrument`. |
| **TBD-VIC-08** — LWOP 52-wk cap scope | 1 | **Per LWOP period.** PM accepts the plain-text reading of s.13(1)(b): "if a period of unpaid leave is less than or is 52 weeks, that period [counts]" — each `leave_without_pay` event treated independently. No WIV phone consultation needed; the Act text is sufficient. TC-VIC-035 stands at `days_excluded_from_service: 0`. **TC-VIC-036 expected output corrected**: under per-period interpretation, all four LWOP periods are individually under 52 wks → `days_excluded_from_service: 0` (was `189` under the cumulative reading). |
| **TBD-VIC-09** — Olivia day-precise vs month-rounded arithmetic | 3 | **Day-precise arithmetic accepted.** Engine computes `days_excluded_from_service` from explicit start/end dates; APA's "first 6 months" wording is shorthand for the day-precise calculation. TC-VIC-037 stands. |
| **TBD-VIC-10** — 1992 Act citation precision | 2 | **APA training pages accepted as practical source-of-truth.** The 1992 Act is repealed; APA training (`docs/features/LSL-training.pdf` p.34-35) is the operational compendium. Engine emits citations of the shape `{ section: "VIC LSL Act 1992 s.62(2)(g)", rule: "...", pdfPage: 35, note: "Per APA LSL Masterclass; legacy provision preserved via 2018 Act s.57" }`. If a direct 1992 Act extract is needed later (e.g. for a tribunal-grade citation), it can be added in a follow-up without changing engine code. |
| **TBD-VIC-11** — s.15 vs s.16 rate computation when hours have changed | 2 | **PM's two-case reading accepted.** For employees *without* a fixed ordinary time rate of pay (varied-rate, commission, piece), apply s.15(2) directly on weekly gross. For employees *with* a fixed rate but varied hours, apply s.16 to compute average weekly hours, then multiply by the fixed rate to derive value-of-week. The classifier in `calculateVIC` makes this distinction by inspecting whether the employee's wage history has stable per-hour gross (fixed-rate path) or volatile gross (varied-rate path). TC-VIC-044 (fixed rate + varied hours) keeps the s.16+s.15(2)(c) citation pair. |
| **TBD-VIC-12** — E2 spec citation correction (s.67 → s.34) | 1 | **Spec corrected.** E2 spec v0.3.1 amends every reference from "LSL Act 2018 (Vic) s.67" to "LSL Act 2018 (Vic) s.34" (Part 3 Division 3 — Offences, the cashing-out prohibition). The APA training PDF p.47 also incorrectly cites s.67; the engine MUST cite s.34. TC-VIC-050 → TC-VIC-053 citation blocks stand (already use s.34 — they were ahead of the spec). See note below re. APA training PDF correction. |
| **TBD-VIC-13** — s.8 leave in advance and s.22 half-pay | 3 | **Both deferred from v1.** Engine recognises these triggers exist (citation note in the cash-out hard error suggests s.22 as a lawful alternative) but does NOT compute scenarios involving them. Trigger types `leave_in_advance` and `half_pay` are out of v1 scope — any such request returns an `unsupported_in_v1` error. Re-evaluate in v2. |

### External: APA training PDF correction

The APA LSL Masterclass PDF (`docs/features/LSL-training.pdf` p.47) incorrectly cites the cashing-out prohibition as "s.67" of the *Long Service Leave Act 2018* (Vic). The authorised Act text places this provision at **s.34** (Part 3 Division 3 — Offences). This document and the engine cite s.34 (the correct section); the APA training PDF is the external source of the error.

**Action**: Surface this to APA's training team for correction in the next PDF revision. **Not a launch blocker** for the calculator — the engine cites s.34 correctly. Tracked here so the operator can forward the correction to APA when convenient.

---

**Sources of legal truth**:
- *Long Service Leave Act 2018* (Vic) No. 12 of 2018 — authorised consolidation, current at 12 Dec 2025. Cited as **"VIC LSL Act 2018 s.N"**.
- *Long Service Leave Act 1992* (Vic) No. 83 of 1992 — repealed 1 November 2018 by s.56 of the 2018 Act. Cited as **"VIC LSL Act 1992 s.N"** where its provisions remain operative via the transitional rules in s.57 of the 2018 Act.
- *APA LSL Masterclass* PDF (`docs/features/LSL-training.pdf`) pp.32–48 — supplies worked examples used as canonical fixtures. Cited as **"APA LSL Masterclass p.NN"**.
- *Comprehensive Guide to the Victorian Long Service Leave Act 2018* (Business Victoria) — descriptive interpretive material for sub-section behaviour the Act treats by formula only.

---

## How to read this file

Each test case has:

- **ID** (e.g. `TC-VIC-001`) — unique, stable, referenced from `gold-standard.test.ts`
- **Name** — short, descriptive
- **Source** — APA PDF page and/or VIC LSL Act section that produced the expected value
- **Category** — Single mode (Fixed-rate / Varied-hours / Commission / Hard-error / negative) or Bulk mode
- **Why it matters** — the spec acceptance criterion or VIC-specific divergence this case backs
- **Inputs** — fenced YAML following the engine's `Employee` / `Trigger` / `WagePeriod` / `ContinuousServiceEvent` data model in `website/src/lib/lsl/engine/types.ts`
- **Expected output** — `value_of_week`, `value_of_day`, `total_entitlement_weeks`, `total_entitlement_dollars`, `expected_citations[]`; for hard-error cases `status: failed` and `error.code`
- **Legal source** — explicit VIC LSL Act 2018 / 1992 / transitional section reference
- **Notes** — interpretation, derivation, any `expected: TBD` flag with rationale

### Conventions used in this file

- **Currency**: AUD; half-up rounding at 0.005; 2 decimal places at display; intermediate arithmetic is unrounded — same convention as NSW (F12, AC25 in E1 spec).
- **Dates**: ISO `YYYY-MM-DD`. Prescribed-date anchor for fixtures is `2026-05-24` (= as-at default for v1 testing).
- **Entitlement formula** (VIC LSL Act 2018 s.6): `weeks of continuous employment × (1/60)` — equivalent to `years_of_continuous_service × (8.6667/10)`. Same numerical accrual ratio as NSW; differs only in the qualifying threshold (7 yrs in VIC vs 10 yrs in NSW).
- **Ordinary pay** (VIC LSL Act 2018 s.15): for employees with a fixed ordinary time rate of pay, that rate is used (s.15(1)). For employees without a fixed rate (commission, piece, varied-hours casual, or hours changed in last 104 wks per s.16(1)(b)), the greater of three averages applies — 52-week, 260-week, or the entire period of continuous employment (s.15(2)(a)/(b)/(c)).
- **Hours averaging** (VIC LSL Act 2018 s.16): for casual / varied-hours employees, normal weekly hours is the greatest of `(B+C)/(52−D)`, `(B+C)/(260−D)`, `(B+C)/(D−E)` where B is hours worked, C is hours on paid leave, D is the denominator-weeks (or weeks of continuous employment in the third formula), and E is weeks of unpaid leave. **Unpaid leave reduces the denominator only; paid leave is added back into the numerator.**
- **Public holidays during LSL** (VIC LSL Act 2018 s.7): EXCLUSIVE — a PH falling within an LSL window is NOT counted as a day of LSL (matches NSW behaviour; differs from SA which is inclusive).
- **Citations**: every case lists the minimum expected citations. The rules engine MAY emit additional citations; tests assert array-membership, not array-equality.

---

## VIC-specific divergences from NSW (the load-bearing facts)

| Topic | NSW | VIC | VIC source |
|---|---|---|---|
| Qualifying period (full entitlement) | 10 yrs | **7 yrs** | VIC LSL Act 2018 s.6 |
| Pro-rata at termination | 5 yrs (limited reasons: redundancy, illness, death, domestic pressing necessity, employer-initiated) | **7 yrs (any reason — incl. resignation, dismissal, serious misconduct)** | VIC LSL Act 2018 s.9; APA p.43 "After 7 years, all accrual is entitlement" |
| Accrual ratio | 1/60 | 1/60 (same) | VIC LSL Act 2018 s.6 |
| Sub-7-yr entitlement | none on resignation; pro-rata exists at 5 yrs for limited reasons (NSW LSA s.4(2)(iii)) | **none — no sub-7-yr pro-rata exists in VIC for any reason** | VIC LSL Act 2018 s.6 (qualifying period is "after completing 7 years"); APA p.43 matrix "Before 7 years – No Entitlement" |
| Ordinary-pay averaging | Greater of (current weekly rate, 5-yr avg weekly gross) for Cat A; 12-mo-vs-5yr for Cat B/C — 2-tier | **Greater of (52-wk avg, 260-wk avg, entire-period-of-continuous-employment avg)** — 3-tier | VIC LSL Act 2018 s.15(2)(a)/(b)/(c); APA p.40 |
| Hours-changed lookback | 5 yrs (260 days) | **104 weeks (2 yrs) is the change-trigger; the 3-tier average is then applied** | VIC LSL Act 2018 s.16(1)(b); APA p.41 |
| Break tolerance — employer/employee-initiated | 2 mo (≤60 days, NSW LSA s.4(11)) | **12 weeks (s.12(6)(a)/(b))** | VIC LSL Act 2018 s.12(6) |
| Casual/seasonal break tolerance | implicit via "regular and systematic" + research §1.4 | **12 weeks unless agreement, seasonal factors, terms of engagement, or regular & systematic w/ reasonable expectation** | VIC LSL Act 2018 s.12(3) |
| Unpaid leave (LWOP / unpaid parental) | UPL excluded from service & lookback denominator | **First 52 weeks of unpaid leave COUNTS as service (s.13(1)(b))**; excess beyond 52 wks does NOT count unless illness/injury or written agreement (s.14(a)) | VIC LSL Act 2018 s.13(1)(b)/(c)/(d) + s.14(a) |
| Casual unpaid parental leave | UPL excluded | **Up to 104 weeks paid OR unpaid parental leave counts (s.12(2)(d))** for casual/seasonal | VIC LSL Act 2018 s.12(2)(d) |
| Workers Comp | counts as service (NSW LSA s.4(11) + WCA s.49); excluded from lookback denominator | **Counts as service (s.13(1)(b) via "illness or injury"); workers-comp employees use s.17 — greater of pre-injury or current rate** | VIC LSL Act 2018 s.13(1)(b), s.17 |
| Apprentice → tradesperson | within 12 mo, preserves prior service (NSW LSA s.4(11)) | **2018 Act: within 52 weeks (s.12(6)(c) + s.13(2))**; pre-2018: within 12 mo (legacy 1992 Act rule preserved via transitional s.57 for absences started pre-1/11/2018) | VIC LSL Act 2018 s.12(6)(c), s.13(2); APA p.34 (pre-2018 transition) |
| Transfer of business | NSW LSA s.4(6) | **s.11(3)–(11) — new owner takes on service, including dismissal-then-rehire-within-12-wks by new owner (s.11(5))** | VIC LSL Act 2018 s.11 |
| Cashing out | not in scope for NSW v1 | **CRIMINAL OFFENCE — s.34 of the 2018 Act prohibits payment in lieu of LSL during ongoing employment.** Penalty: 12 penalty units (natural person) / 60 penalty units (body corporate). Employee accepting payment also commits an offence (s.34(2)). Lawful at termination (s.9 expressly authorises payout). | VIC LSL Act 2018 s.34 |
| Working elsewhere during LSL | not encoded | **OFFENCE under s.35** — penalty 12 penalty units | VIC LSL Act 2018 s.35 |
| Public holiday during LSL | exclusive (NSW LSA s.4(4A)) | **Exclusive (s.7)** — same as NSW | VIC LSL Act 2018 s.7 |
| Death of employee | NSW LSA s.4(2)(iii)(d) — pro-rata, estate on request | **s.10 — full accrued entitlement payable to personal representative; ordinary-pay averaging done over the 52 weeks immediately before death (s.10(3)(b))** | VIC LSL Act 2018 s.10 |
| Pay-on-termination timing | "forthwith" (NSW LSA s.4(5)(a)) | **"on the day on which the employment ends" (s.9(1)(b))** — same in practice | VIC LSL Act 2018 s.9 |
| Leave in advance | not in scope NSW v1 | **Permitted by employer agreement (s.8); deductable from termination payment if employee leaves before entitlement accrues (s.8(3))** | VIC LSL Act 2018 s.8 |
| Half-pay option | not in scope NSW v1 | **Available on employee request unless reasonable business grounds (s.22)** | VIC LSL Act 2018 s.22 |
| Stand-down (slackness, machinery breakdown, work stoppage) | doesn't break / doesn't count as service | **Continuous (s.12(7)(a)/(b)/(c)) BUT excluded from period-of-employment count (s.14(c))** | VIC LSL Act 2018 s.12(7) + s.14(c) |
| Industrial action | doesn't break / doesn't count | **Continuous (s.12(8)); excluded from period-of-employment count (s.14(d))** | VIC LSL Act 2018 s.12(8) + s.14(d) |

---

## Dual-regime handling — what "pre/post 1 November 2018" actually means

> **Resolved interpretation (TBD-VIC-01, PM 2026-05-24)**: ONE rule set with date-aware continuous-service handling. The 2018 Act governs the *current entitlement calculation for all ongoing employees* via s.6. The 1992 Act rules survive only via s.57 of the 2018 Act and affect *which absences count* toward continuous employment — NOT the entitlement-weeks formula. Impl-plan §3 is re-scoped accordingly (one rule set with two continuous-service-rule modules selected by absence start date).

The E2 spec calls VIC a "dual-regime" state. After full research the model is more nuanced than two parallel rule sets running in parallel. The 2018 Act governs the **current entitlement calculation for all ongoing employees**. The 1992 Act rules survive only via the transitional provision in s.57 of the 2018 Act, which has two effects:

1. **s.57(1)** — An absence from work that **started before 1 November 2018** and which was treated as an interruption (i.e. broke continuous employment) under s.62(2), s.62(3), or s.62A(1) of the 1992 Act remains an interruption under the 2018 Act. The 2018 Act's more permissive rules (e.g. up to 52 weeks unpaid leave counting as service) do NOT retrospectively rescue continuity that was already broken under the 1992 Act.

2. **s.57(2)** — An absence that was in progress on 1 November 2018 and which was not a period of employment under the 1992 Act but IS under the 2018 Act is treated as employment only for the part on or after 1 November 2018. The pre-2018 portion of that absence is treated under the 1992 Act rules (which generally meant absences over 48 weeks for illness/injury did not count, and unpaid parental leave did not count at all).

**What this means for fixtures**:

- An employee with **all** service post-1 November 2018 → calculated entirely under the 2018 Act. No transitional rules engage.
- An employee with **all** service pre-1 November 2018 (impossible in practice for current calculations because the trigger date is always today) → governed by 2018 Act for the prospective entitlement, but absences during pre-2018 portion of service follow 1992 Act treatment per s.57(2).
- An employee with service **straddling 1 November 2018** → 2018 Act governs the entitlement and accrual ratio. Absences started before 1 November 2018 that were excluded under the 1992 Act remain excluded for their pre-2018 portion; absences started on/after 1 November 2018 follow 2018 Act rules.

The engine therefore does NOT split entitlement weeks between two regimes (the 1/60 ratio is unchanged across both Acts — the APA training is explicit, p.32 and p.45). What the engine DOES do is apply the correct continuous-employment rule to each historical absence based on **the date that absence started**.

The two **continuous-service rule modules** referenced in impl-plan v0.3.1 §3 are therefore not two parallel entitlement engines: one module applies the s.62/62A/63 rules of the 1992 Act to pre-1/11/2018 absences, the other applies the s.12/13/14 rules of the 2018 Act to post-1/11/2018 absences. Both feed the same s.6 accrual formula in a single VIC rule set.

This interpretation is reflected in the test cases below — the regime split is in `serviceEvents` interpretation, not in entitlement-weeks calculation. **RESOLVED 2026-05-24 — TBD-VIC-01.**

---

## Coverage at a glance

| Source / Theme | Test IDs | Count |
|---|---|---|
| APA PDF VIC worked examples (pp.32–48) | TC-VIC-001 → TC-VIC-011 | 11 |
| APA Practice Activity 2(A)/(B)/(C) — derived expected values | TC-VIC-012 → TC-VIC-014 | 3 |
| Sub-7-year boundary cases (s.6 — no entitlement) | TC-VIC-015 → TC-VIC-019 | 5 |
| Pro-rata at termination — qualifying termination reasons (s.9) | TC-VIC-020 → TC-VIC-026 | 7 |
| Continuous service edge cases — 2018 Act post-1/11/2018 | TC-VIC-027 → TC-VIC-036 | 10 |
| Transitional / 1992-Act-preserved cases (s.57) | TC-VIC-037 → TC-VIC-041 | 5 |
| Ordinary pay — fixed-rate, varied-hours, commission (s.15, s.16) | TC-VIC-042 → TC-VIC-047 | 6 |
| Workers Comp — s.17 higher-of-rates | TC-VIC-048 → TC-VIC-049 | 2 |
| Cashing out — HARD ERROR (s.34) | TC-VIC-050 → TC-VIC-053 | 4 |
| Public holiday during LSL (s.7) | TC-VIC-054 | 1 |
| As-at snapshot trigger | TC-VIC-055 → TC-VIC-056 | 2 |
| Cross-jurisdiction (VIC + other state) | TC-VIC-057 → TC-VIC-058 | 2 |
| Bulk-mode fixtures | TC-VIC-BULK-001 → TC-VIC-BULK-003 | 3 |
| **Total** | | **61** |

---

# Single-mode test cases

## §A — APA PDF VIC worked examples (pp.32–48)

### TC-VIC-001 — Will, 10 yrs FT resignation, full entitlement 8.6667 weeks

- **Source**: APA p.32 Example 1 (Will); VIC LSL Act 2018 s.6
- **Category**: Fixed-rate (s.15(1))
- **Why it matters**: Verbatim APA worked example — the canonical "10 yrs × 1/60" calculation, which is the same accrual ratio NSW uses but reached without crossing the NSW 10-year-milestone barrier.

**Inputs**

```yaml
employee:
  id: TC-VIC-001
  legalName: Will
  startDate: 2016-05-24
  endDate: 2026-05-24
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1800.00
  wageHistory:
    - { periodStart: 2016-05-24, periodEnd: 2026-05-24, grossPay: 936000.00, frequency: weekly }
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-24, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 10.0000
total_entitlement_weeks: 8.6667         # APA p.32: "10 x (8.6667/10) = 8.6667"
value_of_week: 1800.00                   # s.15(1) — fixed ordinary time rate of pay
value_of_day: 360.00                     # 1800 / 5 (FT 5-day week)
total_entitlement_dollars: 15600.06      # 8.6667 × 1800
expected_citations:
  - { section: VIC LSL Act 2018 s.6,   rule: accrual.qualifying-period-7yr-plus,   pdfPage: 32 }
  - { section: VIC LSL Act 2018 s.15(1), rule: ordinary-pay.fixed-rate,            pdfPage: 39 }
  - { section: VIC LSL Act 2018 s.9(1)(b), rule: trigger.termination.payable-on-day-of-termination, pdfPage: 43 }
```

**Notes**

APA training is the source for the exact 8.6667 result. PDF p.32 verbatim: "10 x 52 x 1/60 = 8.6667" and "10 x (8.6667/10) = 8.6667". Voluntary resignation at 10 yrs in VIC pays out the full accrued entitlement under s.9(1)(b) — there is no "any-reason" override needed because VIC's qualifying period is 7 yrs and "after 7 years, all accrual is entitlement" (APA p.43, s.9).

---

### TC-VIC-002 — Alicia, 8 yrs FT redundancy, full pro-rata 6.9333 weeks

- **Source**: APA p.32 Example 2 (Alicia); VIC LSL Act 2018 s.6, s.9
- **Category**: Fixed-rate, redundancy
- **Why it matters**: Verbatim APA — confirms that a redundancy after 7 yrs (but before 10) pays the FULL accrued entitlement, not a reduced pro-rata as in NSW.

**Inputs**

```yaml
employee:
  id: TC-VIC-002
  legalName: Alicia
  startDate: 2018-05-24
  endDate: 2026-05-24
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1500.00
  wageHistory:
    - { periodStart: 2018-05-24, periodEnd: 2026-05-24, grossPay: 624000.00, frequency: weekly }
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-24, reason: redundancy }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 8.0000
total_entitlement_weeks: 6.9333         # APA p.32: "8 x (8.6667/10) = 6.9333"
value_of_week: 1500.00
value_of_day: 300.00
total_entitlement_dollars: 10399.95
expected_citations:
  - { section: VIC LSL Act 2018 s.6,   rule: accrual.qualifying-period-7yr-plus,   pdfPage: 32 }
  - { section: VIC LSL Act 2018 s.9(1)(b), rule: trigger.termination.payable-on-day-of-termination, pdfPage: 43 }
```

**Notes**

The APA example uses "redundancy" but it would not matter for VIC — voluntary resignation, dismissal, redundancy, illness, death all qualify identically once the 7-year threshold is met (per s.9: "If an employee's employment ends … the full amount of the employee's long service leave entitlement … is due and payable to the employee on that day"). Contrast NSW where redundancy specifically unlocks pro-rata at 5–10 yrs.

---

### TC-VIC-003 — Olivia, 1.5 yrs UPL pushes entitlement date out 6 months

- **Source**: APA p.33 (Olivia) — illustrates s.13(1)(b)/(c) interaction
- **Category**: Continuous service — UPL exceeds 52 wks
- **Why it matters**: 2018 Act allows up to 52 wks UPL to count; anything beyond 52 wks does not count (unless illness/injury or written agreement). This is the **load-bearing** divergence from NSW where UPL is excluded entirely.

**Inputs**

```yaml
employee:
  id: TC-VIC-003
  legalName: Olivia
  startDate: 2014-07-01
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1600.00
  wageHistory:
    - { periodStart: 2014-07-01, periodEnd: 2026-05-24, grossPay: 952320.00, frequency: weekly, note: "595 wks elapsed less 26 wks UPL excluded = 569 wks × $1,600/wk ≈ $910,400" }
  serviceEvents:
    - { type: unpaid_parental_leave, startDate: 2018-05-01, endDate: 2019-10-31, note: "78 wks UPL — 52 wks count (s.13(1)(b)), 26 wks excluded (s.14(a))" }
trigger: { kind: as_at, asAtDate: 2026-05-24 }
```

**Expected output**

```yaml
status: computed
days_in_unpaid_leave: 549                 # 78.43 wks × 7 — full UPL duration
days_counting_as_service: 365             # first 52 wks of UPL count per s.13(1)(b)
days_excluded_from_service: 184           # weeks 53-78 do NOT count per s.14(a)
years_of_continuous_service: 11.4034      # (4346 elapsed − 184 excluded) / 365.25
total_entitlement_weeks: 9.8829           # 11.4034 × 8.6667/10
value_of_week: 1600.00                    # s.15(1) — fixed rate
value_of_day: 320.00
total_entitlement_dollars: 15812.64       # 9.8829 × 1600
warnings:
  - { code: accrued_not_currently_payable, message: "Accrued snapshot per as_at trigger; employee remains employed." }
expected_citations:
  - { section: VIC LSL Act 2018 s.13(1)(b), rule: continuous-service.unpaid-leave-52wk-counts, pdfPage: 33 }
  - { section: VIC LSL Act 2018 s.14(a),   rule: continuous-service.unpaid-leave-beyond-52wk-excluded, pdfPage: 33 }
  - { section: VIC LSL Act 2018 s.6,       rule: accrual.qualifying-period-7yr-plus,                  pdfPage: 32 }
```

**Notes**

APA p.33 verbatim: "Without taking the leave her entitlement would have been seven years from 1/7/2014 but this has now been pushed out by 6 months, so her entitlement date is now 1/1/2022. In this case the last 52 weeks still count as service, but the first 6 months do not count as service, as unpaid parental leave from 1/5/2018 to 31/10/2018 did not count as service."

This Olivia example is interpreted by APA training under the **transitional rule** (s.57(2)) because her UPL straddles 1 November 2018 — the pre-2018 portion (1/5/2018–31/10/2018, ~26 wks) is treated under the 1992 Act (UPL did not count at all). The post-2018 portion (1/11/2018–31/10/2019, ~52 wks) is treated under the 2018 Act. The 52-week cap then applies cumulatively to the post-2018 portion. Per APA, the first 6 months are excluded (the pre-2018 portion).

> The fixture above models Olivia under a slightly cleaner all-post-2018 scenario for clarity. The straddling-the-cutoff variant is covered separately as TC-VIC-037 below.

---

### TC-VIC-004 — Mary, fixed-term contract renewal within 12 wks

- **Source**: APA p.33 (Mary) — s.12(6)(b)
- **Category**: Continuous service — contract renewal
- **Why it matters**: 2018 Act preserves continuity when employment ends due to expiry of a specified term and the employee is re-employed within 12 wks. Same employer, same/substantially-same work.

**Inputs**

```yaml
employee:
  id: TC-VIC-004
  legalName: Mary
  startDate: 2018-07-01
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1700.00
  wageHistory:
    - { periodStart: 2018-07-01, periodEnd: 2024-06-30, grossPay: 530400.00, frequency: weekly, note: "First contract" }
    - { periodStart: 2024-08-01, periodEnd: 2026-05-24, grossPay: 158100.00, frequency: weekly, note: "New contract after 1-month gap" }
  serviceEvents:
    - type: employer_initiated_termination_and_rehire
      startDate: 2024-06-30
      endDate:   2024-08-01
      note: "Fixed-term contract expiry → renewal within 12 wks — s.12(6)(b)"
trigger: { kind: as_at, asAtDate: 2026-05-24 }
```

**Expected output**

```yaml
status: computed
prior_service_preserved: true
days_in_gap_not_counted: 32                 # 1/7/24 → 31/7/24 (excl. dismissal day per s.14(b))
years_of_continuous_service: 7.7211         # elapsed less 32-day gap
total_entitlement_weeks: 6.6920
value_of_week: 1700.00
value_of_day: 340.00
total_entitlement_dollars: 11376.40
expected_citations:
  - { section: VIC LSL Act 2018 s.12(6)(b), rule: continuous-service.fixed-term-renewal-within-12wks, pdfPage: 33 }
  - { section: VIC LSL Act 2018 s.14(b),    rule: continuous-service.gap-not-counted,                pdfPage: 33 }
  - { section: VIC LSL Act 2018 s.6,        rule: accrual.qualifying-period-7yr-plus,                pdfPage: 32 }
```

**Notes**

APA p.33: "If employment ends by either the employer or employee and is subsequently re-employed within 12 weeks. Prior service is recognised but the absence will not count as service. This also applies to the renewal of fixed/maximum term contracts." 12-week tolerance is the cap; gap of 1 month is well inside.

---

### TC-VIC-005 — Walid, apprentice → tradesperson re-employed within 52 wks

- **Source**: APA p.34 (Walid) — s.12(6)(c) + s.13(2)
- **Category**: Continuous service — apprentice transition
- **Why it matters**: 2018 Act allows 52 weeks (vs 12 mo before 2018; APA p.34 notes the change). This is the longer tolerance for apprenticeship-to-tradesperson transitions specifically.

**Inputs**

```yaml
employee:
  id: TC-VIC-005
  legalName: Walid
  startDate: 2018-07-01
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1900.00
  wageHistory:
    - { periodStart: 2018-07-01, periodEnd: 2024-06-30, grossPay: 374400.00, frequency: weekly, note: "Apprenticeship — lower rate" }
    - { periodStart: 2024-10-01, periodEnd: 2026-05-24, grossPay: 165300.00, frequency: weekly, note: "Tradesperson — higher rate" }
  serviceEvents:
    - type: apprentice_to_tradesperson_transition
      startDate: 2024-06-30
      endDate:   2024-10-01
      note: "Apprenticeship ends; re-employed as qualified tradesperson within 13 wks — s.12(6)(c) + s.13(2)"
trigger: { kind: as_at, asAtDate: 2026-05-24 }
```

**Expected output**

```yaml
status: computed
prior_apprentice_service_preserved: true
days_in_gap_not_counted: 93                 # 1/7/24 → 30/9/24
years_of_continuous_service: 7.6452         # elapsed less 93-day gap
total_entitlement_weeks: 6.6259
value_of_week: 1900.00                       # s.15(1) — current tradesperson rate
value_of_day: 380.00
total_entitlement_dollars: 12589.21
expected_citations:
  - { section: VIC LSL Act 2018 s.12(6)(c), rule: continuous-service.apprentice-to-trade-within-52wks, pdfPage: 34 }
  - { section: VIC LSL Act 2018 s.13(2),    rule: continuous-service.apprenticeship-counts-as-service, pdfPage: 34 }
  - { section: VIC LSL Act 2018 s.6,        rule: accrual.qualifying-period-7yr-plus,                  pdfPage: 32 }
```

**Notes**

APA p.34: "Apprentices who have entered a contract of service with that employer within 52 weeks of completion of the apprenticeship." 13-week gap is well inside the 52-week tolerance. The 93-day gap itself does NOT count toward service (per s.14(b)) — only the apprenticeship period is preserved.

---

### TC-VIC-006 — Jennifer, casual w/ 2-month European holiday gap

- **Source**: APA p.35 (Jennifer) — s.12(3)
- **Category**: Continuous service — casual gap under 12 wks
- **Why it matters**: 2018 Act preserves casual continuity for gaps under 12 wks. Differs from NSW which uses "regular and systematic" only.

**Inputs**

```yaml
employee:
  id: TC-VIC-006
  legalName: Jennifer
  startDate: 2018-03-01
  employmentType: casual
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 760.00                # 20 hrs × $38/hr
  wageHistory:
    - { periodStart: 2025-05-25, periodEnd: 2026-05-24, grossPay: 35920.00, frequency: other, periodDays: 305, note: "60 days less for 2-month gap" }
  serviceEvents:
    - { type: leave_without_pay, startDate: 2026-03-01, endDate: 2026-05-01, note: "2-month Europe trip — under 12 wks → continuous per s.12(3)" }
trigger: { kind: as_at, asAtDate: 2026-05-24 }
```

**Expected output**

```yaml
status: computed
casual_continuity_preserved: true
years_of_continuous_service: 8.0959         # elapsed continuously (gap excluded from accrual but not breaking service)
days_excluded_from_service: 61              # gap doesn't count as service per s.14(a)
total_entitlement_weeks: 7.0165
expected_citations:
  - { section: VIC LSL Act 2018 s.12(3),   rule: continuous-service.casual-gap-under-12wks-preserves, pdfPage: 35 }
  - { section: VIC LSL Act 2018 s.14(a),   rule: continuous-service.unpaid-leave-beyond-52wk-excluded, pdfPage: 33 }
```

**Notes**

APA p.35 verbatim: "Jennifer is a casual waitress at the local pub. She is going away to Europe for 2 months. As the absence is under 12 weeks then her service will be deemed continuous."

The unpaid-2-month leave is treated as unpaid leave UNDER 52 weeks → counts as service per s.13(1)(b). But because it's a worker-initiated absence under 12 wks for a casual specifically, the alternate framing in s.12(3) (casual continuity) also applies. The result is the same: continuous service, accrual continues. **Practitioner note**: APA p.33 lists this as "unpaid leave up to 52 weeks — does count". The expected `days_excluded_from_service: 61` figure assumes the gap is *not* paid leave and the engine still applies the standard "absent unpaid days don't generate accrual on a casual hours basis" — **RESOLVED 2026-05-24 (TBD-VIC-02)**: for casuals, accrual is hours-based per s.16; the gap preserves continuity but adds no hours to the numerator.

---

### TC-VIC-007 — Johan, fruit picker, seasonal absence > 12 wks

- **Source**: APA p.35 (Johan) — s.12(3)(c)
- **Category**: Continuous service — seasonal
- **Why it matters**: 2018 Act preserves continuity for casual/seasonal employees whose absence is caused by seasonal factors, even if > 12 wks.

**Inputs**

```yaml
employee:
  id: TC-VIC-007
  legalName: Johan
  startDate: 2018-05-24
  employmentType: casual
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1200.00              # 30 hrs × $40/hr in season
  wageHistory:
    - { periodStart: 2025-05-25, periodEnd: 2026-05-24, grossPay: 39000.00, frequency: other, periodDays: 365, note: "32.5 wks of active season × $1,200/wk" }
  serviceEvents:
    - { type: leave_without_pay, startDate: 2025-11-01, endDate: 2026-03-15, note: "Seasonal dormancy 19.5 wks — s.12(3)(c) preserves continuity" }
trigger: { kind: as_at, asAtDate: 2026-05-24 }
```

**Expected output**

```yaml
status: computed
casual_continuity_preserved: true
years_of_continuous_service: 8.0027
total_entitlement_weeks: 6.9357
expected_citations:
  - { section: VIC LSL Act 2018 s.12(3)(c), rule: continuous-service.casual-seasonal-factors-preserve, pdfPage: 35 }
```

**Notes**

APA p.35: "Johan is a fruit picker and often has no work during times that the crop is dormant, this is often a period of over 12 weeks. This time off will still count towards his service, as the absence is due to seasonal factors." NB: the APA wording "still count towards his service" is loose — strictly, the seasonal absence preserves continuity but does not itself add to the accrual unless the employee is on paid leave. The fixture treats the dormancy as days excluded from accrual but continuity preserved.

---

### TC-VIC-008 — Deepa, voluntary resignation + 6-wk gap, prior service preserved

- **Source**: APA p.36 (Deepa) — s.12(6)(a)
- **Category**: Continuous service — employee-initiated rehire within 12 wks
- **Why it matters**: Backs the symmetric treatment under 2018 Act — gaps caused by employee OR employer-initiated termination under 12 wks preserve prior service. Differs from NSW where voluntary resignation resets service.

**Inputs**

```yaml
employee:
  id: TC-VIC-008
  legalName: Deepa
  startDate: 2017-05-24
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1700.00
  wageHistory:
    - { periodStart: 2017-05-24, periodEnd: 2026-03-01, grossPay: 781000.00, frequency: weekly }
    - { periodStart: 2026-04-12, periodEnd: 2026-05-24, grossPay: 10200.00, frequency: weekly }
  serviceEvents:
    - type: employer_initiated_termination_and_rehire
      startDate: 2026-03-01
      endDate:   2026-04-12
      note: "Voluntary resignation; reinstated 6 wks later — s.12(6)(a) preserves service"
trigger: { kind: as_at, asAtDate: 2026-05-24 }
```

**Expected output**

```yaml
status: computed
prior_service_preserved: true
days_in_gap_not_counted: 42                  # 6 wks
years_of_continuous_service: 8.8830
total_entitlement_weeks: 7.6996
value_of_week: 1700.00
value_of_day: 340.00
total_entitlement_dollars: 13089.32
expected_citations:
  - { section: VIC LSL Act 2018 s.12(6)(a), rule: continuous-service.employee-initiated-rehire-within-12wks, pdfPage: 36 }
  - { section: VIC LSL Act 2018 s.14(b),    rule: continuous-service.gap-not-counted,                       pdfPage: 33 }
  - { section: VIC LSL Act 2018 s.6,        rule: accrual.qualifying-period-7yr-plus,                       pdfPage: 32 }
```

**Notes**

APA p.36 verbatim Example 1: "Deepa has resigned as her mother is sick … After 6 weeks Deepa's mother is better, and she can return to Australia. Her employer had luckily not filled her role and was able to re-instate her employment. For Long Service Leave purposes, her prior service will be recognised but the 6-week gap won't count towards service." Note: in NSW this same scenario would reset service to zero per NSW LSA s.4(11). VIC s.12(6)(a) applies equally to employee-initiated and employer-initiated terminations.

The `employer_initiated_termination_and_rehire` event type is used here as a generic "termination + rehire" event marker; the existing engine event type covers both employer- and employee-initiated cases (the type name is a historical artefact from NSW where only employer-initiated preserved service). Engine MUST NOT apply NSW's "voluntary-resignation-resets" semantics when state = VIC.

---

### TC-VIC-009 — Mohammed, poor-performance termination + 2-mo gap

- **Source**: APA p.36 (Mohammed) — s.12(6)(a)
- **Category**: Continuous service — performance dismissal + rehire under 12 wks
- **Why it matters**: Confirms 2018 Act treats employer-initiated termination identically to voluntary — gap < 12 wks preserves prior service regardless of reason.

**Inputs**

```yaml
employee:
  id: TC-VIC-009
  legalName: Mohammed
  startDate: 2017-05-24
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1750.00
  wageHistory:
    - { periodStart: 2017-05-24, periodEnd: 2026-02-01, grossPay: 770000.00, frequency: weekly, note: "Admin role" }
    - { periodStart: 2026-04-01, periodEnd: 2026-05-24, grossPay: 13750.00, frequency: weekly, note: "Sales role at higher rate" }
  serviceEvents:
    - type: employer_initiated_termination_and_rehire
      startDate: 2026-02-01
      endDate:   2026-04-01
      note: "Dismissed for poor performance; rehired 2 mo later — s.12(6)(a) preserves service"
trigger: { kind: as_at, asAtDate: 2026-05-24 }
```

**Expected output**

```yaml
status: computed
prior_service_preserved: true
days_in_gap_not_counted: 59                  # 2 mo ≈ 8.4 wks
years_of_continuous_service: 8.8501
total_entitlement_weeks: 7.6710
value_of_week: 1750.00
total_entitlement_dollars: 13424.25
expected_citations:
  - { section: VIC LSL Act 2018 s.12(6)(a), rule: continuous-service.employer-initiated-rehire-within-12wks, pdfPage: 36 }
```

**Notes**

APA p.36 Example 2: "Mohammed has been terminated due to poor performance … After 2 months the employer has a role in sales and remembers Mohammed had excellent sales skills and is re-hired. As the period is under 12 weeks Mohammed's prior service is recognised, however the gap of 2 months is not counted towards service." This is a Mohammed-shape but the contrast with Renuka (TC-VIC-010 below — 4 months) is the diagnostic.

---

### TC-VIC-010 — Liam, redundancy + 4-month gap, prior service NOT preserved

- **Source**: APA p.36 (Liam) — s.12(6) ceiling
- **Category**: Negative — gap > 12 wks breaks continuity
- **Why it matters**: 12-week ceiling is binding. Service resets on any termination + rehire gap > 12 wks regardless of termination reason.

**Inputs**

```yaml
employee:
  id: TC-VIC-010
  legalName: Liam
  startDate: 2014-05-24
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 2000.00
  wageHistory:
    - { periodStart: 2026-01-22, periodEnd: 2026-05-24, grossPay: 34000.00, frequency: weekly, note: "Post-rehire only" }
  serviceEvents:
    - type: employer_initiated_termination_and_rehire
      startDate: 2025-09-15
      endDate:   2026-01-22
      note: "Redundancy + 4-month gap — exceeds 12-wk cap, service resets per s.12(6)(a)"
trigger: { kind: as_at, asAtDate: 2026-05-24 }
```

**Expected output**

```yaml
status: computed
prior_service_preserved: false
service_start_used: 2026-01-22
years_of_continuous_service: 0.3367
total_entitlement_weeks: 0.2918
value_of_week: 2000.00
total_entitlement_dollars: 583.51
warnings:
  - { code: gap_exceeds_state_tolerance, message: "Re-hire gap exceeded VIC's 12-week limit — prior service not preserved per VIC LSL Act 2018 s.12(6)(a)." }
expected_citations:
  - { section: VIC LSL Act 2018 s.12(6)(a), rule: continuous-service.gap-exceeds-12wks-breaks-service, pdfPage: 36 }
```

**Notes**

APA p.36 Example 3: "Liam has been terminated due to redundancy. The employer offers to hire him back in another role 4 months later. For Long Service Leave purposes, his prior service is not recognised as he is returning after 12 weeks." Direct contrast pair with TC-VIC-008/TC-VIC-009.

**RESOLVED 2026-05-24 (TBD-VIC-03)**: state-agnostic warning code `gap_exceeds_state_tolerance` with state-specific message text. The NSW `gap_exceeds_2mo` enum value in `engine/types.ts` is renamed to `gap_exceeds_state_tolerance` in a small engine-types refactor scheduled alongside T3.2. NSW message preserves "2 months" wording; VIC message uses "12 weeks". Both states refer to the same enum.

---

### TC-VIC-011 — Ria, transfer of business preserves service

- **Source**: APA p.36 (Ria) — s.11(3)
- **Category**: Continuous service — transmission of business
- **Why it matters**: 2018 Act s.11(3) preserves service across change of ownership. APA training calls this out as the VIC analogue of NSW LSA s.4(6).

**Inputs**

```yaml
employee:
  id: TC-VIC-011
  legalName: Ria
  startDate: 2014-05-24
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1500.00
  wageHistory:
    - { periodStart: 2014-05-24, periodEnd: 2026-05-24, grossPay: 936000.00, frequency: weekly }
  serviceEvents:
    - type: transfer_of_business
      startDate: 2021-07-01
      note: "Beauty on the Beach sold to Zen Massage and Beauty; Ria continues in same role — s.11(3)"
trigger: { kind: as_at, asAtDate: 2026-05-24 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 12.0000
total_entitlement_weeks: 10.4000          # 12 × 8.6667/10
value_of_week: 1500.00
value_of_day: 300.00
total_entitlement_dollars: 15600.00
expected_citations:
  - { section: VIC LSL Act 2018 s.11(3), rule: continuous-service.transfer-of-business-preserves-from-original-start, pdfPage: 36 }
  - { section: VIC LSL Act 2018 s.6,     rule: accrual.qualifying-period-7yr-plus,                                    pdfPage: 32 }
```

**Notes**

APA p.36: "Where a business is sold, transferred or assigned and an employee remains with the business, the new employer becomes responsible for the employee's long service leave entitlement." s.11(3) is explicit that the employee is taken to have started with the new owner on the date employment at that business started.

VIC s.11(5) goes further than NSW: if the employee is *dismissed* by the old owner and *rehired by the new owner* within 12 wks doing same/similar work, the dismissal is disregarded for LSL purposes — see TC-VIC-029 below for that variant.

---

## §B — APA Practice Activity worked examples (pp.44–46) — derived expected values

### TC-VIC-012 — Angela, 12.6 yrs FT, taking 3 wks at $2,300/wk

- **Source**: APA p.44 Practice Activity 2(A) (Angela)
- **Category**: Fixed-rate (s.15(1)) — taking_leave
- **Why it matters**: Verbatim APA practice — confirms multi-decimal accrual and the s.15(1) "ordinary weekly rate of pay" path for FT employees with unchanged hours.

**Inputs**

```yaml
employee:
  id: TC-VIC-012
  legalName: Angela
  startDate: 2013-11-24                      # 12.6 yrs to 2026-05-24
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 2300.00
  normalWeeklyHours: 38
  wageHistory:
    - { periodStart: 2013-11-24, periodEnd: 2026-05-24, grossPay: 1507000.00, frequency: weekly }
  serviceEvents: []
trigger: { kind: taking_leave, leaveStartDate: 2026-05-25, leaveWeeks: 3 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 12.6000
total_entitlement_weeks_accrued: 10.9200    # 12.6 × 8.6667/10
weeks_taken: 3.0000
weeks_remaining: 7.9200
value_of_week: 2300.00
value_of_day: 460.00
payable_for_taken_leave: 6900.00            # 3 × 2300
expected_citations:
  - { section: VIC LSL Act 2018 s.6,    rule: accrual.qualifying-period-7yr-plus, pdfPage: 32 }
  - { section: VIC LSL Act 2018 s.15(1), rule: ordinary-pay.fixed-rate,            pdfPage: 39 }
  - { section: VIC LSL Act 2018 s.18,    rule: trigger.taking-leave.request,       pdfPage: 37 }
  - { section: VIC LSL Act 2018 s.20,    rule: trigger.taking-leave.payment-timing, pdfPage: 41 }
```

**Notes**

APA Practice 2(A) is a blank-template exercise; expected values derived from the APA-stated formulas at p.32 (entitlement) and p.39–41 (ordinary pay + payment). Hours have been "fixed for all employment" per the prompt → s.15(1) applies, not the s.15(2) averaging.

---

### TC-VIC-013 — Armend, 12.1 yrs PT, redundancy, 1.5 yrs UPL post-2018

- **Source**: APA p.45 Practice Activity 2(B) (Armend)
- **Category**: Fixed-rate PT (s.15(1)) + s.13(1)/s.14 unpaid-leave handling
- **Why it matters**: PT 25-hr week + 1.5-yr UPL straddling cases. The 1.5-yr UPL is **entirely post-2018**, so the 52-wk cap in s.13(1)(c) applies cleanly: 52 wks count, 26 wks excluded.

**Inputs**

```yaml
employee:
  id: TC-VIC-013
  legalName: Armend
  startDate: 2014-04-24                      # 12.1 yrs elapsed (12.1 yrs ≈ 4416 days)
  endDate: 2026-05-24
  employmentType: part_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 700.00                 # APA p.45: "$700/wk ($28/hr)"
  normalWeeklyHours: 25
  wageHistory:
    - { periodStart: 2014-04-24, periodEnd: 2026-05-24, grossPay: 440300.00, frequency: weekly, note: "12.1 yrs less 1.5 yrs UPL" }
  serviceEvents:
    - { type: unpaid_parental_leave, startDate: 2023-01-01, endDate: 2024-06-30, note: "1.5 yrs UPL post-2018 — 52 wks count per s.13(1)(b)/(c), 26 wks excluded per s.14(a)" }
trigger: { kind: termination, terminationDate: 2026-05-24, reason: redundancy }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 11.5973         # 12.1 elapsed − 0.503 yrs (26 wks UPL excluded) ≈ 11.597
total_entitlement_weeks: 10.0510             # 11.5973 × 8.6667/10
value_of_week: 700.00                        # s.15(1) — fixed PT rate (hours unchanged for full tenure)
value_of_day: 140.00
total_entitlement_dollars: 7035.69           # 10.0510 × 700
expected_citations:
  - { section: VIC LSL Act 2018 s.6,        rule: accrual.qualifying-period-7yr-plus,                pdfPage: 32 }
  - { section: VIC LSL Act 2018 s.13(1)(b)/(c), rule: continuous-service.unpaid-leave-52wk-counts,    pdfPage: 33 }
  - { section: VIC LSL Act 2018 s.14(a),    rule: continuous-service.unpaid-leave-beyond-52wk-excluded, pdfPage: 33 }
  - { section: VIC LSL Act 2018 s.15(1),    rule: ordinary-pay.fixed-rate,                            pdfPage: 39 }
  - { section: VIC LSL Act 2018 s.9(1)(b),  rule: trigger.termination.payable-on-day-of-termination, pdfPage: 43 }
```

**Notes**

APA p.45 Practice 2(B) is a blank-template exercise. The 1.5-yr UPL is all post-1/11/2018 (start 2023-01-01) so the 2018 Act rules apply with no transitional split. Year-count calc: total elapsed = 12.1 yrs, minus 26 wks UPL excluded = 0.4986 yrs → 11.6014 yrs (rounding here approximates). Fixture above uses 11.5973 to reflect day-precise arithmetic — engine should compute from dates directly.

**RESOLVED 2026-05-24 (TBD-VIC-04)**: PM-derived values accepted as gold-standard. Same model used for NSW Practice 1(C) (Bevan). The gold-standard suite covers the calculation logic; APA's blank templates do not constrain the expected numeric output.

---

### TC-VIC-014 — Biljana, 16.4-yr casual resignation, 9.2 wks prior LSL taken

- **Source**: APA p.46 Practice Activity 2(C) (Biljana)
- **Category**: Varied-hours casual (s.16(2)) + leave-already-taken
- **Why it matters**: Verbatim APA hours grid for the 52/260/whole-period averaging. Most complex single-mode case — exercises all three averages.

**Inputs**

```yaml
employee:
  id: TC-VIC-014
  legalName: Biljana
  startDate: 2009-11-24                       # 16.4 yrs to 2026-05-24
  endDate: 2026-05-24
  employmentType: casual
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentHourlyRate: 40.00                    # APA: "$40 per hour (inclusive of casual loading)"
  hoursLast52Weeks: 1664                      # APA p.46
  hoursLast260Weeks: 8645                     # APA p.46
  hoursTotalEmployment: 26907                 # APA p.46
  wageHistory:
    - { periodStart: 2025-05-25, periodEnd: 2026-05-24, grossPay: 66560.00, frequency: other, periodDays: 365 }  # 1664 × $40
    - { periodStart: 2021-05-25, periodEnd: 2026-05-24, grossPay: 345800.00, frequency: other, periodDays: 1826 } # 8645 × $40
    # earlier periods covering 2009-11-24 → 2021-05-24 totalling 18262 hrs × $40 = $730,480
  serviceEvents:
    - { type: paid_leave, startDate: 2022-08-01, endDate: 2022-10-09, note: "9.2 wks paid LSL previously taken" }
trigger: { kind: termination, terminationDate: 2026-05-24, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 16.4000
weekly_avg_52w:  1280.00                     # 1664 / 52 × 40 = $1,280/wk OR using formula A=(B+C)/(52-D) where D=0 → 1664/52 = 32.0 hrs/wk × $40 = $1,280
weekly_avg_260w: 1330.00                     # 8645 / 260 × 40 = $1,330/wk
weekly_avg_whole: 1262.00                    # 26907 / (16.4 × 52) × 40 = 26907/852.8 × 40 ≈ $1,262/wk
value_of_week: 1330.00                       # greatest of the three averages — s.15(2)(b)
value_of_day:  266.00                        # 1330 / 5
gross_entitlement_weeks: 14.2133             # 16.4 × 8.6667/10
less_leave_taken_weeks: 9.2000
total_entitlement_weeks: 5.0133
total_entitlement_dollars: 6667.69           # 5.0133 × 1330
expected_citations:
  - { section: VIC LSL Act 2018 s.6,        rule: accrual.qualifying-period-7yr-plus,                  pdfPage: 32 }
  - { section: VIC LSL Act 2018 s.16(1)(b), rule: ordinary-pay.varied-hours-casual,                    pdfPage: 41 }
  - { section: VIC LSL Act 2018 s.15(2)(b), rule: ordinary-pay.greater-of-260wk-avg,                   pdfPage: 39 }
  - { section: VIC LSL Act 2018 s.9(1)(b),  rule: trigger.termination.payable-on-day-of-termination, pdfPage: 43 }
```

**Notes**

APA p.46 is again a blank-template exercise. Expected `value_of_week = $1,330.00` derives from `(8645 / 260) × $40 = 33.25 hrs/wk × $40 = $1,330`. The 260-wk average wins.

The 9.2-wk leave previously taken comes verbatim from the practice statement. Engine subtracts weeks, not dollars (same convention as NSW TC-NSW-002).

**RESOLVED 2026-05-24 (TBD-VIC-05)**: PM-derived values accepted as gold-standard. Fixture is labelled "PM-derived" — the 260-wk average calculation (`8645 / 260 × $40 = $1,330/wk`) is verbatim formula application from APA-published rules.

---

## §C — Sub-7-year boundary cases (s.6 — no entitlement)

> Critical VIC divergence from NSW: VIC has **NO sub-7-yr entitlement** for any termination reason. NSW has a 5-yr threshold for redundancy/illness/death/employer-initiated. VIC s.6 is unambiguous — entitlement arises only "after completing 7 years of continuous employment".

### TC-VIC-015 — 6.99 yrs FT redundancy → $0

- **Source**: VIC LSL Act 2018 s.6; APA p.43 matrix "Before 7 years – No Entitlement"
- **Category**: Negative — sub-threshold
- **Why it matters**: Even a redundancy at 6 yrs 51 wks (= 6.9808 yrs) returns $0 in VIC. NSW would pay pro-rata on redundancy at this tenure.

**Inputs**

```yaml
employee:
  id: TC-VIC-015
  legalName: SubThresholdRedundancyFixture
  startDate: 2019-06-01                       # 6.98 yrs to 2026-05-24
  endDate: 2026-05-24
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1800.00
  wageHistory:
    - { periodStart: 2019-06-01, periodEnd: 2026-05-24, grossPay: 653400.00, frequency: weekly }
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-24, reason: redundancy }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 6.9802
total_entitlement_weeks: 0.0000
total_entitlement_dollars: 0.00
expected_citations:
  - { section: VIC LSL Act 2018 s.6, rule: accrual.sub-7yr-no-entitlement-any-reason, pdfPage: 43 }
```

**Notes**

Critical regression — NSW would compute `7 × 8.6667/10 = 6.0667 wks × $1,800 = $10,920` here. VIC returns $0. Engine MUST NOT apply NSW's `accrual.pro-rata.5-to-10.redundancy` rule when state = VIC.

---

### TC-VIC-016 — Exactly 7 yrs 0 days FT resignation → full payout

- **Source**: VIC LSL Act 2018 s.6 — "after completing 7 years"
- **Category**: Boundary — entitlement threshold
- **Why it matters**: Confirms the boundary semantics: 7 yrs exactly is "after completing 7 years" so qualifies.

**Inputs**

```yaml
employee:
  id: TC-VIC-016
  legalName: ExactlySevenYearsFixture
  startDate: 2019-05-24
  endDate: 2026-05-24                         # exactly 7 yrs
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1500.00
  wageHistory:
    - { periodStart: 2019-05-24, periodEnd: 2026-05-24, grossPay: 546000.00, frequency: weekly }
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-24, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.0000
total_entitlement_weeks: 6.0667              # 7 × 8.6667/10 = 6.0667
value_of_week: 1500.00
total_entitlement_dollars: 9100.05
expected_citations:
  - { section: VIC LSL Act 2018 s.6,        rule: accrual.qualifying-period-7yr-plus, pdfPage: 32 }
  - { section: VIC LSL Act 2018 s.9(1)(b),  rule: trigger.termination.payable-on-day-of-termination, pdfPage: 43 }
```

**Notes**

The Act language "after completing 7 years" is treated as inclusive at the 7-yr exact boundary. The APA training matrix p.43 confirms: "After 7 years, all accrual is entitlement." Engine MUST treat `years_of_continuous_service >= 7` as the threshold. **RESOLVED 2026-05-24 (TBD-VIC-06)** — inclusive at exactly 7 years 0 days.

---

### TC-VIC-017 — 6 yrs 364 days FT resignation → $0

- **Source**: VIC LSL Act 2018 s.6 boundary
- **Category**: Negative — one day short

**Inputs**

```yaml
employee:
  id: TC-VIC-017
  legalName: OneDayShortFixture
  startDate: 2019-05-25                       # 6 yrs 364 days to 2026-05-24
  endDate: 2026-05-24
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1500.00
  wageHistory:
    - { periodStart: 2019-05-25, periodEnd: 2026-05-24, grossPay: 545700.00, frequency: weekly }
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-24, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 6.9973
total_entitlement_weeks: 0.0000
total_entitlement_dollars: 0.00
expected_citations:
  - { section: VIC LSL Act 2018 s.6, rule: accrual.sub-7yr-no-entitlement-any-reason, pdfPage: 43 }
```

---

### TC-VIC-018 — 6.5 yrs death of employee → $0 (no sub-7-yr exception)

- **Source**: VIC LSL Act 2018 s.10 + s.6
- **Category**: Negative — death below threshold

**Inputs**

```yaml
employee:
  id: TC-VIC-018
  legalName: SubThresholdDeathFixture
  startDate: 2019-11-24
  endDate: 2026-05-24                         # 6.5 yrs
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1700.00
  wageHistory:
    - { periodStart: 2019-11-24, periodEnd: 2026-05-24, grossPay: 574600.00, frequency: weekly }
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-24, reason: death }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 6.5000
total_entitlement_weeks: 0.0000
total_entitlement_dollars: 0.00
payment_recipient: "estate, on request"     # remains documented even at $0
warnings:
  - { code: sub_7yr_review_industrial_instrument, message: "No LSL entitlement under VIC LSL Act 2018 s.6. Review applicable industrial instrument, EA, or contract — these may provide more favourable terms than the statutory minimum." }
expected_citations:
  - { section: VIC LSL Act 2018 s.6,  rule: accrual.sub-7yr-no-entitlement-any-reason, pdfPage: 43 }
  - { section: VIC LSL Act 2018 s.10, rule: trigger.termination.death.estate-payable, pdfPage: 43, note: "Estate would receive payment IF entitlement existed; below 7yr threshold yields nil" }
```

**Notes**

VIC LSL Act 2018 has no equivalent of NSW LSA s.4(2)(iii)(d) (5-yr pro-rata on death). The 7-yr qualifying period is absolute regardless of termination reason. The s.10 citation is shown to make explicit the engine recognised the death-trigger and the recipient is the estate (the question of "would there be an estate payment" is recorded in the citation block even when the dollar amount is zero).

**RESOLVED 2026-05-24 (TBD-VIC-07)**: engine emits a non-blocking advisory warning (`sub_7yr_review_industrial_instrument`) when trigger is death or illness at sub-7-yr tenure. The calculator's role ends at statute; the user is best served by being reminded that statutory may not be the full picture. Implemented in T3.5 (UI integration).

---

### TC-VIC-019 — 4 yrs FT termination, any reason → $0

- **Source**: VIC LSL Act 2018 s.6
- **Category**: Negative — well below threshold (sanity test)

**Inputs**

```yaml
employee:
  id: TC-VIC-019
  legalName: FourYearFixture
  startDate: 2022-05-24
  endDate: 2026-05-24
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1500.00
  wageHistory:
    - { periodStart: 2022-05-24, periodEnd: 2026-05-24, grossPay: 312000.00, frequency: weekly }
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-24, reason: redundancy }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 4.0000
total_entitlement_weeks: 0.0000
total_entitlement_dollars: 0.00
expected_citations:
  - { section: VIC LSL Act 2018 s.6, rule: accrual.sub-7yr-no-entitlement-any-reason, pdfPage: 43 }
```

---

## §D — Pro-rata at termination — qualifying termination reasons (s.9)

> Under VIC LSL Act 2018 s.9, the trigger for paying out accrued LSL on termination is simply "the employee's employment ends" — no reason qualifier. **All termination reasons** pay out accrued LSL once the 7-yr threshold is reached, including voluntary resignation, dismissal, redundancy, illness, death (per s.10), and importantly **serious misconduct** — VIC has no serious-misconduct forfeiture clause (confirmed by Sprintlaw + Business Vic guidance; the "serious misconduct" exception that exists in other jurisdictions does not apply under the Victorian Act).

### TC-VIC-020 — 9 yrs FT voluntary resignation → full payout

```yaml
employee: { id: TC-VIC-020, startDate: 2017-05-24, endDate: 2026-05-24, employmentType: full_time, statesOfService: [VIC], governingJurisdiction: VIC, currentWeeklyGross: 1700.00, wageHistory: [{ periodStart: 2017-05-24, periodEnd: 2026-05-24, grossPay: 795600.00, frequency: weekly }], serviceEvents: [] }
trigger: { kind: termination, terminationDate: 2026-05-24, reason: voluntary_resignation }
expected:
  status: computed
  years_of_continuous_service: 9.0000
  total_entitlement_weeks: 7.8000             # 9 × 8.6667/10
  value_of_week: 1700.00
  total_entitlement_dollars: 13260.00
  expected_citations:
    - { section: VIC LSL Act 2018 s.9(1)(b), rule: trigger.termination.payable-on-day-of-termination, pdfPage: 43 }
    - { section: VIC LSL Act 2018 s.6,       rule: accrual.qualifying-period-7yr-plus, pdfPage: 32 }
```

### TC-VIC-021 — 9 yrs FT dismissal (not misconduct) → full payout

Identical to TC-VIC-020 but `reason: employer_initiated_not_misconduct`. Expected output identical (s.9 makes no reason distinction post-7-yr).

### TC-VIC-022 — 9 yrs FT redundancy → full payout

Identical to TC-VIC-020 but `reason: redundancy`. Expected output identical.

### TC-VIC-023 — 9 yrs FT illness/incapacity → full payout

Identical to TC-VIC-020 but `reason: illness_incapacity`. Expected output identical.

### TC-VIC-024 — 9 yrs FT serious misconduct → STILL FULL PAYOUT

- **Source**: VIC LSL Act 2018 s.9 (no misconduct exception); Sprintlaw + Business Vic guidance
- **Category**: Critical divergence from NSW

```yaml
employee: { id: TC-VIC-024, startDate: 2017-05-24, endDate: 2026-05-24, employmentType: full_time, statesOfService: [VIC], governingJurisdiction: VIC, currentWeeklyGross: 1700.00, wageHistory: [...], serviceEvents: [] }
trigger: { kind: termination, terminationDate: 2026-05-24, reason: serious_misconduct }
expected:
  status: computed
  years_of_continuous_service: 9.0000
  total_entitlement_weeks: 7.8000
  value_of_week: 1700.00
  total_entitlement_dollars: 13260.00
  expected_citations:
    - { section: VIC LSL Act 2018 s.9(1)(b), rule: trigger.termination.any-reason-incl-misconduct, pdfPage: 43 }
    - { section: VIC LSL Act 2018 s.6,       rule: accrual.qualifying-period-7yr-plus, pdfPage: 32 }
```

**Notes**

This is the diagnostic test for the engine's per-state branching: NSW under-10-yr-misconduct returns $0 (TC-NSW-033 pattern); NSW over-10-yr-misconduct returns full payout (TC-NSW-036). VIC returns full payout at any tenure ≥ 7 yrs regardless of reason. Engine MUST NOT apply the NSW misconduct-exclusion rule when state = VIC.

### TC-VIC-025 — 9 yrs FT death → estate receives full payout

- **Source**: VIC LSL Act 2018 s.10
- **Category**: Death — payment to personal representative

```yaml
employee: { id: TC-VIC-025, startDate: 2017-05-24, endDate: 2026-05-24, employmentType: full_time, statesOfService: [VIC], governingJurisdiction: VIC, currentWeeklyGross: 1700.00, wageHistory: [...], serviceEvents: [] }
trigger: { kind: termination, terminationDate: 2026-05-24, reason: death }
expected:
  status: computed
  years_of_continuous_service: 9.0000
  total_entitlement_weeks: 7.8000
  value_of_week_calculated_per_s10: 1700.00      # s.10(3)(b) — 52-week average immediately before death
  total_entitlement_dollars: 13260.00
  payment_recipient: "personal representative of the deceased employee"
  expected_citations:
    - { section: VIC LSL Act 2018 s.10,      rule: trigger.termination.death.estate-payable,  pdfPage: 43 }
    - { section: VIC LSL Act 2018 s.10(3)(b), rule: ordinary-pay.death-52wk-avg-immediately-before-death, pdfPage: 43 }
    - { section: VIC LSL Act 2018 s.6,       rule: accrual.qualifying-period-7yr-plus, pdfPage: 32 }
```

**Notes**

VIC s.10(3)(b) **mandates** the 52-week average for death cases — the 3-tier "greater of" rule at s.15(2) does NOT apply to deaths. Engine MUST use the 52-week average regardless of whether the 260-week or whole-period average would be higher. This is a critical divergence from the live-employee value-of-week computation.

### TC-VIC-026 — 9 yrs casual termination, varied hours → s.15(2) greater-of applies

- **Source**: VIC LSL Act 2018 s.9 + s.15(2)
- **Category**: Varied-hours termination

```yaml
employee:
  id: TC-VIC-026
  legalName: CasualTerminationFixture
  startDate: 2017-05-24
  endDate: 2026-05-24
  employmentType: casual
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentHourlyRate: 38.00
  hoursLast52Weeks: 1500
  hoursLast260Weeks: 7800
  hoursTotalEmployment: 14040
  wageHistory:
    - { periodStart: 2025-05-25, periodEnd: 2026-05-24, grossPay: 57000.00, frequency: other, periodDays: 365 }
    - { periodStart: 2021-05-25, periodEnd: 2026-05-24, grossPay: 296400.00, frequency: other, periodDays: 1826 }
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-24, reason: voluntary_resignation }
expected:
  status: computed
  years_of_continuous_service: 9.0000
  weekly_avg_52w:  1096.15           # 1500 / 52 × 38
  weekly_avg_260w: 1140.00           # 7800 / 260 × 38
  weekly_avg_whole: 1140.00          # 14040 / (9×52) × 38 = 14040/468 × 38 = 30 × 38
  value_of_week: 1140.00             # greatest — 260-wk or whole-period tied at $1,140
  total_entitlement_weeks: 7.8000
  total_entitlement_dollars: 8892.00
  expected_citations:
    - { section: VIC LSL Act 2018 s.9(1)(b),  rule: trigger.termination.payable-on-day-of-termination, pdfPage: 43 }
    - { section: VIC LSL Act 2018 s.15(2)(b), rule: ordinary-pay.greater-of-260wk-avg, pdfPage: 39 }
    - { section: VIC LSL Act 2018 s.16,       rule: ordinary-pay.varied-hours-casual,  pdfPage: 41 }
```

**Notes**

For a termination trigger, VIC s.15 averaging is still anchored to "immediately before the employee starts long service leave" — for termination, the start-of-leave is the day employment ends per s.9(1)(a). Engine MUST anchor the lookback to terminationDate, not asAtDate.

---

## §E — Continuous service edge cases — 2018 Act, post-1/11/2018

### TC-VIC-027 — Paid annual leave counts as service (s.13(1)(a))

```yaml
employee:
  id: TC-VIC-027
  startDate: 2019-05-24
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1500.00
  wageHistory: [{ periodStart: 2019-05-24, periodEnd: 2026-05-24, grossPay: 546000.00, frequency: weekly }]
  serviceEvents:
    - { type: paid_leave, startDate: 2026-01-12, endDate: 2026-02-09, note: "4 wks paid annual leave" }
trigger: { kind: as_at, asAtDate: 2026-05-24 }
expected:
  status: computed
  years_of_continuous_service: 7.0000         # paid leave fully counted
  total_entitlement_weeks: 6.0667
  expected_citations:
    - { section: VIC LSL Act 2018 s.13(1)(a), rule: continuous-service.paid-leave-counts, pdfPage: 33 }
    - { section: VIC LSL Act 2018 s.12(2)(a), rule: continuous-service.annual-leave-continuous, pdfPage: 33 }
```

### TC-VIC-028 — Carer's leave counts as service (s.12(2)(e))

```yaml
serviceEvents:
  - { type: paid_leave, startDate: 2025-11-01, endDate: 2025-11-22, note: "3 wks paid carer's leave" }
expected_citations:
  - { section: VIC LSL Act 2018 s.12(2)(e), rule: continuous-service.carers-leave-continuous, pdfPage: 33 }
```

### TC-VIC-029 — Transfer of business with new-owner dismissal within 12 wks (s.11(5))

- **Source**: VIC LSL Act 2018 s.11(5)
- **Category**: Continuous service — transfer of business edge case

```yaml
employee:
  id: TC-VIC-029
  startDate: 2014-05-24
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1600.00
  wageHistory: [...]
  serviceEvents:
    - type: transfer_of_business
      startDate: 2021-07-01
      note: "Original employer sold business on 1/7/21 and dismissed employee same day"
    - type: employer_initiated_termination_and_rehire
      startDate: 2021-07-01
      endDate:   2021-08-15
      note: "New owner rehires employee for same role within 12 wks — s.11(5) preserves total service"
trigger: { kind: as_at, asAtDate: 2026-05-24 }
expected:
  status: computed
  years_of_continuous_service: 12.0000        # No gap — s.11(5) deems start with new owner = original start
  total_entitlement_weeks: 10.4000
  expected_citations:
    - { section: VIC LSL Act 2018 s.11(5), rule: continuous-service.transfer-of-business-dismissal-rehired-by-new-owner-within-12wks, pdfPage: 36 }
```

### TC-VIC-030 — Stand-down due to slackness — continuous but not service (s.12(7) + s.14(c))

```yaml
employee:
  id: TC-VIC-030
  startDate: 2017-05-24
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1700.00
  serviceEvents:
    - { type: employer_stand_down, startDate: 2024-08-01, endDate: 2024-10-01, note: "61 days stand-down due to slackness — s.12(7)(c)" }
trigger: { kind: as_at, asAtDate: 2026-05-24 }
expected:
  status: computed
  days_excluded_from_service: 61
  years_of_continuous_service: 8.8329          # 9 yrs elapsed less 61 days
  total_entitlement_weeks: 7.6552
  expected_citations:
    - { section: VIC LSL Act 2018 s.12(7)(c), rule: continuous-service.stand-down-slackness-continuous, pdfPage: 33 }
    - { section: VIC LSL Act 2018 s.14(c),    rule: continuous-service.stand-down-excluded-from-accrual, pdfPage: 33 }
```

**Notes**

APA p.33 lists stand-down as "does not count" but the 2018 Act is more nuanced: s.12(7) keeps it continuous (no service break) but s.14(c) excludes it from the period-of-employment count. Engine MUST distinguish "continuity preserved" from "counts toward accrual" — two different ledgers.

### TC-VIC-031 — Industrial action — continuous but not service (s.12(8) + s.14(d))

```yaml
serviceEvents:
  - { type: industrial_action, startDate: 2025-06-01, endDate: 2025-06-08, note: "1-wk strike — s.12(8)" }
expected_citations:
  - { section: VIC LSL Act 2018 s.12(8), rule: continuous-service.industrial-action-continuous, pdfPage: 33 }
  - { section: VIC LSL Act 2018 s.14(d), rule: continuous-service.industrial-action-excluded-from-accrual, pdfPage: 33 }
```

### TC-VIC-032 — Casual UPL > 52 wks ≤ 104 wks counts (s.12(2)(d))

```yaml
employee:
  id: TC-VIC-032
  employmentType: casual
  statesOfService: [VIC]
  governingJurisdiction: VIC
  serviceEvents:
    - { type: unpaid_parental_leave, startDate: 2023-01-01, endDate: 2024-08-15, note: "85 wks UPL — casual gets 104-wk allowance per s.12(2)(d)" }
trigger: { kind: as_at, asAtDate: 2026-05-24 }
expected_citations:
  - { section: VIC LSL Act 2018 s.12(2)(d), rule: continuous-service.casual-parental-leave-up-to-104wks-counts, pdfPage: 33 }
```

**Notes**

For casuals/seasonal, s.12(2)(d) extends the parental-leave-counts cap from 52 wks (s.13(1)(b)) to 104 wks. This is a casual-specific rule and engine MUST apply only when employmentType = casual or the employee is identifiably seasonal.

### TC-VIC-033 — Illness/injury unpaid leave > 52 wks counts (s.13(1)(d)(iii))

```yaml
serviceEvents:
  - { type: workers_comp_absence, startDate: 2023-06-01, endDate: 2025-06-01, note: "104 wks workers comp — s.13(1)(d)(iii) — illness/injury exception to 52-wk cap" }
expected_citations:
  - { section: VIC LSL Act 2018 s.13(1)(d)(iii), rule: continuous-service.illness-injury-unpaid-leave-uncapped, pdfPage: 33 }
```

### TC-VIC-034 — Written agreement allows unpaid leave > 52 wks to count (s.13(1)(d)(ii))

```yaml
serviceEvents:
  - { type: leave_without_pay, startDate: 2023-06-01, endDate: 2025-12-01, note: "78 wks LWOP for sabbatical — written agreement between employer and employee before leave taken — s.13(1)(d)(ii)" }
extraInputs:
  unpaidLeaveWrittenAgreement: true
expected_citations:
  - { section: VIC LSL Act 2018 s.13(1)(d)(ii), rule: continuous-service.unpaid-leave-written-agreement-uncapped, pdfPage: 33 }
```

### TC-VIC-035 — Multiple short LWOP totalling 51 wks across 12 mo (all count, per-period)

```yaml
serviceEvents:
  - { type: leave_without_pay, startDate: 2025-01-01, endDate: 2025-04-30, note: "17 wks LWOP" }
  - { type: leave_without_pay, startDate: 2025-08-01, endDate: 2025-12-15, note: "20 wks LWOP" }
  - { type: leave_without_pay, startDate: 2026-02-01, endDate: 2026-04-15, note: "14 wks LWOP" }
expected:
  days_excluded_from_service: 0           # each period independently under 52 wks → all count per s.13(1)(b)
```

**Notes**

**RESOLVED 2026-05-24 (TBD-VIC-08)**: per-period interpretation accepted. s.13(1)(b) reads "if a period of unpaid leave is less than or is 52 weeks, that period [counts]" — each `leave_without_pay` event is treated independently. All three periods here are individually under 52 wks → all count as service.

### TC-VIC-036 — Multiple LWOP totalling 79 wks across 4 yrs (all count, per-period)

```yaml
serviceEvents:
  - { type: leave_without_pay, startDate: 2022-01-01, endDate: 2022-04-15 }  # 15 wks
  - { type: leave_without_pay, startDate: 2023-01-01, endDate: 2023-04-15 }  # 15 wks
  - { type: leave_without_pay, startDate: 2024-01-01, endDate: 2024-08-30 }  # 35 wks
  - { type: leave_without_pay, startDate: 2025-09-01, endDate: 2025-12-08 }  # 14 wks
expected:
  status: computed
  days_excluded_from_service: 0    # each period independently under 52 wks → all count per s.13(1)(b) (per-period interpretation, TBD-VIC-08)
```

**Notes**

**RESOLVED 2026-05-24 (TBD-VIC-08)**: under the per-period interpretation, all four LWOP periods here are individually under the 52-week cap (max is 35 wks) → all count as service. `days_excluded_from_service: 0`. If a future case has a single period exceeding 52 wks, only the excess of *that period* is excluded (consistent with TC-VIC-003 Olivia treatment).

---

## §F — Transitional / 1992-Act-preserved cases (s.57)

### TC-VIC-037 — Olivia's UPL straddling 1/11/2018 (per APA p.33 reading)

- **Source**: APA p.33 (Olivia); VIC LSL Act 2018 s.57(2)
- **Category**: Transitional — pre/post 2018 UPL

**Inputs**

```yaml
employee:
  id: TC-VIC-037
  legalName: Olivia-Straddling
  startDate: 2014-07-01
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1500.00
  wageHistory: [...]
  serviceEvents:
    - type: unpaid_parental_leave
      startDate: 2018-05-01
      endDate:   2019-10-31         # 1.5 yrs UPL straddling 1/11/2018
      note: "Pre-2018 portion (1/5/2018 – 31/10/2018, 184 days) → 1992 Act s.62/63: UPL does not count. Post-2018 portion (1/11/2018 – 31/10/2019, 365 days) → 2018 Act s.13(1)(b)/(c): 52 wks count + 0 wks excess (cap not exceeded). Engine applies s.57(2)."
trigger: { kind: as_at, asAtDate: 2026-05-24 }
```

**Expected output**

```yaml
status: computed
days_in_unpaid_leave: 549
days_excluded_from_service_pre_2018: 184      # pre-1/11/2018 portion under 1992 Act
days_excluded_from_service_post_2018: 0       # post-2018 portion under 52-wk cap
total_days_excluded_from_service: 184
years_of_continuous_service: 11.3922          # 4346 elapsed − 184 excluded
total_entitlement_weeks: 9.8732
expected_citations:
  - { section: VIC LSL Act 2018 s.57(2), rule: transitional.absence-straddling-1nov2018, pdfPage: 34 }
  - { section: VIC LSL Act 1992 s.62, rule: transitional.legacy.pre-2018-upl-excluded, pdfPage: 34 }
  - { section: VIC LSL Act 2018 s.13(1)(b), rule: continuous-service.unpaid-leave-52wk-counts, pdfPage: 33 }
```

**Notes**

This case implements the APA p.33 reading. Critical: in the 1992 Act, UPL did not count as service at all; only on/after 1 November 2018 does the 52-wk-counts rule apply (and applies to the portion of the absence post-1/11/2018). APA training is explicit on this Olivia example.

**RESOLVED 2026-05-24 (TBD-VIC-09)**: day-precise arithmetic accepted. The engine computes `days_excluded_from_service` from explicit start/end dates; APA's "first 6 months" wording is shorthand for the day-precise calculation. 184 days ≈ 6.07 months is within rounding tolerance.

### TC-VIC-038 — Employee with all pre-2018 service that was subject to 1992 break-rules

- **Source**: VIC LSL Act 2018 s.57(1)
- **Category**: Transitional — service interrupted under 1992 Act
- **Why it matters**: If an employee's service was already broken under the 1992 Act, the 2018 Act does NOT retrospectively rescue continuity.

**Inputs**

```yaml
employee:
  id: TC-VIC-038
  startDate: 2012-05-01
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1700.00
  serviceEvents:
    - { type: leave_without_pay, startDate: 2016-01-01, endDate: 2016-12-31, note: "365 days LWOP in 2016 — under 1992 Act this exceeded the 48-week illness/injury cap and broke continuity for non-illness reasons" }
trigger: { kind: as_at, asAtDate: 2026-05-24 }
```

**Expected output**

```yaml
status: computed
prior_service_preserved: false
service_start_used: 2017-01-01                 # service effectively restarted after the broken-continuity LWOP
years_of_continuous_service: 9.3950
total_entitlement_weeks: 8.1424
warnings:
  - { code: pre_2018_service_broken, message: "Service prior to 2017-01-01 broken under 1992 Act s.62(2). 2018 Act s.57(1) preserves the 1992 Act's break finding." }
expected_citations:
  - { section: VIC LSL Act 2018 s.57(1), rule: transitional.1992-act-break-preserved, pdfPage: 34 }
  - { section: VIC LSL Act 1992 s.62(2), rule: transitional.legacy.upl-breaks-continuity, pdfPage: 34 }
```

**Notes**

**RESOLVED 2026-05-24 (TBD-VIC-10)**: APA training pages (`docs/features/LSL-training.pdf` p.34-35) accepted as the practical source-of-truth for legacy 1992 Act provisions preserved via s.57. The 1992 Act is repealed; APA training is the operational compendium. Citations of the form `{ section: "VIC LSL Act 1992 s.62(2)(g)", rule: "...", pdfPage: 35, note: "Per APA LSL Masterclass; legacy provision preserved via 2018 Act s.57" }` are accepted. If a tribunal-grade direct extract is needed later, it can be added without changing engine code.

### TC-VIC-039 — Pre-2018 illness > 48 weeks in any year (1992 Act cap)

- **Source**: VIC LSL Act 1992 s.63(1)(c) (under 1992 only first 48 wks of illness/injury counts); preserved by 2018 Act s.57(2)

```yaml
serviceEvents:
  - { type: workers_comp_absence, startDate: 2017-01-01, endDate: 2017-12-31, note: "52 wks WC pre-2018 — only first 48 wks count per 1992 Act; 4 wks excluded" }
expected:
  days_excluded_from_service: 28
expected_citations:
  - { section: VIC LSL Act 2018 s.57(2), rule: transitional.absence-straddling-or-pre-2018, pdfPage: 34 }
  - { section: VIC LSL Act 1992 s.63, rule: transitional.legacy.illness-injury-48wk-cap, pdfPage: 34 }
```

### TC-VIC-040 — Pre-2018 apprentice → tradesperson re-employed within 12 mo (legacy 12-mo cap)

- **Source**: VIC LSL Act 1992 s.62 (12-month cap preserved for pre-1/11/2018 apprenticeships) per APA p.34
- **Category**: Transitional — apprenticeship transition

```yaml
employee:
  startDate: 2010-07-01
  serviceEvents:
    - type: apprentice_to_tradesperson_transition
      startDate: 2014-06-30
      endDate:   2014-12-15      # ≈ 24 wks gap — under 1992 Act's 12-mo cap → service preserved
      note: "Pre-1/11/2018 apprenticeship; legacy 12-mo rule per s.57"
expected:
  prior_apprentice_service_preserved: true
expected_citations:
  - { section: VIC LSL Act 2018 s.57(2), rule: transitional.pre-2018-apprenticeship-cap-12mo, pdfPage: 34 }
```

### TC-VIC-041 — Pre-2018 employer-initiated termination + rehire after 3 mo (legacy fail)

- **Source**: VIC LSL Act 1992 s.62(2)(g) (3-mo cap pre-2018); APA p.35

```yaml
employee:
  startDate: 2012-05-01
  serviceEvents:
    - type: employer_initiated_termination_and_rehire
      startDate: 2015-06-01
      endDate:   2015-10-01      # 4 mo gap — under 1992 Act's 3-mo cap this BREAKS service (vs 2018 Act's 12-wk cap which would also break it)
expected:
  prior_service_preserved: false
  service_start_used: 2015-10-01
expected_citations:
  - { section: VIC LSL Act 2018 s.57(1), rule: transitional.1992-act-break-preserved, pdfPage: 34 }
  - { section: VIC LSL Act 1992 s.62(2)(g), rule: transitional.legacy.dismissal-rehire-3mo-cap, pdfPage: 35 }
```

---

## §G — Ordinary pay — fixed-rate, varied-hours, commission (s.15, s.16)

### TC-VIC-042 — FT fixed-rate, hours unchanged 5+ yrs → s.15(1)

```yaml
employee: { id: TC-VIC-042, employmentType: full_time, normalWeeklyHours: 38, currentWeeklyGross: 2000.00, /* 10 yrs no variation */ }
expected:
  value_of_week: 2000.00
expected_citations:
  - { section: VIC LSL Act 2018 s.15(1), rule: ordinary-pay.fixed-rate, pdfPage: 39 }
```

### TC-VIC-043 — PT fixed-rate 25h/wk for 8 yrs → s.15(1)

```yaml
employee: { id: TC-VIC-043, employmentType: part_time, normalWeeklyHours: 25, currentWeeklyGross: 750.00, /* 8 yrs no variation */ }
expected:
  value_of_week: 750.00
expected_citations:
  - { section: VIC LSL Act 2018 s.15(1), rule: ordinary-pay.fixed-rate, pdfPage: 39 }
```

### TC-VIC-044 — FT hours changed within last 104 wks → s.16(1)(b) triggers averaging

```yaml
employee:
  id: TC-VIC-044
  employmentType: full_time
  startDate: 2017-05-24
  normalWeeklyHours: 38                       # current
  currentWeeklyGross: 1900.00
  wageHistory:
    # Hours dropped from 38 to 30 in Mar 2025 (within 104 wks of 2026-05-24)
    - { periodStart: 2025-03-01, periodEnd: 2026-05-24, grossPay: 36000.00, frequency: weekly, note: "PT 30h period" }
    - { periodStart: 2017-05-24, periodEnd: 2025-02-28, grossPay: 597100.00, frequency: weekly, note: "FT 38h period" }
expected:
  weekly_avg_52w: 1500.00                     # avg lower due to recent PT
  weekly_avg_260w: 1815.00
  weekly_avg_whole: 1820.00
  value_of_week: 1820.00                      # greatest — whole-period wins
expected_citations:
  - { section: VIC LSL Act 2018 s.16(1)(b), rule: ordinary-pay.hours-changed-in-last-104wks, pdfPage: 41 }
  - { section: VIC LSL Act 2018 s.15(2)(c), rule: ordinary-pay.greater-of-whole-period-avg, pdfPage: 39 }
```

**Notes**

**RESOLVED 2026-05-24 (TBD-VIC-11)**: two-case reading accepted. For employees *without* a fixed ordinary time rate of pay (varied-rate, commission, piece), apply s.15(2) directly on weekly gross. For employees *with* a fixed rate but varied hours (this case), apply s.16 to compute average weekly hours, then multiply by the fixed hourly rate to derive value-of-week. The classifier in `calculateVIC` distinguishes these by wage-history characteristics (stable per-hour gross → fixed-rate path; volatile gross → varied-rate path). TC-VIC-044 keeps the s.16+s.15(2)(c) citation pair.

### TC-VIC-045 — Casual, hours always varied → s.16(2) all three averages computed

(Covered by TC-VIC-014 (Biljana) — cross-referenced here.)

### TC-VIC-046 — Commission-only employee → s.15(2) three averages on gross pay

(Covered by Allan example from APA p.42 — encode as a fresh fixture):

```yaml
employee:
  id: TC-VIC-046
  legalName: Allan
  startDate: 2017-05-24                      # 8 yrs of continuous employment
  endDate: 2025-05-24
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  wageHistory:                                # APA p.42 grid — retainer + commission
    - { periodStart: 2024-05-25, periodEnd: 2025-05-24, grossPay: 90000.00, frequency: other, periodDays: 365 }   # 2024
    - { periodStart: 2023-05-25, periodEnd: 2024-05-24, grossPay: 85000.00, frequency: other, periodDays: 365 }   # 2023
    - { periodStart: 2022-05-25, periodEnd: 2023-05-24, grossPay: 90000.00, frequency: other, periodDays: 365 }   # 2022
    - { periodStart: 2021-05-25, periodEnd: 2022-05-24, grossPay: 95000.00, frequency: other, periodDays: 365 }   # 2021
    - { periodStart: 2020-05-25, periodEnd: 2021-05-24, grossPay: 70000.00, frequency: other, periodDays: 365 }   # 2020
    # earlier periods: 2019:$80k, 2018:$90k, 2017:$75k
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2025-05-24, reason: voluntary_resignation }
expected:
  weekly_avg_52w: 1730.77                      # APA p.42: $90,000/52
  weekly_avg_260w: 1653.85                     # APA p.42: $430,000/260
  weekly_avg_whole: 1622.60                    # APA p.42: $675,000/416
  value_of_week: 1730.77                       # 52-wk wins per APA
  years_of_continuous_service: 8.0000
  total_entitlement_weeks: 6.9333
  total_entitlement_dollars: 11997.84
expected_citations:
  - { section: VIC LSL Act 2018 s.15(2)(a), rule: ordinary-pay.greater-of-52wk-avg, pdfPage: 42 }
```

### TC-VIC-047 — Allowances that form part of contract — included in ordinary pay

```yaml
employee:
  id: TC-VIC-047
  /* FT employee with $1500/wk salary + $200/wk phone allowance in contract */
  currentWeeklyGross: 1700.00                  # salary + allowance bundled
expected:
  value_of_week: 1700.00                       # contractual allowance included
expected_citations:
  - { section: VIC LSL Act 2018 s.15(1), rule: ordinary-pay.fixed-rate, pdfPage: 39 }
  - { section: VIC LSL Act 2018 s.15(1)(b), rule: ordinary-pay.includes-board-or-lodging-cash-value, pdfPage: 39 }
```

**Notes**

APA p.39: "Allowances that form part of the employees' contract e.g. personal use portions of phone or car allowance" are included; overtime and shift penalties are NOT (unless they form part of the contract for varied-hours casuals). Engine MUST accept the user-supplied weekly gross and trust the user has bundled correctly — the calculator does NOT compute whether an allowance "forms part of contract" (that's a legal question).

---

## §H — Workers Comp — s.17 higher-of-rates

### TC-VIC-048 — Jonah, WC at $1,200/wk, pre-injury rate $1,500/wk

- **Source**: APA p.39 (Jonah); VIC LSL Act 2018 s.17(2)

```yaml
employee:
  id: TC-VIC-048
  legalName: Jonah
  /* 10-yr FT employee on workers comp at $1,200/wk current; pre-injury was $1,500/wk */
  currentWeeklyGross: 1200.00
  extraInputs:
    preInjuryWeeklyHours: 38
    preInjuryWeeklyRate: 1500.00
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2025-08-01, endDate: null, note: "Currently on WC at reduced rate" }
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01 }
expected:
  value_of_week: 1500.00                        # s.17(2) — higher of pre-injury or current
  expected_citations:
    - { section: VIC LSL Act 2018 s.17(2), rule: ordinary-pay.workers-comp-higher-of-rates, pdfPage: 39 }
```

### TC-VIC-049 — WC employee whose pre-injury rate was LOWER → current rate used

```yaml
employee:
  /* WC employee on $1,500/wk; pre-injury $1,200/wk */
  currentWeeklyGross: 1500.00
  extraInputs: { preInjuryWeeklyRate: 1200.00 }
expected:
  value_of_week: 1500.00                        # current rate higher
  expected_citations:
    - { section: VIC LSL Act 2018 s.17(2), rule: ordinary-pay.workers-comp-higher-of-rates-current-wins, pdfPage: 39 }
```

---

## §I — Cashing out — HARD ERROR (s.34)

> **Critical**: cashing out LSL during ongoing employment is a criminal offence under VIC LSL Act 2018 s.34. The calculator MUST refuse to produce a numeric result for any cash-out request — for either employer-initiated OR employee-requested cash-outs (s.34(1) and s.34(2) both create offences). The calculator MUST NOT compute a value that could be used to facilitate or document a criminal cashing-out arrangement.
>
> **Lawful payouts** — cashing out at TERMINATION is NOT an offence; s.9 expressly authorises payout on termination of employment. The hard error applies ONLY to `trigger.kind: cash_out`, not to `trigger.kind: termination`.

### TC-VIC-050 — Cash-out attempt on 8-yr employee → HARD ERROR

- **Source**: VIC LSL Act 2018 s.34; spec F5 + AC5
- **Category**: Hard error — cash-out prohibition

**Inputs**

```yaml
employee:
  id: TC-VIC-050
  legalName: CashOutAttemptFixture
  startDate: 2018-05-24
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1700.00
  wageHistory: [...]
  serviceEvents: []
trigger: { kind: cash_out, cashOutDate: 2026-05-24 }
```

**Expected output**

```yaml
status: failed
outputs: null
error:
  code: vic_cashout_prohibited
  userMessage: "Cashing out long service leave during employment is a criminal offence in Victoria under section 34 of the Long Service Leave Act 2018. The calculator cannot produce a value for a cash-out scenario. To pay out unused LSL at the end of employment, use the termination trigger instead. To allow an employee to take leave and continue working at a reduced pay, see the half-pay option under section 22."
  legalSource: "VIC LSL Act 2018 s.34"
expected_citations:
  - { section: VIC LSL Act 2018 s.34, rule: cash-out.criminal-offence-prohibited, pdfPage: 47, note: "12 penalty units natural person / 60 penalty units body corporate" }
  - { section: VIC LSL Act 2018 s.9,  rule: cash-out.lawful-alternative.termination-payout, pdfPage: 43 }
  - { section: VIC LSL Act 2018 s.22, rule: cash-out.lawful-alternative.half-pay, pdfPage: 47 }
page_event:
  name: vic_cashout_hard_error
  payload: null   # MUST NOT log input PII per spec S2
```

**Notes**

CRITICAL: APA training PDF p.47 cites this as "s.67" but the **authorised Act text** (Section 34 of the 2018 Act, in Part 3 Division 3 — Offences) is the correct citation. APA's citation is wrong. Engine MUST cite s.34. **RESOLVED 2026-05-24 (TBD-VIC-12)**: E2 spec v0.3.1 corrects every "s.67" reference to "s.34". The APA training PDF on disk still has the s.67 error and is surfaced to APA's training team as an external correction request (see "External: APA training PDF correction" in the Resolutions section above). Not a launch blocker for the calculator.

The page-event payload MUST be null — the spec's S2 requires that no input PII is logged for hard-error cases. Engine MUST emit `vic_cashout_hard_error` with `payload: null` only.

### TC-VIC-051 — Cash-out attempt on 5-yr employee → HARD ERROR (no sub-7-yr exception)

Identical shape to TC-VIC-050 but with 5-yr tenure. The hard error fires regardless of accrued amount — the criminality is independent of whether entitlement exists. Even an under-7-yr employee with $0 accrued value cannot be "cashed out".

```yaml
employee: { startDate: 2021-05-24, /* 5 yrs */ }
trigger: { kind: cash_out, cashOutDate: 2026-05-24 }
expected:
  status: failed
  error.code: vic_cashout_prohibited
```

### TC-VIC-052 — Cash-out attempt on 15-yr employee → HARD ERROR (long tenure no exception)

```yaml
employee: { startDate: 2011-05-24, /* 15 yrs */ }
trigger: { kind: cash_out, cashOutDate: 2026-05-24 }
expected:
  status: failed
  error.code: vic_cashout_prohibited
```

### TC-VIC-053 — Termination trigger with reason indicating cash-out intent (e.g. dummy termination) — STILL LAWFUL

- **Source**: VIC LSL Act 2018 s.9 + s.23 contracting-out prohibition

**Inputs**

```yaml
employee: { startDate: 2014-05-24, employmentType: full_time, currentWeeklyGross: 1700.00, /* 12 yrs */ }
trigger: { kind: termination, terminationDate: 2026-05-24, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
total_entitlement_weeks: 10.4000
total_entitlement_dollars: 17680.00
expected_citations:
  - { section: VIC LSL Act 2018 s.9(1)(b), rule: trigger.termination.payable-on-day-of-termination, pdfPage: 43 }
```

**Notes**

The calculator does NOT police whether a termination is a sham designed to facilitate a cash-out. That's a legal/factual question outside the calculator's scope. The engine processes any termination trigger as a lawful payout per s.9. A separate citation referencing s.23 (contracting-out prohibited) MAY be emitted as a non-blocking warning if the engine detects the same employee re-appearing in subsequent calculations with a new start date within 12 weeks — but this is an audit-replay-pattern (E3 epic) not a v1-calculator concern.

---

## §J — Public holiday during LSL (s.7)

### TC-VIC-054 — Jan 26 PH falls during LSL window → extends leave by 1 day

- **Source**: VIC LSL Act 2018 s.7; APA p.37 Jan-24 example
- **Category**: Single mode — taking_leave with PH

**Inputs**

```yaml
employee: { id: TC-VIC-054, /* 10-yr FT employee */ }
trigger:
  kind: taking_leave
  leaveStartDate: 2024-01-24    # Wed
  leaveWeeks: 1                  # but actual elapsed = 7 days because PH extends
extraInputs:
  publicHolidaysInWindow: [2024-01-26]   # Australia Day Friday
```

**Expected output**

```yaml
lsl_days_consumed: 4              # Wed 24, Thu 25, Mon 29, Tue 30 — Fri 26 is PH so not consumed
calendar_leave_end_date: 2024-01-30
expected_citations:
  - { section: VIC LSL Act 2018 s.7, rule: trigger.taking-leave.public-holiday-exclusive, pdfPage: 37 }
```

**Notes**

Identical behaviour to NSW (TC-NSW-018). VIC s.7: "Long service leave does not include any public holiday occurring, or annual leave taken, during the period when the long service leave is taken." Engine MUST treat the `publicHolidaysInWindow` array as authoritative; no built-in holiday calendar in v1.

---

## §K — As-at snapshot trigger

### TC-VIC-055 — 5 yrs as-at snapshot → reports 4.33 wks accrued (regardless of pay-out eligibility)

- **Source**: F11 + D20 from E1 spec — as-at bypasses pro-rata thresholds for snapshot
- **Category**: As-at — sub-7-yr accrued

**Inputs**

```yaml
employee:
  id: TC-VIC-055
  startDate: 2021-05-24
  employmentType: full_time
  statesOfService: [VIC]
  governingJurisdiction: VIC
  currentWeeklyGross: 1500.00
  wageHistory: [...]
  serviceEvents: []
trigger: { kind: as_at, asAtDate: 2026-05-24 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 5.0000
total_entitlement_weeks: 4.3333                # 5 × 8.6667/10 — accrued snapshot per spec D20
value_of_week: 1500.00
total_entitlement_dollars: 6499.95
payable_indicator: "accrued, not currently payable"
warnings:
  - { code: accrued_not_currently_payable, message: "Accrued LSL snapshot for liability/audit reporting. Employee is below the 7-year threshold under VIC LSL Act 2018 s.6 and is not currently entitled to take or be paid out this value." }
expected_citations:
  - { section: VIC LSL Act 2018 s.6, rule: accrual.snapshot.no-pro-rata-threshold, pdfPage: 32, note: "as-at snapshot per E1 spec D20 — qualifying-period threshold NOT applied" }
```

**Notes**

Same as-at semantics as NSW (TC-NSW-037/038). The accrued value is reported for liability/audit purposes regardless of whether the employee is currently entitled to take or be paid out.

### TC-VIC-056 — 8 yrs as-at snapshot → 6.9333 wks (above qualifying threshold)

```yaml
trigger: { kind: as_at, asAtDate: 2026-05-24 }
employee: { startDate: 2018-05-24, /* 8 yrs */ }
expected:
  status: computed
  total_entitlement_weeks: 6.9333
  payable_indicator: "payable"
```

---

## §L — Cross-jurisdiction (VIC + other state)

### TC-VIC-057 — VIC + NSW service, NSW nominated as governing → routed to NSW engine

- **Source**: VIC LSL Act 2018 + NSW LSA + spec F13; sufficiently-connected test (APA PDF p.138) is legal judgement

```yaml
employee:
  id: TC-VIC-057
  startDate: 2018-05-24
  employmentType: full_time
  statesOfService: [VIC, NSW]
  governingJurisdiction: NSW
  currentWeeklyGross: 1800.00
  wageHistory: [...]
  serviceEvents: []
trigger: { kind: as_at, asAtDate: 2026-05-24 }
expected:
  status: computed
  state_used: NSW                              # NSW engine ran, NOT VIC
  total_entitlement_weeks: 6.9334              # 8 × 8.6667/10 — NSW snapshot (no NSW pro-rata threshold in as_at per D20)
  warnings:
    - code: cross_jurisdiction_pending
      message: "Employee has worked in VIC and NSW. The sufficiently connected test (legal judgement, not arithmetic — see APA LSL Masterclass p.138) is for legal counsel where doubt exists. Engine has computed using user-nominated governing jurisdiction: NSW."
```

### TC-VIC-058 — VIC + QLD service, governing NOT nominated → BLOCKED

```yaml
employee: { statesOfService: [VIC, QLD], governingJurisdiction: null }
expected:
  status: blocked_cross_jurisdiction
  outputs: null
  warnings:
    - code: cross_jurisdiction_pending
      message: "Employee has worked in VIC and QLD. Please nominate the governing jurisdiction to proceed."
```

**Notes**

In v1's VIC-only-released-after-NSW timeline, the user MAY nominate either VIC or NSW. If they nominate QLD, the calculator returns a "QLD not yet supported" error per E2 spec F17. Engine MUST detect unencoded-state nominations.

---

# Bulk-mode test cases

### TC-VIC-BULK-001 — 5-employee mixed VIC fixture, all under 2018 Act

- **Source**: spec F17 + AC16; impl-plan §2 / Phase 2 (bulk mixed-state foundation)
- **Category**: Bulk mode — VIC-only mixed-pattern

**Inputs (CSV — abbreviated)**

```csv
employee_id,row_type,state,start_date,employment_type,trigger,trigger_date,period_start,period_end,gross_pay,period_frequency,service_event_type,service_event_start,service_event_end
V01,pay_period,VIC,2014-05-24,full_time,as_at,2026-05-24,2025-05-25,2026-05-24,98000.00,weekly,,,                           # 12 yr FT
V02,pay_period,VIC,2018-05-24,full_time,as_at,2026-05-24,2025-05-25,2026-05-24,78000.00,weekly,,,                           # 8 yr FT — just over threshold
V03,pay_period,VIC,2017-05-24,part_time,as_at,2026-05-24,2025-05-25,2026-05-24,39000.00,weekly,,,                           # 9 yr PT
V04,pay_period,VIC,2015-05-24,casual,as_at,2026-05-24,2025-05-25,2026-05-24,55000.00,other,,,                               # 11 yr casual varied hours
V05,pay_period,VIC,2020-05-24,full_time,as_at,2026-05-24,2025-05-25,2026-05-24,78000.00,weekly,,,                           # 6 yr FT — UNDER threshold → $0
```

**Expected output**

```yaml
total_rows: 5
status_breakdown: { computed: 5, blocked: 0, failed: 0 }
row_results:
  V01: { state_used: VIC, total_entitlement_weeks: 10.4000, dollars: 19600.00 }   # 12 × 8.6667/10 × $1,884.62/wk
  V02: { state_used: VIC, total_entitlement_weeks: 6.9333,  dollars: 10399.95 }   # 8 × 8.6667/10 × $1,500/wk
  V03: { state_used: VIC, total_entitlement_weeks: 7.8000,  dollars: 5850.00 }    # 9 × 8.6667/10 × $750/wk
  V04: { state_used: VIC, total_entitlement_weeks: 9.5333,  dollars: 10086.63 }   # 11 × 8.6667/10 × greater-of avg
  V05: { state_used: VIC, total_entitlement_weeks: 5.2000,  dollars: 7800.00 }    # 6 × 8.6667/10 — as-at snapshot per D20
all_rows_have_state_used_VIC: true
```

### TC-VIC-BULK-002 — 8-employee mixed NSW + VIC, mandatory `state` column

- **Source**: spec F17 RES-4; AC16

```csv
employee_id,row_type,state,start_date,...
NV01,pay_period,NSW,2014-05-24,full_time,...
NV02,pay_period,VIC,2018-05-24,full_time,...
NV03,pay_period,NSW,2015-05-24,casual,...
NV04,pay_period,VIC,2017-05-24,part_time,...
NV05,pay_period,nsw,2020-05-24,full_time,...           # lowercase — should normalise
NV06,pay_period,Vic,2014-05-24,full_time,...           # mixed case — should normalise
NV07,pay_period,,2019-05-24,full_time,...              # EMPTY state — row-level validation error
NV08,pay_period,XYZ,2019-05-24,full_time,...           # UNRECOGNISED state — row-level validation error
```

**Expected output**

```yaml
total_rows: 8
status_breakdown: { computed: 6, blocked: 0, failed: 2 }
row_results:
  NV01: { state_used: NSW, status: computed }
  NV02: { state_used: VIC, status: computed }
  NV03: { state_used: NSW, status: computed }
  NV04: { state_used: VIC, status: computed }
  NV05: { state_used: NSW, status: computed }     # case-normalised
  NV06: { state_used: VIC, status: computed }     # case-normalised
  NV07: { status: failed, error: { code: state_missing_or_empty, userMessage: "Row 7: `state` column value is empty. Required values: NSW or VIC (more states coming). Set the row's state and re-upload, OR remove the row." } }
  NV08: { status: failed, error: { code: state_unrecognised_or_not_yet_encoded, userMessage: "Row 8: state \"XYZ\" is not recognised or not yet encoded in this version. Currently encoded: NSW, VIC. Set the row's state and re-upload, OR remove the row." } }
```

**Notes**

Per spec RES-4 F17: missing column header is a batch-level error (whole batch rejected before any row is calculated). Per-row missing/unrecognised values surface as row-level failures while valid rows continue to process. Test asserts both paths.

### TC-VIC-BULK-003 — VIC cash-out attempt mid-batch → row-level hard error, batch continues

- **Source**: spec F5 + RES-4 (mixed-state batches preserve per-row resilience)

```csv
employee_id,row_type,state,trigger,trigger_date,...
CO01,pay_period,VIC,as_at,2026-05-24,...                  # normal
CO02,pay_period,VIC,cash_out,2026-05-24,...               # HARD ERROR — s.34
CO03,pay_period,NSW,as_at,2026-05-24,...                  # normal
CO04,pay_period,VIC,termination,2026-05-24,...            # normal — termination is lawful
```

**Expected output**

```yaml
total_rows: 4
status_breakdown: { computed: 3, blocked: 0, failed: 1 }
row_results:
  CO01: { state_used: VIC, status: computed }
  CO02:
    state_used: VIC
    status: failed
    error: { code: vic_cashout_prohibited, userMessage: "..." }
    cta: "Use the termination trigger to pay out unused LSL at the end of employment, OR remove this row."
  CO03: { state_used: NSW, status: computed }
  CO04: { state_used: VIC, status: computed }
batch_outcome: "completed with 1 row-level failure; 3 rows computed successfully"
```

**Notes**

The s.34 hard error MUST be per-row, not batch-aborting. Bulk users may have a mixture of valid and invalid rows; the invalid ones surface separately (per AC19 NSW pattern, extended to per-state hard errors).

---

# Coverage matrix

| Spec / source item | Covered by |
|---|---|
| **VIC LSL Act 2018 s.6** — qualifying period (7yr) + accrual ratio (1/60) | TC-VIC-001, TC-VIC-002, TC-VIC-016, TC-VIC-020 |
| **VIC LSL Act 2018 s.7** — public holidays during LSL | TC-VIC-054 |
| **VIC LSL Act 2018 s.8** — leave in advance | Coverage out of v1 scope; TBD-VIC-13 |
| **VIC LSL Act 2018 s.9** — payment on termination | TC-VIC-001 through TC-VIC-026 (all termination cases) |
| **VIC LSL Act 2018 s.10** — death of employee | TC-VIC-018, TC-VIC-025 |
| **VIC LSL Act 2018 s.11** — transfer of business / one-employer | TC-VIC-011, TC-VIC-029 |
| **VIC LSL Act 2018 s.12** — continuous employment + breaks | TC-VIC-004 → TC-VIC-010, TC-VIC-030, TC-VIC-031 |
| **VIC LSL Act 2018 s.13** — what counts as service | TC-VIC-003, TC-VIC-027, TC-VIC-028, TC-VIC-032, TC-VIC-033, TC-VIC-034 |
| **VIC LSL Act 2018 s.14** — what does NOT count as service | TC-VIC-035, TC-VIC-036, TC-VIC-030, TC-VIC-031 |
| **VIC LSL Act 2018 s.15** — ordinary pay (fixed + 3-tier greater-of) | TC-VIC-042 → TC-VIC-047 |
| **VIC LSL Act 2018 s.16** — hours-changed averaging formulas | TC-VIC-014, TC-VIC-044, TC-VIC-045 |
| **VIC LSL Act 2018 s.17** — workers comp value-of-week | TC-VIC-048, TC-VIC-049 |
| **VIC LSL Act 2018 s.18** — employee may request leave | TC-VIC-012 (taking_leave path) |
| **VIC LSL Act 2018 s.19** — employer-directed leave | Coverage out of v1 scope; not encoded |
| **VIC LSL Act 2018 s.20** — payment timing | TC-VIC-012 |
| **VIC LSL Act 2018 s.22** — half-pay option | Coverage out of v1 scope; TBD-VIC-13 |
| **VIC LSL Act 2018 s.23** — contracting out prohibited | TC-VIC-053 |
| **VIC LSL Act 2018 s.34** — payments in lieu forbidden (CASH-OUT HARD ERROR) | TC-VIC-050 → TC-VIC-053 |
| **VIC LSL Act 2018 s.35** — working elsewhere during LSL | Coverage out of v1 scope (not a calculation question); citation note only |
| **VIC LSL Act 2018 s.57** — transitional (1992 Act preserved) | TC-VIC-037 → TC-VIC-041 |
| **VIC LSL Act 1992 s.62 / 62A / 63** — legacy provisions preserved via s.57 | TC-VIC-038, TC-VIC-039, TC-VIC-040, TC-VIC-041 |
| **E2 spec F5 / AC5** — VIC cash-out hard error | TC-VIC-050 → TC-VIC-053 |
| **E2 spec F12 / AC10** — VIC dual-regime (pre/post-1/11/2018) | TC-VIC-037 → TC-VIC-041 (transitional cases) |
| **E2 spec F13 / AC14** — cross-jurisdictional governing-state nomination | TC-VIC-057, TC-VIC-058 |
| **E2 spec F17 / AC16** — mixed-state bulk CSV with per-row state column | TC-VIC-BULK-002 |
| **E2 spec F18** — state selector persists | not unit-tested here — RTL/Playwright |
| **E2 spec AC1 / AC2** — per-state rule set + test suite | this file + the encoded fixtures |
| **E2 spec AC4 / AC4a / AC4b** — PM sign-off + per-state launch gate | this file's PM signature line |

---

# Items flagged `TBD-VIC-NN` — ✅ RESOLVED by PM 2026-05-24

All 13 items below are resolved. Resolutions are folded into the relevant test cases above and summarised in the **Resolutions** section at the top of this file. This section is preserved as the audit record of the questions originally raised.

### TBD-VIC-01 — [Severity 1] Dual-regime interpretation — ✅ RESOLVED 2026-05-24

**Question**: Does the VIC "dual regime" actually mean two parallel entitlement-formula engines (one applying 1992 Act, one applying 2018 Act, summed across the employee's tenure)? Or does it mean a single 2018 Act entitlement formula with per-absence rule selection (1992 rules for absences started pre-1/11/2018, 2018 rules for absences started on/after)?

**My reading**: The latter. The 2018 Act s.6 unambiguously calculates entitlement on "the employee's total period of continuous employment" — singular, undivided. The transitional rules in s.57 affect what absences count toward continuous employment, not how the entitlement weeks are calculated.

**What this changes**: If the latter is correct (my reading), the impl-plan §3 reference to "`rules-pre-2018/` and `rules-post-2018/` two sub-rule-sets" should be re-scoped as "two continuous-service-rule modules, both feeding the same accrual formula" rather than "two parallel entitlement engines". The data shape in the engine is simpler: one rule set with date-aware continuous-service handling, not two cloned rule sets.

**Decision needed by**: T3.1 (rule-set scaffold).

### TBD-VIC-02 — [Severity 2] Casual under-12-wk gap and accrual — ✅ RESOLVED 2026-05-24

**Question**: For TC-VIC-006 (Jennifer, casual on 2-mo holiday), does the gap count toward accrual? APA p.33 says unpaid leave up to 52 wks "does count" — implying it counts as service AND adds to accrual. But casual accrual is typically based on hours worked (s.16), which would be zero during a holiday gap. Is the engine accruing on calendar time or on hours worked?

**My reading**: For casuals, accrual is implicitly "hours-based" (since s.16 uses hours averaging). The gap preserves continuity (s.12(3)) but does not add hours.

**Decision needed by**: T3.2.

### TBD-VIC-03 — [Severity 2] Engine warning code for VIC 12-wk gap — ✅ RESOLVED 2026-05-24

**Question**: TC-VIC-010 reuses NSW's `gap_exceeds_2mo` warning code. Should the engine introduce a VIC-specific code like `gap_exceeds_12wks_vic`, or keep a state-agnostic `gap_breaks_continuity` code with state-specific message?

**Recommendation**: State-agnostic code with state-specific message text. The `Warning.code` enum in `engine/types.ts` currently has `gap_exceeds_2mo` which is NSW-specific by name. Replace with `gap_exceeds_state_tolerance` in a follow-up to keep the engine portable.

**Decision needed by**: T3.2 + a small engine-types refactor task.

### TBD-VIC-04 / TBD-VIC-05 — [Severity 2] APA practice activities expected values — ✅ RESOLVED 2026-05-24

**Question**: APA Practice 2(A)/(B)/(C) are blank-template exercises. The expected values in TC-VIC-012/013/014 are PM-derived, not APA-verbatim. Should these be (a) accepted as PM-derived gold-standard, (b) computed by an independent VIC payroll specialist for cross-validation, or (c) marked as "engine-output trust" fixtures with shape-only assertions?

**Recommendation**: (a) PM-derived — verbatim formula application from APA-published rules. Same model used for NSW Practice 1(C) (Bevan). The gold-standard suite covers the calculation logic, not the APA training's specific worked answer.

**Decision needed by**: PM sign-off of this document.

### TBD-VIC-06 — [Severity 2] 7-year boundary inclusivity — ✅ RESOLVED 2026-05-24

**Question**: Is "after completing 7 years of continuous employment" (s.6) inclusive at exactly 7 years 0 days, or does it require strictly more than 7 years?

**My reading**: Inclusive at the exact 7-year boundary. APA training p.32 example uses 10 years as the input and the answer assumes the entitlement exists at exactly 10 years — analogous reasoning applies to 7 years.

**Decision needed by**: T3.2.

### TBD-VIC-07 — [Severity 3] Sub-7-year UI advisory for death/illness — ✅ RESOLVED 2026-05-24

**Question**: When trigger = death/illness at sub-7-yr tenure (TC-VIC-018), should the engine emit a UI advisory pointing the user to potential award/EA top-ups?

**Recommendation**: Yes — non-blocking warning. The calculator's role ends at statute; the user is best served by being reminded that statutory may not be the full picture.

**Decision needed by**: T3.5 (UI integration).

### TBD-VIC-08 — [Severity 1] LWOP cumulative vs per-period 52-wk cap — ✅ RESOLVED 2026-05-24

**Question**: Does the s.13(1)(b) 52-wk-counts-as-service cap apply (a) per LWOP period, (b) cumulatively across all LWOP periods in a calendar/service year, or (c) cumulatively across the entire period of continuous employment?

**My reading**: The Act is genuinely ambiguous. (a) is the most generous reading (each period independent), (c) is the strictest. (b) is somewhere between. The plain text says "if a period of unpaid leave is less than or is 52 weeks, that period [counts]" — strongly suggests (a) per-period.

**Recommendation**: (a) per-period. Engine treats each `leave_without_pay` event independently. PM to confirm — possibly with a WIV phone consultation.

**Decision needed by**: T3.2 (this is in the core continuous-service rule set).

### TBD-VIC-09 — [Severity 3] Olivia day-precise vs month-rounded arithmetic — ✅ RESOLVED 2026-05-24

**Question**: APA p.33 says "6 months excluded" for Olivia. Day-precise arithmetic gives 184 days = 6.07 months. Acceptable rounding difference?

**Recommendation**: Yes — engine computes day-precise; APA's "6 months" is shorthand. Document this in the fixture notes (already done in TC-VIC-037).

**Decision needed by**: PM sign-off.

### TBD-VIC-10 — [Severity 2] 1992 Act citation precision for break-of-service — ✅ RESOLVED 2026-05-24

**Question**: The exact 1992 Act sections governing pre-2018 LWOP and break-of-service are paraphrased from APA training (p.34–35) rather than quoted from the 1992 Act directly. Is APA's account accepted as authoritative for citation purposes, or should the engine cite the 1992 Act sections directly (which would require pulling the 1992 Act text — not done in this research pass)?

**Recommendation**: Cite APA training pages as the practical source-of-truth for these legacy provisions (the 1992 Act is repealed; APA training is the operational compendium). Engine emits citations like `{ section: "VIC LSL Act 1992 s.62(2)(g)", rule: "...", pdfPage: 35, note: "Per APA LSL Masterclass; legacy provision preserved via 2018 Act s.57" }`.

**Decision needed by**: T3.2.

### TBD-VIC-11 — [Severity 2] s.15 vs s.16 — rate computation when hours have changed — ✅ RESOLVED 2026-05-24

**Question**: When hours have changed within the last 104 weeks (s.16(1)(b)), is the rate-of-pay computed as (a) `avg_hours × current_hourly_rate`, or (b) the greater of three averages of weekly gross pay computed using s.15(2)? APA p.41 and p.42 give different examples.

**My reading**: For employees without a fixed ordinary time rate of pay (varied-rate, commission, piece), apply s.15(2) directly on weekly gross. For employees with a fixed rate but varied hours, apply s.16 to compute average weekly hours, then multiply by the fixed rate to get value-of-week.

**Decision needed by**: T3.2 (this distinction drives the engine's classifier logic for VIC).

### TBD-VIC-12 — [Severity 1] E2 spec citation correction — cashing-out section number — ✅ RESOLVED 2026-05-24

**Question**: E2 spec v0.3.0 (`.specify/features/002-all-state-coverage/spec.md`) at AC5 / F5 cites cashing-out as "LSL Act 2018 (Vic) s.67". The authorised Act text in fact places the cashing-out prohibition at **s.34** (Part 3 Division 3 — Offences). The APA training PDF also incorrectly cites s.67 (p.47).

**Recommended action**: Correct the E2 spec from s.67 to s.34 before T3.2. This is a one-line edit to the spec but it's load-bearing for the engine's hard-error citation block.

**Decision needed by**: Immediately — spec correction.

### TBD-VIC-13 — [Severity 3] s.8 leave in advance and s.22 half-pay — v1 scope — ✅ RESOLVED 2026-05-24

**Question**: Are s.8 (leave in advance) and s.22 (half-pay) in v1 scope, or deferred?

**Recommendation**: Both deferred from v1. Engine MUST recognise these triggers exist (citation note in the cash-out hard error suggests s.22 as a lawful alternative) but does NOT compute scenarios involving them. Trigger types `leave_in_advance` and `half_pay` are out of v1 — any such request returns an `unsupported_in_v1` error.

**Decision needed by**: T3.5.

---

## Provisions deliberately deferred from v1 VIC encoding

| Provision | Reason for deferral |
|---|---|
| **VIC LSL Act 2018 s.8** — leave in advance | Out of v1 trigger scope. v1 supports `taking_leave`, `termination`, `as_at`, `cash_out` (the latter is hard-error only). |
| **VIC LSL Act 2018 s.19** — employer-directed leave | Not a calculator question — the calculator computes value of leave once a trigger fires; who initiated the leave is irrelevant to the value. |
| **VIC LSL Act 2018 s.22** — half-pay | Doubled-duration-at-half-rate is a presentation transformation, not a value change. v1 reports the full-rate weeks; the user can derive half-pay by doubling. Re-evaluate in v2. |
| **VIC LSL Act 2018 s.35** — working elsewhere during LSL | Compliance question, not a calculation. Surface as citation note only when trigger = `taking_leave`. |
| **VIC LSL Act 2018 s.37** — record-keeping | Operational obligation on the employer, not a calculator concern. |
| **VIC LSL Act 2018 Part 4 (s.45-47)** — preservation of superior LSL entitlements (industry awards) | An employee covered by an industry-specific LSL award (cleaning, security, etc.) may have higher entitlements. Calculator computes the statutory minimum only; superior-award handling is deferred. Surface as advisory when applicable industry detected via input. |
| **Industry awards** referenced at APA p.30 — contract cleaning, security, community services | Same as above; out of v1. The seven applicable awards each have their own LSL rules; encoding them is a separate epic. |

---

## Signature line

```
Signed: Tracy Angwin (PM) — 2026-05-24
```

> PM-only sign-off per E2 spec RES-6 / AC4. No APA-specialist co-signer required. Signature here completes T3.0 and unblocks T3.1 (rule-set scaffold). All 13 TBDs resolved — see Resolutions section at top.

---

*End of test-cases-vic.md v1.0 — PM-signed-off 2026-05-24.*
