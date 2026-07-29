# Story 002: Checksum & Corruption Detection

> **Epic**: Run Persistence
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Context

**GDD**: `design/gdd/run-persistence.md`
**Requirement**: `TR-PERSIST-002`

**ADR Governing Implementation**: ADR-0003: Run Persistence save schema & versioning
**ADR Decision Summary**: Uses an order-sensitive 32-bit checksum (F2 weighted sum) computed over the serialized data string only to detect corruption.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Run Persistence checksum must hash the exact string handed to `setItem` for `data`
- Forbidden: A missing migration or shape validation failure must never be partially migrated (treat as Corrupted)
- Guardrail: Checksum compute on a 10 KB string < 3 ms

---

## Acceptance Criteria

*From GDD `design/gdd/run-persistence.md`, scoped to this story:*

- [x] **AC4**: GIVEN a valid Run Save, WHEN one character of the stored data string is mutated (checksum now mismatched) and loadRun() is called, THEN it returns Corrupted, the key is quarantined under vanguard.run.corrupt.*, and the live vanguard.run.v{N} key is cleared (treated as Empty).
- [x] **AC5**: GIVEN a stored value that is not valid JSON, WHEN loadRun(), THEN Corrupted (same quarantine path), no exception escapes to the caller.
- [x] **AC6**: GIVEN a valid JSON payload missing a required top-level field, WHEN loadRun(), THEN Corrupted.
- [x] **AC7**: GIVEN a corrupted Meta Save, WHEN loadMeta(), THEN Corrupted, quarantined, and the live key is reset to schema defaults (not merely cleared) — verifying the harsher Meta-specific outcome.
- [x] **AC20**: GIVEN s="AB", THEN checksum(s) == 197 (F2 worked example, exact regression value).

---

## Implementation Notes

*Derived from ADR-0003 Implementation Guidelines:*

- **Pinned checksum algorithm:** `checksum(s) = ( Σ_{i=0}^{n-1} codeUnit(s, i) × (i + 1) ) mod 2^32`.
- `loadRun()` / `loadMeta()` return a `Result` union, catching parse errors and missing fields as `Corrupted`.
- Corrupted saves must be quarantined before clearing or resetting.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 003: Schema migrations for valid files.

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/run-persistence/checksum-corruption_test.ts` — must exist and pass

**Status**: [x] Tests exist and pass

---

## Dependencies

- Depends on: Story 001 must be DONE
- Unlocks: Story 003

---

## Completion Notes
**Completed**: 2026-07-29
**Criteria**: 5/5 passing
**Deviations**: None
**Test Evidence**: Logic: test file at `tests/unit/run-persistence/checksum-corruption_test.ts`
**Code Review**: Complete (APPROVED)
