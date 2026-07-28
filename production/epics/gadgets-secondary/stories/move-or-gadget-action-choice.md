# Move or Gadget Action Choice

**Description:** Modify the Turn & Phase Manager and Input & Selection systems to allow the player to choose between 'Move' and 'Gadget' for their first action slot. Follow ADR-0013.

## Acceptance Criteria
1. The `resolveSlot1` method accepts either a "move" or "gadget" action.
2. The Input UI provides a toggle/button to select the Gadget instead of normal Move when a Gadget is equipped and available.
3. Using a Gadget successfully consumes the Move slot for the turn.
4. The hero still gets to use their Signature Ability in the second slot after using a Gadget.
5. The Gadget compiles to the same `EffectPrimitive[]` as a normal ability and resolves correctly.

**Story Type:** Logic
**Story Points:** 5
**Dependencies:** Gadget Equip & Slot Logic
