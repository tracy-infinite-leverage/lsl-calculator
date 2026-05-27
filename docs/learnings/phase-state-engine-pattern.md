# State-Engine Phase Pattern (NSW → ACT → TAS → NT, proven 4x)

**Captured:** 2026-05-26 (post-TAS Phase 8 ship)
**Updated:** 2026-05-27 (post-NT Phase 9 ship — adds parallel-thread coordination, fixture-overlay recovery, `UI_SHIPPED_STATES` gate, warning-label audit)
**Status:** Reusable for any future state-engine-pattern epic. NT was the 8th and final Australian state, so further per-state work is unlikely — but the pattern transfers to any cross-jurisdictional rule-set epic.
**Source phases:** E1 NSW, E2/Phase 7 ACT, E2/Phase 8 TAS, E2/Phase 9 NT

This document captures the working pattern for shipping a new state's LSL engine. It's a playbook, not a rule — adapt to circumstances.

---

## Why this pattern works

Each Australian state's LSL Act has a unique calculation surface: different accrual rates, qualifying reasons, ordinary-pay definitions, casual continuity tests, retirement age treatments. Shipping a state cleanly requires:

1. A **PM-signed spec** before any code, so the developer has locked acceptance criteria
2. **Test-first**: gold-standard fixtures derived from the spec drive engine implementation
3. **Reconciliation cycle** between PM expectations and engine reality — handled in one consolidated PM ruling, not piecemeal
4. **Post-merge QA** verifies the spec on production, surfaces any follow-up bugs
5. **Audit trail**: every artifact (spec → engine → fixtures → QA report → handoff) lands on `main` with traceable cross-references

When all 5 are in place, the next state's pipeline takes ~5-7 dev-days end to end with low risk and full audit defensibility.

---

## The pipeline (T8.0 → T8.5 + close-out)

### Phase 0 — PM sign-off (T*.0)

**Owner:** product-manager agent.

1. PM agent reads `docs/research/lsl-pay-components-deep-research.md` (the 8-jurisdiction source-of-truth) for the target state.
2. Drafts `docs/qa/test-cases-{state}.md` mirroring the structure of the most recent state (e.g. TAS mirrored ACT exactly).
3. Surfaces blocking TBDs (typically 6–17 across Sev-1 / Sev-2 / Sev-3).
4. Conducts a conversational interview with the operator, one TBD at a time:
   - Plain-English explanation of the ambiguity
   - Legislative citation
   - 2–3 named options with trade-offs (dev cost, legal risk, completeness)
   - PM recommendation with rationale
5. Each operator answer is written back into the spec (`RESOLVED YYYY-MM-DD: Option (a) — …`).
6. After Sev-1 + Sev-2 are all resolved, PM flips status DRAFT → PM-SIGNED, defers Sev-3s as documented limitations.
7. Operator commits the signed doc on a `docs/{state}-test-cases-pm-signed` branch and merges via PR. **This is a docs PR — see CI escape-hatch note below.**

**Time:** ~30-60 min interview + commit + PR cycle.

### Phase 1 — Engine scaffold (T*.1)

**Owner:** developer agent.

1. Branch `feat/E*-{state}-phase-*` off `main`.
2. Mirror the previous state's `engines/{state}/` directory structure exactly.
3. Wire state into `dispatch.ts` registry + `dispatch.test.ts`.
4. Add new schema fields (`extraInputs.{state}_*` keys, top-level `Employee.*` additions if cross-state).
5. Register new advisory codes in `engine/types.ts`.
6. Smoke fixture (TC-{STATE}-001) passes end-to-end.

**Output:** scaffold + smoke test green; full test suite still 1000+/1000+.

**Time:** ~0.5 dev-day.

### Phase 2 — Rules + orchestrator (T*.2)

**Owner:** developer agent.

Implement each PM-locked rule from the signed test-cases doc:

- Accrual table (cliffs, pro-rata bands, qualifying-reason gates)
- Value-of-week (per-day variation if applicable, commission windows, casual/PT averaging)
- Continuity rules (rehire gaps, slackness clauses, apprentice/parental/WC handling)
- Trigger-handlers (citations, `payable_by` semantics)
- Public holiday calendar (state-specific PHs, regional variations)

Write narrow unit tests as you go — one cluster per rule. Don't wait for the full fixture corpus.

**Output:** ~25–30 new unit tests; full suite green.

**Time:** ~1.5–2 dev-days.

### Phase 3 — Full fixture corpus (T*.3) + reconciliation

**Owner:** developer agent + product-manager agent.

1. Developer builds the full ~75 single-mode + ~3 bulk fixtures as JSON files under `__tests__/fixtures/`.
2. Wire all into gold-standard runner.
3. **Some fixtures will diverge** from doc expected values. This is normal — surfaces 5–8 reconciliation items typically. For each:
   - Use engine-computed value in the fixture JSON (so tests PASS)
   - Add `_reconciliation_note` field documenting the divergence
4. At T*.3 stop-point, surface ALL divergences to operator in one list.
5. Operator routes to PM agent for **consolidated ruling** (do not ask piecemeal — wastes PM cycles).
6. PM rules each item as:
   - **(A) Engine fix** — engine has a real gap; fix it, fixture stays as doc-spec'd
   - **(B) Documented limitation** — engine correct per locked TBDs; amend doc with limitation language; fixture matches engine
   - **(C) Fixture update** — engine correct; doc fixture's expected value is wrong; update the fixture
   - **(D) Amend signed doc** — PM sign-off was incomplete on this point; non-blocking amendment
7. Developer applies the action list, removes `_reconciliation_note` fields, commits.

**Output:** 78/78 fixtures green; doc amendments live; 0–2 small engine fixes.

**Time:** ~1.5–2.5 dev-days.

### Phase 4 — Integration (T*.4)

**Owner:** developer agent.

- Confirm bulk-mode CSV runner passes the 3 bulk fixtures
- Confirm state-selector UI registration (`STATE_REGISTRY`, `ENCODED_STATES`, `ALL_STATES_ORDERED`)
- Confirm `payable_by` message logic handles state-specific advisory

**Time:** ~0.5 dev-day.

### Phase 5 — UI surfaces (T*.5)

**Owner:** developer agent.

- New state-conditional extra-inputs card in single-mode form
- New advisory labels in `result-panel.tsx` `WARNING_LABELS`
- Any new output surface (e.g. TAS's `valuePerDayBreakdown[]` component)
- Form-to-engine wiring for the new `extraInputs.{state}_*` keys
- **`UI_SHIPPED_STATES` flip in `dispatch.ts`** — add the new state to the `UI_SHIPPED_STATES: ReadonlyArray<State>` constant. This is a separate gate from `STATE_REGISTRY` (which controls engine routing) — `UI_SHIPPED_STATES` controls whether the state-selector renders the state as plain code or as `<STATE> (coming soon)`. **Do NOT flip this in Phase 1 alongside the engine scaffold** — the engine being routable in `STATE_REGISTRY` does NOT mean the UI surfaces are complete. Flipping `UI_SHIPPED_STATES` belongs with the UI completion. Surfaced as a discrete step on NT Phase 9 — failure mode #7 below.
- **e2e canary update** in `bulk-identity-dialog.spec.ts`: replace the prior state's `(coming soon)` negative assertion with a positive `/^STATE$/` visible assertion symmetric to the other shipped states. If this is the final state, also drop the global `(coming soon)` invariant or keep it as a closing regression check.
- **`layout.tsx` meta description stale-copy fix**: switch from hard-coded state lists to a dynamic `ENCODED_STATES.join(', ')` join. Same P2 follow-up pattern observed across every state from NSW → TAS — when shipping the final state (NT), this becomes the last time the pattern fires; fix inline rather than as a post-merge P2.

**Time:** ~0.5–1.5 dev-days depending on novelty of UI surfaces.

### Phase 6 — Open + merge PR

PR title: `feat(E*): {STATE} engine — Phase * (T*.1–T*.5) — N fixtures, …distinctive features…`

PR body sections:
- **Summary** (1 paragraph)
- **Commits on this branch** (table)
- **Test plan** (checkbox list — CI green, preview deploy, ~5 specific fixture spot-checks)

Wait for CI green. Merge via squash + delete-branch.

### Phase 7 — Post-merge QA verification

**Owner:** qa agent.

- Pull main locally, route to QA agent with PR test plan as input
- QA walks the test plan on Vercel production / preview
- QA writes `docs/qa/qa-report-E*-{state}-phase-*.md` with verdict + bugs triaged P0/P1/P2/P3
- QA does NOT commit; operator commits the report alongside follow-up work

**Time:** ~30-60 min.

### Phase 8 — Follow-ups + handoff

Inevitable follow-ups (typical pattern):

- **P2 stale-copy fixes**: `layout.tsx` meta description and `isSupported` gates that hard-code old state lists. Single small PR. Pattern: centralise via `ENCODED_STATES` from `dispatch.ts` so future states auto-update.
- **P3 narrative reconciliation**: doc narrative values that drifted from engine-canonical during reconciliation cycle. PM amends doc, developer doesn't change engine.
- **HANDOFF.md**: `docs/engineering/changes/YYYY-MM-DD-{epic}-phase-N-{state}-engine/HANDOFF.md` capturing the full trail.
- **QA report archive**: commit the QA report to main (mirror precedent from previous state phases).

These typically bundle into 1–2 small docs PRs.

---

## Effort by phase (TAS Phase 8 actuals)

| Phase | Estimate | Actual | Notes |
|---|---|---|---|
| T8.0 (PM sign-off) | ~1 hr | ~1 hr | 8 blocking TBDs |
| T8.1 (scaffold) | 0.5d | 0.5d | clean |
| T8.2 (rules) | 1.5–2d | ~2d | TAS-unique day-to-day rate variation added complexity |
| T8.3 (fixtures + reconciliation) | 1.5–2d | ~2.5d | 8 reconciliation items |
| T8.4 (integration) | 0.5d | 0.5d | clean |
| T8.5 (UI) | 0.5–1d | ~1d | `valuePerDayBreakdown` was novel surface |
| Post-merge QA | 30 min | ~45 min | 0 P0/P1, 2 P2, 2 P3 |
| Follow-ups | ~0.5d | ~0.5d | 3 small follow-up PRs |
| **TOTAL** | **~5d** | **~6d** | Slipped ~1d due to TAS-unique features + CI glitch |

---

## Failure modes observed (and mitigations)

### 1. Branch-drift incident (T8.4/T8.5)

**Symptom:** developer agent silently ended up on a different branch (`feat/E5.1-auth-slice`) mid-session. Stashed work + recovered.

**Mitigation:** developer + operator should `git branch --show-current` between major task transitions. Branch state is on disk, but agent-runtime visibility lags.

### 2. GitHub webhook glitch on docs-only PRs

**Symptom:** PR with merge commits + empty commits + small docs commits got stuck with required-checks pending forever. Webhook silently skipped `pull_request:synchronize` events.

**Mitigation:** **PR #35 added `workflow_dispatch:` trigger to `ci.yml` + runbook at `docs/engineering/ci.md`.** If a PR gets stuck, run `gh workflow run ci.yml --ref <branch>`. ~5 min recovery.

### 3. PM ↔ engine narrative drift

**Symptom:** PM hand-math produces e.g. `$13,260.51` from the napkin formula; engine produces `$13,263.08` due to day-precise calculation. Doc lists PM value as canonical; fixture lists engine value.

**Mitigation:** PM should accept "engine value is canonical" in the reconciliation appendix and amend doc narrative to match. Preserve original hand-math as an audit-trail historical reference, clearly annotated. **Don't second-guess locked engine math.**

### 4. CI gating on every commit (path-filter confusion)

**Diagnosis:** ci.yml has NO path filters. Branch protection requires 2 specific check contexts. The other 9 are informational. Initial mental model that "path filters block docs PRs" was wrong — actual cause was webhook drop.

**Mitigation:** Read branch protection rules with `gh api repos/{owner}/{repo}/branches/main/protection` before guessing.

### 5. Parallel-thread coordination collision (NT Phase 9)

**Symptom:** Two Claude Code sessions ran the same playbook against NT Phase 9 simultaneously and unwittingly. **PR #40** (engine T9.1+T9.2 combined in one PR — an all-in-one variant) merged first. **PR #41** (the second session's full discrete T9.1→T9.5 pipeline with its own engine implementation) reached green CI but would have produced a structurally incompatible engine, so was closed without merging. Roughly 3 dev-days of engine code from the displaced session were superseded.

**Mitigation (recommended for future epics):**

1. **Phase-claim signal at T*.0**: PM sign-off should also write the state's status to `docs/product/epic-status.md` (or open a stub PR with a draft marker) marking the state as **in-flight with session/agent ID**. This makes a collision visible immediately to any second session reading the dashboard.
2. **Pre-T*.1 sanity check**: before the developer agent begins T*.1 scaffold, it should fetch latest origin and check whether the target `feat/E*-...-{state}-engine` branch (or any branch matching the pattern) already exists on remote. If yes — coordinate before committing.
3. **PR title convention**: prefer the all-in-one variant (`feat(E*): {STATE} engine — T*.1+T*.2 combined`) OR the discrete variant (`feat(E*): T*.1 — {STATE} scaffold`) consistently across both threads. Inconsistent PR-title conventions hid the collision until both PRs were near-complete.

**Recovery mechanism that worked (NT Phase 9, PR #43):** file-level overlay experiment in the existing worktree (preserved displaced branch state via `git reset --hard HEAD`). Overlaid shipped engine + kept displaced session's fixtures, ran the full LSL vitest. 287 of 330 assertions (87%) passed on first overlay — engines were functionally equivalent at the rule level. See failure mode #6 below for the salvage path.

### 6. Cross-engine reconciliation (sibling implementations of the same spec)

**Symptom:** When a parallel-thread collision happens (failure mode #5), two engines exist for the same spec. They will be **functionally equivalent at the rule level** (same PM-signed TBDs) but diverge in implementation detail:

- **Per-year arithmetic precision** — small dollar drift (~0.02%) on calculations that sum across years; sibling engines may round/aggregate at different points in the math.
- **Citation string conventions** — different naming (e.g. `ordinary-pay.commission-12mo-lookback` vs `ordinary-pay.commission-52wk-lookback`; `trigger.termination.death.*.personal-representative` vs different structure).
- **Warning code naming** — significant naming drift (~30% on NT Phase 9 between `nt_per_year_hours_history_missing` vs `nt_hours_per_year_history_not_supplied`, etc.); same semantics, different snake-case.
- **Output structure** — one engine may add a new `Result.outputs.*` field that the other doesn't (e.g. TAS added `valuePerDayBreakdown[]`; one of NT Phase 9's sibling engines added `perYearBreakdown[]`).

**Recovery (the fixture-overlay salvage path):**

1. **Overlay experiment**: in the displaced session's worktree, `git checkout {shipped-engine-commit} -- {engine-paths}` to overlay the shipped engine. Keep your fixtures + UI + docs unchanged. Delete any engine-specific test files (e.g. unit tests against your engine's surface). Run vitest scoped to the state.
2. **Read the pass rate** — expect 80-90% on first overlay if both engines correctly implement the PM-signed spec. Lower than 70% suggests structural disagreement that needs PM ruling, not fixture retuning.
3. **Regenerate expected values for failures** — write a one-shot script in `{state}/__tests__/` that imports the shipped engine, runs each failing fixture, and writes back the engine's actual output to the fixture's `expected` block. Be conservative: only overwrite the specific fields that differ; don't blindly replace whole expected blocks (preserves fixture intent).
4. **Audit warning labels** — `grep "code: '" website/src/lib/lsl/states/{state}/` to enumerate codes the shipped engine emits; cross-check against your `result-panel.tsx` `WARNING_LABELS`. Codes shipped engine emits but you don't label → add a label. Codes you label but shipped doesn't emit → orphans, can stay as dead code or be cleaned in follow-up.
5. **Drop engine-specific doc amendments** — any doc amendments that describe your engine's internal mechanics (e.g. "38 hr/wk fallback bucket"; "blended `valueOfWeek` arithmetic") may not be true for the shipped engine. Either rewrite to describe the shipped engine's behavior, or defer to a small follow-up doc PR after broader QA.
6. **Restore your branch state** via `git reset --hard HEAD` after the experiment. The overlay is purely diagnostic — your real PR builds on top of the shipped engine on a fresh branch off main.

**Time:** ~3–4 hr from displaced state to delta-PR opened on top of the shipped engine. Most of that is mechanical retune + label audit. Saved ~2 of ~5 dev-days versus discarding the displaced work entirely.

### 7. `UI_SHIPPED_STATES` separate from `STATE_REGISTRY`

**Symptom (NT Phase 9, PR #43 first CI run):** Playwright e2e canary failed across all 4 browsers because the state-selector still rendered NT as `(coming soon)` even though the engine was routable. Root cause: PR #40 (engine T9.1+T9.2 combined) had added NT to `STATE_REGISTRY` (which controls engine routing) but deliberately left `UI_SHIPPED_STATES` at 7 states, pending UI completion landing alongside.

**Mitigation:** Phase 5 (UI surfaces) MUST include the `UI_SHIPPED_STATES` flip — it's listed as a discrete step in the Phase 5 checklist above. One-line addition to `dispatch.ts`. Forgetting it produces a CI failure with a confusing "VIC option not found" error message (the canary spec asserts NT-no-(coming-soon) at the end of a chain of positive state assertions; the failure surfaces on the first assertion in the chain). The mental model to keep:

- `STATE_REGISTRY` (engine layer) → controls whether `calculate(state, ...)` routes successfully
- `ENCODED_STATES` → derived from `STATE_REGISTRY`; used for bulk CSV validation
- `UI_SHIPPED_STATES` → independent gate; controls the `(coming soon)` rendering in state-selector + identity-form-dialog

All three end at the same set once a state ships, but the flip moments differ. Flipping `UI_SHIPPED_STATES` before the UI fields render produces a broken-UX state (user can pick the state but the conditional form fields don't show). Flipping it after `STATE_REGISTRY` adds but before UI ships is the deliberate "engine ready, UI in progress" intermediate state.

### 8. Warning-label divergence audit (cross-engine reconciliation only)

**Symptom (NT Phase 9, PR #43):** During the fixture-overlay salvage (failure mode #6), 11 warning codes the shipped engine emitted had no `WARNING_LABELS` entry in `result-panel.tsx` (would render as raw codes to the user), and 11 labels in `WARNING_LABELS` pointed at codes the shipped engine didn't emit (dead code). Total naming drift between sibling engines: ~30% of NT-related codes.

**Mitigation:** When recovering from failure mode #5, the warning-label audit is a load-bearing diagnostic step — not optional. The grep-and-diff approach:

```bash
# Codes shipped engine emits
grep -roh "code: '[a-zA-Z_0-9]*'" website/src/lib/lsl/states/{state}/ \
  | sed "s/code: '//;s/'$//" | sort -u > /tmp/emitted.txt

# Codes labeled in result-panel.tsx
grep -oE "^  [a-z_0-9]*{state}[a-z_0-9]*:" website/src/components/lsl/result-panel.tsx \
  | tr -d ' :' | sort -u > /tmp/labeled.txt

# Gaps and orphans
comm -23 /tmp/emitted.txt /tmp/labeled.txt  # missing labels — add these
comm -13 /tmp/emitted.txt /tmp/labeled.txt  # orphan labels — dead code
```

Adding missing labels is **load-bearing** (else warnings render as raw codes to operators). Dropping orphan labels is **optional** (dead code, no user impact). Aim for 1:1 coverage on the must-fix side; backlog the orphans.

This audit step is only needed when a parallel-thread collision has occurred. For a clean single-thread phase, the developer authoring T*.2 rules and T*.5 labels in the same session naturally keeps them in sync.

---

## When to deviate from this pattern

- **State with truly novel rule** (e.g. WA's dual-regime workers comp post-2024) — add a Phase 0.5 spike before T*.0 sign-off to validate technical feasibility
- **Cross-state schema addition** — surface as DEV-CROSS-N finding before scaffolding; PM rules on whether it lands in this phase or as separate refactor PR
- **Time pressure** — Phases 3/4 are the compressible ones; Phase 1/2 cannot be safely shortcut

---

## Locked engine invariants (don't violate)

These hold across all 8 states:

- Every state has its own `engines/{state}/` directory; no cross-state coupling
- State-specific signals always live in `extraInputs.{state}_*` (TAS-localised pattern)
- Top-level cross-state schema additions are PM-approved at T*.0, surfaced as DEV-CROSS-N
- Citation API: `hasAllCitations()` for membership checks; fixtures specify expected citations explicitly
- `payable_by` is state-specific: NSW/VIC = pay-cycle, TAS = `terminationDate` itself, ACT = explicit
- Advisory codes: `{state}_{snake_case_specific}` — registered in `engine/types.ts` warning-code union

---

## See also

- Test-cases: `docs/qa/test-cases-{nsw,act,tas,nt}.md`
- QA reports: `docs/qa/qa-report-E*-{state}-phase-*.md` (NT: `docs/qa/qa-report-E2-phase-9-nt.md`)
- Handoffs: `docs/engineering/changes/YYYY-MM-DD-{epic}-phase-N-{state}-engine/HANDOFF.md` (NT: `docs/engineering/changes/2026-05-27-e2-phase-9-nt-engine/HANDOFF.md` — captures the parallel-thread coordination incident and recovery in detail)
- CI runbook: `docs/engineering/ci.md`
- Deep-research source: `docs/research/lsl-pay-components-deep-research.md`
- Epic status: `docs/product/epic-status.md`
- Roadmap: `docs/product/epics.md`
