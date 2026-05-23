import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from '@/server/anthropic';
import {
  ExtractionResponseSchema,
  type ExtractionResponse,
} from './schema';
import { buildExtractionRequest, type ExtractionMode } from './prompts';

export type ExtractionResult =
  | { ok: true; data: ExtractionResponse; usage: TokenUsage; cacheHit: boolean }
  | { ok: false; code: ExtractionErrorCode; userMessage: string };

export type ExtractionErrorCode =
  | 'anthropic_not_configured'
  | 'invalid_pdf'
  | 'extraction_failed'
  | 'schema_validation_failed'
  | 'rate_limited'
  | 'timeout'
  | 'service_unavailable';

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

const TIMEOUTS: Record<ExtractionMode, number> = {
  single: 30_000, // 30s per attempt (D04)
  bulk: 5 * 60_000, // 5min per attempt (D04 / P3)
};

/**
 * Orchestrate one PDF extraction: build request → call Claude → validate Zod →
 * (if shape fails) one corrective retry → return parsed data or typed error.
 *
 * Per impl-plan §4.6: one auto-retry on shape failure with the validation error
 * appended; second failure routes the user to CSV fallback (AC26).
 */
export async function extractPDF(
  pdfBase64: string,
  mode: ExtractionMode
): Promise<ExtractionResult> {
  let client: Anthropic;
  try {
    client = getAnthropicClient();
  } catch {
    return {
      ok: false,
      code: 'anthropic_not_configured',
      userMessage:
        'PDF extraction is not configured on this server. Please upload your wage history as CSV instead.',
    };
  }

  const timeoutMs = TIMEOUTS[mode];

  try {
    const firstAttempt = await callWithTimeout(
      () => callClaude(client, pdfBase64, mode),
      timeoutMs
    );

    const validated = ExtractionResponseSchema.safeParse(firstAttempt.parsed);
    if (validated.success) {
      return {
        ok: true,
        data: validated.data,
        usage: firstAttempt.usage,
        cacheHit: firstAttempt.usage.cacheReadInputTokens > 0,
      };
    }

    // Corrective retry per D19: tell the model what was wrong and ask once more.
    try {
      const retry = await callWithTimeout(
        () =>
          callClaudeWithCorrection(client, pdfBase64, mode, validated.error.message),
        timeoutMs
      );
      const validated2 = ExtractionResponseSchema.safeParse(retry.parsed);
      if (validated2.success) {
        return {
          ok: true,
          data: validated2.data,
          usage: retry.usage,
          cacheHit: retry.usage.cacheReadInputTokens > 0,
        };
      }
    } catch {
      // Fall through to the schema-validation error below
    }

    return {
      ok: false,
      code: 'schema_validation_failed',
      userMessage:
        "PDF extraction couldn't produce a valid response shape after one corrective retry. Please upload your wage history as CSV instead.",
    };
  } catch (err) {
    return mapErrorToResult(err);
  }
}

interface RawCallResult {
  parsed: unknown;
  usage: TokenUsage;
}

async function callClaude(
  client: Anthropic,
  pdfBase64: string,
  mode: ExtractionMode
): Promise<RawCallResult> {
  const request = buildExtractionRequest(mode, pdfBase64);
  // Cast: Claude SDK types lag the structured-outputs + adaptive-thinking betas.
  // The response is always Message — we never set stream:true.
  const response = (await client.messages.create(
    request as unknown as Anthropic.MessageCreateParamsNonStreaming
  )) as Anthropic.Message;
  return extractParsed(response);
}

async function callClaudeWithCorrection(
  client: Anthropic,
  pdfBase64: string,
  mode: ExtractionMode,
  validationError: string
): Promise<RawCallResult> {
  const request = buildExtractionRequest(mode, pdfBase64);
  // Append a correction note to the user message
  const lastMessage = request.messages[request.messages.length - 1];
  lastMessage.content.push({
    type: 'text',
    text: `Your previous response failed JSON schema validation with the following error:\n\n${validationError}\n\nReturn a corrected response that conforms to the schema. Same data, valid shape.`,
  });
  // The response is always Message — we never set stream:true.
  const response = (await client.messages.create(
    request as unknown as Anthropic.MessageCreateParamsNonStreaming
  )) as Anthropic.Message;
  return extractParsed(response);
}

function extractParsed(response: Anthropic.Message): RawCallResult {
  // With output_config.format.json_schema, the model's response should be a single
  // text content block containing valid JSON.
  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text'
  );
  if (!textBlock) {
    throw new Error('No text content block in extraction response.');
  }
  const parsed = JSON.parse(textBlock.text) as unknown;
  return {
    parsed,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
    },
  };
}

async function callWithTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new TimeoutError(`Extraction exceeded ${ms}ms`)), ms)
    ),
  ]);
}

class TimeoutError extends Error {
  readonly code = 'timeout';
}

function mapErrorToResult(err: unknown): ExtractionResult {
  if (err instanceof TimeoutError) {
    return {
      ok: false,
      code: 'timeout',
      userMessage:
        'PDF extraction timed out. Please try again, or upload your wage history as CSV instead.',
    };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return {
      ok: false,
      code: 'rate_limited',
      userMessage:
        'Too many extraction requests right now. Please wait a moment and retry, or upload your wage history as CSV.',
    };
  }
  if (err instanceof Anthropic.APIError) {
    const isTransient = err.status >= 500;
    return {
      ok: false,
      code: isTransient ? 'service_unavailable' : 'extraction_failed',
      userMessage: isTransient
        ? 'PDF extraction is temporarily unavailable. Please upload your wage history as CSV instead. Your other form inputs are preserved.'
        : `Extraction service rejected the file (HTTP ${err.status}). Try a different PDF or use CSV upload.`,
    };
  }
  if (err instanceof SyntaxError) {
    return {
      ok: false,
      code: 'invalid_pdf',
      userMessage:
        "Couldn't parse the model's response. Please retry or upload your wage history as CSV.",
    };
  }
  return {
    ok: false,
    code: 'extraction_failed',
    userMessage:
      'PDF extraction failed unexpectedly. Please upload your wage history as CSV instead.',
  };
}
