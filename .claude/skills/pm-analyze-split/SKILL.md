---
name: pm-analyze-split
description: Run immediately after speckit-analyze produces its findings table. Splits findings into PM layer (client-facing, business language) and Dev layer (routed to developer agent). HIGH PM-layer findings must be resolved before writing the epic entry. Called within pm-epic-writing.
---

# PM Analyze Split

Takes the speckit-analyze findings table and routes each finding to the right audience.

## Why Two Layers

speckit-analyze finds issues across the full spectrum — from "this business goal is vague" to "this acceptance criterion requires a specific database schema to validate." The client can only act on the former; surfacing the latter to them adds noise and confusion. This skill separates concerns cleanly.

## Step 1 — Run speckit-analyze

Invoke speckit-analyze on `.specify/features/{slug}/spec.md`. Receive the full findings table (ID, Issue, Section, Severity, Remediation).

## Step 2 — Classify Each Finding

For each finding, assign it to exactly one layer:

**PM Layer (surface to client):**
- Business goal conflicts (spec goal contradicts `docs/product/product.md` strategy)
- Epic-to-epic duplication (this spec overlaps an existing epic in `docs/product/epics.md`)
- Success criteria unmeasurable from a user/business perspective
- Missing acceptance criteria for a P1 (MUST) requirement — no testable condition defined
- Constitution misalignments (spec violates `docs/product/constitution.md` principles, if it exists)
- Scope vagueness that only the business owner can resolve

**Dev Layer (route to developer agent):**
- Missing data model definitions
- Acceptance criteria requiring implementation knowledge to validate
- Non-functional requirements with no technical constraint (e.g., "system must be fast" with no threshold)
- Ambiguous technical assumptions in the Design/Approach section
- Spec-to-plan inconsistencies (if `impl-plan.md` already exists)

## Step 3 — PM Layer Output

Present PM-layer findings to the client as a clean table, using plain business language. Strip any technical jargon from the Remediation column.

```
| ID  | Issue | Severity | What We Need From You |
|-----|-------|----------|-----------------------|
| A01 | ...   | HIGH     | ...                   |
```

**Gate**: If any PM-layer finding is HIGH severity, it must be resolved before writing the epic entry. Offer to re-run speckit-clarify or amend the spec directly with the client's input. Re-run speckit-analyze after amendments until no HIGH PM-layer findings remain.

MEDIUM and LOW findings: note them, offer to address, but do not block.

## Step 4 — Dev Layer Output

Write dev-layer findings to `.specify/features/{slug}/dev-findings.md`:

```markdown
# Dev Layer Findings — {feature-slug}

Generated: {YYYY-MM-DD}
Source: speckit-analyze on spec.md v{version}

| ID  | Issue | Section | Severity | Suggested Resolution |
|-----|-------|---------|----------|---------------------|
| D01 | ...   | ...     | HIGH     | ...                 |
```

This file is consumed by `dev-feature-plan` in Phase 0. Do not surface its contents to the client.
