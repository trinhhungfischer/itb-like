# Story 004: Quota, Capability & Memory Mode

> **Epic**: Run Persistence
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Integration
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Context

**GDD**: `design/gdd/run-persistence.md`
**Requirement**: `TR-PERSIST-007`

**ADR Governing Implementation**: ADR-0003: Run Persistence save schema & versioning
**ADR Decision Summary**: Detects quota limits and disabled storage gracefully, switching to memory mode or abandoning writes without corrupting state.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: N/A
- Forbidden: N/A
- Guardrail: Boot-time capability probe (`isStorageAvailable`) < 2 ms

---

## Acceptance Criteria

*From GDD `design/gdd/run-persistence.md`, scoped to this story:*

- [x] **AC11**: GIVEN a write that throws QuotaExceededError, WHEN saveRun() is called, THEN it retries once after removing quarantine keys; if the retry also throws, the write is abandoned, the previous good save (if any) is byte-identical to before the attempt, and a storage_full event fires.
- [x] **AC12**: GIVEN the capability probe throws on setItem, WHEN the app boots, THEN the session enters memory-only mode: subsequent saveRun/loadRun calls succeed against an in-memory store for that session only, and a storage_unavailable event fires once.

---

## Implementation Notes

*Derived from ADR-0003 Implementation Guidelines:*

- **Capability probe once at boot.** `isStorageAvailable()` does `try { setItem(probe); removeItem(probe) } catch → false`. On `false`, run the session in memory-only mode.
- **Quota retry**: On `QuotaExceededError`, prune `*.corrupt.*` quarantine keys and retry the write exactly once. Return `QuotaExceeded` result on failure.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 005: Run lifecycle and domain interactions.

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `tests/integration/run-persistence/quota-capability_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003 must be DONE
- Unlocks: Story 005

## Completion Notes
**Completed**: 2026-07-29
**Criteria**: 2/2 passing
**Deviations**: None
**Test Evidence**: Integration: `tests/integration/run-persistence/quota-capability_test.ts`
**Code Review**: Complete
