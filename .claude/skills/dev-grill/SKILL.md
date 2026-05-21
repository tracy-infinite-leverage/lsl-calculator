---
name: dev-grill
description: Use when a spec or plan has been drafted but not yet executed. Triggered when the developer says "grill me", "stress-test this plan", "what could go wrong", or before starting any non-trivial implementation. Runs adversarial interrogation — 10+ questions — and blocks execution until all answers are satisfactory.
credits: |
  Adapted from mattpocock/skills (grill-me)
  Source: https://github.com/mattpocock/skills
  License: MIT — Copyright (c) 2026 Matt Pocock
---

# Dev Grill

Adversarial plan interrogation. Hard gate before implementation starts.

## The Rule

Do not write a single line of implementation code until this skill completes and the plan survives all questions. If any question cannot be answered, the plan is incomplete — refine it first.

## Interrogation Protocol

Generate at least 10 questions across these categories:

### Scope and Boundaries
- What is explicitly OUT of scope? (name it)
- What adjacent systems could be affected that aren't mentioned?
- Is there existing code that already does part of this?

### Data and State
- What data does this touch? Where does it live?
- What happens to existing data during migration/deployment?
- Are there race conditions or concurrent access patterns?

### Error and Edge Cases
- What happens when inputs are null, empty, or malformed?
- What is the failure mode if a dependency is unavailable?
- What does the user experience when this fails?

### Testing
- How will you verify this works? (specific test scenarios)
- How will you verify this didn't break anything? (regression plan)
- Is there a component here that's hard to test automatically?

### Deployment
- Does this require a migration or schema change?
- Is this a breaking change for any callers?
- Can this be deployed incrementally or is it all-or-nothing?

### Assumptions
- What are you assuming is true that you haven't verified?
- What would invalidate this approach entirely?

## Gate

For each question, provide an answer. If an answer is "I don't know" or "TBD":

- Mark it as a **blocker** — resolve before implementation.
- Do not mark it as acceptable ambiguity unless the PM approves the risk explicitly.

## Output

```
PLAN: {one-line summary}
GRILLING QUESTIONS: {numbered list}
BLOCKERS: {any unanswered questions}
VERDICT: APPROVED / BLOCKED
```

---

## Credits

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) — `grill-me`  
License: MIT — Copyright (c) 2026 Matt Pocock
