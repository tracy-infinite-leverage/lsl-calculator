# Effort Self-Report Prompts (per-project `.claude/project.json`)

**Why this exists.** Effort tracking captures **Claude tokens** by reading each session transcript directly, but it derives **human-hours** from either (a) Claude Code JSONL session timestamps or (b) git commit-span. Sessions run in **OpenCode** (or in moved/renamed checkouts) produce **no Claude Code JSONL** the tracker can find, and squash-merge commits compress real work into a single timestamp — so those sessions land **tokens with zero hours**.

The fix: at the **end of each dedicated working session**, have the session write its own **wallclock + token usage** into that project's `.claude/project.json` under an `effort_log` array. I (the tracker) pick those entries up and ingest them as both `claude` and `human` records.

---

## Rules (read once)

- **One file per project**, at `<repo-root>/.claude/project.json`. Run the prompt **inside that project's repo**.
- **Append, never overwrite.** Each entry is keyed by `session_id`; re-running must update-in-place, not duplicate.
- **Owner attribution.** This project's effort is tracked under the **client/owner** identity: **Tracy Angwin** (`tracy@austpayroll.com.au`). Every entry's `contributor_email` MUST be `tracy@austpayroll.com.au` — the tracker's effort-log ingest is **owner-only** and silently drops any entry whose email is not a registered owner identity for this client. Do not tag entries with an Edge8 contributor email (e.g. `trac.nguyen@talentedge.ai`); those would be discarded at ingest.
- **No estimation.** Pull real numbers: `started_at`/`ended_at` from the actual session timestamps; token counts from real usage metadata. If a value isn't knowable, set it to `null` — never guess.
- **Timezone:** record timestamps in **GMT+7**. `occurred_on` is the local calendar date of the session.
- **Units:** `active_hours` and `wall_clock_hours` in decimal hours (e.g. `2.30`). Tokens are raw integer counts.

---

## Prompt A — End-of-session closeout (paste at the end of each session)

```
You are closing out this working session for effort tracking. Do the following exactly:

1. Determine THIS session's real figures from your own session data (do not estimate; use null if unknown):
   - session_id (your session identifier / slug)
   - started_at and ended_at (ISO-8601, GMT+7)
   - active_hours  = summed active time (gaps > 5 min are idle, excluded)
   - wall_clock_hours = ended_at - started_at
   - tokens: { input, output, cache_creation, cache_read, total }
   - tool: "claude-code" or "opencode"
   - contributor_email: ALWAYS "tracy@austpayroll.com.au" (the registered owner
     identity for this client — NOT the git user.email of this repo)

2. This project tracks OWNER effort. Always attribute the entry to the owner
   (tracy@austpayroll.com.au). Do not skip on contributor identity.

3. Read <repo-root>/.claude/project.json (create {} if absent), ensure an
   "effort_log" array exists, and UPSERT this entry by session_id (replace if the
   session_id already exists, else append):

   {
     "session_id": "<id>",
     "occurred_on": "<YYYY-MM-DD local GMT+7>",
     "started_at": "<ISO8601 +07:00>",
     "ended_at": "<ISO8601 +07:00>",
     "active_hours": <decimal>,
     "wall_clock_hours": <decimal>,
     "tokens": { "input": <int>, "output": <int>, "cache_creation": <int>, "cache_read": <int>, "total": <int> },
     "tool": "<claude-code|opencode>",
     "contributor_email": "tracy@austpayroll.com.au",
     "phase": "<short label of what this session did>"
   }

4. Preserve all existing keys in project.json (client_id, project_id, etc.). Write valid
   JSON only. Then print the entry you wrote and the new effort_log length.
```

---

## Prompt B — Retroactive backfill (for sessions that already ended)

Use this when a session closed without running Prompt A. Run it inside the repo, once per past session you want captured.

```
Backfill effort for a PAST session in this repo. For the session identified below, read
its real transcript/usage data (no estimation) and UPSERT an entry into
<repo-root>/.claude/project.json -> effort_log[] using the exact schema from Prompt A
(keyed by session_id, replace-if-exists). Always attribute the entry to the OWNER
identity (contributor_email = "tracy@austpayroll.com.au"), since this project tracks
owner effort and the ingest is owner-only.

SESSION TO BACKFILL:
- session_id / file: <paste session id or transcript path>
(Repeat this block for each past session.)

After writing, print a table of all effort_log entries: occurred_on | active_hours | total tokens | tool.
```

---

## What I do with it (ingestion contract)

When you tell me a project's `effort_log` is updated, I ingest each entry into the tracker idempotently:

| effort_log field | Tracker record |
|---|---|
| `tokens.total` | `token_entries` row, `kind='claude'`, `source='session'`, `occurred_on`, `session_id` |
| `active_hours` (fallback `wall_clock_hours`) | `token_entries` row, `kind='human'` (stored as centihours = `round(hours*100)`), `occurred_on`, `session_id` |
| `contributor_email` | must be a registered **owner** identity for this client (`tracy@austpayroll.com.au`); **non-owner entries are silently dropped** by the owner-only ingest |
| `session_id` | conflict key — re-ingest updates, never duplicates |

So the loop is: **run Prompt A at session end → entry lands in `.claude/project.json` → I ingest → dashboard shows both tokens and hours for that day.** No JSONL-glob dependency, no commit-span guesswork.
