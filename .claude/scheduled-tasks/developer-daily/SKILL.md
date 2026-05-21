---
name: developer-daily
description: Weekdays at 9:03 AM — reads project-status.html for today's approved items, invokes dev-planning to build the day's task list, then runs the development loop (dev-tdd per task) until blocked or all tasks complete. Opens a PR for each completed task.
suggested_cron: "3 9 * * 1-5"
---

It is now 9:03 AM. Today's date is YYYY-MM-DD.

## Step 0 — Load credentials and orient

```python
def parse_env(path):
    vals = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                vals[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return vals

env = {}
for f in [".env", ".env.development", ".env.production", ".env.local"]:
    env.update(parse_env(f))
```

```bash
cd ~/code-projects/{project-slug}
git pull origin main
```

## Step 1 — Read today's approved items from project-status.html

Read `docs/project-status.html`. Extract:
- Auto-approved items (flagged by PM at 7 AM)
- Any items previously approved by the operator

IMPORTANT: If no approved items exist in project-status.html, stop and notify via Lark. Do not invent work.

## Step 2 — Invoke dev-planning

Invoke the **dev-planning** skill for each approved item.

dev-planning will:
- Load the relevant spec from `.specify/features/{slug}/spec.md` if one exists
- Route to **dev-feature-plan** when a spec is present (produces impl-plan.md + tasks.md)
- Fall back to the daily plan format when no spec exists

Output: a concrete task list with Definition of Done for each item.

## Step 3 — Run the development loop

For each task in the plan, in order:

### 3a — Check for a spec

If `.specify/features/{slug}/tasks.md` exists for this item, use it as the task source. Each task must cite its acceptance criterion from `spec.md`.

### 3b — Create a feature branch

```bash
git checkout -b dev/YYYY-MM-DD-{task-slug}
```

### 3c — Run dev-tdd

Invoke the **dev-tdd** skill for each task:
- Write failing test first (cite the acceptance criterion in the test name)
- Write minimum implementation to pass
- Refactor with all tests green
- Commit: `test: {behaviour}` then `feat: {behaviour}`

### 3d — Gate before moving to next task

Before marking a task done:
- [ ] All tests pass
- [ ] No test is skipped or commented out
- [ ] Each test cites a specific acceptance criterion from spec.md
- [ ] No implementation code exists without a corresponding test

### 3e — Open a PR

```bash
git push origin dev/YYYY-MM-DD-{task-slug}
gh pr create \
  --title "feat({slug}): {task description}" \
  --base main \
  --body "Closes acceptance criterion: {AC ID} from .specify/features/{slug}/spec.md"
```

Do NOT auto-merge — operator reviews before merging.

## Step 4 — Handle blockers

If a task cannot proceed because of:
- A missing spec or unclear acceptance criterion → stop that task, note the blocker
- A failing dependency → stop that task, note what's needed
- An external API or credentials issue → stop, notify via Lark

Never skip a blocker silently. Write all blockers to `docs/project-status.html` under "Blockers".

## Step 5 — End-of-session handoff

When all tasks are complete OR the session is blocked, invoke the **dev-handoff** skill:
- Document what was done, what is in-progress, what is blocked
- List all open PRs with their branch names
- Note any spec deviations

Write handoff to `docs/engineering/changes/YYYY-MM-DD-{slug}/HANDOFF.md`.

## Step 6 — Update project-status.html

Update `docs/project-status.html`:
- Mark completed tasks as done with timestamp
- List open PRs awaiting review
- List blockers requiring operator input

## Step 7 — Notify (if Lark configured)

If `LARK_WEBHOOK_URL` is set:
```bash
lark-cli im +messages-send --as bot --chat-id "$LARK_CHAT_ID" \
  --text $'🛠 Dev session complete — YYYY-MM-DD. PRs opened: {count}. Blockers: {count}. Check project-status.html.'
```
