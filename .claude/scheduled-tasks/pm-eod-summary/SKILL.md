---
name: pm-eod-summary
description: Weekdays at 6:37 PM — summarises what shipped today, what is blocked, and what is queued for tomorrow. Updates docs/project-status.html. Notifies team via Lark if configured.
suggested_cron: "37 18 * * 1-5"
---

It is now 6:37 PM. Today's date is YYYY-MM-DD.

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

## Step 1 — Load today's context

```bash
cd ~/code-projects/{project-slug}
git log --oneline --since="today 7am" --all
```

Read `docs/project-status.html` — today's approved items and auto-approvals.
Read today's briefing at `standup/briefings/YYYY-MM/YYYY-MM-DD.md` if it exists.

## Step 2 — Build EOD summary

Compile three sections:
- **Shipped today**: merged PRs, completed tasks
- **Blocked**: anything flagged during the day with no resolution
- **Queue for tomorrow**: highest-priority pending items

## Step 3 — Update project status

Update `docs/project-status.html` with the EOD summary. Add a timestamp.

## Step 4 — Notify (if Lark configured)

If `LARK_WEBHOOK_URL` is set:
```bash
lark-cli im +messages-send --as bot --chat-id "$LARK_CHAT_ID" --text $'🌇 EOD summary ready — check docs/project-status.html'
```

If Lark fails: append EOD summary inline to `docs/project-status.html` as a comment. Never create new alert files.
