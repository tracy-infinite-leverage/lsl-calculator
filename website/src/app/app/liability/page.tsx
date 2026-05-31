/**
 * `/app/liability` — placeholder route page.
 *
 * E6.3 Task 3.7. See `/app/employees/page.tsx` for the page-shape rationale.
 */

import type { Metadata } from 'next';
import { LiabilityEmptyState } from '@/components/empty-states/LiabilityEmptyState';

export const metadata: Metadata = {
  title: 'Liability | APA LSL Platform',
  description: 'Long service leave liability summary.',
  robots: { index: false, follow: false },
};

export default function LiabilityPage() {
  return <LiabilityEmptyState />;
}
