import type { StorybookConfig } from '@storybook/nextjs-vite';

/**
 * Storybook 9 configuration for the LSL Calculator component workbench.
 *
 * Per E6.2 Task 2.1 (PD-3): adopt Storybook as the canonical visual reference
 * for the design system. Chromatic is intentionally NOT installed (cost
 * guardrail). The `@storybook/addon-a11y` addon runs axe-core per story so
 * component-level WCAG 2.2 AA violations are caught before they reach the E2E
 * suite (PD-2).
 *
 * Version note: the original tasks.md specifies "Storybook 8". The project runs
 * on Next.js 16 + React 19, neither of which is supported by
 * `@storybook/nextjs@8` (peer deps cap at next ^15). We bumped to the latest
 * stable Storybook 9.1.20 — same product family, same a11y addon, same
 * architecture.
 *
 * Builder note: we use `@storybook/nextjs-vite` (Vite builder) rather than the
 * default webpack/SWC `@storybook/nextjs`. The webpack/SWC path patches Next's
 * SWC loader at runtime, and Next 16 removed the `swc.isWasm` symbol it
 * monkey-patches against — boot fails with `TypeError: swc.isWasm is not a
 * function`. The Vite builder bypasses that patch entirely and works against
 * Next 16 today. Documented in
 * docs/engineering/changes/2026-05-28-E6.2-task-2.1-storybook/HANDOFF.md.
 */
const config: StorybookConfig = {
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },

  // Story discovery. The project keeps source under `src/`, so component stories
  // co-locate with their components under `src/components/**`. A `stories/` slot
  // is also reserved for cross-cutting introduction docs (e.g. a Welcome MDX
  // landing page authored in later tasks).
  stories: [
    '../stories/**/*.mdx',
    '../stories/**/*.stories.@(ts|tsx|mdx)',
    '../src/components/**/*.stories.@(ts|tsx|mdx)',
  ],

  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
  ],

  // Serve from the same `public/` dir the Next.js app uses in production. When
  // Task 2.2 syncs `docs/brand/final/` into `website/public/brand/` at build
  // time, those assets become available to Storybook automatically — no
  // duplicate config to drift out of sync.
  staticDirs: ['../public'],

  // Typescript: keep type-checking off for Storybook's own build (Vitest + tsc
  // cover the source). Faster boots; matches Storybook 9 defaults.
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
  },
};

export default config;
