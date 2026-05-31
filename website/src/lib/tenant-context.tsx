/**
 * tenant-context.tsx — TenantProvider + useTenantContext hook for the E6.3
 * `/app/*` workspace shell.
 *
 * Spec / tasks:
 *   - `.specify/features/006-ui-design-system/spec.md` v0.5 §5.2 + §8.3 + OQ-9
 *   - `.specify/features/006-ui-design-system/tasks.md` Task 3.3
 *   - `.specify/features/006-ui-design-system/impl-plan.md` §1.1 decision 4
 *     + §1.2 data model
 *
 * # Two revert paths (OQ-9)
 *
 * The spec mandates that the active tenant reverts to the user's home org in
 * two situations:
 *
 *   1. **Hard refresh** — when the user reloads the page (or navigates away
 *      and back, or opens a new tab on `/app/*`), the active tenant MUST
 *      reset to the home org. This is enforced by reading a server-rendered
 *      session cookie on every request: the cookie is the single source of
 *      truth for `activeTenantId` at mount time. The E5.1 writer side (the
 *      `tenant-switch` server action) is responsible for emitting a cookie
 *      that reads `activeTenantId === homeTenantId` on every fresh request
 *      that is NOT a tenant-switch — i.e. the cookie itself enforces the
 *      reset. E6.3 simply trusts the cookie.
 *
 *      Why "trust the cookie" not "always force home on mount"? Because the
 *      tenant-switch flow ALSO writes the cookie — and within that flow the
 *      cookie reads `activeTenantId === clientId`, which is the desired
 *      behaviour for the very next render (the user just clicked "switch into
 *      Acme Corp" — we want them to land inside Acme Corp). The hard-refresh
 *      semantics fall out of E5.1's cookie-write policy, not from a
 *      shell-side `useEffect`.
 *
 *      See `src/lib/auth/session-claims.ts` for the cross-epic contract.
 *
 *   2. **30-min idle** — after 30 minutes of no activity (`mousemove`,
 *      `keydown`, `visibilitychange`), the provider clears `activeTenantId`
 *      back to `homeTenantId` client-side. Implemented via the
 *      `createIdleTracker` primitive in `tenant-context-idle.ts` (see that
 *      module for the timer state machine). The activity listeners attach in
 *      a `useEffect` so SSR doesn't try to touch `window`.
 *
 * # Why the provider is a Client Component
 *
 * The provider owns:
 *   - `useState` for the current `activeTenantId`
 *   - `useEffect` to attach activity listeners + the idle timer
 *   - `useContext` consumers via `useTenantContext`
 *
 * All three are client-only React APIs. The provider is split from a server
 * wrapper (`<TenantProviderFromCookie>`, exported from this file) that reads
 * the cookie via `cookies()` from `next/headers` and forwards the initial
 * claims as props. This is the canonical Next.js 16 server-island pattern.
 *
 * # File header — usage example
 *
 * ```tsx
 * // app/app/layout.tsx
 * import { TenantProviderFromCookie } from '@/lib/tenant-context';
 *
 * export default async function AppLayout({ children }) {
 *   return (
 *     <TenantProviderFromCookie>
 *       {children}
 *     </TenantProviderFromCookie>
 *   );
 * }
 *
 * // Inside a Client Component beneath the provider:
 * import { useTenantContext } from '@/lib/tenant-context';
 *
 * function Banner() {
 *   const { isActingNonHome, activeTenantId } = useTenantContext();
 *   if (!isActingNonHome) return null;
 *   return <div>Acting as: {activeTenantId}</div>;
 * }
 * ```
 *
 * # What this file deliberately does NOT do
 *
 *   - **No localStorage** — the cookie is the only persistence layer for
 *     `activeTenantId`. localStorage would defeat OQ-9 (a stale localStorage
 *     value would survive hard refresh).
 *   - **No fetch / API call** — the initial state comes from the
 *     server-rendered cookie payload. Forcing a fetch on every shell render
 *     would create a flash of "home org" UI while the call resolves.
 *   - **No tenant-switch action** — `setActiveTenant` exists on the context
 *     for the TenantSwitcher (Task 3.4) to call, but the actual server
 *     mutation (writing a new cookie) is E5.1's responsibility. This file
 *     ships the client-side state; the cross-tab / persistence side lives in
 *     E5.1.
 */

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { SessionCookieClaims } from '@/lib/auth/session-claims';
import {
  ACTIVITY_EVENTS,
  IDLE_TIMEOUT_MS,
  buildHomeOrgContext,
  createIdleTracker,
  type IdleTracker,
} from '@/lib/tenant-context-idle';

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
 * The React-context shape consumed via `useTenantContext()`. Mirrors the
 * `TenantContext` type sketched in impl-plan.md §1.2 with two additions:
 *
 *   - `setActiveTenant(tenantId)` — local-state mutation, called by the
 *     TenantSwitcher (Task 3.4) when the user picks a different tenant. The
 *     server-side cookie write lives in E5.1; this just updates the in-memory
 *     view so the UI re-renders immediately.
 *   - `revertToHome()` — fires the same path the idle timer fires. Exposed
 *     so other surfaces (e.g. a "Done acting" button) can call it without
 *     going through the timer.
 */
export interface TenantContextValue {
  /** The tenant the user is currently acting on. */
  activeTenantId: string;
  /** The user's home org. Immutable for the lifetime of the session. */
  homeTenantId: string;
  /** Derived: `activeTenantId !== homeTenantId`. */
  isActingNonHome: boolean;
  /**
   * Number of org memberships. Gates `TenantSwitcher` visibility (OQ-4):
   * switcher hides when this is `< 2`.
   */
  membershipCount: number;
  /**
   * Client-side mutation. Updates the in-memory view; does NOT write the
   * cookie. The cookie write is E5.1's responsibility (server action).
   */
  setActiveTenant: (tenantId: string) => void;
  /**
   * Force the active tenant back to the home org. Used by the 30-min idle
   * timer and by any "stop acting" affordance in the UI.
   */
  revertToHome: () => void;
}

/**
 * Sentinel context value used when no provider is mounted above the
 * consumer. We deliberately initialise the context to `null` so
 * `useTenantContext()` can throw a precise "must be used within
 * TenantProvider" error rather than silently returning undefined defaults.
 */
const TenantContext = createContext<TenantContextValue | null>(null);

/**
 * Props for the Client-Component-side provider. Accepts the resolved
 * `SessionCookieClaims` directly — kept narrow so the server wrapper does
 * all the cookie-parsing work and this component stays a clean handoff.
 */
export interface TenantProviderProps {
  /**
   * The initial claims to seed the provider with. Pass `null` when no
   * cookie was present on the request — the provider then falls back to a
   * "no tenant context" stance: `activeTenantId === homeTenantId === ''`.
   * The shell renders, but the TenantSwitcher hides itself and the
   * ActingAsBanner never shows, which is the safe default.
   */
  initialClaims: SessionCookieClaims | null;
  children: ReactNode;
}

/**
 * Inner provider. Pure Client Component — accepts pre-resolved claims.
 *
 * The OQ-9 hard-refresh path is satisfied by virtue of the parent (the
 * server wrapper) reading a fresh cookie on every request and threading
 * it through `initialClaims`. There is no client-side persistence above
 * this provider; on every fresh mount, `useState` is seeded from the new
 * `initialClaims` value.
 */
export function TenantProvider({ initialClaims, children }: TenantProviderProps) {
  // Resolve the initial state from claims. If claims are null OR the issuer
  // discriminator doesn't match, fall back to an empty "no tenant" stance.
  // The discriminator check is the load-bearing guard against a stale or
  // attacker-controlled cookie leaking a tenant ID — per the contract in
  // `session-claims.ts` jsdoc.
  //
  // `initial` is memoised on `initialClaims` so the derivation runs once per
  // claims change and downstream `useState` / `useMemo` see stable references.
  const initial = useMemo(() => {
    if (initialClaims === null || initialClaims.claimIssuer !== 'supabase-e5.1') {
      return buildHomeOrgContext('', 0);
    }
    return {
      activeTenantId: initialClaims.activeTenantId,
      homeTenantId: initialClaims.homeTenantId,
      isActingNonHome: initialClaims.activeTenantId !== initialClaims.homeTenantId,
      membershipCount: initialClaims.membershipCount,
    };
  }, [initialClaims]);

  // The only piece of mutable state is `activeTenantId`. `homeTenantId` and
  // `membershipCount` are immutable for the lifetime of the session and come
  // straight from the memoised `initial` object — no `useRef` needed.
  //
  // On hard refresh, the provider remounts (the React tree gets a fresh root
  // because the page re-renders from the server with new props), and
  // `useState(initial.activeTenantId)` runs again with the cookie's latest
  // value. That IS the OQ-9 hard-refresh revert path.
  //
  // Tenant-switch (Task 3.4) flows:
  //   1. User clicks "switch to Acme Corp" in the switcher.
  //   2. Server action writes the new cookie + revalidates the path.
  //   3. The page re-renders from the server with `initialClaims.activeTenantId
  //      === 'acme-id'`. The Server Component layout passes new props.
  //   4. `useState` does NOT reset on prop change — React preserves it across
  //      re-renders of the same instance. So we ALSO call `setActiveTenant`
  //      from the switcher's click handler to update the in-memory view
  //      synchronously. The cookie + local state stay aligned.
  //
  // This avoids the React Compiler / `react-hooks/refs` lint hazard of
  // reading `.current` during render and the `react-hooks/set-state-in-effect`
  // hazard of mirroring prop changes via a `useEffect` setter.
  const [activeTenantId, setActiveTenantId] = useState<string>(initial.activeTenantId);

  /**
   * The single "revert to home" code path. Used by both the idle timer
   * (via the tracker's `onIdle` callback) and the public `revertToHome`
   * surface. Setting `activeTenantId = homeTenantId` is the entire revert
   * operation — the derived `isActingNonHome` falls out of the comparison.
   *
   * We capture `initial.homeTenantId` via the dep array so the callback
   * always closes over the latest home value — important if the layout ever
   * re-renders with refreshed claims (e.g. account switch while the tab
   * stays open).
   */
  const revertToHome = useCallback(() => {
    setActiveTenantId(initial.homeTenantId);
  }, [initial.homeTenantId]);

  /**
   * Public client-side mutation for the TenantSwitcher (Task 3.4). Updates
   * the in-memory view only; the cookie write is E5.1's responsibility.
   */
  const setActiveTenant = useCallback((tenantId: string) => {
    setActiveTenantId(tenantId);
  }, []);

  // -------------------------------------------------------------------------
  // Idle timer + activity listeners
  //
  // Mounts the tracker once. Re-creating it on every re-render would reset
  // the clock and silently break the 30-min revert. The empty dep array is
  // load-bearing — verified by source-level test in tenant-context.test.ts.
  // -------------------------------------------------------------------------
  useEffect(() => {
    // SSR guard. The provider is a Client Component so this effect doesn't
    // run on the server, but the `typeof window` check is belt-and-braces
    // against any future test setup that runs effects in a non-DOM env.
    if (typeof window === 'undefined') {
      return;
    }

    const tracker: IdleTracker = createIdleTracker({
      onIdle: revertToHome,
      now: () => Date.now(),
      // We hand the global `window.setTimeout` / `clearTimeout` directly to
      // the tracker. Wrapping in arrow functions avoids `this`-binding
      // surprises if a polyfill replaces them with non-method-form callables.
      schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
      cancel: (handle) => {
        // `handle` is `unknown` from the tracker's perspective. The actual
        // runtime type is the `setTimeout` return value, which `clearTimeout`
        // accepts in both Node and browser environments — the cast is purely
        // a TypeScript courtesy.
        window.clearTimeout(handle as number);
      },
      timeoutMs: IDLE_TIMEOUT_MS,
    });

    // Activity listener — touches the tracker on any of the spec-mandated
    // events. A single shared handler keeps the listener registration cheap
    // and lets the tracker handle the state machine.
    const handleActivity = () => {
      tracker.touch();
    };

    ACTIVITY_EVENTS.forEach((eventName) => {
      // `passive: true` on `mousemove` matters — without it, scrolling-heavy
      // pages incur an extra paint due to the listener blocking the compositor.
      // `keydown` and `visibilitychange` are not affected by passive in any
      // meaningful way; harmless to pass through.
      window.addEventListener(eventName, handleActivity, { passive: true });
    });

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      tracker.dispose();
    };
  }, [revertToHome]);

  // Memoise the context value so consumers don't re-render on every parent
  // re-render — only when one of the underlying values actually changes.
  //
  // `homeTenantId` + `membershipCount` flow straight through from the
  // memoised `initial` object (no refs, no ESLint hazards). The
  // `isActingNonHome` guard against `activeTenantId !== ''` keeps the banner
  // hidden when claims are absent (empty-string fallback from
  // `buildHomeOrgContext`).
  const value = useMemo<TenantContextValue>(
    () => ({
      activeTenantId,
      homeTenantId: initial.homeTenantId,
      isActingNonHome: activeTenantId !== initial.homeTenantId && activeTenantId !== '',
      membershipCount: initial.membershipCount,
      setActiveTenant,
      revertToHome,
    }),
    [activeTenantId, initial.homeTenantId, initial.membershipCount, revertToHome, setActiveTenant],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

/**
 * Hook for consuming the tenant context.
 *
 * Throws if called outside a `<TenantProvider>` — this is intentional. A
 * silent fallback would create a class of bug where the ActingAsBanner
 * disappears because the provider wasn't mounted, and we'd never know.
 */
export function useTenantContext(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (ctx === null) {
    throw new Error(
      'useTenantContext() must be used within a <TenantProvider>. ' +
        'Wrap the consuming subtree in TenantProvider (or TenantProviderFromCookie ' +
        'at the layout level — see app/app/layout.tsx).',
    );
  }
  return ctx;
}

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
 * `TenantProviderFromCookie` below.
 *
 * Exported so the same parser can be reused server-side OR client-side (e.g.
 * a Storybook decorator that fakes a cookie value for previews).
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

/**
 * Server-side cookie-reader wrapper for the TenantProvider lives in
 * `tenant-context-server.tsx`. It cannot live in this file because a file
 * with the `'use client'` directive at the top cannot ALSO export Server
 * Components — Next.js treats the entire module as a Client boundary, and
 * `next/headers` is a server-only API.
 *
 * The split mirrors the established `TopNav` / `TopNavPresentation` pattern
 * elsewhere in this codebase:
 *
 *   - `tenant-context.tsx`        ← Client Component: provider, hook, parser
 *   - `tenant-context-server.tsx` ← Server Component: reads cookie, forwards
 *
 * Consumers mount `TenantProviderFromCookie` from `tenant-context-server` at
 * layout level; client islands consume `useTenantContext` from this file.
 */
