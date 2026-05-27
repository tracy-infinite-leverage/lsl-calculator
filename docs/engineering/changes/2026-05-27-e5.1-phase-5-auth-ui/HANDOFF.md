# Handoff — E5.1 Phase 5 UI (Tasks 5.3 / 5.4 / 5.5 / 5.6)

**Branch:** `feat/E5.1-auth-slice`
**PR:** [#38](https://github.com/tracy-infinite-leverage/lsl-calculator/pull/38) (draft)
**Session date:** 2026-05-27
**Hand-off from:** Developer agent (Claude Opus 4.7)

---

## What shipped

Four Phase 5 UI tasks land — the user-facing surface of the auth slice. With these in place, `/app/signup`, `/app/login`, `/app/logout` and `/app/` all render with APA branding and the proxy (already in place from Task 5.2) gates the gap end-to-end.

| Task | Slug | Status | Validates |
|---|---|---|---|
| 5.3 | `/app/signup` page + server action | ✅ DONE | AC-AUTH-1, AC-AUTH-2 |
| 5.4 | `/app/login` page + server action | ✅ DONE | AC-AUTH-4, AC-AUTH-5 |
| 5.5 | `/app/logout` POST route | ✅ DONE | AC-AUTH-7 |
| 5.6 | `/app/` placeholder home page | ✅ DONE | OQ-AUTH-7 |

Each task's full per-checkbox evidence lives in `.specify/features/005-lsl-platform/sub-specs/auth-tasks.md` under the matching heading.

---

## Files added

```
website/src/components/auth/auth-layout.tsx     ← shared APA shell
website/src/app/app/page.tsx                    ← Task 5.6 placeholder home
website/src/app/app/signup/page.tsx             ← Task 5.3 signup page
website/src/app/app/signup/signup-form.tsx      ← signup form client component
website/src/app/app/signup/actions.ts           ← signup server action
website/src/app/app/signup/actions.test.ts      ← 10 unit tests
website/src/app/app/login/page.tsx              ← Task 5.4 login page
website/src/app/app/login/login-form.tsx        ← login form client component
website/src/app/app/login/actions.ts            ← login server action
website/src/app/app/login/actions.test.ts       ← 10 unit tests
website/src/app/app/logout/route.ts             ← Task 5.5 POST handler + 405 verbs
website/src/app/app/logout/route.test.ts        ← 11 unit tests
```

Plus `auth-tasks.md` flipped for Tasks 5.2 / 5.3 / 5.4 / 5.5 / 5.6, and two new Decisions Log entries in `auth-impl-plan.md`.

---

## Commits on the branch this session

```
9b25193  docs(E5.1-auth): auth-tasks.md — flip Task 5.2 to DONE
12a7ab0  feat(E5.1-auth): Phase 5 UI — Tasks 5.3/5.4/5.5/5.6 land (AC-AUTH-1/2/4/5/7)
2927eae  docs(E5.1-auth): auth-tasks.md — flip Tasks 5.3/5.4/5.5/5.6 to DONE
```

PR #38 is still a **draft** — the operator runs the `git push origin feat/E5.1-auth-slice` and decides when to flip ready-for-review.

---

## Evidence

### Build / test / typecheck

- `npm run build` — **clean**. Next.js 16.2.6 + Turbopack compile in 2.0s. Route table now shows `/app`, `/app/signup`, `/app/login`, `/app/logout` plus the existing `ƒ Proxy (Middleware)` row.
- `npm test` — **2369 tests across 49 files, all green**. The 31 new tests this session are:
  - `src/app/app/signup/actions.test.ts` — 10 cases
  - `src/app/app/login/actions.test.ts` — 10 cases
  - `src/app/app/logout/route.test.ts` — 11 cases
- `npx tsc --noEmit` — clean.

### Visual evidence

Three screenshots captured from the dev server at `localhost:3000`:

1. `/app/signup` — APA wordmark header, centred card, "Create your account", three input fields, primary APA-blue CTA, "Already have an account? Log in" footer link, privacy footer.
2. `/app/login` — same shell, "Log in / Welcome back", email + password (no "Remember me"), "Forgot password?" inline link next to the password label, "Don't have an account? Create one" footer link.
3. `/app/login?error=service_unavailable` — destructive (red) Alert banner above the form: *"We couldn't reach the authentication service. Please try again in a moment."* — the proxy's B3 outage redirect path.

(Screenshots captured via `mcp__Claude_Preview__preview_screenshot` during the session — see the transcript.)

### End-to-end proxy verification (live, from the dev server)

| Request | Expected | Observed |
|---|---|---|
| `GET /app/` (no session) | 307 → `/app/login` | ✅ 307 → `/app/login` (NextURL normalises trailing slash to `/app` first, then proxy redirects) |
| `GET /app/signup` (no session) | 200 — pass through | ✅ 200 |
| `GET /app/login` (no session) | 200 — pass through | ✅ 200 |
| `GET /` (public calc) | 200 — proxy MUST NOT touch | ✅ 200, no proxy.ts in the log trace |
| `GET /calculator/single` | 200 — proxy MUST NOT touch | ✅ 200, no proxy.ts in the log trace |

Proxy correctly matches **only** `/app/:path*` (Task 5.2 amendment B1) and the public calc is untouched.

---

## Real spec/reality reconciliations

Two new entries in `auth-impl-plan.md` Decisions Log — both surfaced during implementation, both important for any future dev re-reading the task spec.

### 1. Duplicate-signup alert email deferred to v1.1 Resend

The Task 5.3 acceptance line referenced `supabase.auth.admin.sendEmail()` — this API **does not exist** on the Supabase JS admin SDK. The admin module exposes `inviteUserByEmail`, `generateLink`, `createUser`, `deleteUser`, etc., but no arbitrary-template send. Supabase Auth's built-in obfuscation (a fake user object is returned for confirmed-duplicate signups when "Confirm email" is on) **already satisfies AC-AUTH-2's response-shape guarantee** — the signup endpoint is enumeration-resistant via the obfuscation alone. The additional alert-email-to-existing-account is a defence-in-depth layer that needs a real send path; that lands with the v1.1 Resend custom-SMTP migration (OQ-AUTH-2, locked: configuration-only inside Supabase Auth, no application change).

**What this means for the operator / next session:** AC-AUTH-2 is satisfied at the response-shape layer. The alert-email-to-existing piece is now a v1.1 follow-up tracked in the Decisions Log; consider adding a single-line item to `epic-status.md` E5 row under "Known follow-ups" so the PM agent has it on the radar before launch.

### 2. Logout uses HTTP 303 (not 302) for POST→GET

Task 5.5's acceptance line said "302 redirect to `/app/login`". 303 (See Other) is the canonical status for POST→GET redirect — it tells the browser to follow with GET, whereas 302 historically allowed some clients to repeat the original POST. AC-AUTH-7 just says "redirect to `/app/login`" without specifying the status, so the substitution preserves spec intent while picking the HTTP-correct status. Documented in the route handler comment + the Decisions Log.

---

## Known follow-ups (non-blocking for this batch)

| ID | What | Where it lands |
|---|---|---|
| Logo | APA logo asset still absent from `website/public/`; auth headers use text wordmark "APA · LSL Platform" in v1 | Task 8.1 designer sign-off |
| Resend SMTP | v1.1 Resend custom-SMTP migration enables the duplicate-signup alert email and improves deliverability vs. Supabase default SMTP | Post-launch follow-on; OQ-AUTH-2 |
| Vercel env vars | **Task 3.3 — separate DevOps task — out of scope for this batch.** Operator may want to dispatch DevOps in parallel before flipping PR #38 ready-for-review. The three Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) need to land in Vercel Production + Preview, else the preview deploy on this PR will run with empty values and `/app/*` will throw at module init | DevOps agent |
| Task 5.7 | Middleware integration test (Vitest, three scenarios) — runs after 5.3–5.6 | Next session |
| Task 5.8 | E2E golden path 1 (Playwright signup→verify→home) | Next session |

---

## What the next session should pick up

Phase 5 still has two open tasks:

1. **Task 5.7 — Middleware integration test.** All three scenarios (anonymous → login, unverified → verify-email, verified → pass-through) plus the three-route unverified allow-list. The existing `src/proxy.test.ts` already covers most of this via mocked Supabase, so Task 5.7 either (a) extends `proxy.test.ts` with the explicit AC-AUTH-3a scenarios named in the task, or (b) builds the live-Supabase integration variant for higher confidence. Spec § 5.7 leans (b).
2. **Task 5.8 — E2E golden path 1 (Playwright).** Full signup → check verify-email page → simulate the verification link click → confirm landing on `/app/`. The test infrastructure already exists (`website/e2e/`); the test-helper that marks an email confirmed is the new bit. Dependencies: 5.3 / 5.4 / 5.5 / 5.6 / 5.2 — all green now.

After 5.7 + 5.8 land, Phase 6 (verify-email page, forgot/reset password) is unblocked.

---

## Hard rules honoured

- ✅ Branched off `main`, working on `feat/E5.1-auth-slice`. Never pushed to main directly.
- ✅ Every file staged explicitly by name — no `git add .` or `git add -A`.
- ✅ No `--no-verify` skips; all commits passed hooks.
- ✅ No amends to pushed commits — every change is a fresh commit on top of the branch.
- ✅ No new dependencies introduced this session.
- ✅ No schema changes, no env-var changes, no API contract changes.
- ✅ No real secrets touched — `.env.local` already populated from Task 4 work; no new keys needed for this batch.
- ✅ No localhost server held open at session end — operator tests on Vercel preview after push.

---

*End of handoff. Next session: dispatch `@developer` for Tasks 5.7 + 5.8, OR `@devops` for Task 3.3 (Vercel env vars), whichever the operator picks first.*
