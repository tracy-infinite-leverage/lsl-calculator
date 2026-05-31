/**
 * Session cookie claims — cross-epic type contract (E5.1 ↔ E6.3).
 *
 * E6.3 Task 3.3-bis (`.specify/features/006-ui-design-system/tasks.md` lines
 * 315–329, spec §5.2 OQ-9 + impl-plan §1.1 decision 4 — resolves G-2).
 *
 * # Purpose
 *
 * Spec §5.2 mandates that the `/app/*` workspace shell MUST revert the active
 * tenant to the user's home org on hard refresh (OQ-9). The only way to honour
 * "hard refresh" semantics cleanly is to hydrate the active-tenant state from a
 * server-rendered value — a session cookie set during sign-in / tenant-switch
 * that is read on every request and reflected into `TenantContext` (E6.3 Task
 * 3.3) at render time.
 *
 * The cookie itself is owned by the E5.1 auth slice — written by the proxy
 * (`src/proxy.ts`) and / or the sign-in / tenant-switch server actions. E6.3
 * consumes it as the source of truth on initial render. The two epics ship in
 * parallel and may merge to `main` in either order, so they share a single
 * TypeScript interface defined here, by mutual agreement:
 *
 *   - E5.1 (writer) MUST shape the cookie payload to satisfy this interface.
 *   - E6.3 (reader) MAY read against this interface and TRUSTS the shape.
 *
 * If either side needs to evolve the shape (rename a claim, add a new claim,
 * change a type), the change lands in THIS file in the same commit as the
 * implementation change. There is no parallel "auth-side type" or "ui-side
 * type" — this file is the single source of truth.
 *
 * # Claim issuer
 *
 * The cookie is issued by E5.1 (Supabase SSR session cookie payload). For v1
 * the JWT is signed by the Supabase service role on the server during sign-in
 * / tenant-switch — never on the client. The `claimIssuer` discriminator below
 * pins the issuer name so a future migration (e.g. moving the issuer to an
 * external auth provider) is a renamed-string code search rather than a quiet
 * semantic change.
 *
 * # Why this is a type-only module
 *
 * No runtime helpers live here. A parser/validator would belong to E5.1 (the
 * writer side has the authoritative parser; the reader side calls it). Mixing
 * runtime code into this file would create a circular dependency surface: E6.3
 * would pull E5.1 implementation into the client bundle just to read a cookie.
 * The shape contract stays type-only; both sides bring their own runtime.
 *
 * # Future evolution
 *
 * If E5.1 adds a claim (e.g. `lastTenantSwitchAt` for telemetry), append it as
 * an OPTIONAL field here in the same PR. Removing or renaming a claim is a
 * breaking change to BOTH epics — coordinate in the PR description and ensure
 * the reader (E6.3) doesn't crash on an absent claim by guarding the read.
 *
 * # Cross-references
 *
 *   - Spec: `.specify/features/006-ui-design-system/spec.md` §5.2 (OQ-9)
 *   - Impl plan: `.specify/features/006-ui-design-system/impl-plan.md` §1.1
 *     decision 4
 *   - Tasks: `.specify/features/006-ui-design-system/tasks.md` Task 3.3-bis
 *   - E5.1 cookie writer (auth slice): `src/proxy.ts`,
 *     `src/lib/supabase/middleware.ts` — the canonical writer site lands as
 *     E5.1 / Task 3.x once tenant-switching ships.
 *   - E6.3 cookie reader (this epic): `src/lib/tenant-context.tsx` (Task 3.3).
 */

/**
 * The shape of the session-cookie claim payload exchanged between E5.1 (writer)
 * and E6.3 (reader).
 *
 * Treat this interface as the source of truth for the cookie body. Both epics
 * MUST honour the field names and types verbatim; any change here is a
 * coordinated cross-epic edit, not a local refactor.
 *
 * @example
 *   // E6.3 reader (Task 3.3 — tenant-context.tsx)
 *   const claims: SessionCookieClaims = parseSessionCookie(cookieHeader);
 *   if (claims.claimIssuer !== 'supabase-e5.1') {
 *     // Cookie was minted by an unknown issuer — fail safe to home org.
 *     return null;
 *   }
 *   return {
 *     activeTenantId: claims.activeTenantId,
 *     homeTenantId: claims.homeTenantId,
 *     membershipCount: claims.membershipCount,
 *   };
 */
export interface SessionCookieClaims {
  /**
   * The tenant ID the user is currently acting on. May equal `homeTenantId`
   * (user on their own org) or differ (e.g. APA consultant acting on a client
   * tenant after an explicit switch — see spec §4.3 persona).
   *
   * On a hard refresh, OQ-9 mandates that this MUST be reset to the
   * `homeTenantId` value. The E5.1 cookie writer enforces this reset on each
   * fresh request that lacks an `Idempotency-Key` style "I just switched"
   * marker — the exact mechanism is E5.1's concern.
   */
  activeTenantId: string;

  /**
   * The user's home org — the tenant they joined first or were invited into as
   * their primary org. The revert target for OQ-9 (hard refresh) and for the
   * 30-min idle reset (E6.3 Task 3.3). This claim is immutable for the
   * lifetime of the session.
   */
  homeTenantId: string;

  /**
   * The number of org memberships the user has. Gates the visibility of the
   * `TenantSwitcher` UI per OQ-4 (spec §5.2):
   *
   *   - `membershipCount < 2` → switcher hidden (single-org user)
   *   - `membershipCount >= 2` → switcher rendered (APA consultant or
   *     multi-org user)
   *
   * Carried here (and not derived in-shell) because E5.1 already knows the
   * count at sign-in time; recomputing it from a separate `/api/me` call on
   * every shell render is wasteful and creates a race window where the
   * switcher could flicker on first paint.
   */
  membershipCount: number;

  /**
   * Discriminator pinning the issuer of these claims. Hard-coded to
   * `'supabase-e5.1'` for v1 — the only issuer that exists today.
   *
   * The E6.3 reader (`lib/tenant-context.tsx`) MUST validate this value
   * before trusting the rest of the payload, so a malformed or
   * unexpectedly-issued cookie falls back to "no tenant context — treat as
   * home org" rather than silently leaking an attacker-controlled tenant ID
   * into the UI.
   *
   * String-literal union (not bare `string`) so a typo at the writer site
   * fails type-check at compile time.
   */
  claimIssuer: 'supabase-e5.1';
}
