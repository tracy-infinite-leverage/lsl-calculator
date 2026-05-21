---
name: qa-triage
description: Use when a bug needs to be classified and routed. Triggered when the QA agent says "triage", "classify this bug", "route this issue", or when a bug report arrives without a priority or assignee. Runs the triage state machine: classify → score → route. Outputs to docs/qa/ and updates epic-status.md and project-status.html.
credits: |
  Adapted from mattpocock/skills (triage)
  Source: https://github.com/mattpocock/skills
  License: MIT — Copyright (c) 2026 Matt Pocock
---

# QA Triage

Bug triage state machine. Classify → score → route.

## Step 1 — Classify

Assign exactly one classification to the bug:

| Class | Definition |
|---|---|
| `regression` | Previously working behaviour that is now broken |
| `new-defect` | Never worked correctly — bug in new code |
| `performance` | Correct output but unacceptably slow |
| `ux-degradation` | Works technically but creates a poor user experience |
| `data-integrity` | Incorrect data stored, returned, or lost |
| `security` | Potential data exposure, auth bypass, or injection |

## Step 2 — Priority Score

Score on three axes (1–5 each):

```
Severity  = how bad is the user impact when it happens?
Frequency = how often does it occur?
Blast     = how many users / features does it affect?

Score = Severity × Frequency × Blast
```

Priority mapping:

| Score | Priority |
|---|---|
| 75–125 | P0 — drop everything |
| 30–74  | P1 — fix this sprint |
| 10–29  | P2 — fix next sprint |
| 1–9    | P3 — backlog |

## Step 3 — Route

| Classification | Route to |
|---|---|
| `security` | PM → escalate immediately, no sprint needed |
| `data-integrity` | Developer (P0/P1) → QA validates fix |
| `regression` | Developer → fix on same branch that caused it |
| `new-defect` | Developer → fix on feature branch |
| `performance` | Developer → profile before fixing |
| `ux-degradation` | PM review → designer if needed → developer |

## Step 4 — Output

Write a triage report to `docs/qa/{YYYY-MM-DD}-{slug}-triage.md`:

```markdown
# Triage: {bug title}

**Date:** {date}
**Reporter:** {who found it}
**Classification:** {class}
**Priority:** P{n} (Score: {score})
**Assigned to:** {agent/person}

## Reproduction

{exact steps to reproduce}

## Expected vs Actual

**Expected:** {what should happen}
**Actual:** {what happens}

## Impact Assessment

- Severity: {1-5} — {reason}
- Frequency: {1-5} — {reason}
- Blast radius: {1-5} — {reason}

## Route Decision

{who is fixing this and why}
```

## Step 5 — Update Project Files

After writing the report:

1. Update `docs/product/epic-status.md` — add bug under the relevant epic's "Known Issues" section.
2. Update `docs/project-status.html` — add to the "Bugs" table with priority, classification, and assignee.

---

## Credits

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) — `triage`  
License: MIT — Copyright (c) 2026 Matt Pocock
