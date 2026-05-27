/**
 * Supabase server-side client factory for Server Components, Server Actions,
 * and Route Handlers.
 *
 * Cookie semantics under Next.js 16:
 *   - `cookies()` from `next/headers` is **async** (was sync in <= Next 14).
 *   - Cookie writes are NOT allowed inside Server Components — only in Server
 *     Actions and Route Handlers. The `setAll` callback below wraps writes in
 *     a try/catch so callers from Server Components don't crash; cookies are
 *     refreshed by the proxy (`src/proxy.ts`) on the next request instead.
 *
 * The plan retains `supabase.auth.getUser()` (NOT `getClaims()`) for the
 * unverified-session gate at AC-AUTH-3a — the JWT does not carry
 * `email_confirmed_at`, so the canonical `auth.users` field is required.
 * See DEV-AUTH-1 in `.specify/features/005-lsl-platform/sub-specs/auth-impl-plan.md`.
 *
 * Reference: https://supabase.com/docs/guides/auth/server-side/creating-a-client
 *
 * @returns A configured `SupabaseClient` instance. ALWAYS create a fresh client
 *   per request — never share one across renders.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase environment variables are missing. Set ' +
        'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in ' +
        '.env.local (see website/.env.example) and in Vercel for Production + Preview.'
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components are read-only for cookies; this catch lets calls
          // from within them no-op silently. The proxy (`src/proxy.ts`) is
          // responsible for refreshing the session on each request, so any
          // updated tokens land there instead.
        }
      },
    },
  });
}
