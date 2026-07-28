# Equipment Slot Data Model

**Description:** Implement the data model for the 2 hybrid equipment slots on heroes, capable of holding either Passive Modules or Gadgets. Update the HeroDefinition and HeroRunState.

## Acceptance Criteria
1. `HeroRunState` has `equipmentSlots: [EquipmentSlot, EquipmentSlot]`.
2. `EquipmentSlot` can hold `PassiveModule`, `Gadget`, or `null`.
3. An equipment slot can only hold a maximum of 1 Gadget per hero across both slots.
4. Validation prevents equipping duplicate modules/gadgets on the same hero, or the same module/gadget across different heroes.

**Story Type:** Logic
**Story Points:** 2
**Dependencies:** None
