import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';

// Playwright runs with testDir=./e2e and CWD=website/ — resolve from project root.
const FIXTURE_PDF = path.resolve('e2e/fixtures/sample-payroll.pdf');

/**
 * Phase 3 PDF extraction E2E.
 *
 * We mock `/api/extract-pdf` at the network layer rather than calling the real
 * Anthropic API in CI. The route under test is the calling client — the route
 * itself has unit-test coverage via its Zod schema + confidence gate.
 */

const HAPPY_RESPONSE = {
  ok: true,
  data: {
    employees: [
      {
        external_employee_id: 'E-PDF-001',
        legal_name: 'Pdf Extracted Employee',
        start_date: '2018-03-15',
        end_date: null,
        employment_type: 'full_time',
        states_of_service: ['NSW'],
        current_weekly_gross: '1500.00',
        wage_history: [
          {
            period_start: '2025-05-22',
            period_end: '2026-05-21',
            gross_pay: '78000.00',
            frequency: 'weekly',
            period_days: null,
          },
        ],
        service_events: [],
        confidence: {
          identity: 0.95,
          employment: 0.95,
          wage_history: 0.93,
          aggregate: 0.93,
        },
      },
    ],
    extraction_notes: null,
  },
  flags: [{ employeeIndex: 0, identity: false, employment: false, wageHistory: false }],
  usage: { inputTokens: 1234, outputTokens: 567, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
  cacheHit: false,
};

const LOW_CONFIDENCE_RESPONSE = {
  error: 'low_confidence',
  userMessage:
    "We couldn't read this PDF with enough confidence to populate the form automatically. Please upload your wage history as CSV instead — your other inputs are preserved.",
  aggregate: 0.62,
};

test.describe('PDF extraction', () => {
  test('happy path: extract → preview → confirm populates form', async ({ page }) => {
    await page.route('**/api/extract-pdf', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(HAPPY_RESPONSE),
      });
    });

    await page.goto('/calculator/single');

    // Confirm the fixture PDF exists; if not, fail fast with a clear message.
    expect(fs.existsSync(FIXTURE_PDF), `Fixture missing: ${FIXTURE_PDF}`).toBe(true);

    await page.setInputFiles('#pdf-upload', FIXTURE_PDF);

    // Preview dialog opens with the extracted data
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Confirm extracted data')).toBeVisible();
    await expect(page.locator('input[value="Pdf Extracted Employee"]')).toBeVisible();
    await expect(page.locator('input[value="2018-03-15"]')).toBeVisible();
    await expect(page.locator('input[value="1500.00"]')).toBeVisible();

    // Confirm — dialog closes, form fields populate
    await page.getByRole('button', { name: /Confirm and use this data/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('#legalName')).toHaveValue('Pdf Extracted Employee');
    await expect(page.locator('#startDate')).toHaveValue('2018-03-15');
    await expect(page.locator('#currentWeeklyGross')).toHaveValue('1500.00');
  });

  test('AC26: low-confidence extraction surfaces fallback CTA', async ({ page }) => {
    await page.route('**/api/extract-pdf', async (route) => {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify(LOW_CONFIDENCE_RESPONSE),
      });
    });

    await page.goto('/calculator/single');
    const t0 = Date.now();
    await page.setInputFiles('#pdf-upload', FIXTURE_PDF);

    // Error alert should appear quickly (AC26 says ≤10s — we're well under here)
    await expect(page.getByText("couldn't read this PDF", { exact: false })).toBeVisible({
      timeout: 10_000,
    });
    expect(Date.now() - t0).toBeLessThan(15_000);

    // Fallback CTA visible
    await expect(page.getByRole('button', { name: /Upload as CSV instead/i })).toBeVisible();
  });

  test('AC26: 503 from extraction service surfaces fallback within 10s', async ({ page }) => {
    await page.route('**/api/extract-pdf', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'anthropic_not_configured',
          userMessage:
            'PDF extraction is not configured on this server. Please upload your wage history as CSV instead.',
        }),
      });
    });

    await page.goto('/calculator/single');
    const t0 = Date.now();
    await page.setInputFiles('#pdf-upload', FIXTURE_PDF);

    await expect(page.getByText('PDF extraction is not configured', { exact: false })).toBeVisible({
      timeout: 10_000,
    });
    expect(Date.now() - t0).toBeLessThan(15_000);
    await expect(page.getByRole('button', { name: /Upload as CSV instead/i })).toBeVisible();
  });
});
