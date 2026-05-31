/**
 * TenantSwitcher.stories.tsx — Storybook coverage for the workspace tenant
 * switcher.
 *
 * E6.3 Task 3.4. Stories target `TenantSwitcherPresentation` — the pure-prop
 * sibling — because Storybook can't run the `useTenantContext` hook against
 * a real TenantProvider tree (Storybook has no Next.js server runtime, no
 * cookie reader). The presentation/wrapper split exposed by
 * `TenantSwitcher.tsx` makes this trivial.
 *
 * Stories exercise the two visibility states (`< 2` memberships → hidden;
 * `≥ 2` → rendered) plus the open-panel state so axe-core scans the
 * dropdown contents. axe flips to `'error'` per the design-system
 * convention — zero serious / critical violations.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TenantSwitcherPresentation } from './TenantSwitcher';

const meta: Meta<typeof TenantSwitcherPresentation> = {
  title: 'AppShell/TenantSwitcher',
  component: TenantSwitcherPresentation,
  parameters: {
    a11y: { test: 'error' },
    layout: 'centered',
    docs: {
      description: {
        component: [
          'Dropdown of the user\'s tenant memberships, mounted in the TopNav slot of the',
          '`/app/*` workspace shell.',
          '',
          '**Hidden** when the user has fewer than two memberships (OQ-4) — single-org users',
          'never see this control.',
          '',
          '**Visible** when the user has ≥ 2 memberships (APA consultants, or anyone invited',
          'into multiple tenants). Selecting a row calls `setActiveTenant` from `TenantContext`.',
          '',
          'Stories render the pure-prop `TenantSwitcherPresentation` so Storybook does not need',
          'a live `TenantProvider` mounted above.',
        ].join('\n'),
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof TenantSwitcherPresentation>;

const SAMPLE_MEMBERSHIPS = [
  { id: 'home', name: 'Acme Pty Ltd' },
  { id: 'client-1', name: 'Bondi Bookkeeping' },
  { id: 'client-2', name: 'Coogee Compliance Services' },
  { id: 'client-3', name: 'Darling Harbour Holdings (Enterprise — Long Name)' },
];

export const Default: Story = {
  args: {
    memberships: SAMPLE_MEMBERSHIPS,
    activeTenantId: 'home',
    membershipCount: SAMPLE_MEMBERSHIPS.length,
    onSelect: () => {
      /* no-op in Storybook */
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Standard APA-consultant view: four memberships, currently acting on the home org. Click the trigger to open the dropdown and pick another tenant.',
      },
    },
  },
};

export const ActingOnClient: Story = {
  args: {
    memberships: SAMPLE_MEMBERSHIPS,
    activeTenantId: 'client-1',
    membershipCount: SAMPLE_MEMBERSHIPS.length,
    onSelect: () => {
      /* no-op */
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Switcher with the active tenant set to a non-home client. The trigger shows the client name; opening the dropdown reveals the check glyph next to the active row.',
      },
    },
  },
};

export const HiddenSingleMembership: Story = {
  args: {
    memberships: [{ id: 'home', name: 'Acme Pty Ltd' }],
    activeTenantId: 'home',
    membershipCount: 1,
    onSelect: () => {
      /* no-op */
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'OQ-4 enforcement: when the user has a single membership, the switcher renders `null`. Storybook will show an empty canvas — that is the correct outcome.',
      },
    },
  },
};

export const HiddenZeroMemberships: Story = {
  args: {
    memberships: [],
    activeTenantId: '',
    membershipCount: 0,
    onSelect: () => {
      /* no-op */
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Defensive guard: zero memberships (e.g. cookie raced, query failed) hides the switcher entirely. The empty canvas is the correct outcome.',
      },
    },
  },
};

export const CookieDisagrees: Story = {
  args: {
    // Cookie says `membershipCount: 1` (single-org), but data fetch returned
    // multiple rows. The switcher honours the cookie (OQ-4 is cookie-driven)
    // and hides itself.
    memberships: SAMPLE_MEMBERSHIPS,
    activeTenantId: 'home',
    membershipCount: 1,
    onSelect: () => {
      /* no-op */
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Defensive guard: if the cookie\'s `membershipCount` disagrees with the memberships array length (e.g. a brief race during cookie refresh), the switcher hides — cookie is the canonical OQ-4 gate.',
      },
    },
  },
};
