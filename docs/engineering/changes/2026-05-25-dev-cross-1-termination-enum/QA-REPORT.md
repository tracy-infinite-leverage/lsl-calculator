# QA Report — DEV-CROSS-1 termination-reason enum refactor

- **PR**: #14 — https://github.com/tracy-infinite-leverage/lsl-calculator/pull/14
- **Branch**: `dev-cross-1-termination-enum`
- **HEAD**: `fae53e6`
- **QA agent**: 2026-05-25
- **Branch at start**: `dev-cross-1-termination-enum`
- **Branch at end**: `dev-cross-1-termination-enum`

## Overall verdict

**PASSES WITH NOTES** — engine is sound, byte-identity confirmed across all 3 states, scope expansion is defensible, but the new Playwright test fails on Firefox + Webkit in the CI matrix and must be stabilised before merge.

## Summary table

| Area | Verdict |
|---|---|
| Byte-identity NSW (153/153) | PASS |
| Byte-identity VIC (170/170) | PASS |
| Byte-identity QLD (179/179) | PASS |
| New enum acceptance across 3 states (38 tests) | PASS |
| Conditional UI Playwright (chromium) | PASS |
| Conditional UI Playwright (firefox + webkit CI) | **FAIL — P1** |
| CSV bulk acceptance | PASS |
| Form-to-engine translation (10 tests) | PASS |
| TypeScript clean | PASS |
| Build clean | PASS |
| Vitest 745/745 | PASS |
| Engine capable of computing 5 deferred QLD fixtures | PASS |

## 1. Byte-identity verification (CRITICAL)

### Diff against main for fixtures

```
git diff main -- website/src/lib/lsl/states/{nsw,vic,qld}/__tests__/fixtures/
```

→ **zero output**. No fixture file touched. This is the strongest possible byte-identity signal — the expected outputs in the gold-standard suites have not moved.

### Per-state vitest results

| State | Single | Bulk | Total | Status |
|---|---|---|---|---|
| NSW | 153 | n/a | 153/153 | PASS |
| VIC | 163 | 7 | 170/170 | PASS |
| QLD | 167 | 12 | 179/179 | PASS |

(Dev claim said "VIC 170 / QLD 179" — that's the per-state-folder total including bulk, verified accurate.)

### Spot-check exact-value evidence

- **TC-NSW-024** — `totalEntitlementDollars: "9880.04"` confirmed in `website/src/lib/lsl/states/nsw/__tests__/fixtures/single/TC-NSW-024.json`. Test "total entitlement = $9880.04" passed.
- **TC-VIC-024** — 9 yrs FT serious-misconduct case (s.9(1)(b) — VIC pays out, no forfeiture). `expected.valueOfWeek: "1700.00"` confirmed and all sub-assertions passed.
- **TC-QLD-049** — cash-out at 8 yrs (`qld_cashout_requires_instrument_or_qirc` warning). All sub-assertions passed.

### Full suite

```
745/745 tests passed (28 test files)
```

Dev claim of 745 total / +48 from baseline is accurate.

**Verdict**: ✅ Byte-identity confirmed for NSW + VIC + QLD. The refactor is genuinely additive at runtime for existing inputs.

## 2. Scope expansion judgment — QLD behaviour added beyond brief

The original DEV-CROSS-1 brief positioned QLD as "just accepts the new enum types"; dev wired the qualifying-reason mapping for `unfair_dismissal` and the initiator disambiguation for `illness_incapacity` into QLD's accrual table inside this PR.

### Correctness check

Reading `website/src/lib/lsl/states/qld/rules/accrual-table.ts`:

- `QLD_QUALIFYING_REASONS` set: `death`, `illness_incapacity`, `redundancy`, `employer_initiated_not_misconduct`, `domestic_pressing_necessity`, `unfair_dismissal` — matches the test-cases-qld.md s.95(3)(a)-(e) mapping.
- `poor_performance` deliberately excluded from the set + an explicit branch (lines 253-269) that returns 0 weeks + `sub_10yr_no_qualifying_reason_qld` warning. Matches TC-QLD-015's expectation.
- `illness_incapacity` initiator disambiguation (lines 281-292): `employer` → s.95(3)(c), `employee`/omitted → s.95(3)(b). Both pay out (same dollars, different citation). Matches test-cases-qld.md AC for TC-QLD-005.
- 10+yr branch (lines 145-166) short-circuits before reaching the initiator switch — so initiator is irrelevant at 10+yr, matching s.95(2)(a) "automatic full payout regardless of reason."

### Doc match

`docs/qa/test-cases-qld.md` lists exactly these 5 deferred fixtures with their s.95 sub-paragraph expectations. The engine code in this PR maps cleanly to each one (see section 11 below).

### Risk to deferred fixtures

The 5 deferred fixtures don't exist yet; the engine just needs to map correctly when they're added. The cases are:

| Fixture | Engine path |
|---|---|
| TC-QLD-005 (8yr employer illness dismissal) | `illness_incapacity` + initiator=`employer` → s.95(3)(c), payable |
| TC-QLD-007 (9yr employer-initiated-not-misconduct) | `employer_initiated_not_misconduct` → s.95(3)(d), payable |
| TC-QLD-008 (8yr unfair dismissal) | `unfair_dismissal` → s.95(3)(e), payable |
| TC-QLD-015 (8yr poor performance) | `poor_performance` → 0 weeks, `sub_10yr_no_qualifying_reason_qld` warning |
| TC-QLD-016 (7yr domestic pressing necessity) | `domestic_pressing_necessity` → s.95(3)(b), payable |

All five paths exist in the new engine code and pass the cross-state assurance test (`termination-enum.test.ts`).

**Verdict**: **Acceptable scope expansion.** Splitting "accept enum value at parser" from "branch on enum value at accrual" into separate PRs would have shipped a temporarily-broken state where the form has a value the engine ignores, and would have produced a misleading citation for QLD `illness_incapacity` employer cases (s.95(3)(b) instead of s.95(3)(c)). The expansion is coherent, well-cited, and unlocks the 5 deferred fixtures with a single follow-up PR that's purely fixture-authoring.

## 3. NSW `reasonToRuleKey` exhaustive change

The dev claim: "defensive only, no behavioural change because the function is only called inside a guard the new values never enter."

### Verification

Reading `website/src/lib/lsl/states/nsw/rules/accrual-table.ts`:

- Line 127: `if (QUALIFYING_5_TO_10_REASONS.includes(reason)) { ... reasonToRuleKey(reason) ... }` — the only call site.
- `QUALIFYING_5_TO_10_REASONS` (line 15) = `['employer_initiated_not_misconduct', 'redundancy', 'illness_incapacity', 'domestic_pressing_necessity', 'death']` — does NOT include the new enum values nor `voluntary_resignation`/`serious_misconduct`.
- 10+yr branch (line 157) uses `reason === 'serious_misconduct'` directly without calling `reasonToRuleKey`.

So the switch cases for `unfair_dismissal`, `poor_performance`, `voluntary_resignation`, and `serious_misconduct` are dead code — never reached.

### Doc-comment defect (minor — P3)

The comment on lines 179-187 says:

> This switch is only reached for 10+yr cases (where every reason pays out), so the rule key just needs to be a stable string for citation labelling.

This is **factually wrong** — the switch is reached only for 5-10yr qualifying reasons (not 10+yr). The behavioural conclusion ("never reached for the new enum values") happens to be correct, but the stated reasoning is inverted. Not blocking, but should be fixed in a follow-up for code clarity.

### NSW byte-identity

153/153 tests pass; zero fixture diff. Confirms no behavioural change.

**Verdict**: ✅ Defensive-only confirmed. Doc comment is misleading but doesn't affect runtime.

## 4. New enum values acceptance across 3 states

`website/src/lib/lsl/engine/termination-enum.test.ts` covers this with **38 tests** (dev brief said 27 — undercount). Read end-to-end:

- 27 tests assert every state accepts every reason without throwing (3 states × 9 reasons = 27).
- 4 tests assert NSW behaviour at 8yr for `unfair_dismissal` + `poor_performance` (non-qualifying → 0 weeks).
- 2 tests assert VIC at 8yr pays out regardless of reason (no reason gate above 7yr).
- 2 tests assert QLD `unfair_dismissal` → s.95(3)(e) citation + payable.
- 1 test asserts QLD `poor_performance` → 0 weeks + `sub_10yr_no_qualifying_reason_qld` warning.
- 1 NSW + 1 VIC test assert `terminationInitiator` is ignored (results byte-identical with and without it).
- 3 QLD tests assert `illness_incapacity` initiator disambiguation: omitted defaults to employee/s.95(3)(b); explicit `employee` → s.95(3)(b); explicit `employer` → s.95(3)(c).

All 38 tests pass.

**Verdict**: ✅ Coverage is correct and exercises what it claims.

## 5. Conditional UI Playwright verdict

### Local dev (chromium only)

```
e2e/single-mode.spec.ts → 4 passed (4.1s)
```

The new `Single-mode — termination initiator (DEV-CROSS-1)` test passes. It verifies:

- Initiator radio absent when reason = `voluntary_resignation` ✓
- Initiator radio visible when reason = `illness_incapacity` ✓
- Validation error fires on submit without picking initiator ✓
- Calculation succeeds with `employer` selected, s.95(3)(c) citation appears in result ✓
- Initiator radio hides again when reason switches to `Redundancy` ✓

### Full CI matrix (chromium + firefox + webkit + mobile-chrome)

```
110 passed, 2 failed (4.1m)
[firefox]  e2e/single-mode.spec.ts:114 DEV-CROSS-1 — FAILED
[webkit]   e2e/single-mode.spec.ts:114 DEV-CROSS-1 — FAILED
```

Failure root cause: the second `pickRadixSelect(page, '#terminationReason', 'Redundancy')` call (line 185) times out because the option element is "outside of the viewport" after the result panel has rendered. The page has scrolled down to show the calculation result, and on Firefox/Webkit the Radix select's portal option list ends up below the visible area. The current helper does not scroll the option into view before clicking.

**This is a CI blocker** — the Playwright job in `.github/workflows/ci.yml` runs the full matrix and will fail on this PR.

**Bug filed: see section 12, bug #1 (P1).**

## 6. CSV bulk acceptance verdict

`website/src/lib/lsl/parsers/csv/bulk.ts` diff is minimal:

```diff
+ 'unfair_dismissal',
+ 'poor_performance',
```

Both new enum values are added to `VALID_TERMINATION_REASONS`. No `termination_initiator` CSV column has been added (deferred — correctly per the brief). The bulk parser does not synthesize an initiator, so the engine receives `terminationInitiator: undefined` for bulk rows and defaults to `'employee'` per the new optional contract. QLD `illness_incapacity` bulk rows therefore route to s.95(3)(b) — matches the dev's stated intent.

Manually traced behaviour:
- `unfair_dismissal` row → accepted by parser → routed through QLD engine → s.95(3)(e) citation, payable at 8yr.
- `poor_performance` row → accepted by parser → QLD engine returns 0 weeks + `sub_10yr_no_qualifying_reason_qld` warning at 8yr.
- `illness_incapacity` row → accepted by parser → defaults to employee initiator → s.95(3)(b) citation.

**Verdict**: ✅ Acceptance is correct; deferring the CSV initiator column is the right call (no breaking schema change for users).

## 7. Form-to-engine translation verdict

`website/src/app/(calculator)/calculator/single/_components/form-to-engine.test.ts` — **10 tests** (dev brief said 12 — undercount):

- 2 tests assert `unfair_dismissal` + `poor_performance` round-trip with `terminationInitiator: undefined`.
- 3 tests assert initiator propagation: carried when reason needs it AND value supplied; omitted when reason needs it but value empty; omitted for `voluntary_resignation` even with stale value.
- 1 test asserts stale-value-dropping for new reasons.
- 4 validation tests: missing initiator flagged for `illness_incapacity`; not flagged for `voluntary_resignation`, `unfair_dismissal`, `poor_performance`; passes when initiator supplied.

All 10 tests pass. The "even-if-localStorage-has-stale-state" test is particularly good — it catches a real footgun.

The form-side reason-switch handler in `single-mode-form.tsx` (lines 530-535) also clears `terminationInitiator` when the new reason doesn't need it. Combined with the form-to-engine's defensive drop in `form-to-engine.ts:172-178`, stale state can't leak from localStorage to the engine.

**Verdict**: ✅ Translation layer is correct and well-tested.

## 8. Pre-existing controlled/uncontrolled warning

The new RadioGroup uses `value={state.terminationInitiator || undefined}` — same pattern as the existing `terminationReason` Select (`value={state.terminationReason || undefined}`).

Running the e2e test on `main` (before this PR) produces:

```
[browser] Select is changing from uncontrolled to controlled. ...
[browser] Select is changing from controlled to uncontrolled. ...
```

Running on this branch produces the same warnings plus:

```
[browser] RadioGroup is changing from uncontrolled to controlled. ...
```

**Confirmed**: this is the same Radix v1 pattern Tracy already has on the Select. Not a regression introduced by this PR. There may already be a tracking issue for the Select case — if not, this is worth recording.

**Verdict**: ✅ Not a regression. Suggest a follow-up to switch all Radix `value` props to `value={state.X ?? ''}` paired with a `defaultValue` to silence the warnings at the root.

## 9. Browser smoke

Not run via Claude Preview — the Playwright test in section 5 covers the same surface on chromium with deterministic localStorage seeding, which is more reliable than a manual browser session. Local Playwright dev run passes; full matrix has the Firefox/Webkit failure documented in section 5.

## 10. ESLint pre-existing error (informational — P3)

Running `npx eslint` on touched files surfaces one error:

```
single-mode-form.tsx:59:16 — Avoid calling setState() directly within an effect
```

I verified this error already exists on `main` (the loadFromStorage hook predates this PR). The CI workflow runs `tsc + vitest + next build + playwright` but **does NOT run `next lint`** — so this won't block CI. Recording for future cleanup; not a regression.

## 11. Engine capability for 5 deferred QLD fixtures

Working through each deferred fixture against the engine code:

### TC-QLD-005 — 8 yrs FT employer illness dismissal → pro-rata payable, s.95(3)(c)

- Engine path: `trigger.reason === 'illness_incapacity' && initiator === 'employer'`
- Hits `accrual-table.ts:285-291` → citation `QLD IR Act 2016 s.95(3)(c)` / `accrual.7-to-10yr.employer-illness-dismissal`
- `QLD_QUALIFYING_REASONS.has('illness_incapacity')` → true → falls into payable branch (line 315-323)
- Returns `payableIndicator: 'payable'` with `payableWeeks > 0`
- ✅ **CAPABLE**

### TC-QLD-007 — 9 yrs FT employer-initiated-not-misconduct → pro-rata payable, s.95(3)(d)

- Engine path: `trigger.reason === 'employer_initiated_not_misconduct'`
- Hits `accrual-table.ts:297-301` → citation `QLD IR Act 2016 s.95(3)(d)` / `accrual.7-to-10yr.dismissal-not-for-conduct`
- `QLD_QUALIFYING_REASONS.has('employer_initiated_not_misconduct')` → true → payable
- ✅ **CAPABLE**

### TC-QLD-008 — 8 yrs FT unfair dismissal → pro-rata payable, s.95(3)(e)

- Engine path: `trigger.reason === 'unfair_dismissal'`
- Hits `accrual-table.ts:302-305` → citation `QLD IR Act 2016 s.95(3)(e)` / `accrual.7-to-10yr.unfair-dismissal`
- `QLD_QUALIFYING_REASONS.has('unfair_dismissal')` → true → payable
- Confirmed by `termination-enum.test.ts > QLD behaviour > unfair_dismissal at 8yr → payable (s.95(3)(e))` — actively passing
- ✅ **CAPABLE**

### TC-QLD-015 — 8 yrs FT poor-performance dismissal → $0, s.95(3)(d) excludes performance

- Engine path: `trigger.reason === 'poor_performance'`
- Hits `accrual-table.ts:253-269` → citation `QLD IR Act 2016 s.95(3)(d)` / `accrual.7-to-10yr.dismissal-for-performance-excluded`
- Returns `payableWeeks: 0`, `payableIndicator: 'accrued_not_currently_payable'`, `noQualifyingReason: true`
- Upstream warning `sub_10yr_no_qualifying_reason_qld` emitted (confirmed by the enum test)
- ✅ **CAPABLE**

### TC-QLD-016 — 7 yrs FT domestic pressing necessity resignation → pro-rata payable, s.95(3)(b)

- Engine path: `trigger.reason === 'domestic_pressing_necessity'`
- Hits `accrual-table.ts:293-295` → citation `QLD IR Act 2016 s.95(3)(b)` / `accrual.7-to-10yr.domestic-pressing-necessity`
- `QLD_QUALIFYING_REASONS.has('domestic_pressing_necessity')` → true → payable
- Note: 7yr threshold is inclusive (`yearsOfService.lt(7)` gate, line 127) — fixture at exactly 7.0000 yrs falls into the 7-10yr band, correct
- ✅ **CAPABLE**

**Verdict**: ✅ All 5 deferred fixtures can be added in a fixture-only follow-up PR.

## 12. Bugs

### Bug #1 — Playwright DEV-CROSS-1 test fails on Firefox + Webkit in CI matrix — **P1**

**Repro**:
```
cd website && CI=true ANTHROPIC_API_KEY=build-time-placeholder npx playwright test e2e/single-mode.spec.ts -g "DEV-CROSS-1"
```

**Symptom**: `pickRadixSelect(page, '#terminationReason', 'Redundancy')` on line 185 times out after ~58s. The option element is logged as "visible, enabled and stable" but "outside of the viewport." Worker retries hit the same state.

**Root cause**: After the calculation runs (line 181), the result panel renders below the form; the page scrolls into a state where the Radix Select portal's option list (containing 'Redundancy') is positioned below the viewport on the Firefox/Webkit viewport sizes (1280×720 default). Chromium happens to render the portal in a position that's visible. The helper does `await page.getByRole('option', { name: optionLabel }).click()` without first scrolling the option into view.

**Why it matters**: The CI Playwright job runs the full 4-browser matrix. With this branch as-is, the CI Playwright check will fail and block merge.

**Fix suggestions** (not blocking; for the next dev pass):
- Add `await page.locator('#terminationReason').scrollIntoViewIfNeeded()` before each `pickRadixSelect` call, OR
- Split the test in two: one that ends after the validation+calculation flow, a second that starts fresh in localStorage with `terminationReason: 'illness_incapacity'` and switches to `Redundancy` before any calculation runs. The second test avoids the scrolled-result-panel state.

**Severity**: P1 — does not affect production behaviour; blocks CI merge.

**Resolution (2026-05-25 — developer)**: Closed by commit `e7aace4` — "fix(test): stabilise DEV-CROSS-1 Playwright on Firefox/Webkit". The single test was split into two so the "hide on switch back to redundancy" case starts from a fresh page with no result panel pushing the trigger below the fold. Verified 116/116 across all four browser projects (chromium + firefox + webkit + mobile-chrome) in both dev and production-build (`PLAYWRIGHT_PRODUCTION_BUILD=1`) modes. Vitest 745/745 unchanged. NSW 153/153, VIC 170/170, QLD 179/179 byte-identical (no fixture or engine touched).

### Bug #2 — NSW `reasonToRuleKey` doc comment is factually inverted — **P3**

`website/src/lib/lsl/states/nsw/rules/accrual-table.ts:179-187`. The comment says the switch is "only reached for 10+yr cases" — it's actually only reached for 5-10yr qualifying reasons (10+yr uses a direct `reason === 'serious_misconduct'` check). The behavioural conclusion ("never reached for the new enum values") happens to remain correct.

**Severity**: P3 — code-clarity only; no runtime impact. Fix in a follow-up.

### Bug #3 — Dev claim counts off (informational) — **P3**

- Brief: "27 new tests in termination-enum.test.ts" — actual: 38.
- Brief: "12 new tests in form-to-engine.test.ts" — actual: 10.
- Brief: "28/28 Playwright dev + 28/28 production-build" — accurate for chromium-only. Full matrix is 112 expected (28 × 4 browsers), of which 110 pass + 2 fail (bug #1).

Not a quality issue, just record-keeping noise. **P3.**

### Pre-existing items (NOT bugs introduced by this PR)

- Radix `value={state.X || undefined}` controlled-vs-uncontrolled warning — present on main for the `terminationReason` Select, replicated here for the `terminationInitiator` RadioGroup. Worth a future cleanup PR across all Radix bindings.
- `setState() directly within an effect` ESLint error in `single-mode-form.tsx:59` — pre-existing on main; not run by CI.

## 13. Hard-rule compliance

- ✅ No code changes made by QA.
- ✅ No commits made.
- ✅ Stayed on `dev-cross-1-termination-enum` throughout (briefly switched to `main` for the pre-existing-warning check; returned immediately).
- ✅ No empty / CI-trigger commits.
- ✅ This QA report is the only file written by QA, at the path specified by the operator.

## 14. Recommendations for the operator

1. **Merge-block**: address bug #1 (Playwright test cross-browser flake) before merge. The fix is small (scroll-into-view or test split), and is not an engine concern.
2. **After merge**: file a follow-up issue to author the 5 deferred QLD fixtures (TC-QLD-005, -007, -008, -015, -016). The engine is ready.
3. **Hygiene** (defer): fix the NSW doc comment (bug #2) and refactor Radix value bindings to use `value ?? ''` to silence the controlled/uncontrolled warnings across the form (touches `terminationReason` Select + new `terminationInitiator` RadioGroup + any future Radix controls).
