/**
 * Badge.stories.tsx — Storybook coverage for the LSL brand Badge
 *
 * E6.2 Task 2.6.h. Renders one story per BRAND variant (brand,
 * brand-secondary, brand-gold, brand-advisory, brand-outline) plus a
 * combination row showing inline use.
 *
 * Per spec §5.5 / Task 2.1 contract: `parameters.a11y.test = 'error'` flips
 * the addon from preview-level `'todo'` to fail-on-violation. Zero serious /
 * critical violations on any story per spec §8.2.
 *
 * Legacy shadcn variants (`default`, `secondary`, `destructive`, `outline`,
 * `warning`, `success`) are NOT story-covered here — they exist solely to
 * preserve existing consumers and are not part of the brand surface Task
 * 2.6 ships. If a future PR adds brand styling to those legacy names, add
 * stories then.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Badge } from './badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  parameters: {
    a11y: {
      // Fail the story on serious / critical axe-core violations. Per spec
      // §5.5 / §8.2 this is the load-bearing a11y bar for the design system.
      test: 'error',
    },
    docs: {
      description: {
        component: [
          'The LSL Calculator brand Badge. Extends the shadcn Badge via `cva`',
          'with five brand variants per spec §5.1 — `brand`, `brand-secondary`,',
          '`brand-gold`, `brand-advisory`, `brand-outline`.',
          '',
          'Gold is reserved for "signal" usage per icon-direction.md §3 — not',
          'general decoration. Use the navy `brand` variant for primary chips',
          'and `brand-secondary` for the subtler context chip.',
        ].join('\n'),
      },
    },
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'brand',
        'brand-secondary',
        'brand-gold',
        'brand-advisory',
        'brand-outline',
      ],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Badge>;

// ---------------------------------------------------------------------------
// brand — primary chip
// ---------------------------------------------------------------------------

export const Brand: Story = {
  args: {
    variant: 'brand',
    children: 'Verified',
  },
};

// ---------------------------------------------------------------------------
// brand-secondary — subtler context chip
// ---------------------------------------------------------------------------

export const BrandSecondary: Story = {
  args: {
    variant: 'brand-secondary',
    children: 'NSW · Adult',
  },
};

// ---------------------------------------------------------------------------
// brand-gold — signal chip (premium / new / noteworthy)
// ---------------------------------------------------------------------------

export const BrandGold: Story = {
  args: {
    variant: 'brand-gold',
    children: 'New',
  },
};

// ---------------------------------------------------------------------------
// brand-advisory — advisory-context chip
// ---------------------------------------------------------------------------

export const BrandAdvisory: Story = {
  args: {
    variant: 'brand-advisory',
    children: 'Advisory',
  },
};

// ---------------------------------------------------------------------------
// brand-outline — quiet inline status
// ---------------------------------------------------------------------------

export const BrandOutline: Story = {
  args: {
    variant: 'brand-outline',
    children: 'Draft',
  },
};

// ---------------------------------------------------------------------------
// All variants — side-by-side comparison
// ---------------------------------------------------------------------------

/**
 * All five brand variants in one frame. Useful for visual contrast / spacing
 * audits and for confirming that the gold "signal" variant reads as distinct
 * from the navy "primary" variant.
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="brand">Primary</Badge>
      <Badge variant="brand-secondary">Secondary</Badge>
      <Badge variant="brand-gold">Signal</Badge>
      <Badge variant="brand-advisory">Advisory</Badge>
      <Badge variant="brand-outline">Outline</Badge>
    </div>
  ),
};
