# VANGUARD — Hero Roster & Squad Design

> **Status**: Draft — awaiting Creative Director review
> **Date**: 2026-07-28
> **Depends on**: [heroes-and-abilities.md](../gdd/heroes-and-abilities.md), [art-bible.md](../art/art-bible.md)
> **Design pillars**: #4 Every Hero Is a Verb · #2 Positioning Over Power · #5 Read in Ten Seconds

---

## Design Philosophy

### ITB Reference → VANGUARD Adaptation

| ITB Pattern | VANGUARD Adaptation |
|------------|---------------------|
| 3 mechs per squad, typed by class (Prime/Brute/Ranged/Science) | 3 heroes per squad, typed by **verb family** (Shove/Pull/Swap/Wall/Zone) |
| Each mech has 1 weapon defining its identity | Each hero has **exactly 1 signature ability** (Rule 3 from GDD) |
| Squads have thematic coherence (Flame Behemoths = fire, Blitzkrieg = chain effects) | Squads have **tactical coherence** — 3 verbs that combo naturally |
| Mech class determines movement + weapon range pattern | Hero class is **flavor/UI only** — all heroes share Move + 1 Ability |
| Unlock via achievements | Unlock via meta-progression (1 starter squad, rest through play) |

### Core Roster Constraints (from GDD)
- **12 heroes** total (4 squads × 3) — this is the v1 roster
- Each hero = 1 `HeroDefinition` with exactly 1 `AbilityDefinition`
- No two heroes share the same verb (Pillar #4 test: "if a new hero is merely *stronger*, cut it")
- `squad_size = 3` (default loadout), draft allows mixing across squads
- All abilities use the 10 Combat Resolution primitives only

---

## Squad 1: IRON VANGUARD *(Starter Squad)*

> **Squad Fantasy**: "We push the line forward — nothing stands where we want it."
> **Tactical Identity**: **Shove specialists** — rearrange enemy positions to neutralize threats via forced displacement. The bread-and-butter squad that teaches push/collision as a win condition.
> **Visual Theme**: Heavy, grounded silhouettes. Trapezoidal shapes with wide stances. Dominant color accent: **Orange (#FF8800)** — the Shove verb family.
> **Unlock**: Available from game start.

### Heroes

#### 1. Vanguard — "The Bulldozer"

| Field | Value |
|-------|-------|
| **Class** (flavor) | Vanguard |
| **Verb** | Shove |
| **maxHP** | 6 |
| **moveRange** | 3 |
| **Ability** | **Ram** |
| **Shape** | UnitTarget |
| **Range** | 1 (melee — adjacent only) |
| **Filter** | Enemy |
| **Effect Template** | `push($target, dir=casterToTarget, distance=2)` |

**Design intent**: The most straightforward hero in the game. Walk up, shove an enemy 2 tiles. Teaches the core mechanic: *pushing an enemy into a wall deals collision damage; pushing into another enemy damages both; pushing into a hazard burns them.* The Vanguard is the ITB Combat Mech analog — a blunt instrument whose depth comes from positioning.

**Visual Direction**:
- Silhouette: Wide trapezoidal body, massive shield-like front plate. The heaviest, most grounded shape in the game.
- Art Bible ref: Orange accent on shield glow and forward-facing chevrons on armor.
- Telegraph icon: Heavy orange chevron (▶▶) showing push direction.

---

#### 2. Mortar — "The Launcher"

| Field | Value |
|-------|-------|
| **Class** (flavor) | Vanguard |
| **Verb** | Shove (ranged area knockback) |
| **maxHP** | 4 |
| **moveRange** | 2 |
| **Ability** | **Concussion Shell** |
| **Shape** | SingleTile |
| **Range** | 3 (ranged — fires over obstacles) |
| **Filter** | AnyTile |
| **Effect Template** | For each unit in `neighbors($target)`: `push(unit, dir=targetToUnit, distance=1)` |

**Design intent**: An area-push hero — drops a shell on a tile that pushes all adjacent units 1 tile outward from the impact point. Lower HP and move range balance the powerful area denial. This is the ITB Artillery Mech analog — ranged push, but at the cost of vulnerability.

**Visual Direction**:
- Silhouette: Tall, narrow upper body with a wide mortar tube on shoulder. Asymmetric — top-heavy to suggest fragility.
- Art Bible ref: Orange rings radiating outward from impact point icon.
- Telegraph icon: Orange starburst (✳) with outward arrows.

---

#### 3. Bastion — "The Wall"

| Field | Value |
|-------|-------|
| **Class** (flavor) | Support |
| **Verb** | Wall (create obstacle) |
| **maxHP** | 5 |
| **moveRange** | 3 |
| **Ability** | **Barricade** |
| **Shape** | SingleTile |
| **Range** | 2 |
| **Filter** | EmptyTile |
| **Effect Template** | `setTerrain($target, Blocked, duration=2)` |

**Design intent**: Creates a temporary wall tile. Combos with the squad's push verbs — Vanguard pushes an enemy into Bastion's wall for collision damage, or Bastion walls off an escape route before Mortar's knockback. The ITB defense mech analog — utility over damage, enabling teammates' verbs.

**Visual Direction**:
- Silhouette: Square, fortress-like body with flat top. Shield icon integrated into body shape. Most rectangular hero.
- Art Bible ref: **Yellow (#FFCC00)** — the Wall verb family. Geometric block patterns.
- Telegraph icon: Yellow square (■) on the target tile.

---

## Squad 2: RIFTBREAKERS

> **Squad Fantasy**: "We don't fight you — we *rearrange* you."
> **Tactical Identity**: **Pull + Swap specialists** — drag enemies out of position and rearrange the board. High tactical ceiling, harder to learn. Wins by making enemies hit each other.
> **Visual Theme**: Lean, angular silhouettes with flowing lines suggesting motion/gravity. Dominant accents: **Cyan (#00CCFF)** + **Purple (#BB33FF)** — Pull and Swap families.
> **Unlock**: Complete 2 runs.

### Heroes

#### 4. Warden — "The Anchor"

| Field | Value |
|-------|-------|
| **Class** (flavor) | Controller |
| **Verb** | Pull |
| **maxHP** | 5 |
| **moveRange** | 2 |
| **Ability** | **Anchor Pull** |
| **Shape** | UnitTarget, `requiresOrthogonalAlignment` |
| **Range** | 4 |
| **Filter** | Enemy |
| **Effect Template** | `pull($target, source=caster, dir=targetToCaster, distance=$distToTarget−1)` |

**Design intent**: Long-range single-target pull — drags an enemy along a cardinal line until it's 1 tile from the Warden. The orthogonal alignment restriction means the Warden must position carefully (Pillar #2). Combos with teammates: pull an enemy into Twinblade's swap range, or pull into a hazard placed by Flux.

**Visual Direction**:
- Silhouette: Tall, thin figure with one extended arm (the "anchor arm"). Body leans backward suggesting pulling force.
- Art Bible ref: Cyan glow emanating from the extended arm, energy lines drawn toward the Warden.
- Telegraph icon: Cyan hooked arrow (↩) from target toward Warden.

---

#### 5. Twinblade — "The Dancer"

| Field | Value |
|-------|-------|
| **Class** (flavor) | Support |
| **Verb** | Swap |
| **maxHP** | 5 |
| **moveRange** | 3 |
| **Ability** | **Blink Swap** |
| **Shape** | UnitTarget |
| **Range** | 3 |
| **Filter** | AnyUnit (excludes self) |
| **Effect Template** | `swap(caster, $target)` |

**Design intent**: Teleport-swap positions with any unit (ally OR enemy) within range. The only hero whose filter is `AnyUnit` — this means it can pull an ally out of a telegraphed hit OR shove an enemy into a deadly position by swapping into it. The most flexible verb in the game, highest skill ceiling.

**Visual Direction**:
- Silhouette: Two mirrored blade-like extensions creating a symmetrical figure. Balanced, almost butterfly-like.
- Art Bible ref: Purple (#BB33FF) double-loop arrows (⇄) showing the exchange.
- Telegraph icon: Purple looping double-arrow between caster and target.

---

#### 6. Flux — "The Sinkhole"

| Field | Value |
|-------|-------|
| **Class** (flavor) | Controller |
| **Verb** | Zone (gravity vortex) |
| **maxHP** | 4 |
| **moveRange** | 2 |
| **Ability** | **Gravity Well** |
| **Shape** | SingleTile |
| **Range** | 3 |
| **Filter** | AnyTile |
| **Effect Template** | `spawnHazard($target, Vortex, damage=1, duration=2)`, then for each unit in `neighbors($target)`: `pull(unit, source=$target, dir=unitToTarget, distance=1)` |

**Design intent**: Creates a gravity vortex hazard that also pulls adjacent units 1 tile inward. Combos with the squad: Warden pulls an enemy into Flux's vortex range, then Flux activates the vortex. Twinblade swaps an ally out of the zone afterward.

**Visual Direction**:
- Silhouette: Swirling, spiral body shape. Asymmetric, slightly top-heavy. The only hero with curves suggesting rotation.
- Art Bible ref: **Mint Green (#00FFAA)** — Zone family, with Cyan pull accents on the inward arrows.
- Telegraph icon: Green spiral (🌀) with inward cyan arrows.

---

## Squad 3: EMBER CORPS

> **Squad Fantasy**: "The board burns — we decide what survives."
> **Tactical Identity**: **Hazard + Zone specialists** — control the battlefield through fire and area denial. Slow, methodical play: set traps, then force enemies into them. Wins by attrition and hazard damage.
> **Visual Theme**: Jagged, flickering silhouettes with sharp angles suggesting flame. Dominant accent: **Orange-Red (#FF6600)** hazard family + **Mint Green (#00FFAA)** zone.
> **Unlock**: Complete 4 runs.

### Heroes

#### 7. Ember — "The Firestarter"

| Field | Value |
|-------|-------|
| **Class** (flavor) | Controller |
| **Verb** | Zone (fire hazard) |
| **maxHP** | 5 |
| **moveRange** | 2 |
| **Ability** | **Firebrand** |
| **Shape** | SingleTile |
| **Range** | 3 |
| **Filter** | AnyTile |
| **Effect Template** | `spawnHazard($target, Fire, damage=2, duration=2)`, then if `isOccupied($target)`: `applyHazard($target)` |

**Design intent**: Place fire on any tile in range. If an enemy is already standing there, they take damage immediately. Fire persists for 2 turns, punishing movement through the tile. The core hazard verb — simple, versatile, and the foundation the squad builds combos around.

**Visual Direction**:
- Silhouette: Triangular body shape with flickering flame-like protrusions at the top. The sharpest hero silhouette.
- Art Bible ref: Orange-Red (#FF6600) fire icon, diagonal hazard stripes on affected tile.
- Telegraph icon: Fire diamond (🔥) on target tile.

---

#### 8. Piston — "The Hammer"

| Field | Value |
|-------|-------|
| **Class** (flavor) | Vanguard |
| **Verb** | Shove + Damage |
| **maxHP** | 7 |
| **moveRange** | 3 |
| **Ability** | **Forge Strike** |
| **Shape** | UnitTarget |
| **Range** | 1 |
| **Filter** | AnyUnit |
| **Effect Template** | `damage($target, 1)`, `push($target, dir=casterToTarget, distance=1)` |

**Design intent**: A melee bruiser that does light damage AND pushes. The key: `AnyUnit` filter means Piston can push allies too — shove an ally out of danger. Combos with Ember: place fire → Piston shoves enemy into it. The "friendly fire is a feature" hero.

**Visual Direction**:
- Silhouette: Industrial, piston-arm mechanical shape. One oversized arm (the striking arm). Orange shove accent mixed with orange-red fire motifs.
- Art Bible ref: Orange (#FF8800) push chevron combined with damage red.
- Telegraph icon: Orange arrow + red impact star.

---

#### 9. Crucible — "The Eruption"

| Field | Value |
|-------|-------|
| **Class** (flavor) | Controller |
| **Verb** | Zone (area fire + push) |
| **maxHP** | 4 |
| **moveRange** | 2 |
| **Ability** | **Eruption** |
| **Shape** | Area |
| **Range** | 3 |
| **areaRadius** | 1 |
| **Filter** | AnyTile |
| **Effect Template** | For each tile in area: `spawnHazard(tile, Fire, damage=2, duration=1)`. For each unit in area: `push(unit, dir=centerToUnit, distance=1)` |

**Design intent**: The squad's AoE finisher — erupts a 3×3 area (radius 1) with fire and pushes everything outward. Combines zone damage with crowd control. Fragile (4 HP) but devastating when Ember sets up the kill zone.

**Visual Direction**:
- Silhouette: Wide, low body with a gaping circular opening on top (the "crucible mouth"). Symmetrical, bowl-like.
- Art Bible ref: Orange-Red (#FF6600) expanding ring icons.
- Telegraph icon: Orange-red expanding ring (◎) with outward arrows.

---

## Squad 4: PHANTOM DIRECTIVE

> **Squad Fantasy**: "We were never there — they just... destroyed themselves."
> **Tactical Identity**: **Redirect + reflect specialists** — manipulates enemy positioning so enemies attack each other or walk into hazards. Highest skill floor, highest reward ceiling.
> **Visual Theme**: Ghostly, semi-transparent silhouettes with flowing trailing edges. Dominant accents: **Cyan (#00CCFF)** pull + **Purple (#BB33FF)** swap, desaturated.
> **Unlock**: Complete 6 runs.

### Heroes

#### 10. Striker — "The Piercer"

| Field | Value |
|-------|-------|
| **Class** (flavor) | Vanguard |
| **Verb** | Damage (line pierce) |
| **maxHP** | 7 |
| **moveRange** | 3 |
| **Ability** | **Piercing Round** |
| **Shape** | Line |
| **Range** | 4 |
| **Filter** | — (hits all units in ray) |
| **Effect Template** | For each unit in `rayTiles(caster, $direction, 4)`: `damage(unit, 2)` |

**Design intent**: The squad's only direct damage dealer — fires a piercing beam through all units in a line. No push, no displacement — pure damage. Exists to finish enemies weakened by the squad's indirect play.

**Visual Direction**:
- Silhouette: Long, narrow profile with a pointed front end. Sleek, arrow-like. Most horizontally elongated hero.
- Art Bible ref: Red (#FF3333) damage line projecting forward. Clean, thin laser aesthetic.
- Telegraph icon: Red line (━━━) through affected tiles.

---

#### 11. Specter — "The Redirect"

| Field | Value |
|-------|-------|
| **Class** (flavor) | Support |
| **Verb** | Pull (any unit) |
| **maxHP** | 4 |
| **moveRange** | 3 |
| **Ability** | **Phase Snare** |
| **Shape** | UnitTarget, `requiresOrthogonalAlignment` |
| **Range** | 3 |
| **Filter** | AnyUnit |
| **Effect Template** | `pull($target, source=caster, dir=targetToCaster, distance=2)` |

**Design intent**: Shorter range than Warden but pulls ANY unit (ally or enemy) 2 tiles. The `AnyUnit` filter makes it the most versatile repositioning tool — pull an enemy into another enemy's telegraph, or pull an ally to safety.

**Visual Direction**:
- Silhouette: Ghostly, wispy shape with trailing edges. Semi-transparent energy suggests phasing. The lightest, most ethereal hero.
- Art Bible ref: Desaturated Cyan with ghost-trail effect. Energy threads from target to Specter.
- Telegraph icon: Cyan dashed arrow (⇠) from target toward Specter.

---

#### 12. Wraith — "The Mirror"

| Field | Value |
|-------|-------|
| **Class** (flavor) | Controller |
| **Verb** | Swap (enemy-to-enemy) |
| **maxHP** | 5 |
| **moveRange** | 2 |
| **Ability** | **Displacement Rift** |
| **Shape** | UnitTarget |
| **Range** | 3 |
| **Filter** | Enemy |
| **Effect Template** | Select second target: enemy within range 1 of first target. `swap($target1, $target2)` |

**Design intent**: The most complex verb in the game — swaps the positions of two *enemies*. This forces enemies into each other's telegraphs, creates collisions, and disrupts enemy formations. The "galaxy brain" hero: easy to misuse, devastating when used correctly.

> **Implementation note**: Wraith's ability requires a **two-target selection flow** — pick first enemy, then second enemy (within range 1 of first). This extends the InputManager state machine with a `SecondTarget` state. The GDD AbilityDefinition schema may need a `secondaryShape` field, or this can be compiled as two sequential effects within `compileEffects()`.

**Visual Direction**:
- Silhouette: Symmetrical, mirror-image shape — two identical halves facing outward. Suggests duality and reflection.
- Art Bible ref: Purple (#BB33FF) portal/rift circles on both swap targets.
- Telegraph icon: Purple double portal circles (⊛⊛) connected by a line.

---

## Squad Synergy Matrix

Each squad's 3 verbs combo naturally. The draft system allows mixing for emergent cross-squad synergies:

| Combo | Heroes | How It Works |
|-------|--------|-------------|
| **Push → Wall** | Vanguard + Bastion | Place wall behind enemy, then push into wall for collision damage |
| **Pull → Hazard** | Warden + Ember | Place fire on tile, then pull enemy onto it |
| **Swap → Telegraph** | Twinblade + any | Swap enemy into another enemy's telegraph |
| **Eruption → Push** | Crucible + Vanguard | Eruption pushes enemies outward; Vanguard catches pushed enemies |
| **Redirect → Pierce** | Specter + Striker | Pull two enemies into a line; Striker pierces both |
| **Wall → Pull** | Bastion + Warden | Wall off escape route, pull target into dead end |
| **Swap-Enemy → Hazard** | Wraith + Ember | Swap enemy into fire tile |
| **Vortex → Push** | Flux + Piston | Flux pulls enemies together; Piston shoves one into the cluster |

---

## Visual Identity Summary

### Shape Language by Squad

| Squad | Body Shape | Edge Quality | Weight | Stance |
|-------|-----------|-------------|--------|--------|
| **Iron Vanguard** | Trapezoidal, wide | Blunt, heavy | Grounded | Wide, planted |
| **Riftbreakers** | Angular, lean | Sharp, flowing | Balanced | Dynamic, twisting |
| **Ember Corps** | Triangular, jagged | Flickering, sharp | Top-heavy | Aggressive, leaning |
| **Phantom Directive** | Wispy, ethereal | Soft, trailing | Light | Floating, drifting |

### Color Coding per Hero

| Hero | Primary Verb Color | Secondary | Silhouette Base |
|------|-------------------|-----------|-----------------|
| Vanguard | Orange (#FF8800) | — | Blue (#4488FF) |
| Mortar | Orange (#FF8800) | — | Blue (#4488FF) |
| Bastion | Yellow (#FFCC00) | — | Blue (#4488FF) |
| Warden | Cyan (#00CCFF) | — | Blue (#4488FF) |
| Twinblade | Purple (#BB33FF) | — | Blue (#4488FF) |
| Flux | Mint (#00FFAA) | Cyan | Blue (#4488FF) |
| Ember | Orange-Red (#FF6600) | — | Blue (#4488FF) |
| Piston | Orange (#FF8800) | Red (#FF3333) | Blue (#4488FF) |
| Crucible | Orange-Red (#FF6600) | Orange (#FF8800) | Blue (#4488FF) |
| Striker | Red (#FF3333) | — | Blue (#4488FF) |
| Specter | Cyan (#00CCFF) | — | Blue (#4488FF) |
| Wraith | Purple (#BB33FF) | — | Blue (#4488FF) |

> All heroes share the Blue (#4488FF) silhouette base to instantly distinguish from red (#FF4444) enemies per Art Bible §3. Verb color appears on ability icons, UI panels, and telegraph overlays — not on unit body.

---

## Open Questions

1. **Wraith's two-target selection**: Keep two-step selection (complex but expressive) or simplify to "swap two nearest enemies in range"?
2. **Squad unlock order**: Linear (2/4/6 runs) or achievement-gated (ITB-style)?
3. **5th secret squad**: Plan for 15 total heroes, or keep v1 at 12?
