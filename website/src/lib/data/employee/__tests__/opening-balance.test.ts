/**
 * Opening-balance reconciliation — unit tests.
 *
 * Phase 2 (Task 2.8) per E5.2 Employee Masterfile + Customer Setup.
 *
 * Covers:
 *   - `validateOpeningBalance(payload)` — pure validator (Result<OpeningBalance,ServiceError>)
 *   - `reconcileOpeningBalance({ csvValue, wizardValue })` — pure reconciler;
 *     applies AC-EMP-12 collision rule (wizard wins on collision); surfaces
 *     provenance + warnings; does NOT touch the DB.
 *
 * Why pure functions, not DB-touching:
 *   - Tasks.md §2.8 sizes this as S and frames it as a paired-test pair per
 *     AC-EMP-12 (CSV-only / wizard-only / both / neither). The DB upsert
 *     against `employees.opening_balance_*` lives in Task 2.6 (employee CRUD
 *     service) — that's where the Supabase client wiring already exists.
 *     This file is the pure reconciliation contract Task 2.6 will consume.
 *
 * Collision-resolution design question — see PR body. Tests assume
 * **Option 2 (policy-column-driven via organisations.opening_balances_method)**
 * is the persisted-collision contract. This file tests the pure reconciler
 * at the in-memory level; persisted-state collision is exercised in Phase 3
 * route-handler integration tests against the test branch.
 *
 * Refs:
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §4.2, §7 OQ-EMP-1
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-tasks.md §Task 2.8
 *   - AC-EMP-12 (wizard wins on collision; locked 2026-05-27).
 */

import { describe, it, expect } from 'vitest';
import {
  validateOpeningBalance,
  reconcileOpeningBalance,
  type OpeningBalance,
  type OpeningBalanceSource,
} from '../opening-balance';

// ─── validateOpeningBalance ──────────────────────────────────────────────────

describe('validateOpeningBalance', () => {
  describe('empty / null cases', () => {
    it('accepts a fully empty payload — all three fields optional', () => {
      const result = validateOpeningBalance({});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({});
      }
    });

    it('accepts an explicit null payload — all fields null', () => {
      const result = validateOpeningBalance({
        opening_balance_weeks: null,
        opening_balance_taken_weeks: null,
        opening_balance_as_at_date: null,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        // null normalises to undefined so downstream callers can rely on a
        // single absent shape.
        expect(result.data).toEqual({});
      }
    });
  });

  describe('opening_balance_weeks', () => {
    it('accepts a positive numeric value within range', () => {
      const result = validateOpeningBalance({ opening_balance_weeks: 12.5 });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.opening_balance_weeks).toBe(12.5);
    });

    it('accepts zero', () => {
      const result = validateOpeningBalance({ opening_balance_weeks: 0 });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.opening_balance_weeks).toBe(0);
    });

    it('accepts the maximum allowed value (numeric(8,4) → 9999.9999)', () => {
      const result = validateOpeningBalance({ opening_balance_weeks: 9999.9999 });
      expect(result.ok).toBe(true);
    });

    it('rejects a negative value', () => {
      const result = validateOpeningBalance({ opening_balance_weeks: -0.0001 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation_failed');
        expect(result.error.field).toBe('opening_balance_weeks');
      }
    });

    it('rejects a value above the numeric(8,4) ceiling', () => {
      const result = validateOpeningBalance({ opening_balance_weeks: 10000 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation_failed');
        expect(result.error.field).toBe('opening_balance_weeks');
      }
    });

    it('rejects NaN', () => {
      const result = validateOpeningBalance({ opening_balance_weeks: Number.NaN });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.field).toBe('opening_balance_weeks');
    });

    it('rejects Infinity', () => {
      const result = validateOpeningBalance({ opening_balance_weeks: Number.POSITIVE_INFINITY });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.field).toBe('opening_balance_weeks');
    });
  });

  describe('opening_balance_taken_weeks', () => {
    it('accepts a value ≤ opening_balance_weeks', () => {
      const result = validateOpeningBalance({
        opening_balance_weeks: 10,
        opening_balance_taken_weeks: 4,
      });
      expect(result.ok).toBe(true);
    });

    it('accepts equal to opening_balance_weeks (fully taken)', () => {
      const result = validateOpeningBalance({
        opening_balance_weeks: 5,
        opening_balance_taken_weeks: 5,
      });
      expect(result.ok).toBe(true);
    });

    it('rejects taken > accrued', () => {
      const result = validateOpeningBalance({
        opening_balance_weeks: 5,
        opening_balance_taken_weeks: 6,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation_failed');
        expect(result.error.field).toBe('opening_balance_taken_weeks');
      }
    });

    it('rejects negative taken', () => {
      const result = validateOpeningBalance({
        opening_balance_weeks: 10,
        opening_balance_taken_weeks: -1,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.field).toBe('opening_balance_taken_weeks');
    });

    it('rejects taken when accrued is null (no balance to take against)', () => {
      const result = validateOpeningBalance({
        opening_balance_taken_weeks: 3,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.field).toBe('opening_balance_taken_weeks');
    });
  });

  describe('opening_balance_as_at_date', () => {
    it('accepts an ISO date string in the past', () => {
      const result = validateOpeningBalance({
        opening_balance_as_at_date: '2024-01-01',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.opening_balance_as_at_date).toBe('2024-01-01');
      }
    });

    it('accepts today', () => {
      const today = new Date().toISOString().slice(0, 10);
      const result = validateOpeningBalance({
        opening_balance_as_at_date: today,
      });
      expect(result.ok).toBe(true);
    });

    it('rejects a future date', () => {
      const future = '2999-01-01';
      const result = validateOpeningBalance({
        opening_balance_as_at_date: future,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('validation_failed');
        expect(result.error.field).toBe('opening_balance_as_at_date');
      }
    });

    it('rejects a malformed date string', () => {
      const result = validateOpeningBalance({
        opening_balance_as_at_date: '2024-13-99',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.field).toBe('opening_balance_as_at_date');
    });

    it('rejects a non-ISO date format', () => {
      const result = validateOpeningBalance({
        opening_balance_as_at_date: '01/01/2024',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.field).toBe('opening_balance_as_at_date');
    });
  });
});

// ─── reconcileOpeningBalance ─────────────────────────────────────────────────

describe('reconcileOpeningBalance (AC-EMP-12 collision rules)', () => {
  // The four canonical AC-EMP-12 cases per tasks.md §Task 2.8:
  //   1. CSV value + wizard value → wizard wins
  //   2. CSV only                 → CSV wins
  //   3. Wizard only              → wizard wins
  //   4. Neither                  → result is null / all undefined

  const csvValue: OpeningBalance = {
    opening_balance_weeks: 8.0,
    opening_balance_taken_weeks: 2.0,
    opening_balance_as_at_date: '2024-06-30',
  };

  const wizardValue: OpeningBalance = {
    opening_balance_weeks: 10.0,
    opening_balance_taken_weeks: 3.5,
    opening_balance_as_at_date: '2025-01-01',
  };

  it('case 1: both present → wizard wins; CSV-overwritten warning surfaced', () => {
    const result = reconcileOpeningBalance({ csvValue, wizardValue });
    expect(result.balance).toEqual(wizardValue);
    expect(result.source).toBe<OpeningBalanceSource>('setup_wizard');
    expect(result.warnings).toContain('csv_value_overwritten');
  });

  it('case 2: CSV only → CSV wins; no warnings', () => {
    const result = reconcileOpeningBalance({ csvValue, wizardValue: null });
    expect(result.balance).toEqual(csvValue);
    expect(result.source).toBe<OpeningBalanceSource>('csv_field');
    expect(result.warnings).toEqual([]);
  });

  it('case 3: wizard only → wizard wins; no warnings', () => {
    const result = reconcileOpeningBalance({ csvValue: null, wizardValue });
    expect(result.balance).toEqual(wizardValue);
    expect(result.source).toBe<OpeningBalanceSource>('setup_wizard');
    expect(result.warnings).toEqual([]);
  });

  it('case 4: neither → balance is empty; source is null', () => {
    const result = reconcileOpeningBalance({ csvValue: null, wizardValue: null });
    expect(result.balance).toEqual({});
    expect(result.source).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  // ─── Edge / partial-payload cases ──────────────────────────────────────────

  it('treats an entirely-empty wizard payload as "no wizard value" (CSV wins)', () => {
    // An empty wizard object (all fields undefined) should NOT trigger the
    // wizard-wins rule. The rule is "wizard supplied a meaningful value".
    const result = reconcileOpeningBalance({ csvValue, wizardValue: {} });
    expect(result.balance).toEqual(csvValue);
    expect(result.source).toBe<OpeningBalanceSource>('csv_field');
    expect(result.warnings).toEqual([]);
  });

  it('treats an entirely-empty CSV payload as "no CSV value" (wizard wins)', () => {
    const result = reconcileOpeningBalance({ csvValue: {}, wizardValue });
    expect(result.balance).toEqual(wizardValue);
    expect(result.source).toBe<OpeningBalanceSource>('setup_wizard');
    expect(result.warnings).toEqual([]);
  });

  it('wizard wins atomically — the whole triple comes from wizard, not field-by-field merge', () => {
    // Intent check: if wizard supplies only opening_balance_weeks and CSV
    // supplies the other two, we DO NOT field-merge. The wizard payload is
    // the authoritative atomic unit when present. Operator semantics: a
    // wizard entry is a deliberate post-import correction; the whole
    // balance set comes from that correction.
    const partialWizard: OpeningBalance = { opening_balance_weeks: 7.5 };
    const result = reconcileOpeningBalance({ csvValue, wizardValue: partialWizard });
    expect(result.balance).toEqual(partialWizard);
    expect(result.balance.opening_balance_taken_weeks).toBeUndefined();
    expect(result.balance.opening_balance_as_at_date).toBeUndefined();
    expect(result.source).toBe<OpeningBalanceSource>('setup_wizard');
    expect(result.warnings).toContain('csv_value_overwritten');
  });

  it('zero values count as "present" (zero is a meaningful opening balance)', () => {
    // Edge case: a tenured employee with zero opening balance is meaningful
    // input — not "absent". Verifies we don't conflate `0` with `undefined`.
    const zeroCsv: OpeningBalance = {
      opening_balance_weeks: 0,
      opening_balance_taken_weeks: 0,
      opening_balance_as_at_date: '2024-06-30',
    };
    const result = reconcileOpeningBalance({ csvValue: zeroCsv, wizardValue: null });
    expect(result.balance).toEqual(zeroCsv);
    expect(result.source).toBe<OpeningBalanceSource>('csv_field');
  });

  it('returns an immutable-safe shape (no aliasing of input objects)', () => {
    // Defence: mutating the returned balance must not mutate the input.
    const result = reconcileOpeningBalance({ csvValue, wizardValue: null });
    (result.balance as OpeningBalance).opening_balance_weeks = 999;
    expect(csvValue.opening_balance_weeks).toBe(8.0);
  });
});
