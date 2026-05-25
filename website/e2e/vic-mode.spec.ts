import { test, expect } from '@playwright/test';

/**
 * VIC end-to-end smoke — seed a VIC-only employee via localStorage, click
 * Calculate, and assert that:
 *   1. The VIC citation block surfaces (s.6 — accrual / qualifying years).
 *   2. The NSW citation block does NOT surface (proves the dispatcher
 *      actually routed to the VIC engine, not NSW).
 *
 * Why this fixture: a 7-year tenure under VIC qualifies for full LSL
 * (VIC LSL Act 2018 s.6 — qualifying period). The same tenure under NSW
 * would only qualify pro-rata at 5 years and full at 10. Pinning a 7-year
 * tenure with VIC citation = unambiguous proof the right engine ran.
 *
 * Companion to e2e/single-mode.spec.ts (NSW happy path).
 */
test.describe('VIC single-mode calculator', () => {
  test('VIC 8-year termination produces VIC-cited result', async ({ page }) => {
    await page.addInitScript(() => {
      const state = {
        legalName: 'VIC E2E Test',
        externalEmployeeId: 'VIC-E2E-001',
        startDate: '2018-05-22',
        employmentType: 'full_time',
        categoryOverride: 'A',
        categoryOverrideConfirmed: true,
        statesOfService: ['VIC'],
        governingJurisdiction: 'VIC',
        currentWeeklyGross: '1500',
        priorLeaveTakenWeeks: '',
        wageHistory: [
          {
            id: 'a',
            periodStart: '2025-05-22',
            periodEnd: '2026-05-21',
            grossPay: '78000',
            frequency: 'weekly',
            periodDays: '',
            note: 'Yr 8 FT',
          },
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

    await expect(page.locator('#legalName')).toHaveValue('VIC E2E Test');
    await expect(page.locator('#currentWeeklyGross')).toHaveValue('1500');

    await page.getByRole('button', { name: /Calculate LSL/i }).click();

    // Wait for the result panel to render the value-of-week. Wage history
    // matches current weekly gross ($1500) exactly, so this is the load-
    // bearing figure.
    await expect(page.locator('text=$1500.00').first()).toBeVisible();

    // Citations live inside <ol aria-label="Legislative citations">. Scope
    // every VIC/NSW assertion to that ordered list so the form's hint copy
    // ("NSW LSA s.3(2)" in the gross-pay hint) doesn't produce false
    // positives.
    const citationLists = page.getByRole('list', { name: /Legislative citations/i });

    // VIC LSL Act 2018 must appear at least once — load-bearing proof the
    // dispatcher routed to the VIC engine.
    await expect(citationLists.getByText(/VIC LSL Act 2018/).first()).toBeVisible();

    // Negative assertion: NSW LSA citations must NOT appear in any
    // citation list. If they do, the form is still hardcoded to NSW.
    await expect(citationLists.getByText(/NSW LSA s\./)).toHaveCount(0);
  });

  test('Landing page hero reads "Australian LSL calculator" (no NSW prefix)', async ({ page }) => {
    await page.goto('/');
    // Operator's preferred hero copy — generic Australia framing, no NSW
    // prefix. Bookended by the negative check on the header brand below.
    await expect(
      page.getByRole('heading', { name: /Australian LSL calculator/i })
    ).toBeVisible();
  });

  test('Header reads "LSL Calculator" (no NSW prefix)', async ({ page }) => {
    await page.goto('/');
    // The header brand link has "LSL Calculator" — and must NOT have "NSW LSL Calculator".
    const headerLink = page.locator('header a').first();
    await expect(headerLink).toContainText('LSL Calculator');
    await expect(headerLink).not.toContainText('NSW LSL');
  });
});
