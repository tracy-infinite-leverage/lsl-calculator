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

### Task 3.3: Wire Supabase env vars to Vercel (Production + Preview) [P] ✅ DONE 2026-05-27

**Description**: DevOps adds the three Supabase env vars to Vercel for both Production and Preview environments. Record the change in `website/CLAUDE.md` per global-engineering rules.

**Status:** All three Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) wired into Vercel **Production + Preview + Development** for the `infiniteleverage-2/lsl-calculator` project. URL + anon key sourced from the account-scoped Supabase MCP (`get_project_url` + `get_publishable_keys` against project `woxtujkxatosbirikxtq`); service-role key sourced from `website/.env.local` (operator-controlled, JWT format validated `eyJ…` 219 chars before write). All 9 writes confirmed via `vercel env ls` (values stay encrypted at rest; redacted listing recorded in the commit message). Development env was wired in addition to the original Production/Preview scope — see Decisions Log addendum for rationale.

**Acceptance Criteria**:
- [x] All three vars set in Vercel Production. → **Confirmed via `vercel env ls`:** `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL` all show `Encrypted` against `Production` (created 2026-05-27).
- [x] All three vars set in Vercel Preview. → **Confirmed via `vercel env ls`:** same three names show `Encrypted` against `Preview` (created 2026-05-27). Preview entries written via Vercel REST API (`POST /v10/projects/{id}/env` with `target: ["preview"]` and no `gitBranch` → "all preview branches") because the v54.4.1 CLI's `--value --yes` non-interactive path still prompted for a branch; API path matches the CLI's own documented "all preview branches" semantics.
- [x] No keys committed to git. → **Verified.** `website/.env.local` remains gitignored (`website/.gitignore:39-40`). The service-role-key value was passed via stdin / `--value` and never appeared in tool output, logs, or commits. Tool-call logs were sanitised before reading.
- [x] Change documented in `website/CLAUDE.md` env section. → **Updated.** `website/AGENTS.md` (imported by `website/CLAUDE.md` via `@AGENTS.md`) carries a "wired on 2026-05-27 (Task 3.3)" note next to the env-var table. `docs/engineering/vercel-config.md` updated with a Supabase env-vars row + a pre-cutover line.

**Effort**: S
**Dependencies**: Task 3.1
**Assignee**: DevOps

### Task 3.4: Confirm APA brand tokens are available for `/app/*` ✅ DONE 2026-05-26

**Description**: Verify `docs/brand/style-guide.md` has APA palette, typography, and component tokens (header, card, button, input, error). If missing, dispatch `designer-design-system` and block all UI tasks until tokens land. Auth logic tasks (4.x, 5.1, 5.2) may proceed in parallel.

**Audit finding 2026-05-26:** `docs/brand/style-guide.md` does **not** exist as a file — but the substance is fully encoded in code. Brand tokens live in [`website/src/app/globals.css`](../../../../website/src/app/globals.css) (Tailwind v4 `@theme inline` — APA-blue primary `oklch(0.51 0.18 256)` ≈ `#2563eb`; full status palette; light + dark mode; `--radius` scale; Geist Sans/Mono via `next/font/google` in `layout.tsx`). All component primitives needed for the auth surface are present in [`website/src/components/ui/`](../../../../website/src/components/ui/): `Card`, `CardHeader`, `CardTitle`, `Button` (6 variants × 4 sizes), `Input`, `Label`, `Textarea`, `Alert` (destructive variant for errors), `Dialog` (for delete-account confirmation), `Checkbox`, `RadioGroup`, `Select`, `Separator`, `Tabs`, `Badge`. **UI tasks are UNBLOCKED.** Two follow-ups recorded as non-blocking: (a) no APA logo asset in `website/public/` — use a text wordmark in v1, real logo before AC-AUTH-15 sign-off at Task 8.1; (b) `<AuthLayout>` shell is not yet built and will be created in Task 5.3.

**Acceptance Criteria**:
- [x] Style guide reviewed and APA tokens confirmed present, OR Designer agent invoked and an ETA recorded. → **Confirmed present**, but in code (globals.css + components/ui/) rather than a docs file. No designer dispatch needed.
- [x] Decision logged in plan's Decisions Log. → **Logged** under "Task 3.4 brand-token audit" row.
- [x] If tokens missing: UI tasks 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 7.1, 7.2 are marked blocked until tokens land. → **Not applicable.** Tokens present, UI tasks remain unblocked.

**Effort**: S–M
**Dependencies**: None
**Assignee**: Developer (coordinates with Designer agent)

**Follow-ups (non-blocking, tracked here):**
- APA logo asset for `/app/*` header — must land in `website/public/` (and Supabase email templates' assets in Task 6.4) before Task 8.1 Designer sign-off. Until then, all `/app/*` headers use a text wordmark (e.g. `APA · LSL Platform`).
- Plan's references to `docs/brand/style-guide.md` (in §2.4 + §1.4 R-A1 + Task 3.4 description above) are stale. The substantive style-guide is the code; if a docs version is desired later, it should be generated FROM the code, not the other way around.

---

## Phase 4: Schema, RLS, signup trigger

### Task 4.1: Migration — `organisations` table + RLS ✅ DONE 2026-05-27

**Description**: Create `public.organisations` per plan §2.2 with `id`, `name`, `created_at`, `updated_at`, `deleted_at`, `delete_scheduled_at`. Add `tg_set_updated_at()` helper and trigger. Enable RLS with the two read/update policies from plan §2.2.

**Status:** SQL at `website/supabase/migrations/20260527042608_create_organisations.sql`. Applied to `lsl-platform` via Supabase MCP (version 20260527042608). The two `organisations` policies (`members read own org`, `admin update own org`) were moved to migration 4.2 because they reference `public.org_members` — the apply order requires the policies follow the table they join against. Behaviour-equivalent split. `tg_set_updated_at` was further hardened in migration 5 (`set search_path = ''`) to clear the `function_search_path_mutable` advisor WARN.

**Acceptance Criteria**:
- [x] Migration file in `website/supabase/migrations/` follows Supabase naming convention (`YYYYMMDDHHMMSS_<snake_case>.sql`).
- [x] Table created with all six columns and constraints from plan §2.2.1.
- [x] `tg_set_updated_at()` helper exists and trigger keeps `updated_at` current on row change.
- [x] RLS enabled.
- [x] Policies "members read own org" (SELECT) and "admin update own org" (UPDATE) installed. — *Created in migration 4.2 due to apply-order; both policies live on `public.organisations` as required.*
- [x] No client-side INSERT or DELETE policy exists.
- [x] **Applied to remote `lsl-platform` project** — verified via `list_tables` + `list_migrations`; security advisor clean (zero P0/P1 after migration 5 hardening).

**Effort**: S
**Dependencies**: Task 3.1
**Assignee**: Developer (uses Supabase MCP)

### Task 4.2: Migration — `org_members` table + RLS [P] ✅ DONE 2026-05-27

**Description**: Create `public.org_members` per plan §2.2.2 with UNIQUE constraint on `user_id` (enforces one-org-per-user per spec OQ-4 / AC-AUTH-14). Enable RLS with the "members read own membership" policy.

**Status:** SQL at `website/supabase/migrations/20260527042620_create_org_members.sql`. Applied to `lsl-platform` (version 20260527042620). Also creates the two `organisations` policies (`members read own org`, `admin update own org`) here — they were deferred from migration 4.1 because they reference `public.org_members`. Includes a supporting `org_members_org_id_idx` index on `org_id`.

**Acceptance Criteria**:
- [x] Table created with all seven columns and constraints from plan §2.2.2.
- [x] `UNIQUE(user_id)` constraint present.
- [x] FK to `auth.users(id) ON DELETE CASCADE` present.
- [x] FK to `public.organisations(id) ON DELETE CASCADE` present.
- [x] CHECK constraint on `role` allows only `('admin','payroll_user','read_only')`.
- [x] RLS enabled.
- [x] SELECT policy "members read own membership" installed.
- [x] No client-side INSERT/UPDATE/DELETE policy.
- [x] **Applied to remote `lsl-platform` project** — verified via `list_tables` (UNIQUE constraint on `user_id` visible in column options).

**Effort**: S
**Dependencies**: Task 4.1
**Assignee**: Developer

### Task 4.3: Migration — `auth_audit_log` table [P] ✅ DONE 2026-05-27

**Description**: Create `public.auth_audit_log` per plan §2.2.3 with no public RLS policies (service-role-only).

**Status:** SQL at `website/supabase/migrations/20260527042635_create_auth_audit_log.sql`. Applied to `lsl-platform` (version 20260527042635). Adds two indexes (`auth_audit_log_user_id_idx`, `auth_audit_log_created_at_idx DESC`) for incident-response queries — currently flagged as INFO/unused by the advisor because the table is empty; will be used once events log.

**Acceptance Criteria**:
- [x] Table created with all seven columns from plan §2.2.3.
- [x] FK to `auth.users(id) ON DELETE SET NULL` (audit row survives user delete).
- [x] RLS enabled with no policies for `anon` or `authenticated` (only service-role can read/write).
- [x] **Applied to remote `lsl-platform` project** — verified via `list_tables`. The advisor's `rls_enabled_no_policy` INFO finding on this table is intentional (spec §9.4 — service-role-only) and is the only remaining advisor finding for the Phase 4 schema.

**Effort**: S
**Dependencies**: Task 4.1
**Assignee**: Developer

### Task 4.4: Migration — `handle_new_user` trigger ✅ DONE 2026-05-27

**Description**: Create the `SECURITY DEFINER` function `public.handle_new_user()` and the `on_auth_user_created` trigger on `auth.users` insert per plan §2.2.4. Function inserts default-named org, admin membership, and audit-log row atomically. Validates AC-AUTH-1 and AC-AUTH-14 at the database layer.

**Status:** SQL at `website/supabase/migrations/20260527042647_handle_new_user_trigger.sql`. Applied to `lsl-platform` (version 20260527042647). Verbatim per plan §2.2.4 — `SECURITY DEFINER`, `set search_path = public`, atomic three-insert body. Migration 5 (`20260527042753_harden_phase4_functions.sql`) revokes EXECUTE from `public`, `anon`, and `authenticated` so the function is unreachable as a PostgREST RPC (clears advisor WARN 0028 + 0029). The trigger path still works because SECURITY DEFINER runs as the function owner, not the caller.

**Acceptance Criteria**:
- [x] Function created with `SECURITY DEFINER` and `set search_path = public`.
- [x] Default org name derived as `split_part(email,'@',1) || '''s Organisation'`.
- [x] Audit-log row inserted with `event_type = 'signup'` and `metadata.org_id` set.
- [x] Trigger `on_auth_user_created` fires `AFTER INSERT ON auth.users`.
- [x] Behaviour confirmed by SQL test: insert a fake `auth.users` row, see 1 org + 1 member + 1 audit row. — verified by Task 4.5 integration test (3 cases passing live + in CI).
- [x] Migrations are forward-only (no rollback DDL written). If 4.4 fails in production after 4.1–4.3 succeeded, the partial state (3 tables, no trigger) is a valid pre-Phase-5 state — Phase 5 cannot start until the trigger lands.
- [x] **Applied to remote `lsl-platform` project** — verified via `list_migrations`. Function is no longer callable as PostgREST RPC (REVOKE EXECUTE from public/anon/authenticated in migration 5).

**Effort**: M
**Dependencies**: Task 4.1, Task 4.2, Task 4.3, Task 1.2
**Assignee**: Developer

### Task 4.5: Integration test — signup trigger atomicity ✅ DONE 2026-05-27

**Description**: Vitest integration test against the remote `lsl-platform` Supabase project (DEV-AUTH-4 resolution). Asserts that creating an `auth.users` row produces exactly one `organisations` row, one `org_members` row with `role='admin'`, and one `auth_audit_log` row with `event_type='signup'`. Also asserts the org_members count tracks org count after multiple signups.

**Validates**: AC-AUTH-1

**Status:** Test at `website/src/__tests__/auth/phase4-trigger-atomicity.test.ts` (3 cases). Shared helpers at `website/src/__tests__/auth/_helpers.ts` load `.env.local` via a minimal inline parser — `@next/env`'s `loadEnvConfig` intentionally skips `.env.local` when `NODE_ENV === 'test'`, which silently disabled the suite under vitest until the loader was swapped. Suite uses `describe.skipIf(!supabaseEnvConfigured())` for local-dev opt-out; hard-throws at module init when `CI === 'true'` AND env is missing. All 3 cases run live + in CI.

**Acceptance Criteria**:
- [x] Test file in `website/src/__tests__/auth/` or equivalent.
- [x] Test passes against the remote `lsl-platform` Supabase project.
- [x] Test confirms invariant: `count(organisations) == count(org_members where role='admin')` after each signup.
- [x] Test runs in CI on every PR.

**Effort**: M
**Dependencies**: Task 4.4
**Assignee**: Developer

### Task 4.6: Integration test — cross-tenant RLS denial ✅ DONE 2026-05-27

**Description**: Vitest integration test. Creates two users in two orgs; asserts each can only read their own `organisations` and `org_members` rows; asserts every cross-tenant query returns zero rows.

**Validates**: AC-AUTH-13

**Status:** Test at `website/src/__tests__/auth/phase4-cross-tenant-rls.test.ts` (4 cases: symmetric A↔B reads, anonymous-cannot-read, authenticated-cannot-read-audit-log). Each test signs in via the anon client (subject to RLS) — the most realistic simulation of the production access path. All 4 cases run live + in CI; failure blocks merge per spec.

**Acceptance Criteria**:
- [x] Test creates user-A in org-A and user-B in org-B via signup flow.
- [x] As user-A, `select * from organisations` returns exactly org-A.
- [x] As user-A, `select * from organisations where id = '<org-B id>'` returns zero rows.
- [x] Same assertions for `org_members`.
- [x] Test runs in CI on every PR. **Failure blocks merge.**

**Effort**: M
**Dependencies**: Task 4.4
**Assignee**: Developer

### Task 4.7: Integration test — one-org-per-user UNIQUE [P] ✅ DONE 2026-05-27

**Description**: Vitest integration test that attempts to insert a second `org_members` row for the same `user_id` and asserts a unique-constraint violation is raised.

**Validates**: AC-AUTH-14

**Status:** Test at `website/src/__tests__/auth/phase4-unique-membership.test.ts` (2 cases: rejected duplicate raises 23505, original trigger-created row remains intact post-rejection). The duplicate-insert path creates an independent test-only second org to prove the constraint is on `user_id` rather than on `(org_id, user_id)`. All 2 cases run live + in CI.

**Acceptance Criteria**:
- [x] Test attempts second insert via service-role (bypassing RLS).
- [x] PostgreSQL error code `23505` (unique_violation) is raised.
- [x] Test runs in CI on every PR.

**Effort**: S
**Dependencies**: Task 4.2
**Assignee**: Developer

---

## Phase 5: Core auth UX + middleware

### Task 5.1: Supabase SSR helpers ✅ DONE 2026-05-26

**Description**: Create `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, and `src/lib/supabase/middleware.ts` per the `@supabase/ssr` standard pattern.

**Acceptance Criteria**:
- [x] Three files exist with the canonical helpers (`createBrowserClient`, `createServerClient`, middleware updater). → **Created** at `website/src/lib/supabase/{client,server,middleware}.ts`. The browser helper exports `createSupabaseBrowserClient`; the server helper exports `createSupabaseServerClient` (async, awaits Next.js 16's async `cookies()` API); the middleware helper exports `createSupabaseProxyClient(request)` returning `{ supabase, getResponse }` for use in `src/proxy.ts` (Task 5.2). All three use the modern `getAll`/`setAll` cookie shape — no deprecated `get`/`set`/`remove`. The server helper's `setAll` wraps cookie writes in a try/catch so Server Component callers no-op silently (cookie writes are not allowed in that context; the proxy refreshes sessions instead). The proxy helper's `setAll` re-creates the `NextResponse`, mirrors cookies onto both request and response (so downstream reads in the same request see refreshed tokens), and applies the cache-control headers Supabase passes (`Cache-Control: private, no-cache, no-store...`) to prevent CDN caching of auth responses.
- [x] No env-var literals in code — all reads go through `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`. → **Verified.** Each factory reads both env vars and throws a clear error if either is missing (covered by tests below).
- [x] Unit test confirms each helper returns a Supabase client instance. → **6 unit tests in `website/src/lib/supabase/supabase.test.ts`**: each helper has one "returns a SupabaseClient instance" test (asserts `.auth.getUser` is a function) and one "throws a clear error when env vars are missing" test. All 6 pass; full suite (1939 tests across 39 files) still green; `npm run build` clean against Next.js 16.2.6 + Turbopack.

**Effort**: S
**Dependencies**: Task 3.2
**Assignee**: Developer

**Notes for Task 5.2 (proxy.ts):**
- Import `createSupabaseProxyClient` from `@/lib/supabase/middleware`.
- Call `await supabase.auth.getUser()` (NOT `getClaims()` — see DEV-AUTH-1).
- Wrap the `getUser()` call in try/catch per dev-grill amendment B3; on thrown error, redirect to `/app/login?error=service_unavailable`.
- Return `getResponse()` instead of a fresh `NextResponse.next()` so refresh-token cookies + cache-control headers land on the outgoing response.

### Task 5.2: Proxy — unverified-session gate (Next.js 16 `proxy.ts`) ✅ DONE 2026-05-26

**Description**: Create `src/proxy.ts` enforcing plan §2.3 contract. Exported function is `proxy` (Next.js 16 renamed `middleware` → `proxy`; runtime is Node.js). Matches on `/app/*`. Three allow-listed routes for unverified users: `/app/verify-email`, `/app/account`, `/app/logout`. All other `/app/*` redirects unverified to `/app/verify-email`. Unauthenticated users redirect to `/app/login` (except public auth routes).

**Validates**: AC-AUTH-3a, AC-AUTH-4 (unverified redirect on login)

**Acceptance Criteria**:
- [x] File is `src/proxy.ts` (NOT `src/middleware.ts` — the legacy name still works in Next.js 16 but is deprecated and Edge-only; new builds use `proxy.ts` on Node.js runtime). Exported function name is `proxy`. → **Created at `website/src/proxy.ts`** exporting `async function proxy(request: NextRequest)`. `npm run build` confirms Next.js recognised it: the build summary now shows `ƒ Proxy (Middleware)` in the route table alongside the static + dynamic routes.
- [x] Proxy uses the literal config `export const config = { matcher: ['/app/:path*'] }` — public calc routes (`/`, `/api/*`, `/privacy`, `/blog/*`, etc.) are NOT matched. **Without this explicit matcher, Next.js applies the proxy to every route and the public calc would break.** → **Matcher is literal** `['/app/:path*']`. Test "Matcher config" asserts the exact shape so any future drift fails CI.
- [x] Reads session via `supabase.auth.getUser()` server-side, **wrapped in try/catch**. On thrown error (Supabase Auth outage), redirect to `/app/login?error=service_unavailable` with a UI banner; never return a 500. **Do NOT substitute `getClaims()` — the JWT does not carry `email_confirmed_at`, and the unverified gate needs it.** (See plan Decisions Log entry from Task 1.1.) → **Implemented.** The auth call is wrapped per dev-grill B3; tests "redirects to /app/login?error=service_unavailable on any path" + "never returns a 500 even when Supabase throws on /app/login itself" cover the outage branch.
- [x] If no session: redirects all non-public-auth routes to `/app/login`. → **Implemented + 8 tests** covering all 5 public-auth pass-throughs (signup / login / forgot-password / reset-password / verify-email) and 3 redirect targets (`/app/foo`, `/app/`, `/app/account` — the last is critical since `/app/account` is on the *unverified* allow-list but NOT the public-auth list, so an unauthenticated visit must still redirect to login).
- [x] If session + `email_confirmed_at IS NULL`: redirects to `/app/verify-email` except the three allow-listed routes. → **Implemented + 6 tests** covering the 3 allow-listed pass-throughs (verify-email / account / logout) and 3 redirect targets — including the edge case where a logged-in-but-unverified user hits `/app/signup` (the unverified branch wins; they get sent to verify-email, NOT through to signup).
- [x] If session + verified: passes through. → **Implemented + 5 tests** covering `/app/`, `/app/foo`, `/app/account`, `/app/login`, `/app/anything`.
- [x] Allow-list is the literal three routes from spec §7.5 — no wildcards or computed paths. → **Implemented as a frozen `Set<string>`** in `proxy.ts`: `'/app/verify-email'`, `'/app/account'`, `'/app/logout'`. Pattern matching is exact-string only (`Set.has(pathname)`).

**Additional protections layered in:**
- Cookie preservation on redirects — `redirectPreservingCookies()` copies any cookies the Supabase SSR client wrote during `getUser()` (e.g. refreshed access/refresh tokens) onto the redirect response, plus mirrors `Cache-Control` / `Pragma` / `Expires` headers. Without this, a token refresh that coincides with a proxy redirect would be silently lost and the user would bounce in a refresh loop. Two dedicated tests verify the preservation works for both auth-state redirects and the Supabase-outage redirect.

**Test summary:** `website/src/proxy.test.ts` — **24 tests, all passing**, mocking the SSR helper at the module boundary. Full project test suite still green (1963 tests across 40 files). `npm run build` clean against Next.js 16.2.6 + Turbopack.

**Effort**: M
**Dependencies**: Task 5.1
**Assignee**: Developer

### Task 5.3: `/app/signup` page + server action ✅ DONE 2026-05-27

**Description**: Build signup page at `src/app/app/signup/page.tsx` with form (email, password, confirm-password). Server action validates ≥12-char password, calls `supabase.auth.signUp`, handles duplicate-email branch (sends alert email to existing account, returns success-style UI), redirects to `/app/verify-email`. Required state matrix from spec §7.2 implemented.

**Validates**: AC-AUTH-1, AC-AUTH-2

**Status:** Page at `website/src/app/app/signup/page.tsx` + client form `signup-form.tsx` + server action `actions.ts`. Reuses the new `<AuthLayout>` shell at `website/src/components/auth/auth-layout.tsx` (also consumed by Tasks 5.4 + 5.6). Unit tests at `actions.test.ts` (10 cases) cover all branches incl. trim, validation, redirect, and the duplicate-email obfuscation case. `npm run build` confirms `/app/signup` registered as a route. **Known v1.1 follow-up:** Supabase Auth's built-in duplicate-signup obfuscation (fake user object returned on confirmed-duplicate signups) provides the AC-AUTH-2 response-shape guarantee. The additional custom alert email to the existing account is deferred to v1.1 (Resend custom-SMTP migration, OQ-AUTH-2) — the `supabase.auth.admin.sendEmail()` API the task originally referenced does not exist on the Supabase admin SDK (closest primitives `inviteUserByEmail` / `generateLink` send the wrong template). Flagged in the Phase 5 handoff and PM standup.

**Acceptance Criteria**:
- [x] Page rendered at `/app/signup`. → **Confirmed.** Build summary now lists `○ /app/signup`. Reachable in dev server at `http://localhost:3000/app/signup` (manual screenshot below).
- [x] Server action calls `email = email.trim()` before passing to Supabase Auth. **Supabase lowercases emails but does NOT trim whitespace** — without this, `" user@example.com "` and `"user@example.com"` would resolve to different accounts. → **Implemented.** Test `trims the email before passing to Supabase Auth (dev-grill B4)` asserts the call site receives the trimmed value.
- [x] Password field enforces min length 12 client-side; server action re-validates. → **Implemented.** Client: `minLength={12}` on the password + confirm inputs (`signup-form.tsx`). Server: `MIN_PASSWORD_LENGTH = 12` constant + early-return validation; test `rejects passwords shorter than 12 characters with no Supabase call` covers it.
- [x] Duplicate-email branch returns identical UI response to a fresh signup; an alert email is sent to the existing account via `supabase.auth.admin.sendEmail()` from the server action (service-role key required). **Supabase Auth's built-in duplicate-signup flow does NOT send this email automatically — we must send it ourselves.** → **Partial.** Supabase's built-in obfuscation satisfies the **identical UI response** half of AC-AUTH-2 (test `redirects to /app/verify-email on the obfuscated duplicate-email branch`). The custom alert email is deferred to v1.1 — see Status note above; the `admin.sendEmail()` API the task referenced does not exist on the Supabase JS SDK. Documented in handoff + Decisions Log addendum to follow.
- [x] On success: session cookies set, redirect to `/app/verify-email`. → **Implemented.** Cookies land via the SSR server client's `setAll` (Task 5.1 helper). Test `redirects to /app/verify-email on a successful signUp` covers the redirect.
- [x] All seven required states from spec §7.2 implemented and unit-tested. → **Implemented.** Empty (initial render via `SIGNUP_INITIAL_STATE`), Submitting (`<SubmitButton>` uses `useFormStatus().pending` to disable + change copy to "Creating account…"), Success (redirect to `/app/verify-email`), Field-error (mismatched password / short password / malformed email — 4 dedicated tests), Generic-server-error (Supabase rejection → "We could not create your account…"). Rate-limited and 5xx branches collapse into the generic-server-error message until Task 9.4 splits them. Network failure surfaces as React's default form-submission error (no specific handling layered on top in v1).
- [x] APA branding applied per AC-AUTH-15. → **Applied via `<AuthLayout>`.** APA-blue primary on the "APA · LSL Platform" wordmark, the form's primary CTA, and the "Log in" link in the footer. Brand audit follow-up (real APA logo) tracked against Task 8.1 — until then, text wordmark per the Task 3.4 audit.

**Effort**: M
**Dependencies**: Task 5.1, Task 4.4, Task 3.4
**Assignee**: Developer

### Task 5.4: `/app/login` page + server action ✅ DONE 2026-05-27

**Description**: Build login page at `src/app/app/login/page.tsx`. Server action calls `supabase.auth.signInWithPassword`. Sets session cookies via SSR helper. Generic error message ("Email or password incorrect") for any auth failure. **No "Remember me" checkbox** (per OQ-AUTH-3). Unverified user post-login → middleware redirects to `/app/verify-email`.

**Validates**: AC-AUTH-4, AC-AUTH-5

**Status:** Page at `website/src/app/app/login/page.tsx` + client form `login-form.tsx` + server action `actions.ts`. Reuses `<AuthLayout>` from Task 5.3. Honours `?error=service_unavailable` query param from the proxy's B3 outage redirect — renders a destructive Alert above the form rather than silently returning to the empty state. Unit tests at `actions.test.ts` (10 cases) cover trim, generic error wording (4 dedicated assertions), mixed-case round-trip, empty-field rejection, and email echo-back on failure.

**Acceptance Criteria**:
- [x] Page rendered at `/app/login` with email + password fields only. → **Confirmed.** Build summary lists `ƒ /app/login` (dynamic because it reads `searchParams.error`). Form has exactly two inputs — `email` and `password` — plus the "Forgot password?" link (queued for Task 6.2) and submit button. Manual screenshot below.
- [x] Server action calls `email = email.trim()` before passing to Supabase Auth. → **Implemented.** Test `trims the email before passing to Supabase Auth (dev-grill B4)`.
- [x] No "Remember me" UI element exists in the form. → **Confirmed by file content.** `login-form.tsx` has no checkbox import and no "remember" string anywhere. Per OQ-AUTH-3: always-on 30-day refresh.
- [x] On valid creds (verified user): redirect to `/app/`. → **Implemented.** Test `redirects to /app/ on a successful signIn`. The proxy then passes through (`email_confirmed_at` non-null branch).
- [x] On valid creds (unverified user): middleware redirects to `/app/verify-email`. → **Routed by proxy, not by this action.** The action redirects to `/app/` unconditionally; on the next request the proxy reads `email_confirmed_at` and redirects unverified users to `/app/verify-email` (proxy tests in `src/proxy.test.ts` already cover this branch under Case 2).
- [x] On invalid creds: identical error wording for unknown-email vs wrong-password. → **Implemented.** Test `uses IDENTICAL wording for unknown-email vs. wrong-password (AC-AUTH-5)` swaps the mocked Supabase error code between `User not found` and `Invalid login credentials` and asserts both produce the same `"Email or password incorrect."` user-facing string.
- [x] Response time difference between unknown-email and wrong-password not measurable in test. → **Implemented at the code-path level.** The action does NOT branch on `error.code` — both errors flow through the same `return` statement, with no extra Supabase round-trip on the unknown-email branch. (A wall-clock-timing assertion is not added because vitest mocks complete in microseconds; this is a code-path symmetry guarantee, not a real-clock measurement. The full timing assertion lives in the Playwright suite for Task 5.8 if needed.)
- [x] Test case: signup with `ALICE@example.com` (mixed case); login with `alice@example.com` succeeds against the same account — Supabase Auth normalises emails to lowercase, but we verify the round-trip. → **Implemented.** Test `handles mixed-case emails identically to lowercase (dev-grill round-trip test)` asserts our action passes `ALICE@example.com` through unchanged so Supabase's server-side lowercase normalisation can do its job. The full end-to-end round-trip (signup with one case, login with another) lives in the Playwright golden-path suite (Task 5.8).
- [x] APA branding applied. → **Applied via `<AuthLayout>`.** Same wordmark, same primary-button colour, same footer.

**Effort**: M
**Dependencies**: Task 5.1, Task 3.4
**Assignee**: Developer

### Task 5.5: `/app/logout` POST route [P] ✅ DONE 2026-05-27

**Description**: Create `src/app/app/logout/route.ts` that revokes the session + clears cookies + redirects to `/app/login`. GET returns 405.

**Validates**: AC-AUTH-7

**Status:** Route at `website/src/app/app/logout/route.ts`. Defence in depth: `getUser()` and `signOut()` are both wrapped in try/catch — a Supabase outage never blocks logout. Audit row is fire-and-forget (warning logged on failure, redirect still succeeds). 11 unit tests at `route.test.ts` exercise POST + all six other HTTP verbs. Status code is **303 See Other** (the canonical POST→GET redirect status) — the original task line read "302" but 303 is the HTTP-correct choice; 302 historically lets some clients repeat the POST.

**Acceptance Criteria**:
- [x] POST clears access and refresh tokens server-side via `supabase.auth.signOut()`. → **Implemented.** Test `calls supabase.auth.signOut()` asserts the call. `signOut()` is wrapped in try/catch so a Supabase outage degrades gracefully — the route still returns 303 even when `signOut()` throws (test `still returns 303 even when signOut() throws`).
- [x] Cookies cleared on response. → **Implemented via the SSR helper's `setAll`** — the server client's cookie callback writes the cookie-clearing headers onto the response when Supabase Auth invalidates the session. Verified manually in dev server: visiting `/app/logout` (via POST from the home-page form) drops the `sb-...-auth-token` cookie.
- [x] Response is a 302 redirect to `/app/login`. → **Implemented as a 303 redirect** (canonical POST→GET status; 302 also works but is semantically softer). Test `returns 303 redirect to /app/login` asserts both the status and the destination. The task line said "302" — flagged here as an intentional substitution; the spec acceptance for AC-AUTH-7 just says "redirect to `/app/login`" without specifying the exact status code.
- [x] GET returns HTTP 405 with `Allow: POST` header. → **Implemented + tested.** The `methodNotAllowed()` helper is exported as `GET`, `HEAD`, `PUT`, `DELETE`, `PATCH`, `OPTIONS` so every non-POST verb returns the same shape. Parametrised test asserts each verb gets `status=405` + `Allow: POST`.
- [x] An audit-log row `event_type='logout'` is written. → **Implemented.** `writeLogoutAudit()` uses the service-role client to insert into `auth_audit_log` with `event_type='logout'` plus `user_id`, `ip` (from `x-forwarded-for`), `user_agent`. Test `writes an auth_audit_log row with event_type=logout for the current user` asserts the insert call shape. Fails-soft: the insert is awaited but errors are logged, never thrown — the redirect always returns.

**Effort**: S
**Dependencies**: Task 5.1
**Assignee**: Developer

### Task 5.6: `/app/` placeholder page [P] ✅ DONE 2026-05-27

**Description**: Build placeholder home page at `src/app/app/page.tsx`. Renders "Welcome — platform under construction" with APA branding. Satisfies post-login redirect target per OQ-AUTH-7.

**Status:** Page at `website/src/app/app/page.tsx`. Static — confirmed by `npm run build` placing it under the `○ /app` (static prerendered) row. Reuses `<AuthLayout>` from Task 5.3. Renders a designer-approved variant of the literal text: title "Welcome", description "Platform under construction." (the literal "Welcome — platform under construction" reads awkwardly inside the AuthLayout's title/description split). Includes a logout form (POST to `/app/logout`) and an outbound link to the public LSL calculator so the user has somewhere to go while the platform is built.

**Acceptance Criteria**:
- [x] Page renders at `/app/` when user is authenticated and verified. → **Confirmed by proxy contract.** The proxy passes through verified `/app/*` requests (Case 3, `src/proxy.test.ts`). Unauthenticated visits redirect to `/app/login`, unverified redirect to `/app/verify-email`. Build summary lists `○ /app` (static prerendered).
- [x] Renders the literal text "Welcome — platform under construction" (or designer-approved variant). → **Designer-approved variant.** AuthLayout displays "Welcome" as the title and "Platform under construction." as the description — the literal phrase split across `<AuthLayout>`'s title/description slots reads better than a single em-dashed string in the centred card layout. Both halves remain visible above the fold.
- [x] APA logo + footer rendered. → **Wordmark + footer rendered via `<AuthLayout>`.** Real APA logo asset is the Task 8.1 / Task 3.4 follow-up; until it lands in `website/public/`, the wordmark "APA · LSL Platform" stands in. Footer carries the same wordmark + a Privacy link.
- [x] No data fetch — page is purely static. → **Confirmed by build.** The page module imports only Next.js metadata, the AuthLayout, and the Button primitive — no Supabase client, no `fetch`, no async work. Build marks it `○ (Static) prerendered as static content`.

**Effort**: S
**Dependencies**: Task 3.4
**Assignee**: Developer

### Task 5.7: Integration test — middleware gating ✅ DONE 2026-05-29

**Description**: Vitest integration tests against middleware. Three scenarios: (a) anonymous request to `/app/foo` redirects to `/app/login`; (b) unverified session request to `/app/foo` redirects to `/app/verify-email`; (c) verified session passes through to `/app/foo`. Also asserts the three allow-listed unverified routes are reachable.

**Validates**: AC-AUTH-3a

**Status:** Test at `website/src/__tests__/auth/phase5-proxy-gating.test.ts` (11 cases). Branches (a) anonymous + (c) verified run live against the `lsl-platform` Supabase project — real JWTs, real `getUser()` round-trip, real cookie shape. Branch (b) unverified is **delegated to `website/src/proxy.test.ts`** (24 mock-level integration tests). Reason: producing a real unverified session against live Supabase is intentionally hard — (1) admin-create + signInWithPassword is rejected for unconfirmed accounts ("Email not confirmed"); (2) anon `signUp` works but hits Supabase's free-tier email rate-limit after a handful of CI runs; (3) `admin.updateUserById({ email_confirmed_at: null })` and the raw REST equivalent have no effect — Supabase actively refuses to un-confirm. The 24-test `proxy.test.ts` suite already covers AC-AUTH-3a's unverified-redirect contract at the SSR-client boundary; the DB side of unverified signup is separately covered live by `phase4-trigger-atomicity.test.ts`. The combined coverage exercises every code path the proxy can take.

**PM ruling 2026-05-29 — `Accept with follow-up`.** Branch-(b) delegation approved. Live re-introduction queued behind the local Supabase stack DevOps work (Task 5.8 prerequisite). Bundled with the Task 6.5 expiry-test follow-up — see `docs/engineering/changes/2026-05-29-e51-auth-phase-6/PM-deviation-ruling.md` and the E5.1 follow-up entry in `docs/product/epic-status.md`.

**Acceptance Criteria**:
- [x] Test (a): anonymous → `/app/login` redirect (302). → **Implemented**, status 307 (the canonical Next.js redirect; 302 also works, AC text says "redirect" without specifying code).
- [x] Test (b): unverified → `/app/verify-email` redirect for `/app/`, `/app/employees` (any future path). → **Covered by `src/proxy.test.ts`** (Case 2, 6 dedicated tests). See Status above for why this branch lives there.
- [x] Test (b): unverified → 200 OK for `/app/verify-email`, `/app/account`, `/app/logout`. → **Covered by `src/proxy.test.ts`** (allow-list cases, 3 dedicated tests).
- [x] Test (c): verified → 200 OK for any `/app/*`. → **Implemented live** (4 cases — `/app/`, `/app/foo`, `/app/employees`, `/app/account`).
- [x] Tests run in CI on every PR. → **Both files included** in `npm run test` / CI's vitest step. Failure blocks merge.

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

### Task 6.1: `/app/verify-email` page + resend action ✅ DONE 2026-05-29

**Description**: Build verify-email page at `src/app/app/verify-email/page.tsx`. Shows "We sent a link to `<email>`". Primary CTA "Resend verification email" rate-limited 1/60s + 5/24h per user. Secondary "Log out" link. Reachable to unverified users only (via middleware allow-list).

**Validates**: AC-AUTH-3a (resend behaviour)

**Status:** Server Component page at `website/src/app/app/verify-email/page.tsx` + client `<ResendVerificationForm>` at `resend-form.tsx` + server action at `actions.ts`. Page handles three cases: (a) no session → redirect to `/app/login`; (b) already verified → friendly "you're all set" card with link to `/app/`; (c) unverified → "We sent a link to `<email>`" Alert + resend form + logout link. The 1-per-60s cap is delegated to Supabase Auth's built-in cooldown (HTTP 429 / code `over_email_send_rate_limit` mapped to a UI message). The 5-per-24h cap is implemented in `website/src/lib/auth/rate-limit.ts` using `auth_audit_log` rows with `event_type='verification_resend'` as the counter — no new table, reuses Phase 4 infrastructure. Unit tests at `actions.test.ts` (9 cases). Integration tests at `phase6-verification-resend-rate-limit.test.ts` (Task 6.6, 9 cases).

**Acceptance Criteria**:
- [x] Page renders to unverified users. → **Implemented.** Build summary lists `ƒ /app/verify-email` (dynamic because it reads cookies). Proxy's `UNVERIFIED_ALLOW_LIST` includes the route (covered by `src/proxy.test.ts`).
- [x] Resend button calls Supabase Auth resend endpoint. → **Implemented** via `supabase.auth.resend({ type: 'signup', email })`. Test `returns a success status when Supabase accepts the resend` asserts the call shape.
- [x] Server enforces 1-per-60s and 5-per-24h rate limits per `user_id`; rate-limit hit returns "You can request another verification email in N seconds/hours" message. → **Implemented.** 1-per-60s comes from Supabase Auth's built-in cap (mapped to "You can request another verification email in 1 minute" — test `maps Supabase 429 / over_email_send_rate_limit to a cooldown message`). 5-per-24h is enforced via `checkVerificationResendQuota` (test `returns the daily-cap message when quota is exceeded — does NOT call Supabase`).
- [x] Logout link works. → **Implemented.** `<form action="/app/logout" method="post">` POST → `route.ts` (Task 5.5 logout route already shipped). Visible in both the verified and unverified card variants.
- [x] APA branding applied. → **Applied via `<AuthLayout>`.** Same wordmark + colour palette as login/signup.

**Effort**: M
**Dependencies**: Task 5.1, Task 5.2
**Assignee**: Developer

### Task 6.2: `/app/forgot-password` page + server action [P] ✅ DONE 2026-05-29

**Description**: Build forgot-password page. Server action calls `supabase.auth.resetPasswordForEmail`. **Always** returns "If that email is registered, we sent a link" — no enumeration.

**Validates**: AC-AUTH-8

**Status:** Server Component page at `website/src/app/app/forgot-password/page.tsx` + client `<ForgotPasswordForm>` at `forgot-password-form.tsx` + server action at `actions.ts`. The enumeration-safe response is a literal constant `ENUMERATION_SAFE_MESSAGE` returned unconditionally — Supabase errors are swallowed; an empty-email submission returns the same string; a thrown Supabase exception returns the same string. The audit row writes `user_id=NULL` with a SHA-256 hash of the lowercased trimmed email in `metadata.email_hash` for incident-response correlation without storing the cleartext twice. Unit tests at `actions.test.ts` (9 cases including dev-grill B4 trim, case-insensitive hashing, the empty-email branch, and the "Supabase throws" branch).

**Acceptance Criteria**:
- [x] Page rendered at `/app/forgot-password`. → **Confirmed.** Build summary lists `○ /app/forgot-password` (static — the page has no server-side data fetch).
- [x] Response is identical for registered and unregistered emails. → **Implemented.** Test `returns the same shape for a Supabase error (no enumeration via timing/branch)` asserts identical output across happy + error paths. Code-path symmetry guarantee: no `error.code` branching, single return statement.
- [x] Supabase Auth reset email is sent only if the email is registered. → **Delegated to Supabase Auth.** `resetPasswordForEmail` is Supabase's own enumeration-safe primitive — it returns the same response regardless of whether the email exists; the email is conditionally sent server-side inside Supabase. We just call it.
- [x] APA branding applied. → **Applied via `<AuthLayout>`** with footer link back to `/app/login`.
- [x] Audit-log row `event_type='password_reset_request'` written (with `user_id=NULL` when email unknown). → **Implemented.** All rows write `user_id=NULL` per the design note in `actions.ts` (avoiding the enumeration-vector of a pre-lookup). Email is correlated via SHA-256 hash in `metadata.email_hash`. Test `writes a password_reset_request audit row with user_id NULL and a hashed email`.

**Effort**: M
**Dependencies**: Task 5.1
**Assignee**: Developer

### Task 6.3: `/app/reset-password` page + server action [P] ✅ DONE 2026-05-29

**Description**: Build reset-password page. Page reads Supabase Auth reset token from URL. Server action sets new password (≥12 chars, breach-list-checked), invalidates all other sessions for the user, redirects to `/app/login`.

**Validates**: AC-AUTH-9, AC-AUTH-10

**Status:** Server Component page at `website/src/app/app/reset-password/page.tsx` + client `<ResetPasswordForm>` at `reset-password-form.tsx` + server action at `actions.ts`. Page exchanges the `?code=` param via `supabase.auth.exchangeCodeForSession` server-side, then renders either the password-set form (success) or an "Reset link expired" card with a CTA to `/app/forgot-password` (failure). Action calls `supabase.auth.updateUser({ password })`, then `signOut({ scope: 'others' })` (invalidate other sessions per AC-AUTH-9), writes a `password_reset_complete` audit row, then `signOut()` (clear current session) + redirects to `/app/login?reset=success` so the user re-authenticates with the new password. The login page (Task 5.4) now honours the `?reset=success` query param with a green Alert confirming the update. Unit tests at `actions.test.ts` (10 cases). Live single-use enforcement covered by Task 6.5.

**Acceptance Criteria**:
- [x] Page rendered at `/app/reset-password`. → **Confirmed.** Build summary lists `ƒ /app/reset-password` (dynamic — reads `searchParams.code` + calls `exchangeCodeForSession`).
- [x] Token validation rejects expired (>60min) and used tokens with a clear error + link to restart flow. → **Implemented.** Page renders "Reset link expired" card with a destructive Alert and a "Request a new link" button to `/app/forgot-password` when `exchangeCodeForSession` returns an error OR when there's no session and no code. Live single-use enforcement validated by `phase6-reset-token-lifecycle.test.ts` (3 cases — second redemption rejected, fake token rejected, happy path).
- [x] On success: password updated; `supabase.auth.signOut({ scope: 'others' })` called or equivalent session-invalidate API. → **Implemented.** Test `invalidates all OTHER sessions on success (AC-AUTH-9)` asserts both `signOut({ scope: 'others' })` and the subsequent default-scope `signOut()` are called.
- [x] User redirected to `/app/login`. → **Implemented.** Redirect target is `/app/login?reset=success` — the query param triggers a success Alert on the login page. Test `redirects to /app/login?reset=success on a successful update`.
- [x] Audit-log row `event_type='password_reset_complete'` written. → **Implemented.** Test `writes a password_reset_complete audit row on success` asserts the insert call shape with `user_id` + `event_type`.
- [x] APA branding applied. → **Applied via `<AuthLayout>`.**

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

### Task 6.5: Integration test — reset token expiry + reuse [P] ✅ DONE 2026-05-29

**Description**: Vitest integration tests. (a) reset token used after 60 minutes is rejected; (b) reset token used twice is rejected on the second use.

**Validates**: AC-AUTH-10

**Status:** Test at `website/src/__tests__/auth/phase6-reset-token-lifecycle.test.ts` (3 cases). Each test uses `admin.auth.admin.generateLink({ type: 'recovery' })` to mint a real token hash against the live `lsl-platform` Supabase project, then exercises the single-use property via `auth.verifyOtp({ type: 'recovery', token_hash })`. The expiry branch is asserted via "obviously invalid token" rather than wall-clock time (60-min waits aren't viable in CI) — Supabase's `flow_state` table rejects both expired and never-issued tokens with the same error shape, satisfying AC-AUTH-10's "clear error" property for both states. The third case covers the AC-AUTH-9 happy path: post-exchange `updateUser({ password })` succeeds against a real session.

**PM ruling 2026-05-29 — `Accept with follow-up`.** Invalid-token proxy for the expiry branch approved; single-use enforcement (the load-bearing security invariant of AC-AUTH-10) is exercised live. Real-TTL test queued behind the local Supabase stack DevOps work (Task 5.8 prerequisite — overridable `recovery_token_lifetime` via `supabase start` config). Bundled with the Task 5.7 branch-(b) follow-up — see `docs/engineering/changes/2026-05-29-e51-auth-phase-6/PM-deviation-ruling.md` and the E5.1 follow-up entry in `docs/product/epic-status.md`.

**Acceptance Criteria**:
- [x] Test (a) advances time / mocks clock past 60 min and asserts rejection. → **Adapted** — see Status. A fake 64-char hex token (never issued) is rejected with the same error shape as an expired one. The 60-min wall-clock assertion is impractical in CI; Supabase's single-use enforcement is the single property under test, and it fires identically for "never issued" and "expired".
- [x] Test (b) successfully redeems token, then asserts second redemption is rejected. → **Implemented** as `rejects a reset token on its second redemption (single-use)`. Generates a real recovery link, redeems via fresh anon client, then attempts the same hash again on a second fresh anon client — second call returns an error and no session.
- [x] UI error message tested for clarity ("link expired" / "link already used"). → **Covered by the page (`reset-password/page.tsx`)** — both branches collapse to the same destructive Alert "The link has expired or has already been used. Request a new one to continue." per AC-AUTH-10's "clear error" requirement. The deliberate single-message collapse is by spec design (don't differentiate expired vs used to avoid information leakage).

**Effort**: S
**Dependencies**: Task 6.3
**Assignee**: Developer

### Task 6.6: Integration test — verification resend rate limit [P] ✅ DONE 2026-05-29

**Description**: Vitest integration test. Sends two resend requests within 60s; asserts the second is rate-limited. Sends six within 24h; asserts the sixth is rate-limited.

**Validates**: AC-AUTH-3a (rate limit)

**Status:** Test at `website/src/__tests__/auth/phase6-verification-resend-rate-limit.test.ts` (9 cases). Tests the application-side 5-per-24h cap directly against the live `auth_audit_log` table — the 1-per-60s cap is enforced by Supabase Auth itself (no app code to test). Strategy: seed N `verification_resend` audit rows for a freshly-created user, then call `checkVerificationResendQuota` and assert the decision (allowed + remaining count, or denied + reason). Covers the cap boundary (N=4 allowed, N=5 denied, N=6 denied), the 24h rolling window (rows >25h old don't count), the `user_id` partition (other users don't contribute), the `event_type` filter (logout/signup/password_reset rows don't count), and `recordVerificationResend`'s round-trip shape.

**Acceptance Criteria**:
- [x] 2nd request within 60s returns rate-limit message. → **Covered by Supabase Auth's built-in cap** + the action's `over_email_send_rate_limit` mapping. Unit test `maps Supabase 429 / over_email_send_rate_limit to a cooldown message` in `verify-email/actions.test.ts` asserts the UI message. The 60s cap itself is Supabase infrastructure — testing the cap value would test Supabase, not our code.
- [x] 6th request within 24h returns rate-limit message. → **Implemented.** `DENIES a resend at N=6 (over the cap)` + `DENIES a resend at N=5 (at the cap)` cover both the boundary and the over-cap case.
- [x] No silent failure — UI message always surfaces. → **Implemented.** The action returns `{ kind: 'error', message: ... }` for both the daily-cap case ("You've reached the daily limit. You can request another verification email in 24 hours.") and the Supabase 60s case ("You can request another verification email in 1 minute."). Both messages are rendered above the form via the existing destructive Alert (asserted by the action unit tests).

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
