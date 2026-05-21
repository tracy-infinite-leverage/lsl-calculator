---
name: pm-standup
description: Daily standup workflow — read git log, draft plan, manage approval triage, compile standups, maintain RAID log, assess scope changes.
---

# PM: Standup Management

Four sub-capabilities:

## 1. Daily Plan (runs at 7am every weekday)

1. Read `git log --oneline -10` and check-ins in `standup/individual/`
2. Read current `docs/project-status.html` for open items and blockers
3. Write today's plan to `docs/plans/{YYYY-MM-DD}.md`:
   - What gets built today (approved epics / tasks)
   - Who is responsible (which agent)
   - Definition of done for each item
4. Update `docs/project-status.html` with the new daily plan:
   - Each item: title, priority, risk level, assigned agent
   - Status: ⏳ Awaiting Approval / ✅ Approved / 📋 Backlogged
5. Notify stakeholder: "Daily plan ready — please review within 2 hours"
6. Wait up to 2 hours. If no reply:
   - **High priority + low risk**: auto-approve, log "Auto-approved at {time}" in plan file
   - **Everything else**: backlog, move to tomorrow
   - Never auto-approve high-risk or unclear-scope items
7. If stakeholder replies with changes: update plan, re-notify once

## 2. Daily Standup Compile (runs at 6pm)

Read all check-ins in `standup/individual/` from today, compile into `standup/briefings/{YYYY-MM}/{YYYY-MM-DD}.md`, notify team.

## 3. RAID Log

Maintain at `docs/product/raid-log.md`:
- **Risks**: Uncertain events that could impact the project
- **Assumptions**: Things believed true that could be false
- **Issues**: Problems already occurring
- **Dependencies**: External things the project relies on

Each entry: description, owner, status, mitigation/response, date.

## 4. Scope Change Assessment

When a scope change is requested:
1. Document what changed and why
2. Assess impact on timeline, resources, existing epics
3. Present trade-off to stakeholder with recommendation
4. Record decision in raid-log.md

## Output Paths

| Artifact | Path |
|----------|------|
| Daily plan | `docs/plans/{YYYY-MM-DD}.md` |
| Standup briefing | `standup/briefings/{YYYY-MM}/{YYYY-MM-DD}.md` |
| RAID log | `docs/product/raid-log.md` |
