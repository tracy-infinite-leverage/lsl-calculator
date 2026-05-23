'use client';

import * as React from 'react';
import { scrubPII } from '@/lib/observability/scrub-pii';

/**
 * Last-resort error boundary that catches errors in the root layout itself.
 * Next.js mounts this without the normal layout chain — it must render a
 * complete HTML document.
 *
 * No app/lib imports beyond the scrubber — if the root layout is the source
 * of the crash, depending on its components here would recurse.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  React.useEffect(() => {
    const payload = {
      route_segment: '(global)',
      digest: error.digest,
      error: scrubPII(error),
    };
    // eslint-disable-next-line no-console
    console.error('[global-error]', JSON.stringify(payload));
  }, [error]);

  return (
    <html lang="en-AU">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '40rem', margin: '2rem auto' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went very wrong</h1>
        <p style={{ marginBottom: '1rem', color: '#444' }}>
          The page failed to render. The error has been logged — please reload, or contact support
          if the issue persists.
        </p>
        {error.digest && (
          <p style={{ fontSize: '0.75rem', fontFamily: 'ui-monospace, monospace', opacity: 0.7 }}>
            Error reference: <span style={{ userSelect: 'all' }}>{error.digest}</span>
          </p>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            border: 'none',
            background: '#0b3d91',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
