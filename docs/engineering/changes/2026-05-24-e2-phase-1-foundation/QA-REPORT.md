# QA Report — E2 Phase 1 (Foundation for All-State Coverage)

**Date**: 2026-05-24
**Branch**: `e2-phase-1-foundation` (HEAD `c785941`, base `main` @ `50061f5`)
**PR**: [#8](https://github.com/tracy-infinite-leverage/lsl-calculator/pull/8)
**Scope**: Phase 1 only — infrastructure for multi-state rollout. No state-specific code beyond NSW.
**Result**: **PASSES WITH NOTES** — no code regressions; merge-blockers are environmental (PR-level merge conflict + CI not yet triggered on PR).

---

## TL;DR

The load-bearing claim — **NSW byte-identity post-refactor** — is verified directly. 153/153 NSW gold-standard tests pass with **exact** expected values including the canonical TC-NSW-024 → `$9,880.04` case, and the same Playwright check passes against both the dev bundle and the production bundle. Engine, dispatcher, telemetry helper, and CI matrix workflow are all clean. State selector component is genuinely invisible — not referenced from any page, and the `NEXT_PUBLIC_STATE_SELECTOR_ENABLED` flag defaults to off. Three issues to flag (none block customer behaviour):

- **P1 (merge-blocker, not behavioural):** PR #8 is `CONFLICTING` against `main` — `docs/product/epic-status.md` was rewritten on `main` by PR #6 and now conflicts with this branch's older copy. Must be resolved before merge.
- **P1 (visibility):** No GitHub Actions runs are present for this branch — only Vercel checks show on the PR. CI may simply be late (PR was 5 min old at scan time) but warrants confirmation. The new `state-matrix` and `cross-state-regression` jobs have not yet had a real on-PR run.
- **P3 (doc):** Handoff doc and PR body claim 11 dispatch tests + 12 selector-helper tests; the actual file counts are 10 and 13. Net new tests still reconciles to +25 against the 319 baseline, so the headline 344/344 figure is correct. Minor.

Two observations worth noting but not raised as bugs:

- The bulk-mode row-recalculation handler (`bulk-mode-form.tsx:244`) and the single-mode form (`single-mode-form.tsx:119`) still call `calculateNSWSafe` / `calculateNSW` directly rather than `dispatch.calculateSafe` / `dispatch.calculate`. T1.7 was marked "partial" in the handoff and the bulk-runner main path was switched (the high-throughput case), so this is intentional scope-trimming, not a regression. Behaviour is identical for NSW today.
- A `Select is changing from uncontrolled to controlled` browser warning surfaces during Playwright runs. I verified on `main` — it is **pre-existing** and not introduced by this PR.

---

## 1. Branch state

| Checkpoint | Value |
|---|---|
| Branch at start | `e2-phase-1-foundation` |
| HEAD at start | `c785941` |
| Working tree | clean (only `website/.claude/` untracked — ignored per scope) |
| Branch at end | `e2-phase-1-foundation` |
| HEAD at end | `c785941` |
| Code changes by QA | none |
| Commits by QA | none |

---

## 2. NSW byte-identical regression — CRITICAL

> The single most important Phase 1 verification.

**Verdict: PASS — byte-identical.**

Evidence:

```bash
cd website
ANTHROPIC_API_KEY=test npx vitest run src/lib/lsl/states/nsw/__tests__/gold-standard.test.ts
# Test Files  1 passed (1)
# Tests       153 passed (153)
```

Spot-checked the load-bearing $9,880.04 case directly in the run output:

```
✓ TC-NSW-024 — 12-yr casual-to-FT — $9,880.04 EXACT (AC25 / SC3 / AC6) > status matches
✓ TC-NSW-024 > category = A
✓ TC-NSW-024 > years of continuous service = 12.0000
✓ TC-NSW-024 > value of week = $950.00
✓ TC-NSW-024 > value of day = $190.00
✓ TC-NSW-024 > total entitlement weeks = 10.4000
✓ TC-NSW-024 > total entitlement = $9880.04
```

Also spot-checked:

- TC-NSW-001 (Alicia, 5.75-yr pro-rata) → `total entitlement = $7474.36` ✓
- TC-NSW-040 (65-wk UPL — no cap; days excluded both ledgers) ✓
- TC-NSW-044 (rehire gap exactly 60 days — at boundary) ✓
- TC-NSW-046 (JobKeeper counts as service, excluded from lookback denom) ✓
- TC-NSW-053 (NSW nominated as governing for NSW+VIC service) ✓

**End-to-end browser check**: the `single-mode.spec.ts:10` Playwright test (which drives the actual form to produce $9,880.04 via the React UI) passes against **both** the dev bundle and the production bundle. This is the same test that has protected the load-bearing dollar figure since Phase 3 of E1.

**Refactor integrity** — I inspected the diff to `engine/continuous-service.ts` and confirmed:

1. The old hardcoded `SERVICE_EVENT_RULES` table moved verbatim to `states/nsw/continuous-service-rules.ts` as `NSW_SERVICE_PROFILE`.
2. The `transfer_of_business` dual-citation (s.4(6) + s.4(11)) is preserved via the new optional `ServiceEventRule.extraCitations` field. The inline lines that emit both citations in the new code (`continuous-service.ts:155-163`) are wired through the profile.
3. `computeContinuousService` and `computeDaysNotCountedInLookback` both now accept a `profile` argument; NSW callers pass `NSW_SERVICE_PROFILE`. Existing 17 continuous-service unit tests were updated to pass the profile and all pass.

---

## 3. Test results

| Suite | Count | Pass | Fail | Duration |
|---|---|---|---|---|
| Vitest — full | 344 / 22 files | 344 | 0 | 1.63s |
| Vitest — NSW gold-standard subset | 153 | 153 | 0 | 524ms |
| Vitest — dispatcher | 10 | 10 | 0 | 512ms |
| Vitest — bulk-runner + continuous-service | 23 | 23 | 0 | 508ms |
| Playwright — dev bundle (chromium) | 23 | 23 | 0 | 6.2s |
| Playwright — production bundle (chromium, `PLAYWRIGHT_PRODUCTION_BUILD=1`) | 23 | 23 | 0 | 7.6s |
| `npx tsc --noEmit` | — | clean | — | — |
| `npm run build` (Turbopack, Next 16.2.6) | — | 10/10 static pages | — | ~3.1s |

Net new tests: **+25** (10 dispatch + 13 selector-helpers + 2 track = 25). Matches handoff's +25 against 319 baseline → 344 total.

Discrepancy: per-file counts in the handoff document say 11 dispatch + 12 selector-helpers. Real counts are 10 + 13. P3 doc bug — does not affect any behavioural claim.

---

## 4. Dispatcher contract assessment

**Verdict: CLEAR. Contract is well-designed and tests cover the right edges.**

`dispatch.ts` is a thin, defensible orchestrator:

- `STATE_REGISTRY: Partial<Record<State, StateRuleSet>>` — type-safe lookup keyed on the canonical `State` union; unshipped states are explicitly absent, not undefined placeholders.
- `ENCODED_STATES` is derived from `STATE_REGISTRY` keys (single source of truth for what the calculator supports today). Test asserts `ENCODED_STATES === ['NSW']`.
- `calculate` and `calculateSafe` are byte-identical for the NSW happy path (asserted in dispatch.test.ts:46 with `expect(fromDispatch).toEqual(fromDirect)`).
- `resolveGoverningState` precedence: explicit `governingJurisdiction` → single-element `statesOfService[0]` → fallback NSW. The fallback preserves v1 single-mode user behaviour.
- Unshipped-state path returns `status: 'blocked_cross_jurisdiction'` + `warnings[0].code = 'cross_jurisdiction_pending'` with a user-facing message listing currently-supported states.
- `calculateSafe` does NOT throw on unshipped states or on `cash_out` — asserted directly.

Tests cover:

| Edge | Covered? |
|---|---|
| NSW happy path | ✓ (byte-identical to `calculateNSW`) |
| Explicit `governingJurisdiction = NSW` for multi-state employee | ✓ |
| Unshipped governing state (VIC) | ✓ |
| Single non-NSW state with no governing | ✓ |
| No states, no governing → falls back to NSW | ✓ |
| `calculateSafe` returns failed (not throws) on `cash_out` | ✓ |
| `calculateSafe` blocks unshipped (WA) without throwing | ✓ |
| `extraInputs` passthrough | **NOT directly asserted** (see note below) |

**Note:** `extraInputs` passthrough is not asserted by a dedicated dispatcher test, but the field is just a passive field on `Employee`; the dispatcher passes the whole `employee` object through to `ruleSet.calculate(employee, trigger)`, so structural pass-through is automatic. No bug — but Phase 3 (VIC) will be the first state to actually consume `extraInputs`, and a regression test should land then.

**Bulk-runner swap**: confirmed via direct diff inspection of `bulk-runner.ts` — single-line import swap (`calculateNSWSafe` → `calculateSafe`). The 23 bulk-runner + continuous-service tests still pass; bulk-mode user output is unchanged.

---

## 5. `cash_out` trigger handling

**Verdict: CLEAN — fail-safe path is exhaustive and user-friendly.**

Layered defence:

| Layer | Behaviour |
|---|---|
| `engine/types.ts` | Adds `{ kind: 'cash_out'; cashOutDate: ISODate }` to the `Trigger` union — TS exhaustiveness propagates everywhere. |
| `engine/trigger.ts → prescribedDate` | New `case 'cash_out'` throws `CashOutNotSupportedError('shared engine')` — defensive; reached only on programmer error because the per-state orchestrator should short-circuit first. |
| `engine/errors.ts → CashOutNotSupportedError` | Friendly user message: `"Cashing-out is not supported for ${state} in this version. VIC and NT will implement cashing-out hard-error handling in a later release; other states either disallow cashing-out outright or do not yet have it encoded."` Code: `cash_out_not_supported`. No raw stack trace. |
| `states/nsw/index.ts → calculateNSW` | Explicit short-circuit at line 138 — `if (trigger.kind === 'cash_out') throw new CashOutNotSupportedError('NSW')`. |
| `states/nsw/index.ts → calculateNSWSafe` | Catches `CashOutNotSupportedError` and returns `{ status: 'failed', error: { code: 'cash_out_not_supported', userMessage } }`. |
| `states/nsw/rules/trigger-handlers.ts` | Switch exhausts `cash_out` (returns `[]`, defensive — never reached). |
| `states/nsw/rules/accrual-table.ts` | `payableWeeks` initialised to zero (TS strict-mode definite-assignment fix introduced by the new variant — no behavioural change). |

Dispatcher test (`dispatch.test.ts:99-105`) asserts directly that the bulk-mode entry point returns a `failed` Result with `error.code === 'cash_out_not_supported'` rather than throwing.

No `cash_out` paths are silently swallowed. The single-mode form has no `cash_out` UI today (correct — NSW doesn't support it), so the user can't actually generate this trigger from the form. The error surface exists for future bulk-mode CSV rows / API callers.

---

## 6. Telemetry sanity check

**Verdict: CLEAN — taxonomy correct, PII guarded, env-var gate working.**

- `stateEventName('NSW', 'calculated') === 'nsw_calculated'` ✓
- `stateEventName('NSW', 'pdf_extracted') === 'nsw_pdf_extracted'` ✓
- Lowercased state segment with verbatim event-name segment is asserted across five state codes (`NSW`, `VIC`, `NT`, `WA`, `ACT`) in `track.test.ts`.
- PII guard: `trackStateEvent` only accepts `Record<string, string | number | boolean | null>` and the docstring explicitly forbids `employee_id` / wages / dates. No PII leaks at the type level. PII still scrubbed per existing `track()` discipline.
- Env-var gate: `if (process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === 'false') return;` — confirmed at `track.ts:91`. Default (env unset) means telemetry fires; setting to `'false'` no-ops the call.
- Server no-op: `if (typeof window === 'undefined') return;` — confirmed.
- Failure isolation: wrapped in `try/catch` with `console.warn` — analytics failures never crash the calc UX. Pre-existing pattern, retained.

`trackStateEvent` is **defined but not yet called by any production code**. That's expected per the handoff — Phase 3 (VIC) will be the first consumer. Shipping the helper now keeps the taxonomy locked in before two states have to retrofit.

---

## 7. Feature-flag isolation

**Verdict: CLEAN — state selector is invisible.**

| Check | Result |
|---|---|
| `NEXT_PUBLIC_STATE_SELECTOR_ENABLED` default | unset → `STATE_SELECTOR_ENABLED === false` (off) |
| `<StateSelector>` imported by any page or production component | **No.** `grep -rn "state-selector\|StateSelector" src/app src/components/lsl` returns only the component's own files and its tests. |
| `<StateSelector>` rendered by single-mode form | No — `single-mode-form.tsx` doesn't import it. |
| `<StateSelector>` rendered by bulk-mode form | No — `bulk-mode-form.tsx` doesn't import it. |
| Console warnings/errors from un-rendered component | None (component is never instantiated, so no React lifecycle to log from). The pre-existing `Select is changing from uncontrolled to controlled` warning I observed during Playwright is **unrelated** — it's present on `main` too, in PDF preview / existing `Select` usage. |
| Visual diff vs production NSW | No new UI elements — diff to `single-mode-form.tsx` is zero; only `form-to-engine.ts` was touched (auto-populate `governingJurisdiction` from `statesOfService[0]` when single-state — strictly additive). |
| Localstorage namespace pollution | The component would write to `lsl:recent-states` only on user pick — since nobody renders it, no localStorage writes happen. |

Operator will see exactly the existing NSW UX. ✓

---

## 8. CI matrix workflow assessment

**Verdict: STRUCTURE CLEAN — but the workflow has not yet executed on this PR (visibility gap, see §11 P1 finding).**

Static review of `.github/workflows/ci.yml`:

- **`state-matrix` job**: `matrix.state: [nsw, engine]`, `fail-fast: false`. Each shard runs `npx vitest run src/lib/lsl/states/${state}` or `src/lib/lsl/engine` (the engine special-case is correctly conditional on `matrix.state == 'engine'`). Working-directory pinned to `website`. ANTHROPIC_API_KEY placeholder set. Adds a step-summary line with shard duration. Pattern is extensible — adding VIC is a one-line matrix append.
- **`cross-state-regression` job**: `if: github.event_name == 'pull_request'`. Computes engine_touched via `git diff` between merge-base and HEAD, filtering on `^website/src/lib/lsl/engine/`, `^website/src/lib/lsl/dispatch\.ts$`, and any `^website/src/lib/lsl/states/[^/]+/continuous-service-rules\.ts$`. If touched: install + ci. If not: skip and echo a message. Posts a per-suite pass/fail table to the step summary. `set -e` ensures the script exits 1 if either NSW or engine suite fails. The grep regex correctly matches the new dispatch.ts and any future `continuous-service-rules.ts` per state.
- **Existing `test` and `playwright` jobs retained as backstops** — unchanged from main.
- **`concurrency: ci-${{ github.ref }}` + `cancel-in-progress: true`** preserved — clean.

What I did **not** verify (deliberately, per "let the PR's own CI run prove it works"):

- That `state-matrix` actually green-completes both shards on Actions runners.
- That `cross-state-regression` correctly detects this PR as engine-touching (it should — `dispatch.ts` is added).
- That the step-summary table renders.

**However** — see §11 — at the time of QA, **no Actions runs are visible for this branch**, despite the workflow being on it. Operator should confirm CI actually runs once the merge conflict is resolved.

---

## 9. Browser-verified findings (axe + visual regression)

**Verdict: CLEAN — no a11y regressions; no new UI to verify.**

Local Playwright dev-mode results include the 6 a11y specs against landing, single-mode, bulk-mode, privacy, single-mode PDF preview dialog, and bulk-mode preview state — all pass axe-core. These are the same Q-01 regression-protection tests that PR #3 added. **Zero critical axe violations.**

Vercel preview deploy is **auth-protected (401 on direct curl)** so I could not run a live remote-browser axe scan. However:

1. The single-mode UI diff in this PR is exactly one file — `form-to-engine.ts`, a pure data-transform helper. The form's JSX (`single-mode-form.tsx`) was not modified.
2. The local Playwright production-bundle (`PLAYWRIGHT_PRODUCTION_BUILD=1`) covers the same Next-built artifact that Vercel serves. All 23 tests pass against it, including the 6 axe specs.
3. `<StateSelector>` is not rendered anywhere, so no new DOM nodes exist to scan.

Visual regression vs production NSW: confirmed via diff inspection — no changes to any rendered component. Operator will not see a new selector or any visual change.

---

## 10. Bugs found

### QA-E2P1-01 · PR is in `CONFLICTING` state against `main`

| Field | Value |
|---|---|
| Classification | regression (against merge process, not user behaviour) |
| Severity | 4 (blocks merge) |
| Frequency | 5 (deterministic) |
| Blast radius | 1 (only this PR) |
| **Score** | **20 → P2** |

**Reproduction**: `gh pr view 8 --json mergeable,mergeStateStatus` → `"mergeable":"CONFLICTING","mergeStateStatus":"DIRTY"`.

**Cause**: `docs/product/epic-status.md` on `main` was rewritten by PR #6 (`dadc2e0`) ~25 minutes before this PR opened to mark E1 SHIPPED + advance E2 to in-flight. This branch's older copy still has the pre-ship text. The handoff acknowledged this risk and resolved it on cherry-pick with a placeholder line that no longer matches main.

**Route**: developer — rebase or merge-resolve `epic-status.md`, keep the main version's E1 SHIPPED text, layer the E2 Phase 1 update on top.

**Note**: I flagged this as P2 not P1 because the bug exists at the GitHub-PR layer, not the runtime layer — every line of shippable code is correct. Treat it as merge hygiene, not as a defect.

### QA-E2P1-02 · No GitHub Actions runs visible for the branch

| Field | Value |
|---|---|
| Classification | new-defect (CI visibility) |
| Severity | 3 (we don't know if `state-matrix` / `cross-state-regression` actually pass on runners) |
| Frequency | unknown (1 sample) |
| Blast radius | 1 (this branch) |
| **Score** | **9 → P3** |

**Reproduction**:

```
gh run list --branch e2-phase-1-foundation   # empty
gh api "repos/.../actions/runs?branch=e2-phase-1-foundation"   # total_count: 0
gh pr checks 8   # only Vercel + Vercel Preview Comments
```

PR was 5 min old at scan; prior PRs (`chore/epic-status-nsw-shipped`, `phase-3-pdf-followup`) trigger CI within ~30 s. Most likely cause is benign — CI just hadn't woken up. Could also be:

- GitHub queue delay (transient — wait).
- Branch-protection-list mismatch (worth a check).
- Branch was pushed via an actor or path that suppresses Actions (unlikely given other branches work).

**Route**: operator confirms CI eventually runs after merge-conflict resolution + push. If it still doesn't trigger, escalate to devops.

### QA-E2P1-03 · Handoff doc undercounts/overcounts new tests per file

| Field | Value |
|---|---|
| Classification | new-defect (documentation) |
| Severity | 1 (cosmetic) |
| Frequency | 1 (single doc) |
| Blast radius | 1 (handoff) |
| **Score** | **1 → P3** |

**Reproduction**: handoff line 113-116 says "dispatch.test.ts — 11 tests" and "state-selector-helpers.test.ts — 12 tests". Real counts are 10 and 13 respectively. Net new = 25 (matches). PR body §"Test results" repeats the 11-test figure.

**Route**: developer — one-line edit to handoff + PR body. Or just leave it — totals reconcile.

---

## 11. Overall verdict

**PASSES WITH NOTES.**

Every behavioural claim the developer made is verified:

- ✓ 153/153 NSW gold-standard byte-identical (including TC-NSW-024 $9,880.04)
- ✓ 344/344 unit tests, 22 files
- ✓ 23/23 Playwright dev bundle + 23/23 production bundle
- ✓ Typecheck + build clean
- ✓ Dispatcher contract solid
- ✓ `cash_out` fail-safe chain layered correctly
- ✓ Telemetry helper taxonomy correct, PII-safe, env-var gated
- ✓ State selector genuinely invisible (no imports outside its own files/tests)
- ✓ CI matrix workflow structure clean

The two real flags are environmental and not behavioural:

1. The PR is `CONFLICTING` — a `docs/product/epic-status.md` merge resolution is required before merge. Fast fix.
2. CI has not yet executed on this branch as of QA scan. Likely benign (5-minute-old PR + queue) but operator should confirm before merging.

Phase 1 ships **zero customer-visible change** and **zero NSW behavioural change**. Safe to merge after the conflict is resolved and CI proves green on the runners.

---

## 12. Files

| Artifact | Path |
|---|---|
| QA report (this doc) | `docs/engineering/changes/2026-05-24-e2-phase-1-foundation/QA-REPORT.md` |
| Handoff | `docs/engineering/changes/2026-05-24-e2-phase-1-foundation/HANDOFF.md` |
| Spec | `.specify/features/002-all-state-coverage/spec.md` v0.3.0 |
| Impl-plan | `.specify/features/002-all-state-coverage/impl-plan.md` §1 |
| Tasks | `.specify/features/002-all-state-coverage/tasks.md` §1 T1.1–T1.10 |
| PR | https://github.com/tracy-infinite-leverage/lsl-calculator/pull/8 |
