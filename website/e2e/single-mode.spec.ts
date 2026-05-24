import { test, expect, type Page } from '@playwright/test';

/**
 * Single-mode happy-path E2E — drives TC-NSW-024 from the gold-standard suite
 * end-to-end in a real browser and asserts the load-bearing $9,880.04 result.
 *
 * Per spec SC3 / AC25 / AC6.
 */
test.describe('Single-mode calculator', () => {
  test('TC-NSW-024 produces $9,880.04 end-to-end', async ({ page }) => {
    // Pre-seed form state via localStorage to avoid driving Radix Select primitives
    // (their controlled-input contract is brittle under Playwright).
    await page.addInitScript(() => {
      const state = {
        legalName: 'TC-NSW-024 Test',
        externalEmployeeId: 'TC-NSW-024',
        startDate: '2014-05-22',
        employmentType: 'full_time',
        categoryOverride: 'A',
        categoryOverrideConfirmed: true,
        statesOfService: ['NSW'],
        governingJurisdiction: '',
        currentWeeklyGross: '950',
        priorLeaveTakenWeeks: '',
        wageHistory: [
          { id: 'a', periodStart: '2025-05-22', periodEnd: '2026-05-21', grossPay: '49400', frequency: 'weekly', periodDays: '', note: 'Yr 12 FT' },
          { id: 'b', periodStart: '2024-05-22', periodEnd: '2025-05-21', grossPay: '49400', frequency: 'weekly', periodDays: '', note: 'Yr 11 FT' },
          { id: 'c', periodStart: '2023-05-22', periodEnd: '2024-05-21', grossPay: '30000', frequency: 'other', periodDays: '366', note: 'Yr 10' },
          { id: 'd', periodStart: '2022-05-22', periodEnd: '2023-05-21', grossPay: '40000', frequency: 'other', periodDays: '365', note: 'Yr 9' },
          { id: 'e', periodStart: '2021-05-22', periodEnd: '2022-05-21', grossPay: '32000', frequency: 'other', periodDays: '365', note: 'Yr 8' },
        ],
        serviceEvents: [],
        triggerKind: 'termination',
        leaveStartDate: '',
        terminationDate: '2026-05-21',
        terminationReason: 'voluntary_resignation',
        asAtDate: '',
      };
      localStorage.setItem(
        'lsl-calculator:single-mode:v1',
        JSON.stringify({ savedAt: Date.now(), state })
      );
    });

    await page.goto('/calculator/single');

    // Form should hydrate with the seeded state
    await expect(page.locator('#legalName')).toHaveValue('TC-NSW-024 Test');
    await expect(page.locator('#currentWeeklyGross')).toHaveValue('950');

    // Click Calculate
    await page.getByRole('button', { name: /Calculate LSL/i }).click();

    // Result panel renders the load-bearing figures
    await expect(page.locator('text=$9880.04')).toBeVisible();
    await expect(page.locator('text=$950.00').first()).toBeVisible();
    await expect(page.locator('text=10.4000 weeks').first()).toBeVisible();
    await expect(page.locator('text=Category')).toBeVisible();

    // Citation block visible
    await expect(page.locator('text=NSW LSA s.4(5)(b)').first()).toBeVisible();
    await expect(page.locator('text=NSW LSA s.4(2)(iii)').first()).toBeVisible();
  });

  test('Landing page links to single-mode', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Australian LSL calculator/i })).toBeVisible();
    await page.getByRole('link', { name: /Calculate for one employee/i }).click();
    await expect(page).toHaveURL(/\/calculator\/single/);
  });

  test('PDF export endpoint returns a valid PDF', async ({ request }) => {
    const res = await request.post('/api/export-pdf', {
      data: {
        legalName: 'TC-NSW-024',
        externalEmployeeId: 'T1',
        startDate: '2014-05-22',
        trigger: {
          kind: 'termination',
          terminationDate: '2026-05-21',
          reason: 'voluntary_resignation',
        },
        category: 'A',
        outputs: {
          valueOfWeek: '950.00',
          valueOfDay: '190.00',
          totalEntitlementWeeks: '10.4000',
          totalEntitlementDollars: '9880.04',
        },
        warnings: [],
        diagnostics: null,
        citations: { valueOfWeek: [], valueOfDay: [], weeks: [], dollars: [] },
      },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');
    const body = await res.body();
    expect(body.byteLength).toBeGreaterThan(1000); // PDF should be non-trivial size
    expect(body.subarray(0, 5).toString('ascii')).toBe('%PDF-'); // PDF magic bytes
  });
});

/** Helper retained for future use when driving Radix Select. */
export async function pickRadixSelect(page: Page, triggerSelector: string, optionLabel: string) {
  await page.locator(triggerSelector).click();
  await page.getByRole('option', { name: optionLabel }).click();
}
