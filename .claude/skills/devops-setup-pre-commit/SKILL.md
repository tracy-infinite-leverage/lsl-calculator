---
name: devops-setup-pre-commit
description: Use when a project needs pre-commit hooks set up for code quality gates. Triggered when the DevOps agent says "setup pre-commit", "add husky", "add lint-staged", or when the project has no pre-commit hooks and the developer is about to start shipping features. Installs Husky + lint-staged + Prettier + type-check.
credits: |
  Adapted from mattpocock/skills (setup-pre-commit)
  Source: https://github.com/mattpocock/skills
  License: MIT — Copyright (c) 2026 Matt Pocock
---

# DevOps Setup Pre-Commit

Install Husky + lint-staged + Prettier + type-check as pre-commit gates.

## Prerequisites

- Node.js project with `package.json`
- Git repository initialised

## Step 1 — Install Dependencies

```bash
npm install --save-dev husky lint-staged prettier
```

For TypeScript projects, also install:

```bash
npm install --save-dev typescript
```

## Step 2 — Initialise Husky

```bash
npx husky init
```

This creates `.husky/pre-commit`.

## Step 3 — Configure lint-staged

Add to `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "prettier --write",
      "eslint --fix"
    ],
    "*.{json,md,css,scss}": [
      "prettier --write"
    ]
  }
}
```

## Step 4 — Configure the Pre-Commit Hook

Write `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run lint-staged
npx lint-staged

# Type-check (TypeScript projects only)
npx tsc --noEmit
```

## Step 5 — Configure Prettier

Create `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

Create `.prettierignore`:

```
node_modules/
.next/
dist/
build/
*.generated.*
```

## Step 6 — Verify

Run a test commit to confirm hooks fire:

```bash
git add .prettierrc .prettierignore package.json
git commit -m "chore: add pre-commit hooks (husky + lint-staged + prettier)"
```

Confirm the hook output appears and all checks pass.

## Step 7 — Document

Update `docs/engineering/` with a note that pre-commit hooks are active and what they check.

---

## Credits

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) — `setup-pre-commit`  
License: MIT — Copyright (c) 2026 Matt Pocock
