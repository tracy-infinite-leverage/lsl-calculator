import Link from 'next/link';
import { Lockup } from '@/components/brand/Lockup';

/**
 * Public-calculator shell footer.
 *
 * E6.4 Task 4.5 (spec §5.3, §8.4):
 *   - "APA lockup visible in page footer on `/`"
 *   - "Footer disclosure line includes 'calculated, not advice'"
 *
 * Layout uses the canonical `Lockup` (wordmark + "by Australian Payroll
 * Association" tagline, stacked orientation) as the brand anchor on the
 * left, with a Privacy link and the "calculated, not advice" disclosure
 * on the right. Mobile collapses to a stacked column.
 *
 * The "calculated, not advice" wording is the same disclaimer the upcoming
 * E6.5 / E6.6 PDF methodology footer carries on every page (spec §5.4,
 * OQ-10 short version: "state-engine version + 'calculated, not advice' +
 * APA URL"). Keeping the wording byte-identical between the web footer
 * and the PDF footer gives the user a single voice across both surfaces.
 */
export function Footer() {
  return (
    <footer className="border-t bg-background mt-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
        <Lockup orientation="stacked" wordmarkWidth={160} className="self-start" />
        <div className="flex flex-col gap-3 sm:items-end">
          <nav aria-label="Footer" className="flex items-center gap-3">
            <Link
              href="/privacy"
              className="hover:text-foreground underline-offset-2 hover:underline"
            >
              Privacy
            </Link>
          </nav>
          <p className="sm:max-w-sm sm:text-right">
            Citations refer to the source long-service-leave statute for each governing
            jurisdiction. Calculated, not advice — verify on the source statute for edge cases.
          </p>
        </div>
      </div>
    </footer>
  );
}
