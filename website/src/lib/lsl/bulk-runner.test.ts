import { describe, it, expect, vi } from 'vitest';
import { runBulk, BULK_CHUNK_SIZE } from './bulk-runner';
import { asISODate } from './engine/types';
import type { Employee, Trigger } from './engine/types';

function makeEmp(id: string, overrides: Partial<Employee> = {}): Employee {
  return {
    id,
    legalName: id,
    startDate: asISODate('2018-03-15'),
    employmentType: 'full_time',
    statesOfService: ['NSW'],
    currentWeeklyGross: '1500.00',
    wageHistory: [
      {
        periodStart: asISODate('2025-05-22'),
        periodEnd: asISODate('2026-05-21'),
        grossPay: '78000.00',
        frequency: 'weekly',
      },
    ],
    serviceEvents: [],
    ...overrides,
  };
}

const asAt2026: Trigger = { kind: 'as_at', asAtDate: asISODate('2026-05-23') };

describe('runBulk', () => {
  it('computes a small batch and reports progress per row', async () => {
    const employees = [makeEmp('A'), makeEmp('B'), makeEmp('C')];
    const onProgress = vi.fn();
    const r = await runBulk({ employees, defaultTrigger: asAt2026, onProgress });

    expect(r.results).toHaveLength(3);
    expect(r.results.every((x) => x.status === 'computed')).toBe(true);
    expect(r.summary.computed).toBe(3);
    expect(r.summary.failed).toBe(0);
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({ completed: 3, total: 3 })
    );
  });

  it('chunks into batches of BULK_CHUNK_SIZE', async () => {
    const n = BULK_CHUNK_SIZE * 2 + 5;
    const employees = Array.from({ length: n }, (_, i) => makeEmp(`E${i}`));
    const onProgress = vi.fn();
    const r = await runBulk({ employees, defaultTrigger: asAt2026, onProgress });

    expect(r.results).toHaveLength(n);
    // 3 batches: 25, 25, 5
    const lastCall = onProgress.mock.calls.at(-1)?.[0];
    expect(lastCall.batchCount).toBe(3);
    expect(lastCall.completed).toBe(n);
  });

  it('isolates a blocked cross-jurisdiction row without affecting peers', async () => {
    const ok = makeEmp('NSW-only');
    const blocked = makeEmp('multi-state', {
      statesOfService: ['NSW', 'VIC'],
      governingJurisdiction: undefined,
    });
    const r = await runBulk({
      employees: [ok, blocked],
      defaultTrigger: asAt2026,
    });
    expect(r.results[0].status).toBe('computed');
    expect(r.results[1].status).toBe('blocked_cross_jurisdiction');
    expect(r.summary.computed).toBe(1);
    expect(r.summary.blocked).toBe(1);
  });

  it('respects per-employee trigger overrides', async () => {
    const employees = [makeEmp('A'), makeEmp('B')];
    const override: Trigger = { kind: 'as_at', asAtDate: asISODate('2025-01-01') };
    const r = await runBulk({
      employees,
      defaultTrigger: asAt2026,
      triggerOverrides: { A: override },
    });
    expect(r.results[0].trigger).toEqual(override);
    expect(r.results[1].trigger).toEqual(asAt2026);
  });

  it('preserves input order in the results array', async () => {
    const employees = Array.from({ length: 50 }, (_, i) => makeEmp(`E${i}`));
    const r = await runBulk({ employees, defaultTrigger: asAt2026 });
    for (let i = 0; i < employees.length; i++) {
      expect(r.results[i].employeeId).toBe(`E${i}`);
    }
  });

  it('returns a populated summary', async () => {
    const employees = [makeEmp('A'), makeEmp('B')];
    const r = await runBulk({ employees, defaultTrigger: asAt2026 });
    expect(r.summary.total).toBe(2);
    expect(typeof r.summary.elapsedMs).toBe('number');
    expect(r.summary.cancelled).toBe(false);
  });
});
