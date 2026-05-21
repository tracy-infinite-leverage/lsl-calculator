---
name: dev-feature-plan
description: Orchestrate speckit-plan then speckit-tasks in one uninterrupted run for a given feature spec. Resolves dev-layer analyze findings in Phase 0 before planning. No client input required between steps. Called by dev-planning when a spec path is provided.
---

# Dev Feature Plan

Translates a completed, analyzed feature spec into an implementation plan and task list without requiring any client input after handoff.

## Inputs

- **Spec path**: `.specify/features/{slug}/spec.md` (required — passed by PM agent)
- **Dev findings**: `.specify/features/{slug}/dev-findings.md` (optional — from pm-analyze-split)

## Step 1 — Validate Branch

Run speckit-git-validate to confirm the current branch is a feature branch.

If not on a feature branch: warn the developer, suggest running speckit-git-feature, but do not block — the developer may choose to proceed on the current branch.

## Step 2 — Load Context

Read:
- `.specify/features/{slug}/spec.md` — the full spec
- `.specify/features/{slug}/dev-findings.md` — dev-layer findings (if exists)
- The corresponding epic entry from `docs/product/epics.md`

## Step 3 — Phase 0: Resolve Dev Findings

If `dev-findings.md` exists and has HIGH findings:

For each HIGH finding:
1. Read the issue and suggested resolution
2. Propose a concrete resolution (data model definition, technical constraint, etc.)
3. Document the resolution inline in the plan under a **Phase 0: Pre-Planning Decisions** section
4. If a finding cannot be resolved without human input, flag it explicitly — do not silently skip

Document all resolutions in `impl-plan.md` Phase 0 before proceeding to Phase 1.

## Step 4 — Run speckit-plan

Invoke speckit-plan on `.specify/features/{slug}/spec.md`.

Output: `.specify/features/{slug}/impl-plan.md`

## Step 5 — Run speckit-tasks (immediately, no pause)

Without waiting for client input, invoke speckit-tasks on `.specify/features/{slug}/impl-plan.md`.

Output: `.specify/features/{slug}/tasks.md`

Ensure:
- Tasks marked `[P]` where they can run in parallel
- Each task cites the spec acceptance criterion it satisfies
- Dependency order is correct

## Step 6 — Phase Summary

Print for the developer agent (not the client):

```
FEATURE PLAN COMPLETE
─────────────────────
Feature : {slug}
Spec    : .specify/features/{slug}/spec.md
Plan    : .specify/features/{slug}/impl-plan.md
Tasks   : .specify/features/{slug}/tasks.md

Dev findings resolved : {count} / {total}
Unresolved findings   : {list IDs or "none"}

NEXT STEPS
1. Review impl-plan.md — confirm architecture decisions
2. Start dev-tdd on Task 1.1 (first task in Phase 1)
3. Each test must cite the acceptance criterion from spec.md it validates
```
