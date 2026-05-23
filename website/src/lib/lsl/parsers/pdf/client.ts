/**
 * Client-side PDF inspection — page count + size validation BEFORE upload.
 * Saves a round-trip when the file is obviously oversized (AC28).
 *
 * Per D03: use pdf.js to read page metadata without rendering.
 */

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_PAGES = 200;

export interface PDFInspection {
  ok: boolean;
  pages?: number;
  sizeBytes: number;
  error?: {
    code: 'too_large' | 'too_many_pages' | 'unreadable' | 'wrong_file_type';
    message: string;
  };
}

/** Inspect a PDF file in the browser; returns page count if valid. */
export async function inspectPDF(file: File): Promise<PDFInspection> {
  // Catch non-PDFs (CSV/XLSX/DOCX/PNG/etc.) BEFORE handing to pdfjs, which would
  // throw "Invalid PDF structure" — confusing for someone who just dropped a CSV
  // on the wrong card.
  const nameLower = file.name.toLowerCase();
  const looksLikePDF =
    nameLower.endsWith('.pdf') ||
    file.type === 'application/pdf' ||
    file.type === 'application/x-pdf';
  if (!looksLikePDF) {
    const ext = nameLower.match(/\.([a-z0-9]+)$/)?.[1];
    const friendly =
      ext === 'csv' || ext === 'tsv'
        ? `This is a ${ext.toUpperCase()} file — please drop it on the "Upload wage history CSV" card below, not the PDF card.`
        : ext === 'xlsx' || ext === 'xls'
          ? `Excel files aren't supported. Please export to CSV and use the CSV uploader below.`
          : `This isn't a PDF (got "${ext ?? file.type ?? 'unknown'}"). Drop a payroll-report PDF here, or use the CSV uploader below for wage history only.`;
    return {
      ok: false,
      sizeBytes: file.size,
      error: { code: 'wrong_file_type', message: friendly },
    };
  }

  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      sizeBytes: file.size,
      error: {
        code: 'too_large',
        message: `This PDF is ${(file.size / 1_048_576).toFixed(1)} MB. The calculator accepts PDFs up to 50 MB. Please slice the file or switch to CSV.`,
      },
    };
  }

  // pdfjs-dist is browser-only. Dynamic import keeps server bundle clean.
  const pdfjs = await import('pdfjs-dist');
  // The worker is copied to public/ by scripts/copy-pdfjs-worker.cjs (postinstall).
  // pdfjs-dist v5 doesn't support disableWorker in the bundled build — same-origin
  // worker is the portable answer (and dodges the `?url` import pattern that
  // Turbopack doesn't yet resolve).
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  let pages: number;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({
      data: arrayBuffer,
      verbosity: 0,
    } as Parameters<typeof pdfjs.getDocument>[0]).promise;
    pages = doc.numPages;
    await doc.destroy();
  } catch (err) {
    return {
      ok: false,
      sizeBytes: file.size,
      error: {
        code: 'unreadable',
        message: `Couldn't read the PDF (${err instanceof Error ? err.message : 'unknown error'}). Try a different file or switch to CSV.`,
      },
    };
  }

  if (pages > MAX_PAGES) {
    return {
      ok: false,
      pages,
      sizeBytes: file.size,
      error: {
        code: 'too_many_pages',
        message: `This PDF has ${pages} pages. The calculator accepts PDFs up to ${MAX_PAGES} pages. Please split the file or export to CSV.`,
      },
    };
  }

  return { ok: true, pages, sizeBytes: file.size };
}
