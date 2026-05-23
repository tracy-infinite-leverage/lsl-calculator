import { NextRequest, NextResponse } from 'next/server';
import { extractPDF } from '@/lib/lsl/parsers/pdf/extract';
import { checkConfidence } from '@/lib/lsl/parsers/pdf/confidence';
import type { ExtractionMode } from '@/lib/lsl/parsers/pdf/prompts';

export const runtime = 'nodejs';
export const maxDuration = 60; // seconds — single-mode budget; bulk needs more (D-OQ7 will raise)

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per F5 / AC28

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

  // Read file → base64 for the Anthropic document content block
  const arrayBuffer = await fileField.arrayBuffer();
  const pdfBase64 = Buffer.from(arrayBuffer).toString('base64');

  const result = await extractPDF(pdfBase64, mode);
  if (!result.ok) {
    const status = result.code === 'anthropic_not_configured' ? 503 : 500;
    return NextResponse.json(
      { error: result.code, userMessage: result.userMessage },
      { status }
    );
  }

  // Confidence gate
  const gate = checkConfidence(result.data.employees);
  if (!gate.ok) {
    return NextResponse.json(
      {
        error: 'low_confidence',
        userMessage:
          "We couldn't read this PDF with enough confidence to populate the form automatically. Please upload your wage history as CSV instead — your other inputs are preserved.",
        aggregate: gate.aggregate,
      },
      { status: 422 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      data: result.data,
      flags: gate.flags,
      usage: result.usage,
      cacheHit: result.cacheHit,
    },
    { status: 200 }
  );
}
