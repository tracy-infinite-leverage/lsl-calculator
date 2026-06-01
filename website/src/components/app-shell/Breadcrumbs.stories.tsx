/**
 * Breadcrumbs.stories.tsx — Storybook coverage for the `/app/*` breadcrumb
 * trail.
 *
 * E6.3 Task 3.6. Stories target `BreadcrumbsPresentation` — the pure-prop
 * sibling — because Storybook can't run `usePathname()` against a real
 * Next router (the `nextjs.navigation.pathname` parameter mocks it, but
 * passing a literal trail array makes the visual reference self-contained
 * and trivially scannable for the QA / designer review).
 *
 * Stories exercise:
 *   - The single terminal "Home" crumb on `/app`.
 *   - The standard two-crumb trail on `/app/employees`.
 *   - The deep-link three-crumb trail with a dynamic-segment fallback label.
 *   - The wrapping behaviour on a synthetic long-name trail (defensive —
 *     real labels are short, but a future client-name surfacing into a
 *     dynamic crumb could be long enough to wrap).
 *
 * axe flips to `'error'` per the design-system convention (`a11y: { test:
 * 'error' }`) — zero serious / critical violations per spec §8.2.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BreadcrumbsPresentation } from './Breadcrumbs';
import { buildTrail } from './breadcrumbs-routes';

const meta: Meta<typeof BreadcrumbsPresentation> = {
  title: 'AppShell/Breadcrumbs',
  component: BreadcrumbsPresentation,
  parameters: {
    a11y: { test: 'error' },
    layout: 'fullscreen',
    docs: {
      description: {
        component: [
          'Breadcrumb trail rendered on every `/app/*` page. Follows the W3C ARIA APG',
          'pattern: `<nav aria-label="Breadcrumb">` wraps an ordered list of crumbs.',
          'Non-terminal crumbs are real `<Link>` elements — keyboard-navigable, in tab',
          'order, focus-ring matches the rest of the shell chrome. The terminal crumb',
          'is plain text with `aria-current="page"`.',
          '',
          'Stories render the pure-prop `BreadcrumbsPresentation` directly with a',
          'literal trail so the visual reference doesn\'t depend on a mocked router.',
        ].join('\n'),
      },
    },
  },
  render: (args) => (
    <div className="bg-brand-white">
      <BreadcrumbsPresentation {...args} />
      <div className="p-6 text-sm text-brand-charcoal">
        Page content placeholder
      </div>
    </div>
  ),
};

export default meta;

type Story = StoryObj<typeof BreadcrumbsPresentation>;

export const Home: Story = {
  args: {
    trail: buildTrail('/app'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'On the post-login home `/app`, the trail is a single terminal "Home" crumb (plain text with `aria-current="page"`).',
      },
    },
  },
};

export const Employees: Story = {
  args: {
    trail: buildTrail('/app/employees'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Standard two-crumb trail: `Home > Employees`. "Home" is a real anchor; "Employees" is the terminal crumb.',
      },
    },
  },
};

export const PayCodes: Story = {
  args: {
    trail: buildTrail('/app/pay-codes'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates sentence-case labelling on a multi-word slug: "Pay codes" (not "Pay-codes" or "Pay Codes"). Brand voice §5.1.',
      },
    },
  },
};

export const DeepLinkWithDynamicSegment: Story = {
  args: {
    trail: buildTrail(
      '/app/employees/0f3b9d24-1d8a-4e2a-9c2a-7c1b1d0c9f4a',
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'A future-route deep link. Unmapped dynamic segment (UUID) falls back to "Details" — meaningful crumb without leaking the identity into the trail. When E5.2 ships the employee-detail page, it can override this with the resolved employee name.',
      },
    },
  },
};

export const LongTrailWrapping: Story = {
  args: {
    trail: [
      { label: 'Home', href: '/app', isCurrent: false },
      {
        label: 'Employees',
        href: '/app/employees',
        isCurrent: false,
      },
      {
        label: 'New hire batch — Q3 import',
        href: '/app/employees/import',
        isCurrent: false,
      },
      { label: 'Review and approve', href: null, isCurrent: true },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Defensive coverage — a synthetic long trail to verify the `flex-wrap` rule. Real labels are short; this is a regression guard for the day a feature introduces a long dynamic crumb.',
      },
    },
  },
};
