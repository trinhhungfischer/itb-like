/**
 * Input & Selection — public module surface.
 *
 * Implements: design/gdd/input-and-selection.md
 * Governing ADR: docs/architecture/adr-0009-reachable-tiles-coordinate-transform.md
 *
 * Story 001 (Coordinate Transform Math) is the only Input & Selection surface
 * implemented so far. The selection state machine (Story 002), Locked-state
 * buffering (Story 003), and keyboard operability (Story 004) are not yet
 * built and are intentionally not re-exported here.
 */

export type { ViewTransform, ScreenPoint } from './coordinate-transform.js';
export { screenToTile, tileToScreenCenter } from './coordinate-transform.js';
