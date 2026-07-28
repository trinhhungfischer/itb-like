# Story 005: Run Lifecycle & Single-Slot Rules

> **Epic**: Run Persistence
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/gdd/run-persistence.md`
**Requirement**: `TR-PERSIST-006`, `TR-PERSIST-008`

**Governing ADRs**:
- ADR-0003: Run Persistence save schema & versioning (Primary)
- ADR-0005: Board/Combat error contract (Secondary)

**ADR Decision Summary**: Enforces single-slot limits, merges unlocks into meta before clearing run saves on run end, and applies the Result-vs-throw error contract.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: N/A
- Forbidden: N/A
- Guardrail: N/A

---

## Acceptance Criteria

*From GDD `design/gdd/run-persistence.md`, scoped to this story:*

- [ ] **AC14**: GIVEN an active run, WHEN a node is entered / a node resolves victory / a draft choice is confirmed, THEN saveRun() is invoked exactly once per trigger with the updated checkpoint data.
- [ ] **AC15**: GIVEN an active run, WHEN the run ends, THEN saveMeta() (merge) is called before clearRun(), in that order (regression guard for the Rule 4f ordering).
- [ ] **AC16**: GIVEN the run-end sequence is interrupted after the meta merge but before clearRun(), WHEN the app reloads, THEN the merged unlocks are present in loadMeta() and the stale Run Save is still Valid (verifying no unlock is lost, per Edge Case).
- [ ] **AC17**: GIVEN a Run Save already exists, WHEN a second saveRun() for a different run is attempted without an explicit overwrite/clear, THEN it is rejected (single-slot enforcement, Rule 9).

---

## Implementation Notes

*Derived from ADR-0003 Implementation Guidelines:*

- **`mergeUnlocksIntoMeta` is the only run-end path.** It performs union unlocks into Meta + write as one call so callers cannot reorder the sequence; run end must call it **before** `clearRun()`.
- Single-slot limit: `saveRun` for a different run ID rejects without a clear.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 006: Determinism and resume testing.

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `tests/integration/run-persistence/run-lifecycle_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 004 must be DONE
- Unlocks: Story 006
