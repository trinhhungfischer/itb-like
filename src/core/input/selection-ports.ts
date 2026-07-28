/**
 * Input & Selection — dependency-injection ports the state machine queries.
 *
 * Implements: design/gdd/input-and-selection.md Core Rule 7 ("Action
 * availability is queried, not owned"), Dependencies table rows for
 * Heroes & Abilities and Combat Resolution.
 *
 * **Judgement call — flagged per the story's report instructions.** The GDD
 * requires querying Heroes & Abilities' real surface (`legalMoveTiles`,
 * `legalTargets`, the selected unit's `Unit` record slot-used state) and,
 * for a commit, ultimately reaching Combat Resolution "only through the
 * owning ability." Neither Heroes & Abilities nor Combat Resolution exist
 * under `src/` yet (both are `Status: Designed`, not implemented) — there is
 * nothing concrete to import. Rather than reach into a nonexistent module or
 * hand-rolling a second copy of the eventual `Unit` shape, this file
 * declares the **minimal structural ports** the state machine needs,
 * injected via `SelectionDeps` (constructor DI, matching
 * `TurnPhaseManagerDeps`'s pattern) — mirroring exactly how
 * `TurnPhaseManagerDeps` already injects `CombatResolver`/`EnemyDriver` as
 * interfaces the concrete Combat/Enemy modules will one day satisfy, not
 * import.
 *
 * When Heroes & Abilities lands (ADR-0008's canonical `Unit` record) and
 * Combat Resolution lands (ADR-0006's `resolve()`), their owners should wire
 * concrete implementations of {@link UnitLookup}, {@link TargetLegalityQuery},
 * and {@link ActionCommitter} against the real `Unit`/`resolve()` surface —
 * this file's shapes are intentionally small (a strict subset of ADR-0008's
 * `Unit` fields plus one derived boolean) specifically so that wiring is a
 * thin adapter, not a redesign. This module must **not** be treated as a
 * second owner of the `Unit` schema (ADR-0008's C2 concern) — it is a
 * temporary seam, not a competing type.
 */

import type { Board } from '../board/board-interface.js';
import type { Tile, UnitId } from '../board/board-types.js';
import type { ActionMode, Team } from './selection-types.js';

/**
 * The strict subset of ADR-0008's canonical `Unit` record this module needs:
 * `id` and `team` verbatim, plus one derived field not on `Unit` itself.
 * `actingEligible` stands in for "has ≥1 action remaining this Player Phase
 * (Move and/or an unused ability)" (GDD Core Rule 7's "slot-used state"),
 * collapsed to a single boolean because story-002 does not need per-slot
 * (Move vs. a specific ability) granularity — only whether the unit is a
 * legal `UnitSelected`/`chooseMode` target at all. A future Heroes-backed
 * implementation may need to expose per-slot detail for the HUD's action-bar
 * graying (GDD Edge Cases); that is additive, not a breaking change here.
 */
export interface UnitInfo {
  readonly id: UnitId;
  readonly team: Team;
  readonly actingEligible: boolean;
}

/** Resolves board tiles / known ids to {@link UnitInfo}. Stands in for a future Heroes & Abilities-backed lookup over the canonical `Unit` record. */
export interface UnitLookup {
  /** The unit occupying `tile` on `board`, or `null` if the tile is empty. */
  unitAt(tile: Tile, board: Board): UnitInfo | null;
  /** Info for a known unit id, or `null` if it no longer exists (e.g. removed since selection — defensive re-validation). */
  unit(unitId: UnitId, board: Board): UnitInfo | null;
}

/**
 * Stands in for Heroes & Abilities' `legalMoveTiles(origin, moveRange, board)`
 * (F1) and `legalTargets(caster, ability, board)` (F2), collapsed to a single
 * membership test since the state machine only ever needs "is this one
 * candidate tile legal," never the full highlight set (highlighting is Board
 * Rendering & Juice's concern, fed by Heroes' real F1/F2 directly — Input &
 * Selection does not fan those sets out itself, per Core Rule 7).
 */
export interface TargetLegalityQuery {
  isLegalTarget(unitId: UnitId, mode: ActionMode, target: Tile, board: Board): boolean;
}

/** Outcome of a commit, standing in for the eventual ability → `Combat.resolve()` call chain. */
export type CommitOutcome =
  | { readonly committed: true; readonly unitHasActionsRemaining: boolean }
  | { readonly committed: false };

/**
 * Stands in for "the owning ability, which itself calls `Combat.resolve()`"
 * (GDD: "Input & Selection never calls Combat primitives directly — always
 * through the owning ability"). Input & Selection calls this exactly once
 * per confirmed commit and never touches `Board` mutation methods itself.
 */
export interface ActionCommitter {
  commit(unitId: UnitId, mode: ActionMode, target: Tile, board: Board): CommitOutcome;
}
