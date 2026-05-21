# Global Engineering Rules
<!-- 
  These rules apply to every project on this machine.
  PROMOTE to ~/.claude/rules/global-engineering.md on each team member's machine
  so they apply across all repos, not just this one.
-->

## Git discipline

- Run `git status` before any file work. Stop and report if there are uncommitted changes or merge conflicts.
- Never force-push (`--force` or `--force-with-lease`) to any branch.
- Never skip hooks with `--no-verify`.
- Never amend a commit that has already been pushed to a remote.
- Never use `git add .` or `git add -A` — stage files explicitly by name.
- Never create a commit unless explicitly instructed by the user.

## Branch and PR discipline

- Never push directly to `main` or `master`. All changes go through a pull request.
- Never merge a PR while CI checks are failing.
- Confirm the correct base branch before opening a PR.

## Deployment discipline

- Never deploy using `vercel deploy`, `vercel --prod`, or any direct CLI deploy command.
- All deployments — preview and production — must flow through `git push` → CI/CD pipeline only.
- Never manually promote a deployment unless explicitly instructed and no CI pipeline exists.
- Never modify environment variables in the Vercel dashboard without recording the change in the repo's env documentation.
- Vercel MCP and Vercel CLI are permitted for read-only operations only: deployment status, build logs, runtime logs, analytics. Any write action must go through CI/CD or requires explicit user confirmation.

## Secrets and credentials

- Never commit `.env` files, API keys, tokens, passwords, or credentials of any kind.
- Never include secrets in code, comments, log statements, or commit messages.
- If a secret is found in staged files, remove it and warn the user before anything else.

## Destructive operations

- Always confirm with the user before: `rm -rf`, `git reset --hard`, `git branch -D`, dropping database tables, or overwriting uncommitted work.
- Investigate unknown files, branches, or lock files before deleting.
- Never use destructive commands to bypass errors — diagnose the root cause first.

## Code quality gates

- Never skip a failing test to ship faster. Fix it or escalate.
- Never disable or bypass a linter, type-checker, or CI step without explicit instruction.
- Never ship code with known security vulnerabilities (OWASP top 10: injection, XSS, broken auth, etc.).

## Supabase

The Supabase MCP plugin is installed globally. When any task involves Supabase (database queries, auth, storage, edge functions, migrations, or RLS policies):
- Use the Supabase MCP tools (`mcp__supabase__*`) — do not use raw `curl`, `psql`, or Supabase CLI calls unless MCP tools are unavailable.
- If not authenticated, call `mcp__supabase__authenticate` first and complete the flow via `mcp__supabase__complete_authentication` before proceeding.
- Never hardcode Supabase URLs, anon keys, or service role keys in code — read them from environment variables.
- Never run destructive migrations (DROP, TRUNCATE, DELETE without WHERE) without explicit user confirmation.

## Continuous improvement

When a solution is explicitly approved by the user OR confirmed working (tests pass, build succeeds, user says "yes" / "perfect" / "that's right"), proactively invoke the `/capture-learning` skill without waiting to be asked.

Invoke only if all three are true:
1. A concrete problem was encountered — not exploration or planning
2. A solution was applied and confirmed working
3. The user explicitly approved the outcome
