#!/usr/bin/env tsx
/**
 * Calibration helper — run the engine on a fixture's input and print the values that
 * the fixture's `expected.*` block should contain. Used during gold-standard suite authoring.
 *
 *   npx tsx scripts/calibrate-fixture.ts <relative-fixture-path>
 *
 * NOT a test; CI ignores this script.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateNSW } from '../src/lib/lsl/states/nsw';

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: tsx scripts/calibrate-fixture.ts <fixture.json>');
  process.exit(1);
}

const path = resolve(process.cwd(), arg);
const fx = JSON.parse(readFileSync(path, 'utf-8'));
const result = calculateNSW(fx.input.employee, fx.input.trigger);

const out = {
  name: fx.name,
  status: result.status,
  category: result.category,
  yearsOfContinuousService: result.diagnostics?.yearsOfContinuousService.toFixed(4),
  daysOfContinuousService: result.diagnostics?.daysOfContinuousService,
  daysNotCountedInService: result.diagnostics?.daysNotCountedInService,
  daysNotCountedInLookback: result.diagnostics?.daysNotCountedInLookback,
  weeklyAvg12mo: result.diagnostics?.weeklyAvg12mo.toFixed(6),
  weeklyAvg5yr: result.diagnostics?.weeklyAvg5yr.toFixed(6),
  valueOfWeek: result.outputs?.valueOfWeek.display,
  valueOfDay: result.outputs?.valueOfDay.display,
  totalEntitlementWeeks: result.outputs?.totalEntitlement.weeks.display,
  totalEntitlementDollars: result.outputs?.totalEntitlement.dollars.display,
  systemFormulaValue: result.outputs?.systemFormula?.display,
  variance: result.outputs?.systemFormula?.varianceDisplay,
  varianceSign: result.outputs?.systemFormula?.varianceSign,
  payableIndicator: result.diagnostics?.payableIndicator,
  warnings: result.warnings.map((w) => w.code),
  citations: [
    ...(result.outputs?.valueOfWeek.citations ?? []),
    ...(result.outputs?.valueOfDay.citations ?? []),
    ...(result.outputs?.totalEntitlement.weeks.citations ?? []),
    ...(result.outputs?.totalEntitlement.dollars.citations ?? []),
  ].map((c) => ({ section: c.section, rule: c.rule })),
};

console.log(JSON.stringify(out, null, 2));
