---
name: web-publisher-publish
description: Publish one blog post per run — build a Next.js React component from markdown, update the blog index, stage and commit. Push content live without human handoff.
---

# Web Publisher: Publish Post

## Discovery
```bash
ls -1t content/topics/   # newest first
```
Find the first folder that has both `blog.md` AND `{slug}-hero.webp` but NO published page.

## Steps per Run
1. Read `blog.md` and `seo.md` — full content + front matter + SEO metadata
2. Read the project's web style guide for component conventions
3. Copy `{slug}-hero.webp` to `website/public/images/blog/`
4. Generate a Next.js (Pages Router) `.jsx` component at `website/pages/blog/posts/{slug}.jsx`:
   - `import Head from 'next/head'` — title, meta description, OG/Twitter tags, canonical URL
   - `import Image from 'next/image'` for all images (never `<img>`)
   - Read-time estimate in the post header
   - Category tag matching a valid blog category from the style guide
   - CSS module or global styles — no inline styles unless unavoidable
5. Add post card at the top of `website/pages/blog/index.jsx` — follow existing card pattern exactly
6. Stage: `git add website/pages/blog/posts/{slug}.jsx website/public/images/blog/{slug}-hero.webp website/pages/blog/index.jsx`
7. Commit: `git commit -m "publish: {Post Title}"`
8. Output: "Run `git push origin main` to go live."

## Quality Checklist (before commit)
- [ ] Component renders — correct JSX, no missing imports
- [ ] All images use `next/image` with correct `src`, `alt`, `width`, `height`
- [ ] `<Head>` includes title, meta description, OG/Twitter tags
- [ ] Category tag matches a valid blog category
- [ ] Post card at top of blog index grid
- [ ] Read-time estimate in post header
