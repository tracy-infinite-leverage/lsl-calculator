# DevOps Scope — Task 5.8 (Playwright E2E golden path 1: signup → verify → home)

**Date:** 2026-05-29
**Author:** DevOps agent (scoping only — no code/workflow changes made)
**Branch context:** `feat/E5.1-auth-slice-phase-6`, PR #67
**Inputs read:**
- `docs/engineering/changes/2026-05-29-e51-auth-phase-6/HANDOFF.md` (especially §"What Is Blocked / Outstanding for Phase 6" and §"Open Questions")
- `docs/launch/LAUNCH-GUARD.md`
- `.github/workflows/ci.yml` (current Playwright job)
- `website/playwright.config.ts`
- `.specify/features/005-lsl-platform/sub-specs/auth-tasks.md` §Task 5.8 + §Task 5.4 (the dev-grill mixed-case round-trip note that explicitly defers to 5.8)
- `website/supabase/migrations/` (5 migrations would need to apply to a local stack)

---

## Bottom line (TL;DR)

**Ship Task 5.8 in a follow-up PR pre-launch, NOT in PR #67. Use Option B (CI-only test-helper route), not the local-Supabase-stack approach the handoff doc suggested.**

Reasoning:
- LAUNCH-GUARD.md does not list E2E coverage as a launch gate. The gate is gone (it was `ANTHROPIC_API_KEY`, closed by code deletion).
- Existing coverage at the unit + integration layer is strong (2513 vitest tests green, 6 of which are live Supabase integration suites that exercise the signup → audit-row → verification-resend chain end-to-end on real infra). The E2E test would harden the browser path, not unlock a missing capability.
- The local-Supabase-stack-in-CI route is a multi-day chunk of work (real CLI install, image-pull cost, port management, Mailhog wiring, env plumbing, the migration-reset dance) and is structurally fragile in CI cold-start environments. Wrong tool for one test.
- The spec for Task 5.8 itself (`auth-tasks.md` line 404) already says "backend test-helper marks email confirmed (simulating link click)" — so Option B is what the spec actually asks for; the handoff doc's local-stack proposal was an alternative interpretation, not a constraint.
- A single test-helper route guarded by a CI-only env flag is ~half-a-day of work and ships behind the same CI gates the rest of auth ships behind. It's the right size for the value.

PR #67 should land as "Phase 6, 6-of-8 complete" with Task 5.8 deferred to a follow-up. Task 6.4 (email templates) is operator-owned dashboard work — also follow-up, also pre-launch.

---

## 1. Approach options

### Option A — Local Supabase stack in CI (`supabase start` + `inbucket`)

The handoff doc's proposal. Spin up the entire local Supabase stack inside the GitHub Actions Playwright job; the Auth API sends real verification emails to the bundled `inbucket` SMTP catcher on port 54324; the Playwright test hits inbucket's HTTP API to fetch the link, follows it, asserts redirect to `/app/`.

**How it would look:**
- New step in the `playwright` job: install Supabase CLI (`npm i -g supabase` or download binary).
- `supabase start` (pulls ~7 Docker images, takes ~60–120s cold).
- `supabase db reset` — applies the 5 existing migrations to the local stack.
- Override `NEXT_PUBLIC_SUPABASE_URL` / anon key / service-role env vars to point at the local stack (`http://127.0.0.1:54321`).
- Playwright test polls inbucket REST API (`http://127.0.0.1:54324/api/v1/mailbox/<email>`) for the verification email, extracts the link, navigates.

**Trade-offs:**
- ✅ Tests the real Supabase Auth verification path end-to-end including the real email template rendering.
- ✅ No production-code surface area added (the test-only behaviour stays in CI infra, not in `src/`).
- ✅ Eliminates the free-tier email rate-limit pain that bit Task 5.7 (per HANDOFF.md "Things tried that didn't work").
- ❌ Docker-in-CI cold-start cost: typically 60–120s for `supabase start` on a fresh GitHub Actions runner. Inflates the Playwright job from ~5 min to ~7–9 min.
- ❌ Maintenance burden: when Supabase CLI or its Docker images drift, the job breaks in ways the rest of the codebase wouldn't catch.
- ❌ Two parallel "sources of truth" for what the auth schema looks like — the live `lsl-platform` project and the local stack. Migration drift is a real failure mode.
- ❌ The 5 migrations include `handle_new_user_trigger.sql` + `harden_phase4_functions.sql` — these rely on `SECURITY DEFINER` and specific role grants. Local stack approximates this but the grant model differs subtly from hosted Supabase. Possible false positives/negatives.
- ❌ `inbucket` SMTP port (54324) and the rest of the 5432/54321/54323/54324 quartet collide with other Docker services. CI usually has clean ports, but documents this fragility.
- ❌ Doubles the env-var surface (which Supabase URL is "real" for which job?). Easy to misconfigure.
- ⚠️ The Vitest integration suites continue to run against the **live** `lsl-platform` project. So now CI has two different Supabase truths — live integration tests AND local-stack E2E — that have to stay in sync.

**Effort:** **Multi-day** (1.5–2.5 dev-days). Bulk is in debugging the local-stack-in-CI fragility, not the test code. The Playwright test itself is ~50 lines.

### Option B — CI-only test-helper route (recommended)

A privileged route handler at `website/src/app/api/test-helpers/confirm-email/route.ts` that:
1. Hard-gates on `process.env.CI_TEST_HELPER_TOKEN === <secret>` — returns 404 in production, on previews without the secret, and locally without the env var. Any other condition is a no-op.
2. Accepts a `POST { email }` body, uses the service-role client to call `admin.updateUserById(id, { email_confirm: true })` for that user, returns 204.
3. Logs every invocation to stdout with the email and a "TEST HELPER USED" marker so any accidental production-env hit is loud.

The Playwright test signs up against the **live** `lsl-platform` Supabase project using a per-test unique email (`e2e-${run_id}-${uuid}@playwright.test.lslcalculator.com.au`), POSTs to `/api/test-helpers/confirm-email` to flip the flag, refreshes, asserts `/app/`.

**Trade-offs:**
- ✅ Single source of truth for the auth schema (the live project). No drift risk.
- ✅ Cheap CI: no Docker, no migration-replay, no inbucket. Adds ~30s to the Playwright job.
- ✅ The spec for Task 5.8 (`auth-tasks.md` line 404) explicitly says "backend test-helper marks email confirmed (simulating link click)" — this matches the spec's intent.
- ✅ Symmetric with how the Vitest integration suites already use the service-role client against the live project — same env vars, same auth model, same trust boundary.
- ❌ **Adds production-code surface area for a test-only helper.** The route file lives in the production bundle. Security depends on the env-var gate being absolutely watertight.
- ❌ The CI_TEST_HELPER_TOKEN secret has to live in (a) GitHub Actions secrets, and (b) NOT in Vercel Production env. If it ever leaks to Production, the route becomes a verification bypass for anyone with the token. The gate must be both `process.env.CI_TEST_HELPER_TOKEN` set AND match the request header.
- ❌ Tests are not running against a clean DB. Per-test email uniqueness is mandatory or runs poison each other.
- ⚠️ Live `lsl-platform` project accumulates test users. Need a periodic cleanup (cron'd edge function purging users whose email matches `*.playwright.test.lslcalculator.com.au`).

**Effort:** **Half-day** (3–4 hours). Route + test + env wiring + a brief security review of the gate.

### Option C — Playwright storage-state auth bypass (don't recommend, listed for completeness)

Pre-generate a verified-user session as Playwright storage state (a `.json` with the Supabase auth cookies) at suite setup, then run the test starting from an already-authenticated browser context. The "signup → verify → home" assertion becomes "load home as a verified user, confirm it renders". The interesting middle is mocked away.

**Trade-offs:**
- ✅ Fastest of any option (~10 min to wire). Lowest risk.
- ❌ Doesn't actually test the signup → verify → redirect path. It just tests "verified user sees home". AC-AUTH-3 and AC-AUTH-4 (the "lands on `/app/verify-email`" and "next page load lands on `/app/`" assertions) are not exercised.
- ❌ Fails the spirit of the task. The whole point of golden-path-1 is the seam between Supabase email-confirm and the Next.js redirect.

**Effort:** A couple of hours, but **don't ship this** — it satisfies the letter of "Playwright test exists" without the substance.

---

## 2. Effort estimate (rolled up)

| Option | Effort | Confidence |
|---|---|---|
| A — Local Supabase + inbucket in CI | 1.5–2.5 dev-days | Medium (CI cold-start variance) |
| B — CI-only test-helper route | 3–4 hours | High |
| C — Storage-state bypass | 2 hours | High (but doesn't actually validate the path) |

---

## 3. Risks

### Flakiness
- **Option A**: `supabase start` Docker pulls have failed in GitHub Actions runner cache misses before. Inbucket's SMTP intake has a small race window where the email isn't yet retrievable via HTTP. Network port assignments inside the Docker network occasionally clash on shared-runner machines. Realistic flake rate without retries: 1–3% per run.
- **Option B**: The Playwright test depends on the live `lsl-platform` project being reachable — same risk as the existing Vitest integration suites which already run against it without flake reports. Realistic flake rate: <0.5%.
- **Option C**: Effectively zero — but tests less.

### Free-tier rate limits
- **Option A**: Eliminated. Local stack has no rate limits.
- **Option B**: The signup itself hits Supabase Auth. Free-tier email send is 3/hour by default — but verification emails in the live project ARE sent for real (to a fake domain that doesn't resolve). Supabase counts these against the cap, so a busy CI day with 6+ PRs could hit it. **Mitigation**: use a project-level rate-limit bump (Supabase Pro tier already gives 30/hour). The project is already on Pro (per `website/AGENTS.md`).
- **Option C**: No signups happen.

### CI cold-start time
- **Option A**: +60–120s per Playwright job for `supabase start`. Compounding cost across PR-iteration cycles.
- **Option B**: +5–10s for the helper-route call. Negligible.
- **Option C**: 0.

### Maintenance burden
- **Option A**: Supabase CLI version pinning, Docker image cache hits, migration-replay correctness, inbucket API stability. Each is a small thing; together they're a long tail of "the auth E2E is broken again, can't merge".
- **Option B**: One helper route. If Supabase admin SDK changes, both the helper and `lib/supabase/admin.ts` need updating — but they're already coupled.
- **Option C**: Storage state regenerates if cookie format changes.

### Security implications
- **Option A**: Zero new attack surface in production code.
- **Option B**: **The big risk.** If `CI_TEST_HELPER_TOKEN` ever ends up in Vercel Production env, the route becomes "POST email → become verified". Mitigations:
  1. Hard 404 if `process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production'` — refuse to serve even with a valid token in true prod. This belt-and-braces makes a misconfigured Vercel env nonviable.
  2. The token is generated fresh per CI run (`secrets.GITHUB_TOKEN` ephemerality) and never persisted.
  3. Document in `docs/engineering/vercel-config.md` that `CI_TEST_HELPER_TOKEN` is a CI-only secret. Operator review confirms it's not in Vercel.
  4. The route logs every invocation. CloudWatch / Vercel logs would surface a production hit immediately.

   With those four mitigations in place, the residual risk is acceptable.
- **Option C**: Storage-state file committed to repo would be a leak of dev session cookies. Don't commit it — gitignore + per-run regeneration.

---

## 4. Dependencies (per option)

### Option A
- **New tooling in CI runner**: Supabase CLI (`npm i -g supabase` or pinned binary), Docker (already on GitHub-hosted runners).
- **New env vars in `playwright` job**:
  - `SUPABASE_URL=http://127.0.0.1:54321` (local override)
  - `SUPABASE_ANON_KEY=<local-stack-default>` (well-known, baked into CLI)
  - `SUPABASE_SERVICE_ROLE_KEY=<local-stack-default>`
  - `INBUCKET_URL=http://127.0.0.1:54324`
- **New GitHub secrets**: none (local-stack keys are public).
- **`playwright.config.ts` changes**: a new project entry or env-driven base-URL switch for the auth E2E.
- **`.github/workflows/ci.yml` changes**: ~30 lines added to the `playwright` job — install CLI, `supabase start`, `supabase db reset`, run tests, `supabase stop` in `always()` cleanup.
- **New repo file**: `website/supabase/config.toml` (Supabase CLI config; pinned versions for reproducibility).
- **New repo files**: `website/e2e/auth-signup-verify.spec.ts` + a small inbucket helper at `website/e2e/_helpers/inbucket.ts`.

### Option B (recommended)
- **New tooling in CI runner**: none.
- **New env vars in `playwright` job**:
  - `NEXT_PUBLIC_SUPABASE_URL` (live, same secret as Vitest job)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same)
  - `SUPABASE_SERVICE_ROLE_KEY` (same)
  - `CI_TEST_HELPER_TOKEN` — new, **GitHub-Actions secret only**, NOT in Vercel.
- **New GitHub Actions secret**: `CI_TEST_HELPER_TOKEN` (any cryptographically random 32-byte value, regeneratable).
- **`playwright.config.ts` changes**: optionally pass `CI_TEST_HELPER_TOKEN` through `webServer.env` so the dev server it spawns sees it. (The current config uses `npm run dev`; adding `env: { CI_TEST_HELPER_TOKEN: '...' }` is a 3-line change.)
- **`.github/workflows/ci.yml` changes**: ~5 lines added to the `playwright` job — pass the three Supabase secrets + the helper token as env on the Playwright step.
- **New repo files**:
  - `website/src/app/api/test-helpers/confirm-email/route.ts` (production code, hard-gated)
  - `website/src/app/api/test-helpers/confirm-email/route.test.ts` (unit tests for the gate — verify 404 in prod, 404 without token, 204 with token in CI)
  - `website/e2e/auth-signup-verify.spec.ts`
  - `website/e2e/_helpers/test-users.ts` (per-test unique email generator)
- **Cleanup job**: a recurring edge function or a CI scheduled workflow that purges `e2e-*@playwright.test.lslcalculator.com.au` users from the `lsl-platform` project weekly. Not blocking — can ship as a follow-up.

### Option C
- **No tooling, no env vars.**
- **`playwright.config.ts`** — add a `globalSetup` script.
- **New repo files**: `website/e2e/global-setup.ts`, `website/e2e/auth-signup-verify.spec.ts` (stub).

---

## 5. Recommendation

### When: pre-launch, in a follow-up PR (NOT in PR #67)

LAUNCH-GUARD.md does not gate launch on E2E coverage. The hard gate (`ANTHROPIC_API_KEY`) is closed by elimination. The remaining items in the guard (production domain, ZDR/privacy posture) don't intersect with the auth-slice E2E.

The existing test coverage for the signup → verify → home path is already substantial:
- `phase4-trigger-atomicity.test.ts` — live Supabase, tests the signup → `handle_new_user` trigger → `organisations` + `org_members` row chain.
- `phase5-proxy-gating.test.ts` — live Supabase, branches (a) anonymous + (c) verified.
- `phase6-verification-resend-rate-limit.test.ts` — live Supabase, exercises the verification-resend code path on real `auth_audit_log` rows.
- `proxy.test.ts` — 24 mock-level tests covering the unverified branch (b).
- The signup/login/verify-email/forgot-password/reset-password actions all have their own action-level Vitest suites.

A Playwright E2E would add **browser-level confidence** that the redirect chain (`/app/signup` POST → `/app/verify-email` GET → confirmed → `/app/` GET) renders correctly across the four-browser matrix already configured. That's worth having before launch — but it's not what's standing between us and customers.

### Why follow-up PR not PR #67
- PR #67's diff is already large (~13 new files, 2 modifications, 6 commits per the handoff).
- Task 5.8's work — even Option B — adds production code (the helper route) that warrants its own focused review.
- The helper-route security gate is the kind of thing where a focused PR with a tight description ("here's the env-flag gate, here's the production refusal, here's why this is safe") gets better scrutiny than the 4th file in a Phase-6 omnibus.

### Why Option B not Option A
- Spec line 404 explicitly says "backend test-helper marks email confirmed (simulating link click)" — Option B matches the spec.
- The local-stack approach is structurally heavier for a single test and introduces drift risk against the live project that the Vitest integration suites already validate against.
- Half-a-day vs. multi-day for the same browser-level confidence.

---

## 6. Concrete task list (Option B, pre-launch follow-up PR)

Dependency-ordered. Each task is ≤ 2 hours.

1. **Generate `CI_TEST_HELPER_TOKEN` and add to GitHub Actions secrets only.**
   - Owner: operator.
   - Command: `openssl rand -hex 32` → paste into `Settings → Secrets and variables → Actions → New repository secret`.
   - Confirm NOT added to Vercel.
   - **Output:** secret name visible in GitHub Actions UI.

2. **Write `website/src/app/api/test-helpers/confirm-email/route.ts`.**
   - Owner: developer agent.
   - Hard gate:
     ```
     if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') return 404
     if (!process.env.CI_TEST_HELPER_TOKEN) return 404
     if (request.headers.get('x-ci-helper-token') !== process.env.CI_TEST_HELPER_TOKEN) return 404
     ```
   - POST body: `{ email: string }`. Use the existing `lib/supabase/admin.ts` factory to get a service-role client, look up the user via `admin.listUsers({ filter: ... })`, then `admin.updateUserById(id, { email_confirm: true })`.
   - Always 204 on success, 404 on any gate miss (no 401/403 — don't even acknowledge the route exists when not authorised).
   - `console.warn('TEST HELPER USED', { email, ts })` on every successful invocation.
   - **Output:** route file + matching `route.test.ts` (≥6 cases: prod-refusal, missing-token, wrong-token, success path, unknown-email-graceful, malformed-body).

3. **Update `.github/workflows/ci.yml` `playwright` job to pass env.**
   - Owner: devops agent.
   - Add the three Supabase secrets (already in the `test` job) and the new `CI_TEST_HELPER_TOKEN` secret to the Playwright step's env block.
   - **Output:** ~5-line diff to ci.yml.

4. **Update `website/playwright.config.ts` to thread env vars to webServer.**
   - Owner: devops agent.
   - Add `env: { CI_TEST_HELPER_TOKEN: process.env.CI_TEST_HELPER_TOKEN, NEXT_PUBLIC_SUPABASE_URL: ..., NEXT_PUBLIC_SUPABASE_ANON_KEY: ..., SUPABASE_SERVICE_ROLE_KEY: ... }` to the `webServer` config so the dev server spawned by Playwright inherits them.
   - **Output:** ~6-line diff to playwright.config.ts.

5. **Write `website/e2e/_helpers/test-users.ts`.**
   - Owner: developer.
   - Exports `uniqueE2eEmail()` returning `e2e-${Date.now()}-${randomHex(8)}@playwright.test.lslcalculator.com.au`.
   - **Output:** ~10-line module.

6. **Write `website/e2e/auth-signup-verify.spec.ts`.**
   - Owner: developer.
   - Steps:
     1. Generate unique email.
     2. Navigate to `/app/signup`, fill email + 12-char password, submit.
     3. Assert URL is `/app/verify-email`.
     4. POST to `/api/test-helpers/confirm-email` with header `x-ci-helper-token: <env>`.
     5. Refresh / navigate to `/app/`.
     6. Assert the page renders the authenticated home (look for the logout button or a known authenticated-only element).
   - **Output:** ~80 LOC spec file.

7. **Verify in CI.**
   - Owner: devops agent.
   - Open the follow-up PR, watch the Playwright job pass on the four-browser matrix, confirm the helper route 404s on preview deploys (test by curl'ing the preview URL — should get 404).
   - **Output:** PR green, manual preview-URL probe documented in the PR description.

8. **Document in `docs/engineering/vercel-config.md`.**
   - Owner: devops agent.
   - One paragraph: "`CI_TEST_HELPER_TOKEN` is a CI-only secret. It lives in GitHub Actions secrets. It MUST NOT be added to any Vercel environment. The route at `/api/test-helpers/confirm-email` hard-refuses to operate in `VERCEL_ENV === 'production'` even if the token leaks."
   - **Output:** doc updated.

9. **(Follow-up, not blocking)** — schedule a weekly user-purge edge function or GitHub Actions cron that deletes Supabase users whose email matches `e2e-*@playwright.test.lslcalculator.com.au`. Prevents the auth.users table from accumulating test cruft.

**Total estimate:** 3–4 hours of focused work spread across developer + devops. Operator action is one secret-generation step.

---

## Operator decisions required before DevOps can proceed

1. **Approve Option B over Option A.** (Or pick A if you specifically want the local-stack route — see §1 and §3 for the trade-offs.)
2. **Confirm "pre-launch follow-up PR" is the right cadence.** Alternative: defer Task 5.8 to v1.1 entirely. Per §5, the existing integration coverage is enough that LAUNCH-GUARD is not violated either way.
3. **Generate and load `CI_TEST_HELPER_TOKEN`** into GitHub Actions secrets when the follow-up PR is opened (Task 1 above). DevOps cannot create GitHub secrets.
4. **Confirm Task 6.4 (email-template branding) is operator+designer-owned**, not in DevOps scope. (Confirms the handoff doc's read; included here so nothing falls between agents.)

Nothing about this scope requires changes to LAUNCH-GUARD.md or any code on PR #67. PR #67 can land at 6-of-8, and Phase 6 closure happens in a separate follow-up.
