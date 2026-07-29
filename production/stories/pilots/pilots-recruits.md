# Story: Pilots Mid-Run Recruits
> **Epic**: pilots
> **Type**: Logic
> **Estimate**: 1 days
> **Status**: Complete
> **Last Updated**: 2026-07-29
## Objective
Handle recruiting pilots mid-run, including base XP scaling based on current run depth.

## Requirements
- F7 seed XP logic for mid-run recruits

## Acceptance Criteria
- [x] New recruits receive correct base XP depending on current zone
- [x] Tests pass

## Completion Notes
- F7 (Seed XP) is fully implemented in `getSeedXP()` inside `src/feature/pilots/pilots.ts`.
- Verified logic via unit tests in `tests/unit/pilots/pilots_test.ts`.
