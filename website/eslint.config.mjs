import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import lslRules from "./eslint-rules/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Storybook production build output (E6.2 Task 2.1):
    "storybook-static/**",
    // Local ESLint rule fixtures — intentionally lint-failing.
    "eslint-rules/__fixtures__/**",
  ]),
  // E6.2 Task 2.5 — Lucide barrel enforcement (OQ-2).
  //
  // Every icon in product code must flow through `@/components/brand/Icon` so
  // the v1.1 custom-icon swap is a one-file change. Direct `lucide-react`
  // imports outside the exempted set fail the lint.
  //
  // Exempt files:
  //   - `src/components/brand/Icon.tsx` — this IS the barrel.
  //   - `src/components/ui/**` — shadcn primitives. Spec §7.2 mandates
  //     "shadcn variant overrides, not replacements" — i.e. preserve the
  //     shadcn upgrade path. `npx shadcn@latest add` re-writes these files
  //     with direct `lucide-react` imports, so forcing the barrel here would
  //     break the upgrade ergonomics. Effective surface for the rule is
  //     every other component / page in `src/`.
  //
  // OQ-2 swap mechanism: when the custom icon set lands, replace
  // `src/components/brand/Icon.tsx` AND the small number of `lucide-react`
  // imports inside `src/components/ui/**` in a single PR. The audit is
  // greppable: `grep -rE "from ['\"]lucide-react['\"]" website/src/`.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/components/brand/Icon.tsx",
      "src/components/ui/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lucide-react",
              message:
                "Import icons from '@/components/brand/Icon' instead. The barrel exists so the v1.1 custom-icon swap (OQ-2) is a one-file change. See icon-direction.md §5 and eslint.config.mjs.",
            },
          ],
        },
      ],
    },
  },
  // E6-quality — RSC boundary enforcement.
  //
  // Two prod-bound PRs in 3 days hit the Next.js server/client boundary as
  // runtime crashes that should have been caught at lint time:
  //   - PR #68 (E5.1 Phase 6): `INITIAL_STATE` consts exported from a
  //     'use server' file, imported into a 'use client' form. Surfaced via
  //     Playwright instead of `tsc`.
  //   - PR #108 (E6.3 Task 3.3): `parseTenantClaimsCookie()` imported from
  //     a 'use client' module into `tenant-context-server.tsx`. Same shape.
  //
  // The rule flags imports that cross the boundary in either direction so
  // every crossing is intentional and reviewer-visible. Legitimate Server
  // Action imports from client components opt out via:
  //   // eslint-disable-next-line lsl/no-cross-rsc-boundary
  //
  // Ships at WARN today, not ERROR — the codebase has ~20 legitimate
  // crossings (server pages composing 'use client' forms; client forms
  // calling Server Actions) that the rule cannot statically distinguish
  // from buggy crossings. A follow-up PR will:
  //   (1) add `// eslint-disable-next-line` with justification on each
  //       legitimate crossing,
  //   (2) flip this severity to "error".
  // Until then, CI surfaces the warning in lint output so reviewers see
  // every new boundary crossing without breaking the build for the
  // existing legitimate inventory.
  //
  // Scope: direct static imports only. Re-exports, dynamic imports, and
  // conditional imports are deferred (see HANDOFF doc 2026-06-01).
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { lsl: lslRules },
    rules: {
      "lsl/no-cross-rsc-boundary": [
        "warn",
        {
          alias: {
            prefix: "@/",
            absoluteRoot: path.join(__dirname, "src"),
          },
        },
      ],
    },
  },
]);

export default eslintConfig;
