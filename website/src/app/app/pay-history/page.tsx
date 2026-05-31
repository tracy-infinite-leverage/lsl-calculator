/**
 * `/app/pay-history` — placeholder route page.
 *
 * E6.3 Task 3.7. See `/app/employees/page.tsx` for the page-shape rationale.
 */

import type { Metadata } from 'next';
import { PayHistoryEmptyState } from '@/components/empty-states/PayHistoryEmptyState';

export const metadata: Metadata = {
  title: 'Pay history | APA LSL Platform',
  description: 'View pay history on the APA LSL Platform.',
  robots: { index: false, follow: false },
};

export default function PayHistoryPage() {
  return <PayHistoryEmptyState />;
}
