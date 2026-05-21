# Agent Routing Rules

These rules govern when and how agents are automatically triggered from conversation context. Claude Code reads this file alongside `CLAUDE.md` and routes work to the right agent without requiring an explicit `@agent` call.

---

## Dev Team — Auto-Routing Triggers

The following context patterns automatically invoke the relevant dev team agent.

| Trigger Context | Agent | Skill (if applicable) |
|---|---|---|
| "plan", "spec", "write an epic", "what should we build", "acceptance criteria" | product-manager | — |
| "create issues", "break into tickets", "to issues" | product-manager | `pm-to-issues` |
| "validate plan", "check against epics", "grill with docs" | product-manager | `pm-grill-with-docs` |
| "build", "implement", "code this", "write the function" | developer | — |
| "debug", "why is this broken", "diagnose", "I can't figure out" | developer | `dev-diagnose` |
| "zoom out", "give me context on this module", "I'm new to this area" | developer | `dev-zoom-out` |
| "grill me", "stress-test this plan", "what could go wrong" | developer | `dev-grill` |
| "tdd", "test-driven", "red-green-refactor" | developer | `dev-tdd` |
| "spike", "prototype", "is this feasible", "hard unknown" | developer | `dev-prototype` |
| "improve architecture", "refactor this module", "tech debt" | developer | `dev-improve-arch` |
| "handoff", "wrapping up", "passing to QA", "done for now" | developer | `dev-handoff` |
| "triage", "classify this bug", "prioritise this bug" | qa | `qa-triage` |
| "test strategy", "what to test", "test plan" | qa | `qa-best-practices` |
| "ci/cd", "pipeline", "github actions", "deployment setup" | devops | — |
| "pre-commit", "husky", "lint-staged" | devops | `devops-setup-pre-commit` |
| "git hooks", "protect main", "guardrails" | devops | `devops-git-guardrails` |

## Marketing Team — Auto-Routing Triggers

| Trigger Context | Agent | Skill (if applicable) |
|---|---|---|
| "write a post", "draft content", "blog post" | writer | — |
| "seo", "meta description", "keyword research" | writer | `writer-seo-content` |
| "social post", "instagram caption", "linkedin post" | writer | — |
| "translate", "vietnamese", "tiếng việt" | writer | — |
| "generate image", "hero image", "create a visual" | designer | `designer-image-generation` |
| "design system", "brand tokens", "colour palette" | designer | `designer-design-system` |
| "mockup", "wireframe", "ui design" | designer | `designer-ui-ux` |
| "publish", "build the page", "push to site", "update blog index" | web-publisher | `web-publisher-publish` |
| "email campaign", "newsletter", "send to subscribers", "nurture" | email-marketer | `email-marketer-nurture` |
| "import contacts", "brevo list", "add to email list" | email-marketer | — |

---

## Hard Rules

These cannot be overridden by operator instructions:

1. **Developer never starts without an approved PM plan.** If there is no approved plan, route to PM first.
2. **QA never skips triage.** Every bug is classified and scored before being assigned.
3. **DevOps never deploys directly.** All deployments flow through `git push` → CI/CD pipeline.
4. **Web Publisher never pushes to GitHub.** Commits locally — operator runs `git push`.
5. **Email Marketer never sends without explicit operator approval.** All campaigns are drafted, not sent.
6. **No agent merges its own PR — unless the change is trivial and self-contained.** See auto-merge criteria in `developer.md`. For all other changes: Developer opens → QA verifies → operator merges.
7. **Designer generates images only after copy is approved.** No images before the Writer's content is signed off.

---

## Team Routing Skills

For full routing context in any session, invoke:

- `/use-dev-team` — full routing table, handoff chain, and skills index for PM + Developer + QA + DevOps
- `/use-marketing-team` — full routing table, content pipeline, and skills index for Writer + Designer + Web Publisher + Email Marketer

---

## Cross-Team Handoff Points

| From | To | Trigger |
|---|---|---|
| PM (approved plan) | Developer | Plan signed off — issues created |
| Developer (feature complete) | QA | Dev handoff doc written |
| QA (bugs found) | Developer | Triage report → P0/P1 bugs |
| QA (all pass) | Web Publisher | QA sign-off on content changes |
| Web Publisher (committed) | Email Marketer | New post live — email announce |
| Email Marketer (drafted) | Operator | Approval needed before send |
