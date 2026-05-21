---
name: speckit-specify
description: Write a technology-agnostic feature specification with executive summary, requirements (MUST/SHOULD/MAY), success criteria, acceptance criteria, and open questions. Outputs to .specify/features/{slug}/spec.md. Called by pm-epic-writing.
credits: |
  github/spec-kit — specify command
  Source: https://github.com/github/spec-kit
  License: MIT
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks (before specification)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_specify` key
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

### (1) Feature Directory
Get or create a feature directory under `.specify/features/{feature_name}/` where:
- `spec.md` contains the specification
- `impl-plan.md` contains the implementation plan
- `tasks.md` contains the generated task checklist

If the feature directory exists:
- Load the existing spec to understand context
- Show the user the current version (at top of spec.md)
- Ask: "Should I update the spec or create a new variant?"

### (2) Specification Content
Your goal is to produce a **specification document** that is:
1. **Complete**: Addresses all the user's requirements
2. **Unambiguous**: Leaves no room for misinterpretation
3. **Verifiable**: Success can be objectively tested
4. **Technology-agnostic**: Focused on outcomes, not implementation

The spec should include sections (in order):

#### Executive Summary
- **1-2 sentences**: High-level description of the feature/change
- **Who benefits**: User role(s) or stakeholder(s)
- **Business value**: Why this matters (impact, goals)

#### Context & Problem Statement
- **Current state**: What exists today?
- **Problem**: What doesn't work or is missing?
- **Constraints**: Budget, timeline, tech limitations, compliance requirements
- **Dependencies**: Other features or systems that matter

#### Requirements
Use **MUST**/**SHOULD**/**MAY** language:
- **MUST**: Non-negotiable, blocking
- **SHOULD**: Important but not blocking
- **MAY**: Nice-to-have, optional

Organize by category (Functional, Performance, Security, UX, Accessibility, Integration, etc.). Each requirement should be a complete sentence.

#### Success Criteria
**Measurable, testable outcomes** that define "done".
- Include specific metrics (time, percentage, count, rate)
- No implementation details (frameworks, databases, tools)
- User-focused: Describe the outcome from the user's perspective, not system internals

#### Design/Approach (Outline)
- **High-level strategy**: How will this be built?
- **Key decisions**: Why these choices over alternatives?
- **Integration points**: How does this fit with existing systems?
- **Data flow/wireframes** (if visual): ASCII diagrams or references to Figma

#### Acceptance Criteria
- **Checklist of testable conditions**: Developers check each one before marking done
- Should not require reading the spec to understand; each criterion should stand alone
- Include happy path + key edge cases

#### Open Questions
- **Ambiguities or unknowns**: List them
- **Decisions pending**: What needs stakeholder input?
- **Risks**: Technical or organizational unknowns

#### Glossary (if needed)
- Terms or abbreviations specific to this feature

### (3) Output & Next Steps
Write the completed specification to `.specify/features/{feature_name}/spec.md`.

Then prompt:
```
Specification complete! Next steps:

1. **Review & Refine**: Does the spec match your intent?
2. **Clarify**: Run `/clarify` to dig deeper into ambiguities
3. **Analyze**: Run `/analyze` to check for gaps and overlaps
4. **Plan**: Run `/plan` to create an implementation strategy
5. **Generate Tasks**: Run `/tasks` to create a task checklist
6. **Implement**: Run `/implement` to start building
```

## Quick Guidelines

### Section Requirements

Each section **must** be present and substantive (not placeholder text).

### For AI Generation

- **Specification completeness**: Specs should be self-contained; treat user input as *intent*, not complete specification text
- **Precision over flexibility**: Phrase requirements clearly to minimize re-specification; if ambiguous, ask clarifying questions
- **Technology-agnostic**: Focus on *what* and *why*, not *how*; avoid "use React" or "build a REST API"—instead, "the system SHALL present product options in a sortable/filterable list" and "the system SHALL accept product queries via standard HTTP"
- **Measurable outcomes**: Success criteria must include concrete metrics; not "users are happy" but "95% of tasks complete in under 3 minutes"
- **Avoid over-specification**: Don't dictate UI flow or code structure; let implementation flexibility shine through

### Success Criteria Guidelines

Success criteria must be:

1. **Measurable**: Include specific metrics (time, percentage, count, rate)
2. **Technology-agnostic**: No mention of frameworks, languages, databases, or tools
3. **User-focused**: Describe outcomes from user/business perspective, not system internals
4. **Verifiable**: Can be tested/validated without knowing implementation details

**Good examples**:
- "Users can complete checkout in under 3 minutes"
- "System supports 10,000 concurrent users"
- "95% of searches return results in under 1 second"
- "Task completion rate improves by 40%"

**Bad examples** (implementation-focused):
- "API response time is under 200ms" (too technical, use "Users see results instantly")
- "Database can handle 1000 TPS" (implementation detail, use user-facing metric)
- "React components render efficiently" (framework-specific)
- "Redis cache hit rate above 80%" (technology-specific)
