# Story 006: Determinism & Resume Contract

> **Epic**: Run Persistence
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/gdd/run-persistence.md`
**Requirement**: `TR-PERSIST-005`

**Governing ADRs**: 
- ADR-0004: mulberry32 PRNG seed strategy (Primary)
- ADR-0003: Run Persistence save schema & versioning (Secondary)
- ADR-0010: Difficulty/tier ownership chain (Secondary)

**ADR Decision Summary**: Ensures that resume relies on `runSeed` and `nodeId` to recreate identical encounter sequences without persisting generated encounters.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Resume must reproduce a byte-identical encounter from stored `runSeed` + `nodeId` alone
- Forbidden: Run Persistence must never store a generated encounter, only inputs
- Guardrail: N/A

---

## Acceptance Criteria

*From GDD `design/gdd/run-persistence.md`, scoped to this story:*

- [ ] **AC18**: GIVEN a stored runSeed and nodeId, WHEN resume calls generateEncounter(runSeed, nodeId, difficultyConfig, rosterSnapshot) twice in a row with the same re-derived difficultyConfig/rosterSnapshot, THEN both calls return deep-equal encounter definitions (purity check on the contract this GDD imposes).
- [ ] **AC19**: GIVEN (N, B_node, H, B_hero, O), THEN runSaveBytes matches F1 for ≥3 sample tuples incl. the worked example (N=20,H=6 → 4300 bytes).

---

## Implementation Notes

*Derived from ADR-0004 Implementation Guidelines:*

- Because generation is a pure function of inputs and battles carry no RNG, storing only seed + position is sufficient to re-derive byte-identical encounters on resume.
- Enforce that `EncounterGenerator` is queried in a stateless manner upon loading a run, using the loaded `runSeed` and map state.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- N/A

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `tests/integration/run-persistence/determinism-resume_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 005 must be DONE
- Unlocks: None
