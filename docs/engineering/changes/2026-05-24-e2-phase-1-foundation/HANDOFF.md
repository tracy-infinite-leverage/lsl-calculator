# Handoff — E2 Phase 1 (foundation for all-state coverage)

**Date**: 2026-05-24
**Branch**: `e2-phase-1-foundation` (cut from `main` at `50061f5`)
**Author**: developer agent
**Status**: feature-complete on Phase 1 scope; ready for PR + operator review
**Source spec / plan / tasks**: `.specify/features/002-all-state-coverage/{spec.md, impl-plan.md, tasks.md}` (cherry-picked onto this branch from the original `002-all-state-coverage` branch, which carried 38 pre-squash NSW commits and was unsuitable for a clean PR)

---

## What landed

Foundation infrastructure for the upcoming 7-state rollout (VIC → QLD → WA → SA → ACT → TAS → NT, per RES-1). **No state-specific code in this PR.** Every new state in Phases 3-9 will:

1. Implement the `StateRuleSet` interface (now defined).
2. Register itself in `dispatch.ts`'s `STATE_REGISTRY` and add itself to `ENCODED_STATES`.
3. Ship its own `continuous-service-rules.ts` profile (the engine no longer hardcodes NSW values).
4. Add its name to the CI matrix in `.github/workflows/ci.yml`.

NSW behaviour is byte-identical pre-/post-refactor — see Parity Check below.

### Files created

- `website/src/lib/lsl/states/StateRuleSet.ts` — the `StateRuleSet` interface (T1.1)
- `website/src/lib/lsl/states/nsw/continuous-service-rules.ts` — `NSW_SERVICE_PROFILE` extracted from `engine/continuous-service.ts` (T1.3)
- `website/src/lib/lsl/states/extra-inputs.md` — per-state extra-inputs convention (T1.2 + P0.6)
- `website/src/lib/lsl/dispatch.ts` — single entry point with `calculate`, `calculateSafe`, `ENCODED_STATES`, `isStateEncoded` (T1.4)
- `website/src/lib/lsl/dispatch.test.ts` — 11 unit tests covering happy path, blocked, cash_out fail-safe (T1.4)
- `website/src/components/lsl/state-selector.tsx` — accessible state picker with LRU recent-3 chips, feature-flagged via `NEXT_PUBLIC_STATE_SELECTOR_ENABLED` (T1.6)
- `website/src/components/lsl/state-selector-helpers.ts` — pure helpers extracted for vitest (no DOM) (T1.6)
- `website/src/components/lsl/state-selector-helpers.test.ts` — 12 unit tests on the LRU / parse logic (T1.6)
- `website/src/lib/observability/track.test.ts` — taxonomy assertion (T1.8)
- `docs/engineering/changes/2026-05-24-e2-phase-1-foundation/HANDOFF.md` — this doc

### Files modified

- `website/src/lib/lsl/engine/types.ts`
  - Added `Employee.extraInputs?: Record<string, unknown>` (T1.2 / P0.6)
  - Added `Trigger` variant `{ kind: 'cash_out'; cashOutDate: ISODate }` (R2)
- `website/src/lib/lsl/engine/errors.ts`
  - Added `CashOutNotSupportedError extends EngineError` with code `cash_out_not_supported` (R2)
- `website/src/lib/lsl/engine/trigger.ts`
  - `prescribedDate` switch exhausts new `cash_out` case by throwing `CashOutNotSupportedError`
- `website/src/lib/lsl/engine/continuous-service.ts`
  - Extracted NSW-specific constants into new `ContinuousServiceProfile` interface
  - `computeContinuousService` and `computeDaysNotCountedInLookback` now accept a `profile` argument
  - Added `ServiceEventRule.extraCitations?` for NSW's `transfer_of_business` dual-citation requirement (preserves byte-identity)
- `website/src/lib/lsl/engine/continuous-service.test.ts`
  - All 17 unit tests updated to pass `NSW_SERVICE_PROFILE`
- `website/src/lib/lsl/states/nsw/index.ts`
  - Imports `NSW_SERVICE_PROFILE`, passes it to `computeContinuousService`
  - Short-circuits `cash_out` trigger with `CashOutNotSupportedError` (NSW does not encode cashing-out yet)
  - Exports `NSW_RULE_SET: StateRuleSet` for dispatcher registration
  - `calculateNSWSafe` surfaces `CashOutNotSupportedError` as a `failed` Result with code `cash_out_not_supported`
- `website/src/lib/lsl/states/nsw/rules/value-of-week.ts`
  - Passes `NSW_SERVICE_PROFILE` to `computeDaysNotCountedInLookback`
- `website/src/lib/lsl/states/nsw/rules/trigger-handlers.ts`
  - Switch exhausts `cash_out` (returns `[]`, defensive — never reached)
- `website/src/lib/lsl/states/nsw/rules/accrual-table.ts`
  - `payableWeeks` initialised to zero (TS strict-mode definite-assignment fix introduced by the new `cash_out` variant)
- `website/src/lib/lsl/bulk-runner.ts`
  - Replaced direct `calculateNSWSafe` import with `dispatch.calculateSafe` (T1.5)
- `website/src/app/(calculator)/calculator/single/_components/form-to-engine.ts`
  - Single-state employee now auto-populates `governingJurisdiction = statesOfService[0]` so the dispatcher routes cleanly without form changes (T1.7, additive)
- `website/src/lib/observability/track.ts`
  - Added `trackStateEvent(state, eventName, payload)` and `stateEventName(state, eventName)` helpers — taxonomy `{state_lowercase}_{event_name}` per P0.4. Gated by `NEXT_PUBLIC_TELEMETRY_ENABLED !== 'false'` (T1.8)
- `.github/workflows/ci.yml`
  - Added `state-matrix` job (`matrix.state: [nsw, engine]`) — each shard runs the relevant vitest subtree
  - Added `cross-state-regression` job that runs only on engine-touching PRs (path filter on `website/src/lib/lsl/engine/**`, `dispatch.ts`, and any `continuous-service-rules.ts`)
  - Posts pass/fail per suite to the GitHub Actions step summary
  - Original `test` job (typecheck + full vitest + build) and `playwright` job retained as backstops (T1.9)
- `docs/product/epic-status.md`
  - Conflict resolved during cherry-pick — kept current main's E1 status; added E2's "Stage 1 specified" entry

### Files deleted

None.

---

## Parity check — NSW byte-identity

> The single most important Phase 1 verification.

| Run | Tests | Result |
|---|---|---|
| Baseline (before any changes) | NSW gold-standard suite: 153 tests | 153 / 153 pass |
| After refactor | NSW gold-standard suite: 153 tests | 153 / 153 pass |

Verified via:

```
ANTHROPIC_API_KEY=test npx vitest run src/lib/lsl/states/nsw/__tests__/gold-standard.test.ts
```

The TC-NSW-024 single-mode end-to-end Playwright test (`single-mode.spec.ts:10`) — which asserts the `$9,880.04` load-bearing result in a real browser — passes against both the dev bundle and the production bundle. **No NSW behaviour change.**

---

## Test counts

| Layer | Count | Status |
|---|---|---|
| Vitest (full) | 344 tests across 22 files | 344 / 344 pass |
| Vitest (NSW gold-standard subset) | 153 | 153 / 153 pass |
| Playwright (chromium, dev bundle) | 23 | 23 / 23 pass |
| Playwright (chromium, production bundle, `PLAYWRIGHT_PRODUCTION_BUILD=1`) | 23 | 23 / 23 pass |
| TypeScript (`tsc --noEmit`) | — | clean |
| `npm run build` | — | clean |

Baseline pre-change was 319 tests / 19 files. Added 25 new tests across 4 new files:

- `dispatch.test.ts` — 11 tests
- `state-selector-helpers.test.ts` — 12 tests
- `track.test.ts` — 2 tests

---

## Phase 1 task status

| Task | Status | Notes |
|------|--------|-------|
| T1.1 · Define `StateRuleSet` interface | done | At `states/StateRuleSet.ts`. NSW formally declares `NSW_RULE_SET: StateRuleSet`. |
| T1.2 · Add `extraInputs?` to `Employee` | done | Plus documented in `states/extra-inputs.md`. |
| T1.3 · Refactor continuous-service to accept rules-profile | done | NSW gold-standard byte-identical. |
| T1.4 · Build state dispatcher | done | `dispatch.calculate` / `dispatch.calculateSafe`. Cross-validated byte-identical to direct `calculateNSW` on happy path. |
| T1.5 · Update bulk-runner to use dispatcher | done | Single import change; existing bulk-runner tests + bench unchanged. |
| T1.6 · State selector UI primitive | partial | Component shipped at `components/lsl/state-selector.tsx` + helpers. Feature-flagged via `NEXT_PUBLIC_STATE_SELECTOR_ENABLED`. **Not yet rendered on any page** — see "What we did NOT do" below. |
| T1.7 · Form-level state field wiring | partial | `formToEngine.ts` now auto-populates `governingJurisdiction` from single-state `statesOfService` — additive, no UI change. Form UI itself unchanged (still uses the existing checkbox grid for NSW users). |
| T1.8 · Telemetry helper | done | `trackStateEvent` + `stateEventName` in existing `observability/track.ts`. Taxonomy `{state_lowercase}_{event_name}` per P0.4. |
| T1.9 · CI matrix workflow | done | `state-matrix` + `cross-state-regression` jobs in `.github/workflows/ci.yml`. |
| T1.10 · Phase 1 sign-off task | done | This handoff. |

Also done in addition to the named tasks:

- R2 (impl-plan risk) — `cash_out` trigger variant scaffold across `Trigger` union, `errors.ts`, `prescribedDate`, NSW orchestrator short-circuit, NSW-safe wrapper surfacing `cash_out_not_supported`. Other states (VIC Phase 3, NT Phase 9) inherit this default-throw behaviour and override in their orchestrator.

---

## Dev-findings closed

| Finding | Status after Phase 1 |
|---|---|
| DEV-E2-M1 (engine ↔ rule-set boundary contract) | **closed** — `StateRuleSet` interface defined and implemented by NSW |
| DEV-E2-M2 (dual-regime pattern) | **deferred to Phase 3** — pattern documented in impl-plan §P0.2 but VIC is the first user, so the test-in-practice happens in Phase 3 |
| DEV-E2-M3 (CI parallelisation) | **closed** — matrix strategy in place; runtime measurement deferred until VIC adds its shard |
| DEV-E2-M4 (telemetry taxonomy) | **closed** — `trackStateEvent` + `stateEventName` ship the taxonomy |
| DEV-E2-M5 (PDF state detection) | **deferred to Phase 2** — not part of Phase 1 |
| DEV-E2-M6 (ACT overtime input shape) | **closed** — `Employee.extraInputs` field + `extra-inputs.md` convention |
| DEV-E2-L1 (quick-pick chips) | **closed** — LRU implementation in `state-selector-helpers.ts` |
| DEV-E2-L2 (per-state docs page) | deferred to per-state phases |
| DEV-E2-L3 (bulk PDF state coverage header) | deferred to Phase 3 (lands with VIC) |
| DEV-E2-L4 (PR-comment integration AC22) | **closed** — `cross-state-regression` job posts pass/fail to step summary; richer PR comment (peter-evans action) can come later if needed |
| DEV-E2-L5 (heuristic F25) | obsolete — RES-5 removed F25 from v1 scope |

---

## What we did NOT do (deliberately — per scope)

- **No state-specific code beyond NSW.** Phases 3-9 add VIC, QLD, WA, SA, ACT, TAS, NT — strictly out of scope for this PR.
- **No Phase 2 (mixed-state CSV foundation).** Lives in parallel with Phase 1 but is its own separable scope.
- **No PDF extraction state-detection.** That's Phase 2.
- **No Phase 7 (logins).** Post-launch.
- **State selector is not rendered on any page yet.** The component exists and is tested, but adding it to the form requires UI changes the impl-plan defers to Phase 3 when VIC actually needs it. `NEXT_PUBLIC_STATE_SELECTOR_ENABLED` reads at module-init — when the time comes, the flag's flip will gate visibility cleanly.

This is intentional. Adding the selector to the form right now would either (a) bloat the UI with a duplicate state picker alongside the existing checkbox grid, or (b) replace the working NSW UX with one that has zero user-visible benefit until VIC ships. Phase 3 will integrate it as part of VIC's work where the value is real.

---

## Commits on this branch

```
9c831b3 feat(E2 Phase 1): per-state telemetry + CI matrix + handoff doc
02268ec feat(E2 Phase 1): state dispatcher + selector UI + form wiring
73a6764 feat(E2 Phase 1): StateRuleSet contract + per-state service profile
e70e7b3 docs(product): E2 impl-plan + tasks — 10 phases, 76 tasks    (cherry-picked from 002-all-state-coverage)
1173286 docs(product): scaffold E2 all-state coverage epic — spec v0.3.0   (cherry-picked from 002-all-state-coverage)
```

The two cherry-picked commits came from the original `002-all-state-coverage` branch (which carried 38 noisy pre-squash NSW commits that are already in main via PR #1 + PR #3, so the branch itself was unsuitable for a clean PR diff).

---

## How to verify locally

```bash
# 1. NSW byte-identity
cd website
ANTHROPIC_API_KEY=test npx vitest run src/lib/lsl/states/nsw/__tests__/gold-standard.test.ts
# expect: 153 / 153 pass

# 2. Full test suite
ANTHROPIC_API_KEY=test npx vitest run
# expect: 344 / 344 pass

# 3. Typecheck
npx tsc --noEmit
# expect: clean

# 4. Build
ANTHROPIC_API_KEY=build-time-placeholder npm run build
# expect: 10/10 static pages generated, no errors

# 5. Playwright (dev mode)
ANTHROPIC_API_KEY=test-pw npx playwright test
# expect: 23 / 23 pass

# 6. Playwright (production bundle — parity with Vercel)
PLAYWRIGHT_PRODUCTION_BUILD=1 ANTHROPIC_API_KEY=test-pw npx playwright test
# expect: 23 / 23 pass
```

---

## Operator action items

None for this PR — Phase 1 is foundation-only and ships without user-visible change. The state selector will become visible in Phase 3 when VIC starts.

For Phase 2 (parallel-eligible with Phase 1 per impl-plan): operator triggers Phase 2 separately when ready. Phase 2 is bulk-CSV mixed-state foundation + PDF state detection.

For Phase 3 (VIC): blocked on PM-signed `docs/qa/test-cases-vic.md` per T3.0.

---

## Notes for the next agent

1. **The `extraCitations` field on `ServiceEventRule`** — I added this because NSW's `transfer_of_business` emits TWO citations (`s.4(6)` preserves + `s.4(11)` deemed-continuous). The original hard-coded code in `continuous-service.ts` had this dual-emission inline. To preserve byte-identity while extracting the rules profile, the cleanest path was to let the profile carry an optional extra citation array. Other states can omit it.
2. **The dispatcher's `unsupportedStateMessage`** — emits `cross_jurisdiction_pending` warning code because that's the existing code in the `Warning` union. If we want a separate `unsupported_state` warning code, that's a follow-up `types.ts` change.
3. **`prescribedDate` cash_out path** — throws `CashOutNotSupportedError('shared engine')`. The per-state orchestrator must short-circuit `cash_out` before calling `prescribedDate`. NSW does this; VIC/NT will do it in Phase 3/9. Any state encoding cash_out support will route through the per-state orchestrator's own date logic before calling shared primitives.
4. **CI cross-state-regression** — currently posts pass/fail to the step summary, not a PR comment. The impl-plan §P0.3 mentioned `peter-evans/create-or-update-comment` as an option. I opted for the simpler step-summary path because it requires no third-party action and zero secrets; an upgrade to PR comments is a one-line workflow change if the operator wants it.
