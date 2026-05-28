/**
 * Wordmark.stories.tsx — Storybook coverage for the brand wordmark
 *
 * E6.2 Task 2.5. Renders one story per colour treatment + a size-comparison
 * story for designer review. The `@storybook/addon-a11y` panel runs axe-core
 * on every story; per spec §5.5 the bar is zero serious / critical violations.
 *
 * Flips `parameters.a11y.test` from the preview-level `'todo'` to `'error'`
 * because this is the first component lands brand styling (per preview.ts
 * comment — "Once a component lands its first brand-styled variant under Task
 * 2.6, flip its story-level parameter to 'error'").
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Wordmark } from './Wordmark';

const meta: Meta<typeof Wordmark> = {
  title: 'Brand/Wordmark',
  component: Wordmark,
  parameters: {
    a11y: {
      // Fail the story on serious / critical axe-core violations. Per spec §5.5
      // this is the load-bearing a11y bar for the design system.
      test: 'error',
    },
    docs: {
      description: {
        component: [
          'The LSL Calculator sub-brand wordmark (Candidate B, operator-approved 2026-05-28).',
          '',
          'Three colour treatments cover the contexts the wordmark appears in:',
          '',
          '- **default** — full colour (navy + gold + dark blue). Light surfaces.',
          '- **mono** — navy-only (no gold rule). Coloured fields where gold would clash.',
          '- **inverse** — white type on a navy field, gold rule preserved. Dark surfaces.',
          '',
          'SVGs are synced from `docs/brand/final/wordmark/` into `public/brand/` by the',
          '`prebuild` script. The component renders an `<img>` for cacheability.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'mono', 'inverse'],
    },
    width: {
      control: { type: 'number', min: 80, max: 600, step: 20 },
    },
    decorative: { control: 'boolean' },
  },
};

export default meta;

type Story = StoryObj<typeof Wordmark>;

/**
 * The canonical full-colour wordmark on a light surface. Default sizing
 * (200px) matches the top-nav placement in spec §5.2.
 */
export const Default: Story = {
  args: {
    variant: 'default',
    width: 280,
  },
};

/**
 * Mono variant — navy ink only, gold rule removed. For surfaces tinted with
 * a brand colour where the gold rule would clash.
 */
export const Mono: Story = {
  args: {
    variant: 'mono',
    width: 280,
  },
};

/**
 * Inverse variant — white type on the brand navy field. The story renders the
 * wordmark over a `bg-brand-navy` block (token-driven per Task 2.3) so axe-core
 * audits the actual on-brand contrast ratio, not a synthetic background.
 */
export const Inverse: Story = {
  args: {
    variant: 'inverse',
    width: 280,
  },
  decorators: [
    (StoryFn) => (
      <div className="bg-brand-navy p-8 inline-block rounded-brand-md">
        <StoryFn />
      </div>
    ),
  ],
};

/**
 * Size comparison — top-nav (160), default (200), hero (320), and PDF
 * letterhead (480). Confirms the SVG scales cleanly across the surfaces the
 * wordmark actually appears in.
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6 items-start">
      <div className="flex items-center gap-4">
        <span className="font-sans text-body-min text-brand-charcoal w-32">
          Top nav (160)
        </span>
        <Wordmark variant="default" width={160} />
      </div>
      <div className="flex items-center gap-4">
        <span className="font-sans text-body-min text-brand-charcoal w-32">
          Default (200)
        </span>
        <Wordmark variant="default" width={200} />
      </div>
      <div className="flex items-center gap-4">
        <span className="font-sans text-body-min text-brand-charcoal w-32">
          Hero (320)
        </span>
        <Wordmark variant="default" width={320} />
      </div>
      <div className="flex items-center gap-4">
        <span className="font-sans text-body-min text-brand-charcoal w-32">
          Letterhead (480)
        </span>
        <Wordmark variant="default" width={480} />
      </div>
    </div>
  ),
};

/**
 * Decorative mode — the wordmark is paired with text that names the brand
 * (e.g. inside a Lockup). `decorative` sets `alt=""` and `aria-hidden`, which
 * prevents axe-core flagging duplicate accessible labels.
 */
export const Decorative: Story = {
  args: {
    variant: 'default',
    width: 240,
    decorative: true,
  },
  decorators: [
    (StoryFn) => (
      <figure className="flex flex-col items-center gap-2">
        <StoryFn />
        <figcaption className="font-sans text-body-min text-brand-charcoal">
          LSL Calculator — when paired with naming text, the wordmark itself
          is decorative.
        </figcaption>
      </figure>
    ),
  ],
};
