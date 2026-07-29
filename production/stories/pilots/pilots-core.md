# Story: Pilots System Implementation
> **Epic**: pilots
> **Type**: Logic
> **Estimate**: 3 days
> **Status**: Complete
> **Last Updated**: 2026-07-29
## Objective
Implement Alpha progression mechanics via the Pilots system, action economy scaling, level-ups, and permanent death.

## Requirements
- Gain XP based on encounters
- Handle level-up logic and permanent death state
- Connect to persistence layer

## Acceptance Criteria
- [x] Pilot levels up correctly when XP threshold is met
- [x] Pilot death triggers appropriate state reset
- [x] Tests pass

## Completion Notes
- Implemented core pilots mechanics in `src/feature/pilots/pilots.ts` (Formulas F1, F2, F3, F4, F6, F8).
- Wrote full unit test coverage in `tests/unit/pilots/pilots_test.ts`.
- Validated F7 logic (Seed XP) as part of pilots system.
