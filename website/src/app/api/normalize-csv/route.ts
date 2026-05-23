import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from '@/server/anthropic';
import { scrubPII } from '@/lib/observability/scrub-pii';
import {
  NormalizationSpecSchema,
  type NormalizationSpec,
} from '@/lib/lsl/parsers/csv/normalize-schema';
import {
  buildNormalizationRequest,
  sampleCSV,
} from '@/lib/lsl/parsers/csv/normalize-prompt';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB — anything bigger isn't a CSV problem, it's a different upload

/**
 * POST /api/normalize-csv
 *
 * Body: JSON { csv: string, payFrequency: 'weekly'|'fortnightly'|'monthly'|'other' }
 *
 * Returns:
 *   200 { ok: true, spec: NormalizationSpec, usage, cacheHit }
 *   400 invalid input
 *   422 Claude returned an invalid spec shape
 *   500 unexpected
 *   503 anthropic not configured
 */
export async function POST(req: NextRequest) {
  let body: { csv?: unknown; payFrequency?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', userMessage: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  const csv = body.csv;
  const payFrequency = body.payFrequency;

  if (typeof csv !== 'string' || csv.trim().length === 0) {
    return NextResponse.json(
      { error: 'missing_csv', userMessage: 'No CSV content supplied.' },
      { status: 400 }
    );
  }
  if (csv.length > MAX_CSV_BYTES) {
    return NextResponse.json(
      {
        error: 'csv_too_large',
        userMessage: `CSV exceeds 5 MB. Please split into smaller files.`,
      },
      { status: 413 }
    );
  }
  if (
    payFrequency !== 'weekly' &&
    payFrequency !== 'fortnightly' &&
    payFrequency !== 'monthly' &&
    payFrequency !== 'other'
  ) {
    return NextResponse.json(
      {
        error: 'invalid_frequency',
        userMessage: 'payFrequency must be weekly | fortnightly | monthly | other.',
      },
      { status: 400 }
    );
  }

  let client: Anthropic;
  try {
    client = getAnthropicClient();
  } catch {
    return NextResponse.json(
      {
        error: 'anthropic_not_configured',
        userMessage:
          'CSV auto-conversion is not configured on this server. The CSV must be in the calculator schema (see Schema tab).',
      },
      { status: 503 }
    );
  }

  const sample = sampleCSV(csv, 15);
  const request = buildNormalizationRequest({ csvSample: sample, payFrequency });

  try {
    const response = (await client.messages.create(
      request as unknown as Anthropic.MessageCreateParamsNonStreaming
    )) as Anthropic.Message;
    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text'
    );
    if (!textBlock) {
      return NextResponse.json(
        {
          error: 'no_response',
          userMessage: 'CSV auto-conversion returned no content. Please retry.',
        },
        { status: 500 }
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return NextResponse.json(
        {
          error: 'invalid_response',
          userMessage:
            "CSV auto-conversion returned malformed output. Try again, or upload a CSV in the calculator's expected schema.",
        },
        { status: 422 }
      );
    }
    const validated = NormalizationSpecSchema.safeParse(parsed);
    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'spec_validation_failed',
          userMessage:
            "CSV auto-conversion returned an unexpected shape. Try again, or upload a CSV in the calculator's expected schema.",
        },
        { status: 422 }
      );
    }
    const spec: NormalizationSpec = validated.data;
    return NextResponse.json(
      {
        ok: true,
        spec,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
          cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
        },
        cacheHit: (response.usage.cache_read_input_tokens ?? 0) > 0,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[normalize-csv] error:', JSON.stringify(scrubPII(err)));
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: 'rate_limited', userMessage: 'Too many requests. Try again in a moment.' },
        { status: 429 }
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        {
          error: 'api_error',
          userMessage: `Auto-conversion service rejected the request (HTTP ${err.status}).`,
        },
        { status: err.status >= 500 ? 503 : 500 }
      );
    }
    return NextResponse.json(
      {
        error: 'unexpected',
        userMessage:
          'CSV auto-conversion failed unexpectedly. Please retry or upload a CSV in the expected schema.',
      },
      { status: 500 }
    );
  }
}
