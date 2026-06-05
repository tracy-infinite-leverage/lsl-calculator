/**
 * families.test.ts — invariants for the report-family registry.
 *
 * E6.5 Task 5.5 — pins the four-family enumeration and the posture map
 * that resolves G-1 (load-bearing OQ-6 contract).
 *
 * These tests are deliberately blunt: they assert the EXACT shape of
 * the posture map. If a future PR changes a family's posture (e.g.
 * makes `single-employee` authenticated), this test fails LOUD and forces
 * the change to land via a spec amendment + Task 5.5-bis test update.
 */

import { describe, it, expect } from 'vitest';
import {
  FAMILY_POSTURE,
  KNOWN_FAMILIES,
  isKnownFamily,
  type ReportFamily,
} from '../families';

describe('FAMILY_POSTURE — posture map (impl-plan §1.3, resolves G-1)', () => {
  it('contains exactly the four known families', () => {
    // The four families are spec-locked. Adding a 5th must come through a
    // spec amendment — this test catches accidental additions.
    expect(Object.keys(FAMILY_POSTURE).sort()).toEqual(
      ['bulk-summary', 'liability', 'reconciliation', 'single-employee'].sort(),
    );
  });

  it('marks `single-employee` as public (OQ-6 — public-calc CTA)', () => {
    expect(FAMILY_POSTURE['single-employee']).toBe('public');
  });

  it('marks `bulk-summary` as public (OQ-6 — same public CTA)', () => {
    expect(FAMILY_POSTURE['bulk-summary']).toBe('public');
  });

  it('marks `liability` as authenticated (tenant-scoped under /app/liability)', () => {
    expect(FAMILY_POSTURE.liability).toBe('authenticated');
  });

  it('marks `reconciliation` as authenticated (tenant-scoped under /app/reconciliation)', () => {
    expect(FAMILY_POSTURE.reconciliation).toBe('authenticated');
  });

  it('every posture value is exactly "public" or "authenticated"', () => {
    // Defensive: catch a future typo like `"publik"` or `"authed"` that
    // would silently break the route handler's branch logic.
    for (const family of Object.keys(FAMILY_POSTURE) as ReportFamily[]) {
      expect(['public', 'authenticated']).toContain(FAMILY_POSTURE[family]);
    }
  });
});

describe('KNOWN_FAMILIES — enumeration', () => {
  it('contains exactly the four families', () => {
    expect([...KNOWN_FAMILIES].sort()).toEqual(
      ['bulk-summary', 'liability', 'reconciliation', 'single-employee'].sort(),
    );
  });

  it('stays in lockstep with FAMILY_POSTURE keys', () => {
    expect([...KNOWN_FAMILIES].sort()).toEqual(
      Object.keys(FAMILY_POSTURE).sort(),
    );
  });
});

describe('isKnownFamily — typeguard', () => {
  it('returns true for each of the four known families', () => {
    expect(isKnownFamily('single-employee')).toBe(true);
    expect(isKnownFamily('bulk-summary')).toBe(true);
    expect(isKnownFamily('liability')).toBe(true);
    expect(isKnownFamily('reconciliation')).toBe(true);
  });

  it('returns false for unknown values', () => {
    expect(isKnownFamily('unknown')).toBe(false);
    expect(isKnownFamily('')).toBe(false);
    expect(isKnownFamily('SINGLE-EMPLOYEE')).toBe(false); // case-sensitive
    expect(isKnownFamily('single_employee')).toBe(false); // underscore vs hyphen
  });

  it('does NOT misidentify Object.prototype keys (prototype-pollution guard)', () => {
    // `Object.prototype.hasOwnProperty.call` (used in the implementation)
    // is the safe pattern. A naive `value in FAMILY_POSTURE` check would
    // accept `'toString'` / `'constructor'` etc.
    expect(isKnownFamily('toString')).toBe(false);
    expect(isKnownFamily('constructor')).toBe(false);
    expect(isKnownFamily('hasOwnProperty')).toBe(false);
    expect(isKnownFamily('__proto__')).toBe(false);
  });
});
