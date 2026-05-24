import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'LSL Calculator',
  description:
    'Defensible long-service-leave calculator for Australian payroll. NSW and VIC available — QLD, WA, SA, ACT, TAS, NT coming soon. Every output is citation-backed to the source statute.',
  openGraph: {
    title: 'LSL Calculator',
    description:
      'Defensible long-service-leave calculator for Australian payroll. NSW and VIC available — QLD, WA, SA, ACT, TAS, NT coming soon.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
