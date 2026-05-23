import { EXTRACTION_JSON_SCHEMA } from './schema';

/**
 * PDF extraction prompts per impl-plan §4.2. Cache the system prompt + schema
 * spec across requests since they're identical every time we call Claude —
 * mark them with `cache_control: { type: 'ephemeral' }`.
 *
 * Render order (per shared/prompt-caching.md): tools → system → messages.
 * Stable content (system + schema) goes first; the only varying byte across
 * extractions is the PDF document and the mode hint, both passed in messages.
 */

export type ExtractionMode = 'single' | 'bulk';

const SYSTEM_PROMPT_BASE = `You are an Australian payroll data extractor. You read payroll-report PDFs (any vendor — Xero, MYOB, KeyPay, ADP, custom exports) and emit a strict JSON object that conforms to the schema supplied below.

Your job is data extraction only — you do not calculate Long Service Leave or interpret legislation. Just transcribe what the PDF reports.

Critical rules:
- **Never fabricate values.** If a field isn't readable from the PDF, return null (not a guess).
- **Confidence is honest, not optimistic.** Report low confidence rather than guess. A field you couldn't read = 0.0 confidence on that field's group; the aggregate score is the lowest of identity / employment / wage_history (not an average).
- **Dates are ISO 8601 (YYYY-MM-DD).** If the PDF uses DD/MM/YYYY (Australian convention), convert. If a date is ambiguous (e.g. 01/02/2024 — Jan or Feb?), prefer DMY but lower the confidence score.
- **Gross pay is a decimal string** like "1500.00". No currency symbols, no thousands separators, no commas.
- **Pay frequency:** infer from period_start/period_end gaps when available — 7 days = weekly, 14 = fortnightly, ~30 = monthly, otherwise = other (and populate period_days).
- **Employment type:** "full_time" | "part_time" | "casual". If the PDF says "permanent" treat as full_time, "PT" as part_time, "casual"/"flexi" as casual. If absent, null.
- **States of service:** Australian state codes only — NSW, VIC, QLD, WA, SA, TAS, ACT, NT. If the PDF is silent on jurisdiction, return an empty array — do NOT assume NSW.
- **Service events:** include any paid leave, Workers' Comp, unpaid leave, JobKeeper periods, transfer-of-business, rehire-after-redundancy events the PDF surfaces.
- **No commentary in the response.** Only the JSON object that matches the schema. The "extraction_notes" field is for noting genuinely ambiguous data you couldn't resolve — not for chitchat.

Schema you must conform to:

\`\`\`json
${JSON.stringify(EXTRACTION_JSON_SCHEMA, null, 2)}
\`\`\``;

const SINGLE_MODE_USER_PROMPT = `Mode: SINGLE EMPLOYEE.

This PDF should contain payroll data for exactly one employee. Return exactly one element in the "employees" array. If the PDF visibly contains more than one employee, populate "extraction_notes" with a clear warning naming what you observed.

The user will review every field before any calculation runs. Prefer fewer-but-correct extractions over many-but-uncertain.`;

const BULK_MODE_USER_PROMPT = `Mode: BULK / MULTI-EMPLOYEE.

This PDF contains payroll data for multiple employees. Return one element per distinct employee in the "employees" array.

Employee disambiguation hints, in priority order:
1. Employee ID columns (e.g. "Emp ID", "Employee #", "Payroll ID")
2. Legal name
3. Employment start date

If two rows in the PDF look like the same employee at different points in time, fold them together. If you can't tell whether two rows are the same person, list them separately and lower the identity confidence.

Pay periods belonging to one employee should go in that employee's wage_history array. Don't mix wage rows across employees.`;

/**
 * Build the Anthropic Messages API parameters for a PDF extraction call.
 * System + schema are cached across calls per shared/prompt-caching.md.
 */
export function buildExtractionRequest(
  mode: ExtractionMode,
  pdfBase64: string,
  modelOverride?: string
): {
  model: string;
  max_tokens: number;
  thinking: { type: 'adaptive' };
  output_config: { effort: 'medium'; format: { type: 'json_schema'; schema: object } };
  system: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
  messages: Array<{
    role: 'user';
    content: Array<
      | {
          type: 'document';
          source: { type: 'base64'; media_type: 'application/pdf'; data: string };
        }
      | { type: 'text'; text: string }
    >;
  }>;
} {
  const userText = mode === 'single' ? SINGLE_MODE_USER_PROMPT : BULK_MODE_USER_PROMPT;

  return {
    model: modelOverride ?? 'claude-opus-4-7',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: {
        type: 'json_schema',
        schema: EXTRACTION_JSON_SCHEMA as unknown as object,
      },
    },
    // System prompt + embedded schema are stable across every extraction call.
    // Cache-mark the last system block per shared/prompt-caching.md placement guidance.
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT_BASE,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          { type: 'text', text: userText },
        ],
      },
    ],
  };
}
