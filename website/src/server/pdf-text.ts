/**
 * Server-side PDF → text extraction.
 *
 * WHY: Anthropic's `document` content block is capped at 100 pages — sending a
 * 200-page payroll report as raw binary will be rejected. Pre-extracting text
 * with pdfjs (Node legacy build) lets us send a `text` content block instead,
 * which lifts the page ceiling and is also significantly cheaper in tokens.
 *
 * Trade-off: scanned image-only PDFs won't yield usable text. Payroll system
 * exports (Xero / MYOB / KeyPay / ADP / custom) are virtually always
 * text-bearing, so this is acceptable for E1. Bulk-mode (Phase 4) may want OCR
 * for the edge cases — out of scope here.
 */

// pdfjs-dist legacy build is Node-compatible (no DOM). We need the LEGACY path
// because the default v5 build assumes a worker + DOM globals.
// Import the type separately so TS still resolves the package surface.
import type * as PDFJS from 'pdfjs-dist';

let _pdfjs: typeof PDFJS | null = null;

async function loadPDFJS(): Promise<typeof PDFJS> {
  if (_pdfjs) return _pdfjs;
  // Dynamic import — kept off the request hot path on first use only.
  // The .mjs path is the source-of-truth bundle for Node.
  _pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as typeof PDFJS;
  return _pdfjs;
}

export interface ExtractedPdfText {
  pages: number;
  /** Full document text, page-delimited so Claude can cite by page if needed. */
  text: string;
  /** True if every page yielded zero printable characters (likely scanned image). */
  isLikelyScanned: boolean;
}

/**
 * Extract text from a PDF buffer. Page-delimited with `--- PAGE N ---` markers
 * so the LLM can reference page numbers in extraction_notes when relevant.
 */
export async function extractPdfText(pdfBuffer: Buffer): Promise<ExtractedPdfText> {
  const pdfjs = await loadPDFJS();

  // Convert Node Buffer → Uint8Array as required by pdfjs.
  const data = new Uint8Array(pdfBuffer);

  const doc = await pdfjs.getDocument({
    data,
    verbosity: 0,
    // No DOM in Node — disable any feature that would need one.
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;

  const pageCount = doc.numPages;
  const parts: string[] = [];
  let totalChars = 0;

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Each item has a `str` field; some items are markedContent without it.
    const pageText = content.items
      .map((item) => (typeof (item as { str?: unknown }).str === 'string'
        ? (item as { str: string }).str
        : ''))
      .join(' ')
      .replace(/[ \t]+/g, ' ')
      .trim();
    totalChars += pageText.length;
    parts.push(`--- PAGE ${i} ---\n${pageText}`);
    page.cleanup();
  }

  await doc.destroy();

  return {
    pages: pageCount,
    text: parts.join('\n\n'),
    isLikelyScanned: totalChars === 0,
  };
}
