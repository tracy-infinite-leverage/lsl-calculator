---
name: speckit-analyze
description: Cross-artifact quality review detecting ambiguities, underspecification, coverage gaps, constitution violations, and inconsistencies. Returns a severity-ranked findings table. Called within pm-epic-writing; always followed by pm-analyze-split.
credits: |
  github/spec-kit — analyze command
  Source: https://github.com/github/spec-kit
  License: MIT
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks (before analysis)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_analyze` key
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

## Goal

Perform a **spec quality review** to detect issues that could derail implementation:
- Ambiguities or contradictions
- Underspecified or incomplete sections
- Coverage gaps or missed edge cases
- Requirements that conflict with success criteria
- Non-verifiable or vague success metrics

## Operating Constraints

- **Must be token-efficient**: Don't load the entire spec into a giant analysis. Load it, identify high-signal issues, and report findings compactly.
- **Must be deterministic**: Re-analyzing the same spec without changes should produce the same findings (same IDs, same counts).
- **Must be actionable**: Every finding should include remediation steps, not just "this is wrong".
- **Progressive disclosure**: If findings exceed 50 rows, return top findings + count of overflow issues, and ask if user wants deep-dive.

## Execution Steps

### 1. Initialize Analysis Context
- Load the spec from `.specify/features/{feature_name}/spec.md` (from user input or current feature directory)
- Extract document metadata: title, version, date last modified
- Count total sections, requirements, success criteria, acceptance criteria
- Brief scan for obvious issues (empty sections, placeholder text like `[TODO]`, `{EXAMPLE}`, etc.)

### 2. Load Artifacts (Progressive Disclosure)
- Load the specification document
- If the spec is very large (>10,000 words), **chunk it** and load sections on-demand based on analysis focus
- Don't dump the entire spec into context; reference sections by heading

### 3. Build Semantic Models
- **Requirement model**: Extract all `MUST`/`SHOULD`/`MAY` statements; normalize into structured form
- **Success criteria model**: Extract all success metrics; check for measurability, unit, and technology neutrality
- **Acceptance criteria model**: Extract testable conditions; check for specificity and independence
- **Glossary model**: Extract defined terms and check for consistent usage

### 4. Detection Passes (Token-Efficient Analysis)

#### A. Duplication Detection
- Scan requirements, success criteria, and acceptance criteria for **identical or near-duplicate statements**
- Flag entries with >80% textual similarity

#### B. Ambiguity Detection
- Scan for vague quantifiers: "some", "many", "a few", "quick", "fast", "reliable", "user-friendly"
- Scan for conditional language without specifics: "if possible", "as needed", "may be required"
- Flag modal verbs without context: "should be able to", "could potentially"

#### C. Underspecification
- Check for requirements with no corresponding success criteria (orphaned requirements)
- Check for success criteria with no measurable unit (e.g., "system is performant" vs. "95% of queries return in <1s")
- Check for acceptance criteria that are testable but vague (e.g., "works correctly")

#### D. Constitution Alignment
- If `.specify/memory/constitution.md` exists, load it and check:
  - Does the spec mention or violate any declared principles?
  - Are success criteria aligned with constitutional KPIs or performance targets?
  - Flag misalignments with gentle guidance, not errors

#### E. Coverage Gaps
- Check for missing edge cases: null/empty inputs, boundary conditions, error states
- Check for missing cross-functional concerns: accessibility, security, performance, localization, mobile
- Check success criteria for coverage of all major requirements

#### F. Inconsistency
- Check acceptance criteria against requirements: Do acceptance criteria fully validate all requirements?
- Check success criteria against business goals: Do metrics align with stated business value?
- Highlight any contradictions (e.g., "response time <100ms" AND "system supports 100k concurrent users" may conflict without resource estimates)

### 5. Severity Assignment
For each finding, assign severity:
- **HIGH**: Blocks implementation (critical ambiguity, missing success criteria for a MUST requirement, constitutional violation)
- **MEDIUM**: Slows implementation (underspecified acceptance criteria, orphaned requirements, edge cases)
- **LOW**: Improves clarity (minor rephrasing, consistent terminology, nice-to-have suggestions)

### 6. Produce Compact Analysis Report

Return findings in a **table format**:

| ID  | Issue | Section | Severity | Remediation |
|-----|-------|---------|----------|-------------|
| A01 | Ambiguous term "real-time" used without SLA | Design | HIGH | Define: "real-time" means <100ms latency. Update success criteria. |
| A02 | Success criterion "users are happy" is unmeasurable | Success Criteria | HIGH | Replace with: "95% of post-task surveys rate experience 4+/5" |

Limit to **50 findings**. If overflow, append:
```
**Findings truncated**: {overflow_count} additional issues found.
```

### 7. Provide Next Actions
After the findings table, suggest **priority actions**:

1. **Fix HIGH findings first**: Resolve ambiguities and missing success criteria before proceeding
2. **Clarify MEDIUM findings**: Align with the team on edge cases and acceptance criteria
3. **Polish LOW findings**: Improve spec language for clarity and consistency

### 8. Offer Remediation
For each HIGH finding, provide:
- **Current text** (quote from spec)
- **Suggested revision** (concrete rewrite)
- **Rationale** (why this matters)

### 9. Check for extension hooks (after analysis)
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.after_analyze` key
- Handle hooks per the same optional/mandatory protocol as pre-execution checks above.

## Operating Principles

- **Minimal high-signal tokens**: Focus on actionable findings, not exhaustive documentation
- **Progressive disclosure**: Load artifacts incrementally
- **Neutral tone**: Issues are observations, not judgments
- **Actionable remediation**: Every finding includes concrete suggestions

## Context

{ARGS}
