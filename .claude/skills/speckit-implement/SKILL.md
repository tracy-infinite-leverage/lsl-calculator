---
name: speckit-implement
description: Execute tasks from tasks.md phase by phase, validating each task against spec acceptance criteria and logging any deviations. Reference skill for the developer agent — our dev-tdd and dev-handoff extend this pattern.
credits: |
  github/spec-kit — implement command
  Source: https://github.com/github/spec-kit
  License: MIT
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks (before implementation)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_implement` key
- Handle hooks per the optional/mandatory protocol (check enabled flag, skip condition evaluation, output appropriate hook block).
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Outline

### (1) Load Artifacts
- Load the specification (`.specify/features/{feature_name}/spec.md`)
- Load the implementation plan (`.specify/features/{feature_name}/impl-plan.md`)
- Load the task checklist (`.specify/features/{feature_name}/tasks.md`)
- Understand the context: what's being built, why, and how it's organized

### (2) Understand the Current Phase
- Ask the user which phase they want to implement (or infer from their input)
- Load the tasks for that phase from the task checklist

### (3) Implementation Workflow
- Present the current phase's tasks in order (respecting dependencies)
- For each task, provide full context:
  - **Task title** and brief description
  - **Acceptance criteria** (checklist of testable outcomes)
  - **Code scaffolding** or starting point (if applicable)
  - **Integration notes** (how this connects to existing systems)
  - **Spec cross-references** (sections to review for detailed requirements)
- Implement incrementally; generate code in small, reviewable chunks
- After each chunk, ask for feedback or confirmation before proceeding
- Validate generated code against acceptance criteria and spec success criteria

### (4) Continuous Validation
- After each task, cross-reference acceptance criteria to confirm completion
- Check that code aligns with the architecture and design decisions from `impl-plan.md`
- Validate that generated code won't break existing tests or systems
- Call out any deviations from the spec; ask developer for confirmation before proceeding
- If the spec conflicts with the implementation, document the deviation and suggest spec amendments

### (5) Task Completion & Tracking
- Once a task's acceptance criteria are met, check it off in `tasks.md`
- Commit the task with a clear message (if in git)
- Move to the next task, honoring dependencies

### (6) Phase Summary & Handoff
- Once all tasks in the phase are complete:
  - Run **acceptance testing** against the spec's success criteria
  - Generate a **phase summary**: what was built, key decisions, any spec amendments
  - Ask: "Phase {N} complete! Ready to move to Phase {N+1}?"
