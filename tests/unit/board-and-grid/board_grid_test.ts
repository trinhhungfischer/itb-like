// Board & Grid — unit tests (Vitest)
//
// These reference implementations mirror the pure formulas defined in
// design/gdd/board-and-grid.md (Formulas F1–F7). They live in this test file only
// because src/ does not exist yet; once Board & Grid is implemented, replace them
// with imports from src/ and keep the assertions.
//
// Naming follows the project standard: [system]_[feature]_test.ts,
// test_[scenario]_[expected] for cases. All tests are deterministic (no RNG, no time).

import { describe, it, expect } from 'vitest'

const W = 8
const H = 8

// F1 — in-bounds
const inBounds = (c: number, r: number): boolean => c >= 0 && c < W && r >= 0 && r < H

// F2 — Manhattan distance
const distance = (a: [number, number], b: [number, number]): number =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])

// F3 — orthogonal in-bounds neighbors
const neighbors = (c: number, r: number): Array<[number, number]> =>
  ([[0, -1], [0, 1], [-1, 0], [1, 0]] as Array<[number, number]>)
    .map(([dc, dr]) => [c + dc, r + dr] as [number, number])
    .filter(([nc, nr]) => inBounds(nc, nr))

// F4 — tiles within Manhattan radius R (clipped to board)
const tilesInRange = (o: [number, number], R: number): Array<[number, number]> => {
  const out: Array<[number, number]> = []
  for (let c = 0; c < W; c++)
    for (let r = 0; r < H; r++)
      if (distance(o, [c, r]) <= R) out.push([c, r])
  return out
}

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
