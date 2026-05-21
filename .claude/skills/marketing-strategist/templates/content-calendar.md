# {{CLIENT_NAME}} — Content Calendar

This is the single rolling content calendar. Add new weeks at the bottom. Never create separate monthly files.

The writer agent reads this every {{WRITER_RUN_DAY}} to produce the following week's content. Each topic links to a folder in `content/topics/`.

---

## Calendar Format

Each week is a block. Each row is one topic with its publish date, type, channel, hook, and status.

| Publish Date | Day | Type | Channel | Hook | Folder | Status |
|---|---|---|---|---|---|---|

---

## Week of {{FIRST_MONDAY_DATE}}

| Publish Date | Day | Type | Channel | Hook | Folder | Status |
|---|---|---|---|---|---|---|
| {{YYYY-MM-DD}} | {{Mon}} | {{Angle_1}} | {{Channels}} | {{Hook from transcript or placeholder}} | `{{YYYY-MM-DD}}-{{type}}-{{slug}}` | PLANNED |
| {{YYYY-MM-DD}} | {{Tue}} | {{Angle_1}} (cont.) | {{Channels}} | {{Continuation hook}} | `{{same folder}}` | PLANNED |
| {{YYYY-MM-DD}} | {{Wed}} | {{Angle_2}} | {{Channels}} | {{Hook}} | `{{YYYY-MM-DD}}-{{type}}-{{slug}}` | PLANNED |
| {{YYYY-MM-DD}} | {{Thu}} | {{Angle_2}} (cont.) | {{Channels}} | {{Continuation hook}} | `{{same folder}}` | PLANNED |
| {{YYYY-MM-DD}} | {{Fri}} | {{Angle_3}} | {{Channels}} | {{Hook}} | `{{YYYY-MM-DD}}-{{type}}-{{slug}}` | PLANNED |

---

## Adding New Weeks

Copy the week block format above. Add at the bottom of this file. Mark all new topics as `PLANNED`. The writer agent picks up anything marked `PLANNED` during its scheduled run.

## Source Material Notes

{{Per-topic notes the writer needs before running — permissions to confirm, source files to gather, people to reach out to.}}
