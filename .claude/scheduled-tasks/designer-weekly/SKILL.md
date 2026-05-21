---
name: designer-weekly
description: Tuesdays at 9:03 AM — finds the most recently written blog.md with no hero image yet, generates the hero image via the generate-image skill, saves to content/topics/{slug}/hero.webp.
suggested_cron: "3 9 * * 2"
---

It is Tuesday 9:03 AM. Today's date is YYYY-MM-DD.

## Step 1 — Find the unimaged blog post

```bash
cd ~/code-projects/{project-slug}
```

Look through `content/topics/*/blog.md`. Find the folder that has a `blog.md` but no hero image (`hero.webp`, `hero.png`, or `hero.jpg`), with the most recent date prefix. That is the target.

IMPORTANT: If all blog posts already have images, stop and notify via Lark if configured.

## Step 2 — Read context

Read:
- `content/topics/{slug}/blog.md` — the post to generate an image for
- `content/topics/{slug}/brief.md` — for additional context
- `docs/brand/palette.md` — brand colour palette (if exists)
- `agents/designer/context/persona.md` — designer style guide (if exists)

## Step 3 — Generate hero image

Invoke the `generate-image` skill from `~/.claude/skills/generate-image/SKILL.md`.

The image prompt should:
- Reflect the post's core theme
- Match the brand palette
- Be photographic or illustrative (not generic stock)
- Avoid text overlays

Save the generated image to `content/topics/{slug}/hero.webp`.

## Step 4 — Commit and PR

```bash
git pull origin main
git checkout -b designer/hero/YYYY-MM-DD-{slug}
git add content/topics/{slug}/hero.webp
git commit -m "design(hero): generate image for {slug}"
git push origin designer/hero/YYYY-MM-DD-{slug}
gh pr create --title "design(hero): {slug}" --base main --body "Automated hero image. Review before merging."
git checkout main
git branch -d designer/hero/YYYY-MM-DD-{slug} 2>/dev/null || true
```

Note: do NOT auto-merge — images need human approval before publishing.

## Step 5 — Notify (if Lark configured)

If `LARK_WEBHOOK_URL` is set:
```bash
lark-cli im +messages-send --as bot --chat-id "$LARK_CHAT_ID" --text $'🎨 Hero image generated for {slug} — PR opened for review.'
```
