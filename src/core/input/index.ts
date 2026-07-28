/**
 * Input & Selection — public module surface.
 *
 * Implements: design/gdd/input-and-selection.md
 * Governing ADR: docs/architecture/adr-0009-reachable-tiles-coordinate-transform.md
 *
 * Built: Story 001 (coordinate transform) and Story 002 (selection state
 * machine). Story 003 (Locked-state buffering) and Story 004 (keyboard
 * operability) are not yet implemented and are intentionally absent.
 */

// ── Story 001: coordinate transform ──────────────────────────────────────────
export type { ViewTransform, ScreenPoint } from './coordinate-transform.js';
export { screenToTile, tileToScreenCenter } from './coordinate-transform.js';

// ── Story 002: selection state machine ───────────────────────────────────────
export * from './selection-types.js';
export * from './selection-events.js';
export * from './selection-result.js';
export * from './selection-config.js';
export * from './selection-ports.js';
export * from './selection-state-machine.js';
export * from './click-precision.js';
