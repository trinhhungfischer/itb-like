# Active Session State

**Task:** Designing Board & Grid GDD
**Status:** Skeleton created — working on Section A (Overview)
**File:** design/gdd/board-and-grid.md

## Progress
- ✅ Game concept written (design/gdd/game-concept.md) — VANGUARD, deterministic tactical roguelike, pure-web (TS+PixiJS)
- ✅ Systems index written (25 systems: 10 MVP, 11 Vertical Slice, 4 Alpha)

## Key decisions
- Review mode: lean (no production/review-mode.txt)
- Architecture convention: Combat Resolution owns effect primitives (damage/push/pull/spawn-hazard); Abilities + Enemy actions defined in terms of them → no circular deps. Record as ADR later.
- Combat Resolution MUST be a pure deterministic function (state → state) so Move Preview reuses it.

## Next
- Design MVP systems in order: 1) Board & Grid → 2) Turn & Phase Manager → 3) Combat Resolution → 4) Heroes & Abilities ...
- User's stated interest: Heroes & Abilities (#4) — depends on Board/Grid + Combat Resolution (both undesigned).
- Command: `/design-system board-and-grid` (proper order) or `/design-system heroes-and-abilities` (jump, provisional deps)
