# VANGUARD — Enemy Roster & Archetype Design

> **Status**: Draft — awaiting Creative Director review
> **Date**: 2026-07-28
> **Depends on**: [enemy-abilities-and-telegraph.md](../gdd/enemy-abilities-and-telegraph.md), [art-bible.md](../art/art-bible.md), [difficulty-tiers.md](../gdd/difficulty-tiers.md)
> **Design pillars**: #1 Perfect Information · #2 Positioning Over Power · #5 Read in Ten Seconds

---

## Design Philosophy

### ITB Vek Reference → VANGUARD Adaptation

| ITB Pattern | VANGUARD Adaptation |
|------------|---------------------|
| Vek typed by behavior (melee charger, ranged lobber, artillery, support) | Enemies typed by **threat pattern** (Approach, Artillery, Zone, Support, Boss) |
| Normal + Alpha variants (stat scaling) | **Tier 1 → Tier 3** variants (stat + ability escalation) |
| Psions as passive aura buffers | **Overseers** — aura enemies that modify all allies on the board |
| Island-specific enemy pools | **Environment-themed encounter pools** — enemies synergize with terrain |
| Friendly fire is always on | Same — enemies can hit each other, rewarding player positioning |
| One-turn telegraph on all actions | Same — `chooseIntents()` → display → `resolveTelegraphed()` |

### Core Design Rules (from Enemy GDD)
- Every enemy ability is an `AbilityDefinition` (same schema as heroes)
- All abilities compile into the 10 Combat Resolution primitives
- AI uses Nearest-Threat target selection (Formula F1)
- Telegraph is immutable once set — never recomputed mid-turn
- Resolution order: ascending `unitId` (spawn order, oldest first)

### Enemy Design Test
> *"If a player cannot name what this enemy will do (move + effect) after seeing its telegraph for 10 seconds, redesign the telegraph."* (Pillar #5)

---

## Threat Pattern Classification

Every enemy archetype falls into exactly one threat pattern. This determines its behavioral identity and visual silhouette family:

| Pattern | Behavior | Visual Silhouette | ITB Analog |
|---------|----------|-------------------|-----------|
| **Approach** | High moveRange, low attackRange (melee). Runs at nearest hero. | Forward-leaning, top-heavy, spiky | Beetle, Hornet |
| **Artillery** | Low/zero moveRange, high/∞ attackRange. Stays put, hits from afar. | Wide base, upward-pointing barrel/tube | Scarab, Crab |
| **Zone** | Medium moveRange, places hazards or AoE on tiles. | Flat, spreading shape, organic/oozing | Blobber, Plasmodia |
| **Support** | Provides passive aura or modifies other enemies. Priority kill target. | Tall, thin, glowing — visually distinct from all combat types | Psion |
| **Boss** | Unique mechanics, multi-ability, high HP. 1 per encounter max. | Massive, occupies visual attention. Combines shapes. | Vek Leader |

---

## Tier System

Each archetype has up to 3 tiers. Higher tiers appear at higher difficulty via the Difficulty Tiers system:

| Tier | Label | When Appears | Stat Scaling | Ability Change |
|------|-------|-------------|-------------|----------------|
| **T1** | Standard | From Tier 1 encounters | Base stats | Base ability only |
| **T2** | Elite | From Tier 3+ encounters | +2 HP, +1 moveRange | Ability gains secondary effect or wider AoE |
| **T3** | Alpha | From Tier 5+ encounters | +4 HP, +1 moveRange, +1 attackRange | Full ability kit — new mechanics or on-death effects |

> **Design rule**: Tier escalation always adds **complexity** (more effects to read), never just raw numbers. A T3 Charger doesn't just do more damage — it also pushes on impact, creating a new tactical problem.

---

## APPROACH ENEMIES — "They come to you"

### 1. Drone — "The Swarm Fodder"

> The simplest enemy in the game. Teaches: "enemies move toward you and hit an adjacent tile."

| Field | T1 | T2 | T3 |
|-------|----|----|-----|
| **maxHP** | 2 | 4 | 6 |
| **moveRange** | 3 | 4 | 4 |
| **attackRange** | 1 | 1 | 1 |
| **Ability** | Bite | Bite | Venomous Bite |
| **Shape** | SingleTile | SingleTile | SingleTile |
| **Effect** | `damage(target, 1)` | `damage(target, 2)` | `damage(target, 2)`, `spawnHazard(target, Acid, 1, duration=1)` |
| **onDeath** | — | — | — |

**Tactical role**: Cheap, numerous. Individually non-threatening but in groups they block tiles and limit hero movement. The player learns to use push/pull to shove Drones into each other or into hazards rather than trying to kill them all directly.

**Visual**: Small, triangular, darting. Swarm insects — sharp silhouettes in groups. Red (#FF4444) enemy base.

---

### 2. Charger — "The Battering Ram"

> Teaches: "blocking the path is a valid tactic." The Beetle analog.

| Field | T1 | T2 | T3 |
|-------|----|----|-----|
| **maxHP** | 4 | 6 | 8 |
| **moveRange** | 3 | 4 | 4 |
| **attackRange** | 1 | 1 | 1 |
| **Ability** | Charge Strike | Charge Strike | Ram Through |
| **Shape** | SingleTile | SingleTile | SingleTile |
| **Effect** | `damage(target, 2)` | `damage(target, 2)`, `push(target, dir=chargerToTarget, 1)` | `damage(target, 3)`, `push(target, dir=chargerToTarget, 2)` |
| **onDeath** | — | — | — |

**Tactical role**: The primary melee threat. T1 is pure damage; T2 adds push (now the player must consider where the hero LANDS after being hit). T3's 2-tile push can chain-collide with walls or other units. **Block its path with a Wall (Bastion) or push it off-course to make it whiff.**

**Visual**: Heavy, rhino-like silhouette. Wide base, forward horn. Charges are shown as a dotted path + impact star on the telegraph.

---

### 3. Stalker — "The Flanker"

> Teaches: "some enemies ignore the front line." High mobility, bypasses formations.

| Field | T1 | T2 | T3 |
|-------|----|----|-----|
| **maxHP** | 3 | 5 | 7 |
| **moveRange** | 4 | 5 | 5 |
| **attackRange** | 1 | 1 | 1 |
| **Ability** | Slash | Slash | Ambush |
| **Shape** | SingleTile | SingleTile | Area (radius 0 = SingleTile, but hits 2 adjacent tiles) |
| **Effect** | `damage(target, 2)` | `damage(target, 2)` | For target + 1 neighbor: `damage(unit, 2)` |
| **onDeath** | — | — | — |

**Tactical role**: The "assassin." Highest moveRange among Approach enemies. Goes for backline heroes (Mortar, Ember, Crucible). Forces the player to either protect fragile heroes or bait the Stalker. T3's cleave punishes clustering — never group two low-HP heroes adjacent.

**Visual**: Low, crouching, elongated. Lizard/raptor silhouette. Fast, darting movement animation.

---

## ARTILLERY ENEMIES — "They hit from safety"

### 4. Lobber — "The Mortar"

> Teaches: "move out of the red tiles." Ranged area damage, stationary.

| Field | T1 | T2 | T3 |
|-------|----|----|-----|
| **maxHP** | 3 | 5 | 7 |
| **moveRange** | 1 | 1 | 2 |
| **attackRange** | 4 | 4 | 5 |
| **Ability** | Acid Glob | Acid Glob | Acid Rain |
| **Shape** | SingleTile | Area (radius 1) | Area (radius 1) |
| **areaRadius** | 0 | 1 | 1 |
| **Effect** | `damage(target, 1)` | For each unit in area: `damage(unit, 1)` | For each unit in area: `damage(unit, 1)`, `spawnHazard(tile, Acid, 1, duration=2)` |
| **onDeath** | — | — | `spawnHazard(deathTile, Acid, 1, duration=2)` for each neighbor |

**Tactical role**: Forces movement. The player must either move heroes off the telegraphed tiles or push the Lobber to cause a whiff (range gate). T2's AoE makes it harder to just sidestep. T3 leaves persistent Acid — the board progressively becomes more dangerous. **Pull or push the Lobber to make its fixed telegraphed tiles miss.**

**Visual**: Round, bloated body with an upward-facing aperture. Fires arcing projectiles. Pink/magenta (#FF5588) intent overlay on target tiles.

---

### 5. Spitter — "The Sniper"

> Teaches: "line-of-sight matters — don't stand in a cardinal line with this enemy."

| Field | T1 | T2 | T3 |
|-------|----|----|-----|
| **maxHP** | 3 | 5 | 7 |
| **moveRange** | 0 | 1 | 1 |
| **attackRange** | ∞ | ∞ | ∞ |
| **Ability** | Spike Shot | Spike Shot | Impaling Shot |
| **Shape** | SingleTile (line projectile — first unit hit) | SingleTile (first unit hit) | SingleTile (first unit hit) |
| **Effect** | `damage(target, 2)` | `damage(target, 2)` | `damage(target, 2)`, `push(target, dir=spitterToTarget, 1)` |
| **onDeath** | — | — | — |

**Tactical role**: The ITB Firefly analog. Unlimited range but only hits the FIRST unit in a cardinal line. Teaches: put another enemy between the Spitter and your hero — the Spitter hits its own ally (friendly fire). T3's push adds displacement danger. **Stationary turret — must be killed or have its line blocked.**

**Visual**: Tall, needle-like silhouette pointing in the firing direction. A red line projects from the Spitter through the target to the edge of the board (visual telegraph).

---

### 6. Sentinel — "The Area Denial"

> Teaches: "some threats are persistent — the board gets more dangerous over time."

| Field | T1 | T2 | T3 |
|-------|----|----|-----|
| **maxHP** | 4 | 6 | 8 |
| **moveRange** | 0 | 0 | 1 |
| **attackRange** | 3 | 3 | 4 |
| **Ability** | Mine Layer | Mine Layer | Mine Field |
| **Shape** | SingleTile | SingleTile | Area (radius 1) |
| **Effect** | `spawnHazard(target, Mine, damage=3, duration=∞)` | `spawnHazard(target, Mine, damage=3, duration=∞)` | For each tile in area: `spawnHazard(tile, Mine, damage=3, duration=∞)` |
| **onDeath** | — | Mines on all neighbor tiles: `spawnHazard(neighbor, Mine, 3, ∞)` | Same as T2 |

**Tactical role**: Doesn't do damage directly but makes the board increasingly hazardous. Mines are permanent until triggered (stepped on). Forces the player to carefully path heroes and consider push destinations. T2's on-death mine ring means killing it requires thinking about WHERE it dies. **Push enemies onto mines for massive damage.**

**Visual**: Squat, dome-shaped with mechanical appendages. Drops glowing triangular mines. Yellow-red hazard overlay on mined tiles.

---

## ZONE ENEMIES — "They reshape the board"

### 7. Broodmother — "The Spawner"

> Teaches: "kill this or the board floods." Priority target.

| Field | T1 | T2 | T3 |
|-------|----|----|-----|
| **maxHP** | 5 | 7 | 9 |
| **moveRange** | 1 | 2 | 2 |
| **attackRange** | 0 (spawns, doesn't attack) | 0 | 1 |
| **Ability** | Spawn Brood | Spawn Brood | Spawn Brood + Shriek |
| **Shape** | Self | Self | Self + SingleTile |
| **Effect** | `spawnUnit(neighbor, DroneT1)` × 1 | `spawnUnit(neighbor, DroneT1)` × 2 | `spawnUnit(neighbor, DroneT1)` × 2, then `damage(adjacent_target, 1)` |
| **onDeath** | `spawnUnit(neighbor, DroneT1)` × 2 | `spawnUnit(neighbor, DroneT1)` × 3 | `spawnUnit(neighbor, DroneT2)` × 2 |

**Tactical role**: The Vek Broodmother analog. Spawns Drones every turn. Left alone, the board drowns in bodies. But killing it also spawns Drones (on-death). **The optimal play is to kill it when its neighbor tiles are blocked (wall, edge, other units) so brood can't spawn.** Teaches interaction between push/wall verbs and spawn mechanics.

**Visual**: Large, bloated, egg-sac silhouette. Organic, pulsating. Spawn-imminent icons on neighbor tiles.

---

### 8. Shifter — "The Terrain Sculptor"

> Teaches: "the board itself can change." Creates walls and chasms.

| Field | T1 | T2 | T3 |
|-------|----|----|-----|
| **maxHP** | 4 | 6 | 8 |
| **moveRange** | 2 | 2 | 3 |
| **attackRange** | 2 | 3 | 3 |
| **Ability** | Erect Wall | Erect Wall | Terraform |
| **Shape** | SingleTile | SingleTile | SingleTile |
| **Filter** | EmptyTile | EmptyTile | AnyTile |
| **Effect** | `setTerrain(target, Blocked, duration=3)` | `setTerrain(target, Blocked, duration=3)` | `setTerrain(target, Chasm)` (permanent) |

**Tactical role**: The "architect" enemy. T1-T2 creates temporary walls that block hero movement and can trap heroes in corners. **Clever players use the walls offensively — push an enemy into the Shifter's wall for collision damage.** T3 creates permanent Chasms — a lethal tile that kills anything pushed into it. This turns every push/pull into a potential instant-kill if the terrain lines up.

**Visual**: Crystalline, angular silhouette. Geometric, mineral-like. Yellow (#FFCC00) wall indicators or red chasm icons on affected tiles.

---

## SUPPORT ENEMIES — "They make everything else worse"

### 9. Overseer — "The Aura Buffer"

> Teaches: "kill the Psion first." Global passive effect on all other enemies.

Overseers are unique — they don't attack directly. Instead, they provide a **passive aura** that buffs all other enemies on the board. Only 1 Overseer per encounter. Each has a different aura type:

| Variant | Aura Effect | Visual Cue | Counter-strategy |
|---------|------------|------------|-----------------|
| **Warchief** | All enemies gain +1 damage on all abilities | Red glow on all enemies | Kill early — every turn it lives, total incoming damage scales with enemy count |
| **Ironhide** | All enemies gain +2 maxHP (healing to full on spawn) | Grey armor overlay on all enemies | Focus priority target — more HP means enemies survive longer to deal more damage |
| **Volatile** | All enemies explode on death: `spawnHazard(deathTile, Fire, 2, duration=1)` per neighbor | Orange shimmer on all enemies | Position kills — killing an enemy near your heroes hurts them; killing enemies near OTHER enemies chains explosions |
| **Hivemind** | All enemies gain +1 moveRange | Speed lines on all enemies | Harder to avoid engagements — walls and positioning become critical |

| Field | All variants |
|-------|-------------|
| **maxHP** | 3 |
| **moveRange** | 2 |
| **attackRange** | 0 (no attack) |
| **Ability** | None (passive aura only) |
| **onDeath** | Aura instantly removed from all enemies |

**Tactical role**: The ITB Psion analog. Low HP, no attack — a glass cannon of utility. **Always the highest priority kill target.** The decision of "do I spend my turn killing the Overseer or dealing with the immediate telegraph" is the core tension it creates. Some Overseers are more dangerous than others depending on the encounter composition (Volatile + Broodmother = chain death explosions).

**Visual**: Tall, thin, floating silhouette with a glowing "crown" or halo. Visually distinct from all combat enemies. The aura color matches the buff type.

---

## BOSS ENEMIES — "The final puzzle"

### 10. Behemoth — "The Warlord"

> The run-ending boss. Multi-ability, high HP, unique mechanics.

| Field | Value |
|-------|-------|
| **maxHP** | 15 |
| **moveRange** | 2 |
| **attackRange** | 2 (melee slam) + ∞ (summon) |
| **Ability 1** | **Seismic Slam** — Area (radius 1), `damage(each, 3)` + `push(each, dir=centerToUnit, 1)` |
| **Ability 2** | **Summon Swarm** — `spawnUnit(spawn_point, DroneT2)` × 2 (uses spawn points) |
| **AI Pattern** | Alternates: Turn 1 Slam, Turn 2 Summon, Turn 3 Slam, ... |
| **onDeath** | Victory condition |

**Tactical role**: The boss is a two-phase puzzle. Slam turns are about positioning (don't cluster within radius 1). Summon turns are about spawn management. The alternating pattern is fully telegraphed — the player always knows which ability comes next. **Best strategy: use push/pull to keep heroes spread during slam, then use the summon turn to reposition and kill Drones.**

**Visual**: Massive, asymmetric silhouette. Dominates the grid visually. Multiple limbs/protrusions suggesting both melee and ranged capability.

---

### 11. Architect — "The Board Controller"

> Alternative boss for variety. Terraforms the board.

| Field | Value |
|-------|-------|
| **maxHP** | 12 |
| **moveRange** | 1 |
| **attackRange** | ∞ |
| **Ability 1** | **Rift Tear** — SingleTile at range ∞: `setTerrain(target, Chasm)` (permanent) |
| **Ability 2** | **Shockwave** — Area (radius 1 centered on self): `push(each, dir=centerToUnit, 2)` + `damage(each, 1)` |
| **AI Pattern** | Turn 1 Rift Tear, Turn 2 Shockwave, alternating |
| **onDeath** | Victory condition |

**Tactical role**: The "puzzle boss." Rift Tear permanently removes tiles from the board — the playable area shrinks every 2 turns. Shockwave pushes everything away from the Architect — into the Chasms it created. **Time pressure: the longer the fight, the less board is left. The player must rush damage while dodging the shrinking arena.**

**Visual**: Geometric, crystalline form. Floating. Tile-destruction shown as shattering grid squares.

---

## Environment-Enemy Synergy Matrix

VANGUARD v1 has one region but encounters can feature different **terrain themes**. Each theme favors certain enemy compositions:

| Terrain Theme | Environmental Hazard | Enemies That Synergize | Why |
|--------------|---------------------|----------------------|-----|
| **Ruins** (default) | Blocked walls, rubble | Charger, Stalker, Shifter | Walls create collision damage opportunities; Shifter adds more |
| **Inferno** | Fire tiles (pre-placed) | Lobber (Acid), Drone, Piston-squad heroes | Fire + Acid creates multi-hazard boards; push enemies into fire |
| **Badlands** | Chasms, limited tiles | Sentinel (mines), Spitter, Charger | Mines near chasms = instant kills; tight board rewards precision |
| **Hive** | Spawn points, organic walls | Broodmother, Drone (many), Overseer | Swarm pressure; spawn-point blocking is critical |

---

## Encounter Composition Guidelines

For Encounter Generator template authoring:

| Encounter Type | Enemy Count | Composition Rule |
|---------------|-------------|-----------------|
| **Battle (normal)** | 3–5 enemies | At least 1 Approach + 1 Artillery/Zone. No Bosses. Max 1 Overseer. |
| **Elite** | 4–6 enemies | Must include at least 1 T2+ enemy. Max 1 Overseer. |
| **Boss** | 1 Boss + 2–4 minions | Boss + Drones (spawned by boss or pre-placed). Optional 1 Overseer. |

| Difficulty Tier | T1 : T2 : T3 Ratio | Overseer Frequency |
|----------------|--------------------|--------------------|
| Tier 1–2 | All T1 | Never |
| Tier 3–4 | 70% T1, 30% T2 | 20% of encounters |
| Tier 5–6 | 40% T1, 40% T2, 20% T3 | 50% of encounters |
| Tier 7+ | 20% T1, 40% T2, 40% T3 | 80% of encounters |

---

## Visual Identity Summary

### Shape Language by Threat Pattern

| Pattern | Body Shape | Edge Quality | Size | Art Bible §3 Ref |
|---------|-----------|-------------|------|-------------------|
| **Approach** | Triangular, forward-leaning | Sharp, jagged | Medium | Enemy = aggressive geometry |
| **Artillery** | Wide base, narrow top | Smooth base, sharp aperture | Medium-Large | Top-heavy = threat |
| **Zone** | Organic, spreading | Soft, blobby or crystalline | Varies | Distinct from geometric combat types |
| **Support** | Tall, thin, vertical | Smooth, glowing | Small body, large aura | Must stand out visually |
| **Boss** | Massive, composite | Mixed sharp + smooth | 2× normal enemy size | Dominates grid attention |

All enemies use **Red (#FF4444)** as their base silhouette color (vs Blue #4488FF for heroes) per Art Bible §3.

---

## Resolved Design Decisions

1. ✅ **Mine hazard type**: **New HazardType**. `Mine` is a distinct hazard alongside `Fire`, `Acid`, and the new `Smoke`. Mine properties: `{ damage: 3, duration: ∞, triggerOn: "step" }` — detonates when any unit enters the tile (via Move or forced displacement), then is consumed. Not a Fire variant because: different trigger model (on-step vs per-tick), infinite duration, single-detonation.
2. ✅ **Smoke hazard type**: **New HazardType**. `Smoke` blocks enemy AI targeting (`Formula F1` skips units on Smoke tiles as candidates). Properties: `{ damage: 0, duration: 1, effect: "blocks_targeting" }`. Does NOT block movement or LoS for player abilities — only enemy AI target selection.
3. **Overseer aura implementation**: Deferred to implementation. Recommend: auras as runtime stat modifiers applied at `chooseIntents()` time, removed on Overseer death — simpler than reusing Ability Upgrades' additive-delta (which is hero-only and run-persistent).
4. **Boss multi-ability**: Deferred to implementation. Recommend: simple turn-parity check (`turn % 2 == 0 ? ability1 : ability2`) — a state machine is overkill for v1's alternating pattern.

### New Hazard Types Summary

| Hazard | Damage | Duration | Trigger | Source |
|--------|--------|----------|---------|--------|
| **Fire** (existing) | `fire_damage_per_tick` | N turns | Per-tick (Environment Phase) | Ember heroes, Aftershock passive |
| **Acid** (existing) | `acid_damage_per_tick` | N turns | Per-tick (Environment Phase) | Lobber T3 |
| **Mine** (new) | 3 | ∞ (until triggered) | On-step (any unit enters tile) | Sentinel enemy |
| **Smoke** (new) | 0 | 1 turn | Passive (blocks targeting) | Smoke Bomb gadget |

