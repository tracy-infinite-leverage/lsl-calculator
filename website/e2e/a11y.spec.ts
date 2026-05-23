import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * WCAG 2.2 AA audit per tasks.md §5.1 / A1 / SC5.
 *
 * Runs axe-core against every public route. Any violation fails CI so we don't
 * regress accessibility silently.
 *
 * Scope: tags ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] — the
 * spec target. We DON'T enable best-practice or experimental rules; they
 * surface noise that's not strictly WCAG-required.
 *
 * Known acceptable exceptions are added per-test via .disableRules() with a
 * comment explaining why (e.g. interactive components where Radix manages
 * focus correctly but axe's heuristics flag false positives).
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.describe('WCAG 2.2 AA — axe-core', () => {
  test('landing page passes axe', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('single-mode calculator passes axe', async ({ page }) => {
    await page.goto('/calculator/single');
    await expect(page.locator('body')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('bulk-mode calculator passes axe', async ({ page }) => {
    await page.goto('/calculator/bulk');
    await expect(page.locator('body')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('bulk-mode preview state passes axe (sample CSV loaded)', async ({ page }) => {
    await page.goto('/calculator/bulk');
    await page.getByRole('button', { name: /Load sample CSV/i }).click();
    // Wait for the preview card to render
    await expect(page.getByText(/Review extracted employees/i)).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});
