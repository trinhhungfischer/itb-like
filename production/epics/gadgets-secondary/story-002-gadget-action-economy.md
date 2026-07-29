# Story 002: Gadget Action Economy

> **Epic**: Gadgets & Secondary Weapons
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Completion Notes
**Completed**: 2026-07-29
**Criteria**: 3/3 passing
**Deviations**: None
**Test Evidence**: tests/unit/heroes-and-abilities/gadget-action-economy_test.ts
**Code Review**: Skipped

## Context

**GDD**: `design/content/secondary-weapons-and-gadgets.md`
**Requirement**: `TR-GADGET-003`

**ADR Governing Implementation**: ADR-0013: Gadget action slot
**ADR Decision Summary**: Gadgets consume the Ability action slot, not the Move slot. This preserves the 2-action economy (Move + Ability or Gadget).

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: 

**Control Manifest Rules (this layer)**:
- Required: All board mutation must flow exclusively through Combat resolve()
- Forbidden: Expected gameplay rejections must never throw

---

## Acceptance Criteria

*From GDD `design/content/secondary-weapons-and-gadgets.md`, scoped to this story:*

- [ ] Gadget use consumes the Ability action slot.
- [ ] Hero retains their Move action before or after Gadget use.
- [ ] Gadgets observe their `cooldownTurns` and `usesPerBattle` before allowing selection.

---

## Implementation Notes

*Derived from ADR-0013 Implementation Guidelines:*

Implement `ActionSystem.consumeAbilitySlot(heroId: string, source: 'innate' | 'gadget')`. When a hero uses a Gadget, it uses their Ability action for that turn, preserving their Move action. Ensure UI and action availability checks correctly disable the innate Ability button for the turn when a Gadget is used.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 001: Schema definition.
- Story 005: Draft and shop integration.

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-1**: Gadget consumes Ability slot
  - Given: A hero with an equipped Gadget that is off cooldown
  - When: The hero uses the Gadget
  - Then: The hero's Ability slot is marked as used for the turn, but the Move slot remains available.

- **AC-2**: Cooldown constraint
  - Given: A hero with a Gadget on cooldown
  - When: The player attempts to use the Gadget
  - Then: The Gadget cannot be selected and an expected gameplay rejection is returned.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/heroes-and-abilities/gadget-action-economy_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 must be DONE
- Unlocks: None
