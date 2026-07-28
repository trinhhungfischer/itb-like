// Input & Selection — Story 002: Click Precision Tolerance (Formula 3)
//
// Implements: production/epics/input-selection/story-002-selection-state-machine.md
// GDD: design/gdd/input-and-selection.md Formula 3 (`isValidClick`)
//
// `click_tolerance_px` is a player-adjustable accessibility knob
// (accessibility.md A13, added 2026-07-28) — every test below drives
// `isValidClick` through an explicitly injected `SelectionConfig`, never a
// literal `6`/`600` baked into the assertion itself, so these tests would
// still be meaningful if the GDD defaults ever change.
//
// Naming: [system]_[feature]_test.ts / test_[scenario]_[expected].
// Deterministic: no RNG, no wall clock — every timestamp is caller-supplied.

import { describe, it, expect } from 'vitest'
import { isValidClick } from '../../../src/core/input/click-precision.js'
import type { ClickPoint } from '../../../src/core/input/click-precision.js'
import { DEFAULT_SELECTION_CONFIG } from '../../../src/core/input/selection-config.js'
import type { SelectionConfig } from '../../../src/core/input/selection-config.js'

describe('input-selection: isValidClick (Formula 3) — GDD worked examples', () => {
  it('test_gdd_worked_example_small_drift_within_tolerance_is_valid', () => {
    const down: ClickPoint = { px: 300, py: 150, t: 0 }
    const up: ClickPoint = { px: 303, py: 152, t: 120 } // dist ≈ 3.6 ≤ 6
    expect(isValidClick(down, up, DEFAULT_SELECTION_CONFIG)).toBe(true)
  })

  it('test_gdd_worked_example_large_drift_beyond_tolerance_is_invalid', () => {
    const down: ClickPoint = { px: 300, py: 150, t: 0 }
    const up: ClickPoint = { px: 320, py: 170, t: 120 } // dist ≈ 28.3 > 6
    expect(isValidClick(down, up, DEFAULT_SELECTION_CONFIG)).toBe(false)
  })
})

describe('input-selection: isValidClick (Formula 3) — distance threshold, at and beyond', () => {
  const config: SelectionConfig = { ...DEFAULT_SELECTION_CONFIG, clickTolerancePx: 6 }

  it('test_distance_exactly_at_tolerance_threshold_is_valid_inclusive_bound', () => {
    const down: ClickPoint = { px: 0, py: 0, t: 0 }
    const up: ClickPoint = { px: 6, py: 0, t: 0 } // dist == 6, exactly the configured tolerance
    expect(isValidClick(down, up, config)).toBe(true)
  })

  it('test_distance_just_beyond_tolerance_threshold_is_invalid', () => {
    const down: ClickPoint = { px: 0, py: 0, t: 0 }
    const up: ClickPoint = { px: 6.01, py: 0, t: 0 } // dist == 6.01 > 6
    expect(isValidClick(down, up, config)).toBe(false)
  })

  it('test_zero_drift_is_always_valid_regardless_of_tolerance', () => {
    const down: ClickPoint = { px: 42, py: 17, t: 500 }
    const up: ClickPoint = { px: 42, py: 17, t: 500 }
    expect(isValidClick(down, up, { ...config, clickTolerancePx: 0.0001 })).toBe(true)
  })
})

describe('input-selection: isValidClick (Formula 3) — hold-time threshold, at and beyond', () => {
  const config: SelectionConfig = { ...DEFAULT_SELECTION_CONFIG, maxClickHoldMs: 600 }

  it('test_hold_time_exactly_at_max_hold_ms_is_valid_inclusive_bound', () => {
    const down: ClickPoint = { px: 10, py: 10, t: 1000 }
    const up: ClickPoint = { px: 10, py: 10, t: 1600 } // held exactly 600ms
    expect(isValidClick(down, up, config)).toBe(true)
  })

  it('test_hold_time_just_beyond_max_hold_ms_is_invalid', () => {
    const down: ClickPoint = { px: 10, py: 10, t: 1000 }
    const up: ClickPoint = { px: 10, py: 10, t: 1601 } // held 601ms
    expect(isValidClick(down, up, config)).toBe(false)
  })
})

describe('input-selection: isValidClick (Formula 3) — config is injected data, never a hardcoded literal (A13)', () => {
  it('test_same_pixel_drift_is_valid_under_a_lenient_injected_tolerance_and_invalid_under_a_strict_one', () => {
    const down: ClickPoint = { px: 100, py: 100, t: 0 }
    const up: ClickPoint = { px: 104, py: 100, t: 0 } // identical 4px drift in both cases

    const strict: SelectionConfig = { ...DEFAULT_SELECTION_CONFIG, clickTolerancePx: 2 }
    const lenient: SelectionConfig = { ...DEFAULT_SELECTION_CONFIG, clickTolerancePx: 15 }

    // The only thing that differs between these two calls is the injected
    // config value — proving isValidClick reads clickTolerancePx as data,
    // not a compiled-in constant.
    expect(isValidClick(down, up, strict)).toBe(false)
    expect(isValidClick(down, up, lenient)).toBe(true)
  })

  it('test_same_hold_duration_is_valid_under_a_lenient_injected_max_hold_and_invalid_under_a_strict_one', () => {
    const down: ClickPoint = { px: 0, py: 0, t: 0 }
    const up: ClickPoint = { px: 0, py: 0, t: 500 } // identical 500ms hold in both cases

    const strict: SelectionConfig = { ...DEFAULT_SELECTION_CONFIG, maxClickHoldMs: 400 }
    const lenient: SelectionConfig = { ...DEFAULT_SELECTION_CONFIG, maxClickHoldMs: 800 }

    expect(isValidClick(down, up, strict)).toBe(false)
    expect(isValidClick(down, up, lenient)).toBe(true)
  })
})
