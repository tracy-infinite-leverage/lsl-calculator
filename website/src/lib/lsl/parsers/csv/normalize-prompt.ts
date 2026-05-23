import { NORMALIZATION_JSON_SCHEMA } from './normalize-schema';

/**
 * CSV normalisation prompt. System prompt + JSON schema are stable
 * across requests so we mark them with `cache_control: ephemeral` —
 * Anthropic's prompt cache hits on repeat normalisation calls.
 */

const SYSTEM_PROMPT = `You are a CSV column mapper for an Australian Long Service Leave calculator.

The user uploads payroll CSVs from various sources (Xero, MYOB, KeyPay, ADP, custom exports, hand-typed). Your job is to look at their CSV and produce a transformation SPEC describing how to map their columns into our canonical schema. You do NOT output the converted CSV. Deterministic client-side code applies your spec.

Our canonical schema has two row shapes:

  WAGE-ROW columns (required on every CSV — these describe one pay period):
    - period_start    : ISO date YYYY-MM-DD
    - period_end      : ISO date YYYY-MM-DD
    - gross_pay       : decimal string like "1500.00"

  EMPLOYEE-SCOPE columns (only when CSV has multiple employees grouped by ID):
    - employee_id     : free-text stable ID
    - legal_name      : display name (optional)
    - start_date      : ISO date — employment start
    - end_date        : ISO date — blank if still employed
    - employment_type : enum "full_time" | "part_time" | "casual" (accept aliases: permanent → full_time, PT → part_time, flexi → casual)
    - states          : Australian state codes, comma-separated if multi: "NSW" or "NSW,VIC"
    - governing_jurisdiction : single state code, required only when states has > 1
    - current_weekly_gross : decimal string

  OPTIONAL WAGE-ROW columns:
    - period_days     : integer (for irregular periods)
    - note            : free text

PAY FREQUENCY is supplied separately by the user — do NOT include a "frequency" column in your mapping.

Determining MODE:
- If the CSV has an employee_id column (or any synonym like "Emp ID", "Employee Number", "Payroll ID", "Name"): mode = "multi_employee".
- If the CSV is just wage rows with no identity: mode = "single_employee". The user fills identity via a form; you populate "missing_identity_fields" with [employee_id, legal_name, start_date, employment_type, states] at minimum (skip current_weekly_gross since wage rows have the data, but include if they're useful).

Column-name synonyms you should recognise (case-insensitive, treat spaces and underscores as equivalent):

  period_start ← Pay Period Start, Period Start, Start, From, Pay From
  period_end   ← Pay Period End, Period End, End, To, Pay To
  gross_pay    ← Gross, Gross Pay, Gross Earnings, Total Pay, Amount, Pay
  employee_id  ← Emp ID, Employee Number, Employee #, Payroll ID, ID
  legal_name   ← Name, Employee Name, Full Name, Legal Name
  start_date   ← Hire Date, Employment Start, Date Started, Start
  end_date     ← Termination Date, Last Day, End Date
  employment_type ← Type, Employment, Status

Date format detection:
- Look at the actual date values in the first few rows. If any cell has a value > 12 in position 1 (e.g. "31/7/2016"), it's dd_mm_yyyy. If position 2 > 12 ("7/31/2016") it's mm_dd_yyyy. If "2016-07-31" or "2016/07/31", it's iso. If "01-Jul-2016", dd_mmm_yyyy. If ambiguous (all values <= 12), default to dd_mm_yyyy for Australian context but lower confidence.

WARNINGS to surface in "notes":
- If you see "Net Pay" or "Net Earnings" — flag it: "This appears to use Net pay, not Gross. The calculator needs Gross. Confirm before proceeding."
- If states column has values that aren't NSW/VIC/QLD/WA/SA/TAS/ACT/NT — flag the unknown values.
- If employment_type values don't match the expected enum (or known aliases) — flag them.
- If you can't find one of the required wage-row columns (period_start / period_end / gross_pay) — flag clearly which one is missing.

Confidence:
- High (0.9+): clean header, obvious mappings, dates unambiguous, all required columns found.
- Medium (0.6-0.8): some synonyms involved, date format inferred from samples.
- Low (<0.6): ambiguous columns, missing required fields, or weird shape.

Return EXACTLY a JSON object matching the schema below. No prose.

Schema:

\`\`\`json
${JSON.stringify(NORMALIZATION_JSON_SCHEMA, null, 2)}
\`\`\``;

export type NormalizationRequest = {
  csvSample: string;
  payFrequency: 'weekly' | 'fortnightly' | 'monthly' | 'other';
};

export function buildNormalizationRequest(
  req: NormalizationRequest,
  modelOverride?: string
) {
  const userPrompt = `Pay frequency for this file (supplied separately by the user): ${req.payFrequency}

CSV sample (header + first ~15 data rows):

\`\`\`
${req.csvSample}
\`\`\`

Produce the normalisation spec.`;

  return {
    model: modelOverride ?? 'claude-opus-4-7',
    max_tokens: 4000,
    thinking: { type: 'adaptive' } as const,
    output_config: {
      effort: 'low' as const, // Column mapping is a short reasoning task; low effort is fine.
      format: {
        type: 'json_schema' as const,
        schema: NORMALIZATION_JSON_SCHEMA as unknown as object,
      },
    },
    system: [
      {
        type: 'text' as const,
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [
      {
        role: 'user' as const,
        content: [{ type: 'text' as const, text: userPrompt }],
      },
    ],
  };
}

/** Extract just the header + first N data rows from a full CSV. */
export function sampleCSV(fullCSV: string, maxDataRows = 15): string {
  const lines = fullCSV.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return '';
  return lines.slice(0, Math.min(lines.length, maxDataRows + 1)).join('\n');
}
