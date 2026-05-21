---
name: dev-prototype
description: Use when there is a hard technical unknown that needs a throwaway spike before committing to an implementation approach. Triggered when the developer says "prototype", "spike", "I'm not sure if this is technically feasible", or when a plan contains an unvalidated technical assumption. The prototype is always deleted after the question is answered.
credits: |
  Adapted from mattpocock/skills (prototype)
  Source: https://github.com/mattpocock/skills
  License: MIT — Copyright (c) 2026 Matt Pocock
---

# Dev Prototype

Throwaway spike for hard technical unknowns. Answer the question, then delete.

## The Rule

A prototype exists only to answer one specific question. It is never a foundation for production code. When the question is answered, delete the prototype.

## Step 1 — Define the Question

State the single technical question this prototype must answer. Be specific:

- BAD: "I want to see how this works"
- GOOD: "Can Supabase Edge Functions stream responses with >5s latency without timing out?"
- GOOD: "Does the React `useTransition` API handle 1000 concurrent state updates without visual stutter?"

If you cannot write the question in one sentence, the scope is too large. Split it.

## Step 2 — Timebox

Set a timebox before starting: 30 minutes, 1 hour, 2 hours maximum.

If you hit the timebox without an answer:
- Stop.
- Report: "UNRESOLVED — needs more time or different approach."
- Do not extend the timebox silently.

## Step 3 — Build

Build the absolute minimum needed to answer the question:

- No error handling beyond what's needed to observe the behaviour.
- No code style, naming conventions, or patterns — this is throwaway.
- No tests — the prototype itself is the experiment.
- Use `working_files/` or `/tmp/` as the location.

## Step 4 — Answer

Run the prototype. Record the answer:

```
QUESTION: {the question from Step 1}
ANSWER: {yes/no/partial + what you observed}
EVIDENCE: {what you ran and what you saw}
IMPLICATIONS: {what this means for the real implementation}
```

## Step 5 — Delete

Delete all prototype code. It served its purpose.

```bash
rm -rf working_files/{prototype-name}
```

Do not commit prototype code. Do not "clean it up" and keep it — that defeats the purpose.

## Step 6 — Resume

Return to the plan with the answer. Update the approach if the answer changed assumptions. Run `dev-grill` again if the answer invalidates key plan decisions.

---

## Credits

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) — `prototype`  
License: MIT — Copyright (c) 2026 Matt Pocock
