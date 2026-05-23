import { describe, it, expect } from 'vitest';
import { inspectPDF } from '../client';

/**
 * Note: Node 20+ provides global `File` and `Blob`. We deliberately do not
 * load jsdom for these tests — they exercise the type/size guards that run
 * BEFORE pdfjs (which would need a browser env). Tests that depend on
 * pdfjs's actual parsing belong in the Playwright e2e suite.
 */

/**
 * Client-side pre-upload guards (D03, AC27, AC28). These tests exercise the
 * file-type and size branches that short-circuit BEFORE pdfjs is imported,
 * so they're hermetic — no DOM workers, no real PDF parsing required.
 */

function makeFile(name: string, sizeBytes: number, type = 'application/pdf'): File {
  // Build a File whose `.size` matches what we want without allocating the
  // real bytes (avoids OOM on the 51 MB case). The contents are never read.
  const buf = new Uint8Array(Math.min(sizeBytes, 16)); // tiny payload
  const f = new File([buf], name, { type });
  Object.defineProperty(f, 'size', { value: sizeBytes, configurable: true });
  return f;
}

describe('inspectPDF — pre-upload guards', () => {
  it('AC27: rejects a .csv file with a friendly "wrong card" message', async () => {
    const csv = makeFile('wage-history.csv', 1024, 'text/csv');
    const result = await inspectPDF(csv);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('wrong_file_type');
    expect(result.error?.message).toMatch(/CSV/i);
    expect(result.error?.message).toMatch(/CSV uploader|CSV card|"Upload wage history CSV"/i);
  });

  it('AC27: rejects a .xlsx file with the export-to-CSV nudge', async () => {
    const xlsx = makeFile(
      'payroll.xlsx',
      1024,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    const result = await inspectPDF(xlsx);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('wrong_file_type');
    expect(result.error?.message).toMatch(/Excel/i);
  });

  it('AC27: rejects a .docx file as wrong file type', async () => {
    const docx = makeFile(
      'report.docx',
      1024,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    const result = await inspectPDF(docx);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('wrong_file_type');
  });

  it('AC27: rejects a .png image with the not-a-PDF message', async () => {
    const png = makeFile('scan.png', 1024, 'image/png');
    const result = await inspectPDF(png);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('wrong_file_type');
    expect(result.error?.message).toMatch(/not a PDF|isn't a PDF|payroll-report PDF/i);
  });

  it('AC28: rejects a file > 50 MB before pdfjs is loaded', async () => {
    const big = makeFile('huge.pdf', 51 * 1024 * 1024, 'application/pdf');
    const result = await inspectPDF(big);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('too_large');
    expect(result.error?.message).toMatch(/50 MB/);
    expect(result.sizeBytes).toBe(51 * 1024 * 1024);
  });

  it('returns sizeBytes even on rejection (callers may want to log it)', async () => {
    const csv = makeFile('wage.csv', 4096, 'text/csv');
    const result = await inspectPDF(csv);
    expect(result.sizeBytes).toBe(4096);
  });

  // Note: we deliberately do NOT test the "valid PDF" or "extension only,
  // MIME missing" path here — both push past the type-guard into pdfjs,
  // which needs a browser environment (DOMMatrix, OffscreenCanvas). That
  // coverage lives in the Playwright e2e suite which runs in a real browser.
});
