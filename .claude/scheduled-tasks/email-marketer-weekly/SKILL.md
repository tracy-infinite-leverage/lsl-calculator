---
name: email-marketer-weekly
description: Thursdays at 10:03 AM — checks the email index, drafts this week's newsletter based on the most recently published post, saves to emails/drafts/newsletter-YYYY-MM-DD.md. Draft only — does not send without approval.
suggested_cron: "3 10 * * 4"
---

It is Thursday 10:03 AM. Today's date is YYYY-MM-DD.

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

## Step 1 — Check email index

```bash
cd ~/code-projects/{project-slug}
```

Read `agents/email-marketer/context/email-index.md`. Identify:
- Which stage is currently in flight
- The most recently published blog post
- Which subscribers have already received what

IMPORTANT: If email-index.md is missing or Stage 0 is empty, stop and notify via Lark.

## Step 2 — Read source content

Read the most recently published `content/topics/*/blog.md` that has a corresponding page in `website/pages/blog/posts/`.

Read `agents/email-marketer/context/persona.md` for email voice and style (if exists).

## Step 3 — Draft newsletter

Write newsletter draft to `emails/drafts/newsletter-YYYY-MM-DD.md` with frontmatter:

```markdown
---
subject: {subject line}
preview: {preview text — 90 chars max}
segment: all-subscribers
stage: review
source_post: content/topics/{slug}/blog.md
---

{email body — conversational, value-first, single clear CTA}
```

Newsletter rules:
- Subject line is specific and curiosity-driven (not "This week's update")
- First line hooks without "I hope this finds you well"
- One main idea only — link to post for the rest
- CTA is a single link to the published post
- Plain-text friendly (no heavy HTML)

## Step 4 — Commit and PR

```bash
git pull origin main
git checkout -b email/newsletter/YYYY-MM-DD
git add emails/drafts/newsletter-YYYY-MM-DD.md
git commit -m "email(newsletter): draft YYYY-MM-DD"
git push origin email/newsletter/YYYY-MM-DD
gh pr create --title "email(newsletter): YYYY-MM-DD draft" --base main --body "Newsletter draft — review subject line and body before approving send."
git checkout main
git branch -d email/newsletter/YYYY-MM-DD 2>/dev/null || true
```

Note: do NOT send or auto-merge — operator must approve before sending.

## Step 5 — Notify (if Lark configured)

If `LARK_WEBHOOK_URL` is set:
```bash
lark-cli im +messages-send --as bot --chat-id "$LARK_CHAT_ID" --text $'📧 Newsletter draft ready: emails/drafts/newsletter-YYYY-MM-DD.md — approve to send.'
```
