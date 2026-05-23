import { describe, it, expect } from 'vitest';
import { buildExtractionRequest } from '../prompts';
import { EXTRACTION_JSON_SCHEMA } from '../schema';

/**
 * Prompt-builder tests. The prompt template is stable-by-design so the
 * system + schema blocks can be prompt-cached (impl-plan §4.2, claude-api skill).
 * If any of these expectations break, the cache hit rate drops to zero — which
 * is expensive and slow.
 */

describe('buildExtractionRequest', () => {
  const PDF_TEXT = '--- PAGE 1 ---\nEmployee: Jane Doe\nGross: $1,500.00';

  it('pins the model to claude-opus-4-7 by default', () => {
    const req = buildExtractionRequest('single', PDF_TEXT);
    expect(req.model).toBe('claude-opus-4-7');
  });

  it('honours a modelOverride when supplied', () => {
    const req = buildExtractionRequest('single', PDF_TEXT, 'claude-opus-4-7-test');
    expect(req.model).toBe('claude-opus-4-7-test');
  });

  it('marks the system block with cache_control: ephemeral (prompt cache)', () => {
    const req = buildExtractionRequest('single', PDF_TEXT);
    expect(req.system.length).toBeGreaterThan(0);
    const lastSystemBlock = req.system[req.system.length - 1];
    expect(lastSystemBlock.cache_control).toEqual({ type: 'ephemeral' });
  });

  it('embeds the JSON schema in the system prompt (deterministic format anchor)', () => {
    const req = buildExtractionRequest('single', PDF_TEXT);
    const systemText = req.system[0].text;
    // Spot-check three known top-level keys from the schema
    expect(systemText).toContain('employees');
    expect(systemText).toContain('confidence');
    expect(systemText).toContain('wage_history');
  });

  it('passes the JSON schema to output_config.format', () => {
    const req = buildExtractionRequest('single', PDF_TEXT);
    expect(req.output_config.format.type).toBe('json_schema');
    expect(req.output_config.format.schema).toBe(EXTRACTION_JSON_SCHEMA);
  });

  it('uses adaptive thinking with medium effort (Opus 4.7 defaults)', () => {
    const req = buildExtractionRequest('single', PDF_TEXT);
    expect(req.thinking).toEqual({ type: 'adaptive' });
    expect(req.output_config.effort).toBe('medium');
  });

  it('places the PDF text in the LAST message (cache-friendly: stable prefix)', () => {
    const req = buildExtractionRequest('single', PDF_TEXT);
    expect(req.messages.length).toBe(1);
    const userMessageContent = req.messages[0].content[0].text;
    // The PDF text should be at the end of the user message so the prefix
    // (system + cached schema + mode hint) stays identical across calls.
    expect(userMessageContent).toContain(PDF_TEXT);
    expect(userMessageContent.endsWith(PDF_TEXT)).toBe(true);
  });

  it('uses the SINGLE-mode user prompt when mode=single', () => {
    const req = buildExtractionRequest('single', PDF_TEXT);
    const userMessageContent = req.messages[0].content[0].text;
    expect(userMessageContent).toContain('SINGLE EMPLOYEE');
    expect(userMessageContent).not.toContain('BULK / MULTI-EMPLOYEE');
  });

  it('uses the BULK-mode user prompt when mode=bulk', () => {
    const req = buildExtractionRequest('bulk', PDF_TEXT);
    const userMessageContent = req.messages[0].content[0].text;
    expect(userMessageContent).toContain('BULK / MULTI-EMPLOYEE');
    expect(userMessageContent).not.toContain('Mode: SINGLE EMPLOYEE');
  });

  it('keeps max_tokens generous enough for bulk extractions', () => {
    const req = buildExtractionRequest('bulk', PDF_TEXT);
    expect(req.max_tokens).toBeGreaterThanOrEqual(8000);
  });

  it('produces a stable system block for the same mode (cache safety)', () => {
    const a = buildExtractionRequest('single', 'PDF body A');
    const b = buildExtractionRequest('single', 'completely different PDF body B');
    // System block is identical regardless of PDF text → cache hit on second call.
    expect(a.system[0].text).toBe(b.system[0].text);
    expect(a.system[0].cache_control).toEqual(b.system[0].cache_control);
  });

  it('single and bulk modes differ only in user prompt, not system (so each mode caches independently)', () => {
    const single = buildExtractionRequest('single', PDF_TEXT);
    const bulk = buildExtractionRequest('bulk', PDF_TEXT);
    expect(single.system[0].text).toBe(bulk.system[0].text);
    expect(single.messages[0].content[0].text).not.toBe(bulk.messages[0].content[0].text);
  });
});
