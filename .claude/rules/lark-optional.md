# Lark — Optional Integration

Lark notifications are optional. Before sending any Lark message, check whether
Lark is available using the following protocol. Never fail or block on missing Lark.

## Detection Protocol

### In Claude Chat (no filesystem access)

Ask the user once at the start of the session:

> "Do you use Lark for team notifications? If yes, is `lark-cli` installed and
> authenticated on this machine? I'll use it for status updates — if not, I'll
> skip notifications silently."

- If user says **yes** → proceed with Lark notifications as described in agent instructions.
- If user says **no** or **not sure** → skip all Lark steps silently. Log important
  updates to the relevant output file instead (HANDOFF.md, project-status.html, etc.).
- Do not ask again in the same session.

### In Claude Code (filesystem access available)

Check automatically — do not ask the user:

```bash
# Check 1: is lark-cli in PATH?
command -v lark-cli > /dev/null 2>&1 && LARK_CLI=1 || LARK_CLI=0

# Check 2: is LARK_WEBHOOK_URL set in the environment?
LARK_URL="${LARK_WEBHOOK_URL:-$(grep '^LARK_WEBHOOK_URL=' ~/.claude/.env 2>/dev/null | cut -d= -f2-)}"

if [ "$LARK_CLI" -eq 1 ] && [ -n "$LARK_URL" ]; then
  # Lark available — proceed with notification
  lark-cli send --as bot --text "{message}"
else
  # Lark not available — skip silently, log to file instead
  echo "[$(date)] LARK SKIPPED: {message}" >> ~/.claude/lark-skipped.log
fi
```

## What to Do When Skipping Lark

When Lark is not available, do not silently lose the information. Instead:

| Lark message type | Fallback |
|---|---|
| Standup / EOD summary | Write to `standup/briefings/` file as normal |
| Handoff notification | The HANDOFF.md commit is the record |
| Bug triage alert | Triage report in `docs/qa/` is the record |
| Campaign approval request | Write draft note in `email-index.md` |
| Blocker / escalation | Write to `docs/project-status.html` blocked section |

## Limitations Without Lark

If Lark is not configured, inform the user once at session start (do not repeat):

> "Lark is not configured on this machine. Team notifications will be written to
> project files instead of sent via Lark. To enable Lark, add `LARK_APP_ID`,
> `LARK_APP_SECRET`, and `LARK_WEBHOOK_URL` to `~/.claude/.env` and install
> `lark-cli`."
