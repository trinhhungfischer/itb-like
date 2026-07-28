# VANGUARD — Passive Abilities & Equipment Pool

> **Status**: Draft — awaiting Creative Director review
> **Date**: 2026-07-28
> **Depends on**: [ability-upgrades.md](../gdd/ability-upgrades.md), [heroes-and-abilities.md](../gdd/heroes-and-abilities.md), [draft-and-loadout-meta.md](../gdd/draft-and-loadout-meta.md)
> **Design pillars**: #3 Variety Lives in the Draft · #2 Positioning Over Power · #4 Every Hero Is a Verb

---

## Design Philosophy

### ITB Equipment Reference → VANGUARD Adaptation

| ITB Pattern | VANGUARD Adaptation |
|------------|---------------------|
| Reactor Core upgrades (numeric: +1 damage, +1 range) | **Ability Upgrades** (already designed — 4 categories) |
| Passive equipment (Force Amp, Networked Shield, etc.) | **Passive Modules** — equippable passives that modify game rules |
| Secondary weapon slot (equip found/bought weapons) | Designed separately (Document C) |
| 2 equipment slots per mech | **1 Passive Module slot** per hero (v1 — simpler to read) |

### The Problem Passives Solve

The current Ability Upgrades system (GDD) only has **numeric deltas**: +damage, +range, +use, +immunity. These are important but don't change *how* you play — they just make what you already do stronger. ITB's best passives (Force Amp, Building Immune, Networked Shield) change the **rules of engagement**, creating new tactical possibilities.

**Passives must**:
- Change HOW you play, not just how HARD you hit (Pillar #2)
- Be readable at a glance — no hidden interactions (Pillar #5)
- Never give a hero a second active verb (Pillar #4 — "every hero is ONE verb")
- Interact with the existing 10 Combat Resolution primitives

---

## System Design: Passive Modules

### Schema

```
PassiveModuleDefinition {
  id: string                    // unique identifier
  name: string                  // display name
  category: Combat | Tactical | Survival | Utility
  scope: Self | Squad | Global  // who benefits
  trigger: Always | OnAction | OnHit | OnKill | OnTurnStart
  effect: PassiveEffect         // the rule modification
  rarity: Common | Uncommon | Rare
  incompatible: string[]        // IDs of modules this cannot stack with
}
```

### Equip Rules

1. Each hero has **1 Passive Module slot** (in addition to their 1 Ability slot)
2. Modules are found via **Draft / Loadout Meta** (Reward nodes, shop purchases)
3. A module is equipped to a **specific hero** — not squad-wide
4. Modules with `scope: Squad` affect all heroes but still occupy one hero's slot
5. Two heroes cannot equip the same module ID simultaneously
6. Modules persist for the entire run once equipped (no unequip)
7. Module effects are **deterministic** — no RNG triggers

---

## Module Catalog

### Category: COMBAT — "How your verb hits"

#### C1. Force Amplifier *(Uncommon)*

| Field | Value |
|-------|-------|
| **Scope** | Self |
| **Trigger** | Always |
| **Effect** | Collision damage from this hero's push/pull abilities is **doubled** (2→4, 3→6) |
| **Incompatible** | — |

**Design intent**: The ITB Force Amp analog. Directly rewards the "push into wall" play pattern. A Vanguard with Force Amp turns every wall collision into a devastating hit. Makes positioning even MORE important — you're not just pushing enemies away, you're weaponizing every obstacle.

**Readability**: When equipped, the hero's telegraph overlay shows doubled collision damage numbers in orange on wall-adjacent targets.

---

#### C2. Piercing Strikes *(Uncommon)*

| Field | Value |
|-------|-------|
| **Scope** | Self |
| **Trigger** | Always |
| **Effect** | This hero's `damage` primitives ignore the first 1 point of enemy HP reduction prevention (future-proofing for shields/armor). In v1: no mechanical change — exists as a slot for future shield/armor counter-play. **V1 actual effect**: +1 damage to all `damage` primitives from this hero |
| **Incompatible** | — |

**Design intent**: Simple damage amplifier for damage-dealing heroes (Striker, Piston). Straightforward and always useful.

---

#### C3. Aftershock *(Rare)*

| Field | Value |
|-------|-------|
| **Scope** | Self |
| **Trigger** | OnAction (after this hero's ability resolves) |
| **Effect** | After this hero's ability `resolve()` completes, `spawnHazard(each affected tile, Fire, 1, duration=1)` for every tile the ability's effect chain targeted |
| **Incompatible** | — |

**Design intent**: Every ability leaves fire in its wake. A Vanguard shove now leaves fire where the enemy was standing AND where they land. Warden's pull leaves a trail of fire. Transforms positioning abilities into area-denial tools. **Very powerful, hence Rare.**

**Readability**: When equipped, fire icons appear on the hero's ability preview alongside normal effects.

---

#### C4. Chain Reaction *(Rare)*

| Field | Value |
|-------|-------|
| **Scope** | Self |
| **Trigger** | OnKill (when this hero's ability removes a unit) |
| **Effect** | When this hero's ability causes a unit to be `Removed`, `push(each neighbor, dir=centerToNeighbor, distance=1)` from the removed unit's tile |
| **Incompatible** | — |

**Design intent**: Killing an enemy creates an explosion that pushes everything adjacent outward. Chains with other enemies (push them into walls for collision damage) and with hazards (push them into fire/mines). The ultimate "positioning payoff" passive.

---

### Category: TACTICAL — "How you move and plan"

#### T1. Pathfinder *(Common)*

| Field | Value |
|-------|-------|
| **Scope** | Self |
| **Trigger** | Always |
| **Effect** | This hero's `moveRange` +1 |
| **Incompatible** | — |

**Design intent**: More movement = more positioning options. Simple, always useful. Particularly valuable on low-mobility heroes (Warden, Ember with moveRange 2).

---

#### T2. Overwatch *(Uncommon)*

| Field | Value |
|-------|-------|
| **Scope** | Self |
| **Trigger** | OnTurnStart |
| **Effect** | If this hero did NOT use its Ability slot last turn, its ability `range` is +2 this turn |
| **Incompatible** | — |

**Design intent**: Rewards patience. If you skip your ability for a turn (just move), next turn you can hit from further away. Creates a "coil and release" play pattern — reposition for one turn, then strike with extended range. Particularly powerful on short-range heroes (Vanguard range 1 → 3).

**Readability**: The hero's ability icon pulses/glows when the range bonus is active. Legal target tiles show the extended range.

---

#### T3. Warp Beacon *(Rare)*

| Field | Value |
|-------|-------|
| **Scope** | Self |
| **Trigger** | OnAction (after Move) |
| **Effect** | After this hero moves, `spawnHazard(previousTile, Beacon, duration=∞)`. Once per battle, this hero can teleport to any Beacon tile instead of normal movement |
| **Incompatible** | — |

**Design intent**: Drop a warp beacon on the tile you were standing on when you move. Later, teleport back to it. Creates long-range tactical setups: move forward, drop beacon, attack, then next turn teleport back to safety. **One use only** prevents abuse.

**Readability**: Beacon tile shows a distinct blue marker. The hero's Move option shows "Warp" as an alternative to normal movement when a Beacon exists.

---

#### T4. Tactician's Eye *(Common)*

| Field | Value |
|-------|-------|
| **Scope** | Squad |
| **Trigger** | Always |
| **Effect** | All hero telegraphs (ability previews) also show the **second-order consequences** — e.g., if your push would cause a collision, the preview shows collision damage AND where the collided unit would go if it's also pushed |
| **Incompatible** | — |

**Design intent**: Quality-of-life as a passive. In base game, preview shows direct effects only. With Tactician's Eye, you see the full chain reaction. Makes complex combos more plannable. **Squad scope** means equipping it on any hero benefits the whole team's preview.

**Readability**: Enhanced preview tiles have a subtle "chain" icon and secondary effect indicators.

---

### Category: SURVIVAL — "How you endure"

#### S1. Kinetic Armor *(Common)*

| Field | Value |
|-------|-------|
| **Scope** | Self |
| **Trigger** | OnHit (when this hero receives `push` or `pull`) |
| **Effect** | This hero takes **0 collision damage** from being pushed/pulled into walls. The push/pull displacement still occurs normally |
| **Incompatible** | — |

**Design intent**: The "Building Immune" analog for heroes. Prevents collision damage to THIS hero (not enemies). Lets you intentionally place a hero against a wall without fear of being slammed. Particularly useful on frontline heroes (Vanguard, Piston) who operate near walls.

---

#### S2. Hazard Walker *(Uncommon)*

| Field | Value |
|-------|-------|
| **Scope** | Self |
| **Trigger** | Always |
| **Effect** | This hero is immune to `Fire` hazard damage (from `applyHazard` — both stepping on fire and environmental fire ticks). Does NOT grant immunity to Acid, Mines, or Vortex |
| **Incompatible** | S3 (Acid Walker) |

**Design intent**: The hero can walk through fire safely. Extremely powerful with Ember Corps squad — set the board on fire, then walk through it. Also counters Volatile Overseer's death-fire.

**Readability**: The hero has a flame-proof icon. Fire tiles under this hero don't show damage preview.

---

#### S3. Acid Walker *(Uncommon)*

| Field | Value |
|-------|-------|
| **Scope** | Self |
| **Trigger** | Always |
| **Effect** | This hero is immune to `Acid` hazard damage |
| **Incompatible** | S2 (Hazard Walker) |

**Design intent**: Identical to Hazard Walker but for Acid. Counters Lobber T3's persistent Acid pools.

---

#### S4. Last Stand *(Rare)*

| Field | Value |
|-------|-------|
| **Scope** | Self |
| **Trigger** | OnHit (when this hero would be reduced to 0 HP) |
| **Effect** | The first time this hero would be `Removed(Defeated)` in a battle, prevent removal and set `currentHP = 1` instead. Once per battle |
| **Incompatible** | — |

**Design intent**: A one-time death save. Gives the player a safety net for one critical mistake. Extremely valuable on high-value heroes. **Once per battle** prevents abuse — the hero is at 1 HP and extremely vulnerable afterward.

---

### Category: UTILITY — "How you interact with the meta-game"

#### U1. Scavenger *(Common)*

| Field | Value |
|-------|-------|
| **Scope** | Squad |
| **Trigger** | OnKill (when any hero kills an enemy) |
| **Effect** | +1 bonus currency (Reputation/Salvage) per kill in this battle. Stacks across kills |
| **Incompatible** | — |

**Design intent**: Economy booster. Rewards aggressive play over defensive stalling. Squad scope encourages drafting it early.

---

#### U2. Spotter *(Common)*

| Field | Value |
|-------|-------|
| **Scope** | Self |
| **Trigger** | Always |
| **Effect** | This hero's ability `targetFilter` adds: tiles occupied by enemies within ability range show their full Intent (telegraphed action) in an expanded tooltip during ability targeting. No mechanical effect — pure information |
| **Incompatible** | — |

**Design intent**: Information advantage. When targeting with this hero's ability, you see not just the enemy's position but WHAT it plans to do next turn. Helps make informed push/pull decisions.

---

## Module Distribution via Draft

Modules appear in the Draft / Loadout Meta system:

| Source | Module Rarity Available | Count |
|--------|------------------------|-------|
| **Reward node** | Common, Uncommon | Choose 1 of 3 |
| **Elite reward** | Uncommon, Rare | Choose 1 of 3 |
| **Boss reward** | Rare guaranteed | Choose 1 of 2 |
| **Shop** | Any (weighted by rarity) | Buy from rotating stock of 4 |

### Rarity Distribution

| Rarity | Pool Size | Drop Weight |
|--------|-----------|-------------|
| Common | 5 modules (T1, T4, S1, U1, U2) | 50% |
| Uncommon | 5 modules (C1, C2, T2, S2, S3) | 35% |
| Rare | 4 modules (C3, C4, T3, S4) | 15% |

---

## Synergy Matrix (Passive × Hero)

Some passives are significantly stronger on certain heroes:

| Passive | Best Heroes | Why |
|---------|------------|-----|
| Force Amplifier | Vanguard, Piston, Mortar | Push abilities + doubled collision = massive damage |
| Aftershock | Warden, Twinblade, Specter | Displacement abilities now leave fire trails |
| Chain Reaction | Striker, Piston | Damage dealers that can trigger kills → explosive chain pushes |
| Overwatch | Vanguard (range 1→3), Crucible | Short-range heroes become mid-range threats with patience |
| Hazard Walker | Any Ember Corps hero | Squad themed around fire → walk through your own hazards |
| Last Stand | Vanguard (6 HP), Striker (7 HP) | Frontline bruisers that absorb damage need a safety net |
| Kinetic Armor | Piston, Vanguard | Melee fighters near walls all the time |
| Warp Beacon | Specter, Twinblade | Already mobile heroes become even more unpredictable |

---

## Impact on GDD / Architecture

### Changes Required

| System | Change | Scope |
|--------|--------|-------|
| **Heroes & Abilities** | Add `passiveModuleSlot: PassiveModuleInstance \| null` to `HeroDefinition` runtime | Small — 1 new field |
| **Combat Resolution** | `resolve()` must emit `OnAction`, `OnHit`, `OnKill` events (many already exist via event bus) | Small — events already planned |
| **Draft / Loadout Meta** | Add Module to the draftable content pool alongside heroes and upgrades | Medium — new content type in draft |
| **Battle HUD** | Show equipped passive icon + active/cooldown state per hero | Small — UI addition |
| **Move Preview** | Passives that modify previews (Aftershock, Chain Reaction) need preview integration | Medium — preview must call passive modifiers |

### New ADR Recommended
> **ADR-0012: Passive Module resolution timing** — Passives with `OnAction`/`OnKill` triggers resolve as **follow-up `resolve()` calls** (same pattern as Enemy on-death effects, Rule 13 of enemy GDD), not injected mid-chain. This preserves Combat Resolution's single-chain contract.

---

## Open Questions

1. **Slot count**: 1 passive per hero feels clean. Should we allow 2 slots (like ITB's 2 equipment slots) for more build depth, or is 1 enough for v1?
2. **Tactician's Eye scope**: Showing chain reactions in preview is powerful QoL — should this be a **default feature** unlocked for free, not a passive? It might feel bad to "waste" a slot on information that should be available to all players.
3. **Passive Module vs Ability Upgrades**: These are two separate equip systems. Should they share the same slot (choose either an upgrade OR a passive for each slot), or remain independent (1 passive slot + 2 upgrade slots)?
