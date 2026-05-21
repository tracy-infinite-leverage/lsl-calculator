# Implementation Plan: NSW Long Service Leave Calculator (E1)

**Version**: 0.1
**Status**: Draft — for Tracy (PM) review
**Date**: 2026-05-21
**Owner**: Developer agent
**Spec**: `.specify/features/001-nsw-calculator/spec.md` v0.4.1
**Dev findings consumed**: `.specify/features/001-nsw-calculator/dev-findings.md` (D01–D22, D-OQ7)
**Tasks**: `.specify/features/001-nsw-calculator/tasks.md`
**Branch**: `001-nsw-calculator`

> This plan is paired with `tasks.md`. Read `spec.md` first; this document assumes the spec's vocabulary (single mode / bulk mode, three pay-pattern categories, prescribed date, triggers, citation block).

---

## 1. Architecture overview

### 1.1 Folder structure under `website/src/`

```
website/
├── src/
│   ├── app/                                  ← Next.js 16 App Router
│   │   ├── (calculator)/
│   │   │   ├── calculator/
│   │   │   │   ├── single/
│   │   │   │   │   ├── page.tsx              ← Single-mode entry (Server Component shell)
│   │   │   │   │   └── _components/          ← Single-mode UI (mostly client)
│   │   │   │   └── bulk/
│   │   │   │       ├── page.tsx              ← Bulk-mode entry
│   │   │   │       └── _components/
│   │   │   └── layout.tsx                    ← Shared shell, no auth wrapper in v1
│   │   ├── api/
│   │   │   ├── extract-pdf/
│   │   │   │   └── route.ts                  ← Anthropic SDK proxy (Node runtime)
│   │   │   └── export-pdf/
│   │   │       └── route.ts                  ← pdfkit streaming PDF export (bulk + single)
│   │   ├── layout.tsx
│   │   └── page.tsx                          ← Landing page; routes to single/bulk
│   │
│   ├── lib/
│   │   └── lsl/
│   │       ├── engine/                       ← STATE-AGNOSTIC engine core
│   │       │   ├── index.ts                  ← Public entry: calculate(employee, ruleset)
│   │       │   ├── types.ts                  ← Employee, WageHistory, Trigger, Result, Citation
│   │       │   ├── citation.ts               ← Citation accumulator
│   │       │   ├── decimal.ts                ← decimal.js wrapper + AUD rounding
│   │       │   ├── normalise.ts              ← Pay-cycle normaliser (F3a)
│   │       │   ├── lookback.ts               ← 12-month / 5-year window math + days-not-counted
│   │       │   ├── classifier.ts             ← Pay-pattern decision tree (D06)
│   │       │   ├── continuous-service.ts     ← Event-folding to "days counted" (F9)
│   │       │   ├── accrual.ts                ← Years × (8.6667/10) etc. (F11)
│   │       │   ├── trigger.ts                ← Prescribed-date resolver (D07)
│   │       │   └── errors.ts                 ← Typed engine errors
│   │       │
│   │       ├── states/
│   │       │   └── nsw/
│   │       │       ├── index.ts              ← NSW RuleSet export
│   │       │       ├── rules/
│   │       │       │   ├── value-of-week-a.ts  ← s.4(5) Category A
│   │       │       │   ├── value-of-week-b.ts  ← s.4(5) Category B
│   │       │       │   ├── value-of-week-c.ts  ← s.4(5) Category C
│   │       │       │   ├── continuous-service.ts ← s.4(11), s.4(6)
│   │       │       │   ├── accrual-table.ts     ← s.4(2), s.4(2)(iii)
│   │       │       │   └── trigger-handlers.ts  ← taking_leave | termination | as_at
│   │       │       ├── citations.ts          ← Section + PDF page lookup map
│   │       │       └── __tests__/
│   │       │           ├── gold-standard.test.ts
│   │       │           └── fixtures/
│   │       │               ├── single/
│   │       │               │   ├── 12yr-casual-to-ft.json    ← PDF p.141 ($9,880.04)
│   │       │               │   ├── full-time-12yr.json
│   │       │               │   ├── 7yr-redundancy.json
│   │       │               │   └── (more — see test-cases.md)
│   │       │               └── bulk/
│   │       │                   ├── 10-employee-mixed.csv
│   │       │                   └── 50-employee-payroll-export.csv
│   │       │
│   │       └── parsers/
│   │           ├── csv/
│   │           │   ├── single.ts             ← Single-mode wage-history CSV
│   │           │   ├── bulk.ts               ← Bulk CSV schema (D17)
│   │           │   └── schema.ts             ← Zod schemas
│   │           ├── pdf/
│   │           │   ├── extract.ts            ← Anthropic SDK orchestration
│   │           │   ├── prompts.ts            ← Prompt templates (single / bulk)
│   │           │   ├── schema.ts             ← LLM JSON output Zod schema (D19)
│   │           │   └── confidence.ts         ← Threshold gate (D05)
│   │           └── exports/
│   │               ├── csv.ts                ← Bulk results → CSV
│   │               └── pdf.ts                ← Multi-page PDF via pdfkit (D21)
│   │
│   ├── components/
│   │   ├── ui/                               ← shadcn primitives
│   │   ├── lsl/
│   │   │   ├── CitationBlock.tsx
│   │   │   ├── ResultPanel.tsx               ← Single-mode result panel
│   │   │   ├── BulkResultsTable.tsx          ← TanStack-Table-backed (filter/sort)
│   │   │   ├── EditablePreviewTable.tsx     ← Post-extraction preview (F5)
│   │   │   ├── ContinuousServiceList.tsx    ← Repeating row UI (D02)
│   │   │   ├── ClassifierConfirmModal.tsx
│   │   │   ├── JurisdictionBlockBanner.tsx
│   │   │   ├── SystemFormulaToggle.tsx       ← F21 / AC12
│   │   │   └── WageHistoryUpload.tsx
│   │   └── shell/                            ← Header / nav / footer
│   │
│   └── server/
│       ├── anthropic.ts                      ← SDK singleton + key resolver
│       ├── telemetry.ts                      ← D14 thin wrapper (vendor TBD)
│       └── errors.ts                         ← Error scrubber (no PII to logs, D15)
│
├── public/
└── (package.json, etc. — modified in Phase 1 Task 1.0)
```

**Why this shape**:
- **State-agnostic engine vs. state-specific rule set** is the key split called out in the spec ("Design / Approach §High-level strategy"). E2 adds sibling state directories under `states/`; the engine never changes shape per state.
- **`lib/lsl/parsers/` separate from `lib/lsl/engine/`**: parsers convert noisy real-world inputs (CSV / PDF) into the engine's typed `Employee` shape. The engine is pure; parsers can throw.
- **`api/extract-pdf` and `api/export-pdf` as Node-runtime API routes**, not Server Actions: PDF binary handling and Anthropic SDK streaming are awkward in the Server Action model. Edge runtime cannot host `pdfkit` or the Anthropic SDK reliably.
- **`(calculator)` route group**: lets us share the calculator shell layout without exposing it in the URL.

### 1.2 Split between state-agnostic engine and NSW rule set

The engine exposes a single entry point:

```ts
// engine/index.ts (conceptual signature — do NOT take this as final code)
export interface RuleSet {
  jurisdiction: 'NSW' | 'VIC' | /* … */;
  classify: (employee, lookbackDays) => Category;
  valueOfWeek: (employee, category, prescribedDate, ctx) => DecimalWithCitations;
  continuousService: (employee, asOf) => DaysCounted;
  accrual: (yearsOfService, trigger, terminationReason) => WeeksWithCitations;
  triggerHandler: (employee, trigger, valueOfWeek, accrualWeeks) => Result;
}

export function calculate(employee: Employee, trigger: Trigger, ruleset: RuleSet): Result;
```

The engine owns: orchestration, decimal arithmetic, lookback-window math, citation accumulation, error boundaries. The rule set owns: which formulas apply for which category, which events count as service, the accrual table, the prescribed-date semantics for each trigger, and the citation strings.

### 1.3 Citation accumulator model

`Citation` is the smallest reusable unit of provenance:

```ts
interface Citation {
  section: string;      // 'NSW LSA s.4(5)(b)'
  rule: string;         // 'value-of-week.categoryA.fiveYearAverage'
  pdfPage?: number;     // 23
  note?: string;        // Optional one-line context (e.g. "as-at snapshot — pro-rata thresholds not applied" — D20)
}
```

Every rule function returns `{ value: Decimal, citations: Citation[] }`. The engine collects citations per computed value and attaches them to the final `Result.outputs`. Three numeric outputs (F12: value of week / value of day / total entitlement) each carry their own citation array.

Rendering (D10): citations render as a stacked list under the value. Section first; rule + PDF page second; note third. Source order = visual order for screen-reader compatibility (AC11, A3).

### 1.4 How single and bulk routes share the engine

Single and bulk are independent routes (D22) but call the same `calculate()`. The difference is in the assembly layer:

- **Single mode**: form state → one `Employee` object → one `calculate()` call → one `Result` rendered in `ResultPanel`.
- **Bulk mode**: CSV/PDF parse → array of `Employee` → `calculate()` per row inside `Promise.all` (chunked, see §3) → array of `Result` rendered in `BulkResultsTable`.

Bulk mode wraps each per-employee call in a row-level try/catch so that one engine throw (D15) yields `{ status: 'failed', error }` for that row rather than failing the whole batch.

### 1.5 PDF extraction integration

PDF extraction lives in the Node-runtime API route `/api/extract-pdf`:

1. Client POSTs `multipart/form-data` containing the PDF + a `mode` field (`single` / `bulk`).
2. Route validates file (size ≤ 50 MB; pages ≤ 50, pre-counted client-side via `pdf.js` per D03).
3. Route calls Anthropic SDK with the appropriate prompt template (single vs. multi-employee — §4).
4. Response is validated against a Zod schema (§4.5). Shape failure triggers one corrective-prompt retry (D19); second failure surfaces an "extraction failed, switch to CSV" message (AC26).
5. Successful response is returned to the client with confidence metadata.
6. Client renders `EditablePreviewTable` — user confirms or corrects before the engine runs.

Key constraint per S4/S5: nothing beyond the PDF bytes leaves the server. Telemetry (§7) logs only event counts and timings, never extracted values.

---

## 2. Data model

### 2.1 Engine types (TypeScript)

```ts
type EmploymentType = 'full_time' | 'part_time' | 'casual';

type State = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';

type Trigger =
  | { kind: 'taking_leave'; leaveStartDate: ISODate }
  | { kind: 'termination'; terminationDate: ISODate; reason: TerminationReason }
  | { kind: 'as_at'; asAtDate: ISODate };

type TerminationReason =
  | 'voluntary_resignation'
  | 'employer_initiated_not_misconduct'
  | 'redundancy'
  | 'serious_misconduct'
  | 'illness_incapacity'
  | 'domestic_pressing_necessity'
  | 'death';

type PayFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'other';

interface WagePeriod {
  periodStart: ISODate;
  periodEnd: ISODate;
  grossPay: Decimal;        // unrounded
  frequency: PayFrequency;
  periodDays?: number;      // required when frequency === 'other'
  note?: string;
}

interface ContinuousServiceEvent {
  type:
    | 'paid_leave'
    | 'workers_comp_absence'
    | 'unpaid_parental_leave'
    | 'leave_without_pay'
    | 'industrial_action'
    | 'employer_stand_down'
    | 'transfer_of_business'
    | 'employer_initiated_termination_and_rehire'
    | 'apprentice_to_tradesperson_transition'
    | 'jobkeeper_or_covid_standdown';
  startDate: ISODate;
  endDate?: ISODate;          // optional for transfer + apprentice-transition
  note?: string;
}

interface Employee {
  // Identity (display-only)
  id: string;                 // internal row id; not necessarily PII
  legalName?: string;
  externalEmployeeId?: string;

  // Employment
  startDate: ISODate;
  endDate?: ISODate;          // required if trigger.kind === 'termination'
  employmentType: EmploymentType;

  // Jurisdiction (multi-select; v1 only NSW runs to completion)
  statesOfService: State[];
  governingJurisdiction?: State;

  // Pay
  currentWeeklyGross: Decimal;
  wageHistory: WagePeriod[];

  // Service events
  serviceEvents: ContinuousServiceEvent[];

  // Classifier override (D08)
  categoryOverride?: 'A' | 'B' | 'C';
  categoryOverrideConfirmed?: boolean;
}

interface Result {
  employeeId: string;
  status: 'computed' | 'blocked_cross_jurisdiction' | 'failed';
  outputs?: {
    valueOfWeek:        { value: Decimal; display: string; citations: Citation[] };
    valueOfDay:         { value: Decimal; display: string; citations: Citation[] };
    totalEntitlement:   {
      weeks: { value: Decimal; display: string; citations: Citation[] };
      dollars: { value: Decimal; display: string; citations: Citation[] };
    };
    systemFormula?: { value: Decimal; display: string; variance: Decimal };  // F21
  };
  category?: 'A' | 'B' | 'C';
  trigger: Trigger;
  warnings: Warning[];        // mixed-frequency, classifier-ambiguous, etc.
  error?: { code: string; userMessage: string };
}

interface Warning {
  code: 'mixed_frequency' | 'classifier_ambiguous' | 'cross_jurisdiction_pending' | 'extraction_low_confidence';
  message: string;
  rowRef?: string;
}
```

`ISODate` is a brand on `string` (YYYY-MM-DD). `Decimal` is `decimal.js` instance.

### 2.2 CSV schemas

**Single-mode CSV (wage history only — F3)**

| Column | Type | Required | Notes |
|---|---|---|---|
| period_start | ISODate | yes | YYYY-MM-DD |
| period_end | ISODate | yes | |
| gross_pay | decimal | yes | AUD, no thousands separator |
| note | string | no | |

Frequency is selected by the user in the UI (or inferred — F3); not per-row.

**Bulk-mode CSV (D17 — schema is a launch-gate artifact)**

One row per pay period or per service event. The `row_type` column disambiguates:

| Column | Type | Req? | Applies to row_type | Notes |
|---|---|---|---|---|
| employee_id | string | yes | both | Primary key for grouping rows |
| employee_name | string | no | both | Display-only |
| row_type | enum(`pay_period`, `service_event`) | yes | both | |
| start_date | ISODate | yes (employee) | once per employee_id, on first row | Employment start |
| end_date | ISODate | yes if termination | once per employee_id | |
| employment_type | enum | yes | once per employee_id | full_time \| part_time \| casual |
| states_of_service | string | yes | once per employee_id | Semicolon-delimited e.g. `NSW;VIC` |
| trigger | enum | no | once per employee_id | Defaults to `as_at` (PM-B) |
| trigger_date | ISODate | no | once per employee_id | Defaults to upload date for as_at |
| termination_reason | enum | conditional | once per employee_id | Required when trigger=termination |
| period_start | ISODate | yes | pay_period | |
| period_end | ISODate | yes | pay_period | |
| gross_pay | decimal | yes | pay_period | |
| period_frequency | enum | yes | pay_period | weekly \| fortnightly \| monthly \| other |
| period_days | int | conditional | pay_period | Required when period_frequency=other |
| service_event_type | enum | yes | service_event | See F4 |
| service_event_start | ISODate | yes | service_event | |
| service_event_end | ISODate | conditional | service_event | Optional for transfer + apprentice-transition |
| service_event_note | string | no | service_event | |

Bulk-mode parser groups rows by `employee_id`, validates per-employee minima, and emits an `Employee[]`. Validation errors do not throw — they're surfaced as warnings in the editable preview (F6).

### 2.3 LLM extraction JSON schema (D19)

The Anthropic prompt instructs the model to emit JSON of shape:

```json
{
  "employees": [
    {
      "external_employee_id": "string|null",
      "legal_name": "string|null",
      "start_date": "YYYY-MM-DD|null",
      "end_date": "YYYY-MM-DD|null",
      "employment_type": "full_time|part_time|casual|null",
      "states_of_service": ["NSW"],
      "wage_history": [
        {
          "period_start": "YYYY-MM-DD",
          "period_end": "YYYY-MM-DD",
          "gross_pay": "string",
          "frequency": "weekly|fortnightly|monthly|other|null",
          "period_days": "int|null"
        }
      ],
      "service_events": [
        { "type": "...", "start_date": "...", "end_date": "..." }
      ],
      "confidence": {
        "identity": 0.0,
        "employment": 0.0,
        "wage_history": 0.0,
        "aggregate": 0.0
      }
    }
  ],
  "extraction_notes": "string|null"
}
```

This is validated server-side with Zod before being returned to the client. Shape failure → corrective retry (D19); second failure → fall back to CSV (AC26). `gross_pay` is a string to avoid float precision loss in JSON; the client parses to `Decimal`.

---

## 3. Rules engine implementation strategy

### 3.1 Pure TypeScript

All rule functions are pure: `(input) => { value, citations }`. No side effects, no clock reads (the prescribed date is passed in), no global state. This makes the gold-standard suite trivially deterministic and CI-cacheable.

### 3.2 Decimal arithmetic (D01)

Use **`decimal.js`** for all monetary computation. Rationale:

- Mature, small (≈25 kB minified), well-tested.
- Configurable rounding modes — we use `ROUND_HALF_UP` at 2 dp at display only.
- Intermediate arithmetic uses full precision (default 20-significant-digit).

Wrap in `lib/lsl/engine/decimal.ts` so we can swap libraries in one place. Property-based test (`fast-check`): for any sequence of additions / multiplications, `display(engineValue)` and `display(decimalJsReferenceValue)` must agree to the last cent. Specifically test AC25: the 12-year casual-to-FT example returns `$9,880.04` not `$9,880.03` or `$9,880.05`.

**Rounding rule**: AUD half-up at 0.005. The display layer is the *only* place rounding occurs. The engine's internal `value` on a citation is the unrounded `Decimal`; the `display` string is computed at the boundary.

### 3.3 Pay-pattern classifier decision tree (D06)

```
employment_type === 'full_time' and stddev(hours_per_period) / mean(hours_per_period) <= 0.10
  → Category A

employment_type === 'part_time' and stddev(hours_per_period) / mean(hours_per_period) <= 0.10
  → Category A

employment_type ∈ {part_time, casual} and stddev(hours_per_period) / mean(hours_per_period) > 0.10
  → Category B (mark "ambiguous=true" if 0.05 < coefficient_of_variation <= 0.10 — borderline)

evidence of variable rate (varied gross_per_hour across periods exceeding 5%)
  → Category C
```

The classifier returns `{ category, ambiguous: boolean, signals: string[] }`. When `ambiguous`, single-mode shows `ClassifierConfirmModal` and bulk-mode marks the row for confirmation in the preview table. The override sticks to the row (D08) until explicit reset.

**Important caveat**: spec F8 says when the user has not provided hours separately, Category B falls through to Category C math (greater of 12-mo / 5-yr averages on gross weekly). The classifier still tags the row as B; the rule selector applies the fall-through.

### 3.4 Lookback math

`lookback.ts` exposes:

```ts
function weeklyAverageOverWindow(
  wageHistory: WagePeriod[],
  windowEnd: ISODate,
  windowDays: 365 | 1826,            // 12 months / 5 years (handles leap years per spec)
  daysNotCounted: number,
): Decimal;
```

- `windowDays` is configurable for leap-year-correctness: actual window days = end - start in days, but `daysNotCounted` removes unpaid leave / JobKeeper days / industrial action / etc. per F3a and research brief §1.2 ("days not counted").
- Sum of gross over the window in `Decimal`; divide by `(windowDays - daysNotCounted)`; multiply by 7.
- Per-period gross is itself the *period* total (not weekly-normalised) — the formula is `sum(gross_in_window) / (days_in_window − days_not_counted) × 7`.

`continuous-service.ts` produces `daysNotCounted` and `daysCounted` from the `serviceEvents` list, per s.4(11) classification.

### 3.5 Citation provenance threading

Each rule function emits citations at the point of decision:

```ts
// Inside value-of-week-a.ts
function valueOfWeekCategoryA(emp, prescribedDate): { value: Decimal, citations: Citation[] } {
  const current = emp.currentWeeklyGross;
  const fiveYearAvg = weeklyAverageOverWindow(emp.wageHistory, prescribedDate, 1826, daysNotCounted);
  const [winner, source] = current.gte(fiveYearAvg) ? [current, 'current'] : [fiveYearAvg, '5yr_avg'];
  return {
    value: winner,
    citations: [
      { section: 'NSW LSA s.4(5)(b)', rule: `value-of-week.A.${source}`, pdfPage: 22 },
      { section: 'NSW LSA s.3(2)', rule: 'ordinary-pay-definition', pdfPage: 18 },
    ],
  };
}
```

The engine concatenates per-rule citations onto the appropriate `Result.outputs.*.citations` array. Dedup happens at the render layer (`CitationBlock` collapses exact duplicates).

### 3.6 Engine errors and bulk-mode isolation (D15)

The engine throws `EngineError` subtypes:
- `InvalidInputError` — e.g. termination trigger without endDate
- `InsufficientHistoryError` — e.g. <12 months of wage history when the formula requires it (warning, not always fatal)
- `JurisdictionBlockedError` — non-NSW governing jurisdiction
- `UnclassifiableError` — classifier cannot resolve and user hasn't confirmed

Single-mode: caught at the form-submit boundary; mapped to a user-facing message.
Bulk-mode: caught per row; emits `Result { status: 'failed', error }`. Batch continues. The results table surfaces failed rows with the error message and an "edit and retry" affordance.

Top-level uncaught throws (defensive) are caught by the Next.js `error.tsx` boundary and an `errors.ts` server-side scrubber that strips employee-identifying fields before logging.

---

## 4. PDF extraction pipeline

### 4.1 Anthropic SDK integration

Use `@anthropic-ai/sdk` directly. The SDK call lives in `src/server/anthropic.ts` (singleton client) and `src/lib/lsl/parsers/pdf/extract.ts` (orchestration).

Server-side only. The API key is `ANTHROPIC_API_KEY` (loaded from env via Vercel project settings). The no-retention enterprise endpoint is the org-level default per OQ-B sign-off; no per-request flag is needed beyond the standard SDK auth.

**Model selection**: Claude Sonnet 4.7 (cost / latency / accuracy sweet spot for vision-and-text PDF parsing). We do not need Opus for this task. Re-evaluate if D05's calibration shows aggregate confidence below 0.85 on the 50-PDF calibration set.

### 4.2 Prompt strategy with prompt caching

Per the project's `claude-api` skill: **cache the system prompt and the schema definition** across requests, since they're identical for every extraction. Mark them with `cache_control: { type: 'ephemeral' }`.

Structure of every extraction request:

```
[system]  (cached) — role definition, exhaustive schema spec, "do not fabricate values", "report low confidence rather than guess"
[user]    (cached) — mode-specific instructions (single vs. bulk)
[user]    (NOT cached) — the PDF document + per-call hint (e.g., "this is a payroll export from Vendor X, expect weekly periods")
```

The PDF goes in a `document` content block. We do not pre-process the PDF text client-side — Claude's vision handles tabular layouts that text extraction botches.

### 4.3 Single-employee vs. multi-employee prompts

**Single-mode prompt** instructs Claude to return exactly one element in the `employees` array. If the PDF visibly contains more than one employee, it must surface that in `extraction_notes` and prompt the user to clarify.

**Bulk-mode prompt** instructs Claude to return one element per distinct employee, grouping wage periods under each. Employee disambiguation hints in the prompt: legal name, employee ID, employment start date.

Both prompts include the literal JSON schema and a worked example of input → expected output.

### 4.4 Confidence-threshold mechanics (D05)

The model returns `confidence` per group of fields (identity / employment / wage_history) plus an aggregate. Default threshold: **aggregate ≥ 0.85**.

- aggregate ≥ 0.85 → render `EditablePreviewTable`, all values editable.
- aggregate < 0.85 → refuse to display, surface "we couldn't extract this confidently — please switch to CSV", offer CSV input with form state preserved.
- Per-field confidence below 0.7 → highlight that field in yellow with a "low confidence — please verify" badge.

The threshold value is configurable from a server-side constants file; D05 calls for calibration on a labelled 50-PDF set before launch. The launch threshold is PM-signable.

### 4.5 Fallback to CSV (D04)

Per-attempt timeouts:
- Single mode: 30 s per attempt, 70 s total budget (D04).
- Bulk mode: 5 min per attempt (P3), 11 min total budget.

On timeout or network error: one automatic retry; on second failure, surface error within 10 s (AC26) and route user to CSV path with form state preserved.

On schema-validation failure: one corrective retry with the validation error appended to the prompt (D19); on second failure, fall back to CSV.

### 4.6 Error and timeout handling

- Network error → catchable, retry.
- HTTP 429 (rate limit) → exponential backoff inside one retry, then surface failure.
- HTTP 5xx → retry once, then surface failure.
- HTTP 4xx (other than 429) → no retry; surface "extraction service rejected the file" with the request id for support.
- Schema-validation failure → corrective retry per D19.
- Timeout (per D04) → surface mode-specific timeout message and route to CSV.

All failures route through the same `EditablePreviewTable` boundary so the user never sees a bare exception.

---

## 5. UI structure

### 5.1 Pages and routes

- `/` — landing, two CTAs: "Calculate for one employee" / "Calculate for many"
- `/calculator/single` — single-mode form + result panel
- `/calculator/bulk` — bulk-mode upload + preview + results table

No auth. No global state library — React state + `localStorage` is sufficient (D13). Bulk results that exceed `localStorage` quota fall back to in-memory only.

### 5.2 Component inventory

Built on **shadcn/ui** primitives (Button, Input, Select, Dialog, Toast, Form, Table, Tabs, Accordion, Badge, Tooltip). Custom components in `src/components/lsl/`:

- `WageHistoryUpload` — switches between CSV / PDF tabs, handles file picker (D03), surfaces extraction progress.
- `EditablePreviewTable` — post-extraction confirmation table. Single-mode: one section per employee. Bulk-mode: grouped by employee with inline-edit on every cell; cell warnings (mixed-frequency, low-confidence) inline.
- `ContinuousServiceList` — repeating-row UI for F4 (D02); rows grouped by `event_type`; `end_date` optional for `transfer_of_business` and `apprentice_to_tradesperson_transition`.
- `ClassifierConfirmModal` — single-mode modal when D06 marks ambiguous; "this looks like Category B — confirm or override".
- `ResultPanel` — single-mode result: three numeric outputs, each with its `CitationBlock`, `SystemFormulaToggle` (F21), and an export button.
- `BulkResultsTable` — TanStack Table on top of shadcn `Table`. Sticky header. Columns: employee, category, value-of-week, value-of-day, total weeks, total dollars, variance, status badge. Expand chevron per row reveals the citation block in place (D18). Filter / sort per AC20.
- `CitationBlock` — stacked list per D10; section first, rule + page second; screen-reader order = visual order (A3).
- `JurisdictionBlockBanner` — per-row "needs jurisdiction nominated" affordance with modal (D18); resolving re-runs that single row only (D18).
- `SystemFormulaToggle` — checkbox in result panel; when on, renders the comparison value + variance dollar amount + plain-English "your payroll system would have given $X — that's Y over/under" copy (AC12).
- `MixedFrequencyBadge`, `LowConfidenceBadge` — inline warnings.

### 5.3 shadcn primitives to use

Form, Input, Label, Select, RadioGroup, Checkbox, DatePicker (calendar + popover), Dialog, AlertDialog (jurisdiction block + classifier confirm), Toast, Table, Tabs, Accordion (citation expand), Badge, Tooltip, Progress (extraction progress bar), Skeleton (loading), Button.

Initialize shadcn with the "new york" style (per the developer persona default) and the project's brand palette from `context/brand/palette.md`.

### 5.4 Single vs. bulk results table (D18)

Single-mode `ResultPanel` is a vertical card layout — the three numeric outputs stacked, each with citations underneath, comparison toggle below. PDF export is one button.

Bulk-mode `BulkResultsTable` is a virtualised table (TanStack Virtual under the hood — bulk uploads of 500 rows need virtualisation for perf, P2). Each row has an expand chevron that reveals the per-row citation block in place. Failed rows render with the error in red and an "edit and retry" link that re-opens that row's preview. Cross-jurisdiction-blocked rows render with the inline "nominate jurisdiction" affordance and do not show numbers until resolved.

### 5.5 Browser local state (D13, F20, S1)

`localStorage` keyed by an anonymous session UUID (generated on first load, persisted). Surface a "clear this calculation" button on each route. Auto-clear after 7 days of inactivity (a timestamp check at load).

Bulk results may exceed the 5–10 MB `localStorage` cap. If a serialised result blob is > 4 MB, persist only the input metadata and re-run on revisit (warn user).

---

## 6. Testing strategy

### 6.1 Gold-standard suite (SC2 / D16)

Lives at `website/src/lib/lsl/states/nsw/__tests__/gold-standard.test.ts`. Reads fixtures from `__tests__/fixtures/single/*.json` and `__tests__/fixtures/bulk/*.csv`.

Each fixture file is structured:

```json
{
  "name": "12yr-casual-to-ft-pdf-p141",
  "source": "APA LSL Masterclass PDF p.141",
  "input": { /* Employee object */ },
  "trigger": { "kind": "termination", "terminationDate": "...", "reason": "..." },
  "expected": {
    "category": "B",
    "valueOfWeek": "1140.93",        // exact string
    "valueOfDay": "228.19",
    "totalEntitlement": {
      "weeks": "8.6667",
      "dollars": "9880.04"            // ± $0.00 per AC25 / SC3
    },
    "citations": [
      { "section": "NSW LSA s.4(5)", "rule": "value-of-week.B.fall-through" },
      /* … */
    ]
  }
}
```

Test runner asserts exact equality on rounded display values, exact-string equality on citation section + rule, and array-membership on the citation list. A single mismatch fails CI.

The fixture set is enumerated in `test-cases.md` (Phase 0 deliverable; PM signs off before Phase 1 starts). Coverage from spec SC2:
- Every NSW worked example from the LSL-training PDF (pp.13–31)
- PDF pp.139–141 system-vs-manual bulk APA examples
- 8 edge cases from research brief §5 items 1–8 and 10–11
- ≥ 2 bulk-mode multi-employee fixtures of ≥ 10 employees each

### 6.2 CI gate (D16, AC24)

The gold-standard suite runs in the PR check pipeline; a failing test fails the build and blocks merge to `main`. Vercel auto-deploys from `main`, so a red gold-standard suite blocks deploy.

Implementation: `vitest` with `--reporter=verbose` so failures show the diff inline. Run on every PR push.

### 6.3 Bulk-mode fixtures (D17)

Two CSV fixtures:
- `10-employee-mixed.csv` — 10 employees, mixed pay-pattern categories (3 × A, 4 × B, 3 × C), one with cross-jurisdiction service (must be blocked), one with unpaid parental leave mid-tenure.
- `50-employee-payroll-export.csv` — 50 employees, all NSW, weekly periods, designed to test P2 (60 s for 500 employees, this is a 10× sample).

Each row's expected output is enumerated in `test-cases.md`.

### 6.4 Property tests for rounding (D01)

Using `fast-check`:
- For any sequence of `Decimal` operations, the rounded display value differs from the unrounded engine value by < 0.005.
- For any pair of equivalent inputs at different frequencies (weekly / fortnightly / monthly), AC4 holds: same weekly value within 1 cent.

### 6.5 Error-isolation tests (D15)

- Bulk fixture with one deliberately invalid row (negative gross_pay, end_date before start_date, etc.) → engine emits one `failed` result; other 9 rows compute normally.
- Bulk fixture with one cross-jurisdiction row → emits one `blocked_cross_jurisdiction` result; other rows compute (AC19).

### 6.6 Component / integration tests

- Vitest + React Testing Library for UI components.
- Playwright for end-to-end flows: single-mode happy path (CSV upload → result), bulk-mode happy path (CSV upload → preview → results table → CSV export), PDF extraction unavailability fallback (mocked Anthropic 503 → CSV path with form state preserved).

### 6.7 Accessibility (A1–A4, SC5)

- `axe-core` via `@axe-core/playwright` in Playwright suite — runs on single-mode result, bulk-mode results table.
- Manual keyboard-only walkthrough as a Phase 5 task; documented in `docs/qa/`.

### 6.8 Browser matrix (F17)

Playwright runs against Chromium, WebKit, Firefox. Edge shares Chromium; manual smoke on Edge during pre-launch (Phase 6).

---

## 7. Telemetry plan (D14)

**What we log**:
- Page view counts per route (single / bulk / landing)
- Calculation event: `{ mode, trigger.kind, category, status, durationMs, jurisdiction }` — no employee identifiers, no monetary values, no dates
- Extraction event: `{ mode, pdfPageCount, durationMs, status, aggregateConfidence }` — no extracted content
- Error event: `{ errorCode, route, mode }` — scrubbed of any context that could include PII
- Export event: `{ mode, format, employeeCount }` for bulk; `{ mode, format }` for single

**What we never log**: legal names, employee IDs (internal or external), gross pay values, date-of-birth-equivalent dates, PDF contents, CSV cell values, Anthropic request/response bodies. The error scrubber (`server/errors.ts`) is the single chokepoint that enforces this on any captured exception.

**Vendor**: **Plausible Analytics (self-hosted or Plausible Cloud EU)** for page-view + event counts. Rationale: GDPR-by-design, no cookies, simple event API, no PII surface. For application errors, **Sentry** with PII scrubbing aggressively configured (`beforeSend` strips all `extra` and `contexts.request.data`). Both choices are reversible — wrapper in `server/telemetry.ts` lets us swap vendors in one place.

S3 forbids third-party analytics that track employee inputs; Plausible doesn't see inputs at all (event metadata only). Sentry only sees error context that has been routed through the scrubber.

---

## 8. Privacy / data-handling policy (Draft — for PM sign-off before production traffic)

Per OQ-B sign-off (2026-05-21), the PDF extraction vendor is the Anthropic Claude API on the no-retention enterprise tier. PM also flagged that no Australian inference region exists today; requests transit US infrastructure under the no-retention contract.

This section is a **DRAFT data-handling policy** — Tracy (PM) reviews and signs off before production traffic. It will eventually live in `docs/engineering/` as a standalone policy doc; reproduced here so the impl-plan is complete.

### 8.1 What employee data goes to Anthropic

Only data the user has explicitly uploaded for extraction:
- The PDF document bytes (single payroll report or multi-employee payroll export)
- A short extraction prompt naming the expected schema (no employee-specific content)

The application does NOT send:
- The user's identity, IP, browser fingerprint (the SDK call is server-side)
- Any data from prior calculations
- Form fields the user typed directly (those never reach the LLM)
- Any session token

### 8.2 What Anthropic's no-retention contract covers

Per Anthropic's enterprise no-retention terms (as understood at 2026-05-21; **dev to re-verify with Anthropic account team before production traffic**):
- Request and response data are not retained after the response is returned (i.e., not used for training, not stored beyond the request lifecycle, not available for support replay).
- Standard infrastructure logs (request id, timestamp, latency) are retained per Anthropic's standard retention policy.
- Inference occurs on US infrastructure; data crosses the Pacific in transit (HTTPS, TLS 1.2+).

### 8.3 What telemetry we keep (and where it lives)

- Plausible Analytics: page-view counts and aggregated event counts; no PII; hosted region per Plausible vendor choice (EU if Cloud).
- Sentry: scrubbed error events; PII fields explicitly stripped before send; data retention per Sentry plan (90 days standard).
- Application logs (Vercel): request paths and status codes; no body content; standard Vercel retention.

### 8.4 What persists in the browser

- The user's current and recent calculations in `localStorage`, keyed by anonymous session UUID, auto-cleared after 7 days (D13).
- No server-side persistence in v1 (S1).

### 8.5 Mapping to Australian Privacy Principles (APPs)

- **APP 1 (Open and transparent management)**: a short user-facing privacy notice is rendered on `/calculator/single` and `/calculator/bulk` describing what happens to uploaded data. Linked from the upload control. PM-signable copy.
- **APP 6 (Use or disclosure)**: extracted data is used only to populate the calculator's preview; not used for any other purpose; not disclosed to any party other than Anthropic for the extraction round-trip.
- **APP 8 (Cross-border disclosure)**: Anthropic is the cross-border recipient (US). The user-facing notice discloses this. The no-retention contract is the basis for treating Anthropic's retention surface as bounded.
- **APP 11 (Security)**: HTTPS-only transport (S2); no third-party analytics that capture inputs (S3); browser-only persistence (S1); minimal LLM payload (S5).
- **APP 12 (Access) and APP 13 (Correction)**: not directly applicable in v1 since we hold no employee records server-side. Users can clear their own browser state via the "clear this calculation" control.

### 8.6 Pre-production checklist (Phase 6)

- [ ] Re-verify Anthropic no-retention contract terms with account team
- [ ] PM signs off on user-facing privacy notice copy
- [ ] PM signs off on this policy doc
- [ ] Privacy notice linked from both calculator pages and the landing page
- [ ] Sentry PII scrubbing configuration audited
- [ ] Plausible vendor / region selected and documented

---

## 9. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | PDF extraction accuracy below the 0.85 confidence threshold on real-world payroll PDFs, blocking too many uploads | Medium | High (blocks the bulk-mode wedge for many users) | D05 calibration set of 50 labelled PDFs from APA members before launch; tune threshold; cache prompts for cost; offer CSV fallback that preserves form state |
| R2 | Bulk-mode performance on 500-employee CSVs misses P2 (< 60 s) — engine + render combined | Medium | Medium | Per-row engine calls in `Promise.all` chunks of 25; TanStack Virtual for the results table; benchmark on Phase 1 + Phase 4 with a 500-employee fixture; consider Web Worker offload if engine alone breaches 30 s |
| R3 | Rounding off-by-cent vs. APA worked examples (especially $9,880.04 in AC25/SC3) | Low (with `decimal.js`) | Critical (single failing case blocks deploy per SC2) | `decimal.js` for all arithmetic; property tests on the rounder; round only at the display boundary; gold-standard fixture asserts exact-string equality on `$9,880.04` |
| R4 | Cross-jurisdiction UX dead-ends — user enters multi-state employee, gets blocked, doesn't know what to do | Medium | Medium | Inline "this employee is skipped; choose a governing jurisdiction to proceed" affordance per AC23 / D18; bulk-mode batch still produces other rows (F6c); test on Playwright + manual walkthrough |
| R5 | Anthropic enterprise key + no-retention contract not in place at launch readiness, blocking the OQ-B-signed-off vendor choice | Low | High (PDF mode cannot ship without it, or ships with an unsigned-off vendor) | DevOps action to confirm contract + key provisioning in Phase 3 Task 3.0; CSV-only mode is still complete without PDF, so worst case is a soft launch sans PDF |
| R6 | Spec ambiguity on Category B fall-through when only gross-only inputs are available (F8 says fall through to Category C math, but classifier still tags B) creates confusing citations | Low | Low | Citation explicitly names "Category B (fall-through to C math: hourly rate + hours not supplied)" with rule key `value-of-week.B.fall-through`; documented in test-cases.md per Phase 0; reviewed with PM |
| R7 | Anthropic SDK / Claude model behaviour drift between Phase 3 build and Phase 6 launch causes extraction quality regression | Low | Medium | Pin model version (`claude-sonnet-4-7-YYYYMMDD`) in `server/anthropic.ts`; calibration set rerun on any model bump; D05 threshold reviewed |

---

## 10. Out of scope (explicitly)

This impl-plan does NOT address:

- **Split-leave** (F14 limits taking_leave to a single period; s.4(3) split-period support deferred — E2 or later)
- **Pay-component decomposition** (gross-only inputs per PM Clarification Summary; F2/F7-related v0.3.0 features removed)
- **$183,100 high-income threshold** bonus-inclusion test (out per v0.4.0 simplification)
- **Salary sacrifice, retrospective pay rises, pre-modern-award employees** (research brief §5.9, §5.12, §5.13 — out of v1)
- **Other states (VIC, QLD, WA, SA, TAS, ACT, NT)** — E2 territory; this plan establishes the directory shape (`states/<jurisdiction>/`) and engine interface (`RuleSet`) that E2 will reuse
- **Audit replay / variance report** — E3 territory; reuses the rules engine, adds CSV import + replay
- **Payroll-system API integrations** — E4 territory
- **Authentication / SSO with APA portal** — v1 ships standalone + deep-link per PM-resolved decision
- **Server-side persistence of employee data** — S1 forbids in v1; APP review precondition for any future server-side store
- **Vendor-specific PDF templates** — F5 explicitly vendor-agnostic in v1; the architecture leaves a pre-LLM template-match hook for future optimisation

---

## 11. Spec gaps surfaced during planning

These are genuine ambiguities surfaced while writing this plan. None are blocking — defaults are noted alongside — but Tracy should consider whether any need PM sign-off before Phase 1 starts.

1. **Category B fall-through citation language (F8)**. Spec says "fall-through to Category C math (whichever is greater of 12-month or 5-year averages on gross weekly)" but doesn't specify what the citation block should say. *Default*: cite both s.4(5)(c) (the formula actually applied) and s.4(5)(b) (the formula the user might expect for Category B) with a note "Category B: hourly rate + hours not separately supplied; using gross-weekly fall-through". PM may want different copy.
2. **As-at mode pro-rata (F11 + D20)**. Spec says as-at mode applies pro-rata accrual regardless of tenure, deliberately differing from termination mode. Spec is internally consistent, but worth confirming with PM that the on-screen UX makes the distinction visible (e.g., a banner "this is a snapshot, not a payout figure").
3. **Bulk-mode trigger override granularity (AC18 / D17)**. Spec says default `as_at` with per-row override via CSV columns, but doesn't specify how the editable preview UI exposes per-row trigger override post-upload. *Default*: trigger is editable in the preview table per row; defaults populated from CSV trigger column or `as_at` if absent. PM may want a bulk "set trigger for all" affordance.
4. **Classifier ambiguity threshold borders (D06)**. D06 gives a CV > 0.10 rule but no soft "borderline" band. *Default*: 0.05 < CV ≤ 0.10 = borderline (still Category A but with `ambiguous: true` flag — surfaces the modal). PM/QA may want a tighter or looser band.
5. **Privacy notice copy (S4 + §8 above)**. Spec mandates a data-handling policy but does not enumerate user-facing copy. *Default*: dev drafts copy in Phase 6 Task 6.2; PM signs off before production traffic.
6. **Vendor for Plausible vs. PostHog vs. self-hosted (D14)**. D14 says "privacy-respecting service or self-hosted" — this plan defaults to Plausible. *Default*: Plausible Cloud (EU region). PM may prefer self-hosted on infra grounds.

---

## 12. References

- Spec: `.specify/features/001-nsw-calculator/spec.md` v0.4.1
- Dev findings: `.specify/features/001-nsw-calculator/dev-findings.md`
- Test cases (to be authored Phase 0): `.specify/features/001-nsw-calculator/test-cases.md`
- Research brief: `context/source-material/lsl-legislation/research-brief-2026-05-21.md`
- Product: `docs/product/product.md`
- Epics: `docs/product/epics.md`
- Folder structure: `FOLDER-STRUCTURE.md`
- CLAUDE: `CLAUDE.md`
- Engineering rules: `~/.claude/rules/global-engineering.md`
