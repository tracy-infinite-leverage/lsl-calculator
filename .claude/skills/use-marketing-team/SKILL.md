---
name: use-marketing-team
description: Use when any content or marketing work needs to be routed to the right agent on the marketing team. Triggered automatically by CLAUDE.md context when the conversation involves writing, design, publishing, or email. Also triggered explicitly when the operator says "use marketing team", "who handles content", "route this to marketing", or "what agent do I need for X". Covers Writer, Designer, Web Publisher, and Email Marketer agents.
---

# Use Marketing Team

Routing guide for the 4-agent marketing and content team.

## Team Roster

| Agent | File | Handles |
|---|---|---|
| **Writer** | `~/.claude/agents/writer.md` | Blog posts, SEO content, copy, social media, translations |
| **Designer** | `~/.claude/agents/designer.md` | Hero images, social graphics, design system, UI mockups |
| **Web Publisher** | `~/.claude/agents/web-publisher.md` | React components from approved content, blog index, git stage |
| **Email Marketer** | `~/.claude/agents/email-marketer.md` | Email sequences, Brevo campaigns, lead nurture, Supabase lists |

## Routing Table

| Task | Agent | Trigger Phrases |
|---|---|---|
| Write a blog post | Writer | "write a post", "draft content", "write about", "blog post" |
| SEO content | Writer → `writer-seo-content` | "seo", "meta description", "keyword", "optimise for search" |
| Social copy | Writer | "social post", "instagram caption", "tweet", "linkedin post" |
| Vietnamese translation | Writer | "translate", "vietnamese", "tiếng việt" |
| Hero image | Designer → `designer-image-generation` | "generate image", "hero image", "create a visual", "design image" |
| Design system | Designer → `designer-design-system` | "design system", "tokens", "colours", "brand guide" |
| UI mockup | Designer → `designer-ui-ux` | "mockup", "wireframe", "ui design", "screen design" |
| Publish a post | Web Publisher → `web-publisher-publish` | "publish", "build the page", "push to site", "update blog index" |
| Email campaign | Email Marketer → `email-marketer-nurture` | "email campaign", "newsletter", "send to subscribers", "nurture" |
| Brevo import | Email Marketer | "import contacts", "brevo list", "add to email list" |
| Email sequence | Email Marketer | "email sequence", "drip", "automated email" |

## Content Pipeline

```
Writer (draft approved content)
    ↓
Designer (generate hero image + social graphics)
    ↓
Web Publisher (build React component, update blog index, git commit)
    ↓ operator runs: git push origin main
Email Marketer (send announcement to subscribers)
```

## Queue Check

Before starting any new content piece:

1. Check the content calendar — is there already a draft in progress?
2. Check `docs/project-status.html` — is there a publishing backlog?
3. Check `email-index.md` — has the last published post been emailed?

Do not start a new piece if there is unpublished approved content in the queue.

## Hard Rules

- **Web Publisher never pushes to GitHub.** It commits locally and tells the operator to run `git push origin main`.
- **Email Marketer never sends without explicit operator approval.** All campaigns are drafted first.
- **Designer generates images only from approved written content.** No images before the copy is approved.
- **Writer does not publish.** Approved content goes to Web Publisher — never self-published.

## Skills Index

```
writer-seo-content          — SEO-optimised blog posts
designer-image-generation   — hero and social image generation
designer-design-system      — brand tokens and design system
designer-ui-ux              — UI mockups and screen design
designer-style-to-photo     — style reference to photo generation
web-publisher-publish       — React component from content, git stage
email-marketer-nurture      — lead nurture email sequence
```
