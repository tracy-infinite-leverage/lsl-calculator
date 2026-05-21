---
name: infiniteleverage-help
description: "Show the full Infinite Leverage skill menu — all available skills grouped by team with trigger phrases and what each one produces. Use when the user asks 'what can I do?', 'what skills are available?', 'show me the menu', 'infiniteleverage help', or '/infiniteleverage-help'."
---

# Infinite Leverage — Skill Menu

Print the following menu verbatim, then offer to invoke any skill the user points to.

---

## 🛠 Developer

| Skill | Trigger | Produces |
|-------|---------|---------|
| `dev-planning` | "plan today's work", "read project status" | Daily plan drafted under `docs/plans/` |
| `dev-karpathy` | "spec first", "keep it simple", "Karpathy mode" | Spec-first design → TDD implementation |
| `dev-tdd` | "tdd", "red-green-refactor", "test-driven" | Failing test → minimal impl → green |
| `dev-feature-plan` | "plan this feature", "break this down" | Scoped feature plan with acceptance criteria |
| `dev-brainstorm` | "brainstorm", "think through options" | Structured options + recommendation |
| `dev-diagnose` | "why is this broken", "debug", "diagnose" | Root cause analysis + fix |
| `dev-zoom-out` | "zoom out", "give me context", "I'm new to this area" | Module map + key entry points |
| `dev-grill` | "grill me", "stress-test this plan", "what could go wrong" | Devil's advocate review of a plan or design |
| `dev-prototype` | "spike", "prototype", "is this feasible" | Minimal proof-of-concept + verdict |
| `dev-improve-arch` | "refactor", "improve architecture", "tech debt" | Targeted architecture improvement plan |
| `dev-github-hygiene` | "branch hygiene", "PR discipline", "commit standards" | Branch/PR/commit guardrails enforced |
| `dev-qa-delegation` | "call QA", "hand off to QA", "done implementing" | QA delegated, bugs fixed, PR merged |
| `dev-multi-agent` | "parallel agents", "wave-based", "multi-file task" | Wave-based parallel agent delegation |
| `dev-handoff` | "handoff", "wrapping up", "passing to QA" | BRIDGE.md handoff doc written |
| `create-agent` | "create an agent", "build an agent", "I need an agent that..." | Full agent package: persona + skills + evals + installed |

---

## 🧪 QA

| Skill | Trigger | Produces |
|-------|---------|---------|
| `qa-triage` | "triage", "classify this bug", "prioritise" | Bug scored P0–P3 with reproduction steps |
| `qa-best-practices` | "test strategy", "what to test", "test plan" | Test pyramid strategy for the feature |
| `qa-planning` | "QA plan", "what should QA cover" | Full QA plan with scope + exit criteria |
| `qa-documentation` | "document tests", "write test docs" | Test documentation written |

---

## ⚙️ DevOps

| Skill | Trigger | Produces |
|-------|---------|---------|
| `devops-setup-pre-commit` | "pre-commit", "husky", "lint-staged" | Pre-commit hooks configured |
| `devops-git-guardrails` | "protect main", "git guardrails", "branch rules" | Branch protection + guardrail rules applied |
| `devops-ops` | "check pipeline", "CI status", "deployment health" | Pipeline health report + fixes |

---

## 📋 Product Manager

| Skill | Trigger | Produces |
|-------|---------|---------|
| `pm-epic-writing` | "write an epic", "acceptance criteria", "spec this feature" | Epic with AC written to `docs/product/epics.md` |
| `pm-to-issues` | "create issues", "break into tickets", "to issues" | GitHub issues created from the epic |
| `pm-grill-with-docs` | "validate plan", "check against docs", "grill with docs" | Plan verified against product docs |
| `pm-standup` | "standup", "daily briefing", "what shipped" | Standup summary from git log |
| `pm-client-interview` | "client interview", "intake", "gather requirements" | Structured intake doc written |
| `pm-project-status` | "update project status", "project health" | `docs/project-status.html` updated |
| `pm-documentation` | "update docs", "write product docs" | Product documentation updated |
| `pm-clarify-guard` | "clarify", "ambiguous requirement", "missing detail" | Clarifying questions surfaced before building |
| `pm-analyze-split` | "split this epic", "too big", "break this up" | Epic split into deliverable chunks |
| `pm-constitution-sync` | "sync constitution", "update product principles" | Product constitution synced |

---

## ✍️ Writer

| Skill | Trigger | Produces |
|-------|---------|---------|
| `writer-seo-content` | "seo content", "keyword research", "meta description" | SEO-optimised blog post or page copy |

---

## 🎨 Designer

| Skill | Trigger | Produces |
|-------|---------|---------|
| `designer-image-generation` | "generate image", "hero image", "create a visual" | Gemini-generated image saved as WebP |
| `designer-design-system` | "design system", "brand tokens", "colour palette" | Design tokens + component spec |
| `designer-ui-ux` | "mockup", "wireframe", "ui design" | UI/UX design spec or prototype |
| `designer-style-to-photo` | "style photo", "apply brand style", "retouch" | Brand-styled photo output |

---

## 🌐 Web Publisher

| Skill | Trigger | Produces |
|-------|---------|---------|
| `web-publisher-publish` | "publish", "push to site", "build the page" | React component + blog index updated + commit staged |

---

## 📧 Email Marketer

| Skill | Trigger | Produces |
|-------|---------|---------|
| `email-marketer-nurture` | "email campaign", "newsletter", "nurture sequence" | Email draft written, ready for operator approval |

---

## 🔧 Global / Admin

| Skill | Trigger | Produces |
|-------|---------|---------|
| `daily-checkin` | "daily checkin", "morning briefing", "how's the team" | Team status summary across all agents |
| `create-local-routine` | "create a routine", "automate this", "schedule this locally" | CronCreate routine registered |
| `create-agent` | "create an agent", "I need a new agent role" | Full agent package installed to `.claude/agents/` |
| `marketing-strategist` | "marketing strategy", "content plan", "campaign brief" | Marketing strategy or campaign brief |
| `global-caveman` | "caveman mode", "explain simply", "eli5" | Complex concept explained simply |

---

## 🚀 Setup & Maintenance

| Skill | Trigger | Produces |
|-------|---------|---------|
| `infiniteleverage-init` | "init", "bootstrap a new machine", "set up from scratch" | Full Mac Mini bootstrap: website + 8 agents + schedules |
| `infiniteleverage-onboard` | "onboard", "connect my laptop", "personal laptop setup" | Laptop connected to existing AI team |
| `infiniteleverage-patch` | "patch", "sync agents", "update my setup" | Health check + agents/skills/hooks synced to latest |
| `infiniteleverage-help` | "help", "what can I do", "show me the menu" | This menu |

---

After printing the menu, say:

> "Point me at any skill and I'll run it — or just describe what you want to do and I'll match it."
