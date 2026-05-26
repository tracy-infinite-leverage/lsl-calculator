# Implementation Plan — LSL Platform · Auth (Login slice of E5.1)

**Slug:** `lsl-platform-auth`
**Spec:** `.specify/features/005-lsl-platform/sub-specs/auth.md` v1.0 APPROVED 2026-05-26
**Plan version:** v1.0 (drafted 2026-05-26)
**Author:** Developer agent (via `dev-feature-plan`)
**Status:** Draft — pending dev review before tasks generation

---

## Phase 0 — Pre-Planning Decisions

No `dev-findings.md` accompanied this spec. The spec is fully approved (all 7 OQs resolved 2026-05-26) and includes precise data-model, route, and security definitions in §§4–9 and §§11–12.

**Decisions inherited from the spec (no new decisions required):**

| Inherited decision | From | Implication for plan |
|---|---|---|
| Supabase Auth, email/password only | OQ-3, OQ-AUTH-1, OQ-AUTH-4 | No alternate provider work; no OAuth/SSO/magic-link code paths. |
| `@supabase/ssr` (NOT `auth-helpers-nextjs`) | §5 | One known package to install; cookie-based session model. |
| Supabase Auth default SMTP in v1 | OQ-AUTH-2 | Zero new email-vendor wiring; Resend migration is v1.1 config-only. |
| Auto-login on signup → unverified session | OQ-AUTH-4 + §7.5 | Middleware enforces unverified gating, not a redirect-to-login. |
| Default org name = `<email-local>'s Organisation` | OQ-AUTH-6 | No org-naming UI in signup form. |
| Placeholder `/app/` post-login landing acceptable | OQ-AUTH-7 | "Welcome — platform under construction" stub satisfies redirect. |
| 7-day grace on account deletion = 7-day grace on org deletion (same primitive) | OQ-AUTH-5 + AC-AUTH-12 | One scheduled hard-delete job; no separate user-vs-org delete paths. |

**Open decisions left to the dev agent at impl-plan time (per spec §8):**

1. **Atomic signup trigger mechanism**: Postgres `AFTER INSERT` trigger on `auth.users` vs Supabase Auth `handle_new_user` function vs server-route call from `/app/signup` POST handler. **Plan recommendation: Postgres `AFTER INSERT` trigger on `auth.users`** — the standard Supabase pattern; runs in the same transaction as the auth.users insert; cannot be bypassed by a misbehaving client; testable via SQL.
2. **CSRF defence**: double-submit cookie vs `@supabase/ssr` SameSite=Lax + Origin header check. **Plan recommendation: SameSite=Lax + Origin/Referer header check** — `@supabase/ssr` sets SameSite=Lax by default; adding an Origin header check in middleware on all POSTs to `/app/*` is one small additional file vs maintaining a CSRF-token store. Re-evaluate at security review (§Phase 9).
3. **Scheduled hard-delete job runtime**: Supabase Edge Function on cron vs Vercel cron route. **Plan recommendation: Supabase Edge Function on `pg_cron` schedule** — keeps the job co-located with the database it mutates; survives Vercel deploy churn; one less Vercel cron consuming the project's quota.

These three picks are recorded here, then validated in Phase 1; any change moves to a Phase-1 decision log entry before tasks are written.

---

## Phase 1 — Outline & Research

### 1.1 What gets built in v1 (this plan)

| Capability | Spec AC | Notes |
|---|---|---|
| Email + password signup with atomic org + admin-membership creation | AC-AUTH-1, AC-AUTH-14 | Postgres trigger pattern. |
| Email-enumeration-resistant signup (same UI for new + duplicate; alert email to existing) | AC-AUTH-2 | Server-side branch on duplicate email check. |
| Email verification flow with `email_confirmed_at` gating | AC-AUTH-3 | Supabase Auth verification link → middleware unblocks. |
| Unverified-session model — middleware gating, resend, account-page subset, password-change block | AC-AUTH-3a | The load-bearing security requirement of the slice. |
| Email + password login with HttpOnly cookies, 60-min access TTL, 30-day refresh TTL | AC-AUTH-4 | No "Remember me". |
| Generic invalid-credential error + per-(email,IP) lockout after 5 fails / 15 min | AC-AUTH-5, AC-AUTH-6 | Supabase Auth rate-limit config + a unified error code path. |
| Logout (POST) | AC-AUTH-7 | Refresh + access token revoked server-side and cleared client-side. |
| Forgot-password (enumeration-resistant) + reset-password (single-use, 60-min TTL) | AC-AUTH-8, AC-AUTH-9, AC-AUTH-10 | Supabase Auth built-in; invalidate other sessions on reset. |
| Account page — view email, change password (verified only), delete account | AC-AUTH-11, AC-AUTH-12 | Restricted subset of UI while unverified. |
| Account deletion → 7-day grace → hard-delete job | AC-AUTH-12 | `delete_scheduled_at`/`deleted_at` columns + scheduled job + login-cancels-deletion path. |
| RLS on `organisations`, `org_members`, `auth_audit_log` | AC-AUTH-13, §9.3 | Cross-tenant test in CI is non-negotiable. |
| `auth_audit_log` rows for every auth event | §8 last row | Service-role insert; no application read. |
| Privacy notice revised to cover platform-tier auth data | AC-AUTH-16 | Single content update; routes to web-publisher only after Designer signs off. |
| APA branding on all `/app/*` pages and on Supabase Auth email templates | AC-AUTH-15 | Designer agent owns; precondition on `docs/brand/style-guide.md`. |

### 1.2 What's deferred (rest of E5.1 or later)

- Invite flow, `payroll_user` and `read_only` roles, multi-user-per-org admin actions
- MFA, SSO, OAuth, magic links
- Multi-org-per-user
- Org tombstone receipt UI
- Email-change UI (`/app/account` is view-only on email in this slice)
- Resend custom-SMTP migration (v1.1; configuration-only)
- Real `/app/` home page (placeholder ships with this slice)

### 1.3 Research & validation needed before Phase 2

Three concrete items must be validated before opening implementation tasks. Each is short and time-boxed.

| Item | What we're confirming | How | Time |
|---|---|---|---|
| **R1. `@supabase/ssr` cookie + middleware pattern on Next.js 16 / React 19** | Verify `@supabase/ssr` is current package and not deprecated by Supabase as of 2026-05-26. Confirm middleware-side `createServerClient` + `getUser()` works for the unverified-gate use case. | Read [supabase.com/docs/guides/auth/server-side/nextjs](https://supabase.com/docs/guides/auth/server-side/nextjs); confirm the example reads `email_confirmed_at` from `auth.users`. Spike if docs are unclear. | S (≤1h) |
| **R2. Postgres trigger-based atomic org creation** | Confirm the `handle_new_user` trigger pattern works with Supabase Auth's `auth.users` insert and runs inside the same transaction. | Read Supabase auth schema docs; check the official "Add fields to user table" guide. Confirm the trigger sees the inserted `auth.users` row and can write to `public.organisations` + `public.org_members` from a `SECURITY DEFINER` function. | S (≤1h) |
| **R3. Supabase Auth breach-list (HIBP) toggle** | Confirm the v4+ Supabase Auth password-strength config exposes the HIBP toggle in v1 dashboards. If not, fall back to a server-side check in `/app/signup` and `/app/reset-password` POST handlers (against the HIBP k-anon API). | Inspect the Supabase project's auth config in the dashboard once R0 (project provisioned) is done. | S (≤30m) |

If R2 fails (the trigger pattern doesn't work atomically), the fallback is a server-route POST handler that performs all three inserts in a single transaction via the service role. This costs ~30min of additional code and is the only material plan-shifter on the research list.

### 1.4 Risks & assumptions

| ID | Risk / Assumption | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R-A1** | The APA design system at `docs/brand/style-guide.md` is not yet coded. Auth pages cannot ship un-branded. | Medium | Blocks visible release | Phase 2 includes a **precondition task** for `designer-design-system` to publish base tokens (colour, typography, spacing) before any `/app/*` page is built. Auth UX can scaffold against placeholder tokens; final brand pass is a Phase 8 task. |
| **R-A2** | Supabase Auth default SMTP deliverability is patchy for some recipients (gmail.com sometimes greylists). **Plus:** v1 sender is a Supabase-owned domain (e.g. `noreply@mail.app.supabase.io`), NOT `noreply@lslcalculator.com.au` — spec §10's `noreply@lslcalculator.com.au` from-address is aspirational and only lands with v1.1 Resend custom SMTP. Reply-to is customisable in v1. | Medium | Frustrating signup UX + brand-from-address mismatch until v1.1 | Spec accepts default SMTP for v1 (OQ-AUTH-2). Add a "didn't get the email?" link on `/app/verify-email` that triggers resend. Track delivery failure rates via Supabase logs. **Brand-from-address discrepancy flagged to PM standup** so the gap is recorded against spec §10. Task 6.4 acceptance now states the v1 reality explicitly. |
| **R-A3** | The Postgres trigger fires but creates a partial state if `org_members` insert fails after `organisations` insert. | Low | Orphaned org row | Wrap the `handle_new_user` function body in a single transaction (default in PL/pgSQL); add a sanity test that asserts `organisations` count equals `org_members.role='admin'` count. |
| **R-A4** | A malicious user logs in within the 7-day grace to cancel deletion infinitely. | Low | Account never actually deletes | Per spec: cancelling is the intended UX. No mitigation needed — this is the design. |
| **R-A5** | The middleware on `/app/*` accidentally allow-lists too much or too little, leaking an unverified user into a data page. | Medium | Security regression | The middleware allow-list is **three hard-coded routes**: `/app/verify-email`, `/app/account`, `/app/logout`. Tests assert any other `/app/*` redirects unverified users to `/app/verify-email`. Cross-tenant test in CI also runs the unverified-redirect assertion. |
| **R-A6** | Vercel free-tier cron limit is reached if hard-delete job uses Vercel cron. | Low | Delete job stops running | Plan recommends Supabase Edge Function + `pg_cron` (decision in Phase 0). If that proves infeasible, fall back to Vercel cron with a single daily run at 03:00 UTC. |
| **R-A7** | `auth_audit_log` rows accumulate without rotation and bloat the database. | Low | Storage cost | Out of scope for v1. Add a follow-up ticket in the umbrella E5.1 epic for "audit-log retention policy" — 12-month rolling window is the default plan, but not for this slice. |
| **R-A8** | The breach-list (HIBP) check is a network call on every signup/reset and could be a latency tail. | Low | Slow signup | Supabase's built-in HIBP check is async server-side; if R3 forces us to roll our own, use the HIBP k-anonymity API which returns in <300ms typically. Cache nothing — passwords change. |
| **R-A9** | Resend domain (`lslcalculator.com.au`) isn't yet configured for SPF/DKIM/DMARC; v1.1 migration blocks on this. | Medium | v1.1 follow-on delayed | Not a v1 risk. DevOps agent owns this work pre-v1.1. Tracked in epic-status. |
| **R-A10** | A user enters a passphrase with leading/trailing whitespace that Supabase Auth normalises differently from expectation. | Low | Login fails after signup with same password | Test with whitespace-containing passwords. Confirm Supabase Auth does not strip. Spec §6 says all Unicode + spaces allowed per ASVS V2.1.4–5. |

### 1.5 Out-of-scope confirmation (sanity check before Phase 2)

Anything below is **not** in this plan; trying to address it triggers a scope grill before proceeding:
- A multi-user invite UI (deferred per spec §3)
- Role assignment beyond `admin` (deferred)
- An org-rename page (deferred — admin page is view-only on org name)
- A user-profile page beyond email + change-password + delete-account
- Any tenant table beyond `organisations`, `org_members`, `auth_audit_log`
- Customer-facing analytics, billing, or session-management UI ("active sessions" list)

---

## Phase 2 — Design & Contracts

### 2.1 System architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React 19 — Next.js 16 client components)      │
│   • /app/signup  /app/login  /app/forgot-password       │
│   • /app/reset-password  /app/verify-email              │
│   • /app/account  /app/  (placeholder)                  │
│   • supabase-js client (browser, anon key)              │
└───────────────┬─────────────────────────────────────────┘
                │  HTTPS — HttpOnly Secure SameSite=Lax cookies
                ▼
┌─────────────────────────────────────────────────────────┐
│  Next.js 16 server (Vercel)                             │
│   • middleware.ts → @supabase/ssr session check         │
│     unverified gate on /app/* (allow-list = 3 routes)  │
│   • Route handlers: /app/logout (POST), /api/auth/...   │
│   • Server components read session via createServerClient│
└───────────────┬─────────────────────────────────────────┘
                │  Supabase JS SDK
                ▼
┌─────────────────────────────────────────────────────────┐
│  Supabase                                               │
│   • Auth (email/password, HIBP breach check, JWT)       │
│   • Postgres                                            │
│     ├─ auth.users (managed by Supabase Auth)            │
│     ├─ public.organisations (with deleted_at,           │
│     │   delete_scheduled_at)                            │
│     ├─ public.org_members (admin role, UNIQUE user_id)  │
│     └─ public.auth_audit_log (service-role-only)        │
│   • RLS policies on all public.* tenant tables          │
│   • handle_new_user trigger (SECURITY DEFINER)          │
│   • Edge Function `purge-expired-orgs` on pg_cron daily │
│   • Default SMTP for verification/reset/alert emails    │
└─────────────────────────────────────────────────────────┘
```

**Boundaries:**
- The browser never sees the service role key. Only the anon key.
- The `handle_new_user` trigger runs as `SECURITY DEFINER`; nothing in the application impersonates the service role from the browser.
- The middleware is the **only** unverified-session gate. RLS is the second line of defence — never the only one.

### 2.2 Data model (final DDL contract)

The spec §9 already nails the column set. The DDL below is the binding contract for the developer; deviating requires a plan amendment.

```sql
-- 2.2.1  organisations
create table public.organisations (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  delete_scheduled_at   timestamptz
);

create trigger organisations_set_updated_at
  before update on public.organisations
  for each row execute procedure public.tg_set_updated_at();

-- 2.2.2  org_members
create table public.org_members (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organisations(id) on delete cascade,
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  role         text not null check (role in ('admin','payroll_user','read_only')),
  joined_at    timestamptz,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id)
);

-- 2.2.3  auth_audit_log
create table public.auth_audit_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  event_type   text not null,
  ip           inet,
  user_agent   text,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

-- 2.2.4  signup trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  new_org_id uuid;
  default_name text;
begin
  default_name := split_part(new.email, '@', 1) || '''s Organisation';
  insert into public.organisations (name) values (default_name) returning id into new_org_id;
  insert into public.org_members (org_id, user_id, role, joined_at)
    values (new_org_id, new.id, 'admin', now());
  insert into public.auth_audit_log (user_id, event_type, metadata)
    values (new.id, 'signup', jsonb_build_object('org_id', new_org_id));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

**RLS policies (final binding contract):**

```sql
alter table public.organisations enable row level security;
alter table public.org_members enable row level security;
alter table public.auth_audit_log enable row level security;

-- organisations
create policy "members read own org" on public.organisations for select using (
  id in (select org_id from public.org_members where user_id = auth.uid())
);
create policy "admin update own org" on public.organisations for update using (
  id in (select org_id from public.org_members where user_id = auth.uid() and role = 'admin')
) with check (
  id in (select org_id from public.org_members where user_id = auth.uid() and role = 'admin')
);
-- no insert / delete from client; trigger + service-role only.

-- org_members
create policy "members read own membership" on public.org_members for select using (
  user_id = auth.uid()
);
-- no insert / update / delete from client in this slice.

-- auth_audit_log — service-role-only; no policies for anon/authenticated.
```

### 2.3 Routes (final contract)

| Route | File | Method | Body / Params | Response |
|---|---|---|---|---|
| `/app/signup` | `src/app/app/signup/page.tsx` + `actions.ts` | GET / POST (server action) | `{ email, password }` | Always success-style UI; sets unverified session on real signup; sends alert email on duplicate. |
| `/app/login` | `src/app/app/login/page.tsx` + `actions.ts` | GET / POST | `{ email, password }` | Sets session cookie; redirects to `/app/`. Unverified → redirect to `/app/verify-email`. |
| `/app/forgot-password` | `src/app/app/forgot-password/page.tsx` + `actions.ts` | GET / POST | `{ email }` | Always `"if registered, we sent a link"`. |
| `/app/reset-password` | `src/app/app/reset-password/page.tsx` + `actions.ts` | GET (with `?token=…`) / POST | `{ password, token }` | On success: invalidate all sessions, redirect to `/app/login`. |
| `/app/verify-email` | `src/app/app/verify-email/page.tsx` + `actions.ts` | GET | Reads Supabase verification token if present | Shows resend UI; on Supabase verification link click, Supabase processes the token and redirects to `/app/`. |
| `/app/logout` | `src/app/app/logout/route.ts` | POST | (none) | Clears session, redirects to `/app/login`. GET returns 405. |
| `/app/account` | `src/app/app/account/page.tsx` + `actions.ts` | GET / POST | `{ action: 'change_password'\|'delete_account'\|'resend_verification', … }` | Restricted UI subset while unverified. |
| `/app/` | `src/app/app/page.tsx` | GET | — | Placeholder: "Welcome — platform under construction". |

**Middleware contract (single file: `src/middleware.ts`):**

```
on request to /app/*:
  session = await supabase.auth.getUser()
  if session is null:
      // public auth routes only:
      allow /app/signup, /app/login, /app/forgot-password, /app/reset-password, /app/verify-email
      else → redirect to /app/login
  else if session.user.email_confirmed_at is null:
      allow /app/verify-email, /app/account, /app/logout
      else → redirect to /app/verify-email
  else:
      allow all /app/*
```

### 2.4 UI/UX surfaces

**Component hierarchy (shared across all auth pages):**

```
<AuthLayout>          ← APA-branded shell (header logo, footer privacy link)
  <AuthCard>          ← centered, max-width 420px, shadow
    <AuthHeader/>     ← page title, sub-text
    <form>            ← React 19 server-action form
      <Field email/>
      <Field password/>
      <Button primary/>
    </form>
    <AuthFooter/>     ← "Already have an account? Log in" or similar
  </AuthCard>
</AuthLayout>
```

**Required state matrix** per spec §7.2 — Empty, Submitting (CTA disabled + spinner), Success, Field-error, Server-error (invalid creds, rate-limited, 5xx), Network. All states implemented for every form.

**Brand handoff:** if `docs/brand/style-guide.md` does not have APA tokens at task-start time, the first Phase 3 task escalates to `designer-design-system` and blocks all `/app/*` page tasks until tokens land. Auth logic tasks (middleware, trigger, RLS, server actions) can proceed in parallel.

### 2.5 Testing strategy

Following the project's QA pyramid (Vitest unit + integration; Playwright e2e for golden paths only):

| Layer | What we test | Why this layer |
|---|---|---|
| **Unit (Vitest)** | Email validators, password policy enforcement (≥12 chars), default org-name derivation, error-message dictionary, middleware allow-list logic in isolation. | Pure functions and one tiny middleware helper — fast feedback. |
| **Integration (Vitest + Supabase test DB)** | Signup trigger atomicity, RLS cross-tenant denial, UNIQUE constraint on `org_members.user_id`, deletion-grace cancellation on re-login, audit-log row inserts. | Database-level invariants — the spec's load-bearing properties. **AC-AUTH-13 cross-tenant test is mandatory in CI.** |
| **E2E (Playwright)** | The two golden paths only: (1) signup → verification email → click link → land on `/app/` and (2) login → wrong password 5× → see lockout → try again → success after lockout window. | These are the user journeys most likely to break in production via cookie/middleware regressions. |
| **Visual / brand (Designer review)** | All `/app/*` pages screenshot against APA tokens. Manual review by Designer agent before merge per AC-AUTH-15. | Brand is not unit-testable. |
| **Security review** | OWASP ASVS V2 + V3 walk-through against the implementation. CSRF defence pick from Phase 0 validated. | Auth is a security feature first; this is non-negotiable. |

**What we explicitly do NOT test in v1:**
- Email deliverability per provider (Gmail/Outlook/iCloud) — beyond the scope of automated tests; track via Supabase logs in prod.
- The Resend migration path — v1.1 work.
- Load testing — auth volumes for a mid-market payroll product are small; revisit if usage grows.

---

## Phase 3 — Foundation (Supabase + dependencies + brand precondition)

**Goal:** unblock Phase 4 by getting Supabase provisioned, env wired, packages installed, and brand tokens ready.

| WP | Description | Size | Depends on |
|---|---|---|---|
| 3.1 | Provision Supabase project via Supabase MCP; capture `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in `.env.example`; document in `website/CLAUDE.md`. | S | — |
| 3.2 | Install `@supabase/ssr` + `@supabase/supabase-js` in `website/package.json`. Confirm Next.js 16 / React 19 compatibility (R1 research). | S | 3.1 |
| 3.3 | DevOps: add the three Supabase env vars to Vercel Production + Preview. | S | 3.1 |
| 3.4 | Brand precondition: confirm `docs/brand/style-guide.md` has APA tokens for `/app/*` (header, card, button, input, error). If missing, dispatch `designer-design-system` and block 4.x page tasks. | S–M | — |

**Phase 3 size: M total.** Phase 4 cannot start until 3.1–3.3 land; 3.4 only blocks the UI subset of Phase 4.

---

## Phase 4 — Schema, RLS, signup trigger

**Goal:** the data layer is correct and tested before any UI touches it.

| WP | Description | Size | Depends on |
|---|---|---|---|
| 4.1 | Migration 1: create `public.tg_set_updated_at()` helper + `public.organisations` + RLS policies. | S | 3.1 |
| 4.2 | Migration 2: create `public.org_members` with UNIQUE `user_id` + RLS policies. | S | 4.1 |
| 4.3 | Migration 3: create `public.auth_audit_log` with no public RLS policies. | S | 4.1 |
| 4.4 | Migration 4: create `public.handle_new_user()` function + `on_auth_user_created` trigger on `auth.users`. | M | 4.1, 4.2, 4.3 |
| 4.5 | Integration test: signup → trigger fires → org + member + audit rows created atomically. | M | 4.4 |
| 4.6 | Integration test: two users in two orgs cannot read each other's rows via any query path (AC-AUTH-13). | M | 4.4 |
| 4.7 | Integration test: second `org_members` row for same `user_id` fails with constraint violation (AC-AUTH-14). | S | 4.2 |

**Phase 4 size: L total.** Blocks Phase 5 entirely.

---

## Phase 5 — Core auth UX + middleware (signup, login, logout)

**Goal:** a user can sign up, get auto-logged-in (unverified), log out, and log back in. The middleware is in place.

| WP | Description | Size | Depends on |
|---|---|---|---|
| 5.1 | Create `src/lib/supabase/{server,client,middleware}.ts` helpers per `@supabase/ssr` standard pattern. | S | 3.2 |
| 5.2 | Create `src/middleware.ts` with the exact contract in §2.3. Includes the three allow-listed unverified routes. | M | 5.1 |
| 5.3 | Build `/app/signup` page + server action: validate email + password (≥12 chars), call `supabase.auth.signUp`, handle duplicate-email branch (alert email send + success-style UI), redirect to `/app/verify-email`. | M | 5.1, 4.4, 3.4 |
| 5.4 | Build `/app/login` page + server action: `supabase.auth.signInWithPassword`, set cookies via SSR helper, redirect to `/app/`. Unified error message. | M | 5.1, 3.4 |
| 5.5 | Build `/app/logout` POST route: revoke session + clear cookies + redirect. Return 405 on GET. | S | 5.1 |
| 5.6 | Build placeholder `/app/` page: "Welcome — platform under construction" with APA branding. | S | 3.4 |
| 5.7 | Integration test (Vitest): middleware redirects unauthenticated `/app/foo` to `/app/login`; redirects unverified `/app/foo` to `/app/verify-email`; allows verified all `/app/*`. | M | 5.2 |
| 5.8 | E2E golden path 1 (Playwright): signup → verification email mocked → confirm redirect to verify page → click link → land on `/app/`. | M | 5.3, 5.4, 5.5, 5.6 |

**Phase 5 size: XL total.**

---

## Phase 6 — Verification flow + password reset

| WP | Description | Size | Depends on |
|---|---|---|---|
| 6.1 | Build `/app/verify-email` page: shows email, resend button (rate-limited 1/60s + 5/24h per user), logout link. Uses Supabase Auth resend endpoint. | M | 5.1, 5.2 |
| 6.2 | Build `/app/forgot-password` page + server action: enumeration-resistant response. | M | 5.1 |
| 6.3 | Build `/app/reset-password` page + server action: validates token, sets new password, invalidates all other sessions, redirects to `/app/login`. | M | 5.1 |
| 6.4 | Customise Supabase Auth email templates (verification, password reset, duplicate-signup alert) in the Supabase dashboard with APA branding. | S–M | 3.4 |
| 6.5 | Integration test: expired reset token returns clear error; reused reset token returns clear error (AC-AUTH-10). | S | 6.3 |
| 6.6 | Integration test: resend rate limit triggers correctly at 2nd-in-60s and 6th-in-24h. | S | 6.1 |

**Phase 6 size: L total.**

---

## Phase 7 — Account page + deletion grace + scheduled job

| WP | Description | Size | Depends on |
|---|---|---|---|
| 7.1 | Build `/app/account` page (verified subset): show email, change-password form (current + new + confirm), delete-account button. | M | 5.1 |
| 7.2 | Build `/app/account` page (unverified subset): show email + unverified badge, resend-verification button, delete-account button, logout button. Password change blocked with message. | M | 5.1, 6.1 |
| 7.3 | Server action: change password → invalidates other sessions → keeps current session. | M | 7.1 |
| 7.4 | Server action: delete account → sets `organisations.delete_scheduled_at = now()`, `deleted_at = now() + 7 days` → logs user out → audit log entry. | M | 4.1 |
| 7.5 | Server action: on successful login, if user's org has `delete_scheduled_at IS NOT NULL`, clear both `delete_scheduled_at` and `deleted_at` and audit `account_delete_cancelled`. | M | 5.4, 7.4 |
| 7.6 | Supabase Edge Function `purge-expired-orgs`: nightly `pg_cron` schedule. Deletes `auth.users`, `organisations`, `org_members` where `organisations.deleted_at <= now()`. Audit-log `account_delete_finalised`. | L | 7.4 |
| 7.7 | Integration test: deletion-grace path — schedule delete → log back in within window → deletion cancelled. Verify same-user re-login outside window is blocked (because user no longer exists). | M | 7.4, 7.5, 7.6 |

**Phase 7 size: XL total.**

---

## Phase 8 — Brand, privacy notice, polish

| WP | Description | Size | Depends on |
|---|---|---|---|
| 8.1 | Designer agent visual review of all `/app/*` pages and email templates against APA brand (AC-AUTH-15). | M | 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 7.1, 7.2 |
| 8.2 | Writer + Web Publisher: update privacy notice content for platform-tier auth data per AC-AUTH-16. | M | — (parallel) |
| 8.3 | All form-state error messages reviewed against §7.2 state matrix. | S | 5.3, 5.4, 6.2, 6.3, 7.1, 7.2 |
| 8.4 | Add HSTS header in `next.config.ts` per §8 row "TLS". | S | — |

**Phase 8 size: L total.**

---

## Phase 9 — Security review, rate limits, QA sign-off

| WP | Description | Size | Depends on |
|---|---|---|---|
| 9.1 | Configure Supabase Auth rate limits: 5 fails / 15min per (email, IP); 100 / hour / IP global. Document config in `website/supabase/README.md`. | S | 3.1 |
| 9.2 | Enable Supabase Auth HIBP breach-list check (or implement HIBP k-anon API fallback per R3). | S | 3.1 |
| 9.3 | CSRF defence: implement Origin/Referer header check in middleware for POSTs to `/app/*`. Document the pick. | M | 5.2 |
| 9.4 | E2E golden path 2 (Playwright): login → 5 wrong-password attempts → see lockout → wait → succeed (AC-AUTH-6). | M | 5.4, 9.1 |
| 9.5 | OWASP ASVS V2 + V3 walk-through against the implementation. Findings logged in `docs/qa/`. | M | all of 5–8 |
| 9.6 | QA agent full regression — every AC in spec §12 validated; report in `docs/qa/`. | L | all of 5–8 |
| 9.7 | Pre-merge security review by DevOps agent of env-vars + production Supabase config. | M | 3.3 |

**Phase 9 size: XL total.**

---

## Dependency graph (high level)

```
3 (foundation) ──► 4 (schema) ──► 5 (signup/login/middleware) ──► 6 (verify/reset)
                                                          │
                                                          └──► 7 (account/delete/grace)
                                                                  │
                                                                  ▼
                                                         8 (brand/privacy/polish)
                                                                  │
                                                                  ▼
                                                         9 (security/QA/launch)
```

Phases 4 and 5 cannot be parallelised — every UI piece needs the trigger + RLS in place. Phases 6 and 7 can be parallelised within a single sprint after Phase 5 lands, since they share only the SSR helpers from 5.1.

---

## Effort totals

| Phase | Size |
|---|---|
| 3. Foundation | M |
| 4. Schema + trigger | L |
| 5. Core UX + middleware | XL |
| 6. Verification + password reset | L |
| 7. Account + deletion grace | XL |
| 8. Brand + privacy + polish | L |
| 9. Security + QA | XL |

**Plan total: ~6–8 developer-weeks** assuming one senior developer, with Designer agent and DevOps agent unblocking in parallel where listed. Cross-cutting blockers (R-A1 brand tokens, R-A9 SPF/DKIM for v1.1) can compress the critical path if pre-staged.

---

## Decisions log

| Date | Decision | Source |
|---|---|---|
| 2026-05-26 | Use Postgres trigger (`AFTER INSERT on auth.users`) for atomic org + member creation, not a server-route call. | Phase 0 |
| 2026-05-26 | CSRF defence = Origin/Referer header check + SameSite=Lax cookies (no token store). Revisit in Phase 9 security review. | Phase 0 |
| 2026-05-26 | Scheduled hard-delete job = Supabase Edge Function on `pg_cron`, not Vercel cron. | Phase 0 |
| 2026-05-26 | Auth pages live under `src/app/app/...` in the existing Next.js 16 App Router. Single `src/proxy.ts` at the website root (renamed from `middleware.ts` per Next.js 16 — see Task 1.1 Decisions Log entry). | Phase 1 |
| 2026-05-26 | E2E test surface is two golden paths only (signup-verify; brute-force-lockout). All other ACs validated via Vitest integration tests against a Supabase test instance. | Phase 2.5 |
| 2026-05-26 | **Supabase project provisioned** — name `lsl-platform`, ref `woxtujkxatosbirikxtq`, region ap-southeast-2 (Sydney), Pro tier $10/month, org `tracy-infinite-leverage's Org` (`lmprzbyhxbazwrrpdxrt`). URL: `https://woxtujkxatosbirikxtq.supabase.co`. **Note:** the project-scoped `mcp__supabase` server is bound to a stale ref (`jmicqilfcphneioemwjo`) — the account-scoped MCP (`mcp__2ac7599f-...`) is the one to use for migrations, SQL, edge functions on the new project. Tracy may want to reconfigure the project-scoped MCP binding before Phase 5 to use `get_project_url` / `get_publishable_keys` for client wiring. | Task 3.1 |
| 2026-05-26 | **Post-`dev-grill` amendments (B1–B7 + soft items):** (B1) Middleware matcher made explicit — literal `config = { matcher: ['/app/:path*'] }` required on Task 5.2; (B2) Cancel-deletion (7.5) and purge-cron (7.6) paths now use `SELECT … FOR UPDATE` row-level locking inside a transaction; (B3) Middleware wraps `auth.getUser()` in try/catch — Supabase outage redirects to `/app/login?error=service_unavailable`, never 500; (B4) Signup (5.3) and login (5.4) server actions trim email before Supabase calls (Supabase lowercases but does NOT trim); (B5) Task 3.1 gated on Tracy authenticating Supabase MCP (currently unauthenticated as of 2026-05-26); (B6) Task 6.4 corrected — v1 sender is a Supabase-owned domain, `noreply@lslcalculator.com.au` only lands in v1.1; (B7) Task 5.3 now requires explicit `supabase.auth.admin.sendEmail()` for duplicate-signup alert (Supabase Auth does not auto-send this); plus soft items — Task 4.4 documented as forward-only migrations, Task 7.7 clarified (invoke Edge Function directly, do not test pg_cron), Task 5.4 adds mixed-case email round-trip test, new Task 9.8 — public-calc regression smoke test. Task count: 46 → 47. | dev-grill |
| 2026-05-26 | **DEV-AUTH-1 RESOLVED** — `@supabase/ssr` v0.10.3 (published ~mid-May 2026) confirmed as current Supabase recommendation for Next.js 16 + React 19. `@supabase/auth-helpers-nextjs` is deprecated; all bug fixes flow to `@supabase/ssr`. Package self-describes as beta — API may have breaking changes, accepted risk per Supabase's own adoption guidance. Cookie-handler shape is `getAll`/`setAll` (not the legacy `get`/`set`/`remove`). | Task 1.1 research |
| 2026-05-26 | **`getUser()` retained for the unverified gate (NOT `getClaims()`).** Supabase docs now recommend `auth.getClaims()` for general page protection — faster (local JWT decode, no network call), no auth-server round-trip. **However**, the Supabase JWT does NOT include `email_confirmed_at` (only `iss`, `exp`, `sub`, `role`, `email`, `phone`). The unverified-session gate at the heart of AC-AUTH-3a needs the authoritative `email_confirmed_at` from `auth.users`, which is only available via `getUser()`. **Plan and Task 5.2 keep `getUser()`. Do NOT "optimise" to `getClaims()` later — it silently breaks the unverified gate.** Network-call cost (~50ms p50) is acceptable for security-critical gating. | Task 1.1 research |
| 2026-05-26 | **Next.js 16 renamed `middleware.ts` → `proxy.ts`** (runtime: Node.js, exported function name: `proxy`). All file-path references to `src/middleware.ts` in this plan and `auth-tasks.md` should be read as `src/proxy.ts`. Logic and matcher config are unchanged. The legacy `middleware.ts` still works in Next.js 16 (Edge-only, deprecated; removed in a future version). Task 5.2 entry file is `src/proxy.ts`. Helper file at `src/lib/supabase/middleware.ts` keeps its name (it's just a utility module, not the Next.js entry). | Task 1.1 research |
| 2026-05-26 | **DEV-AUTH-2 RESOLVED** — `handle_new_user` trigger atomicity confirmed. The canonical Supabase pattern (`AFTER INSERT ON auth.users` + `SECURITY DEFINER` + `set search_path = ''`) is well-documented and widely used. **Atomicity is guaranteed by Postgres semantics**: an AFTER trigger runs inside the same transaction as the INSERT, and an exception inside the trigger function rolls back the entire transaction — including the `auth.users` row. Supabase docs corroborate: "if the trigger fails, it could block signups" — i.e., the auth.users insert never lands. No orphaned-row risk if the trigger's `org_members` insert fails after `organisations` succeeds, because both inserts are in the same transaction as the `auth.users` insert; all three roll back together. **No fallback needed. Task 4.4 proceeds with the plan §2.2.4 SQL as written.** | Task 1.2 research |
| 2026-05-26 | **DEV-AUTH-3 RESOLVED** — Supabase Auth HIBP breach-list check is exposed as a dashboard toggle. Path: **Authentication → Password Protection** (per [supabase.com/docs/guides/auth/password-security](https://supabase.com/docs/guides/auth/password-security)). Requires **Pro Plan or above** — the provisioned `lsl-platform` project is Pro tier ($10/month, see Task 3.1 row above), so eligible. Implementation is privacy-preserving (k-anonymity API; HIBP only sees the first 5 hex chars of the hash). Check applies to new signups and new password changes — matches AC-AUTH-15 (signup) + Task 7.3 (change password) + Task 6.3 (reset password) flows. **No k-anon API fallback needed.** Task 9.2 simplifies to: flip the dashboard toggle + verify behaviour with a known-breached test password. | Task 1.3 research |

---

## Open issues for dev agent to resolve at task-time

| ID | Question | Owner | Block? |
|---|---|---|---|
| DEV-AUTH-1 | ~~Confirm R1 (`@supabase/ssr` on Next.js 16 + React 19) before WP 5.1.~~ **RESOLVED 2026-05-26** — `@supabase/ssr` v0.10.3 confirmed; `getUser()` retained over `getClaims()` for unverified gate; entry file renamed to `src/proxy.ts` per Next.js 16. See Decisions Log. | Developer | ✅ Closed |
| DEV-AUTH-2 | ~~Confirm R2 (trigger atomicity) before WP 4.4.~~ **RESOLVED 2026-05-26** — Postgres AFTER-trigger atomicity confirmed; trigger failure rolls back the entire signup transaction. No fallback needed. See Decisions Log. | Developer | ✅ Closed |
| DEV-AUTH-3 | ~~Confirm R3 (HIBP toggle in Supabase Auth dashboard) before WP 9.2.~~ **RESOLVED 2026-05-26** — Toggle exists at Authentication → Password Protection on Pro plan (provisioned project is Pro). No k-anon API fallback needed. See Decisions Log. | Developer | ✅ Closed |
| DEV-AUTH-4 | Decide test-database strategy: shared Supabase test project vs `supabase start` local + Vitest. Plan default: local `supabase start` for integration tests; CI uses ephemeral local Supabase. | Developer | No — required by WP 4.5 |

---

## References

- Spec: `.specify/features/005-lsl-platform/sub-specs/auth.md` v1.0
- Umbrella spec: `.specify/features/005-lsl-platform/spec.md` v1.0
- Brand: `docs/brand/style-guide.md` (Designer-owned)
- Engineering rules: `.claude/rules/global-engineering.md`
- Project standards: `CLAUDE.md`
- Standards: OWASP ASVS v4.0.3 §V2 + §V3; NIST 800-63B §5.2.2

---

*End of plan v1.0 (drafted 2026-05-26).*
