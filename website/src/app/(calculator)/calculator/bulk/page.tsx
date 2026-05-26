import { Metadata } from 'next';
import { ENCODED_STATES } from '@/lib/lsl/dispatch';
import { BulkModeForm } from './_components/bulk-mode-form';

export const metadata: Metadata = {
  title: 'Bulk LSL calculator',
  description: `Upload a CSV (or PDF) and run Long Service Leave calculations across many employees at once. ${ENCODED_STATES.join(', ')} supported.`,
};

export default function BulkCalculatorPage() {
  // No nested <main> — the (calculator) layout already provides one. WCAG
  // SC 1.3.1 / axe `landmark-no-duplicate-main` requires exactly one main.
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12 space-y-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wider text-muted-foreground">
          Bulk mode
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Calculate LSL for many employees
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Upload a payroll CSV and the calculator will compute Long Service Leave entitlements for
          every employee in one pass. Each row carries its own governing jurisdiction —{' '}
          {ENCODED_STATES.join(', ')} supported today.
        </p>
      </header>

      <BulkModeForm />
    </div>
  );
}
