/**
 * Next.js 16 proxy (renamed from `middleware` — see DEV-AUTH-1 in
 * `.specify/features/005-lsl-platform/sub-specs/auth-impl-plan.md`).
 *
 * Runs on every request matching `/app/:path*` (see `config.matcher` at the
 * bottom). Enforces the AC-AUTH-3a unverified-session gate from
 * `.specify/features/005-lsl-platform/sub-specs/auth.md` §7.5 — the
 * load-bearing security requirement of this slice.
 *
 * Routing contract (plan §2.3, distilled):
 *
 *   1. No session
 *      → public-auth routes (signup / login / forgot-password /
 *        reset-password / verify-email) pass through
 *      → everything else redirects to /app/login
 *
 *   2. Session but `email_confirmed_at IS NULL` (unverified)
 *      → narrow allow-list (verify-email / account / logout) per spec §7.5
 *      → everything else redirects to /app/verify-email
 *
 *   3. Session + verified
 *      → all /app/* passes through
 *
 *   4. Supabase Auth throws (outage)
 *      → /app/login?error=service_unavailable — never a 500
 *
 * Why `getUser()` and NOT `getClaims()`: the JWT does not carry
 * `email_confirmed_at`. The unverified gate needs the canonical
 * `auth.users` value, which only `getUser()` returns. Future devs:
 * do NOT "optimise" to `getClaims()` — it silently breaks the gate.
 * (DEV-AUTH-1, plan Decisions Log entry from Task 1.1.)
 *
 * Why the matcher is explicit `['/app/:path*']` and not a regex
 * exclusion: without it, Next.js applies the proxy to every route
 * including the public LSL calculator at `/`, which would break the
 * un-authenticated calc. (dev-grill amendment B1.)
 *
 * Public LSL calculator routes (`/`, `/calculator/*`, `/api/*`,
 * `/privacy`, `/blog/*`, etc.) are NOT under `/app/*` and therefore
 * never hit this proxy. Smoke-tested in Task 9.8.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseProxyClient } from '@/lib/supabase/middleware';

/**
 * Routes reachable without a session. Auth surfaces only — the public
 * calc is OUTSIDE `/app/*` and doesn't need to appear here.
 */
const PUBLIC_AUTH_ROUTES = new Set<string>([
  '/app/signup',
  '/app/login',
  '/app/forgot-password',
  '/app/reset-password',
  '/app/verify-email',
]);

/**
 * Three (and only three) routes an unverified user can reach.
 * Per spec §7.5 — no wildcards, no computed paths, no creative additions.
 */
const UNVERIFIED_ALLOW_LIST = new Set<string>([
  '/app/verify-email',
  '/app/account',
  '/app/logout',
]);

/**
 * Build a redirect response that preserves any cookies the Supabase SSR
 * client wrote during `getUser()` (typically a refreshed access/refresh
 * token pair). Without this copy, a token refresh that coincides with a
 * proxy redirect is silently dropped, causing the user to bounce in a
 * refresh loop.
 */
function redirectPreservingCookies(
  request: NextRequest,
  destination: string,
  sourceResponse: NextResponse
): NextResponse {
  // Use the standard URL constructor (not `request.nextUrl.clone()` + pathname
  // assignment) — NextURL normalises trailing slashes based on `trailingSlash`
  // config in ways that surprised the unit tests. `new URL(pathOrUrl, base)`
  // is deterministic and handles query strings cleanly.
  const url = new URL(destination, request.url);

  const redirect = NextResponse.redirect(url);
  sourceResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  // Mirror any cache-control headers the Supabase SSR helper applied.
  // These prevent CDN poisoning of auth-cookie responses.
  sourceResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'cache-control' || key.toLowerCase() === 'pragma' || key.toLowerCase() === 'expires') {
      redirect.headers.set(key, value);
    }
  });
  return redirect;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  const { supabase, getResponse } = createSupabaseProxyClient(request);

  // Read the canonical session state from Supabase Auth. Wrapped in try/catch
  // per dev-grill amendment B3 — a Supabase outage must never produce a 500.
  let user;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    return redirectPreservingCookies(
      request,
      '/app/login?error=service_unavailable',
      getResponse()
    );
  }

  // Case 1 — no session.
  if (!user) {
    if (PUBLIC_AUTH_ROUTES.has(pathname)) {
      return getResponse();
    }
    return redirectPreservingCookies(request, '/app/login', getResponse());
  }

  // Case 2 — session but unverified email.
  // `email_confirmed_at` is the canonical field; absent/null means unverified.
  if (user.email_confirmed_at == null) {
    if (UNVERIFIED_ALLOW_LIST.has(pathname)) {
      return getResponse();
    }
    return redirectPreservingCookies(request, '/app/verify-email', getResponse());
  }

  // Case 3 — session + verified. Pass through.
  return getResponse();
}

/**
 * Matcher — restrict the proxy to `/app/*` only. The public calc routes
 * (`/`, `/calculator/*`, `/api/*`, `/privacy`, `/blog/*`, ...) MUST NOT be
 * matched, otherwise an un-authenticated visit to the LSL calculator would
 * redirect to `/app/login`. Verified by Task 9.8 (public-calc regression
 * smoke test).
 *
 * Static assets under `/app/*` would also match if any existed — none do
 * today (assets live under `/public/`, served at `/foo.png` not `/app/foo.png`).
 * If that changes, add an exclusion such as `'/app/(?!_next|.*\\.(png|jpg|svg|webp)$)(.*)'`.
 */
export const config = {
  matcher: ['/app/:path*'],
};
