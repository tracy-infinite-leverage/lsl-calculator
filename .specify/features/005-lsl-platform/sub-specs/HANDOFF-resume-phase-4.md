# HANDOFF — Resume the LSL auth slice at Phase 4 (database schema)

**Feature:** LSL Platform · Auth (E5.1 login slice)
**Branch to work on:** `feat/E5.1-auth-slice`
**Last session ended:** 2026-05-27 (Tracy's morning)
**Last commit on this branch:** `3e2f405 feat(E5.1-auth): Task 5.2 — proxy.ts unverified-session gate (AC-AUTH-3a)`
**Tasks complete:** 8 of 47 (Phase 1 × 3, Phase 3 × 3, Phase 5 × 2)
**Tasks remaining in Phase 4:** 7 (4.1–4.7)

---

## 0. First thing: orient yourself

Read these in order. Don't skip.

1. `CLAUDE.md` (project root) — engineering rules and agent routing
2. `.specify/features/005-lsl-platform/sub-specs/auth.md` — spec v1.0 (APPROVED)
3. `.specify/features/005-lsl-platform/sub-specs/auth-impl-plan.md` — impl plan v1.0
   - Pay special attention to the **Decisions Log** at the bottom. 9 decisions have been recorded; they bind your work.
4. `.specify/features/005-lsl-platform/sub-specs/auth-tasks.md` — 47 tasks; first 8 marked DONE
5. `website/AGENTS.md` — project-specific Next.js 16 warnings + Supabase config

Once you've read these, run `git log --oneline -10` on `feat/E5.1-auth-slice` to see what's already shipped.

---

## 1. Resolve DEV-AUTH-4 FIRST (before any Phase 4 task)

DEV-AUTH-4 is the only un-resolved open issue in the impl plan. It asks: should the auth integration tests run against (a) a local Supabase stack via `supabase start`, or (b) the remote Pro-tier project at `woxtujkxatosbirikxtq` directly?

**Plan default: local `supabase start`.** Confirm it's still right, then make it real.

### Steps

1. **Confirm branch + working tree:**
   ```bash
   git checkout feat/E5.1-auth-slice
   git status
   ```
   If a sibling session has yanked you to `main` or any other branch, the checkout switches you back. Uncommitted files from sibling sessions (e.g. `website/.claude/`, `docs/qa/test-cases-nt.md`) are not yours — leave them alone.

2. **Install the Supabase CLI** if not present on this machine:
   ```bash
   brew install supabase/tap/supabase
   # or: npm i -g supabase
   ```

3. **Initialise the local Supabase stack** under `website/`:
   ```bash
   cd website
   supabase init           # creates website/supabase/ if not already there
   supabase start          # spins up local Postgres + Auth + Studio in Docker
   ```
   Capture the local URLs Supabase prints (API, DB, Studio). Add them to `website/AGENTS.md` under the Supabase config section as a "Local dev" subsection.

4. **Add a `.env.local`** to `website/` (gitignored) with the local Supabase keys printed by `supabase start`. Use these for `npm run dev` and Vitest integration tests. Real cloud keys stay in Vercel.

5. **Update the impl-plan's Decisions Log** with the DEV-AUTH-4 resolution. Mark the Open Issues row as RESOLVED.

6. **Commit** as: `chore(E5.1-auth): DEV-AUTH-4 resolved — local supabase start for integration tests`

Estimated effort: 20–40 minutes.

---

## 2. Phase 4 — the work itself

Seven tasks. Spec contract: plan §2.2.4 has the binding SQL. **Do not improvise** — write each migration verbatim per the plan. Deviation requires a plan amendment first.

| Task | Title | Effort | Depends on |
|---|---|---|---|
| 4.1 | Migration — `organisations` table + RLS | S | DEV-AUTH-4 + Task 3.1 |
| 4.2 [P] | Migration — `org_members` table + RLS | S | 4.1 |
| 4.3 [P] | Migration — `auth_audit_log` table | S | 4.1 |
| 4.4 | Migration — `handle_new_user` trigger | M | 4.1 + 4.2 + 4.3 + DEV-AUTH-2 (resolved ✓) |
| 4.5 | Integration test — signup trigger atomicity (AC-AUTH-1) | M | 4.4 |
| 4.6 | Integration test — cross-tenant RLS denial (AC-AUTH-13) | M | 4.4 |
| 4.7 [P] | Integration test — one-org-per-user UNIQUE (AC-AUTH-14) | S | 4.2 |

### Workflow per task

1. **Write the migration locally** via `supabase migration new <name>` — creates a timestamped SQL file in `website/supabase/migrations/`.
2. **Apply locally**:
   ```bash
   supabase db reset      # resets local DB and replays all migrations
   ```
3. **Run integration tests** (once 4.5+ are written):
   ```bash
   npx vitest run src/lib/auth/  # or wherever the auth tests land
   ```
4. **When the migration passes locally**, apply to the remote `lsl-platform` project via the account-scoped MCP:
   ```
   mcp__supabase__apply_migration with project_id="woxtujkxatosbirikxtq"
   ```
5. **Run advisors** after each remote apply:
   ```
   mcp__supabase__get_advisors(type="security")
   mcp__supabase__get_advisors(type="performance")
   ```
   Zero P0/P1 findings before moving on.
6. **Commit per task** (or per cluster of tightly-related tasks). Conventional message: `feat(E5.1-auth): Task 4.X — <description>`.

### Tasks 4.5 + 4.6 + 4.7 — the load-bearing tests

- **AC-AUTH-13 (cross-tenant test) is non-negotiable in CI.** Failure must block merges. This is the single most security-critical test in the whole slice.
- **AC-AUTH-14 (UNIQUE constraint on `org_members.user_id`)** enforces the one-org-per-signup decision from OQ-4.
- **AC-AUTH-1 (signup trigger atomicity)** verifies all four rows (`auth.users`, `organisations`, `org_members`, `auth_audit_log`) commit or roll back together.

---

## 3. Gotchas the prior session learned the hard way

1. **Branch ping-pong.** A sibling Claude session (TAS spec work) keeps writing to `.git/HEAD`. Symptoms: a fresh `Bash` call shows you on `main` or `docs/learnings-state-engine-pattern` without explanation. Recovery: `git checkout feat/E5.1-auth-slice` and continue. Working-tree edits carry across cleanly.

2. **Two Supabase MCPs.** Use the **account-scoped** one (`mcp__2ac7599f-...`) and pass `project_id="woxtujkxatosbirikxtq"` explicitly. The project-scoped MCP (`mcp__supabase__*`) is bound to a stale ref and won't reach the correct project until reconfigured.

3. **Next.js 16 quirks** (already handled for Tasks 5.1 + 5.2 — applies if you encounter Next.js APIs in Phase 4 too):
   - `middleware.ts` → `proxy.ts` (file is named `src/proxy.ts`)
   - `cookies()` from `next/headers` is async — `await cookies()`
   - `@supabase/ssr` v0.10.3 (beta but stable enough) — use `getAll`/`setAll` cookie shape, never the deprecated `get`/`set`/`remove`

4. **`getUser()` NOT `getClaims()`** for any auth check that needs `email_confirmed_at`. The JWT does not carry that field. DEV-AUTH-1 has the full rationale.

5. **DEV-AUTH-2 is RESOLVED.** Postgres AFTER-trigger atomicity is guaranteed by Postgres semantics — no application-level fallback needed for Task 4.4.

6. **No touching `src/engines/*` or calc fixtures.** That territory is owned by the parallel TAS engine work on the misnamed `005-lsl-platform-auth` branch.

7. **Git discipline (from `~/.claude/rules/global-engineering.md` and the project's rules):**
   - Stage files explicitly by name — never `git add .` or `git add -A`
   - Never `git push` or merge to main without operator instruction
   - Never commit secrets — `.env*` is gitignored except `.env.example`
   - Never `--no-verify`, never force-push, never amend pushed commits
   - One commit per task or per tight cluster; conventional messages

8. **When committing via heredoc fails on bash parsing**, use `git commit -F /tmp/commit-msg.txt` with a tempfile instead. Don't fight bash quoting.

---

## 4. Done criteria for the Phase 4 session

You can hand back to the operator with a clean "Phase 4 complete" message when ALL of these are true:

- [ ] DEV-AUTH-4 resolved in the impl-plan's Decisions Log and Open Issues table
- [ ] All 7 Phase 4 tasks marked DONE in `auth-tasks.md` with their AC checkboxes filled
- [ ] All 4 migration files exist in `website/supabase/migrations/` (forward-only — no `down.sql`)
- [ ] Local `supabase db reset` runs the migrations cleanly
- [ ] Remote `lsl-platform` project has the migrations applied via MCP `apply_migration`
- [ ] `mcp__supabase__get_advisors` reports zero P0/P1 findings (security + performance) on the remote project
- [ ] `npx vitest run` passes (full suite, including the new integration tests in Phase 4)
- [ ] `npm run build` passes (Next.js compile + TypeScript)
- [ ] Branch is `feat/E5.1-auth-slice` with one commit per task (or per phase milestone)
- [ ] Working tree is clean (no uncommitted Phase 4 changes)

After this lands, Phase 5 becomes fully unblocked and the next session can build the user-visible pages (signup form, login form, logout, placeholder home).

---

## 5. If you get stuck

- **A migration fails locally:** read the error carefully, fix the SQL, re-run `supabase db reset`. Forward-only migrations means you fix forward.
- **A migration fails remotely after passing locally:** something differs between environments. Check the Pro project's existing extensions (`mcp__supabase__list_extensions`) and any pre-existing tables in `public.*`. The provisioned project is fresh, so it should be empty under `public`.
- **Integration tests pass locally but you're not sure they'll pass in CI:** check the project's existing CI config under `.github/workflows/` and make sure the integration tests start a local Supabase in CI too. If they can't, downgrade those tests to "manual local only" and document the gap.
- **You need to make a decision the plan doesn't cover:** record it in the Decisions Log with a date, rationale, and the option NOT chosen. Don't push silent deviations.

---

*Generated by the previous Claude session (2026-05-27). Branch `feat/E5.1-auth-slice` at commit `3e2f405` is the state this handoff describes.*
