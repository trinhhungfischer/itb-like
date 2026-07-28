/**
 * Move Preview — dependency-injection seam for the not-yet-implemented
 * Heroes & Abilities compilation step.
 *
 * Implements: design/gdd/move-preview.md Rule 1 ("a candidate action is a
 * fully-specified, already-legal ordered EffectPrimitive[] chain, compiled
 * by Heroes & Abilities... from a selected hero ability plus a selected
 * target"), Rule 5 ("Move Preview never computes ability legality... it only
 * ever receives already-legal candidate effect chains").
 *
 * **Judgement call — flagged per this implementer's report instructions.**
 * Input & Selection's `hover` event (`selection-events.ts`) carries only
 * `{unitId, mode, tile}` — never a compiled `EffectPrimitive[]`. The GDD's
 * own Interactions table has Move Preview *reading/calling*
 * `compileEffects()` on Heroes & Abilities directly (a pull, not something
 * riding along on Input's event payload) — so this gap is expected by
 * design, not a bug in Input & Selection. But Heroes & Abilities does not
 * exist under `src/` yet (`Status: Designed`, not implemented), so there is
 * nothing concrete to call.
 *
 * This file declares the minimal structural port Move Preview needs,
 * mirroring — deliberately, down to the reasoning — the identical seam
 * `src/core/input/selection-ports.ts` already established for the same
 * missing dependency (`TargetLegalityQuery`/`ActionCommitter`). When Heroes &
 * Abilities lands, its owner should wire a concrete `EffectCompiler` against
 * the real `compileEffects()`/`legalTargets()` surface; this file's shape is
 * intentionally the smallest structural slice so that wiring is a thin
 * adapter, not a redesign. This module must not be treated as a second
 * owner of ability-legality logic.
 */

import type { Board } from '../board/board-interface.js';
import type { Tile, UnitId } from '../board/board-types.js';
import type { ActionMode } from '../input/selection-types.js';
import type { EffectPrimitive } from '../combat/index.js';

/**
 * Stands in for Heroes & Abilities' `compileEffects()` (GDD Rule 1/5,
 * Interactions table). Returns the already-legal, ordered effect chain for
 * `unitId` performing `mode` targeting `target`, or `null` if no legal
 * candidate exists for that combination — the caller (Move Preview) must
 * treat `null` exactly as Rule 5 describes: "simply never invoked," i.e. no
 * `Computing`/`Ready` state is entered and no prior preview is disturbed.
 *
 * `null` is deliberately distinct from an empty array `[]`: `[]` is a legal
 * "no consequence" candidate (GDD Edge Cases — equivalent to Combat
 * Resolution's own empty-chain "pass" case) and MUST still produce a Ready
 * preview; only `null` means "not a legal candidate at all."
 */
export interface EffectCompiler {
  compileEffects(unitId: UnitId, mode: ActionMode, target: Tile, board: Board): readonly EffectPrimitive[] | null;
}
