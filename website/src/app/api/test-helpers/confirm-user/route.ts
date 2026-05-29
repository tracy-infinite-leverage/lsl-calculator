/**
 * `/api/test-helpers/confirm-user` — Task 5.8 (E5.1 auth slice, golden-path 1).
 *
 * CI-ONLY ROUTE. This route exists to let Playwright simulate a user clicking
 * the verification link in their email without going through Supabase Auth's
 * email-delivery path (which is rate-limited on free tier and unreachable
 * from headless CI in any case). It is hard-gated to be effectively
 * non-existent in any production environment.
 *
 * Spec ref: `.specify/features/005-lsl-platform/sub-specs/auth-tasks.md` Task 5.8
 *   "backend test-helper marks email confirmed (simulating link click)"
 * DevOps scope: `docs/engineering/changes/2026-05-29-e51-auth-phase-6/DEVOPS-task-5.8-scope.md` Option B
 *
 * Gate (every check returns 404 — no acknowledgment of the route's existence
 * when not authorised, preserving plausible deniability in production):
 *
 *   1. `VERCEL_ENV === 'production'`        → 404. Belt-and-braces. Even if the
 *                                              CI_TEST_HELPER_TOKEN secret somehow
 *                                              leaks into Vercel Production env,
 *                                              the route still refuses.
 *   2. `!process.env.CI_TEST_HELPER_TOKEN`  → 404. The flag is GitHub-Actions-only
 *                                              and intentionally NOT in any Vercel
 *                                              env. Without it the route is dead.
 *   3. Authorization header mismatch        → 404. No 401 — we don't tell anyone
 *                                              there's a token-protected route here.
 *
 * Only after all three gates pass do we consult the request body. A malformed
 * body returns 400 (the caller is authorised, so an honest error is fine).
 *
 * Side effects on success:
 *   - `auth.users.email_confirmed_at = NOW()` via the admin SDK (the only
 *     primitive that can set this field — `signUp` won't set it, `updateUser`
 *     can't either).
 *   - One `auth_audit_log` row with `event_type='test_helper_confirm_user'`
 *     so any production hit (which shouldn't be possible per the gate) is
 *     loud and traceable.
 *   - `console.warn` with `[TEST HELPER USED]` marker — visible in Vercel
 *     logs for any environment that does manage to invoke it.
 *
 * Returns:
 *   - 204 No Content on success
 *   - 400 on malformed/missing body (caller is authorised)
 *   - 404 on any gate miss (no acknowledgment of the route)
 *   - 500 if the Supabase admin call genuinely fails
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const NOT_FOUND = new NextResponse('Not Found', { status: 404 });

/**
 * Centralised gate. Returns null if the request is authorised; returns the
 * 404 response otherwise. Pulled out so the unit tests can exercise every
 * branch explicitly.
 */
function checkGate(request: NextRequest): NextResponse | null {
  // 1. Hard refusal in Vercel Production — even with a valid token. This is
  //    a deliberate belt-and-braces check: the secret is supposed to live
  //    only in GitHub Actions, but if it ever ends up in Vercel Production
  //    env this short-circuit keeps the route from becoming a verification
  //    bypass.
  if (process.env.VERCEL_ENV === 'production') {
    return NOT_FOUND;
  }

  // 2. The env flag is the existence switch. With the flag unset, the route
  //    is functionally non-existent — including in dev environments where
  //    the developer hasn't intentionally opted in.
  const expected = process.env.CI_TEST_HELPER_TOKEN;
  if (!expected) {
    return NOT_FOUND;
  }

  // 3. Authorization header check. We use the standard Bearer pattern. Any
  //    mismatch is a 404, NOT a 401 — we don't acknowledge there's a
  //    token-protected route here.
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NOT_FOUND;
  }

  // Constant-time compare via length-equalised string compare. JS doesn't
  // have a built-in constant-time string compare, but since both halves are
  // env-controlled (not attacker-controlled in any realistic scenario) we
  // accept a plain `!==` here.
  const expectedHeader = `Bearer ${expected}`;
  if (authHeader !== expectedHeader) {
    return NOT_FOUND;
  }

  return null;
}

/**
 * Look up a user by email via the admin SDK and update `email_confirmed_at`.
 * Pure side-effect function. Errors propagate to the caller.
 */
async function confirmUserByEmail(
  admin: SupabaseClient,
  email: string
): Promise<{ userId: string } | { error: 'not_found' } | { error: 'update_failed'; detail: string }> {
  // The admin SDK doesn't expose a direct `get-user-by-email` primitive in a
  // stable shape; we use `listUsers` with a manual filter. The result set
  // for a single page is bounded — for a CI test where each email is
  // freshly minted, the user is guaranteed to be on page 1 within seconds
  // of signup.
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (error) {
    return { error: 'update_failed', detail: error.message };
  }

  const lowered = email.toLowerCase().trim();
  const user = data.users.find((u) => (u.email ?? '').toLowerCase() === lowered);

  if (!user) {
    return { error: 'not_found' };
  }

  // `email_confirm: true` is the documented primitive for marking a user
  // confirmed via the admin SDK. Setting `email_confirmed_at` directly
  // through `updateUserById` is not supported by the public typed API.
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    email_confirm: true,
  });

  if (updateError) {
    return { error: 'update_failed', detail: updateError.message };
  }

  return { userId: user.id };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gateResponse = checkGate(request);
  if (gateResponse) {
    return gateResponse;
  }

  // Parse + validate body. Caller is authorised, so honest 400 is fine here.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse('Bad Request: invalid JSON', { status: 400 });
  }

  if (
    !body ||
    typeof body !== 'object' ||
    typeof (body as { email?: unknown }).email !== 'string'
  ) {
    return new NextResponse('Bad Request: { email: string } required', {
      status: 400,
    });
  }

  const email = (body as { email: string }).email.trim();
  if (email.length === 0 || !email.includes('@')) {
    return new NextResponse('Bad Request: invalid email', { status: 400 });
  }

  // Construct the admin client. We do NOT use the existing
  // `createSupabaseAdminClient` helper because it returns `null` on missing
  // env vars and we want to surface a hard 500 here — a test-helper that
  // silently no-ops is worse than one that fails loudly.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error(
      '[test-helper:confirm-user] missing Supabase admin env vars — refusing to operate'
    );
    return new NextResponse('Server Misconfigured', { status: 500 });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.warn('[TEST HELPER USED] confirm-user', {
    email,
    vercelEnv: process.env.VERCEL_ENV ?? 'local',
    ts: new Date().toISOString(),
  });

  const result = await confirmUserByEmail(admin, email);

  if ('error' in result) {
    if (result.error === 'not_found') {
      return new NextResponse('User Not Found', { status: 404 });
    }
    console.error(
      '[test-helper:confirm-user] admin update failed:',
      result.detail
    );
    return new NextResponse('Confirm Failed', { status: 500 });
  }

  // Audit row — best-effort. A failure here does NOT block the success
  // response; the test should still pass, and the warn line above is the
  // last-resort trail.
  try {
    const xff = request.headers.get('x-forwarded-for');
    const ip = xff ? xff.split(',')[0]!.trim() : null;
    const userAgent = request.headers.get('user-agent') ?? null;

    const { error: auditError } = await admin.from('auth_audit_log').insert({
      user_id: result.userId,
      event_type: 'test_helper_confirm_user',
      ip,
      user_agent: userAgent,
      metadata: {
        vercel_env: process.env.VERCEL_ENV ?? 'local',
      },
    });
    if (auditError) {
      console.warn(
        '[test-helper:confirm-user] audit insert failed:',
        auditError.message
      );
    }
  } catch (err) {
    console.warn(
      '[test-helper:confirm-user] audit insert threw:',
      err instanceof Error ? err.message : String(err)
    );
  }

  return new NextResponse(null, { status: 204 });
}

/**
 * Single 404 handler reused by every non-POST verb. Returning 404 (not 405)
 * matches the route-existence-denial pattern of the gate.
 */
function notFound(): NextResponse {
  return new NextResponse('Not Found', { status: 404 });
}

export const GET = notFound;
export const HEAD = notFound;
export const PUT = notFound;
export const DELETE = notFound;
export const PATCH = notFound;
export const OPTIONS = notFound;
