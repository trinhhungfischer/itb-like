# Story 001: Envelope Serialization & Round Trip

> **Epic**: Run Persistence
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/gdd/run-persistence.md`
**Requirement**: `TR-PERSIST-001`, `TR-PERSIST-003`

**ADR Governing Implementation**: ADR-0003: Run Persistence save schema & versioning
**ADR Decision Summary**: Pins the on-disk save format for VANGUARD's browser-local persistence: a `{schemaVersion, checksum, data}` envelope written to `window.localStorage` under two independent domains, with build-then-swap atomic writes.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Run Persistence must write using build-then-swap atomic writes (one `setItem`)
- Forbidden: Run Persistence must never clear or truncate the key before its replacement string is fully built
- Guardrail: `saveRun()` / `saveMeta()` (≤10 KB payload, incl. checksum compute) < 5 ms

---

## Acceptance Criteria

*From GDD `design/gdd/run-persistence.md`, scoped to this story:*

- [ ] **AC1**: GIVEN a Run Save is written with saveRun(data), WHEN loadRun() is called immediately after, THEN it returns Valid with data deep-equal to what was written.
- [ ] **AC2**: GIVEN the same for Meta Save, THEN the same round-trip guarantee holds independently.
- [ ] **AC3**: GIVEN two identical write sequences on two fresh mock-storage instances, THEN both produce byte-identical stored strings (determinism).
- [ ] **AC13**: GIVEN no Run Save exists, WHEN loadRun(), THEN Empty and "Continue Run" is not offered (consumer-level check on the returned state).

---

## Implementation Notes

*Derived from ADR-0003 Implementation Guidelines:*

- **Hash the `data` string, not the envelope.** Compute `checksum` over exactly the string handed to `setItem` for the `data` field. Serialize `data` once and reuse that exact string for both hashing and storage.
- **Deterministic serialization.** `JSON.stringify` must produce identical output for identical state.
- **Build-then-swap literally.** Never `removeItem` then `setItem`; assign the fully-built string in a single `setItem`.
- **Headless-testable.** All of the above must run in Vitest against a mocked `localStorage` with no browser.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: Checksum generation and corruption handling.
- Story 003: Migrations and schema versioning.

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/run-persistence/envelope-serialization_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: Story 002
