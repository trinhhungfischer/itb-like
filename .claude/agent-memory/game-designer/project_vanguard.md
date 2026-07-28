---
name: project_vanguard
description: Core facts about the VANGUARD game project — genre, stack, pillars, scope — needed to author any GDD in this repo consistently.
metadata:
  type: project
---

VANGUARD is a **deterministic tactical roguelike** (Into the Breach meets a
Slay-the-Spire-style meta layer), pure-web stack: TypeScript + PixiJS + Vite,
no native engine, single-player, no networking.

**Five pillars** (every GDD's status header must cite which it implements):
1. Perfect Information, Perfect Blame — full telegraph, free undo, no surprises.
2. Positioning Over Power — win by board manipulation, not damage numbers.
3. Variety Lives in the Draft, Not the Dice — NO RNG in battle; all variety
   lives in the between-battle draft/route/meta layer.
4. Every Hero Is a Verb — each hero = one unique board-manipulation verb.
5. Read in Ten Seconds — whole battle state legible at a glance.

**Board constants** (registered in `design/registry/entities.yaml`):
`grid_width=8`, `grid_height=8`, 4-directional orthogonal adjacency, Manhattan
distance (`manhattan_distance` formula), units occupy exactly 1 tile.

**Scope**: v1 = 1 region, 6-8 heroes, ~15-20 encounter templates. Session
length target 30-60 min/run, ~5 min/battle. MVP → Vertical Slice → Alpha →
Full Vision tiers (see `design/gdd/systems-index.md`).

**Combat Resolution owns effect primitives** (damage, push, pull,
spawn-hazard, apply-hazard, remove-unit, collision) — both hero and enemy
abilities are defined in terms of these, never duplicated per-system.

**Turn order**: TurnStart → PlayerPhase → Environment → EnemyResolve → Spawn
→ Telegraph → EndCheck. Environment resolves BEFORE enemies (setup/disruption
depth). Undo scoped to Player Phase via Board `snapshot()`. Defeat > Victory
precedence at every evaluation point.

Related: [[project_gdd_conventions]], [[feedback_gdd_fanout_authoring]]
