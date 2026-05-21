---
name: dev-tdd
description: Use when implementing with strict test-first discipline. Triggered when the developer says "tdd", "test-driven", "red-green-refactor", or when the PM plan specifies test-first implementation. Enforces the red → green → refactor cycle with hard rules against horizontal slicing.
credits: |
  Adapted from mattpocock/skills (tdd)
  Source: https://github.com/mattpocock/skills
  License: MIT — Copyright (c) 2026 Matt Pocock
---

# Dev TDD

Strict red-green-refactor. No exceptions.

## The Law

1. **Red first.** Write a failing test before writing any implementation code.
2. **Green minimal.** Write the minimum code to make the test pass — nothing more.
3. **Refactor clean.** Clean up with all tests green. Do not add features during refactor.

Repeat. One cycle at a time. No skipping steps.

## Hard Rules

- **No implementation without a failing test.** If you write code before a test, stop. Delete the code. Write the test first.
- **No horizontal slicing.** Do not build "the data layer" then "the business layer" then "the UI layer". Build one complete vertical slice (input → output) at a time, tested end-to-end.
- **No green shortcuts.** Do not hard-code return values to pass tests (unless as a deliberate step in triangulation — but you must write another test that forces real logic within the same cycle).
- **Test must fail for the right reason.** Before writing implementation, confirm the test fails with the expected failure message — not a compile error, not a wrong error.

## Vertical Slice Pattern

Each TDD cycle targets one user-visible behaviour:

```
TEST: "given {input}, {system} produces {output}"
IMPL: minimal code to satisfy the test
REFACTOR: clean without changing behaviour
```

Examples of vertical slices:
- "Given a valid email, signup returns a user ID"
- "Given an invalid email, signup returns a 400 with a message"
- NOT: "Build the User model" (horizontal)

## Cycle Discipline

```
1. Write test → run → confirm RED (right failure)
2. Write impl → run → confirm GREEN
3. Refactor → run → confirm still GREEN
4. Commit: "test: {behaviour}" then "feat: {behaviour}"
5. Next slice
```

## Gate

Before calling a feature done:

- [ ] Every behaviour has at least one test.
- [ ] No implementation code exists without a corresponding test.
- [ ] All tests pass.
- [ ] No test is skipped, commented out, or marked `.only` without reason.
- [ ] Each test targets a specific acceptance criterion from `.specify/features/{slug}/spec.md` (cite it in the test name or a comment — e.g. `// AC-3: user receives confirmation email`).

---

## Credits

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) — `tdd`  
License: MIT — Copyright (c) 2026 Matt Pocock
