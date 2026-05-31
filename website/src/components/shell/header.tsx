import Link from 'next/link';
import { Wordmark } from '@/components/brand/Wordmark';

/**
 * Public-calculator shell header.
 *
 * E6.4 Task 4.5 (spec §5.3, §8.4):
 *   "Sub-brand wordmark in page header."
 *
 * The brand link uses the approved Candidate B `Wordmark` (Task 1.4 sign-off,
 * 2026-05-28) at a top-nav-friendly 160 CSS px width — same scale Lockup uses
 * for `wordmarkWidth=160` in horizontal mode, so the header reads as a sibling
 * of the footer lockup without visual jump.
 *
 * The `Wordmark` is rendered with `decorative` so screen readers don't
 * announce the wordmark image AND the redundant `sr-only` text. The
 * `<span className="sr-only">` ("LSL Calculator") preserves the visible-text
 * contract the Playwright matrix asserts:
 *
 *   `page.locator('header a').first().toContainText('LSL Calculator')`
 *
 * — see `website/e2e/vic-mode.spec.ts`. `toContainText` reads `textContent`,
 * which includes `sr-only` text even though it is visually hidden via the
 * `.sr-only` Tailwind class.
 */
export function Header() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
        <Link
          href="/"
          aria-label="LSL Calculator — home"
          className="flex items-center font-semibold text-foreground"
        >
          <Wordmark width={160} decorative />
          <span className="sr-only">LSL Calculator</span>
        </Link>
        <nav className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/calculator/single" className="hover:text-foreground transition-colors">
            Single
          </Link>
          <Link href="/calculator/bulk" className="hover:text-foreground transition-colors">
            Bulk
          </Link>
        </nav>
      </div>
    </header>
  );
}
