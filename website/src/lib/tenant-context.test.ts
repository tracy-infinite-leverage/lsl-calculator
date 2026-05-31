/**
 * tenant-context.test.ts — contract + source-level tests for the TenantProvider.
 *
 * E6.3 Task 3.3. Vitest runs `environment: 'node'` (see `vitest.config.ts`)
 * with no JSDOM setup — the React tree cannot be rendered here. Coverage in
 * this file is two-pronged:
 *
 *   1. **Source-level structural assertions** — the file uses the load-bearing
 *      APIs (`SessionCookieClaims`, `createIdleTracker`, the `ACTIVITY_EVENTS`
 *      tuple, `buildHomeOrgContext`) and wires the activity listeners +
 *      effect-cleanup correctly. Matches the established pattern in
 *      `spinner.test.ts` / `select.test.ts`.
 *
 *   2. **Pure-function coverage** — `parseTenantClaimsCookie` is a pure
 *      function (no React, no DOM, no network) and gets full branch coverage
 *      here. This is where the hard-refresh hydration path's correctness is
 *      pinned: the cookie is parsed → claims fed to provider → state seeded
 *      from claims.
 *
 * The behavioural side of the React provider (mount, idle revert, cleanup) is
 * covered structurally by asserting the wiring + functionally via the
 * `tenant-context-idle.test.ts` suite which exercises the underlying tracker
 * primitive end-to-end. Playwright (E6.3 Phase 4) covers the integrated
 * browser path.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { parseTenantClaimsCookie, SESSION_CLAIMS_COOKIE_NAME } from './tenant-context';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const src = readFileSync(resolve(__dirname, 'tenant-context.tsx'), 'utf-8');
const serverSrc = readFileSync(resolve(__dirname, 'tenant-context-server.tsx'), 'utf-8');

// ---------------------------------------------------------------------------
// Section 1 — Cross-epic contract surface (SessionCookieClaims, cookie name)
// ---------------------------------------------------------------------------

describe('TenantProvider — SessionCookieClaims contract', () => {
  it('imports SessionCookieClaims as a type from the cross-epic contract module', () => {
    // The Task 3.3 AC mandates: "Reads against SessionCookieClaims type from
    // Task 3.3-bis (no inline duplicate of the cookie shape)." Assert the
    // import path is exactly `@/lib/auth/session-claims` so any drift trips
    // this test.
    expect(src).toMatch(
      /import\s+type\s+\{\s*SessionCookieClaims\s*\}\s+from\s+['"]@\/lib\/auth\/session-claims['"]/,
    );
  });

  it('does NOT inline-duplicate the SessionCookieClaims shape', () => {
    // Guard against the failure mode the AC explicitly warns about — a local
    // interface that drifts from the cross-epic contract. The reader side
    // must NOT redeclare claimIssuer / activeTenantId / homeTenantId /
    // membershipCount as its own interface.
    expect(src).not.toMatch(/interface\s+SessionCookieClaims\b/);
    // The only allowed reference to the literal claim-issuer string is the
    // discriminator check in parseTenantClaimsCookie + the matching check in
    // the provider's `initialClaims === null || claimIssuer !== ...` guard.
    // We assert it appears, but as a string-equality check, not a redeclaration.
    expect(src).toContain("claimIssuer === 'supabase-e5.1'");
  });

  it('exports the cookie name constant for cross-epic coordination with E5.1', () => {
    expect(SESSION_CLAIMS_COOKIE_NAME).toBe('lsl_session_claims');
    expect(src).toMatch(/export\s+const\s+SESSION_CLAIMS_COOKIE_NAME\s*=/);
  });
});

// ---------------------------------------------------------------------------
// Section 2 — Idle / activity wiring (revert path 2: 30-min idle)
// ---------------------------------------------------------------------------

describe('TenantProvider — idle / activity wiring (spec §8.3 + OQ-9)', () => {
  it('imports createIdleTracker + ACTIVITY_EVENTS from the pure-logic module', () => {
    expect(src).toMatch(
      /from\s+['"]@\/lib\/tenant-context-idle['"]/,
    );
    expect(src).toContain('createIdleTracker');
    expect(src).toContain('ACTIVITY_EVENTS');
    expect(src).toContain('IDLE_TIMEOUT_MS');
  });

  it('registers a window listener for every event in ACTIVITY_EVENTS', () => {
    // Source-level proof that the provider iterates the spec-mandated event
    // triad (mousemove / keydown / visibilitychange) and attaches listeners.
    expect(src).toMatch(
      /ACTIVITY_EVENTS\.forEach\(\s*\(\s*eventName\s*\)\s*=>\s*\{[\s\S]*window\.addEventListener/,
    );
  });

  it('cleans up listeners + disposes the tracker on effect teardown', () => {
    // The cleanup function inside the idle useEffect must call BOTH
    // `removeEventListener` (per event) and `tracker.dispose()` — without
    // either, mount/unmount churn leaks timers or listeners.
    expect(src).toMatch(/removeEventListener\(\s*eventName\s*,/);
    expect(src).toMatch(/tracker\.dispose\(\s*\)/);
  });

  it('passes IDLE_TIMEOUT_MS into the tracker (not a magic number)', () => {
    expect(src).toMatch(/timeoutMs:\s*IDLE_TIMEOUT_MS/);
  });

  it('uses Date.now and window.setTimeout/clearTimeout as the scheduler', () => {
    // The scheduler abstraction in tenant-context-idle.ts deliberately stays
    // injectable so tests can use fake timers. Production must use the real
    // clock + browser scheduler — this test pins that wiring.
    expect(src).toMatch(/now:\s*\(\s*\)\s*=>\s*Date\.now\(\s*\)/);
    expect(src).toMatch(/window\.setTimeout\(/);
    expect(src).toMatch(/window\.clearTimeout\(/);
  });

  it('guards the idle effect against SSR (no window.addEventListener on the server)', () => {
    expect(src).toMatch(/typeof\s+window\s*===\s*['"]undefined['"]/);
  });
});

// ---------------------------------------------------------------------------
// Section 3 — Hard-refresh hydration (revert path 1: cookie-driven)
// ---------------------------------------------------------------------------

describe('TenantProvider — hard-refresh hydration (spec §8.3 + OQ-9)', () => {
  it('declares a Server Component wrapper TenantProviderFromCookie that reads cookies()', () => {
    // The hard-refresh path depends on a Server Component reading the cookie
    // on every request, then passing claims as Client-Component props. The
    // wrapper lives in `tenant-context-server.tsx` (NOT in this file) because
    // a `'use client'` module cannot also export Server Components — see the
    // file header in `tenant-context-server.tsx` for the rationale.
    expect(serverSrc).toMatch(
      /export\s+async\s+function\s+TenantProviderFromCookie\b/,
    );
    expect(serverSrc).toMatch(/from\s+['"]next\/headers['"]/);
    expect(serverSrc).toContain('cookieStore.get(SESSION_CLAIMS_COOKIE_NAME)');
  });

  it('server wrapper imports the Client provider + cookie name from the client module', () => {
    // The two-file split must remain a clean handoff: the server wrapper
    // imports the Client Component + the parser + the cookie name constant
    // FROM tenant-context.tsx. Asserting the import path keeps the contract
    // explicit so a refactor can't quietly fold logic into the server file.
    expect(serverSrc).toMatch(
      /import\s+\{[^}]*SESSION_CLAIMS_COOKIE_NAME[^}]*TenantProvider[^}]*parseTenantClaimsCookie[^}]*\}\s+from\s+['"]\.\/tenant-context['"]/,
    );
  });

  it('server wrapper does NOT declare "use client" (would defeat the cookie read)', () => {
    expect(serverSrc).not.toMatch(/^['"]use client['"]/m);
  });

  it('does NOT persist activeTenantId to localStorage (would defeat hard-refresh revert)', () => {
    // Load-bearing negative test. If a future contributor adds
    // localStorage.setItem('activeTenantId', ...), OQ-9 silently breaks.
    expect(src).not.toMatch(/localStorage\./);
    expect(src).not.toMatch(/sessionStorage\./);
  });

  it('uses buildHomeOrgContext for the empty-claims fallback (single source of "home")', () => {
    expect(src).toContain('buildHomeOrgContext');
  });

  it('seeds initial state from the SessionCookieClaims prop (no fetch on mount)', () => {
    // The provider must derive its initial state synchronously from
    // `initialClaims` — no `useEffect(() => fetch('/api/me'), [])` or similar.
    // Spec §5.2: the cookie IS the source of truth at mount time.
    expect(src).not.toMatch(/fetch\(/);
  });
});

// ---------------------------------------------------------------------------
// Section 4 — Client/Server split + 'use client' directive
// ---------------------------------------------------------------------------

describe('TenantProvider — client/server split', () => {
  it('marks the module as a Client Component ("use client" directive)', () => {
    // The provider uses useState/useEffect/useContext — must be a Client
    // Component. The directive must appear above all imports/declarations,
    // though the established codebase convention is to place it after the
    // file-header jsdoc block (see `components/app-shell/UserMenu.tsx`). The
    // load-bearing check: the directive sits BEFORE the first `import`.
    const directiveAt = src.indexOf("'use client'");
    const firstImportAt = src.indexOf('\nimport ');
    expect(directiveAt).toBeGreaterThanOrEqual(0);
    expect(firstImportAt).toBeGreaterThan(directiveAt);
  });

  it('imports React hooks needed for state + effect + context', () => {
    expect(src).toContain('createContext');
    expect(src).toContain('useContext');
    expect(src).toContain('useState');
    expect(src).toContain('useEffect');
    expect(src).toContain('useMemo');
    expect(src).toContain('useCallback');
  });

  it('throws a precise error from useTenantContext when used outside the provider', () => {
    // Silent fallback would create a class of bug (banner disappears, nobody
    // knows). The hook must throw.
    expect(src).toMatch(
      /must be used within a <TenantProvider>/,
    );
  });
});

// ---------------------------------------------------------------------------
// Section 5 — parseTenantClaimsCookie (pure function — full branch coverage)
// ---------------------------------------------------------------------------

describe('parseTenantClaimsCookie', () => {
  const validClaims = {
    activeTenantId: 'org-acme',
    homeTenantId: 'org-acme',
    membershipCount: 1,
    claimIssuer: 'supabase-e5.1' as const,
  };

  it('returns null for undefined input', () => {
    expect(parseTenantClaimsCookie(undefined)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseTenantClaimsCookie('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseTenantClaimsCookie('not-json{')).toBeNull();
  });

  it('returns null for non-object JSON (number, array, null)', () => {
    expect(parseTenantClaimsCookie(JSON.stringify(42))).toBeNull();
    expect(parseTenantClaimsCookie(JSON.stringify([1, 2, 3]))).toBeNull();
    expect(parseTenantClaimsCookie(JSON.stringify(null))).toBeNull();
  });

  it('returns null when activeTenantId is missing', () => {
    const { activeTenantId, ...rest } = validClaims;
    void activeTenantId;
    expect(parseTenantClaimsCookie(JSON.stringify(rest))).toBeNull();
  });

  it('returns null when homeTenantId is missing', () => {
    const { homeTenantId, ...rest } = validClaims;
    void homeTenantId;
    expect(parseTenantClaimsCookie(JSON.stringify(rest))).toBeNull();
  });

  it('returns null when membershipCount is missing', () => {
    const { membershipCount, ...rest } = validClaims;
    void membershipCount;
    expect(parseTenantClaimsCookie(JSON.stringify(rest))).toBeNull();
  });

  it('returns null when claimIssuer is missing', () => {
    const { claimIssuer, ...rest } = validClaims;
    void claimIssuer;
    expect(parseTenantClaimsCookie(JSON.stringify(rest))).toBeNull();
  });

  it('returns null when claimIssuer does not match the contract value', () => {
    // The discriminator check is the load-bearing guard against
    // attacker-controlled or stale cookies leaking a tenant ID.
    expect(
      parseTenantClaimsCookie(
        JSON.stringify({ ...validClaims, claimIssuer: 'unknown-issuer' }),
      ),
    ).toBeNull();
  });

  it('returns null when membershipCount is a string (not a number)', () => {
    expect(
      parseTenantClaimsCookie(
        JSON.stringify({ ...validClaims, membershipCount: '1' }),
      ),
    ).toBeNull();
  });

  it('parses a valid plain-JSON cookie payload', () => {
    expect(parseTenantClaimsCookie(JSON.stringify(validClaims))).toEqual(validClaims);
  });

  it('parses a URL-encoded JSON cookie payload', () => {
    // Browsers / Vercel sometimes URL-encode JSON cookie payloads automatically.
    // The parser handles both shapes per the writer-contract note in the
    // parser docstring.
    const encoded = encodeURIComponent(JSON.stringify(validClaims));
    expect(parseTenantClaimsCookie(encoded)).toEqual(validClaims);
  });

  it('parses a payload where active and home differ (acting-as state)', () => {
    const actingAs = {
      activeTenantId: 'org-acme-client',
      homeTenantId: 'org-apa-consulting',
      membershipCount: 5,
      claimIssuer: 'supabase-e5.1' as const,
    };
    expect(parseTenantClaimsCookie(JSON.stringify(actingAs))).toEqual(actingAs);
  });
});
