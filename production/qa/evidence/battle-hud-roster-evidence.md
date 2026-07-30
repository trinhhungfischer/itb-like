# Battle HUD Roster Evidence

## Test Cases

### AC-1: Ability bar population
- **Setup**: Load battle with 3 heroes (simulated in `main.ts`).
- **Verify**: 3 cards are displayed horizontally along the bottom center in `#zone-c`.
- **Pass condition**: HP bars match unit data, ability icons show correct verb-family colors, and the active hero is highlighted. Clicking a hero updates the active highlighted card.

## Implementation Details

- **Zone C**: Created via `BattleHud.ts` which injects DOM elements dynamically.
- **Styling**: Uses flexbox for horizontal layout at `bottom: 24px; left: 50%;`.
- **Data Binding**: Roster populated using a simple array of `HeroData` objects.

## Status
- [x] Passed Manual Walkthrough
