# QA Report — E2 Phase 3 VIC Engine (PR #10)

**Reviewer**: QA agent
**Date**: 2026-05-24
**Branch**: `e2-phase-3-vic` @ `ff1f9d4`
**Verdict**: **PASSES WITH NOTES**

---

## 1. NSW byte-identical regression — PASS (CRITICAL)

- `npx vitest run src/lib/lsl/states/nsw/__tests__/gold-standard.test.ts`: **153/153 pass**, ~471 ms.
- TC-NSW-024 verified: `valueOfWeek: "950.00"`, `totalEntitlementWeeks: "10.4000"`, `totalEntitlementDollars: "9880.04"` — the load-bearing exact value preserved.
- TC-NSW-014 verified: rule key `continuous-service.gap-exceeds-2mo-breaks-service` preserved; only the warning *code* renamed (`gap_exceeds_2mo` → `gap_exceeds_state_tolerance`).
- User-facing message text preserved verbatim in `website/src/lib/lsl/states/nsw/continuous-service-rules.ts:32-33`: "Employer-initiated re-hire gap of N days exceeds the NSW 2-month (M-day) preservation cap — prior service not preserved."
- Engine rename touched 5 files (commit `983b5bb`); zero NSW semantic changes.

## 2. VIC fixture pass rate — PASS

- `npx vitest run src/lib/lsl/states/vic`: **170/170 sub-tests pass** across 61 fixtures (58 single + 3 bulk).
- Full suite: **517/517** pass.
- TypeScript clean. Build clean.

## 3. High-stakes spot-checks — PASS

- **TC-VIC-016** (7-yr boundary inclusive): startDate `2019-05-24` → end `2026-05-24` = 2,558 days / 365.25 = 7.0034 yr — qualifies; emits `accrual.qualifying-period-7yr-plus`.
- **TC-VIC-017** (6 yr 364 days): startDate `2019-05-26` → end `2026-05-24` = 2,556 days / 365.25 = 6.998 yr — sub-7-yr; emits `accrual.sub-7yr-no-entitlement-any-reason`.
- **TC-VIC-025** (death override): wage history `795,600` over 3,288 days = $241.97/day × 7 = **$1,693.80** weekly avg. Test case's $1,700 was a copy-paste of `currentWeeklyGross`. Dev's calibration is genuine.
- **TC-VIC-037** (UPL straddling 1/11/2018): citations include `s.57(2)` + `s.62 1992 Act` + `s.13(1)(b)`. Date-aware service properly wired via `CUTOFF_2018` constant.
- **TC-VIC-050/051/052/053** (cash-out 4-fixture set): 3 cash-out attempts return `failed` with `errorCode: vic_cashout_prohibited`; control termination produces `$1,700` value.

## 4. Five calibration items — all acceptable

| # | Item | Verdict |
|---|---|---|
| 1 | TC-VIC-017 startDate moved by 1 day | Test-case authoring bug; engine uses standard 365.25-day division. Amend `docs/qa/test-cases-vic.md`. |
| 2 | TC-VIC-025 valueOfWeek $1693.80 (not $1700) | s.10(3)(b) implementation is correct per `value-of-week.ts:109-141` — 52-wk avg overrides currentWeeklyGross for death. |
| 3 | TC-VIC-004 citation s.12(6)(a) vs (b) | Single event type covers both employer-rehire and fixed-term-renewal; legal effect identical. |
| 4 | TC-VIC-014 citations-only assertion | Acceptable per AC4b. v1 doesn't collect hours per pay period. |
| 5 | New `extraInputs.hoursChangedInLast104Weeks` | Acceptable in TS, minor doc gap in cross-state `extra-inputs.md`. |

**No engine bugs masquerading as calibration.**

## 5. Cashing-out hard error — PASS

- `VICCashOutProhibitedError` returns `error.code: 'vic_cashout_prohibited'` per `engine/errors.ts:75`.
- s.34 citation emitted via `vicCashOutCitations()` (`states/vic/index.ts:351-370`) with penalty unit detail.
- Lawful alternatives present: `s.9` (termination payout) + `s.22` (half-pay) citations.
- All 4 fixtures (TC-VIC-050/051/052/053) pass.

**Caveat (B1, P2)**: Spec AC5 + S2 require a `vic_cashout_hard_error` **page event** to fire with no PII. Telemetry helper exists; no caller fires it. Consistent with deferred UI wiring.

## 6. Engine rename — PASS

- Surgical 5-file commit. Zero `gap_exceeds_2mo` leftovers.
- NSW user-facing message text unchanged.
- 2 new warning codes added (`sub_7yr_review_industrial_instrument`, `pre_2018_service_broken`) — additive, not regression risk.

## 7. Dispatcher routing — PASS

- `STATE_REGISTRY` has NSW + VIC entries; future states append cleanly.
- `dispatch.test.ts`: 13/13 pass including VIC routing, VIC cash-out path, VIC+NSW governing=NSW path.
- Unsupported states return `blocked_cross_jurisdiction` (not throw — safer for bulk).

## 8. CI matrix gap — B2 (P2)

- `.github/workflows/ci.yml:63` matrix still `[nsw, engine]`. VIC tests **do** run via the umbrella `npx vitest run` job.
- The cross-state-regression job also only shards `nsw` + `engine`.
- **No test coverage gap — visibility gap only.**
- 2-line fix: append `vic` to both `state-matrix.strategy.matrix.state` and the `cross-state-regression` script.

## 9. Browser smoke — PASS

- `next dev` boots cleanly; `/`, `/calculator/single`, `/calculator/bulk` all HTTP 200.
- No console errors.
- UI unchanged from production (state-selector wiring deferred per HANDOFF).

## 10. Bugs found

| # | Severity | Item | File / area |
|---|---|---|---|
| B1 | P2 | `vic_cashout_hard_error` page event not fired anywhere — AC5 + S2 unmet at runtime. Engine returns correct `failed` Result; firing site needs to land with UI wiring. | Form layer (deferred) |
| B2 | P2 | CI matrix lacks `vic` shard — visibility gap, not coverage gap. | `.github/workflows/ci.yml:63` |
| B3 | P3 | `website/src/lib/lsl/states/extra-inputs.md` doesn't document `hoursChangedInLast104Weeks`. | `extra-inputs.md` |
| B4 | P3 | TC-VIC-017 / TC-VIC-025 / TC-VIC-004 divergences should be reconciled in `docs/qa/test-cases-vic.md`. | PM-owned doc |

**No P0 or P1 issues.** No engine bugs. NSW byte-identical regression holds.

## 11. AC4b launch gate (per-state)

**MET at the engine level.**

- ✅ All 61 fixtures green
- ✅ NSW 153/153 still green
- ⏳ UI wiring deferred (T1.5 / state-selector) — VIC not yet user-visible
- ⏳ Page-event firing deferred to UI wiring PR (B1)

Full VIC user-launch is gated on the deferred items, not on this PR.
