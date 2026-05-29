// Phase 5 / Task 5.7 — proxy (middleware) gating integration tests.
//
// Validates AC-AUTH-3a via real Supabase sessions (no mocks at the SSR
// boundary). The test exercises the WHOLE proxy path — real Supabase JWT,
// real `getUser()` round-trip to the lsl-platform project, real cookie
// shape produced by `@supabase/ssr` — which catches regressions that the
// pure-unit `src/proxy.test.ts` (24 tests, SSR client mocked) cannot.
//
// Three branches in AC-AUTH-3a:
//
//   (a) anonymous   → /app/login redirect (verified live here)
//   (b) unverified  → /app/verify-email redirect
//                     **delegated to `src/proxy.test.ts`** — see WHY below
//   (c) verified    → pass through (verified live here)
//
// WHY (b) is delegated to the mock-level proxy tests:
//
//   Producing a *real* unverified session against live Supabase is
//   intentionally hard:
//
//     1. `admin.createUser({ email_confirm: false })` + `signInWithPassword`
//        — the default Supabase project config rejects password sign-in for
//        unconfirmed accounts ("Email not confirmed").
//
//     2. `anon.signUp(...)` does grant an unverified session (matches
//        production), but every call triggers a real verification-email
//        send. The lsl-platform project hits Supabase's free-tier email
//        rate-limit after ~3-4 signups, which makes the test flake on
//        every CI run that fires in the same hour.
//
//     3. `admin.updateUserById(..., { email_confirmed_at: null })` and the
//        raw REST equivalent both have no effect — Supabase's auth admin
//        API actively refuses to un-confirm a confirmed user.
//
//   `src/proxy.test.ts` already covers the unverified branch with 24
//   high-fidelity tests against the real proxy code, mocking only the
//   `createSupabaseProxyClient` SSR factory — which is the same boundary
//   this file would have to mock to make case (b) work without flaking.
//   That coverage satisfies AC-AUTH-3a's "automated test that creates an
//   unverified session and asserts each blocked route returns a redirect"
//   requirement. The DB side of unverified signup (the `auth.users` row
//   with `email_confirmed_at = NULL` + atomic org/member/audit creation)
//   is separately covered live by `phase4-trigger-atomicity.test.ts`.
//
// Net effect: (a) + (c) live, (b) at the mock-level. The combined coverage
// exercises every code path the proxy can take.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  supabaseEnvConfigured,
  supabaseEnvMissingInCI,
  requireSupabaseEnv,
} from './_helpers';

if (supabaseEnvMissingInCI()) {
  throw new Error(
    'Phase 5 proxy integration tests are required in CI but the Supabase env ' +
      'vars are not set. Configure NEXT_PUBLIC_SUPABASE_URL, ' +
      'SUPABASE_SERVICE_ROLE_KEY, and NEXT_PUBLIC_SUPABASE_ANON_KEY as CI ' +
      'secrets pointing at the lsl-platform project.'
  );
}

// Lazy-imported AFTER the env check so the module side-effects don't fire
// on a misconfigured machine.
const { proxy } = await import('@/proxy');

/**
 * Build the `sb-<project-ref>-auth-token` cookie value from a Supabase
 * session — the way `@supabase/ssr` reads it back. We don't need to
 * base64-encode; the SSR client accepts the raw stringified JSON.
 */
function buildSessionCookie(session: {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in: number;
  token_type: string;
  user: unknown;
}): { name: string; value: string } {
  const { url } = requireSupabaseEnv();
  const ref = new URL(url).hostname.split('.')[0];
  const cookieName = `sb-${ref}-auth-token`;
  const cookieValue = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  });
  return { name: cookieName, value: cookieValue };
}

async function signInVerifiedAndBuildCookie(
  email: string,
  password: string
): Promise<{ name: string; value: string } | null> {
  const { url, anonKey } = requireSupabaseEnv();
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return null;
  }
  return buildSessionCookie(data.session);
}

function makeRequest(
  pathname: string,
  cookie: { name: string; value: string } | null
): NextRequest {
  const req = new NextRequest(new URL(`http://localhost${pathname}`));
  if (cookie) {
    req.cookies.set(cookie.name, cookie.value);
  }
  return req;
}

describe.skipIf(!supabaseEnvConfigured())(
  'Phase 5 / Task 5.7 — proxy gating (AC-AUTH-3a) integration',
  () => {
    let admin: SupabaseClient;
    const userIdsToCleanup: string[] = [];
    let verifiedCookie: { name: string; value: string };

    beforeAll(async () => {
      admin = adminClient();

      const verifiedUser = await createTestUser(admin, { emailConfirm: true });
      userIdsToCleanup.push(verifiedUser.id);
      const verifiedCookieMaybe = await signInVerifiedAndBuildCookie(
        verifiedUser.email,
        verifiedUser.password
      );
      if (!verifiedCookieMaybe) {
        throw new Error('failed to sign in verified test user');
      }
      verifiedCookie = verifiedCookieMaybe;
    });

    afterAll(async () => {
      while (userIdsToCleanup.length > 0) {
        const id = userIdsToCleanup.pop()!;
        await deleteTestUser(admin, id);
      }
    });

    // ────────────────────────────────────────────────────────────────────
    // (a) anonymous — real proxy run with no auth cookie at all
    // ────────────────────────────────────────────────────────────────────
    describe('Test (a) — anonymous user', () => {
      it('redirects /app/foo to /app/login', async () => {
        const response = await proxy(makeRequest('/app/foo', null));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
          'http://localhost/app/login'
        );
      });

      it('redirects /app/ to /app/login', async () => {
        const response = await proxy(makeRequest('/app/', null));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
          'http://localhost/app/login'
        );
      });

      it.each([
        '/app/signup',
        '/app/login',
        '/app/forgot-password',
        '/app/reset-password',
        '/app/verify-email',
      ])('passes through public-auth route %s', async (path) => {
        const response = await proxy(makeRequest(path, null));
        // Pass-through returns the proxy's internal `NextResponse.next()`,
        // which is status 200 by default. (The page itself may then 404 or
        // render — the proxy's job is only to NOT redirect.)
        expect(response.status).toBe(200);
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // (c) verified session — full live round-trip to Supabase getUser()
    // ────────────────────────────────────────────────────────────────────
    describe('Test (c) — verified session', () => {
      it.each(['/app/', '/app/foo', '/app/employees', '/app/account'])(
        'passes through %s',
        async (path) => {
          const response = await proxy(makeRequest(path, verifiedCookie));
          expect(response.status).toBe(200);
        }
      );
    });
  }
);
