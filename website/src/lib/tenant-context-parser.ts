/**
 * tenant-context-parser.ts — pure parser + cross-epic constants for the
 * `lsl_session_claims` cookie. Shared by the Client-side TenantProvider
 * (`tenant-context.tsx`) and the Server-side cookie reader
 * (`tenant-context-server.tsx`).
 *
 * Spec / tasks:
 *   - `.specify/features/006-ui-design-system/spec.md` v0.5 §5.2 + §8.3 + OQ-9
 *   - `.specify/features/006-ui-design-system/tasks.md` Task 3.3
 *
 * # Why this module exists separately
 *
 * `tenant-context.tsx` carries the `'use client'` directive — it owns
 * `useState` / `useEffect` / `useContext`. Next.js compiles every export of a
 * `'use client'` module into an opaque client reference when imported by a
 * Server Component. A Server Component can RENDER a client export, but cannot
 * CALL one. That made it impossible for `tenant-context-server.tsx` (a Server
 * Component) to invoke `parseTenantClaimsCookie` when it lived inside the
 * `'use client'` module — Next.js raised:
 *
 *   "Attempted to call parseTenantClaimsCookie() from the server but
 *    parseTenantClaimsCookie is on the client."
 *
 * Lifting the parser + the cookie-name constant into a non-directive module
 * (this file) restores symmetric access: both the Client provider and the
 * Server cookie reader import these pure values from here, and Next.js treats
 * the module as ordinary shared code, not a client boundary.
 *
 * # Public surface — canonical export paths
 *
 *   - `SESSION_CLAIMS_COOKIE_NAME` — the cross-epic cookie name. E5.1's writer
 *     side imports this exact symbol from `@/lib/tenant-context-parser` once
 *     it ships; do NOT import it from `@/lib/tenant-context` (the Client
 *     re-export is provided only for backwards compatibility with existing
 *     consumers, see jsdoc in `tenant-context.tsx`).
 *   - `parseTenantClaimsCookie(raw)` — pure parser. Safe to call from any
 *     module (Server, Client, route handlers, edge middleware).
 *
 * Both symbols are re-exported from `tenant-context.tsx` for source-level
 * test compatibility (the existing `tenant-context.test.ts` reads the client
 * file as a string and greps for these names). The re-exports are tagged in
 * the client file so a future cleanup can remove them once the test pivots
 * to the parser module directly.
 *
 * # No runtime React, no DOM, no Next.js APIs
 *
 * This file imports ONLY the `SessionCookieClaims` type. That keeps the module
 * tree-shakeable and safe to import from the proxy, edge middleware, route
 * handlers, server components, client components, and unit tests.
 */

import type { SessionCookieClaims } from '@/lib/auth/session-claims';

/**
 * Cookie name shared across E5.1 (writer) and E6.3 (reader).
 *
 * Cross-epic contract: if this name needs to change, the edit MUST land in
 * the same commit as the matching writer-side change in E5.1. Both sides
 * also read from `SessionCookieClaims` in `lib/auth/session-claims.ts` for
 * the payload shape — this constant is the analogous contract for the
 * cookie's *name*.
 *
 * The name uses a lowercased dash-separated scheme to match Vercel /
 * Supabase cookie conventions; the `lsl_` prefix namespaces it away from
 * Supabase's own auth cookies (`sb-*`) so a misconfigured cookie-cleanup
 * sweep can't accidentally nuke the active-tenant claim while leaving the
 * Supabase session intact (or vice versa).
 */
export const SESSION_CLAIMS_COOKIE_NAME = 'lsl_session_claims';

/**
 * Parse the raw `lsl_session_claims` cookie value into a `SessionCookieClaims`
 * object, or `null` if the cookie is absent / malformed / from an unexpected
 * issuer.
 *
 * Validates the discriminator (`claimIssuer === 'supabase-e5.1'`) and the
 * required fields. Returns `null` on any failure — the provider treats that
 * as "no tenant context" (safe default; banner hidden, switcher hidden).
 *
 * # Why this lives here and not in `session-claims.ts`
 *
 * Per the jsdoc in `session-claims.ts`: "A parser/validator would belong to
 * E5.1 (the writer side has the authoritative parser; the reader side calls
 * it). Mixing runtime code into [session-claims.ts] would create a circular
 * dependency surface."
 *
 * E5.1 hasn't shipped its parser yet, but E6.3 needs to read the cookie now.
 * This local reader is intentionally minimal — when E5.1 ships their
 * authoritative parser, the swap is a one-import change in
 * `TenantProviderFromCookie`.
 *
 * # Why this lives here and not in `tenant-context.tsx`
 *
 * The `tenant-context.tsx` module is marked `'use client'`. Any function
 * exported from a `'use client'` module becomes a client reference when
 * imported from Server Components — Next.js cannot invoke it server-side
 * (see file header for the original CI failure). Lifting the parser into
 * this non-directive module makes it symmetrically callable from either
 * side of the Client/Server boundary.
 */
export function parseTenantClaimsCookie(raw: string | undefined): SessionCookieClaims | null {
  if (typeof raw !== 'string' || raw.length === 0) {
    return null;
  }

  let decoded: unknown;
  try {
    // The cookie value is JSON-encoded then URL-encoded (E5.1 contract). Try
    // both — `decodeURIComponent` is a no-op on already-decoded strings, so
    // a writer that skips URL encoding still parses cleanly.
    decoded = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }

  if (decoded === null || typeof decoded !== 'object') {
    return null;
  }

  const obj = decoded as Record<string, unknown>;

  if (
    typeof obj['activeTenantId'] !== 'string' ||
    typeof obj['homeTenantId'] !== 'string' ||
    typeof obj['membershipCount'] !== 'number' ||
    obj['claimIssuer'] !== 'supabase-e5.1'
  ) {
    return null;
  }

  return {
    activeTenantId: obj['activeTenantId'],
    homeTenantId: obj['homeTenantId'],
    membershipCount: obj['membershipCount'],
    claimIssuer: 'supabase-e5.1',
  };
}
