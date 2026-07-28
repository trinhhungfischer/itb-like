/**
 * Input & Selection — the selection state machine's own state/action shapes.
 *
 * Implements: design/gdd/input-and-selection.md "States and Transitions",
 * Core Rule 4, Edge Cases (Inspect).
 * Story: production/epics/input-selection/story-002-selection-state-machine.md
 */

import type { Tile, UnitId } from '../board/board-types.js';

/**
 * Which action-mode context `Targeting` is open for. `Move` is the one
 * always-available mode (per the unit's Move slot); an ability mode is
 * identified by its `abilityId`, read off the selected unit's `Unit` record
 * (Heroes & Abilities, not yet implemented — see `selection-ports.ts`'s doc
 * comment).
 */
export type ActionMode = { readonly kind: 'Move' } | { readonly kind: 'Ability'; readonly abilityId: string };

/**
 * A unit's side, mirroring ADR-0008's `Unit.team` discriminant
 * (`'hero' | 'enemy'`) exactly. Duplicated here (rather than imported) only
 * because Heroes & Abilities — the ADR-0008 owner of the real `Unit`
 * type — does not exist in `src/` yet; see `selection-ports.ts`'s doc
 * comment for the seam this is meant to close without a reshape once it
 * lands.
 */
export type Team = 'hero' | 'enemy';

/**
 * The subset of `Idle`/`UnitSelected` a read-only `Inspect` overlay can
 * return to on exit (click empty space, or Escape). `Inspect` itself is
 * never a valid `returnTo` target — it is never reachable from `Targeting`
 * (see the state machine's doc comment) or from another `Inspect`.
 */
export type ReturnableState = { readonly status: 'Idle' } | { readonly status: 'UnitSelected'; readonly unitId: UnitId };

/**
 * The full selection state machine (GDD "States and Transitions" table, plus
 * the `Inspect` read-only overlay documented only in Edge Cases / the
 * Battle HUD dependency row — see the implementer's report for why it is
 * modeled as a fifth top-level status rather than folded into the table's
 * four named rows).
 */
export type SelectionState =
  | { readonly status: 'Idle' }
  | { readonly status: 'UnitSelected'; readonly unitId: UnitId }
  | {
      readonly status: 'Targeting';
      readonly unitId: UnitId;
      readonly mode: ActionMode;
      /** Non-null only while `require_confirm_click=true` and a legal target has been armed but not yet confirmed. */
      readonly armedTarget: Tile | null;
    }
  | { readonly status: 'Locked' }
  | {
      readonly status: 'Inspect';
      readonly unitId: UnitId;
      readonly team: Team;
      /** State to resume when the read-only overlay is dismissed (click elsewhere / Escape). */
      readonly returnTo: ReturnableState;
    };
