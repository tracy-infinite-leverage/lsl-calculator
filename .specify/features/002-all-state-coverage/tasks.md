# Tasks — All-State Coverage (E2)

**Source plan**: `.specify/features/002-all-state-coverage/impl-plan.md` v0.3.2
**Branch**: `002-all-state-coverage`
**Date**: 2026-05-25 (last updated)
**Sizing legend**: S (≤ 4h), M (½ – 1.5 days), L (2–4 days), XL (> 4 days, split before starting)
**[P] marker**: task can run in parallel with sibling tasks in the same phase (no shared file mutation, no dependency)

**2026-05-24 update**: T3.0 SIGNED OFF (PM Tracy Angwin). T3.1-T3.4 re-scoped per `docs/qa/test-cases-vic.md` TBD-VIC-01 resolution — one VIC rule set with date-aware continuous-service handling instead of two parallel rule sets. F5 citation corrected s.67 → s.34 per TBD-VIC-12.

**2026-05-25 update (QLD)**: T4.0 SIGNED OFF (PM Tracy Angwin). All 6 TBDs resolved in `docs/qa/test-cases-qld.md` v1.0 — see file's Resolutions section. T4.2 acceptance criteria updated to reflect the resolved interpretations (15-yr continuous accrual; s.103 hard-anchor casual cliff + s.96 advisory-only general cliff; 52-wk casual lookback; cash-out advisory granularity; WC-reduced-rate advisory). Termination-reason enum redesign deferred to a separate state-agnostic PR (DEV-CROSS-1 — see dev-findings.md); 5 QLD fixtures deferred until that refactor lands. T4.1 onwards unblocked.

**2026-05-25 update (WA)**: T5.0 SIGNED OFF (PM Tracy Angwin). All 16 TBDs resolved in `docs/qa/test-cases-wa.md` v1.0 — see file's Resolutions section. T5.1-T5.4 re-scoped per TBD-WA-01 resolution — one WA rule set with date-aware continuous-service handling instead of two parallel rule sets (parallel to VIC's earlier re-scope). New task T5.0.5 (WA schema extension via DEV-CROSS-2) added as a state-agnostic refactor PR that lands BEFORE WA T5.1 begins. T5.1 BLOCKED on DEV-CROSS-2 (same blocking pattern as QLD's deferred fixtures were blocked on DEV-CROSS-1). Phase 5 effort estimate revised L (5–8 d) → M–L (4–6 d); total dev-days estimate revised 34–50 → 32–48.

Per AC4a, **Phases 3 through 9 (per-state encoding) execute strictly sequentially** in the order VIC → QLD → WA → SA → ACT → TAS → NT. Phases 1 and 2 run before Phase 3 and can overlap with each other (different code paths). Phase 10 runs after Phase 9 ships.

---

## Phase 1 — Foundation

Pre-requisite: branch `002-all-state-coverage` is on top of `001-nsw-calculator` HEAD. NSW gold-standard suite must be 100% green at task 1.1 start.

### T1.1 · Define `StateRuleSet` interface (S) — AC1, AC4b

Create `website/src/lib/lsl/states/StateRuleSet.ts` exporting `StateRuleSet`, `StateCalculate`, `StateCalculateSafe` per impl-plan P0.1. Update `website/src/lib/lsl/states/nsw/index.ts` to formally declare `export const NSW_RULE_SET: StateRuleSet = { state: 'NSW', calculate: calculateNSW, calculateSafe: calculateNSWSafe }`. Type-only change; runtime behaviour unchanged. **Verification**: `pnpm run typecheck` clean; NSW gold-standard suite still 100% green.

### T1.2 · Add `extraInputs?` to `Employee` (S) — F2, AC11, P0.6

Extend `Employee` in `website/src/lib/lsl/engine/types.ts` with `extraInputs?: Record<string, unknown>`. Backfill nothing — purely additive. **Verification**: typecheck clean; NSW suite green.

### T1.3 · Refactor continuous-service to accept rules-profile (M) — F2, F7, F8, F12, AC9, P0.1

In `website/src/lib/lsl/engine/continuous-service.ts`:
- Extract `SERVICE_EVENT_RULES`, `REHIRE_GAP_DAYS_NSW`, `APPRENTICE_GAP_DAYS_MAX` constants into a new type `ContinuousServiceProfile`.
- Change `computeContinuousService` signature to `(startDate, prescribedDate, events, profile)`.
- Move the existing NSW values into `website/src/lib/lsl/states/nsw/continuous-service-rules.ts` exporting `NSW_SERVICE_PROFILE: ContinuousServiceProfile`.
- Update `calculateNSW` to pass `NSW_SERVICE_PROFILE`.
- Export `ContinuousServiceProfile` type from the engine barrel.

**Verification**: all engine + NSW tests stay green at 100%. Diff to NSW gold-standard fixtures must be byte-identical (no floating-point drift).

### T1.4 · Build state dispatcher (M) — AC1, AC4b, AC21

Create `website/src/lib/lsl/dispatch.ts`:
- Export `ENCODED_STATES: ReadonlyArray<State>` (initial value `['NSW']`).
- Export `calculate(employee, trigger): Result` that selects orchestrator via `governingJurisdiction ?? statesOfService[0] ?? 'NSW'`.
- Export `calculateSafe(...)` likewise.
- Non-encoded state returns `status: 'blocked_cross_jurisdiction'` with message naming the state.
- Add comprehensive unit tests in `dispatch.test.ts`.

**Verification**: `dispatch.calculate` produces byte-identical results to `calculateNSW` for all 37 NSW fixtures.

### T1.5 · Update bulk-runner to use dispatcher (S) — AC16, P3

Replace `calculateNSWSafe` import in `website/src/lib/lsl/bulk-runner.ts` with `calculateSafe` from `dispatch.ts`. Update `bulk-runner.test.ts` and `bulk-runner.bench.test.ts` references. **Verification**: existing bulk-runner tests + bench pass unchanged.

### T1.6 · [P] State selector UI primitive (M) — F16, F18, F22, A1, AC17, AC19

Create `website/src/components/lsl/state-selector.tsx` (shadcn `Select` based):
- Renders all 8 states.
- Reads `lsl-calculator:state-recent:v1` localStorage; renders top-3 as quick-pick chips above selector (F22).
- Persists selection to that key as an LRU array (max length 3).
- Keyboard-accessible per WCAG 2.2 AA (focus-visible, ARIA labels).
- Unit tests + Testing Library a11y assertions.

**Verification**: keyboard-only flow lands focus on selector, opens list, selects, persists. axe-core scan zero violations.

### T1.7 · [P] Form-level state field wiring (M) — F16, AC18, AC20

In `website/src/app/(calculator)/calculator/single/_components/`:
- Promote `statesOfService` UI to use the new selector for single-state mode (default).
- Multi-state mode (checkbox "employee has worked in multiple states") reveals checkbox list + governing-jurisdiction selector (existing F13 flow extended to all 8 states).
- ACT-conditional overtime-hours input field — stub only in this phase, disabled, with placeholder text "Available when state = ACT and employment type = part_time/casual" (enabled in Phase 7).
- `formToEngine.ts`: when statesOfService.length === 1, set `governingJurisdiction = statesOfService[0]`.

**Verification**: form persists across reload; selecting non-NSW state shows blocked Result; switching back to NSW computes.

### T1.8 · [P] Telemetry helper (S) — S2, P0.4

Create `website/src/lib/telemetry/state-event.ts` exporting `emitTelemetry({ page_event: string, state: State })`. Wire-format identical to E1 telemetry shipped in `a6cf665`. Gated by `NEXT_PUBLIC_TELEMETRY_ENABLED` env-var. **Verification**: unit test confirms PII-free payload; gated emission in `NODE_ENV=test` is a no-op.

### T1.9 · CI matrix workflow (M) — F19, F20, AC21, AC22, AC23, P3

Create / extend `.github/workflows/test.yml`:
- Matrix strategy `state: [nsw, engine]` (other states append in their phases).
- Each shard runs `pnpm vitest run website/src/lib/lsl/states/{state}/__tests__/` or `engine/`.
- Separate `cross-state-regression` job triggered on PRs touching `website/src/lib/lsl/engine/**` or `website/src/lib/lsl/citations/**` — runs full matrix.
- `peter-evans/create-or-update-comment` step posts pass/fail/unchanged summary on engine-touching PRs.
- Per-shard job-duration line captured to GitHub Actions summary.

**Verification**: CI run on a no-op PR completes ≤ 5 minutes total; PR-comment job activates on a fixture engine-touching PR.

### T1.10 · Phase 1 sign-off task — exit criteria

Document Phase 1 completion in `docs/engineering/changes/2026-05-{date}-e2-phase-1/HANDOFF.md`:
- All Phase 1 tasks merged.
- NSW gold-standard suite still 100% green.
- `dispatch.calculate` byte-identical to `calculateNSW` (regression check evidence).
- CI matrix configured and green.
- State selector ships behind feature flag (`NEXT_PUBLIC_STATE_SELECTOR_ENABLED`) so it's not user-visible until VIC ships in Phase 3.

---

## Phase 2 — Bulk CSV mixed-state foundation

### T2.1 · Extend CSV normalisation prompt for required `state` column (M) — F17, AC16

In `website/src/lib/lsl/parsers/csv/normalize-prompt.ts`:
- Update system prompt to mark `state` as REQUIRED in `multi_employee` mode.
- Accept header variants `state | State | STATE | jurisdiction | Jurisdiction`.
- Mark `confidence` ≤ 0.7 when state column inference is unclear.

In `normalize-schema.ts`: no schema change needed (`states` canonical column already exists). Confirm `split_states` transform handles single-value cells correctly.

**Verification**: prompt unit tests (mock Claude responses) confirm `states` column is detected from each header variant.

### T2.2 · Bulk-to-engine row-level state validation (M) — F17, AC16

In `website/src/lib/lsl/parsers/csv/bulk-to-engine.ts`:
- Before producing `Employee[]`, validate each row's resolved `states` value.
- If header missing from spec → batch-level error: "CSV is missing required `state` column. Add a column named `state` and a value for each row."
- If header present but row value empty → row-level error attached to that row in the preview output.
- If row value not in `ENCODED_STATES` (from `dispatch.ts`) → row-level error: `Unsupported state "${value}". Currently encoded: ${ENCODED_STATES.join(', ')}`.
- Valid rows continue to process unchanged.

Add `bulk-to-engine.test.ts` cases: missing-column → batch error; mixed valid+invalid rows → valid processed, invalid surface as preview errors.

**Verification**: NSW-only CSV processes byte-identically; CSV with one `VIC` row pre-VIC-ship surfaces that row as unsupported, NSW rows still compute.

### T2.3 · Preview-table row-error UI (S) — F17, AC16

In `website/src/app/(calculator)/calculator/bulk/_components/bulk-preview-table.tsx`, render each row's `state` value and a row-level error chip when validation failed. Reuses the existing `unblock-jurisdiction-modal.tsx` UX pattern. **Verification**: visual review on a fixture batch with 3 valid + 2 invalid rows.

### T2.4 · PDF extraction schema/prompt state-detection (M) — F17, P0.5, AC16

In `website/src/lib/lsl/parsers/pdf/`:
- `schema.ts`: add `detected_state` (enum of 8 states, nullable) and `state_confidence` (0..1) per employee block.
- `prompts.ts`: append state-detection instructions.
- `extract.ts`: surface low-confidence detections to the preview UI for user confirmation.
- `confidence.ts`: threshold 0.75 for "needs review".

Add unit tests with mocked Anthropic responses covering: clear state in header → high confidence; no state mentioned → null+null; ambiguous → confidence 0.5.

**Verification**: PDF bulk upload of a known fixture returns `detected_state = "NSW"` confidence ≥ 0.9.

### T2.5 · Phase 2 sign-off task — exit criteria

Document Phase 2 completion in HANDOFF.md. NSW-only CSV still processes byte-identically. Mixed-state validation surfaces rows correctly. PDF state-detection wires into preview UI.

---

## Phase 3 — VIC (RES-1 #1, dual-regime, hard-error)

### T3.0 · [BLOCKING] PM-signed test-cases-vic.md (M) — AC4, AC4a, AC4b — ✅ SIGNED OFF 2026-05-24

`docs/qa/test-cases-vic.md` v1.0 — PM-signed-off 2026-05-24 by Tracy Angwin on branch `pm/vic-test-cases`. 61 test cases (single-mode 53 + bulk-mode 3 + transitional 5 — case IDs TC-VIC-001 through TC-VIC-058 + TC-VIC-BULK-001 through TC-VIC-BULK-003). All 13 TBDs resolved (see Resolutions section in the document). T3.1 onwards unblocked.

### T3.1 · VIC rule-set scaffold (S) — AC1 — re-scoped 2026-05-24 (TBD-VIC-01)

Create (one rule set with date-aware continuous-service handling per impl-plan v0.3.1 P0.2):
```
website/src/lib/lsl/states/vic/
├── index.ts                                       (stub)
├── rules/
│   ├── accrual-table.ts                           (stub — s.6 single accrual table)
│   ├── value-of-week.ts                           (stub — s.15 fixed-rate + s.15(2) 3-tier averaging + s.16)
│   ├── trigger-handlers.ts                        (stub — incl. F5 cashing-out hard error)
│   └── continuous-service/
│       ├── index.ts                               (stub — date-aware module selector)
│       ├── rules-pre-1nov2018.ts                  (stub — 1992 Act rules)
│       └── rules-post-1nov2018.ts                 (stub — 2018 Act rules)
└── __tests__/{gold-standard.test.ts, fixtures/{post-2018, straddling, transitional}/}
```

### T3.2 · VIC continuous-service-rule modules (M) — F2, F12, AC10 — re-scoped 2026-05-24

Encode the two date-aware continuous-service modules:
- `rules/continuous-service/rules-post-1nov2018.ts`: 2018 Act s.12 / s.13 / s.14 rules — 12-week break tolerance, 52-wk UPL cap **per-period** (TBD-VIC-08), 52-wk casual seasonal allowance, s.13(1)(b)/(c) unpaid-leave-counts rules, s.14(a)/(b)/(c) excluded-from-accrual rules.
- `rules/continuous-service/rules-pre-1nov2018.ts`: 1992 Act s.62 / s.62A / s.63 rules preserved via s.57 — 12-mo apprentice cap, 3-mo dismissal/rehire cap, 48-wk illness cap, UPL-doesn't-count-at-all rule.
- `rules/continuous-service/index.ts`: walks `serviceEvents` and selects the appropriate module per `absence.startDate` vs `2018-11-01`. For absences straddling the cutoff, split into two date segments and apply each module to its segment.

Also: small `engine/types.ts` refactor — rename `gap_exceeds_2mo` warning code → `gap_exceeds_state_tolerance` per TBD-VIC-03; preserve NSW message wording.

### T3.3 · VIC accrual + value-of-week + trigger-handlers (M) — F2, F12, AC10 — re-scoped 2026-05-24

Encode the single VIC rule set (no pre/post split at this layer — s.6 entitlement formula is undivided):
- `rules/accrual-table.ts`: VIC LSL Act 2018 s.6 — 7-year qualifying threshold (inclusive at exactly 7.0000 per TBD-VIC-06); accrual ratio 8.6667/10 per year of continuous employment.
- `rules/value-of-week.ts`: s.15(1) fixed-rate path; s.15(2)(a)/(b)/(c) three-tier averaging for varied-rate employees; s.16 hours-changed-in-last-104wks averaging; s.17 workers-comp higher-of-rates. Classifier branches by wage-history characteristics per TBD-VIC-11.
- `rules/trigger-handlers.ts`: s.9 termination (any reason ≥ 7 yrs); s.10 death (52-wk avg per s.10(3)(b) overrides s.15(2) 3-tier); s.18+s.20 taking_leave; sub-7-yr advisory warning per TBD-VIC-07. **F5 cashing-out hard error** stays in this module.

### T3.4 · VIC orchestrator (M) — F5, F12, AC5, AC10 — re-scoped 2026-05-24

Implement `calculateVIC(employee, trigger)` per impl-plan v0.3.1 P0.2:
1. Compute effective service start with VIC 12-week break tolerance.
2. Walk `serviceEvents`; route each absence through the date-aware continuous-service module (sum `days_excluded_from_service`).
3. Compute years of continuous service = (elapsed since effective start) − sum(days_excluded).
4. Apply s.6 accrual once (no regime sum — single formula across total period of continuous employment).
5. Apply value-of-week per the employee's classification.
6. Apply trigger handler. F5 cashing-out hard error: return `status: 'failed'` with citation `LSL Act 2018 (Vic) s.34` (corrected from s.67 per TBD-VIC-12), `error.code = 'vic_cashout_prohibited'`, no numeric outputs. Emit `vic_cashout_hard_error` page event.

Add `calculateVICSafe` wrapper. Export `VIC_RULE_SET: StateRuleSet`.

**Note**: no `vic_regime_split_data_insufficient` warning path is needed — VIC's date-aware handling operates on known absence start dates, not on wage-history granularity. WA retains this warning (different architecture).

### T3.5 · VIC fixtures (M) — F3, AC2, AC3

Translate every row in `test-cases-vic.md` into `__tests__/fixtures/single/TC-VIC-NNN.json` and `__tests__/fixtures/bulk/`. Same fixture shape as NSW.

### T3.6 · VIC integration (S) — AC1

- Append `'VIC'` to `ENCODED_STATES` in `dispatch.ts`.
- Add VIC case to `dispatch.calculate` (maps to `calculateVIC`).
- Add `vic` shard to CI matrix in `.github/workflows/test.yml`.

### T3.7 · [P] VIC docs page scaffold (S) — F21, DEV-E2-L2

Create `website/src/app/calculator/about/vic/page.tsx` with placeholder prose. Linked from "Why this number?" affordance on the result panel. Prose authored by PM in a follow-up — not blocking AC1–AC4.

### T3.8 · [P] Bulk PDF state-coverage summary header (S) — F23, DEV-E2-L3

Extend `bulk-results-table.tsx` PDF export template with a one-row "states this batch covered" summary. Lands once; reused for all later states.

### T3.9 · VIC per-state launch gate (AC4b)

Before merging T3.4–T3.6 to `main`:
- PM-signed `test-cases-vic.md` (T3.0) — confirmed.
- VIC gold-standard suite 100% green in CI on merge commit.
- Cross-state regression confirms NSW still green.
- Update `docs/product/epic-status.md`: VIC → Stage 5 (Shipped).
- Update `ENCODED_STATES` documentation comment.

**Only after this gate** may Phase 4 (QLD) start (AC4a).

---

## Phase 4 — QLD (RES-1 #2)

### T4.0 · [BLOCKING] PM-signed test-cases-qld.md (M) — AC4, AC4a, AC4b — ✅ SIGNED OFF 2026-05-25

`docs/qa/test-cases-qld.md` v1.0 — PM-signed-off 2026-05-25 by Tracy Angwin on branch `pm/qld-test-cases`. 58 active test cases (single-mode 50 + bulk-mode 3 + cross-jurisdiction 2 + as-at 2 + 1 PH = 58; case IDs TC-QLD-001 through TC-QLD-057 + TC-QLD-BULK-001..003, with TC-QLD-005, -007, -008, -015, -016 deferred to a follow-up PR after DEV-CROSS-1 lands). All 6 TBDs resolved (see Resolutions section in the document). T4.1 onwards unblocked.

### T4.1 · QLD rule-set scaffold (S) — AC1

Single-regime structure: `website/src/lib/lsl/states/qld/{index.ts, rules/{accrual-table, value-of-week, trigger-handlers, continuous-service-rules}.ts, __tests__/}`.

### T4.2 · QLD rules + orchestrator (L) — F2, AC1 — acceptance criteria updated 2026-05-25 per TBD resolutions

**Accrual table (`accrual-table.ts`)**:
- 10-yr qualifying period at 8.6667 weeks (s.95(2)(a)). Threshold inclusive at exact-day boundary (`years_of_continuous_service >= 10.0000`).
- Continuous 1/60 accrual across all tenure bands ≥ 10 yrs (NO discrete step at 15 yrs per TBD-QLD-01 resolution). At 15 yrs the arithmetic outcome is `15 × 8.6667 / 10 ≈ 13.0` weeks. At 7-yr threshold (sub-10-yr pro-rata): `years_of_continuous_service >= 7.0000` AND qualifying-reason gate satisfied (s.95(3)/(4)).
- 10+ yr automatic payout regardless of reason (incl. `serious_misconduct`) per s.95(2). QLD has NO misconduct exception at 10+ yrs.

**Value-of-week (`value-of-week.ts`)**:
- Fixed-rate FT/PT path: trust `currentWeeklyGross` (s.98 ordinary rate, overtime excluded; engine does not decompose). Above-award and contractual allowances honoured if included in supplied gross.
- Casual path: single 52-wk lookback per TBD-QLD-03 resolution. Formula: `(hoursLast52Weeks ÷ 52) × loadedHourlyRate` (s.105). NO 3-tier "greater of" (that stays VIC-specific).
- Commission path: 52-wk average per s.99.
- WC handling per TBD-QLD-05: ALWAYS return current rate at time of leave (literal s.98). NO equivalent of VIC s.17 higher-of-rates. The reduced-rate advisory is emitted from `trigger-handlers.ts`, not this module.

**Continuous-service-rules (`continuous-service-rules.ts`)**:
- 3-month break tolerance (s.134 general). Reuse state-agnostic `gap_exceeds_state_tolerance` warning code (introduced VIC Phase 3) with QLD-specific message "3 months".
- Casual-specific 3-month gap break per s.103.
- UPL does NOT count toward service but does NOT break continuity (s.134).
- Workers Comp absence counts toward continuous service (s.134; Business QLD interpretive guidance).
- Transfer of business preserves service (s.134); dismissed-at-transfer + rehired-within-3-mo by new owner preserves total service.
- **s.103 casual cliff HARD-ANCHOR per TBD-QLD-02**: when `employmentType = 'casual' && startDate < 1994-03-30`, set effective service start to `1994-03-30`. Emit `pre_1994_casual_cliff_qld` warning. Applies retrospectively to the casual portion of a casual-to-permanent transition.
- **s.96 general cliff ADVISORY-ONLY per TBD-QLD-02**: when `startDate < 1990-06-23`, use actual start date in accrual computation. Emit `pre_1990_service_advisory_qld` warning. Do NOT alter computed weeks/dollars.
- Stand-down (s.134(2)(b) slackness of trade) preserves continuity but does NOT count as service (aligns with VIC s.14(c) per TBD-QLD-02 resolution).

**Trigger-handlers (`trigger-handlers.ts`)**:
- `termination` trigger: route by `reason` through s.95(2) (10+ yr automatic) vs s.95(3)/(4) (sub-10-yr qualifying-reason gate) vs sub-7-yr ($0). v1 supports `voluntary_resignation`, `redundancy`, `serious_misconduct`, `illness_incapacity`, `death` enum values. Other s.95(3) sub-paragraphs (`employer_initiated_not_misconduct`, `unfair_dismissal`, `domestic_pressing_necessity`, `poor_performance`, employee-vs-employer-initiated illness) are deferred to DEV-CROSS-1.
- `cash_out` trigger per TBD-QLD-04: ALWAYS compute and return value (not a hard error — divergence from VIC). Emit `qld_cashout_requires_instrument_or_qirc` advisory citing s.110. When `years_of_continuous_service < 10`, emit additional `sub_10yr_cashout_only_via_qirc_qld` advisory. When `years_of_continuous_service < 7`, value is $0 and emit `qld_cashout_no_entitlement_to_cash_out` advisory alongside the existing `sub_7yr_no_entitlement_qld` warning. NO user-supplied s.110 ground required.
- `taking_leave` trigger: standard s.97 PH-exclusive treatment.
- `as_at` snapshot: bypass qualifying-reason gates (E1 spec D20 convention); report accrued value; emit `accrued_not_currently_payable` warning when sub-7-yr.
- **WC-overlap advisory per TBD-QLD-05**: when ANY `workers_comp_absence` event in `employee.serviceEvents` overlaps the trigger date (termination date, leave start date, as-at date, or cash-out date), emit `qld_lsl_calculated_at_wc_reduced_rate_warning` advisory. Message text per Resolutions section in test-cases-qld.md.

**Orchestrator (`index.ts`)**:
- `calculateQLD(employee, trigger)` per `StateRuleSet` interface (P0.1).
- `calculateQLDSafe(employee, trigger)` wrapper.
- Export `QLD_RULE_SET: StateRuleSet`.

### T4.3 · QLD fixtures (M) — F3, AC2, AC3

`TC-QLD-NNN.json` fixtures per the signed test-cases. Build the 58 active fixtures; do NOT build the 5 deferred fixtures (TC-QLD-005, -007, -008, -015, -016 — see test-cases-qld.md "Deferred to cross-state termination-enum refactor" appendix). The deferred fixtures will be added via a small follow-up PR after DEV-CROSS-1 lands.

### T4.4 · QLD integration (S) — AC1

Append `'QLD'` to `ENCODED_STATES`; add `qld` to CI matrix; add dispatch case.

### T4.5 · [P] QLD docs page scaffold (S) — F21

`website/src/app/calculator/about/qld/page.tsx`.

### T4.6 · QLD per-state launch gate (AC4b)

Same shape as T3.9. Only after this gate may Phase 5 (WA) start.

---

## Phase 5 — WA (RES-1 #3) — re-scoped 2026-05-25 per TBD-WA-01

### T5.0 · [BLOCKING] PM-signed test-cases-wa.md (L) — AC4, AC4a, AC4b — ✅ SIGNED OFF 2026-05-25

`docs/qa/test-cases-wa.md` v1.0 — PM-signed-off 2026-05-25 by Tracy Angwin on branch `pm/wa-test-cases`. 73 test cases (70 single-mode + 3 bulk; case IDs TC-WA-001 → TC-WA-070 + TC-WA-BULK-001 → TC-WA-BULK-003). All 16 TBDs resolved (see Resolutions section in the document) — TBD-WA-01 load-bearing dual-regime architecture resolved to single rule set with date-aware continuous-service handling; TBD-WA-08, -12, -13, -14 + slackness-of-trade signal deferred to a state-agnostic schema extension PR (DEV-CROSS-2) that lands BEFORE T5.1; remaining 11 Sev-2/3 TBDs resolved inline per PM's recommendations. 5 fixtures (TC-WA-029, TC-WA-030, TC-WA-049, TC-WA-052, TC-WA-060) remain in the active launch-gate suite pending DEV-CROSS-2.

### T5.0.5 · [BLOCKING — pre-flight for T5.1] DEV-CROSS-2 · WA schema extension (S–M) — see dev-findings.md

State-agnostic `engine/types.ts` extensions that the WA per-state PR (Phase 5) will consume. Same pattern as DEV-CROSS-1 (which landed at `bd2d284` between QLD launch and WA Phase 5 start). Bundles four schema additions into a single cross-state PR rather than retrofitting per-state:

- `slacknessOfTrade?: boolean` on `employer_initiated_termination_and_rehire` event type (defaults `false`).
- `paidConcurrent?: boolean` and `returnToWorkProgram?: boolean` on `workers_comp_absence` event type (both default `false`).
- `reasonableExpectationOfReturn?: boolean` on `unpaid_parental_leave` event type (defaults `false`).
- `mealsAndAccommodationCashValueWeekly?: number` on `Employee` interface (defaults `0`).

Updates NSW + VIC + QLD orchestrators to accept the new fields (no behaviour change — they don't currently consume them, so the cases are no-ops). Updates single-mode form UI to render the new fields conditionally where appropriate (slackness-of-trade checkbox on employer-rehire event editor; paid-concurrent + RTW checkboxes on WC event editor; reasonable-expectation checkbox on UPL event editor for casual employees; meals/accommodation cash value field on employee profile). Form-state migration in `formToEngine.ts` populates the new fields.

**Pre-flight blocker for**: WA T5.1 (rule-set scaffold). Without DEV-CROSS-2, fixtures TC-WA-029, TC-WA-030, TC-WA-049, TC-WA-052, TC-WA-060 cannot pass — the engine would have no schema field to consult.

**Verification**: typecheck clean; NSW + VIC + QLD gold-standard suites still 100% green at byte-identical outputs (the new optional fields default to falsy and have no behaviour effect on existing fixtures).

**Effort**: S–M (½–1.5 days).

### T5.1 · WA rule-set scaffold (S) — AC1 — re-scoped 2026-05-25 (TBD-WA-01) — BLOCKED on T5.0.5

Create (one rule set with date-aware continuous-service handling per impl-plan v0.3.2 P0.2):
```
website/src/lib/lsl/states/wa/
├── index.ts                                       (stub — calculateWA orchestrator)
├── rules/
│   ├── accrual-table.ts                           (stub — s.8 single accrual table, continuous 1/60, thresholds inclusive)
│   ├── value-of-week.ts                           (stub — s.9 fixed-rate + accrual-period averaging + 365-day results-based)
│   ├── trigger-handlers.ts                        (stub — s.8(3) termination matrix incl. 10+yr partial forfeiture; s.5 three-tier cash-out advisory)
│   └── continuous-service/
│       ├── index.ts                               (stub — date-aware module selector by accrual-block fully-accrued date)
│       ├── rules-pre-20jun2022.ts                 (stub — pre-2022 s.6 rules)
│       ├── rules-post-20jun2022.ts                (stub — post-2022 s.6 rules)
│       └── workers-comp-override.ts               (stub — WCIM Act 2023 (WA) 2024-07-01 override on top of post-2022 module)
└── __tests__/{gold-standard.test.ts, fixtures/{single, straddling, workers-comp, bulk}/}
```

### T5.2 · WA continuous-service-rule modules (M) — F2, F7, F8, AC7, AC8, AC9 — re-scoped 2026-05-25

Encode the two date-aware continuous-service modules plus the WC override:
- `rules/continuous-service/rules-post-20jun2022.ts`: paid sickness counts in full (no 15-day cap); casual continuity expanded with `slacknessOfTrade` 6-mo tolerance + general 2-mo non-slackness tolerance; paid parental counts; casual UPL with `reasonableExpectationOfReturn: true` counts; broader Fair Work-style transfer-of-business.
- `rules/continuous-service/rules-pre-20jun2022.ts`: 15-day sickness cap (working days proportionate to normal pattern per TBD-WA-09 RESOLVED); UPL excluded; no specific casual rules (general s.6 2-mo/6-mo applies + `wa_pre_2022_casual_no_specific_rules` advisory per TBD-WA-10 RESOLVED); pre-2022 transmission-of-business.
- `rules/continuous-service/workers-comp-override.ts`: applied AFTER the pre/post-2022 module selects. For any `workers_comp_absence` event, days on or after 2024-07-01 count regardless of which module is active. Pre-2024-07-01 portions follow the selected module's rule. Paid-concurrent and RTW-program exceptions honoured via the DEV-CROSS-2 schema fields. Citation: "WCIM Act 2023 (WA)" (Act-level only — sub-section TBD per TBD-WA-02 RESOLVED documented limitation).
- `rules/continuous-service/index.ts`: for each accrual block on the employee's record, determines whether the block's "fully accrued" date is before or on/after 2022-06-20 (inclusive of 2022-06-20 in the post-2022 set per TBD-WA-11 RESOLVED) and selects the appropriate module. For blocks straddling absences, split into segments by date and apply each module to its segment. Also emits `wa_regime_split_applied` warning (transparency — fires even when numerical outcome is identical) and `wa_regime_split_data_insufficient` warning + post-2022 fallback when data granularity is insufficient (per spec AC8).

### T5.3 · WA accrual + value-of-week + trigger-handlers (M) — F2, AC1, AC7 — re-scoped 2026-05-25

Encode the single WA rule set (no pre/post split at this layer — s.8 entitlement formula is undivided):
- `rules/accrual-table.ts`: WA LSL Act 1958 s.8 — continuous 1/60 accrual across all tenure bands ≥ 10 yrs (NO discrete step at 15 yrs per TBD-WA-04 RESOLVED). Thresholds at 7, 10, 15, 20, 25 yrs all inclusive at exact-day boundary.
- `rules/value-of-week.ts`: s.9 fixed-rate path; varied-hours accrual-period averaging (partial-block averaging covers partial duration only per TBD-WA-06 RESOLVED); casual loaded rate (incl. casual loading per s.9 as amended 2022); 365-day rolling average for commission/piece/results-based; meals/accommodation cash value added when supplied via DEV-CROSS-2 field. WC handling per TBD-WA-05 RESOLVED: ALWAYS return current rate at time of leave (literal s.9). NO equivalent of VIC's s.17 higher-of-rates.
- `rules/trigger-handlers.ts`: `termination` trigger with s.8(3) matrix — sub-7-yr returns $0 (with `sub_7yr_no_entitlement_wa` warning, including for death per TBD-WA-16 RESOLVED no-carve-out); 7+yr "any reason except serious misconduct" pays out pro-rata; sub-10-yr serious misconduct returns $0 with `sub_10yr_misconduct_excluded_wa` warning; 10+yr serious misconduct returns `max(0, last_fully_accrued_block_weeks - leave_already_taken_against_that_block)` per TBD-WA-07 RESOLVED with `wa_10yr_plus_misconduct_partial_forfeiture` warning. `cash_out` trigger per TBD-WA-03 RESOLVED: three distinct advisory codes (post-accrual / pre-first-milestone advisory not blocked per TBD-WA-15 RESOLVED / sub-7-yr no entitlement). `taking_leave` trigger: s.9 PH-exclusive. **WC-overlap advisory per TBD-WA-05 RESOLVED**: when ANY `workers_comp_absence` event in `employee.serviceEvents` overlaps the trigger date, emit `wa_lsl_calculated_at_wc_reduced_rate_warning` advisory.

### T5.4 · WA orchestrator (M) — F5, F7, AC1, AC7, AC8 — re-scoped 2026-05-25

Implement `calculateWA(employee, trigger)` per impl-plan v0.3.2 P0.2:
1. Compute effective service start with WA 2-mo non-slackness / 6-mo slackness re-employment tolerances (the 6-mo tolerance uses the `slacknessOfTrade` field added via DEV-CROSS-2).
2. Walk `serviceEvents` and accrual blocks; route each through the date-aware continuous-service module (sum `days_excluded_from_service`). Apply WC override at 2024-07-01 to any WC absence events.
3. Compute years of continuous service = (elapsed since effective start) − sum(days_excluded).
4. Apply s.8 accrual once (no regime sum — single formula across total period of continuous employment).
5. Apply value-of-week per the employee's classification (with partial-block averaging for varied-hours; loaded rate for casual; 365-day for results-based).
6. Apply trigger handler. Emit citations: pre/post-2022 continuous-service modules per which fired; s.8 accrual; s.9 ordinary-pay; WCIM Act 2023 (WA) if WC override fired (Act-level citation). Emit `wa_regime_split_applied` warning when service straddles 2022-06-20 (even if numerical outcome is identical — transparency).

Add `calculateWASafe` wrapper. Export `WA_RULE_SET: StateRuleSet`.

### T5.5 · WA fixtures (M) — F3, AC2, AC3 — re-scoped 2026-05-25

Translate every row in `test-cases-wa.md` v1.0 into `__tests__/fixtures/single/TC-WA-NNN.json` and `__tests__/fixtures/bulk/`. Build all 73 fixtures (70 single + 3 bulk). 5 fixtures (TC-WA-029, TC-WA-030, TC-WA-049, TC-WA-052, TC-WA-060) depend on the DEV-CROSS-2 schema fields landing first (T5.0.5).

### T5.6 · WA integration (S) — AC1

Append `'WA'` to `ENCODED_STATES`; add WA case to `dispatch.calculate` (maps to `calculateWA`); add `wa` shard to CI matrix in `.github/workflows/test.yml`.

### T5.7 · [P] WA docs page scaffold (S) — F21

`website/src/app/calculator/about/wa/page.tsx`.

### T5.8 · WA per-state launch gate (AC4b)

Before merging T5.1–T5.6 to `main`:
- PM-signed `test-cases-wa.md` (T5.0) — confirmed.
- DEV-CROSS-2 merged (T5.0.5) — confirmed.
- WA gold-standard suite 100% green in CI on merge commit (all 73 fixtures pass — including the 5 DEV-CROSS-2-dependent fixtures).
- Cross-state regression confirms NSW + VIC + QLD still green.
- Update `docs/product/epic-status.md`: WA → Stage 5 (Shipped).
- Update `ENCODED_STATES` documentation comment.

**Only after this gate** may Phase 6 (SA) start (AC4a).

---

## Phase 6 — SA (RES-1 #4)

### T6.0 · [BLOCKING] PM-signed test-cases-sa.md (M) — AC4

APA PDF pp.80–94 + SA edge cases: employee at exactly 10 years → 13 weeks (not 8.6667), employee with PH falling within LSL period (no extension), written-agreement cashing-out.

### T6.1 · SA rule-set scaffold (S) — AC1

### T6.2 · SA rules + orchestrator (L) — F2, F10, F11, AC12, AC13

- **Accrual: 13 weeks at 10 years** (separate table — implementation shared with NT in T9.x by extracting a `SA_NT_ACCRUAL_TABLE` constant).
- **Value-of-week: PH-inclusive in LSL period (F11)** — when trigger is `taking_leave` and the leave-period overlaps a public holiday, do not extend the leave by the PH duration. Implementation: the SA `value-of-week.ts` and/or trigger handler reads a `publicHolidays` field on the employee or a system PH calendar. (Decision: use a hardcoded SA public-holidays array for v1; auto-detect from leave dates. v2 may upgrade to user-supplied PH list.)
- `calculateSA` + safe wrapper. Export `SA_RULE_SET`.

### T6.3 · SA fixtures (M) — F3, AC2, AC3, AC12, AC13

`TC-SA-NNN.json` fixtures.

### T6.4 · SA integration (S)

### T6.5 · [P] SA docs page scaffold (S)

### T6.6 · SA per-state launch gate (AC4b). Blocks Phase 7.

---

## Phase 7 — ACT (RES-1 #5, overtime in ordinary pay — high mis-coding risk)

### T7.0 · [BLOCKING] PM-signed test-cases-act.md (L) — AC4

APA PDF pp.109–123 + ACT edge cases: 7-year qualifying period employee (just over), casual with overtime hours, part-time with overtime hours, termination paid within 90 days (vs immediate). PM explicitly reviews the overtime-inclusion semantics against the Act before signing.

### T7.1 · ACT rule-set scaffold + extra-inputs schema (S) — F2, AC11

Create `states/act/extra-inputs.ts` with `ACTExtraInputs` interface (overtimeHoursByPeriod). Scaffold `states/act/{index, rules/, __tests__/}`.

### T7.2 · ACT rules + overtime-inclusive value-of-week (L) — F2, F9, AC11

- **value-of-week reads `employee.extraInputs.overtimeHoursByPeriod`** and adds overtime $ to weekly gross for part-time/casual.
- Citation emitter adds the explicit "divergence from NSW" citation (F9 last sentence).
- Termination handler: 90-day window for payment (vs NSW "forthwith") — surfaces a `payable_by` advisory in the Result, not a hard error.
- `calculateACT` + safe wrapper. Export `ACT_RULE_SET`.

### T7.3 · ACT form-conditional overtime input (M) — F16, AC18

In `single-mode-form.tsx`, **enable** the overtime-hours input stub (placed in T1.7). Conditional rendering: `state === 'ACT' && employment_type ∈ {part_time, casual}`. Field accepts a list of `{periodStart, periodEnd, hours}` rows. `formToEngine.ts` populates `employee.extraInputs.overtimeHoursByPeriod`.

Add a11y test: screen-reader announcement when field appears/disappears (AC18).

### T7.4 · ACT fixtures (M) — F3, AC2, AC3, AC11

`TC-ACT-NNN.json` fixtures, several covering overtime-inclusive scenarios.

### T7.5 · ACT integration (S)

### T7.6 · [P] ACT docs page scaffold (S)

### T7.7 · ACT per-state launch gate (AC4b). Blocks Phase 8.

---

## Phase 8 — TAS (RES-1 #6)

### T8.0 · [BLOCKING] PM-signed test-cases-tas.md (M) — AC4

APA PDF pp.95–108 + TAS edge cases: 3-month break tolerance, cashing-out attempted before entitlement accrues (rejected; citation note), taking-leave attempted before 10 years (refused).

### T8.1 · TAS rule-set scaffold (S) — AC1

### T8.2 · TAS rules + orchestrator (L) — F2

- 3-month break tolerance.
- Cashing-out: allowed only after entitlement; trigger handler refuses pre-entitlement cash-out with citation note (not a hard error).
- Advance leave: not permitted; `taking_leave` trigger refused when years-of-service < 10.
- Standard 8.6667-week accrual.

### T8.3 · TAS fixtures (M) — F3, AC2, AC3

### T8.4 · TAS integration (S)

### T8.5 · [P] TAS docs page scaffold (S)

### T8.6 · TAS per-state launch gate (AC4b). Blocks Phase 9.

---

## Phase 9 — NT (RES-1 #7, cashing-out hard error)

### T9.0 · [BLOCKING] PM-signed test-cases-nt.md (M) — AC4

APA PDF pp.124–136 + NT edge cases: 13-week first entitlement (mirror SA), cashing-out attempt → hard error, working-elsewhere-during-LSL restriction surfaced via trigger handler.

### T9.1 · NT rule-set scaffold (S) — AC1

### T9.2 · NT rules + orchestrator (L) — F2, F6, F10, AC6, AC12

- **Accrual: 13 weeks at 10 years** — share `SA_NT_ACCRUAL_TABLE` extracted in T6.2.
- F6 cashing-out hard error: mirror VIC F5 pattern. Citation `LSL Act 1981 (NT) s.12`. Page event `nt_cashout_hard_error`.
- s.16 working-elsewhere restriction: citation note in `taking_leave` handler.
- `calculateNT` + safe wrapper. Export `NT_RULE_SET`.

### T9.3 · NT fixtures (M) — F3, AC2, AC3, AC6, AC12

### T9.4 · NT integration (S)

### T9.5 · [P] NT docs page scaffold (S)

### T9.6 · NT per-state launch gate (AC4b). Triggers Phase 10.

---

## Phase 10 — E2 closeout

Runs after Phase 9 (NT) ships. Tasks here close cross-cutting acceptance criteria.

### T10.1 · Full cross-state regression sweep (M) — F19, F20, AC21, AC22

Run the full matrix on a clean PR; confirm all 8 state suites green; review any engine-touch commits from Phases 3–9 for unintended cross-state effects. Capture results in `docs/engineering/changes/2026-XX-XX-e2-closeout/`.

### T10.2 · WCAG 2.2 AA closeout audit (M) — A1, A2, A3, AC17, AC18, AC19, SC9

Run axe-core automated scan on:
- State selector flow.
- ACT conditional overtime input (add/remove).
- Cross-jurisdictional governing-state nomination dialog.

Manual keyboard run-through of each. Zero violations required for SC9.

### T10.3 · Performance benchmark (M) — P1, P2, P3, SC4

- P95 single-mode ≤ 2s across all 8 states (bench harness `engine/property.test.ts` style).
- P95 bulk-mode ≤ 60s for 500 mixed-state employees (extend `bulk-runner.bench.test.ts`).
- CI matrix wall-clock ≤ 5 min on standard runner.

If any breach: investigate before closing E2; do not bump targets without operator approval.

### T10.4 · `epic-status.md` update (S)

E2 → Stage 5 (Shipped). Note all 7 per-state launch gates met. Cross-reference each state's launch-gate commit SHA.

### T10.5 · Quarterly legislation-review template (S) — RES-3

Create `docs/operational/legislation-quarterly-review-template.md`:
- Checklist for 1 March / 1 June / 1 September / 1 December.
- Each of the 8 jurisdictions listed with its gazette URL from spec §Constraints.
- On-trigger override section (gazetted amendment / media notice).
- Owner: Tracy (PM).

This is operational documentation (not engineering); it scaffolds the workflow the operator runs quarterly. **No code change.**

### T10.6 · E2 sign-off (S)

Document E2 completion in `docs/engineering/changes/2026-XX-XX-e2-closeout/HANDOFF.md` with:
- All 10 phases completed.
- All cross-state gates met.
- Performance + a11y + CI runtime budgets validated.
- Quarterly review template scaffolded.

Hand off to QA for one final end-to-end pass before flipping the `NEXT_PUBLIC_STATE_SELECTOR_ENABLED` flag in production.

---

## Task count summary

| Phase | Tasks | Of which [P] |
|---|---|---|
| 1 | 10 | 3 (T1.6, T1.7, T1.8) |
| 2 | 5 | 0 |
| 3 (VIC) | 10 (incl. T3.0 blocking) | 2 (T3.7, T3.8) |
| 4 (QLD) | 7 | 1 (T4.5) |
| 5 (WA) | 10 (incl. T5.0 + T5.0.5 blocking) | 1 (T5.7) |
| 6 (SA) | 7 | 1 (T6.5) |
| 7 (ACT) | 8 | 1 (T7.6) |
| 8 (TAS) | 7 | 1 (T8.5) |
| 9 (NT) | 7 | 1 (T9.5) |
| 10 (closeout) | 6 | 0 |
| **Total** | **77** | **11** |

State distribution across the 7 new states (Phases 3–9): 56 tasks total. VIC and WA carry the highest task count (10 each — both also include their respective blocking PM-sign-off task; WA additionally includes T5.0.5 DEV-CROSS-2 pre-flight). QLD/SA/TAS/NT each at 7 tasks. ACT at 8 (one extra task for the form-conditional overtime input).

---

## Dependency chain (high-level)

```
Phase 1 ─┐
         ├─→ Phase 3 (VIC) ─→ Phase 4 (QLD) ─→ Phase 5 (WA) ─→ Phase 6 (SA) ─→ Phase 7 (ACT) ─→ Phase 8 (TAS) ─→ Phase 9 (NT) ─→ Phase 10
Phase 2 ─┘
```

Phases 1 and 2 are parallel-eligible (different code paths). Phases 3–9 strictly sequential per AC4a. Phase 10 is post-NT.

Within each per-state phase, the BLOCKING test-cases.md task (T{N}.0) must be PM-signed before T{N}.1 onwards may start. Docs-page scaffolds are [P]-eligible because they don't block the engine launch gate (AC4b is engine + suite + PM signoff, not docs).
