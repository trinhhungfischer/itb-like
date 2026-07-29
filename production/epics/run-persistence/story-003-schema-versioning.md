# Story 003: Schema Versioning & Migrations

> **Epic**: Run Persistence
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Context

**GDD**: `design/gdd/run-persistence.md`
**Requirement**: `TR-PERSIST-004`

**ADR Governing Implementation**: ADR-0003: Run Persistence save schema & versioning
**ADR Decision Summary**: Handles sequential per-domain migrations on load and rejects newer unsupported versions without overwriting.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: N/A
- Forbidden: Saves with `schemaVersion > CURRENT_VERSION` must be left untouched on disk, never overwritten
- Guardrail: `loadRun()` with a 3-step migration chain < 15 ms

---

## Acceptance Criteria

*From GDD `design/gdd/run-persistence.md`, scoped to this story:*

- [x] **AC8**: GIVEN schemaVersion < CURRENT_VERSION, WHEN loaded, THEN exactly migrationsToApply (F3) migration functions run in ascending order and the result validates against the current schema.
- [x] **AC9**: GIVEN a version chain missing one migration function, WHEN loaded, THEN the result is Corrupted (not partially migrated).
- [x] **AC10**: GIVEN schemaVersion > CURRENT_VERSION, WHEN loaded, THEN the result is Unsupported(NewerVersion), the stored key is not parsed further and not overwritten by any subsequent write in that session.
- [x] **AC21**: GIVEN (v_stored, v_current) pairs incl. equal (0 migrations) and multi-step, THEN migrationsToApply matches F3 exactly.

---

## Implementation Notes

*Derived from ADR-0003 Implementation Guidelines:*

- **Migration functions are pure and ordered.** Each `migrate_vN_to_vN+1` is a pure `data → data` transform. Validate the final shape against the current schema before returning `Valid`.
- A gap in the chain or validation failure yields `Corrupted`.
- `Unsupported` state prevents further writes to the domain in that session.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 004: Quota and storage limits.

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/run-persistence/schema-versioning_test.ts` — must exist and pass

**Status**: [x] Created and passing

---

## Dependencies

- Depends on: Story 002 must be DONE
- Unlocks: Story 004

## Completion Notes
**Completed**: 2026-07-29
**Criteria**: 4/4 passing
**Deviations**: None
**Test Evidence**: Logic: test file at tests/unit/run-persistence/schema-versioning_test.ts
**Code Review**: Complete (Approved with suggestions)

