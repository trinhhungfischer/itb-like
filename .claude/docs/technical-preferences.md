# Technical Preferences

<!-- Populated by /setup-engine. Updated as the user makes decisions throughout development. -->
<!-- All agents reference this file for project-specific standards and conventions. -->

## Engine & Language

- **Engine**: Pure Web (no game engine — PixiJS for rendering only)
- **Language**: TypeScript (strict mode)
- **Rendering**: PixiJS 8.x (2D WebGL, Canvas2D fallback)
- **Physics**: None (deterministic grid, no physics engine)

## Input & Platform

<!-- Written by /setup-engine. Read by /ux-design, /ux-review, /test-setup, /team-ui, and /dev-story -->
<!-- to scope interaction specs, test helpers, and implementation to the correct input methods. -->

- **Target Platforms**: Web (PC desktop browsers — evergreen Chrome/Firefox/Edge/Safari)
- **Input Methods**: Keyboard/Mouse (primary), Touch (future consideration)
- **Primary Input**: Mouse (click to select unit, click to move/act)
- **Gamepad Support**: None (v1)
- **Touch Support**: Partial (layout responsive, not optimized)
- **Platform Notes**: No mobile-first optimization; desktop browsers are primary target. localStorage for persistence.

## Naming Conventions

- **Classes**: PascalCase (`BoardGrid`, `CombatResolver`)
- **Variables**: camelCase (`currentPhase`, `reachableTiles`)
- **Signals/Events**: snake_case string literals (`turn_started`, `action_applied`, `battle_ended`)
- **Files**: kebab-case (`board-grid.ts`, `combat-resolver.ts`)
- **Scenes/Prefabs**: N/A (no scene files — pure code)
- **Constants**: UPPER_SNAKE_CASE (`GRID_WIDTH`, `MAX_ACTIONS_PER_TURN`)

## Performance Budgets

- **Target Framerate**: 60 FPS
- **Frame Budget**: 16.67ms
- **Draw Calls**: <200 per frame (PixiJS batched sprites)
- **Memory Ceiling**: 256MB heap (browser tab)

## Testing

- **Framework**: Vitest (headless TS unit/integration tests)
- **Minimum Coverage**: 80% for simulation core (Foundation + Core layers)
- **Required Tests**: Balance formulas, combat resolution, deterministic replay, board state snapshots

## Forbidden Patterns

<!-- Add patterns that should never appear in this project's codebase -->
- `any` type usage (use `unknown` + type guards)
- Direct DOM manipulation in simulation code (sim is pure, Pixi is the only rendering path)
- `Math.random()` anywhere (use mulberry32 seeded PRNG per ADR-0004)
- Mutable global state (all state owned by explicit system modules)
- Async in the event bus (synchronous only per ADR-0002)
- Presentation layer importing/calling simulation mutation functions

## Allowed Libraries / Addons

<!-- Add approved third-party dependencies here -->
- **pixi.js** ^8.x — 2D WebGL rendering
- **vite** ^6.x — build tool / dev server / HMR
- **vitest** ^3.x — test runner
- **@pixi/sound** — audio (optional, v1 advisory)

## Architecture Decisions Log

<!-- Quick reference linking to full ADRs in docs/architecture/ -->
- ADR-0001: Board Tile State Snapshot
- ADR-0002: Deterministic Event Bus
- ADR-0003: Run Persistence Save Schema
- ADR-0004: Mulberry32 Seed Strategy
- ADR-0005: Board Combat Error Contract
- ADR-0006: Combat Resolve Single Mutation Path
- ADR-0007: Snapshot Undo Preview
- ADR-0008: Shared Unit Record
- ADR-0009: Reachable Tiles Coordinate Transform
- ADR-0010: Difficulty Tier Ownership
- ADR-0011: Environmental Telegraph Query
- ADR-0012: Ironman Run Commitment (pilot-death durability)

## Engine Specialists

<!-- Written by /setup-engine when engine is configured. -->
<!-- Read by /code-review, /architecture-decision, /architecture-review, and team skills -->
<!-- to know which specialist to spawn for engine-specific validation. -->

- **Primary**: N/A (pure web — no engine-specific specialist)
- **Language/Code Specialist**: TypeScript (strict mode)
- **Shader Specialist**: N/A (no custom shaders in v1 — PixiJS built-in filters only)
- **UI Specialist**: PixiJS UI / HTML overlay (TBD per implementation)
- **Additional Specialists**: None
- **Routing Notes**: All code review routes through a single TypeScript reviewer. No engine-specific agents apply.

### File Extension Routing

<!-- Skills use this table to select the right specialist per file type. -->
<!-- If a row says [TO BE CONFIGURED], fall back to Primary for that file type. -->

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (`.ts`) | TypeScript reviewer |
| Shader / material files | N/A (no custom shaders) |
| UI / screen files (`.ts`) | TypeScript reviewer |
| Scene / prefab / level files | N/A (no scene files) |
| Native extension / plugin files | N/A |
| General architecture review | Primary (TypeScript reviewer) |
