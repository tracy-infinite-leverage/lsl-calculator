/**
 * `/app/valuations` — placeholder route page.
 *
 * E6.3 Task 3.7. See `/app/employees/page.tsx` for the page-shape rationale.
 */

import type { Metadata } from 'next';
import { ValuationsEmptyState } from '@/components/empty-states/ValuationsEmptyState';

export const metadata: Metadata = {
  title: 'Valuations | APA LSL Platform',
  description: 'Run and review long service leave valuations.',
  robots: { index: false, follow: false },
};

export default function ValuationsPage() {
  return <ValuationsEmptyState />;
}
