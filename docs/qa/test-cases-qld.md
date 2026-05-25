# QLD LSL Calculator — Gold-Standard Test Cases

**Status**: SIGNED OFF · Tracy Angwin (PM) · 2026-05-25
**Version**: v1.1
**Date**: 2026-05-25 (v1.0); revised 2026-05-25 (v1.1 — DEV-CROSS-1 deferred fixtures reinstated)
**Spec**: `.specify/features/002-all-state-coverage/spec.md` v0.3.1
**Impl plan**: `.specify/features/002-all-state-coverage/impl-plan.md` Phase 4 (QLD)
**Tasks**: `.specify/features/002-all-state-coverage/tasks.md` T4.0 (SIGNED OFF — T4.1 onwards unblocked)
**Source-of-truth Act**: *Industrial Relations Act 2016* (Qld) — Chapter 2 Part 3 Division 9 (sections 93–110) + Chapter 2 Part 3 Division 12 (section 134 — general continuity of service)

> **PM sign-off**: Tracy Angwin · 2026-05-25. All 6 TBDs resolved (see **Resolutions** section immediately below). T4.1 (QLD rule-set scaffold) is unblocked for the developer agent.
>
> **v1.1 amendment (2026-05-25)** — DEV-CROSS-1 (the state-agnostic termination-reason enum + initiator refactor) merged in PR #14. The 5 fixtures that were deferred in v1.0 (TC-QLD-005, -007, -008, -015, -016) have been reinstated as active QLD launch-gate fixtures. The previous "Deferred to cross-state termination-enum refactor" appendix has been removed; a one-line historical note has been left in its place. All 5 reinstated fixtures pass the engine gold-standard test on first run with no engine code changes.

---

## Resolutions

This section records the PM resolutions applied on 2026-05-25 for each TBD raised during the v1.0-draft research pass. The original TBD register is preserved further below for traceability.

### TBD-QLD-01 — [Severity 1] 15-year accrual + threshold inclusivity → RESOLVED

**Operator decision (Tracy Angwin, 2026-05-25)**: **Accept PM's reading.** Accrual is continuous at 1/60 — no discrete step at 15 yrs. The 13-week figure at 15 yrs is the arithmetic outcome (15 × 8.6667/10 = 13.00005 ≈ 13.0), not a separate accrual band. Thresholds (7, 10, 15 yrs) are **inclusive** at exact-day boundary — same as VIC's resolved 7-yr inclusivity.

**Engine encoding**: `years_of_continuous_service >= 7.0000`, `>= 10.0000`, `>= 15.0000`. Accrual formula `years × 8.6667 / 10` applied continuously across all tenure bands ≥ 10 yrs. TC-QLD-047 and TC-QLD-048 expected outputs reflect the continuous reading and are unchanged.

### TBD-QLD-02 — [Severity 1] Historical cliffs (s.96 general, s.103 casual) → RESOLVED

**Operator decision (Tracy Angwin, 2026-05-25)**: **Accept PM's reading.**
- **s.103 (30 March 1994 casual cliff)**: HARD-ANCHOR. Engine MUST anchor casual service to 1994-03-30 when `employmentType = 'casual' && startDate < 1994-03-30`. The Act language is unambiguous and the cliff is operationally meaningful for long-tenure casuals.
- **s.96 (23 June 1990 general cliff)**: ADVISORY-ONLY. Engine uses the actual start date in the accrual computation and emits a `pre_1990_service_advisory_qld` warning when `startDate < 1990-06-23`. Rationale: the cliff carves out a transitional exception that may or may not engage depending on industrial-award history; the calculator cannot adjudicate that and so surfaces the advisory and proceeds with the user-supplied date. In practice the cliff is moot for current calculations (pre-1990 starters have 35+ years of post-cliff service to draw on).
- **TC-QLD-038 transition (casual-to-permanent)**: the cliff applies only to the casual portion. Permanent service from the transition date onward counts fully; pre-1994 casual hours are excluded.

**Engine encoding**: see `continuous-service-rules.ts` per-state file (T4.2). Fixtures TC-QLD-035 (advisory only), TC-QLD-036 (hard-anchor to 1994-03-30), TC-QLD-037 (no cliff for permanent pre-1990 starter — advisory only), TC-QLD-038 (casual-portion-only cliff) all stand as drafted.

### TBD-QLD-03 — [Severity 2] Casual rate-of-pay averaging window → RESOLVED

**PM recommendation applied (Tracy Angwin, 2026-05-25)**: single **52-week lookback** per Business QLD's published formula `(total ordinary hours ÷ 52) × 8.6667 ÷ 10` and RosterElf's worked examples. NOT a 3-tier "greater of" like VIC s.15(2). This matches the simpler s.105 statutory wording and the explicit Business QLD guidance.

**Engine encoding**: QLD `value-of-week.ts` reads `hoursLast52Weeks` (already on the Employee shape, used by VIC's casual path), divides by 52, multiplies by the loaded hourly rate per s.105. No `weekly_avg_52w / 260w / whole` triplet required for QLD — simpler than VIC. Fixtures TC-QLD-009, TC-QLD-024, TC-QLD-042 expected `weekly_avg` values stand as drafted.

**No architectural surprise**: the engine already supports a 52-wk-only path (NSW casual handling); QLD reuses that pattern.

### TBD-QLD-04 — [Severity 2] Cash-out advisory granularity → RESOLVED

**PM recommendation applied (Tracy Angwin, 2026-05-25)**:
1. **NO user-supplied s.110 ground required.** The calculator computes the value; the legal authority (industrial instrument vs QIRC order on financial hardship / compassionate grounds) is the user's responsibility. A single advisory message covers all s.110 grounds.
2. **YES emit BOTH a base s.110 advisory AND a sub-10-yr-specific advisory** when `years_of_continuous_service < 10`. Strengthens user awareness that pre-10-yr cash-out is rarely authorised by industrial instrument and typically requires a QIRC order.
3. **Pass through with $0 at sub-7-yr** (TC-QLD-051). The calculator does not refuse the cash_out trigger; it surfaces that there's nothing to cash out via the `sub_7yr_no_entitlement_qld` warning plus a `qld_cashout_no_entitlement_to_cash_out` advisory.

**Engine encoding**: trigger-handlers.ts emits the warning codes per the fixture expectations. Fixtures TC-QLD-049, TC-QLD-050, TC-QLD-051, TC-QLD-052 all stand as drafted.

**No architectural surprise**: the warning-emission pattern is identical to NSW/VIC; only the message text and code names are QLD-specific.

### TBD-QLD-05 — [Severity 2] Workers Compensation rate of pay → RESOLVED

**Operator decision (Tracy Angwin, 2026-05-25)**: **Accept PM's reading.** Apply the literal s.98 ordinary-rate-at-leave-time. QLD has NO equivalent of VIC s.17 "higher of pre-injury rate or current rate" — the engine pays LSL at whatever rate is in force when the leave is taken, even if that is a temporarily reduced WC rate.

**Additional engine behaviour (added per operator instruction)**: emit a non-blocking warning when a `workers_comp_absence` event overlaps the LSL trigger date OR when the trigger date falls within an active WC episode. Warning code: `qld_lsl_calculated_at_wc_reduced_rate_warning`. Message text: *"LSL has been calculated at the rate in force at the time leave is taken under QLD IR Act 2016 s.98. The employee appears to be on workers compensation at a reduced rate. If feasible, defer taking LSL until the employee is back on their ordinary rate; QLD has no statutory higher-of-rates equivalent to VIC s.17."*

**Engine encoding**: QLD `value-of-week.ts` always returns the current rate (no auto-uplift). `trigger-handlers.ts` checks for WC-event overlap with the trigger window and emits the advisory warning where applicable. TC-QLD-029 expected `value_of_week` is `1800.00` (current rate); the fixture now also expects the new warning code.

**No architectural surprise**: same pattern as VIC's cashing-out warning; one new warning code added.

### TBD-QLD-06 — [Severity 2] Termination-reason enum design → RESOLVED via cross-state refactor (DEV-CROSS-1 merged)

**Operator decision (Tracy Angwin, 2026-05-25)**: **Spin off as a separate cross-state PR.** Do NOT bundle the termination-reason enum redesign into the QLD per-state PR. The redesign applies to WA/SA/TAS/ACT/NT as well (each has analogous qualifying-reason taxonomies) and belongs in a state-agnostic refactor.

**Engine encoding (final)**: `TerminationReason` is now an additive cross-state enum (`voluntary_resignation`, `employer_initiated_not_misconduct`, `redundancy`, `serious_misconduct`, `illness_incapacity`, `domestic_pressing_necessity`, `death`, `unfair_dismissal`, `poor_performance`) with an optional `terminationInitiator: 'employee' | 'employer'` on the termination trigger. Delivered in **DEV-CROSS-1** (PR #14, merged 2026-05-25 — commit `bd2d284`).

**v1.1 update (2026-05-25)**: With DEV-CROSS-1 merged, all 5 previously deferred fixtures (TC-QLD-005, -007, -008, -015, -016) have been reinstated as active launch-gate fixtures and pass the engine gold-standard test on first run. The "Deferred to cross-state termination-enum refactor" appendix that previously held them has been removed.

**No architectural surprise**: the cleanest path — kept QLD scope tight in the original PR, delivered the cross-cutting refactor as its own state-agnostic PR, then reinstated the dependent fixtures.

---

---

## Sources of legal truth

- *Industrial Relations Act 2016* (Qld) No. 63 of 2016 — current at 1 January 2026, available at `legislation.qld.gov.au`. Cited as **"QLD IR Act 2016 s.N"**. The LSL provisions are in **Chapter 2 Part 3 Division 9** (sections 93–110) plus the general continuity-of-service rule at **Chapter 2 Part 3 Division 12 section 134**. Section numbers and headings in this document follow the AustLII consolidated index of the Act and have been cross-checked against multiple authoritative summaries (Business Queensland, QIRC, RosterElf, Sprintlaw, Holding Redlich, Business Chamber Queensland).
- *Industrial Relations Act 1999* (Qld) — repealed and superseded by the 2016 Act on **1 March 2017**. The 2016 Act commenced cleanly; there is no s.57-style transitional carry-forward of repealed sections. References to the 1999 Act appear in this file only for the historical-cliff cases (s.96 — service before 23 June 1990, s.103 — casual continuity from 30 March 1994). Both cliff dates pre-date the 1999 Act and were carried through 1999 → 2016 unchanged. Cited as **"QLD IR Act 1999 s.N"** only where relevant.
- *Business Queensland* — Office of Industrial Relations (OIR Qld) interpretive guidance at `business.qld.gov.au/running-business/employing/legal-obligations/long-service-leave`. The Queensland Government's official plain-English operational summary. Cited as **"Business QLD — LSL Entitlements"** where used.
- *APA LSL Masterclass* PDF (`docs/features/LSL-training.pdf`) pp.49–64 — supplies worked examples and the QLD edge-case set used as canonical fixtures. Cited as **"APA LSL Masterclass p.NN"**.
- *Queensland Industrial Relations Commission* — `qirc.qld.gov.au`. Authoritative for s.110 cashing-out applications (financial hardship and compassionate grounds).
- *Fox v Infosys Technologies Ltd* — QIRC decision (upheld by Queensland Court of Appeal; High Court refused special leave) on continuous-service interpretation. Cited where the engine's behaviour is shaped by case law.

---

## How to read this file

Each test case has:

- **ID** (e.g. `TC-QLD-001`) — unique, stable, referenced from `gold-standard.test.ts`
- **Name** — short, descriptive
- **Source** — APA PDF page and/or QLD IR Act 2016 section that produced the expected value
- **Category** — Single mode (Fixed-rate / Varied-hours / Commission / Hard-error / negative) or Bulk mode
- **Why it matters** — the spec acceptance criterion or QLD-specific divergence this case backs
- **Inputs** — fenced YAML following the engine's `Employee` / `Trigger` / `WagePeriod` / `ContinuousServiceEvent` data model in `website/src/lib/lsl/engine/types.ts`
- **Expected output** — `value_of_week`, `value_of_day`, `total_entitlement_weeks`, `total_entitlement_dollars`, `expected_citations[]`; for hard-error cases `status: failed` and `error.code`
- **Legal source** — explicit QLD IR Act 2016 section reference
- **Notes** — interpretation, derivation, any `expected: TBD` flag with rationale

### Conventions used in this file

- **Currency**: AUD; half-up rounding at 0.005; 2 decimal places at display; intermediate arithmetic is unrounded — same convention as NSW (F12, AC25 in E1 spec) and VIC.
- **Dates**: ISO `YYYY-MM-DD`. Prescribed-date anchor for fixtures is `2026-05-25` (= as-at default for v1 testing, day after VIC anchor).
- **Entitlement formula** (QLD IR Act 2016 s.95(2)): `8.6667 weeks` at 10 years of continuous service, plus `4.3333 weeks` for each further 5 years. Same accrual ratio as NSW (1/60 = 8.6667/10). The QLD-specific divergence from NSW is in the **pro-rata-at-termination qualifying reasons** (s.95(3)/(4)), NOT in the accrual rate or qualifying period.
- **Pro-rata at termination** (s.95(3)/(4)): below 10 years but ≥ 7 years, pro-rata is payable ONLY if the termination is for a qualifying reason — death, illness or pressing domestic necessity (employee-initiated), illness-based dismissal, dismissal for any reason other than the employee's conduct/capacity/performance, or unfair dismissal. At 10+ years, pro-rata is automatic regardless of reason (including misconduct — QLD has NO serious-misconduct forfeiture at 10+).
- **Ordinary pay** (s.98 + s.99): paid at the ordinary rate **excluding overtime** at the time the leave is taken. For commission/piece-rate workers, the average commission over the year before the leave period is used (s.99). Casuals are paid at their **loaded casual hourly rate** (s.105) — including casual loading.
- **Continuous service** (s.93 + s.134): paid working time and paid leave count. Re-employment within **3 months** of termination preserves prior service (s.134). Unpaid leave does not count toward service but does not break continuity. Casual employees: continuous service ends if a gap between contracts exceeds **3 months** (s.103).
- **Public holidays during LSL** (s.97 + Business QLD): **EXCLUSIVE** — a PH falling within an LSL window is NOT counted as a day of LSL (matches NSW and VIC; differs from SA which is inclusive).
- **Cashing out** (s.110): permitted ONLY if (a) an industrial instrument (modern award, certified agreement, bargaining award) authorises it, OR (b) the Queensland Industrial Relations Commission orders it on **financial hardship or compassionate** grounds. Cashing-out is NOT a criminal offence in QLD (unlike VIC). Engine emits a **non-blocking advisory** citation note when a `cash_out` trigger is received, NOT a hard error. See §I for the resolved behaviour. Per TBD-QLD-04 (RESOLVED), the engine does NOT require user-supplied s.110 ground — a single advisory message covers all grounds; sub-10-yr cash-out gets a stronger advisory; sub-7-yr passes through with $0.
- **Citations**: every case lists the minimum expected citations. The rules engine MAY emit additional citations; tests assert array-membership, not array-equality.

---

## QLD-specific divergences from NSW + VIC (the load-bearing facts)

| Topic | NSW | VIC | QLD | QLD source |
|---|---|---|---|---|
| Qualifying period (full entitlement) | 10 yrs | 7 yrs | **10 yrs** | QLD IR Act 2016 s.95(2)(a) |
| Pro-rata at termination (sub-10-yr threshold) | 5 yrs (limited reasons: redundancy, illness, death, domestic pressing necessity, employer-initiated) | 7 yrs (any reason — incl. resignation, dismissal, serious misconduct) | **7 yrs (limited reasons: death, illness, domestic pressing necessity, dismissal not for conduct/capacity/performance, unfair dismissal)** | QLD IR Act 2016 s.95(3)/(4) |
| Sub-7-yr entitlement | none on resignation; pro-rata exists at 5 yrs for limited reasons | none — no sub-7-yr pro-rata exists in VIC | **none — no sub-7-yr entitlement under any reason** | QLD IR Act 2016 s.95(3) |
| Resignation between 7–10 yrs (no qualifying reason) | not payable | full payout (VIC s.9 any reason) | **NOT PAYABLE — critical divergence from VIC** | QLD IR Act 2016 s.95(3)/(4); APA p.50–51; Sprintlaw 2025 |
| Serious-misconduct dismissal at 10+ yrs | full payout (NSW LSA s.4(2)(a)(iii) applies only sub-10-yr forfeiture) | full payout (VIC s.9 — no misconduct exception) | **full payout — QLD has no serious-misconduct exception at 10+ years** | QLD IR Act 2016 s.95(2); Business QLD — "after 10 years, pro-rata is automatic regardless of termination reason" |
| Accrual ratio | 1/60 (8.6667 weeks per 10 years) | 1/60 (same) | **1/60 (same)** | QLD IR Act 2016 s.95(2)(a) |
| 15-year additional accrual | 8.6667 weeks total at 10 yrs; no additional at 15 yrs (continues to accrue at 1/60) | as NSW (continuous 1/60 accrual) | **+ 4.3333 weeks at 15 yrs (= 13 weeks total at 15 yrs)** — discrete step | QLD IR Act 2016 s.95(2)(b); Business QLD |
| Break tolerance — employer/employee-initiated | 2 mo (≤60 days) | 12 weeks | **3 months** | QLD IR Act 2016 s.134; Business QLD |
| Casual break tolerance | implicit via "regular and systematic" + research §1.4 | 12 weeks unless agreement, seasonal, or regular & systematic | **3 months between contracts (s.103)** — specific casual rule | QLD IR Act 2016 s.103 |
| Casual loading | included in ordinary pay for casuals | included | **included — "loaded casual hourly rate" used for LSL pay** | QLD IR Act 2016 s.105; Business QLD; RosterElf |
| Casual historical cliff | none | none (2018 Act commenced 1/11/2018 cleanly) | **30 March 1994 — all continuous service of a casual employee taken into account from 30 March 1994** | QLD IR Act 2016 s.103; Business QLD — "as from 30 March 1994, all continuous service of a casual employee is taken into account" |
| General historical cliff | none | 1 November 2018 (dual-regime via s.57) | **23 June 1990 — special continuity rules for service before 23 June 1990 (s.96)** | QLD IR Act 2016 s.96 |
| Unpaid leave | UPL excluded from service & lookback denominator | First 52 wks counts (s.13(1)(b)); excess excluded (s.14(a)) | **UPL does NOT count toward service but does NOT break continuity** | QLD IR Act 2016 s.134; Business QLD — "unpaid leave does not count as service" |
| Workers Comp | counts as service (NSW LSA s.4(11)) | counts as service (s.13(1)(b)); use s.17 higher-of-rates | **counts as continuous service — Business QLD: WorkCover absences "may count" as continuous service**; rate of pay paid at the rate in force when LSL is taken (s.98), not pre-injury rate | QLD IR Act 2016 s.134 (continuity); s.98 (rate); Business QLD |
| Transfer of business | NSW LSA s.4(6) | s.11(3)–(11) — new owner takes on service; dismissal-then-rehire-within-12-wks by new owner preserves | **s.134 — service preserved; dismissed at transfer or within preceding month + rehired by new owner within 3 mo preserves** | QLD IR Act 2016 s.134; Business QLD |
| Cashing out | not in scope for NSW v1 | **CRIMINAL OFFENCE — s.34 (12 penalty units natural / 60 corporate)** | **PERMITTED only via industrial instrument OR QIRC order on financial hardship / compassionate grounds (s.110)** — NOT a criminal offence | QLD IR Act 2016 s.110 |
| Engine behaviour on `cash_out` trigger | not modelled | hard error `vic_cashout_prohibited` (s.34) | **non-blocking advisory `qld_cashout_requires_instrument_or_qirc` with citation to s.110** — engine computes value AND surfaces an advisory | E2 spec F5 (VIC only); impl-plan §4 P0.4 QLD — "Cashing-out: not blocked, but emits citation referencing the QIRC/EA-permission rule" |
| Public holiday during LSL | exclusive (NSW LSA s.4(4A)) | exclusive (VIC s.7) | **Exclusive** — same behaviour | Business QLD; APA p.55 |
| Death of employee | NSW LSA s.4(2)(iii)(d) — pro-rata, estate on request | VIC s.10 — full accrued entitlement to personal representative; 52-wk avg | **s.95(3)(a) — pro-rata payable at 7+ years (any age); pay to legal personal representative; ordinary rate at date of death used (s.98)** | QLD IR Act 2016 s.95(3)(a), s.98 |
| Pay-on-termination timing | "forthwith" (NSW LSA s.4(5)(a)) | "on the day on which the employment ends" (VIC s.9(1)(b)) | **payable on termination — s.95** (no specific timing language equivalent to "forthwith"; OIR enforcement practice treats next-pay-cycle as compliant) | QLD IR Act 2016 s.95 |
| Industrial action / slackness | doesn't break / doesn't count as service | continuous (s.12(7)/(8)) but excluded from accrual (s.14(c)/(d)) | **s.134(2)(a)/(b) — continuous; s.134 doesn't count as service unless re-employed** | QLD IR Act 2016 s.134 |
| Industry-specific awards (cleaning, building-construction, community-services) | superior award handling out of v1 | same — out of v1 | **separate portable LSL schemes apply** (Building & Construction Industry Act 1991; Contract Cleaning Industry Act 2005; Community Services Industry Act 2020) — out of v1 statutory engine scope | QLD IR Act 2016 s.110 cross-references these Acts; deferred — see "Provisions deliberately deferred" below |
| Seasonal employees (sugar / meatworks) | not modelled | not modelled | **separate subdivision applies — s.106-108 (sugar/meatworks); s.109 (other seasonal)** — out of v1 scope | QLD IR Act 2016 s.106–109 |
| Minimum leave amount per period | not specified in NSW LSA | not specified | **employer may require minimum of 4 weeks taken in one period, on 3 months' written notice (s.97)** — not a calculation question | QLD IR Act 2016 s.97 |

---

## Historical-cliff handling — what "23 June 1990" and "30 March 1994" mean for the engine

QLD has TWO historical date cliffs in the LSL regime, both of which pre-date the 2016 Act and were carried through the (now-repealed) 1999 Act unchanged. They are NOT a dual-regime in the VIC s.57 sense — there is no "rules-pre-1990 vs rules-post-1990" engine split because the 2016 Act's entitlement formula is the only one that applies. The cliffs affect **which historical service counts as service**, not which formula computes the entitlement weeks.

### s.96 — Continuity of service: service before 23 June 1990

Service performed for the same employer before 23 June 1990 is generally NOT counted as continuous service for the purpose of computing the qualifying period (s.95(2)) UNLESS specific transitional savings apply. In practice this means an employee who started before 23 June 1990 and has been continuously employed since has their "official start date" for LSL purposes treated as 23 June 1990 (the earliest the modern continuous-service rules begin to count) — UNLESS a prior industrial award or contract preserved their pre-1990 service.

**What this means for v1**: in practice, an employee with start date pre-1990 who is calculating a 2026 LSL entitlement has well over 30 years of post-1990 service and the cliff is moot for the accrual calculation. The engine **MUST** surface this as an advisory warning (`pre_1990_service_advisory_qld`) when `startDate < 1990-06-23`, but does NOT alter the computed weeks or dollars per the resolved TBD-QLD-02. See Resolutions section above.

### s.103 — Continuity of service for casual employees: 30 March 1994

The 30 March 1994 cliff applies specifically to **casual employees**. Before 30 March 1994, casual employees had no entitlement to LSL at all in Queensland. From 30 March 1994 onward, all continuous service of a casual employee is taken into account. The engine **MUST** treat any casual service before 30 March 1994 as zero hours for the s.95 accrual calculation, and start counting service from 30 March 1994 forward. Per the resolved TBD-QLD-02: this cliff is a **HARD ANCHOR** — engine sets the effective service start to 1994-03-30 when `employmentType = 'casual' && startDate < 1994-03-30` and emits the `pre_1994_casual_cliff_qld` warning.

---

## Coverage at a glance

| Source / Theme | Test IDs | Count |
|---|---|---|
| APA PDF QLD worked examples (pp.49–64) | TC-QLD-001 → TC-QLD-010 | 10 |
| Sub-7-year and 7–10-year qualifying-reason cases (s.95(3)/(4)) | TC-QLD-011 → TC-QLD-019 | 9 |
| 10+ year automatic payout (any reason, incl. misconduct) (s.95(2)) | TC-QLD-020 → TC-QLD-024 | 5 |
| Continuous-service edge cases (s.134, s.103) | TC-QLD-025 → TC-QLD-034 | 10 |
| Historical-cliff cases (s.96, s.103) | TC-QLD-035 → TC-QLD-038 | 4 |
| Ordinary pay — fixed-rate, casual loading, commission (s.98, s.99, s.105) | TC-QLD-039 → TC-QLD-046 | 8 |
| 15-year accrual step (s.95(2)(b)) | TC-QLD-047 → TC-QLD-048 | 2 |
| Cashing-out — non-blocking advisory (s.110) | TC-QLD-049 → TC-QLD-052 | 4 |
| Public holiday during LSL (s.97) | TC-QLD-053 | 1 |
| As-at snapshot trigger | TC-QLD-054 → TC-QLD-055 | 2 |
| Cross-jurisdiction (QLD + other state) | TC-QLD-056 → TC-QLD-057 | 2 |
| Bulk-mode fixtures | TC-QLD-BULK-001 → TC-QLD-BULK-003 | 3 |
| **Total active single-mode fixtures for v1 QLD launch** | | **57** |
| **Bulk-mode fixtures** | | **3** |
| **Grand total** | | **60** |

> **v1.1 note (2026-05-25)**: TC-QLD-005, -007, -008, -015, -016 — previously deferred pending DEV-CROSS-1 — are now active. The "Deferred to cross-state termination-enum refactor" appendix has been removed.

---

# Single-mode test cases

## §A — APA PDF QLD worked examples (pp.49–64)

### TC-QLD-001 — 10 yrs FT resignation, full entitlement 8.6667 weeks

- **Source**: APA p.49–50 worked example; QLD IR Act 2016 s.95(2)(a)
- **Category**: Fixed-rate (s.98)
- **Why it matters**: Canonical "10 yrs × 1/60" calculation. The qualifying-period bar is reached. Resignation at 10+ years pays out automatically per s.95(2) — no qualifying-reason test needed.

**Inputs**

```yaml
employee:
  id: TC-QLD-001
  legalName: Sam
  startDate: 2016-05-25
  endDate: 2026-05-25
  employmentType: full_time
  statesOfService: [QLD]
  governingJurisdiction: QLD
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
total_entitlement_weeks: 8.6667         # s.95(2)(a) — first entitlement at 10 yrs
value_of_week: 1800.00                   # s.98 — ordinary rate at time of taking leave
value_of_day: 360.00                     # 1800 / 5 (FT 5-day week)
total_entitlement_dollars: 15600.06      # 8.6667 × 1800
expected_citations:
  - { section: QLD IR Act 2016 s.95(2)(a), rule: accrual.qualifying-period-10yr, pdfPage: 49 }
  - { section: QLD IR Act 2016 s.98,       rule: ordinary-pay.ordinary-rate-at-leave-time, pdfPage: 53 }
  - { section: QLD IR Act 2016 s.95,       rule: trigger.termination.10yr-automatic-any-reason, pdfPage: 50 }
```

**Notes**

Identical accrual ratio to NSW (8.6667 weeks at 10 yrs). The QLD divergence from NSW is invisible at the 10-yr mark for FT resignation; it surfaces in the sub-10-yr qualifying-reason cases (§B below) and the 15-yr step (§G). Voluntary resignation at 10+ yrs in QLD pays out without qualifying-reason test because the s.95(2) accrual is automatic at the threshold.

---

### TC-QLD-002 — 9 yrs FT resignation, no qualifying reason → $0

- **Source**: APA p.50 example; QLD IR Act 2016 s.95(3)/(4); Business QLD — "An employee who simply resigns after seven or eight years to take another job will usually not be entitled to pro-rata long service leave"
- **Category**: Negative — sub-10-yr resignation without qualifying reason
- **Why it matters**: This is the **critical divergence from VIC** — under VIC s.9, voluntary resignation at 7+ yrs pays out the full accrual. Under QLD s.95(3)/(4), voluntary resignation at 7–10 yrs without a qualifying reason returns $0. Engine MUST NOT apply VIC's "any-reason" logic when state = QLD.

**Inputs**

```yaml
employee:
  id: TC-QLD-002
  legalName: ResignationNoReasonFixture
  startDate: 2017-05-25
  endDate: 2026-05-25
  employmentType: full_time
  statesOfService: [QLD]
  governingJurisdiction: QLD
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
total_entitlement_weeks: 0.0000
total_entitlement_dollars: 0.00
warnings:
  - { code: sub_10yr_no_qualifying_reason_qld, message: "Below 10 years of continuous service. Pro-rata is payable only if termination is for a qualifying reason under QLD IR Act 2016 s.95(3)/(4) — death, illness/domestic pressing necessity, dismissal not for conduct/capacity/performance, or unfair dismissal. Voluntary resignation does not qualify." }
expected_citations:
  - { section: QLD IR Act 2016 s.95(3), rule: accrual.7-to-10yr.qualifying-reasons-only, pdfPage: 50 }
  - { section: QLD IR Act 2016 s.95(4), rule: accrual.7-to-10yr.qualifying-reasons-list, pdfPage: 50 }
```

**Notes**

This is the diagnostic test for the engine's per-state branching. NSW returns $0 here too (NSW LSA s.4(2)(iii) limits pro-rata to redundancy/illness/death/etc. at 5–10 yrs). VIC returns full payout. QLD returns $0 — same outcome as NSW for this specific input, but the legal mechanism is different and the citation MUST reflect s.95(3)/(4), NOT NSW LSA s.4(2)(iii).

---

### TC-QLD-003 — 8 yrs FT redundancy, pro-rata payout

- **Source**: APA p.51 example; QLD IR Act 2016 s.95(3)(d) / s.95(4)
- **Category**: Fixed-rate, redundancy (qualifying termination reason)
- **Why it matters**: Redundancy IS a qualifying reason under s.95(3) via "dismissal for a reason other than the employee's conduct/capacity/performance". Pro-rata payable.

**Inputs**

```yaml
employee:
  id: TC-QLD-003
  legalName: RedundancyFixture
  startDate: 2018-05-25
  endDate: 2026-05-25
  employmentType: full_time
  statesOfService: [QLD]
  governingJurisdiction: QLD
  currentWeeklyGross: 1500.00
  wageHistory:
    - { periodStart: 2018-05-25, periodEnd: 2026-05-25, grossPay: 624000.00, frequency: weekly }
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: redundancy }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 8.0000
total_entitlement_weeks: 6.9333         # 8 × (8.6667/10) — proportionate per s.95(4)
value_of_week: 1500.00
value_of_day: 300.00
total_entitlement_dollars: 10399.95
expected_citations:
  - { section: QLD IR Act 2016 s.95(3)(d), rule: accrual.7-to-10yr.dismissal-not-for-conduct, pdfPage: 50 }
  - { section: QLD IR Act 2016 s.95(4),    rule: accrual.proportionate-payment-formula, pdfPage: 50 }
  - { section: QLD IR Act 2016 s.98,       rule: ordinary-pay.ordinary-rate-at-leave-time, pdfPage: 53 }
```

**Notes**

Redundancy is treated as "dismissal for a reason other than the employee's conduct, capacity or performance" per s.95(3)(d). Numerically identical to NSW redundancy at 8 yrs (same accrual ratio); the citation source is what differs.

---

### TC-QLD-004 — 7.5 yrs FT illness-based resignation, pro-rata payout

- **Source**: APA p.52 (illness resignation); QLD IR Act 2016 s.95(3)(b)
- **Category**: Pro-rata at termination — employee illness

**Inputs**

```yaml
employee:
  id: TC-QLD-004
  legalName: IllnessResignationFixture
  startDate: 2018-11-25
  endDate: 2026-05-25
  employmentType: full_time
  statesOfService: [QLD]
  governingJurisdiction: QLD
  currentWeeklyGross: 1600.00
  wageHistory:
    - { periodStart: 2018-11-25, periodEnd: 2026-05-25, grossPay: 624000.00, frequency: weekly }
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: illness_incapacity }
extraInputs:
  terminationInitiator: employee   # employee resigned, not employer dismissal
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.5000
total_entitlement_weeks: 6.5000         # 7.5 × 8.6667/10
value_of_week: 1600.00
value_of_day: 320.00
total_entitlement_dollars: 10400.00
expected_citations:
  - { section: QLD IR Act 2016 s.95(3)(b), rule: accrual.7-to-10yr.employee-illness-or-pressing-necessity, pdfPage: 50 }
  - { section: QLD IR Act 2016 s.95(4),    rule: accrual.proportionate-payment-formula, pdfPage: 50 }
```

**Notes**

"Illness" under s.95(3)(b) includes injury, incapacity or other medical condition (per Business QLD interpretive note). The same s.95(3)(b) covers an employee resigning because of a "domestic or other pressing necessity" — case law treats this as covering family caregiving obligations and serious commute/family-relationship strain where employer remediation has been refused (per Business Chamber QLD).

---

### TC-QLD-005 — 8 yrs FT employer dismissal for illness, pro-rata payout

> **Reinstated in v1.1 (2026-05-25)** — DEV-CROSS-1 (PR #14) merged the `terminationInitiator` field and the cross-state termination-reason enum. Fixture is now active.

- **Source**: APA p.52; QLD IR Act 2016 s.95(3)(c) — employer dismisses for the employee's illness
- **Category**: Pro-rata at termination — employer-initiated, illness

**Inputs**

```yaml
employee:
  id: TC-QLD-005
  legalName: EmployerDismissalIllnessFixture
  startDate: 2018-05-25
  endDate: 2026-05-25
  employmentType: full_time
  statesOfService: [QLD]
  governingJurisdiction: QLD
  currentWeeklyGross: 1700.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: illness_incapacity }
extraInputs:
  terminationInitiator: employer
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 8.0000
total_entitlement_weeks: 6.9333
value_of_week: 1700.00
total_entitlement_dollars: 11786.61
expected_citations:
  - { section: QLD IR Act 2016 s.95(3)(c), rule: accrual.7-to-10yr.employer-dismissal-for-employee-illness, pdfPage: 50 }
```

**Notes**

Distinct from s.95(3)(b) (employee-initiated) in that the employer is the terminating party. Engine MUST distinguish via `terminationInitiator` because s.95(3)(b) and (c) are separate sub-paragraphs covering different scenarios.

---

### TC-QLD-006 — 7 yrs FT death, pro-rata payable to estate

- **Source**: APA p.53; QLD IR Act 2016 s.95(3)(a)
- **Category**: Pro-rata at termination — death

**Inputs**

```yaml
employee:
  id: TC-QLD-006
  legalName: DeathFixture
  startDate: 2019-05-25
  endDate: 2026-05-25   # exactly 7 yrs
  employmentType: full_time
  statesOfService: [QLD]
  governingJurisdiction: QLD
  currentWeeklyGross: 1700.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: death }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.0000
total_entitlement_weeks: 6.0667         # 7 × 8.6667/10
value_of_week: 1700.00
total_entitlement_dollars: 10313.39
payment_recipient: "legal personal representative of the deceased employee"
expected_citations:
  - { section: QLD IR Act 2016 s.95(3)(a), rule: accrual.7-to-10yr.death-of-employee, pdfPage: 50 }
  - { section: QLD IR Act 2016 s.95(4),    rule: accrual.proportionate-payment-formula, pdfPage: 50 }
  - { section: QLD IR Act 2016 s.98,       rule: ordinary-pay.ordinary-rate-at-leave-time, pdfPage: 53 }
```

**Notes**

QLD does not have a VIC-style separate s.10 "death of employee" provision with a mandated 52-week ordinary-pay-averaging formula. The standard s.98 ordinary-rate-at-leave-time applies, with the leave-time anchor for a death trigger being the date of death (engine MUST anchor lookback to terminationDate, not asAtDate). Per the resolved TBD-QLD-05: the engine applies the literal s.98 rate at time of leave/termination — for a death trigger, that is the rate at date of death. APA training and Business QLD both support this reading.

---

### TC-QLD-007 — 9 yrs FT employer dismissal NOT for conduct, pro-rata payable

> **Reinstated in v1.1 (2026-05-25)** — DEV-CROSS-1 (PR #14) added the `employer_initiated_not_misconduct` enum value. Fixture is now active.

- **Source**: APA p.51; QLD IR Act 2016 s.95(3)(d)
- **Category**: Pro-rata at termination — generic employer dismissal

**Inputs**

```yaml
employee:
  id: TC-QLD-007
  legalName: EmployerDismissalNotConductFixture
  startDate: 2017-05-25
  endDate: 2026-05-25
  employmentType: full_time
  statesOfService: [QLD]
  governingJurisdiction: QLD
  currentWeeklyGross: 1800.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: employer_initiated_not_misconduct }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 9.0000
total_entitlement_weeks: 7.8000
value_of_week: 1800.00
total_entitlement_dollars: 14040.00
expected_citations:
  - { section: QLD IR Act 2016 s.95(3)(d), rule: accrual.7-to-10yr.dismissal-not-for-conduct-capacity-performance, pdfPage: 50 }
```

**Notes**

s.95(3)(d) catches any employer-initiated dismissal NOT due to employee's "conduct, capacity or performance". Common examples: business restructure, position elimination, role outsourcing — distinct from redundancy in the strict Fair Work Act sense, but treated equivalently for s.95 purposes. The qualifying language is broad.

---

### TC-QLD-008 — 8 yrs FT unfair dismissal finding, pro-rata payable

> **Reinstated in v1.1 (2026-05-25)** — DEV-CROSS-1 (PR #14) added the `unfair_dismissal` enum value (s.95(3)(e)). Fixture is now active.

- **Source**: APA p.51; QLD IR Act 2016 s.95(3)(e)
- **Category**: Pro-rata at termination — unfair dismissal

**Inputs**

```yaml
employee:
  id: TC-QLD-008
  legalName: UnfairDismissalFixture
  startDate: 2018-05-25
  endDate: 2026-05-25
  employmentType: full_time
  statesOfService: [QLD]
  governingJurisdiction: QLD
  currentWeeklyGross: 1700.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: unfair_dismissal }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 8.0000
total_entitlement_weeks: 6.9333
value_of_week: 1700.00
total_entitlement_dollars: 11786.61
expected_citations:
  - { section: QLD IR Act 2016 s.95(3)(e), rule: accrual.7-to-10yr.unfair-dismissal, pdfPage: 50 }
```

**Notes**

s.95(3)(e) covers cases where the dismissal has been found unfair by the QIRC under the unfair-dismissal jurisdiction. The trigger reason `unfair_dismissal` is a positive determination — the user is asserting (or the QIRC has determined) the dismissal was unfair. The calculator does NOT determine fairness; it computes based on the user-asserted reason.

---

### TC-QLD-009 — Long-term casual, 12 yrs continuous, taking 8.6667 weeks

- **Source**: APA p.54–55 example; QLD IR Act 2016 s.95(2), s.102, s.103, s.105
- **Category**: Casual — hours-based accrual + loaded rate
- **Why it matters**: Verifies casual treatment — continuous service via s.103 (no gaps > 3 mo); loaded hourly rate per s.105.

**Inputs**

```yaml
employee:
  id: TC-QLD-009
  legalName: CasualTaking
  startDate: 2014-05-25                       # 12 yrs to 2026-05-25
  employmentType: casual
  statesOfService: [QLD]
  governingJurisdiction: QLD
  currentHourlyRate: 38.00                    # loaded casual hourly rate per s.105
  hoursLast52Weeks: 1664                      # avg 32 h/wk
  hoursLast260Weeks: 8320                     # avg 32 h/wk
  hoursTotalEmployment: 19968                 # 32 h/wk × 624 wks
  wageHistory:
    - { periodStart: 2025-05-26, periodEnd: 2026-05-25, grossPay: 63232.00, frequency: other, periodDays: 365 }
  serviceEvents: []
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 8.6667 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 12.0000
total_entitlement_weeks: 10.4000             # 12 × 8.6667/10 (continues to accrue at 1/60 between 10-yr and 15-yr step)
weekly_avg: 1216.00                          # 1664/52 × 38 = 32 × 38 = $1,216 at loaded rate
value_of_week: 1216.00
value_of_day: 243.20
payable_for_taken_leave: 10535.36            # 8.6667 × 1216
expected_citations:
  - { section: QLD IR Act 2016 s.95(2)(a),  rule: accrual.qualifying-period-10yr,                   pdfPage: 49 }
  - { section: QLD IR Act 2016 s.103,       rule: continuous-service.casual-3mo-gap-rule,           pdfPage: 56 }
  - { section: QLD IR Act 2016 s.105,       rule: ordinary-pay.casual-loaded-hourly-rate,           pdfPage: 57 }
  - { section: QLD IR Act 2016 s.98,        rule: ordinary-pay.ordinary-rate-at-leave-time,         pdfPage: 53 }
```

**Notes**

QLD casual treatment differs from VIC's 3-tier averaging (s.15(2)). QLD uses the hours-based calculation built on s.105 (loaded hourly rate), with continuous service rule per s.103 (3-month casual gap break). The 52-week hours figure drives the weekly average computation. Per the resolved TBD-QLD-03: QLD applies a **single 52-wk lookback** (NOT a multi-tier "greater of"), per Business QLD's published formula `(total ordinary hours ÷ 52) × 8.6667 ÷ 10` and RosterElf's worked examples.

---

### TC-QLD-010 — Olivia, 1.5 yrs unpaid parental leave, accrual frozen during UPL

- **Source**: APA p.56 (Olivia variant for QLD); QLD IR Act 2016 s.134
- **Category**: Continuous service — UPL does not count but does not break
- **Why it matters**: Critical divergence from VIC's 52-wk-counts rule. QLD treats UPL as "does not count toward service, but does not break continuity" — same as NSW.

**Inputs**

```yaml
employee:
  id: TC-QLD-010
  legalName: Olivia-QLD
  startDate: 2014-07-01
  employmentType: full_time
  statesOfService: [QLD]
  governingJurisdiction: QLD
  currentWeeklyGross: 1600.00
  wageHistory:
    - { periodStart: 2014-07-01, periodEnd: 2026-05-25, grossPay: 952320.00, frequency: weekly, note: "Total wages reflect 595 wks elapsed less 78 wks UPL excluded" }
  serviceEvents:
    - { type: unpaid_parental_leave, startDate: 2018-05-01, endDate: 2019-10-31, note: "78 wks UPL — none counts toward service per QLD treatment" }
trigger: { kind: as_at, asAtDate: 2026-05-25 }
```

**Expected output**

```yaml
status: computed
days_in_unpaid_leave: 549                 # 78 wks UPL — full duration
days_counting_as_service: 0               # QLD: UPL does not count toward service
days_excluded_from_service: 549           # all of UPL excluded from accrual
continuity_preserved: true                # but not broken
years_of_continuous_service: 10.4001      # (4346 elapsed − 549 excluded) / 365.25
total_entitlement_weeks: 9.0134           # 10.4001 × 8.6667/10
value_of_week: 1600.00
total_entitlement_dollars: 14421.39
warnings:
  - { code: accrued_not_currently_payable, message: "Accrued snapshot per as_at trigger; employee remains employed." }
expected_citations:
  - { section: QLD IR Act 2016 s.134,    rule: continuous-service.upl-does-not-count-but-no-break, pdfPage: 56 }
  - { section: QLD IR Act 2016 s.95(2)(a), rule: accrual.qualifying-period-10yr, pdfPage: 49 }
```

**Notes**

The same Olivia fixture would yield different excluded-days under VIC (184 excluded, post-2018 portion of UPL straddling 1/11/2018) vs QLD (549 excluded — all of UPL). Engine MUST apply the state-specific UPL treatment, not a universal rule. This is one of the clearest examples of state-specific continuous-service rule divergence.

---

## §B — Sub-7-year and 7–10-year qualifying-reason cases (s.95(3)/(4))

### TC-QLD-011 — 6.99 yrs FT redundancy → $0 (sub-7yr threshold)

- **Source**: QLD IR Act 2016 s.95(3); Business QLD — no sub-7-yr entitlement
- **Category**: Negative — sub-7-yr threshold

**Inputs**

```yaml
employee:
  id: TC-QLD-011
  legalName: SubSevenYearRedundancyFixture
  startDate: 2019-06-01
  endDate: 2026-05-25                         # 6.98 yrs
  employmentType: full_time
  statesOfService: [QLD]
  governingJurisdiction: QLD
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
  - { code: sub_7yr_no_entitlement_qld, message: "No LSL entitlement under QLD IR Act 2016 s.95(3) — sub-7-year service. Review applicable industrial instrument, EA, or contract — these may provide more favourable terms than the statutory minimum." }
expected_citations:
  - { section: QLD IR Act 2016 s.95(3), rule: accrual.sub-7yr-no-entitlement-any-reason, pdfPage: 50 }
```

**Notes**

Same numeric outcome as VIC sub-7-yr (TC-VIC-015) and NSW sub-5-yr cases. Engine MUST cite QLD IR Act 2016 s.95(3), NOT NSW LSA s.4 or VIC s.6. The warning code `sub_7yr_no_entitlement_qld` is QLD-specific; the engine reuses the existing state-agnostic warning enum infrastructure with QLD-specific message text (same pattern as VIC's `sub_7yr_review_industrial_instrument` from TBD-VIC-07).

---

### TC-QLD-012 — Exactly 7 yrs FT redundancy → pro-rata payout

- **Source**: QLD IR Act 2016 s.95(3)(d); boundary case
- **Category**: Boundary — 7-yr threshold inclusivity

**Inputs**

```yaml
employee:
  id: TC-QLD-012
  legalName: ExactlySevenYearsRedundancyFixture
  startDate: 2019-05-25
  endDate: 2026-05-25                         # exactly 7 yrs
  employmentType: full_time
  statesOfService: [QLD]
  governingJurisdiction: QLD
  currentWeeklyGross: 1500.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: redundancy }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.0000
total_entitlement_weeks: 6.0667              # 7 × 8.6667/10
value_of_week: 1500.00
total_entitlement_dollars: 9100.05
expected_citations:
  - { section: QLD IR Act 2016 s.95(3)(d), rule: accrual.7-to-10yr.dismissal-not-for-conduct, pdfPage: 50 }
  - { section: QLD IR Act 2016 s.95(4),    rule: accrual.proportionate-payment-formula, pdfPage: 50 }
```

**Notes**

The Act language "at least 7 years continuous service" is read inclusive at the exact 7-yr boundary (consistent with VIC's "after completing 7 years" interpretation, TBD-VIC-06 resolution). Engine threshold is `years_of_continuous_service >= 7.0000`. Per the resolved TBD-QLD-01: thresholds at 7, 10, and 15 yrs are all inclusive at exact-day boundary.

---

### TC-QLD-013 — 6 yrs 364 days FT redundancy → $0

- **Source**: QLD IR Act 2016 s.95(3) boundary
- **Category**: Negative — one day short of 7 yrs

**Inputs**

```yaml
employee:
  id: TC-QLD-013
  legalName: OneDayShortRedundancyFixture
  startDate: 2019-05-26
  endDate: 2026-05-25                         # 6 yrs 364 days
  employmentType: full_time
  statesOfService: [QLD]
  governingJurisdiction: QLD
  currentWeeklyGross: 1500.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: redundancy }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 6.9973
total_entitlement_weeks: 0.0000
total_entitlement_dollars: 0.00
expected_citations:
  - { section: QLD IR Act 2016 s.95(3), rule: accrual.sub-7yr-no-entitlement-any-reason, pdfPage: 50 }
```

---

### TC-QLD-014 — 9 yrs FT serious-misconduct dismissal → $0 (s.95(3)(d) exclusion)

- **Source**: QLD IR Act 2016 s.95(3)(d) — "for a reason other than the employee's conduct, capacity or performance"
- **Category**: Negative — sub-10-yr misconduct
- **Why it matters**: At sub-10-yr, misconduct termination DOES NOT trigger pro-rata because s.95(3)(d) explicitly excludes dismissals for the employee's "conduct, capacity or performance". This is QLD's sub-10-yr equivalent of NSW's misconduct-forfeiture rule. **AT 10+ yrs the misconduct exception drops — see TC-QLD-022.**

**Inputs**

```yaml
employee:
  id: TC-QLD-014
  legalName: SubTenYearMisconductFixture
  startDate: 2017-05-25
  endDate: 2026-05-25                         # 9 yrs
  employmentType: full_time
  statesOfService: [QLD]
  governingJurisdiction: QLD
  currentWeeklyGross: 1700.00
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: serious_misconduct }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 9.0000
total_entitlement_weeks: 0.0000
total_entitlement_dollars: 0.00
warnings:
  - { code: sub_10yr_misconduct_excluded_qld, message: "Dismissal for serious misconduct does not satisfy any qualifying reason under QLD IR Act 2016 s.95(3) — sub-10-year service. Engine returns $0. (Note: at 10+ years, misconduct does NOT exclude payout per s.95(2) — see TC-QLD-022.)" }
expected_citations:
  - { section: QLD IR Act 2016 s.95(3)(d), rule: accrual.7-to-10yr.dismissal-for-conduct-excluded, pdfPage: 50 }
```

**Notes**

QLD diverges from VIC here: VIC pays out at 7+ yrs regardless of misconduct (TC-VIC-024 — full payout). QLD does not pay out at sub-10-yr for misconduct. This is the **second critical engine branching point** distinguishing VIC from QLD.

---

### TC-QLD-015 — 8 yrs FT poor-performance dismissal → $0 (capacity/performance excluded)

> **Reinstated in v1.1 (2026-05-25)** — DEV-CROSS-1 (PR #14) added the `poor_performance` enum value. Fixture is now active and tests the s.95(3)(d) performance exclusion as a distinct case from `serious_misconduct`.

- **Source**: QLD IR Act 2016 s.95(3)(d)
- **Category**: Negative — sub-10-yr performance dismissal

**Inputs**

```yaml
trigger: { kind: termination, terminationDate: 2026-05-25, reason: poor_performance }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 8.0000
total_entitlement_weeks: 0.0000
expected_citations:
  - { section: QLD IR Act 2016 s.95(3)(d), rule: accrual.7-to-10yr.dismissal-for-capacity-or-performance-excluded, pdfPage: 50 }
```

**Notes**

Reuses TC-QLD-014's input shape but with `reason: poor_performance`. Engine MUST treat `serious_misconduct`, `poor_performance`, `incapacity_dismissal` as semantically equivalent for s.95(3)(d) exclusion purposes. The `poor_performance` enum value was added by DEV-CROSS-1 (PR #14) along with `unfair_dismissal`, `employer_initiated_not_misconduct`, `domestic_pressing_necessity`, and the optional `terminationInitiator` field on the termination trigger. This fixture is active as of v1.1 (2026-05-25).

---

### TC-QLD-016 — 7 yrs FT domestic pressing necessity resignation → pro-rata payable

> **Reinstated in v1.1 (2026-05-25)** — DEV-CROSS-1 (PR #14) added the `domestic_pressing_necessity` enum value (s.95(3)(b) employee-initiated). Fixture is now active.

- **Source**: QLD IR Act 2016 s.95(3)(b); Business Chamber QLD — case-law examples
- **Category**: Pro-rata at termination — domestic pressing necessity

**Inputs**

```yaml
trigger: { kind: termination, terminationDate: 2026-05-25, reason: domestic_pressing_necessity }
extraInputs: { terminationInitiator: employee }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.0000
total_entitlement_weeks: 6.0667
expected_citations:
  - { section: QLD IR Act 2016 s.95(3)(b), rule: accrual.7-to-10yr.domestic-pressing-necessity, pdfPage: 50 }
```

**Notes**

"Domestic or other pressing necessity" per s.95(3)(b) covers forced caregiver obligations and severe family-relationship strain unable to be remedied by the employer. The calculator does NOT adjudicate whether a given reason qualifies — the user asserts it. The `domestic_pressing_necessity` enum value was added by DEV-CROSS-1 (PR #14); this fixture is active as of v1.1 (2026-05-25).

---

### TC-QLD-017 — Casual 7 yrs continuous, no qualifying reason → $0

- **Source**: QLD IR Act 2016 s.95(3); s.102–105 (casual sub-division)
- **Category**: Negative — sub-10-yr casual resignation

**Inputs**

```yaml
employee: { id: TC-QLD-017, employmentType: casual, /* 7 yrs continuous casual */ }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 7.0000
total_entitlement_weeks: 0.0000
expected_citations:
  - { section: QLD IR Act 2016 s.95(3), rule: accrual.7-to-10yr.qualifying-reasons-only-applies-to-casuals-too, pdfPage: 50 }
```

**Notes**

Casual employees are subject to the same s.95(3) qualifying-reason test as permanent employees. The casual-specific subdivision (s.102–105) governs continuity (s.103) and rate of pay (s.105); it does NOT carve a separate qualifying-reason regime.

---

### TC-QLD-018 — 8 yrs PT illness resignation → pro-rata payable

- **Source**: QLD IR Act 2016 s.95(3)(b)
- **Category**: PT — illness-initiated resignation

**Inputs**

```yaml
employee:
  id: TC-QLD-018
  employmentType: part_time
  /* 8 yrs PT 25h/wk @ $30/hr = $750/wk */
trigger: { kind: termination, terminationDate: 2026-05-25, reason: illness_incapacity }
extraInputs: { terminationInitiator: employee }
```

**Expected output**

```yaml
total_entitlement_weeks: 6.9333
value_of_week: 750.00
total_entitlement_dollars: 5199.98
expected_citations:
  - { section: QLD IR Act 2016 s.95(3)(b), rule: accrual.7-to-10yr.employee-illness-or-pressing-necessity, pdfPage: 50 }
```

---

### TC-QLD-019 — 4 yrs FT redundancy → $0 (well below threshold)

- **Source**: QLD IR Act 2016 s.95(3)
- **Category**: Negative — sub-7-yr sanity test

**Inputs**

```yaml
employee: { startDate: 2022-05-25, endDate: 2026-05-25 }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: redundancy }
```

**Expected output**

```yaml
total_entitlement_weeks: 0.0000
expected_citations:
  - { section: QLD IR Act 2016 s.95(3), rule: accrual.sub-7yr-no-entitlement-any-reason, pdfPage: 50 }
```

---

## §C — 10+ year automatic payout (any reason, incl. misconduct) (s.95(2))

> Critical QLD/NSW divergence from VIC: at 10+ years, **no qualifying-reason test applies** — s.95(2) confers automatic entitlement. This includes voluntary resignation, dismissal, redundancy, illness, death, AND **serious misconduct** (per Business QLD — "after 10 years, pro-rata is automatic regardless of termination reason"). The s.95(3)/(4) qualifying-reason gate sits BELOW 10 yrs only.

### TC-QLD-020 — 10 yrs FT voluntary resignation → full payout

- **Source**: QLD IR Act 2016 s.95(2)(a); Business QLD
- **Category**: 10-yr threshold, voluntary resignation

**Inputs**

```yaml
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
employee: { startDate: 2016-05-25, endDate: 2026-05-25, /* 10 yrs */ }
```

**Expected output**

```yaml
total_entitlement_weeks: 8.6667
expected_citations:
  - { section: QLD IR Act 2016 s.95(2)(a), rule: accrual.10yr-automatic-any-reason, pdfPage: 49 }
```

---

### TC-QLD-021 — 12 yrs FT dismissal → full payout

- **Source**: QLD IR Act 2016 s.95(2)(a) — accrual continues at 1/60 between 10 and 15 yrs
- **Category**: 10+ yr employer dismissal

**Inputs**

```yaml
employee: { startDate: 2014-05-25, endDate: 2026-05-25, /* 12 yrs */ }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: employer_initiated_not_misconduct }
```

**Expected output**

```yaml
total_entitlement_weeks: 10.4000              # 12 × 8.6667/10 (not yet at 15-yr step)
expected_citations:
  - { section: QLD IR Act 2016 s.95(2)(a), rule: accrual.10yr-automatic-any-reason, pdfPage: 49 }
```

**Notes**

Confirms that between 10 and 15 yrs the accrual continues at 1/60 per year (not capped at 8.6667 weeks). The 15-yr step adds 4.3333 weeks (= 13 weeks total) per s.95(2)(b) — see TC-QLD-047/048 for the 15-yr boundary.

---

### TC-QLD-022 — 12 yrs FT serious misconduct → STILL FULL PAYOUT

- **Source**: QLD IR Act 2016 s.95(2); Business QLD — "after 10 years, pro-rata is automatic regardless of termination reason"; APA p.50–51
- **Category**: 10+ yr misconduct — critical engine branching test
- **Why it matters**: At 10+ yrs, QLD has NO misconduct exception. Engine MUST pay out the full accrual. Diverges from the sub-10-yr behaviour (TC-QLD-014).

**Inputs**

```yaml
employee: { startDate: 2014-05-25, endDate: 2026-05-25, /* 12 yrs */ }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: serious_misconduct }
```

**Expected output**

```yaml
total_entitlement_weeks: 10.4000              # 12 × 8.6667/10 — full payout regardless of misconduct
expected_citations:
  - { section: QLD IR Act 2016 s.95(2)(a), rule: accrual.10yr-automatic-any-reason-incl-misconduct, pdfPage: 49 }
```

**Notes**

This is the diagnostic test pair with TC-QLD-014 (9 yr misconduct → $0). The single boundary at 10 yrs flips QLD's misconduct treatment from "no payout" to "full payout". NSW has the same flip at 10 yrs (TC-NSW-036). VIC has no misconduct exception at any tenure ≥ 7 yrs. The engine's per-state branching MUST:
- QLD < 10 yrs + misconduct → $0
- QLD ≥ 10 yrs + misconduct → full payout
- NSW < 10 yrs + misconduct → $0
- NSW ≥ 10 yrs + misconduct → full payout
- VIC ≥ 7 yrs + misconduct → full payout

---

### TC-QLD-023 — 13 yrs FT death → full pro-rata to estate

- **Source**: QLD IR Act 2016 s.95(2)(a), s.95(3)(a) (also applies but s.95(2) is the operative gate at 10+)
- **Category**: 10+ yr death

**Inputs**

```yaml
employee: { startDate: 2013-05-25, /* 13 yrs */ }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: death }
```

**Expected output**

```yaml
total_entitlement_weeks: 11.2667              # 13 × 8.6667/10
payment_recipient: "legal personal representative of the deceased employee"
expected_citations:
  - { section: QLD IR Act 2016 s.95(2)(a), rule: accrual.10yr-automatic-any-reason, pdfPage: 49 }
  - { section: QLD IR Act 2016 s.98,       rule: ordinary-pay.ordinary-rate-at-leave-time, pdfPage: 53 }
```

---

### TC-QLD-024 — 14 yrs casual termination → full payout, hours-based weekly avg

- **Source**: QLD IR Act 2016 s.95(2), s.105
- **Category**: 10+ yr casual

**Inputs**

```yaml
employee:
  id: TC-QLD-024
  employmentType: casual
  startDate: 2012-05-25  /* 14 yrs */
  currentHourlyRate: 40.00
  hoursLast52Weeks: 1664
  hoursTotalEmployment: 23296                  # 32 h/wk × 728 wks
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
```

**Expected output**

```yaml
total_entitlement_weeks: 12.1334               # 14 × 8.6667/10
weekly_avg: 1280.00                            # 1664/52 × 40 = $1,280
value_of_week: 1280.00
total_entitlement_dollars: 15530.75
expected_citations:
  - { section: QLD IR Act 2016 s.95(2)(a), rule: accrual.10yr-automatic-any-reason, pdfPage: 49 }
  - { section: QLD IR Act 2016 s.105,      rule: ordinary-pay.casual-loaded-hourly-rate, pdfPage: 57 }
```

---

## §D — Continuous-service edge cases (s.134, s.103)

### TC-QLD-025 — Paid annual leave counts as service (s.134)

```yaml
employee:
  id: TC-QLD-025
  startDate: 2016-05-25
  employmentType: full_time
  statesOfService: [QLD]
  governingJurisdiction: QLD
  currentWeeklyGross: 1500.00
  serviceEvents:
    - { type: paid_leave, startDate: 2026-01-12, endDate: 2026-02-09, note: "4 wks paid annual leave" }
trigger: { kind: as_at, asAtDate: 2026-05-25 }
expected_citations:
  - { section: QLD IR Act 2016 s.134, rule: continuous-service.paid-leave-counts, pdfPage: 56 }
  - { section: QLD IR Act 2016 s.93,  rule: continuous-service.definition-includes-paid-leave, pdfPage: 49 }
```

### TC-QLD-026 — Re-employment within 3 months preserves service (s.134)

```yaml
employee:
  id: TC-QLD-026
  startDate: 2017-05-25
  employmentType: full_time
  serviceEvents:
    - type: employer_initiated_termination_and_rehire
      startDate: 2025-08-01
      endDate:   2025-10-15           # 2.5 mo gap — under 3 mo cap
      note: "Dismissed and re-employed within 3 months — s.134 preserves prior service"
trigger: { kind: as_at, asAtDate: 2026-05-25 }
expected:
  prior_service_preserved: true
  days_in_gap_not_counted: 75
expected_citations:
  - { section: QLD IR Act 2016 s.134, rule: continuous-service.rehire-within-3mo-preserves, pdfPage: 56 }
```

---

### TC-QLD-027 — Re-employment after 4 months breaks service (s.134 ceiling)

```yaml
employee:
  id: TC-QLD-027
  startDate: 2014-05-25
  employmentType: full_time
  currentWeeklyGross: 2000.00
  serviceEvents:
    - type: employer_initiated_termination_and_rehire
      startDate: 2025-09-15
      endDate:   2026-01-22                # 4+ mo gap — exceeds 3 mo cap
trigger: { kind: as_at, asAtDate: 2026-05-25 }
expected:
  prior_service_preserved: false
  service_start_used: 2026-01-22
  years_of_continuous_service: 0.3367
  total_entitlement_weeks: 0.0000
warnings:
  - { code: gap_exceeds_state_tolerance, message: "Re-hire gap exceeded QLD's 3-month limit — prior service not preserved per QLD IR Act 2016 s.134." }
expected_citations:
  - { section: QLD IR Act 2016 s.134, rule: continuous-service.gap-exceeds-3mo-breaks-service, pdfPage: 56 }
```

**Notes**

Reuses the state-agnostic `gap_exceeds_state_tolerance` warning code introduced in VIC Phase 3 (TBD-VIC-03 resolution). NSW message says "2 months"; VIC message says "12 weeks"; QLD message says "3 months". Same enum, state-specific message text.

---

### TC-QLD-028 — Unpaid leave does not count toward service but preserves continuity (s.134)

```yaml
employee:
  id: TC-QLD-028
  startDate: 2014-07-01
  employmentType: full_time
  serviceEvents:
    - { type: leave_without_pay, startDate: 2024-01-01, endDate: 2024-06-30, note: "6 mo LWOP — does not count toward service" }
trigger: { kind: as_at, asAtDate: 2026-05-25 }
expected:
  continuity_preserved: true
  days_excluded_from_service: 181
expected_citations:
  - { section: QLD IR Act 2016 s.134, rule: continuous-service.unpaid-leave-does-not-count-but-no-break, pdfPage: 56 }
```

**Notes**

QLD treats ALL unpaid leave the same way: no service accrual, no break. Unlike VIC which has the 52-wk-counts rule (s.13(1)(b)/(c)) and unlike NSW which has special handling for some categories. The QLD rule is simpler and absolute.

---

### TC-QLD-029 — Workers Compensation counts as continuous service (s.134) + WC-reduced-rate advisory

```yaml
employee:
  id: TC-QLD-029
  startDate: 2018-05-25
  employmentType: full_time
  currentWeeklyGross: 1500.00            # reduced WC rate at time of as-at — partial-capacity WC payment
  extraInputs:
    preInjuryWeeklyRate: 1800.00          # for reference; NOT used in QLD calculation
  serviceEvents:
    - { type: workers_comp_absence, startDate: 2025-08-01, endDate: 2026-05-25, note: "Active WC at as-at date — engine emits reduced-rate advisory per TBD-QLD-05 resolution" }
trigger: { kind: as_at, asAtDate: 2026-05-25 }
expected:
  continuity_preserved: true
  days_counting_as_service: 297            # WC period counts
  value_of_week: 1500.00                   # current (reduced WC) rate per s.98, NOT pre-injury rate — QLD has no s.17 equivalent
  warnings:
    - { code: qld_lsl_calculated_at_wc_reduced_rate_warning, message: "LSL has been calculated at the rate in force at the time leave is taken under QLD IR Act 2016 s.98. The employee appears to be on workers compensation at a reduced rate. If feasible, defer taking LSL until the employee is back on their ordinary rate; QLD has no statutory higher-of-rates equivalent to VIC s.17." }
expected_citations:
  - { section: QLD IR Act 2016 s.134, rule: continuous-service.workers-comp-counts, pdfPage: 56 }
  - { section: QLD IR Act 2016 s.98,  rule: ordinary-pay.ordinary-rate-at-leave-time, pdfPage: 53 }
```

**Notes**

**Critical divergence from VIC**: VIC has s.17 explicit "higher of pre-injury or current rate" for WC employees. QLD has NO equivalent provision — the standard s.98 "ordinary rate at time of leave" applies, full stop. Per the resolved TBD-QLD-05: the engine applies the literal s.98 rate (even if it is the reduced WC rate) AND emits a `qld_lsl_calculated_at_wc_reduced_rate_warning` advisory when a `workers_comp_absence` event overlaps the trigger date OR when the trigger date falls within an active WC episode. The advisory suggests deferring LSL until the employee is back on their ordinary rate, if feasible. This surfaces the WC-rate-divergence-from-VIC behaviour to the user without changing the statutory math.

---

### TC-QLD-030 — Transfer of business preserves service (s.134)

```yaml
employee:
  id: TC-QLD-030
  startDate: 2014-05-25
  employmentType: full_time
  serviceEvents:
    - type: transfer_of_business
      startDate: 2021-07-01
      note: "Business sold; employee continues with new owner — s.134 preserves service"
trigger: { kind: as_at, asAtDate: 2026-05-25 }
expected:
  years_of_continuous_service: 12.0000
  total_entitlement_weeks: 10.4000
expected_citations:
  - { section: QLD IR Act 2016 s.134, rule: continuous-service.transfer-of-business-preserves-from-original-start, pdfPage: 56 }
```

---

### TC-QLD-031 — Transfer of business with dismissal-at-transfer + rehire within 3 mo (s.134)

```yaml
employee:
  id: TC-QLD-031
  startDate: 2014-05-25
  serviceEvents:
    - type: transfer_of_business
      startDate: 2021-07-01
    - type: employer_initiated_termination_and_rehire
      startDate: 2021-07-01
      endDate:   2021-09-15        # 2.5 mo gap — within 3 mo
      note: "Dismissed at business transfer; rehired by new owner within 3 mo — s.134 preserves total service"
trigger: { kind: as_at, asAtDate: 2026-05-25 }
expected:
  years_of_continuous_service: 12.0000   # no gap deducted — s.134 deems no break
  total_entitlement_weeks: 10.4000
expected_citations:
  - { section: QLD IR Act 2016 s.134, rule: continuous-service.transfer-dismissal-rehire-within-3mo, pdfPage: 56 }
```

**Notes**

The transfer-of-business carve-out is broader than the generic s.134 3-month rule. Business QLD: "Long service leave entitlements also transfer if an employee is dismissed at the time the business changes hands or within the preceding month and is then employed by the new employer within 3 months." Two-month-look-back-from-transfer-date + three-month-look-forward-window.

---

### TC-QLD-032 — Casual with 2-mo gap → service preserved (s.103)

```yaml
employee:
  id: TC-QLD-032
  employmentType: casual
  startDate: 2017-05-25
  serviceEvents:
    - { type: leave_without_pay, startDate: 2026-01-01, endDate: 2026-03-01, note: "2 mo gap — under 3 mo casual cap per s.103" }
trigger: { kind: as_at, asAtDate: 2026-05-25 }
expected:
  casual_continuity_preserved: true
expected_citations:
  - { section: QLD IR Act 2016 s.103, rule: continuous-service.casual-3mo-gap-rule, pdfPage: 56 }
```

### TC-QLD-033 — Casual with 4-mo gap → service breaks (s.103)

```yaml
employee:
  id: TC-QLD-033
  employmentType: casual
  startDate: 2014-05-25
  serviceEvents:
    - { type: leave_without_pay, startDate: 2025-08-01, endDate: 2025-12-15, note: "4.5 mo gap — exceeds 3 mo casual cap" }
trigger: { kind: as_at, asAtDate: 2026-05-25 }
expected:
  casual_continuity_preserved: false
  service_start_used: 2025-12-15
warnings:
  - { code: gap_exceeds_state_tolerance, message: "Casual gap exceeded QLD's 3-month limit between contracts — prior casual service not preserved per QLD IR Act 2016 s.103." }
expected_citations:
  - { section: QLD IR Act 2016 s.103, rule: continuous-service.casual-3mo-gap-breaks-service, pdfPage: 56 }
```

---

### TC-QLD-034 — Industrial dispute + slackness — service preserved (s.134(2))

```yaml
employee:
  id: TC-QLD-034
  startDate: 2016-05-25
  serviceEvents:
    - { type: employer_stand_down, startDate: 2024-08-01, endDate: 2024-10-01, note: "61 days stand-down due to slackness of trade — s.134(2)(b)" }
trigger: { kind: as_at, asAtDate: 2026-05-25 }
expected:
  continuity_preserved: true
  days_excluded_from_service: 61              # continuity preserved but stand-down does not count as service
expected_citations:
  - { section: QLD IR Act 2016 s.134, rule: continuous-service.stand-down-slackness-continuous-but-no-accrual, pdfPage: 56 }
```

**Notes**

QLD s.134(2) preserves continuity for industrial disputes and slackness-of-trade stand-downs (similar to VIC s.12(7)/(8)). Whether the stand-down period itself COUNTS toward accrual is more ambiguous in QLD — the Act lists what preserves continuity but is less explicit about what counts as service. Business QLD's "continuous service refers to paid working time and paid leave" implies stand-down periods (unpaid) do not count. The engine treats stand-down as continuity-preserving but accrual-excluding. Per the resolved TBD-QLD-02: this aligns with VIC's explicit s.14(c) exclusion as a sensible default; the engine emits the citation note and the user can override via service-event editing if they have a contrary industrial-instrument provision.

---

## §E — Historical-cliff cases (s.96, s.103)

### TC-QLD-035 — Employee starting before 23 June 1990 — s.96 advisory

- **Source**: QLD IR Act 2016 s.96 — Continuity of service: service before 23 June 1990
- **Category**: Historical cliff advisory (NOT a calculation change in practice)

```yaml
employee:
  id: TC-QLD-035
  legalName: PreCliffEmployeeFixture
  startDate: 1985-07-01                  # pre-1990 cliff
  employmentType: full_time
  statesOfService: [QLD]
  governingJurisdiction: QLD
  currentWeeklyGross: 1800.00
  wageHistory: [...]                      # 40 yrs of weekly pay
  serviceEvents: []
trigger: { kind: as_at, asAtDate: 2026-05-25 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 35.9000   # day-precise from 1985-07-01
total_entitlement_weeks: 31.1133       # at 35.9 yrs: 8.6667 (first 10y) + 4.3333 (10-15y step) + 4.3333 per 5-yr step thereafter (continuous accrual at 1/60 after 15 yrs per Business QLD)
warnings:
  - { code: pre_1990_service_advisory_qld, message: "This employee's start date predates 23 June 1990. The Industrial Relations Act 2016 (Qld) s.96 contains transitional rules for service before that date. In practice the employee's post-1990 service alone exceeds the qualifying period, so the cliff is moot for the accrual calculation; we flag it here so the user can confirm with their industrial relations adviser if the employee's pre-1990 service is governed by an earlier industrial award that may have preserved it. Engine has used the full start date as the service anchor; if the user prefers a 23 June 1990 anchor, recompute with a manual override." }
expected_citations:
  - { section: QLD IR Act 2016 s.96, rule: continuous-service.pre-1990-cliff-advisory, pdfPage: 51 }
  - { section: QLD IR Act 2016 s.95(2)(b), rule: accrual.15yr-additional-step, pdfPage: 49 }
```

**Notes**

The s.96 cliff is rarely operative in practice — an employee with pre-1990 start has at minimum 35.9 years of post-1990 service to 2026, well past the qualifying period. Per the resolved TBD-QLD-02: the engine surfaces the cliff as a `pre_1990_service_advisory_qld` non-blocking warning AND uses the actual start date in the accrual computation (advisory-only treatment). No hard-anchor for the general cliff.

---

### TC-QLD-036 — Casual starting before 30 March 1994 — only post-1994 service counts (s.103)

- **Source**: QLD IR Act 2016 s.103; Business QLD — "as from 30 March 1994, all continuous service of a casual employee is taken into account"
- **Category**: Historical cliff — casual

```yaml
employee:
  id: TC-QLD-036
  legalName: PreCasualCliffFixture
  startDate: 1992-05-25                   # pre-1994 cliff
  employmentType: casual
  statesOfService: [QLD]
  governingJurisdiction: QLD
  currentHourlyRate: 40.00
  hoursLast52Weeks: 1664
trigger: { kind: as_at, asAtDate: 2026-05-25 }
```

**Expected output**

```yaml
status: computed
service_start_used: 1994-03-30           # casual cliff applies — service before 30 March 1994 does not count
years_of_continuous_service: 32.1547     # from 1994-03-30 to 2026-05-25
total_entitlement_weeks: 27.8675         # 32.1547 × 8.6667/10 (continuous accrual)
warnings:
  - { code: pre_1994_casual_cliff_qld, message: "This casual employee's start date precedes 30 March 1994. Casual service before that date does not count toward LSL under QLD IR Act 2016 s.103. Engine has anchored service to 30 March 1994." }
expected_citations:
  - { section: QLD IR Act 2016 s.103, rule: continuous-service.casual-cliff-30mar1994, pdfPage: 56 }
```

**Notes**

This is the most operationally significant historical cliff for the engine because casual employees with extremely long tenure are relatively common in some industries (hospitality, retail). The engine MUST anchor pre-1994 casual service to 30 March 1994 and surface the warning. Permanent (FT/PT) employees do NOT have this cliff — only casuals.

---

### TC-QLD-037 — Permanent employee starting in 1992 — full service counts (no casual cliff)

```yaml
employee:
  id: TC-QLD-037
  startDate: 1992-05-25
  employmentType: full_time
trigger: { kind: as_at, asAtDate: 2026-05-25 }
expected:
  years_of_continuous_service: 34.0000   # full start date used
  service_start_used: 1992-05-25
  total_entitlement_weeks: 29.4667        # 34 × 8.6667/10
expected_citations:
  - { section: QLD IR Act 2016 s.95(2), rule: accrual.qualifying-period-10yr-permanent, pdfPage: 49 }
  - { section: QLD IR Act 2016 s.96,   rule: continuous-service.pre-1990-cliff-not-engaged, pdfPage: 51, note: "Start date post-1990; cliff not engaged" }
```

**Notes**

Pair with TC-QLD-036 — same start year, different employment type, different cliff treatment. Confirms the casual cliff is casual-specific.

---

### TC-QLD-038 — Employee transitioning from casual (pre-1994) to permanent (post-1994)

```yaml
employee:
  id: TC-QLD-038
  startDate: 1992-05-25
  employmentType: full_time              # current
  extraInputs:
    employmentTypeHistory:
      - { period: 1992-05-25..1995-12-31, type: casual, note: "Pre-cliff casual" }
      - { period: 1996-01-01..2026-05-25, type: full_time, note: "Post-cliff permanent" }
trigger: { kind: as_at, asAtDate: 2026-05-25 }
```

**Expected output**

```yaml
status: computed
service_start_used: 1994-03-30           # casual cliff applies retrospectively to pre-1994 casual segment
# but post-cliff permanent service from 1996-01-01 also counts independently
years_of_continuous_service: 32.1547     # from 1994-03-30
warnings:
  - { code: pre_1994_casual_cliff_qld, message: "..." }
  - { code: employment_type_transition_qld, message: "Casual service before 30 March 1994 excluded; subsequent permanent service from 1996 counts fully." }
expected_citations:
  - { section: QLD IR Act 2016 s.103, rule: continuous-service.casual-cliff-30mar1994, pdfPage: 56 }
  - { section: QLD IR Act 2016 s.134, rule: continuous-service.casual-to-permanent-transition, pdfPage: 56 }
```

**Notes**

Per the resolved TBD-QLD-02: when an employee transitions from casual to permanent mid-tenure, the cliff applies only to the casual portion. The cliff strips pre-1994 casual hours but does NOT strip post-cliff permanent service. The engine emits both the casual cliff warning AND the employment-type-transition warning.

---

## §F — Ordinary pay — fixed-rate, casual loading, commission (s.98, s.99, s.105)

### TC-QLD-039 — FT fixed-rate, hours unchanged 5+ yrs → s.98 ordinary rate

```yaml
employee: { id: TC-QLD-039, employmentType: full_time, normalWeeklyHours: 38, currentWeeklyGross: 2000.00 }
trigger: { kind: taking_leave, leaveStartDate: 2026-06-01, leaveWeeks: 8.6667 }
expected:
  value_of_week: 2000.00
expected_citations:
  - { section: QLD IR Act 2016 s.98, rule: ordinary-pay.ordinary-rate-at-leave-time, pdfPage: 53 }
```

### TC-QLD-040 — PT fixed-rate 25h/wk for 11 yrs → s.98

```yaml
employee: { id: TC-QLD-040, employmentType: part_time, normalWeeklyHours: 25, currentWeeklyGross: 750.00 }
expected:
  value_of_week: 750.00
expected_citations:
  - { section: QLD IR Act 2016 s.98, rule: ordinary-pay.ordinary-rate-at-leave-time, pdfPage: 53 }
```

### TC-QLD-041 — Overtime NOT included in ordinary rate (s.98)

```yaml
employee:
  id: TC-QLD-041
  employmentType: full_time
  normalWeeklyHours: 38
  currentWeeklyGross: 1900.00              # = base rate × 38
  extraInputs:
    overtimeWeeklyGross: 500.00             # NOT included in value_of_week
expected:
  value_of_week: 1900.00                    # overtime excluded
expected_citations:
  - { section: QLD IR Act 2016 s.98, rule: ordinary-pay.overtime-excluded, pdfPage: 53 }
```

**Notes**

Business QLD: "ordinary rate (i.e. excluding overtime payments)". Engine MUST trust the user-supplied weekly gross and assume overtime has been excluded — the calculator does NOT decompose gross-pay components.

### TC-QLD-042 — Casual loaded hourly rate used for LSL pay (s.105)

```yaml
employee:
  id: TC-QLD-042
  employmentType: casual
  currentHourlyRate: 38.00                  # loaded rate (incl. 25% casual loading)
  hoursLast52Weeks: 1664
  /* 12 yrs continuous casual */
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
expected:
  value_of_week: 1216.00                    # 1664/52 × 38 = 32 × 38 = $1,216
expected_citations:
  - { section: QLD IR Act 2016 s.105, rule: ordinary-pay.casual-loaded-hourly-rate, pdfPage: 57 }
```

### TC-QLD-043 — Commission employee — average commission over preceding year (s.99)

```yaml
employee:
  id: TC-QLD-043
  legalName: CommissionAvg
  startDate: 2014-05-25
  employmentType: full_time
  statesOfService: [QLD]
  governingJurisdiction: QLD
  wageHistory:
    - { periodStart: 2025-05-26, periodEnd: 2026-05-25, grossPay: 95000.00, frequency: other, periodDays: 365, note: "Year-before-leave commission earnings — drives s.99 averaging" }
    - { periodStart: 2014-05-25, periodEnd: 2025-05-25, grossPay: 800000.00, frequency: other, periodDays: 4018 }
  serviceEvents: []
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
expected:
  weekly_avg_year_before: 1826.92             # $95,000 / 52
  value_of_week: 1826.92
  years_of_continuous_service: 12.0000
  total_entitlement_weeks: 10.4000
  total_entitlement_dollars: 18999.97
expected_citations:
  - { section: QLD IR Act 2016 s.99, rule: ordinary-pay.commission-year-before-average, pdfPage: 53 }
  - { section: QLD IR Act 2016 s.95(2)(a), rule: accrual.10yr-automatic-any-reason, pdfPage: 49 }
```

**Notes**

QLD s.99 mandates a single 52-week average for commission employees — different from VIC's 3-tier "greater of" rule (s.15(2)). Engine MUST apply the simpler s.99 formula when state = QLD AND employee category is commission-based. The user identifies the commission category via the wage-history pattern (volatile periodic gross with no fixed per-hour rate).

### TC-QLD-044 — Piece-rate worker (s.100)

```yaml
employee:
  id: TC-QLD-044
  legalName: PieceRateFixture
  employmentType: full_time
  /* 12 yrs piece-rate */
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
expected_citations:
  - { section: QLD IR Act 2016 s.100, rule: ordinary-pay.piecework-rate-disputes, pdfPage: 53, note: "Piecework rate disputes resolved by QIRC — calculator uses user-supplied weekly gross" }
```

**Notes**

s.100 specifies QIRC arbitration for piecework-rate disputes. The calculator does NOT compute the dispute resolution — it trusts the user-supplied weekly gross. (Note: TBD-QLD-04's resolution governs cash-out advisory granularity, not piecework — the piecework treatment was uncontested in the v1.0-draft and stands as written.)

### TC-QLD-045 — Above-award rate honoured

```yaml
employee:
  id: TC-QLD-045
  currentWeeklyGross: 2500.00              # above the applicable award rate
expected:
  value_of_week: 2500.00                    # higher rate per Business QLD
expected_citations:
  - { section: QLD IR Act 2016 s.98, rule: ordinary-pay.above-award-rate-honoured, pdfPage: 53 }
```

### TC-QLD-046 — Allowances forming part of contract — included

```yaml
employee:
  id: TC-QLD-046
  currentWeeklyGross: 1700.00              # $1500 base + $200/wk car allowance bundled
expected:
  value_of_week: 1700.00                    # contractual allowance included
expected_citations:
  - { section: QLD IR Act 2016 s.98, rule: ordinary-pay.contractual-allowances-included, pdfPage: 53 }
```

**Notes**

Same convention as NSW and VIC — engine trusts the user-supplied gross. Whether a given allowance forms part of the contract is a legal question outside the calculator's scope.

---

## §G — 15-year accrual step (s.95(2)(b))

### TC-QLD-047 — Exactly 15 yrs FT → 13 weeks total (8.6667 + 4.3333)

- **Source**: QLD IR Act 2016 s.95(2)(b); Business QLD — "additional 4.3333 weeks after a further 5 years"
- **Category**: 15-yr boundary

```yaml
employee: { startDate: 2011-05-25, endDate: 2026-05-25, /* exactly 15 yrs */ }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
expected:
  years_of_continuous_service: 15.0000
  total_entitlement_weeks: 13.0000         # 8.6667 + 4.3333 = 13.0000 per s.95(2)(b)
expected_citations:
  - { section: QLD IR Act 2016 s.95(2)(a), rule: accrual.first-entitlement-10yr-8.6667wks, pdfPage: 49 }
  - { section: QLD IR Act 2016 s.95(2)(b), rule: accrual.15yr-additional-4.3333wks, pdfPage: 49 }
```

**Notes**

Per the resolved TBD-QLD-01: accrual is **continuous at 1/60** with no discrete step at 15 yrs. Between 10 and 15 yrs, accrual proceeds smoothly (12 yr → 10.4000 wks, 14 yr → 12.1333 wks). The 13-wk figure at 15 yrs is the arithmetic outcome of `15 × 8.6667 / 10 = 13.00005 ≈ 13.0`, not a separate accrual band. Thresholds at 7, 10, 15 yrs are inclusive at exact-day boundary.

---

### TC-QLD-048 — 16 yrs FT → 13.86 wks (continuous accrual at 1/60 after 15)

```yaml
employee: { startDate: 2010-05-25, endDate: 2026-05-25, /* 16 yrs */ }
expected:
  years_of_continuous_service: 16.0000
  total_entitlement_weeks: 13.8667         # 16 × 8.6667/10
expected_citations:
  - { section: QLD IR Act 2016 s.95(2),    rule: accrual.continuous-1-per-60-after-15yr, pdfPage: 49 }
```

**Notes**

Accrual continues at 1/60 across all tenure bands ≥ 10 yrs. Per the resolved TBD-QLD-01, the engine treats accrual as continuous (no discrete step) — no flatten-and-jump at 15 yrs.

---

## §H — Cashing out — NON-BLOCKING advisory (s.110)

> **Critical**: cashing out LSL in QLD is **NOT a criminal offence** (unlike VIC). It is **permitted but restricted** — only valid via (a) an industrial instrument (modern award, certified agreement, bargaining award) that authorises it, OR (b) a QIRC order on financial hardship or compassionate grounds. The calculator computes the value AND surfaces an advisory citation note — it does NOT hard-error.

### TC-QLD-049 — Cash-out attempt on 12-yr employee → ADVISORY (value computed)

- **Source**: QLD IR Act 2016 s.110; impl-plan §4 — "Cashing-out: not blocked, but emits citation referencing the QIRC/EA-permission rule"
- **Category**: Cash-out advisory

**Inputs**

```yaml
employee:
  id: TC-QLD-049
  legalName: CashOutFixture
  startDate: 2014-05-25
  employmentType: full_time
  statesOfService: [QLD]
  governingJurisdiction: QLD
  currentWeeklyGross: 1800.00
  serviceEvents: []
trigger: { kind: cash_out, cashOutDate: 2026-05-25 }
```

**Expected output**

```yaml
status: computed
years_of_continuous_service: 12.0000
total_entitlement_weeks: 10.4000
value_of_week: 1800.00
total_entitlement_dollars: 18720.00
warnings:
  - { code: qld_cashout_requires_instrument_or_qirc, message: "Cashing out long service leave in Queensland is permitted only if (a) an applicable industrial instrument (modern award, certified agreement, bargaining award) authorises it, OR (b) the Queensland Industrial Relations Commission orders cash-out on financial hardship or compassionate grounds. Engine has computed the value of the leave as if cashed out, but the legal authority to cash out MUST be verified before paying. See QLD IR Act 2016 s.110." }
expected_citations:
  - { section: QLD IR Act 2016 s.110, rule: cash-out.industrial-instrument-or-qirc-permission, pdfPage: 58 }
  - { section: QLD IR Act 2016 s.95(2)(a), rule: accrual.10yr-automatic-any-reason, pdfPage: 49 }
  - { section: QLD IR Act 2016 s.98, rule: ordinary-pay.ordinary-rate-at-leave-time, pdfPage: 53 }
page_event:
  name: qld_cashout_advisory
  payload: null   # MUST NOT log input PII per spec S2 (same convention as VIC)
```

**Notes**

This is the **second critical engine branching point** distinguishing VIC (hard error) from QLD (advisory + compute). Engine MUST:
- VIC + `cash_out` → `status: failed`, error code `vic_cashout_prohibited`, citing s.34
- QLD + `cash_out` → `status: computed`, warning code `qld_cashout_requires_instrument_or_qirc`, citing s.110
- NSW + `cash_out` → `status: failed`, error code `cashout_not_in_v1_scope` (NSW doesn't model cash-out in v1)
- NT + `cash_out` (Phase 9) → hard error like VIC, citing NT s.12

Per the resolved TBD-QLD-04: the engine does NOT require user input confirming the s.110 ground (financial hardship / compassionate / industrial instrument). The calculator computes the value; the legal authority is the user's responsibility. A single advisory message covers all s.110 grounds.

---

### TC-QLD-050 — Cash-out attempt on 8-yr employee → ADVISORY + sub-10-yr warning

```yaml
employee: { startDate: 2018-05-25, /* 8 yrs */, /* reason for cash-out is moot — engine computes regardless */ }
trigger: { kind: cash_out, cashOutDate: 2026-05-25 }
expected:
  status: computed
  total_entitlement_weeks: 6.9333          # 8 × 8.6667/10 — pro-rata as if a qualifying-reason termination were happening
  warnings:
    - { code: qld_cashout_requires_instrument_or_qirc, message: "..." }
    - { code: sub_10yr_cashout_only_via_qirc_qld, message: "Cash-out requests below 10 yrs of service in QLD are typically only granted by QIRC order on financial hardship or compassionate grounds. Industrial instruments rarely authorise pre-10-yr cash-out. Verify legal authority before paying." }
expected_citations:
  - { section: QLD IR Act 2016 s.110, rule: cash-out.industrial-instrument-or-qirc-permission, pdfPage: 58 }
```

**Notes**

The cash-out advisory takes a STRONGER form below 10 yrs because the entitlement hasn't yet vested. Per the resolved TBD-QLD-04: the engine emits BOTH advisories (the standard s.110 one AND a sub-10-yr-specific one).

---

### TC-QLD-051 — Cash-out attempt on 5-yr employee → ADVISORY + sub-7-yr warning + value = $0

```yaml
employee: { startDate: 2021-05-25, /* 5 yrs */ }
trigger: { kind: cash_out, cashOutDate: 2026-05-25 }
expected:
  status: computed
  total_entitlement_weeks: 0.0000          # below 7-yr — no entitlement exists to cash out
  total_entitlement_dollars: 0.00
  warnings:
    - { code: sub_7yr_no_entitlement_qld, message: "..." }
    - { code: qld_cashout_no_entitlement_to_cash_out, message: "Below the 7-yr qualifying period, no LSL entitlement has accrued — there is nothing to cash out under QLD IR Act 2016 s.95." }
expected_citations:
  - { section: QLD IR Act 2016 s.95(3), rule: accrual.sub-7yr-no-entitlement-any-reason, pdfPage: 50 }
  - { section: QLD IR Act 2016 s.110,   rule: cash-out.no-entitlement-yet-to-cash-out, pdfPage: 58 }
```

---

### TC-QLD-052 — Termination trigger with apparent cash-out intent — STILL LAWFUL

```yaml
employee: { startDate: 2014-05-25, /* 12 yrs */ }
trigger: { kind: termination, terminationDate: 2026-05-25, reason: voluntary_resignation }
expected:
  status: computed
  total_entitlement_weeks: 10.4000
  total_entitlement_dollars: 18720.00
expected_citations:
  - { section: QLD IR Act 2016 s.95(2)(a), rule: accrual.10yr-automatic-any-reason, pdfPage: 49 }
```

**Notes**

QLD has no equivalent of VIC's s.23 contracting-out prohibition that explicitly polices sham terminations. As with VIC, the calculator does NOT police intent — it processes the trigger as supplied. Pay out on termination is lawful under s.95.

---

## §I — Public holiday during LSL (s.97)

### TC-QLD-053 — Australia Day PH falls during LSL window → extends leave by 1 day

```yaml
employee: { id: TC-QLD-053, /* 12-yr FT employee */ }
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
  - { section: QLD IR Act 2016 s.97, rule: trigger.taking-leave.public-holiday-exclusive, pdfPage: 53 }
```

**Notes**

Identical behaviour to NSW (TC-NSW-018) and VIC (TC-VIC-054). PH exclusive of LSL — same convention. Engine MUST NOT apply SA's inclusive treatment when state = QLD.

---

## §J — As-at snapshot trigger

### TC-QLD-054 — 5 yrs as-at snapshot → reports 4.33 wks accrued (regardless of pay-out eligibility)

- **Source**: F11 + D20 from E1 spec — as-at bypasses qualifying-reason gates for snapshot
- **Category**: As-at — sub-7-yr accrued

```yaml
employee: { startDate: 2021-05-25, /* 5 yrs */, employmentType: full_time, currentWeeklyGross: 1500.00 }
trigger: { kind: as_at, asAtDate: 2026-05-25 }
expected:
  status: computed
  years_of_continuous_service: 5.0000
  total_entitlement_weeks: 4.3333          # 5 × 8.6667/10 — accrued snapshot per spec D20
  value_of_week: 1500.00
  total_entitlement_dollars: 6499.95
  payable_indicator: "accrued, not currently payable"
  warnings:
    - { code: accrued_not_currently_payable, message: "Accrued LSL snapshot for liability/audit reporting. Employee is below the 7-year threshold under QLD IR Act 2016 s.95 and is not currently entitled to take or be paid out this value." }
expected_citations:
  - { section: QLD IR Act 2016 s.95, rule: accrual.snapshot.no-qualifying-reason-threshold, pdfPage: 49, note: "as-at snapshot per E1 spec D20 — qualifying-period threshold NOT applied" }
```

### TC-QLD-055 — 11 yrs as-at snapshot → 9.5333 wks (above qualifying threshold)

```yaml
trigger: { kind: as_at, asAtDate: 2026-05-25 }
employee: { startDate: 2015-05-25, /* 11 yrs */ }
expected:
  total_entitlement_weeks: 9.5333
  payable_indicator: "payable"
```

---

## §K — Cross-jurisdiction (QLD + other state)

### TC-QLD-056 — QLD + NSW service, NSW nominated → routed to NSW engine

```yaml
employee:
  id: TC-QLD-056
  statesOfService: [QLD, NSW]
  governingJurisdiction: NSW
trigger: { kind: as_at, asAtDate: 2026-05-25 }
expected:
  state_used: NSW
  warnings:
    - { code: cross_jurisdiction_pending, message: "Employee has worked in QLD and NSW. The sufficiently connected test (legal judgement, not arithmetic — see APA LSL Masterclass p.138) is for legal counsel where doubt exists. Engine has computed using user-nominated governing jurisdiction: NSW." }
```

### TC-QLD-057 — QLD + WA service, governing NOT nominated → BLOCKED

```yaml
employee: { statesOfService: [QLD, WA], governingJurisdiction: null }
expected:
  status: blocked_cross_jurisdiction
  outputs: null
  warnings:
    - { code: cross_jurisdiction_pending, message: "Employee has worked in QLD and WA. Please nominate the governing jurisdiction to proceed." }
```

**Notes**

In v1's QLD-released-after-VIC timeline, the user MAY nominate QLD, VIC, or NSW. WA is not yet encoded — selecting it returns a "WA not yet supported" error per E2 spec F17.

---

# Bulk-mode test cases

### TC-QLD-BULK-001 — 5-employee QLD-only fixture, mixed tenures and triggers

- **Source**: spec F17 + AC16; impl-plan §2 / Phase 2 (bulk mixed-state foundation)

**Inputs (CSV — abbreviated)**

```csv
employee_id,row_type,state,start_date,employment_type,trigger,trigger_date,gross_pay,period_frequency,reason
Q01,pay_period,QLD,2014-05-25,full_time,as_at,2026-05-25,98000.00,weekly,                        # 12 yr FT
Q02,pay_period,QLD,2018-05-25,full_time,termination,2026-05-25,78000.00,weekly,redundancy        # 8 yr FT redundancy → pro-rata
Q03,pay_period,QLD,2017-05-25,part_time,as_at,2026-05-25,39000.00,weekly,                         # 9 yr PT as-at
Q04,pay_period,QLD,2015-05-25,casual,termination,2026-05-25,55000.00,other,voluntary_resignation  # 11 yr casual → full payout
Q05,pay_period,QLD,2020-05-25,full_time,termination,2026-05-25,78000.00,weekly,voluntary_resignation  # 6 yr FT resignation → $0 (sub-7)
```

**Expected output**

```yaml
total_rows: 5
status_breakdown: { computed: 5, blocked: 0, failed: 0 }
row_results:
  Q01: { state_used: QLD, total_entitlement_weeks: 10.4000, dollars: 19600.00 }
  Q02: { state_used: QLD, total_entitlement_weeks: 6.9333,  dollars: 10399.95 }    # redundancy = qualifying reason
  Q03: { state_used: QLD, total_entitlement_weeks: 7.8000,  dollars: 5850.00 }     # as_at — no qualifying-reason gate
  Q04: { state_used: QLD, total_entitlement_weeks: 9.5333,  dollars: 10086.62 }    # 11yr casual, loaded rate
  Q05: { state_used: QLD, total_entitlement_weeks: 0.0000,  dollars: 0.00 }        # sub-7yr resignation → $0
all_rows_have_state_used_QLD: true
```

---

### TC-QLD-BULK-002 — 10-employee mixed NSW + VIC + QLD, with case-normalisation

```csv
employee_id,row_type,state,start_date,employment_type,trigger,trigger_date,...
NVQ01,pay_period,NSW,2014-05-25,full_time,as_at,2026-05-25,...
NVQ02,pay_period,VIC,2018-05-25,full_time,as_at,2026-05-25,...
NVQ03,pay_period,QLD,2015-05-25,casual,as_at,2026-05-25,...
NVQ04,pay_period,qld,2017-05-25,part_time,as_at,2026-05-25,...           # lowercase — should normalise
NVQ05,pay_period,Qld,2020-05-25,full_time,as_at,2026-05-25,...           # mixed case — should normalise
NVQ06,pay_period,QLD,2014-05-25,full_time,termination,2026-05-25,...,reason=serious_misconduct  # 12 yr misconduct → FULL PAYOUT
NVQ07,pay_period,QLD,2018-05-25,full_time,termination,2026-05-25,...,reason=serious_misconduct  # 8 yr misconduct → $0
NVQ08,pay_period,,2019-05-25,full_time,as_at,2026-05-25,...              # EMPTY state — row-level validation error
NVQ09,pay_period,XYZ,2019-05-25,full_time,as_at,2026-05-25,...           # UNRECOGNISED state — row-level validation error
NVQ10,pay_period,QLD,1992-05-25,casual,as_at,2026-05-25,...              # PRE-1994 casual cliff
```

**Expected output**

```yaml
total_rows: 10
status_breakdown: { computed: 8, blocked: 0, failed: 2 }
row_results:
  NVQ01: { state_used: NSW, status: computed }
  NVQ02: { state_used: VIC, status: computed }
  NVQ03: { state_used: QLD, status: computed }
  NVQ04: { state_used: QLD, status: computed }     # case-normalised
  NVQ05: { state_used: QLD, status: computed }     # case-normalised
  NVQ06: { state_used: QLD, status: computed }     # 12yr misconduct → full payout per s.95(2)
  NVQ07: { state_used: QLD, status: computed, total_entitlement_dollars: 0.00, warnings: [{ code: sub_10yr_misconduct_excluded_qld }] }
  NVQ08: { status: failed, error: { code: state_missing_or_empty, userMessage: "..." } }
  NVQ09: { status: failed, error: { code: state_unrecognised_or_not_yet_encoded, userMessage: "Row 9: state \"XYZ\" is not recognised or not yet encoded in this version. Currently encoded: NSW, VIC, QLD. Set the row's state and re-upload, OR remove the row." } }
  NVQ10: { state_used: QLD, status: computed, warnings: [{ code: pre_1994_casual_cliff_qld }] }
```

**Notes**

Asserts (a) the per-state engine branching is row-scoped, (b) case-normalisation works, (c) historical cliffs apply per-row, (d) misconduct treatment flips at 10 yrs per row. Critical regression fixture for the multi-state bulk pipeline.

---

### TC-QLD-BULK-003 — QLD cash-out attempt mid-batch → row-level advisory, batch continues

```csv
employee_id,row_type,state,trigger,trigger_date,...
CO-Q01,pay_period,QLD,as_at,2026-05-25,...                  # normal
CO-Q02,pay_period,QLD,cash_out,2026-05-25,...               # ADVISORY (computed) — s.110
CO-Q03,pay_period,VIC,cash_out,2026-05-25,...               # HARD ERROR (failed) — s.34
CO-Q04,pay_period,NSW,as_at,2026-05-25,...                  # normal
CO-Q05,pay_period,QLD,termination,2026-05-25,...            # normal — termination is lawful
```

**Expected output**

```yaml
total_rows: 5
status_breakdown: { computed: 4, blocked: 0, failed: 1 }
row_results:
  CO-Q01: { state_used: QLD, status: computed }
  CO-Q02:
    state_used: QLD
    status: computed                                # NOT failed — QLD cash-out is advisory
    warnings: [{ code: qld_cashout_requires_instrument_or_qirc }]
  CO-Q03:
    state_used: VIC
    status: failed                                  # VIC cash-out IS a hard error
    error: { code: vic_cashout_prohibited }
  CO-Q04: { state_used: NSW, status: computed }
  CO-Q05: { state_used: QLD, status: computed }
batch_outcome: "completed with 1 row-level failure (VIC cash-out) and 1 advisory (QLD cash-out); 4 rows computed"
```

**Notes**

This is the critical fixture proving the per-state cash-out branching: QLD computes-with-advisory, VIC hard-errors. NSW does not model cash-out in v1 (would also hard-error with `cashout_not_in_v1_scope` if added). Engine MUST distinguish per-row, not batch-globally.

---

# Coverage matrix

| Spec / source item | Covered by |
|---|---|
| **QLD IR Act 2016 s.93** — Definitions for division (continuous service definition) | TC-QLD-025, TC-QLD-001 (implicit) |
| **QLD IR Act 2016 s.94** — Application of pt 4 for particular purposes (cross-ref to s.134) | All TC-QLD-NNN (implicit via continuous-service handling) |
| **QLD IR Act 2016 s.95(2)(a)** — first entitlement 8.6667 wks at 10 yrs | TC-QLD-001, TC-QLD-020, TC-QLD-021, TC-QLD-022, TC-QLD-023, TC-QLD-024 |
| **QLD IR Act 2016 s.95(2)(b)** — additional 4.3333 wks at 15 yrs | TC-QLD-047, TC-QLD-048 |
| **QLD IR Act 2016 s.95(3)** — sub-10-yr qualifying-reason gate | TC-QLD-002, TC-QLD-003 → TC-QLD-008, TC-QLD-011 → TC-QLD-019 |
| **QLD IR Act 2016 s.95(3)(a)** — death | TC-QLD-006, TC-QLD-023 |
| **QLD IR Act 2016 s.95(3)(b)** — employee illness or domestic pressing necessity | TC-QLD-004, TC-QLD-016, TC-QLD-018 |
| **QLD IR Act 2016 s.95(3)(c)** — employer dismissal for employee's illness | TC-QLD-005 |
| **QLD IR Act 2016 s.95(3)(d)** — dismissal not for conduct/capacity/performance | TC-QLD-003, TC-QLD-007, TC-QLD-012, TC-QLD-014, TC-QLD-015 |
| **QLD IR Act 2016 s.95(3)(e)** — unfair dismissal | TC-QLD-008 |
| **QLD IR Act 2016 s.95(4)** — proportionate payment formula | TC-QLD-003, TC-QLD-004, TC-QLD-006, TC-QLD-007 |
| **QLD IR Act 2016 s.96** — Continuity of service: service before 23 June 1990 | TC-QLD-035, TC-QLD-037 |
| **QLD IR Act 2016 s.97** — Taking long service leave (incl. PH exclusive) | TC-QLD-053 |
| **QLD IR Act 2016 s.98** — Rate of payment (ordinary rate, no overtime) | TC-QLD-001, TC-QLD-029, TC-QLD-039 → TC-QLD-046 |
| **QLD IR Act 2016 s.99** — Payment for commission | TC-QLD-043 |
| **QLD IR Act 2016 s.100** — Disputes about payment: piecework rates | TC-QLD-044 |
| **QLD IR Act 2016 s.101** — Other matters relating to payment | Coverage out of v1 scope; not encoded |
| **QLD IR Act 2016 s.102** — Definition for subdivision (casual/regular-PT) | TC-QLD-009 (implicit), TC-QLD-017 (implicit) |
| **QLD IR Act 2016 s.103** — Continuity of service: casual employees (3-mo cap, 30 Mar 1994 cliff) | TC-QLD-009, TC-QLD-032, TC-QLD-033, TC-QLD-036, TC-QLD-038 |
| **QLD IR Act 2016 s.104** — Taking LSL: casual/regular-PT | TC-QLD-009 (implicit) |
| **QLD IR Act 2016 s.105** — Payment for LSL (casual loaded rate) | TC-QLD-009, TC-QLD-024, TC-QLD-042 |
| **QLD IR Act 2016 s.106–108** — Seasonal employees in sugar industry and meat works | Coverage out of v1 scope; deferred |
| **QLD IR Act 2016 s.109** — Other seasonal employees | Coverage out of v1 scope; deferred |
| **QLD IR Act 2016 s.110** — Payment instead of taking LSL (cashing out via instrument or QIRC) | TC-QLD-049 → TC-QLD-052 |
| **QLD IR Act 2016 s.134** — Continuity of service: generally | TC-QLD-025 → TC-QLD-031, TC-QLD-034, TC-QLD-029 (workers comp), TC-QLD-030 (transfer) |
| **E2 spec F1 / F2 / AC1 / AC2** — per-state rule set + test suite | this file + the encoded fixtures |
| **E2 spec F13 / AC14** — cross-jurisdictional governing-state nomination | TC-QLD-056, TC-QLD-057 |
| **E2 spec F17 / AC16** — mixed-state bulk CSV with per-row state column | TC-QLD-BULK-002 |
| **E2 spec F18** — state selector persists | not unit-tested here — RTL/Playwright |
| **E2 spec AC4 / AC4a / AC4b** — PM sign-off + per-state launch gate | this file's PM signature line (pending) |

---

# Items flagged `TBD-QLD-NN` — ALL RESOLVED (preserved for traceability)

> **All 6 TBDs were resolved on 2026-05-25.** See the **Resolutions** section near the top of this document for the final outcomes. The original research-pass questions are preserved below for traceability and to document the alternatives considered.

Below are the open questions raised during research. Each had a severity rating (1 = launch-blocker, 2 = should-resolve, 3 = nice-to-have). Each is now marked **RESOLVED** with a back-reference to the Resolutions section.

### TBD-QLD-01 — [Severity 1] 15-year accrual: discrete step or continuous? Threshold inclusivity → RESOLVED (see Resolutions section above — accept PM's reading, continuous + inclusive)

**Question**: s.95(2)(b) confers "a period that bears to 8.6667 weeks the proportion that the employee's further period of continuous service bears to 10 years" for service beyond 10 years. Plain-English summaries (Business QLD, RosterElf) say "+4.3333 weeks after a further 5 years (13 weeks total at 15 years)" — implying a continuous-accrual reading where 12 yrs = 10.4 wks, 13 yrs = 11.2667 wks, 14 yrs = 12.1333 wks, 15 yrs = 13.0 wks. The Act language is plainly proportionate.

There is also a **threshold inclusivity** question parallel to the VIC one (TBD-VIC-06): is "10 years continuous service" inclusive at exactly 10.0 yrs 0 days? Same for the 7-yr pro-rata threshold and the 15-yr step.

**My reading**:
- Accrual is continuous at 1/60 — no discrete step at 15 yrs. The 13-week figure at 15 yrs is the arithmetic outcome (15 × 8.6667/10 = 13.00005 ≈ 13.0), not a separate step.
- Thresholds (7 yrs, 10 yrs, 15 yrs) are inclusive at exact-day boundary — same as VIC's resolved 7-yr inclusivity. Engine: `years_of_continuous_service >= 10.0000` triggers full accrual.

**What this changes**: TC-QLD-047/048 expected weeks. If discrete step is correct (10–14.99 yrs = 8.6667 flat, 15.0 yrs jumps to 13.0), the entire mid-range accrual table differs from the assumed continuous one.

**Decision needed by**: T4.1 (rule-set scaffold); blocks accrual-table.ts encoding.

---

### TBD-QLD-02 — [Severity 1] Historical cliffs — engine treatment → RESOLVED (see Resolutions section above — accept PM's reading, hard-anchor s.103 casual cliff; advisory-only s.96 general cliff)

**Question**: How does the engine treat the two historical cliffs?
- **s.96** (general, 23 June 1990): does the engine emit an advisory warning, or just a citation note? Does pre-1990 service get fully excluded (anchor service to 1990-06-23) or fully included (anchor to actual start, surface advisory only)?
- **s.103** (casual, 30 March 1994): same questions for casuals.

The cliffs are largely moot for current calculations (a pre-1990 starter has 35+ years of post-cliff service to draw on) BUT a casual-to-permanent transition mid-cliff (TC-QLD-038) makes the treatment material.

**My reading**:
- **s.96 (general 1990 cliff)**: emit advisory warning (`pre_1990_service_advisory_qld`) but use the actual start date in the accrual computation. Rationale: the cliff carves out a transitional exception that may or may not engage depending on industrial-award history; the calculator cannot adjudicate, so it surfaces and proceeds with the user-supplied date.
- **s.103 (casual 1994 cliff)**: HARD ANCHOR to 30 March 1994. The Act is unambiguous that casual service before that date does not count. Engine MUST anchor and surface the warning.
- **TC-QLD-038 (transition)**: cliff applies only to the casual portion, not the full pre-1994 tenure. Permanent service from 1996 onward counts fully; casual service 1992–1995 is excluded.

**What this changes**: TC-QLD-035, TC-QLD-036, TC-QLD-038 expected outputs and warning emissions.

**Decision needed by**: T4.2 (rules + orchestrator); affects continuous-service-rules.ts.

---

### TBD-QLD-03 — [Severity 2] Casual rate-of-pay averaging window → RESOLVED (see Resolutions section above — single 52-wk lookback per Business QLD)

**Question**: For casual employees, does s.105 use a 52-week lookback (like Business QLD's published formula `(total ordinary hours ÷ 52) × 8.6667 ÷ 10`), or a multi-tier "greater of" like VIC's s.15(2)? The Act's wording at s.105 is less specific than VIC's, and APA training pages 54–55 are derived examples.

**My reading**: Single 52-week lookback per Business QLD's published formula and RosterElf's worked examples. NOT a 3-tier average. This is simpler than VIC and matches NSW's casual handling.

**What this changes**: TC-QLD-009 expected `weekly_avg` calculation. If multi-tier is correct, engine needs a `weekly_avg_52w / 260w / whole` triplet like VIC.

**Decision needed by**: T4.2 — affects value-of-week.ts encoding.

---

### TBD-QLD-04 — [Severity 2] Cash-out advisory behaviour — granularity → RESOLVED (see Resolutions section above — no ground required; stronger sub-10-yr advisory; pass-through with $0 at sub-7-yr)

**Question**: For a `cash_out` trigger in QLD:
1. Does the engine require the user to specify the s.110 ground (financial hardship, compassionate, industrial instrument)?
2. Does the engine differentiate the advisory text for sub-10-yr cash-out (rarer in practice) vs 10+ yr?
3. Does the engine block cash-out at sub-7-yr (no entitlement to cash out — TC-QLD-051) or pass through with zero value?

**My reading**:
1. NO — the calculator computes value; the legal authority is the user's responsibility. Single advisory message covers all s.110 grounds.
2. YES — emit BOTH a base s.110 advisory AND a sub-10-yr-specific advisory when years < 10 (TC-QLD-050). Strengthens user awareness.
3. Pass through with zero value (TC-QLD-051) — calculator does not refuse the trigger; it surfaces that there's nothing to cash out.

**What this changes**: TC-QLD-049, TC-QLD-050, TC-QLD-051 warning enumerations and message text.

**Decision needed by**: T4.2 — affects trigger-handlers.ts encoding for `cash_out`.

---

### TBD-QLD-05 — [Severity 2] Workers Compensation rate of pay — no QLD equivalent of VIC s.17 → RESOLVED (see Resolutions section above — accept PM's reading; apply literal s.98 + emit `qld_lsl_calculated_at_wc_reduced_rate_warning` advisory)

**Question**: VIC s.17 provides "higher of pre-injury rate or current rate" for WC employees taking LSL. QLD has NO equivalent provision — Business QLD interpretive guidance silently uses the standard s.98 "ordinary rate at time of leave". For an employee on partial-capacity WC at a reduced rate, this means LSL is paid at the reduced rate.

This produces user-facing outcomes that may seem unfair (employee earned full rate for years; LSL pays out at temporary reduced WC rate). Is this the correct reading?

**My reading**: YES — apply the literal s.98 rate at time of leave. Engine does NOT auto-uplift WC rates. If users want the higher-of behaviour for fairness reasons, that's an industrial-instrument-level negotiation, not a statutory engine concern.

**What this changes**: TC-QLD-029 expected `value_of_week` is `1800.00` (current rate, even if reduced from $1500 pre-injury rate would be $1500). If PM disagrees, engine MUST add a higher-of-rates branch.

**Decision needed by**: T4.2 — affects value-of-week.ts; also signals user-experience risk to surface in UI advisory.

---

### TBD-QLD-06 — [Severity 2] Termination-reason enum design — granularity for s.95(3) qualifying reasons → RESOLVED via cross-state refactor deferral (see Resolutions section above — spun off as DEV-CROSS-1; 5 fixtures deferred)

**Question**: The engine's current `Trigger.reason` enum (NSW + VIC) needs new values to capture QLD's s.95(3) qualifying-reason taxonomy:
- `voluntary_resignation` — does NOT qualify under s.95(3)
- `illness_incapacity` — qualifies under s.95(3)(b) IF employee-initiated, s.95(3)(c) IF employer-initiated
- `domestic_pressing_necessity` — qualifies under s.95(3)(b) (employee-initiated only)
- `death` — qualifies under s.95(3)(a)
- `redundancy` — qualifies under s.95(3)(d)
- `employer_initiated_not_misconduct` — qualifies under s.95(3)(d)
- `serious_misconduct` — does NOT qualify (s.95(3)(d) excludes "conduct")
- `poor_performance` — does NOT qualify (s.95(3)(d) excludes "performance")
- `incapacity_dismissal` — does NOT qualify if framed as "capacity" dismissal; conflicts with s.95(3)(c) (employer dismissal for illness). Ambiguous — needs explicit distinction.
- `unfair_dismissal` — qualifies under s.95(3)(e)

The illness/incapacity case is tricky: s.95(3)(b) (employee illness resignation) and s.95(3)(c) (employer illness dismissal) both pay out, but s.95(3)(d) (employer dismissal for capacity/performance) does NOT pay out. The engine needs to disambiguate.

**My reading**: Add `terminationInitiator: 'employee' | 'employer'` as a sibling field to `Trigger.reason`. Combine reason + initiator to determine s.95(3) sub-paragraph. Add new reason value `domestic_pressing_necessity`. Add new reason value `unfair_dismissal`. Distinguish `incapacity_dismissal` from `poor_performance` at the user-facing form level.

**What this changes**: `engine/types.ts` Trigger interface (adds `terminationInitiator`); single-mode form UI (adds initiator field, expands reason dropdown for QLD).

**Decision needed by**: T4.2 + a small engine-types refactor task in Phase 4. Also surfaces for WA/SA/TAS/ACT/NT — each may have analogous reason distinctions.

---

## Provisions deliberately deferred from v1 QLD encoding

| Provision | Reason for deferral |
|---|---|
| **QLD IR Act 2016 s.97 (minimum 4-wk leave period)** | Not a calculation question — employer-employee notice/negotiation rule, not a value computation. |
| **QLD IR Act 2016 s.101 (other payment matters)** | Sweep-up provision for payment-related matters not covered elsewhere; nothing operationally distinct emerges for the calculator. |
| **QLD IR Act 2016 s.106–108 (sugar industry / meatworks seasonal)** | Industry-specific subdivision. Out of v1 statutory engine scope — same convention as VIC industry awards (TBD-VIC industry awards deferred). |
| **QLD IR Act 2016 s.109 (other seasonal employees)** | Same as above. |
| **Building and Construction Industry (Portable LSL) Act 1991 (Qld)** | Portable LSL scheme — separate Act, separate scheme, out of v1. Engine emits a `portable_lsl_scheme_may_apply_qld` advisory if the user's industry is flagged (deferred until UI captures industry input). |
| **Contract Cleaning Industry (Portable LSL) Act 2005 (Qld)** | Same as above. |
| **Community Services Industry (Portable LSL) Act 2020 (Qld)** | Same as above. |
| **Fox v Infosys-style continuous-service interpretation cases** | Case law applied to ambiguous fact patterns — calculator does not adjudicate; the user supplies the asserted facts. Cited where engine behaviour is shaped by case law (no specific cases drive v1 logic). |

---

## Historical note — DEV-CROSS-1 deferred fixtures (v1.0 → v1.1)

In v1.0 of this document (2026-05-25), five fixtures — **TC-QLD-005, -007, -008, -015, -016** — were deferred to a follow-up PR pending DEV-CROSS-1, the state-agnostic termination-reason enum + initiator refactor. DEV-CROSS-1 merged in **PR #14 on 2026-05-25 (commit `bd2d284`)**, adding the new enum values (`employer_initiated_not_misconduct`, `unfair_dismissal`, `domestic_pressing_necessity`, `poor_performance`) and the optional `terminationInitiator: 'employee' | 'employer'` field on the termination trigger. The five fixtures were then reinstated as active QLD launch-gate fixtures in v1.1 (same day) and are documented above in §A and §B alongside the rest of the gold-standard set.

---

## Signature line

```
Signed: Tracy Angwin (PM)
Date:   2026-05-25
```

> PM-only sign-off per E2 spec RES-6 / AC4. No APA-specialist co-signer required. Sign-off completed T4.0 (v1.0) and unblocked T4.1 (QLD rule-set scaffold). All 6 TBDs resolved — see Resolutions section near the top.
>
> **v1.1 amendment (2026-05-25)** — 5 fixtures previously deferred to DEV-CROSS-1 (TC-QLD-005, -007, -008, -015, -016) have been reinstated and pass the engine gold-standard test. Total active single-mode fixtures now 57 (was 52 in v1.0). Plus 3 bulk-mode = 60 grand total.

---

*End of test-cases-qld.md v1.1 — SIGNED OFF Tracy Angwin (PM) 2026-05-25 (v1.0 sign-off carries forward; v1.1 reinstates 5 fixtures previously deferred to DEV-CROSS-1).*
