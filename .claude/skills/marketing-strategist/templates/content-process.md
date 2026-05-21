# {{CLIENT_NAME}} — Content Process

## Overview

This document defines how the content machine runs. Weekly rhythm, channel schedule, folder and file conventions, and the agent pipeline. The actual topics and hooks live in `content-calendar.md`. The brand strategy lives in `strategy.md`.

---

## Weekly Rhythm

| Day | Type | Content | Channels |
|-----|------|---------|----------|
| {{DAY_1}} | {{Blog + Social / Social only}} | **{{ANGLE NAME}}** — {{one line}} | {{CHANNELS}} |
| {{DAY_2}} | {{...}} | {{...}} | {{...}} |
| {{DAY_3}} | {{...}} | {{...}} | {{...}} |

{{If a secondary audience has a separate track — e.g. LinkedIn for B2B — describe its cadence here. Does NOT follow the main rhythm.}}

---

## Content Pairing Rules

- {{Rule 1: how publishing days connect across the week — matched pairs, narrative arcs}}
- {{Rule 2: what each week's payoff post must do}}
- {{Rule 3: one primary topic per week / multiple / etc.}}
- Each topic gets its own folder under `content/topics/<YYYY-MM-DD>-<type>-<topic>/`.

---

## Folder Naming Convention

**Format:** `<YYYY-MM-DD>-<type>-<topic>`

- `YYYY-MM-DD` — the post's publish date (zero-padded, sortable)
- `type` — one of: {{list from strategy.md content angles}}
- `topic` — short topic keyword in kebab-case

**Examples:**
- `{{YYYY-MM-DD}}-{{type}}-{{topic-slug}}` — {{one-line description}}

**URL slugs are separate.** Folder name is organizational. The published URL uses a semantic slug declared in `blog.md` frontmatter (`url-slug:` field).

---

## Topic Folder Structure

```
content/topics/<YYYY-MM-DD>-<type>-<topic>/
├── blog.md                     # Full blog post
├── seo.md                      # SEO metadata for the blog post
├── {{day}}-{{channel}}.md      # Social posts, e.g. mon-facebook.md, fri-instagram.md
├── image-prompts.json          # Image generation prompts (written by writer agent)
```

Not every topic has all files. A topic owns only the deliverables assigned to it in the calendar.

---

## File Naming Convention

- **Blog:** `blog.md`
- **SEO:** `seo.md`
- **Social:** `[day]-[channel].md`

---

## Source Material Structure

```
context/source/
├── {{subfolder per source type — e.g. user-stories/, research/, founder/, caregiver/}}
```

All source files include a header with: date added, source type, topic tags. Lets the writer agent retrieve relevant material without scanning everything.

---

## Agent Pipeline

### Step 1 — Calendar Updated ({{day, prior week}})
The human or content producer agent updates `content-calendar.md` with the following week's topics, hooks, and publish dates. All topics marked `STATUS: PLANNED`.

### Step 2 — Writer Agent Runs ({{day}})
The writer agent:
1. Reads `strategy.md` for brand voice and CTA rules
2. Reads `content-calendar.md` for next week's topics
3. Pulls relevant source material from `context/source/`
4. Creates topic folders and writes all deliverables
5. Writes `image-prompts.json` as the final step for each topic
6. Updates topic status to `STATUS: WRITTEN`

### Step 3 — Image Designer Runs ({{day, after writer}})
Once topics are marked `WRITTEN`:
1. Reads `content-calendar.md` for `WRITTEN` topics
2. Loads `image-prompts.json` for each
3. Generates all images in parallel
4. Saves images to the topic folder
5. Updates status to `STATUS: DESIGNED`

### Step 4 — Review Notification (automated, no gate)
When the Web Developer runs, an email goes to the review list (configured per project — see `context/strategy.md` Notifications section). FYI only. Does not block publishing. Feedback feeds the next iteration.

### Step 5 — Web Developer Runs ({{day}})
Picks up `DESIGNED` content and stages it according to the calendar. Generates list-blast email files (awaiting human send) and fires the reviewer notification. Updates status to `PUBLISHED`.

---

## Monthly Planning

### 1. Choose the Month's Themes
Before each month, define {{N}} weekly topics. Each week needs:
- {{Day_1 angle}} — {{what this slot needs}}
- {{Day_2 angle}} — {{what this slot needs}}
- {{Day_3 angle}} — {{what this slot needs}}

### 2. Update the Content Calendar
Add new weeks to `content-calendar.md`. One rolling file only.

### 3. Prepare Source Material
Confirm relevant source material is in place before the writer agent runs.

### 4. Distribution Coordination
{{If the strategy has a distribution asset — email list, etc. — describe how publishing flows to it here.}}

---

## Status Flags

| Status | Meaning |
|--------|---------|
| `PLANNED` | Topic in calendar, writing not started |
| `WRITTEN` | All content files written, image prompts ready |
| `DESIGNED` | Images generated and saved to topic folder |
| `PUBLISHED` | Web Developer staged everything, reviewer notification sent. Public visibility depends on per-channel human action (deploy, paste, send). |
