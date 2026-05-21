# Canonical Project Folder Structure

> **Authoritative spec.** Every Infinite Leverage project follows this layout. The PM agent, developer agent, and `infiniteleverage-init` skill must honor it exactly. Do not invent new top-level folders. New per-project additions go inside the existing slots.

## Fixed filenames (DO NOT rename)

These files have hard-coded names that skills and agents reference by path:

| Path | Owner | Updated by |
|------|-------|------------|
| `docs/product/product.md` | PM agent | `pm-documentation` skill |
| `docs/product/epics.md` | PM agent | `pm-epic-writing` skill |
| `docs/product/epic-status.md` | PM agent | `pm-epic-writing` skill |
| `docs/project-status.html` | PM agent | `pm-project-status` skill |
| `CLAUDE.md` | All agents | Manual / `/init` |
| `README.md` | Developer agent | Manual |
| `.env.example` | Developer agent | `dev-github-hygiene` skill |
| `.gitignore` | Developer agent | Manual |
| `context/general-project-agent-context/publish-log.md` | web-publisher | Append-only |
| `.specify/memory/constitution.md` | PM agent | `speckit-constitution` skill |
| `.specify/features/{slug}/spec.md` | PM agent | `speckit-specify` via `pm-epic-writing` |
| `.specify/features/{slug}/impl-plan.md` | Developer agent | `speckit-plan` via `dev-feature-plan` |
| `.specify/features/{slug}/tasks.md` | Developer agent | `speckit-tasks` via `dev-feature-plan` |

## Full tree

```
<project>/
├── .claude/                                    ← Claude Code local config
│   ├── agents/                                 ← Project-scoped agent overrides (.md files)
│   │   └── PH-project-agent.md
│   ├── rules/
│   │   └── global-engineering.md               ← Engineering guardrails
│   ├── skills/                                 ← Project-scoped skills
│   │   └── PH-skill-name/
│   │       └── SKILL.md
│   └── worktrees/                              ← git-worktree workspaces (gitignored)
│
├── .specify/                                   ← spec-kit working directory (gitignored internals)
│   ├── features/                               ← One folder per feature slug
│   │   └── {slug}/
│   │       ├── spec.md                         ← Written by speckit-specify (via pm-epic-writing)
│   │       ├── dev-findings.md                 ← Written by pm-analyze-split
│   │       ├── impl-plan.md                    ← Written by speckit-plan (via dev-feature-plan)
│   │       └── tasks.md                        ← Written by speckit-tasks (via dev-feature-plan)
│   ├── memory/
│   │   └── constitution.md                     ← Written by speckit-constitution
│   ├── templates/                              ← spec-kit internal templates
│   └── extensions/
│       └── git/
│           └── git-config.yml                  ← All auto-commits disabled by default
│
├── agents/                                     ← Per-agent context + skills + workflows
│   ├── product-manager/
│   │   ├── context/
│   │   │   └── persona.md                      ← Project overrides for PM
│   │   ├── skills/
│   │   │   └── pm-project-overrides/SKILL.md
│   │   └── workflows/
│   │       ├── daily-standup.md
│   │       └── release-monitor.md
│   ├── developer/
│   │   ├── context/persona.md
│   │   └── skills/dev-stack-overrides/SKILL.md
│   ├── qa/
│   │   ├── context/persona.md
│   │   └── skills/qa-checklist-overrides/SKILL.md
│   ├── devops/
│   │   ├── context/persona.md
│   │   └── skills/
│   ├── designer/
│   │   ├── context/persona.md
│   │   └── skills/designer-brand-overrides/SKILL.md
│   ├── writer/
│   │   ├── context/persona.md
│   │   └── skills/writer-voice-overrides/SKILL.md
│   ├── web-publisher/
│   │   ├── context/persona.md
│   │   ├── skills/publisher-pipeline-overrides/SKILL.md
│   │   └── output/                              ← Build artifacts staging
│   └── email-marketer/
│       ├── context/persona.md
│       └── skills/
│
├── content/                                    ← Source-of-truth content
│   ├── content-calendar/
│   │   └── PH-content-calendar.md
│   └── topics/                                  ← One folder per topic bundle
│       └── YYYY-MM-DD-PH-topic-slug/
│           ├── brief.md                         ← Writer's brief (input)
│           ├── blog.md                          ← Drafted post
│           ├── seo.md                           ← Title/meta/keywords
│           ├── social-twitter.md
│           ├── social-linkedin.md
│           ├── social-facebook.md
│           └── images.md                        ← Image prompts
│
├── context/                                    ← Agent-only context (not project docs)
│   ├── brand/
│   │   ├── voice.md                             ← Tone, vocabulary, dos/don'ts
│   │   └── palette.md                           ← Color tokens
│   ├── general-project-agent-context/
│   │   ├── publish-log.md                       ← Append-only publish ledger
│   │   └── blog-index.md                        ← Pointer to website blog index
│   └── source-material/                         ← Raw research per topic area
│       └── PH-research-topic/
│           └── PH-notes.md
│
├── docs/                                       ← Human-readable project docs
│   ├── product/                                 ← PM agent territory
│   │   ├── product.md                           [FIXED]
│   │   ├── epics.md                             [FIXED — created/updated by pm-epic-writing]
│   │   ├── epic-status.md                       [FIXED — created/updated by pm-epic-writing]
│   │   └── constitution.md                      [copy of .specify/memory/constitution.md — pm-constitution-sync]
│   ├── project-status.html                      [FIXED — single-file dashboard]
│   ├── architecture/
│   │   ├── README.md
│   │   ├── plans/PH-plan-name.md
│   │   ├── readings/PH-reading-topic.md
│   │   ├── templates/PH-template-name.md
│   │   └── workflows/PH-workflow-name.md
│   ├── archive/                                 ← Superseded docs
│   ├── engineering/
│   │   ├── changes/YYYY-MM-DD-PH-change.md
│   │   └── prompts/PH-setup-prompt.md
│   ├── features/                                ← One folder per feature (human-readable proposals)
│   │   └── PH-feature-slug/
│   │       ├── proposal.md
│   │       └── design.md
│   ├── plans/PH-plan-name.md
│   └── qa/
│       ├── qa-plan.md
│       └── PH-regression-report.md
│
├── emails/
│   └── drafts/YYYY-MM-DD-PH-subject.md          ← Markdown draft with frontmatter
│
├── standup/
│   ├── individual/PH-person.md                  ← Per-person check-in log
│   └── briefings/
│       └── YYYY-MM/YYYY-MM-DD.md                ← Daily PM-compiled briefing
│
├── resources/                                  ← Design system, brand assets, masters
│   └── README.md
│
├── website/                                    ← Next.js app (scaffolded by developer)
│   └── README.md
│
├── CLAUDE.md                                   [FIXED]
├── README.md                                   [FIXED]
├── .env.example                                [FIXED]
└── .gitignore                                  [FIXED]
```

## Naming conventions

- **Dates**: `YYYY-MM-DD` everywhere. Briefings folders: `YYYY-MM/`.
- **Slugs**: lowercase, hyphenated, no spaces. `2026-04-13-horse-wedding`, not `2026_04_13_HorseWedding`.
- **Placeholders**: files prefixed `PH-` are placeholders in this template. Real projects rename them.
- **spec-kit slugs**: kebab-case, no date prefix. `user-auth`, `email-notifications`.

## Rules for agents

1. **Never invent new top-level folders.** New work goes inside an existing slot. If a slot doesn't fit, raise it to the PM agent first.
2. **Honor fixed filenames.** Never rename `product.md`, `epics.md`, `epic-status.md`, `project-status.html`. Skills break otherwise.
3. **Per-agent context lives under `agents/<agent>/`**, not under `docs/`. `docs/` is for humans.
4. **Per-agent skill overrides** in `agents/<agent>/skills/<skill-name>/SKILL.md` take precedence over global `~/.claude/skills/` versions.
5. **Source content → `content/topics/<slug>/`. Published artifacts → `website/`.** Never publish directly from `content/`.
6. **Working scratch files → `working_files/`** (gitignored). Never commit.
7. **Worktrees → `.claude/worktrees/`** (gitignored). One per parallel task.
8. **spec-kit artifacts → `.specify/features/{slug}/`.** Never write spec.md, impl-plan.md, or tasks.md outside `.specify/`.

## When to deviate

Only the PM agent can approve deviations, and any deviation must be recorded in `docs/engineering/changes/YYYY-MM-DD-folder-structure-deviation.md` with reason and rollback plan.
