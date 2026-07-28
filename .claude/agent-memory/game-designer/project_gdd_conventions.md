---
name: project_gdd_conventions
description: Structural and rigor conventions shared across VANGUARD's design/gdd/ documents — reuse these when authoring or reviewing any system GDD in this project.
metadata:
  type: project
---

Observed consistently across `board-and-grid.md`, `turn-and-phase-manager.md`,
`encounter-generator.md`, `objective-and-win-lose.md`, `run-persistence.md`,
and `run-structure-node-map.md`:

- **Section order**: Overview, Player Fantasy, Detailed Design (Core Rules +
  Data Contracts [when there's a schema] + States and Transitions +
  Interactions with Other Systems), Formulas, Edge Cases, Dependencies,
  Tuning Knobs, Visual/Audio Requirements, UI Requirements, Acceptance
  Criteria (ending with a Performance Budget subtable), Open Questions.
- **Seeded PRNG convention**: deterministic generation uses a shared `mix()`
  32-bit hash combiner (exact algorithm pinned via one shared ADR, not
  per-system) + `mulberry32` as the actual stream generator. Any new
  seeded-generation system should reuse this exact algorithm rather than
  inventing a new one, and should note "identical algorithm to
  encounter-generator.md's Formula F2" for consistency.
- **PROVISIONAL tagging**: any dependency on an undesigned system is called
  out inline (in Dependencies tables and Core Rules) as `(undesigned,
  PROVISIONAL)`. The proposed interface is documented as "the contract this
  GDD proposes" so the undesigned system can be checked against it later.
- **Bidirectional-consistency notes**: every Dependencies section ends with a
  paragraph cross-checking claims against what sibling GDDs already say about
  the same edge, and explicitly flags any `systems-index.md` gaps for a later
  `/consistency-check` pass — GDDs never edit `systems-index.md` or
  `design/registry/entities.yaml` directly; those are updated separately.
- **Edge cases must state exact outcomes** — never "handle gracefully."
  Pattern: state the trigger, the exact mechanical result, and whether it's a
  runtime path vs. a construction/authoring-time rejection (assert/reject
  before the fact, matching Board & Grid's `W<1` precedent).
  Precedent chains matter: cite an existing edge case as precedent for a new
  one rather than re-deriving a new invalid-input policy.
- **"Guarantee vs. search" distinction**: some systems make a guarantee
  constructively (e.g. graph connectivity via backfill — cannot fail); others
  make a guarantee via bounded, budgeted search with a fallback (e.g.
  Encounter Generator's solver — can genuinely exhaust budget, falls back to
  an authored baseline). Be explicit about which kind any new guarantee is.
- **Formulas need**: a variable table (symbol, type, range, description), an
  explicit output range, and at least one fully-hand-computed worked example
  (not just an illustrative unresolved hash) wherever the arithmetic is
  actually hand-computable.
- **Registry discipline**: never invent numbers that contradict
  `design/registry/entities.yaml` (e.g. `grid_width=8`, `grid_height=8`,
  `manhattan_distance`). New cross-system constants/formulas worth reusing
  elsewhere should be flagged as `registry_candidates` in the task's
  structured output, not written into the registry directly.

Related: [[project_vanguard]], [[feedback_gdd_fanout_authoring]]
