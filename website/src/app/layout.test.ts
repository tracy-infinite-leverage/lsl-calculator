/**
 * RootLayout — Toaster mount smoke test (E6.2 PR #84 follow-up).
 *
 * Why this test exists: PR #84 shipped the Sonner brand wrapper
 * (`src/components/ui/toast.tsx`) but did NOT mount `<Toaster />` anywhere
 * in the app shell — the QA report at
 * `docs/qa/2026-05-30-PR-84-sonner-toast/QA-REPORT.md` flagged that the
 * wrapper was dead code on the live site (every `toast()` call would
 * silently no-op). This test pins the mount in place so a future refactor
 * can't quietly delete it.
 *
 * Why source-text inspection (not a render test):
 *   - `vitest.config.ts` runs in the node environment and includes only
 *     `*.{test,spec}.ts` — no jsdom, no JSX renderer wired up.
 *   - `RootLayout` calls `next/font/local()` at module load, which only
 *     resolves under the Next.js build pipeline; importing the module in
 *     bare vitest would throw.
 *   - The brand wrapper's actual render behaviour is already covered by
 *     the 8-story Storybook file (`toast.stories.tsx`) — axe-clean per
 *     spec §5.5. What was missing was a guarantee that the production
 *     app shell mounts the `<Toaster />` at all.
 *
 * Hence: a source-text invariant. Cheap, fast, fails loudly if either the
 * import or the JSX element is removed.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('app shell — Sonner Toaster mount (PR #84 follow-up)', () => {
  const layoutSrc = readFileSync(
    resolve(__dirname, 'layout.tsx'),
    'utf8'
  );

  it('imports Toaster from the brand wrapper', () => {
    expect(layoutSrc).toMatch(
      /import\s+\{\s*Toaster\s*\}\s+from\s+['"]@\/components\/ui\/toast['"]/
    );
  });

  it('mounts <Toaster /> inside the <body>', () => {
    expect(layoutSrc).toMatch(/<Toaster\s*\/>/);

    const bodyOpen = layoutSrc.indexOf('<body');
    const bodyClose = layoutSrc.indexOf('</body>');
    const toasterAt = layoutSrc.indexOf('<Toaster');
    expect(bodyOpen).toBeGreaterThan(-1);
    expect(bodyClose).toBeGreaterThan(bodyOpen);
    expect(toasterAt).toBeGreaterThan(bodyOpen);
    expect(toasterAt).toBeLessThan(bodyClose);
  });
});
