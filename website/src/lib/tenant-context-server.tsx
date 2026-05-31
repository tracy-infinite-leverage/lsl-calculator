/**
 * tenant-context-server.tsx — Server Component wrapper that reads the
 * `lsl_session_claims` cookie on every request and forwards the parsed
 * `SessionCookieClaims` into the Client Component `TenantProvider`.
 *
 * E6.3 Task 3.3 (spec §5.2 + §8.3 + OQ-9).
 *
 * # Why a separate file
 *
 * The TenantProvider in `tenant-context.tsx` is marked `'use client'`
 * because it uses `useState` / `useEffect` / `useContext`. A file marked
 * `'use client'` cannot ALSO export Server Components — Next.js treats the
 * entire module as a Client boundary, and `next/headers` is a server-only
 * API that would fail to bundle / execute.
 *
 * The split mirrors the established `TopNav` / `TopNavPresentation` pattern
 * already used elsewhere in this codebase (see
 * `src/components/app-shell/TopNav.tsx`):
 *
 *   - Server wrapper reads request-scoped data (cookies, session, etc.)
 *   - Client island receives that data as plain props and owns the
 *     interactive surface.
 *
 * # OQ-9 hard-refresh contract
 *
 * Because this Server Component runs on every request and reads a fresh
 * cookie, OQ-9's "hard refresh reverts active tenant to home org" is
 * satisfied here:
 *
 *   1. E5.1's tenant-switch writer ensures the cookie reads
 *      `activeTenantId === homeTenantId` on any fresh request that isn't a
 *      tenant-switch flow.
 *   2. We read that cookie on every render.
 *   3. The Client Component `TenantProvider` seeds state synchronously
 *      from the resulting `SessionCookieClaims` prop.
 *
 * Result: hard refresh → fresh cookie read → home-org default. No
 * `useEffect`, no localStorage, no race.
 *
 * # Async because of Next.js 16
 *
 * `cookies()` from `next/headers` returns a Promise in Next 16 (was sync in
 * <= Next 14). The wrapper is therefore an `async` Server Component. The
 * app layout already awaits other async work (`headers()` for pathname
 * detection), so awaiting one more is free.
 */

import type { ReactNode } from 'react';
import { cookies } from 'next/headers';

import {
  SESSION_CLAIMS_COOKIE_NAME,
  TenantProvider,
  parseTenantClaimsCookie,
} from './tenant-context';

/**
 * Mount this in `app/app/layout.tsx` (or any Server Component above the
 * subtree that needs the tenant context). It does the cookie read + claim
 * parse, then renders the Client Component provider with parsed claims.
 *
 * Storybook decorators + unit tests for downstream components should mount
 * `TenantProvider` directly with synthesised `SessionCookieClaims`, NOT this
 * wrapper — the wrapper exists only to bridge the server / client boundary.
 */
export async function TenantProviderFromCookie({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_CLAIMS_COOKIE_NAME)?.value;
  const claims = parseTenantClaimsCookie(raw);

  return <TenantProvider initialClaims={claims}>{children}</TenantProvider>;
}
