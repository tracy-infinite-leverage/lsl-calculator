/**
 * `/app/pay-codes` — placeholder route page.
 *
 * E6.3 Task 3.7. See `/app/employees/page.tsx` for the page-shape rationale.
 *
 * Sidebar visibility note: this route is gated by the
 * `NEXT_PUBLIC_FEATURE_PAY_CODES` flag in `sidebar-routes.ts`. The page
 * itself is reachable by direct URL regardless of the flag (the layout
 * doesn't 404 on hidden sidebar entries). Treating the flag as a sidebar-
 * only affordance is deliberate — power users can deep-link, but the
 * default discovery path stays hidden until the underlying feature ships.
 */

import type { Metadata } from 'next';
import { PayCodesEmptyState } from '@/components/empty-states/PayCodesEmptyState';

export const metadata: Metadata = {
  title: 'Pay codes | APA LSL Platform',
  description: 'Manage pay codes on the APA LSL Platform.',
  robots: { index: false, follow: false },
};

export default function PayCodesPage() {
  return <PayCodesEmptyState />;
}
