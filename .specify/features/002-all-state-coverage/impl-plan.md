# Impl Plan — All-State Coverage (E2)

**Source spec**: `.specify/features/002-all-state-coverage/spec.md` v0.3.1
**Version**: 0.3.1 (2026-05-24)
**Branch**: `002-all-state-coverage`
**Date**: 2026-05-24
**Owner**: developer agent
**Status**: Draft — ready for `speckit-tasks` to convert into `tasks.md`

**v0.3.1 change log (2026-05-24)**:
1. **Phase 3 (VIC) re-scoped** per `docs/qa/test-cases-vic.md` TBD-VIC-01 resolution. The "two parallel rule sets (`rules-pre-2018/` + `rules-post-2018/`)" model is replaced by **one VIC rule set with date-aware continuous-service handling**. Two continuous-service-rule *modules* (selected by absence start date) feed the same s.6 accrual formula. P0.2 decision and Phase 3 effort estimate revised. ~2 dev-days saved (8 → 6).
2. **F5 citation corrected**: `LSL Act 2018 (Vic) s.67` → `LSL Act 2018 (Vic) s.34` (Part 3 Division 3 — Offences) per TBD-VIC-12. Mirrors spec v0.3.1.

---

## Phase 0 — Pre-Planning Decisions

These resolutions clear the dev-findings produced by `pm-analyze-split`. The NSW reference implementation on this branch (HEAD `5dc7fd5`) is now stable enough at the interface level to commit to a contract; this is the gate the spec called out under the pattern-dependency notice.

### P0.1 — DEV-E2-M1 · Engine ↔ rule-set boundary contract (RESOLVED)

**Read** (NSW reference, on this branch):
- `website/src/lib/lsl/engine/index.ts` — barrel for shared engine primitives.
- `website/src/lib/lsl/engine/types.ts` — `Employee`, `Trigger`, `Result`, `Citation`, `Warning`, `State` (the `State` union already enumerates all 8 jurisdictions).
- `website/src/lib/lsl/engine/{classifier,continuous-service,lookback,decimal,dates,normalise,trigger,system-formula,citation,errors}.ts` — all state-agnostic primitives.
- `website/src/lib/lsl/states/nsw/index.ts` — the orchestrator: imports engine primitives, imports NSW-specific rules from `./rules/`, returns a `Result`.
- `website/src/lib/lsl/states/nsw/rules/{accrual-table,value-of-week,trigger-handlers}.ts` — the three NSW-specific concerns currently broken out.

**Decision: per-state rule sets expose a single orchestrator function `calculate{STATE}(employee, trigger) → Result` plus a `calculate{STATE}Safe(...)` wrapper.** This matches what NSW already does (`calculateNSW`, `calculateNSWSafe`). The orchestrator imports engine primitives directly; there is no "bundle of named functions" interface that the engine then calls. The dispatcher (P0.2 below) selects which orchestrator to call by `governingState`.

**Documented as a TypeScript interface** at `website/src/lib/lsl/states/StateRuleSet.ts` for explicit type-safety:

```ts
import type { Employee, Result, Trigger } from '@/lib/lsl/engine/types';

/** Pure orchestrator — never throws on user-input issues; encodes them as Result.status. */
export type StateCalculate = (employee: Employee, trigger: Trigger) => Result;

/** Wrapped version: catches throws, returns Result with status = 'failed'. Used by bulk runner. */
export type StateCalculateSafe = (employee: Employee, trigger: Trigger) => Result;

export interface StateRuleSet {
  state: 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
  calculate: StateCalculate;
  calculateSafe: StateCalculateSafe;
}
```

**Concerns that stay in the shared engine** (no changes for E2):
- Decimal arithmetic, ISO date arithmetic, citation construction
- Pay-pattern classifier (`classify(employee)`) — Categories A/B/C are NSW-derived but the math is gross-CV + employment_type, neither state-specific. States that need different categories (e.g. ACT with overtime hours) override via the orchestrator, not the classifier itself.
- Continuous-service primitive (`computeContinuousService`) — accepts a `ContinuousServiceEvent[]`; the *rule table* of which events count is currently embedded in this file as `SERVICE_EVENT_RULES`. **Refactor for E2**: extract that table to be passed in by the per-state orchestrator (or accept a "rules profile" parameter), so QLD/SA/TAS/ACT/NT/WA can encode their own treatment of `workers_comp_absence`, `unpaid_parental_leave`, etc. This is the only engine change E2 needs; it preserves all NSW behaviour by passing the existing NSW table as the default.
- Lookback-window arithmetic, normalisation, system-formula computation.

**Concerns that move into the per-state rule set** (mirroring NSW's `rules/` folder):
- `accrual-table.ts` — qualifying period, accrual per year, pro-rata thresholds, termination-reason qualifying lists.
- `value-of-week.ts` — ordinary-pay definition. ACT diverges by including overtime; SA may diverge on PH-during-leave inclusion (F11).
- `trigger-handlers.ts` — trigger-kind → citation list, plus state-specific trigger preconditions (e.g. F5/F6 cashing-out hard error for VIC/NT).
- `continuous-service-rules.ts` (new per-state file) — the state's `SERVICE_EVENT_RULES` table including break tolerance, rehire gap threshold, regime-split thresholds.

This is **the contract**. Every new state implements this shape. The dispatcher (next decision) selects the right orchestrator.

---

### P0.2 — DEV-E2-M2 · Dual-regime state encoding (VIC, WA) (RESOLVED — re-scoped 2026-05-24)

**VIC re-scope (TBD-VIC-01, 2026-05-24)**: the original v0.3.0 plan called for two parallel rule sets per state (`vic-pre-2018/` and `vic-post-2018/`). Per the resolution recorded in `docs/qa/test-cases-vic.md` TBD-VIC-01, this is replaced by **one VIC rule set with date-aware continuous-service handling**. VIC LSL Act 2018 s.6 calculates entitlement on the employee's *total* period of continuous employment — singular, undivided. The transitional rules in s.57 affect *which absences count* toward continuous employment, not the entitlement-weeks formula. The pre/post-1/11/2018 split therefore applies to *per-absence rule selection* (which continuous-service-rule module to invoke for each historical absence) and NOT to two parallel entitlement engines.

**Three candidate patterns** evaluated against the criterion "testability of each regime in isolation":

- (a) Engine-level `selectRuleSetByDate(state, employee)` per segment, engine sums segments. Rejected: forces the engine to know about state-specific regime cutoffs, leaks state knowledge into shared code.
- (b) Per-state dispatcher module that internally branches between two parallel rule sets selected by date. Rejected for VIC after TBD-VIC-01: the s.6 entitlement formula applies to total continuous employment, not segments, so two parallel entitlement engines is the wrong model.
- (c) **VIC: one rule set with two continuous-service-rule modules selected by absence start date. Selected.**
- WA: pattern (b) remains correct — WA's 2022 amendment is structurally different (changed accrual structure, not just continuous-service treatment). WA layout unchanged.

**Decision (VIC): one rule set; absence-start-date-aware continuous-service rule selection.**

VIC layout:
```
website/src/lib/lsl/states/vic/
├── index.ts                            # calculateVIC orchestrator — single entitlement path
├── rules/
│   ├── accrual-table.ts                # 2018 Act s.6 accrual — applies to all VIC employees
│   ├── value-of-week.ts                # s.15 fixed-rate + s.15(2) 3-tier averaging + s.16 hours-changed
│   ├── trigger-handlers.ts             # incl. F5 cashing-out hard error (s.34)
│   └── continuous-service/
│       ├── index.ts                    # selects pre-2018 or post-2018 module per absence start date
│       ├── rules-pre-1nov2018.ts       # 1992 Act s.62/62A/63 rules — applies to absences starting before 1 Nov 2018
│       └── rules-post-1nov2018.ts      # 2018 Act s.12/13/14 rules — applies to absences starting on/after 1 Nov 2018
└── __tests__/
    ├── gold-standard.test.ts           # all VIC fixtures
    └── fixtures/
        ├── post-2018/                  # employees entirely post-1/11/2018
        ├── straddling/                 # employees whose service crosses 1/11/2018 (absences span the cutoff)
        └── transitional/               # pre-2018-started absences governed by 1992 Act rules per s.57
```

`calculateVIC(employee, trigger)`:
1. Determine effective service start (with **VIC 12-week break tolerance** instead of NSW's 60-day).
2. Walk `employee.serviceEvents`; for each absence, select the continuous-service rule module by `absence.startDate < 2018-11-01` (→ `rules-pre-1nov2018`) or `>= 2018-11-01` (→ `rules-post-1nov2018`). For absences that themselves straddle 1/11/2018 (e.g. Olivia, TC-VIC-037), split into two segments by date and apply each module to its segment.
3. Sum days_excluded_from_service across all absences.
4. Compute total period of continuous employment = (elapsed since effective service start) − sum(days_excluded).
5. Apply s.6 accrual formula once: `years_of_continuous_service × (8.6667 / 10)` weeks. The accrual ratio is unchanged across both Acts (APA training is explicit, p.32 and p.45).
6. Apply s.15 / s.16 to compute value-of-week.
7. Emit citations from each continuous-service-rule module that fired, plus the single s.6 accrual citation.

This is simpler than the original (b) pattern: one accrual table, one value-of-week, one trigger-handlers module — only the continuous-service handling is date-aware. Effort estimate revised downward by ~2 days (8 → 6).

**WA layout unchanged** — follows the original pattern (b) with cutoff = 2022-06-20 (`rules-pre-2022` / `rules-post-2022`). WA's 2022 amendment changed the accrual structure itself, so two parallel rule sets remain the right model. WA Workers Comp counting only from 2024-07-01 (F8) is encoded inside `rules-post-2022/continuous-service-rules.ts` as a date-aware override.

**Single-regime states** (QLD, SA, TAS, ACT, NT) have no `rules-pre-X / rules-post-X` split; their `rules/` directory mirrors NSW's flat structure.

**Ambiguity surfacing (F7, F12 / AC8)**: WA's regime split requires data-granularity checks (e.g., monthly pay periods that straddle the cutoff). VIC does NOT — the date-aware continuous-service handling operates on `serviceEvent.startDate`, which is always known. VIC fixture coverage therefore does not require a `regime_split_data_insufficient` warning path; the WA orchestrator retains that warning per F7.

---

### P0.3 — DEV-E2-M3 · CI parallelisation strategy (RESOLVED)

**Decision: GitHub Actions matrix strategy on `state`**, plus a separate `engine` job.

```yaml
strategy:
  fail-fast: false
  matrix:
    state: [nsw, vic, qld, wa, sa, act, tas, nt, engine]
```

Each matrix shard runs `vitest run website/src/lib/lsl/states/{state}/__tests__/` (or `engine/` for the engine shard). With NSW currently at 227 unit tests passing in ~30s on the standard runner, parallelised at 8 shards the worst-case wall time stays well inside the 5-minute AC23 ceiling even if each state plateaus around 250 tests. The engine shard is intentionally separate because it touches every state via the cross-state regression rule (AC22).

**Cross-state regression on engine changes (F20 / AC22)**: a separate `cross-state-regression` job triggered only on PRs touching `website/src/lib/lsl/engine/` or `website/src/lib/lsl/citations/`. It runs ALL state suites in matrix and posts a PR comment via `peter-evans/create-or-update-comment` listing pass/fail/unchanged per state. On non-engine-touching PRs (e.g. a VIC-only change), only NSW + the changed state matrix shards run, to preserve runner-minute budget.

**Test-impact-analysis fallback**: deferred to Phase 9 (TAS or NT, whichever first overshoots the 5-minute envelope). Not built up-front because the matrix-shard approach has a generous margin.

**Per-state CI duration metric** (DEV-E2-M3 telemetry sub-item): emit job-duration to GitHub Actions summary; aggregate into a simple line in `docs/engineering/` after each state ships. Not a Datadog/PostHog dependency — repo-local artifact.

---

### P0.4 — DEV-E2-M4 · Per-state telemetry event taxonomy (RESOLVED)

**Decision: `{state_lowercase}_{event_name}` flat scheme** with the same PII-stripped page-event shape as the E1 telemetry shipped in `a6cf665`.

State-specific page events introduced in E2:
- `vic_cashout_hard_error` (AC5)
- `nt_cashout_hard_error` (AC6)
- `vic_regime_split_applied` — both pre- and post-Nov-2018 segments contributed
- `vic_regime_split_data_insufficient` — fallback to single-regime
- `wa_regime_split_applied` — both pre- and post-Jun-2022 segments contributed
- `wa_regime_split_data_insufficient` — fallback to single-regime
- `wa_workers_comp_pre_2024_excluded` — at least one absence segment had days dropped
- `act_overtime_included_in_ordinary_pay` — F9 ACT casual/part-time path activated
- `sa_ph_inclusive_in_leave_period` — F11 path activated
- `bulk_csv_state_column_missing` — batch-level error
- `bulk_csv_row_state_invalid` — row-level error (event includes anonymised count, never the value)

**PII rule (S2)**: no event carries the user input (no employee name, no dates, no $ values). Counters and state-name booleans only. Each new state's orchestrator gates its events behind a single `emitTelemetry({page_event, state})` helper — same wire as E1.

---

### P0.5 — DEV-E2-M5 · State detection in PDF extraction (RESOLVED)

**Decision: extend the existing Anthropic extraction prompt to ATTEMPT state detection per employee with a confidence score, but require user confirmation in the editable preview when confidence < 0.75.**

Changes to `website/src/lib/lsl/parsers/pdf/`:
- `schema.ts` — add `detected_state` (nullable enum of the 8 states) and `state_confidence` (0..1) per employee block in the structured response.
- `prompts.ts` — append: "If the PDF text or header clearly identifies a jurisdiction (state name, state abbreviation in a recognised position such as a header or letterhead), populate `detected_state` and `state_confidence`. If ambiguous or absent, set both to null." Includes the explicit canonical state values.
- The editable preview surfaces low-confidence detections as a row-level warning with a state-selector dropdown defaulting to the detection.

**ZDR / contract impact**: the prompt change does not alter the no-retention contract — it adds output fields, doesn't change data-handling. No Anthropic re-confirmation needed.

---

### P0.6 — DEV-E2-M6 · ACT overtime-hours input shape (RESOLVED)

**Decision: per-state `extraInputs?: Record<string, unknown>` field on `Employee`**, with each state's module documenting its own keys.

Type change in `engine/types.ts`:

```ts
export interface Employee {
  // ...existing fields...
  /** State-specific extension fields. Schema documented per-state in `states/{state}/extra-inputs.ts`. */
  extraInputs?: Record<string, unknown>;
}
```

For ACT, the documented shape (in `website/src/lib/lsl/states/act/extra-inputs.ts`):

```ts
export interface ACTExtraInputs {
  /** Overtime hours per pay period — used in ordinary-pay computation for part-time/casual per ACT LSL Act 1976 s.4. */
  overtimeHoursByPeriod?: Array<{ periodStart: ISODate; periodEnd: ISODate; hours: number }>;
}
```

Form-level conditional rendering: the ACT overtime-hours input only renders when `state === 'ACT' && employment_type ∈ {part_time, casual}` per F16/AC18. When state changes away from ACT, the value is cleared from form state but not from `extraInputs` (so a user toggling back doesn't lose data within a session).

---

### P0.7 — Resolved LOW findings (in-line)

- **DEV-E2-L1 (quick-pick chips F22)** — implementation: `lsl-calculator:state-recent:v1` localStorage key, LRU array length 3. Same persistence model as `LOCAL_STORAGE_KEY` in `form-to-engine.ts`. Task added to Phase 1 (state selector).
- **DEV-E2-L2 (per-state docs page F21)** — `website/src/app/calculator/about/{state}/page.tsx` scaffold per state, placeholder content authored by PM after rule-set merges. Task scheduled in each state's phase; does not block AC1–AC4 (the engine work).
- **DEV-E2-L3 (bulk PDF state-coverage header F23)** — small extension to the existing bulk PDF export template. Lands once with VIC, then unchanged.
- **DEV-E2-L4 (PR-comment integration AC22)** — built in Phase 0 CI workflow setup, validated when VIC ships.
- **DEV-E2-L5 (heuristic F25)** — obsolete; RES-5 deferred to v2. No tasks.

---

## Phase 1 — Foundation (shared, runs before any state)

The shared scaffolding that VIC depends on. **No state-specific rules in this phase** — only the abstractions every state will consume.

**Effort estimate**: M (3–4 days)

1. Define `StateRuleSet` interface at `website/src/lib/lsl/states/StateRuleSet.ts`. Update NSW to formally implement it (typing-only change; no runtime effect).
2. Add `extraInputs?` to `Employee` in `engine/types.ts` (per P0.6).
3. Refactor `engine/continuous-service.ts` to accept a `ServiceEventRulesProfile` parameter (per P0.1 last bullet). Move NSW's existing `SERVICE_EVENT_RULES` table to `states/nsw/continuous-service-rules.ts` and pass it explicitly from `calculateNSW`. Verify NSW gold-standard suite unchanged at 100%.
4. Build the state dispatcher: `website/src/lib/lsl/dispatch.ts` exporting `calculate(employee, trigger) → Result`. Internally maps `employee.governingJurisdiction ?? employee.statesOfService[0] ?? 'NSW'` to the matching `calculate{STATE}` function. Bulk runner calls this; single-mode form calls this. (Replaces the direct `calculateNSWSafe` import in `bulk-runner.ts`.)
5. State selector UI primitive at `website/src/components/lsl/state-selector.tsx` — accessible select (shadcn `Select`), 8 states, persists via `lsl-calculator:state-recent:v1` localStorage, returns top-3 quick-pick chips above the full list (F22).
6. CI workflow: GitHub Actions matrix on `state` per P0.3. Initial matrix `[nsw, engine]` only (other entries added as states ship). PR-comment job behind path filter on `engine/**` and `citations/**`. Acceptance: NSW suite still green at 100%, new matrix configuration produces a successful CI run on PR.
7. Telemetry helper `emitTelemetry({page_event, state})` at `website/src/lib/telemetry/state-event.ts` per P0.4. Same wire format as E1 telemetry; gated by env-var to avoid noise in CI.
8. Form-level `state` field added to `FormState` and `validateForm` (already present but unsupported in `formToEngine`); `formToEngine` now sets `governingJurisdiction = state` for single-mode, single-state employees. ACT conditional overtime field stubbed but disabled until Phase 7.

**Exit criteria for Phase 1**:
- NSW gold-standard suite still 100% green.
- New `dispatch.calculate(employee, trigger)` produces byte-identical NSW results vs. direct `calculateNSWSafe`.
- CI workflow runs successfully on a PR with no functional changes.
- State selector renders + persists, but selecting non-NSW returns the existing `blocked_cross_jurisdiction` Result (gated by P0.1 — no state rule sets yet).

---

## Phase 2 — Bulk CSV mixed-state foundation (RES-4)

Lands once after Phase 1, applies to every subsequent state from VIC onwards. Independent of any single state's rules.

**Effort estimate**: M (2–3 days)

1. Extend CSV normaliser prompt to mark `state` (canonical column already exists in `normalize-schema.ts`) as REQUIRED in multi_employee mode for v1+. Update `normalize-prompt.ts` accordingly.
2. Add a "state column present + populated" row-level validation pass in `bulk-to-engine.ts`: if `state` column absent → batch error; if row has empty/unrecognised `state` value → row-level error surfaced in the editable preview per the existing F6c pattern. Valid rows in the same batch continue to process.
3. The "set of currently-encoded states" is a single source-of-truth constant `ENCODED_STATES` in `dispatch.ts` (initially `['NSW']`; appended on each state's Phase N merge).
4. Bulk preview table column for `state` is already partially present (jurisdiction-unblock modal exists from commit `9820d6e`); extend to render each row's `state` value and surface unrecognised values inline.
5. CSV-normaliser tests cover: missing `state` column → batch error; mixed valid+invalid rows → valid ones process, invalid surface as row errors; header-variant detection (`state`, `State`, `STATE`, `jurisdiction`, `Jurisdiction`).
6. PDF extraction schema/prompt updates per P0.5.

**Exit criteria for Phase 2**:
- A CSV with only NSW rows still processes byte-identically.
- A CSV with NSW rows AND any non-encoded state value (e.g. `VIC`) surfaces the `VIC` rows as row-level "unsupported state" errors and processes the NSW rows successfully.
- PDF-bulk now returns `detected_state` per employee with confidence; low-confidence detections route to user confirmation.

---

## Phases 3–9 — Per-state encoding (one phase per state, in RES-1 order)

The seven phases below share an identical shape; they vary only in legislation specifics. Each phase is gated by the prior phase reaching `state deployed to prod + PM-signed test-cases.md` per AC4a/AC4b.

**Shape of one state's phase** (substitute `{STATE}` and its act sections):

- **Step 1 — Test-cases artifact + PM sign-off (AC4)**. Author `docs/qa/test-cases-{state}.md` listing every APA-PDF worked example for this state, ≥5 state-unique edge cases, ≥1 bulk-mode multi-employee fixture. PM signs. **Blocks coding until signed.**
- **Step 2 — Build per-state continuous-service-rules table**. Encode the state's service-event treatment (break tolerance, rehire gap, workers-comp counting rules, regime cutoffs).
- **Step 3 — Build per-state accrual table**. Qualifying period, accrual per year, entitlement weeks at milestones, pro-rata threshold logic.
- **Step 4 — Build per-state value-of-week**. Ordinary-pay definition; state-specific divergences (ACT overtime; SA PH-inclusive).
- **Step 5 — Build per-state trigger handlers**. Trigger-kind citations + state-specific trigger preconditions (cashing-out hard errors for VIC/NT).
- **Step 6 — Wire orchestrator `calculate{STATE}` + `calculate{STATE}Safe`**. Implement `StateRuleSet` interface.
- **Step 7 — Gold-standard fixtures**. Translate every test-cases-{state}.md row into a `__tests__/fixtures/single/{TC-{STATE}-NNN}.json` fixture in the same shape as NSW.
- **Step 8 — Wire into `dispatch.calculate`**. Add `{STATE}` to `ENCODED_STATES`. Add the state to `bulk-runner` allowed list.
- **Step 9 — UI conditionals**. Any state-specific input fields (ACT overtime); citation-block source reference; form labels.
- **Step 10 — Docs page**. `website/src/app/calculator/about/{state}/page.tsx`.
- **Step 11 — CI matrix shard**. Add `{state}` to the matrix in `.github/workflows/`.
- **Step 12 — Per-state launch gate (AC4b)**. PM-signed test-cases.md + automated suite 100% green in CI on merge commit. Deploy to prod. Update `epic-status.md` with state moving to Stage 5 (Shipped). **THEN** the next state in sequence may start.

### Phase 3 — VIC (RES-1 #1) — re-scoped 2026-05-24 per TBD-VIC-01

**Effort estimate**: M–L (4–6 days) — revised down from L (5–8 days) following TBD-VIC-01 resolution. Architectural simplification: one VIC rule set with date-aware continuous-service handling (not two parallel rule sets). Hard-error + criminal-offence framing still warrants a high QA bar; the saving is on duplicated accrual / value-of-week / trigger-handler scaffolding.

State-specific work beyond the generic shape:
- **One VIC rule set** with two continuous-service-rule modules (`rules/continuous-service/rules-pre-1nov2018.ts` and `rules-post-1nov2018.ts`) selected by absence start date per P0.2 (re-scoped).
- F5 cashing-out hard error path: `calculateVIC` checks trigger metadata for cashing-out intent (TBD shape — likely a new `Trigger` variant in v2; for v1, any explicit `cashOut: true` flag in trigger payload). Hard error returns `status: 'failed'` with `error.code = 'vic_cashout_prohibited'`, citation `LSL Act 2018 (Vic) s.34` (corrected from s.67 per TBD-VIC-12), no numeric outputs. Page event `vic_cashout_hard_error` emitted.
- Absence-split fixture coverage: post-2018 only, pre-2018 (transitional) only, straddling-1/11/2018 absences (e.g. Olivia, TC-VIC-037) split into two date segments.
- 12-week break tolerance replaces NSW's 60-day in the orchestrator's effective-service-start logic.
- Small `engine/types.ts` refactor: rename `gap_exceeds_2mo` warning code → `gap_exceeds_state_tolerance` per TBD-VIC-03. Touches NSW message wiring (preserved as "2 months") and VIC message wiring (new: "12 weeks"). Same enum value, parameterised message.
- LWOP cap interpretation: **per-period** per TBD-VIC-08. Each `leave_without_pay` event evaluated against the 52-wk cap independently.
- 7-year qualifying threshold inclusive at exactly 7 years (TBD-VIC-06): `years_of_continuous_service >= 7.0000`.
- Sub-7-yr advisory warning (TBD-VIC-07): when trigger is death/illness at sub-7-yr tenure, emit `sub_7yr_review_industrial_instrument` non-blocking warning.
- VIC docs page emphasises cashing-out prohibition + transitional s.57 handling.

### Phase 4 — QLD (RES-1 #2)

**Effort estimate**: M (3–5 days) — single regime; the complexity is QIRC/EA-restricted cashing-out language (not a hard error, but a citation note).

Highlights:
- 3-month break tolerance.
- Cashing-out: not blocked, but emits citation referencing the QIRC/EA-permission rule.

### Phase 5 — WA (RES-1 #3)

**Effort estimate**: L (5–8 days) — second dual-regime state; PLUS the 2024-07-01 Workers Comp sub-cutoff.

Highlights:
- Two sub-rule-sets `rules-pre-2022/` and `rules-post-2022/`.
- In `rules-post-2022/continuous-service-rules.ts`, Workers Comp absences have an effective-date predicate: `countsAsService = (absenceDate >= 2024-07-01)`. Pre-2024 portions of a Workers Comp event are excluded from service.
- F8/AC9 fixture coverage: Workers Comp event spanning 2024-07-01 (some days count, some don't).
- F7/AC8 fixture coverage: regime-split data-insufficient fallback path.

### Phase 6 — SA (RES-1 #4)

**Effort estimate**: M (3–5 days).

Highlights:
- 13-week first entitlement at 10 years (F10/AC12). Separate accrual table from the 8.6667-states.
- PH-inclusive-of-leave (F11/AC13) — value-of-week or trigger-handler concern (TBD, but encoded in the SA `value-of-week.ts` is cleanest because the leave-period calculation feeds the value).
- Written-agreement cashing-out — citation note only, no hard error.

### Phase 7 — ACT (RES-1 #5)

**Effort estimate**: L (5–7 days) — overtime-inclusive ordinary-pay is the highest mis-coding risk in the entire epic.

Highlights:
- 7-year qualifying period (equal-lowest with VIC).
- F9/AC11 overtime-hours-in-ordinary-pay: the ACT `value-of-week.ts` reads `employee.extraInputs.overtimeHoursByPeriod` and adds overtime $ to the gross-weekly base for part-time/casual.
- ACT-only form field (overtime hours per period) enabled in `single-mode-form.tsx`; conditional on `state === 'ACT' && employment_type ∈ {part_time, casual}`.
- Citation block explicitly notes the divergence from NSW (F9 last sentence) — a static citation `{ section: 'ACT LSL Act 1976 s.4', rule: 'value-of-week.act.divergence-from-nsw', note: 'ACT includes overtime hours; NSW excludes them.' }`.
- Termination-paid-within-90-days (vs NSW immediate) — a `payable_by` field surfaces in the result UI when applicable.

### Phase 8 — TAS (RES-1 #6)

**Effort estimate**: M (3–4 days).

Highlights:
- 3-month break tolerance (same as QLD; consider sharing a constant).
- Cashing-out permitted only after entitlement accrues — citation note.
- No advance leave — trigger-handler refuses `taking_leave` when years-of-service < 10.

### Phase 9 — NT (RES-1 #7)

**Effort estimate**: M (4–5 days).

Highlights:
- 13-week first entitlement at 10 years (same accrual table as SA — share where possible).
- F6/AC6 cashing-out hard error: same shape as VIC F5, but cites `LSL Act 1981 (NT) s.12`. Page event `nt_cashout_hard_error`.
- Strongest s.16 restriction on working elsewhere during LSL — citation note in the leave-taking trigger handler.

---

## Phase 10 — E2 closeout

After NT ships, the closeout phase finalises cross-cutting acceptance criteria that depend on ALL eight states being live.

**Effort estimate**: S–M (2–3 days)

1. Run the full cross-state regression on every engine file touched during E2; verify zero breakage in any state.
2. WCAG 2.2 AA automated scan + manual keyboard run of state selector, conditional fields (ACT overtime), and cross-jurisdictional nomination dialog (AC17–AC19, A1–A3, SC9).
3. Performance bench: P95 single-mode ≤ 2s, bulk P95 ≤ 60s for 500 mixed-state employees (P1/P2/SC4).
4. CI runtime audit per AC23: matrix wall-clock ≤ 5 min.
5. Update `docs/product/epic-status.md` with E2 → Stage 5 (Shipped).
6. Scaffold `docs/operational/legislation-quarterly-review-template.md` (RES-3 quarterly review template — operational doc, owned by Tracy). One-page checklist of all 8 jurisdictions + their gazette URLs from spec §Constraints; PM fills it on 1 March / 1 June / 1 September / 1 December.

---

## Risks & assumptions

| ID | Risk / assumption | Mitigation |
|---|---|---|
| R1 | NSW Phase 3–7 work (PDF extraction Phase 3+, logins Phase 7) shifts the engine surface mid-E2. | The Phase 1 refactor (extracting `SERVICE_EVENT_RULES` from continuous-service.ts) is the only engine touch this epic does. Any NSW change touching `engine/` triggers the cross-state regression CI job (AC22) — breakage surfaces immediately. Operator has accepted this risk per the spec pattern-dependency notice. |
| R2 | The `Trigger` type may need a `cashOut: boolean` discriminant to express F5/F6 hard-error paths cleanly. | Currently the Trigger union has no cashing-out variant. Add a new variant `{ kind: 'cash_out'; cashOutDate: ISODate }` in Phase 3 (VIC) — first state that needs it. NSW and any not-yet-shipped state default to throwing `EngineError('cash_out_not_supported')` for unknown trigger kinds. |
| R3 | The classifier may not survive an ACT input shape that has overtime hours alongside gross — gross-CV alone may misclassify an ACT casual whose overtime is volatile. | The classifier change in Phase 7 (ACT) is to add a per-state `classify` override path: ACT's orchestrator can re-classify after computing the overtime-inclusive weekly value. The shared `classify(employee)` remains the default; states opt in. |
| R4 | Bulk CSV mixed-state perf — `dispatch.calculate` per row is one extra function-call hop per employee. At 500 rows × 8 possible states, cache locality may suffer marginally. | Negligible at 500 rows; v-table-style dispatch in JS is cheap. Re-measure in Phase 10 closeout. |
| R5 | Per-state docs pages (DEV-E2-L2) are an authoring bottleneck on PM. | The Phase-N task only scaffolds the page with placeholder content; the prose can be written and pushed in a follow-up. Per-state launch gate (AC4b) does NOT include docs-page sign-off — only the test-cases.md and the suite. |
| R6 | `calculate` rename — `calculateNSW` is exported from `engine/index.ts`. Adding `dispatch.calculate` may create a naming collision. | Phase 1 step 4: keep `calculateNSW` exported (back-compat for any existing imports) AND add `dispatch.calculate` as the new top-level entry. No deprecation; tests of each state's orchestrator continue to call `calculate{STATE}` directly. |

---

## Effort summary

| Phase | Scope | Effort |
|---|---|---|
| 1 | Shared foundation | M (3–4 days) |
| 2 | Bulk CSV mixed-state foundation | M (2–3 days) |
| 3 | VIC | M–L (4–6 days) — revised 2026-05-24 per TBD-VIC-01 (was 5–8 days) |
| 4 | QLD | M (3–5 days) |
| 5 | WA | L (5–8 days) |
| 6 | SA | M (3–5 days) |
| 7 | ACT | L (5–7 days) |
| 8 | TAS | M (3–4 days) |
| 9 | NT | M (4–5 days) |
| 10 | E2 closeout | S–M (2–3 days) |
| **Total** | | **34–50 dev-days** (was 35–52; ~2 days saved on VIC re-scope) |

Effort is sequential (per AC4a) — phases 3 through 9 cannot parallelise without operator override. Phases 1 and 2 can overlap (different code paths). Phase 10 starts when NT (Phase 9) ships.

---

## Dev findings — final state

| Finding | Status | Resolution location |
|---|---|---|
| DEV-E2-M1 | Resolved | P0.1 |
| DEV-E2-M2 | Resolved | P0.2 |
| DEV-E2-M3 | Resolved | P0.3 |
| DEV-E2-M4 | Resolved | P0.4 |
| DEV-E2-M5 | Resolved | P0.5 |
| DEV-E2-M6 | Resolved | P0.6 |
| DEV-E2-L1 | Resolved | P0.7 (Phase 1 task) |
| DEV-E2-L2 | Resolved | P0.7 (per-state task) |
| DEV-E2-L3 | Resolved | P0.7 (Phase 3 task) |
| DEV-E2-L4 | Resolved | P0.7 (Phase 1 CI task) |
| DEV-E2-L5 | Obsolete | RES-5 — F25 removed from v1 scope |

**Unresolved findings: none.**
