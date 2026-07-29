# Story 004: Decoy Drone

> **Epic**: Gadgets & Secondary Weapons
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/content/secondary-weapons-and-gadgets.md`
**Requirement**: `TR-GADGET-005`

**ADR Governing Implementation**: N/A
**ADR Decision Summary**: New unit entity utilizing existing unit patterns.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: 

**Control Manifest Rules (this layer)**:
- Required: spawnUnit is the single board-mutation path for adding a unit.

---

## Acceptance Criteria

*From GDD `design/content/secondary-weapons-and-gadgets.md`, scoped to this story:*

- [ ] Define `DecoyDrone` unit (`maxHP: 1`, `moveRange: 0`, `team: Hero`, `abilities: []`).
- [ ] Ensure it successfully attracts Formula F1 (Nearest-Threat) target selection.

---

## Implementation Notes

The Decoy Drone is a standard unit that belongs to the `Hero` team. As long as it is registered as such, the existing F1 formula should inherently treat it as a valid target. Verify that this correctly happens without bespoke F1 logic.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: Gadget use mechanics.

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-1**: Decoy targeting
  - Given: A Decoy Drone and a Hero on the board, with the Drone closer to an enemy
  - When: The enemy evaluates F1 (Nearest-Threat)
  - Then: The enemy selects the Decoy Drone as its target.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/heroes-and-abilities/decoy-drone_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: None
