# State-Engine Phase Pattern (NSW → ACT → TAS, proven 3x)

**Captured:** 2026-05-26 (post-TAS Phase 8 ship)
**Status:** Reusable for NT (Phase 9) and any future state additions
**Source phases:** E1 NSW, E2/Phase 7 ACT, E2/Phase 8 TAS

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

- Test-cases: `docs/qa/test-cases-{nsw,act,tas}.md`
- QA reports: `docs/qa/qa-report-E*-{state}-phase-*.md`
- Handoffs: `docs/engineering/changes/YYYY-MM-DD-{epic}-phase-N-{state}-engine/HANDOFF.md`
- CI runbook: `docs/engineering/ci.md`
- Deep-research source: `docs/research/lsl-pay-components-deep-research.md`
- Epic status: `docs/product/epic-status.md`
- Roadmap: `docs/product/epics.md`
