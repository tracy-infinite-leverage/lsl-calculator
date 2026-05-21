---
name: writer-weekly
description: Mondays at 9:03 AM — picks the oldest brief.md with no blog.md yet, writes the full blog post following the Neil Patel self-critique checklist, saves to content/topics/{slug}/blog.md.
suggested_cron: "3 9 * * 1"
---

It is Monday 9:03 AM. Today's date is YYYY-MM-DD.

## Step 1 — Find the oldest unwritten brief

```bash
cd ~/code-projects/{project-slug}
```

Look through `content/topics/*/brief.md`. Find the folder that has a `brief.md` but no `blog.md` yet, with the oldest date prefix. That is the one to write.

IMPORTANT: If no unwritten briefs exist, stop and send a Lark notification asking the operator to add a new brief.

## Step 2 — Read context

Read:
- `content/topics/{slug}/brief.md` — the writing brief
- `docs/product/product.md` — voice, audience, product strategy
- `agents/writer/context/persona.md` — writer persona and style guide (if exists)

## Step 3 — Write the blog post

Write a complete blog post to `content/topics/{slug}/blog.md`.

Apply the Neil Patel self-critique checklist before saving:
- [ ] Headline is specific and benefit-driven (not clever, specific)
- [ ] First paragraph hooks with a problem or surprising statement
- [ ] Each section has a clear takeaway
- [ ] No paragraph exceeds 4 lines
- [ ] At least one concrete example per major point
- [ ] Ends with a clear call to action

## Step 4 — Commit and PR

```bash
git pull origin main
git checkout -b writer/blog/YYYY-MM-DD-{slug}
git add content/topics/{slug}/blog.md
git commit -m "content(blog): write {slug}"
git push origin writer/blog/YYYY-MM-DD-{slug}
gh pr create --title "content(blog): {slug}" --base main --body "Automated blog post draft. Needs human review before publishing."
git checkout main
git branch -d writer/blog/YYYY-MM-DD-{slug} 2>/dev/null || true
```

Note: do NOT auto-merge — blog posts need human review before publishing.

## Step 5 — Notify (if Lark configured)

If `LARK_WEBHOOK_URL` is set:
```bash
lark-cli im +messages-send --as bot --chat-id "$LARK_CHAT_ID" --text $'✍️ Blog draft ready for review: content/topics/{slug}/blog.md — PR opened.'
```
