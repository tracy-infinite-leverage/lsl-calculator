# Task Checklist — LSL Platform · Auth (Login slice of E5.1)

**Slug:** `lsl-platform-auth`
**Plan:** `.specify/features/005-lsl-platform/sub-specs/auth-impl-plan.md` v1.0
**Spec:** `.specify/features/005-lsl-platform/sub-specs/auth.md` v1.0
**Status:** Draft — generated 2026-05-26
**Convention:** `[P]` after the task title = can run in parallel with sibling tasks. Acceptance criterion IDs (AC-AUTH-N) reference spec §12.

---

## Phase 1: Research & Validation

These three spikes resolve the only known technical unknowns. They must complete before the implementation phases they gate, but they themselves are quick (≤1h each).

### Task 1.1: Validate `@supabase/ssr` on Next.js 16 + React 19 ✅ DONE 2026-05-26

**Description**: Confirm `@supabase/ssr` (not the deprecated `auth-helpers-nextjs`) is the current Supabase recommendation as of 2026-05-26 and works inside Next.js 16 middleware + React Server Components.

**Acceptance Criteria**:
- [x] Read [supabase.com/docs/guides/auth/server-side/nextjs](https://supabase.com/docs/guides/auth/server-side/nextjs) and capture the package version recommended. → **`@supabase/ssr` v0.10.3** (published ~mid-May 2026). `@supabase/auth-helpers-nextjs` deprecated; all fixes flow to `@supabase/ssr`. Package marked beta — accepted risk.
- [x] Confirm the docs show middleware-side `createServerClient` + `auth.getUser()` reading `email_confirmed_at`. → **Docs now recommend `auth.getClaims()` for general page protection** (faster, local JWT decode). **However**, JWT does NOT carry `email_confirmed_at` (only `iss`, `exp`, `sub`, `role`, `email`, `phone`). The unverified gate per AC-AUTH-3a REQUIRES the authoritative `email_confirmed_at`, available only via `getUser()`. **Plan retains `getUser()` for Task 5.2.** Do not "optimise" to `getClaims()` — silently breaks the gate.
- [x] Spike a minimal `src/middleware.ts` in a throwaway branch if docs are ambiguous; verify session reads. → **Spike not required.** Docs are unambiguous on package + function choice. Cookie-handler shape confirmed as `getAll`/`setAll`.
- [x] Outcome recorded in plan's Decisions Log as `DEV-AUTH-1` resolved (or note fallback to `@supabase/auth-helpers-nextjs`). → **Three entries added to Decisions Log:** (a) ssr v0.10.3 confirmed; (b) `getUser()` retained over `getClaims()` with rationale; (c) Next.js 16 renamed `middleware.ts` → `proxy.ts` (entry-file rename — see Task 5.2 update).

**Effort**: S
**Dependencies**: None
**Assignee**: Developer

### Task 1.2: Validate Postgres trigger atomicity for org auto-creation [P] ✅ DONE 2026-05-26

**Description**: Confirm a `SECURITY DEFINER` trigger on `auth.users` insert can write to `public.organisations` + `public.org_members` in the same transaction.

**Acceptance Criteria**:
- [x] Read Supabase docs for the `handle_new_user` pattern. → **Canonical pattern confirmed** at [supabase.com/docs/guides/auth/managing-user-data](https://supabase.com/docs/guides/auth/managing-user-data): `AFTER INSERT ON auth.users` + `SECURITY DEFINER` + `set search_path = ''` (or explicit schema).
- [x] Confirm the trigger sees the inserted `auth.users` row and that failure rolls back the auth insert. → **Confirmed by Postgres semantics**: AFTER triggers run in the same transaction as the INSERT; an exception in the trigger function rolls back the entire transaction including `auth.users`. Supabase docs corroborate: "if the trigger fails, it could block signups". No orphaned-row risk — all three inserts (`auth.users`, `organisations`, `org_members`, `auth_audit_log`) commit or roll back together.
- [x] Outcome recorded as `DEV-AUTH-2` resolved (or note fallback to a service-role server-route). → **DEV-AUTH-2 RESOLVED** in plan Decisions Log. No fallback needed. Task 4.4 proceeds with plan §2.2.4 SQL as written.

**Effort**: S
**Dependencies**: None
**Assignee**: Developer

### Task 1.3: Validate Supabase HIBP breach-list toggle [P] ✅ DONE 2026-05-26

**Description**: Confirm whether Supabase Auth's HIBP breach-list check is exposed as a dashboard toggle on the v1 project, or whether we need to call the HIBP k-anonymity API server-side.

**Acceptance Criteria**:
- [x] Inspect the project's Auth → Settings → Password Strength after Task 3.1 completes (this task may run after 3.1). → **Toggle confirmed via docs research** at [supabase.com/docs/guides/auth/password-security](https://supabase.com/docs/guides/auth/password-security): dashboard path is **Authentication → Password Protection**. Available on **Pro Plan and above**; the provisioned `lsl-platform` project is Pro tier ($10/month) → eligible. Implementation is privacy-preserving (k-anonymity API used internally; HIBP only sees first 5 hex chars of hash). Final dashboard-click verification happens during Task 9.2 itself; no prerequisite spike needed.
- [x] Outcome recorded as `DEV-AUTH-3` resolved with the choice (toggle vs k-anon API fallback). → **DEV-AUTH-3 RESOLVED** in plan Decisions Log. Toggle path, not k-anon API fallback. Task 9.2 simplifies: flip toggle + verify with a known-breached test password.

**Effort**: S
**Dependencies**: Task 3.1
**Assignee**: Developer

---

## Phase 3: Foundation

### Task 3.1: Provision Supabase project via Supabase MCP ✅ DONE 2026-05-26

**Description**: Create the Supabase project for the LSL platform; capture URL + anon key + service-role key. Document in `website/CLAUDE.md`.

**Status:** ✅ **DONE** — `lsl-platform` provisioned, `ACTIVE_HEALTHY` confirmed (Postgres 17.6.1.127, region ap-southeast-2, Pro tier, project ref `woxtujkxatosbirikxtq`). Env-var placeholders scaffolded in `website/.env.example` (real values to be populated in `.env.local` locally and in Vercel via Task 3.3). Supabase config + MCP guidance documented in `website/AGENTS.md` (which `website/CLAUDE.md` imports via `@AGENTS.md`).

**Acceptance Criteria**:
- [x] Supabase MCP authenticated via OAuth (completed 2026-05-26 by Tracy).
- [x] Supabase project created in correct organisation/region (ap-southeast-2, Sydney — confirmed).
- [x] Project status reaches `ACTIVE_HEALTHY` (check via `mcp__2ac7599f...__get_project` or dashboard). → **Confirmed ACTIVE_HEALTHY** via `get_project` MCP call on 2026-05-26; Postgres 17.6.1.127 GA.
- [x] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` recorded in `website/.env.example` (placeholders only — no real values). → **File created at `website/.env.example` with placeholders; `.env*` already gitignored via `website/.gitignore:39-40`.**
- [x] Project URL and key locations documented in `website/CLAUDE.md`. → **Documented in `website/AGENTS.md` (imported by `website/CLAUDE.md` via `@AGENTS.md`).** Includes project URL/ref/region/plan, env-var purpose, MCP usage, hard rules on service-role key handling.
- [x] No real secrets committed to git. → **Verified.** `.env.example` contains placeholders only.

**Effort**: S
**Dependencies**: None
**Assignee**: Developer (uses Supabase MCP)

### Task 3.2: Install `@supabase/ssr` and `@supabase/supabase-js` ✅ DONE 2026-05-26

**Description**: Add the two Supabase packages to `website/package.json` and lock against the version validated in Task 1.1.

**Acceptance Criteria**:
- [x] `@supabase/ssr` and `@supabase/supabase-js` appear in `dependencies`. → **`@supabase/ssr@^0.10.3` and `@supabase/supabase-js@^2.106.2`** added to `website/package.json`. 17 packages added, 39 changed; `package-lock.json` updated.
- [x] `npm install` succeeds against Next.js 16.2.6 / React 19.2.4. → **Passed**, 5 s, no errors. `npm audit` reports 2 moderate vulns (pre-existing in the website's dep tree, not introduced by the Supabase packages) — captured as a non-blocking follow-up.
- [x] `npm run build` succeeds on a clean checkout. → **Passed**. Next.js 16.2.6 + Turbopack, compile 2.0 s, TypeScript clean, all 10 routes (`/`, `/calculator/bulk`, `/calculator/single`, `/privacy`, `/_not-found`, `/api/export-pdf`, `/api/extract-pdf`, `/api/normalize-csv`) generated. No new public routes — the `/app/*` surface lands in Phase 5.

**Effort**: S
**Dependencies**: Task 1.1, Task 3.1
**Assignee**: Developer

### Task 3.3: Wire Supabase env vars to Vercel (Production + Preview) [P]

**Description**: DevOps adds the three Supabase env vars to Vercel for both Production and Preview environments. Record the change in `website/CLAUDE.md` per global-engineering rules.

**Acceptance Criteria**:
- [ ] All three vars set in Vercel Production.
- [ ] All three vars set in Vercel Preview.
- [ ] No keys committed to git.
- [ ] Change documented in `website/CLAUDE.md` env section.

**Effort**: S
**Dependencies**: Task 3.1
**Assignee**: DevOps

### Task 3.4: Confirm APA brand tokens are available for `/app/*`

**Description**: Verify `docs/brand/style-guide.md` has APA palette, typography, and component tokens (header, card, button, input, error). If missing, dispatch `designer-design-system` and block all UI tasks until tokens land. Auth logic tasks (4.x, 5.1, 5.2) may proceed in parallel.

**Acceptance Criteria**:
- [ ] Style guide reviewed and APA tokens confirmed present, OR Designer agent invoked and an ETA recorded.
- [ ] Decision logged in plan's Decisions Log.
- [ ] If tokens missing: UI tasks 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 7.1, 7.2 are marked blocked until tokens land.

**Effort**: S–M
**Dependencies**: None
**Assignee**: Developer (coordinates with Designer agent)

---

## Phase 4: Schema, RLS, signup trigger

### Task 4.1: Migration — `organisations` table + RLS

**Description**: Create `public.organisations` per plan §2.2 with `id`, `name`, `created_at`, `updated_at`, `deleted_at`, `delete_scheduled_at`. Add `tg_set_updated_at()` helper and trigger. Enable RLS with the two read/update policies from plan §2.2.

**Acceptance Criteria**:
- [ ] Migration file in `website/supabase/migrations/` follows Supabase naming convention.
- [ ] Table created with all six columns and constraints from plan §2.2.1.
- [ ] `tg_set_updated_at()` helper exists and trigger keeps `updated_at` current on row change.
- [ ] RLS enabled.
- [ ] Policies "members read own org" (SELECT) and "admin update own org" (UPDATE) installed.
- [ ] No client-side INSERT or DELETE policy exists.

**Effort**: S
**Dependencies**: Task 3.1
**Assignee**: Developer (uses Supabase MCP)

### Task 4.2: Migration — `org_members` table + RLS [P]

**Description**: Create `public.org_members` per plan §2.2.2 with UNIQUE constraint on `user_id` (enforces one-org-per-user per spec OQ-4 / AC-AUTH-14). Enable RLS with the "members read own membership" policy.

**Acceptance Criteria**:
- [ ] Table created with all seven columns and constraints from plan §2.2.2.
- [ ] `UNIQUE(user_id)` constraint present.
- [ ] FK to `auth.users(id) ON DELETE CASCADE` present.
- [ ] FK to `public.organisations(id) ON DELETE CASCADE` present.
- [ ] CHECK constraint on `role` allows only `('admin','payroll_user','read_only')`.
- [ ] RLS enabled.
- [ ] SELECT policy "members read own membership" installed.
- [ ] No client-side INSERT/UPDATE/DELETE policy.

**Effort**: S
**Dependencies**: Task 4.1
**Assignee**: Developer

### Task 4.3: Migration — `auth_audit_log` table [P]

**Description**: Create `public.auth_audit_log` per plan §2.2.3 with no public RLS policies (service-role-only).

**Acceptance Criteria**:
- [ ] Table created with all seven columns from plan §2.2.3.
- [ ] FK to `auth.users(id) ON DELETE SET NULL` (audit row survives user delete).
- [ ] RLS enabled with no policies for `anon` or `authenticated` (only service-role can read/write).

**Effort**: S
**Dependencies**: Task 4.1
**Assignee**: Developer

### Task 4.4: Migration — `handle_new_user` trigger

**Description**: Create the `SECURITY DEFINER` function `public.handle_new_user()` and the `on_auth_user_created` trigger on `auth.users` insert per plan §2.2.4. Function inserts default-named org, admin membership, and audit-log row atomically. Validates AC-AUTH-1 and AC-AUTH-14 at the database layer.

**Acceptance Criteria**:
- [ ] Function created with `SECURITY DEFINER` and `set search_path = public`.
- [ ] Default org name derived as `split_part(email,'@',1) || '''s Organisation'`.
- [ ] Audit-log row inserted with `event_type = 'signup'` and `metadata.org_id` set.
- [ ] Trigger `on_auth_user_created` fires `AFTER INSERT ON auth.users`.
- [ ] Behaviour confirmed by SQL test: insert a fake `auth.users` row, see 1 org + 1 member + 1 audit row.
- [ ] Migrations are forward-only (no rollback DDL written). If 4.4 fails in production after 4.1–4.3 succeeded, the partial state (3 tables, no trigger) is a valid pre-Phase-5 state — Phase 5 cannot start until the trigger lands.

**Effort**: M
**Dependencies**: Task 4.1, Task 4.2, Task 4.3, Task 1.2
**Assignee**: Developer

### Task 4.5: Integration test — signup trigger atomicity

**Description**: Vitest integration test against a local `supabase start` instance. Asserts that creating an `auth.users` row produces exactly one `organisations` row, one `org_members` row with `role='admin'`, and one `auth_audit_log` row with `event_type='signup'`. Also asserts the org_members count tracks org count after multiple signups.

**Validates**: AC-AUTH-1

**Acceptance Criteria**:
- [ ] Test file in `website/src/__tests__/auth/` or equivalent.
- [ ] Test passes against ephemeral local Supabase.
- [ ] Test confirms invariant: `count(organisations) == count(org_members where role='admin')` after each signup.
- [ ] Test runs in CI on every PR.

**Effort**: M
**Dependencies**: Task 4.4
**Assignee**: Developer

### Task 4.6: Integration test — cross-tenant RLS denial

**Description**: Vitest integration test. Creates two users in two orgs; asserts each can only read their own `organisations` and `org_members` rows; asserts every cross-tenant query returns zero rows.

**Validates**: AC-AUTH-13

**Acceptance Criteria**:
- [ ] Test creates user-A in org-A and user-B in org-B via signup flow.
- [ ] As user-A, `select * from organisations` returns exactly org-A.
- [ ] As user-A, `select * from organisations where id = '<org-B id>'` returns zero rows.
- [ ] Same assertions for `org_members`.
- [ ] Test runs in CI on every PR. **Failure blocks merge.**

**Effort**: M
**Dependencies**: Task 4.4
**Assignee**: Developer

### Task 4.7: Integration test — one-org-per-user UNIQUE [P]

**Description**: Vitest integration test that attempts to insert a second `org_members` row for the same `user_id` and asserts a unique-constraint violation is raised.

**Validates**: AC-AUTH-14

**Acceptance Criteria**:
- [ ] Test attempts second insert via service-role (bypassing RLS).
- [ ] PostgreSQL error code `23505` (unique_violation) is raised.
- [ ] Test runs in CI on every PR.

**Effort**: S
**Dependencies**: Task 4.2
**Assignee**: Developer

---

## Phase 5: Core auth UX + middleware

### Task 5.1: Supabase SSR helpers

**Description**: Create `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, and `src/lib/supabase/middleware.ts` per the `@supabase/ssr` standard pattern.

**Acceptance Criteria**:
- [ ] Three files exist with the canonical helpers (`createBrowserClient`, `createServerClient`, middleware updater).
- [ ] No env-var literals in code — all reads go through `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Unit test confirms each helper returns a Supabase client instance.

**Effort**: S
**Dependencies**: Task 3.2
**Assignee**: Developer

### Task 5.2: Proxy — unverified-session gate (Next.js 16 `proxy.ts`)

**Description**: Create `src/proxy.ts` enforcing plan §2.3 contract. Exported function is `proxy` (Next.js 16 renamed `middleware` → `proxy`; runtime is Node.js). Matches on `/app/*`. Three allow-listed routes for unverified users: `/app/verify-email`, `/app/account`, `/app/logout`. All other `/app/*` redirects unverified to `/app/verify-email`. Unauthenticated users redirect to `/app/login` (except public auth routes).

**Validates**: AC-AUTH-3a, AC-AUTH-4 (unverified redirect on login)

**Acceptance Criteria**:
- [ ] File is `src/proxy.ts` (NOT `src/middleware.ts` — the legacy name still works in Next.js 16 but is deprecated and Edge-only; new builds use `proxy.ts` on Node.js runtime). Exported function name is `proxy`.
- [ ] Proxy uses the literal config `export const config = { matcher: ['/app/:path*'] }` — public calc routes (`/`, `/api/*`, `/privacy`, `/blog/*`, etc.) are NOT matched. **Without this explicit matcher, Next.js applies the proxy to every route and the public calc would break.**
- [ ] Reads session via `supabase.auth.getUser()` server-side, **wrapped in try/catch**. On thrown error (Supabase Auth outage), redirect to `/app/login?error=service_unavailable` with a UI banner; never return a 500. **Do NOT substitute `getClaims()` — the JWT does not carry `email_confirmed_at`, and the unverified gate needs it.** (See plan Decisions Log entry from Task 1.1.)
- [ ] If no session: redirects all non-public-auth routes to `/app/login`.
- [ ] If session + `email_confirmed_at IS NULL`: redirects to `/app/verify-email` except the three allow-listed routes.
- [ ] If session + verified: passes through.
- [ ] Allow-list is the literal three routes from spec §7.5 — no wildcards or computed paths.

**Effort**: M
**Dependencies**: Task 5.1
**Assignee**: Developer

### Task 5.3: `/app/signup` page + server action

**Description**: Build signup page at `src/app/app/signup/page.tsx` with form (email, password, confirm-password). Server action validates ≥12-char password, calls `supabase.auth.signUp`, handles duplicate-email branch (sends alert email to existing account, returns success-style UI), redirects to `/app/verify-email`. Required state matrix from spec §7.2 implemented.

**Validates**: AC-AUTH-1, AC-AUTH-2

**Acceptance Criteria**:
- [ ] Page rendered at `/app/signup`.
- [ ] Server action calls `email = email.trim()` before passing to Supabase Auth. **Supabase lowercases emails but does NOT trim whitespace** — without this, `" user@example.com "` and `"user@example.com"` would resolve to different accounts.
- [ ] Password field enforces min length 12 client-side; server action re-validates.
- [ ] Duplicate-email branch returns identical UI response to a fresh signup; an alert email is sent to the existing account via `supabase.auth.admin.sendEmail()` from the server action (service-role key required). **Supabase Auth's built-in duplicate-signup flow does NOT send this email automatically — we must send it ourselves.**
- [ ] On success: session cookies set, redirect to `/app/verify-email`.
- [ ] All seven required states from spec §7.2 implemented and unit-tested.
- [ ] APA branding applied per AC-AUTH-15.

**Effort**: M
**Dependencies**: Task 5.1, Task 4.4, Task 3.4
**Assignee**: Developer

### Task 5.4: `/app/login` page + server action

**Description**: Build login page at `src/app/app/login/page.tsx`. Server action calls `supabase.auth.signInWithPassword`. Sets session cookies via SSR helper. Generic error message ("Email or password incorrect") for any auth failure. **No "Remember me" checkbox** (per OQ-AUTH-3). Unverified user post-login → middleware redirects to `/app/verify-email`.

**Validates**: AC-AUTH-4, AC-AUTH-5

**Acceptance Criteria**:
- [ ] Page rendered at `/app/login` with email + password fields only.
- [ ] Server action calls `email = email.trim()` before passing to Supabase Auth.
- [ ] No "Remember me" UI element exists in the form.
- [ ] On valid creds (verified user): redirect to `/app/`.
- [ ] On valid creds (unverified user): middleware redirects to `/app/verify-email`.
- [ ] On invalid creds: identical error wording for unknown-email vs wrong-password.
- [ ] Response time difference between unknown-email and wrong-password not measurable in test.
- [ ] Test case: signup with `ALICE@example.com` (mixed case); login with `alice@example.com` succeeds against the same account — Supabase Auth normalises emails to lowercase, but we verify the round-trip.
- [ ] APA branding applied.

**Effort**: M
**Dependencies**: Task 5.1, Task 3.4
**Assignee**: Developer

### Task 5.5: `/app/logout` POST route [P]

**Description**: Create `src/app/app/logout/route.ts` that revokes the session + clears cookies + redirects to `/app/login`. GET returns 405.

**Validates**: AC-AUTH-7

**Acceptance Criteria**:
- [ ] POST clears access and refresh tokens server-side via `supabase.auth.signOut()`.
- [ ] Cookies cleared on response.
- [ ] Response is a 302 redirect to `/app/login`.
- [ ] GET returns HTTP 405 with `Allow: POST` header.
- [ ] An audit-log row `event_type='logout'` is written.

**Effort**: S
**Dependencies**: Task 5.1
**Assignee**: Developer

### Task 5.6: `/app/` placeholder page [P]

**Description**: Build placeholder home page at `src/app/app/page.tsx`. Renders "Welcome — platform under construction" with APA branding. Satisfies post-login redirect target per OQ-AUTH-7.

**Acceptance Criteria**:
- [ ] Page renders at `/app/` when user is authenticated and verified.
- [ ] Renders the literal text "Welcome — platform under construction" (or designer-approved variant).
- [ ] APA logo + footer rendered.
- [ ] No data fetch — page is purely static.

**Effort**: S
**Dependencies**: Task 3.4
**Assignee**: Developer

### Task 5.7: Integration test — middleware gating

**Description**: Vitest integration tests against middleware. Three scenarios: (a) anonymous request to `/app/foo` redirects to `/app/login`; (b) unverified session request to `/app/foo` redirects to `/app/verify-email`; (c) verified session passes through to `/app/foo`. Also asserts the three allow-listed unverified routes are reachable.

**Validates**: AC-AUTH-3a

**Acceptance Criteria**:
- [ ] Test (a): anonymous → `/app/login` redirect (302).
- [ ] Test (b): unverified → `/app/verify-email` redirect for `/app/`, `/app/employees` (any future path).
- [ ] Test (b): unverified → 200 OK for `/app/verify-email`, `/app/account`, `/app/logout`.
- [ ] Test (c): verified → 200 OK for any `/app/*`.
- [ ] Tests run in CI on every PR.

**Effort**: M
**Dependencies**: Task 5.2
**Assignee**: Developer

### Task 5.8: E2E golden path 1 — signup → verify → home

**Description**: Playwright e2e test. New email signs up → lands on `/app/verify-email` → backend test-helper marks email confirmed (simulating link click) → next page load lands on `/app/`.

**Validates**: AC-AUTH-1, AC-AUTH-3, AC-AUTH-4

**Acceptance Criteria**:
- [ ] Playwright test in `website/e2e/auth-signup-verify.spec.ts`.
- [ ] Test runs against a local Supabase + Next.js dev server.
- [ ] All assertions pass in CI.

**Effort**: M
**Dependencies**: Task 5.3, Task 5.4, Task 5.5, Task 5.6, Task 5.2
**Assignee**: Developer

---

## Phase 6: Verification flow + password reset

### Task 6.1: `/app/verify-email` page + resend action

**Description**: Build verify-email page at `src/app/app/verify-email/page.tsx`. Shows "We sent a link to `<email>`". Primary CTA "Resend verification email" rate-limited 1/60s + 5/24h per user. Secondary "Log out" link. Reachable to unverified users only (via middleware allow-list).

**Validates**: AC-AUTH-3a (resend behaviour)

**Acceptance Criteria**:
- [ ] Page renders to unverified users.
- [ ] Resend button calls Supabase Auth resend endpoint.
- [ ] Server enforces 1-per-60s and 5-per-24h rate limits per `user_id`; rate-limit hit returns "You can request another verification email in N seconds/hours" message.
- [ ] Logout link works.
- [ ] APA branding applied.

**Effort**: M
**Dependencies**: Task 5.1, Task 5.2
**Assignee**: Developer

### Task 6.2: `/app/forgot-password` page + server action [P]

**Description**: Build forgot-password page. Server action calls `supabase.auth.resetPasswordForEmail`. **Always** returns "If that email is registered, we sent a link" — no enumeration.

**Validates**: AC-AUTH-8

**Acceptance Criteria**:
- [ ] Page rendered at `/app/forgot-password`.
- [ ] Response is identical for registered and unregistered emails.
- [ ] Supabase Auth reset email is sent only if the email is registered.
- [ ] APA branding applied.
- [ ] Audit-log row `event_type='password_reset_request'` written (with `user_id=NULL` when email unknown).

**Effort**: M
**Dependencies**: Task 5.1
**Assignee**: Developer

### Task 6.3: `/app/reset-password` page + server action [P]

**Description**: Build reset-password page. Page reads Supabase Auth reset token from URL. Server action sets new password (≥12 chars, breach-list-checked), invalidates all other sessions for the user, redirects to `/app/login`.

**Validates**: AC-AUTH-9, AC-AUTH-10

**Acceptance Criteria**:
- [ ] Page rendered at `/app/reset-password`.
- [ ] Token validation rejects expired (>60min) and used tokens with a clear error + link to restart flow.
- [ ] On success: password updated; `supabase.auth.signOut({ scope: 'others' })` called or equivalent session-invalidate API.
- [ ] User redirected to `/app/login`.
- [ ] Audit-log row `event_type='password_reset_complete'` written.
- [ ] APA branding applied.

**Effort**: M
**Dependencies**: Task 5.1
**Assignee**: Developer

### Task 6.4: Customise Supabase Auth email templates with APA branding

**Description**: Via the Supabase dashboard template editor, replace the default verification, password-reset, and (if exposed) duplicate-signup-alert templates with APA-branded versions. Expiry notes included ("link expires in 24 hours" / "60 minutes"). Subject lines per spec §10.

**Validates**: AC-AUTH-15 (email side)

**Acceptance Criteria**:
- [ ] Verification email template carries APA logo, palette, "Verify your email" CTA, "expires in 24 hours" note.
- [ ] Password-reset template carries APA branding, "Reset your password" CTA, "expires in 60 minutes" note, "if you didn't request this, ignore" security note.
- [ ] Duplicate-signup alert template (custom-sent via server) is APA-branded with neutral tone per spec §10.
- [ ] **v1 sender domain is Supabase-owned** (e.g. `noreply@mail.app.supabase.io`) — the `noreply@lslcalculator.com.au` sender in spec §10 is only achievable in v1.1 with custom SMTP via Resend. This is a known spec/reality gap; flag in `website/supabase/README.md` and in the PM standup so the discrepancy is recorded against the spec text.
- [ ] Reply-to = `support@austpayroll.com.au` (settable on every template regardless of channel).
- [ ] Designer agent signs off on visual fidelity.

**Effort**: S–M
**Dependencies**: Task 3.4, Task 3.1
**Assignee**: Developer (executes), Designer (signs off)

### Task 6.5: Integration test — reset token expiry + reuse [P]

**Description**: Vitest integration tests. (a) reset token used after 60 minutes is rejected; (b) reset token used twice is rejected on the second use.

**Validates**: AC-AUTH-10

**Acceptance Criteria**:
- [ ] Test (a) advances time / mocks clock past 60 min and asserts rejection.
- [ ] Test (b) successfully redeems token, then asserts second redemption is rejected.
- [ ] UI error message tested for clarity ("link expired" / "link already used").

**Effort**: S
**Dependencies**: Task 6.3
**Assignee**: Developer

### Task 6.6: Integration test — verification resend rate limit [P]

**Description**: Vitest integration test. Sends two resend requests within 60s; asserts the second is rate-limited. Sends six within 24h; asserts the sixth is rate-limited.

**Validates**: AC-AUTH-3a (rate limit)

**Acceptance Criteria**:
- [ ] 2nd request within 60s returns rate-limit message.
- [ ] 6th request within 24h returns rate-limit message.
- [ ] No silent failure — UI message always surfaces.

**Effort**: S
**Dependencies**: Task 6.1
**Assignee**: Developer

---

## Phase 7: Account page + deletion grace + scheduled job

### Task 7.1: `/app/account` page — verified subset

**Description**: Build `/app/account` for verified users. Shows email (read-only), change-password form (current + new + confirm), delete-account button.

**Validates**: AC-AUTH-11 (verified branch)

**Acceptance Criteria**:
- [ ] Page renders at `/app/account` for verified users.
- [ ] Email displayed as read-only.
- [ ] Change-password form with three fields (current, new, confirm).
- [ ] Delete-account button visible with confirmation modal.
- [ ] APA branding applied.

**Effort**: M
**Dependencies**: Task 5.1
**Assignee**: Developer

### Task 7.2: `/app/account` page — unverified subset

**Description**: Same route, but for unverified users (allowed by middleware allow-list). Shows email + unverified badge, resend-verification button, delete-account button, logout button. **Password change blocked** with message "Please verify your email before changing your password" per spec §7.5.

**Validates**: AC-AUTH-3a (account subset), AC-AUTH-11 (unverified branch)

**Acceptance Criteria**:
- [ ] Page conditionally renders the unverified subset when `email_confirmed_at IS NULL`.
- [ ] Unverified badge visible.
- [ ] Password-change UI hidden or disabled with the blocked message.
- [ ] Resend-verification button works (reuses 6.1 endpoint).
- [ ] Delete-account button visible.
- [ ] Logout button visible.

**Effort**: M
**Dependencies**: Task 5.1, Task 6.1
**Assignee**: Developer

### Task 7.3: Change-password server action

**Description**: Server action for `/app/account`. Validates current password matches; updates to new password (≥12 chars, breach-list-checked); invalidates all OTHER sessions for the user; keeps current session active.

**Validates**: AC-AUTH-11

**Acceptance Criteria**:
- [ ] Current password verified via Supabase Auth re-authentication.
- [ ] Password policy enforced server-side (≥12 chars, HIBP if available).
- [ ] On success: other sessions invalidated; current session active.
- [ ] Audit-log row `event_type='password_change'` written.
- [ ] Blocked for unverified users — returns the spec §7.5 message.

**Effort**: M
**Dependencies**: Task 7.1, Task 7.2
**Assignee**: Developer

### Task 7.4: Delete-account server action

**Description**: Sets `organisations.delete_scheduled_at = now()` and `deleted_at = now() + interval '7 days'` for the user's org. Logs the user out. Writes audit-log row `event_type='account_delete_request'`. Returns confirmation page explaining the 7-day grace.

**Validates**: AC-AUTH-12 (request side)

**Acceptance Criteria**:
- [ ] Action available for both verified and unverified users.
- [ ] Both timestamp columns set correctly on the user's org.
- [ ] User session is destroyed (signOut) before redirect.
- [ ] Audit-log row written.
- [ ] Confirmation message clearly states the 7-day grace and how to cancel.

**Effort**: M
**Dependencies**: Task 4.1
**Assignee**: Developer

### Task 7.5: Cancel-deletion on login

**Description**: On successful login (Task 5.4), check the user's org row; if `delete_scheduled_at IS NOT NULL`, clear both `delete_scheduled_at` and `deleted_at`; write audit-log row `event_type='account_delete_cancelled'`; flash a UI message "Your account deletion has been cancelled."

**Validates**: AC-AUTH-12 (cancel branch)

**Acceptance Criteria**:
- [ ] Login path includes the org-state check.
- [ ] The cancel-deletion UPDATE is wrapped in a transaction that **`SELECT … FOR UPDATE`**s the org row first — defends against the boundary race where login and the nightly purge cron fire within the same second.
- [ ] Both timestamp columns cleared atomically (single UPDATE inside the locked transaction).
- [ ] Audit-log row written.
- [ ] UI shows a non-intrusive flash message confirming cancellation.

**Effort**: M
**Dependencies**: Task 5.4, Task 7.4
**Assignee**: Developer

### Task 7.6: Supabase Edge Function — `purge-expired-orgs` daily job

**Description**: Build Edge Function that runs nightly via `pg_cron`. Hard-deletes `auth.users` rows for any user whose only org has `deleted_at <= now()`. FK cascades remove the `organisations` and `org_members` rows. Audit-log rows persist with `user_id` set to NULL after cascade (FK is `ON DELETE SET NULL`).

**Validates**: AC-AUTH-12 (finalisation)

**Acceptance Criteria**:
- [ ] Edge Function deployed in `website/supabase/functions/purge-expired-orgs/`.
- [ ] Function uses service-role key from env.
- [ ] `pg_cron` schedule registered (suggested: `0 3 * * *` UTC).
- [ ] Function selects rows where `deleted_at <= now()` using **`SELECT … FOR UPDATE`** inside a single transaction — defends against the boundary race where a user logs in to cancel deletion at the same moment as cron fires.
- [ ] Function audit-logs `event_type='account_delete_finalised'` for each deletion BEFORE deleting the user (so user_id is present).
- [ ] FK ON DELETE CASCADE removes `organisations` and `org_members`.
- [ ] Function logs success/failure to Supabase logs.

**Effort**: L
**Dependencies**: Task 7.4
**Assignee**: Developer

### Task 7.7: Integration test — deletion grace lifecycle

**Description**: Vitest integration test. Full path: signup → schedule delete → log back in within window → confirm cancellation; second scenario: schedule delete → fast-forward time past 7 days → run purge job → confirm hard-delete.

**Validates**: AC-AUTH-12

**Acceptance Criteria**:
- [ ] Scenario A: log back in cancels deletion; org row's two timestamp columns are cleared.
- [ ] Scenario B: purge job hard-deletes user, org, members; audit-log preserved with `user_id` set to NULL.
- [ ] Test invokes the Edge Function **directly** (via HTTP or Supabase Functions CLI) — does NOT test the `pg_cron` scheduler itself. The scheduler is trusted infrastructure.
- [ ] Tests run in CI on every PR.

**Effort**: M
**Dependencies**: Task 7.4, Task 7.5, Task 7.6
**Assignee**: Developer

---

## Phase 8: Brand, privacy notice, polish

### Task 8.1: Designer review — all `/app/*` pages

**Description**: Designer agent walks every auth page in browser (signup, login, forgot-password, reset-password, verify-email, account, home placeholder) plus all three email templates. Flags any deviations from APA brand tokens.

**Validates**: AC-AUTH-15

**Acceptance Criteria**:
- [ ] Designer report logged in `docs/design/` with screenshots + diff against `docs/brand/style-guide.md`.
- [ ] Any P0/P1 brand issues fixed before merge.
- [ ] Designer sign-off recorded in the PR.

**Effort**: M
**Dependencies**: Tasks 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2
**Assignee**: Designer

### Task 8.2: Privacy notice update [P]

**Description**: Writer + Web Publisher revise the privacy notice to cover platform-tier auth data: email stored, password bcrypt-hashed via Supabase Auth, session cookies (HttpOnly/Secure/SameSite=Lax), IP + user-agent logged in `auth_audit_log`, 7-day grace on account deletion, no data sharing beyond Supabase. Note Resend as v1.1 vendor pending migration.

**Validates**: AC-AUTH-16

**Acceptance Criteria**:
- [ ] Privacy notice text updated in `website/src/app/privacy/` (or equivalent).
- [ ] All seven content points from AC-AUTH-16 covered.
- [ ] Effective date updated.
- [ ] Web Publisher commits the change.

**Effort**: M
**Dependencies**: None (parallel with Phase 7 dev work)
**Assignee**: Writer (drafts), Web Publisher (publishes)

### Task 8.3: Error-message audit against spec §7.2 state matrix [P]

**Description**: For every form across `/app/signup`, `/app/login`, `/app/forgot-password`, `/app/reset-password`, `/app/account`, verify the seven states (Empty, Submitting, Success, Field-error, Invalid-creds, Rate-limited, 5xx, Network) all render correctly and consistently.

**Acceptance Criteria**:
- [ ] Manual walkthrough recorded in `docs/qa/`.
- [ ] Any inconsistency fixed before merge.
- [ ] No internal error detail leaked in any 5xx state.

**Effort**: S
**Dependencies**: Tasks 5.3, 5.4, 6.2, 6.3, 7.1, 7.2
**Assignee**: QA

### Task 8.4: Add HSTS header in `next.config.ts` [P]

**Description**: Add `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` to all responses via Next.js headers config.

**Acceptance Criteria**:
- [ ] HSTS header set globally in `next.config.ts`.
- [ ] Verified in production via curl after deploy.
- [ ] Documented in `website/CLAUDE.md` security section.

**Effort**: S
**Dependencies**: None
**Assignee**: DevOps

---

## Phase 9: Security review, rate limits, QA sign-off

### Task 9.1: Configure Supabase Auth rate limits

**Description**: In the Supabase dashboard, configure rate limits: 5 failed logins per 15 min per (email, IP) → 15-min lockout; 100 requests/hour/IP across login + signup + forgot-password combined. Document settings in `website/supabase/README.md`.

**Validates**: AC-AUTH-6

**Acceptance Criteria**:
- [ ] Rate-limit values set in Supabase dashboard.
- [ ] Settings documented in `website/supabase/README.md`.
- [ ] Manual test confirms lockout after 5 failures.

**Effort**: S
**Dependencies**: Task 3.1
**Assignee**: Developer

### Task 9.2: Enable HIBP breach-list check (or fallback) [P]

**Description**: Per Task 1.3 outcome — either flip the Supabase toggle, or implement HIBP k-anonymity API call in `/app/signup` and `/app/reset-password` server actions.

**Acceptance Criteria**:
- [ ] Toggle enabled OR fallback implemented.
- [ ] Known-breached passwords (test: `Password12345!`) are rejected with a clear message.
- [ ] Unit test added if fallback path was taken.

**Effort**: S (toggle) / M (fallback)
**Dependencies**: Task 1.3, Task 3.1
**Assignee**: Developer

### Task 9.3: CSRF defence — Origin/Referer header check in proxy

**Description**: Add Origin and Referer header validation in `src/proxy.ts` (the Next.js 16 entry file, see Task 5.2) for all POST requests to `/app/*`. Reject if neither header is present or if neither matches the expected origin. Document decision in plan's Decisions Log.

**Acceptance Criteria**:
- [ ] Proxy rejects POST `/app/*` requests missing both Origin and Referer headers with 403.
- [ ] Proxy rejects POST `/app/*` requests where Origin/Referer doesn't match expected host with 403.
- [ ] Same-origin POSTs pass through.
- [ ] Decision logged in plan's Decisions Log.

**Effort**: M
**Dependencies**: Task 5.2
**Assignee**: Developer

### Task 9.4: E2E golden path 2 — brute-force lockout

**Description**: Playwright e2e test. Five wrong-password attempts trigger lockout; UI shows "Too many attempts. Try again in N minutes." After 15-min window (mocked clock or test-helper), correct password succeeds.

**Validates**: AC-AUTH-6

**Acceptance Criteria**:
- [ ] Playwright test in `website/e2e/auth-bruteforce-lockout.spec.ts`.
- [ ] Asserts lockout UI message after 5th failure.
- [ ] Asserts post-lockout success after window elapses.

**Effort**: M
**Dependencies**: Task 5.4, Task 9.1
**Assignee**: Developer

### Task 9.5: OWASP ASVS V2 + V3 walkthrough

**Description**: Walk every applicable ASVS V2 (Authentication) and V3 (Session Management) requirement against the implementation. Log findings in `docs/qa/auth-asvs-review.md`. Fix any P0/P1 before merge.

**Acceptance Criteria**:
- [ ] Review document created with one row per applicable ASVS requirement and pass/fail/N/A.
- [ ] No P0 or P1 findings open at merge time.

**Effort**: M
**Dependencies**: All Phase 5–8 tasks
**Assignee**: QA + Developer

### Task 9.6: QA full regression — every AC validated

**Description**: QA agent walks every AC-AUTH-1 through AC-AUTH-17 from spec §12. Produces `docs/qa/auth-qa-report.md` with pass/fail status per AC. Any fail blocks merge.

**Validates**: AC-AUTH-1 through AC-AUTH-17

**Acceptance Criteria**:
- [ ] Report exists in `docs/qa/auth-qa-report.md`.
- [ ] Every AC has a pass/fail entry with the verification evidence (test name, screenshot, or manual-test record).
- [ ] All AC entries pass.

**Effort**: L
**Dependencies**: All Phase 5–8 tasks
**Assignee**: QA

### Task 9.7: DevOps pre-merge security review of env-vars + Supabase prod config

**Description**: DevOps confirms (a) no secrets in repo; (b) all Supabase env vars set in Vercel; (c) Supabase Auth rate-limit values applied to the production project; (d) `auth_audit_log` is service-role-only in production.

**Acceptance Criteria**:
- [ ] DevOps sign-off recorded in the PR.
- [ ] `git log -p -- '*.env*'` shows no committed secrets.
- [ ] Production Supabase project audited; settings match `website/supabase/README.md`.

**Effort**: M
**Dependencies**: Task 3.3, Task 9.1
**Assignee**: DevOps

### Task 9.8: Regression test — public calc unaffected by auth deploy [P]

**Description**: Playwright smoke test asserting the public LSL calculator at `/` continues to render correctly after auth ships. Guards against accidental middleware-matcher overreach (Task 5.2 B1 fix).

**Acceptance Criteria**:
- [ ] Smoke test: `GET /` returns 200 with the public-calc HTML (assert presence of the calculator root element).
- [ ] Same 200 assertion for `/privacy` and at least one `/api/*` route that does not require auth.
- [ ] Test runs in CI on every PR. **Failure blocks merge.**

**Effort**: S
**Dependencies**: Task 5.2
**Assignee**: Developer

---

## Summary

| Phase | Tasks | Total effort |
|---|---|---|
| 1. Research | 3 | S × 3 |
| 3. Foundation | 4 | M |
| 4. Schema + trigger | 7 | L |
| 5. Core UX + middleware | 8 | XL |
| 6. Verification + reset | 6 | L |
| 7. Account + deletion grace | 7 | XL |
| 8. Brand + privacy + polish | 4 | L |
| 9. Security + QA + sign-off | 8 | XL |
| **Total** | **47 tasks** | **~6–8 dev-weeks** |

**Critical path:** Task 1.1 → 3.1 → 3.2 → 4.1 → 4.2 → 4.4 → 4.5/4.6 → 5.1 → 5.2 → 5.3 → 5.4 → 5.8 → 6.x → 7.x → 9.5 → 9.6 → merge.

**Parallelisable paths:** Phase 3 tasks 3.3 + 3.4 with 3.1/3.2; Phase 4 tasks 4.2 + 4.3 + 4.7 after 4.1; Phase 6 tasks 6.2 + 6.3 + 6.5 in parallel; Phase 8 tasks 8.2, 8.3, 8.4 in parallel with Phase 7 dev work.

---

*End of tasks v1.0 (generated 2026-05-26).*
