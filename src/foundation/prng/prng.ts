export function mix(...inputs: (number | string)[]): number {
  let h = 2166136261;
  for (const input of inputs) {
    const s = String(input);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

export function mulberry32(seed: number): { next(): number } {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6D2B79F5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  };
}

export const MAP_SEED_SALT = "vanguard_run_map_v1";
export const DRAFT_SEED_SALT = "vanguard_draft_offer_v1";
