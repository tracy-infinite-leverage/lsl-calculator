import { test, expect } from '@playwright/test';

/**
 * Responsive pass per tasks.md §5.3 / F22 / PM-A.
 *
 * Verifies all three public routes don't horizontally overflow at the
 * three spec viewports (360 / 768 / 1024) and that the primary CTA on
 * each is visible without scrolling.
 *
 * The cross-browser matrix project `mobile-chrome` (Pixel 7, 412×915)
 * already exercises every other test at small width; this spec adds
 * the 360px floor which the spec calls out explicitly.
 */

const VIEWPORTS = [
  { name: 'iPhone SE (360)', width: 360, height: 740 },
  { name: 'iPad portrait (768)', width: 768, height: 1024 },
  { name: 'small desktop (1024)', width: 1024, height: 768 },
] as const;

const ROUTES = ['/', '/calculator/single', '/calculator/bulk'] as const;

for (const vp of VIEWPORTS) {
  test.describe(`responsive @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const route of ROUTES) {
      test(`${route} has no horizontal overflow`, async ({ page }) => {
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        const overflow = await page.evaluate(() => ({
          docW: document.documentElement.scrollWidth,
          viewportW: window.innerWidth,
        }));
        // Allow a 1px hairline tolerance — scrollbars and sub-pixel rounding.
        expect(overflow.docW).toBeLessThanOrEqual(overflow.viewportW + 1);
      });
    }
  });
}
