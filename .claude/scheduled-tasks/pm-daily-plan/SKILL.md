---
name: pm-daily-plan
description: Weekdays at 7:03 AM — reads epic-status.md to extract the current to-do list, checks git log and standup check-ins, sets today's 3 priorities, auto-approves low-risk tasks, writes updated project-status.html for the developer agent to pick up at 9 AM.
suggested_cron: "3 7 * * 1-5"
---

It is now 7:03 AM. Today's date is YYYY-MM-DD.

## Step 0 — Load credentials

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

## Step 1 — Read epic-status.md and extract to-do list

```bash
cd ~/code-projects/{project-slug}
```

Read `docs/product/epic-status.md` in full. Extract every item that is:
- Status `☐ planned` — not yet started
- Status `🔄 in flight` — actively being worked on
- Status `⏳ partially done` — started but not complete

For each item, note: Epic ID, item description, current status, pipeline stage, open bug count.

This is the master to-do list for today.

## Step 2 — Check git activity and standup check-ins

```bash
git log --oneline --since="48 hours ago" --all
```

Read `standup/individual/*.md` — note any new check-ins or blockers since yesterday.
Read `content/content-calendar/` — identify this week's content queue.

## Step 3 — Set today's 3 priorities

Cross-reference the epic-status to-do list against git activity and check-ins. Select the 3 highest-value items for today in order of: unblocked + high-pipeline-stage first, then value.

Flag any blockers preventing progress.

**Auto-approve** tasks that are BOTH:
- (a) High priority AND
- (b) Low risk: no new code, no external API calls, content or config only

Log: `Auto-approved [task] at 07:03` for each. Everything else → pending for developer review.

## Step 4 — Update project-status.html

Update `docs/project-status.html` with:

- **Today's to-do list** — pulled directly from epic-status.md (all ☐/🔄/⏳ items)
- **Today's 3 priorities** — ordered list with risk rating
- **Auto-approved items** — flagged so the developer agent can pick them up immediately at 9 AM
- **Blockers** — anything the team needs to resolve before work can proceed
- **Last updated** — YYYY-MM-DD 07:03

IMPORTANT: The developer agent reads project-status.html at 9 AM to start its day. Write the approved items section clearly so it can be parsed without ambiguity.

## Step 5 — Notify (if Lark configured)

If `LARK_WEBHOOK_URL` is set:
```bash
lark-cli im +messages-send --as bot --chat-id "$LARK_CHAT_ID" \
  --text $'🌅 Daily plan set — project-status.html updated with today\'s to-do list from epic-status.md. Developer picks up at 9 AM.'
```
