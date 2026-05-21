---
name: pm-weekly-rag
description: Fridays at 5:07 PM — generates Red/Amber/Green status report from the week's briefings, writes to docs/product/rag-YYYY-MM-DD.md, notifies team via Lark if configured.
suggested_cron: "7 17 * * 5"
---

It is Friday 5:07 PM. Today's date is YYYY-MM-DD.

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

## Step 1 — Load this week's briefings

```bash
cd ~/code-projects/{project-slug}
MONTH=$(date +%Y-%m)
ls standup/briefings/$MONTH/
```

Read all daily briefings from this week. Read `docs/product/epic-status.md` for pipeline status per epic.

## Step 2 — Write RAG report

Write to `docs/product/rag-YYYY-MM-DD.md`:

```markdown
# Weekly RAG Report — YYYY-MM-DD

## Overall health: 🟢 / 🟡 / 🔴

## Workstream status
| Workstream | Status | Notes |
|------------|--------|-------|
| [Epic 1]   | 🟢     |       |

## Key decisions this week
- [decision + who made it]

## Risks to flag
- [risk + mitigation]

## Next week priorities
1. [highest value item]
2. [second item]
3. [third item]

## Decisions needed from stakeholders
- [open decision + owner + deadline]
```

## Step 3 — Commit and PR

```bash
git pull origin main
git checkout -b pm/weekly-rag/YYYY-MM-DD
git add docs/product/rag-YYYY-MM-DD.md
git commit -m "docs(rag): weekly report YYYY-MM-DD"
git push origin pm/weekly-rag/YYYY-MM-DD
gh pr create --title "docs(rag): weekly RAG YYYY-MM-DD" --base main --body "Automated weekly RAG report."
gh pr merge --merge --auto --delete-branch
git checkout main && git pull origin main
git branch -d pm/weekly-rag/YYYY-MM-DD 2>/dev/null || true
```

## Step 4 — Notify (if Lark configured)

If `LARK_WEBHOOK_URL` is set:
```bash
lark-cli im +messages-send --as bot --chat-id "$LARK_CHAT_ID" --text $'📊 Weekly RAG report ready — docs/product/rag-YYYY-MM-DD.md'
```
