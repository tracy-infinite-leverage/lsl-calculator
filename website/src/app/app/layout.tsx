/**
 * Layout for the authenticated app surface (`/app/*`).
 *
 * Two purposes:
 *
 *   1. Opt the entire `/app/*` route subtree out of static prerender by
 *      exporting `dynamic = 'force-dynamic'` once at the layout level
 *      instead of per-page. (Pre-existing behaviour; rationale below.)
 *
 *   2. Mount the workspace shell chrome — TopNav + Sidebar — around every
 *      `/app/*` page so the navigation is consistent across the surface.
 *      Per E6.3 Tasks 3.1 + 3.2 (spec §5.2 + §8.3).
 *
 * Why force-dynamic for this whole subtree:
 *
 *   a. Every `/app/*` page is gated by the proxy (`src/proxy.ts`), which
 *      reads/writes session cookies on each request. Pages here are
 *      effectively dynamic in practice — there is no scenario where a
 *      static prerender would be served.
 *
 *   b. Several pages (`verify-email`, `reset-password`, and any future
 *      page that calls `createSupabaseServerClient` at render time) read
 *      `NEXT_PUBLIC_SUPABASE_*` env vars during module evaluation. Those
 *      vars are absent in the GitHub Actions CI environment that runs
 *      `next build` (Vercel injects them at runtime, not at build time on
 *      CI), so a static prerender throws "Supabase environment variables
 *      are missing". Forcing dynamic here defers the Supabase client
 *      construction to request time and removes the entire class of bug
 *      from any future page added under `/app/*`.
 *
 *   c. This does NOT affect the public marketing/calculator routes —
 *      they live outside `/app/*` and continue to be statically rendered.
 *
 * Why the auth surfaces (login / signup / verify-email / etc.) opt out of
 * the chrome:
 *
 *   - Spec §4 carve-out: E5.1 auth screens stay on default shadcn and
 *     are NOT re-skinned by E6. Wrapping them in the TopNav + Sidebar
 *     would brand them by side-effect.
 *   - Auth surfaces own their own chrome via `<AuthLayout>` (see
 *     `src/components/auth/auth-layout.tsx`).
 *
 * The cleanest split is to detect the pathname at the route level and
 * skip the shell for the auth allow-list. Next.js layouts can't read
 * the pathname directly — `headers()` gives us the request URL on the
 * server side without a client island. The header read keeps the layout
 * a Server Component.
 */

import { headers } from 'next/headers';
import { TopNav } from '@/components/app-shell/TopNav';
import { Sidebar } from '@/components/app-shell/Sidebar';
import { TenantProviderFromCookie } from '@/lib/tenant-context-server';

export const dynamic = 'force-dynamic';

/**
 * Pathnames that render WITHOUT the app shell. Mirrors `PUBLIC_AUTH_ROUTES`
 * + the verify / logout / account routes from `src/proxy.ts`. Kept as a
 * literal set so a future contributor can `grep AUTH_SHELL_BYPASS` and
 * land on the canonical list.
 *
 * `/app/logout` is a POST route handler and never actually renders a
 * page — listing it here is belt-and-braces so a `GET /app/logout` (which
 * returns 405) doesn't render a malformed shell either.
 */
const AUTH_SHELL_BYPASS = new Set<string>([
  '/app/signup',
  '/app/login',
  '/app/forgot-password',
  '/app/reset-password',
  '/app/verify-email',
  '/app/account',
  '/app/logout',
]);

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // `headers()` returns the raw request headers. Next.js exposes the
  // resolved pathname under `x-pathname` (Next 16) — but as a defensive
  // fallback we also check `next-url` (Next ≤ 15 convention) and
  // `referer`. The order is "most-specific first" so we trust the
  // framework-emitted header when present.
  const headerList = await headers();
  const candidate =
    headerList.get('x-pathname') ??
    headerList.get('next-url') ??
    headerList.get('x-invoke-path');

  let pathname: string;
  if (candidate && candidate.startsWith('/')) {
    pathname = candidate.split('?')[0]!;
  } else {
    // Fallback — assume we're under a non-auth route. The shell still
    // renders, just without the bypass optimisation. The auth surfaces
    // own their own chrome via `<AuthLayout>` so rendering the shell
    // around them would only happen if BOTH headers were absent AND
    // somebody navigated to /app/login — which is impossible in
    // practice (proxy serves them via Server Component render path).
    pathname = '/app';
  }

  // Bypass the shell for auth surfaces.
  if (AUTH_SHELL_BYPASS.has(pathname)) {
    return <>{children}</>;
  }

  // Standard shell: TopNav full-width across the top, Sidebar pinned to
  // the left below it, main column flexes to fill the rest.
  //
  // The shell is wrapped in `TenantProviderFromCookie` — a Server Component
  // wrapper that reads the `lsl_session_claims` cookie via `next/headers`
  // and forwards the parsed `SessionCookieClaims` to the Client Component
  // provider. This is where OQ-9's "hard-refresh reverts to home org"
  // semantics are satisfied — every request reads a fresh cookie, and E5.1's
  // tenant-switch writer is responsible for ensuring the cookie reads
  // `activeTenantId === homeTenantId` on a fresh request. (See
  // `src/lib/tenant-context.tsx` for the full rationale.)
  return (
    <TenantProviderFromCookie>
      <div className="flex min-h-screen flex-col bg-brand-white">
        <TopNav />
        <div className="flex flex-1">
          <Sidebar />
          <main
            className="flex-1 overflow-y-auto bg-brand-white px-4 py-6 sm:px-6 lg:px-8"
            // Subtle ring so the main column reads as a panel against the
            // bg without competing with the wordmark for visual weight.
            data-testid="app-main"
          >
            {children}
          </main>
        </div>
      </div>
    </TenantProviderFromCookie>
  );
}
