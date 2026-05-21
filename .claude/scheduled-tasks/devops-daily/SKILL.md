---
name: devops-daily
description: Weekdays at 6:03 AM — checks production health (Vercel deployment status, uptime), reviews GitHub Actions CI/CD runs for failures, surfaces open PRs with failing checks, documents any issues into epic-status.md before the PM reads it at 7 AM.
suggested_cron: "3 6 * * 1-5"
---

It is now 6:03 AM. Today's date is YYYY-MM-DD.

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

```bash
cd ~/code-projects/{project-slug}
```

## Step 1 — Check production deployment status

```bash
vercel ls --limit 5
vercel inspect $(vercel ls --limit 1 --json | jq -r '.[0].url') 2>/dev/null || true
curl -s -o /dev/null -w "%{http_code}" https://{project-slug}.vercel.app
```

Record: latest deployment status (READY / ERROR / BUILDING), HTTP response code, deploy timestamp.

Flag as ❌ if: status is ERROR, HTTP is not 200, or last successful deploy is > 48 hours old.

## Step 2 — Check GitHub Actions CI/CD runs

```bash
gh run list --limit 10 --json status,conclusion,name,createdAt,url
gh run list --limit 10 --json status,conclusion,name,createdAt,url \
  | jq '.[] | select(.conclusion == "failure" or .conclusion == "cancelled")'
```

Identify:
- Any failed or cancelled runs in the last 24 hours
- Which workflow failed (build, test, deploy, lint)
- Whether the failure is on main or a PR branch

## Step 3 — Check open PRs with failing checks

```bash
gh pr list --state open --json number,title,statusCheckRollup,headRefName \
  | jq '.[] | select(.statusCheckRollup != null) | select(.statusCheckRollup[] | select(.conclusion == "FAILURE"))'
```

For each failing PR: note the PR number, title, branch, and which check is failing.

## Step 4 — Document issues into epic-status.md

Read `docs/product/epic-status.md`.

For each issue found in Steps 1–3, add or update an entry in the **Open bugs** column of the relevant epic's row in the "At a glance" table.

Format for CI/CD bugs:
```
[CI] {workflow name} failing on {branch} — {date}
```

Format for production issues:
```
[PROD] {issue description} — {date}
```

If no issues found: add a note to the most recent epic's drilldown: `✅ CI/CD and production healthy — YYYY-MM-DD 06:03`.

Write the updated file back to `docs/product/epic-status.md`.

IMPORTANT: Write only factual observations. Do not modify epic status glyphs or pipeline dots — those are the PM's job at 7 AM.

## Step 5 — Commit changes

```bash
git pull origin main
git checkout -b devops/daily-check/YYYY-MM-DD
git add docs/product/epic-status.md
git commit -m "ops(ci): daily health check YYYY-MM-DD — {summary of findings}"
git push origin devops/daily-check/YYYY-MM-DD
gh pr create \
  --title "ops(ci): daily health check YYYY-MM-DD" \
  --base main \
  --body "Automated CI/CD and production status check. Auto-merge safe — observation only." \
  --label "ops,automated"
gh pr merge --merge --auto --delete-branch
git checkout main && git pull origin main
git branch -d devops/daily-check/YYYY-MM-DD 2>/dev/null || true
```

## Step 6 — Notify on failures (if Lark configured)

Only notify if there are failures (do not send a message on clean runs):

```bash
if [ "$ISSUES_FOUND" = "true" ]; then
  lark-cli im +messages-send --as bot --chat-id "$LARK_CHAT_ID" \
    --text $'⚠️ DevOps alert — YYYY-MM-DD 06:03\n{list of issues}\nCheck docs/product/epic-status.md for details.'
fi
```

If Lark fails: the epic-status.md commit is the record. Never create new alert files.
