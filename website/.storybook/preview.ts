import type { Preview } from '@storybook/nextjs-vite';

// Tailwind v4 base styles + LSL design tokens. Storybook must render every
// component with the exact same global CSS the production app uses, otherwise
// stories drift from reality. The Next.js app entry is `src/app/layout.tsx`,
// which imports `./globals.css`; we mirror that here so the Tailwind theme,
// brand tokens, and focus-ring rules are available in every story.
import '../src/app/globals.css';

const preview: Preview = {
  parameters: {
    // Show the full controls panel by default — most stories will rely on
    // Storybook's auto-generated controls for variant exploration.
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    // axe-core integration (PD-2 component layer).
    //
    // Mode `'todo'` shows violations as informational only (so stories still
    // render even when a11y is in progress). Once a component lands its first
    // brand-styled variant under Task 2.6, flip its story-level parameter to
    // `'error'` so the addon fails the story panel on serious/critical hits.
    a11y: {
      test: 'todo',
      config: {
        rules: [
          // shadcn's default focus styles use outline-offset which axe-core
          // sometimes flags as low-contrast in light themes. Leave the rule
          // enabled — we want to know about it — and address per component.
        ],
      },
    },

    layout: 'centered',
  },

  // Global types reserved for future light/dark toggle (deferred per spec §5.8
  // — dark mode is explicitly out of scope for v1). No globalTypes today.
};

export default preview;
