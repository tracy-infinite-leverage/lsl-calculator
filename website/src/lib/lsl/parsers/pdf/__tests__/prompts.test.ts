import { describe, it, expect } from 'vitest';
import { buildExtractionRequest } from '../prompts';
import { EXTRACTION_JSON_SCHEMA } from '../schema';

/**
 * Prompt-builder tests. The prompt template is stable-by-design so the
 * system + schema blocks can be prompt-cached (impl-plan §4.2, claude-api skill).
 * If any of these expectations break, the cache hit rate drops to zero — which
 * is expensive and slow.
 *
 * The PDF is now passed as a base64 `document` content block (Anthropic native
 * PDF support) — these tests pin that contract.
 */

describe('buildExtractionRequest', () => {
  // Minimal base64 payload — these tests don't decode it, they just assert
  // it ends up in the document block source verbatim.
  const PDF_BASE64 = 'JVBERi0xLjQKJeLjz9MKCg==';

  it('pins the model to claude-opus-4-7 by default', () => {
    const req = buildExtractionRequest('single', PDF_BASE64);
    expect(req.model).toBe('claude-opus-4-7');
  });

  it('honours a modelOverride when supplied', () => {
    const req = buildExtractionRequest('single', PDF_BASE64, 'claude-opus-4-7-test');
    expect(req.model).toBe('claude-opus-4-7-test');
  });

  it('marks the system block with cache_control: ephemeral (prompt cache)', () => {
    const req = buildExtractionRequest('single', PDF_BASE64);
    expect(req.system.length).toBeGreaterThan(0);
    const lastSystemBlock = req.system[req.system.length - 1];
    expect(lastSystemBlock.cache_control).toEqual({ type: 'ephemeral' });
  });

  it('embeds the JSON schema in the system prompt (deterministic format anchor)', () => {
    const req = buildExtractionRequest('single', PDF_BASE64);
    const systemText = req.system[0].text;
    // Spot-check three known top-level keys from the schema
    expect(systemText).toContain('employees');
    expect(systemText).toContain('confidence');
    expect(systemText).toContain('wage_history');
  });

  it('passes the JSON schema to output_config.format', () => {
    const req = buildExtractionRequest('single', PDF_BASE64);
    expect(req.output_config.format.type).toBe('json_schema');
    expect(req.output_config.format.schema).toBe(EXTRACTION_JSON_SCHEMA);
  });

  it('uses adaptive thinking with medium effort (Opus 4.7 defaults)', () => {
    const req = buildExtractionRequest('single', PDF_BASE64);
    expect(req.thinking).toEqual({ type: 'adaptive' });
    expect(req.output_config.effort).toBe('medium');
  });

  it('sends the PDF as a base64 document content block (Anthropic native PDF)', () => {
    const req = buildExtractionRequest('single', PDF_BASE64);
    expect(req.messages.length).toBe(1);
    const content = req.messages[0].content;
    // First content item is the PDF document block — placed before the text
    // instructions per Anthropic's documentation guidance.
    const docBlock = content[0];
    expect(docBlock.type).toBe('document');
    if (docBlock.type === 'document') {
      expect(docBlock.source.type).toBe('base64');
      expect(docBlock.source.media_type).toBe('application/pdf');
      expect(docBlock.source.data).toBe(PDF_BASE64);
    }
  });

  it('places the document block FIRST and the text instructions SECOND', () => {
    const req = buildExtractionRequest('single', PDF_BASE64);
    const content = req.messages[0].content;
    expect(content[0].type).toBe('document');
    expect(content[1].type).toBe('text');
  });

  it('uses the SINGLE-mode user prompt when mode=single', () => {
    const req = buildExtractionRequest('single', PDF_BASE64);
    const textBlock = req.messages[0].content[1];
    expect(textBlock.type).toBe('text');
    if (textBlock.type === 'text') {
      expect(textBlock.text).toContain('SINGLE EMPLOYEE');
      expect(textBlock.text).not.toContain('BULK / MULTI-EMPLOYEE');
    }
  });

  it('uses the BULK-mode user prompt when mode=bulk', () => {
    const req = buildExtractionRequest('bulk', PDF_BASE64);
    const textBlock = req.messages[0].content[1];
    expect(textBlock.type).toBe('text');
    if (textBlock.type === 'text') {
      expect(textBlock.text).toContain('BULK / MULTI-EMPLOYEE');
      expect(textBlock.text).not.toContain('Mode: SINGLE EMPLOYEE');
    }
  });

  it('keeps max_tokens generous enough for bulk extractions', () => {
    const req = buildExtractionRequest('bulk', PDF_BASE64);
    expect(req.max_tokens).toBeGreaterThanOrEqual(8000);
  });

  it('produces a stable system block for the same mode (cache safety)', () => {
    const a = buildExtractionRequest('single', 'AAAA');
    const b = buildExtractionRequest('single', 'BBBB');
    // System block is identical regardless of PDF payload → cache hit on second call.
    expect(a.system[0].text).toBe(b.system[0].text);
    expect(a.system[0].cache_control).toEqual(b.system[0].cache_control);
  });

  it('produces a stable text-instruction block for the same mode (no PDF leakage)', () => {
    // The text-instruction block (content[1]) must NOT include the PDF
    // payload — that lives in the document block. Stability of the text
    // block across calls is what lets the document block be the only thing
    // that varies, which is the right cache-shape for Anthropic's PDF flow.
    const a = buildExtractionRequest('single', 'AAAA');
    const b = buildExtractionRequest('single', 'BBBB');
    expect(a.messages[0].content[1]).toEqual(b.messages[0].content[1]);
  });

  it('single and bulk modes differ only in user-text content, not system (so each mode caches independently)', () => {
    const single = buildExtractionRequest('single', PDF_BASE64);
    const bulk = buildExtractionRequest('bulk', PDF_BASE64);
    expect(single.system[0].text).toBe(bulk.system[0].text);
    const singleText = single.messages[0].content[1];
    const bulkText = bulk.messages[0].content[1];
    if (singleText.type === 'text' && bulkText.type === 'text') {
      expect(singleText.text).not.toBe(bulkText.text);
    } else {
      throw new Error('text block missing');
    }
  });
});
