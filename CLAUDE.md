# LSL Calculator — Project Instructions

This file is the entry point Claude Code reads when this repo is opened. It defines roles, folder conventions, and publishing/engineering workflows.

## ⚠️ Pre-launch guard — Anthropic ZDR

**Before any agent acts on a "merge to main", "cut over", "go live", or "ship it" signal, READ `docs/launch/LAUNCH-GUARD.md` first.**

In short: Zero Data Retention was requested with Anthropic on 2026-05-23. Production traffic cannot start until Anthropic confirms ZDR is **active** on the production key — the privacy notice claim becomes inaccurate otherwise. The guard file has the full check + fallback options.

## Stack
- Website: Next.js + Tailwind + shadcn (`website/`)
- Database: Supabase (`website/supabase/`)
- Deployment: Vercel (auto-deploy on push to `main`)
- Email: Resend or Brevo (see `agents/email-marketer/context/`)

<!-- BEGIN: AGENT-DELEGATION (managed by infiniteleverage skills — do not delete this block) -->
## Agent delegation (auto-routing)

When you receive a request, **delegate to the right specialist agent** before doing the work yourself. The 8 agents and their triggers:

| Agent | Delegate when the request involves… |
|---|---|
| **product-manager** | roadmap, vision, epics, daily plan, project-status.html, scope changes, approval triage, stakeholder updates, standup briefings |
| **developer** | writing/changing code, fixing bugs, refactoring, scaffolding pages, API endpoints, Supabase migrations, env-vars wiring |
| **qa** | testing, regression checks, browser matrix, accessibility, QA plans, "verify this works" |
| **devops** | CI/CD, deployments, secret management, infra escalations, Vercel/GitHub workflow issues |
| **designer** | UI mockups, brand application, image prompts, design system updates, visual reviews |
| **writer** | blog drafts, social copy, SEO briefs, voice/tone, content briefs |
| **web-publisher** | publishing markdown → Next.js components, updating `website/pages/blog/index.jsx`, image optimization, the publish workflow |
| **email-marketer** | email drafts, sequences, broadcast campaigns, Brevo/Resend, CRM segmentation |

**Delegation rules:**
1. Pick exactly **one** agent per turn — don't run two in parallel unless the operator explicitly says so.
2. If a request spans agents (e.g., "write a blog *and* publish it"), call them **in sequence**: writer → designer → web-publisher.
3. If unclear which agent fits, **ask the operator** before assuming.
4. Cross-cutting engineering rules live in `.claude/rules/global-engineering.md` — every agent honors them.
5. Project-level persona overrides for each agent live in `agents/<name>/context/persona.md` — read these on first invocation.
6. Trigger phrases: `@product-manager`, `@developer`, etc. — but auto-route even without the `@` when intent is clear.
7. See `~/.claude/rules/agent-routing.md` for the full phrase-to-agent routing table — it is always active.
<!-- END: AGENT-DELEGATION -->

## Agent Team Skills

Two global skills provide full routing context on demand. Invoke them when you need the complete picture for a team:

| Skill | Invoke when… |
|---|---|
| `/use-dev-team` | Any development work — shows full routing table, handoff chain, and skills index for PM + Developer + QA + DevOps |
| `/use-marketing-team` | Any content/marketing work — shows full routing table, content pipeline, and skills index for Writer + Designer + Web Publisher + Email Marketer |

**These skills are also triggered automatically** by `~/.claude/rules/agent-routing.md` when you say "use dev team", "use marketing team", "who handles this", or "what agent do I need for X".

### Dev Team — Quick Trigger Map

| Say… | Routes to | Skill invoked |
|---|---|---|
| "plan", "spec this", "write an epic" | product-manager | — |
| "create issues", "break into tickets" | product-manager | `pm-to-issues` |
| "validate plan", "grill with docs" | product-manager | `pm-grill-with-docs` |
| "build", "implement", "fix" | developer | — |
| "debug", "diagnose", "why is this broken" | developer | `dev-diagnose` |
| "zoom out", "context on this module" | developer | `dev-zoom-out` |
| "grill me", "stress-test this plan" | developer | `dev-grill` |
| "tdd", "test-driven" | developer | `dev-tdd` |
| "spike", "prototype" | developer | `dev-prototype` |
| "improve architecture", "tech debt" | developer | `dev-improve-arch` |
| "handoff", "wrapping up" | developer | `dev-handoff` |
| "triage", "classify this bug" | qa | `qa-triage` |
| "ci/cd", "pre-commit", "guardrails" | devops | `devops-setup-pre-commit` / `devops-git-guardrails` |

### Marketing Team — Quick Trigger Map

| Say… | Routes to | Skill invoked |
|---|---|---|
| "write a post", "blog post", "seo" | writer | `writer-seo-content` |
| "generate image", "hero image" | designer | `designer-image-generation` |
| "design system", "brand tokens" | designer | `designer-design-system` |
| "publish", "build the page", "push to site" | web-publisher | `web-publisher-publish` |
| "email campaign", "newsletter", "nurture" | email-marketer | `email-marketer-nurture` |

## Folder conventions
See `templates/project-scaffold/FOLDER-STRUCTURE.md` in the agent template repo (`talentedgeai/infiniteleverage-8-agents-template`) for the canonical structure every project follows. Agents MUST honor it — do not invent new top-level folders.

## Publishing workflow
Read source content from `content/topics/<slug>/` → optimize images → generate React components via `build-page` skill → copy into `website/pages/` → update `website/pages/blog/index.jsx` → commit → hand off push command to operator.

## Cross-tool context bridge
- Read `~/Documents/Claude/shared-context/BRIDGE.md` at session start
- Update it at session end with handoff notes
