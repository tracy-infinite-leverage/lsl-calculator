import { Metadata } from 'next';
import { BulkModeForm } from './_components/bulk-mode-form';

export const metadata: Metadata = {
  title: 'Bulk LSL calculator | NSW',
  description:
    'Upload a CSV (or PDF) and run NSW Long Service Leave calculations across many employees at once.',
};

export default function BulkCalculatorPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12 space-y-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wider text-muted-foreground">
          Bulk mode · NSW
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Calculate LSL for many employees
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Upload a payroll CSV and the calculator will compute Long Service Leave entitlements for
          every employee in one pass. Nothing is sent to a server — calculations run locally in
          your browser.
        </p>
      </header>

      <BulkModeForm />
    </main>
  );
}
