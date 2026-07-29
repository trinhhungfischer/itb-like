# Story 002: Passive Trigger System

> **Epic**: Passive Modules
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Context

**GDD**: `design/content/passive-modules-and-equipment.md`
**Requirement**: `TR-COMBAT-???`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR: N/A — Recommended ADR-0012 for "Passive Module resolution timing" is not yet authored.
**ADR Decision Summary**: Pending ADR-0012. Modules with OnAction/OnKill should resolve as follow-up resolve() calls, preserving Combat Resolution's single-chain contract.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: All board mutation must flow exclusively through Combat `resolve()`.
- Forbidden: Combat never calls back into Turn & Phase Manager.
- Guardrail: Board cost/frame < 2 ms.

---

## Acceptance Criteria

*From GDD `design/content/passive-modules-and-equipment.md`, scoped to this story:*

- [x] AC3: Passive effects are deterministically applied during the Combat Resolution phase and reflected accurately in the Move Preview.
- [x] `resolve()` must emit `OnAction`, `OnHit`, `OnKill` events to trigger passive modules.

---

## Implementation Notes

*Derived from ADR-NNNN Implementation Guidelines:*

Passives with `OnAction`/`OnKill` triggers resolve as follow-up `resolve()` calls (same pattern as Enemy on-death effects). Do not inject mid-chain.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 001: Equipment Slot Data Model
- Story 003: Trigger Type Implementations

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-3**: Passive effects are deterministically applied.
  - Given: A hero equipped with a passive module that triggers `OnHit`.
  - When: The hero performs an action that registers a hit during combat resolution.
  - Then: A follow-up `resolve()` is queued and executed for the passive effect, emitting the expected events.
  - Edge cases: Multiple passives triggering simultaneously resolve in equip order.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/combat-resolution/passive-trigger_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001
- Unlocks: Story 003

## Completion Notes
**Completed**: 2026-07-29
**Criteria**: 2/2 passing
**Deviations**: None
**Test Evidence**: tests/unit/combat-resolution/passive-trigger_test.ts
**Code Review**: Complete
