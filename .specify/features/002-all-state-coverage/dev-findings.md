# Dev Findings — All-State Coverage (E2)

**Source spec**: `.specify/features/002-all-state-coverage/spec.md` v0.1.0
**Date**: 2026-05-23 (DEV-CROSS-1 added 2026-05-25)
**Owner**: developer agent (resolves these in Phase 0 of `dev-feature-plan`)

These findings are routed from `pm-analyze-split` and are out-of-scope for PM resolution. They concern technical architecture, NFRs in engineering units, and implementation detail.

---

## HIGH severity

_None._

## MEDIUM severity

### DEV-CROSS-1 · Termination-reason enum redesign (state-agnostic refactor)

**Surfaced from**: TBD-QLD-06 (Phase 4 PM resolution, 2026-05-25). The same disambiguation surfaces for WA/SA/TAS/ACT/NT — each has analogous qualifying-reason taxonomies — so this is routed here rather than retrofitted per-state.

**Section**: F2, F16, AC1, AC11, AC18; affects `engine/types.ts` Trigger interface; affects single-mode form UI for every state phase ≥ QLD.

**Issue**: The current `Trigger.reason` enum (NSW + VIC) is too coarse to express the QLD s.95(3) qualifying-reason taxonomy AND will be too coarse for the equivalent provisions in WA/SA/TAS/ACT/NT. Specifically:
- `voluntary_resignation` — does NOT qualify under QLD s.95(3); MAY qualify in some other states.
- `illness_incapacity` — qualifies under QLD s.95(3)(b) IF employee-initiated, QLD s.95(3)(c) IF employer-initiated. NSW LSA s.4(2)(a)(iii)(b) has its own illness-employee-initiated distinction. ACT and TAS have separate illness provisions.
- `domestic_pressing_necessity` — qualifies under QLD s.95(3)(b) (employee-initiated only). No current enum value.
- `death` — qualifies in all states.
- `redundancy` — qualifies broadly; existing enum value is fine.
- `employer_initiated_not_misconduct` — qualifies under QLD s.95(3)(d); equivalent provisions in WA/SA/TAS. No current enum value.
- `serious_misconduct` — does NOT qualify in QLD sub-10-yr (s.95(3)(d) excludes "conduct"); MAY qualify in VIC (no misconduct exception).
- `poor_performance` — does NOT qualify in QLD sub-10-yr (s.95(3)(d) excludes "performance"). No current enum value as a distinct case from `serious_misconduct`.
- `incapacity_dismissal` — Ambiguous: in QLD it conflicts with s.95(3)(c) (employer dismissal for illness, pays out) vs s.95(3)(d) (employer dismissal for capacity, does NOT pay out).
- `unfair_dismissal` — qualifies under QLD s.95(3)(e); analogous in NSW/VIC unfair-dismissal jurisdictions. No current enum value.

The illness/incapacity case is particularly tricky: in QLD, s.95(3)(b) (employee illness resignation) and s.95(3)(c) (employer illness dismissal) both pay out, but s.95(3)(d) (employer dismissal for capacity/performance) does NOT pay out. The engine needs to disambiguate by both `reason` AND who initiated the termination.

**Recommendation** (final design TBD by developer agent during refactor PR):
1. Add `terminationInitiator: 'employee' | 'employer'` as a sibling field to `Trigger.reason` on the termination trigger variant. Default to `'employee'` when not supplied (matches the most common case = resignation).
2. Add new `reason` enum values: `domestic_pressing_necessity`, `unfair_dismissal`, `employer_initiated_not_misconduct`, `poor_performance`.
3. Distinguish `incapacity_dismissal` from `poor_performance` explicitly at the user-facing form level (different dropdown options).
4. Combine `reason` + `terminationInitiator` to determine each state's sub-paragraph mapping inside that state's `trigger-handlers.ts`.
5. Update existing NSW + VIC orchestrators to accept the new enum values (no behaviour change — they don't currently consume the new values, so the cases are no-ops).
6. Update single-mode form UI: conditional `terminationInitiator` field appears when `trigger.kind === 'termination' && (reason === 'illness_incapacity')` (other states may surface it for additional reason values; QLD is the first).

**Scope**: state-agnostic refactor PR — touches `engine/types.ts`, every per-state `trigger-handlers.ts` (NSW, VIC currently shipped; QLD wired in T4.2 to expect the new shape but tolerate the v1 enum subset), single-mode form UI, plus a small form-state migration in `formToEngine.ts`.

**Sequencing**: deliver as its own PR between QLD v1 launch (Phase 4 launch gate) and WA Phase 5 start. After it lands, reinstate the 5 deferred QLD fixtures (TC-QLD-005, -007, -008, -015, -016 per `docs/qa/test-cases-qld.md` "Deferred to cross-state termination-enum refactor" appendix) via a small follow-up PR (estimated S — under half a day).

**Why not bundle into QLD v1**: bundling would (a) inflate the QLD per-state PR with code that has no QLD-specific behaviour, (b) force NSW + VIC orchestrators to be updated inside the QLD PR (cross-cutting change inside a per-state PR), and (c) couple the QLD launch gate (AC4b) to a refactor that touches every state's surface. The cleaner path is a tight QLD v1 PR using the existing enum, then DEV-CROSS-1 as a state-agnostic refactor, then a small QLD follow-up adding the 5 fixtures.

**Pre-flight blocker for**: WA Phase 5 (T5.2 pre-2022 rules will want the disambiguation). Should land before WA Phase 5 starts.

**Effort estimate**: M (1–2 days for the refactor + tests; under half a day for the QLD-fixtures follow-up).

---

### DEV-E2-M1 · Engine-vs-rule-set boundary contract

**Section**: F2, F19, AC22, Design § High-level strategy
**Issue**: The spec asserts "engine unchanged" and "per-state rule set under `website/src/lib/lsl/states/{state}/`" but does not formally document the interface contract. As written, dev could legitimately read either as (a) the rule set exposes a `calculate(input) → Result` function, or (b) the rule set exposes a bundle of named functions (`classify()`, `accrual()`, `continuousService()`, `valueOfWeek()`) and the engine orchestrates them.
**Remediation**: dev to read the E1 NSW implementation (`website/src/lib/lsl/states/nsw/`) on the `001-nsw-calculator` branch, extract the actual exposed interface, document it as a TypeScript interface in `website/src/lib/lsl/states/StateRuleSet.ts`, and have all 7 new states implement it. If the NSW implementation does not yet stabilise this interface (Phase 3+ work may shift it), defer state #2 (the first non-NSW state) until NSW reaches Phase 6/7 and the interface is frozen.
**Pre-flight blocker for**: state #1 development start.

### DEV-E2-M2 · Dual-regime state encoding pattern (VIC, WA)

**Section**: F7, F8, F12, AC7, AC8, AC10, Design § Key decisions
**Issue**: Spec proposes "two rule sets per state, selected by date" for dual-regime states but does not specify the orchestrator. Where does the date-based selection live — in the engine, in a per-state dispatcher module, in the rule set itself?
**Remediation**: dev to choose one of three patterns and document the choice in `impl-plan.md`:
- (a) Engine-level `selectRuleSetByDate(state, employee)` returns a single rule set per employee segment, then the engine sums segments.
- (b) Per-state dispatcher module under `website/src/lib/lsl/states/vic/` that internally branches between `vic-pre-2018/` and `vic-post-2018/` rule sets.
- (c) Single rule set per dual-regime state with explicit `if (date < threshold)` branching inside each rule.
Choice should optimise for testability of each regime in isolation. Pattern (b) is most likely correct; spec defers to dev judgement.

### DEV-E2-M3 · Cross-state regression suite parallelisation

**Section**: F19, F20, AC21, AC22, P3, AC23
**Issue**: AC23 mandates "under 5 minutes" for all 8 state suites + engine suite on the standard CI runner. With NSW alone at 227 unit tests (per `epic-status.md`), 8 states could plausibly hit 1,500+ unit tests + Playwright E2E. Sequential execution may breach 5 minutes.
**Remediation**: dev to design CI workflow with per-state parallel jobs (e.g., GitHub Actions matrix strategy on `state`) and validate runtime in a preview branch before committing to AC23. If runtime overshoots, either bump P3 or implement test-impact-analysis (only re-run suites for states whose rule set or shared dependency changed).
**Telemetry**: dev to add CI duration metric per-state to make breach visible.

### DEV-E2-M4 · Per-state telemetry event taxonomy

**Section**: S2, AC5, AC6
**Issue**: Spec calls out `vic_cashout_hard_error` and `nt_cashout_hard_error` as page-event names but does not define the full taxonomy. Future audit will want consistent naming (`{state}_{event}` vs `{event}_in_{state}` vs flat names per event).
**Remediation**: dev to define the per-state telemetry event taxonomy in `impl-plan.md` Phase 0, consistent with the E1 telemetry pattern shipped in commit `a6cf665` (Phase 5 Wave 1 — telemetry). Each state-specific hard error gets one page event; the schema is the same as NSW's existing telemetry. PII MUST NOT be logged (S2).

### DEV-E2-M5 · State detection in PDF extraction

**Section**: F17, OQ for PDF extraction
**Issue**: F17 says PDF bulk uploads must have the state "nominated at upload time or inferred per-employee where the PDF clearly identifies the jurisdiction". The LLM extraction prompt currently (E1 Phase 3) does not extract a state field; it extracts wage history only. Either the prompt extends, or the user always nominates at upload.
**Remediation**: dev to extend the Anthropic extraction prompt to attempt state detection per employee (looking for `NSW`, `Victoria`, `Vic`, `QLD`, etc. anywhere in the PDF text/header), return the detected state with a confidence score in the structured response, and surface low-confidence detections in the editable preview for user confirmation. The prompt change MUST be reviewed against the no-retention contract (no schema change implies a contract change; verify with Anthropic if uncertain).

### DEV-E2-M6 · ACT overtime-hours input shape

**Section**: F2, F9, F16, AC11, AC17, AC18
**Issue**: ACT casuals require overtime hours per ACT LSL Act 1976 s.4. The E1 v0.5.0 spec (Clarification Summary #5) explicitly removed hours data from the NSW input shape because hours are irrelevant in NSW. ACT re-introduces it.
**Remediation**: dev to design the ACT input shape so the overtime-hours field is *conditional on `state = ACT && employment_type ∈ {part_time, casual}`* and does not propagate into the shared `Employee` schema. Recommended: per-state `extraInputs: Record<string, unknown>` field on `Employee`, with the ACT module documenting its expected keys.

## LOW severity

### DEV-E2-L1 · State quick-pick chips (F22)

**Section**: F22 SHOULD
**Issue**: F22 specifies "last 3 states used" as quick-pick chips. Implementation detail: storage key, eviction order, sync across tabs.
**Remediation**: dev to follow the same browser-local storage pattern as E1 F20 (most-recent calculation persistence). Use a single localStorage key (`lsl.state.recent`) holding an LRU-ordered array of 3.

### DEV-E2-L2 · Documentation page per state (F21)

**Section**: F21 SHOULD
**Issue**: Each state needs a "Why this number?" doc page. Pages live where? Content authored by whom?
**Remediation**: dev to scaffold `website/src/app/calculator/about/{state}/page.tsx` per state with placeholder content; PM (or APA-engaged specialist per OQ-6) authors the prose. This is a documentation deliverable separable from the engine work and should not block AC1–AC4.

### DEV-E2-L3 · Bulk export PDF state-coverage summary header (F23)

**Section**: F23 SHOULD
**Issue**: The multi-page PDF export needs a summary header counting employees per state. Implementation: PDF template change, not engine change.
**Remediation**: dev to extend the existing E1 bulk PDF export template (commit `9820d6e` — BulkResultsTable + jurisdiction-unblock) with a state-coverage summary row. Straightforward; logs as a Phase-N task per state or as a one-shot improvement when state #2 ships.

### DEV-E2-L4 · Engine-file PR comment integration (AC22)

**Section**: F20, AC22
**Issue**: PR comment listing which state suites passed/failed/unchanged on engine-file changes. Implementation: GitHub Actions PR comment using the `peter-evans/create-or-update-comment` action or equivalent.
**Remediation**: dev to add to CI workflow when state #2 ships (single-state changes don't need this; only changes touching `engine/` or `citations/` do).

### DEV-E2-L5 · Heuristic governing-state advisory (F25 MAY)

**Section**: F25, OQ-4
**Issue**: F25 is a MAY only; if the operator declines OQ-4's advisory option, this finding becomes obsolete.
**Remediation**: defer until OQ-4 is resolved. If accepted, dev to design the heuristic (proportion of service per state + anchor-of-employment + recent state) with strict "advisory, not legal advice" framing, citation back to PDF p.138.

---

## Pre-flight blockers summary

Before development of **state #1** begins:
1. DEV-E2-M1 (engine-rule-set interface) — must be frozen.
2. OQ-5 (legislation source-of-truth and update cadence) — PM/operator decision, owner TBD.
3. OQ-6 (gold-standard sign-off authority per state) — PM/operator + APA decision.

Before development of **state #2** begins:
1. NSW (E1) must be at Stage 4 (Tested) at minimum, ideally Stage 5 (Shipped).
2. DEV-E2-M2 (dual-regime pattern) — documented in `impl-plan.md`.
3. DEV-E2-M3 (CI parallelisation strategy) — validated runtime stays under 5 minutes.
