---
name: feedback_gdd_fanout_authoring
description: How to behave when invoked as "workflow (design-system fan-out)" to author a VANGUARD system GDD — write directly, no approval loop.
metadata:
  type: feedback
---

When a task explicitly instructs "read these context files THEN write the
finished GDD to [path] using the Write tool" and frames the Author as
"workflow (design-system fan-out)", this is an **automated single-shot
authoring invocation**, not an interactive collaborative session. Do NOT run
the normal Question-First / incremental-section-approval protocol (asking
"may I write this section?" etc.) — there is no user present to answer mid-task.
Instead: read all named context files, make the necessary design decisions
directly, mark any assumption about an undesigned dependency as PROVISIONAL
inline in the doc, and write the complete file in one pass, then return a
StructuredOutput summary only (no report files).

**Why**: this matches the established pattern already used by sibling docs in
this project (`encounter-generator.md`, `objective-and-win-lose.md`,
`run-persistence.md` — all authored the same way, same Author field). A
human reviewer runs `/design-review` on the output afterward; that is the
actual approval gate for fan-out-authored docs, not an in-session back-and-forth.

**How to apply**: check the task's Author-field instruction and phrasing
first. If it says "write the finished GDD" (imperative, no "ask before
writing"), proceed directly. If a task instead explicitly asks for
incremental section-by-section collaboration with a live user, follow the
normal collaborative protocol instead — the two modes are distinguishable by
how the task is framed, not by which agent is running.

Related: [[project_gdd_conventions]]
