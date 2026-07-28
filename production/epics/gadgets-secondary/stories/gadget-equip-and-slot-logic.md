# Gadget Equip & Slot Logic

**Description:** Implement the Gadget schema and equip logic, integrating it into the hybrid Equipment slots on heroes. Enforce class restrictions and slot limits.

## Acceptance Criteria
1. `GadgetDefinition` schema is implemented.
2. Gadgets can be equipped into a hero's `EquipmentSlot`.
3. Validation prevents a hero from equipping more than 1 Gadget.
4. Validation enforces `compatible: HeroId[]` class restrictions when equipping.
5. `HeroRunState` tracks `gadgetCooldown` and `gadgetUsesRemaining`.

**Story Type:** Logic
**Story Points:** 2
**Dependencies:** none (relies on Equipment Slot Data Model conceptually)
