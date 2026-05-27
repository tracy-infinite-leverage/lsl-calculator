/**
 * `/app/logout` — Task 5.5 (AC-AUTH-7).
 *
 * POST-only logout route. GET-based logout is explicitly NOT supported —
 * spec §8 row "Logout":
 *   "POST endpoint clears both access and refresh tokens server-side AND
 *    client-side. GET-based logout NOT supported (defends against CSRF
 *    logout attacks)."
 *
 * Behaviour:
 *   - POST  → `supabase.auth.signOut()` (revokes refresh, clears cookies via
 *            the SSR helper's `setAll`) → 303 redirect to `/app/login`.
 *            303 (See Other) is the correct status for POST → GET redirect;
 *            302 happens to work in practice but lets the browser repeat
 *            the POST on some old clients.
 *   - GET   → 405 with `Allow: POST` (spec §7.5 row "/app/logout").
 *   - other → 405 (same response shape).
 *
 * Audit-log:
 *   The task spec calls for an `event_type='logout'` row to be written.
 *   Two paths are possible:
 *     (a) write from this route handler using the service-role client,
 *     (b) write via a trigger / Postgres-side hook on the auth.sessions
 *         table.
 *   Phase 5 ships path (a) inlined here; the schema and policy don't
 *   change. Failure to write the audit row must NOT block the logout —
 *   so the insert is fire-and-forget with errors logged, never thrown.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Write a single `logout` row to `auth_audit_log` via the service-role
 * client. Service-role bypasses RLS — the table has no public policies
 * (spec §9.4 / Task 4.3). On any failure we log and move on; logout MUST
 * succeed even if the audit insert breaks.
 */
async function writeLogoutAudit(
  userId: string,
  request: NextRequest
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    // Service-role key is required in Vercel + local. If it's missing
    // we degrade gracefully — the user still logs out cleanly.
    console.warn(
      '[logout] SUPABASE_SERVICE_ROLE_KEY missing — skipping audit row.'
    );
    return;
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Source IP — Vercel sets `x-forwarded-for` with the client's IP at
  // position 0 of the comma-separated list. Locally this header is absent.
  const xff = request.headers.get('x-forwarded-for');
  const ip = xff ? xff.split(',')[0].trim() : null;
  const userAgent = request.headers.get('user-agent') ?? null;

  const { error } = await admin
    .from('auth_audit_log')
    .insert({
      user_id: userId,
      event_type: 'logout',
      ip,
      user_agent: userAgent,
    });

  if (error) {
    console.warn('[logout] audit insert failed:', error.message);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  // Capture the user id BEFORE signOut() so we can attribute the audit row.
  // Wrap in try/catch — a Supabase Auth outage should NOT block logout.
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }

  // Sign out — clears server-side refresh token + writes cookie-clearing
  // headers via the SSR helper's `setAll`. Errors here are non-fatal:
  // worst case the cookie is stale and the proxy will treat the next
  // request as a refreshed session, which will fail to refresh, and the
  // user is back at `/app/login` anyway.
  try {
    await supabase.auth.signOut();
  } catch {
    // intentional no-op
  }

  if (userId) {
    await writeLogoutAudit(userId, request);
  }

  // 303 See Other — the canonical POST→GET redirect status.
  return NextResponse.redirect(new URL('/app/login', request.url), {
    status: 303,
  });
}

/**
 * Single 405 handler reused by every non-POST verb. Returning the same
 * shape from a named GET export plus the catch-all keeps the response
 * stable regardless of which verb Next.js routes to us first.
 */
function methodNotAllowed(): NextResponse {
  return new NextResponse('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  });
}

export const GET = methodNotAllowed;
export const HEAD = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
