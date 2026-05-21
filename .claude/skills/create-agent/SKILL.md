---
name: create-agent
description: "Runs a structured interview to design a new Claude Code subagent role from scratch. MUST be used when the user says 'create an agent', 'build an agent', 'I need an agent that...', 'set up a new agent role', or describes autonomous behaviour they want to delegate. Produces the complete agent package (persona, skills, evals) and installs the agent into .claude/agents/."
---

# Create Agent Skill

Guide the user through designing a new Claude Code subagent role from requirements through to installation, using a five-phase process: **interview → diagram → iterate → build → install**.

Do not skip phases. Do not generate any files before the workflow diagram is approved.

---

## Phase 1 — Interview

Present all questions in a single message, grouped by section. Do not proceed until the user has answered each section. If an answer is vague, ask one targeted follow-up before moving on.

---

**Let's design your new agent. Answer what you know — leave blanks for anything uncertain.**

**1. Role basics**
- What is this agent's name or role title?
- In one sentence: what problem does it solve or what does it own?

**2. Team & context**
- Who does it work with? (names, human or AI, any contact info)
- What project or repo does it operate in?

**3. Workflow**
- What triggers it? (a time/schedule, a human phrase, an event, or all three)
- Walk me through the key phases from trigger to done — rough steps are fine
- Any retry loops, escalation paths, or deadlines it must enforce?

**4. Tool stack**
- What tools or services should it have access to? (e.g. git CLI, GitHub MCP, Slack, Supabase, file tools, scheduled tasks)
- Are any not yet connected? If so, what should it do as a fallback?

**5. Data & files**
- What files does it read? What files does it write or update?
- Any naming conventions or formats it must follow?

**6. Skills**
- List the discrete things this agent needs to be able to do (one skill = one trigger = one outcome)
- For each: what phrase triggers it and what does it produce?

**7. Constraints & framework**
- Any hard limits? (tools to avoid, process to keep lightweight, privacy rules)
- Any established framework to draw behaviour from? (e.g. PMBOK, Agile, Shape Up, IDEO)

---

## Phase 2 — Generate the Workflow Diagram

Once the interview is complete, generate a Mermaid-based HTML workflow diagram.

Save to: `agents/<role-slug>/context/<role-slug>-workflow.html`
If no `agents/` folder exists in the project, create it.

### HTML template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>[Role Name] — Workflow Diagram</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>
    body { font-family: sans-serif; background: #0f1117; color: #e2e8f0; margin: 0; padding: 2rem; }
    h1 { font-size: 1.4rem; margin-bottom: 1.5rem; color: #7dd3fc; }
    .mermaid { background: #1e2330; border-radius: 8px; padding: 2rem; }
  </style>
</head>
<body>
  <h1>[Role Name] — Agent Workflow</h1>
  <div class="mermaid">
  flowchart TD
    %% Replace with generated diagram nodes
  </div>
  <script>mermaid.initialize({ startOnLoad: true, theme: 'dark' });</script>
</body>
</html>
```

### Diagram must cover

- All triggers (schedule, phrase, event)
- Each named phase with its action and output
- Decision points (e.g. "file exists?", "tool available?")
- Retry and escalation loops
- Fallback paths for disconnected tools
- Terminal states (done, blocked, escalated)

After saving, tell the user:

> **Workflow diagram saved** → `agents/<role-slug>/context/<role-slug>-workflow.html`
>
> Open it in a browser and review. Tell me:
> - Any phases that are missing or wrong
> - Any flows that need reordering
> - Anything to add or remove
>
> Type **"approved"** when the diagram looks right, or describe the changes you want.

---

## Phase 3 — Iterate

For each round of feedback:
1. Apply the requested changes to the diagram
2. Overwrite the same file
3. Summarise what changed (bullet list)
4. Ask for approval again

Repeat until the user says "approved", "looks good", "ship it", or similar.
If iteration exceeds 3 rounds, offer to regenerate from scratch with a revised interview summary.

---

## Phase 4 — Generate the Complete Agent Package

Once approved, generate all files in one pass before reporting.

### File map

| File | Purpose |
|------|---------|
| `agents/<role-slug>/context/<role-slug>-workflow.html` | Already written in Phase 2 |
| `agents/<role-slug>/context/persona.md` | Full agent persona (11 sections) |
| `agents/<role-slug>/context/skills/<skill-name>/SKILL.md` | One per skill |
| `agents/<role-slug>/context/skills/evals/evals.json` | One test case per skill |
| `agents/<role-slug>/output/.gitkeep` | Staging folder placeholder |
| `.claude/agents/<role-slug>.md` | Installs agent into Claude Code |

---

### 4a — persona.md

```markdown
# [Role Name] Agent — Persona

## Identity & Purpose
[One paragraph: what this agent owns and the problem it solves]

## Team
| Name | Type | Role | Contact |
|------|------|------|---------|

## Core Behaviors
[5–8 non-negotiable rules derived from the domain framework or user constraints]

## Daily Workflow
[Named phases with times/triggers, step-by-step actions, conditions, and fallbacks]

## Communication Standards
[Output formats, audience calibration, escalation rules, tone]

## Canonical Artifacts
| Artifact | Path | Cadence | Operation |
|----------|------|---------|-----------|

## Data Locations
| File | Path | Read/Write/Append | Notes |
|------|------|-------------------|-------|

## Tools & MCPs
| Tool | Status | Fallback |
|------|--------|----------|
| ...  | ✅ Connected / ❌ Needs connection / 🔧 CLI | ... |

## Agent Skills
| Skill | Folder | Trigger phrase | Output |
|-------|--------|----------------|--------|

## KPIs
[3–5 measurable metrics this agent tracks]

## Scheduled Tasks
| Trigger | Time/Condition | Action | Fallback |
|---------|----------------|--------|----------|
```

**Rules:**
- Every notification action must have a primary channel and a fallback
- Every tool flagged ❌ must have a fallback defined
- Execution logic belongs in SKILL.md files, not the persona

---

### 4b — SKILL.md (one per skill)

```markdown
---
name: <skill-name>
description: "<Specific trigger description — slightly pushy so Claude wants to use it>"
---

# [Skill Name]

## Purpose
[One paragraph: why this skill exists and what it produces]

## Steps

### 1. [Phase name]
[Action, condition, edge case handling]

### 2. [Phase name]
[...]

## File Paths
| Operation | Path |
|-----------|------|
| Read      | ...  |
| Write     | ...  |

## Output Format
[Exact structure — headings, fields, file format]

## Edge Cases
- **[Failure mode 1]**: [how to handle]
- **[Failure mode 2]**: [how to handle]
```

---

### 4c — evals.json

```json
{
  "agent": "<role-name>",
  "skills": [
    {
      "skill": "<skill-name>",
      "test_cases": [
        {
          "id": "happy-path",
          "prompt": "<realistic, specific trigger prompt>",
          "fixtures": ["<file paths the skill needs>"],
          "assertions": [
            "<verifiable assertion 1>",
            "<verifiable assertion 2>",
            "<verifiable assertion 3>"
          ]
        },
        {
          "id": "failure-mode",
          "prompt": "<prompt that hits the primary failure case>",
          "fixtures": [],
          "assertions": [
            "<failure handled gracefully>",
            "<fallback was used>"
          ]
        }
      ]
    }
  ]
}
```

---

### 4d — .claude/agents/<role-slug>.md

```markdown
---
name: <Role Name>
description: <One sentence — include the primary trigger phrases so Claude routes correctly>
model: sonnet
tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
---

You are the <Role Name> agent. Your full persona and operating instructions are at `agents/<role-slug>/context/persona.md`. Read that file at the start of every session before taking any action.

## Quick reference

**Purpose:** <one sentence>
**Triggers:** <primary trigger phrases>
**Primary output:** <what you produce most often>
**Skills:** <comma-separated skill names>

## On first invocation

1. Read `agents/<role-slug>/context/persona.md`
2. Identify what the user is asking for
3. If it matches a skill trigger, read `agents/<role-slug>/context/skills/<skill>/SKILL.md`
4. Execute the skill steps exactly

## Hard rules

- Never act without reading the persona first
- Every notification must use its fallback if the primary channel is unavailable
- All file writes must use the exact paths in the persona's data locations table
```

---

## Phase 5 — Report & Next Steps

```
✅ Agent package created: <Role Name>

Files written:
  agents/<role-slug>/context/<role-slug>-workflow.html
  agents/<role-slug>/context/persona.md
  agents/<role-slug>/context/skills/<skill-1>/SKILL.md
  ...
  agents/<role-slug>/context/skills/evals/evals.json
  agents/<role-slug>/output/
  .claude/agents/<role-slug>.md  ← agent installed

To use: @<Role Name> <your request>

Next steps:
  1. Review persona.md and adjust behaviours that don't fit
  2. Create fixture files listed in evals.json
  3. Run evals to verify each skill
  4. Commit: git add agents/<role-slug>/ .claude/agents/<role-slug>.md
```

---

## Edge Cases

- **User skips sections**: Fill from context, flag gaps, ask targeted follow-ups before generating.
- **Role name conflicts**: Check `.claude/agents/`. Warn, suggest suffix, confirm before writing.
- **Tool ❌ with no fallback**: Default = write note to `agents/<role-slug>/output/pending-actions.md`. Flag in persona.
- **No `agents/` folder**: Create it. If project structure is unfamiliar, ask user to confirm root first.
- **Fewer skills than workflow implies**: Accept the list, note which phases have no corresponding skill.
- **Iteration > 3 rounds**: Offer to regenerate from scratch with a revised interview summary.
