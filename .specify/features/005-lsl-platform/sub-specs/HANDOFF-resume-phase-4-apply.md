# HANDOFF — Apply Phase 4 migrations + run the integration tests

**Feature:** LSL Platform · Auth (E5.1 login slice)
**Branch to work on:** `feat/E5.1-auth-slice`
**Last session ended:** 2026-05-27 (Tracy's afternoon)
**Last commit before this handoff:** (filled in at commit time)
**Phase 4 status:** ✅ code complete (4 migrations + 3 integration tests + helper) / ⏳ apply + verify pending
**Tasks remaining in Phase 4:** apply migrations to remote project, run advisors, run integration tests once env is wired

The previous session (2026-05-27 morning) wrote all four Phase 4 migrations and three integration tests, but could not apply them to the remote Supabase project. Two blockers carried forward:

1. **`.env.local` Supabase keys are empty.** The file exists at `website/.env.local` (gitignored), but `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` all have zero-length values. Without these, the integration tests `describe.skipIf` themselves locally.

2. **Project-scoped Supabase MCP is bound to a stale ref.** `mcp__supabase__get_project_url` returns `https://jmicqilfcphneioemwjo.supabase.co`, NOT the `lsl-platform` URL `https://woxtujkxatosbirikxtq.supabase.co`. Until the MCP is rebound, `mcp__supabase__apply_migration` would land DDL on the wrong project.

Both blockers must be cleared before this session can ship.

---

## 0. First thing: orient yourself

Read these in order. Don't skip.

1. `CLAUDE.md` (project root) — engineering rules, agent routing, Supabase MCP-first rule
2. `.specify/features/005-lsl-platform/sub-specs/auth.md` — spec v1.0 APPROVED, especially §9 + §12
3. `.specify/features/005-lsl-platform/sub-specs/auth-impl-plan.md` — pay attention to the **Decisions Log**; the entries from 2026-05-27 lock the DEV-AUTH-4 resolution and the RLS-`(select auth.uid())` deviation from plan §2.2
4. `.specify/features/005-lsl-platform/sub-specs/auth-tasks.md` — Phase 4 tasks 4.1–4.7 are marked `✅ DONE (code) / ⏳ APPLY PENDING` (or `RUN PENDING` for the tests)
5. The four migration files in `website/supabase/migrations/` (20260527000001 through 20260527000004) — read them top to bottom before applying
6. `website/src/__tests__/auth/_helpers.ts` and the three Phase 4 test files in the same directory

Once you've read these, run `git log --oneline -10` to confirm where the previous session landed.

---

## 1. Clear the two blockers

### Blocker A — populate `website/.env.local`

The file exists; only the values are empty. Tracy fills it in from the Supabase dashboard:

1. Open https://supabase.com/dashboard/project/woxtujkxatosbirikxtq/settings/api
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` (should be `https://woxtujkxatosbirikxtq.supabase.co`)
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY` (treat as a password — server-side only)
3. Save `.env.local`. The file is already in `website/.gitignore`; verify with `git status -s -- website/.env.local` (must show nothing).

Verify the values load:

```bash
cd website
node -e "const {loadEnvConfig}=require('@next/env');loadEnvConfig('.');console.log('URL?',!!process.env.NEXT_PUBLIC_SUPABASE_URL,'SRK?',!!process.env.SUPABASE_SERVICE_ROLE_KEY,'ANON?',!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);"
```

Expected output: `URL? true SRK? true ANON? true`.

### Blocker B — rebind the Supabase MCP to `woxtujkxatosbirikxtq`

Tracy updates the project-scoped MCP config so `mcp__supabase__get_project_url` returns the `lsl-platform` URL. Typical location: `~/.claude/mcp.json` or per-project `.mcp.json` — look for a `supabase` server entry with `--project-ref jmicqilfcphneioemwjo` and replace with `--project-ref woxtujkxatosbirikxtq`. Restart Claude Code if needed.

**Sanity check before doing any DDL** — call `mcp__supabase__get_project_url`. If it still returns the stale ref, **STOP** and have Tracy reconfigure before applying anything. Applying migrations to the wrong project pollutes a different Supabase project and is not cleanly reversible.

**Fallback:** if MCP reconfiguration proves hard, you may apply the four migrations manually via the Supabase dashboard SQL editor (paste each `.sql` file in order into https://supabase.com/dashboard/project/woxtujkxatosbirikxtq/sql/new). Note the deviation in the Decisions Log if you take this path.

---

## 2. Apply the migrations

Once both blockers are cleared and `mcp__supabase__get_project_url` returns `https://woxtujkxatosbirikxtq.supabase.co`:

For each of the four migration files in `website/supabase/migrations/` (in numeric order — they have dependencies):

1. **Read the SQL** from the file.
2. **Apply via MCP:**
   ```
   mcp__supabase__apply_migration(name="<snake_case_name>", query="<sql contents>")
   ```
   Use a name like `create_organisations` (without the date prefix — the MCP timestamps internally).
3. **Verify the apply succeeded** by reading `mcp__supabase__list_tables(schemas=['public'])` after each. The four migrations should produce three tables (`organisations`, `org_members`, `auth_audit_log`) plus the helper function `tg_set_updated_at`, the trigger function `handle_new_user`, and the trigger `on_auth_user_created` on `auth.users`.
4. **Run advisors** after the final migration (not after each — one consolidated check is enough):
   ```
   mcp__supabase__get_advisors(type="security")
   mcp__supabase__get_advisors(type="performance")
   ```
   **Zero P0/P1 findings before moving on.** Expected baseline: the migrations use `(select auth.uid())` to avoid the `auth_rls_initplan` lint, RLS is enabled on all three tables, and audit-log has no client policies (which is intentional — confirm advisors don't flag this as a P0).

If an advisor flags something:
- P0 (security): stop, write a follow-on migration fixing the finding, apply, re-check.
- P1 (performance): assess; most likely a missing index. Add as a follow-on migration.
- P2 / info: log and continue.

---

## 3. Run the integration tests

With `.env.local` populated, the three Phase 4 suites should auto-enable:

```bash
cd website
npm test -- src/__tests__/auth/
```

Expected: 9 tests pass across 3 files (3 atomicity + 4 cross-tenant + 2 unique-constraint). If any fail:

- **Atomicity test failures** → the `handle_new_user` trigger didn't fire or didn't write all three rows. Inspect via `mcp__supabase__execute_sql("select count(*) from organisations;")` etc. The most likely cause is migration 4 didn't apply cleanly.
- **Cross-tenant test failures** → RLS policies aren't enforcing. This is AC-AUTH-13 and **non-negotiable**. Inspect the policies via `mcp__supabase__execute_sql("select * from pg_policies where schemaname='public';")`. Common issue: missing `(select auth.uid())` parens, policy `to authenticated` clause missing.
- **Unique-constraint test failures** → the UNIQUE on `org_members.user_id` didn't apply. Confirm via `mcp__supabase__execute_sql("select indexname, indexdef from pg_indexes where tablename='org_members';")` — you should see an automatic unique index named like `org_members_user_id_key`.

Each test cleans up its own `auth.users` rows via `auth.admin.deleteUser` (FK cascades remove org + membership). If tests crash mid-run, check `auth.users` for stragglers with `@e2e.lslcalculator.test` emails and delete via the dashboard.

---

## 4. Wire CI secrets (DevOps handoff or self-do)

The three Phase 4 suites need their secrets in CI to enforce AC-AUTH-13's "failure blocks merge" requirement.

Add to GitHub repo secrets (Settings → Secrets and variables → Actions):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Then update `.github/workflows/<vitest-job>.yml` to inject them into the test env:

```yaml
- name: Run vitest
  working-directory: website
  env:
    NEXT_PUBLIC_SUPABASE_URL:      ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
    SUPABASE_SERVICE_ROLE_KEY:     ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
  run: npm test
```

CI already sets `CI=true` automatically (GitHub Actions default), so the hard-throw at the top of each suite enforces the policy: missing secret = build red.

This is technically DevOps work — route to `@devops` if it's beyond your scope. The hard requirement is just that secrets land before the PR can merge.

---

## 5. Update auth-tasks.md and close Phase 4

Once advisors are clean and all 9 tests pass:

For each of Tasks 4.1–4.7, flip the remaining unchecked AC boxes (the "Applied to remote project" / "Test passes" / "Runs in CI" rows) and update the status header from `✅ DONE (code) / ⏳ APPLY PENDING` to a single `✅ DONE 2026-05-XX`.

Commit as: `feat(E5.1-auth): Phase 4 applied + tested — migrations live on lsl-platform, RLS green in CI`.

---

## 6. Done criteria for this session

You can hand back to Tracy with a clean "Phase 4 complete" message when ALL of these are true:

- [ ] `.env.local` has real Supabase keys for `lsl-platform`
- [ ] `mcp__supabase__get_project_url` returns the `lsl-platform` URL (or the deviation to dashboard-apply is recorded in the Decisions Log)
- [ ] Four migrations applied; `mcp__supabase__list_tables` shows `organisations`, `org_members`, `auth_audit_log` in `public`
- [ ] `mcp__supabase__get_advisors` reports zero P0/P1 findings on both `security` and `performance`
- [ ] All 9 Phase 4 integration tests pass locally (no skips)
- [ ] CI secrets configured; CI workflow injects them into the vitest job; a fresh CI run is green
- [ ] `npm run build` still passes
- [ ] All Phase 4 task headers in `auth-tasks.md` say `✅ DONE 2026-05-XX`
- [ ] Decisions Log gains a "Phase 4 applied" row noting the date and any incidental deviations
- [ ] Branch is `feat/E5.1-auth-slice`, PR open against `main`, latest commit pushed

After this lands, **Phase 5 is fully unblocked** — the next session can build the user-visible pages (signup, login, logout, placeholder home).

---

## 7. Carry-over gotchas (still active)

These were live in the previous handoff and remain live for this one:

1. **Branch ping-pong.** A sibling Claude session keeps writing to `.git/HEAD`. The previous session got flipped to `feat/E5-sa-cashout-topup` twice mid-work. Recovery: `git checkout feat/E5.1-auth-slice`. The sibling's uncommitted SA work (`website/src/lib/lsl/states/sa/*`, `website/src/components/lsl/result-panel.tsx`, etc.) is NOT yours — don't stage or commit it. Always `git add` files explicitly by name.

2. **Two Supabase MCPs.** The handoff from 2026-05-26 mentioned an "account-scoped" MCP (`mcp__2ac7599f-...`). In the 2026-05-27 session, only the project-scoped one (`mcp__supabase__*`) was loadable. If the account-scoped one becomes available again, prefer it (and pass `project_id="woxtujkxatosbirikxtq"` explicitly to every call).

3. **Next.js 16 quirks** (`proxy.ts` not `middleware.ts`; async `cookies()`; `@supabase/ssr` getAll/setAll). Not directly relevant to Phase 4 but stays relevant for Phase 5.

4. **`getUser()` NOT `getClaims()`** for any auth check that needs `email_confirmed_at`. The JWT does not carry that field.

5. **No touching `src/engines/*` or calc fixtures.** That territory is owned by the parallel TAS/SA cashout engine work.

6. **Git discipline** (from `~/.claude/rules/global-engineering.md` and the project's rules) — stage explicitly, no `git add .`, no `--no-verify`, no force-push, no commits without explicit instruction.

7. **`heredoc` commits sometimes fail on bash parsing** — use `git commit -F /tmp/commit-msg.txt` with a tempfile instead. Don't fight bash quoting.

---

*Generated by the 2026-05-27 morning Claude session. Branch `feat/E5.1-auth-slice` carries Phase 4 code; the apply + verify is the only remaining work to close Phase 4.*
