# Story 005: Draft Pool Integration

> **Epic**: Gadgets & Secondary Weapons
> **Status**: Ready
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/content/secondary-weapons-and-gadgets.md`
**Requirement**: `TR-GADGET-006`

**ADR Governing Implementation**: N/A
**ADR Decision Summary**: Meta integration.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: 

**Control Manifest Rules (this layer)**:
- Required: Variety must live entirely in a pre-battle, reproducible meta layer.

---

## Acceptance Criteria

*From GDD `design/content/secondary-weapons-and-gadgets.md`, scoped to this story:*

- [ ] Add Gadgets to Draft reward pools (Battle, Elite, Boss).
- [ ] Add Gadgets to the Shop, costing exactly 3 Reputation.
- [ ] Ensure Draft respects Gadget `compatible` fields when offering to specific heroes.

---

## Implementation Notes

Update the reward pool generators and Shop population logic to include Gadgets alongside Ability Upgrades and Passive Modules. Verify determinism is maintained.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 001: Gadget schema definition.

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-1**: Draft reward pool
  - Given: The player completes an Elite battle
  - When: The reward screen is generated
  - Then: Gadgets are valid candidates in the reward pool.

- **AC-2**: Shop cost
  - Given: The player enters the Shop
  - When: A Gadget is offered
  - Then: It costs exactly 3 Reputation.

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `tests/integration/draft-and-loadout-meta/gadget-draft_test.ts` OR playtest doc

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 must be DONE
- Unlocks: None
