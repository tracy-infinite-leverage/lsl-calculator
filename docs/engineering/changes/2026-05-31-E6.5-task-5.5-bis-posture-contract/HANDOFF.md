# Task 5.5-bis — Public-vs-authenticated endpoint posture contract test — HANDOFF

**Date**: 2026-05-31 (dispatched 2026-06-02)
**Branch**: `feat/E6.5-5.5-bis-posture-contract`
**Spec**: `.specify/features/006-ui-design-system/spec.md` v0.5 — §5.3 + OQ-6
**Impl-plan**: `.specify/features/006-ui-design-system/impl-plan.md` §1.3
**Task**: `.specify/features/006-ui-design-system/tasks.md` lines 686-700 (Task 5.5-bis, size S)
**Predecessors**: Task 5.5 (PR #135 — the route handler this PR pins)

---

## What shipped

One new test file:

- **`website/src/app/api/reports/__tests__/posture.test.ts`** — wire-level
  posture contract test. 6 vitest cases:
  1. `single-employee` with NO auth → 501 today / 200 Phase 5a (NEVER 401)
  2. `bulk-summary`    with NO auth → 501 today / 200 Phase 5a (NEVER 401)
  3. `liability`       with NO auth → 401 unauthorized
  4. `reconciliation`  with NO auth → 401 unauthorized
  5. OQ-6 invariant — public families NEVER return 401
  6. Companion invariant — authed families NEVER return 200/501 without auth

Plus this HANDOFF doc.

---

## The four spec-mandated family-level assertions

Per tasks.md lines 689-693 the test must assert one outcome per family. The
table below maps each assertion to the test name and the response code that
fires today vs after Phase 5a flips the public templates online.

| Family            | Posture       | Today's response       | Phase 5a flip          |
|-------------------|---------------|------------------------|------------------------|
| `single-employee` | public        | 501 `template-not-shipped` | 200 `application/pdf` |
| `bulk-summary`    | public        | 501 `template-not-shipped` | 200 `application/pdf` |
| `liability`       | authenticated | 401 `unauthorized`     | 401 (unchanged)        |
| `reconciliation`  | authenticated | 401 `unauthorized`     | 401 (unchanged)        |

The public-family assertions ACCEPT EITHER 200 or 501, both with the matching
body shape (JSON `error: 'template-not-shipped'` for 501; `Content-Type:
application/pdf` for 200). When Tasks 6.1 + 6.2 land the templates, the test
flips green on 200 without modification.

The 401 assertions for authed families are absolute — the only correct
response code without a Supabase session is 401.

---

## Why this lives at `website/src/app/api/reports/__tests__/posture.test.ts`

The dispatch instruction's preferred path was `website/e2e/api-reports-posture.spec.ts`,
but `website/e2e/` is diff-guarded by Task 2.11 (`docs/qa/e6-test-sanctity.md`).
The instruction explicitly carved an "only if e2e/ is NOT in the diff-guard"
clause and named `website/__tests__/api/reports-posture.test.ts` as the fallback.

The named fallback path is OUTSIDE `vitest.config.ts`'s `include: ['src/**​/*.{test,spec}.ts']`
glob, so CI would not pick it up without a `vitest.config.ts` change. Rather
than widen the vitest include surface and risk picking up unintended files,
the test lives at the canonical vitest location for an API route's tests —
colocated under `src/app/api/reports/__tests__/`. This path:

- Is OUTSIDE all four diff-guarded surfaces (`website/e2e/`,
  `website/src/lib/lsl/engine/`, `website/src/lib/lsl/states/`,
  `website/src/__tests__/`).
- Is INSIDE the default vitest include glob — picked up by the CI `test` job
  automatically, no config change required.
- Sits alongside the existing `route.test.ts` unit tests it complements.

---

## How this complements `route.test.ts`

The existing unit tests in `route.test.ts` mock `createSupabaseServerClient` at
the FACTORY boundary — they assert posture by inspecting `not.toHaveBeenCalled()`
on the factory itself. That is the right test for "did the code path branch
correctly", but it does not exercise the request → response wire.

This PR's test is the wire-level complement. The mock surface is one layer
DEEPER — `@supabase/ssr.createServerClient`, the underlying SDK that the real
factory calls. Everything the route handler does to construct the response
runs for real:

- The real `createSupabaseServerClient` factory from `@/lib/supabase/server`
- The real env-var read for `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY`
- The real `cookies()` resolution from `next/headers` (mocked empty — what
  an anonymous request would see)
- The real `@/lib/pdf/families.ts` registry lookup + `isKnownFamily` guard
- The real posture branch in the route handler
- The real Zod schema parse against `VALID_BODY`
- The real `NextResponse.json(...)` / `NextResponse(...)` construction

Only the Supabase SSR wire boundary is mocked, and it is mocked to model the
EXACT production behaviour for an anonymous request: "no session cookie → no
network call → `user: null`". If a future refactor accidentally hoists the
auth check above the family branch — i.e. couples a public family to Supabase
— the public assertions in this file return 401 (or 500 from a thrown supabase
construction) instead of 501, and the test fails LOUD.

---

## The two wire-boundary mocks (why each is necessary)

1. **`next/headers` cookies()** — there is no Next.js request context in a
   vitest process, so the real `cookies()` from `next/headers` throws. The
   mock returns an empty cookie store, which is what a real anonymous request
   would receive in production.

2. **`@supabase/ssr` createServerClient** — the real factory makes a network
   call when `auth.getUser()` runs. With an unreachable dummy URL the call
   would fail and return 500, masking the 401 we are trying to test. The mock
   models supabase-ssr's documented behaviour for the "no session cookie"
   case — it reads the cookies callback, sees no `sb-*-auth-token` cookie, and
   returns `{ data: { user: null }, error: null }` synchronously.

Both mocks are at the WIRE BOUNDARY between the application and external
dependencies. Nothing inside the application — route handler, family registry,
posture logic, Zod schema, response construction — is mocked.

---

## CI integration

The new file is picked up by the existing `test` job in
`.github/workflows/ci.yml` (line 28-56). No CI changes required. Verified by
running `npx vitest run` locally and observing the new file in the suite list
(`Test Files  84 passed | 6 skipped (90)` — was 83 before this PR).

A failure of any of the 6 assertions in this file blocks any E6 PR merge,
since the `test` job is a required check. This satisfies tasks.md line 696:

> Test runs in CI on every E6 PR; failure is a hard block

---

## Local gates — all clean

| Gate                                                  | Result                              |
|-------------------------------------------------------|-------------------------------------|
| `npx vitest run src/app/api/reports/__tests__/posture.test.ts` | 6/6 pass                            |
| `npx vitest run` (full suite)                         | 3100 pass / 32 skipped (no regress) |
| `npx tsc --noEmit`                                    | clean                               |
| `npm run build`                                       | clean                               |
| `audit-bundle` (postbuild)                            | PASS — no external origins          |
| `npx eslint src/app/api/reports/__tests__/posture.test.ts` | clean                               |

3094 → 3100 vitest cases — the +6 are exactly the new tests in this PR. No
regressions.

---

## Files changed

NEW:
- `website/src/app/api/reports/__tests__/posture.test.ts` (≈260 lines)
- `docs/engineering/changes/2026-05-31-E6.5-task-5.5-bis-posture-contract/HANDOFF.md` (this file)

No files modified. Strict additive PR.

---

## What's deferred to other PRs

- **Tasks 6.1 + 6.2** — public-family templates (`single-employee` +
  `bulk-summary`). When these land, the public-family assertions in this file
  start observing 200 + `application/pdf` instead of 501. No test change
  required — the assertions already accept either status.
- **Tasks E5.5 + E5.6** — authed-family templates (`liability` +
  `reconciliation`). When these land, an authenticated session test (currently
  not in scope for 5.5-bis) would assert 200. The 401 assertions in this file
  remain valid for the anonymous case.

---

## QA notes for the next agent

1. **The OQ-6 invariant is the load-bearing assertion.** The test name
   `public families NEVER return 401 — they return 200 or 501` is the single
   line a code reviewer should read to understand what this PR locks.
2. **Both mocks are at the WIRE boundary.** Adding mocks for the route
   handler, family registry, Supabase factory, or Zod schema would defeat the
   point of this test — it must complement the unit tests, not duplicate them.
3. **The test survives the Phase 5a flip.** When Tasks 6.1 + 6.2 ship the
   public templates, do not modify the assertions in this file — they already
   accept either 200 + `application/pdf` or 501 + `template-not-shipped`.
