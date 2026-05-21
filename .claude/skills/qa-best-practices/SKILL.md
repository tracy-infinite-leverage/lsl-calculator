---
name: qa-best-practices
description: Testing pyramid enforcement, unit/integration/e2e patterns, anti-patterns to refuse, and explicit can/cannot-test boundaries for AI-driven QA.
---

# QA: Best Practices

## Test Pyramid (enforce this ratio)

```
        /\
       /  \  e2e (Playwright)
      / 1  \  ← 1 per critical user flow only
     /------\
    /        \  integration (API + DB)
   /  3 to 5  \  ← per feature
  /------------\
 /              \  unit (Jest + React Testing Library)
/   10 or more  \  ← default layer, always start here
```

**Rule**: Start at unit. Only write integration when unit cannot cover the behavior. Only write e2e for flows that touch auth, form submission, payment, or signup.

## Testing Philosophy: Production Quality First
1. **Stability over coverage** — a flaky test that sometimes passes is worse than no test
2. **Maintainability over thoroughness** — tests needing updates on implementation detail changes are a liability, not safety
3. **Intent over implementation** — test what the code is supposed to do, never how it does it internally
4. **Fail clearly over fail quietly** — every failure must point to the broken behavior, not leave debugging

## Unit Tests — Jest + React Testing Library
Red→green→refactor strictly:
```ts
describe('[Component]', () => {
  it('should [behavior] when [condition]', () => {
    // Arrange / Act / Assert
  })
})
```
Cover: happy path, boundary conditions (empty, null, min, max), failure modes (invalid input, thrown errors).

## Integration Tests — API Routes + Supabase
- Test full request→response cycle for every API route
- Use Supabase local dev stack or test project — never mock the database
- Assert on: response status, response shape, data side effects
- Structure with Given/When/Then

## E2E Tests — Playwright
- Write ONLY for critical user flows: auth, subscribe, checkout, contact form
- Structure as Given/When/Then
- Use `data-testid` attributes — never assert on CSS class names or DOM structure

## Anti-Patterns — Refuse and Fix
- Screenshot-only e2e (no behavioral assertions)
- Mocking the database (use test DB)
- Testing implementation details (internal state, class names, HTML structure)
- Deleting or commenting assertions to make tests pass
- `await sleep(N)` — use `waitFor` or Playwright's automatic waiting
- Ambiguous names (`it('works')`) — always describe expected behavior
- Over-mocking — if everything is mocked, you're testing your mocks

## What AI Can Test
- Unit tests: logic, components, hooks, utilities
- Integration tests: API routes, DB queries, Supabase edge functions
- e2e: critical flows via Playwright
- TypeScript types, lint, build success

## What AI Cannot Test (flag to human)
- Visual appearance and pixel-level rendering
- Accessibility with real assistive technology
- Real payment flows (Stripe test mode minimum)
- Mobile touch and native device behavior
- Third-party service availability and latency under load
