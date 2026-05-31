/**
 * tenant-context-idle.test.ts — unit tests for the pure idle-timer primitives.
 *
 * E6.3 Task 3.3. Covers BOTH revert paths mandated by spec §8.3 + OQ-9:
 *
 *   1. **30-min idle reverts to home org** — driven through `createIdleTracker`
 *      with `vi.useFakeTimers()`.
 *   2. **Hard-refresh reverts to home org** — exercised at the API level via
 *      `buildHomeOrgContext`, the same function the React provider falls back
 *      to when no claims cookie is present.
 *
 * The tests deliberately avoid pulling React in — vitest in this repo runs
 * `environment: 'node'` and the `.test.ts` glob excludes `.test.tsx`. The
 * React provider's contract (cookie parsing + activity listeners + effect
 * wiring) is verified in `tenant-context.test.ts` via source inspection.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACTIVITY_EVENTS,
  IDLE_TIMEOUT_MS,
  buildHomeOrgContext,
  createIdleTracker,
} from './tenant-context-idle';

// ---------------------------------------------------------------------------
// Module-level constants — spec sanity checks
// ---------------------------------------------------------------------------

describe('IDLE_TIMEOUT_MS', () => {
  it('is exactly 30 minutes in milliseconds (spec §5.2 + OQ-9)', () => {
    expect(IDLE_TIMEOUT_MS).toBe(30 * 60 * 1000);
  });
});

describe('ACTIVITY_EVENTS', () => {
  it('matches the spec-mandated triad — mousemove, keydown, visibilitychange', () => {
    // Tuple order matters less than membership; assert on the set.
    expect(new Set(ACTIVITY_EVENTS)).toEqual(
      new Set(['mousemove', 'keydown', 'visibilitychange']),
    );
  });

  it('is exposed as a readonly tuple of length 3', () => {
    expect(ACTIVITY_EVENTS).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// REVERT PATH 1 — 30-min idle (the timer-driven path)
// ---------------------------------------------------------------------------

describe('createIdleTracker — idle revert path (spec §8.3 + OQ-9)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Pin the clock to a known point so `Date.now()` is deterministic across
    // assertions. Choice of value is arbitrary; we just need it stable.
    vi.setSystemTime(new Date('2026-06-01T09:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onIdle after exactly IDLE_TIMEOUT_MS with no activity', () => {
    const onIdle = vi.fn();
    createIdleTracker({
      onIdle,
      now: () => Date.now(),
      schedule: (cb, delay) => setTimeout(cb, delay),
      cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    });

    // Just before the threshold — must NOT have fired yet.
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1);
    expect(onIdle).not.toHaveBeenCalled();

    // Cross the threshold.
    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onIdle if touch() is called inside the window', () => {
    const onIdle = vi.fn();
    const tracker = createIdleTracker({
      onIdle,
      now: () => Date.now(),
      schedule: (cb, delay) => setTimeout(cb, delay),
      cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    });

    // Drift to halfway, then touch — clock should restart.
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS / 2);
    tracker.touch();

    // Advance to where the ORIGINAL timer would have fired. If touch worked,
    // nothing happens.
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS / 2);
    expect(onIdle).not.toHaveBeenCalled();

    // Now drift to the new threshold from the touch — onIdle fires.
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS / 2);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('re-arms after onIdle fires so subsequent activity is tracked again', () => {
    const onIdle = vi.fn();
    const tracker = createIdleTracker({
      onIdle,
      now: () => Date.now(),
      schedule: (cb, delay) => setTimeout(cb, delay),
      cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    });

    // First fire.
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
    expect(onIdle).toHaveBeenCalledTimes(1);

    // User comes back — touch() should re-engage the tracker, then a fresh
    // 30 minutes of idle fires onIdle a second time.
    tracker.touch();
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
    expect(onIdle).toHaveBeenCalledTimes(2);
  });

  it('dispose() prevents any pending fire from running', () => {
    const onIdle = vi.fn();
    const tracker = createIdleTracker({
      onIdle,
      now: () => Date.now(),
      schedule: (cb, delay) => setTimeout(cb, delay),
      cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    });

    // Drift halfway, dispose, advance well past the threshold.
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS / 2);
    tracker.dispose();
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS * 2);

    expect(onIdle).not.toHaveBeenCalled();
  });

  it('touch() after dispose() is a no-op', () => {
    const onIdle = vi.fn();
    const tracker = createIdleTracker({
      onIdle,
      now: () => Date.now(),
      schedule: (cb, delay) => setTimeout(cb, delay),
      cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    });

    tracker.dispose();
    tracker.touch();
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS * 2);

    expect(onIdle).not.toHaveBeenCalled();
  });

  it('records the last activity timestamp on construction and on each touch()', () => {
    const startMs = Date.now();
    const tracker = createIdleTracker({
      onIdle: () => undefined,
      now: () => Date.now(),
      schedule: (cb, delay) => setTimeout(cb, delay),
      cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    });

    expect(tracker.getLastActivityAt()).toBe(startMs);

    vi.advanceTimersByTime(5_000);
    tracker.touch();
    expect(tracker.getLastActivityAt()).toBe(startMs + 5_000);

    tracker.dispose();
  });

  it('cancels the previous timer when touch() re-arms (no double-fire)', () => {
    const onIdle = vi.fn();
    const cancel = vi.fn((handle: unknown) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    });
    const tracker = createIdleTracker({
      onIdle,
      now: () => Date.now(),
      schedule: (cb, delay) => setTimeout(cb, delay),
      cancel,
    });

    // Touch a few times — each touch should cancel the prior pending timer.
    // Construction sets the first timer (no cancel yet — pending is null).
    tracker.touch(); // cancels timer #1, schedules #2
    tracker.touch(); // cancels timer #2, schedules #3
    tracker.touch(); // cancels timer #3, schedules #4

    expect(cancel).toHaveBeenCalledTimes(3);

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('respects the injectable timeoutMs (allows shortening for non-default callers)', () => {
    const onIdle = vi.fn();
    createIdleTracker({
      onIdle,
      now: () => Date.now(),
      schedule: (cb, delay) => setTimeout(cb, delay),
      cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      timeoutMs: 5_000,
    });

    vi.advanceTimersByTime(4_999);
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// REVERT PATH 2 — hard refresh (the cookie-driven path)
//
// The hard-refresh revert is enforced at TWO layers in the system:
//
//   a. E5.1's cookie writer ensures the cookie reads
//      `activeTenantId === homeTenantId` on any fresh request that isn't a
//      tenant-switch (out of scope for these tests; verified in E5.1's suite).
//
//   b. E6.3's TenantProvider falls back to a "home org" stance whenever the
//      claims cookie is absent or malformed. That fallback is `buildHomeOrgContext`
//      — the helper tested below. The provider's source-level test in
//      `tenant-context.test.ts` confirms the provider uses this helper.
// ---------------------------------------------------------------------------

describe('buildHomeOrgContext — hard-refresh fallback (spec §8.3 + OQ-9)', () => {
  it('produces a derived view with activeTenantId pinned to home', () => {
    const result = buildHomeOrgContext('home-org-id', 1);
    expect(result.activeTenantId).toBe('home-org-id');
    expect(result.homeTenantId).toBe('home-org-id');
  });

  it('always sets isActingNonHome=false (the whole point of "revert")', () => {
    expect(buildHomeOrgContext('home-org-id', 5).isActingNonHome).toBe(false);
    expect(buildHomeOrgContext('', 0).isActingNonHome).toBe(false);
  });

  it('passes membershipCount through unchanged', () => {
    expect(buildHomeOrgContext('home', 2).membershipCount).toBe(2);
    expect(buildHomeOrgContext('home', 7).membershipCount).toBe(7);
  });

  it('handles the empty-claims edge case (cookie absent / malformed)', () => {
    // When the provider has no claims, the safe fallback is "no tenant" —
    // empty strings + zero memberships. This keeps the switcher hidden (OQ-4
    // gates on membershipCount < 2) and the banner hidden (isActingNonHome
    // is false), per spec §8.3 fail-safe-to-home semantics.
    const result = buildHomeOrgContext('', 0);
    expect(result).toEqual({
      activeTenantId: '',
      homeTenantId: '',
      isActingNonHome: false,
      membershipCount: 0,
    });
  });
});
