/**
 * `/app/employees` — placeholder route page.
 *
 * E6.3 Task 3.7. The Employees feature itself lands later in the E5
 * series; this page exists so the sidebar entry (Task 3.2) and the
 * workspace shell layout (Task 3.1 + extended in PR #100) have a real
 * destination, and so the spec-mandated empty state (AC §8.3) has a
 * mount point.
 *
 * Render contract:
 *   - The `/app/*` layout (`src/app/app/layout.tsx`) wraps this page in
 *     the TopNav + Sidebar shell automatically.
 *   - This page renders ONLY the empty state for v1. When the Employees
 *     data feature ships in E5, the empty state stays as the conditional
 *     branch (`if (employees.length === 0)`) and the populated table
 *     replaces the empty branch.
 *
 * Why a separate page file per surface (vs. a single `/app/[slug]/page.tsx`
 * dynamic route):
 *
 *   1. Each surface will eventually own a non-trivial render path
 *      (employee table, pay-code editor, valuations history, …). A
 *      single dynamic route would have to fan out at the top with a
 *      switch — strictly worse than six focused files.
 *
 *   2. Type safety. Per-surface pages can declare typed `params` /
 *      `searchParams` shapes specific to their feature without
 *      contorting a union type.
 *
 *   3. CODEOWNERS / lint scoping. Future E5 features can scope their
 *      ownership to the per-surface folder.
 */

import type { Metadata } from 'next';
import { EmployeesEmptyState } from '@/components/empty-states/EmployeesEmptyState';

export const metadata: Metadata = {
  title: 'Employees | APA LSL Platform',
  description: 'Manage employees on the APA LSL Platform.',
  // Private workspace — no SEO indexing.
  robots: { index: false, follow: false },
};

export default function EmployeesPage() {
  return <EmployeesEmptyState />;
}
