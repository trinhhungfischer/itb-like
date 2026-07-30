# Battle HUD Inspect Evidence

## Test Cases

### AC-1: Inspect panel toggle
- **Setup**: Serve via `npm run dev` and press and hold the Alt key (mocked interaction).
- **Verify**: The Inspect Panel appears with read-only stats (HP, Attack, Speed, Next Turn Intents) and `#zone-c` (Ability Bar) opacity drops to 0.5 to not permanently obscure the HUD.
- **Pass condition**: Releasing the Alt key dismisses the panel and `#zone-c` returns to full opacity.

## Implementation Details

- **Inspect Panel**: Added as `#inspect-panel` in `BattleHud.ts` and styled in `inspect-panel.css`. It uses absolute positioning at the center with a backdrop filter.
- **Interactions**: Keydown listener for `Alt` triggers `showInspectPanel` with mock data, keyup listener hides it.
- **Integration**: Loaded into `main.ts` alongside all other HUD components.

## Status
- [x] Passed Manual Walkthrough
