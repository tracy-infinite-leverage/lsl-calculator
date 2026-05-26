import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateTAS, calculateTASSafe } from '../index';
import { hasAllCitations } from '@/lib/lsl/engine/citation';
import type { Employee, Trigger, Citation } from '@/lib/lsl/engine/types';

interface Fixture {
  name: string;
  title: string;
  source: string;
  input: { employee: Employee; trigger: Trigger };
  expected: {
    status: 'computed' | 'blocked_cross_jurisdiction' | 'failed';
    category?: 'A' | 'B' | 'C';
    yearsOfContinuousService?: string;
    valueOfWeek?: string;
    valueOfDay?: string;
    totalEntitlementWeeks?: string;
    totalEntitlementDollars?: string;
    expected_citations?: Citation[];
    warnings?: string[];
    payableIndicator?: 'payable' | 'accrued_not_currently_payable';
    payable_by?: string;
    systemFormulaValue?: string;
    errorCode?: string;
  };
}

function loadFixtures(): Fixture[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, 'fixtures', 'single');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  return files
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf-8')) as Fixture);
}

const fixtures = loadFixtures();

describe('TAS gold-standard suite — single mode', () => {
  for (const fx of fixtures) {
    describe(`${fx.name} — ${fx.title}`, () => {
      const result =
        fx.input.trigger.kind === 'cash_out'
          ? calculateTASSafe(fx.input.employee, fx.input.trigger)
          : calculateTAS(fx.input.employee, fx.input.trigger);

      it('status matches', () => {
        expect(result.status).toBe(fx.expected.status);
      });

      if (fx.expected.errorCode) {
        it(`error.code = ${fx.expected.errorCode}`, () => {
          expect(result.error?.code).toBe(fx.expected.errorCode);
        });
      }

      if (fx.expected.status !== 'computed') return;

      if (fx.expected.category) {
        it(`category = ${fx.expected.category}`, () => {
          expect(result.category).toBe(fx.expected.category);
        });
      }

      if (fx.expected.yearsOfContinuousService !== undefined) {
        it(`years of continuous service = ${fx.expected.yearsOfContinuousService}`, () => {
          expect(result.diagnostics?.yearsOfContinuousService.toFixed(4)).toBe(
            fx.expected.yearsOfContinuousService
          );
        });
      }

      if (fx.expected.valueOfWeek !== undefined) {
        it(`value of week = $${fx.expected.valueOfWeek}`, () => {
          expect(result.outputs?.valueOfWeek.display).toBe(fx.expected.valueOfWeek);
        });
      }

      if (fx.expected.valueOfDay !== undefined) {
        it(`value of day = $${fx.expected.valueOfDay}`, () => {
          expect(result.outputs?.valueOfDay.display).toBe(fx.expected.valueOfDay);
        });
      }

      if (fx.expected.totalEntitlementWeeks !== undefined) {
        it(`total entitlement weeks = ${fx.expected.totalEntitlementWeeks}`, () => {
          expect(result.outputs?.totalEntitlement.weeks.display).toBe(
            fx.expected.totalEntitlementWeeks
          );
        });
      }

      if (fx.expected.totalEntitlementDollars !== undefined) {
        it(`total entitlement = $${fx.expected.totalEntitlementDollars}`, () => {
          expect(result.outputs?.totalEntitlement.dollars.display).toBe(
            fx.expected.totalEntitlementDollars
          );
        });
      }

      if (fx.expected.expected_citations && fx.expected.expected_citations.length > 0) {
        it('emits expected citations (membership)', () => {
          const all = [
            ...(result.outputs?.valueOfWeek.citations ?? []),
            ...(result.outputs?.valueOfDay.citations ?? []),
            ...(result.outputs?.totalEntitlement.weeks.citations ?? []),
            ...(result.outputs?.totalEntitlement.dollars.citations ?? []),
          ];
          const check = hasAllCitations(all, fx.expected.expected_citations!);
          expect(check.ok, `missing citations: ${JSON.stringify(check.missing)}`).toBe(true);
        });
      }

      if (fx.expected.warnings && fx.expected.warnings.length > 0) {
        it('emits expected warnings (membership)', () => {
          const codes = result.warnings.map((w) => w.code);
          for (const expected of fx.expected.warnings!) {
            expect(codes).toContain(expected);
          }
        });
      }

      if (fx.expected.payableIndicator) {
        it(`payable indicator = ${fx.expected.payableIndicator}`, () => {
          expect(result.diagnostics?.payableIndicator).toBe(fx.expected.payableIndicator);
        });
      }

      if (fx.expected.payable_by !== undefined) {
        it(`payable_by = ${fx.expected.payable_by}`, () => {
          expect(result.payable_by).toBe(fx.expected.payable_by);
        });
      }

      if (fx.expected.systemFormulaValue !== undefined) {
        it(`system formula = $${fx.expected.systemFormulaValue}`, () => {
          expect(result.outputs?.systemFormula?.display).toBe(fx.expected.systemFormulaValue);
        });
      }
    });
  }
});
