// Board & Grid — Story 002: Board Snapshot
//
// Implements: production/epics/board-grid/story-002-board-snapshot.md
// GDD: design/gdd/board-and-grid.md (snapshot() acceptance criteria, Performance Budget)
// Governing ADR: docs/architecture/adr-0001-board-tile-state-snapshot.md
//
// Covers: deep-copy independence in both directions (mutate copy does not
// touch live; mutate live after snapshot does not retroactively touch the
// snapshot — the guarantee ADR-0007's undo/adopt-a-prior-snapshot model
// depends on), round-trip field fidelity, byte-identical determinism across
// two identically-constructed boards, and the < 1 ms/call performance budget.
//
// Naming: [system]_[feature]_test.ts / test_[scenario]_[expected].
// Deterministic: no RNG. Timing assertion uses a generous, spec-derived
// threshold (GDD Performance Budget), not a flaky micro-bound.

import { describe, it, expect } from 'vitest'
import { makeBoard } from '../../../src/core/board/board.js'
import { TerrainType } from '../../../src/core/board/board-types.js'
import type { Board } from '../../../src/core/board/board-interface.js'

/** Compares two boards field-by-field over every tile (used for determinism/independence checks). */
function boardsEqual(a: Board, b: Board): boolean {
  if (a.width !== b.width || a.height !== b.height) return false
  for (let col = 0; col < a.width; col++) {
    for (let row = 0; row < a.height; row++) {
      const ta = a.getTile(col, row)
      const tb = b.getTile(col, row)
      if (ta.terrain !== tb.terrain) return false
      if (ta.hazard !== tb.hazard) return false
      if (ta.occupant !== tb.occupant) return false
      if (ta.flags.length !== tb.flags.length) return false
      if (ta.flags.slice().sort().join() !== tb.flags.slice().sort().join()) return false
    }
  }
  return true
}

describe('board-and-grid: snapshot independence', () => {
  it('test_mutating_the_copy_leaves_the_live_board_unchanged', () => {
    const live = makeBoard()
    live.place({ col: 1, row: 1 }, 'hero-1')
    const copy = live.snapshot()

    copy.place({ col: 2, row: 2 }, 'hero-2')
    copy.setTerrain({ col: 3, row: 3 }, TerrainType.Blocked)
    copy.setHazard({ col: 4, row: 4 }, 'fire')
    copy.setFlag({ col: 5, row: 5 }, 'objective')
    copy.clear({ col: 1, row: 1 })

    expect(live.isOccupied(2, 2)).toBe(false)
    expect(live.isBlocked(3, 3)).toBe(false)
    expect(live.getHazard(4, 4)).toBeNull()
    expect(live.hasFlag(5, 5, 'objective')).toBe(false)
    expect(live.getOccupant(1, 1)).toBe('hero-1')
  })

  it('test_mutating_the_live_board_after_snapshot_does_not_alter_the_snapshot', () => {
    const live = makeBoard()
    live.place({ col: 0, row: 0 }, 'hero-1')
    const snap = live.snapshot()

    live.place({ col: 1, row: 0 }, 'hero-2')
    live.setTerrain({ col: 2, row: 0 }, TerrainType.Chasm)
    live.setHazard({ col: 3, row: 0 }, 'smoke')
    live.setFlag({ col: 4, row: 0 }, 'spawn-point')
    live.clear({ col: 0, row: 0 })

    expect(snap.isOccupied(1, 0)).toBe(false)
    expect(snap.classify({ col: 2, row: 0 }).kind).toBe('Clear')
    expect(snap.getHazard(3, 0)).toBeNull()
    expect(snap.hasFlag(4, 0, 'spawn-point')).toBe(false)
    expect(snap.getOccupant(0, 0)).toBe('hero-1')
  })

  it('test_snapshot_preserves_every_field_at_capture_time', () => {
    const live = makeBoard()
    live.setTerrain({ col: 0, row: 0 }, TerrainType.BlockedDestructible)
    live.setHazard({ col: 1, row: 1 }, 'acid')
    live.setFlag({ col: 2, row: 2 }, 'deploy-zone')
    live.place({ col: 3, row: 3 }, 'enemy-9')

    const snap = live.snapshot()

    expect(snap.getTile(0, 0).terrain).toBe(TerrainType.BlockedDestructible)
    expect(snap.getTile(1, 1).hazard).toBe('acid')
    expect(snap.getTile(2, 2).flags).toContain('deploy-zone')
    expect(snap.getTile(3, 3).occupant).toBe('enemy-9')
  })
})

describe('board-and-grid: snapshot determinism', () => {
  it('test_two_identically_constructed_boards_with_identical_mutations_are_byte_identical', () => {
    const run = (): Board => {
      const b = makeBoard()
      b.setTerrain({ col: 1, row: 1 }, TerrainType.Blocked)
      b.setTerrain({ col: 2, row: 2 }, TerrainType.Chasm)
      b.place({ col: 0, row: 0 }, 'hero-1')
      b.place({ col: 7, row: 7 }, 'enemy-1')
      b.setHazard({ col: 3, row: 3 }, 'fire')
      b.setFlag({ col: 4, row: 4 }, 'objective')
      b.clear({ col: 0, row: 0 })
      b.place({ col: 0, row: 1 }, 'hero-1')
      return b
    }

    const a = run()
    const b = run()
    expect(boardsEqual(a, b)).toBe(true)
    expect(boardsEqual(a.snapshot(), b.snapshot())).toBe(true)
  })
})

describe('board-and-grid: snapshot performance budget', () => {
  it('test_snapshot_deep_copy_under_one_millisecond_average', () => {
    // GDD Performance Budget: "snapshot() full deep-copy (<=12x12) < 1 ms/call."
    // Tester check: benchmark in a tight headless loop (1000 iters, no rendering).
    const board = makeBoard({ width: 12, height: 12 })
    board.place({ col: 1, row: 1 }, 'hero-1')
    board.setTerrain({ col: 2, row: 2 }, TerrainType.Blocked)
    board.setHazard({ col: 3, row: 3 }, 'fire')
    board.setFlag({ col: 4, row: 4 }, 'objective')

    const iterations = 1000
    // Warm up the JIT before measuring, so the reported average reflects
    // steady-state cost rather than one-time compilation overhead.
    for (let i = 0; i < 50; i++) board.snapshot()

    const start = performance.now()
    for (let i = 0; i < iterations; i++) board.snapshot()
    const elapsed = performance.now() - start
    const avgMs = elapsed / iterations

    expect(avgMs).toBeLessThan(1)
  })
})
