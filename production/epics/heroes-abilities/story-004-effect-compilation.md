# Story 004: Effect Compilation and Preview Integration

> **Epic**: Heroes & Abilities
> **Status**: Complete
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Context

**GDD**: `design/gdd/heroes-and-abilities.md`
**Requirement**: `TR-HERO-004`, `TR-HERO-002`

**ADR Governing Implementation**: ADR-0006 (Combat `resolve()`), ADR-0007 (Snapshot-based undo & preview)
**ADR Decision Summary**: `compileEffects` must be pure and deterministic, producing the identical effect list for both preview and commit. Snapshot mechanisms support Undo correctly.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Effects must apply strictly sequentially in list order. Move Preview must reuse the identical `resolve()` entry point over a disposable snapshot.
- Forbidden: Snapshot must never be captured mid-chain.
- Guardrail: None

---

## Acceptance Criteria

*From GDD `design/gdd/heroes-and-abilities.md`, scoped to this story:*

- [x] GIVEN Vanguard's Shove compiled against a valid adjacent enemy target, THEN `compileEffects` returns exactly `[push(targetId, direction, distance=2)]` with `direction` computed as caster→target.
- [x] GIVEN the identical `(caster, ability, target)` input, WHEN `compileEffects` is called twice, THEN both calls return byte-identical output (pure function, no hidden state).
- [x] GIVEN Striker's ray contains 2 qualifying enemy units, THEN `compileEffects` returns exactly 2 `damage` primitives, ordered nearest-to-farthest along the ray, with both target IDs snapshotted before compilation begins.
- [x] GIVEN a `Line` ability's ray contains zero qualifying units, THEN `compileEffects` returns an empty array (legal, not an error).
- [x] GIVEN `compileEffects`'s output for a real Player-Phase action, WHEN the identical output is instead passed to `resolve(board.snapshot(), effects)` for a preview, THEN the resulting event log and board mutations are identical in shape to what the real commit will produce.
- [x] GIVEN a hero has used its Ability slot, WHEN the Turn Manager's `undo()` restores the Board to the pre-action snapshot, THEN that hero's Ability slot reads `Available` again at the same undo depth.
- [x] GIVEN a hero used Move then Ability (two snapshots deep), WHEN one `undo()` is called, THEN only the Ability slot's action is rolled back — the Move slot remains `Used` and the hero's position from the Move is retained.

---

## Implementation Notes

*Derived from ADR-0006 and ADR-0007 Implementation Guidelines:*

Implement `compileEffects`. It must bind placeholders (`$target`, `$direction`, `$distance`) deterministically. Ensure undo rolls back the `Available`/`Used` bookkeeping for slots along with the board snapshot.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 005: Presentation and Highlighting

---

## QA Test Cases

**Test file path**: `tests/integration/heroes-abilities/story-004-effect-compilation_test.ts`
**What to test**:
- `compileEffects` compiles correct Combat Resolution primitive sequence (e.g. `push`, `damage`).
- `compileEffects` is deterministic across multiple calls with same input.
- `compileEffects` for multi-target shapes (e.g. `Line`) correctly generates primitives for all targets in correct order.
- `compileEffects` returns empty array for shapes that find no units.
- Snapshot preview output matches actual player phase output perfectly.
- Undo restores action slots appropriately.

**Edge cases to cover**:
- `Line` abilities containing zero qualifying units.
- Undo after Move and Ability actions.

**Estimated test count**: ~8 integration tests

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `tests/integration/heroes-abilities/effect-compilation-preview_test.ts` — must exist and pass

**Status**: [x] Not yet created

---

## Dependencies

- Depends on: Story 003
- Unlocks: Story 005

---

## Completion Notes
**Completed**: 2026-07-29
**Criteria**: 7/7 passing 
**Deviations**: None
**Test Evidence**: Integration test file at `tests/integration/heroes-abilities/effect-compilation-preview_test.ts`
**Code Review**: Complete (APPROVED WITH SUGGESTIONS - Missing doc comments)
