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
| 2 equipment slots per mech | **2 Equipment slots** per hero — each holds a Passive Module OR a Gadget (hybrid) |

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

1. Each hero has **2 Equipment slots** (in addition to their 1 Ability slot)
2. Each Equipment slot can hold **either** a Passive Module **or** a Gadget (see [secondary-weapons-and-gadgets.md](secondary-weapons-and-gadgets.md))
3. Valid slot configurations: 2 Passives, 1 Passive + 1 Gadget, 2 Gadgets, or any slot empty
4. Equipment is found via **Draft / Loadout Meta** (Reward nodes, shop purchases)
5. Equipment is equipped to a **specific hero** — not squad-wide
6. Modules with `scope: Squad` affect all heroes but still occupy one hero's slot
7. Two heroes cannot equip the same module/gadget ID simultaneously
8. Equipment persists for the entire run once equipped (no unequip)
9. Module effects are **deterministic** — no RNG triggers
10. **A hero may equip at most 1 Gadget** across their 2 slots (Gadgets replace Move — having 2 would be meaningless since there's only 1 Move action per turn)

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

#### C2. Shatter Strike *(Uncommon)*

| Field | Value |
|-------|-------|
| **Scope** | Self |
| **Trigger** | OnHit |
| **Effect** | When this hero damages an enemy that is adjacent to `Blocked` terrain (walls, rubble), the `Blocked` terrain is destroyed, and the enemy takes 1 additional collision damage from the debris. |
| **Incompatible** | — |

**Design intent**: Replaces stat-padding damage buffs with positional damage. Rewards attacking enemies near walls, synergizing perfectly with push abilities.

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

#### T1. Slipstream *(Common)*

| Field | Value |
|-------|-------|
| **Scope** | Self |
| **Trigger** | OnAction (Move) |
| **Effect** | Moving through or out of `Hazard` tiles (Fire, Acid) refunds 1 Move point. Does not prevent hazard damage/effects. |
| **Incompatible** | — |

**Design intent**: Replaces raw +Move stat-padding with a tactical mobility option. Encourages players to use hazards as highways, making hazard creation (like Aftershock) synergize with mobility.

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

#### ~~T4. Tactician's Eye~~ — RESOLVED: Now a free base feature

> **Decision**: Chain-reaction preview (showing second-order consequences like collision damage, push destinations, and chain effects) is now a **base game feature available to all players for free**, not a passive module. It was moved out of the passive pool because:
> - Information that helps readability should never cost a slot (Pillar #5)
> - It felt bad to "waste" a slot on QoL that should be standard
> - It directly supports Pillar #1 (Perfect Information)
>
> **Implementation**: Move Preview system always renders full chain-reaction consequences. No slot required.

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

## Acceptance Criteria, Edge Cases & Stacking Rules

### 1. Stacking Rules
- **Same Module, Different Heroes**: Allowed (unless `Scope: Squad`). If two heroes equip *Force Amplifier*, both get doubled collision damage.
- **Squad-Scope Stacking**: If a module is `Scope: Squad`, a second copy of it will NOT appear in the Draft pool. It cannot be stacked.
- **Trigger Order**: When multiple passives trigger simultaneously (e.g., `OnHit` from *Kinetic Armor* and *Last Stand*), they resolve in the order they were equipped.

### 2. Hazard & Multi-Hit Edge Cases
- **Aftershock + Multi-Tile Abilities**: If an ability hits a 3x3 area, *Aftershock* spawns Fire on ALL 9 tiles.
- **Chain Reaction + Multiple Kills**: If one ability kills 3 enemies simultaneously, *Chain Reaction* triggers 3 separate `push` events originating from the 3 removed units. These resolve in ascending `unitId` order of the killed units.
- **Kinetic Armor + Hazards**: *Kinetic Armor* ONLY prevents collision damage from walls/units. If pushed into a Fire hazard, the Fire damage still applies.
- **Last Stand + Multi-Hit**: If a hero at 1 HP takes 2 damage, *Last Stand* triggers, preventing the death and resetting HP to 1. If a *second* hit occurs in the same turn, the hero dies (Last Stand is once per battle).

### 3. Acceptance Criteria
- **AC1**: A hero can equip a maximum of 2 passive modules.
- **AC2**: Attempting to equip a 3rd module prompts the player to replace an existing one.
- **AC3**: Passive effects are deterministically applied during the Combat Resolution phase and reflected accurately in the Move Preview.
- **AC4**: `Scope: Squad` modules apply their effect to all heroes but consume only one equipment slot on the hero who drafted it.

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
| Common | 4 modules (T1, S1, U1, U2) | 50% |
| Uncommon | 5 modules (C1, C2, T2, S2, S3) | 35% |
| Rare | 4 modules (C3, C4, T3, S4) | 15% |

> **Note**: T4 (Tactician's Eye) removed from pool — now a free base feature.

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
| **Heroes & Abilities** | Add `equipmentSlots: [EquipmentSlot, EquipmentSlot]` to `HeroDefinition` runtime. Each slot holds `PassiveModule \| Gadget \| null` | Medium — unified slot system |
| **Combat Resolution** | `resolve()` must emit `OnAction`, `OnHit`, `OnKill` events (many already exist via event bus) | Small — events already planned |
| **Draft / Loadout Meta** | Add Module + Gadget to the draftable content pool alongside heroes and upgrades | Medium — new content types in draft |
| **Battle HUD** | Show 2 equipment slots per hero with passive/gadget icons + cooldown state | Small — UI addition |
| **Move Preview** | Chain-reaction preview is now a **base feature** (former Tactician's Eye). Passives that modify effects (Aftershock, Chain Reaction) need preview integration | Medium — preview must call passive modifiers |

### New ADR Recommended
> **ADR-0012: Passive Module resolution timing** — Passives with `OnAction`/`OnKill` triggers resolve as **follow-up `resolve()` calls** (same pattern as Enemy on-death effects, Rule 13 of enemy GDD), not injected mid-chain. This preserves Combat Resolution's single-chain contract.

---

## Resolved Design Decisions

1. ✅ **Slot count**: **2 hybrid Equipment slots** per hero. Each slot accepts either a Passive Module or a Gadget. Max 1 Gadget per hero (only 1 Move action to replace).
2. ✅ **Tactician's Eye**: Removed from passive pool. Chain-reaction preview is now a **free base feature** for all players.
3. ✅ **Passive Module vs Ability Upgrades**: Independent systems. 2 Equipment slots (Passive/Gadget) + 2 Ability Upgrade slots = 4 total customization slots per hero.
