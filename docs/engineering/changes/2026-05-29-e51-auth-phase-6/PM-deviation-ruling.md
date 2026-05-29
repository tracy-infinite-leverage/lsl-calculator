# PM Deviation Ruling — E5.1 Auth Slice, Phase 6

**Date:** 2026-05-29
**PM:** product-manager agent
**Branch / PR:** `feat/E5.1-auth-slice-phase-6` / PR #67
**Context:** [`HANDOFF.md`](./HANDOFF.md) §Spec Deviations
**Specs touched (read-only review):**
- `.specify/features/005-lsl-platform/sub-specs/auth.md` (AC-AUTH-3a, AC-AUTH-10)
- `.specify/features/005-lsl-platform/sub-specs/auth-tasks.md` (Tasks 5.7, 6.5)
- `website/src/__tests__/auth/phase5-proxy-gating.test.ts` (header L1–L46)
- `website/src/__tests__/auth/phase6-reset-token-lifecycle.test.ts` (header L1–L24)

---

## Verdicts at a glance

| # | Deviation | Verdict |
|---|---|---|
| 1 | AC-AUTH-3a / Task 5.7 — proxy-gating branch (b) unverified delegated to mock-level `src/proxy.test.ts` instead of live Supabase | **Accept with follow-up** |
| 2 | AC-AUTH-10 / Task 6.5 — expiry branch asserted via an obviously-invalid token instead of wall-clock-past-60-min | **Accept with follow-up** |

Neither deviation touches the **pre-launch guard** (`docs/launch/LAUNCH-GUARD.md`). That guard's load-bearing item is `ANTHROPIC_API_KEY` in Vercel Production, being closed by elimination via the PDF-removal companion. AC-AUTH-3a and AC-AUTH-10's security properties (unverified-redirect, single-use reset token, clear-error UI on bad token) hold under the implemented coverage.

---

## Deviation 1 · AC-AUTH-3a / Task 5.7 — proxy-gating branch (b) delegated

### What the spec said

Spec text (`auth.md` L394, AC-AUTH-3a):

> Verified by an automated test that creates an unverified session and asserts each blocked route returns a redirect to `/app/verify-email`.

Task text (`auth-tasks.md` L385, Task 5.7 description):

> Vitest integration tests against middleware. Three scenarios: (a) anonymous request to `/app/foo` redirects to `/app/login`; (b) unverified session request to `/app/foo` redirects to `/app/verify-email`; (c) verified session passes through to `/app/foo`.

AC line on the (b) branch (`auth-tasks.md` L393):

> Test (b): unverified → /app/verify-email redirect for /app/, /app/employees (any future path).

The intent — read alongside Task 5.7's AC "Tests run in CI on every PR" (L396) — was for all three branches to run live in the integration suite.

### What the dev shipped

`phase5-proxy-gating.test.ts` (11 cases) runs branches (a) anonymous and (c) verified live against the `lsl-platform` Supabase project. Branch (b) is delegated to `src/proxy.test.ts` (24 mock-level cases mocking the `createSupabaseProxyClient` SSR factory). The DB-side complement (unverified-signup atomicity, `email_confirmed_at = NULL` write) is separately covered live by `phase4-trigger-atomicity.test.ts`.

### Dev's rationale (verified against the test file's L16–L46 comment block)

Producing a real unverified session against the live `lsl-platform` project is refused by the platform by design:

1. `admin.createUser({ email_confirm: false })` + `signInWithPassword` → Supabase rejects password sign-in for unconfirmed accounts ("Email not confirmed").
2. `anon.signUp(...)` → works for a one-off but hits Supabase's free-tier email rate-limit after ~3–4 calls/hour, which would flake CI.
3. `admin.updateUserById(id, { email_confirmed_at: null })` via SDK → silently ignored. Raw REST equivalent → also silently ignored. Supabase actively refuses to un-confirm a confirmed user.

These behaviours are properties of Supabase Auth's anti-enumeration design, not bugs.

### PM ruling

**Accept with follow-up.**

Reasoning:
- The dev's three workaround attempts are documented and reproducible; the SaaS platform's behaviour is what it is.
- The combined coverage (live (a)+(c) at the proxy boundary; mock-level (b) at the SSR-client boundary it would also have to mock; live unverified-signup DB write in `phase4-trigger-atomicity.test.ts`) exercises every code path the proxy can reach for the unverified branch.
- The AC's load-bearing property is *"unverified session → redirect to `/app/verify-email`"*, not *"live Supabase JWT used in every case"*. That property is asserted; the surface it's asserted against is the same SSR-client boundary either approach would have to mock once Supabase refuses to mint an unverified session.
- The AC text in `auth-tasks.md` L389 already records the delegation honestly. We formalise that now with a PM-approved note (not silent), and queue the live (b) test to land once the local Supabase stack ships in CI.

### Spec edits

No edits to `auth.md` AC-AUTH-3a — the AC's wording ("automated test that creates an unverified session and asserts each blocked route returns a redirect") remains satisfied by the combined `proxy.test.ts` + `phase4-trigger-atomicity.test.ts` coverage.

**`auth-tasks.md` Task 5.7 — minor amendment to the Status note** to add explicit PM approval and the follow-up reference. See "Spec/status edits applied" below.

### Follow-up

**Task title:** "E5.1 follow-up · Re-introduce live branch-(b) unverified-session test in proxy-gating integration suite once local Supabase stack lands in CI"

**Tracked in:** `docs/product/epic-status.md` E5.1 row, under the existing "follow-up" notes for the auth slice. Linked to Task 5.8 — once the local Supabase stack + Mailhog are stood up for the Playwright E2E, the unverified-session production path becomes reachable via `anon.signUp` without the free-tier email cap. At that point, the live (b) branch becomes cheap to add to `phase5-proxy-gating.test.ts`.

**Priority:** Low. Coverage is not absent today; it's at the mock-boundary that any live test would also have to mock. This is hardening, not gap-filling.

---

## Deviation 2 · AC-AUTH-10 / Task 6.5 — expiry branch via invalid token

### What the spec said

Spec text (`auth.md` L401, AC-AUTH-10):

> A used reset token cannot be redeemed twice. An expired (>60min) reset token returns a clear error and a link to start the flow again.

Task AC (`auth-tasks.md` L506):

> Test (a) advances time / mocks clock past 60 min and asserts rejection.

### What the dev shipped

`phase6-reset-token-lifecycle.test.ts` (3 cases):
1. Single-use rejection — generate a real recovery link via `admin.auth.admin.generateLink({type:'recovery'})`, redeem once (success), redeem the same hash a second time on a fresh anon client (rejected). **Live, end-to-end against Supabase's `flow_state` enforcement.**
2. Expiry branch — asserts that an obviously-invalid 64-char hex token (never issued) is rejected with the same error shape Supabase returns for an expired token.
3. Happy path — post-exchange `updateUser({ password })` succeeds against a real session (covers AC-AUTH-9 cross-validation).

### Dev's rationale (verified against the test file's L6–L24 comment block)

- 60-minute wall-clock waits are not viable in CI.
- Supabase's `flow_state` invalidation fires identically for "never issued" and "expired" tokens — same error shape, same code path.
- The AC's load-bearing property is *"clear error and link to start the flow again"*, which the page collapses to a single destructive Alert ("The link has expired or has already been used. Request a new one to continue.") — already documented at `auth-tasks.md` L508 as deliberate by spec design (don't differentiate expired vs used to avoid information leakage).

### PM ruling

**Accept with follow-up.**

Reasoning:
- The single-use property — the actually load-bearing security invariant of AC-AUTH-10 — IS exercised live against Supabase's `flow_state` enforcement. That's the one I care most about.
- The "clear error on expired" property is asserted via an invalid-token proxy that hits the same Supabase code path as a 60-min-expired token. The UI assertion (single destructive Alert covering both branches) is covered by the page (Task 6.3, `reset-password/page.tsx`) and recorded at `auth-tasks.md` L508.
- **The residual risk:** if Supabase ever ships a behaviour change that emits a distinct error shape for expired-vs-invalid tokens, this test will silently pass on the invalid case while a real expired token might produce something the UI doesn't handle. The likelihood is low (it would be a deliberate Supabase Auth behaviour change), but the test would not catch it.

That residual risk is the reason for the follow-up — not a blocker for this PR.

### Spec edits

No edits to `auth.md` AC-AUTH-10 — the AC's "clear error and a link to start the flow again" property is asserted.

**`auth-tasks.md` Task 6.5 AC line for Test (a)** — already records the adaptation ("A fake 64-char hex token (never issued) is rejected with the same error shape as an expired one. The 60-min wall-clock assertion is impractical in CI; Supabase's single-use enforcement is the single property under test, and it fires identically for 'never issued' and 'expired'."). We add explicit PM approval to the Status block. See "Spec/status edits applied" below.

### Follow-up

**Task title:** "E5.1 follow-up · Add a real-expiry test for reset tokens — JWT-clock-mock or local Supabase stack with overridable token TTL"

**Tracked in:** `docs/product/epic-status.md` E5.1 row, under the same follow-up notes block as Deviation 1.

**Priority:** Low. Two viable paths once the local stack is in CI:
- (a) Use `supabase start` with a config override that sets `recovery_token_lifetime` to ~3 seconds, then sleep-and-retry.
- (b) Mock the system clock at the Supabase boundary — requires intercepting `flow_state` row reads, which is more invasive than option (a).

Option (a) is the natural pairing with Task 5.8's local-stack setup. Bundle this follow-up into the same DevOps work-package.

---

## Bundled follow-up task (single line for `epic-status.md`)

Both follow-ups depend on the same prerequisite (local Supabase stack in CI for Task 5.8). I'm logging them as **one bundled follow-up** to avoid splitting a single piece of infrastructure work into two tickets:

> **E5.1 follow-up · Auth integration test hardening — re-introduce live unverified-session branch in `phase5-proxy-gating.test.ts` (Deviation 1) + add real-expiry test for reset tokens in `phase6-reset-token-lifecycle.test.ts` (Deviation 2). Both blocked on local Supabase stack in CI (prerequisite to Task 5.8 Playwright E2E). Bundle into the same DevOps work-package.**

This goes onto the E5.1 follow-up list in `epic-status.md`. Not blocking for Phase 6 sign-off.

---

## Spec / status edits applied (alongside this ruling)

1. **`.specify/features/005-lsl-platform/sub-specs/auth-tasks.md`** — Task 5.7 Status block updated to add the line: *"PM ruling 2026-05-29 — `Accept with follow-up`. Branch-(b) delegation approved; live re-introduction queued behind the local Supabase stack DevOps work (Task 5.8 prerequisite)."*
2. **`.specify/features/005-lsl-platform/sub-specs/auth-tasks.md`** — Task 6.5 Status block updated to add the line: *"PM ruling 2026-05-29 — `Accept with follow-up`. Invalid-token proxy for expiry approved; real-TTL test queued behind the local Supabase stack DevOps work (Task 5.8 prerequisite)."*
3. **`docs/product/epic-status.md`** — E5.1 row updated to record the bundled follow-up (text above).

No code changed. No commits created.

---

## What needs operator decision before PM signs off Phase 6

Phase 6 is **6 of 8 tasks DONE**. The two outstanding tasks are the open questions in HANDOFF.md §"Open Questions":

1. **Task 5.8 (Playwright E2E golden path 1)** — needs local Supabase stack + Mailhog/`inbucket` in CI before it's reachable. This is DevOps work; the parallel DevOps session is already scoping it.
2. **Task 6.4 (Customise Supabase Auth email templates)** — dashboard config, operator-driven. Recommend PM coordinates with Designer for visual fidelity (per `docs/brand/style-guide.md` referenced in the spec) before the operator does the dashboard clicks.

**My recommendation to operator:**
- **PR #67 should NOT be moved out of draft until both 5.8 and 6.4 land, OR until operator explicitly defers them to a v1.1 milestone.** This was the original Phase 6 done-criteria; let's not silently slip it.
- If 5.8 + 6.4 slip past this week, defer them explicitly and mark Phase 6 "partial-complete" in `epic-status.md` so the slip is recorded (not silent).

No launch-guard impact either way — neither task touches the `ANTHROPIC_API_KEY` path or customer-facing privacy copy.

---

*PM sign-off pending Phase 6 completion of 5.8 + 6.4 (or explicit operator deferral).*
