---
name: project-vanguard-overview
description: VANGUARD project facts — deterministic tactical roguelike, pure-web stack, GDD sibling-doc style to match
metadata:
  type: project
---

VANGUARD (working title) is a deterministic tactical roguelike (Into-the-Breach-
like) built pure-web: TypeScript + PixiJS + Vite, no native engine, no
networking. Board is registered at `grid_width=8, grid_height=8` (source
`design/gdd/board-and-grid.md`), 4-directional adjacency, Manhattan distance
(registered formula `manhattan_distance`). Five pillars, most load-bearing for
systems-designer work: #1 Perfect Information/Perfect Blame (no in-battle RNG,
full telegraph, free undo), #3 Variety Lives in the Draft Not the Dice (all
randomness/variety lives in the between-battle meta layer, never in a battle).

**Why:** `design/gdd/systems-index.md` enumerates 25 systems across
Foundation → Core → Feature → Presentation → Polish layers; Combat Resolution
owns all effect primitives (damage/push/pull/spawn-hazard/apply-hazard/
remove-unit/collision) and both Heroes & Abilities and Enemy Abilities &
Telegraph are defined purely in terms of those primitives (no duplication —
this is how the Combat↔Abilities circular dependency is broken).

**How to apply:** When authoring any new VANGUARD GDD, match the depth/rigor of
the two existing designed docs — `design/gdd/board-and-grid.md` and
`design/gdd/turn-and-phase-manager.md`. Both use this structure beyond the
required 8 sections: Detailed Design split into "Core Rules" / "States and
Transitions" / "Interactions with Other Systems" (with a proposed API/contract
block + a "Provisional — undesigned dependencies" callout), then Formulas
(named F1/F2/... with variable table + output range + worked example),
Edge Cases (exact outcomes, 10+ items), Dependencies (Upstream/Downstream
tables + a "Bidirectional-consistency note" flagging index gaps), Tuning
Knobs (table + an "Intentionally NOT a knob" callout for design-locked
invariants), Visual/Audio Requirements + UI Requirements (stubs or light
content even for non-visual systems), Acceptance Criteria (GWT, grouped by
rule, plus a "Performance Budget" table), and Open Questions (split into
"Needs an ADR" / "Resolved this session — provisional" / "Deferred to owning
system's GDD"). Check `design/registry/entities.yaml` before inventing any
cross-system constant/formula — see [[registry-workflow-vanguard]].
