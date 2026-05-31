/**
 * tenant-context-idle.ts — pure idle-timer + activity-tracker primitives for
 * the E6.3 TenantContext provider.
 *
 * Spec / tasks:
 *   - `.specify/features/006-ui-design-system/spec.md` v0.5 §5.2 + §8.3 + OQ-9
 *   - `.specify/features/006-ui-design-system/tasks.md` Task 3.3
 *
 * # Why this module exists separately
 *
 * The TenantProvider in `tenant-context.tsx` is a Client Component — it imports
 * React + uses `useState` / `useEffect` / `useRef`. Vitest in this repo runs
 * with `environment: 'node'` (see `vitest.config.ts`) and there is no JSDOM
 * setup, so React rendering / DOM events cannot be exercised in unit tests.
 *
 * The load-bearing behaviour of OQ-9 — the 30-min idle revert and the activity
 * reset — is pure-logic timer state management. Lifting it into a plain
 * module lets us:
 *
 *   1. Cover BOTH revert paths (hard-refresh hydration and idle timeout) with
 *      deterministic unit tests using `vi.useFakeTimers()` — no DOM, no
 *      `@testing-library/react`, no JSDOM. Honours the existing testing posture
 *      (see `spinner.test.ts`).
 *   2. Keep `tenant-context.tsx` thin — it wires the timer into React, but the
 *      timer itself is portable, framework-agnostic, and obviously correct.
 *   3. Avoid pulling React into the test module so the test runs in raw node.
 *
 * # Public surface
 *
 *   - `IDLE_TIMEOUT_MS` — single source of truth for the 30-min threshold.
 *     Exported so the React provider and tests can reference the same value.
 *   - `ACTIVITY_EVENTS` — the DOM events that reset the idle clock. Exported
 *     so the React provider attaches listeners and tests can reason about the
 *     reset surface.
 *   - `createIdleTracker({ onIdle, now, schedule, cancel })` — constructs an
 *     idle tracker with injectable clock + scheduler. The React provider
 *     passes `Date.now` + `setTimeout` / `clearTimeout`; tests inject fake
 *     timers. Returns `{ touch, dispose }`. Calling `touch()` records activity
 *     and re-arms the timer; `dispose()` clears any pending fire and prevents
 *     further callbacks.
 *
 * # Why injectable scheduler (not bare setTimeout)
 *
 * `setTimeout` IDs are typed differently between Node and browser environments,
 * and `vi.useFakeTimers()` patches the global. Injecting the scheduler lets the
 * test environment supply a deterministic stand-in if we ever need one — but
 * day-to-day the test will use `vi.useFakeTimers()` against the real
 * `setTimeout` / `clearTimeout` and we'll pass those through.
 */

/**
 * Idle revert threshold — 30 minutes per spec §5.2 + OQ-9.
 *
 * Exported as a `const` so React + tests share the exact value. If this needs
 * to change, it's a single-line edit here + a coordinated spec amend.
 */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Browser events that count as "user activity" and reset the idle clock.
 *
 * Spec §5.2 + Task 3.3 mandate the set: `mousemove`, `keydown`,
 * `visibilitychange`. These are the standard idle-tracker triad — pointer
 * input, keyboard input, and tab focus.
 *
 * Exported as a `readonly` tuple so the React provider attaches listeners in
 * a single `forEach` and tests can verify the surface against the spec.
 */
export const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'visibilitychange'] as const;

/**
 * Type-only shape of the activity-events tuple, exposed for callers that want
 * to type a partial subset (e.g. a test that registers only `keydown`).
 */
export type ActivityEvent = (typeof ACTIVITY_EVENTS)[number];

/**
 * Scheduler abstraction. Matches the runtime shape of `setTimeout` /
 * `clearTimeout` deliberately so the React provider can pass them through
 * with zero glue:
 *
 *   const tracker = createIdleTracker({
 *     onIdle,
 *     now: Date.now,
 *     schedule: (cb, delay) => window.setTimeout(cb, delay),
 *     cancel: (handle) => window.clearTimeout(handle),
 *   });
 *
 * The `unknown` handle type accommodates Node's `NodeJS.Timeout` and the DOM's
 * `number` without leaking either type into the module.
 */
export interface IdleTrackerScheduler {
  /** Returns the current time in milliseconds since epoch. */
  now: () => number;
  /** Schedules `callback` to fire after `delayMs`. Returns an opaque handle. */
  schedule: (callback: () => void, delayMs: number) => unknown;
  /** Cancels a previously-scheduled handle. No-op if `handle` is null. */
  cancel: (handle: unknown) => void;
}

/**
 * Options for `createIdleTracker`.
 */
export interface IdleTrackerOptions extends IdleTrackerScheduler {
  /**
   * Fires when the idle threshold has elapsed without a `touch()` call.
   * The React provider uses this to revert `activeTenantId → homeTenantId`.
   * After firing, the tracker auto-arms a fresh timer so the caller can
   * `touch()` again to re-engage — no need to dispose + recreate.
   */
  onIdle: () => void;
  /**
   * Idle threshold in milliseconds. Defaults to `IDLE_TIMEOUT_MS` (30 min).
   * Injectable purely for tests — production callers should accept the default.
   */
  timeoutMs?: number;
}

/**
 * Handle returned by `createIdleTracker`. The tracker is stateful (it owns
 * the pending timer handle) but the surface is intentionally minimal.
 */
export interface IdleTracker {
  /**
   * Record activity. Cancels any pending fire and arms a fresh one
   * `timeoutMs` from `now()`. Cheap — safe to call on every mousemove.
   */
  touch: () => void;
  /**
   * Tear down the tracker. Cancels any pending fire and renders subsequent
   * `touch()` calls inert. Call from the React provider's effect cleanup.
   */
  dispose: () => void;
  /**
   * Returns the timestamp of the most recent `touch()` (or the tracker's
   * creation time if `touch()` has not yet been called). Exposed primarily
   * for tests; the React provider does not need it.
   */
  getLastActivityAt: () => number;
}

/**
 * Construct an idle tracker. See `IdleTrackerOptions` for the contract.
 *
 * The tracker is armed immediately at construction time — if the caller does
 * nothing, `onIdle` will fire `timeoutMs` from now. This matches the React
 * provider's mount semantics (the moment the provider mounts, we're already
 * counting down toward the 30-min revert).
 */
export function createIdleTracker(options: IdleTrackerOptions): IdleTracker {
  const { onIdle, now, schedule, cancel, timeoutMs = IDLE_TIMEOUT_MS } = options;

  let disposed = false;
  let pending: unknown = null;
  let lastActivityAt = now();

  function arm(): void {
    // Always cancel before re-arming. `cancel(null)` is a no-op contract,
    // but we keep the guard explicit so the scheduler abstraction stays simple.
    if (pending !== null) {
      cancel(pending);
    }
    pending = schedule(() => {
      pending = null;
      if (disposed) {
        return;
      }
      onIdle();
      // After firing, re-arm so the caller can `touch()` to re-engage. This
      // matches "30-min idle → revert → user resumes → keep using the app"
      // without forcing the caller to recreate the tracker.
      if (!disposed) {
        lastActivityAt = now();
        arm();
      }
    }, timeoutMs);
  }

  // Arm immediately on construction. See module-level comment.
  arm();

  return {
    touch(): void {
      if (disposed) {
        return;
      }
      lastActivityAt = now();
      arm();
    },
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      if (pending !== null) {
        cancel(pending);
        pending = null;
      }
    },
    getLastActivityAt(): number {
      return lastActivityAt;
    },
  };
}

/**
 * Resolve the "post-revert" tenant context shape from the home tenant.
 *
 * Pure helper used by BOTH the hard-refresh hydration path (when no valid
 * cookie is present) and the idle-revert path (when 30 min has elapsed). The
 * single function makes it explicit that "revert" and "home org default"
 * collapse to the same operation, which is the whole point of OQ-9.
 *
 * Returns the **derived** view (with `isActingNonHome` precomputed) so the
 * React provider doesn't have to recompute on every render.
 */
export function buildHomeOrgContext(homeTenantId: string, membershipCount: number): {
  activeTenantId: string;
  homeTenantId: string;
  isActingNonHome: boolean;
  membershipCount: number;
} {
  return {
    activeTenantId: homeTenantId,
    homeTenantId,
    isActingNonHome: false,
    membershipCount,
  };
}
