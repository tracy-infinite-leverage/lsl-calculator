/**
 * Supabase browser-side client factory.
 *
 * Used in Client Components and any code path that runs in the browser. The
 * `@supabase/ssr` package automatically wires up `document.cookie` reads/writes
 * when `cookies` is omitted, so we keep this simple.
 *
 * Reference: https://supabase.com/docs/guides/auth/server-side/creating-a-client
 *
 * @returns A configured `SupabaseClient` instance. Create a new client per
 *   component invocation rather than sharing one across renders.
 */

import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase environment variables are missing. Set ' +
        'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in ' +
        '.env.local (see website/.env.example) and in Vercel for Production + Preview.'
    );
  }

  return createBrowserClient(url, anonKey);
}
