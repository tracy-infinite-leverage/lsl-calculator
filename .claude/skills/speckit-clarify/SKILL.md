---
name: speckit-clarify
description: Conduct a targeted interview to resolve ambiguities in an existing spec, then amend the spec with a Clarification Summary. Outputs updated .specify/features/{slug}/spec.md. Called within pm-epic-writing; always followed by pm-clarify-guard to filter technical questions.
credits: |
  github/spec-kit — clarify command
  Source: https://github.com/github/spec-kit
  License: MIT
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks (before clarification)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_clarify` key
- If the YAML cannot be parsed or is invalid, skip hook checking silently and continue normally
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- For each executable hook, output the following based on its `optional` flag:
  - **Optional hook** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Pre-Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **Mandatory hook** (`optional: false`):
    ```
    ## Extension Hooks

    **Automatic Pre-Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}

    Wait for the result of the hook command before proceeding to the Outline.
    ```
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Outline

### (1) Load Specification
- Identify the target spec (from user input or current feature directory `.specify/features/{feature_name}/spec.md`)
- Read and parse it
- Extract all sections: summary, context, requirements, success criteria, design, acceptance criteria, questions, glossary

### (2) Clarification Interview
Conduct a **targeted interview** to resolve ambiguities. Focus on sections that are:
- **Incomplete** (e.g., missing acceptance criteria)
- **Unclear** (e.g., vague requirements or success metrics)
- **Risky** (e.g., no explicit prioritization, missing edge cases)

Ask **5–10 strategic questions** that:
- Identify scope gaps (e.g., "Does 'user' include guest users?")
- Probe edge cases (e.g., "What happens when search returns no results?")
- Clarify metrics (e.g., "What's the acceptable error rate for this system?")
- Validate assumptions (e.g., "You mentioned 'real-time'; is sub-100ms latency required?")
- Prioritize trade-offs (e.g., "If we can't hit all success criteria, which is most critical?")

**Do NOT ask questions answered in the spec**. Only ask when the spec is genuinely unclear.

### (3) Synthesize Answers
- Collect the user's answers
- Identify patterns (e.g., repeated edge cases, newly discovered constraints)
- Flag potential conflicts between requirements or success criteria

### (4) Amend Specification
Update the spec with clarifications:
- Add detail to ambiguous sections
- Tighten acceptance criteria based on edge cases discussed
- Adjust success metrics if needed
- Update the version (semver) at the top of the file

### (5) Document Changes
Prepend a **Clarification Summary** to the spec:
```
## Clarification Summary (Version X.Y.Z)

**Date**: YYYY-MM-DD
**Clarifications made**:
- {Point 1}: {Change}
- {Point 2}: {Change}
- {Point 3}: {Change}

**Open questions remaining**:
- {Question 1}
- {Question 2}
```

Then write the updated spec back to `.specify/features/{feature_name}/spec.md`.

### (6) Next Steps
Prompt:
```
Specification clarified! Next steps:

1. **Analyze**: Run `/analyze` to check for gaps and inconsistencies
2. **Plan**: Run `/plan` to outline implementation strategy
3. **Tasks**: Run `/tasks` to break down into concrete work items
4. **Implement**: Run `/implement` to start building
```

## Post-Execution Checks

After writing the updated spec to `.specify/features/{feature_name}/spec.md`:
- Confirm the file was written successfully
- Display the new version number (from top of spec.md)
- Remind user: "Run `/analyze` next to validate the spec, or `/plan` to start implementation planning"
