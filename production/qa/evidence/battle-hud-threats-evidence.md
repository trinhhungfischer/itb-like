# Battle HUD Threats Evidence

## Test Cases

### AC-1: Threat ticker aggregation
- **Setup**: Simulated 2 enemies telegraphing attacks in `main.ts` using `populateThreats` and `renderEnemyHpBars`.
- **Verify**: Ticker shows 2 incoming threat summaries on the right edge.
- **Pass condition**: Icons match the exact shape and verb-color of the attacks (mocked as intent accent colors). Lethal threats have a red accent. Enemy HP bars float at assigned screen coordinates.

## Implementation Details

- **Zone D**: Created via `BattleHud.ts` injecting DOM elements. Anchored right `top: 50%; right: 24px;`.
- **Enemy HP**: Added a `floating-layer` to `#battle-hud` which allows attaching HP bars above absolute screen coordinates.
- **Styling**: `zone-d.css` handles the animation and layout of the cards and floating bars.

## Status
- [x] Passed Manual Walkthrough
