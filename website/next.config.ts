import type { NextConfig } from 'next';

/**
 * Content-Security-Policy (Report-Only) — E6.2 Task 2.10b.
 *
 * We emit a strict policy in **report-only** mode so the header is observable
 * (per the smoke test in `scripts/csp-smoke.mjs`) without breaking the app.
 *
 * Why report-only, not enforcing: Next.js's static prerender inlines a
 * hydration `<script>` block. An enforcing CSP without `'unsafe-inline'` in
 * `script-src` would break the app, and one with `'unsafe-inline'` would
 * weaken the guarantee that the smoke test exists to enforce. The full
 * nonce-based enforcing CSP is a larger task (touches every server layout
 * and the proxy) deferred to a future security-hardening epic. See
 * `docs/qa/e6-csp-audit.md` "CSP header smoke test" section.
 *
 * Directive design — every directive present here is what an enforcing CSP
 * would also use. No `'unsafe-inline'`, no `'unsafe-eval'`, no wildcard
 * third-party origins. The Vercel-analytics endpoints listed under
 * `connect-src` are first-party per the LSL Platform spec §5.7 / audit doc.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://vitals.vercel-insights.com https://*.vercel-analytics.com https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  // @react-pdf/renderer ships pure JS + JSX; no native binary or font asset issues.
  // Silence the lockfile-inference warning by pinning Turbopack's root to /website.
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        // Apply to every route. The proxy at `src/proxy.ts` is matcher-scoped
        // to `/app/*` and does not set response headers on its own pass-through,
        // so this `headers()` config is the single source of truth for the
        // CSP-Report-Only header across the entire app surface.
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy-Report-Only',
            value: CSP_REPORT_ONLY,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
