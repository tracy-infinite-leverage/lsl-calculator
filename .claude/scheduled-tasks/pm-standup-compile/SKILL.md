---
name: pm-standup-compile
description: Weekdays at 6:07 PM — reads all standup check-ins, compiles daily team briefing to standup/briefings/YYYY-MM/YYYY-MM-DD.md, notifies team via Lark if configured.
suggested_cron: "7 18 * * 1-5"
---

It is now 6:07 PM. Today's date is YYYY-MM-DD.

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

## Step 1 — Load today's check-ins

```bash
cd ~/code-projects/{project-slug}
```

Read `standup/individual/*.md` for each team member. Note what each person reported for today.

## Step 2 — Pull git activity

```bash
git log --oneline --since="yesterday 7am" --all --format="%an: %s"
```

Pair reported work against actual git commits. Flag mismatches (positive: did more than reported, negative: reported work but no commits).

## Step 3 — Write briefing

Write compiled briefing to `standup/briefings/YYYY-MM/YYYY-MM-DD.md`:

```markdown
# Daily Briefing — YYYY-MM-DD

## Team Check-ins
[per-person summary]

## Git Activity
[commits and PRs since yesterday 7 AM]

## Flags
[mismatches, blockers, anything needing attention]

## Tomorrow
[priorities from docs/project-status.html]
```

## Step 4 — Commit and PR

```bash
git pull origin main
git checkout -b pm/standup-compile/YYYY-MM-DD
git add standup/briefings/YYYY-MM/YYYY-MM-DD.md
git commit -m "docs(standup): daily briefing YYYY-MM-DD"
git push origin pm/standup-compile/YYYY-MM-DD
gh pr create --title "docs(standup): YYYY-MM-DD briefing" --base main --body "Automated daily briefing."
gh pr merge --merge --auto --delete-branch
git checkout main && git pull origin main
git branch -d pm/standup-compile/YYYY-MM-DD 2>/dev/null || true
```

## Step 5 — Notify (if Lark configured)

If `LARK_WEBHOOK_URL` is set:
```bash
lark-cli im +messages-send --as bot --chat-id "$LARK_CHAT_ID" --text $'📋 Daily briefing compiled — standup/briefings/YYYY-MM/YYYY-MM-DD.md'
```
