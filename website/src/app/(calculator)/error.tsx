'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { scrubPII } from '@/lib/observability/scrub-pii';

/**
 * Calculator-route error boundary per tasks.md §5.5.
 *
 * Catches any uncaught throw inside the (calculator) segment. Logs a
 * PII-scrubbed payload to console.error — Vercel runtime logs pick that up,
 * which is our error monitoring path (no Sentry per owner decision 2026-05-23).
 *
 * The Reset button re-renders the segment. The Go Home button is the escape
 * hatch when reset doesn't help (e.g. stale localStorage from a prior schema).
 */
export default function CalculatorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Vercel runtime logs ingest console.error. Scrub before send.
    const payload = {
      route_segment: '(calculator)',
      digest: error.digest,
      error: scrubPII(error),
    };
    // eslint-disable-next-line no-console
    console.error('[calculator-error]', JSON.stringify(payload));
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 space-y-6">
      <Alert variant="destructive">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle>Something went wrong with the calculator</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            We&apos;ve logged the error (with all wage figures and names scrubbed) so it can be
            diagnosed. Try resetting the page first — your last bulk-mode run is preserved in
            local storage. If the error persists, click Go home and re-upload.
          </p>
          {error.digest && (
            <p className="text-xs font-mono opacity-70">
              Error reference: <span className="select-all">{error.digest}</span>
            </p>
          )}
        </AlertDescription>
      </Alert>
      <div className="flex gap-2">
        <Button type="button" onClick={() => reset()}>
          Reset
        </Button>
        <Button type="button" variant="outline" onClick={() => (window.location.href = '/')}>
          Go home
        </Button>
      </div>
    </div>
  );
}
