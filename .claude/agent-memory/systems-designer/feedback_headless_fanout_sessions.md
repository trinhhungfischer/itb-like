---
name: feedback-headless-fanout-sessions
description: When the incoming task author is "workflow (design-system fan-out)", author and write the full GDD directly — no interactive Q&A
metadata:
  type: feedback
---

When a task's required status header names the author as
`workflow (design-system fan-out)` (or similar orchestrator-driven phrasing)
and the task ends by requiring a `StructuredOutput` summary return, this is a
headless fan-out subagent invocation, not an interactive collaboration
session — there is no user available to answer clarifying questions mid-task.

**Why:** The collaboration-protocol instructions (ask questions, present
options via AskUserQuestion, get per-section approval before writing) assume
a live back-and-forth session. A design-system fan-out task instead gives a
fully-specified brief (game concept, systems-index row, registry, project
conventions) and expects the finished GDD written to disk in one pass, with
the `StructuredOutput` call as the only return channel back to the
orchestrator.

**How to apply:** In this mode, read all supplied context files, read at
least one sibling GDD for style/depth matching (see
[[project-vanguard-overview]]), make and document reasonable provisional
decisions inline in the doc (flag with "PROVISIONAL" / "Open Questions")
rather than stopping to ask, and write the complete file directly with
Write. Do not wait for per-section approval. Still respect hard constraints
from the task (e.g. "do not edit systems-index.md or entities.yaml" —
surface proposed registry additions only in the `registry_candidates` field
of the final `StructuredOutput` call).
