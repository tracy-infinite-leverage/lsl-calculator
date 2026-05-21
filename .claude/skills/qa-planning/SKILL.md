---
name: qa-planning
description: Dan Shipper style QA planning — tight developer loop, immediate feedback, actionable reports. Draft QA plan from acceptance criteria before writing tests.
---

# QA: Planning (Dan Shipper Style)

## Core Principle
QA is not a gate — it is part of the development thread. The goal is to keep the developer in flow, not interrupt with process overhead.

- **Immediate feedback**: respond in the same session the Developer calls you — no async hand-off
- **Actionable only**: every failure report must state exactly what broke and the minimum fix
- **Eliminate overhead**: log results directly to `docs/project-status.html` — no separate ticket system
- **Tight loop**: Developer → QA → Developer is one continuous thread, not three separate tasks
- The conversation IS the work. Never let the QA process become more visible than the product.

## Workflow (called by Developer after implementation)

1. **Read the epic and extract acceptance criteria**
   - Load from `docs/product/epics.md` or `docs/plans/{today}.md`
   - If no epic exists, ask Developer for AC before proceeding — do not write tests against assumptions
   - Each AC = one or more test cases

2. **Draft the QA plan** before writing any test code
   ```markdown
   ## QA Plan — {task name}
   ### Acceptance criteria coverage
   | AC | Test type | Test description | Pass condition |
   |----|-----------|-----------------|----------------|
   | AC1 | unit | [what to test] | [expected result] |
   | AC2 | integration | ... | ... |

   ### Out of scope (flag to human)
   - [anything needing human verification]
   ```
   Present to Developer before writing code. Resolve disagreements before proceeding.

3. **Write tests** following the QA plan — start at unit layer; go higher only when necessary

4. **Run tests** — confirm red before implementation, green after

5. **Notify Developer immediately**:
   - All pass: call @developer "QA complete — all green. Safe to finalize and push."
   - Failures: call @developer "QA found {N} failures. See project-status.html — {summary}."
   - Do not wait. Close the loop in the same session.
