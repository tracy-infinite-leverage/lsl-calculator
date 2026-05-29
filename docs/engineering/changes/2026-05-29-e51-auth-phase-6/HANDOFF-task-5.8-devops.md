# HANDOFF — Task 5.8 (Playwright E2E golden path 1) → DevOps

**Date:** 2026-05-29
**From:** Developer agent
**To:** DevOps agent
**Branch:** `feat/E5.1-task-5.8-playwright-e2e` (off `main` — see "Branch base note" below)
**PR:** not yet opened — waiting on operator approval per the task brief

This doc is the developer-side handoff for the CI wiring step of Task 5.8. The
helper route + Playwright spec + unit tests have shipped on the branch; what
remains is a small `.github/workflows/ci.yml` edit + one GitHub Actions secret
verification.

---

## TL;DR — what DevOps needs to do

1. Confirm `CI_TEST_HELPER_TOKEN` is already in GitHub Actions secrets (operator
   confirmed via `gh secret list` per the task brief).
2. Pass that secret + the three Supabase env vars to the `playwright` job in
   `.github/workflows/ci.yml`. ~6 lines added.
3. Verify the helper route 404s on the live production domain
   (`https://www.lslcalculator.com.au/api/test-helpers/confirm-user`) after the
   PR merges — it must NOT acknowledge the route exists.

That's it. No new tooling, no new Vercel env vars (helper token MUST NOT be
added to Vercel), no migrations.

---

## Branch base note (important)

The task brief instructed branching off `feat/E5.1-auth-slice-phase-6`. However,
by the time I sat down to do this work, **PR #67 had already merged + three
follow-up production hotfixes (#68, #69, #70) had also merged to `main`**. The
`feat/E5.1-auth-slice-phase-6` branch was missing those three fixes — most
critically PR #68's "move INITIAL_STATE out of 'use server' files" fix, which
makes the signup page crash with `A "use server" file can only export async
functions, found object` in any dev environment without it.

Decision: I rebased onto `origin/main` instead of the stale phase-6 branch. The
auth pages exist on main, the fixes are there, and the PR base should be `main`,
not `feat/E5.1-auth-slice-phase-6`. The two-commit stack the operator described
is no longer accurate (#67 already landed).

If the operator wants to re-target the PR base to `feat/E5.1-auth-slice-phase-6`
specifically, the phase-6 branch first needs to be merged with main to pick up
those three fixes — otherwise the dev server won't start and the E2E can't run.

---

## What's shipped on the branch

Files added (no existing files modified):

| Path | Purpose |
|---|---|
| `website/src/app/api/test-helpers/confirm-user/route.ts` | Hard-gated CI-only route that marks a user `email_confirmed_at=NOW()` via admin SDK. Returns 404 on every gate miss (no acknowledgment of existence). |
| `website/src/app/api/test-helpers/confirm-user/route.test.ts` | 22 Vitest cases covering every gate branch, body-validation case, success path, audit-row insert, and non-POST verbs. |
| `website/e2e/_helpers/test-users.ts` | `uniqueE2eEmail()` + `cleanupUserByEmail()` helpers for E2E specs. |
| `website/e2e/auth-signup-verify.spec.ts` | Playwright spec — golden path 1 (signup → verify-email → test-helper confirm → login → /app/). Skips entirely when `CI_TEST_HELPER_TOKEN` is unset. |
| `docs/engineering/changes/2026-05-29-e51-auth-phase-6/HANDOFF-task-5.8-devops.md` | This file. |

---

## Gate semantics — recap before you wire CI

The route MUST return 404 (not 401/403/503) on:

1. `VERCEL_ENV === 'production'` — belt-and-braces: even with a valid token, the
   route refuses in production. This means if `CI_TEST_HELPER_TOKEN` ever leaks
   into Vercel Production env by mistake, the route is still a 404.
2. `CI_TEST_HELPER_TOKEN` env var unset — the route is functionally non-existent
   without the flag.
3. Missing `Authorization` header.
4. `Authorization` header value ≠ `Bearer <CI_TEST_HELPER_TOKEN>`.
5. Any non-POST verb.

Only after all gates pass does the route consult the request body. Malformed
body returns 400 (caller is authorised, honest error is fine). User not found
returns 404 (different reason from gate-404, but indistinguishable from outside
— that's intentional). Server misconfig (missing Supabase env) returns 500
(loud — gate has already accepted, so we want to know).

---

## Required CI changes

### 1. Update `.github/workflows/ci.yml` — `playwright` job

Add four env vars to the `Run Playwright matrix` step. The three Supabase vars
are already present on the `test` job; reuse the same secret names. The new
`CI_TEST_HELPER_TOKEN` is the only addition to Actions secrets.

```yaml
      - name: Run Playwright matrix
        # The CI env var triggers the full browser matrix in playwright.config.ts.
        # The Supabase env vars are required for the auth E2E (Task 5.8) to hit
        # the live lsl-platform project. CI_TEST_HELPER_TOKEN is the gate flag
        # for the /api/test-helpers/confirm-user route used by the E2E to
        # simulate the email-verification click without real SMTP.
        env:
          CI: true
          NEXT_PUBLIC_SUPABASE_URL:      ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY:     ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          CI_TEST_HELPER_TOKEN:          ${{ secrets.CI_TEST_HELPER_TOKEN }}
        run: npx playwright test
```

That's the only `.github/workflows/ci.yml` change required. The
`webServer.command` in `playwright.config.ts` is `npm run dev`, which inherits
`process.env` from the parent (the GitHub Actions runner). The env vars set on
the step propagate cleanly without needing a `webServer.env` block.

### 2. Verify the GitHub Actions secret

Per the task brief, the operator already created `CI_TEST_HELPER_TOKEN` via
`gh secret set`. Confirm via:

```bash
gh secret list --repo tracy-infinite-leverage/lsl-calculator | grep CI_TEST_HELPER_TOKEN
```

If absent, regenerate with `openssl rand -hex 32` and load via
`gh secret set CI_TEST_HELPER_TOKEN --repo tracy-infinite-leverage/lsl-calculator`.

### 3. CRITICAL — confirm the token is NOT in Vercel

The route's primary defence is the env-flag gate. The secondary defence is
`VERCEL_ENV === 'production'` refusal. Both must hold for the route to be safe
in production. Check via:

- Vercel dashboard → `lsl-calculator` → Settings → Environment Variables.
- Search for `CI_TEST_HELPER_TOKEN`. **It must not appear in any scope.**
- Production / Preview / Development should all be empty for this key.

If for any reason the token IS in Vercel, the `VERCEL_ENV` belt-and-braces still
fires — but the layered defence is the point. Remove it.

### 4. Post-merge smoke test

Once the PR merges and Vercel deploys to production, probe the live route:

```bash
curl -i -X POST https://www.lslcalculator.com.au/api/test-helpers/confirm-user \
  -H "Authorization: Bearer anything-at-all" \
  -H "Content-Type: application/json" \
  -d '{"email":"foo@example.com"}'
```

Expected: **`HTTP/1.1 404 Not Found`** with no acknowledgment of the route.

Document the curl probe result in the PR description.

---

## What's NOT in scope for DevOps

- **No `playwright.config.ts` changes needed.** The current config inherits env
  from the parent process, which is enough. The DevOps scope doc had a
  speculative `webServer.env` block — I tested without it and the env threads
  through correctly via `npm run dev`'s inheritance.
- **No new ports, no Docker, no local Supabase stack.** Option B is the route.
- **No `vercel.json` changes.** The route is a standard Next.js API route and
  Vercel picks it up automatically.

---

## Test/verify results (developer side, before handoff)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean. |
| `npx vitest run` (full suite — 2546 tests) | All green, including 22 new unit tests for the helper route. |
| `npx playwright test auth-signup-verify.spec.ts` — no `CI_TEST_HELPER_TOKEN` | **Skipped** with the literal CI-only reason. Not failed. |
| `npx playwright test auth-signup-verify.spec.ts` — with `CI_TEST_HELPER_TOKEN` set | **Blocked locally by a Supabase free-tier email-send rate limit** caused by my repeated debug iterations (≥10 signups in 5 minutes). The signup-action returns "We could not create your account" because Supabase 429s on the verification-email send (`over_email_send_rate_limit`). In CI this won't happen — each PR triggers ~1 signup against the project's Pro-tier 30/hour cap. **The helper route itself is verified working live** — `curl -X POST -H "Authorization: Bearer <token>" .../confirm-user -d '{"email":"<existing-user>"}'` returns 204 and writes an `auth_audit_log` row with `event_type='test_helper_confirm_user'` (confirmed via direct SQL on the `lsl-platform` project). The signup-form interaction is also confirmed working — `getByLabel` selectors hit the correct inputs and the action receives populated FormData. The only outstanding gap is end-to-end signup → verify-email in a single local run, which is gated on the rate limit clearing. |
| `npm run build` with `.env.local` moved aside | Clean build. Route registered as `ƒ /api/test-helpers/confirm-user` (dynamic, as expected). |
| Production-refusal behaviour (`VERCEL_ENV=production`) | Verified by unit test — returns 404 even with valid token. |
| Audit row written on success | Verified live — `auth_audit_log` row with `event_type='test_helper_confirm_user'`, `user_id` populated, `metadata={"vercel_env":"local"}`, IP captured. |

---

## Follow-up items (not blocking this PR)

1. **Cron-purge for E2E test users.** A weekly Supabase Edge Function or
   GitHub Actions cron should delete `auth.users` rows where `email LIKE
   '%@playwright.test.lslcalculator.com.au'`. The spec for Task 5.8 didn't
   require it, but the DevOps scope flagged it as a follow-up. Not blocking
   launch.
2. **Re-introduce live unverified-session integration coverage.** Task 5.7's
   branch (b) was delegated to mock-level tests. Now that we have a working
   way to create unverified sessions via the test-helper, the
   `phase5-proxy-gating.test.ts` suite could be extended to add a live
   unverified branch. PM-deviation ruling already filed; this stays a
   follow-up.
3. **Pro-tier rate-limit confirmation.** The Supabase Pro tier nominally allows
   30 verification emails/hour. My local testing hit 429 after ~10 attempts.
   Worth a quick dashboard check that the project's auth rate-limit setting
   is configured per Pro defaults; if it's still on the free-tier 3/hour cap,
   bumping it cheaply hedges against rare CI flake from rapid PR iteration.

---

## LAUNCH-GUARD posture

Read `docs/launch/LAUNCH-GUARD.md` before this change ships. The guard's hard
gate (`ANTHROPIC_API_KEY`) is closed by code deletion. This change does NOT
re-open it and does NOT introduce any new gate. The test-helper route is
hard-refused in production (`VERCEL_ENV === 'production'` → 404, regardless of
any env state) so its presence does not weaken the launch posture.
