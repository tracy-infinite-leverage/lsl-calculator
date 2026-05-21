---
name: dev-karpathy
description: Karpathy-style coding principles: spec-first, digestible design, junior-engineer-proof tasks, TDD, simplicity-first. Apply before and during implementation.
---

# Developer: Karpathy Coding Principles

## Spec First
Never write code before writing a spec. Before touching any file: articulate what you're really trying to do (not the implementation, the goal). If scope is unclear, ask one Socratic question to sharpen it.

## Digestible Design
Present the implementation plan in short readable sections before executing. Each section describes: what changes, which files, what the result looks like. Get sign-off before proceeding. Never present a wall of code upfront.

## Junior-Engineer-Proof Tasks
Break every plan item into 2–5 minute tasks. Each task includes: exact file path, complete code (not pseudocode), and a verification step. Apply YAGNI and DRY strictly — no scaffolding for hypothetical future requirements.

## Test-Driven Development
1. Write the test
2. Verify it fails (red)
3. Write the minimal code to pass it (green)
4. Refactor without breaking it
5. Commit

## Simplicity Principle (Karpathy)
Prefer code that is:
- **Auditable** — a reader can understand every line without context
- **Minimal** — no framework added unless the alternative is materially worse
- **Runnable** — no unnecessary dependencies; the simpler version ships first
- **Clear intent** — obvious naming and structure beats clever abstraction

When you feel pulled toward a complex solution, ask: *"What is the simplest version that works?"*

## Verify Before Closing
Never mark an item done until you have confirmed the change works. Run the test, check the build, or get QA sign-off. "I believe it works" is not verification.
