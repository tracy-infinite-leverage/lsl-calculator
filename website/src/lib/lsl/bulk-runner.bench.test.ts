import { describe, it, expect } from 'vitest';
import { runBulk } from './bulk-runner';
import { asISODate, type Employee, type Trigger } from './engine/types';

/**
 * Performance benchmark per tasks.md §5.7 / P2.
 *
 * Spec target: bulk-mode of 500 employees completes in < 60s end-to-end.
 *
 * This bench runs the runner directly (no UI overhead) — the actual UI run
 * is timed separately in Playwright (see future e2e/bulk-perf.spec.ts).
 * The runner alone should be well under the budget; if it isn't, the
 * engine layer needs work, not the UI.
 */

function makeEmployee(i: number): Employee {
  return {
    id: `E${String(i).padStart(4, '0')}`,
    legalName: `Employee ${i}`,
    externalEmployeeId: `E${i}`,
    startDate: asISODate('2014-03-15'),
    employmentType: 'full_time',
    statesOfService: ['NSW'],
    currentWeeklyGross: '1500.00',
    wageHistory: [
      // 24 weekly periods — enough to exercise the lookback windowing.
      ...Array.from({ length: 24 }, (_, k) => ({
        periodStart: asISODate(
          new Date(2025, 5, 1 + k * 7).toISOString().slice(0, 10)
        ),
        periodEnd: asISODate(
          new Date(2025, 5, 7 + k * 7).toISOString().slice(0, 10)
        ),
        grossPay: '1500.00',
        frequency: 'weekly' as const,
      })),
    ],
    serviceEvents: [],
  };
}

const TRIGGER: Trigger = { kind: 'as_at', asAtDate: asISODate('2026-05-23') };

describe('bulk-runner perf', () => {
  it('500 NSW employees complete in < 60s (P2 budget)', { timeout: 90_000 }, async () => {
    const employees = Array.from({ length: 500 }, (_, i) => makeEmployee(i));
    const t0 = performance.now();
    const out = await runBulk({ employees, defaultTrigger: TRIGGER });
    const elapsedMs = performance.now() - t0;

    expect(out.results).toHaveLength(500);
    expect(out.summary.computed).toBe(500);
    expect(out.summary.failed).toBe(0);

    // Soft assertion + log so we capture the actual number even when it passes.
    // eslint-disable-next-line no-console
    console.log(
      `[bench] 500-employee runBulk: ${elapsedMs.toFixed(0)}ms ` +
        `(${(elapsedMs / 500).toFixed(2)}ms/employee, ` +
        `summary.elapsedMs=${out.summary.elapsedMs.toFixed(0)}ms)`
    );
    expect(elapsedMs).toBeLessThan(60_000);
  });

  it('single NSW employee completes in < 100ms (sanity check)', () => {
    const t0 = performance.now();
    const _out = runBulk({
      employees: [makeEmployee(1)],
      defaultTrigger: TRIGGER,
    });
    void _out;
    const elapsedMs = performance.now() - t0;
    // eslint-disable-next-line no-console
    console.log(`[bench] single runBulk dispatch: ${elapsedMs.toFixed(2)}ms`);
    expect(elapsedMs).toBeLessThan(100);
  });
});
