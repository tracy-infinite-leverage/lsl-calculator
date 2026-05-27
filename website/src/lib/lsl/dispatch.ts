/**
 * State dispatcher — single entry point for LSL calculations across all jurisdictions.
 *
 * Looks up the right per-state rule set by employee's governing jurisdiction (or
 * falls back to `statesOfService[0]` then `'NSW'`) and delegates to its orchestrator.
 *
 * Today only NSW is registered. Each subsequent state (VIC in Phase 3, etc.) appends
 * one entry to `STATE_REGISTRY` and one to `ENCODED_STATES`. The bulk runner and the
 * single-mode form both call into here — no other callers should import a per-state
 * orchestrator directly.
 *
 * See E2 impl-plan §P0.1 and tasks.md §T1.4.
 */

import type { Employee, Result, State, Trigger } from '@/lib/lsl/engine/types';
import type { StateRuleSet } from '@/lib/lsl/states/StateRuleSet';
import { NSW_RULE_SET } from '@/lib/lsl/states/nsw';
import { VIC_RULE_SET } from '@/lib/lsl/states/vic';
import { QLD_RULE_SET } from '@/lib/lsl/states/qld';
import { WA_RULE_SET } from '@/lib/lsl/states/wa';
import { SA_RULE_SET } from '@/lib/lsl/states/sa';
import { ACT_RULE_SET } from '@/lib/lsl/states/act';
import { TAS_RULE_SET } from '@/lib/lsl/states/tas';
import { NT_RULE_SET } from '@/lib/lsl/states/nt';

/**
 * Registry of state → rule set. Add one entry per state as it ships.
 *
 * Type-safe: keyed on the `State` union, but values are optional so unshipped
 * states are explicitly absent rather than placeholders.
 */
const STATE_REGISTRY: Partial<Record<State, StateRuleSet>> = {
  NSW: NSW_RULE_SET,
  VIC: VIC_RULE_SET,
  QLD: QLD_RULE_SET,
  WA: WA_RULE_SET,
  SA: SA_RULE_SET,
  ACT: ACT_RULE_SET,
  TAS: TAS_RULE_SET,
  NT: NT_RULE_SET,
};

/**
 * The set of states the calculator currently supports.
 *
 * Bulk-mode CSV validation, the state-selector UI, and the dispatcher all
 * read from this single source of truth. Always equals `Object.keys(STATE_REGISTRY)`.
 */
export const ENCODED_STATES: ReadonlyArray<State> = Object.keys(STATE_REGISTRY) as State[];

/** Check whether a state has a registered rule set today. */
export function isStateEncoded(state: State): boolean {
  return state in STATE_REGISTRY;
}

/**
 * The set of states whose UI is fully shipped (input wizard, warning-label maps,
 * result-panel affordances, etc.).
 *
 * Decoupled from `ENCODED_STATES` to support multi-task state shipping: a state's
 * engine can land in an earlier task while the surrounding UI lands in a later
 * task (e.g. NT engine in T9.1, NT UI in T9.5). The state-picker dropdowns read
 * from here so an engine-only state stays disabled and labelled "coming soon".
 *
 * Invariant: every entry must also be in `ENCODED_STATES`. When the trailing UI
 * task ships, collapse this back to `ENCODED_STATES` and remove the indirection.
 */
export const UI_SHIPPED_STATES: ReadonlyArray<State> = [
  'NSW',
  'VIC',
  'QLD',
  'WA',
  'SA',
  'ACT',
  'TAS',
  'NT',
];

/** Check whether a state's UI is fully shipped today. */
export function isStateUIShipped(state: State): boolean {
  return UI_SHIPPED_STATES.includes(state);
}

/**
 * Resolve the governing jurisdiction for an employee.
 *
 *   1. explicit `governingJurisdiction` (single-state nomination from the form)
 *   2. first entry in `statesOfService` if length === 1
 *   3. fall back to NSW (legacy v1 behaviour — keeps existing single-mode users working)
 *
 * Note: multi-state employees with no governing jurisdiction nominated still
 * resolve to a state here; the per-state `calculate` then blocks via
 * `checkJurisdiction`. This mirrors the existing NSW gate.
 */
function resolveGoverningState(employee: Employee): State {
  if (employee.governingJurisdiction) return employee.governingJurisdiction;
  if (employee.statesOfService && employee.statesOfService.length === 1) {
    return employee.statesOfService[0];
  }
  return 'NSW';
}

/**
 * Calculate LSL for any employee under any trigger.
 *
 * Throws if the state has no registered rule set. Bulk callers should use
 * `calculateSafe` for fault isolation.
 */
export function calculate(employee: Employee, trigger: Trigger): Result {
  const state = resolveGoverningState(employee);
  const ruleSet = STATE_REGISTRY[state];
  if (!ruleSet) {
    return {
      employeeId: employee.id,
      status: 'blocked_cross_jurisdiction',
      trigger,
      warnings: [
        {
          code: 'cross_jurisdiction_pending',
          message: unsupportedStateMessage(state),
        },
      ],
    };
  }
  return ruleSet.calculate(employee, trigger);
}

/**
 * Throw-safe dispatcher used by the bulk runner. Mirrors `calculateSafe` for
 * each per-state rule set: catches anything thrown and returns a `failed` Result.
 */
export function calculateSafe(employee: Employee, trigger: Trigger): Result {
  const state = resolveGoverningState(employee);
  const ruleSet = STATE_REGISTRY[state];
  if (!ruleSet) {
    return {
      employeeId: employee.id,
      status: 'blocked_cross_jurisdiction',
      trigger,
      warnings: [
        {
          code: 'cross_jurisdiction_pending',
          message: unsupportedStateMessage(state),
        },
      ],
    };
  }
  return ruleSet.calculateSafe(employee, trigger);
}

function unsupportedStateMessage(state: State): string {
  const list = ENCODED_STATES.join(', ');
  return `Calculator does not yet support ${state}. Currently supported: ${list}. This employee will be skipped.`;
}
