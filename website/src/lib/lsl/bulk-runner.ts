/**
 * Bulk runner per tasks.md §4.5 / D15.
 *
 * Contract:
 *   - Iterate Employee[].
 *   - Chunk into batches of CHUNK_SIZE (25), `Promise.all` per batch.
 *   - Per-row try/catch: one failure NEVER aborts the batch — record it in
 *     the failed Result for that row and keep going. This is what "fault
 *     isolation" means in D15.
 *   - Stream progress (current row, total, batch index) via `onProgress`
 *     so the UI can render a progress bar.
 *
 * Why chunking: 500-row bulks need a yield point so the browser stays
 * responsive between batches. Promise.all of 500 sync engine calls would
 * still block the main thread for ~20+ seconds. With chunks we yield
 * naturally between microtasks.
 */

import { calculateNSWSafe } from '@/lib/lsl/states/nsw';
import type { Employee, Result, Trigger } from '@/lib/lsl/engine/types';

export const BULK_CHUNK_SIZE = 25;

export interface BulkRunInput {
  employees: Employee[];
  /** Default trigger when an employee doesn't carry one. Typically `as_at` upload date. */
  defaultTrigger: Trigger;
  /** Per-employee trigger override map keyed by employee.id. */
  triggerOverrides?: Record<string, Trigger>;
  /** Optional progress callback. Fires once per completed row. */
  onProgress?: (progress: BulkProgress) => void;
  /** Optional cancellation signal. Aborts after the current chunk finishes. */
  signal?: AbortSignal;
}

export interface BulkProgress {
  completed: number;
  total: number;
  batchIndex: number;
  batchCount: number;
}

export interface BulkRunResult {
  results: Result[];
  summary: {
    total: number;
    computed: number;
    blocked: number;
    failed: number;
    cancelled: boolean;
    elapsedMs: number;
  };
}

/**
 * Run a bulk LSL calculation across many employees.
 *
 * Returns deterministic Result[] in the same order as the input. Every entry
 * has a status — `failed` results carry `error.userMessage` for the UI; never
 * throws upward.
 */
export async function runBulk(input: BulkRunInput): Promise<BulkRunResult> {
  const t0 = performance.now();
  const { employees, defaultTrigger, triggerOverrides = {}, onProgress, signal } = input;

  const results: Result[] = new Array(employees.length);
  const batchCount = Math.ceil(employees.length / BULK_CHUNK_SIZE);
  let completed = 0;
  let cancelled = false;

  for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
    if (signal?.aborted) {
      cancelled = true;
      break;
    }

    const start = batchIndex * BULK_CHUNK_SIZE;
    const end = Math.min(start + BULK_CHUNK_SIZE, employees.length);

    const batchPromises: Promise<{ index: number; result: Result }>[] = [];
    for (let i = start; i < end; i++) {
      batchPromises.push(runOne(employees[i], i, triggerOverrides, defaultTrigger));
    }
    const batchResults = await Promise.all(batchPromises);
    for (const { index, result } of batchResults) {
      results[index] = result;
      completed++;
      onProgress?.({ completed, total: employees.length, batchIndex, batchCount });
    }

    // Yield to the event loop between batches so the browser can paint.
    await microtaskYield();
  }

  let computed = 0;
  let blocked = 0;
  let failed = 0;
  for (const r of results) {
    if (!r) continue;
    if (r.status === 'computed') computed++;
    else if (r.status === 'blocked_cross_jurisdiction') blocked++;
    else failed++;
  }

  return {
    results,
    summary: {
      total: employees.length,
      computed,
      blocked,
      failed,
      cancelled,
      elapsedMs: performance.now() - t0,
    },
  };
}

async function runOne(
  emp: Employee,
  index: number,
  overrides: Record<string, Trigger>,
  defaultTrigger: Trigger
): Promise<{ index: number; result: Result }> {
  const trigger = overrides[emp.id] ?? defaultTrigger;
  try {
    const result = calculateNSWSafe(emp, trigger);
    return { index, result };
  } catch (err) {
    // calculateNSWSafe should never throw — but defensively wrap anyway.
    return {
      index,
      result: {
        employeeId: emp.id,
        status: 'failed',
        trigger,
        warnings: [],
        error: {
          code: 'unhandled_runtime_error',
          userMessage:
            err instanceof Error ? err.message : 'Calculation failed unexpectedly.',
        },
      },
    };
  }
}

function microtaskYield(): Promise<void> {
  return new Promise((resolve) => {
    // queueMicrotask gives the browser a paint opportunity without the 4ms
    // setTimeout floor that would slow down large bulks unnecessarily.
    if (typeof queueMicrotask === 'function') queueMicrotask(resolve);
    else Promise.resolve().then(resolve);
  });
}
