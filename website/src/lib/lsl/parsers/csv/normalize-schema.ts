/**
 * Schema for the CSV normalisation spec returned by Claude per the
 * pre-launch CSV-import upgrade (chat 2026-05-23).
 *
 * Design: instead of asking Claude to output the whole converted CSV
 * (expensive — output tokens cost ~3x input on Opus 4.7), we ask for a
 * compact JSON spec describing HOW to convert the user's CSV. The
 * conversion itself runs deterministically in client-side code via
 * `applyNormalizationSpec()` (see normalize-apply.ts).
 *
 * This file owns both the Zod runtime validator AND the JSON Schema fed
 * to Claude's `output_config.format`. Kept in sync by hand because
 * Anthropic's structured-outputs dialect is a constrained subset of
 * JSON Schema (no min/max on numbers, no nullable enums, etc. — see
 * Phase 3 fix commit ee2266c history for details).
 */

import { z } from 'zod';

/**
 * Our canonical column names. The spec maps THEIR header names → these.
 * Wage-row columns are the only ones the user's CSV is REQUIRED to carry;
 * everything else can come from the identity form when in single-employee
 * mode.
 */
export const CanonicalColumnSchema = z.enum([
  // Wage row (required in some form on every CSV)
  'period_start',
  'period_end',
  'gross_pay',
  // Employee scope (may be absent when single-employee mode)
  'employee_id',
  'legal_name',
  'start_date',
  'end_date',
  'employment_type',
  'states',
  'governing_jurisdiction',
  'current_weekly_gross',
  'period_days',
  'note',
]);

export type CanonicalColumn = z.infer<typeof CanonicalColumnSchema>;

export const DateFormatSchema = z.enum([
  'iso', // YYYY-MM-DD
  'dd_mm_yyyy', // 1/7/2016 or 01/07/2016 (Australian default)
  'mm_dd_yyyy', // 7/1/2016 (US)
  'dd_mmm_yyyy', // 01-Jul-2016
  'unknown',
]);

export type DateFormat = z.infer<typeof DateFormatSchema>;

export const NormalizationModeSchema = z.enum([
  'multi_employee', // CSV has identity columns + groups rows by employee
  'single_employee', // CSV is wage history only — identity comes from the form
]);

export type NormalizationMode = z.infer<typeof NormalizationModeSchema>;

/**
 * A single column mapping: which canonical field this column represents,
 * which header index it lives at in the source CSV, and any transform
 * hints (e.g. strip currency symbols).
 */
export const ColumnMappingSchema = z.object({
  canonical: CanonicalColumnSchema,
  source_header: z.string(),
  source_index: z.number().int().min(0),
  transform: z
    .enum(['none', 'strip_currency', 'parse_date', 'split_states'])
    .default('none')
    .optional(),
});

export type ColumnMapping = z.infer<typeof ColumnMappingSchema>;

export const NormalizationSpecSchema = z.object({
  mode: NormalizationModeSchema,
  date_format: DateFormatSchema,
  columns: z.array(ColumnMappingSchema),
  /**
   * Canonical fields the user MUST supply via the identity form when
   * mode is single_employee. Always empty for multi_employee mode.
   */
  missing_identity_fields: z.array(CanonicalColumnSchema),
  /**
   * Free text notes from Claude about quality, ambiguities, or
   * surprises. Surfaced to the user in the review UI.
   */
  notes: z.string().nullable(),
  /** 0..1 — Claude's self-rated confidence. Below 0.7 prompts careful UI review. */
  confidence: z.number(),
});

export type NormalizationSpec = z.infer<typeof NormalizationSpecSchema>;

/**
 * JSON Schema fed to Claude's output_config. Mirrors the Zod schema with
 * Anthropic's structured-outputs dialect quirks applied (no nullable
 * enums; use anyOf for nullable strings).
 */
export const NORMALIZATION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'mode',
    'date_format',
    'columns',
    'missing_identity_fields',
    'notes',
    'confidence',
  ],
  properties: {
    mode: { type: 'string', enum: ['multi_employee', 'single_employee'] },
    date_format: {
      type: 'string',
      enum: ['iso', 'dd_mm_yyyy', 'mm_dd_yyyy', 'dd_mmm_yyyy', 'unknown'],
    },
    columns: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['canonical', 'source_header', 'source_index'],
        properties: {
          canonical: {
            type: 'string',
            enum: [
              'period_start',
              'period_end',
              'gross_pay',
              'employee_id',
              'legal_name',
              'start_date',
              'end_date',
              'employment_type',
              'states',
              'governing_jurisdiction',
              'current_weekly_gross',
              'period_days',
              'note',
            ],
          },
          source_header: { type: 'string' },
          source_index: { type: 'integer' },
          transform: {
            type: 'string',
            enum: ['none', 'strip_currency', 'parse_date', 'split_states'],
          },
        },
      },
    },
    missing_identity_fields: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'employee_id',
          'legal_name',
          'start_date',
          'end_date',
          'employment_type',
          'states',
          'governing_jurisdiction',
          'current_weekly_gross',
        ],
      },
    },
    notes: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    confidence: { type: 'number' },
  },
} as const;
