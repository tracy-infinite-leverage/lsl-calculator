---
name: web-publisher-weekly
description: Wednesdays at 9:03 AM — finds content/topics/ folders that have blog.md and a hero image but no committed .jsx page, builds the Next.js page, optimises the image to WebP, updates the blog index, commits. Does not push — operator pushes manually.
suggested_cron: "3 9 * * 3"
---

It is Wednesday 9:03 AM. Today's date is YYYY-MM-DD.

## Step 1 — Find publishable content

```bash
cd ~/code-projects/{project-slug}
```

Look through `content/topics/*/`. Find folders that have:
- `blog.md` ✅
- A hero image (`hero.webp`, `hero.png`, or `hero.jpg`) ✅
- No corresponding `.jsx` page in `website/pages/blog/posts/` ✅

IMPORTANT: If no publishable content exists, stop and notify via Lark if configured.

## Step 2 — Read style guides

Read (required before building any component — do not skip):
- `agents/web-developer/context/web-style-guide.md`
- `agents/web-developer/context/style-guide.md`

## Step 3 — Build the page

Invoke the `build-page` skill from `~/.claude/skills/build-page/SKILL.md`.

The generated component must include:
- `<Head>` with title, meta description, OG/Twitter tags, canonical URL
- `next/image` for all images
- Valid category tag (from web-style-guide.md)
- Read-time estimate in the post header

## Step 4 — Optimise hero image

Convert hero image to WebP if not already:
```python
from PIL import Image
img = Image.open("content/topics/{slug}/hero.png")
img.save("website/public/images/blog/{slug}.webp", "webp", quality=85)
```

Reduce quality in 5% steps until file is under 150 KB if needed.

## Step 5 — Copy and update blog index

Copy component:
```bash
cp /tmp/generated-{slug}.jsx website/pages/blog/posts/{slug}.jsx
```

Add post card at the TOP of the grid in `website/pages/blog/index.jsx`. Follow the existing card pattern exactly. Do not change other cards.

## Step 6 — Commit (do not push)

```bash
git pull origin main
git checkout -b publisher/post/YYYY-MM-DD-{slug}
git add website/pages/blog/posts/{slug}.jsx \
        website/public/images/blog/{slug}.webp \
        website/pages/blog/index.jsx
git commit -m "publish: {post title}"
git push origin publisher/post/YYYY-MM-DD-{slug}
gh pr create --title "publish: {post title}" --base main --body "Ready to publish. Operator must review and merge."
git checkout main
git branch -d publisher/post/YYYY-MM-DD-{slug} 2>/dev/null || true
```

Note: do NOT auto-merge — operator reviews and pushes to trigger the live deploy.

## Step 7 — Update publish log

Append to `context/general-project-agent-context/publish-log.md`:
```
| YYYY-MM-DD | {Post title} | {slug}.jsx | {Category} |
```

## Step 8 — Notify (if Lark configured)

If `LARK_WEBHOOK_URL` is set:
```bash
lark-cli im +messages-send --as bot --chat-id "$LARK_CHAT_ID" --text $'🌐 Page built and PR opened for {slug} — review and merge to publish.'
```
