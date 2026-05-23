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
  title: 'NSW LSL Calculator',
  description:
    'Compute long-service-leave entitlement for NSW employees with every output citation-backed to the NSW Long Service Leave Act 1955.',
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
