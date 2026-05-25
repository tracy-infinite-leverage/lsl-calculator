# QA Report — E2 Phase 4 QLD Engine (PR #13)

**Reviewer**: QA agent
**Date**: 2026-05-25
**Branch**: `e2-phase-4-qld` @ `696e490`
**Verdict**: **PASSES WITH NOTES**

---

## 1. NSW byte-identical regression — PASS (CRITICAL)

- `npx vitest run src/lib/lsl/states/nsw`: **153/153 pass**, ~502 ms.
- TC-NSW-024 (the load-bearing $9,880.04 fixture) verified — 8 sub-assertions all pass:
  - `valueOfWeek: "950.00"`
  - `totalEntitlementDollars: "9880.04"` — EXACT preserved
  - Citations + warnings membership intact
- `engine/types.ts` diff is purely additive — 10 new QLD warning codes appended to the `Warning.code` union. Zero existing codes removed or renamed.
- `result-panel.tsx` diff is purely additive — 10 new QLD label entries appended to `WARNING_LABELS`. Zero existing labels touched.
- `dispatch.ts` diff: one import + one registry entry + one comment update. NSW + VIC entries unchanged.

## 2. VIC byte-identical regression — PASS (CRITICAL)

- `npx vitest run src/lib/lsl/states/vic`: **170/170 pass** across 61 fixtures (58 single + 3 bulk), ~555 ms.
- VIC cash-out semantics preserved: TC-VIC-050/051/052/053 still `status: failed` with `error.code: vic_cashout_prohibited`.
- Cross-state regression sanity check (TC-QLD-BULK-003) confirms VIC cash-out row still returns `failed` while QLD cash-out rows return `computed` — architectural divergence working as intended on both sides.

## 3. QLD fixture pass rate — PASS

- `npx vitest run src/lib/lsl/states/qld`: **179/179 sub-assertions pass** across 55 fixtures (52 active single + 3 bulk).
- Full suite: **697/697** unit tests pass across 26 test files.
- TypeScript clean (`npx tsc --noEmit`).
- ESLint clean on `src/lib/lsl/states/qld`.
- Production build clean (`npm run build` — 10 static pages, no errors).
- Deferred (per PM-signed test-cases-qld.md): TC-QLD-005, -007, -008, -015, -016 — not built and correctly absent from the fixtures folder. Total 57 listed minus 5 deferred = 52 active single. Matches.
- No `.skip` / `.todo` / `xit` anywhere in QLD test code.

## 4. TC-QLD-013 calibration assessment — ACCEPTABLE (P3 doc follow-up)

The fix shifts the startDate from `2019-05-26` → `2019-05-27` (+1 day) so the fixture sits at the intended "sub-7-yr cliff".

**Manual calculation** (using the engine's `inclusiveDays / 365.25` convention from `engine/dates.ts:25,47`):

| startDate | endDate | inclusiveDays | years | Verdict |
|---|---|---|---|---|
| 2019-05-26 (original) | 2026-05-25 | 2,557 | 7.000684 | **Crosses 7-yr cliff** — would qualify |
| 2019-05-27 (calibrated) | 2026-05-25 | 2,556 | 6.997947 | 1 day under 7 yrs — does NOT qualify |

The fixture's intent ("6 yrs 364 days → $0") only holds with the +1 day shift. This is a **test-case authoring bug**, not an engine bug. The engine's `yearsOfContinuousService = inclusiveDays / 365.25` arithmetic (`continuous-service-rules.ts:274,290-291`) matches NSW + VIC exactly — same approach used for TC-VIC-017 (Phase 3) and TC-NSW-024.

**Doc drift**: `docs/qa/test-cases-qld.md` TC-QLD-013 section still references the original `2019-05-26` startDate. Same precedent as VIC — should be amended in a follow-up doc PR. **P3**.

## 5. Cash-out advisory (architectural divergence from VIC) — PASS

QLD cash-out is NOT a hard error. Verified across the 3 cash-out fixtures + 1 bulk row:

| Fixture | Tenure | Expected status | Expected warnings | Citation |
|---|---|---|---|---|
| TC-QLD-049 | 12 yrs | `computed`, valueOfWeek $1,800 | `qld_cashout_requires_instrument_or_qirc` only | s.110, s.95(2)(a), s.98 |
| TC-QLD-050 | 8 yrs | `computed`, valueOfWeek $1,700 | `qld_cashout_requires_instrument_or_qirc` + `sub_10yr_cashout_only_via_qirc_qld` (stronger) | s.110 |
| TC-QLD-051 | 5 yrs | `computed`, $0 entitlement | `sub_7yr_no_entitlement_qld` + `qld_cashout_no_entitlement_to_cash_out` + `qld_cashout_requires_instrument_or_qirc` | s.95(3), s.110 |

All 3 pass with full sub-assertion coverage. Implementation at `states/qld/index.ts:219-243` matches the test-case ladder: base advisory always, sub-10-yr adds QIRC-only escalation, sub-7-yr adds no-entitlement notice. Citation s.110 in every path.

**Bulk TC-QLD-BULK-003** (mixed cash-out): summary `{computed: 4, blocked: 0, failed: 1}` — QLD cash-out rows compute alongside valid rows; VIC cash-out row alone returns `failed` with `vic_cashout_prohibited`. Confirms per-row fault isolation works across the QLD/VIC architectural divergence.

## 6. Casual cliff (s.103) handling — PASS

- **TC-QLD-036** (casual starting 1992-05-25 → as-at 2026-05-25):
  - `valueOfWeek: "1280.00"` exact match
  - Warning code `pre_1994_casual_cliff_qld` emitted
  - Citation `QLD IR Act 2016 s.103` with rule `continuous-service.casual-cliff-30mar1994`
  - Service effectively anchored to 1994-03-30 per the engine's `continuous-service-rules.ts` cliff logic.
- **TC-QLD-037** (permanent FT starting 1992-05-25 — control case): no `pre_1994_casual_cliff_qld` warning, full service counted — confirms the cliff is **casual-only**.
- **TC-QLD-035** (pre-1990 permanent FT starting 1985-07-01): `pre_1990_service_advisory_qld` emitted with `s.96` citation; service still counts (advisory only, not anchored).

## 7. WC rate handling (TBD-QLD-05 literal s.98) — PASS

- **TC-QLD-029** (FT with active workers_comp_absence overlapping as-at date 2026-05-25):
  - Pre-injury rate `$1,800.00` (in `extraInputs.preInjuryWeeklyRate`) vs current `$1,500.00`
  - Engine returns `valueOfWeek: "1500.00"` — uses the literal WC-reduced rate, not the pre-injury rate
  - Warning `qld_lsl_calculated_at_wc_reduced_rate_warning` fires per `states/qld/index.ts:254-262`
  - Citations include s.98 (`ordinary-pay.ordinary-rate-at-leave-time`) + s.134 (`continuous-service.workers-comp-counts`)
  - Advisory text explicitly notes "QLD has no statutory higher-of-rates equivalent to VIC s.17" — matches the legal interpretation captured in test-cases-qld.md
- Engine matches the PM-signed legal call. QA does not second-guess the call, only confirms engine ↔ test-case alignment.

## 8. Misconduct flip at 10-yr boundary — PASS

| Fixture | Tenure | Reason | Outcome | Confirms |
|---|---|---|---|---|
| TC-QLD-014 | 9 yrs FT | `serious_misconduct` | `$0`, warning `sub_10yr_misconduct_excluded_qld`, citation s.95(3)(d) | Sub-10-yr misconduct excluded |
| TC-QLD-021 | 12 yrs FT | `redundancy` (control) | full payout, citation s.95(2)(a) `accrual.10yr-automatic-any-reason` | 10+yr full payout baseline |
| TC-QLD-022 | 12 yrs FT | `serious_misconduct` | full payout, citation s.95(2)(a) `accrual.10yr-automatic-any-reason-incl-misconduct` | 10+yr **misconduct DOES NOT exclude** — QLD's divergence from NSW/VIC |

The opposite outcomes confirm the 10-yr boundary inversion is correctly implemented.

## 9. Dispatcher routing — PASS

- `STATE_REGISTRY` in `dispatch.ts:27-33` has NSW + VIC + QLD entries.
- `ENCODED_STATES` derived from `Object.keys(STATE_REGISTRY)` — single source of truth.
- `dispatch.test.ts`: **14/14 pass** including a dedicated `'routes QLD-only employee to QLD orchestrator'` test and `'contains NSW, VIC, and QLD after Phase 4'`.
- `isStateEncoded('QLD')` returns `true`; `isStateEncoded('WA')`, `isStateEncoded('NT')` return `false`.
- WA/SA/ACT/TAS/NT employees still return `status: blocked_cross_jurisdiction` with `cross_jurisdiction_pending` warning.

## 10. CI matrix update — PASS

- `.github/workflows/ci.yml` diff verified:
  - Line 63 matrix updated `[nsw, vic, engine]` → `[nsw, vic, qld, engine]`
  - Cross-state-regression script appends `STATUS_QLD` and the QLD shard, plus updates the failure gate to include QLD.
- Live PR #13 check `State suite · qld` reports **pass** (28s, run 26380018387).
- All other shards green: `State suite · nsw` pass, `State suite · vic` pass, `State suite · engine` pass, `Cross-state regression` pass, `TypeScript · Vitest · Build` pass.
- Playwright matrix job currently `pending` (was still in queue at observation time). Not a blocker — TS, Vitest, and per-state shards all green.

## 11. State selector auto-pickup — PASS

- `single-mode-form.tsx` and `bulk-identity-dialog.tsx` are NOT in the PR diff — confirmed via `git diff main..HEAD --stat`.
- Yet `isStateEncoded('QLD')` now returns `true` because `dispatch.ts` registered QLD.
- `e2e/bulk-identity-dialog.spec.ts` Playwright regression updated:
  - Asserts QLD appears as a clean option (no "(coming soon)" suffix)
  - Asserts the new canary is WA (proves the strip didn't go too wide)
- The decoupled-selector pattern from PR #11 holds: shipping a new engine + flipping the registry is sufficient for the UI to pick it up. No UI code touched.

## 12. Browser smoke — NOT RUN

Skipped per the brief's "optional" framing. The per-state CI shards + the explicit `isStateEncoded` test coverage + the Playwright bulk-dialog spec update provide adequate signal that the selector picks up QLD automatically. The Vercel preview deployment for PR #13 is green per `gh pr checks 13` — operator can manually smoke-test the preview URL if desired.

## 13. Bugs found

| # | Severity | Item | File / area | Notes |
|---|---|---|---|---|
| B1 | **P3** | `docs/qa/test-cases-qld.md` TC-QLD-013 entry still shows `startDate: 2019-05-26`; fixture and engine confirm intent requires `2019-05-27`. | `docs/qa/test-cases-qld.md` TC-QLD-013 section | Doc-only drift. Same pattern as TC-VIC-017 in Phase 3. Update in a follow-up doc PR; not a release blocker. |

**No P0/P1/P2 bugs found.**

---

## Branch state

- **Start**: `e2-phase-4-qld` @ `696e490`. Working tree clean except `website/.claude/` (untracked, ignored per brief).
- **End**: `e2-phase-4-qld` @ `696e490`. No code changes. This QA report is the only new file (`docs/engineering/changes/2026-05-25-e2-phase-4-qld-engine/QA-REPORT.md`).
- No commits made. No push made. Operator handles git from here.

## Test evidence summary

| Suite | Result | Sub-assertions |
|---|---|---|
| NSW gold-standard | PASS | 153/153 |
| VIC gold-standard + bulk | PASS | 170/170 |
| QLD gold-standard + bulk | PASS | 179/179 |
| dispatch.test.ts | PASS | 14/14 |
| **Full unit suite (26 files)** | **PASS** | **697/697** |
| TypeScript | clean | — |
| ESLint (QLD source) | clean | — |
| Production build | clean | 10 static pages |
| CI on PR #13 | green | all state shards + TS/Vitest/Build pass |

## Verdict

**PASSES WITH NOTES.** The QLD engine ships per spec: 179/179 sub-assertions across 55 fixtures, NSW + VIC byte-identical preserved, full 697/697 unit suite green, TS + lint + build clean, CI matrix updated and green on PR #13. The architectural divergences (cash-out advisory vs VIC hard error; 10+yr misconduct full payout vs NSW/VIC exclusion; literal s.98 WC rate) are all correctly implemented and match the PM-signed test cases. The state selector picks up QLD automatically per the PR #11 decoupled pattern.

Only finding is the P3 doc drift on TC-QLD-013 — not a release blocker, file a follow-up.

This QLD pattern is now the standard per-state shipping pattern. Quality bar met.
