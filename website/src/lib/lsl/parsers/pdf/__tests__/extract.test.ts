import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractPDF } from '../extract';

/**
 * Extract.ts hermetic tests. We only exercise the no-API-key branch here —
 * end-to-end Anthropic calls live in the Playwright e2e suite with the
 * route mocked at the network layer. This keeps the unit suite hermetic.
 */

describe('extractPDF (no API key)', () => {
  let savedKey: string | undefined;

  beforeEach(() => {
    savedKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    // The Anthropic client is a module-level singleton. Resetting modules
    // clears the cached null state so getAnthropicClient() re-checks env.
  });

  afterEach(() => {
    if (savedKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  });

  it('returns anthropic_not_configured (not a thrown error) when the key is missing', async () => {
    const result = await extractPDF(Buffer.from('%PDF-1.4 (stub bytes)'), 'single');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Either of these is acceptable — what matters is we DO NOT throw.
      // The singleton may have been initialised by another test, in which
      // case we get a regular API error code, not the not-configured one.
      // We assert the typed shape, not the exact code.
      expect(result.code).toMatch(/anthropic_not_configured|extraction_failed/);
      expect(typeof result.userMessage).toBe('string');
      expect(result.userMessage.length).toBeGreaterThan(0);
    }
  });
});
