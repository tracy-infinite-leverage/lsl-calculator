---
name: speckit-tasks
description: Generate a phased, dependency-ordered task checklist from an impl-plan.md. Each task has acceptance criteria, effort sizing (S/M/L/XL), and [P] parallelization markers. Outputs to .specify/features/{slug}/tasks.md. Called by dev-feature-plan immediately after speckit-plan.
credits: |
  github/spec-kit — tasks command
  Source: https://github.com/github/spec-kit
  License: MIT
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks (before task generation)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_tasks` key
- Handle hooks per the optional/mandatory protocol (check enabled flag, skip condition evaluation, output appropriate hook block).
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Outline

### (1) Load Implementation Plan
- Load the implementation plan from `.specify/features/{feature_name}/impl-plan.md`
- Extract phases, work packages, and effort estimates
- Understand the phase breakdown (which requirements go into which phase)

### (2) Generate Task Checklist
For each phase in the implementation plan, generate a **concrete, immediately-actionable task checklist**:

- Each task must be **specific enough** that an LLM or developer can complete it without reading the spec
- Task title should be clear and action-oriented (verb + object: "Build X", "Write Y", "Test Z")
- Include brief task description (1-2 sentences) with acceptance criteria
- Group tasks by phase (MVP, Phase 1, Phase 2, etc.)
- Estimate effort (S/M/L/XL) for each task
- Call out dependencies between tasks (e.g., "depends on Task 1.2")

Write the completed task checklist to `.specify/features/{feature_name}/tasks.md`.

## Task Generation Rules

### Checklist Format (REQUIRED)

```markdown
## Phase {N}: {Phase Name}

### Task {N}.{M}: {Task Title}

**Description**: {1-2 sentence summary}

**Acceptance Criteria**:
- [ ] {Criterion 1}
- [ ] {Criterion 2}
- [ ] {Criterion 3}

**Effort**: {S/M/L/XL}
**Dependencies**: {Task 1.1, Task 1.3} or "None"
**Assignee**: {Role or "Unassigned"}
```

Each task is a **checkbox item** that developers check off as they complete it. Tasks should be:
1. **Specific**: No ambiguity about what "done" looks like
2. **Independent**: A developer should be able to understand the task without re-reading the spec
3. **Measurable**: Each acceptance criterion is testable
4. **Actionable**: A developer can start working immediately

### Task Organization

- Group tasks **by phase** (from the implementation plan)
- Within each phase, order tasks by **dependency** (dependencies-first)
- Mark tasks that can run in parallel with `[P]` after the task title
- Use consistent numbering: Phase 1, Task 1.1; Phase 1, Task 1.2; etc.

### Phase Structure

Follow the phase structure from `impl-plan.md`:
- **Phase 0** (if applicable): Research, prototypes, setup
- **Phase 1** (MVP): Core feature, must-have requirements
- **Phase 2+**: Extensions, enhancements, optional requirements

Do not generate tasks for phases beyond what the implementation plan specifies.
