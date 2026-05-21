---
name: create-local-routine
description: Create a persistent scheduled routine using mcp__scheduled-tasks — stored on disk in ~/.claude/scheduled-tasks/, local timezone, no expiry, no minimum interval. Runs while Claude Desktop is open; catches up on next launch if the app was closed.
---

# Skill: create-local-routine

Create a persistent local scheduled routine using `mcp__scheduled-tasks__create_scheduled_task`. Routines are stored as `SKILL.md` files in `/Users/tracnguyendang/.claude/scheduled-tasks/` and survive Desktop restarts indefinitely.

## When to use

Trigger this skill when the user says things like:
- "schedule a task to..."
- "create a routine that runs every..."
- "set up a scheduled agent for..."
- "add a cron job to..."

**Always use `mcp__scheduled-tasks__create_scheduled_task`.** Notes on alternatives:
- `CronCreate` — session-only; `durable: true` exists in the schema but is not implemented
- `RemoteTrigger` — cloud CCR; use only when the Mac must be asleep (requires repo/git, no local env)

---

## How scheduled routines work

- **Persistent on disk** — stored in `~/.claude/scheduled-tasks/{taskId}/SKILL.md`, survives restarts indefinitely.
- **Local timezone** — cron expressions are in local time. No UTC conversion needed.
- **No minimum interval** — sub-hourly supported.
- **No expiry** — runs forever until disabled or deleted.
- **App must be open** — fires while Claude Desktop is running; if closed when due, catches up on next launch.
- **Shows approval prompt** — calling the tool shows the user a confirmation dialog before registering.
- **Managed via** `mcp__scheduled-tasks__list_scheduled_tasks` / `mcp__scheduled-tasks__update_scheduled_task`.

---

## Step 1 — Load schema

```
ToolSearch(query: "select:mcp__scheduled-tasks__create_scheduled_task,mcp__scheduled-tasks__list_scheduled_tasks,mcp__scheduled-tasks__update_scheduled_task")
```

Always load the schema before calling the tool.

---

## Step 2 — Call create_scheduled_task

```
mcp__scheduled-tasks__create_scheduled_task(
  taskId: "kebab-case-routine-name",
  description: "One-line summary shown in sidebar",
  cronExpression: "3 9 * * 1-5",   // local time; omit for one-time or ad-hoc
  prompt: "<full self-contained prompt>",
  notifyOnCompletion: true
)
```

**One-time routine** — use `fireAt` instead of `cronExpression`:
```
fireAt: "2026-05-21T09:00:00+07:00"   // ISO 8601 with timezone offset
```

**Ad-hoc** (manual trigger only) — omit both `cronExpression` and `fireAt`.

---

## Cron expressions (local time — Asia/Saigon)

No conversion needed. Write the time the user said.

| Local time | Cron |
|---|---|
| Weekdays 6:03 AM | `3 6 * * 1-5` |
| Weekdays 9:03 AM | `3 9 * * 1-5` |
| Weekdays 6:07 PM | `7 18 * * 1-5` |
| Weekdays 6:37 PM | `37 18 * * 1-5` |
| Fridays 5:07 PM | `7 17 * * 5` |
| Every 30 min | `*/30 * * * *` |
| Hourly (off-peak) | `7 * * * *` |
| Daily 8:57 AM | `57 8 * * *` |

Off-minute rule: avoid `:00` and `:30` when the user's request is approximate.

---

## Prompt body patterns

Each run starts fresh with no memory of the conversation — the prompt must be fully self-contained.

### 1. Open with time context
```
Today is $(date '+%Y-%m-%d'). Current time is $(date '+%H:%M') Asia/Saigon.
```

### 2. Local file access
Local `.env`, config files, and repo paths are all accessible directly. No git checkout needed.

### 3. Git workflow (if writing files)
```bash
cd /path/to/repo
git pull origin main
git checkout -b <prefix>/<routine-name>/$(date '+%Y-%m-%d')
# ... work ...
git add <specific files>
git commit -m "<prefix>(<routine>): $(date '+%Y-%m-%d')"
git push origin HEAD
gh pr create --title "..." --base main --body "..."
gh pr merge --merge --auto --delete-branch
git checkout main && git pull origin main
```

### 4. Notification pattern
Send both Lark and Resend — not fallbacks, both always fire:
- **Lark**: `lark-cli im +messages-send --as bot --chat-id "$LARK_CHAT_ID" --text $'...'`
- **Resend**: read HTML template → substitute → `resend emails send`
- **If both fail**: write inline to a repo file, commit. Never create new alert files.

### 5. Numbered steps
Structure as `## Step 0`, `## Step 1`, etc. Add `IMPORTANT:` notes for edge cases.

---

## Workflow

1. **Gather requirements:**
   - Routine ID (kebab-case)
   - One-line description
   - What it does and what success looks like
   - When it fires (local Asia/Saigon time — no conversion needed)
   - Recurring, one-time, or ad-hoc
   - Whether it writes files (needs git workflow) or is read/notify only

2. **Draft the full prompt** — self-contained, opens with date/time context, uses local file paths.

3. **Load schema** via `ToolSearch(query: "select:mcp__scheduled-tasks__create_scheduled_task,...")`.

4. **Register** via `mcp__scheduled-tasks__create_scheduled_task(...)`.

5. **Confirm to the user:**
   - Routine ID and storage path: `~/.claude/scheduled-tasks/{taskId}/SKILL.md`
   - Schedule in local time
   - Reminder: app must be open to fire on time; catches up on next launch if not
   - Manage with `list_scheduled_tasks` / `update_scheduled_task`
