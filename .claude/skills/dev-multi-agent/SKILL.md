---
name: dev-multi-agent
description: Wave-based parallel agent delegation for complex tasks. Decompose into independent work items, dispatch parallel sub-agents, collect outputs, validate, and integrate.
---

# Developer: Multi-Agent Delegation

Use for complex tasks that can be decomposed into independent work items.

## Wave Execution Model

```
Wave 1: [Agent A] [Agent B] [Agent C]   ← independent, parallel
           ↓          ↓          ↓
         done        done        done
                     ↓
Wave 2: [Agent D] [Agent E]            ← depends on Wave 1 outputs
```

Waves are sequential — Wave 2 starts only after Wave 1 is fully resolved. Within a wave, all agents run concurrently and independently.

## Sub-Agent Prompt Template

Every sub-agent prompt must include:

```
You are working on [specific scope]. Your goal: [single deliverable].

Context:
- [relevant background]
- [error messages / failing tests / requirements]

Constraints:
- Do NOT modify [files/systems outside scope]
- Do NOT ask clarifying questions — make the best call and document your reasoning

When done, return:
- Decision made / root cause
- Files created or modified (path + one-line description)
- Any caveats or follow-up items
```

## When to Use Parallel Dispatch

| Situation | Action |
|-----------|--------|
| 2+ independent failures/tasks | Dispatch one agent per domain |
| Tasks share state or depend on each other | Sequential agents or single agent |
| Single problem, unclear root cause | Single agent investigates first |
| Agents would edit the same files | Do NOT dispatch in parallel |

## Coordinator Responsibilities
- Decompose task into independent domains before Wave 1
- Craft complete, self-contained agent prompts before each wave
- Collect and synthesize all agent outputs after each wave
- Check for conflicts between agent changes
- Decide whether a Wave 2 is needed
- Write unified summary after all waves complete

## Integration Check
After all agents complete, produce a unified summary:
- Conflicts found: none / [list]
- Follow-up waves needed: none / [describe]
