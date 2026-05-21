# Daily Standup Workflow

When invoked by name or by the daily 7am routine, the PM:
1. Reads `git log --oneline -10`
2. Reads each `standup/individual/<person>.md` updated since yesterday
3. Reads `docs/product/epic-status.md`
4. Writes today's briefing to `standup/briefings/YYYY-MM/YYYY-MM-DD.md`
5. Updates `docs/project-status.html`
