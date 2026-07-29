# Story 003: Smoke Hazard

> **Epic**: Gadgets & Secondary Weapons
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/content/secondary-weapons-and-gadgets.md`
**Requirement**: `TR-GADGET-004`

**ADR Governing Implementation**: N/A
**ADR Decision Summary**: New hazard type matching existing hazard mechanics.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: 

**Control Manifest Rules (this layer)**:
- Required: hazardImmunities is consulted at every hazard damage site.

---

## Acceptance Criteria

*From GDD `design/content/secondary-weapons-and-gadgets.md`, scoped to this story:*

- [ ] Add `Smoke` hazard type (0 damage, duration 1).
- [ ] Smoke prevents targeting of units standing on it (AI skips them, telegraphed abilities whiff/don't target).
- [ ] Smoke does not block movement.

---

## Implementation Notes

Ensure the `Smoke` hazard definition allows movement. Update targeting formulas (like F1) and player ability target validation to reject units standing on a Smoke tile. 

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: Gadget use mechanics.

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-1**: Target blocking
  - Given: A unit standing on a Smoke hazard
  - When: An enemy evaluates Formula F1 (Nearest-Threat) or a player targets them
  - Then: The unit is treated as untargetable and excluded from valid targets.

- **AC-2**: Movement allowed
  - Given: A Smoke hazard on the board
  - When: A unit paths through or onto the tile
  - Then: Movement is allowed and not blocked.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/combat-resolution/smoke-hazard_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: None
