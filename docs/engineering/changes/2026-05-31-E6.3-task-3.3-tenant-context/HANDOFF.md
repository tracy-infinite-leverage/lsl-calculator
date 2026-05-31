# E6.3 Task 3.3 — TenantContext provider (home-org revert + idle reset)

**Date:** 2026-05-31
**Branch:** `feat/E6.3-3.3-tenant-context` (off `main`)
**Worktree:** `/Users/tracyangwin/code-projects/lsl-e6-3`
**Spec:** `.specify/features/006-ui-design-system/spec.md` v0.5 §5.2 + §8.3 + OQ-9
**Task:** `.specify/features/006-ui-design-system/tasks.md` Task 3.3 (size M)
**Cross-epic contract:** `.specify/features/006-ui-design-system/impl-plan.md` §1.1 decision 4

---

## What shipped

The E6.3 `/app/*` workspace shell's `TenantContext` provider. Three load-bearing
behaviours land:

1. **Hard refresh reverts active tenant to home org** (OQ-9, AC bullet 1).
2. **30-min idle reverts active tenant to home org** (OQ-9, AC bullet 2).
3. **User activity within the window keeps the active tenant** (AC bullet 3).

Plus the cross-epic contract surface — the provider reads against
`SessionCookieClaims` from `lib/auth/session-claims.ts` with NO inline
duplicate of the cookie shape (AC bullet 5).

## Files touched

NEW:

- `website/src/lib/tenant-context-idle.ts`
  Pure idle-timer primitives (no React, no DOM). Exports `IDLE_TIMEOUT_MS`,
  `ACTIVITY_EVENTS`, `createIdleTracker`, `buildHomeOrgContext`.

- `website/src/lib/tenant-context.tsx`
  `'use client'` Client Component module — `TenantProvider`,
  `useTenantContext` hook, `parseTenantClaimsCookie`,
  `SESSION_CLAIMS_COOKIE_NAME` constant.

- `website/src/lib/tenant-context-server.tsx`
  Server Component wrapper — `TenantProviderFromCookie` reads
  `next/headers#cookies()` and forwards parsed claims to `TenantProvider`.

- `website/src/lib/tenant-context-idle.test.ts`
  13 unit tests for the idle-timer primitives — covers both revert paths.

- `website/src/lib/tenant-context.test.ts`
  33 contract + structural + pure-function tests for the React provider.

MODIFIED:

- `website/src/app/app/layout.tsx`
  Wrapped the shell tree in `<TenantProviderFromCookie>` so every `/app/*`
  route gets a fresh cookie read on each request.

## Architecture

### Three-file split (mirrors existing TopNav pattern)

The existing codebase splits Server / Client boundaries into separate files
(see `components/app-shell/TopNav.tsx` — server wrapper around
`TopNavPresentation` client island). The tenant context follows the same
pattern, with one extra file for portable pure logic:

```
tenant-context-server.tsx   Server Component  — reads cookies()
        │
        ▼ (renders)
tenant-context.tsx          'use client'      — React provider + hook + parser
        │
        ▼ (uses)
tenant-context-idle.ts      Plain TS          — idle-timer primitives
```

The split is mandatory: a `'use client'` module cannot ALSO export Server
Components — Next.js treats the entire module as a Client boundary, and
`next/headers` is a server-only API. The three-file split keeps each file
single-purpose and lets the idle module run under `vitest`'s `node`
environment with no React/JSDOM dependencies.

### Hard-refresh revert path (OQ-9 #1)

Implemented at the server / client boundary:

1. Every `/app/*` request hits `app/app/layout.tsx` (a Server Component
   marked `force-dynamic`).
2. The layout mounts `<TenantProviderFromCookie>`, which reads the
   `lsl_session_claims` cookie via `next/headers#cookies()` (async in
   Next.js 16).
3. The parsed `SessionCookieClaims` (or `null` if absent / malformed) is
   handed as a prop into the Client Component `TenantProvider`.
4. `TenantProvider` seeds `useState` synchronously from the prop.

Because the cookie is the source of truth at every page render, hard refresh
collapses to "fresh cookie read → home-org default" — provided E5.1's writer
honours the contract (cookie reads `activeTenantId === homeTenantId` on any
fresh request that isn't a tenant-switch flow).

**No localStorage. No sessionStorage. No client-side fetch.** A unit test in
`tenant-context.test.ts` pins these as negative assertions.

### 30-min idle revert path (OQ-9 #2)

Implemented via `createIdleTracker` (pure logic) + a React `useEffect` that
attaches activity listeners and threads the tracker through:

1. On mount, the provider creates one idle tracker armed for 30 min.
2. The tracker arms a `setTimeout(onIdle, IDLE_TIMEOUT_MS)` on construction.
3. Every `mousemove` / `keydown` / `visibilitychange` calls `tracker.touch()`,
   which cancels the pending timer and re-arms a fresh one.
4. On 30 min of silence, the timer fires `onIdle` → `revertToHome` →
   `setActiveTenantId(initial.homeTenantId)`.
5. The tracker re-arms after firing so a returning user is tracked again.
6. Effect cleanup removes all listeners + disposes the tracker (no leaks
   on unmount or remount).

Activity events match the spec triad exactly:
`['mousemove', 'keydown', 'visibilitychange']`. Listener registration uses
`{ passive: true }` so `mousemove` doesn't block the compositor on
scroll-heavy pages.

### Cross-epic contract — `SessionCookieClaims`

The reader-side honours the existing `SessionCookieClaims` interface in
`lib/auth/session-claims.ts` verbatim — imported as a type, never
redeclared. The discriminator check (`claimIssuer === 'supabase-e5.1'`) is
applied in BOTH `parseTenantClaimsCookie` (parse-time) AND in the provider's
initial-state derivation (defence in depth — if a non-discriminated object
ever sneaked through the parser, the provider still falls safe to home).

Cookie name: `lsl_session_claims` — exported as
`SESSION_CLAIMS_COOKIE_NAME`. If E5.1 needs a different name, it's a
one-line change in `tenant-context.tsx` + a coordinated edit in E5.1's
writer.

## Tests — both revert paths covered (AC bullet 4)

**Idle revert (path 2):** `tenant-context-idle.test.ts` uses
`vi.useFakeTimers()` to deterministically exercise:

- Fires `onIdle` after exactly `IDLE_TIMEOUT_MS` (30 min).
- Does NOT fire if `touch()` was called inside the window.
- Re-arms after firing so subsequent activity is tracked again.
- `dispose()` cancels any pending fire.
- `touch()` after `dispose()` is a no-op.
- Cancels previous timer on each `touch()` (no double-fire).
- Respects an injectable `timeoutMs` for non-default callers.

**Hard-refresh revert (path 1):** Covered at two levels:

- `tenant-context-idle.test.ts > buildHomeOrgContext` exercises the helper
  that produces the "home org default" view — both for valid claims and the
  empty-claims edge case.
- `tenant-context.test.ts > parseTenantClaimsCookie` exercises every
  parser branch (undefined / empty / malformed JSON / non-object / missing
  fields / bad discriminator / type drift / valid plain / URL-encoded /
  acting-as state).
- `tenant-context.test.ts > TenantProvider — hard-refresh hydration`
  asserts the wiring: Server Component wrapper present, reads from
  `next/headers`, no localStorage / sessionStorage / fetch.

**Total:** 46 new tests across the two files. All green.

## Local CI gate state

```
npx tsc --noEmit            ✅ clean
npm run test                ✅ 2631 passed | 32 skipped
npm run lint                ✅ no new errors on touched files
                            (pre-existing lint debt unchanged: 10 errors
                            in calculator + global-error files, none mine)
npm run build               ✅ clean
audit-bundle (postbuild)    ✅ no third-party origins, no SVG @import leaks
```

## Design decisions worth flagging

1. **Two-file Server/Client split** rather than dynamic-import workaround.
   The dynamic-import-of-`next/headers`-inside-a-`'use client'`-file
   approach compiles but is incoherent at runtime — Next.js treats the file
   as a Client boundary. The clean split mirrors the existing `TopNav`
   pattern and keeps each module single-purpose.

2. **No `useEffect` to sync prop changes into state.** React Compiler /
   eslint rule `react-hooks/set-state-in-effect` forbids the pattern, and
   the React idiom for "reset state when prop changes" is to remount
   (which the server-component-driven layout does on every request anyway).
   The TenantSwitcher (Task 3.4) will call `setActiveTenant` from its
   click handler — that's the in-session update path.

3. **No `useRef` for "immutable" home tenant.** Reading `.current` during
   render trips `react-hooks/refs`. `initial.homeTenantId` (from the
   memoised `useMemo`) is the canonical home value; the dep arrays close
   over it. Simpler and lint-clean.

4. **Pure idle-tracker module separate from the React provider.** The
   `vitest` config in this repo uses `environment: 'node'` and matches
   only `.test.ts` (not `.test.tsx`). Lifting the timer state machine
   into a plain module means BOTH revert paths get deterministic
   `vi.useFakeTimers()` coverage with zero React/DOM dependency.

## Cross-epic surface impact

- **E5.1 (auth slice):** The cookie name (`lsl_session_claims`) and shape
  (`SessionCookieClaims`) are now load-bearing for E6.3. When E5.1 ships
  its tenant-switch action, it MUST write to this cookie name and shape.
  The `SESSION_CLAIMS_COOKIE_NAME` constant in `tenant-context.tsx` is the
  single source of truth — both sides import from there.

- **E6.3 Task 3.4 (TenantSwitcher + ActingAsBanner):** Will consume
  `useTenantContext()` directly. `isActingNonHome`, `membershipCount`,
  and `setActiveTenant` are the surfaces it needs — all on the context.

- **E6.3 Task 3.5 (ConfirmDestructiveDialog):** Will read
  `isActingNonHome` from the context to decide whether to show the
  confirm dialog.

- **No engine / calculator impact.** This is presentation-layer-only
  (spec §1.2). The `(calculator)` route group is untouched.

## What's NOT done in this PR

- TenantSwitcher (Task 3.4) — separate PR.
- ActingAsBanner (Task 3.4) — separate PR.
- ConfirmDestructiveDialog (Task 3.5) — separate PR.
- E5.1 cookie writer — E5.1's slice, not this one.
- Playwright E2E for the integrated hard-refresh + idle path —
  follows in Phase 4 of the epic per impl-plan §1.5.
- Storybook story for the provider — providers don't render visible UI
  directly; Task 3.4's switcher + banner stories will exercise it.

## How to test locally

```sh
# Tests
cd /Users/tracyangwin/code-projects/lsl-e6-3/website
npm test -- src/lib/tenant-context-idle.test.ts src/lib/tenant-context.test.ts

# Type check
npx tsc --noEmit

# Build (includes audit-bundle postbuild)
npm run build
```

## QA notes

- The 30-min idle threshold is hard-coded but injectable for testing via
  the tracker's `timeoutMs` option. Manual QA can shorten this via a one-line
  edit if a 30-min wait is impractical.
- The cookie name (`lsl_session_claims`) is currently unmounted by any
  writer — E5.1 hasn't shipped its tenant-switch flow yet. Until then, the
  cookie is always absent, the parser returns `null`, and the provider
  falls into its "no tenant context" empty-string fallback. That's the
  safe default and lets the rest of the shell render without crashing.
- The `useTenantContext()` hook throws if used outside a provider. This is
  intentional — silent fallback would hide a class of integration bugs.

## Followups (not blocking this PR)

- When E5.1 ships its tenant-switch server action, the writer side of the
  cookie contract closes. Coordinate the name + shape via the constants in
  `tenant-context.tsx` and `lib/auth/session-claims.ts`.
- If a downstream consumer reports needing access to `revertToHome` from
  outside React (e.g. a sign-out flow that wants to clear context), expose
  it via a singleton or a separate plain module — easy to add.
