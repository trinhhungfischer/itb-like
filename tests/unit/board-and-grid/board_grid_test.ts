// Board & Grid — unit tests (Vitest)
//
// These cases originally shipped with inline reference implementations of
// Formulas F1-F4, mirroring design/gdd/board-and-grid.md, because src/ did
// not exist yet. Board & Grid is now implemented at src/core/board/ — this
// file imports the real implementation and keeps every original assertion
// unchanged, so it now exercises Board.inBounds/distance/neighbors/tilesInRange
// on the default 8x8 board.
//
// Naming follows the project standard: [system]_[feature]_test.ts,
// test_[scenario]_[expected] for cases. All tests are deterministic (no RNG, no time).

import { describe, it, expect } from 'vitest'
import { makeBoard } from '../../../src/core/board/board.js'
import type { Tile } from '../../../src/core/board/board-types.js'

const board = makeBoard() // default 8x8

const inBounds = (c: number, r: number): boolean => board.inBounds(c, r)
const distance = (a: [number, number], b: [number, number]): number =>
  board.distance({ col: a[0], row: a[1] }, { col: b[0], row: b[1] })
const neighbors = (c: number, r: number): Array<[number, number]> =>
  board.neighbors(c, r).map((t: Tile) => [t.col, t.row] as [number, number])
const tilesInRange = (o: [number, number], R: number): Array<[number, number]> =>
  board.tilesInRange({ col: o[0], row: o[1] }, R).map((t: Tile) => [t.col, t.row] as [number, number])

describe('board-and-grid: inBounds (F1)', () => {
  it('test_corner_in_bounds_true', () => expect(inBounds(7, 7)).toBe(true))
  it('test_one_past_max_false', () => expect(inBounds(8, 3)).toBe(false))
  it('test_negative_false_no_wraparound', () => expect(inBounds(-1, 0)).toBe(false))
})

describe('board-and-grid: distance (F2, Manhattan)', () => {
  it('test_known_pair_returns_seven', () => expect(distance([1, 1], [4, 5])).toBe(7))
  it('test_same_tile_zero', () => expect(distance([2, 2], [2, 2])).toBe(0))
  it('test_symmetry', () => expect(distance([1, 1], [4, 5])).toBe(distance([4, 5], [1, 1])))
  it('test_diagonal_is_two_not_one', () => expect(distance([0, 0], [1, 1])).toBe(2))
})

describe('board-and-grid: neighbors (F3, orthogonal)', () => {
  it('test_interior_returns_four', () => expect(neighbors(3, 3).length).toBe(4))
  it('test_corner_returns_two', () => expect(neighbors(0, 0).length).toBe(2))
  it('test_edge_returns_three', () => expect(neighbors(0, 3).length).toBe(3))
  it('test_no_diagonal_neighbor', () =>
    expect(neighbors(0, 0).some(([c, r]) => c === 1 && r === 1)).toBe(false))
})

describe('board-and-grid: tilesInRange (F4)', () => {
  it('test_radius_zero_returns_origin_only', () => {
    const t = tilesInRange([3, 3], 0)
    expect(t).toEqual([[3, 3]])
  })
  it('test_interior_r2_returns_thirteen', () => expect(tilesInRange([3, 3], 2).length).toBe(13))
  it('test_corner_r2_clips_to_six', () => expect(tilesInRange([0, 0], 2).length).toBe(6))
})
