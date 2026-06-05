// Standalone ESLint flat config for testing no-cross-rsc-boundary in isolation.
// Run: npx eslint --config eslint-rules/__fixtures__/test-config.mjs eslint-rules/__fixtures__/
import lslRules from "../index.js";

export default [
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { lsl: lslRules },
    rules: {
      "lsl/no-cross-rsc-boundary": "error",
    },
    languageOptions: {
      parser: (await import("@typescript-eslint/parser")).default,
    },
  },
];
