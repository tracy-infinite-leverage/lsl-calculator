# Handoff: E5.1 Auth Slice — Phase 6 (verification + password reset + Phase 5 tail)

**Date:** 2026-05-29
**From:** Developer agent (resume session — prior socket dropped after ~34 min, nothing committed)
**To:** Operator → QA agent for verification; PM agent to track outstanding Phase 6 items (5.8, 6.4) into the next session
**Branch:** `feat/E5.1-auth-slice-phase-6`
**PR:** [#67](https://github.com/tracy-infinite-leverage/lsl-calculator/pull/67) (draft — still scaffold-only because nothing has been committed yet)

---

## What Was Done

This session **resumed** work the prior socket-dropped session had produced as uncommitted files. I audited every file, fixed the bugs the prior session left, and finished the missing Task 6.6.

**Tasks landed (6 of 8 in Phase 6 scope):**

- ✅ **Task 5.7** — proxy gating integration (`phase5-proxy-gating.test.ts`, 11 live cases against the lsl-platform Supabase project; branch (b) unverified delegated to the existing 24-test `proxy.test.ts` with full justification in the file's header comment).
- ✅ **Task 6.1** — `/app/verify-email` page + resend server action + `<ResendVerificationForm>` client (verified/unverified branches, Supabase 1-per-60s mapping, application 5-per-24h cap).
- ✅ **Task 6.2** — `/app/forgot-password` page + enumeration-safe server action + `<ForgotPasswordForm>` client. SHA-256 email hash in `auth_audit_log.metadata` for incident-response correlation without storing the cleartext twice.
- ✅ **Task 6.3** — `/app/reset-password` page (exchanges `?code=` via `exchangeCodeForSession`, renders expired-link card on failure) + server action (≥12-char + match validation, `updateUser`, `signOut({scope:'others'})`, audit row, redirect to `/app/login?reset=success`) + `<ResetPasswordForm>` client. Login page extended to honour `?reset=success` with a green Alert (the +13-line `login/page.tsx` modification).
- ✅ **Task 6.5** — reset token lifecycle integration test (`phase6-reset-token-lifecycle.test.ts`, 3 cases). Uses real `admin.generateLink({type:'recovery'})` against the live project to mint a real token hash and assert single-use enforcement.
- ✅ **Task 6.6** — verification-resend rate-limit integration test (`phase6-verification-resend-rate-limit.test.ts`, 9 cases). Tests the application-side 5-per-24h cap against real `auth_audit_log` rows on the live project — boundary cases, rolling 24h window, per-user partitioning, event_type filter, `recordVerificationResend` round-trip.

**Infrastructure added:**
- `src/lib/supabase/admin.ts` — service-role client factory + `readClientFingerprint(headers)` helper. Returns `null` when env vars are missing so callers degrade gracefully (no service-role key in dev → 5-per-24h cap disabled, but Supabase's 1-per-60s still in force).
- `src/lib/auth/rate-limit.ts` — `checkVerificationResendQuota`, `recordVerificationResend`, `formatRetryAfter`. No new table — reuses `auth_audit_log` from Phase 4 with `event_type='verification_resend'` as the counter.

**`auth-tasks.md` updated:** Tasks 5.7, 6.1, 6.2, 6.3, 6.5, 6.6 all flipped to ✅ DONE with substantial status notes mapping each AC to its test.

## What Is In Progress

Nothing — every code change made this session reached a stable point with all checkboxes green. The PR is the natural next step.

## What Is Blocked / Outstanding for Phase 6

**Two tasks did NOT ship this session.** Both are non-code or require infrastructure the prior session didn't set up:

### Task 5.8 — Playwright E2E golden path 1 (signup → verify → home)

Requires:
- Either a **local Supabase stack** via `supabase start` (per the handoff doc's recommendation), with a Mailhog catcher to intercept the verification email
- OR a way to mark a user verified via test-helper without going through real email delivery

The handoff doc specifies the local-stack approach. Setting that up cleanly requires:
1. `supabase` CLI installation in the Playwright CI job (currently NOT in `.github/workflows/ci.yml`'s `playwright` job — Node only)
2. `supabase start` + `supabase db reset` to apply the 5 migrations
3. Playwright test that talks to Mailhog (or `inbucket` — Supabase's bundled local SMTP catcher) on `http://localhost:54324` to pull the verification link
4. Env var wiring so `playwright.config.ts` knows about the local Supabase URL

This is a real chunk of DevOps work. Recommend routing to the DevOps agent before the next session attempts Task 5.8.

### Task 6.4 — Customise Supabase Auth email templates with APA branding

This is a **dashboard config task**, not code. Workflow per the handoff doc:
1. Log in to https://supabase.com/dashboard/project/woxtujkxatosbirikxtq
2. Authentication → Email Templates
3. Customise **Confirm signup**, **Reset password**, **Magic link** templates with APA wordmark + colour palette per `docs/brand/style-guide.md` (which doesn't exist as a file — substantive style guide is the code: `website/src/app/globals.css` + `website/src/components/ui/`)
4. Document the templates + bound variables in the auth-impl-plan Decisions Log
5. Screenshot each template for QA / Designer sign-off
6. Verify by triggering each email in a test signup flow

Cannot be done from Claude Code — requires the operator (or PM agent driving the operator) to perform the dashboard clicks.

**Both 5.8 and 6.4 are on the Phase 6 task list. The session done-criteria from the handoff doc requires all 8 tasks DONE — so Phase 6 is 6-of-8 complete after this session.**

## Files Changed (ready to commit)

**Modified (2):**
- `website/src/app/app/login/page.tsx` — accept `?reset=success` query param, show green Alert above the form
- `.specify/features/005-lsl-platform/sub-specs/auth-tasks.md` — mark tasks 5.7, 6.1, 6.2, 6.3, 6.5, 6.6 DONE with status notes

**New / untracked (13 files):**

Page surfaces:
- `website/src/app/app/verify-email/page.tsx`
- `website/src/app/app/verify-email/actions.ts`
- `website/src/app/app/verify-email/actions.test.ts`
- `website/src/app/app/verify-email/resend-form.tsx`
- `website/src/app/app/forgot-password/page.tsx`
- `website/src/app/app/forgot-password/actions.ts`
- `website/src/app/app/forgot-password/actions.test.ts`
- `website/src/app/app/forgot-password/forgot-password-form.tsx`
- `website/src/app/app/reset-password/page.tsx`
- `website/src/app/app/reset-password/actions.ts`
- `website/src/app/app/reset-password/actions.test.ts`
- `website/src/app/app/reset-password/reset-password-form.tsx`

Library:
- `website/src/lib/auth/rate-limit.ts`
- `website/src/lib/supabase/admin.ts`

Integration tests:
- `website/src/__tests__/auth/phase5-proxy-gating.test.ts`
- `website/src/__tests__/auth/phase6-reset-token-lifecycle.test.ts`
- `website/src/__tests__/auth/phase6-verification-resend-rate-limit.test.ts`

### Suggested commit grouping (operator decides — nothing committed yet)

The natural shape is **one commit per task** per the handoff doc's convention:

1. `feat(E5.1-auth): Task 6.1 — /app/verify-email page + resend rate-limit infrastructure` — verify-email/*, lib/auth/rate-limit.ts, lib/supabase/admin.ts
2. `feat(E5.1-auth): Task 6.2 — /app/forgot-password (enumeration-safe)` — forgot-password/*
3. `feat(E5.1-auth): Task 6.3 — /app/reset-password + login ?reset=success banner` — reset-password/*, login/page.tsx
4. `test(E5.1-auth): Task 5.7 — proxy gating integration (live)` — phase5-proxy-gating.test.ts
5. `test(E5.1-auth): Task 6.5 — reset token lifecycle integration` — phase6-reset-token-lifecycle.test.ts
6. `test(E5.1-auth): Task 6.6 — verification resend rate-limit integration` — phase6-verification-resend-rate-limit.test.ts
7. `docs(E5.1-auth): mark Phase 6 Tasks 5.7, 6.1–6.3, 6.5, 6.6 DONE` — auth-tasks.md

The `lib/auth/rate-limit.ts` + `lib/supabase/admin.ts` files are load-bearing for Task 6.1's resend cap, so they ship in commit (1) with verify-email.

## How to Test

All test gates run from `website/`:

```bash
# 1. TypeScript — clean (the gate CI enforces).
npx tsc --noEmit

# 2. Vitest — full suite, including all 6 auth integration suites against live Supabase.
#    The integration suites read NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
#    NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local (parsed inline by _helpers.ts).
npx vitest run

# 3. Build — Next.js production bundle.
npm run build
```

**Current state (verified at session end, 2026-05-29 09:00 AEST):**

| Gate | Status | Counts |
|---|---|---|
| `npx tsc --noEmit` | green | 0 errors |
| `npx vitest run` | green | 2513 passed / 0 failed / 58 files |
| `npm run build` | green | 13 routes incl. all 4 new auth pages + Proxy registered |
| `npm run lint` | not a CI gate — 1605 warnings + 17 errors **all pre-existing in lsl/* engine code**; 0 errors in any new Phase 6 file (only 4 underscore-prefix unused-param warnings) |

## Context for Next Session

### What the prior session did well

- **Server-action structure is clean and follows the React 19 + Next.js 16 conventions established by Tasks 5.3 + 5.4** (`useActionState` + `useFormStatus`, server-only files with `'use server'` at top, page/form/action separation).
- **The enumeration-safe forgot-password action is well-reasoned** — explicitly does NOT pre-lookup the email (would re-introduce the enumeration vector) and uses a SHA-256 hash in `auth_audit_log.metadata` for incident-response correlation. The detailed comment block explaining why is excellent.
- **The reset-password action's two-step sign-out** (`signOut({scope:'others'})` then default `signOut()`) is the right read of the SDK — the comment explains why `{scope:'global'}` would race with cookie invalidation.
- **`lib/supabase/admin.ts` returns `null`** when the service-role key is missing, and callers degrade gracefully (no admin → application-side cap disabled, Supabase's 1-per-60s still in force). Right design.
- **`lib/auth/rate-limit.ts` fails OPEN on a read failure** so a transient DB error doesn't strand a user mid-signup. The comment explaining the trade-off is exactly the kind of reasoning the spec wants captured.

### What I had to fix or rewrite

1. **TypeScript errors in `forgot-password/actions.test.ts` + `reset-password/actions.test.ts`** — `auditInsertMock = vi.fn(async () => ...)` was a zero-arg signature called with one arg (the row), breaking strict tsc. Added `_row: unknown` to the mock signature. Also propagated the fix to the tuple-element-at-index errors that cascaded from the same root cause. **CI runs `npx tsc --noEmit`, so this would have broken the build.**

2. **`phase5-proxy-gating.test.ts` test (b) unverified was unreachable.** Prior session attempted `admin.createUser({ email_confirm: false })` + `signInWithPassword`. Supabase default config rejects password sign-in for unconfirmed accounts ("Email not confirmed"), so the suite failed at `beforeAll`. I probed three workarounds:
   - **`anon.signUp(...)`** — works for one-off but hits Supabase's free-tier email rate limit after ~3-4 calls in an hour, so it would flake CI.
   - **`admin.updateUserById(id, { email_confirmed_at: null })`** via SDK — silently ignored by Supabase.
   - **Raw REST `PUT /auth/v1/admin/users/{id}` with `email_confirmed_at: null`** — also silently ignored.

   The honest engineering decision: **scope the integration test to (a) anonymous + (c) verified — the branches we CAN deterministically exercise live**, and document that branch (b) unverified is fully covered by the existing 24-test `src/proxy.test.ts` (which mocks only the `createSupabaseProxyClient` SSR factory — the same boundary an integration test would need to mock anyway to escape the email-rate-limit trap). The DB side of unverified signup is covered live by `phase4-trigger-atomicity.test.ts`. Combined, every code path the proxy can take is exercised. The full justification is in the test file's header comment.

3. **Task 6.6 (verification resend rate-limit integration test) was missing.** Prior session built the 5 page surfaces + 2 library files + 2 integration tests, but the handoff doc's 8-task scope included Task 6.6 which never got written. I added `phase6-verification-resend-rate-limit.test.ts` (9 cases) to close that gap.

### Decisions made

- **Task 5.7 branch (b) deliberately delegated to `proxy.test.ts`** — see Fix #2 above. Worth flagging to PM if the spec wants a live-Supabase test for the unverified branch specifically; would require infrastructure changes (local Supabase stack in CI).
- **Reset-token-expiry assertion (Task 6.5) uses "fake token" instead of "expired token"** — 60-min wall-clock waits aren't viable in CI; Supabase's `flow_state` invalidation fires identically for "never issued" and "expired", so the "clear error" property of AC-AUTH-10 holds for both. Documented in the test file's comments.

### Things tried that didn't work

- Three attempts to produce a live unverified session against the remote Supabase project (see Fix #2). All rejected by Supabase's anti-enumeration design. Rather than fight the framework, I scoped the live integration test to what's reliably testable and routed the unverified branch through the existing mock-level integration test.

### Assumptions baked into the implementation

- `auth_audit_log.event_type` is a free `text` column (no enum). The new event_type values introduced this session are:
  - `verification_resend` (Task 6.1 — recorded by `recordVerificationResend`)
  - `password_reset_request` (Task 6.2 — recorded by forgot-password action, `user_id` is NULL)
  - `password_reset_complete` (Task 6.3 — recorded by reset-password action)
  - The Phase 4 migration already wrote `signup` and `logout` (Task 5.5). No schema change needed.

- The reset-password page's `?code=` exchange happens in the Server Component (not a separate route handler) because a Server Component can write cookies via `createSupabaseServerClient` exactly the same way a server action can. Splitting into a route would add a hop with no benefit. Documented in the page's docstring.

## Open Questions

1. **Task 5.8 (Playwright E2E) infrastructure.** Does the next session run with the operator setting up local Supabase + Mailhog in CI first (DevOps task), or does Task 5.8 get bumped to a v1.1 milestone and we mark Phase 6 "complete-enough"? PM decision.
2. **Task 6.4 (email templates) — operator-driven.** Who clicks through the Supabase dashboard to customise the three templates? Recommend PM coordinates with Designer for the visual fidelity before the operator does the clicks.
3. **Pre-launch guard:** I did NOT touch anything affecting `ANTHROPIC_API_KEY` paths, ZDR, or customer-facing privacy copy this session. The launch guard remains in its pre-session state. No operator confirmation needed.
4. **Service-unavailable banner on `/app/login`** already existed (`?error=service_unavailable`). I added `?reset=success` as a sibling param — keep an eye on whether more accumulate; a state-machine pattern might be cleaner if a third joins.

## Spec Deviations

- **AC-AUTH-3a, Task 5.7 acceptance criterion** "Tests run in CI on every PR" with branches (a)/(b)/(c) all live → **branch (b) unverified is delegated to the existing 24-test `src/proxy.test.ts`** (mock-level integration tests at the SSR-client boundary). Reason: producing a real unverified session against live Supabase is intentionally hard (anti-enumeration design) and rate-limited (free-tier email caps). The combined coverage exercises every code path; see the test file's header for the full justification. Worth flagging to PM if the spec wants live coverage of the unverified branch specifically — would need DevOps to stand up a local Supabase stack in CI.

- **AC-AUTH-10 / Task 6.5 acceptance criterion** "Test (a) advances time / mocks clock past 60 min and asserts rejection" → **adapted to "obviously invalid token"** rather than wall-clock waiting. Supabase's `flow_state` invalidation fires identically for "never issued" and "expired", so the "clear error" property holds for both states. Documented in the test file's comments.

- **Phase 6 done-criteria from `HANDOFF-resume-phase-6.md` §3** "all 8 tasks DONE" → **6 of 8 done** (5.7, 6.1, 6.2, 6.3, 6.5, 6.6). Tasks 5.8 + 6.4 outstanding as described in "What Is Blocked" above. PR #67 will move from "scaffold-only" to "Phase 6 partial complete" once these commits land, but should stay draft until 5.8 + 6.4 ship or get explicitly deferred by the PM.

---

*Generated by the dev-handoff skill at the close of the 2026-05-29 resume session.*
