---
name: speckit-constitution
description: Create or update the project constitution at .specify/memory/constitution.md — versioned project principles, KPIs, and governance. Always followed by pm-constitution-sync to copy to docs/product/constitution.md.
credits: |
  github/spec-kit — constitution command
  Source: https://github.com/github/spec-kit
  License: MIT
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks (before constitution update)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_constitution` key
- Handle hooks per the optional/mandatory protocol (check enabled flag, skip condition evaluation, output appropriate hook block).
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Outline

### (1) Load the Constitution Template
You are updating the project constitution at `.specify/memory/constitution.md`. This file is a TEMPLATE containing placeholder tokens in square brackets (e.g. `[PROJECT_NAME]`, `[PRINCIPLE_1_NAME]`). Your job is to:
1. Collect/derive concrete values for placeholders
2. Fill the template precisely
3. Propagate amendments across dependent artifacts

**Note**: If `.specify/memory/constitution.md` does not exist, copy from `.specify/templates/constitution-template.md` if available, otherwise create from scratch using the structure below.

### (1a) Load the existing constitution
- Load the file at `.specify/memory/constitution.md`
- Identify every placeholder token of the form `[ALL_CAPS_IDENTIFIER]`
- **IMPORTANT**: Respect the user's preferences on the **number of principles**. If they specify "3 principles" or "5 principles", follow the general template structure and generate that many.

### (2) Collect/Derive Values for Placeholders
Work through each placeholder systematically. For each placeholder:
- If the user provided a value in their input, use it
- If not, **infer a reasonable value** based on:
  - Project metadata (docs/product/product.md, README, package.json)
  - Existing decisions in specs, plans, or code
  - Best practices for the project type
- If you cannot derive a value, ask the user

**Common placeholders**:
- `[PROJECT_NAME]`: Name of the project
- `[PROJECT_DESCRIPTION]`: 1-sentence project purpose
- `[PRINCIPLE_N_NAME]`: Name of each principle
- `[PRINCIPLE_N_STATEMENT]`: Declaration of each principle
- `[PRINCIPLE_N_WHY]`: Rationale for each principle
- `[PRINCIPLE_N_EXAMPLES]`: Concrete examples demonstrating the principle
- `[KPIs]`: Key performance indicators for project success
- `[VERSION]`: Semantic version of the constitution (start at 1.0.0 if new)
- `[DATE]`: Date the constitution was established or last updated (ISO 8601: YYYY-MM-DD)

### (3) Draft the Updated Constitution
- Replace every placeholder with concrete text
- Preserve heading hierarchy and formatting
- Ensure principles are:
  - **Declarative**: State what the project believes or does, not aspirations
  - **Testable**: Each principle should be operationalizable (can drive decisions)
  - **Free of vague language**: Replace "should try to" with "MUST" or "SHOULD" language with rationale

### (4) Validate and Sync
- Load docs/product/product.md for project context
- Check for **consistency** across the project:
  - Do specifications align with constitutional principles?
  - Are implementation decisions traced back to constitutional values?

### (5) Produce a Sync Impact Report
Prepend this as an HTML comment at the top of the constitution file after you update it:

```html
<!--
CONSTITUTION SYNC REPORT
========================
Version: {old_version} → {new_version}

Modified Principles:
- {old_name} → {new_name}

Added Sections:
- {new_section_name}

Removed Sections:
- {old_section_name}

Follow-up TODOs:
- [ ] Review README.md for principle references
- [ ] Update design system docs to reflect Principle Y

-->
```

### (6) Validation Checklist
Before outputting the constitution:
- [ ] No remaining unexplained bracket tokens (`[...]`) except intentionally deferred placeholders
- [ ] Version line matches the Sync Impact Report
- [ ] Dates are in ISO 8601 format (YYYY-MM-DD)
- [ ] Principles are declarative, testable, free of vague language
- [ ] Sync Impact Report is complete and accurate

### (7) Output the Constitution
Write the completed constitution to `.specify/memory/constitution.md`.

## Post-Execution Checks

After writing the updated constitution:
- Confirm the file was written successfully
- Display the new version number and key amendments
- Remind: "Constitution updated! Run pm-constitution-sync to copy to docs/product/constitution.md"
