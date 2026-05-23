import Anthropic from '@anthropic-ai/sdk';

/**
 * Anthropic SDK singleton. Pinned model + lazy init so the module can be imported
 * without an API key in test/build contexts; calls fail loudly when the key is missing.
 *
 * Per OQ-B sign-off (impl-plan §4.1): default vendor = Anthropic Claude API,
 * no-retention enterprise tier. The no-retention behaviour is configured at the
 * org/key level — no per-request flag is needed.
 */
export const ANTHROPIC_MODEL = 'claude-opus-4-7' as const;

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnthropicNotConfiguredError();
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export class AnthropicNotConfiguredError extends Error {
  readonly code = 'anthropic_not_configured';
  constructor() {
    super(
      'ANTHROPIC_API_KEY is not set. PDF extraction is not configured — please upload your wage history as CSV instead.'
    );
    this.name = 'AnthropicNotConfiguredError';
  }
}

/** Re-export type aliases so callers don't import directly from the SDK. */
export type { Anthropic };
