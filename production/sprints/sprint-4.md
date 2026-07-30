# Sprint 4 Plan — Presentation & UI Integration

## Sprint Goal
Integrate PIXI.js to render the Engine board state, establish the Battle HUD overlay, and implement the core interaction patterns (Move Preview, Selection) for a complete tactical UX.

## Capacity
- Total days: 25
- Buffer (20%): 5 days reserved for unplanned work
- Available: 20 days

## Tasks

### Must Have (Critical Path)
| ID | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|----|------|-------------|-----------|-------------|-------------------|
| pixi-renderer-board | PIXI Board & Tile Rendering | | 3 | | PIXI canvas initializes and draws the grid, tiles, and static environment based on Engine state |
| pixi-renderer-entities | Entity & State Rendering | | 3 | pixi-renderer-board | Heroes and enemies are rendered at their correct coordinates with health bars |
| battle-hud-layout | HUD Layout & Zones A-B-E | | 2 | | Zones A (Turn), B (Objective), and E (End Turn) are positioned and styled |
| battle-hud-roster | HUD Zone C (Ability Bar) | | 2 | battle-hud-layout | Bottom hero roster displays living heroes, abilities, and responds to selection |
| battle-hud-threats | HUD Zone D (Threat Ticker) | | 2 | battle-hud-layout | Threat ticker and enemy intent telegraphs render correctly on screen |
| interaction-selection | Selection State Machine | | 3 | | Clicking heroes selects them, hovering valid targets shows legal tiles, input is buffered |

### Should Have
| ID | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|----|------|-------------|-----------|-------------|-------------------|
| pixi-renderer-juice | Basic Animations & Juice | | 2 | pixi-renderer-entities | Movements and attacks have basic tween animations rather than snapping |
| battle-hud-inspect | Unit Inspect Panel | | 1 | battle-hud-layout | Alt-click opens the read-only inspect panel over the HUD |
| interaction-preview | Move Preview Overlay | | 2 | interaction-selection | Hovering a target dry-runs the combat and shows consequences without mutating state |
| interaction-undo | Undo/Redo & Confirm | | 2 | | Ctrl+Z/Y undo/redo works, End Turn warns if hero is in danger |

### Nice to Have
| ID | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|----|------|-------------|-----------|-------------|-------------------|
| | | | | | |

## Carryover from Previous Sprint
| Task | Reason | New Estimate |
|------|--------|-------------|
| Pilots System Implementation | Deprioritized for UX focus | 3 |
| Node Bonuses Implementation | Deprioritized for UX focus | 2 |
| Accessibility Thresholds & Gates | Deprioritized for UX focus | 1 |
| Settings Domain & Persistence | Deprioritized for UX focus | 1 |

## Risks
| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| PIXI.js performance issues with large grids | Low | Medium | Use sprite pooling and culling if necessary |
| Move preview state mutation bug | Medium | High | Ensure deep-copy of Engine state during dry-run |

## Dependencies on External Factors
- Requires core Engine state to be stable

## Definition of Done for this Sprint
- [ ] All Must Have tasks completed
- [ ] All tasks pass acceptance criteria
- [ ] QA plan exists (`production/qa/qa-plan-sprint-4.md`)
- [ ] All Logic/Integration stories have passing unit/integration tests
- [ ] Smoke check passed (`/smoke-check sprint`)
- [ ] QA sign-off report: APPROVED or APPROVED WITH CONDITIONS (`/team-qa sprint`)
- [ ] No S1 or S2 bugs in delivered features
- [ ] Design documents updated for any deviations
- [ ] Code reviewed and merged
