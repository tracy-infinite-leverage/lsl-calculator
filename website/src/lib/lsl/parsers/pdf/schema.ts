import { z } from 'zod';
import type { PayFrequency, EmploymentType, ServiceEventType, State } from '@/lib/lsl/engine/types';

/**
 * Extraction JSON schema per impl-plan §2.3 — the shape Claude is asked to emit
 * when reading a payroll-report PDF. `gross_pay` is a string to avoid float
 * precision loss in JSON; the client parses to Decimal.
 *
 * Used in two places:
 *   1. As a Zod schema for server-side validation (corrective retry per D19)
 *   2. As a JSON Schema fed into Claude's `output_config.format` for structured
 *      outputs (so the model is constrained to this shape on the API side)
 */

const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const NULLABLE_ISO_DATE = z.union([ISO_DATE, z.null()]);

const EMPLOYMENT_TYPES: EmploymentType[] = ['full_time', 'part_time', 'casual'];
const FREQUENCIES: PayFrequency[] = ['weekly', 'fortnightly', 'monthly', 'other'];
const STATES: State[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const SERVICE_EVENT_TYPES: ServiceEventType[] = [
  'paid_leave',
  'workers_comp_absence',
  'unpaid_parental_leave',
  'leave_without_pay',
  'industrial_action',
  'employer_stand_down',
  'transfer_of_business',
  'employer_initiated_termination_and_rehire',
  'apprentice_to_tradesperson_transition',
  'jobkeeper_or_covid_standdown',
];

export const WageHistoryEntrySchema = z.object({
  period_start: ISO_DATE,
  period_end: ISO_DATE,
  /** gross as string to preserve precision across JSON round-trip */
  gross_pay: z.string().regex(/^\d+(\.\d+)?$/),
  frequency: z.enum(['weekly', 'fortnightly', 'monthly', 'other']).nullable(),
  period_days: z.number().int().positive().nullable(),
});

export const ServiceEventSchema = z.object({
  type: z.enum(SERVICE_EVENT_TYPES as [ServiceEventType, ...ServiceEventType[]]),
  start_date: ISO_DATE,
  end_date: NULLABLE_ISO_DATE,
  note: z.string().nullable().optional(),
});

export const ConfidenceSchema = z.object({
  identity: z.number().min(0).max(1),
  employment: z.number().min(0).max(1),
  wage_history: z.number().min(0).max(1),
  aggregate: z.number().min(0).max(1),
});

export const ExtractedEmployeeSchema = z.object({
  external_employee_id: z.string().nullable(),
  legal_name: z.string().nullable(),
  start_date: NULLABLE_ISO_DATE,
  end_date: NULLABLE_ISO_DATE,
  employment_type: z
    .enum(EMPLOYMENT_TYPES as [EmploymentType, ...EmploymentType[]])
    .nullable(),
  states_of_service: z.array(z.enum(STATES as [State, ...State[]])).default([]),
  current_weekly_gross: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .nullable(),
  wage_history: z.array(WageHistoryEntrySchema).default([]),
  service_events: z.array(ServiceEventSchema).default([]),
  confidence: ConfidenceSchema,
});

export const ExtractionResponseSchema = z.object({
  employees: z.array(ExtractedEmployeeSchema).min(1),
  extraction_notes: z.string().nullable().optional(),
});

export type ExtractedEmployee = z.infer<typeof ExtractedEmployeeSchema>;
export type WageHistoryEntry = z.infer<typeof WageHistoryEntrySchema>;
export type ExtractedServiceEvent = z.infer<typeof ServiceEventSchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;

/**
 * Hand-rolled JSON Schema mirror of the Zod schema, fed to Claude via
 * `output_config.format`. We don't auto-derive from Zod here — Claude's
 * structured-outputs JSON Schema dialect is a constrained subset (no
 * `additionalProperties` beyond `false`, no recursion, limited string formats),
 * so it's safer to write it once and keep it in sync with the Zod side.
 */
export const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['employees'],
  properties: {
    employees: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'external_employee_id',
          'legal_name',
          'start_date',
          'end_date',
          'employment_type',
          'states_of_service',
          'current_weekly_gross',
          'wage_history',
          'service_events',
          'confidence',
        ],
        properties: {
          external_employee_id: { type: ['string', 'null'] },
          legal_name: { type: ['string', 'null'] },
          start_date: {
            type: ['string', 'null'],
            description: 'ISO date YYYY-MM-DD',
          },
          end_date: {
            type: ['string', 'null'],
            description: 'ISO date YYYY-MM-DD',
          },
          // anyOf — Anthropic's structured-outputs validator rejects the
          // `type: ['string', 'null']` + `enum` combo, even when null is in
          // the enum list. anyOf is the canonical JSON Schema spelling.
          employment_type: {
            anyOf: [
              { type: 'string', enum: EMPLOYMENT_TYPES },
              { type: 'null' },
            ],
          },
          states_of_service: {
            type: 'array',
            items: { type: 'string', enum: STATES },
          },
          current_weekly_gross: {
            type: ['string', 'null'],
            description: 'AUD as a decimal string, e.g. "1500.00"',
          },
          wage_history: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['period_start', 'period_end', 'gross_pay', 'frequency', 'period_days'],
              properties: {
                period_start: { type: 'string' },
                period_end: { type: 'string' },
                gross_pay: { type: 'string' },
                frequency: {
                  anyOf: [
                    { type: 'string', enum: FREQUENCIES },
                    { type: 'null' },
                  ],
                },
                period_days: { type: ['integer', 'null'] },
              },
            },
          },
          service_events: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['type', 'start_date', 'end_date'],
              properties: {
                type: { type: 'string', enum: SERVICE_EVENT_TYPES },
                start_date: { type: 'string' },
                end_date: { type: ['string', 'null'] },
                note: { type: ['string', 'null'] },
              },
            },
          },
          confidence: {
            type: 'object',
            additionalProperties: false,
            required: ['identity', 'employment', 'wage_history', 'aggregate'],
            // Anthropic's structured-outputs JSON Schema dialect rejects
            // `minimum`/`maximum` on number types. Range (0..1) is enforced
            // by the Zod schema after the model returns.
            properties: {
              identity: { type: 'number' },
              employment: { type: 'number' },
              wage_history: { type: 'number' },
              aggregate: { type: 'number' },
            },
          },
        },
      },
    },
    extraction_notes: { type: ['string', 'null'] },
  },
} as const;
