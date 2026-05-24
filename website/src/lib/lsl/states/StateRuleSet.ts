import type { Employee, Result, State, Trigger } from '@/lib/lsl/engine/types';

/**
 * Per-state orchestrator signature.
 *
 * Pure function — encodes user-input issues as `Result.status` rather than throwing.
 * Implementations live under `website/src/lib/lsl/states/{state}/index.ts` and export a
 * `calculate{STATE}` function matching this signature. See E2 impl-plan §P0.1.
 */
export type StateCalculate = (employee: Employee, trigger: Trigger) => Result;

/**
 * Throw-safe wrapper around `StateCalculate`.
 *
 * Catches every throw and turns it into a `Result` with `status: 'failed'` (or
 * `'blocked_cross_jurisdiction'` for jurisdiction blocks). The bulk runner relies on
 * this for per-row fault isolation — one employee's blow-up never aborts the batch.
 */
export type StateCalculateSafe = (employee: Employee, trigger: Trigger) => Result;

/**
 * Single contract every state in E2 must satisfy. Selected at runtime by
 * `dispatch.calculate` based on the employee's governing jurisdiction.
 */
export interface StateRuleSet {
  state: State;
  calculate: StateCalculate;
  calculateSafe: StateCalculateSafe;
}
