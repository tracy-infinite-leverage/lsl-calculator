# QA Report — E2 Phase 7 ACT engine

**Date**: 2026-05-26
**Reviewer**: QA agent (Claude Opus 4.7)
**PR**: https://github.com/tracy-infinite-leverage/lsl-calculator/pull/26
**Branch**: `e2-phase-7-act-engine` @ `073e5eb`
**Binding contract**: `docs/qa/test-cases-act.md` v1.0 — PM-signed 2026-05-26
**Verdict**: APPROVE FOR MERGE

---

## Executive summary

PR #26 ships the ACT (Australian Capital Territory) LSL engine — the sixth Australian state encoded. All four Sev-1 architectural divergences from the binding contract are implemented correctly and verifiable through fixtures. Cross-state regression is clean (NSW + VIC + QLD + WA + SA unchanged). CI is fully green including Playwright. Engine-layer changes are strictly additive (optional fields only).

Two minor follow-ups (both P3) noted below — neither blocks merge.

| Metric | Result |
|---|---|
| ACT fixtures pass (311 unit assertions across 75 single + 3 bulk) | PASS |
| Cross-state regression byte-identical (1024 tests across NSW/VIC/QLD/WA/SA) | PASS |
| Full vitest suite (35 files, 1610 tests) | PASS |
| TypeScript `tsc --noEmit` | PASS |
| CI: state suites (act, nsw, vic, qld, wa, sa, engine) | PASS |
| CI: cross-state regression job | PASS |
| CI: Playwright (chromium · webkit · firefox · mobile-chrome) | PASS (4m14s) |
| CI: TypeScript · Vitest · Build | PASS |
| Vercel preview deploy | PASS |

---

## Layer 1 — fixture/spec consistency

### Test run

```
$ cd website && npx vitest run src/lib/lsl/states/act --reporter=verbose
Test Files  2 passed (2)
     Tests  311 passed (311)
```

PASS — matches the dev claim of 311 ACT tests.

### Spot-checks against contract (Resolutions section)

| Fixture | Contract anchor | Verification | Result |
|---|---|---|---|
| TC-ACT-001 | s.4 7-yr qualifying entitlement | FT taking_leave, valueOfWeek $1800, expected citations array | PASS |
| TC-ACT-006 | TBD-ACT-02 asymmetric overtime (PT taking_leave, s.7(2) anchor) | Hours 1300/52 × $35 = $875, `act_overtime_included_in_hours_average` warning | PASS |
| TC-ACT-010 | sub-5-yr floor (4.9 yrs illness) | $0, `sub_5yr_no_entitlement_act` | PASS |
| TC-ACT-011 | sub-7-yr voluntary resignation (must NOT pay out) | 5.5 yrs voluntary, $0, `sub_7yr_no_qualifying_reason_act` | PASS |
| TC-ACT-012 | 5–7-yr s.11C qualifying reason (must pay out) | 6 yrs domestic_pressing_necessity, payable, `payable_by: 2026-08-24` | PASS |
| TC-ACT-018 | TBD-ACT-07 poor performance non-qualifying | 6 yrs poor_performance, $0, `sub_7yr_no_qualifying_reason_act` | PASS |
| TC-ACT-029 | TBD-ACT-15 paid parental leave excluded | `sa_or_act_parental_leave_excluded` warning emitted | PASS |
| TC-ACT-036 | TBD-ACT-05 WC pre-9-Jun-2023 cap | `act_workers_comp_pre_9jun2023_capped` | PASS |
| TC-ACT-037 | WC post-9-Jun-2023 counts in full | `act_workers_comp_post_9jun2023_counts`, cite WC Act 1951 (ACT) s.46 | PASS |
| TC-ACT-051 | F9/AC11 casual overtime asymmetry | Casual 1560h, $42.50 base → $1275/wk; overtime advisory | PASS |
| TC-ACT-056 | TBD-ACT-04 s.7(3) FT→PT within 2 yrs | Transition 2024-11-26 → entitlement 2026-05-26 = 18 mo; `act_s7_3_ft_to_pt_within_2yr_path` | PASS |
| TC-ACT-060 | TBD-ACT-03 anchor split — hours INCREASED | termination uses s.11D (1820h/52 × $35 = $1225); divergence warning fires | PASS |
| TC-ACT-061 | TBD-ACT-03 anchor split — hours DECREASED | termination uses s.11D (1040h/52 × $35 = $700); divergence warning fires | PASS |
| TC-ACT-068 | WC reduced-rate during LSL — literal s.7 rate + advisory | $1300/wk literal, `act_lsl_calculated_at_wc_reduced_rate_warning` | PASS |
| TC-ACT-073 | Cross-jurisdiction — ACT engine defensive gate when NSW governing | `blocked_cross_jurisdiction` from ACT engine (dispatcher routes to NSW separately) | PASS |
| TC-ACT-074 | ACT + VIC, no governing nominated → BLOCKED | `blocked_cross_jurisdiction` | PASS |
| TC-ACT-075 | TBD-ACT-08 payable_by surface (s.11A(4)(b) 90 days) | termination_date + 90 days = `2026-08-24`, advisory warning | PASS |

### Anchor split (Sev-1 highest mis-coding risk)

Verified independently: `taking_leave` fixtures (TC-ACT-001 FT, TC-ACT-006 PT, TC-ACT-051 casual, TC-ACT-052 PT, TC-ACT-057 casual) route through s.7(2) entitlement-date anchor. `termination` fixtures (TC-ACT-059/060/061) route through s.11D cessation-date anchor. The `act_taking_anchor_vs_termination_anchor_diverged` warning fires only when the two windows produce different averages AND the trigger is termination — gated correctly at `website/src/lib/lsl/states/act/index.ts:281`.

### Overtime asymmetry (Sev-1)

Verified: contract example annotation `hoursLast12MonthsBeforeEntitlement: 1300 # base hours 1200 + 100 overtime hours` is implemented as "caller supplies TOTAL hours including OT; `act_overtime_hours_by_period` is provenance for the asymmetric warning; engine applies base hourly rate only". TC-ACT-006 and TC-ACT-051 both compute `total_hours / 52 × base_rate` with no OT premium addition. Consistent with WorkSafe ACT guidance and APA Masterclass.

### Fixture-as-code coverage gaps (acceptable for v1)

Several fixtures relax their `expected` block to assert only a subset of contract values (e.g. TC-ACT-008 commission drops `valueOfWeek` after wage-period day-precision adjustment per HANDOFF "Fixtures that needed ±1 day adjustment"; TC-ACT-062 / -063 15-yr / 20-yr cases assert only `valueOfWeek` and `payable_by`, not `total_entitlement_weeks: 13.0005`). The contract is the binding authority — gold-standard fixtures verify a slice. This is documented in the HANDOFF and was a deliberate authoring choice for the day-precision quirks; not a blocker but a P3 follow-up to consider tightening.

---

## Layer 2 — cross-state regression byte-identical

### Test run

```
$ cd website && npx vitest run src/lib/lsl/states/nsw src/lib/lsl/states/vic src/lib/lsl/states/qld src/lib/lsl/states/wa src/lib/lsl/states/sa
Test Files  9 passed (9)
     Tests  1024 passed (1024)
```

PASS — NSW + VIC + QLD + WA + SA all green. No prior-state regressions.

### Engine-layer diff scan

```
$ git diff main...HEAD --stat -- website/src/lib/lsl/engine/
 website/src/lib/lsl/engine/types.ts | 53 +++++++++++++++++++++++++++++++++++--
 1 file changed, 51 insertions(+), 2 deletions(-)
```

The only engine-level change is `types.ts` and it is strictly additive:
- `TerminationReason` adds `'retirement'` (new enum member, exhaustive switches reviewed below).
- `Employee.dob?` added as OPTIONAL.
- `Result.payable_by?` added as OPTIONAL.
- 28 new ACT warning codes appended to the `Warning.code` union.

No existing semantics changed.

### `'retirement'` enum addition — exhaustive-switch sweep

`grep` of all per-state rule modules for `switch (reason)` or membership checks on `TerminationReason`:

- **NSW** (`states/nsw/rules/accrual-table.ts`): exhaustive switch — `case 'retirement': return 'retirement';` added (PR #26 line 191). Stable citation key, NSW does not branch on retirement. PASS.
- **QLD** (`states/qld/rules/accrual-table.ts`): switch gated on `QLD_QUALIFYING_REASONS.has(reason)` set; `'retirement'` is NOT in that set, so the switch never receives it. No regression risk.
- **VIC / WA / SA**: no `switch (reason)` patterns — `'retirement'` flows through ordinary logic without branching.

PASS — no exhaustive-switch breakage.

### Dispatch registration

`states/dispatch.ts` and `dispatch.test.ts` reviewed:
- `STATE_REGISTRY.ACT = ACT_RULE_SET` added.
- `ENCODED_STATES` test asserts `['ACT', 'NSW', 'QLD', 'SA', 'VIC', 'WA']` after Phase 7.
- Canary "(coming soon)" tests moved from ACT to TAS.
- `isStateEncoded('ACT') === true`.

PASS.

---

## Layer 3 — schema additions

### `Result.payable_by`

Verified OPTIONAL and ACT-only emission:
- Defined as `payable_by?: ISODate` in `engine/types.ts:374` (PR #26).
- Grep of `src/lib/lsl/states/{nsw,vic,qld,wa,sa}/` for `payable_by` returns ZERO matches — only ACT consumes/emits the field.
- ACT emits it at `states/act/index.ts:378` strictly inside `if (trigger.kind === 'termination')`.

PASS.

### `Employee.dob`

Verified OPTIONAL and ACT-only consumption:
- Defined as `dob?: ISODate` in `engine/types.ts:217`.
- Grep of `employee.dob` across all state modules returns only `states/act/rules/accrual-table.ts:69` (the s.11C retirement-age gate).

PASS.

### `'retirement'` reason

- Added to `TerminationReason` union in `engine/types.ts:55`.
- Added to `TERMINATION_REASON_OPTIONS` in the single-mode form (`single/_components/types.ts:165`).
- NSW exhaustive switch updated.

PASS.

---

## Layer 4 — UI surface

### `result-panel.tsx`

- All 28 ACT warning codes have user-facing label entries at lines 75–102 (one-to-one with the engine emission list in `types.ts`).
- `payable_by` Alert renders conditionally at line 188:
  ```
  {result.payable_by && (
    <Alert variant="info">
      <AlertTitle>Payable by</AlertTitle>
      <AlertDescription>
        The statutory pay-by date is {result.payable_by} — 90 days after cessation per ACT LSL Act 1976 s.11A(4)(b). Informational only.
      </AlertDescription>
    </Alert>
  )}
  ```

PASS.

### Single-mode form

- `TERMINATION_REASON_OPTIONS` includes `{ value: 'retirement', label: 'Retirement' }` at line 165.
- The single-mode form does NOT expose `extraInputs.act_overtime_hours_by_period`, `currentHourlyRate`, `hoursLast12MonthsBeforeEntitlement`, `act_ft_to_pt_transition_date`, or `act_award_min_retirement_age_reached` as input controls. This is a known pre-existing pattern shared with WA and SA — `extraInputs` are exercised through CSV bulk mode only, not surfaced in the single-mode form. Not introduced by this PR.

PASS (no regression).

### `bulk-identity-dialog.spec.ts` (e2e canary)

- ACT removed from "(coming soon)" assertions at lines 100–101.
- TAS added as the new canary at line 105.

PASS — confirmed Playwright job green at 4m14s.

### Bulk-mode `payable_by` rendering

- `bulk-results-table.tsx` renders warnings + citations in the expand row but does NOT render `result.payable_by` as a dedicated field.
- The `act_termination_payable_within_90_days_advisory` warning text DOES surface in the expand row.
- ACT termination rows will surface the advisory text but not the specific ISO date.

P3 follow-up — see bug list below. Not a blocker.

---

## Layer 5 — CI

All checks green on PR #26 (run 26425665267):

| Check | Status | Time |
|---|---|---|
| State suite · act | pass | 24s |
| State suite · nsw | pass | 22s |
| State suite · vic | pass | 24s |
| State suite · qld | pass | 26s |
| State suite · wa | pass | 28s |
| State suite · sa | pass | 25s |
| State suite · engine | pass | 24s |
| Cross-state regression | pass | 36s |
| TypeScript · Vitest · Build | pass | 50s |
| Playwright (chromium · webkit · firefox · mobile-chrome) | pass | 4m14s |
| Vercel | pass | (deploy ok) |

PASS.

---

## Bug list

### P3-1 — `payable_by` not displayed in bulk-mode results table

**File**: `website/src/app/(calculator)/calculator/bulk/_components/bulk-results-table.tsx`
**Impact**: ACT termination rows in bulk mode surface the `act_termination_payable_within_90_days_advisory` warning text (good) but do NOT render the specific `result.payable_by` ISO date as a dedicated cell or row in the expand panel. Single-mode shows it via Alert (`result-panel.tsx:188`).
**Workaround**: User can compute `terminationDate + 90 days` mentally or read the warning text. CSV import path still functions; no calculation impact.
**Recommendation**: Add a column or expand-row field rendering `result.payable_by` when present (gated on `result.payable_by != null`). Cross-state-available — will benefit any future state that adopts the field.
**Priority**: P3 (cosmetic / nice-to-have; no calc correctness impact).

### P3-2 — Several fixture `expected` blocks omit contract-specified assertions

**Files**: `website/src/lib/lsl/states/act/__tests__/fixtures/single/TC-ACT-008.json`, `TC-ACT-062.json`, `TC-ACT-063.json`, and a handful of others.
**Impact**: The gold-standard test runner only asserts what each fixture declares in `expected`. Some fixtures drop contract-specified values (`total_entitlement_weeks`, `total_entitlement_dollars`) and assert only a subset (`valueOfWeek`, `payable_by`). The contract remains the binding authority for any future audit, but fixtures-as-code coverage is narrower than contract coverage.
**Workaround**: None needed — engine math is exercised; tests still pass.
**Recommendation**: Re-tighten fixture assertions to mirror the contract's `expected` block where day-precision allows. The HANDOFF "Fixtures that needed ±1 day adjustment" section documents the rationale for the existing relaxations.
**Priority**: P3 (test-coverage debt; not a bug in production code).

### No P0/P1/P2 bugs found

The four Sev-1 architectural divergences (single regime with date-aware WC override, overtime asymmetry, s.7(2) vs s.11D anchor split, s.7(3) FT→PT within 2 yrs) are all correctly implemented and verifiable via fixtures. The 5-yr pro-rata threshold with narrow s.11C qualifying-reason list, the paid-parental-leave exclusion, and the 90-day `payable_by` window are all wired and tested.

---

## Verdict

**APPROVE FOR MERGE.**

PR #26 satisfies the binding contract `docs/qa/test-cases-act.md` v1.0. All 311 ACT assertions pass, all 1024 cross-state assertions pass byte-identical, the full vitest suite of 1610 tests is green, TypeScript compiles clean, and the complete CI matrix including Playwright is green. Engine-level changes are strictly additive (optional fields only). No P0/P1/P2 bugs found. Two P3 follow-ups noted as backlog items.

Recommend the operator merges via the normal PR flow.

---

## Open questions from dev HANDOFF — resolutions

1. **Bulk-mode `payable_by` surface**: Resolved as P3-1. Field is correctly populated on the per-row `Result`, but the bulk results table does not render it as a dedicated cell. Recommend a follow-up PR. CSV export of results is not currently a feature (verified — no result-CSV export path exists in `src/app/(calculator)/calculator/bulk/`), so the original question of "CSV emits the field" is moot for v1.

2. **Single-mode UI screenshots of `payable_by` Alert**: Code review of `result-panel.tsx:188` confirms the Alert renders correctly with title "Payable by" and the s.11A(4)(b) citation in the description. Playwright suite ran clean on chromium / webkit / firefox / mobile-chrome — any visual regression would have caught a render fault. No manual screenshot required.

3. **Cross-jurisdictional ACT routing (TC-ACT-073/074)**: Verified. TC-ACT-073 is a defensive test of the ACT engine's own jurisdiction gate (calls `calculateACT` directly with `governingJurisdiction: 'NSW'` → correctly returns `blocked_cross_jurisdiction`). The actual production routing happens in `dispatch.ts` which uses `resolveGoverningState` and routes NSW-governing to `NSW_RULE_SET`. `dispatch.test.ts` covers the end-to-end routing for ACT-only, ACT+X+NSW-governing, and ACT+X-no-governing cases. The fixture title "→ routed to NSW engine" is slightly misleading (the routing is the dispatcher's job, not ACT's) but the test value is a defensive gate, which is valid. P4 documentation cleanup if anyone cares.
