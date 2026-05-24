import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { extractPDF } from '@/lib/lsl/parsers/pdf/extract';
import { checkConfidence } from '@/lib/lsl/parsers/pdf/confidence';
import type { ExtractionMode } from '@/lib/lsl/parsers/pdf/prompts';

export const runtime = 'nodejs';
// Route ceiling must exceed extract.ts TIMEOUTS.single (120s) — leave a small
// margin for the rest of the request (page-count validation, JSON write).
export const maxDuration = 150;

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per F5 / AC28
// Anthropic's document content block is capped at 32 MB per document. Our
// public limit (50 MB / 50 pages) covers everything that fits; PDFs in the
// 32–50 MB range get rejected here with a clear message. Payroll exports
// rarely exceed 32 MB in practice — the upper band is mostly scanned-archive
// material that we'd advise users to convert anyway.
const MAX_ANTHROPIC_BYTES = 32 * 1024 * 1024;
const MAX_PAGES = 50; // spec F5 / AC28; matches client-side cap

/**
 * POST /api/extract-pdf
 *
 * Body: multipart/form-data with fields:
 *   - file: the PDF (required)
 *   - mode: "single" | "bulk" (required)
 *
 * Returns 200 with the validated extraction + confidence flags on success,
 * or a structured JSON error body with one of the `extraction_*` codes on
 * failure (so the client can route to CSV fallback per AC26).
 *
 * The PDF is sent to Anthropic as a base64 `document` content block — no
 * server-side text pre-extraction. We use pdf-lib for a quick page-count
 * guard (pure JS, no DOM globals, safe on Vercel's Node runtime).
 */
export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: 'invalid_form_data', userMessage: 'Could not read multipart form.' },
      { status: 400 }
    );
  }

  const fileField = formData.get('file');
  const modeField = formData.get('mode');

  if (!(fileField instanceof File)) {
    return NextResponse.json(
      { error: 'missing_file', userMessage: 'No PDF file uploaded.' },
      { status: 400 }
    );
  }
  if (modeField !== 'single' && modeField !== 'bulk') {
    return NextResponse.json(
      { error: 'invalid_mode', userMessage: 'mode must be "single" or "bulk".' },
      { status: 400 }
    );
  }
  const mode = modeField as ExtractionMode;

  if (fileField.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      {
        error: 'file_too_large',
        userMessage: `PDF exceeds the 50 MB limit (${Math.round(fileField.size / 1_048_576)} MB). Please slice the file or switch to CSV.`,
      },
      { status: 413 }
    );
  }

  if (fileField.size > MAX_ANTHROPIC_BYTES) {
    // 32–50 MB band: under our public cap but over Anthropic's document-block
    // ceiling. Surface a clear message rather than letting the extractor fail
    // opaquely on the upstream API.
    return NextResponse.json(
      {
        error: 'file_too_large',
        userMessage: `This PDF is ${Math.round(fileField.size / 1_048_576)} MB. Files above 32 MB can't be processed by the extraction service — please slice the file or upload your wage history as CSV instead.`,
      },
      { status: 413 }
    );
  }

  if (fileField.type && !fileField.type.includes('pdf')) {
    return NextResponse.json(
      {
        error: 'invalid_content_type',
        userMessage:
          'Only PDF files are supported. Excel users should export to CSV; image / .docx / .xlsx files are rejected.',
      },
      { status: 415 }
    );
  }

  const arrayBuffer = await fileField.arrayBuffer();
  const pdfBuffer = Buffer.from(arrayBuffer);

  // Server-side page-count guard. The client-side inspectPDF also enforces 50
  // pages, but the server is the trust boundary — we can't rely on a
  // hand-crafted client to play fair. pdf-lib is pure JS and doesn't pull in
  // any DOM globals, so it runs cleanly on Vercel's Node 20 runtime (unlike
  // pdfjs-dist's legacy build — see GitHub issue #5).
  let pageCount: number;
  try {
    // ignoreEncryption: best-effort read of the page tree even for password-
    // protected PDFs. We only need numPages; we never decrypt content.
    const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    pageCount = doc.getPageCount();
  } catch (err) {
    return NextResponse.json(
      {
        error: 'invalid_pdf',
        userMessage: `Couldn't read the PDF (${err instanceof Error ? err.message : 'unknown error'}). Try a different file or upload your wage history as CSV instead.`,
      },
      { status: 422 }
    );
  }

  if (pageCount > MAX_PAGES) {
    return NextResponse.json(
      {
        error: 'too_many_pages',
        userMessage: `This PDF has ${pageCount} pages. The calculator accepts PDFs up to ${MAX_PAGES} pages. Please split the file or upload as CSV instead.`,
      },
      { status: 413 }
    );
  }

  const result = await extractPDF(pdfBuffer, mode);
  if (!result.ok) {
    const status = result.code === 'anthropic_not_configured' ? 503 : 500;
    return NextResponse.json(
      { error: result.code, userMessage: result.userMessage },
      { status }
    );
  }

  // Confidence report — informational, never blocks. The editable preview
  // table is the user's chance to review every field; we just decorate the
  // response with flags + an overall-low banner hint.
  const report = checkConfidence(result.data.employees);

  return NextResponse.json(
    {
      ok: true,
      data: result.data,
      flags: report.flags,
      worstAggregate: report.worstAggregate,
      lowOverallConfidence: report.lowOverallConfidence,
      usage: result.usage,
      cacheHit: result.cacheHit,
    },
    { status: 200 }
  );
}
