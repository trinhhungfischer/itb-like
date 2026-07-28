# Game Concept: VANGUARD *(working title)*

*Created: 2026-07-27*
*Status: Draft*

---

## Elevator Pitch

> It's a **deterministic tactical roguelike** where you command a tiny squad of
> heroes — each defined by one unique board-manipulating verb — across a
> procedurally routed campaign, winning every fully-telegraphed battle by
> **position and foresight, not damage or luck**.
>
> Test: "Into the Breach meets a squad RPG — you outsmart the enemy on a chess
> grid, and your roster/build changes every run." Understandable in 10 seconds.

---

## Core Identity

| Aspect | Detail |
| ---- | ---- |
| **Genre** | Deterministic tactical roguelike (Into-the-Breach-like) + light 4X meta layer |
| **Platform** | Web / Browser (pure web — no native engine) |
| **Target Audience** | Strategy/puzzle players who value mastery (see Player Profile) |
| **Player Count** | Single-player |
| **Session Length** | 30–60 min per run; individual battles ~5 min |
| **Monetization** | None decided yet (premium or free web release likely) |
| **Estimated Scope** | Medium–Large (4–6 months, solo) |
| **Comparable Titles** | Into the Breach, Slay the Spire, Wildfrost |

---

## Core Fantasy

**"I am a cunning commander who wins with my mind, not with numbers."**

The player leads an outnumbered elite squad and, through perfect reading of the
board, turns the enemy's own momentum against them. Every battle is a solvable
situation; the joy is the *"aha!"* of finding the one clean sequence of moves
that neutralizes every threat at once — and doing it with heroes whose unique
verbs let you manipulate the battlefield in ways brute force never could.

What you can do here that you can't elsewhere: experience Into the Breach's
"solve-and-act in the same move" clarity, but wrapped in a roguelike run where
*which* verbs you command changes every time.

---

## Fiction and Terminology

*Added 2026-07-28, when `pilots.md` forced the question. Prior to this the game's
fiction was undeclared: `heroes-and-abilities.md` used the term `chassis`,
`hero-roster-and-squads.md` described armor plates and shoulder-mounted mortar
tubes and called its units "the ITB Combat Mech analog", and `art-bible.md` §2
specified "blueprint" and "laboratory" lighting — but nothing stated outright what
a unit* is.

**The units are mechs — piloted machines.** The player is the **commander** who
directs them, which is exactly the identity the Core Fantasy above already claims
("I am a cunning commander"). **Pilots** are the human beings inside the mechs, and
they are the only thing in the entire design that can be permanently lost within a
run (see `pilots.md`).

This resolves a latent incoherence rather than introducing a new theme: the art
direction and hero roster already read as machines, and the schema already called
its units chassis. Only the word "hero" implied people.

### Terminology split (deliberate)

| Layer | Term | Rationale |
|---|---|---|
| Schema / code | `HeroDefinition`, `RosterMember`, `Unit`, `hero` | Retained unchanged. No production code exists yet, so renaming would be free in code — but renaming across 24 reviewed GDDs immediately before Sprint 1 is pure risk for zero gameplay value |
| Player-facing text | "mech", "pilot", "commander" | What the player reads in UI, tutorial, and flavor |

This split is intentional and permanent for v1. Do not "fix" it by renaming schema
identifiers; do not leak `hero` into player-facing strings.

---

## Unique Hook

**It's like Into the Breach, AND ALSO every hero is a distinct board-manipulating
*verb* (shove, swap, wall, pull…) that you draft and combine across a roguelike
campaign — the variety lives entirely in the draft, never in in-battle dice.**

The hook:
- One sentence, gameplay-affecting, not cosmetic.
- Novel synthesis: ITB's deterministic clarity + a roguelike hero-draft where
  emergent depth comes from verb combinations, not stat rolls or RNG combat.
- Directly serves the core fantasy: outsmarting, not overpowering.

---

## Player Experience Analysis (MDA Framework)

### Target Aesthetics (What the player FEELS)

| Aesthetic | Priority | How We Deliver It |
| ---- | ---- | ---- |
| **Challenge** (obstacle course, mastery) | **1** | Fully-telegraphed, deterministic battles; failure is always the player's miscalculation; rising difficulty tiers. |
| **Expression** (self-expression, creativity) | 2 | Roster/verb draft between battles; many valid solutions per puzzle; personal build identity. |
| **Discovery** (exploration, emergent systems) | 3 | Discovering verb synergies and optimal solution paths; unlocking new heroes/enemies. |
| **Fantasy** (make-believe, role-playing) | 4 | The "cunning commander" identity; heroes with personality and signature verbs. |
| **Sensation** | 5 | Crisp, readable "juice" on each move (knockback, tile reactions) — clarity-first, not spectacle. |
| **Narrative** | 6 | Light framing: a region/frontline to defend; heroes with brief flavor. |
| **Fellowship** | N/A | Single-player. |
| **Submission** | N/A | Intentionally not a relaxing game — losses are earned. |

### Key Dynamics (Emergent player behaviors)
- Players read the full enemy telegraph, then plan a whole turn as one puzzle.
- Players experiment with hero verb combinations to find synergies ("shove into
  a wall my other hero just built").
- Players draft toward a build identity across a run and re-plan when the draft
  denies their preferred verbs.
- Players self-impose challenge (hero restrictions, higher tiers) once mastered.

### Core Mechanics (Systems we build)

1. **Deterministic turn-based grid combat** — perfect information, enemy actions
   fully telegraphed one turn ahead; no hit-chance RNG.
2. **Hero verbs** — each hero is one unique board-manipulation verb (shove, pull,
   swap, wall, teleport, zone…) plus a movement rule; no generic stat-stick units.
3. **Roguelike run structure** — a procedurally routed node map (Slay-the-Spire-
   style) linking battles, with a draft of heroes/verb-upgrades between battles.
4. **Light 4X-lite meta** — claim/hold map nodes for passive run bonuses (a thin
   "expand/control" layer, deliberately kept minimal in v1).
5. **Meta-progression** — unlock new heroes, enemy variants, and difficulty tiers
   across runs.

---

## Player Motivation Profile

### Primary Psychological Needs Served

| Need | How This Game Satisfies It | Strength |
| ---- | ---- | ---- |
| **Autonomy** | Choice of roster, campaign route, and multiple valid solutions per battle. | Core |
| **Competence** | Deterministic + telegraphed ⇒ every loss is a legible mistake, every win is proof of skill. The cleanest possible mastery-feedback loop. | Core |
| **Relatedness** | Attachment to distinct hero personalities/verbs and to the region being defended. | Supporting |

### Player Type Appeal (Bartle Taxonomy)

- [x] **Achievers** — climbing difficulty tiers, unlocking full roster, mastering runs.
- [x] **Explorers** — mapping the solution space of each puzzle and the verb-synergy system.
- [ ] **Socializers** — not served (single-player, no social layer).
- [ ] **Killers/Competitors** — not served directly (possible future: score/leaderboard runs).

### Flow State Design

- **Onboarding curve**: First battles introduce one hero verb at a time on small
  boards with obvious telegraphs; the first 10 minutes teach "read → plan → act."
- **Difficulty scaling**: More enemies, tighter boards, and richer telegraph
  combinations per tier; difficulty comes from complexity, never from randomness.
- **Feedback clarity**: Every move shows its full consequence before commit
  (preview), so improvement is self-evident.
- **Recovery from failure**: A lost battle/run restarts fast; failure is
  educational ("I see the move I missed"), not punishing grind.

---

## Core Loop

### Moment-to-Moment (30 seconds)
The player reads the enemy's fully-telegraphed actions, then moves 3–4 heroes and
spends their verbs to **simultaneously neutralize incoming threats and hit the
objective**. Each turn is a small, solvable puzzle with an optimal sequence — the
"aha!" beat. Intrinsically satisfying via instant, legible feedback (knockback,
tile reactions) and the satisfaction of a perfectly resolved turn.

### Short-Term (5–15 minutes)
One battle (~4–6 turns, ITB-scale). Objective: survive / protect the target /
clear the threat. "One more turn" psychology comes from each enemy move re-opening
the puzzle — the board is never static.

### Session-Level (30–120 minutes)
One *run*: traverse a procedurally routed node map, choosing your path and claiming
nodes for bonuses (the 4X-lite layer). Between battles, recruit/upgrade heroes and
draft new verbs — **this is where RPG depth and variety live, never inside a
battle.** Natural stopping points after each battle or region; the hook is "next
run I'll try a different verb combination."

### Long-Term Progression
Roguelike meta-progression across days/weeks: unlock new heroes, enemy variants,
and difficulty tiers. Player growth is primarily **KNOWLEDGE** (reading telegraphs,
knowing synergies) and **OPTIONS** (a widening roster), not raw power. "Done" =
clearing the top difficulty / unlocking the full roster / self-set challenges.

### Retention Hooks
- **Curiosity**: locked heroes, unseen enemy variants, higher tiers.
- **Investment**: an in-progress run and a build you don't want to lose.
- **Social**: none in v1 (potential future: shared daily seeds).
- **Mastery**: cleaner solutions to chase, harder tiers to conquer.

---

## Game Pillars

### Pillar 1: Perfect Information, Perfect Blame
The player always sees every consequence before committing; failure is a
miscalculation, never bad luck.

*Design test*: If debating between adding an in-battle random element and keeping
everything telegraphed → keep it telegraphed.

### Pillar 2: Positioning Over Power
Battles are won by position and board manipulation, not by damage numbers.

*Design test*: Between a "deal more damage" ability and a "shove/pull/swap
position" ability → prioritize the one that manipulates space.

### Pillar 3: Variety Lives in the Draft, Not the Dice
Roguelike variety comes from which heroes/verbs you draft between battles; every
battle itself stays deterministic.

*Design test*: To add "surprise," add it to the meta/draft layer — never inject
RNG into a battle.

### Pillar 4: Every Hero Is a Verb
Each hero is defined by one unique verb/mechanic (shove, swap, wall…), not by a
stat block.

*Design test*: If a new hero is merely "stronger" than an existing one → cut it;
it must bring a new verb.

### Pillar 5: Read in Ten Seconds
The whole state of a battle must be legible in a ten-second glance at the board.

*Design test*: If a mechanic needs a reference table to understand mid-battle →
simplify it or cut it.

**Intentional tension**: Pillar 4 (rich unique kits) pulls against Pillar 5
(legibility) — more verbs are harder to read; Pillar 3 forces roguelike variety
into the meta so it never breaks Pillar 1's determinism.

### Anti-Pillars (What This Game Is NOT)

- **NOT a hit-chance combat game**: no to-hit/miss RNG in battle — it would
  destroy Pillar 1 (Perfect Information, Perfect Blame).
- **NOT a grand 4X**: no deep resource economies, tech trees, or base-building —
  it would break Pillar 5 and blow the "months" scope.
- **NOT a damage race**: winning by having higher numbers would break Pillar 2.
- **NOT a power-creep roster**: new heroes must differ, not out-stat old ones —
  power creep would break Pillar 4.

---

## Visual Identity Anchor

*Lightweight seed for the art bible (art-director gate skipped — Lean mode). To be
expanded via `/art-bible`.*

**Selected visual direction: "Legible Battlefield"**

**One-line visual rule**: *If it affects the puzzle, it must be readable in a single
glance* — every telegraph, hazard, and hero verb has a distinct silhouette and color.

**Supporting principles:**
1. **Silhouette-first units** — each hero/enemy is identifiable by shape alone.
   *Test*: if two units are confusable in monochrome, redesign one.
2. **Icon-driven telegraphs** — enemy intents and hazards are shown as clear,
   consistent icons/overlays on tiles, not subtle animation.
   *Test*: a new player can name every incoming threat within 10 seconds.
3. **One accent color per verb-family** — shove/pull/swap/wall each read via a
   consistent color language.
   *Test*: color alone communicates what a verb does before reading text.

**Color philosophy**: A neutral, low-saturation board so that saturated hazards,
telegraphs, and verb effects pop against it. Clarity over spectacle.

---

## Inspiration and References

| Reference | What We Take From It | What We Do Differently | Why It Matters |
| ---- | ---- | ---- | ---- |
| Into the Breach | Deterministic, fully-telegraphed grid combat; "solve-and-act" turns; board manipulation over damage | A roguelike hero-draft run structure and RPG-flavored roster instead of fixed mech squads | Validates that deterministic tactical puzzles are deeply replayable and marketable |
| Slay the Spire | Roguelike node-map run structure; draft-driven build variety; meta-progression | Applied to a spatial tactics puzzle instead of a deckbuilder | Validates that "variety in the draft, not the dice" sustains long-term engagement |
| Wildfrost / Griftlands | Characterful units with signature mechanics; readable tactical presentation | Stricter determinism (no RNG combat) and verb-first hero design | Validates a market for characterful, systemic small-squad tactics |

**Non-game inspirations**: Chess (perfect-information positional thinking, piece-as-
verb movement), logic puzzles (single-solution "aha" satisfaction).

---

## Target Player Profile

| Attribute | Detail |
| ---- | ---- |
| **Age range** | ~18–40 |
| **Gaming experience** | Mid-core to hardcore (strategy/puzzle literate) |
| **Time availability** | 30–60 min sessions, often on desktop browser |
| **Platform preference** | PC web browser primarily |
| **Current games they play** | Into the Breach, Slay the Spire, Tactical Breach Wizards, Bad North |
| **What they're looking for** | A pure, luck-free tactical puzzle they can master, with roguelike replay variety |
| **What would turn them away** | RNG-decided combat, bloated 4X complexity, "feel" over clarity, pay-to-win |

---

## Technical Considerations

| Consideration | Assessment |
| ---- | ---- |
| **Recommended Engine** | **Pure web: TypeScript + PixiJS (2D WebGL) + Vite.** No native engine — the game is a deterministic 2D grid with no physics/3D, so a web stack is ideal and ships to the browser directly. (Phaser 3 is a viable "batteries-included" alternative.) NOTE: the studio's engine-specialist agents target Godot/Unity/Unreal and do **not** apply to a pure-web build; design/production skills still apply. |
| **Key Technical Challenges** | Deterministic simulation with a reliable full "move preview"; a constrained procedural encounter generator that guarantees solvable, interesting battles; clean turn/state management for undo-preview. |
| **Art Style** | Clean 2D — flat/vector or crisp pixel art; high-contrast, silhouette-first ("Legible Battlefield"). |
| **Art Pipeline Complexity** | Low–Medium (minimalist geometric/icon-driven 2D; solo-feasible). |
| **Audio Needs** | Moderate (crisp SFX for moves/telegraphs; light adaptive music). |
| **Networking** | None (single-player, fully local/deterministic). |
| **Content Volume** | v1 target: ~6–8 heroes, ~15–20 enemy/encounter templates, 1 region, escalating difficulty tiers; runs ~30–60 min. |
| **Procedural Systems** | Node-map routing + encounter selection/variation from authored templates, with solvability constraints. Deliberately NOT fully-random battle generation. |

---

## Risks and Open Questions

### Design Risks
- Procedurally assembled battles may fail to be consistently solvable **and**
  interesting — ITB hand-tunes heavily; template-based generation must match that
  quality.
- Verb-first roster (Pillar 4) may collide with legibility (Pillar 5) as the
  roster grows.

### Technical Risks
- A trustworthy full-consequence "move preview" across all verb interactions is
  the load-bearing tech; edge cases (chained shoves, walls, swaps) must resolve
  deterministically and predictably.

### Market Risks
- Tactical-roguelike niche is loyal but moderate in size; discoverability on web
  differs from Steam and may need a strong shareable hook (e.g., daily seeds).

### Scope Risks
- RPG hero progression + 4X-lite territory layer + roster can balloon past the
  "months" target if not deliberately trimmed to the Slay-the-Spire-style map for v1.

### Open Questions
- How is procedural solvability guaranteed? → Prototype a constrained generator +
  automated solver/validator.
- How much 4X-lite (node bonuses vs. real territory control) survives v1? → Resolve
  during vertical slice.
- Is the deterministic core fun *before* meta layers exist? → Answered by the MVP
  single-battle prototype.

---

## MVP Definition

**Core hypothesis**: *A fully-telegraphed, deterministic single battle — where 3
heroes with unique verbs solve an incoming-threat puzzle — is intrinsically
satisfying ("aha!") without any meta/RNG layer.*

**Required for MVP**:
1. Deterministic turn-based grid battle with full enemy telegraph and move preview.
2. 3 heroes, each a distinct verb (e.g., shove, wall, swap) + a movement rule.
3. 2–3 enemy types with telegraphed actions; win condition = survive / protect the
   objective on an ~8×8 board.

**Explicitly NOT in MVP** (defer to later):
- Roguelike run map, draft, and meta-progression.
- 4X-lite territory layer.
- Full roster, enemy variants, difficulty tiers, narrative framing, audio polish.

### Scope Tiers (if budget/time shrinks)

| Tier | Content | Features | Timeline |
| ---- | ---- | ---- | ---- |
| **MVP** | 1 battle type, 3 heroes, 2–3 enemies | Deterministic telegraphed combat + move preview | ~1 month |
| **Vertical Slice** | Slay-the-Spire node map, 6–8 heroes, ~15–20 encounter templates, 1 region | Core + draft-between-battles + hero unlocks + difficulty ramp | ~2–3 months |
| **Alpha** | Multiple regions (placeholder), 4X-lite node bonuses, more enemy variants | All systems present, rough | ~3–4 months |
| **Full Vision** | Multiple regions/biomes, 12+ heroes, bosses, fuller 4X-lite control, deep meta | All features, polished | ~4–6 months |

---

## Next Steps

- [ ] Fill in CLAUDE.md / technical-preferences with the web stack (note: `/setup-engine` targets Godot/Unity/Unreal, not pure web — configure manually)
- [ ] Validate concept completeness (`/design-review design/gdd/game-concept.md`)
- [ ] **Prototype the core idea** (`/prototype deterministic-telegraphed-battle`) — validate the single-battle "aha" is fun before writing GDDs
- [ ] If prototype PROCEEDS: run `/art-bible`, then decompose into systems (`/map-systems`)
- [ ] Design each system (`/design-system [system-name]`) using prototype learnings
- [ ] Plan the technical architecture (`/create-architecture`)
- [ ] Build the vertical slice (`/vertical-slice`) before committing to Production
- [ ] Validate readiness (`/gate-check pre-production`)
