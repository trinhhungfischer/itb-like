/**
 * Board & Grid — tile-flag bitfield encoding.
 *
 * Per ADR-0001, `flags` is stored as one `Uint8` bitfield per tile rather
 * than an array of flag objects. This module is the single place the bit
 * assignment is defined — mirrors the `index(c,r)` "define once" discipline.
 */

import type { TileFlag } from './board-types.js';

const FLAG_BITS: Readonly<Record<TileFlag, number>> = Object.freeze({
  'spawn-point': 0b001,
  objective: 0b010,
  'deploy-zone': 0b100,
});

const ALL_FLAGS: readonly TileFlag[] = Object.freeze(['spawn-point', 'objective', 'deploy-zone']);

/** Bit assigned to `flag` in the per-tile flags bitfield. */
export function bitFor(flag: TileFlag): number {
  return FLAG_BITS[flag];
}

/** Decodes a bitfield byte into the set of {@link TileFlag}s it represents. */
export function decodeFlags(bitfield: number): TileFlag[] {
  return ALL_FLAGS.filter((flag) => (bitfield & bitFor(flag)) !== 0);
}
