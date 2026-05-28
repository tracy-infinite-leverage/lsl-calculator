import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { ENCODED_STATES } from '@/lib/lsl/dispatch';
import './globals.css';

// Self-hosted brand fonts (E6.2 Task 2.2 — resolves OQ-3).
//
// Montserrat (Light / Regular / Semibold) for titles + H1.
// Source Sans 3 (Light / Regular / Semibold) for body, H2, H3, captions.
//
// woff2 files are vendored from @fontsource/montserrat + @fontsource/source-sans-3
// (SIL OFL 1.1) into `public/fonts/` so production serves them directly from our
// Vercel domain — zero third-party font CDN requests per spec §5.7.
//
// `font-display: swap` keeps FCP unblocked while custom faces load. Next.js's
// `next/font/local` automatically generates a size-adjusted fallback metric so
// the swap does not cause layout-shift (CLS stays at 0.0 per the baseline in
// `docs/qa/e6-baseline-metrics.md`).
//
// Note: spec §5.1 names "Source Sans Pro" — Adobe renamed the family to
// "Source Sans 3" in 2021. The visible name is unchanged; the npm package is
// `@fontsource/source-sans-3`. CSS variable `--font-source-sans` keeps the
// spec-aligned semantic name in token consumers.
const montserrat = localFont({
  variable: '--font-montserrat',
  display: 'swap',
  src: [
    {
      path: '../../public/fonts/montserrat-light.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../../public/fonts/montserrat-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/montserrat-semibold.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
});

const sourceSans = localFont({
  variable: '--font-source-sans',
  display: 'swap',
  src: [
    {
      path: '../../public/fonts/source-sans-3-light.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../../public/fonts/source-sans-3-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/source-sans-3-semibold.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
});

// Build the state list once at module load — sourced from `dispatch.ts` so the
// list cannot drift from the engine registry. As of E2 Phase 9 all 8
// states/territories are encoded, so there is no "coming soon" suffix.
const STATE_LIST = ENCODED_STATES.join(', ');

export const metadata: Metadata = {
  title: 'LSL Calculator',
  description: `Defensible long-service-leave calculator for Australian payroll. ${STATE_LIST} — full Australian LSL coverage. Every output is citation-backed to the source statute.`,
  openGraph: {
    title: 'LSL Calculator',
    description: `Defensible long-service-leave calculator for Australian payroll. ${STATE_LIST} — full Australian LSL coverage.`,
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        {/*
         * Vercel Analytics + Speed Insights per tasks.md §5.4 (D14 substitution).
         * Free with Vercel hosting; no external vendor / API key needed.
         * Analytics → page views + custom events (track() calls below).
         * SpeedInsights → Core Web Vitals (LCP / INP / CLS).
         * Both are no-ops on non-Vercel deploys (e.g. local dev).
         */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
