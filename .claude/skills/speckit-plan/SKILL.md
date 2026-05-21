---
name: speckit-plan
description: Build a high-level implementation strategy from a completed spec — phases, design decisions, risks, effort estimates. Outputs to .specify/features/{slug}/impl-plan.md. Called by dev-feature-plan immediately followed by speckit-tasks.
credits: |
  github/spec-kit — plan command
  Source: https://github.com/github/spec-kit
  License: MIT
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks (before planning)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_plan` key
- Handle hooks per the optional/mandatory protocol (check enabled flag, skip condition evaluation, output appropriate hook block).
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Outline

Build a **high-level implementation strategy** that translates the specification into a work plan. The plan should:
1. Break the spec into **phases** or milestones (e.g., MVP, Phase 1, Phase 2)
2. Identify **key design decisions** and trade-offs
3. Map requirements → work packages (what gets built in which phase)
4. Highlight **risks** and mitigation strategies
5. Estimate **effort & dependencies**

The plan should be **implementation-agnostic**: describe *what* gets built and *why*, not *how* (frameworks, specific code patterns, etc.). Implementation details belong in `/implement`, not here.

Output the completed plan to `.specify/features/{feature_name}/impl-plan.md`.

## Phases

### Phase 0: Outline & Research
Outline the scope of work and any unknowns that should be researched or prototyped before committing to Phase 1. Include:
- **What gets built**: Which requirements or user journeys are in scope for Phase 1?
- **What's deferred**: Which requirements are Phase 2+?
- **Research & validation**: What prototypes or research should happen before Phase 1 starts?
- **Risks & assumptions**: What could go wrong? What are we assuming is true?

### Phase 1: Design & Contracts
Define the external contracts (API, data formats, UI components) and architecture before implementation:
- **System architecture**: How do different components interact?
- **API contracts** (if applicable): Request/response schemas, endpoints, error handling
- **Data model**: What data is created, updated, or queried?
- **UI/UX design**: Wireframes, user flows, component hierarchy
- **Testing strategy**: How will we validate requirements?

## Key rules

- **Prioritization**: Number the phases; prioritize user-critical features first (MVP mindset)
- **Effort estimates**: Include T-shirt sizing (S/M/L/XL) or rough story points per phase
- **Dependencies**: Call out work packages that depend on others (e.g., "Phase 2 depends on Phase 1 API")
- **Risks & mitigations**: For each risk, propose a mitigation strategy
