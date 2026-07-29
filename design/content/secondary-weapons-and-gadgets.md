# VANGUARD — Secondary Weapons & Equipable Items

> **Status**: Draft — awaiting Creative Director review
> **Date**: 2026-07-28
> **Depends on**: [heroes-and-abilities.md](../gdd/heroes-and-abilities.md), [passive-modules-and-equipment.md](passive-modules-and-equipment.md), [draft-and-loadout-meta.md](../gdd/draft-and-loadout-meta.md)
> **Design pillars**: #3 Variety Lives in the Draft · #4 Every Hero Is a Verb · #2 Positioning Over Power

---

## Design Philosophy

### The Problem: "Every hero is ONE verb — forever"

VANGUARD's Pillar #4 says "every hero is a verb" — and the current design enforces exactly 1 ability per hero, unchangeable across a run. This creates tactical clarity but risks monotony:
- A Vanguard always shoves. Every turn. Every fight. For the entire run.
- The only variation comes from Ability Upgrades (numeric deltas) and Passive Modules (rule modifiers).
- ITB solves this with a **second equipment slot** that can hold a completely different weapon — a Prime Mech can swap its Titan Fist for a Hydraulic Legs and become a fundamentally different unit.

### VANGUARD's Solution: "Your verb is permanent. Your tool changes."

Secondary weapons **add a second, constrained action option** that the hero can use INSTEAD of (not in addition to) their signature Ability slot:

> **Core rule: a hero still gets exactly 2 actions per turn (1 Move + 1 Ability). A secondary weapon replaces the Ability action with an alternative.**

This preserves:
- **Tactical Positioning**: Heroes can still Move before acting, which is critical for melee heroes.
- **Actions per turn**: Still 2, per Turn & Phase Manager's `actions_per_hero_turn = 2`
- **Readability**: The player chooses "Move, then Ability OR Gadget" — maintaining clean decision-making.

### ITB Reference → VANGUARD Adaptation

| ITB Pattern | VANGUARD Adaptation |
|------------|---------------------|
| 2 weapon slots (Prime + alternate) | 1 permanent Ability + 1 Gadget (replaces Ability) |
| Found in time pods, shops, reputation rewards | Found via Draft / Loadout Meta (Reward, Shop, Elite) |
| Any mech can equip any weapon | **Class-restricted** — each Gadget lists compatible squads/heroes |
| Weapons can be moved between mechs freely | Gadgets are **bound to a hero** once equipped (run-long) |

---

## System Design: Gadgets

### Schema

```
GadgetDefinition {
  id: string                         // unique identifier
  name: string                       // display name
  category: Offensive | Defensive | Utility
  verbFamily: push | pull | swap | damage | spawnHazard | setTerrain | spawnUnit
  compatible: HeroId[] | "any"       // which heroes can equip
  ability: AbilityDefinition         // same schema as hero abilities
  cooldownTurns: int                 // turns between uses (0 = no cooldown)
  usesPerBattle: int | null          // max uses per battle (null = unlimited)
  rarity: Common | Uncommon | Rare
}
```

> **Availability model**: Gadgets support **both** cooldown AND limited uses. A Gadget is available when: `cooldownRemaining == 0 AND (usesPerBattle == null OR usesRemaining > 0)`. Some gadgets are cooldown-only (unlimited uses), some are uses-only (no cooldown), and powerful gadgets use both constraints.

### Equip & Use Rules

1. Gadgets occupy an **Equipment slot** (shared with Passive Modules — see [passive-modules-and-equipment.md](passive-modules-and-equipment.md))
2. Each hero has **2 Equipment slots** total — a Gadget takes 1 slot, and a hero may equip **at most 1 Gadget** (the other slot can be a Passive or empty)
3. A Gadget is an `AbilityDefinition` — same schema, same `compileEffects()`, same resolution through Combat Resolution
4. **Using a Gadget consumes the Ability slot**, not the Move slot:
   - The hero chooses: **Move** (normal walk)
   - Then: **Ability** (signature verb) OR **Gadget** (activate secondary weapon)
   - Total actions per turn: still 2
5. The Gadget has `cooldownTurns` and/or `usesPerBattle` — if on cooldown or out of uses, the hero must use their signature Ability (or do nothing).
6. Gadgets are found via Draft and bound to a specific hero.
7. **Undo Stack Integration**: Using a Gadget pushes a state to the Undo Stack exactly like an Ability. Because Gadgets are deterministic, they can be fully undone unless they trigger an effect that reveals hidden information.

### Why "Replace Ability" and Not Move?

| Alternative | Problem |
|------------|---------|
| 3rd action slot | Breaks Turn & Phase Manager's `actions_per_hero_turn = 2` — every downstream system assumes at most 2 actions per hero |
| Replace Move | Breaks melee heroes who must position to be effective, ruining tactical positioning. |
| Separate phase | Adds combat complexity, breaks "Read in Ten Seconds" |
| **Replace Ability ✅** | Preserves mobility (Move). You trade your signature verb for situational utility. |

**The trade-off is the design**: using your Gadget means you sacrifice your signature output for that turn. A Vanguard with a Smoke Bomb must choose: "Do I Shove the Charger, or do I drop smoke to protect the team?" This emphasizes tactical flexibility while maintaining positioning.

---

## Gadget Catalog

### Category: OFFENSIVE — "A second way to deal damage"

#### G-O1. Frag Grenade *(Common)*

| Field | Value |
|-------|-------|
| **VerbFamily** | damage |
| **Compatible** | Any |
| **Shape** | Area (radius 1) |
| **Range** | 3 |
| **Cooldown** | 1 turn |
| **Uses/Battle** | Unlimited |
| **Effect** | `damage(each unit in area, 1)` |

**Design intent**: Simple AoE chip damage. Useful on heroes that lack direct damage (Vanguard, Twinblade, Warden). 1 damage is low but hits everything in radius 1 (up to 5 tiles). **Cooldown 1** means it's every other turn — not spammable.

---

#### G-O2. Rail Driver *(Uncommon)*

| Field | Value |
|-------|-------|
| **VerbFamily** | damage |
| **Compatible** | Any |
| **Shape** | Line (ray, cardinal direction) |
| **Range** | ∞ (full board ray) |
| **Cooldown** | 2 turns |
| **Effect** | `damage(first unit in ray, 3)` |

**Design intent**: A powerful single-target sniper shot. ∞ range but only hits the FIRST unit in the chosen direction. Friendly fire applies — don't line up heroes in front of it. **2-turn cooldown** makes it a deliberate "save for the right moment" weapon.

---

#### G-O3. Impact Charge *(Rare)*

| Field | Value |
|-------|-------|
| **VerbFamily** | damage + push |
| **Compatible** | Approach heroes (Vanguard, Piston, Twinblade) |
| **Shape** | SingleTile (melee, range 1) |
| **Range** | 1 |
| **Cooldown** | 2 turns |
| **Effect** | `damage(target, 2)` + `push(target, dir=casterToTarget, 2)` |

**Design intent**: A "second shove" for melee heroes. Deals damage AND pushes 2 tiles. Since it replaces the Ability slot, the hero uses this *instead* of their normal attack, providing a longer push at the cost of their signature verb. **Hero-class restricted** to melee fighters.

---

### Category: DEFENSIVE — "Control the board without dealing damage"

#### G-D1. Smoke Bomb *(Common)*

| Field | Value |
|-------|-------|
| **VerbFamily** | spawnHazard |
| **Compatible** | Any |
| **Shape** | SingleTile |
| **Range** | 3 |
| **Cooldown** | 1 turn |
| **Effect** | `spawnHazard(target, Smoke, 0, duration=1)` |

**Smoke hazard effect**: A unit standing on a Smoke tile **cannot be targeted by enemy abilities** (the enemy's AI skips it as a candidate in Formula F1, or if already telegraphed, the effect whiffs when targeting through smoke). Smoke does NOT block movement. Duration 1 = disappears next Environment Phase.

**Design intent**: The ultimate defensive Gadget. Drop smoke on a hero to make them untargetable for one turn. Or drop smoke on a spawn point to delay enemy emergence. Since it replaces Ability, the hero can still move into position before deploying it.

> **New hazard type required**: Smoke (0 damage, blocks targeting, duration=1)

---

#### G-D2. Deployable Shield *(Uncommon)*

| Field | Value |
|-------|-------|
| **VerbFamily** | setTerrain |
| **Compatible** | Any |
| **Shape** | SingleTile |
| **Range** | 2 |
| **Cooldown** | 2 turns |
| **Effect** | `setTerrain(target, Blocked, duration=2)` |

**Design intent**: Creates a temporary wall for 2 turns. Identical to the Shifter enemy's wall ability but player-controlled. Blocks enemy movement, blocks projectile lines, creates collision surfaces. **Pairs beautifully with push heroes** — deploy a wall behind an enemy, then shove them into it for collision damage.

---

#### G-D3. Gravity Well *(Rare)*

| Field | Value |
|-------|-------|
| **VerbFamily** | pull |
| **Compatible** | Any |
| **Shape** | Area (radius 2) |
| **Range** | 3 |
| **Cooldown** | 3 turns |
| **Effect** | `pull(each unit in area, dir=unitToCenter, distance=1)` |

**Design intent**: Pulls everything in a radius-2 area 1 tile toward the center. Clusters enemies together (enabling AoE), pulls enemies off advantageous positions, can pull heroes toward safety. **Friendly fire**: also affects heroes in the area. 3-turn cooldown for a powerful repositioning tool.

---

### Category: UTILITY — "Change the rules of this turn"

#### G-U1. Grapple Hook *(Common)*

| Field | Value |
|-------|-------|
| **VerbFamily** | pull (self) |
| **Compatible** | Any |
| **Shape** | SingleTile |
| **Range** | 4 |
| **Filter** | AnyTile (Blocked, Occupied, or Clear) |
| **Cooldown** | 0 (every turn) |
| **Effect** | `pull(self, dir=selfToTarget, distance=min(4, distanceToTarget-1))` — pulls the CASTER toward the target tile, stopping 1 tile before it (or at the first obstruction) |

**Design intent**: A **movement alternative** packaged as a Gadget. Since it replaces Ability, you can Move normally *and then* Grapple, allowing for extreme repositioning (Move 3 + Grapple 4 = 7 tiles of displacement). BUT: only cardinal directions, no pathing around obstacles. **0 cooldown** but uses up your offensive action for the turn.

**Trade-off**: You give up your attack to reposition drastically. Choose based on the board state.

---

#### G-U2. Swap Beacon *(Uncommon)*

| Field | Value |
|-------|-------|
| **VerbFamily** | swap |
| **Compatible** | Any |
| **Shape** | SingleTile |
| **Range** | 3 |
| **Filter** | AnyUnit (hero or enemy) |
| **Cooldown** | 1 turn |
| **Effect** | `swap(self, target)` — swaps the caster with the target unit |

**Design intent**: Swap positions with any unit on the board within range 3. Swap a frontline hero with a backline hero for protection. Swap yourself with an enemy to pull them out of position. Swap an enemy into a hazard. **Extremely versatile** — the best utility Gadget for creative players. Cooldown 1 keeps it in check.

---

#### G-U3. Decoy Drone *(Rare)*

| Field | Value |
|-------|-------|
| **VerbFamily** | spawnUnit |
| **Compatible** | Any |
| **Shape** | SingleTile |
| **Range** | 3 |
| **Filter** | EmptyTile |
| **Cooldown** | 3 turns |
| **Effect** | `spawnUnit(target, DecoyDrone)` |

**Decoy Drone unit**: `{ maxHP: 1, moveRange: 0, team: Hero, abilities: [] }` — a non-acting, non-moving hero-team unit that exists solely to be targeted. Enemies using Nearest-Threat AI (Formula F1) will target the Decoy if it's closest. **The Decoy is a target dummy.**

**Design intent**: Deploy a Decoy to redirect enemy telegraphs. If the Decoy is closer than any real hero, enemies target it instead. Dies in 1 hit but buys a turn of safety. **Extremely powerful for protecting objectives** or splitting enemy attention. 3-turn cooldown for balance.

> **Architectural note**: The Decoy is a `Unit` with `team: Hero`, making it a valid F1 candidate. **AI Phase Integration**: The AI resolves its target selection (Formula F1) during the Enemy Phase. Since the Decoy is deployed during the Player Phase, it is fully registered in the board state before the AI evaluates targets, preventing phase contradictions.

---

## Gadget Distribution via Draft

| Source | Gadget Rarity Available | Count |
|--------|------------------------|-------|
| **Reward node (battle)** | Common | Choose 1 of 3 (Gadget vs Passive vs Upgrade) |
| **Reward node (elite)** | Uncommon, Rare | Choose 1 of 3 |
| **Boss reward** | Rare guaranteed | Choose 1 of 2 |
| **Shop** | Any (weighted) | Buy from stock of 4 (mixed with Passives and Upgrades) |

### Draft Pool Integration

Reward nodes now offer a **mixed pool** of 3 content types:

```
RewardChoice = AbilityUpgrade | PassiveModule | Gadget
```

**Economy Integration**: In the Shop, Gadgets cost 3 Reputation (same as an Ability Upgrade). Selling an equipped Gadget yields 1 Reputation. This forces the player to weigh Gadgets directly against permanent stat upgrades.

The player drafts from a curated selection each time. This is the "variety lives in the draft" promise — every run has a different combination of upgrades, passives, and gadgets available.

---

## Full Hero Loadout Summary (v1)

After all three systems, each hero's runtime state is:

```
HeroRunState {
  // Identity (permanent, never changes)
  chassis: HeroDefinition        // Vanguard, Striker, etc.
  signatureAbility: AbilityDefinition  // Shove, Piercing Round, etc.

  // Draft-acquired (found during run, permanent once equipped)
  abilityUpgrades: [UpgradeSlot, UpgradeSlot]        // 2 numeric upgrade slots
  equipmentSlots: [EquipmentSlot, EquipmentSlot]      // 2 hybrid slots (Passive | Gadget)

  // Battle state (reset each battle)
  currentHP: int
  position: tile
  moveSlotUsed: boolean
  abilitySlotUsed: boolean // Shared by Signature Ability AND Gadget
  gadgetCooldown: int             // 0 = ready
  gadgetUsesRemaining: int | null // null = unlimited
}

EquipmentSlot = PassiveModule | Gadget | null
// Constraint: at most 1 Gadget across both slots
```

### Action Economy per Turn

```
Hero Turn Options:
  Slot 1 (Position):  Move (walk within moveRange)

  Slot 2 (Verb):      Signature Ability (always available if legal targets exist)
                      — OR —
                      Gadget (if equipped, if off cooldown)
```

**Total actions: always 2.** `actions_per_hero_turn = 2` is preserved.

---

## Synergy Examples (Gadget × Hero × Passive)

### Build 1: "The Wrecking Ball" (Vanguard)
- **Signature**: Ram (push 2)
- **Gadget**: Impact Charge (damage 2 + push 2)
- **Passive**: Force Amplifier (doubled collision damage)
- **Play pattern**: Move to position, then Impact Charge → enemy hits wall for 4 collision damage + 2 direct. Total: 6 damage in one turn, but from a longer range than normal Shove.

### Build 2: "The Smoke Screen" (Crucible)
- **Signature**: Eruption (spawnHazard Fire + push outward)
- **Gadget**: Smoke Bomb (protect a hero from targeting)
- **Passive**: Hazard Walker (immune to fire)
- **Play pattern**: Drop Smoke on a threatened hero, then place Vortex on a choke point. The team is protected from both telegraphed attacks AND terrain hazards.

### Build 3: "The Sniper's Nest" (Striker)
- **Signature**: Piercing Round (Line, damage 3)
- **Gadget**: Deployable Shield (create wall)
- **Passive**: Overwatch (+2 range after skipping ability)
- **Play pattern**: Turn 1: Deploy Shield to block enemy approach. Turn 2: Overwatch-boosted Piercing Round at range 6 from behind cover. Safe, long-range, devastating.

### Build 4: "The Puppet Master" (Twinblade)
- **Signature**: Blink Swap (swap positions with ally)
- **Gadget**: Swap Beacon (swap with any unit, range 3)
- **Passive**: Chain Reaction (kills push nearby units)
- **Play pattern**: Swap Beacon → swap a damaged enemy next to other enemies. Then Blink Swap an ally out of danger. Kill the damaged enemy → Chain Reaction pushes its neighbors into hazards. Total board reshape.

---

## Impact on Architecture

### Required Changes

| System | Change | Scope |
|--------|--------|-------|
| **Heroes & Abilities** | Add `gadgetSlot: GadgetInstance \| null` to runtime state; modify Ability slot to accept "Gadget" as alternative | Medium |
| **Turn & Phase Manager** | No change — `actions_per_hero_turn` stays 2. Gadget is just a different action in slot 1 | None |
| **Input & Selection** | When hero is selected, show "Ability \| Gadget" toggle for slot 2 (if Gadget equipped + off cooldown) | Small |
| **Move Preview** | Gadget's `compileEffects()` feeds into the same preview pipeline as abilities | Small |
| **Combat Resolution** | No change — Gadgets compile to the same `EffectPrimitive[]` | None |
| **Draft / Loadout Meta** | Add Gadget to draftable pool | Medium |
| **Battle HUD** | Show Gadget icon + cooldown per hero | Small |

### New ADR Recommended
> **ADR-0013: Gadget action slot** — Gadgets consume the Ability action slot, not the Move slot. This is enforced at the Heroes & Abilities level: `resolveSlot2(hero, choice: "ability" | "gadget")`. The rest of the combat pipeline sees the Gadget as a normal `resolve()` call, identical to an ability use.

---

## Resolved Design Decisions

1. ✅ **Gadget cooldown vs uses**: **Both systems**. Each Gadget defines `cooldownTurns` (0 = no cooldown) AND `usesPerBattle` (null = unlimited). Some gadgets are cooldown-only, some are uses-only, powerful ones have both constraints.
2. ✅ **Decoy + objectives**: **Yes**, a Decoy Drone on an objective tile counts as "defended." It is a `Unit` with `team: Hero`, which satisfies Objective / Win-Lose's occupation check. This is intentionally powerful — using a Move action + 3-turn CD to deploy a defender is a meaningful tactical investment.
3. ✅ **Hybrid Equipment slots**: Gadgets share the 2 Equipment slots with Passive Modules (see Document B). Max 1 Gadget per hero.
4. **Grapple Hook and hazards**: Deferred to implementation — start with "no hazard triggers during grapple" and tune if too strong.
