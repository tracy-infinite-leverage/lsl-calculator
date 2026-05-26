# Handoff — E3 Phase 8 TAS engine (T8.1–T8.5 + P2 follow-up)

**Date**: 2026-05-26
**From**: Developer agent (retrospective handoff — phase already merged)
**To**: QA agent / future maintainers / next-state developer (NT is next)
**Branch**: `feat/E3-tas-phase-8` (squash-merged via PR #29 → `415699e`) and `fix/E3-tas-stale-copy` (squash-merged via PR #30 → `6ac11a7`)
**Status**: SHIPPED — Phase 8 complete; QA verified (1 P2 batch closed in PR #30; 2 P3 items remain — addressed in this PR `docs/E3-tas-p3-followups`)

---

## What landed

Phase 8 of E3 (per-state LSL coverage) — the **TAS (Tasmania)** engine. TAS is the seventh state encoded after NSW (E1), VIC (E2 Phase 3), QLD (E2 Phase 4), WA (E2 Phase 5), SA (E2 Phase 6), and ACT (E2 Phase 7). T8.0 through T8.5 from the TAS task list are complete.

TAS is the **first state with day-to-day rate variation as a load-bearing primitive** and introduces three Sev-1 architectural divergences:

1. **Day-by-day rate** (TBD-TAS-01) — per-day rate = `(base × penalty_multiplier) + allowance`. Engine emits a new `valuePerDayBreakdown[]` output structure. No other Australian state computes LSL value at per-day granularity in v1.
2. **Sex-specific default retirement age** (TBD-TAS-02) — s.8(3) literal reading: 60 for women, 65 for men. First engine that consumes `Employee.sex`. Award-min-age override path available via `extraInputs.tas_award_min_retirement_age_reached`.
3. **s.5(3) casual 32hr/4wk hybrid evaluator** (TBD-TAS-04) — engine attempts auto-derivation from `wageHistory` 4-week sliding windows; falls back to operator flag; defaults permissive with `tas_casual_32hr_4wk_test_not_verified` advisory.

Plus three Sev-2 divergences worth flagging:

- **s.11(3) commission lookback** — 91-day window / 13 weeks (parallel-style to ACT s.7(1) but distinct window length).
- **10+ year misconduct full payout** (TBD-TAS-06) — TAS-unique: misconduct termination at 10+ yrs still triggers full LSL payout per s.8(2). All other states forfeit.
- **Voluntary resignation sub-10-yr cliff** (TBD-TAS-07) — strict zero entitlement; no qualifying-reason carve-out (parallel to QLD but with TAS-specific 10-yr threshold).

### Tasks delivered

| Task | Scope | Status | Commit |
|---|---|---|---|
| T8.0 | PM-signed test-cases-tas.md v1.0 (17 TBDs resolved; 8 Sev-1/Sev-2 + 9 Sev-3 deferred) | done | `e2d1bdc` (PR #28) |
| T8.1 | Engine scaffold — `states/tas/` + dispatch registration + 6 advisories + smoke fixture | done | `0238f8e` |
| T8.2 | Rule modules — per-day rate, 91-day commission, s.5(3) casual hybrid, slackness 14-day, apprentice 3-mo, parental excluded, cash-out, PH calendar | done | `ce6c4db` |
| T8.3 | 78 fixtures (75 single + 3 bulk) + PM reconciliation (8 PM rulings, 2 engine fixes, 3 doc amendments) | done | `12bbdc6` |
| T8.4 + T8.5 | UI surfaces — `<ValuePerDayBreakdown>` component, 8 TAS-conditional form fields, 29 warning labels, form-to-engine wiring, payable_by branching | done | `9b2f6ef` |
| P2 follow-up | Stale-copy fixes — `layout.tsx` meta description, `unblock-jurisdiction-modal` `isSupported` gate, bulk page metadata + subhead, result-panel cross-jurisdiction fallback — all switched from hard-coded NSW/VIC to read `ENCODED_STATES` from dispatch | done | `926d72c` (PR #30 → `6ac11a7`) |

### Out of scope (deferred per test-cases-tas.md "Deferred with documented limitations")

All 9 Sev-3 TBDs deferred to v2 with documented limitations:

- **TBD-TAS-09** — PH calendar incl. Recreation Day (northern-only) — implemented as advisory flag; no v1 calendar effect.
- **TBD-TAS-10** (amended) — Single-day PH-extends-LSL is citation-only in v1; no `leave_end_calendar` computation.
- **TBD-TAS-11** — Apprentice 3-mo lead-in — citation-only.
- **TBD-TAS-12** — Slackness 14-day return — advisory flag wired (`extraInputs.tas_slackness_return_within_14_days`); no v1 break-detection.
- **TBD-TAS-13** — Maternity/parental excluded — implemented (paid + unpaid both excluded from service).
- **TBD-TAS-14** — TasBuild portable scheme — out-of-scope (same convention as VIC/QLD/WA/SA/ACT).
- **TBD-TAS-15** — Bonus substring detection advisory — implemented.
- **TBD-TAS-16** — Records retention — operational, not engine.
- **TBD-TAS-17 (new)** — Casual continuity flag=false without break-date → strict-zero all service.
- **TBD-TAS-18 (new)** — UPL-substitution in 12-month casual window is operator's responsibility; engine emits `tas_12mo_window_upl_overlap_check_substitution` informational advisory only.

---

## Files created

```
website/src/lib/lsl/states/tas/
├── index.ts                                  # Orchestrator (calculateTAS + calculateTASSafe + TAS_RULE_SET)
├── extra-inputs.ts                           # TASExtraInputs (8 tas_* keys + currentHourlyRate + hoursLast12Months*)
├── continuous-service-rules.ts               # Walker — slackness, parental excl, apprentice, casual s.5(3)
├── rules/
│   ├── accrual-table.ts                      # s.8 / s.11 — 10+ misconduct full payout, voluntary-res cliff, qualifying reasons
│   ├── value-of-week.ts                      # Day-by-day rate aggregation + 91-day commission window + casual 12-mo averaging
│   ├── trigger-handlers.ts                   # Citations + payable_on_day_of_termination advisory
│   ├── casual-continuity.ts                  # s.5(3) 32hr/4wk hybrid evaluator
│   └── public-holidays.ts                    # TAS PHs incl. Easter Tuesday + Recreation Day (northern-only flag)
└── __tests__/
    ├── gold-standard.test.ts                 # 75 single-mode fixtures
    ├── bulk.test.ts                          # 3 bulk-mode fixtures
    └── fixtures/
        ├── single/TC-TAS-{001..075}.json
        └── bulk/TC-TAS-BULK-{001..003}.json
```

```
docs/qa/qa-report-E3-tas-phase-8.md          # QA verification report (this phase)
docs/engineering/changes/2026-05-26-e3-phase-8-tas-engine/HANDOFF.md   # this document
```

## Files modified

- `website/src/lib/lsl/dispatch.ts` — registered `TAS_RULE_SET` in `STATE_REGISTRY`; TAS removed from coming-soon list.
- `website/src/lib/lsl/dispatch.test.ts` — TAS now encoded; canary state moved from TAS to NT (see also e2e canary swap).
- `website/src/lib/lsl/engine/types.ts` —
  - Added 29 TAS-specific warning codes to the `Warning.code` union.
  - Added optional `valuePerDayBreakdown` array to `ResultOutputs` (purely additive; populated by TAS; ignored by other states).
  - Added optional top-level `Employee.sex` field (consumed by TAS s.8(3) retirement gate; gated to TAS-conditional read; ignored elsewhere).
- `website/src/app/(calculator)/calculator/single/_components/form-to-engine.ts` — wires the 8 `extraInputs.tas_*` fields + `Employee.sex` into the engine call only when TAS is in scope.
- `website/src/app/(calculator)/calculator/single/_components/single-mode-form.tsx` — 8 TAS-conditional form inputs.
- `website/src/app/(calculator)/calculator/single/_components/types.ts` — TAS form field types.
- `website/src/components/lsl/result-panel.tsx` — new `<ValuePerDayBreakdown>` component; 29 warning labels added to `WARNING_LABELS` map; payable_by message branches on `tas_payable_on_day_of_termination_advisory`.
- `website/src/app/(calculator)/calculator/bulk/page.tsx` — metadata + subhead switched to `ENCODED_STATES` (P2 follow-up).
- `website/src/app/(calculator)/calculator/bulk/_components/unblock-jurisdiction-modal.tsx` — `isSupported` gate reads `ENCODED_STATES` (P2 follow-up).
- `website/src/app/layout.tsx` — meta description no longer lists TAS as coming-soon (P2 follow-up).
- `website/e2e/bulk-identity-dialog.spec.ts` — TAS canary swapped to NT (commit `fcddcc2`).

---

## Key architectural decisions (per PM resolutions in test-cases-tas.md)

All 18 TBD items are PM-signed-off in `docs/qa/test-cases-tas.md` v1.0 (8 Sev-1/Sev-2 RESOLVED + 9 Sev-3 DEFERRED + 2 NEW TBDs added during T8.3 reconciliation). Highlights:

1. **TBD-TAS-01 — Day-to-day rate variation** (Sev-1, load-bearing): per-day rate = `(base × penalty_multiplier) + allowance`. Engine emits `valuePerDayBreakdown[]` listing each LSL day's effective rate. When inputs absent, falls back to flat `currentWeeklyGross` + emits both `tas_shift_penalty_assumed_included_in_weekly_gross` AND `tas_day_to_day_rate_variation_advisory`.

2. **TBD-TAS-02 — Sex-specific retirement default** (Sev-1, load-bearing, TAS-unique): s.8(3) literal reading — 60 for women, 65 for men. Top-level `Employee.sex` field added; TAS-conditional read only. Award-min-age override via `extraInputs.tas_award_min_retirement_age_reached: true` bypasses default reading and emits `tas_retirement_qualifying_via_award_min_age`.

3. **TBD-TAS-03 — Commission 91-day window** (Sev-2, locked): commission income averaged over 91 days / 13 weeks (s.11(3) Tasmanian reading). Distinct from ACT's s.7(1) hours-averaging window.

4. **TBD-TAS-04 — Casual s.5(3) hybrid evaluator** (Sev-1, load-bearing): Option (c) hybrid hierarchy — engine attempts auto-derivation from `wageHistory` 4-week sliding windows first; falls back to operator flag `tas_casual_32hr_4wk_periods_compliant`; defaults permissive plus `tas_casual_32hr_4wk_test_not_verified` advisory if both signals sparse (>25% missing).

5. **TBD-TAS-05 — Default-flat shift-penalty assumption** (Sev-2): when `tas_shift_penalty_by_day` empty, engine assumes shift penalties are included in `currentWeeklyGross` for FT/PT and emits `tas_shift_penalty_assumed_included_in_weekly_gross`. Operator override path (T2: explicit per-day entries) takes precedence.

6. **TBD-TAS-06 — 10+ year misconduct full payout** (Sev-2, TAS-unique): s.8(2) — misconduct termination at 10+ yrs continuous service does NOT forfeit accrued LSL. Engine emits `tas_10yr_plus_misconduct_full_payout`. All other states forfeit.

7. **TBD-TAS-07 — Voluntary resignation sub-10-yr cliff** (Sev-2, locked): strict zero entitlement under 10 yrs; no qualifying-reason carve-out at 7-10 yrs (unlike ACT/SA/QLD). Cliff fires at exactly 10.000 yrs by inclusive-days math.

8. **TBD-TAS-08 — Advance-leave refusal semantics** (Sev-2): `status: computed` + `payable_for_taken_leave: 0` + `tas_advance_leave_not_permitted` advisory (parallel to ACT TBD-ACT-14). **Important**: the gate uses **wall-clock elapsed years** at trigger date, NOT LWP-excluded service years — fix applied in T8.3 reconciliation (Item 6 sub-bug; see TC-TAS-058 fixture).

9. **TBD-TAS-17 (NEW, added 2026-05-26 T8.3)** — Casual continuity flag=false without break-date → strict-zero all service. Engine emits `tas_casual_32hr_4wk_continuity_not_satisfied`. Operator-empowering reading: flag=false without break-date is read as a conservative "treat all service as broken" request.

10. **TBD-TAS-18 (NEW, added 2026-05-26 T8.3)** — UPL-substitution in 12-month casual averaging window is operator's responsibility. Engine emits `tas_12mo_window_upl_overlap_check_substitution` informational advisory only; consumes operator-supplied hours as-is (no auto-substitution).

**TBD-TAS-10 amended** (T8.3): PH-extends-LSL is citation-only in v1; no `leave_end_calendar` computation. Parallel to ACT TBD-ACT-10 deferred.

**Engine surface — NO DEV-CROSS-N dev-finding**. All TAS-specific signals localised via `extraInputs.tas_*` keys. One top-level `Employee.sex` field added (gated to TAS-conditional read). One additive `ResultOutputs.valuePerDayBreakdown` array (other states ignore).

---

## T8.3 reconciliation appendix — 8 PM rulings

The fixture-corpus build (78 fixtures) surfaced 8 items where engine output diverged from doc-spec'd expected values. PM ruled on each (2026-05-26) as part of T8.3 reconciliation. **Doc remains PM-SIGNED — no re-sign required.** Full table in `docs/qa/test-cases-tas.md` reconciliation appendix lines 2418–2460.

| # | Fixture | Ruling | Action |
|---|---|---|---|
| 1 | TC-TAS-015 (`unfair_dismissal`) | **(A) Engine fix** | Add `unfair_dismissal` to TAS `QUALIFYING_REASONS` set. Cross-state parallel: ACT/SA/QLD/WA/NSW all wire `unfair_dismissal`. Engine-canonical expected: 7.8018 wks / $13,263.08 (operator Note-A T8.5 close-out — supersedes original T8.3 hand-math 7.8003 / $13,260.51; $2.57 / 0.0015 wk drift from calendar/Decimal precision in hand-calculation). |
| 2 | TC-TAS-018 (casual flag=false, no break-date) | **(B) Documented limitation** | TBD-TAS-17 (new). Engine strict-zeros service when flag=false and no `tas_casual_continuity_break_date` is supplied. |
| 3 | TC-TAS-040 (7-wk LSL + 4 PHs) | **(B) Documented limitation** | TBD-TAS-10 amended — citation-only, no `leave_end_calendar`. |
| 4 | TC-TAS-041 (4-wk LSL + 3 Easter PHs) | **(B) Documented limitation** | Same as Item 3. |
| 5 | TC-TAS-042 (single-day LSL on PH) | **(B) Documented limitation** | Engine emits `tas_single_day_lsl_on_ph_exclusive` advisory + citation; does NOT shift the day. |
| 6 | TC-TAS-058 (UPL in 12-mo window) | **(B) Documented limitation + (A) Engine sub-bug fix** | TBD-TAS-18 (new). Sub-bug: advance-leave gate at 10 yrs + 6 days was incorrectly excluding LWP from service years; fixed to use wall-clock elapsed years. |
| 7 | TC-TAS-060 (commission boundary) | **(C) Fixture update** | 1-day boundary bleed in fixture; corrected periodEnd to `2026-02-24`. No engine change. |
| 8 | TC-TAS-073 (cross-jurisdiction routing) | **(C) Fixture update** | Scope mismatch — dispatch-layer test, not engine-layer. Rewritten to mirror ACT TC-ACT-073: `status: "blocked_cross_jurisdiction"`. |

### Post-implementation reconciliation — T8.5 close-out (Note A)

TC-TAS-015 narrative reconciled to engine-canonical value ($13,263.08 / 7.8018 wks). Original T8.3 PM hand-math ($13,260.51 / 7.8003 wks) preserved in the rulings table as the historical reference. Doc narrative amendments applied in PR `docs/E3-tas-p3-followups` (this PR — closing P3-1 from QA report).

---

## Test results

- **All TAS tests pass**: 78 fixtures (75 single + 3 bulk), 317 assertions.
- **Full LSL suite**: 1883/1883 passing (up from 1877 prior to T8.3 — 6 new assertions from new advisories).
- **Project suite**: 1933/1933 passing.
- **tsc**: clean.
- **ESLint**: no NEW errors or warnings introduced. 24 pre-existing items (PDF.js minified files, error.tsx, global-error.tsx) unchanged.
- **Playwright e2e**: 124/124 green across chromium · webkit · firefox · mobile-chrome (4m14s reported in PR #29 comments). Bulk identity dialog canary spec updated — TAS moved from "coming soon" to "shipped"; NT now the canary.

---

## How to test

```bash
# All TAS fixtures
cd website && pnpm vitest run src/lib/lsl/states/tas

# Full LSL suite (regression check)
cd website && pnpm vitest run src/lib/lsl

# Project suite
cd website && pnpm vitest run

# E2E canary
cd website && pnpm playwright test bulk-identity-dialog
```

Manual UI check:
1. Load `/calculator/single` in browser.
2. Select state = TAS.
3. The 8 TAS-conditional form fields render: `currentHourlyRate`, `hoursLast12MonthsBeforeEntitlement`, `hoursLast12MonthsBeforeCessation`, `tas_award_min_retirement_age_reached`, `tas_casual_32hr_4wk_periods_compliant` (auto/true/false tri-state), `tas_casual_continuity_break_date`, `tas_employee_in_northern_tas`, `tas_slackness_return_within_14_days`.
4. Submit a 9 yrs FT unfair-dismissal scenario (TC-TAS-015 inputs) → expect result panel to show 7.8018 wks / $13,263.08, no payable_by date (TAS pays on day of termination), and the `tas_payable_on_day_of_termination_advisory` warning rendered.
5. Submit a TAS scenario with `tas_shift_penalty_by_day` entries → expect `<ValuePerDayBreakdown>` component to render per-day rate breakdown.

---

## Context for next session

### Locked engine surface (do not break without TBD ruling)

- **8 `extraInputs.tas_*` keys**: `tas_shift_penalty_by_day`, `tas_all_purpose_allowance_by_day`, `tas_award_min_retirement_age_reached`, `tas_casual_32hr_4wk_periods_compliant`, `tas_casual_continuity_break_date`, `tas_employee_in_northern_tas`, `tas_slackness_return_within_14_days`. Plus 3 shared engine-boundary keys (`currentHourlyRate`, `hoursLast12MonthsBeforeEntitlement`, `hoursLast12MonthsBeforeCessation`).
- **Top-level `Employee.sex`**: TAS-conditional read; other states ignore.
- **`ResultOutputs.valuePerDayBreakdown[]`**: TAS-populated; other states omit.
- **29 `tas_*` warning codes** in `engine/types.ts` `Warning.code` union — frozen.

### Engineering debt / known v1 limitations

- **Day-precision tenure math**: TAS shares the inclusive-days / 365.25 convention with NSW/VIC/QLD/WA/SA/ACT. Fixture authors must align to engine's day-precise model. Item 7 of the T8.3 reconciliation (TC-TAS-060) was a 1-day boundary bleed in the fixture — pattern to watch for.
- **PH-extends-LSL is citation-only**: TBD-TAS-10 amended; engine does NOT compute `leave_end_calendar` for PHs falling inside an LSL window. Parallel to ACT TBD-ACT-10.
- **UPL-substitution operator-responsibility**: TBD-TAS-18; engine consumes operator-supplied hours as-is. Engine emits `tas_12mo_window_upl_overlap_check_substitution` advisory — operator must pre-substitute hours when LWP overlaps the 12-month casual averaging window.
- **Casual continuity hybrid evaluator default-permissive**: TBD-TAS-04 — when both auto-derivation and operator flag are sparse, engine defaults permissive and emits `tas_casual_32hr_4wk_test_not_verified`. v2 should tighten this to default-strict when wage data is rich enough to detect actual breaks.

### Decisions made during T8.3 reconciliation

- **TC-TAS-015 expected value lineage**: doc was authored at 7.8003 / $13,260.51 (PM hand-math). Engine computed 7.8018 / $13,263.08. PM ruling at T8.3 said "keep doc value — fixture stays at 7.8003". Engine fix added `unfair_dismissal` to QUALIFYING_REASONS, but the per-day arithmetic still produced 7.8018 in engine output. Note-A at T8.5 close-out accepted the engine value as canonical; original PM hand-math preserved as historical reference. Net: $2.57 / 0.0015 wk drift is calendar/Decimal precision in the hand-calculation; engine math is the source of truth. **Doc narrative amendments applied in PR `docs/E3-tas-p3-followups` (this PR).**
- **Advance-leave gate fix (TC-TAS-058 sub-bug)**: gate originally used LWP-excluded service years, which would incorrectly trip `tas_advance_leave_not_permitted` for a worker with effective service = 10 yrs 6 days but LWP-adjusted years = 9.95 yrs. Fix uses wall-clock elapsed years at trigger date for the gate; consistent with the entitlement-vesting semantics.

### Things tried that didn't work

- **Auto-derived casual continuity from sparse wageHistory**: initial T8.2 implementation defaulted to strict-zero when 4-week sliding windows had any missing entries. Too aggressive — caused false negatives on TC-TAS-018 sibling fixtures. Switched to >25%-missing threshold + permissive default + advisory warning (TBD-TAS-04 hybrid hierarchy, Option (c)).
- **DEV-CROSS-N for `valuePerDayBreakdown`**: initially scoped as a new cross-state output channel. PM ruling at T8.2 was "additive-only — other states omit; no shared schema work". Saved ~½ d of cross-state refactor.

---

## Open questions for QA / next session

These have been answered in `docs/qa/qa-report-E3-tas-phase-8.md`. Summary:

1. **Per-day breakdown UI rendering**: confirmed visually correct in result panel; QA verified.
2. **TAS-conditional form fields**: confirmed only render when state = TAS; non-TAS calculations are byte-identical to pre-Phase-8.
3. **Bulk-mode TAS coverage**: confirmed via 3 bulk fixtures; CSV-export emits TAS rows correctly.

**P3 items remaining** (addressed in PR `docs/E3-tas-p3-followups`):
- **P3-1**: TC-TAS-015 doc narrative reconciled to engine-canonical value ($13,263.08 / 7.8018 wks) — applied in this PR.
- **P3-2**: This HANDOFF.md — written in this PR.

---

## Next steps

- **NT (Northern Territory)** is the next state. NT test-cases doc has not yet been authored; PM agent owns T9.0 next.
- **Cross-state regression** should be re-run when NT lands to confirm TAS integrity holds.
- **Day-by-day rate variation pattern**: TAS is the first state to use this; if NT or future states need similar primitives, factor `valuePerDayBreakdown[]` building logic out of `states/tas/rules/value-of-week.ts` into a shared util.

---

## Spec deviations

None of substance. The two NEW TBDs added during T8.3 (TBD-TAS-17, TBD-TAS-18) are recorded in the test-cases-tas.md limitations table and reconciliation appendix — PM-signed (no re-sign required per appendix sign-off note). TBD-TAS-10 was amended during T8.3 (PH-extends-LSL downgraded from compute-end-date to citation-only) — same provenance.

The only post-sign-off narrative drift was TC-TAS-015's expected value ($13,260.51 → $13,263.08) — resolved in PR `docs/E3-tas-p3-followups` by reconciling the doc narrative to engine-canonical per operator Note-A ruling at T8.5 close-out.

---

*Retrospective handoff written 2026-05-26 by Developer agent (Claude Opus 4.7) to close P3-2 from `docs/qa/qa-report-E3-tas-phase-8.md`.*
