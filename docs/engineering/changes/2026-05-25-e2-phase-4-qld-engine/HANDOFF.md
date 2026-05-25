# Handoff — E2 Phase 4 QLD engine (T4.1–T4.5)

**Date**: 2026-05-25
**Branch**: `e2-phase-4-qld`
**Developer**: Claude (Opus 4.7)
**Status**: READY FOR QA

---

## What landed

Phase 4 of E2 (per-state LSL coverage) — the QLD (Queensland) engine. QLD is
the third state encoded after NSW (E1) and VIC (E2 Phase 3). T4.1 through
T4.5 from `.specify/features/002-all-state-coverage/tasks.md` are complete.

### Tasks delivered

| Task | Scope | Status |
|---|---|---|
| T4.1 | QLD rule-set scaffold under `website/src/lib/lsl/states/qld/` | done |
| T4.2 | Continuous-service rules + s.103 casual cliff hard-anchor + s.96 advisory + cash-out advisory family | done |
| T4.3 | Accrual table (s.95(2)(a), s.95(3)/(4)) + value-of-week (s.98 / s.99 / s.105) | done |
| T4.4 | Trigger handlers — taking_leave, termination, as_at, cash_out (advisory not hard error) | done |
| T4.5 | 52 single-mode + 3 bulk fixtures, gold-standard test harness | done |

### Out of scope (deferred to follow-up PRs)

- **DEV-CROSS-1** — cross-state termination-reason enum refactor. Five
  fixtures (TC-QLD-005, -007, -008, -015, -016) are deferred until that lands;
  they live in the test-cases-qld.md "Deferred" appendix and are NOT in the
  fixture set.
- **Phase 5 (WA)** and onward — out of scope for this PR.

---

## Files created

```
website/src/lib/lsl/states/qld/
├── index.ts                                  # Orchestrator (calculateQLD + calculateQLDSafe + QLD_RULE_SET)
├── extra-inputs.ts                           # QLDExtraInputs (currentHourlyRate, hoursLast52Weeks, ...)
├── continuous-service-rules.ts               # Single-regime: s.103 casual cliff + s.96 advisory + s.134
├── rules/
│   ├── accrual-table.ts                      # s.95(2)/(3)/(4) with 10-yr automatic + 7-10yr qualifying-reason gate
│   ├── value-of-week.ts                      # s.98 fixed + s.99 commission + s.105 casual loaded rate
│   └── trigger-handlers.ts                   # Citation-emitter; cash-out is advisory not hard error
└── __tests__/
    ├── gold-standard.test.ts                 # 52 single-mode fixtures
    ├── bulk.test.ts                          # 3 bulk-mode fixtures
    └── fixtures/
        ├── single/TC-QLD-{001..057}.json     # 52 active (5 deferred)
        └── bulk/TC-QLD-BULK-{001..003}.json
```

## Files modified

- `website/src/lib/lsl/dispatch.ts` — registered `QLD_RULE_SET` in `STATE_REGISTRY`.
- `website/src/lib/lsl/dispatch.test.ts` — updated assertions to reflect QLD encoded.
- `website/src/lib/lsl/engine/types.ts` — added 10 QLD-specific warning codes to the `Warning.code` union.
- `website/src/components/lsl/result-panel.tsx` — added user-facing labels for the 10 new warning codes.
- `website/e2e/bulk-identity-dialog.spec.ts` — moved the "(coming soon)" canary from QLD to WA (since QLD has now shipped).
- `.github/workflows/ci.yml` — added `qld` to `state-matrix` and `cross-state-regression` job.

---

## Key architectural decisions (per PM resolutions in test-cases-qld.md)

These are all PM-signed-off in `docs/qa/test-cases-qld.md` v1.0:

1. **TBD-QLD-01 — Continuous 1/60 accrual** with no discrete step at 15 yrs.
   Threshold inclusivity at 7 / 10 / 15 yrs at the exact-day boundary
   (`years_of_continuous_service >= 7.0000` etc.).

2. **TBD-QLD-02 — Historical cliffs**:
   - s.103 casual cliff (1994-03-30): **HARD-ANCHOR** — engine moves
     `effectiveServiceStart` to 1994-03-30 when employee is casual and
     `startDate < 1994-03-30`. Emits `pre_1994_casual_cliff_qld` warning.
   - s.96 general cliff (1990-06-23): **ADVISORY-ONLY** — engine uses actual
     start date but emits `pre_1990_service_advisory_qld` warning.

3. **TBD-QLD-03 — Casual value-of-week**: single 52-wk lookback using
   `(hoursLast52Weeks / 52) × currentHourlyRate` per Business QLD formula
   and s.105. NOT a 3-tier "greater of" (that stays VIC-specific).

4. **TBD-QLD-04 — Cash-out is ADVISORY, not hard error**. Engine returns
   `status: 'computed'` and emits `qld_cashout_requires_instrument_or_qirc`.
   At sub-10-yr, also emits `sub_10yr_cashout_only_via_qirc_qld`. At sub-7-yr,
   value is $0 with `qld_cashout_no_entitlement_to_cash_out`. This is the
   critical QLD-vs-VIC divergence (VIC cash-out is a hard error per s.34).

5. **TBD-QLD-05 — WC literal s.98**: engine applies the rate at time of
   leave, even if that's a reduced WC rate. QLD has NO equivalent of VIC
   s.17 higher-of-rates. When a `workers_comp_absence` event overlaps the
   trigger date, the engine emits `qld_lsl_calculated_at_wc_reduced_rate_warning`.

6. **TBD-QLD-06 — Termination enum unchanged**. v1 uses the existing
   `Trigger.reason` enum values (`voluntary_resignation`, `redundancy`,
   `serious_misconduct`, `illness_incapacity`, `death`,
   `employer_initiated_not_misconduct`, `domestic_pressing_necessity`). Five
   fixtures requiring `terminationInitiator`, `unfair_dismissal`, or
   `poor_performance` are deferred to DEV-CROSS-1.

7. **Misconduct treatment (QLD-specific divergence from VIC)**:
   - sub-10-yr `serious_misconduct` → $0 (s.95(3)(d) excludes conduct).
   - 10+ yr `serious_misconduct` → full payout (s.95(2) is automatic).

---

## Regression evidence

| Suite | Result | Evidence |
|---|---|---|
| NSW gold-standard | **153/153 PASS** | `npx vitest run src/lib/lsl/states/nsw` |
| VIC gold-standard + bulk | **170/170 PASS** | `npx vitest run src/lib/lsl/states/vic` |
| QLD gold-standard + bulk | **179/179 PASS** (52 single + 3 bulk fixtures × sub-assertions) | `npx vitest run src/lib/lsl/states/qld` |
| Dispatcher | **14/14 PASS** | `npx vitest run src/lib/lsl/dispatch.test.ts` |
| Full vitest | **697/697 PASS** (26 test files) | `npx vitest run` |
| TypeScript | clean | `npx tsc --noEmit` |
| Next.js build | clean | `npm run build` |
| Playwright chromium (dev) | **27/27 PASS** | `npx playwright test --project=chromium` |
| Playwright chromium (production) | **27/27 PASS** | `PLAYWRIGHT_PRODUCTION_BUILD=1 npx playwright test --project=chromium` |

---

## One operator note — fixture date precision

The QLD test-cases doc describes TC-QLD-013 as "6 yrs 364 days" with
`startDate: 2019-05-26, endDate: 2026-05-25`. Under the engine's
`inclusiveDays / 365.25` formula, that date range computes to **7.0008 yrs**
(2557 inclusive days), which actually **crosses the 7-yr threshold** and
yields a 6+ wk pro-rata.

To preserve the legal intent of the fixture (sub-7-yr → $0) without altering
the PM-signed-off s.95(3) interpretation, I shifted the start date by one day
(`2019-05-26` → `2019-05-27`). The new range computes to 6.9954 yrs (2556
inclusive days), genuinely sub-7. This is a fixture-data adjustment, not a
spec change. The legal interpretation (sub-7 → $0 → `sub_7yr_no_entitlement_qld`)
is unchanged from the signed test-cases doc.

If PM prefers the date-range stay as originally drafted, the test will need
its expected output adjusted to reflect ~7 yrs of accrual instead of $0.

---

## How to run

```bash
cd website

# QLD suite only
npx vitest run src/lib/lsl/states/qld

# Full state matrix (NSW + VIC + QLD + engine)
npx vitest run src/lib/lsl/states src/lib/lsl/engine

# Full vitest
npm run test

# Playwright (dev mode, chromium)
npx playwright test --project=chromium

# Playwright (production bundle, full matrix — what CI runs)
PLAYWRIGHT_PRODUCTION_BUILD=1 npx playwright test
```

## What's next

1. **QA pass** (T4.6 launch gate) — validate the 52 single-mode fixtures and
   3 bulk fixtures match the signed test-cases doc.
2. **DEV-CROSS-1 follow-up PR** — implement cross-state termination-reason
   enum refactor; reinstate the 5 deferred fixtures (TC-QLD-005, -007, -008,
   -015, -016).
3. **Phase 5 (WA)** can start once T4.6 closes.
