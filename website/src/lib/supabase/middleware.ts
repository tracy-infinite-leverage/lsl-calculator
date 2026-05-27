/**
 * Supabase client factory for the Next.js 16 proxy (`src/proxy.ts` — renamed
 * from `middleware.ts` in Next 16). This helper module keeps its `middleware`
 * filename because it's a utility, not the Next.js entry point.
 *
 * The proxy is the only place auth-token refreshes can be reliably written
 * back to the response. If this helper is misconfigured (e.g. `setAll` not
 * applied to the response), the symptoms are random logouts, early session
 * termination, JSON parse errors, or excessive refresh-token traffic — see
 * `@supabase/ssr`'s warning in `createServerClient.d.ts`.
 *
 * Returns a tuple-style object so the caller (the proxy) can:
 *   1. Use `supabase.auth.getUser()` to read the session
 *      (DO NOT switch to `getClaims()` — the JWT does not carry
 *      `email_confirmed_at`; see DEV-AUTH-1 in the impl plan).
 *   2. Branch on session/verification state to redirect.
 *   3. Return `getResponse()` so any cookies Supabase wrote during the
 *      `getUser()` call (typically token refresh) land on the response.
 *
 * Reference: https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export function createSupabaseProxyClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase environment variables are missing. Set ' +
        'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in ' +
        '.env.local (see website/.env.example) and in Vercel for Production + Preview.'
    );
  }

  // Mutable response — `setAll` reassigns this so cookies Supabase writes
  // during token refresh land on the outgoing response.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Re-create the response so the new cookies attach to a fresh
        // outgoing response that hasn't been streamed yet.
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          // Update the request cookies so any downstream code reading
          // them in this same request sees the new values.
          request.cookies.set(name, value);
          // And write them to the outgoing response.
          response.cookies.set(name, value, options);
        });
        // Cache-control + Pragma headers are critical: without these, a CDN
        // (Vercel Edge, CloudFront, Cloudflare) can cache a Set-Cookie response
        // and serve one user's session token to a different user. The
        // `@supabase/ssr` library supplies the exact headers needed.
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  return {
    supabase,
    /**
     * Call after `supabase.auth.getUser()` (or any auth call) to fetch the
     * response with any refresh-token cookies and cache-control headers
     * applied. Always return this from `proxy.ts` — never the original
     * `NextResponse.next()`.
     */
    getResponse: () => response,
  };
}
