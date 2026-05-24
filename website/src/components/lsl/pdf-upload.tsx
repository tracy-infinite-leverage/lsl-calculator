'use client';

import * as React from 'react';
import { FileUp, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EditablePreviewTable } from './editable-preview-table';
import { inspectPDF } from '@/lib/lsl/parsers/pdf/client';
import type {
  ExtractedEmployee,
  ExtractionResponse,
} from '@/lib/lsl/parsers/pdf/schema';
import type { PerFieldFlags } from '@/lib/lsl/parsers/pdf/confidence';

export interface PdfUploadProps {
  onConfirmed: (employees: ExtractedEmployee[]) => void;
  /** Called when the user wants to upload a CSV instead (AC26 fallback). */
  onSwitchToCSV?: () => void;
}

type State =
  | { kind: 'idle' }
  | { kind: 'inspecting' }
  | { kind: 'inspect_error'; message: string }
  | { kind: 'uploading' }
  | { kind: 'upload_error'; message: string; canFallback: boolean }
  | {
      kind: 'preview';
      data: ExtractionResponse;
      flags: PerFieldFlags[];
      worstAggregate: number;
      lowOverallConfidence: boolean;
    };

export function PdfUpload({ onConfirmed, onSwitchToCSV }: PdfUploadProps) {
  const [state, setState] = React.useState<State>({ kind: 'idle' });
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    setState({ kind: 'inspecting' });

    const inspection = await inspectPDF(file);
    if (!inspection.ok) {
      setState({ kind: 'inspect_error', message: inspection.error?.message ?? 'Invalid PDF' });
      return;
    }

    setState({ kind: 'uploading' });
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('mode', 'single');
      const res = await fetch('/api/extract-pdf', { method: 'POST', body });
      if (!res.ok) {
        const json: { error?: string; userMessage?: string } = await res.json().catch(() => ({}));
        const canFallback = res.status !== 400; // 400 = bad form, can't fall back
        setState({
          kind: 'upload_error',
          message: json.userMessage ?? `Extraction failed (HTTP ${res.status}).`,
          canFallback,
        });
        return;
      }
      const body2: {
        ok: true;
        data: ExtractionResponse;
        flags: PerFieldFlags[];
        worstAggregate: number;
        lowOverallConfidence: boolean;
      } = await res.json();
      setState({
        kind: 'preview',
        data: body2.data,
        flags: body2.flags,
        worstAggregate: body2.worstAggregate,
        lowOverallConfidence: body2.lowOverallConfidence,
      });
    } catch (err) {
      setState({
        kind: 'upload_error',
        message:
          err instanceof Error
            ? err.message
            : 'PDF extraction is temporarily unavailable. Please upload your wage history as CSV instead.',
        canFallback: true,
      });
    }
  }

  function handleConfirm(employees: ExtractedEmployee[]) {
    setState({ kind: 'idle' });
    if (fileRef.current) fileRef.current.value = '';
    onConfirmed(employees);
  }

  function handleCancel() {
    setState({ kind: 'idle' });
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleFallback() {
    setState({ kind: 'idle' });
    if (fileRef.current) fileRef.current.value = '';
    onSwitchToCSV?.();
  }

  const busy = state.kind === 'inspecting' || state.kind === 'uploading';

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileUp className="h-4 w-4 text-primary" />
            Upload a payroll PDF (optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload any vendor&apos;s payroll-report PDF (Xero, MYOB, KeyPay, ADP, custom exports).
            We&apos;ll extract the employee details and wage history with an LLM and let you review
            every field before the calculation runs.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="pdf-upload">PDF file (max 50 pages / 50 MB)</Label>
            <Input
              id="pdf-upload"
              ref={fileRef}
              type="file"
              accept="application/pdf"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Nothing is stored server-side. The PDF is sent to Anthropic Claude (no-retention
              enterprise tier) for extraction and the response stays in your browser.
            </p>
          </div>

          {state.kind === 'inspecting' && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading PDF…
            </p>
          )}
          {state.kind === 'uploading' && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Extracting employee data with Claude…
            </p>
          )}

          {state.kind === 'inspect_error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Couldn&apos;t read this PDF</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          {state.kind === 'upload_error' && (
            <Alert variant="warning">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Extraction failed</AlertTitle>
              <AlertDescription>
                <p>{state.message}</p>
                {state.canFallback && onSwitchToCSV && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={handleFallback}
                    type="button"
                  >
                    Upload as CSV instead
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={state.kind === 'preview'}
        onOpenChange={(o: boolean) => {
          if (!o) handleCancel();
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirm extracted data</DialogTitle>
            <DialogDescription>
              Review and edit any field before it&apos;s used in the calculation.
            </DialogDescription>
          </DialogHeader>
          {state.kind === 'preview' && (
            <EditablePreviewTable
              employees={state.data.employees}
              flags={state.flags}
              extractionNotes={state.data.extraction_notes ?? undefined}
              worstAggregate={state.worstAggregate}
              lowOverallConfidence={state.lowOverallConfidence}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
