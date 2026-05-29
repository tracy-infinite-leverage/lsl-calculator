/**
 * Service-role Supabase client for server-only operations that must bypass
 * RLS — auditing, rate-limit counters, admin tasks. NEVER import this from
 * a client component, a Server Component that streams to the browser, or
 * anywhere the resulting client could escape to the public bundle.
 *
 * The key (`SUPABASE_SERVICE_ROLE_KEY`) is server-only per `website/AGENTS.md`
 * and `docs/engineering/vercel-config.md`. It does not have a `NEXT_PUBLIC_`
 * prefix, so Next.js will refuse to inline it into client bundles.
 *
 * Why a factory rather than a module-level singleton:
 *   - We want each server action / route handler to construct its own client
 *     so that misconfiguration surfaces at the call site, not on cold start.
 *   - The SDK's `createClient` is cheap (no network on construction).
 *   - Singletons across Next.js' route-handler boundary can cause stale
 *     auth state in some edge runtimes.
 *
 * Returns `null` when the env vars are missing. Callers must branch on null
 * and degrade gracefully (typically: log a warning, continue without the
 * audit row). The unverified-resend path uses this — a missing service-role
 * key must NOT block the user from resending; it just disables the
 * 5-per-24h application-side cap and falls back to Supabase's built-in
 * 1-per-60s cap.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      // Service-role clients are never persisted to a cookie store and never
      // refresh tokens — they authenticate per-request via the service-role JWT.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Read the source IP + user agent from a Next.js Request-like object. Vercel
 * sets `x-forwarded-for` with the client IP at index 0 of the
 * comma-separated list; locally that header is absent.
 *
 * Pure function — easy to unit-test, no Supabase dep.
 */
export function readClientFingerprint(headers: Headers): {
  ip: string | null;
  userAgent: string | null;
} {
  const xff = headers.get('x-forwarded-for');
  const ip = xff ? xff.split(',')[0]!.trim() : null;
  const userAgent = headers.get('user-agent') ?? null;
  return { ip, userAgent };
}
