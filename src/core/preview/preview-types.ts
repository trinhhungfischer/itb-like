/**
 * Move Preview — public data shapes.
 *
 * Implements: design/gdd/move-preview.md "States and Transitions", Rules 1-3, 8.
 * Governing ADRs: docs/architecture/adr-0007-snapshot-undo-preview.md,
 * docs/architecture/adr-0006-combat-resolve-single-mutation-path.md.
 *
 * SCOPE NOTE: this Sprint implements story-001 (dry-run mechanism) and
 * story-002 (subscription lifecycle) only. story-003 (threat-overlay
 * cross-reference, Rule 9 / Formula F3) is explicitly out of scope — no
 * `threatened` flag appears anywhere in this module.
 */

import type { Tile, UnitId } from '../board/board-types.js';
import type { ActionMode } from '../input/selection-types.js';
import type { CombatEvent } from '../combat/index.js';
import type { EffectPrimitive } from '../combat/index.js';

/**
 * The six named states of the GDD's "States and Transitions" table.
 * `Stale` and `Committed` are momentary by construction in this
 * implementation (see `move-preview.ts` class doc comment) — the GDD itself
 * says Stale "exists for testability... not as a UI-visible state distinct
 * from Computing" (move-preview.md, States and Transitions, closing note).
 */
export type PreviewLifecycleState = 'Idle' | 'Computing' | 'Ready' | 'Stale' | 'Discarded' | 'Committed';

/**
 * Identifies *what* is being previewed: a specific hero/unit, an action
 * mode (Move or a named ability), and a target tile. Two candidates with
 * identical `(unitId, mode, target)` are the same candidate (GDD Rule 4 —
 * "candidate action itself changes" means one of these three differs).
 */
export interface PreviewCandidate {
  readonly unitId: UnitId;
  readonly mode: ActionMode;
  readonly target: Tile;
}

/**
 * The "structured preview result" the GDD Overview promises: "an event log
 * plus a derived visual diff." This implementation exposes the full,
 * unfiltered, ordered `CombatEvent[]` `resolve()` returned for the dry run —
 * every unit an effect chain touches has its own events in this list, so
 * Rule 8's multi-target completeness ("a distinct entry for every one of the
 * N units") is a direct corollary of returning the log unfiltered, not a
 * separately-maintained per-unit projection.
 *
 * A richer, presentation-facing "visual diff" object (aggregated positions/
 * HP-deltas/death-cause-per-unit, independent of having to replay the event
 * log) is deliberately NOT built here — neither story-001 nor story-002's
 * acceptance criteria require it, Board Rendering & Juice is unimplemented,
 * and building a second data shape ahead of its only consumer risks guessing
 * that consumer's needs wrong. See this implementer's report.
 */
export interface PreviewResult {
  readonly candidate: PreviewCandidate;
  /** The exact, already-legal effect chain the dry run was run against (GDD Rule 2 — never re-derived from the event log). */
  readonly effects: readonly EffectPrimitive[];
  /** The complete, ordered event log `resolve()` returned for this candidate over a disposable snapshot. */
  readonly events: readonly CombatEvent[];
}
