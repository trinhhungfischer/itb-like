/**
 * Move Preview — the pure lifecycle-state transition table.
 *
 * Implements: design/gdd/move-preview.md "States and Transitions" verbatim:
 * `Idle -> Computing -> Ready -> {Stale -> Computing | Discarded -> Idle |
 * Committed -> Idle}`.
 *
 * Kept as a standalone pure function (rather than inlined into
 * `move-preview.ts`'s class, unlike `SelectionStateMachine`'s switch-based
 * style) because two of the GDD's six named states — `Stale` and
 * `Committed` — are, by this implementation's own synchronous design,
 * momentary: a caller of `MovePreview` never observes them mid-cascade (see
 * `move-preview.ts`'s class doc comment). Exporting the transition table on
 * its own lets `tests/unit/move-preview/preview-lifecycle_test.ts` assert
 * every row of the GDD table directly and exhaustively, independent of
 * whether the class happens to expose an intermediate state externally.
 *
 * **Judgement call — flagged per this implementer's report instructions.**
 * The GDD's table gives `Computing` no named failure exit: "`Ready` (compute
 * succeeds) **or the confirm action stays blocked (Rule 10) if it fails**" —
 * prose describing an *effect* (confirm blocked), not a *state*. No row
 * names what state a failed compute leaves the machine in. Resolved here:
 * `compute_failed` transitions `Computing -> Idle`. `Idle` ("no candidate
 * action exists; nothing to preview") is the only table state whose meaning
 * satisfies Rule 10's requirement that a failed compute must never leave a
 * `Ready`-looking preview behind — and it is a state the table already
 * defines, so this does not invent a seventh state, only picks the correct
 * one of the existing six for an under-specified edge. Flagged for
 * `game-designer`/`systems-designer` to confirm or amend the GDD.
 */

import type { PreviewLifecycleState } from './preview-types.js';

/**
 * Every trigger that can move the lifecycle. Names the *cause*, not the
 * destination — the destination is this module's own decision, computed
 * below, exactly mirroring the GDD table's "Entered when" column.
 */
export type PreviewLifecycleEvent =
  /** Rule 1/4a: a legal candidate action formed from `Idle` (no candidate previously existed). */
  | { readonly type: 'candidate_formed' }
  /** Rule 4a: the candidate itself changed (different ability/target/direction) while a result was `Ready` or already `Stale`. */
  | { readonly type: 'candidate_changed' }
  /** Rule 4b: the live board mutated out from under an existing `Ready` result. */
  | { readonly type: 'board_mutated' }
  /** Rule 4: the immediate recompute a `Stale` result triggers. */
  | { readonly type: 'recompute_started' }
  /** `resolve()` over the disposable snapshot returned successfully. */
  | { readonly type: 'compute_succeeded' }
  /** `resolve()` (or the dry-run harness around it) failed — an implementation fault, not a gameplay path (Rule 10). See this file's judgement-call doc comment. */
  | { readonly type: 'compute_failed' }
  /** Rule 6: candidate cancelled/deselected — zero board effect. */
  | { readonly type: 'cancelled' }
  /** Rule 7: the player confirmed a `Ready` candidate. */
  | { readonly type: 'confirmed' }
  /** The unconditional `Discarded -> Idle` / `Committed -> Idle` exit the table names with no further trigger of its own. */
  | { readonly type: 'settled' };

/**
 * Pure, total, defensive transition function: an event that does not apply
 * to `current` (e.g. `confirmed` while `Idle`) is a no-op, returning `current`
 * unchanged, rather than throwing — this machine has no Channel-2 invariant
 * of its own to enforce; callers compose events, so an inapplicable one
 * simply reflects a caller that already handled the case (see
 * `move-preview.ts`).
 */
export function transitionPreviewState(
  current: PreviewLifecycleState,
  event: PreviewLifecycleEvent,
): PreviewLifecycleState {
  switch (event.type) {
    case 'candidate_formed':
      return current === 'Idle' ? 'Computing' : current;
    case 'candidate_changed':
      return current === 'Ready' || current === 'Stale' ? 'Stale' : current;
    case 'board_mutated':
      return current === 'Ready' ? 'Stale' : current;
    case 'recompute_started':
      return current === 'Stale' ? 'Computing' : current;
    case 'compute_succeeded':
      return current === 'Computing' ? 'Ready' : current;
    case 'compute_failed':
      return current === 'Computing' ? 'Idle' : current;
    case 'cancelled':
      return current === 'Ready' || current === 'Stale' || current === 'Computing' ? 'Discarded' : current;
    case 'confirmed':
      return current === 'Ready' ? 'Committed' : current;
    case 'settled':
      return current === 'Discarded' || current === 'Committed' ? 'Idle' : current;
  }
}
