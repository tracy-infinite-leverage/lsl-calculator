# RSC boundary rule — test fixtures

These files exercise the `lsl/no-cross-rsc-boundary` ESLint rule. They are
intentionally lint-failing and live outside `src/` so production builds do
not see them.

## Files

| File | Directive | Purpose |
|---|---|---|
| `client-module.ts` | `'use client'` | A client module to be imported by other fixtures. |
| `server-module.ts` | `'use server'` | A server-actions module to be imported by other fixtures. |
| `bad-server-imports-client.ts` | (none — server) | Should be flagged: server imports `'use client'` module. |
| `bad-client-imports-server.ts` | `'use client'` | Should be flagged: client imports `'use server'` module. |
| `good-no-crossing.ts` | (none) | Should NOT be flagged: no boundary crossing. |

## Running

```bash
cd website
npx eslint eslint-rules/__fixtures__/
```

Expected output: exactly 2 errors (one per `bad-*` file), 0 errors for the
`good-*` file, 0 errors for the `client-module` / `server-module` source
files (they are only imported, not boundary-violators themselves).

The rule is configured to scan `src/**` in CI, so these fixtures only
exercise the rule when explicitly lint-targeted as above.
