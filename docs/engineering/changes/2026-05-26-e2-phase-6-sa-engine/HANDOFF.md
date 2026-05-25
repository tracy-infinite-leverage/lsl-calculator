# Handoff — E2 Phase 6 SA engine (T6.1–T6.5)

**Date**: 2026-05-26
**Branch**: `e2-phase-6-sa-engine`
**PR**: [#22](https://github.com/tracy-infinite-leverage/lsl-calculator/pull/22)
**Developer**: Claude (Opus 4.7) — picked up from prior agent watchdog stall
**Status**: READY FOR QA

---

## What landed

Phase 6 of E2 (per-state LSL coverage) — the SA (South Australia) engine.
SA is the fifth state encoded after NSW (E1), VIC (E2 Phase 3), QLD
(E2 Phase 4), and WA (E2 Phase 5). T6.1 through T6.5 from
`.specify/features/002-all-state-coverage/tasks.md` are complete.

SA's shape is significantly simpler than WA Phase 5: **single rule set, single
regime, no pre/post-amendment service split**. The SA LSL Act 1987 has no
amendment with a date boundary that requires bifurcating the accrual stream.
The complexity that makes SA distinct is concentrated in three places: (a)
PH-inclusive treatment of public holidays during the LSL period (the headline
divergence from NSW/VIC/QLD), (b) the 10-year full-payout rule that overrides
misconduct (s.5(1)), and (c) the WC two-rule treatment (counts as service AND
substitutes in the 156-wk averaging window).

### Tasks delivered

| Task | Scope | Status |
|---|---|---|
| T6.1 | SA rule-set scaffold under `website/src/lib/lsl/states/sa/` | done |
| T6.2 | Continuous-service rules — single-regime, PH-inclusive period extension | done |
| T6.3 | Accrual table (s.5) + value-of-week (s.4 incl. casual loading + 156-wk averaging) | done |
| T6.4 | 64 single-mode + 3 bulk fixtures, gold-standard test harness | done |
| T6.5 | Dispatch registration + CI matrix + dispatcher test + canary forward | done |

### Out of scope (deferred / not applicable)

- **Phase 7 (ACT)** and onward — out of scope for this PR.
- No DEV-CROSS-3 was identified in the SA test-cases doc (PR #20).
  All 12 TBD-SA items are PM-resolved.

---

## Files created

```
website/src/lib/lsl/states/sa/
├── index.ts                          # Orchestrator (calculateSA + calculateSASafe + SA_RULE_SET)
├── extra-inputs.ts                   # SAExtraInputs (PH dates, WC weeks, etc.)
├── continuous-service-rules.ts       # Single-regime s.6 — break tolerances + transfer of business
├── rules/
│   ├── accrual-table.ts              # s.5(1) full payout @ 10yr / s.5(3) qualifying-reason pro-rata @ 7–10yr
│   ├── value-of-week.ts              # s.4 — incl. casual loading + 156-wk averaging w/ WC substitution
│   └── trigger-handlers.ts           # Citation-emitter; cash-out is tri-advisory not hard error
└── __tests__/
    ├── gold-standard.test.ts         # 64 single-mode fixtures
    ├── bulk.test.ts                  # 3 bulk-mode fixtures
    └── fixtures/
        ├── single/TC-SA-{001..064}.json
        └── bulk/TC-SA-BULK-{001..003}.json
```

## Files modified

- `website/src/lib/lsl/dispatch.ts` — registered `SA_RULE_SET` in `STATE_REGISTRY`.
- `website/src/lib/lsl/dispatch.test.ts` — updated assertions: SA now encoded; canary state moved from SA to ACT.
- `website/src/lib/lsl/engine/types.ts` — added 10 SA-specific warning codes to the `Warning.code` union.
- `website/src/components/lsl/result-panel.tsx` — added user-facing labels for the 10 new warning codes.
- `website/e2e/bulk-identity-dialog.spec.ts` — canary "(coming soon)" moved from SA → ACT.
- `.github/workflows/ci.yml` — added `sa` to `state-matrix` and `cross-state-regression` job.

---

## Architectural decisions honoured (10 SA-specific resolutions)

All 12 TBD-SA items are PM-signed-off in `docs/qa/test-cases-sa.md` v1.0
(per commit `df62faf`). The 10 load-bearing decisions reflected in the engine:

1. **Single rule set, single regime** (no dual-regime split like WA Phase 5).
   The SA LSL Act 1987 has no pre/post-amendment service-treatment fork that
   requires bisecting the accrual stream. Cleaner shape than WA.

2. **10+yr full payout overrides misconduct** (s.5(1)).
   The only state where misconduct does not forfeit accrued LSL once the
   10-year threshold is crossed. Emits `sa_10yr_plus_misconduct_full_payout`
   advisory rather than blocking. Sub-10yr misconduct → $0 with
   `sub_10yr_misconduct_excluded_sa`.

3. **7–10yr partial payout only on qualifying reason** (s.5(3)).
   Illness, incapacity, domestic/pressing necessity, employer-initiated
   termination. Pro-rata 13 / (15 × 52) × completed weeks of service.

4. **Sub-7yr: no entitlement** (s.5).
   Cash-out request at sub-7yr emits `sa_cashout_no_entitlement_to_cash_out`
   (Tier-3 of the cash-out tri-advisory).

5. **Public holidays INCLUSIVE in LSL period** (F11 / AC13, SA divergence).
   Hardcoded SA PH list per Public Holidays Act 1910 (SA). PHs falling
   inside the LSL period are paid as LSL, not extending it — opposite of
   NSW/VIC/QLD/WA convention.

6. **Cashing-out is ADVISORY**, three-code ladder (TBD-SA-06):
   `sa_cashout_post_accrual_advisory` (10+yr, agreement required) /
   `sa_cashout_pre_accrual_not_authorised` (7–10yr) /
   `sa_cashout_no_entitlement_to_cash_out` (sub-7yr).
   Parallel to resolved TBD-WA-03 / TBD-QLD-04. Result is `computed`, not `failed`.

7. **WC two-rule treatment** (TBD-SA-05):
   (a) WC absence COUNTS toward continuous service per accruing-leave
   guidance — natural reading of "absences from work due to illness or
   injury" bucket.
   (b) WC weeks are EXCLUDED from the 156-wk casual/PT averaging window
   and substituted with prior worked weeks per the methodology guidance.
   Two distinct rule paths from the same input signal.

8. **WC rate literal s.4** — engine pays at the WC-reduced rate when LSL
   is taken during a WC period, emitting
   `sa_lsl_calculated_at_wc_reduced_rate_warning` advisory.

9. **Casual continuity 3-mo / 6-mo heuristic** (TBD-SA-02).
   Default break tolerance 3 months; up to 6 months tolerated when the user
   supplies a seasonal-shutdown signal. Emits
   `sa_casual_seasonal_continuity_preserved` (preserved) or
   `sa_casual_continuity_uncertain` (2–6 months, no seasonal justification).

10. **Transfer of business preserves service** (s.6).
    New employer assumes liability; no engine forfeiture, both employers
    cited in the response.

---

## In-flight calibrations applied

**None.** All 67 SA fixtures pass as-drafted by PM in PR #20. No WA-trap
±1-day fixture date shifts were needed for any SA fixture — SA's
just-eligible / just-ineligible boundary fixtures (TC-SA-005, TC-SA-058,
TC-SA-061, TC-SA-062) land cleanly on the engine's strict `< 7.0` and
`< 10.0` boundaries.

No `totalEntitlementWeeks` / `totalEntitlementDollars` were stripped from
assertions either. SA fixtures were drafted from the outset using the
post-WA structural-surface convention (assert `valueOfWeek` + warnings +
citations + `payableIndicator` + `status`; integer-anniversary aspirational
totals are not asserted).

---

## Test gate

| Gate | Result |
|---|---|
| `npx vitest run src/lib/lsl/states/sa` | 259 passed (2 files: 64 single + 3 bulk × sub-assertions) |
| `npx vitest run` (full suite) | 1299 passed (33 files) |
| `npx tsc --noEmit` | clean |

### Cross-state byte-identical verification

NSW / VIC / QLD / WA test counts unchanged — zero changes to
`website/src/lib/lsl/states/{nsw,vic,qld,wa}/`:

| State | Tests |
|---|---|
| NSW | 153 passed |
| VIC | 170 passed |
| QLD | 200 passed |
| WA  | 242 passed |

The 10 new SA warning codes added to `engine/types.ts` are additive only —
the union expanded, no existing codes changed, so the byte-identity
guarantee holds.

---

## How to run

```
cd website

# SA suite only
npx vitest run src/lib/lsl/states/sa

# Full vitest
npx vitest run

# Full type check
npx tsc --noEmit
```

---

## Open items for QA

- Smoke-test the calculator UI in `/calculator/single` with an SA employee:
  10+yr FT termination with misconduct should produce a paid result with
  `sa_10yr_plus_misconduct_full_payout` advisory (the SA-unique override).
- Smoke-test `/calculator/single` with a 7–10yr SA employee citing a
  qualifying reason — should produce a pro-rata result with §5(3) citation.
- Smoke-test `/calculator/single` with an SA employee whose leave period
  spans an SA public holiday — verify the PH is included in the LSL period
  (does NOT extend the leave), unlike NSW/VIC/QLD/WA.
- Smoke-test `/calculator/bulk` with a mixed-state CSV including SA rows
  (TC-SA-BULK-002 covers this case).
- Smoke-test cash-out advisory: sub-7yr → no entitlement; 7–10yr →
  not authorised; 10+yr post-accrual → advisory only.
- Verify the result panel renders all 10 new SA warning labels correctly.
- Verify no NSW/VIC/QLD/WA regressions on the dispatcher path.

---

## Pre-flight watchouts for Phase 7 (ACT)

- The dispatcher's "coming soon" canary in `e2e/bulk-identity-dialog.spec.ts`
  is now ACT. When ACT ships, move it to the next unshipped state
  (TAS or NT).
- The dispatcher's `ENCODED_STATES` test (`dispatch.test.ts:32`) will need
  the same upgrade pattern (add ACT to the sorted list, swap canary `ACT`
  references to `TAS` or `NT`).
- ACT's LSL framework is closer to NSW/VIC in shape (no PH-inclusive
  divergence, no 10+yr misconduct override). Expect a leaner phase than SA
  — possibly the cleanest after NSW.
- ACT has unique handling of "portable LSL" for some industries (cleaning,
  community, security, construction) via a separate scheme — this may
  surface as a dev-cross item (cross-jurisdictional with private
  portable-LSL providers) that the engine v1 does NOT cover but should
  emit an advisory for. Flag this early in the spec phase.
- The 156-wk averaging window logic added for SA is reusable for any
  future state that adopts a similar method (TBD-ACT-?? if applicable).
  Consider lifting it to a shared `engine/averaging-windows.ts` helper if
  ACT or TAS need the same approach.

---

## Pickup notes (this session)

The prior agent (commit author of `8efa8e0`, `b45f06c`, `81e0413`) stalled
on a watchdog timeout AFTER writing all 36 remaining single fixtures and 2
bulk fixtures to disk but BEFORE committing them, and also had a pending
modification to `dispatch.test.ts` uncommitted. This session:

1. Verified the dispatch.test.ts diff is a clean SA registry addition
   (mirror of the WA Phase 5 pattern — rename test, expand sorted list,
   swap canary references from SA to ACT). Safe to commit.
2. Ran the SA test suite green (259/259) and the full vitest green
   (1299/1299) BEFORE committing.
3. Ran `npx tsc --noEmit` green (the gate the prior agent died on).
4. Committed in two slices: fixtures (commit `2b5ef37`) and dispatch test
   (commit `0781fe5`). Pushed.
5. Retitled PR #22 from "...fixtures pending in follow-up" to
   "...67 fixtures, single regime, PH-inclusive", rewrote the body using
   the WA PR #19 template style, and marked it ready for review.

No additional engine changes were needed during pickup — the prior agent
shipped working code; the stall was procedural, not technical.
