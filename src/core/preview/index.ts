/**
 * Move Preview — public module surface.
 *
 * Implements: design/gdd/move-preview.md
 * Governing ADRs: docs/architecture/adr-0007-snapshot-undo-preview.md,
 * docs/architecture/adr-0006-combat-resolve-single-mutation-path.md.
 *
 * Built: story-001 (dry-run mechanism) and story-002 (subscription
 * lifecycle). story-003 (threat-overlay cross-reference) is not yet
 * implemented and is intentionally absent.
 */

export type { PreviewLifecycleState, PreviewCandidate, PreviewResult } from './preview-types.js';
export type { EffectCompiler } from './preview-ports.js';
export type { PreviewLifecycleEvent } from './preview-lifecycle.js';
export { transitionPreviewState } from './preview-lifecycle.js';
export { MovePreview } from './move-preview.js';
export type { MovePreviewDeps } from './move-preview.js';
