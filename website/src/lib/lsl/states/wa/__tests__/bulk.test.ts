import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBulk } from '@/lib/lsl/bulk-runner';
import type { Employee, Trigger } from '@/lib/lsl/engine/types';

interface BulkFixture {
  name: string;
  title: string;
  source: string;
  input: {
    employees: Array<Employee & { _perRowTrigger?: Trigger }>;
    trigger: Trigger;
  };
  expected: {
    summary: { computed: number; blocked: number; failed: number };
    rowStatuses: Record<string, 'computed' | 'blocked_cross_jurisdiction' | 'failed'>;
    rowErrors?: Record<string, string>;
  };
}

function loadBulkFixtures(): BulkFixture[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, 'fixtures', 'bulk');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  return files
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf-8')) as BulkFixture);
}

const fixtures = loadBulkFixtures();

describe('WA bulk-mode fixtures', () => {
  for (const fx of fixtures) {
    describe(`${fx.name} — ${fx.title}`, () => {
      const triggerOverrides: Record<string, Trigger> = {};
      const employees: Employee[] = fx.input.employees.map((e) => {
        const { _perRowTrigger, ...rest } = e;
        if (_perRowTrigger) triggerOverrides[rest.id] = _perRowTrigger;
        return rest as Employee;
      });

      it('summary matches expected counts', async () => {
        const r = await runBulk({
          employees,
          defaultTrigger: fx.input.trigger,
          triggerOverrides,
        });
        expect({
          computed: r.summary.computed,
          blocked: r.summary.blocked,
          failed: r.summary.failed,
        }).toEqual(fx.expected.summary);
      });

      it('per-row statuses match', async () => {
        const r = await runBulk({
          employees,
          defaultTrigger: fx.input.trigger,
          triggerOverrides,
        });
        const actual: Record<string, string> = {};
        for (const row of r.results) {
          actual[row.employeeId] = row.status;
        }
        expect(actual).toEqual(fx.expected.rowStatuses);
      });

      if (fx.expected.rowErrors) {
        it('per-row error codes match', async () => {
          const r = await runBulk({
            employees,
            defaultTrigger: fx.input.trigger,
            triggerOverrides,
          });
          for (const [id, expectedCode] of Object.entries(fx.expected.rowErrors!)) {
            const row = r.results.find((x) => x.employeeId === id);
            expect(row?.error?.code).toBe(expectedCode);
          }
        });
      }
    });
  }
});
