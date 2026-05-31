/**
 * `/app/reconciliation` — placeholder route page.
 *
 * E6.3 Task 3.7. See `/app/employees/page.tsx` for the page-shape rationale.
 */

import type { Metadata } from 'next';
import { ReconciliationEmptyState } from '@/components/empty-states/ReconciliationEmptyState';

export const metadata: Metadata = {
  title: 'Reconciliation | APA LSL Platform',
  description: 'Reconcile calculated entitlements against paid amounts.',
  robots: { index: false, follow: false },
};

export default function ReconciliationPage() {
  return <ReconciliationEmptyState />;
}
