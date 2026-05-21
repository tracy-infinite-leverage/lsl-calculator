---
name: writer-seo-content
description: One blog post per run with SEO-optimized content, Neil Patel self-critique, and structured brief-driven workflow. Produces blog.md and image-prompts.md.
---

# Writer: SEO Content Production

## Discovery
```bash
ls -1t content/topics/   # list all topic folders, newest first
```
Find the first folder that has `brief.md` but NOT `blog.md`. Validate brief.md has all required fields before starting.

## Brief Format (required — stop if missing fields)

```markdown
# Post Brief
**Title**: [working title]
**Target keyword**: [primary SEO keyword]
**Audience**: [who is this for — be specific]
**Angle**: [what unique point of view or claim?]
**Hook idea**: [optional — surprising stat, claim, or question]
**Supporting points**: [3–5 bullet points]
**Call to action**: [what should the reader do after reading?]
**Tone**: [e.g. authoritative, conversational, technical, story-driven]
**Deadline**: [YYYY-MM-DD or "next Monday run"]
```

## Output per Run
1. `content/topics/{slug}/blog.md` — full post in owner's voice
2. `content/topics/{slug}/image-prompts.md` — visual prompt for Designer

## Neil Patel Self-Critique (mandatory after every draft)

Run this checklist before saving final files:

### Hook
- Does the opening line make the reader need to keep reading?
- Weak: starts with context-setting or background
- Strong: opens with a surprising claim, data point, or direct challenge

### SEO Structure
- Primary keyword in: title, first 100 words, and at least two H2s
- H2s: do they tell a complete story when read alone (without body text)?
- Meta description: would a one-sentence summary make someone click?

### Proof Density
- Every claim needs evidence: data, named example, or case study
- "Many businesses find that..." is not proof — name the business, cite the stat
- Remove any assertion a reader could dismiss with "says who?"

### Scanability
- Can someone read only H2s and subheadings and understand the main point?
- No paragraph longer than 4 lines
- Bullet lists for 3+ parallel items

### Call to Action
- Exactly one CTA at the end — not three
- It should be specific ("Book a 30-min call") not generic ("Get in touch")

### Cut 20%
- Every sentence earns its place or gets cut
- If a section doesn't add new information, it goes

## image-prompts.md Format
```
subject: [main visual element]
style: [art style or photographic style]
mood: [emotional tone]
palette: [key colors]
composition: [framing or layout note]
avoid: [things to exclude]
```
