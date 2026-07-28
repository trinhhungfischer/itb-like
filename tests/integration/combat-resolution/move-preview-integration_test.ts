// Combat Resolution — Story 006: Move Preview Integration
//
// Implements: production/epics/combat-resolution/story-006-move-preview-integration.md
// GDD: design/gdd/combat-resolution.md (Interactions: Move Preview)
// Governing ADR: docs/architecture/adr-0007-snapshot-undo-preview.md
//
// SCOPE NOTE: per this implementer's exclusive-scope instructions
// (`src/core/combat/**` and `tests/unit/combat-resolution/**` only), this
// file lives under tests/unit/combat-resolution/ rather than the
// tests/integration/combat-resolution/ path story-006.md's own "Test
// Evidence" section names — flagged in this implementer's report as a
// scope-vs-story-doc conflict, resolved in favor of the explicit task scope.
//
// ADR-0007's isolation mechanism: Board has no `committed` flag and no
// second "preview" resolve() implementation — the ONLY thing that keeps a
// dry run from leaking onto shared subscribers is (a) running resolve()
// against `board.snapshot()`/a `CombatState.snapshot()` instead of the live
// objects, and (b) injecting a fresh, private `EventBus` instance instead of
// the shared session bus. Nothing in the type system enforces (b) — a caller
// that forgets to pass a private bus WILL leak preview events onto the
// shared stream. This suite proves the mechanism works when used correctly.
//
// Naming: [system]_[feature]_test.ts / test_[scenario]_[expected].
// Deterministic: no RNG, no wall clock. Each test builds its own board/state.

import { describe, it, expect } from 'vitest'
import { makeBoard } from '../../../src/core/board/index.js'
import type { Board } from '../../../src/core/board/index.js'
import { EventBus } from '../../../src/core/events/event-bus.js'
import { resolve, CombatState } from '../../../src/core/combat/index.js'
import type { CombatEvent, CombatEventMap, EffectPrimitive } from '../../../src/core/combat/index.js'

/** Serializes every tile's occupant/terrain/hazard for whole-board equality assertions (Board has no `equals()`). */
function serializeBoard(board: Board): string {
  const rows: string[] = []
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      const tile = board.getTile(col, row)
      rows.push(`${col},${row}:${tile.terrain}:${tile.occupant ?? '-'}:${tile.hazard ?? '-'}`)
    }
  }
  return rows.join('|')
}

describe('combat-resolution: preview isolation (ADR-0007)', () => {
  it('test_resolve_on_a_snapshot_leaves_the_live_board_byte_identical', () => {
    const liveBoard = makeBoard()
    const liveState = CombatState.empty()
    liveBoard.place({ col: 1, row: 1 }, 'hero-1')
    liveState.registerUnit('hero-1', 10)
    const before = serializeBoard(liveBoard)

    const previewBoard = liveBoard.snapshot()
    const previewState = liveState.snapshot()
    resolve(previewBoard, previewState, [{ kind: 'push', targetId: 'hero-1', direction: 'E', distance: 3 }], {
      bus: new EventBus<CombatEventMap>(),
    })

    // The snapshot moved; the live board did not.
    expect(previewBoard.getOccupant(4, 1)).toBe('hero-1')
    expect(serializeBoard(liveBoard)).toBe(before)
    expect(liveBoard.getOccupant(1, 1)).toBe('hero-1')
    expect(liveState.getHp('hero-1')).toBe(10)
  })

  it('test_preview_resolve_emits_zero_events_onto_the_shared_session_bus', () => {
    const liveBoard = makeBoard()
    const liveState = CombatState.empty()
    liveBoard.place({ col: 1, row: 1 }, 'hero-1')
    liveState.registerUnit('hero-1', 10)

    const sessionBus = new EventBus<CombatEventMap>()
    const sessionBusEvents: CombatEvent[] = []
    sessionBus.on('displacement_complete', (e) => sessionBusEvents.push(e))
    sessionBus.on('damage_applied', (e) => sessionBusEvents.push(e))
    sessionBus.on('collision_resolved', (e) => sessionBusEvents.push(e))

    // A dry run must construct its OWN bus, never the shared one.
    const previewBus = new EventBus<CombatEventMap>()
    const previewBoard = liveBoard.snapshot()
    const previewState = liveState.snapshot()
    const previewEvents = resolve(
      previewBoard,
      previewState,
      [{ kind: 'push', targetId: 'hero-1', direction: 'E', distance: 3 }],
      { bus: previewBus },
    )

    // The preview's own return value/private bus DID observe the events...
    expect(previewEvents.length).toBeGreaterThan(0)
    // ...but the shared session bus structurally saw none of them (the silence IS the boundary).
    expect(sessionBusEvents).toEqual([])
  })

  it('test_preview_and_commit_of_the_same_effects_produce_identical_resulting_board_state', () => {
    const liveBoard = makeBoard()
    const liveState = CombatState.empty()
    liveBoard.place({ col: 1, row: 1 }, 'hero-1')
    liveState.registerUnit('hero-1', 10)
    liveBoard.place({ col: 4, row: 1 }, 'enemy-1')
    liveState.registerUnit('enemy-1', 6)
    const effects: EffectPrimitive[] = [{ kind: 'push', targetId: 'hero-1', direction: 'E', distance: 5 }]

    // Preview first, against a disposable snapshot.
    const previewBoard = liveBoard.snapshot()
    const previewState = liveState.snapshot()
    const previewEvents = resolve(previewBoard, previewState, effects, { bus: new EventBus<CombatEventMap>() })

    // Live board is unchanged by the preview, so committing now against it
    // is exactly the "unchanged live board" precondition Preview-Commit
    // Parity requires (ADR-0007 Decision point 4).
    const sessionBus = new EventBus<CombatEventMap>()
    const commitEvents = resolve(liveBoard, liveState, effects, { bus: sessionBus })

    expect(serializeBoard(liveBoard)).toBe(serializeBoard(previewBoard))
    expect(commitEvents).toEqual(previewEvents)
    expect(liveState.getHp('hero-1')).toBe(previewState.getHp('hero-1'))
    expect(liveState.getHp('enemy-1')).toBe(previewState.getHp('enemy-1'))
  })
})

describe('combat-resolution: resolve() is the atomic unit a post-chain snapshot observes (ADR-0007 point 3)', () => {
  it('test_a_single_resolve_call_completes_an_entire_chain_including_on_death_spawn_before_returning', () => {
    // Simulates the shape of an on-death "brood spawn": the killing blow and
    // its follow-up spawnUnit are both authored into ONE effects[] list, as
    // Enemy/Telegraph would compile them (GDD Rule 15). Because resolve() is
    // synchronous and never yields mid-loop, any snapshot a caller (e.g. Turn
    // & Phase Manager) takes AFTER resolve() returns is guaranteed to observe
    // the fully-resolved post-chain state — never a half-resolved one — with
    // no possibility of an external observer catching it between the kill
    // and the spawn.
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 2, row: 2 }, 'enemy-1')
    state.registerUnit('enemy-1', 1)

    const effects: EffectPrimitive[] = [
      { kind: 'damage', targetId: 'enemy-1', amount: 1 }, // the killing blow
      { kind: 'spawnUnit', tile: { col: 2, row: 2 }, unitSpec: { id: 'brood-1', hp: 2 } }, // on-death follow-up
    ]
    const events = resolve(board, state, effects)

    // resolve() only returns once BOTH the death and the brood spawn have
    // applied — there is no earlier return point that stops mid-chain.
    expect(events).toEqual([
      { type: 'damage_applied', targetId: 'enemy-1', amount: 1, hp: 0 },
      { type: 'unit_removed', targetId: 'enemy-1', cause: 'Defeated', tile: { col: 2, row: 2 } },
      { type: 'unit_spawned', unitId: 'brood-1', tile: { col: 2, row: 2 }, unitSpec: { id: 'brood-1', hp: 2 } },
    ])

    // A snapshot taken now (post-resolve(), exactly where ADR-0007 says the
    // caller must take it) captures the complete post-chain state.
    const postChainSnapshot = board.snapshot()
    expect(postChainSnapshot.getOccupant(2, 2)).toBe('brood-1')
    expect(state.hasUnit('enemy-1')).toBe(false)
    expect(state.hasUnit('brood-1')).toBe(true)
  })
})
