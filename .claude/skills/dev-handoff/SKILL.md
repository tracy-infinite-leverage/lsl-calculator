---
name: dev-handoff
description: Use when a developer session is pausing, ending, or handing work to another agent or developer. Triggered when the developer says "handoff", "I'm done for now", "passing this to QA", "wrapping up", or when the session is about to end with in-progress work. Writes a HANDOFF.md to docs/engineering/changes/{date}-{slug}/.
credits: |
  Adapted from mattpocock/skills (handoff)
  Source: https://github.com/mattpocock/skills
  License: MIT — Copyright (c) 2026 Matt Pocock
---

# Dev Handoff

Session handoff protocol. Produces a HANDOFF.md so the next agent or developer can continue without losing context.

## Step 1 — Locate or Create the Change Folder

Handoff files live at:

```
docs/engineering/changes/{YYYY-MM-DD}-{slug}/HANDOFF.md
```

Where `{slug}` is a short kebab-case label for the current feature or fix (e.g. `auth-refresh-fix`, `email-sequence-step3`).

If the folder doesn't exist, create it.

## Step 2 — Write HANDOFF.md

```markdown
# Handoff: {feature/fix name}

**Date:** {YYYY-MM-DD}
**From:** Developer agent
**To:** {who is receiving — QA agent / next developer session / PM}
**Branch:** {current git branch}

## What Was Done

{2-5 bullet points of completed work}

## What Is In Progress

{any work started but not finished}

## What Is Blocked

{anything that cannot proceed without external input — name the blocker and who resolves it}

## Files Changed

{list of modified/created files}

## How to Test

{exact commands or steps to verify the work — not vague "run tests"}

## Context for Next Session

{any non-obvious things the next person needs to know:
- decisions made and why
- things tried that didn't work
- assumptions baked into the implementation}

## Open Questions

{anything unresolved that the next person needs to decide or investigate}

## Spec Deviations _(optional — omit section if none)_

{List any deliberate deviations from `.specify/features/{slug}/spec.md`:
- AC-N: {what the spec required} → {what was actually built} — Reason: {why}
These deviations must be flagged to the PM for spec amendment or acceptance.}
```

## Step 3 — Commit the Handoff

```bash
git add docs/engineering/changes/{date}-{slug}/HANDOFF.md
git commit -m "docs: handoff for {feature} — {what/where next}"
```

## Step 4 — Notify (optional)

If `LARK_WEBHOOK_URL` is set in the environment, send a Lark notification:

```
🔁 Handoff: {feature}
From: Developer → {recipient}
Branch: {branch}
Handoff: docs/engineering/changes/{date}-{slug}/HANDOFF.md
```

If Lark is not configured, skip this step silently — the HANDOFF.md commit is the record.

---

## Credits

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) — `handoff`  
License: MIT — Copyright (c) 2026 Matt Pocock
