# Active Session State

**Task:** Batch-authored all MVP + Vertical Slice GDDs via Workflow fan-out + consistency pass + fixes
**Status:** COMPLETE for MVP+VS. 21/25 systems Designed (MVP 10/10, VS 11/11). Alpha #22–#25 not started.
**Files:** design/gdd/*.md (21 system GDDs)

## Consistency pass (2026-07-28)
- Verify found 8 cross-doc conflicts. Quick fixes applied: #2 (Objective = state-poll not events), #3 (added 9th Combat primitive setTerrain → "wall" verb buildable), #6 (tutorial fields folded into MetaStatistics), #8 (PRNG registered once as mulberry32_prng).
- Registry seeded: entities combat_primitives (9), unit_record (pending); formula mulberry32_prng; constants squad_size=3, actions_per_hero_turn=2, upgrade_slots_per_hero=2, collision_damage=1, fire_damage_per_tick=1 (+ grid_width/height, manhattan_distance).
- 4 structural contracts routed to architecture as Required ADRs (systems-index "Open Cross-System Contracts": C1 DifficultyConfig/tier ownership, C2 shared Unit record, C3 shared reachableTiles BFS, C4 environmental telegraph query).

## Pipeline in progress (user: do the whole pipeline)
- ✅ Design-review fan-out (21 docs): APPROVED 2, MINOR 4, NEEDS_REVISION 15 — mostly cross-doc contract drift from parallel authoring.
- ✅ Wrote canonical **design/architecture/cross-system-contracts.md** (source of truth resolving the drift + C1-C4). Registry: combat_primitives now 10 (added spawnUnit); unit_record canonical fields.
- ✅ systems-index Depends-On columns completed (Move Preview, Battle HUD, Encounter Gen, Run Structure→Difficulty Tiers per C1, Audio, Onboarding).
- ⏳ RUNNING: reconcile fan-out (wf_49c497f3-ffd) — 21 agents each fixing their own GDD against the contracts doc.

## Reconcile COMPLETE (2026-07-28)
- 2 reconcile passes + 1 targeted cleanup. Grep-verified: ZERO stale "(undesigned)" tags for Designed systems; primitive count 10 everywhere; canonical signatures in place. All 21 GDDs consistent with cross-system-contracts.md.
- Progress tracker: 21 reviewed, 21 approved (post-reconcile).

## Architecture (2026-07-28)
- ✅ docs/architecture/architecture.md v1.0 — TD sign-off APPROVED (LP skipped, lean). 5 layers, module ownership, data flow, API boundaries, 11 Required ADRs (A1-A11), 6 principles. Pure-web stack (TS+PixiJS+Vite); Godot engine-ref N/A.
- ⏳ RUNNING: fan-out writing 11 ADRs (adr-0001..0011, Status: Accepted) — wf_3fce0d56-c2e.

## Architecture-review + pre-gate (2026-07-28)
- ✅ 11 ADRs (adr-0001..0011) all Accepted.
- ✅ /architecture-review: PASS — 126 TRs, 84 covered, 40 design-level, 0 gaps, 0 conflicts. Wrote tr-registry.yaml, architecture-review-2026-07-28.md, requirements-traceability.md (renamed from architecture-traceability-index.md).
- ✅ Pre-gate artifacts: tests/unit (+ board_grid example test), tests/integration, .github/workflows/tests.yml, vitest.config.ts, design/ux/interaction-patterns.md, design/ux/accessibility-requirements.md, design/accessibility-requirements.md.

## Gate: Technical Setup -> Pre-Production (2026-07-28) = CONCERNS
- Strong technical foundation (architecture PASS, 11 ADRs Accepted, 0 Foundation gaps, tests scaffolded). NOT advanced (stage.txt unchanged). User accepted CONCERNS and stopped.
- 3 items to reach PASS when resumed:
  1. ~~/art-bible — expand concept's "Legible Battlefield" anchor into art-bible.md §1-4 (the one real missing artifact).~~ ✅ Done 2026-07-28.
  2. ~~Record tech decision (TS+PixiJS+Vite, pure web) into .claude/docs/technical-preferences.md + CLAUDE.md Technology Stack + naming/perf budgets.~~ ✅ Done 2026-07-28.
  3. ~~Rename docs/architecture/architecture-traceability-index.md -> requirements-traceability.md.~~ ✅ Done 2026-07-28.
- Optional: ~~design/ux/hud.md screen spec~~ ✅ Battle HUD UX spec written (`design/ux/battle-hud-ux-spec.md`); director panel (advisory) not run.

## Gate: Technical Setup -> Pre-Production (2026-07-28) = PASS
- Re-run after resolving all 3 items + adding Battle HUD UX spec.
- 13/13 artifacts ✅, 8/8 quality checks ✅. Stage advanced to Pre-Production.
- Report: `production/gate-checks/gate-check-pre-production-2026-07-28.md`

## Control Manifest (2026-07-28)
- ✅ `docs/architecture/control-manifest.md` generated from 11 ADRs + technical-preferences.md.
- 4 layer sections (Foundation/Core/Feature/Presentation) + Global rules. All rules sourced to ADR or tech-prefs.

## Resume pointer
Pre-Production pipeline in progress. Control manifest done. Next steps:
1. `/vertical-slice` — build core loop prototype (validates fun before committing to epics)
2. Playtest → `/playtest-report`
3. `/create-epics layer:foundation` then `layer:core`
4. `/create-stories [epic-slug]` for each epic
5. `/sprint-plan new`
Alpha systems #22-#25 still Not Started.
**Design order key decision:** phases = TurnStart → PlayerPhase → Environment → EnemyResolve → Spawn → Telegraph → EndCheck (environment-first, per user, for setup/disruption depth). Undo scoped to Player Phase.
**Resolved:** #5 renamed "Enemy, Abilities & Telegraph" (folds enemy attack abilities + on-death effects into #5; heroes keep #4). Synced across index + both GDDs.

## Next
- ✅ #1 Board & Grid, ✅ #2 Turn & Phase Manager designed (2/10 MVP).
- Recommend `/design-review` (fresh session) for both GDDs before building on them.
- Next in design order: #3 Combat Resolution (L-effort, bottleneck), then #4 Heroes & Abilities, #5 Enemy Abilities & Telegraph.
- Registry: grid_width=8, grid_height=8, manhattan_distance.

## Progress
- ✅ Game concept written (design/gdd/game-concept.md) — VANGUARD, deterministic tactical roguelike, pure-web (TS+PixiJS)
- ✅ Systems index written (25 systems: 10 MVP, 11 Vertical Slice, 4 Alpha)

## Key decisions
- Review mode: lean (no production/review-mode.txt)
- Architecture convention: Combat Resolution owns effect primitives (damage/push/pull/spawn-hazard); Abilities + Enemy actions defined in terms of them → no circular deps. Record as ADR later.
- Combat Resolution MUST be a pure deterministic function (state → state) so Move Preview reuses it.

## Next
- ✅ #1 Board & Grid designed. Next in order: #2 Turn & Phase Manager → #3 Combat Resolution → #4 Heroes & Abilities (user's stated interest).
- Recommend: run `/design-review design/gdd/board-and-grid.md` in a FRESH session before building on it.
- Command to continue: `/design-system turn-and-phase-manager` or `/map-systems next`.
- Registry now holds: grid_width=8, grid_height=8, manhattan_distance (source: board-and-grid.md).
