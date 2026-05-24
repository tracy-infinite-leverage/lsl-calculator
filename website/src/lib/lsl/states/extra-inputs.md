# Per-state extra-inputs pattern

Some Australian jurisdictions require employee data that NSW does not. Rather
than bloat the shared `Employee` type with state-specific fields, each state's
module declares its expected extension keys under
`Employee.extraInputs?: Record<string, unknown>`.

See E2 impl-plan §P0.6 / DEV-E2-M6.

## Rules

1. The shared engine **must not** read `extraInputs`. Only the per-state
   orchestrator (`states/{state}/index.ts`) and its rule files may read it.
2. Each state documents its keys in `states/{state}/extra-inputs.ts` as an
   exported TypeScript interface, plus a runtime parser that validates the
   shape and surfaces a `failed` Result on malformed input.
3. Form-level rendering of state-specific inputs is conditional on
   `(state, employment_type)` — fields are only visible when the engine will
   actually consume them. See the ACT overtime-hours pattern (Phase 7).
4. Switching state on the form preserves `extraInputs` in form state across
   the toggle so a user doesn't lose typed-in data within a session.

## Known states using this

| State | Keys | Reason | Phase |
|-------|------|--------|-------|
| VIC   | `hoursChangedInLast104Weeks?: boolean` | VIC LSL Act 2018 s.16 averaging path (vs s.15 default) depends on whether hours changed in the last 104 weeks. v1 cannot infer this from wage history alone — form layer sets the flag when the user confirms. Defaults to `false`. See TBD-VIC-11 resolution in `docs/qa/test-cases-vic.md`. | Phase 3 |
| ACT   | `overtimeHoursByPeriod: Array<{ periodStart, periodEnd, hours }>` | ACT LSL Act 1976 s.4 includes overtime in ordinary-pay for part-time/casual employees | Phase 7 |

Other states have not declared extra inputs yet.

## Example shape

```ts
// website/src/lib/lsl/states/act/extra-inputs.ts
import type { ISODate } from '@/lib/lsl/engine/types';

export interface ACTExtraInputs {
  /**
   * Overtime hours per pay period — used in ordinary-pay computation for
   * part-time / casual per ACT LSL Act 1976 s.4.
   */
  overtimeHoursByPeriod?: Array<{
    periodStart: ISODate;
    periodEnd: ISODate;
    hours: number;
  }>;
}

export function parseACTExtraInputs(raw: unknown): ACTExtraInputs {
  // …validate shape, throw InvalidInputError on bad data…
}
```
