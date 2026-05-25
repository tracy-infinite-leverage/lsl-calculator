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

/**
 * DEV-CROSS-1 — conditional `terminationInitiator` radio group surfaces only
 * for termination reasons that need the disambiguation (v1: illness_incapacity).
 *
 * Split into two tests so the second case can start from a fresh page (no
 * post-Calculate results panel pushing the Select trigger below the fold,
 * which makes the Radix Select popper render options outside the viewport on
 * Firefox/Webkit/mobile and times out the option click).
 */
function seedSingleModeQldTerminationState(
  page: Page,
  overrides: { terminationReason: string; terminationInitiator: string }
) {
  return page.addInitScript((opts) => {
    const state = {
      legalName: 'DEV-CROSS-1 test',
      externalEmployeeId: 'DEV-CROSS-1',
      startDate: '2018-05-22',
      employmentType: 'full_time',
      categoryOverride: 'A',
      categoryOverrideConfirmed: true,
      statesOfService: ['QLD'],
      governingJurisdiction: 'QLD',
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
          note: '',
        },
      ],
      serviceEvents: [],
      triggerKind: 'termination',
      leaveStartDate: '',
      terminationDate: '2026-05-21',
      terminationReason: opts.terminationReason,
      terminationInitiator: opts.terminationInitiator,
      asAtDate: '',
    };
    localStorage.setItem(
      'lsl-calculator:single-mode:v1',
      JSON.stringify({ savedAt: Date.now(), state })
    );
  }, overrides);
}

test.describe('Single-mode — termination initiator (DEV-CROSS-1)', () => {
  test('terminationInitiator radio appears when switching to illness_incapacity, calc succeeds', async ({
    page,
  }) => {
    // Seed: termination + voluntary_resignation. Initiator radio MUST NOT show.
    await seedSingleModeQldTerminationState(page, {
      terminationReason: 'voluntary_resignation',
      terminationInitiator: '',
    });

    await page.goto('/calculator/single');

    await expect(page.locator('#terminationInitiator')).toHaveCount(0);

    // Switch to illness_incapacity via the Select trigger.
    await pickRadixSelect(page, '#terminationReason', 'Illness / incapacity');

    // Now the initiator radio group MUST appear.
    await expect(page.locator('#terminationInitiator')).toBeVisible();
    await expect(
      page.locator('#terminationInitiator-employee')
    ).toBeVisible();
    await expect(
      page.locator('#terminationInitiator-employer')
    ).toBeVisible();

    // Validation: submitting without picking an initiator surfaces an error.
    await page.getByRole('button', { name: /Calculate LSL/i }).click();
    await expect(
      page.locator('text=For illness / incapacity').first()
    ).toBeVisible();

    // Pick employer-initiated and verify calculation succeeds.
    await page.locator('#terminationInitiator-employer').click();
    await page.getByRole('button', { name: /Calculate LSL/i }).click();
    await expect(
      page.locator('text=/QLD IR Act 2016 s\\.95\\(3\\)\\(c\\)/').first()
    ).toBeVisible();
  });

  test('terminationInitiator radio hides when switching from illness_incapacity to redundancy', async ({
    page,
  }) => {
    // Seed already on illness_incapacity / employer with no result panel —
    // keeps the Select trigger near the top of the viewport so the Radix
    // popper can render its options in-view across all browsers.
    await seedSingleModeQldTerminationState(page, {
      terminationReason: 'illness_incapacity',
      terminationInitiator: 'employer',
    });

    await page.goto('/calculator/single');

    // Initiator radio group MUST be visible on illness_incapacity.
    await expect(page.locator('#terminationInitiator')).toBeVisible();

    // Switch to a reason that doesn't need the initiator — field hides.
    await pickRadixSelect(page, '#terminationReason', 'Redundancy');
    await expect(page.locator('#terminationInitiator')).toHaveCount(0);
  });
});
