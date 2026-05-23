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

  test('privacy notice passes axe', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('body')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('bulk-mode preview state passes axe (sample CSV loaded)', async ({ page }) => {
    // The Load-sample button calls /api/normalize-csv (Claude). Mock it with
    // a trivial canonical-mapping spec so the test stays hermetic + free.
    await page.route('**/api/normalize-csv', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          spec: {
            mode: 'multi_employee',
            date_format: 'iso',
            columns: [
              { canonical: 'employee_id', source_header: 'employee_id', source_index: 0 },
              { canonical: 'legal_name', source_header: 'legal_name', source_index: 1 },
              { canonical: 'start_date', source_header: 'start_date', source_index: 2 },
              { canonical: 'employment_type', source_header: 'employment_type', source_index: 3 },
              { canonical: 'states', source_header: 'states', source_index: 4 },
              { canonical: 'current_weekly_gross', source_header: 'current_weekly_gross', source_index: 5 },
              { canonical: 'period_start', source_header: 'period_start', source_index: 6 },
              { canonical: 'period_end', source_header: 'period_end', source_index: 7 },
              { canonical: 'gross_pay', source_header: 'gross_pay', source_index: 8 },
            ],
            missing_identity_fields: [],
            notes: null,
            confidence: 0.99,
          },
          usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
          cacheHit: false,
        }),
      });
    });

    await page.goto('/calculator/bulk');
    await page.getByRole('button', { name: /Load sample CSV/i }).click();
    // Wait for the preview card to render
    await expect(page.getByText(/Review extracted employees/i)).toBeVisible({ timeout: 10_000 });
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});
