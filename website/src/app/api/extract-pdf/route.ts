import { NextRequest, NextResponse } from 'next/server';
import { extractPDF } from '@/lib/lsl/parsers/pdf/extract';
import { checkConfidence } from '@/lib/lsl/parsers/pdf/confidence';
import type { ExtractionMode } from '@/lib/lsl/parsers/pdf/prompts';
import { extractPdfText } from '@/server/pdf-text';

export const runtime = 'nodejs';
// Route ceiling must exceed extract.ts TIMEOUTS.single (120s) — leave a small
// margin for the rest of the request (text extraction, validation, JSON write).
export const maxDuration = 150;

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per F5 / AC28
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

  // Server-side text extraction: bypasses Anthropic's 100-page document-block
  // ceiling and is significantly cheaper in tokens. Scanned image-only PDFs
  // will return zero text — we surface that as a 422 with the CSV fallback CTA.
  const arrayBuffer = await fileField.arrayBuffer();
  const pdfBuffer = Buffer.from(arrayBuffer);

  let extracted: Awaited<ReturnType<typeof extractPdfText>>;
  try {
    extracted = await extractPdfText(pdfBuffer);
  } catch (err) {
    return NextResponse.json(
      {
        error: 'invalid_pdf',
        userMessage: `Couldn't read the PDF (${err instanceof Error ? err.message : 'unknown error'}). Try a different file or upload your wage history as CSV instead.`,
      },
      { status: 422 }
    );
  }

  if (extracted.pages > MAX_PAGES) {
    return NextResponse.json(
      {
        error: 'too_many_pages',
        userMessage: `This PDF has ${extracted.pages} pages. The calculator accepts PDFs up to ${MAX_PAGES} pages. Please split the file or upload as CSV instead.`,
      },
      { status: 413 }
    );
  }

  if (extracted.isLikelyScanned) {
    return NextResponse.json(
      {
        error: 'scanned_pdf',
        userMessage:
          "This PDF appears to be a scanned image (no extractable text). Please use a text-based payroll export, or upload your wage history as CSV instead.",
      },
      { status: 422 }
    );
  }

  const result = await extractPDF(extracted.text, mode);
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
