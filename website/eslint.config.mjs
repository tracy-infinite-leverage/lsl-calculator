import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
]);

export default eslintConfig;
