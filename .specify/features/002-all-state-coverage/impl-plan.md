# Impl Plan — All-State Coverage (E2)

**Source spec**: `.specify/features/002-all-state-coverage/spec.md` v0.3.1
**Version**: 0.3.5 (2026-05-26 — Phase 7 (ACT) T7.0 SIGNED OFF; all 17 TBDs resolved per `docs/qa/test-cases-act.md` v1.0; no DEV-CROSS-4)
**Branch**: `002-all-state-coverage`
**Date**: 2026-05-26
**Owner**: developer agent
**Status**: Phase 6 (SA) SHIPPED at `d8bd186`. Phase 7 (ACT) T7.0 SIGNED OFF 2026-05-26 (PM Tracy Angwin) at `docs/qa/test-cases-act.md` v1.0 — all 17 TBDs resolved; **T7.1 unblocked immediately** (no pre-flight cross-state PR required — all ACT-specific signals are ACT-localised via `extraInputs.act_*`, parallel to SA Phase 6 precedent; one purely-additive optional `Result.payable_by: ISODate` field bundles inline with the per-state PR).

**v0.3.5 change log (2026-05-26)**:
1. **Phase 7 (ACT) T7.0 SIGNED OFF.** All 17 TBDs resolved per `docs/qa/test-cases-act.md` v1.0 (PM-signed Tracy Angwin 2026-05-26) Resolutions section. **No architectural re-scope** — TBD-ACT-01 resolved as single rule set with date-aware Workers Comp override at 9 June 2023 (parallel to WA's 2024-07-01 WCIM 2023 override pattern). All anticipated PM-recommendations confirmed.
2. **No DEV-CROSS-4 dev-finding created.** All ACT-specific signals (overtime hours, FT→PT transition date, award-min retirement age) are ACT-localised via `extraInputs.act_*` keys (parallel to SA TBD-SA-04 / -07 RESOLVED pattern). NSW/VIC/QLD/WA/SA orchestrators not affected.
3. **One new `Result.payable_by: ISODate` field** added per TBD-ACT-08 — purely additive, cross-state-available, no breaking change. Bundles inline with the per-state ACT PR (no separate cross-state PR required). ACT is the first consumer; other states emit `undefined`.
4. **Phase 7 effort estimate stays at L (5–7 dev-days)** — no re-scope.
5. **Total dev-days re-estimate**: 32–48 (unchanged from v0.3.4 — Phase 7 stays at L (5–7 d); no DEV-CROSS-4 addition).

**v0.3.4 change log (2026-05-26)**:
1. **Phase 7 (ACT) test-cases drafted** at `docs/qa/test-cases-act.md` v1.0-draft. 78 fixtures (75 single-mode + 3 bulk). 17 TBDs surfaced for operator resolution, with PM recommendations inline. **No fixture-value changes expected** if operator accepts all PM recommendations.
2. **Anticipated architectural shape (pending PM sign-off of TBD-ACT-01)**: single ACT rule set with date-aware Workers Comp override at 9 June 2023 (parallel to WA's 2024-07-01 WCIM 2023 override pattern). The WC override module sits on top of a single continuous-service-rule profile — NO two parallel rule sets.
3. **Anticipated ACT-localised `extraInputs` keys (pending PM sign-off of TBD-ACT-02, -04, -07)**: `act_overtime_hours_by_period`, `act_ft_to_pt_transition_date`, `act_award_min_retirement_age_reached`. SA-localised pattern — no DEV-CROSS-4 dev-finding anticipated.
4. **Anticipated `Result` schema addition (pending PM sign-off of TBD-ACT-08)**: new optional `payable_by: ISODate` field for ACT's 90-day pay-on-termination window. Purely additive; cross-state-available; no breaking change.
5. **§7 (Phase 7 — ACT) expanded** to anticipate all 17 TBD-ACT resolutions. Highlights below (binding once PM signs off):
   - **TBD-ACT-01** (Sev-1, LOAD-BEARING): single rule set + WC date-aware override at 9 June 2023.
   - **TBD-ACT-02** (Sev-1, LOAD-BEARING): overtime hours-vs-rate asymmetry — hours INCLUDED in s.7(2) 12-mo casual/PT average; rate EXCLUDES overtime premium per s.7(1). Parallel to SA 156-wk pattern.
   - **TBD-ACT-03** (Sev-1, LOAD-BEARING): s.7(2) (taking-leave anchor = 12 mo before entitlement date) vs s.11D (termination anchor = 12 mo before cessation). Engine selects by trigger kind.
   - **TBD-ACT-04** (Sev-1): s.7(3) FT→PT/casual within 2 yrs of 7-yr entitlement — 5-yr salary total ÷ 5 ÷ 52. ACT-unique. Routed via `extraInputs.act_ft_to_pt_transition_date`.
   - **TBD-ACT-05/-17** (Sev-2): pre-9-June-2023 WC + sickness 2-wk/yr cap interpretation — per-service-year (parallel to WA pre-2022 cap pattern per TBD-WA-09 RESOLVED).
   - **TBD-ACT-06** (Sev-2): WA DEV-CROSS-2 flags (`paidConcurrent`, `returnToWorkProgram`) ignored by ACT orchestrator (WA-specific exceptions, not state-agnostic).
   - **TBD-ACT-07** (Sev-2): retirement qualifying-reason gate via `employee.dob` (>= 65) OR `extraInputs.act_award_min_retirement_age_reached`. Poor-performance dismissal treated as non-qualifying (parallel to QLD s.95(3)(d)).
   - **TBD-ACT-08** (Sev-2): new `Result.payable_by: ISODate` (optional) for 90-day window. Purely additive.
   - **TBD-ACT-09** (Sev-3): hardcoded ACT PHs from Public Holidays Act 1958 (ACT) — incl. Canberra Day + Reconciliation Day.
   - **TBD-ACT-10** (Sev-3): single-day LSL on PH shifts to next non-PH working day (PH-exclusive semantics).
   - **TBD-ACT-11** (Sev-3): portable schemes (BCI / CCI / PS Act) out of v1 scope.
   - **TBD-ACT-12** (Sev-3): cash-out citation `ACT LSL Act 1976 s.8(c)` (Act-level documented limitation, parallel to TBD-WA-02 / TBD-SA-03).
   - **TBD-ACT-13** (Sev-3): UPL "extends-the-line" pattern (parallel to SA TBD-SA-04 RESOLVED).
   - **TBD-ACT-14** (Sev-2): advance-leave refusal — `status: computed` + advisory (not hard-error). Parallel to QLD sub-7-yr cash-out.
   - **TBD-ACT-15** (Sev-2): paid parental leave does NOT count toward ACT service (ACT divergence from NSW/SA/VIC-post-2018).
   - **TBD-ACT-16** (Sev-3): state-namespaced warning codes for new ACT-specific advisories (`act_*` convention).
6. **Total dev-days re-estimate**: 32–48 (unchanged from v0.3.3 — Phase 7 stays at L (5–7 d); no DEV-CROSS-4 addition anticipated).

**v0.3.3 change log (2026-05-25)**:
1. **Phase 6 (SA) TBDs 01–12 resolved inline** per `docs/qa/test-cases-sa.md` v1.0 (PM-signed Tracy Angwin 2026-05-25) Resolutions section. **No architectural re-scope** — TBD-SA-01 resolved as single regime (LSL (AWE) Amendment Act 2015 (SA) is forward-looking only, not a dual-regime cliff; SA mirrors QLD's flat single-regime architecture). Phase 6 effort estimate stays at M (3–5 days).
2. **No DEV-CROSS-3 dev-finding created.** TBD-SA-07 (higher-duties acting rate) resolved as SA-localised via `extraInputs.sa_higher_duties_active` + `extraInputs.sa_higher_duties_weekly_rate` — operator chose YAGNI over promoting to dedicated `Employee` fields. No cross-state schema extension; no pre-flight blocker. T6.1 unblocks on PM sign-off alone.
3. **§6 (Phase 6 — SA) expanded** to document all resolved interpretations: single regime; two disqualifiers (misconduct + SA-unique unlawful-worker-termination via `extraInputs.sa_worker_notice_compliance`); 10+ yr full payout regardless of reason (SA does NOT mirror WA partial-forfeiture); 156-wk all-hours casual/PT averaging with WC/UPL substitution; 52-wk commission lookback; SA-unique higher-duties acting rate via SA-localised `extraInputs`; PH-INCLUSIVE in LSL period (F11/AC13 — headliner divergence); three-tier cash-out advisory; literal-s.4-rate + advisory for WC overlap; Act-level cashing-out citation (documented limitation pending RES-3 quarterly review).
4. **Total dev-days re-estimate**: 32–48 (unchanged from v0.3.2 — Phase 6 stays at M (3–5 d); no DEV-CROSS-3 addition).

**v0.3.2 change log (2026-05-25)**:
1. **Phase 5 (WA) re-scoped** per `docs/qa/test-cases-wa.md` v1.0 (PM-signed Tracy Angwin) TBD-WA-01 resolution. The "two parallel rule sets (`rules-pre-2022/` + `rules-post-2022/`)" model is replaced by **one WA rule set with date-aware continuous-service handling**. Two continuous-service-rule *modules* (selected by accrual-block "fully accrued" date vs 2022-06-20) feed the same s.8 accrual formula. A third date-aware override at 2024-07-01 for Workers Comp via WCIM Act 2023 sits on top of the post-2022 module. P0.2 (WA portion) updated; Phase 5 effort estimate revised L (5–8 d) → M–L (4–6 d). ~2 dev-days saved.
2. **WA schema extension deferred to a separate cross-state PR (DEV-CROSS-2)** — see `dev-findings.md`. Adds `slacknessOfTrade?: boolean` to `employer_initiated_termination_and_rehire`, `paidConcurrent?: boolean` + `returnToWorkProgram?: boolean` to `workers_comp_absence`, `reasonableExpectationOfReturn?: boolean` to `unpaid_parental_leave`, `mealsAndAccommodationCashValueWeekly?: number` to `Employee`. Same pattern as DEV-CROSS-1 — lands BEFORE WA engine code (T5.1) begins. Pre-flight blocker for T5.1.
3. **Phase 5 (WA) TBDs 02–07, 09–11, 15, 16 resolved inline** per the test-cases-wa.md Resolutions section. Highlights:
   - WCIM Act 2023 (WA) citation form: Act-level only in v1; sub-section TBD via quarterly review (TBD-WA-02).
   - Three distinct cash-out advisory codes (post-accrual, pre-first-milestone, no-entitlement) (TBD-WA-03).
   - 15-yr accrual continuous + threshold inclusivity (TBD-WA-04 — parallel to QLD).
   - WC rate: literal s.9 + `wa_lsl_calculated_at_wc_reduced_rate_warning` advisory (TBD-WA-05 — parallel to QLD).
   - Accrual-period averaging: partial duration only (TBD-WA-06).
   - 10+yr misconduct partial-forfeiture: `(last_fully_accrued_block - leave_already_taken_against_that_block)` (TBD-WA-07).
   - Pre-2022 sickness 15-day cap: working days proportionate to normal pattern (TBD-WA-09).
   - Pre-2022 casual: general s.6 rules + advisory (TBD-WA-10).
   - 2022-06-20 cutoff: ON-the-day → post-2022 (strict "on or after") (TBD-WA-11).
   - Pre-first-milestone cash-out: advisory not blocked (TBD-WA-15).
   - Sub-7-yr death: no carve-out (TBD-WA-16).
4. **Total dev-days re-estimate**: 34–50 → **32–48** (~2 dev-days saved on WA re-scope; DEV-CROSS-2 adds S–M = ½–1.5 days but reduces WA Phase 5 by the same magnitude through reusable schema).

**v0.3.1 change log**:
1. **2026-05-24 — Phase 3 (VIC) re-scoped** per `docs/qa/test-cases-vic.md` TBD-VIC-01 resolution. The "two parallel rule sets (`rules-pre-2018/` + `rules-post-2018/`)" model is replaced by **one VIC rule set with date-aware continuous-service handling**. Two continuous-service-rule *modules* (selected by absence start date) feed the same s.6 accrual formula. P0.2 decision and Phase 3 effort estimate revised. ~2 dev-days saved (8 → 6).
2. **2026-05-24 — F5 citation corrected**: `LSL Act 2018 (Vic) s.67` → `LSL Act 2018 (Vic) s.34` (Part 3 Division 3 — Offences) per TBD-VIC-12. Mirrors spec v0.3.1.
3. **2026-05-25 — Phase 4 (QLD) TBDs resolved per `docs/qa/test-cases-qld.md` v1.0 (PM-signed Tracy Angwin)**:
   - 15-yr accrual continuous at 1/60 (no discrete step) + threshold inclusivity at exact-day boundary (TBD-QLD-01).
   - s.103 casual cliff HARD-ANCHOR to 1994-03-30; s.96 general cliff ADVISORY-ONLY (TBD-QLD-02).
   - Casual rate single 52-wk lookback (NOT 3-tier "greater of") (TBD-QLD-03).
   - Cash-out advisory: no user-supplied ground required; stronger sub-10-yr advisory; pass-through with $0 at sub-7-yr (TBD-QLD-04).
   - WC rate: literal s.98 + new `qld_lsl_calculated_at_wc_reduced_rate_warning` advisory when WC overlaps trigger (TBD-QLD-05).
   - Termination-reason enum redesign **deferred** to a separate cross-state PR (DEV-CROSS-1) — see dev-findings.md. 5 QLD fixtures deferred until that refactor lands.

---

## Phase 0 — Pre-Planning Decisions

These resolutions clear the dev-findings produced by `pm-analyze-split`. The NSW reference implementation on this branch (HEAD `5dc7fd5`) is now stable enough at the interface level to commit to a contract; this is the gate the spec called out under the pattern-dependency notice.

### P0.1 — DEV-E2-M1 · Engine ↔ rule-set boundary contract (RESOLVED)

**Read** (NSW reference, on this branch):
- `website/src/lib/lsl/engine/index.ts` — barrel for shared engine primitives.
- `website/src/lib/lsl/engine/types.ts` — `Employee`, `Trigger`, `Result`, `Citation`, `Warning`, `State` (the `State` union already enumerates all 8 jurisdictions).
- `website/src/lib/lsl/engine/{classifier,continuous-service,lookback,decimal,dates,normalise,trigger,system-formula,citation,errors}.ts` — all state-agnostic primitives.
- `website/src/lib/lsl/states/nsw/index.ts` — the orchestrator: imports engine primitives, imports NSW-specific rules from `./rules/`, returns a `Result`.
- `website/src/lib/lsl/states/nsw/rules/{accrual-table,value-of-week,trigger-handlers}.ts` — the three NSW-specific concerns currently broken out.

**Decision: per-state rule sets expose a single orchestrator function `calculate{STATE}(employee, trigger) → Result` plus a `calculate{STATE}Safe(...)` wrapper.** This matches what NSW already does (`calculateNSW`, `calculateNSWSafe`). The orchestrator imports engine primitives directly; there is no "bundle of named functions" interface that the engine then calls. The dispatcher (P0.2 below) selects which orchestrator to call by `governingState`.

**Documented as a TypeScript interface** at `website/src/lib/lsl/states/StateRuleSet.ts` for explicit type-safety:

```ts
import type { Employee, Result, Trigger } from '@/lib/lsl/engine/types';

/** Pure orchestrator — never throws on user-input issues; encodes them as Result.status. */
export type StateCalculate = (employee: Employee, trigger: Trigger) => Result;

/** Wrapped version: catches throws, returns Result with status = 'failed'. Used by bulk runner. */
export type StateCalculateSafe = (employee: Employee, trigger: Trigger) => Result;

export interface StateRuleSet {
  state: 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
  calculate: StateCalculate;
  calculateSafe: StateCalculateSafe;
}
```

**Concerns that stay in the shared engine** (no changes for E2):
- Decimal arithmetic, ISO date arithmetic, citation construction
- Pay-pattern classifier (`classify(employee)`) — Categories A/B/C are NSW-derived but the math is gross-CV + employment_type, neither state-specific. States that need different categories (e.g. ACT with overtime hours) override via the orchestrator, not the classifier itself.
- Continuous-service primitive (`computeContinuousService`) — accepts a `ContinuousServiceEvent[]`; the *rule table* of which events count is currently embedded in this file as `SERVICE_EVENT_RULES`. **Refactor for E2**: extract that table to be passed in by the per-state orchestrator (or accept a "rules profile" parameter), so QLD/SA/TAS/ACT/NT/WA can encode their own treatment of `workers_comp_absence`, `unpaid_parental_leave`, etc. This is the only engine change E2 needs; it preserves all NSW behaviour by passing the existing NSW table as the default.
- Lookback-window arithmetic, normalisation, system-formula computation.

**Concerns that move into the per-state rule set** (mirroring NSW's `rules/` folder):
- `accrual-table.ts` — qualifying period, accrual per year, pro-rata thresholds, termination-reason qualifying lists.
- `value-of-week.ts` — ordinary-pay definition. ACT diverges by including overtime; SA may diverge on PH-during-leave inclusion (F11).
- `trigger-handlers.ts` — trigger-kind → citation list, plus state-specific trigger preconditions (e.g. F5/F6 cashing-out hard error for VIC/NT).
- `continuous-service-rules.ts` (new per-state file) — the state's `SERVICE_EVENT_RULES` table including break tolerance, rehire gap threshold, regime-split thresholds.

This is **the contract**. Every new state implements this shape. The dispatcher (next decision) selects the right orchestrator.

---

### P0.2 — DEV-E2-M2 · Dual-regime state encoding (VIC, WA) (RESOLVED — re-scoped 2026-05-24 for VIC, 2026-05-25 for WA)

**VIC re-scope (TBD-VIC-01, 2026-05-24)**: the original v0.3.0 plan called for two parallel rule sets per state (`vic-pre-2018/` and `vic-post-2018/`). Per the resolution recorded in `docs/qa/test-cases-vic.md` TBD-VIC-01, this is replaced by **one VIC rule set with date-aware continuous-service handling**. VIC LSL Act 2018 s.6 calculates entitlement on the employee's *total* period of continuous employment — singular, undivided. The transitional rules in s.57 affect *which absences count* toward continuous employment, not the entitlement-weeks formula. The pre/post-1/11/2018 split therefore applies to *per-absence rule selection* (which continuous-service-rule module to invoke for each historical absence) and NOT to two parallel entitlement engines.

**WA re-scope (TBD-WA-01, 2026-05-25)**: same architectural pattern as VIC. Per the resolution recorded in `docs/qa/test-cases-wa.md` TBD-WA-01, the original v0.3.0/v0.3.1 plan ("two parallel rule sets `rules-pre-2022/` + `rules-post-2022/`") is replaced by **one WA rule set with date-aware continuous-service handling**. The IR Legislation Amendment Act 2021 changed continuous-employment rules only — the WA LSL Act 1958 s.8 accrual formula and s.8(3) pro-rata threshold are unchanged across the 2022-06-20 cutoff. Two continuous-service-rule *modules* (`rules-pre-20jun2022.ts` + `rules-post-20jun2022.ts`) selected by accrual-block "fully accrued" date feed the same s.8 accrual formula. A third date-aware override at 2024-07-01 for Workers Comp absences (via WCIM Act 2023) sits on top of the post-2022 module.

**Three candidate patterns** evaluated against the criterion "testability of each regime in isolation":

- (a) Engine-level `selectRuleSetByDate(state, employee)` per segment, engine sums segments. Rejected: forces the engine to know about state-specific regime cutoffs, leaks state knowledge into shared code.
- (b) Per-state dispatcher module that internally branches between two parallel rule sets selected by date. Rejected for VIC after TBD-VIC-01 and for WA after TBD-WA-01: the s.6 / s.8 entitlement formula applies to total continuous employment, not segments, so two parallel entitlement engines is the wrong model.
- (c) **VIC and WA: one rule set with two continuous-service-rule modules selected by absence start date / accrual-block-fully-accrued date. Selected.**

**Decision (VIC and WA): one rule set per state; date-aware continuous-service rule selection.**

VIC layout:
```
website/src/lib/lsl/states/vic/
├── index.ts                            # calculateVIC orchestrator — single entitlement path
├── rules/
│   ├── accrual-table.ts                # 2018 Act s.6 accrual — applies to all VIC employees
│   ├── value-of-week.ts                # s.15 fixed-rate + s.15(2) 3-tier averaging + s.16 hours-changed
│   ├── trigger-handlers.ts             # incl. F5 cashing-out hard error (s.34)
│   └── continuous-service/
│       ├── index.ts                    # selects pre-2018 or post-2018 module per absence start date
│       ├── rules-pre-1nov2018.ts       # 1992 Act s.62/62A/63 rules — applies to absences starting before 1 Nov 2018
│       └── rules-post-1nov2018.ts      # 2018 Act s.12/13/14 rules — applies to absences starting on/after 1 Nov 2018
└── __tests__/
    ├── gold-standard.test.ts           # all VIC fixtures
    └── fixtures/
        ├── post-2018/                  # employees entirely post-1/11/2018
        ├── straddling/                 # employees whose service crosses 1/11/2018 (absences span the cutoff)
        └── transitional/               # pre-2018-started absences governed by 1992 Act rules per s.57
```

`calculateVIC(employee, trigger)`:
1. Determine effective service start (with **VIC 12-week break tolerance** instead of NSW's 60-day).
2. Walk `employee.serviceEvents`; for each absence, select the continuous-service rule module by `absence.startDate < 2018-11-01` (→ `rules-pre-1nov2018`) or `>= 2018-11-01` (→ `rules-post-1nov2018`). For absences that themselves straddle 1/11/2018 (e.g. Olivia, TC-VIC-037), split into two segments by date and apply each module to its segment.
3. Sum days_excluded_from_service across all absences.
4. Compute total period of continuous employment = (elapsed since effective service start) − sum(days_excluded).
5. Apply s.6 accrual formula once: `years_of_continuous_service × (8.6667 / 10)` weeks. The accrual ratio is unchanged across both Acts (APA training is explicit, p.32 and p.45).
6. Apply s.15 / s.16 to compute value-of-week.
7. Emit citations from each continuous-service-rule module that fired, plus the single s.6 accrual citation.

This is simpler than the original (b) pattern: one accrual table, one value-of-week, one trigger-handlers module — only the continuous-service handling is date-aware. Effort estimate revised downward by ~2 days (8 → 6).

**WA layout (re-scoped 2026-05-25 per TBD-WA-01)** — follows the VIC pattern: one rule set with date-aware continuous-service handling.

WA layout:
```
website/src/lib/lsl/states/wa/
├── index.ts                                       # calculateWA orchestrator — single entitlement path
├── rules/
│   ├── accrual-table.ts                           # s.8 single accrual table (continuous 1/60; thresholds inclusive)
│   ├── value-of-week.ts                           # s.9 fixed-rate + accrual-period averaging + 365-day results-based + casual loaded rate
│   ├── trigger-handlers.ts                        # s.8(3) termination matrix incl. 10+yr partial-forfeiture; s.5 cash-out advisory (three tiers); s.9 PH-exclusive
│   └── continuous-service/
│       ├── index.ts                               # selects pre-2022 or post-2022 module per accrual-block fully-accrued date
│       ├── rules-pre-20jun2022.ts                 # 15-day sickness cap; UPL excluded; no specific casual rules; pre-2022 transmission-of-business
│       ├── rules-post-20jun2022.ts                # paid sickness counts in full; casual continuity expanded; paid parental counts; broader Fair Work transfer-of-business
│       └── workers-comp-override.ts               # date-aware override at 2024-07-01 via WCIM Act 2023 — sits on top of post-2022 module
└── __tests__/
    ├── gold-standard.test.ts                      # all WA fixtures
    └── fixtures/
        ├── single/                                # employees entirely within one regime, or where the split is irrelevant
        ├── straddling/                            # employees whose accrual blocks fully accrued across 2022-06-20
        ├── workers-comp/                          # WC absences pre/on/post 2024-07-01
        └── bulk/                                  # bulk-mode CSV fixtures
```

`calculateWA(employee, trigger)`:
1. Determine effective service start (with **WA 2-mo non-slackness / 6-mo slackness re-employment tolerances**).
2. Walk `employee.serviceEvents`; for each accrual block on the employee's record, determine the "fully accrued" date and select the appropriate continuous-service rule module (pre-20-Jun-2022 if fully accrued before 2022-06-20; post-20-Jun-2022 if on or after). For each WC absence event, apply the workers-comp-override AFTER the pre/post module selects: days on or after 2024-07-01 count regardless of which module is active.
3. Sum days_excluded_from_service across all absences and accrual blocks.
4. Compute total period of continuous employment = (elapsed since effective service start) − sum(days_excluded).
5. Apply s.8 accrual formula once: `years_of_continuous_service × (8.6667 / 10)` weeks. The accrual ratio is unchanged across both pre and post 2022 rule sets.
6. Apply s.9 to compute value-of-week per the employee's classification (fixed / varied-hours / casual loaded / 365-day results-based).
7. Apply trigger handler. Cash-out trigger: three-tier advisory (post-accrual / pre-first-milestone / sub-7-yr no entitlement) per TBD-WA-03 RESOLVED. Misconduct at 10+ yrs: partial forfeiture per TBD-WA-07 RESOLVED — `payable = max(0, last_fully_accrued_block - leave_already_taken_against_that_block)`.
8. Emit citations from each continuous-service-rule module that fired, plus the s.8 accrual citation, plus the WCIM Act 2023 (WA) citation if any WC override fired (Act-level citation only — sub-section TBD per TBD-WA-02 RESOLVED documented limitation).

Effort estimate revised downward by ~2 days (5–8 → 4–6).

**Single-regime states** (QLD, SA, TAS, ACT, NT) have no `rules-pre-X / rules-post-X` split; their `rules/` directory mirrors NSW's flat structure.

**Ambiguity surfacing (F7, F12 / AC8)**: WA's regime split requires data-granularity checks (e.g., when historical accrual-block fully-accrued dates cannot be reconstructed from aggregated wage history). VIC does NOT — the date-aware continuous-service handling operates on `serviceEvent.startDate`, which is always known. WA fixture coverage therefore retains `wa_regime_split_data_insufficient` warning path (TC-WA-044, TC-WA-045) per F7. The single-regime fallback is post-2022 rules (the rules currently in force, the most user-favourable choice for ambiguous data).

---

### P0.3 — DEV-E2-M3 · CI parallelisation strategy (RESOLVED)

**Decision: GitHub Actions matrix strategy on `state`**, plus a separate `engine` job.

```yaml
strategy:
  fail-fast: false
  matrix:
    state: [nsw, vic, qld, wa, sa, act, tas, nt, engine]
```

Each matrix shard runs `vitest run website/src/lib/lsl/states/{state}/__tests__/` (or `engine/` for the engine shard). With NSW currently at 227 unit tests passing in ~30s on the standard runner, parallelised at 8 shards the worst-case wall time stays well inside the 5-minute AC23 ceiling even if each state plateaus around 250 tests. The engine shard is intentionally separate because it touches every state via the cross-state regression rule (AC22).

**Cross-state regression on engine changes (F20 / AC22)**: a separate `cross-state-regression` job triggered only on PRs touching `website/src/lib/lsl/engine/` or `website/src/lib/lsl/citations/`. It runs ALL state suites in matrix and posts a PR comment via `peter-evans/create-or-update-comment` listing pass/fail/unchanged per state. On non-engine-touching PRs (e.g. a VIC-only change), only NSW + the changed state matrix shards run, to preserve runner-minute budget.

**Test-impact-analysis fallback**: deferred to Phase 9 (TAS or NT, whichever first overshoots the 5-minute envelope). Not built up-front because the matrix-shard approach has a generous margin.

**Per-state CI duration metric** (DEV-E2-M3 telemetry sub-item): emit job-duration to GitHub Actions summary; aggregate into a simple line in `docs/engineering/` after each state ships. Not a Datadog/PostHog dependency — repo-local artifact.

---

### P0.4 — DEV-E2-M4 · Per-state telemetry event taxonomy (RESOLVED)

**Decision: `{state_lowercase}_{event_name}` flat scheme** with the same PII-stripped page-event shape as the E1 telemetry shipped in `a6cf665`.

State-specific page events introduced in E2:
- `vic_cashout_hard_error` (AC5)
- `nt_cashout_hard_error` (AC6)
- `vic_regime_split_applied` — both pre- and post-Nov-2018 segments contributed
- `vic_regime_split_data_insufficient` — fallback to single-regime
- `wa_regime_split_applied` — both pre- and post-Jun-2022 segments contributed
- `wa_regime_split_data_insufficient` — fallback to single-regime
- `wa_workers_comp_pre_2024_excluded` — at least one absence segment had days dropped
- `act_overtime_included_in_ordinary_pay` — F9 ACT casual/part-time path activated
- `sa_ph_inclusive_in_leave_period` — F11 path activated
- `bulk_csv_state_column_missing` — batch-level error
- `bulk_csv_row_state_invalid` — row-level error (event includes anonymised count, never the value)

**PII rule (S2)**: no event carries the user input (no employee name, no dates, no $ values). Counters and state-name booleans only. Each new state's orchestrator gates its events behind a single `emitTelemetry({page_event, state})` helper — same wire as E1.

---

### P0.5 — DEV-E2-M5 · State detection in PDF extraction (RESOLVED)

**Decision: extend the existing Anthropic extraction prompt to ATTEMPT state detection per employee with a confidence score, but require user confirmation in the editable preview when confidence < 0.75.**

Changes to `website/src/lib/lsl/parsers/pdf/`:
- `schema.ts` — add `detected_state` (nullable enum of the 8 states) and `state_confidence` (0..1) per employee block in the structured response.
- `prompts.ts` — append: "If the PDF text or header clearly identifies a jurisdiction (state name, state abbreviation in a recognised position such as a header or letterhead), populate `detected_state` and `state_confidence`. If ambiguous or absent, set both to null." Includes the explicit canonical state values.
- The editable preview surfaces low-confidence detections as a row-level warning with a state-selector dropdown defaulting to the detection.

**ZDR / contract impact**: the prompt change does not alter the no-retention contract — it adds output fields, doesn't change data-handling. No Anthropic re-confirmation needed.

---

### P0.6 — DEV-E2-M6 · ACT overtime-hours input shape (RESOLVED)

**Decision: per-state `extraInputs?: Record<string, unknown>` field on `Employee`**, with each state's module documenting its own keys.

Type change in `engine/types.ts`:

```ts
export interface Employee {
  // ...existing fields...
  /** State-specific extension fields. Schema documented per-state in `states/{state}/extra-inputs.ts`. */
  extraInputs?: Record<string, unknown>;
}
```

For ACT, the documented shape (in `website/src/lib/lsl/states/act/extra-inputs.ts`):

```ts
export interface ACTExtraInputs {
  /** Overtime hours per pay period — used in ordinary-pay computation for part-time/casual per ACT LSL Act 1976 s.4. */
  overtimeHoursByPeriod?: Array<{ periodStart: ISODate; periodEnd: ISODate; hours: number }>;
}
```

Form-level conditional rendering: the ACT overtime-hours input only renders when `state === 'ACT' && employment_type ∈ {part_time, casual}` per F16/AC18. When state changes away from ACT, the value is cleared from form state but not from `extraInputs` (so a user toggling back doesn't lose data within a session).

---

### P0.7 — Resolved LOW findings (in-line)

- **DEV-E2-L1 (quick-pick chips F22)** — implementation: `lsl-calculator:state-recent:v1` localStorage key, LRU array length 3. Same persistence model as `LOCAL_STORAGE_KEY` in `form-to-engine.ts`. Task added to Phase 1 (state selector).
- **DEV-E2-L2 (per-state docs page F21)** — `website/src/app/calculator/about/{state}/page.tsx` scaffold per state, placeholder content authored by PM after rule-set merges. Task scheduled in each state's phase; does not block AC1–AC4 (the engine work).
- **DEV-E2-L3 (bulk PDF state-coverage header F23)** — small extension to the existing bulk PDF export template. Lands once with VIC, then unchanged.
- **DEV-E2-L4 (PR-comment integration AC22)** — built in Phase 0 CI workflow setup, validated when VIC ships.
- **DEV-E2-L5 (heuristic F25)** — obsolete; RES-5 deferred to v2. No tasks.

---

## Phase 1 — Foundation (shared, runs before any state)

The shared scaffolding that VIC depends on. **No state-specific rules in this phase** — only the abstractions every state will consume.

**Effort estimate**: M (3–4 days)

1. Define `StateRuleSet` interface at `website/src/lib/lsl/states/StateRuleSet.ts`. Update NSW to formally implement it (typing-only change; no runtime effect).
2. Add `extraInputs?` to `Employee` in `engine/types.ts` (per P0.6).
3. Refactor `engine/continuous-service.ts` to accept a `ServiceEventRulesProfile` parameter (per P0.1 last bullet). Move NSW's existing `SERVICE_EVENT_RULES` table to `states/nsw/continuous-service-rules.ts` and pass it explicitly from `calculateNSW`. Verify NSW gold-standard suite unchanged at 100%.
4. Build the state dispatcher: `website/src/lib/lsl/dispatch.ts` exporting `calculate(employee, trigger) → Result`. Internally maps `employee.governingJurisdiction ?? employee.statesOfService[0] ?? 'NSW'` to the matching `calculate{STATE}` function. Bulk runner calls this; single-mode form calls this. (Replaces the direct `calculateNSWSafe` import in `bulk-runner.ts`.)
5. State selector UI primitive at `website/src/components/lsl/state-selector.tsx` — accessible select (shadcn `Select`), 8 states, persists via `lsl-calculator:state-recent:v1` localStorage, returns top-3 quick-pick chips above the full list (F22).
6. CI workflow: GitHub Actions matrix on `state` per P0.3. Initial matrix `[nsw, engine]` only (other entries added as states ship). PR-comment job behind path filter on `engine/**` and `citations/**`. Acceptance: NSW suite still green at 100%, new matrix configuration produces a successful CI run on PR.
7. Telemetry helper `emitTelemetry({page_event, state})` at `website/src/lib/telemetry/state-event.ts` per P0.4. Same wire format as E1 telemetry; gated by env-var to avoid noise in CI.
8. Form-level `state` field added to `FormState` and `validateForm` (already present but unsupported in `formToEngine`); `formToEngine` now sets `governingJurisdiction = state` for single-mode, single-state employees. ACT conditional overtime field stubbed but disabled until Phase 7.

**Exit criteria for Phase 1**:
- NSW gold-standard suite still 100% green.
- New `dispatch.calculate(employee, trigger)` produces byte-identical NSW results vs. direct `calculateNSWSafe`.
- CI workflow runs successfully on a PR with no functional changes.
- State selector renders + persists, but selecting non-NSW returns the existing `blocked_cross_jurisdiction` Result (gated by P0.1 — no state rule sets yet).

---

## Phase 2 — Bulk CSV mixed-state foundation (RES-4)

Lands once after Phase 1, applies to every subsequent state from VIC onwards. Independent of any single state's rules.

**Effort estimate**: M (2–3 days)

1. Extend CSV normaliser prompt to mark `state` (canonical column already exists in `normalize-schema.ts`) as REQUIRED in multi_employee mode for v1+. Update `normalize-prompt.ts` accordingly.
2. Add a "state column present + populated" row-level validation pass in `bulk-to-engine.ts`: if `state` column absent → batch error; if row has empty/unrecognised `state` value → row-level error surfaced in the editable preview per the existing F6c pattern. Valid rows in the same batch continue to process.
3. The "set of currently-encoded states" is a single source-of-truth constant `ENCODED_STATES` in `dispatch.ts` (initially `['NSW']`; appended on each state's Phase N merge).
4. Bulk preview table column for `state` is already partially present (jurisdiction-unblock modal exists from commit `9820d6e`); extend to render each row's `state` value and surface unrecognised values inline.
5. CSV-normaliser tests cover: missing `state` column → batch error; mixed valid+invalid rows → valid ones process, invalid surface as row errors; header-variant detection (`state`, `State`, `STATE`, `jurisdiction`, `Jurisdiction`).
6. PDF extraction schema/prompt updates per P0.5.

**Exit criteria for Phase 2**:
- A CSV with only NSW rows still processes byte-identically.
- A CSV with NSW rows AND any non-encoded state value (e.g. `VIC`) surfaces the `VIC` rows as row-level "unsupported state" errors and processes the NSW rows successfully.
- PDF-bulk now returns `detected_state` per employee with confidence; low-confidence detections route to user confirmation.

---

## Phases 3–9 — Per-state encoding (one phase per state, in RES-1 order)

The seven phases below share an identical shape; they vary only in legislation specifics. Each phase is gated by the prior phase reaching `state deployed to prod + PM-signed test-cases.md` per AC4a/AC4b.

**Shape of one state's phase** (substitute `{STATE}` and its act sections):

- **Step 1 — Test-cases artifact + PM sign-off (AC4)**. Author `docs/qa/test-cases-{state}.md` listing every APA-PDF worked example for this state, ≥5 state-unique edge cases, ≥1 bulk-mode multi-employee fixture. PM signs. **Blocks coding until signed.**
- **Step 2 — Build per-state continuous-service-rules table**. Encode the state's service-event treatment (break tolerance, rehire gap, workers-comp counting rules, regime cutoffs).
- **Step 3 — Build per-state accrual table**. Qualifying period, accrual per year, entitlement weeks at milestones, pro-rata threshold logic.
- **Step 4 — Build per-state value-of-week**. Ordinary-pay definition; state-specific divergences (ACT overtime; SA PH-inclusive).
- **Step 5 — Build per-state trigger handlers**. Trigger-kind citations + state-specific trigger preconditions (cashing-out hard errors for VIC/NT).
- **Step 6 — Wire orchestrator `calculate{STATE}` + `calculate{STATE}Safe`**. Implement `StateRuleSet` interface.
- **Step 7 — Gold-standard fixtures**. Translate every test-cases-{state}.md row into a `__tests__/fixtures/single/{TC-{STATE}-NNN}.json` fixture in the same shape as NSW.
- **Step 8 — Wire into `dispatch.calculate`**. Add `{STATE}` to `ENCODED_STATES`. Add the state to `bulk-runner` allowed list.
- **Step 9 — UI conditionals**. Any state-specific input fields (ACT overtime); citation-block source reference; form labels.
- **Step 10 — Docs page**. `website/src/app/calculator/about/{state}/page.tsx`.
- **Step 11 — CI matrix shard**. Add `{state}` to the matrix in `.github/workflows/`.
- **Step 12 — Per-state launch gate (AC4b)**. PM-signed test-cases.md + automated suite 100% green in CI on merge commit. Deploy to prod. Update `epic-status.md` with state moving to Stage 5 (Shipped). **THEN** the next state in sequence may start.

### Phase 3 — VIC (RES-1 #1) — re-scoped 2026-05-24 per TBD-VIC-01

**Effort estimate**: M–L (4–6 days) — revised down from L (5–8 days) following TBD-VIC-01 resolution. Architectural simplification: one VIC rule set with date-aware continuous-service handling (not two parallel rule sets). Hard-error + criminal-offence framing still warrants a high QA bar; the saving is on duplicated accrual / value-of-week / trigger-handler scaffolding.

State-specific work beyond the generic shape:
- **One VIC rule set** with two continuous-service-rule modules (`rules/continuous-service/rules-pre-1nov2018.ts` and `rules-post-1nov2018.ts`) selected by absence start date per P0.2 (re-scoped).
- F5 cashing-out hard error path: `calculateVIC` checks trigger metadata for cashing-out intent (TBD shape — likely a new `Trigger` variant in v2; for v1, any explicit `cashOut: true` flag in trigger payload). Hard error returns `status: 'failed'` with `error.code = 'vic_cashout_prohibited'`, citation `LSL Act 2018 (Vic) s.34` (corrected from s.67 per TBD-VIC-12), no numeric outputs. Page event `vic_cashout_hard_error` emitted.
- Absence-split fixture coverage: post-2018 only, pre-2018 (transitional) only, straddling-1/11/2018 absences (e.g. Olivia, TC-VIC-037) split into two date segments.
- 12-week break tolerance replaces NSW's 60-day in the orchestrator's effective-service-start logic.
- Small `engine/types.ts` refactor: rename `gap_exceeds_2mo` warning code → `gap_exceeds_state_tolerance` per TBD-VIC-03. Touches NSW message wiring (preserved as "2 months") and VIC message wiring (new: "12 weeks"). Same enum value, parameterised message.
- LWOP cap interpretation: **per-period** per TBD-VIC-08. Each `leave_without_pay` event evaluated against the 52-wk cap independently.
- 7-year qualifying threshold inclusive at exactly 7 years (TBD-VIC-06): `years_of_continuous_service >= 7.0000`.
- Sub-7-yr advisory warning (TBD-VIC-07): when trigger is death/illness at sub-7-yr tenure, emit `sub_7yr_review_industrial_instrument` non-blocking warning.
- VIC docs page emphasises cashing-out prohibition + transitional s.57 handling.

### Phase 4 — QLD (RES-1 #2) — TBDs resolved 2026-05-25 per `docs/qa/test-cases-qld.md` v1.0

**Effort estimate**: M (3–5 days) — single regime; the complexity is QIRC/EA-restricted cashing-out language (not a hard error, but a citation note) plus the WC-reduced-rate advisory and the s.103 hard-anchor casual cliff.

Highlights:
- **3-month break tolerance** (s.134 general; s.103 casual-specific). Reuses the state-agnostic `gap_exceeds_state_tolerance` warning code introduced in VIC Phase 3 (TBD-VIC-03 resolution).
- **Cashing-out: not blocked, but emits citation referencing the QIRC/EA-permission rule** (s.110). Per TBD-QLD-04 resolution:
  - Engine does NOT require user-supplied s.110 ground (financial hardship / compassionate / industrial instrument). Single advisory message covers all grounds.
  - Emit BOTH a base s.110 advisory AND a sub-10-yr-specific advisory when `years_of_continuous_service < 10`.
  - Pass through with $0 at sub-7-yr (no entitlement to cash out); surface `qld_cashout_no_entitlement_to_cash_out` advisory alongside the existing `sub_7yr_no_entitlement_qld` warning.
- **Accrual: 1/60 continuous across all tenure bands ≥ 10 yrs** per TBD-QLD-01 resolution. No discrete step at 15 yrs — the 13-week figure at 15 yrs is the arithmetic outcome of `15 × 8.6667 / 10 = 13.00005 ≈ 13.0`. Thresholds at 7, 10, 15 yrs are inclusive at exact-day boundary (`years_of_continuous_service >= N.0000`).
- **Historical cliffs** per TBD-QLD-02 resolution:
  - **s.103 (30 March 1994 casual cliff)** — HARD-ANCHOR. `continuous-service-rules.ts` sets the effective service start to `1994-03-30` when `employmentType = 'casual' && startDate < 1994-03-30`. Emit `pre_1994_casual_cliff_qld` warning. Applies retrospectively to any casual portion of a casual-to-permanent transition (TC-QLD-038).
  - **s.96 (23 June 1990 general cliff)** — ADVISORY-ONLY. Engine uses the actual start date and emits `pre_1990_service_advisory_qld` warning when `startDate < 1990-06-23`. The cliff is moot for current calculations (pre-1990 starters have 35+ years of post-cliff service).
- **Casual rate of pay**: single 52-week lookback per s.105 and Business QLD per TBD-QLD-03 resolution. `value-of-week.ts` reads `hoursLast52Weeks ÷ 52 × loadedHourlyRate`. NO 3-tier "greater of" averaging (that pattern stays VIC-specific).
- **Workers Compensation rate of pay**: literal s.98 ordinary-rate-at-leave-time per TBD-QLD-05 resolution. NO equivalent of VIC s.17 higher-of-rates. Additionally, emit `qld_lsl_calculated_at_wc_reduced_rate_warning` advisory in `trigger-handlers.ts` when a `workers_comp_absence` event overlaps the trigger date OR when the trigger date falls within an active WC episode. Advisory text suggests deferring LSL until the employee is back on their ordinary rate, if feasible.
- **10+ yr automatic payout regardless of reason (incl. serious misconduct)** per s.95(2). QLD has NO misconduct exception at 10+ yrs. Diverges from sub-10-yr behaviour where s.95(3)(d) excludes misconduct.

**Cross-state refactor deferred to follow-up PR (DEV-CROSS-1)**:

The termination-reason enum redesign raised under TBD-QLD-06 has been spun off as a separate state-agnostic PR (tracked as **DEV-CROSS-1** in `dev-findings.md`). It is NOT bundled into the QLD per-state PR because the same disambiguation surfaces for WA/SA/TAS/ACT/NT — it belongs in a single cross-state refactor rather than per-state retrofits.

QLD v1 ships with the **existing** `Trigger.reason` enum values (`voluntary_resignation`, `redundancy`, `serious_misconduct`, `illness_incapacity`, `death`). Five fixtures that genuinely require the new disambiguation (`employer_initiated_not_misconduct`, `unfair_dismissal`, `domestic_pressing_necessity`, `poor_performance`, employee-vs-employer-initiated illness) are deferred to the post-DEV-CROSS-1 follow-up PR. See the **Deferred to cross-state termination-enum refactor** appendix in `docs/qa/test-cases-qld.md` for the full list and the rationale for each.

The DEV-CROSS-1 refactor PR is expected to land between QLD v1 launch and WA Phase 5; the deferred QLD fixtures will be reinstated immediately after DEV-CROSS-1 lands (estimated S — under half a day of work).

### Phase 5 — WA (RES-1 #3) — re-scoped 2026-05-25 per TBD-WA-01

**Effort estimate**: M–L (4–6 days) — revised down from L (5–8 days) following TBD-WA-01 resolution. Architectural simplification: one WA rule set with date-aware continuous-service handling (not two parallel rule sets). The 2024-07-01 Workers Comp sub-cutoff is an additional date-aware override on top of the post-2022 module — a one-file override, not a separate rule set.

State-specific work beyond the generic shape:
- **One WA rule set** with two continuous-service-rule modules (`rules/continuous-service/rules-pre-20jun2022.ts` and `rules-post-20jun2022.ts`) selected by accrual-block "fully accrued" date per P0.2 (re-scoped). PLUS `rules/continuous-service/workers-comp-override.ts` for the 2024-07-01 WCIM Act 2023 (WA) date-aware override on top of the post-2022 module.
- **Single s.8 accrual table** — continuous 1/60 with thresholds (7, 10, 15, 20, 25 yrs) inclusive at exact-day boundary per TBD-WA-04 RESOLVED. Same accrual ratio as NSW, VIC, QLD.
- **Single s.9 value-of-week** — fixed-rate / varied-hours / casual / 365-day results-based branches. Accrual-period partial-block averaging per TBD-WA-06 RESOLVED (average over the partial duration only, not extrapolated). WC rate of pay: literal s.9 current rate + `wa_lsl_calculated_at_wc_reduced_rate_warning` advisory when a WC episode overlaps the LSL trigger date per TBD-WA-05 RESOLVED. Meals/accommodation cash value: optional `mealsAndAccommodationCashValueWeekly` field on `Employee` added via DEV-CROSS-2.
- **Trigger-handlers** — s.8(3) termination matrix with the WA-unique 10+yr partial-forfeiture per TBD-WA-07 RESOLVED: `payable = max(0, last_fully_accrued_block_weeks - leave_already_taken_against_that_block)`. Three-tier cash-out advisory per TBD-WA-03 RESOLVED. Sub-7-yr death returns $0 per TBD-WA-16 RESOLVED. PH-exclusive (matches NSW/VIC/QLD).
- **2-mo non-slackness / 6-mo slackness re-employment tolerances** replace VIC's 12-week and NSW's 60-day in the orchestrator's effective-service-start logic. The 6-mo slackness tolerance uses the `slacknessOfTrade?: boolean` field added to `employer_initiated_termination_and_rehire` via DEV-CROSS-2.
- **2022-06-20 cutoff inclusivity**: blocks fully accrued ON the date → post-2022 (strict "on or after") per TBD-WA-11 RESOLVED.
- **Pre-2022 sickness 15-day cap**: working days proportionate to the employee's normal pattern per TBD-WA-09 RESOLVED.
- **Pre-2022 casual continuity**: general s.6 2-mo/6-mo rules apply (no specific casual provisions pre-2022) + `wa_pre_2022_casual_no_specific_rules` advisory per TBD-WA-10 RESOLVED.
- **WCIM Act 2023 (WA) citation form**: Act-level only in v1 — sub-section TBD per TBD-WA-02 RESOLVED documented limitation. Engine cites the Act + rule key `workers-comp-counts-from-2024-07-01`.
- **F8/AC9 fixture coverage**: Workers Comp event spanning 2024-07-01 (TC-WA-046 → TC-WA-049).
- **F7/AC8 fixture coverage**: regime-split data-insufficient fallback path (TC-WA-044, TC-WA-045) — fallback to post-2022 rules with `wa_regime_split_data_insufficient` advisory.

**Cross-state refactor pre-flight blocker — DEV-CROSS-2**:

The WA schema extension (slackness-of-trade signal + WC `paidConcurrent`/`returnToWorkProgram` + casual UPL `reasonableExpectationOfReturn` + `mealsAndAccommodationCashValueWeekly`) is bundled as a separate state-agnostic PR (tracked as **DEV-CROSS-2** in `dev-findings.md`) rather than retrofitted per-state. Same pattern as DEV-CROSS-1 (the termination-reason enum refactor that landed at `bd2d284` between QLD launch and WA Phase 5 start). DEV-CROSS-2 lands BEFORE WA T5.1 begins.

5 fixtures (TC-WA-029, TC-WA-030, TC-WA-049, TC-WA-052, TC-WA-060) remain in the WA active launch-gate suite and will pass on the engine gold-standard run once DEV-CROSS-2 has landed.

### Phase 6 — SA (RES-1 #4) — TBDs resolved 2026-05-25 per `docs/qa/test-cases-sa.md` v1.0

**Effort estimate**: M (3–5 days). **No re-scope** — TBD-SA-01 resolved as single regime. **No pre-flight cross-state PR** — TBD-SA-07 resolved as SA-localised via `extraInputs`, not DEV-CROSS-3. T6.1 unblocked immediately on PM sign-off.

State-specific work beyond the generic shape:
- **Single SA rule set** — flat single-regime architecture (parallel to QLD). The LSL (Calculation of Average Weekly Earnings) Amendment Act 2015 (SA) transitional provision is uniform forward-looking; no date-aware service routing required per TBD-SA-01 RESOLVED.
- **Accrual: 13 weeks at 10 years** + 1.3 wks per further year continuous (F10/AC12 — most generous in Australia, 50% higher than NSW/VIC/QLD/WA's 8.6667/yr). Implementation shared with NT in T9.x via `SA_NT_ACCRUAL_TABLE` constant extracted in T6.2.
- **No discrete step at 15 yrs** — continuous 1.3 wks/yr accrual (parallel to resolved TBD-QLD-01 / TBD-WA-04 continuous-accrual pattern).
- **Pro-rata at 7+ yrs (s.5(3))** with **two disqualifiers** — serious & wilful misconduct AND SA-unique unlawful-worker-termination (worker failed to give required notice). The second disqualifier is read from `extraInputs.sa_worker_notice_compliance: boolean` (default `true`) per TBD-SA-04 RESOLVED — SA-localised; no cross-state `TerminationReason` enum change.
- **10+ yr full payout regardless of reason** — SA does NOT mirror WA's partial-forfeiture rule. Misconduct at 10+ yrs returns the full s.5(1) entitlement. Aligns with NSW/VIC/QLD.
- **156-week (3-yr) all-hours-incl-overtime casual/PT averaging** with WC/UPL substitution — window extends backward to substitute weeks of approved unpaid leave or workers' compensation with prior worked weeks. Denominator stays 156 per SafeWork SA — part-time / casual calculation methodology. WC counts toward service AND triggers the 156-wk substitution per TBD-SA-05 RESOLVED.
- **52-week (12-mo) income lookback for commission / piece-rate workers** — distinct from the 156-wk hours window. SA-specific dual-window methodology. Bonuses (Christmas, target-achievement on hourly rate) excluded from the average.
- **SA-unique higher-duties acting rate (s.4)** — when the employee is acting in a higher-paid position at the date LSL commences, the higher (acting) weekly rate applies as the ordinary weekly rate. Engine reads `extraInputs.sa_higher_duties_active: boolean` + `extraInputs.sa_higher_duties_weekly_rate: number` per TBD-SA-07 RESOLVED — SA-localised, no cross-state schema extension. Emits `sa_higher_duties_rate_applied` warning when active.
- **PH-INCLUSIVE in LSL period (F11/AC13)** — the headliner SA divergence from NSW/VIC/QLD/WA. A PH falling within the LSL period is COUNTED as a day of LSL; the leave is NOT extended. Engine reads a hardcoded SA PH calendar (Public Holidays Act 1910 (SA), 12 PHs including Adelaide Cup Day) per TBD-SA-10 RESOLVED. SA `value-of-week.ts` / trigger handler computes the calendar end-date of the leave window using `leaveWeeks` only, surfaces `phs_within_leave_count` as an informational field, but does NOT extend the duration. Single-day LSL on a PH counts as 1 day of LSL per TBD-SA-09 RESOLVED (literal reading; avoids gaming).
- **Cashing out — three-tier non-blocking advisory** per TBD-SA-06 RESOLVED: `sa_cashout_post_accrual_advisory` (10+ yr), `sa_cashout_pre_accrual_not_authorised` (7–10 yr or otherwise pre-10-yr), `sa_cashout_no_entitlement_to_cash_out` (sub-7-yr). Contrasts VIC's hard error; parallel to QLD/WA advisory model. Citation form: `SA LSL Act 1987 s.5` (Act-level only) per TBD-SA-03 RESOLVED — documented limitation pending RES-3 quarterly review, parallel to TBD-WA-02 precedent.
- **WC overlap with LSL rate** — literal s.4 ordinary rate at leave time + non-blocking `sa_lsl_calculated_at_wc_reduced_rate_warning` advisory per TBD-SA-08 RESOLVED. SA s.4 has no s.17-equivalent higher-of-pre-injury-vs-current rule. Parallel to resolved TBD-QLD-05 / TBD-WA-05.
- **Continuous service (s.6)** — 2-month re-employment tolerance (tighter than QLD's 3 months; same as WA non-slackness). Casual / seasonal continuity uses a 3-month engine heuristic without seasonal-shutdown justification (or 6 months with) per TBD-SA-02 RESOLVED; `sa_casual_continuity_uncertain` advisory in the 2–6 month grey zone. "Extends-the-line" rule for unpaid leave (does not count as service but does not break continuity).
- **Portable LSL schemes out of v1 scope** per TBD-SA-11 RESOLVED — Construction Industry LSL Act 1987 (SA) and Portable LSL Act 2024 (SA) are separate schemes; no industry-portable-scheme advisory in v1. Same convention as VIC/QLD/WA industry schemes.
- **Pre-1987 service counts where continuous** per TBD-SA-12 RESOLVED — moot in practice (39+ years of post-1987 service available).

**No cross-state refactor blocker.** Higher-duties and worker-notice signals are SA-localised via `extraInputs` — same pattern as the planned ACT `extraInputs.overtimeHoursByPeriod` (Phase 7). NSW/VIC/QLD/WA orchestrators are not affected; they don't read SA-namespaced extraInputs keys.

### Phase 7 — ACT (RES-1 #5)

**Effort estimate**: L (5–7 days) — overtime-inclusive ordinary-pay is the highest mis-coding risk in the entire epic.

**Phase 7 expansion (2026-05-26 — PM-signed `docs/qa/test-cases-act.md` v1.0; all 17 TBDs resolved)**:

State-specific work beyond the generic shape:
- **Single ACT rule set with date-aware Workers Comp override at 9 June 2023** per TBD-ACT-01 RESOLVED. Parallel to WA's 2024-07-01 WCIM 2023 override pattern. WC override is a one-file module sitting on top of a single continuous-service-rule profile — NOT two parallel rule sets. Pre-9-June-2023 WC absence counts up to 2 weeks per service year; from 9 June 2023, counts in full per WC Act 1951 (ACT) s.46 amendment.
- **7-year qualifying period (equal-lowest with VIC)**; **5-year pro-rata threshold under s.11C** — the LOWEST in Australia. Qualifying reasons in 5–7 yr band: illness/incapacity, domestic or pressing necessity, retirement (per award/agreement OR 65), death, employer-not-misconduct. Voluntary resignation 5–7 yrs does NOT qualify (ACT divergence from SA/WA which pay out at 7+ regardless).
- **7+ yr full payout regardless of reason** — ACT does NOT mirror WA's partial-forfeiture; aligns with NSW/VIC/QLD/SA on this point. The s.11C misconduct exception applies only to the 5–7 yr pro-rata band.
- **Accrual formula**: 6.0667 weeks at 7 yrs; +0.8667 wks/yr continuous (= 1/5 month/yr). Equivalent expression past year 10: `Years × (8.6667/10)` — same accrual ratio as NSW/QLD/WA/TAS. No discrete step at 15 yrs.
- **F9/AC11 overtime-hours-in-ordinary-pay (asymmetric per TBD-ACT-02)**: the ACT `value-of-week.ts` reads `employee.extraInputs.act_overtime_hours_by_period` and INCLUDES overtime hours in the s.7(2) 12-month casual/PT hours-averaging window. **Rate excludes overtime premium per s.7(1)** — engine multiplies the averaged hours by the base hourly rate (incl. casual loading), NOT by the loaded overtime rate. **Asymmetric — parallel to SA 156-wk pattern.** Spec wording follow-up clarification anticipated in v0.3.4 amendment to make the asymmetry explicit.
- **s.7(2) vs s.11D averaging-anchor split per TBD-ACT-03**: trigger kind drives the averaging anchor. `taking_leave` → s.7(2) (12 mo before entitlement date — computed as `startDate + 7 years` adjusted for excluded days). `termination` → s.11D (12 mo before cessation date). The two windows are different 12-month spans and produce different averages whenever hours have changed between entitlement and cessation. Engine emits `act_taking_anchor_vs_termination_anchor_diverged` warning when the difference is material.
- **s.7(3) FT→PT/casual within 2 yrs of entitlement per TBD-ACT-04 (ACT-unique)**: when `extraInputs.act_ft_to_pt_transition_date` is set AND the transition is within 2 yrs prior to the 7-yr entitlement anniversary (inclusive at 2.0000 yrs), engine routes to s.7(3) — 5-year total salary ÷ 5 ÷ 52. NO hours averaging. No other state has this rule. Emits `act_s7_3_ft_to_pt_within_2yr_path` warning.
- **Cashing out — non-blocking three-tier advisory** per TBD-ACT-12 (citation form documented limitation). Three codes: `act_cashout_post_accrual_advisory` (7+ yr) / `act_cashout_pre_accrual_not_authorised` (5–7 yr pro-rata band) / `act_cashout_no_entitlement_to_cash_out` (sub-5-yr). Citation `ACT LSL Act 1976 s.8(c)` (Act-level only — sub-section TBD pending RES-3 quarterly review, parallel to TBD-WA-02 / TBD-SA-03 precedent).
- **Leave in advance — refused per TBD-ACT-14**: engine refuses `taking_leave` when `years_of_continuous_service < 7`. Returns `status: computed` with `payable_for_taken_leave: 0` + `act_advance_leave_not_permitted` advisory. Parallel to QLD's sub-7-yr cash-out pattern (NOT a hard error).
- **PH-EXCLUSIVE in LSL period per TBD-ACT-09**: ACT s.9 — PH falling within LSL extends the leave by 1 day per PH. Engine reads hardcoded ACT PH calendar from `rules/public-holidays.ts` (12 PHs from Public Holidays Act 1958 (ACT) — incl. Canberra Day [second Monday in March] and Reconciliation Day [Monday closest to 27 May]). Single-day LSL on a PH shifts to the next non-PH working day per TBD-ACT-10.
- **WC overlap with LSL rate** — literal s.7 ordinary rate + non-blocking `act_lsl_calculated_at_wc_reduced_rate_warning` advisory. ACT s.7 has no s.17-equivalent higher-of-pre-injury-vs-current rule. Parallel to resolved TBD-QLD-05 / TBD-WA-05 / TBD-SA-08.
- **Continuous service (s.2G)** — 2-month re-employment tolerance (non-slackness); 6-month tolerance following slackness-of-trade stand-down (REUSES DEV-CROSS-2 `slacknessOfTrade` flag from WA Phase 5 — no schema additions needed). Sickness/injury up to 2 weeks per service year counts; excess does NOT count per TBD-ACT-17. UPL "extends-the-line" — doesn't count toward service but doesn't necessarily break continuity per TBD-ACT-13. **Paid parental leave (Company-paid + GPPL) does NOT count toward ACT service per TBD-ACT-15** — ACT divergence from NSW/SA/VIC-post-2018. Engine reads event type or substring-match the `note` field for backward compatibility.
- **Workers Comp dual regime (date-aware override at 9 June 2023)** — pre-cutoff: 2-wk/yr cap per service year (parallel to WA pre-2022 15-day cap per TBD-WA-09 RESOLVED working-days-proportionate interpretation); from 9 June 2023: counts in full per WC Act 1951 (ACT) s.46. Cutoff inclusivity: ON 9 June 2023 → post-cutoff (strict "on or after"). WA DEV-CROSS-2 flags (`paidConcurrent`, `returnToWorkProgram`) IGNORED by ACT orchestrator per TBD-ACT-06.
- **Pay-on-termination within 90 days per s.11A(4)(b)** — LONGEST in Australia. New optional `Result.payable_by: ISODate` field per TBD-ACT-08 — purely additive, cross-state-available, no breaking change. Engine emits `act_termination_payable_within_90_days_advisory` on every termination trigger.
- **Retirement-qualifying-reason gate per TBD-ACT-07**: two-signal check. `employee.dob` (if supplied AND age >= 65 at cessation) qualifies retirement automatically. `extraInputs.act_award_min_retirement_age_reached: boolean` (default `false`) qualifies sub-65 award-based retirement. When `reason === 'retirement'` AND neither signal is set, retirement is treated as non-qualifying. Poor-performance dismissal treated as non-qualifying (parallel to QLD s.95(3)(d) exclusion of capacity/performance).
- **Portable LSL schemes out of v1 scope per TBD-ACT-11** — LSL (BCI) Act 1981 (construction), LSL (CCI) Act 1999 (contract cleaning), LSL (PS) Act 2009 (other) are separate schemes; no advisory in v1. Same convention as VIC/QLD/WA/SA industry schemes.

**No cross-state refactor blocker (no DEV-CROSS-4).** All ACT-specific signals are ACT-localised via `extraInputs.act_*` keys — same SA-localised pattern (TBD-SA-04 / TBD-SA-07 RESOLVED precedent). Single purely-additive optional `Result.payable_by: ISODate` field is the only `engine/types.ts` change anticipated — cross-state-available but ACT is the first consumer. NSW/VIC/QLD/WA/SA orchestrators are not affected; they don't read ACT-namespaced extraInputs keys and do not surface a `payable_by` value (undefined is correct).

**T7.1 unblocks immediately on PM sign-off** — no pre-flight cross-state PR required (parallel to SA Phase 6 precedent).

### Phase 8 — TAS (RES-1 #6)

**Effort estimate**: M (3–4 days).

Highlights:
- 3-month break tolerance (same as QLD; consider sharing a constant).
- Cashing-out permitted only after entitlement accrues — citation note.
- No advance leave — trigger-handler refuses `taking_leave` when years-of-service < 10.

### Phase 9 — NT (RES-1 #7)

**Effort estimate**: M (4–5 days).

Highlights:
- 13-week first entitlement at 10 years (same accrual table as SA — share where possible).
- F6/AC6 cashing-out hard error: same shape as VIC F5, but cites `LSL Act 1981 (NT) s.12`. Page event `nt_cashout_hard_error`.
- Strongest s.16 restriction on working elsewhere during LSL — citation note in the leave-taking trigger handler.

---

## Phase 10 — E2 closeout

After NT ships, the closeout phase finalises cross-cutting acceptance criteria that depend on ALL eight states being live.

**Effort estimate**: S–M (2–3 days)

1. Run the full cross-state regression on every engine file touched during E2; verify zero breakage in any state.
2. WCAG 2.2 AA automated scan + manual keyboard run of state selector, conditional fields (ACT overtime), and cross-jurisdictional nomination dialog (AC17–AC19, A1–A3, SC9).
3. Performance bench: P95 single-mode ≤ 2s, bulk P95 ≤ 60s for 500 mixed-state employees (P1/P2/SC4).
4. CI runtime audit per AC23: matrix wall-clock ≤ 5 min.
5. Update `docs/product/epic-status.md` with E2 → Stage 5 (Shipped).
6. Scaffold `docs/operational/legislation-quarterly-review-template.md` (RES-3 quarterly review template — operational doc, owned by Tracy). One-page checklist of all 8 jurisdictions + their gazette URLs from spec §Constraints; PM fills it on 1 March / 1 June / 1 September / 1 December.

---

## Risks & assumptions

| ID | Risk / assumption | Mitigation |
|---|---|---|
| R1 | NSW Phase 3–7 work (PDF extraction Phase 3+, logins Phase 7) shifts the engine surface mid-E2. | The Phase 1 refactor (extracting `SERVICE_EVENT_RULES` from continuous-service.ts) is the only engine touch this epic does. Any NSW change touching `engine/` triggers the cross-state regression CI job (AC22) — breakage surfaces immediately. Operator has accepted this risk per the spec pattern-dependency notice. |
| R2 | The `Trigger` type may need a `cashOut: boolean` discriminant to express F5/F6 hard-error paths cleanly. | Currently the Trigger union has no cashing-out variant. Add a new variant `{ kind: 'cash_out'; cashOutDate: ISODate }` in Phase 3 (VIC) — first state that needs it. NSW and any not-yet-shipped state default to throwing `EngineError('cash_out_not_supported')` for unknown trigger kinds. |
| R3 | The classifier may not survive an ACT input shape that has overtime hours alongside gross — gross-CV alone may misclassify an ACT casual whose overtime is volatile. | The classifier change in Phase 7 (ACT) is to add a per-state `classify` override path: ACT's orchestrator can re-classify after computing the overtime-inclusive weekly value. The shared `classify(employee)` remains the default; states opt in. |
| R4 | Bulk CSV mixed-state perf — `dispatch.calculate` per row is one extra function-call hop per employee. At 500 rows × 8 possible states, cache locality may suffer marginally. | Negligible at 500 rows; v-table-style dispatch in JS is cheap. Re-measure in Phase 10 closeout. |
| R5 | Per-state docs pages (DEV-E2-L2) are an authoring bottleneck on PM. | The Phase-N task only scaffolds the page with placeholder content; the prose can be written and pushed in a follow-up. Per-state launch gate (AC4b) does NOT include docs-page sign-off — only the test-cases.md and the suite. |
| R6 | `calculate` rename — `calculateNSW` is exported from `engine/index.ts`. Adding `dispatch.calculate` may create a naming collision. | Phase 1 step 4: keep `calculateNSW` exported (back-compat for any existing imports) AND add `dispatch.calculate` as the new top-level entry. No deprecation; tests of each state's orchestrator continue to call `calculate{STATE}` directly. |

---

## Effort summary

| Phase | Scope | Effort |
|---|---|---|
| 1 | Shared foundation | M (3–4 days) |
| 2 | Bulk CSV mixed-state foundation | M (2–3 days) |
| 3 | VIC | M–L (4–6 days) — revised 2026-05-24 per TBD-VIC-01 (was 5–8 days) |
| 4 | QLD | M (3–5 days) |
| — | DEV-CROSS-1 (state-agnostic termination-reason enum refactor) | M (1–2 days) — MERGED 2026-05-25 at `bd2d284` |
| — | DEV-CROSS-2 (state-agnostic WA schema extension) | S–M (½–1.5 days) — PRE-FLIGHT BLOCKER for T5.1 |
| 5 | WA | M–L (4–6 days) — revised 2026-05-25 per TBD-WA-01 (was 5–8 days) |
| 6 | SA | M (3–5 days) |
| 7 | ACT | L (5–7 days) |
| 8 | TAS | M (3–4 days) |
| 9 | NT | M (4–5 days) |
| 10 | E2 closeout | S–M (2–3 days) |
| **Total** | | **32–48 dev-days** (was 34–50 at v0.3.1; ~2 days saved on WA re-scope; DEV-CROSS-2 add and WA reduction net out — the net is the WA architectural saving) |

Effort is sequential (per AC4a) — phases 3 through 9 cannot parallelise without operator override. Phases 1 and 2 can overlap (different code paths). Phase 10 starts when NT (Phase 9) ships. DEV-CROSS-1 and DEV-CROSS-2 are state-agnostic refactors that land between per-state phases (DEV-CROSS-1 between QLD launch and WA T5.1; DEV-CROSS-2 also between QLD launch and WA T5.1 — both before WA Phase 5 begins).

---

## Dev findings — final state

| Finding | Status | Resolution location |
|---|---|---|
| DEV-E2-M1 | Resolved | P0.1 |
| DEV-E2-M2 | Resolved | P0.2 |
| DEV-E2-M3 | Resolved | P0.3 |
| DEV-E2-M4 | Resolved | P0.4 |
| DEV-E2-M5 | Resolved | P0.5 |
| DEV-E2-M6 | Resolved | P0.6 |
| DEV-E2-L1 | Resolved | P0.7 (Phase 1 task) |
| DEV-E2-L2 | Resolved | P0.7 (per-state task) |
| DEV-E2-L3 | Resolved | P0.7 (Phase 3 task) |
| DEV-E2-L4 | Resolved | P0.7 (Phase 1 CI task) |
| DEV-E2-L5 | Obsolete | RES-5 — F25 removed from v1 scope |

**Unresolved findings: none.**
