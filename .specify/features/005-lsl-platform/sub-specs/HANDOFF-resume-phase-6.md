# HANDOFF — Resume the LSL auth slice at Phase 6 (verification + password reset)

**Feature:** LSL Platform · Auth (E5.1 login slice)
**Branch to work on:** `feat/E5.1-auth-slice-phase-6`
**Active PR:** [#67](https://github.com/tracy-infinite-leverage/lsl-calculator/pull/67) (draft)
**Last session ended:** 2026-05-27 (after PR #38 merge — 20/47 tasks shipped)
**Latest commit on this branch:** `d966d5c chore(E5.1): scaffold Phase 6 PR — verification + password reset + Phase 5 tail`
**Tasks complete (cumulative on main):** 20 of 47 (Phases 1, 3, 4 + Tasks 5.1–5.6)
**Tasks in this session:** 8 (Phase 5 tail 5.7 + 5.8, Phase 6 6.1–6.6)

---

## 0. First thing: orient yourself

Read these in order. Don't skip.

1. `CLAUDE.md` (project root) — engineering rules and agent routing
2. `.specify/features/005-lsl-platform/sub-specs/auth.md` — spec v1.0 APPROVED
   - Pay special attention to §7.5 (unverified-session model), §8 (password reset token lifecycle), §10 (email infrastructure)
3. `.specify/features/005-lsl-platform/sub-specs/auth-impl-plan.md` — impl plan
   - Decisions Log at the bottom binds your work. DEV-AUTH-4 was resolved during Phase 4 (PR #38).
4. `.specify/features/005-lsl-platform/sub-specs/auth-tasks.md` — 47 tasks; 20 marked DONE
5. `website/AGENTS.md` — Next.js 16 quirks + Supabase config
6. PR #67 body — full scope + AC mapping for this session

Then `git log --oneline -10` on `feat/E5.1-auth-slice-phase-6` to see what's already on the branch (currently just the marker commit).

---

## 1. Phase 6 — the work itself

Eight tasks. Spec contracts: §7.1 (routes), §7.2 (required form states), §7.5 (unverified-session model + resend rate-limit), §8 (token lifecycle), §10 (email infra), §12 (ACs).

| Task | Title | Effort | Depends on |
|---|---|---|---|
| 5.7 | Integration test — middleware (`proxy.ts`) gating verified via AC-AUTH-3a | M | Task 5.2 (shipped in PR #38) |
| 5.8 | E2E golden path 1 — signup → verify → home | L | 5.7 + 6.1 |
| 6.1 | `/app/verify-email` page + resend action | M | Task 5.2 + 5.4 (both shipped) |
| 6.2 [P] | `/app/forgot-password` page + server action | M | Task 5.4 (shipped) |
| 6.3 [P] | `/app/reset-password` page + server action | M | 6.2 |
| 6.4 | Customise Supabase Auth email templates with APA branding | M | docs/brand/style-guide.md (Designer-owned) |
| 6.5 [P] | Integration test — reset token expiry + reuse | S | 6.3 |
| 6.6 [P] | Integration test — verification resend rate limit | S | 6.1 |

### Workflow per task

1. **Read the task's spec ACs first.** Every task in `auth-tasks.md` cites the AC it satisfies — read that AC in `auth.md` §12 before writing code.
2. **TDD where the test is cheap.** Tasks 5.7, 6.5, 6.6 are integration tests by definition — write them red, then make them green. Task 5.8 is Playwright — same pattern.
3. **Server actions over API routes** for form submissions, per the Next.js 16 + auth-impl-plan §3 convention already used in Tasks 5.3 + 5.4.
4. **Rate-limit logic** (Tasks 6.1 + 6.6) — implement via Supabase Auth's built-in resend rate-limits where possible (1/60s, 5/24h per `user_id`). If the built-in doesn't expose the exact tunables we need, add an application-level guard with a `verification_resend_log` table — design decision goes in the impl-plan Decisions Log first.
5. **Commit per task or per tight cluster.** Conventional message: `feat(E5.1-auth): Task 6.X — <description>`.

### Task 6.4 — email templates (the only non-code task)

This task is configuration in the Supabase dashboard, not code. Workflow:

1. Read `docs/brand/style-guide.md` for APA colours / typography / voice
2. Open the Supabase dashboard for project `woxtujkxatosbirikxtq` → Authentication → Email Templates
3. Customise three templates: **Confirm Signup**, **Reset Password**, and **Magic Link** (the last one is disabled per OQ-3 but still needs the APA shell in case it accidentally fires)
4. Add a 4th template variant for the **alert-on-duplicate-signup** email per §7.3 — this may need to be sent via a separate channel (Supabase auth events → Edge Function) if the standard templates don't cover it
5. Verify by triggering each email in a test signup flow and screenshotting for the QA agent
6. Document in the auth-impl-plan Decisions Log under the Email Templates heading — what template variants exist, what bound variables they expect

### Task 5.8 — Playwright E2E

The first true end-to-end test for the platform. Workflow:

1. New file: `website/tests/e2e/auth-signup-verify-home.spec.ts` (or wherever Playwright tests already live)
2. Test against a local Supabase stack (DEV-AUTH-4 resolved this in Phase 4 — local `supabase start`)
3. Steps the test exercises:
   - POST `/app/signup` with fresh email + strong password
   - Assert: redirected to `/app/verify-email`
   - Read the verification link from the local SMTP catcher (Mailhog or equivalent that Supabase local stack provides)
   - GET the verification link
   - Assert: redirected to `/app/`
   - Assert: page shows "Welcome — platform under construction" placeholder (per OQ-AUTH-7)
4. Add to `.github/workflows/ci.yml` Playwright matrix if not already covered by the existing chromium/webkit/firefox/mobile-chrome shards

---

## 2. Gotchas — carry-forward from Phase 4 and earlier

These all still apply. Read them before you start coding.

1. **Branch ping-pong.** Sibling Claude sessions writing to `.git/HEAD` will swap you onto unrelated branches without warning. Recovery: `git checkout feat/E5.1-auth-slice-phase-6` and continue. Working-tree edits carry across.

2. **Two Supabase MCPs.** Use the **account-scoped** one (`mcp__2ac7599f-...`) and pass `project_id="woxtujkxatosbirikxtq"` explicitly. The project-scoped MCP (`mcp__supabase__*`) is bound to a stale ref.

3. **Next.js 16 quirks:**
   - File is `src/proxy.ts`, not `middleware.ts`
   - `cookies()` from `next/headers` is async — `await cookies()`
   - `@supabase/ssr` v0.10.3 — use `getAll` / `setAll` cookie shape only

4. **`getUser()` NOT `getClaims()`** for any auth check needing `email_confirmed_at`. The JWT does not carry that field.

5. **No touching `src/lib/lsl/*` engine or fixtures.** Parallel work continues on NT engine + other state engines. Stay clear.

6. **CI is on Node 22** as of commit `6ecbec7` (PR #38). Don't assume Node 20.

7. **Git discipline:**
   - Stage files explicitly by name — never `git add .` or `git add -A`
   - Never `git push` to main; PR only
   - Never commit secrets (`.env*` gitignored except `.env.example`)
   - Never `--no-verify`, never force-push, never amend pushed commits
   - One commit per task or per tight cluster; conventional messages

8. **Bash heredoc + backticks in commit messages can fail.** Use `git commit -F /tmp/commit-msg.txt` if `-m "$(cat <<EOF...)"` errors out.

---

## 3. Done criteria for this session

Hand back with a clean "Phase 6 complete" message when ALL of these are true:

- [ ] All 8 tasks (5.7, 5.8, 6.1–6.6) marked DONE in `auth-tasks.md` with AC checkboxes filled
- [ ] `npx vitest run` passes (full suite, including new integration tests)
- [ ] Playwright E2E golden path 1 passes locally and in CI
- [ ] `npm run build` passes (Next.js compile + TypeScript)
- [ ] All 4 Supabase Auth email templates carry APA branding (verified by a screenshot or trigger-and-receive test)
- [ ] PR #67 has all check runs green on the latest push
- [ ] Branch is `feat/E5.1-auth-slice-phase-6` with one commit per task (or per cluster)
- [ ] Working tree clean (no uncommitted Phase 6 changes)
- [ ] Decisions Log in `auth-impl-plan.md` updated if any new decisions were made
- [ ] Mark PR #67 **ready** when all the above pass

After this lands, Phase 7 (account page + delete-account + 7-day grace + scheduled purge) becomes the next session's work.

---

## 4. If you get stuck

- **Server actions returning unexpected types:** check the Next.js 16 server-action signature changes; `useActionState` (formerly `useFormState`) has updated semantics. The impl-plan §3 has the chosen pattern.
- **Supabase Auth resend rate-limit not honouring our 1/60s + 5/24h:** check the Supabase Auth project settings via MCP. If the built-in granularity isn't enough, fall through to an application-level guard (see §1 Workflow step 4 above).
- **Reset token redemption succeeds twice in a test:** Supabase Auth should invalidate after first use — if it isn't, check that you're actually using `verifyOtp` with `type='recovery'` and not just a raw redirect.
- **APA-branded email templates not rendering:** Supabase Auth emails use a constrained HTML subset. If a CSS rule isn't applying, fall back to inline styles. Document in the Decisions Log.
- **CI fails on a check that passed locally:** check Node version (CI is on 22 per `ci.yml`), check the test config doesn't depend on local-only environment variables, run `supabase start` locally to mirror CI's local-stack approach.
- **You need a decision the plan doesn't cover:** record it in the Decisions Log with date + rationale + option NOT chosen. Don't push silent deviations.

---

*Generated by the Claude Code dev workflow on 2026-05-27. Supersedes `HANDOFF-resume-phase-4.md` (deleted same commit — Phase 4 shipped inside PR #38).*
