import { test, expect } from '@playwright/test';

/**
 * Bulk-mode identity dialog — regression coverage for PR11-P1-01.
 *
 * The identity dialog opens when /api/normalize-csv reports the uploaded CSV
 * is wage-history-only (single_employee mode). Inside, the "State of service"
 * dropdown previously labelled every non-NSW option as
 * "(E2 — not yet computable)" — a leak that contradicted the rest of the UI
 * once VIC shipped.
 *
 * This test mocks /api/normalize-csv (Anthropic call) so it can drive the
 * dialog deterministically without needing an API key. The mock returns a
 * minimal single_employee spec — just enough to push the form into the
 * `needs_identity` stage.
 *
 * Load-bearing assertions:
 *   1. VIC option exists with the plain label "VIC" — no "(E2 …)" suffix,
 *      no "(coming soon)" suffix.
 *   2. NSW is similarly clean.
 *   3. At least one unshipped state still carries "(coming soon)" — proves
 *      we didn't accidentally strip the suffix from every option.
 *
 * Lives alongside vic-mode.spec.ts (calculator engine routing) and
 * single-mode.spec.ts (NSW happy-path).
 */
test.describe('Bulk-mode identity dialog state dropdown', () => {
  test('VIC option renders without "(E2 — not yet computable)" suffix', async ({ page }) => {
    // Mock /api/normalize-csv so we don't depend on Anthropic in CI.
    // single_employee + missing_identity_fields triggers the dialog.
    await page.route('**/api/normalize-csv', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          spec: {
            mode: 'single_employee',
            date_format: 'iso',
            columns: [
              { canonical: 'period_start', source_header: 'period_start', source_index: 0, transform: 'none' },
              { canonical: 'period_end', source_header: 'period_end', source_index: 1, transform: 'none' },
              { canonical: 'gross_pay', source_header: 'gross_pay', source_index: 2, transform: 'none' },
            ],
            missing_identity_fields: [
              'employee_id',
              'start_date',
              'employment_type',
              'states',
            ],
            notes: 'Looks like one employee — please fill these in.',
            confidence: 0.85,
          },
        }),
      });
    });

    await page.goto('/calculator/bulk');

    // Paste a wage-history-only CSV via the "Paste CSV" tab (no file I/O).
    await page.getByRole('tab', { name: /Paste CSV/i }).click();
    await page.locator('#bulk-paste').fill(
      'period_start,period_end,gross_pay\n2025-05-22,2026-05-21,78000.00\n'
    );
    await page.getByRole('button', { name: /^Parse CSV$/ }).click();

    // Dialog should open (single_employee mode).
    await expect(page.getByRole('heading', { name: /Single-employee details/i })).toBeVisible();

    // The "State of service" select trigger lives next to the label "State of service".
    // Open it to render the option list.
    await page.locator('#id-state').click();

    // Radix Select renders options into a portal — scope by role.
    const listbox = page.getByRole('listbox');

    // PR11-P1-01 regression: VIC must NOT carry the old "(E2 — not yet computable)" suffix.
    // It also must not be labelled "(coming soon)" — VIC has shipped.
    const vicOption = listbox.getByRole('option', { name: /^VIC$/ });
    await expect(vicOption).toBeVisible();
    await expect(listbox.getByText(/E2 — not yet computable/)).toHaveCount(0);
    await expect(listbox.getByRole('option', { name: /^VIC \(coming soon\)$/ })).toHaveCount(0);

    // NSW is also clean.
    await expect(listbox.getByRole('option', { name: /^NSW$/ })).toBeVisible();

    // QLD has shipped in Phase 4 — must NOT carry "(coming soon)".
    await expect(listbox.getByRole('option', { name: /^QLD$/ })).toBeVisible();
    await expect(listbox.getByRole('option', { name: /^QLD \(coming soon\)$/ })).toHaveCount(0);

    // At least one unshipped state still carries "(coming soon)" — proves we
    // didn't over-strip. WA is the next-to-ship and a safe canary.
    await expect(listbox.getByRole('option', { name: /^WA \(coming soon\)$/ })).toBeVisible();
  });
});
