# Feature Specification — LSL Platform · Auth (Login slice of E5.1)

**Slug:** `lsl-platform-auth`
**Parent feature:** `005-lsl-platform` (umbrella platform spec v1.0 APPROVED 2026-05-26)
**Sub-epic:** E5.1 · Auth + Tenancy + DB Scaffold — this spec is the **auth slice** of E5.1
**Status:** **v1.0 APPROVED 2026-05-26** (signed off by Tracy Angwin; all 7 open questions accepted as PM-recommended)
**Author:** Product Manager (drafted 2026-05-26 from owner brief: "I just want email address and password")
**Owner:** Tracy Angwin (austpayroll.com.au)
**Depends on:** Umbrella E5 spec v1.0 (`.specify/features/005-lsl-platform/spec.md`). All decisions locked there bind here.
**Supersedes:** Nothing. (E1 Phase 7's single-user "save my calc" auth was cancelled at the umbrella-spec level; this is the platform's auth, not a revival of Phase 7.)

---

## 0. Why this spec exists (Option A vs Option B)

The umbrella E5 spec covers auth as one strand inside E5.1. This sub-spec exists so a developer can pick up **login alone** without waiting for the full E5.1 impl plan (which also has to land Postgres tenancy primitives, role gating, invitation flows, soft-delete, org-deletion grace, RLS on every tenant table to come).

**Decision: Option A — sub-spec of E5.1, written to `.specify/features/005-lsl-platform/sub-specs/auth.md`.**

**One-line justification:** Login without an org primitive has nowhere to land the user post-signup; OQ-4 already locks one-org-per-signup as the minimum tenancy, so the spec extends to that primitive but no further. Calling it a standalone epic (Option B) would create a phantom E6 that ships nothing useful by itself.

**What this sub-spec covers vs what the rest of E5.1 still covers:**

| In this sub-spec | Left for the rest of E5.1 |
|---|---|
| Email + password signup, login, logout, password reset | Inviting additional users into an org |
| Auto-creating the org on signup, with the signup user as `admin` | The full three-role model (`payroll_user`, `read_only`) and role gating |
| Two minimum tables: `organisations`, `org_members` | Every other tenant table (employees, pay codes, pay periods, mappings, valuations, reports) and their RLS |
| Session management (cookies, expiry, refresh) | User soft-delete (deactivate without losing audit trail) |
| Account-self-deletion (links to the org-deletion 7-day grace) | Org-deletion 7-day grace workflow surface and the tombstone receipt |
| Privacy notice update for auth-tier data handling | The full enterprise-tier privacy notice update (more PII surfaces to follow) |

A developer can ship **everything in this sub-spec** without breaking anything in the umbrella spec. When the rest of E5.1 lands later, it builds on these two tables and these flows — no migration, no rewrite.

---

## 1. Executive summary

The LSL Platform needs a private workspace per client organisation. Step one is letting a person sign in. This spec defines **email + password authentication only** — no SSO, no OAuth, no magic links, no MFA in v1. Supabase Auth provides the primitives; this spec defines which Supabase Auth features to use, the minimum schema (two tables: `organisations` and `org_members`), the session model, the password policy, the UX surfaces, and the security posture.

On signup, the platform auto-creates an organisation with the new user as its admin — the smallest possible tenancy primitive so the user lands somewhere meaningful. Multi-user-per-org (invitations, role management) is explicitly **deferred to a later E5.1 slice**; this spec ships single-admin orgs only.

Password reset uses Supabase Auth's built-in flow. **Locked decision:** v1 ships on Supabase Auth's default SMTP. The migration to Resend (the project's standard email infrastructure per `CLAUDE.md`) is a v1.1 follow-on and is **configuration-only** — Supabase Auth custom-SMTP credentials swap inside Supabase, with **no application code change**. See §11 (decisions locked) and §10.

---

## 2. Background — what already exists vs what is new

| Capability | Today | What this spec adds |
|---|---|---|
| Supabase project | **Not provisioned.** `website/supabase/` does not exist. No `@supabase/*` deps in `website/package.json`. | A provisioned Supabase project, the `@supabase/ssr` package wired in Next.js, and the two minimum tables with RLS. |
| Auth pages | None. The public calc at `/` has no auth. | `/app/signup`, `/app/login`, `/app/forgot-password`, `/app/reset-password`. Logout is a POST endpoint. |
| Email infrastructure | Resend is named in `CLAUDE.md` as project standard but not yet wired. | Password-reset emails routed via Resend OR via Supabase Auth default SMTP — see OQ-AUTH-2. |
| Privacy notice | Updated 2026-05-23 for the stateless calc. Says "no server-side employee data". | Revised to cover platform-tier *auth* data handling (account email, hashed password, session tokens). Employee PII is not yet in scope of this sub-spec — that lands when E5.2 ships. |
| Brand identity on `/app/*` | None — `/app/*` doesn't exist yet. | APA branding on every auth surface per umbrella spec §10 / OQ-12. |
| ANTHROPIC_API_KEY dependency | Public calc depends on it per LAUNCH-GUARD. | **No new dependency.** This auth slice has zero LLM surface area. The public calc dependency is untouched. |

---

## 3. Scope boundary — in / out of v1

### In scope for v1 (this sub-spec)

- Email + password signup. **Email verification is required before first login** to any data-bearing page (locked OQ-AUTH-1). Signup creates a session immediately (locked OQ-AUTH-4) but that session is **unverified** until the verification link is clicked — see §7.5 and AC-AUTH-3a.
- Login (email + password) — only verified accounts can reach `/app/` and any future data-bearing page
- Logout (clears the session)
- Forgot-password → email reset link → set new password → re-login
- Session management: cookie-based session, refresh, expiry. **No "Remember me" UI** — always-on 30-day refresh session (locked OQ-AUTH-3).
- Account self-deletion (delete-my-account) — links to the umbrella spec's 7-day grace on org deletion, since deleting the only admin's account also deletes the org
- Auto-creating an `organisations` row on signup with the signup user as the org's `admin` in an `org_members` row
- RLS policies on both new tables, enforcing per-org isolation
- APA branding on every auth surface (login, signup, forgot-password, reset-password, success/error states)
- Privacy notice revision covering email + password + session-cookie + IP-log handling for the platform-tier surface
- Rate limiting on login + signup + forgot-password endpoints
- Email enumeration mitigation on signup + forgot-password

### Out of scope for this sub-spec (deferred to rest of E5.1 or later)

- Inviting other users into the org (the full multi-user-per-org workflow)
- Role assignment beyond `admin` (the `payroll_user` and `read_only` roles ship later in E5.1)
- Admin actions on other users (deactivate, change role, resend invite) — there are no other users in this slice
- MFA / TOTP / WebAuthn — explicit umbrella decision (MAY in §5.1 of parent spec; deferred for v1)
- Social login, SSO/SAML, OAuth (Google/Microsoft/Apple), magic links — locked OUT by OQ-3
- Multi-org-per-user — locked OUT by OQ-4
- Email verification on every login (only on signup or password change)
- IP-allowlist / device-bound sessions
- Org tombstone receipt UI (delete-my-account uses the same 7-day grace mechanism but doesn't surface the full receipt UI in this slice)

### Explicitly NOT covered (the umbrella spec covers these elsewhere)

- Employees, pay codes, pay periods, mappings, valuations, reports — all of E5.2 through E5.6
- Org-deletion grace UI surface — covered at the umbrella-spec level under E5.1 AC5.1.8
- The full three-role model — covered at the umbrella-spec level under §5.1 + AC5.1.3

---

## 4. Identity model

**One user has exactly one email address.** Email is the user's unique identifier in Supabase Auth's `auth.users` table.

**On signup:**

1. The user submits `email` + `password` on `/app/signup`.
2. Supabase Auth creates a row in `auth.users` with a generated `uuid`. The `email_confirmed_at` column is **NULL** (Supabase Auth's standard unverified state).
3. The platform creates a row in `organisations` with a generated `uuid` and a placeholder `name` (default: `<email-local-part>'s Organisation`; user can rename later — out of scope for this sub-spec) (locked OQ-AUTH-6).
4. The platform creates a row in `org_members` linking `auth.users.id` to `organisations.id` with `role = 'admin'`.
5. **The user is auto-logged-in immediately into an unverified session** (locked OQ-AUTH-4). Supabase Auth issues both access and refresh tokens. The session is well-defined and restricted — see §7.5 "Unverified-session model" for the exact restrictions. Until the user clicks the verification link in their email and `email_confirmed_at` becomes non-NULL, the session can reach only `/app/verify-email` (resend UI) and `/app/account` (resend + logout + delete-account). All other `/app/*` pages redirect to `/app/verify-email`.

**Steps 3–4 happen atomically with step 2** via a Postgres trigger on `auth.users` insert OR via a Supabase Auth `handle_new_user` Postgres function (the standard Supabase pattern). The dev impl plan picks the mechanism; this spec mandates atomicity. A user without an org row is a malformed state and must never persist.

**Future (rest of E5.1):**

- An `admin` invites another user → a pending `org_members` row is created with `role = 'payroll_user'` or `'read_only'` and a `joined_at = NULL` until the invitee accepts.
- A user cannot be a member of two orgs in v1 (OQ-4). This is enforced by a `UNIQUE` constraint on `org_members.user_id`.

---

## 5. Auth provider — Supabase Auth

**Locked decision:** Supabase Auth (per OQ-3 of the umbrella spec).

**Features used:**

| Supabase Auth feature | Used? | Notes |
|---|---|---|
| Email/password provider | YES | The only auth method in v1. |
| Email verification flow | YES | Verification timing per OQ-AUTH-1 below. |
| Password reset (forgot-password) | YES | Email channel per OQ-AUTH-2 below. |
| Session JWT | YES | Issued by Supabase Auth; stored client-side via `@supabase/ssr` cookies. |
| Refresh tokens | YES | Long-lived refresh token in HttpOnly cookie; access token refreshed transparently. |
| Magic links | NO | Locked OUT by OQ-3. |
| OAuth providers (Google, Microsoft, etc.) | NO | Locked OUT by OQ-3. |
| Phone / SMS auth | NO | Out of scope. |
| MFA / TOTP | NO | Deferred (MAY in umbrella §5.1). |
| Anonymous sign-ins | NO | The public calc is unauthenticated; the platform is not. |

**Library choice (Next.js integration):** **`@supabase/ssr`** (not `@supabase/auth-helpers-nextjs`, which Supabase has deprecated in favour of `@supabase/ssr`). Justification: `@supabase/ssr` is the current supported package as of 2026; it handles cookie-based sessions in both Server Components and Route Handlers natively; `auth-helpers-*` is in maintenance mode. The dev agent confirms package availability at impl-plan time.

**RLS implication — load-bearing:**

Every authenticated request must resolve `auth.uid()` → the user's `org_id` via the `org_members` table. Every tenant-scoped table (only `organisations` and `org_members` exist in this slice; many more land later) has a Postgres RLS policy that joins through `org_members` on `auth.uid()` and returns no rows when the requesting user is not a member of the row's org.

**RLS policy template (illustrative — actual DDL is the dev agent's deliverable):**

```sql
-- on organisations: a user can read their own org row only
create policy "members read own org" on public.organisations
  for select using (
    id in (select org_id from public.org_members where user_id = auth.uid())
  );

-- on org_members: a user can read their own membership row only
create policy "members read own membership" on public.org_members
  for select using (user_id = auth.uid());
```

Inserts to `organisations` are blocked from the client (the signup trigger handles them server-side). Inserts to `org_members` are similarly trigger-controlled.

---

## 6. Password policy

Grounded in **OWASP ASVS v4.0.3 §V2 (Authentication)** — no reinvention.

| Rule | Value | Rationale |
|---|---|---|
| Minimum length | **12 characters** | ASVS V2.1.1; aligns with umbrella spec §5.1 "≥12 characters or equivalent policy". |
| Maximum length | **64 characters** | ASVS V2.1.2; prevents DoS via bcrypt's slow hash on huge inputs while not blocking reasonable passphrases. |
| Complexity rules (must contain X) | **NONE** | ASVS V2.1.9 explicitly recommends *against* composition rules. Length + breach-list check is the modern standard. |
| Breach-list check | **YES — Supabase Auth's "have-i-been-pwned" hash check, enabled** | ASVS V2.1.7. Supabase has this as a config toggle. |
| Allowed characters | **All Unicode, including spaces** | ASVS V2.1.4 + V2.1.5. |
| Storage | **Delegated to Supabase Auth (bcrypt-equivalent)** | Supabase Auth uses `bcrypt` for password hashing. Confirmed by Supabase docs as of 2026. Salts are per-user and generated automatically. |
| Rate limit on failed login | **5 failures per 15 minutes per (email, IP) tuple, then 15-minute lockout** | Aligns with NIST 800-63B §5.2.2 (max 100 consecutive failed attempts before account lockout, but most products tighten to 5–10 per window). Supabase Auth has built-in rate limiting; values configurable. |
| Password reset token TTL | **60 minutes** | ASVS V2.5.1 (single-use); Supabase Auth default is 60 minutes — accept the default. |
| Password reset token reuse | **Single-use; invalidated after first redemption** | ASVS V2.5.1. Supabase Auth enforces this. |
| Force password rotation on schedule | **NO** | ASVS V2.1.10 — periodic forced rotation is anti-pattern. Force only on detected compromise. |
| Force password change after reset | **NO** — the user already sets a new password via the reset flow. |

---

## 7. UX surfaces

All pages are **APA-branded** per umbrella spec §10 / OQ-12. Designer agent owns brand application; if the APA design system is not yet coded at impl-plan time, `designer-design-system` produces it as a precondition.

### 7.1 Pages and routes

| Route | Method | Purpose | Auth required |
|---|---|---|---|
| `/app/signup` | GET / POST | Email + password signup form | NO |
| `/app/login` | GET / POST | Email + password login form | NO |
| `/app/forgot-password` | GET / POST | Request password reset email | NO |
| `/app/reset-password` | GET / POST | Set new password via reset token from email | NO (token-gated) |
| `/app/verify-email` | GET | Land after clicking email-verification link | NO (token-gated) |
| `/app/logout` | POST | Clear session, redirect to `/app/login` | YES |
| `/app/account` | GET | View account email, change password, delete account | YES |

Post-login default landing: `/app/` (the platform home page). The platform home page itself is out of scope for this sub-spec — but the auth flow MUST redirect there on successful login. A placeholder page returning "Welcome — platform under construction" is acceptable for this slice.

### 7.2 Required states per page

For each form-bearing page (`/app/signup`, `/app/login`, `/app/forgot-password`, `/app/reset-password`, `/app/account`):

| State | Behaviour |
|---|---|
| Empty (initial render) | Form fields rendered, primary CTA enabled. |
| Submitting | CTA disabled, spinner visible, no double-submission possible. |
| Success | Either redirect (login, logout, reset complete) OR success message with next step (signup → "check your email", forgot-password → "if that email is registered, we sent a link"). |
| Field-level validation error | Inline error under each field; CTA disabled until valid. |
| Server error — invalid credentials | Generic message: "Email or password incorrect" (NOT "no user with that email"). |
| Server error — rate limited | Specific message: "Too many attempts. Try again in N minutes." |
| Server error — generic 5xx | Specific message: "Something went wrong. Please try again." with no internal detail leaked. |
| Network failure | Toast: "Connection lost. Please check your network." |

### 7.3 Email enumeration mitigation

- **Signup**: if the email is already registered, the response is the same as success ("check your email to verify"); the verification email itself is sent only to the new account or, if the address is taken, an alert email is sent to the existing account informing them someone tried to sign up with their address. This pattern is recommended by ASVS V2.1.6.
- **Forgot-password**: the response is always "if that email is registered, we sent a link". The email is sent only if the account exists.
- **Login**: invalid email and invalid password return the same error message.

### 7.4 Brand application

Per umbrella spec §10:
- All `/app/*` pages carry APA logo, palette, typography per `docs/brand/style-guide.md` (Designer agent owns).
- Supabase Auth email templates (verification, password reset, alert-on-duplicate-signup) carry APA branding — customised via the Supabase dashboard template editor in v1. (In v1.1 when Resend custom-SMTP lands, templates may move to Resend; no application change.)
- Login page is the first impression for a returning customer — Designer reviews layout before merge.

### 7.5 Unverified-session model (load-bearing — locks OQ-AUTH-1 + OQ-AUTH-4 interaction)

The umbrella spec §5.1 says: *"MUST require a verified email address for every user account."* This sub-spec reads that strictly — **no data-bearing page is reachable without a verified email** — while also auto-logging the user in on signup (OQ-AUTH-4) to avoid an awkward "we just made an account but you can't use it" dead end.

The reconciliation is: **the session exists; the session is restricted.** Until `auth.users.email_confirmed_at IS NOT NULL`, the user is in an **unverified session state**, defined as follows:

#### Reachable while unverified
| Route | Behaviour |
|---|---|
| `/app/verify-email` | Default landing for an unverified session. Shows: "We sent a link to `<email>` — click it to finish signup." Primary CTA: **Resend verification email** (rate-limited to 1 send per 60 seconds, 5 sends per 24 hours per user). Secondary link: change email address (out of scope for v1 — link disabled / hidden). Tertiary link: **Log out**. |
| `/app/account` | Restricted account page. Shows the user's email (unverified badge), a **Resend verification email** button, a **Log out** button, and a **Delete account** button. **Password change is blocked** while unverified (changing the password while unverified would let an attacker who guessed the password pin the account before the real owner clicks the verify link). |
| `/app/logout` (POST) | Always allowed. Clears session and redirects to `/app/login`. |

#### Blocked while unverified
- `/app/` (the post-login landing — currently a placeholder per locked OQ-AUTH-7, later the real platform home) → **redirect to `/app/verify-email`**.
- Any other future `/app/*` data-bearing page (employees, mappings, valuations, reports — none exist in this slice but the middleware must block them once they do) → **redirect to `/app/verify-email`**.
- Password change at `/app/account` → blocked with message "Please verify your email before changing your password."

#### Enforcement
- A Next.js middleware on `/app/*` reads the Supabase session and checks `email_confirmed_at`. If NULL, the middleware rewrites the response to redirect to `/app/verify-email`, **except** for the allow-listed routes above (`/app/verify-email`, `/app/account`, `/app/logout`).
- The check is server-side. The client cannot bypass it.
- The check is **independent of RLS**. RLS is the second line of defence; the unverified-state restriction is the first.
- When the user clicks the verification link, Supabase Auth sets `email_confirmed_at = now()`. The next request after that point passes the middleware check and the user can reach `/app/`.

#### Why this design
- It satisfies umbrella §5.1's strict reading ("verified email for every user account") — no unverified user reaches a data-bearing page.
- It satisfies OQ-AUTH-4's "auto-login on signup" goal — the user is not stuck at a login screen after signup; they land somewhere meaningful (`/app/verify-email`) and have an obvious next action (click the email, or resend it).
- It avoids the worst alternative ("verified-email-then-login-then-redirect-back-to-the-page-they-were-on") which adds two extra hops and a state-restoration bug surface.
- It produces one well-defined state, not two ambiguous ones. A developer reading this spec cannot accidentally let an unverified session reach `/app/employees` because the middleware is the single chokepoint.

#### Verification-email rate-limit
- 1 resend per 60 seconds per `user_id` (prevents accidental double-click spam).
- 5 resends per 24 hours per `user_id` (prevents using the platform as an email-bomb relay against a third party).
- Exceeding either limit returns a UI message: "You can request another verification email in N seconds/hours." No silent fail.

---

## 8. Security

| Concern | v1 posture | Reference |
|---|---|---|
| **Password storage** | bcrypt via Supabase Auth. Confirmed standard as of 2026 — work factor managed by Supabase. | Supabase Auth docs. |
| **Session cookies** | HttpOnly, Secure, SameSite=Lax (NOT Strict — SameSite=Strict breaks the email-link-back redirect on password reset and signup verification). `@supabase/ssr` sets these by default. | OWASP Session Management Cheat Sheet. |
| **Session expiry** | Access token: 60 minutes (Supabase default). Refresh token: 30 days (Supabase default). Refresh rotation enabled. | ASVS V3.3.1, V3.3.2. |
| **CSRF** | For password-mutation endpoints (login, signup, reset, change-password, delete-account), use double-submit-cookie pattern OR rely on `@supabase/ssr` SameSite=Lax + Origin header check. The dev agent picks at impl-plan time; this spec mandates that **all state-changing endpoints have explicit CSRF defence** beyond the cookie itself. | OWASP CSRF Cheat Sheet. |
| **Email enumeration** | Mitigated per §7.3. | ASVS V2.1.6. |
| **Brute-force per email** | 5 failures / 15 min / (email, IP) → 15-min lockout, surfaces in UI. | Supabase Auth rate-limit config + NIST 800-63B §5.2.2. |
| **Brute-force per IP (no specific email)** | 100 requests / hour / IP across `/app/login`, `/app/signup`, `/app/forgot-password` combined. | Supabase Auth global rate limit. |
| **Password reset token** | 60-min TTL, single-use, invalidated on successful redemption. Reset link served over HTTPS only. | ASVS V2.5.1. |
| **Logout** | POST endpoint clears both access and refresh tokens server-side AND client-side. GET-based logout NOT supported (defends against CSRF logout attacks). | OWASP. |
| **Session fixation** | Supabase Auth rotates the session ID on every login. | OWASP Session Management Cheat Sheet V3.2. |
| **Email change** | Out of scope for this slice — `/app/account` exposes view-only email. Change-email lands in a later E5.1 slice. |
| **Password change (while logged in)** | In scope. Requires current password + new password (entered twice). Invalidates all other sessions for that user on success (Supabase Auth supports this). |
| **TLS** | HTTPS-only enforced by Vercel for `lslcalculator.com.au`. HSTS header recommended via `next.config.js`. | OWASP Transport Layer Protection Cheat Sheet. |
| **Audit log** | Every login (success + failure), every signup, every password reset request, every password change, every account deletion is logged to a `auth_audit_log` table with `user_id`, `event_type`, `ip`, `user_agent`, `created_at`. Read-only from the application; admin-only access (no admin UI yet — query via Supabase dashboard). | Best practice; supports incident response. |

---

## 9. Data — minimum new tables

Only **two** new tables ship in this slice. The umbrella spec adds many more later; this sub-spec scope explicitly excludes them.

### 9.1 `organisations`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `name` | `text` | NOT NULL | Default at signup: `<email-local-part>'s Organisation`; user-editable later (out of this slice). |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Trigger-updated on row change. |
| `deleted_at` | `timestamptz` | NULL | Soft-delete timestamp; hard-delete after 7-day grace per umbrella spec §5.1 + AC5.1.8. |
| `delete_scheduled_at` | `timestamptz` | NULL | When user requested deletion. `deleted_at` = `delete_scheduled_at + 7 days`. |

### 9.2 `org_members`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `org_id` | `uuid` | NOT NULL, FK → `organisations.id` ON DELETE CASCADE | |
| `user_id` | `uuid` | NOT NULL, FK → `auth.users.id` ON DELETE CASCADE, **UNIQUE** | Enforces one-org-per-user (OQ-4). |
| `role` | `text` | NOT NULL, CHECK (`role` IN ('admin', 'payroll_user', 'read_only')) | Only `'admin'` populated in this slice. |
| `joined_at` | `timestamptz` | NULL | NULL for pending invites (later); set on accept. |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `created_by` | `uuid` | NULL, FK → `auth.users.id` | NULL on signup self-creation; set on invite (later). |

### 9.3 RLS policies

Both tables have `ENABLE ROW LEVEL SECURITY` set. Policies (sketched in §5 above — the dev agent owns final DDL):

- `organisations`: a user can `SELECT` only their own org row (via `org_members` join on `auth.uid()`).
- `organisations`: only the `admin` of the org can `UPDATE` it (this slice only allows `name` and `delete_scheduled_at` to change).
- `organisations`: no client-side `INSERT` or `DELETE` (handled by trigger and admin operations only).
- `org_members`: a user can `SELECT` only their own membership row.
- `org_members`: no client-side `INSERT`, `UPDATE`, or `DELETE` in this slice — all changes go through Postgres functions or triggers. (When invites land in a later E5.1 slice, the policy expands to allow admins to insert pending rows.)

### 9.4 `auth_audit_log` (optional but recommended)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | Nullable — login failures may not have a known user. |
| `event_type` | `text` | `login_success`, `login_failure`, `signup`, `password_reset_request`, `password_reset_complete`, `password_change`, `account_delete_request`, `account_delete_finalised`, `logout`. |
| `ip` | `inet` | Source IP. |
| `user_agent` | `text` | UA string. |
| `metadata` | `jsonb` | Failure reason, rate-limit hit, etc. |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

RLS: no application read access. Service-role-only.

### 9.5 What this sub-spec does NOT add

- No `employees`, `pay_codes`, `pay_periods`, `mappings`, `valuations`, `reports`, `reconciliations` tables. Those land in E5.2–E5.6 per umbrella spec.
- No `user_profiles` table — Supabase `auth.users` carries email + hashed password; the umbrella spec does not require a separate profile in v1.

---

## 10. Email infrastructure

**Password reset emails, signup verification emails, alert-on-duplicate-signup emails** all need a delivery channel.

**Locked decision (OQ-AUTH-2):** v1 ships on **Supabase Auth's default SMTP**. v1.1 migrates to **Supabase Auth → custom SMTP via Resend** (the project's standard email vendor per `CLAUDE.md`).

| Channel | When | Notes |
|---|---|---|
| **A. Supabase Auth default SMTP** | **v1 (this slice)** | Zero new wiring; SPF/DKIM handled by Supabase. Acceptable deliverability for early customers. Templates editable in the Supabase dashboard. |
| **B. Supabase Auth → custom SMTP via Resend** | **v1.1 (post-launch follow-on)** | Better deliverability; full APA branding via Resend templates; unified email infra. Requires Resend SMTP credentials in Supabase Auth + SPF/DKIM/DMARC on `lslcalculator.com.au`. |

**Critical property:** the migration from A to B is **configuration-only inside the Supabase Auth dashboard**. No application code changes. No schema changes. No deployment risk to the auth flow itself. The dev agent does not need to anticipate this switch in v1; the v1 code is identical regardless.

**Email content (regardless of channel):**

- **Verification email**: APA branding, plain CTA "Verify your email", expiry note ("link expires in 24 hours").
- **Password reset**: APA branding, plain CTA "Reset your password", expiry note ("link expires in 60 minutes"), security note ("if you didn't request this, ignore this email").
- **Alert on duplicate signup attempt**: APA branding, neutral tone ("someone tried to create an account with this email; you don't need to do anything, but if it wasn't you, consider rotating your password"), no link.

**Deliverability:**
- SPF / DKIM / DMARC for `lslcalculator.com.au` required regardless of channel.
- Sender address: `noreply@lslcalculator.com.au` (or `accounts@`).
- Reply-to: `support@austpayroll.com.au` (per CLAUDE.md / owner email).

---

## 11. Decisions locked (2026-05-26)

All 7 open questions from v0.1 DRAFT were resolved 2026-05-26 by Tracy Angwin, accepting every PM recommendation verbatim. This section records each decision with a one-line rationale.

| ID | Decision | One-line rationale |
|---|---|---|
| **OQ-AUTH-1** | **Email verification required before first login.** Unverified accounts cannot reach any data-bearing page; see §7.5 for the precise unverified-session model. | Strict reading of umbrella §5.1 ("MUST require a verified email address for every user account"). Mid-market payroll buyers expect verified email; Supabase Auth provides it free. |
| **OQ-AUTH-2** | **Supabase Auth default SMTP in v1; configuration-only swap to Resend in v1.1.** Zero application code change between the two. | Lets v1 ship without blocking on Resend domain wiring; lets v1.1 land the project-standard email infra cleanly. |
| **OQ-AUTH-3** | **No "Remember me" checkbox.** Always-on 30-day refresh-token session. | Lowers friction; matches mid-market norm; the refresh-token rotation gives the desired security posture without UX cost. |
| **OQ-AUTH-4** | **Auto-login on signup into an unverified session.** The session exists but is restricted: only `/app/verify-email`, `/app/account` (restricted subset), and `/app/logout` are reachable until `email_confirmed_at` is set. All data-bearing routes redirect to `/app/verify-email`. See §7.5. | Resolves the OQ-AUTH-1 + OQ-AUTH-4 interaction precisely. The session-exists-but-restricted model avoids both the "stranded at login after signup" friction and the "unverified user reaches data pages" leak. |
| **OQ-AUTH-5** | **Account self-deletion cascades to org deletion with the umbrella spec's 7-day grace.** In this slice the user IS the org. Logging back in within 7 days cancels deletion; after 7 days a scheduled job hard-deletes `auth.users`, `organisations`, and `org_members` rows. | Aligns with umbrella AC5.1.8. Same primitive, same grace window, no special-casing. |
| **OQ-AUTH-6** | **Default org name = `<email-local-part>'s Organisation`.** No prompt at signup. User renames later via a future `/app/account` setting (out of this slice). | Single-page signup keeps friction low. Renaming surface lands with the full org-settings page in a later E5.1 slice. |
| **OQ-AUTH-7** | **Auth slice does not block on the rest of E5.1's `/app/` landing.** A placeholder `/app/` page returning "Welcome — platform under construction" satisfies the post-login redirect target. | Lets auth ship as a self-contained vertical without dragging in masterfile/mapping UI. The placeholder is replaced by the real home page in a later E5.1 slice. |

---

## 12. Acceptance criteria

Numbered to make traceability into the umbrella E5.1 acceptance set straightforward. (Umbrella AC5.1.1, AC5.1.4, AC5.1.5, AC5.1.7, AC5.1.8 map directly into this set; AC5.1.2, AC5.1.3, AC5.1.6 are partially addressed here — one-org enforcement is in scope, invite/deactivate flows are not.)

| AC | Description | Maps to umbrella AC |
|---|---|---|
| **AC-AUTH-1** | A new user can sign up at `/app/signup` with email + password (≥12 chars, breach-list-checked). On successful submission a Supabase `auth.users` row (with `email_confirmed_at = NULL`), an `organisations` row (with `name = '<email-local-part>'s Organisation'`), and an `org_members` row (`role='admin'`) are created atomically. The user is auto-logged-in into an **unverified session**. | AC5.1.1, AC5.1.2 (partial — one-org auto-create) |
| **AC-AUTH-2** | A second signup attempt with the same email returns the **same** success-style UI response as a fresh signup; no information is leaked about whether the email is already taken. An alert email is sent to the existing account. | (new — email enumeration mitigation) |
| **AC-AUTH-3** | A signed-up user receives a verification email immediately on signup. Clicking the link sets `auth.users.email_confirmed_at` and lands the user on `/app/` (the platform home). No second login is required; the existing auto-login session is upgraded from unverified to verified. | AC5.1.1 |
| **AC-AUTH-3a** | **An unverified session is restricted.** Any request to `/app/*` other than `/app/verify-email`, `/app/account` (restricted subset per §7.5), and `/app/logout` is redirected by Next.js middleware to `/app/verify-email`. The user can resend the verification email from `/app/verify-email` or `/app/account` (rate-limited: 1 per 60 seconds, 5 per 24 hours per user). The user can log out from either page. Password change is **blocked** for unverified users with a clear message. Verified by an automated test that creates an unverified session and asserts each blocked route returns a redirect to `/app/verify-email`. | AC5.1.1 (strict reading of umbrella §5.1) |
| **AC-AUTH-4** | A returning user (already verified) can log in with email + password at `/app/login`; a valid session cookie (HttpOnly, Secure, SameSite=Lax) is set with access-token TTL of 60 minutes and refresh-token TTL of 30 days (Supabase defaults); the user is redirected to `/app/`. There is **no "Remember me" checkbox** — the long session is always-on per locked OQ-AUTH-3. An unverified user attempting to log in is auto-redirected to `/app/verify-email` after authentication succeeds. | AC5.1.1 |
| **AC-AUTH-5** | An invalid login (wrong password OR unknown email) returns the same generic error message ("Email or password incorrect"); no distinction is observable in response time or wording. | (new — enumeration + ASVS V2.1.6) |
| **AC-AUTH-6** | After 5 failed login attempts within 15 minutes for the same (email, IP), further attempts are rate-limited for 15 minutes; the UI surfaces the lockout with a clear "try again in N minutes" message. | (new — brute-force mitigation) |
| **AC-AUTH-7** | A logged-in user POSTs to `/app/logout`; both access and refresh tokens are revoked server-side and cleared client-side; the user is redirected to `/app/login`. | AC5.1.1 (implicit) |
| **AC-AUTH-8** | A user can request a password reset at `/app/forgot-password`; the response is always "if that email is registered, we sent a link" regardless of whether the email exists. An email with a single-use 60-minute reset token is sent only if the email is registered. | AC5.1.5 |
| **AC-AUTH-9** | Clicking the reset link lands on `/app/reset-password`; entering a new password (≥12 chars, breach-list-checked) updates the password and invalidates all existing sessions for that user. The user is then redirected to `/app/login` to sign in fresh. | AC5.1.5 |
| **AC-AUTH-10** | A used reset token cannot be redeemed twice. An expired (>60min) reset token returns a clear error and a link to start the flow again. | AC5.1.5 |
| **AC-AUTH-11** | At `/app/account`, a logged-in **verified** user can change their password by entering current + new + confirm. On success, all OTHER sessions for that user are invalidated; the current session remains active. An **unverified** user attempting password change is blocked with the message: "Please verify your email before changing your password." | (new — covers password change while logged in; ties to §7.5) |
| **AC-AUTH-12** | At `/app/account`, a logged-in user (verified or unverified) can delete their account. This schedules org deletion at `delete_scheduled_at = now()` and `deleted_at = now() + 7 days` on the `organisations` row; the user is logged out and the account/org enter a 7-day grace state. Logging back in within 7 days clears `delete_scheduled_at` and `deleted_at` (deletion cancelled). After 7 days, a scheduled job hard-deletes the `auth.users`, `organisations`, and `org_members` rows; FK ON DELETE CASCADE handles the `org_members` row automatically. `auth_audit_log` rows persist with the user's `user_id` retained for incident-response purposes (the row is the tombstone). | AC5.1.8 |
| **AC-AUTH-13** | Postgres RLS prevents any logged-in user from reading any `organisations` or `org_members` row not their own. Validated by an automated cross-tenant security test in CI that creates two test users in two test orgs and asserts neither can read the other's rows via any query path. | AC5.1.4 |
| **AC-AUTH-14** | The `org_members.user_id` UNIQUE constraint prevents a user from being a member of two orgs. Tested by attempting to insert a second `org_members` row for the same user — must fail with a constraint violation. | AC5.1.2 |
| **AC-AUTH-15** | All auth surfaces (`/app/signup`, `/app/login`, `/app/forgot-password`, `/app/reset-password`, `/app/verify-email`, `/app/account`) carry APA branding per `docs/brand/style-guide.md`. All Supabase Auth emails (verification, password reset, alert-on-duplicate-signup) carry APA branding via the Supabase template editor. Verified by Designer agent review before merge. | AC5.1.7 + umbrella §10 |
| **AC-AUTH-16** | The privacy notice is updated to cover platform-tier auth-data handling: email address stored, password hashed via bcrypt (Supabase Auth), session cookies set (HttpOnly, Secure, SameSite=Lax), IP and user-agent logged in `auth_audit_log`, 7-day grace on account deletion, no data sharing with third parties beyond Supabase. (Resend is named as the v1.1 email-delivery vendor when that migration lands; the privacy notice will be re-revised at that point.) | AC5.1.7 |
| **AC-AUTH-17** | **Password-reset email channel is Supabase Auth's default SMTP in v1.** Migration to Resend (custom SMTP via the Supabase Auth dashboard) is a v1.1 follow-on with **no application code change** — the v1 implementation does not need to anticipate it. Verified by the dev agent at impl-plan time. | (new — locks OQ-AUTH-2) |

---

## 13. References

- **Umbrella E5 spec:** `.specify/features/005-lsl-platform/spec.md` v1.0 APPROVED 2026-05-26 (especially §5.1, §10, §12, AC5.1.x)
- **Project standards:** `CLAUDE.md` (Resend as standard email infra), `.claude/rules/global-engineering.md` (Supabase MCP usage)
- **Standards:** OWASP ASVS v4.0.3 §V2 (Authentication), §V3 (Session Management); NIST 800-63B §5.2.2 (Memorized Secrets)
- **Supabase docs:** `@supabase/ssr` migration guide; Supabase Auth password hashing (bcrypt); Supabase Auth rate-limit configuration; Supabase Auth custom-SMTP
- **Brand:** `docs/brand/style-guide.md` (Designer-owned; APA design system — may need to ship before E5.1 if not yet coded)
- **Privacy notice:** Current location TBD (referenced as "the privacy notice was updated 2026-05-23" in umbrella spec)

---

## 14. Version history

| Version | Date | Author | Notes |
|---|---|---|---|
| v0.1 DRAFT | 2026-05-26 | Product Manager | Initial draft with 7 open questions in §11. |
| **v1.0 APPROVED** | **2026-05-26** | **Tracy Angwin (owner sign-off)** | All 7 open questions resolved per PM recommendations (see §11). §7.5 added to specify the unverified-session model precisely (OQ-AUTH-1 + OQ-AUTH-4 reconciliation). AC-AUTH-3a and AC-AUTH-17 added. §10 + §11 stripped of "deferred to" language; §10 now lists v1 channel (Supabase default SMTP) and v1.1 migration (Resend, config-only). |

---

*End of sub-spec v1.0 APPROVED 2026-05-26.*
