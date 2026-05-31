/**
 * sidebar-routes.test.ts — unit coverage for the workspace sidebar logic.
 *
 * E6.3 Task 3.2. Exercises:
 *
 *   1. `SIDEBAR_ENTRIES` shape — seven entries in the spec order, every
 *      one carries the required fields.
 *
 *   2. `isVisible()` — `null` flag is always visible; a flag named here
 *      tracks `process.env[name] === 'true'`.
 *
 *   3. `visibleEntries()` — composition of (1) + (2); reflects current
 *      `process.env` state. Two cases: minimum (all flags off) and full
 *      (all flags on).
 *
 *   4. `isActive()` — exact match, prefix match (`/app/employees/123`
 *      highlights `/app/employees`), and `/app` → Employees home rule.
 *
 * No DOM, no JSX, no React — pure data + pure functions. Runs in vitest's
 * default `node` env per `vitest.config.ts`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SIDEBAR_ENTRIES,
  isActive,
  isVisible,
  visibleEntries,
} from './sidebar-routes';

// Names of the env vars `isVisible` references. Pulled into a constant so
// the per-test setup/teardown is exhaustive — adding a new flag in
// sidebar-routes.ts must come with an entry here OR the
// `visibleEntries({ all on })` test fails (good).
const FLAG_NAMES = [
  'NEXT_PUBLIC_FEATURE_PAY_CODES',
  'NEXT_PUBLIC_FEATURE_PAY_HISTORY',
  'NEXT_PUBLIC_FEATURE_VALUATIONS',
  'NEXT_PUBLIC_FEATURE_LIABILITY',
  'NEXT_PUBLIC_FEATURE_RECONCILIATION',
] as const;

/**
 * Snapshot every flag env var before each test, restore after. Mutating
 * process.env in a test is safe but the harness MUST be isolated — a
 * leaked `'true'` would silently turn other tests' expectations green.
 */
let flagSnapshot: Record<string, string | undefined>;

beforeEach(() => {
  flagSnapshot = Object.fromEntries(
    FLAG_NAMES.map((name) => [name, process.env[name]]),
  );
  // Default state: all flags absent. Tests opt entries in by setting the
  // flag explicitly to `'true'`.
  for (const name of FLAG_NAMES) {
    delete process.env[name];
  }
});

afterEach(() => {
  for (const name of FLAG_NAMES) {
    const prev = flagSnapshot[name];
    if (prev === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = prev;
    }
  }
});

// ---------------------------------------------------------------------------
// SIDEBAR_ENTRIES — shape contract
// ---------------------------------------------------------------------------

describe('SIDEBAR_ENTRIES', () => {
  it('contains all seven primary destinations in spec order', () => {
    expect(SIDEBAR_ENTRIES.map((e) => e.slug)).toEqual([
      'employees',
      'pay-codes',
      'pay-history',
      'valuations',
      'liability',
      'reconciliation',
      'settings',
    ]);
  });

  it('every entry carries a label, href, icon, and flag field', () => {
    for (const entry of SIDEBAR_ENTRIES) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.href.startsWith('/app/')).toBe(true);
      expect(typeof entry.icon).toBe('object'); // forwardRef object
      // `flag` is `string | null` — either a string OR explicit null. No
      // `undefined`, so the visibility check is total.
      expect(entry.flag === null || typeof entry.flag === 'string').toBe(true);
    }
  });

  it('marks Employees and Settings as always-visible (null flag)', () => {
    const employees = SIDEBAR_ENTRIES.find((e) => e.slug === 'employees');
    const settings = SIDEBAR_ENTRIES.find((e) => e.slug === 'settings');
    expect(employees?.flag).toBeNull();
    expect(settings?.flag).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isVisible
// ---------------------------------------------------------------------------

describe('isVisible', () => {
  it('returns true when flag is null', () => {
    expect(isVisible(null)).toBe(true);
  });

  it('returns false when the env var is unset', () => {
    delete process.env.NEXT_PUBLIC_FEATURE_PAY_CODES;
    expect(isVisible('NEXT_PUBLIC_FEATURE_PAY_CODES')).toBe(false);
  });

  it('returns true only on the literal string "true"', () => {
    process.env.NEXT_PUBLIC_FEATURE_PAY_CODES = 'true';
    expect(isVisible('NEXT_PUBLIC_FEATURE_PAY_CODES')).toBe(true);
  });

  it('returns false for truthy non-"true" values (avoid footguns)', () => {
    process.env.NEXT_PUBLIC_FEATURE_PAY_CODES = '1';
    expect(isVisible('NEXT_PUBLIC_FEATURE_PAY_CODES')).toBe(false);
    process.env.NEXT_PUBLIC_FEATURE_PAY_CODES = 'yes';
    expect(isVisible('NEXT_PUBLIC_FEATURE_PAY_CODES')).toBe(false);
    process.env.NEXT_PUBLIC_FEATURE_PAY_CODES = 'TRUE';
    expect(isVisible('NEXT_PUBLIC_FEATURE_PAY_CODES')).toBe(false);
  });

  it('returns false for an unknown flag name (defensive default)', () => {
    expect(isVisible('NEXT_PUBLIC_FEATURE_NEVER_REGISTERED')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// visibleEntries — composition
// ---------------------------------------------------------------------------

describe('visibleEntries', () => {
  it('with all flags off, returns only Employees + Settings', () => {
    const slugs = visibleEntries().map((e) => e.slug);
    expect(slugs).toEqual(['employees', 'settings']);
  });

  it('with all flags on, returns every entry in display order', () => {
    for (const name of FLAG_NAMES) {
      process.env[name] = 'true';
    }
    const slugs = visibleEntries().map((e) => e.slug);
    expect(slugs).toEqual([
      'employees',
      'pay-codes',
      'pay-history',
      'valuations',
      'liability',
      'reconciliation',
      'settings',
    ]);
  });

  it('selectively renders entries whose flag is on', () => {
    process.env.NEXT_PUBLIC_FEATURE_VALUATIONS = 'true';
    process.env.NEXT_PUBLIC_FEATURE_LIABILITY = 'true';
    const slugs = visibleEntries().map((e) => e.slug);
    expect(slugs).toEqual(['employees', 'valuations', 'liability', 'settings']);
  });
});

// ---------------------------------------------------------------------------
// isActive
// ---------------------------------------------------------------------------

describe('isActive', () => {
  it('returns true on exact path match', () => {
    expect(isActive('/app/employees', '/app/employees')).toBe(true);
  });

  it('returns true on a deep-link prefix match', () => {
    expect(isActive('/app/employees/abc-123', '/app/employees')).toBe(true);
    expect(isActive('/app/employees/abc-123/edit', '/app/employees')).toBe(true);
  });

  it('returns false on a sibling-route mismatch', () => {
    expect(isActive('/app/pay-codes', '/app/employees')).toBe(false);
    // Bare-prefix collision: "/app/employees-archive" must NOT highlight
    // "/app/employees". The `/`-suffix rule guards this.
    expect(isActive('/app/employees-archive', '/app/employees')).toBe(false);
  });

  it('treats /app as the Employees home route', () => {
    expect(isActive('/app', '/app/employees')).toBe(true);
    expect(isActive('/app/', '/app/employees')).toBe(true);
    // /app does NOT activate other entries
    expect(isActive('/app', '/app/settings')).toBe(false);
  });
});
