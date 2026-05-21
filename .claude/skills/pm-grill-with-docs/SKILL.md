---
name: pm-grill-with-docs
description: Use when a plan or spec has been drafted and needs validation against existing project documentation before approval. Triggered when the PM says "grill with docs", "validate this plan", "check this against the project", or before approving any plan that touches existing epics. Interrogates the plan against project-status.html, epics.md, and epic-status.md.
credits: |
  Adapted from mattpocock/skills (grill-with-docs)
  Source: https://github.com/mattpocock/skills
  License: MIT — Copyright (c) 2026 Matt Pocock
---

# PM Grill With Docs

Validate a plan against live project documentation before approving it.

## Step 1 — Load Project State

Read the following files before asking any questions:

1. `docs/project-status.html` — current sprint, what's in progress, what's blocked
2. `docs/product/epics.md` — list of all epics and their scope
3. `docs/product/epic-status.md` — current status of each epic (planned / in-progress / done / blocked)

If any of these files don't exist, note it and proceed with what's available.

## Step 2 — Cross-Reference the Plan

For the plan under review, ask:

### Alignment
- Which epic does this plan fall under? Is it in the right epic or does it belong elsewhere?
- Does any existing epic already cover this work? (check for duplication)
- Does this plan conflict with any currently in-progress work?

### Completeness
- Does the plan mention all files/components that will be affected?
- Does it address the acceptance criteria in the epic?
- Are there dependent tasks that must complete first?

### Scope Creep
- Does this plan include work that belongs in a different epic?
- Is there any work in this plan that isn't in the approved epic scope?

### Risk
- Does this plan touch any "blocked" or "at risk" items in epic-status.md?
- Does it create a dependency on anything that isn't done yet?

## Step 3 — Questions

Generate 5–10 specific questions based on the cross-reference. Each question must cite which document triggered it:

```
Q{n}: [{source file}] {question}
```

## Step 4 — Verdict

```
PLAN: {one-line summary}
ALIGNED WITH: {epic name}
CONFLICTS: {any conflicts found}
SCOPE ISSUES: {anything out of scope}
OPEN QUESTIONS: {list of blockers}
VERDICT: APPROVED / REVISE / BLOCKED
```

Only issue APPROVED if all cross-reference questions are answered and no conflicts remain.

---

## Credits

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) — `grill-with-docs`  
License: MIT — Copyright (c) 2026 Matt Pocock
