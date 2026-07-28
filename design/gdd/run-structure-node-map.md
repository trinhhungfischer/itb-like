# Run Structure / Node Map

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #3 Variety Lives in the Draft, Not the Dice; #1 Perfect Information, Perfect Blame

## Overview

Run Structure / Node Map is the **campaign map** that frames one entire VANGUARD
run: a single-region, Slay-the-Spire-style directed graph of nodes — **Battle**,
**Elite**, **Reward**, **Event**, **Rest**, and a single terminal **Boss** —
generated once, deterministically, from the run's seed, and revealed to the
player **in full** the moment the run begins. It owns the map's topology
(which nodes exist, how they connect), each node's type and difficulty tier,
the player's current position and path-choice legality (which nodes are
reachable *right now*), and the run-level bookkeeping that turns a sequence of
individually-resolved nodes into a single Victory (reach and clear the Boss)
or Defeat (lose any Battle/Elite/Boss node). It is the seam between the
deterministic battle core (Turn & Phase Manager, Combat Resolution, Objective
/ Win-Lose) and the roguelike meta layer (Draft / Loadout Meta,
Meta-progression / Unlocks): it decides **when** a battle happens and **how
hard**, but never **how** a battle resolves — that remains entirely the battle
core's job, called out to once per Battle/Elite/Boss node via Encounter
Generator and Turn & Phase Manager. This system exists because Pillar #3
(Variety Lives in the Draft, Not the Dice) needs a *frame* for the draft to
live in — the node map is the thing the player is actually navigating between
hero-draft decisions, and Pillar #1 (Perfect Information, Perfect Blame)
demands that frame be **fully visible, no fog of war**: the player always
knows the whole shape of the road ahead, even if not what waits inside each
still-unresolved battle.

## Player Fantasy

Run Structure / Node Map has no ability icon and no combat presence — like
Board & Grid and Turn & Phase Manager, it is the stage, not a performer on it.
What the player *feels* when it works is **"I am charting my own campaign, and
every choice on this map is mine to own."** Seeing the entire route laid out
at once — every Elite to dodge or seek out, every Rest to bank for the right
moment, the Boss looming at a fixed, known distance — turns the meta-layer
into a second puzzle that sits *above* the tactical one: not "can I win this
fight" but "which fights do I choose to have, and in what order, given the
roster I'm drafting along the way." This is Self-Determination Theory's
**Autonomy** made spatial: no path is secretly better or worse by design (see
Edge Cases and Tuning Knobs for how the generator keeps paths *comparable*,
not identical), so every route the player picks is a real, ownable decision,
never a false choice between an obviously-correct branch and an obviously-bad
one. It also directly serves the **Achiever** and **Explorer** motivations
named in `game-concept.md`: Achievers read the map as an escalating ladder of
difficulty tiers to climb toward the Boss; Explorers read it as a space of
route trade-offs (skip the Elite and bank the Rest for later, or take the
Elite now while the roster is fresh) to map out and optimize across repeat
runs. The failure state of this system is a map that either hides information
the player needs to choose well (breaking Pillar #1) or offers a choice that
isn't really one — a route so obviously superior that "choosing" a path stops
being a decision (breaking Autonomy and, by extension, Pillar #3's promise
that variety lives here, in the draft/route layer, not in the dice).

## Detailed Design

### Core Rules

1. **Ownership boundary.** Run Structure / Node Map owns: the map-generation
   algorithm (topology + node-type assignment, seeded and deterministic), the
   player's current position and the legal "reachable next node" set, node
   lifecycle state (`Unvisited` / `Bypassed` / `Claimed`), the call into
   Difficulty Tiers' `getEncounterForNode()` per battle-type node (Rule 13),
   and the run-level terminal outcome (`Victory` / `Defeat` / `Abandon`),
   exposed via `processRunEnd(outcome)` (Rule 15). It does **not** own: how a
   battle resolves (Turn & Phase Manager / Combat Resolution / Objective),
   what a specific battle contains or how hard it is (Difficulty Tiers ✅
   owns tier resolution; Encounter Generator ✅ owns content), what a
   Reward/Event/Rest node's specific content or choice mechanics are (Draft /
   Loadout Meta ✅, and a future narrative/event-content system, which
   remains undesigned and out of any currently-planned system's scope), or
   passive "claimed node" bonuses (4X-lite Node Bonuses, an Alpha-tier system
   not yet started, explicitly out of this document's v1 scope — see Open
   Questions).
2. **One region, one map, one run.** V1 ships exactly one region (per
   `game-concept.md`'s MVP/Vertical-Slice scope): a run is a single traversal
   of a single generated map, from a chosen row-1 entry node to the mandatory
   Boss node. There is no multi-region chaining, no "world map of maps" — a
   run **is** one Route Graph, start to finish.
3. **The whole map is visible from the moment the run starts (Pillar #1).**
   Every node's row, column, type, and difficulty tier is revealed as soon as
   `generateRunMap()` completes — there is no fog of war on map *topology* or
   node *type*, ever, for the whole run. This differs from a generated
   battle's contents, which remain unknown until the player actually enters
   that node (Rule 11) — the map tells the player *what kind* of challenge is
   ahead and *how hard*, never the exact encounter composition, matching
   Encounter Generator's own "not shown until entered" contract.
4. **Traversal is strictly forward and one-way.** The player begins
   conceptually at a virtual **Start** (row 0, not a real node) connected to
   every row-1 node. From any current node, the only legal moves are along
   that node's **outgoing edges** to row `r+1`. There is no backtracking to a
   previous row, no re-entering a node once left behind, and no skipping a
   row. A run's node sequence is therefore a single path of length
   `map_depth + 1` (one node chosen per regular row, plus the mandatory Boss)
   through a graph that itself contains more nodes than any one run will ever
   visit (Rule 5) — the unchosen branches are exactly what makes the *choice*
   meaningful (Rule Player Fantasy's Autonomy point).
5. **The graph has more width than any single traversal uses.** Each regular
   row `r` (`1 ≤ r ≤ map_depth`) contains `nodes_per_row` nodes (uniform width
   across all regular rows in v1 — see Tuning Knobs), giving the player a real
   branching choice at every row; the final row (`map_depth + 1`) is the
   single mandatory **Boss** node, width 1, with an edge in from *every* node
   in row `map_depth` (a fixed, unrolled connection — Rule 9).
6. **Node types.** Six types exist in v1: **Battle**, **Elite**, **Reward**,
   **Event**, **Rest**, **Boss**. Battle/Elite/Boss are combat nodes that call
   Encounter Generator and drive a full battle through Turn & Phase Manager;
   Reward/Event/Rest are non-combat nodes whose resolution is **delegated**
   (Rule 12) — they can never produce a run-ending Defeat in v1 (see Edge
   Cases for the deliberate v1 scope line this implies for Event content).
   Type is assigned once per node, at map generation time (Rule 7/Formula
   F4), and never changes.
7. **Node-type assignment is a seeded weighted roll, with two hard placement
   rules layered on top of the weighted roll.** Every node's type is chosen by
   a weighted random draw (Formula F4) from a **row-band weight table** (Rule
   8) — except:
   - **Hard rule A (row 1 exclusions):** row 1 nodes are never `Elite` or
     `Rest` — the run's opening choices are always Battle/Reward/Event, so the
     player faces no threat spike and has nothing to "rest" from yet.
   - **Hard rule B (guaranteed Rest before the Boss):** if, after the weighted
     roll, row `map_depth` (the row immediately before the Boss) contains zero
     `Rest` nodes, the node with the **highest column index** in that row is
     deterministically **overridden** to `Rest` (no re-roll, no extra PRNG
     draw — Formula F4's worked examples show why this is safe). This
     guarantees the player always has one banked preparation opportunity
     immediately before the run's hardest fight (Pillar #1 — the player is
     never denied the chance to prepare by bad luck).
8. **Row-band weight tables (v1 default content — tunable, see Tuning
   Knobs).** Rows are grouped into three bands with distinct type-weight
   vectors, in the fixed declared order `{Battle, Elite, Reward, Event,
   Rest}` (a type absent from a band has weight `0`):
   - **Band A** (row `1` only): `{Battle: 0.60, Elite: 0, Reward: 0.20,
     Event: 0.20, Rest: 0}`.
   - **Band B** (rows `2 .. elite_min_row − 1`): `{Battle: 0.50, Elite: 0,
     Reward: 0.20, Event: 0.20, Rest: 0.10}`.
   - **Band C** (rows `elite_min_row .. map_depth`): `{Battle: 0.40, Elite:
     0.15, Reward: 0.15, Event: 0.15, Rest: 0.15}`.
   With v1 defaults (`elite_min_row = 3`), Band B is exactly row 2, Band C is
   rows 3–6. **`Battle` is the unconditional structural fallback** — every
   band's weight vector always keeps `Battle > 0`, so a row can never end up
   with zero eligible types (Edge Cases).
9. **Boss row and edges are fixed, not rolled.** Row `map_depth + 1` always
   contains exactly one node, `type = Boss`, `tierIndex = maxRegularTierIndex
   + 1` (Formula F6 — a display-only estimate; see Rule 13) — always the
   single hardest fight of the run. Every node
   in row `map_depth` has exactly one outgoing edge, unconditionally, to the
   Boss node — no PRNG draw, no candidate set, no player choice about *which*
   node the Boss connects from (there is only one Boss to connect to).
   Likewise, the virtual Start's edges to every row-1 node are fixed, not
   rolled — row 1 is the player's true first choice.
10. **Regular row-to-row edges are seeded and constructively guaranteed
    connected (Formula F5).** Each node in row `r` gets 1–2 outgoing edges to
    row `r+1`, rolled from a locally-clustered candidate set (keeps the map
    visually readable — Pillar #5 — by avoiding edges that cross the whole
    row's width); a deterministic **backfill pass** then guarantees every node
    in row `r+1` has at least one incoming edge, even if the rolled forward
    pass alone left one starved. This mirrors Board & Grid's
    "reject-and-report" philosophy at graph-construction time rather than
    Encounter Generator's "retry-and-fallback" philosophy — there is no
    solvability *search* here, because graph connectivity, unlike battle
    solvability, is fully guaranteeable by construction (Formula F5's proof is
    in its worked example).
11. **Battle/Elite/Boss node resolution is delegated to the real battle
    stack, lazily, on entry.** When the player enters a Battle/Elite/Boss
    node, Run Structure (a) calls Difficulty Tiers' `getEncounterForNode(
    runSeed, nodeId, nodeIndex, ascensionOffset, rosterSnapshot) → { tier,
    encounter }` (Rule 13 — per `difficulty-tiers.md`'s public contract),
    which internally resolves the node's tier and drives Encounter
    Generator's `generateEncounter()` on Run Structure's behalf, (b)
    instantiates a **fresh** Board & Grid from the returned
    `EncounterDefinition` and starts a **fresh** Turn & Phase Manager
    instance against it (Rule 14 — the integration seam this document
    introduces), and (c) awaits that battle's terminal `battle_ended` event.
    Generation is **lazy** — an `EncounterDefinition` is never pre-computed
    at map-generation time, only when the player actually arrives at the
    node — resolving `encounter-generator.md`'s Open Question #11 in favor of
    "always regenerate fresh on entry," which sidesteps that document's
    flagged "stale `rosterSnapshot`" risk entirely (the snapshot passed is
    always the roster's *current*, just-in-time state). The returned `tier`
    is the single source of truth for this node's difficulty — Run Structure
    stores it for display but never recomputes or overrides it (Rule 13).
12. **Reward/Event/Rest node resolution is delegated to other systems, and is
    always non-failing in v1.** Entering a Reward or Rest node hands control
    to **Draft / Loadout Meta** ✅; entering an Event node hands control to a
    future narrative/event-content system (still undesigned, out of any
    currently-planned system's stated scope — flagged in Open Questions).
    Whatever that delegate does, it must
    eventually call back with a single **completion signal**
    (`resolveNode(nodeId, {outcome: Completed})`) — Run Structure has no
    concept of "won" or "lost" for these three types in v1; they can apply
    consequences to the roster (heal, upgrade, or per a future Event design,
    even damage/loss), but they can never themselves end the run. This is a
    deliberate v1 scope line, matching Objective / Win-Lose's mutual-exclusive
    v1 objective-type scoping philosophy.
13. **Difficulty resolution is delegated to Difficulty Tiers — Run Structure
    never assembles a `DifficultyConfig` or calls Encounter Generator
    directly (resolves this project's C1 cross-system contract).** For every
    Battle/Elite/Boss node, Run Structure calls Difficulty Tiers' single
    entry point: `getEncounterForNode(runSeed, nodeId, nodeIndex,
    ascensionOffset, rosterSnapshot) → { tier: int, encounter:
    EncounterDefinition }` (per `difficulty-tiers.md`'s Rule 9 contract).
    `nodeIndex` is this node's ordinal position along the chosen path (`row −
    1`, 0-based); `ascensionOffset` is the player-selected, run-start-fixed
    Ascension value (owned by Meta-progression / Unlocks, forwarded
    unchanged by Run Structure). Difficulty Tiers internally assembles
    `DifficultyConfig` (its own Formulas F2–F5, balance tables, and template
    pool selection) and calls Encounter Generator's `generateEncounter()` on
    Run Structure's behalf — Run Structure has no knowledge of
    `DifficultyConfig`'s shape and never calls Encounter Generator directly.
    **The `tier` returned by `getEncounterForNode()` is the single source of
    truth** for this node's difficulty, for both this system's own
    `MapNode.tierIndex` display field and Difficulty Tiers' own curve —
    Formula F6 below is retained only as a **display-only, non-authoritative**
    pre-battle estimate (Map/Run UI may show it before the node is entered);
    it is overwritten by the real, authoritative `tier` the moment
    `getEncounterForNode()` resolves (Edge Cases). Run Structure depends on
    Difficulty Tiers ✅ — not Encounter Generator directly — for all
    node-difficulty resolution.
14. **Battle orchestration contract (a new integration surface this document
    establishes).** Neither `board-and-grid.md` nor
    `turn-and-phase-manager.md` names the system responsible for
    instantiating a *new* Board & Grid + Turn & Phase Manager pair at the
    start of a battle — Encounter Generator explicitly disclaims owning "run
    or node-map routing" and "has no concept of a run." Run Structure / Node
    Map is the natural owner of that responsibility, since it is the first
    system in the dependency chain that *does* have a concept of "one battle
    among many in a run." This document's contract:
    `startBattle(encounterDefinition) → BattleHandle`, which constructs a
    fresh Board & Grid from the definition's terrain/spawns/objective
    (`board-and-grid.md`'s "Encounter Generator writes initial state" already
    covers *what* gets written; this rule clarifies *who* triggers the
    write — Run Structure, via the definition it just received), constructs a
    fresh Turn & Phase Manager bound to that board, and returns a handle Run
    Structure awaits `battle_ended` on. **PROVISIONAL** until Turn & Phase
    Manager or an architecture pass formally confirms this ownership — flagged
    in Open Questions.
15. **Run-level terminal outcomes.** A run ends in exactly one of three ways:
    **Run Victory** — the Boss node's battle reaches `Objective`'s terminal
    `Victory`; **Run Defeat** — *any* Battle/Elite/Boss node's battle reaches
    terminal `Defeat` (v1 has no partial-roster continuation — a lost battle
    ends the whole run, matching the roguelike-permadeath framing in
    `game-concept.md`); **Run Abandon** — the player quits mid-run, either at
    the map screen between nodes (an immediate `Abandon`, no battle in
    progress) or mid-battle (propagated from Turn & Phase Manager's own
    `battle_ended(Abandon)`, per `turn-and-phase-manager.md` Rule 6). Whichever
    of the three occurs, Run Structure invokes its own terminal entry point,
    **`processRunEnd(outcome: {result: Victory | Defeat | Abandon, nodeType?:
    Battle | Elite | Boss})`** — `nodeType` is present, sourced from
    `battle_ended`'s own `nodeType` field, when the outcome was determined by
    a battle node, and absent for a map-screen `Abandon`. `processRunEnd` is
    the single place this document fires exactly one of
    `run_completed(Victory | Defeat)` or `run_abandoned`, and it is the hook
    point Meta-progression / Unlocks' own `processRunEnd(runSummary,
    metaStats, catalog)` is invoked from — Run Structure assembles the
    `RunSummary` that call requires from `outcome` plus its own run-level
    state (visited nodes, tiers faced, heroes deployed). Exactly one of
    `run_completed(Victory | Defeat)` or `run_abandoned` fires per run, ever.
16. **Reproducibility.** Given an identical `runSeed`, `generateRunMap(runSeed)`
    always returns a byte-identical `RunMap` (same node types, same tiers,
    same edges) — no wall-clock time, no non-seeded randomness. This is the
    map-level half of the "daily seed" retention hook named in
    `game-concept.md`; the battle-level half is Encounter Generator's own
    Rule 14.

### Data Contracts

```
MapNode {
  nodeId: int                          // Formula F3
  row: int                             // 1..map_depth, or map_depth+1 for Boss
  col: int                             // 0..nodes_per_row-1 (always 0 for Boss)
  type: Battle | Elite | Reward | Event | Rest | Boss
  tierIndex: int                       // Formula F6 — DISPLAY-ONLY, non-authoritative
                                        // pre-battle estimate; overwritten by the
                                        // authoritative `tier` Difficulty Tiers'
                                        // getEncounterForNode() returns on entry (Rule 13)
  state: Unvisited | Bypassed | Claimed
}

MapEdge {
  fromNodeId: int                      // -1 sentinel for the virtual Start
  toNodeId: int
}

RunMap {
  runSeed: uint32
  mapSeed: uint32                      // Formula F1
  nodes: MapNode[]
  edges: MapEdge[]
  currentNodeId: int | null            // null = at virtual Start, before any node entered
  bossNodeId: int
}

// DifficultyConfig is NOT a Run Structure data contract — it is assembled
// and consumed entirely inside Difficulty Tiers (see difficulty-tiers.md's
// Data Contracts). Run Structure only ever sees Difficulty Tiers'
// getEncounterForNode() return value: { tier: int, encounter: EncounterDefinition }
// (Rule 13).

RunEndOutcome {                        // input to processRunEnd(), Rule 15
  result: Victory | Defeat | Abandon
  nodeType: Battle | Elite | Boss | null   // present iff result came from a battle
                                            // node's battle_ended event
}
```

### States and Transitions

**Run-level lifecycle:** `NotStarted → InProgress → { Victory | Defeat |
Abandoned }` (terminal — matches Run Persistence's `NoRun → InProgress →
RunEnded → NoRun` cycle, of which this is the gameplay-facing view).

**Per-node lifecycle:** `Unvisited → { InProgress → Claimed } | Bypassed`.

| Transition | Trigger | Notes |
|---|---|---|
| `Unvisited → InProgress` | Player selects this node from the current `reachableNodes` set (`enterNode`) | Only legal if the node is in the reachable set (Rule 4/Formula F7) and currently `Unvisited` |
| `InProgress → Claimed` | The node's delegated resolution completes successfully (`resolveNode(nodeId, Completed)` for Reward/Event/Rest, or `Objective`'s terminal `Victory` for Battle/Elite/Boss) | `currentNodeId` advances to this node; its row's other `Unvisited` nodes transition to `Bypassed` in the same step |
| `Unvisited → Bypassed` | Any other node in the same row as a node that just entered `InProgress` | Passive, retroactive, UI/history-only — a `Bypassed` node has no further gameplay relevance this run |
| `InProgress → (run ends)` | A Battle/Elite/Boss node's battle reaches terminal `Defeat` | The node itself never reaches `Claimed`; the **run** transitions to `Defeat` and the `RunMap` becomes moot (Edge Cases) |

**Reachability is a derived, not stored, property** (Formula F7): `reachableNodes(runMap)` is recomputed fresh from `currentNodeId`'s outgoing edges (or, if `currentNodeId == null`, from every row-1 node) every time it is queried — there is no separate "reachable" flag to keep in sync.

### Interactions with Other Systems

Run Structure / Node Map is an **orchestrating consumer**: it has no combat
logic of its own, but it is the system that decides *when* to invoke the
battle stack and *what* happens to the campaign as a result.

| System | Run Structure reads/calls | Run Structure provides | Ownership boundary |
|---|---|---|---|
| **Difficulty Tiers** ✅ | `getEncounterForNode(runSeed, nodeId, nodeIndex, ascensionOffset, rosterSnapshot) → { tier, encounter }`, called once per Battle/Elite/Boss node, lazily on entry (Rule 11, Rule 13) | `nodeId` (Formula F3), `nodeIndex` (this node's ordinal position, 0-based), `ascensionOffset` (forwarded from Meta-progression / Unlocks, fixed for the run), `rosterSnapshot` | Run Structure decides *when*; Difficulty Tiers decides *how hard* (resolves this project's C1 contract — Run Structure never assembles `DifficultyConfig` or calls Encounter Generator directly) |
| **Encounter Generator** ✅ (indirect, via Difficulty Tiers) | — | — | No direct interface — Difficulty Tiers is the only caller of `generateEncounter()` on Run Structure's behalf |
| **Turn & Phase Manager** ✅ | Instantiates a fresh instance per battle node (Rule 14); awaits `battle_ended(result)` | The `EncounterDefinition`-derived Board & Grid to run against | Run Structure owns *when a battle exists*; the Manager owns *how it plays out* — **this document's Rule 14 is a new, currently-undocumented integration surface, flagged in Open Questions** |
| **Objective / Win-Lose** ✅ (indirect, via Turn & Phase Manager's `battle_ended`) | The terminal `EvaluationResult.status` (`Victory`/`Defeat`) of each Battle/Elite/Boss node | — | Resolves `objective-and-win-lose.md`'s own Downstream row: "Run Structure / Node Map … the final terminal `EvaluationResult` to route run progression or end the run" |
| **Board & Grid** ✅ (indirect, via Encounter Generator + Turn & Phase Manager) | — | — | No direct interface; Run Structure never queries tiles itself |
| **Run Persistence** ✅ | `loadRun() → RunMap + currentNodeId + node states` on resume | `saveRun(data)` on node entry (Rule 4a-equivalent) and node resolution (Rule 4b-equivalent), matching `run-persistence.md`'s Rule 4a/4b write triggers exactly; `clearRun()` semantics on run end are Persistence's own Rule 4f, triggered by this system's `run_completed`/`run_abandoned` event and `processRunEnd(outcome)` (Rule 15) | **Confirmed Hard, bidirectionally** — `run-persistence.md`'s own Dependencies section lists this exact edge back |
| **Draft / Loadout Meta** ✅ | `rosterSnapshot` (current roster, forwarded to Difficulty Tiers) | Delegates Reward/Rest node resolution and post-Battle/Elite/Boss-Victory reward triggers to it; awaits its `resolveNode(nodeId, {outcome: Completed})` completion callback (Rule 12) | **Hard, blocking** — resolves `systems-index.md`'s declared "Draft / Loadout Meta depends on … Run Structure / Node Map" from the other side, confirmed by `draft-and-loadout-meta.md`'s own Interactions table |
| **Heroes & Abilities** ✅ (indirect, via Draft / Loadout Meta) | Roster composition/liveness feeding `rosterSnapshot` | — | Indirect — Run Structure only forwards what Draft / Loadout Meta / Heroes & Abilities produce |
| **4X-lite Node Bonuses** ✅ (`node-bonuses.md`, Designed 2026-07-28) | — | Exposes `MapNode.state == Claimed` as the only extension point this document commits to; all bonus logic is that system's | **Hard** — that document observes the `Unvisited → Claimed` transition and `MapNode.type`, and adds **no** new state and **no** new transition here. This document's map model is unchanged by it |
| **Map/Run UI** ✅ | — | The full `RunMap` (all nodes/edges/types/tiers/states) and `reachableNodes()` for rendering the map screen and enforcing which nodes are clickable; calls `enterNode()` on player click | Read-only consumer; Pillar #1's "reveal everything" requirement (Rule 3) is *this* system's guarantee, which the UI merely renders — confirmed **Hard** by `map-run-ui.md`'s own Interactions table |
| **Meta-progression / Unlocks** ✅ | `ascension_max_offset` ceiling and the player's currently-unlocked `ascensionOffset` (forwarded, unmodified, to Difficulty Tiers) | `processRunEnd(outcome)` (Rule 15) as the terminal hook Meta-progression's own `processRunEnd(runSummary, metaStats, catalog)` is invoked from, once per run, with `battle_ended`'s `nodeType` (Battle/Elite/Boss) available for `RunSummary` assembly | **Hard** — resolves the gap `meta-progression-and-unlocks.md` flagged ("Run Structure / Node Map … would need to call `processRunEnd()`") |

**Bidirectional-consistency notes:**
- Per this project's cross-system contracts (C1), Run Structure calls
  Difficulty Tiers' `getEncounterForNode()` instead of Encounter Generator's
  `generateEncounter()` directly. `difficulty-tiers.md`'s own Downstream
  table already lists "Run Structure / Node Map | Calls
  `getEncounterForNode(...)` … once per battle node | **Hard**" — this
  document confirms and does not contradict that contract.
  `encounter-generator.md`'s Downstream table's "Run Structure / Node Map"
  row is superseded by this interface-inversion (that document's own Rule 12
  already names Difficulty Tiers, not Run Structure, as the legitimate
  direct caller).
- `objective-and-win-lose.md`'s Downstream table already lists "Run Structure
  / Node Map | the final terminal `EvaluationResult`" — confirmed, resolved
  by this document's Rule 15.
- `run-persistence.md` confirms the same edge back in its own Dependencies
  section — the dependency is real and **Hard** on both sides.
- `systems-index.md` (row 13) lists Run Structure / Node Map depending on
  Difficulty Tiers, Objective / Win-Lose, and Turn & Phase Manager —
  consistent with this document's Dependencies section below and with Rule
  14's battle orchestration contract. It does **not** yet list Run
  Persistence, Draft / Loadout Meta, Heroes & Abilities, or Meta-progression
  / Unlocks, despite each being confirmed **Hard** below — flagged for
  `/consistency-check` and the next `systems-index.md` edit pass.

## Formulas

All formulas are deterministic. Examples use v1 default knob values:
`map_depth=6`, `nodes_per_row=3`, `elite_min_row=3`, `rows_per_tier=2`.

### F1. Map seed derivation

`mapSeed = mix(runSeed, MAP_SEED_SALT)`

where `mix` is the **same** deterministic 32-bit hash combiner used by
Encounter Generator's Formula F1 (pinned once via ADR — see Open Questions,
shared with that document's Open Question #1), and `MAP_SEED_SALT` is a fixed
string constant (`"vanguard_run_map_v1"`) that decorrelates the map-generation
PRNG stream from any node's `encounterSeed` stream (which mixes
`runSeed, nodeId, templateId, attemptIndex` — a different input tuple over the
same `mix` primitive, so no collision is possible by construction even without
the salt, but the salt makes the separation explicit and auditable).

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| run seed | `runSeed` | uint32 | any | Set once at run start; this system is its owner (per `encounter-generator.md`'s F1 table: "owned by Run Structure / Node Map") |
| salt constant | `MAP_SEED_SALT` | string | fixed | `"vanguard_run_map_v1"` — never varies per run |

**Output:** uint32, `[0, 2^32−1]`. **Worked example (illustrative, not a
computed hash value, matching `encounter-generator.md`'s F1 convention):**
`runSeed=0xA1B2C3D4` → `mapSeed = mix(0xA1B2C3D4, "vanguard_run_map_v1") =
<some uint32>`; a different `runSeed` yields a decorrelated, unrelated-looking
`mapSeed`.

### F2. PRNG stream (mulberry32 — shared algorithm with Encounter Generator)

```
state = mapSeed
next():
  state = (state + 0x6D2B79F5) mod 2^32
  t = state
  t = (t ^ (t >> 15)) * (t | 1) mod 2^32
  t = t ^ (t + (t ^ (t >> 7)) * (t | 61)) mod 2^32
  return ((t ^ (t >> 14)) mod 2^32) / 2^32     // float in [0, 1)
```

Identical algorithm to `encounter-generator.md`'s Formula F2, reproduced here
for standalone readability. This `mix()` combiner + `mulberry32` stream is
registered as **`mulberry32_prng`** in `design/registry/entities.yaml`
(canonical source: `encounter-generator.md`); this document supplies only its
own salt constant (`MAP_SEED_SALT`, Formula F1) and must **not** let the
algorithm diverge from that canonical definition. **Declared draw order (fixed, two-phase, the
generation-time analogue of that document's "template's declared slot
order"):** (1) all node-type rolls, row 1 → `map_depth`, column `0 →
nodes_per_row−1` within each row (Formula F4); then (2) all edge rolls, row
`1→2` through row `(map_depth−1)→map_depth`, source column order within each
row transition (Formula F5). Boss-row and Start-row edges are never rolled
(Rule 9) and consume no draws.

**Output range:** `[0, 1)`, uniform. **Total draws consumed for a default
6×3 map:** 18 type-roll draws (one per regular-row node; Boss's type is fixed)
+ up to 3×(1–2 edge-count draws + 1–2 target draws) per source node across 5
row-transitions (rows 1→2 … 5→6) ≈ 45–65 draws total — small enough that the
"why exhaustive search is intractable" caveat from Encounter Generator's
Formula F5 does not apply here; this is enumeration, not search.

### F3. Node ID encoding

`nodeId(row, col) = row × nodes_per_row + col`

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| row | `row` | int | `1..map_depth+1` | `map_depth+1` is the Boss row |
| column | `col` | int | `0..nodes_per_row−1` (always `0` for Boss) | Position within the row |
| row width | `nodes_per_row` | int | ≥1 (default 3) | This run's configured width (Tuning Knobs) |

**Output:** int, `[nodes_per_row+0, (map_depth+1)×nodes_per_row]` for the
default uniform-width scheme. Mirrors `board-and-grid.md`'s `index(c,r) = r·W
+ c` 1D-index pattern for the same reason: a stable, collision-free integer
key. **Worked example (defaults, `nodes_per_row=3`):** `nodeId(row=3, col=1) =
3×3+1 = 10`; the Boss node is `nodeId(row=7, col=0) = 7×3+0 = 21`.

### F4. Weighted node-type roll

Generalizes `encounter-generator.md`'s Formula F3 `rollChoice` (uniform) to a
**non-uniform weighted** choice, in the fixed declared order `{Battle, Elite,
Reward, Event, Rest}`:

`rollWeightedType(draw, weights) = ` the first `type` in declared order whose
cumulative weight (running sum up to and including `type`) exceeds `draw`.

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| draw | `draw` | float | `[0,1)` | One PRNG output (F2) |
| weight vector | `weights` | map | per-band, sums to `1.00` (Rule 8) | `{Battle, Elite, Reward, Event, Rest}` weights for this node's row-band |

**Output:** one of `{Battle, Elite, Reward, Event, Rest}` — never a type with
`weight=0` in this band (a zero-width cumulative interval can never contain a
`draw ∈ [0,1)`). **Worked example (row 1, Band A `{Battle:0.60, Elite:0,
Reward:0.20, Event:0.20, Rest:0}`):** cumulative thresholds `Battle
[0,0.60)`, `Elite [0.60,0.60)` (empty), `Reward [0.60,0.80)`, `Event
[0.80,1.00)`, `Rest [1.00,1.00)` (empty); `draw=0.91` → falls in `Event
[0.80,1.00)` → **Event**. **Worked example (row 3, Band C
`{Battle:0.40, Elite:0.15, Reward:0.15, Event:0.15, Rest:0.15}`):**
thresholds `Battle[0,0.40)`, `Elite[0.40,0.55)`, `Reward[0.55,0.70)`,
`Event[0.70,0.85)`, `Rest[0.85,1.00)`; `draw=0.62` → falls in
`Reward[0.55,0.70)` → **Reward**.

### F5. Row-to-row edge generation (constructive connectivity guarantee)

**Forward pass** (per source node `i` in row `r`, width `Wr`, targeting row
`r+1`, width `W'`): `srcExpected(i) = floor(i × W' / Wr)`; candidate targets
`= { srcExpected−1, srcExpected, srcExpected+1 } ∩ [0, W'−1]`. Draw one PRNG
value to pick edge count (`2` edges if `draw ≥ 1 − extra_edge_chance`, else
`1`; `extra_edge_chance` default `0.3` — Tuning Knobs), then draw that many
edges via `rollWithoutReplacement` (per `encounter-generator.md`'s Formula F3
definition) over the candidate set.

**Backfill pass** (after all forward-pass edges for a row-transition are
rolled): for every target `j` in row `r+1` with **zero** incoming edges so
far, add a forced edge from `src = clamp(floor(j × Wr / W'), 0, Wr−1)` — no
PRNG draw. This mapping is the same `floor(·)` shape as the forward pass's
`srcExpected`, applied in reverse, and `clamp` guarantees a valid index exists
for any `Wr ≥ 1`, so **this backfill can never itself fail** — unlike
Encounter Generator's solver (which can genuinely exhaust its budget), graph
connectivity here is fully constructive, not search-based.

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| source row width | `Wr` | int | ≥1 | Row `r`'s node count |
| target row width | `W'` | int | ≥1 | Row `r+1`'s node count |
| source index | `i` | int | `0..Wr−1` | Node being connected outward |
| target index | `j` | int | `0..W'−1` | Node needing an incoming-edge check |
| extra-edge chance | `extra_edge_chance` | float | `0.0–1.0` (default `0.3`) | Probability a source node gets a 2nd outgoing edge |

**Output:** a set of `MapEdge`s satisfying: every node in row `r` has
`≥1` outgoing edge (forward pass, unconditionally rolled), and every node in
row `r+1` has `≥1` incoming edge (backfill guarantee). **Worked example**
(`Wr=W'=3`, source `i=1`): `srcExpected=floor(1×3/3)=1`, candidates
`{0,1,2}`. Edge-count draw `=0.85` → `0.85 ≥ 0.70 (=1−0.3)` → **2 edges**.
`rollWithoutReplacement(k=2)` over `{0,1,2}`: draw₁`=0.40` →
`rollChoice(0.40,[0,1,2]) = floor(0.40×3)=1` → target `1`, pool becomes
`{0,2}`; draw₂`=0.90` → `rollChoice(0.90,[0,2]) = floor(0.90×2)=1` → pool`[1]
= 2` → target `2`. Node `i=1` connects to `{1, 2}`.

### F6. Difficulty tier by row (display-only, non-authoritative — see Rule 13)

> **Non-authoritative.** This formula produces a *pre-battle display
> estimate* only, for Map/Run UI to show an approximate difficulty before a
> node is entered. The **authoritative** tier — the one that actually shapes
> Encounter Generator's output — is whatever Difficulty Tiers'
> `getEncounterForNode(runSeed, nodeId, nodeIndex, ascensionOffset,
> rosterSnapshot)` returns as its `tier` field (`difficulty-tiers.md`'s own
> Formula F1, which additionally accounts for `ascensionOffset` — a per-run
> player choice this formula does not see — and its own
> `nodes_per_tier_step` knob, which is not required to equal this formula's
> `rows_per_tier`). The two curves typically agree in shape but are **not
> guaranteed to be numerically identical**; `MapNode.tierIndex` is
> overwritten with the authoritative value the moment a node's encounter is
> generated (Rule 13).

`maxRegularTierIndex = floor((map_depth − 1) / rows_per_tier)`
`tierIndex(row) = min(floor((row − 1) / rows_per_tier), maxRegularTierIndex)` for `row ≤ map_depth`
`tierIndex(bossRow) = maxRegularTierIndex + 1`

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| row | `row` | int | `1..map_depth+1` | The node's row |
| rows per tier | `rows_per_tier` | int | ≥1 (default 2) | How many rows share one difficulty tier |
| map depth | `map_depth` | int | ≥1 (default 6) | Count of regular rows |

**Output:** int, `[0, maxRegularTierIndex+1]`. **Worked example (defaults,
`rows_per_tier=2, map_depth=6` → `maxRegularTierIndex=floor(5/2)=2`):**
`tierIndex(1)=0`, `tierIndex(2)=0`, `tierIndex(3)=1`, `tierIndex(4)=1`,
`tierIndex(5)=2`, `tierIndex(6)=2`, `tierIndex(boss, row 7)=3`. This display
estimate therefore rises in a clean stepped ramp (2 rows per tier) and the
Boss is always shown exactly one tier above the highest regular-row tier the
player has faced — never a jump of more than one step, matching this
project's sawtooth-curve difficulty-design convention (`CLAUDE.md`); the
same monotonic-step shape is independently guaranteed for the authoritative
tier by Difficulty Tiers' own Formula F1.

### F7. Reachable-node set

`reachable(runMap) = { n.nodeId : n ∈ nodes, row(n) == 1 }` if
`runMap.currentNodeId == null` (at Start); else `reachable(runMap) = { e.toNodeId
: e ∈ edges, e.fromNodeId == runMap.currentNodeId }`.

**Output:** a set of `nodeId`s, size `≥1` always (Formula F5's forward-pass
guarantee + Rule 9's fixed Boss/Start edges together ensure no node — except
the terminal Boss — is ever a dead end). **Worked example:** using F5's
worked example, if `currentNodeId = nodeId(row=r, col=1)`, then
`reachable(runMap) = { nodeId(row=r+1, col=1), nodeId(row=r+1, col=2) }` (the
two targets `{1,2}` computed above, translated through Formula F3).

## Edge Cases

- **`map_depth < 1` or `nodes_per_row < 1` supplied to `generateRunMap`:**
  rejected at construction (assert), matching `board-and-grid.md`'s `W<1`
  precedent — never produces a partially-built `RunMap`.
- **A row-band's weight vector sums to something other than `1.00` (a
  content-authoring error in the balance table):** rejected at
  `DifficultyConfig`/weight-table load time, before `generateRunMap()` runs —
  a config-authoring error, analogous to Objective / Win-Lose's rejected
  `depth_min > depth_max` case, not a per-generation runtime path.
- **A row-band weight vector would leave a row with zero eligible types:**
  cannot occur by construction (Rule 8's structural guarantee — `Battle`
  always has nonzero weight in every band) — there is no fallback path to
  document because there is no failure state to fall back from.
- **The forward edge-pass leaves a row-`r+1` node with zero incoming edges:**
  the backfill pass (Formula F5) deterministically adds one — this is the
  *expected*, common case for boundary-index nodes (e.g. the last column of a
  wide row targeting a narrower row), not a rare failure; it is exercised on
  essentially every map generated with non-uniform-adjacent-index rolls.
- **The last regular row (`map_depth`) rolls zero `Rest` nodes:** Rule 7's
  Hard Rule B fires — the highest-column-index node in that row is
  deterministically converted to `Rest`, consuming no additional PRNG draw.
  If that node had already rolled `Rest` naturally, the override is a
  no-op (idempotent).
- **`nodes_per_row = 1` (a fully linear map, no branching):** legal. Every
  row's single node gets its type rolled normally (Formula F4 still applies
  to a width-1 row); Hard Rule B still applies (if that lone last-row node
  didn't roll `Rest`, it is forced to `Rest`). Formula F5's forward pass
  always finds `srcExpected=0` and the backfill pass is a no-op (the one node
  always already has 1 incoming edge). Path choice is trivial in this
  configuration, but map generation itself does not break — Pillar #3's
  variety comes primarily from the hero draft, not the route, so a
  degenerate-width map is a *content* choice, not a system failure (Tuning
  Knobs discourages this default but does not forbid it).
- **Player attempts `enterNode(targetNodeId)` for a `nodeId` not in the
  current `reachableNodes` set:** rejected (contract violation, assert) — the
  UI is responsible for only ever offering reachable nodes as selectable;
  this is a defensive programmer-error guard, not a player-facing "why can't
  I do this" gameplay case, matching this project's established convention
  for invalid-input handling (e.g. `board-and-grid.md`'s OOB-origin
  rejection).
- **Player attempts to re-enter an already-`Claimed` node:** rejected — v1
  has no revisit/backtrack mechanic (Rule 4). This is the same class of
  rejection as the previous bullet (the node is, by definition, no longer in
  `reachableNodes` once `Claimed`, since `reachable()` only returns targets
  reachable from `currentNodeId`, which has already moved past it).
- **A Battle/Elite/Boss node's battle ends in `Defeat`:** the node itself
  never transitions to `Claimed` (it is left in a terminal, non-re-enterable
  `InProgress`-turned-`Failed` state, kept only for telemetry/UI history);
  the **run** immediately transitions to `Defeat` (Rule 15) and
  `run_completed(Defeat)` fires. No further node transitions occur —
  the rest of the `RunMap` becomes moot the instant the run ends, since Run
  Persistence's own run-end sequence (`run-persistence.md` Rule 4f) clears
  the Run Save entirely; there is no lingering "half-completed map" state to
  reconcile on the next session.
- **A Reward/Event/Rest node's delegated resolution never calls back**
  (a bug in Draft / Loadout Meta or a future event system): **PROVISIONAL,
  out of scope for v1.** This document assumes the delegate always
  eventually completes; no timeout/fallback is defined — flagged in Open
  Questions as a risk to revisit once Draft / Loadout Meta is designed.
- **Resume mid-run, `currentNodeId` points at a node whose battle was
  in-progress when the session ended:** per `run-persistence.md` Core Rule 3,
  that node's `EncounterDefinition` is regenerated fresh via the same
  `getEncounterForNode(runSeed, nodeId, nodeIndex, ascensionOffset,
  rosterSnapshot)` call Rule 13 defines (byte-identical per Rule 16/Encounter
  Generator's own Rule 14) and the battle restarts from Turn 1. The
  node's `state` is whatever it was at the last checkpoint (`InProgress`, not
  yet `Claimed`), so re-entering behaves identically to a first entry — no
  special-case handling is needed.
- **Two runs share an identical `runSeed`** (a shared "daily seed," or the
  same session's map regenerated from persisted state on resume): the
  resulting `RunMap` (node types, tiers, edges — everything) is
  byte-identical both times (Rule 16), the map-level half of the
  reproducibility guarantee that also makes seeded battle content shareable.
- **`rows_per_tier` does not evenly divide `map_depth`:** no special
  handling — the last tier band is simply shorter than the others (Formula
  F6's `floor()` naturally absorbs the remainder); this is an accepted
  content-pacing characteristic, not an error.
- **`elite_min_row ≥ map_depth`** (a misconfigured knob under which Elites
  can mathematically never appear): **not** rejected — unlike the hard `W<1`
  rejection above, this doesn't break determinism, reachability, or any
  structural invariant; it silently removes a node type from ever rolling.
  Flagged as a content-authoring footgun in Tuning Knobs, not an Edge Case
  failure.
- **`nodes_per_row = 1` combined with `guarantee_rest_before_boss = true`**
  (interaction of two edge cases above): the single last-row node is either
  already `Rest` from the normal roll, or is force-converted to `Rest` by
  Hard Rule B — both paths already fully covered by the general-case rules
  above; no additional special-casing is required for the width-1 boundary.

## Dependencies

**Upstream (Run Structure / Node Map depends on):**

| System | Interface | Hard / Soft |
|---|---|---|
| **Difficulty Tiers** ✅ | `getEncounterForNode(runSeed, nodeId, nodeIndex, ascensionOffset, rosterSnapshot) → { tier, encounter }`, called lazily once per Battle/Elite/Boss node (Rule 11, Rule 13) | **Hard** |
| **Encounter Generator** ✅ (indirect, via Difficulty Tiers) | — no direct call; Difficulty Tiers is the sole caller of `generateEncounter()` on Run Structure's behalf | **Soft** — no direct calls (resolves C1) |
| **Turn & Phase Manager** ✅ | Instantiates a fresh instance per battle node and awaits `battle_ended(result)` (Rule 14, PROVISIONAL orchestration contract) | **Hard** |
| **Objective / Win-Lose** ✅ (indirect) | The terminal `EvaluationResult.status` surfaced via `battle_ended` | **Hard** |
| **Board & Grid** ✅ (indirect, via Encounter Generator + Turn & Phase Manager) | — | **Soft** — no direct calls |
| **Run Persistence** ✅ | `loadRun()` on resume; `saveRun()`/`clearRun()` on node entry/resolution/run-end (Rule 11's battle-node checkpoints and Rule 12's non-combat-node checkpoints both route through this) | **Hard** — confirmed bidirectionally by `run-persistence.md`'s own Dependencies section |
| **Draft / Loadout Meta** ✅ | Delegated resolution of Reward/Rest nodes and post-Victory rewards; supplies `rosterSnapshot` | **Hard, blocking** |
| **Heroes & Abilities** ✅ (indirect, via Draft / Loadout Meta) | Roster composition feeding `rosterSnapshot`, indirectly via Draft / Loadout Meta | **Soft** |
| **Meta-progression / Unlocks** ✅ | `ascension_max_offset` and the player's currently-unlocked `ascensionOffset` at run start, forwarded unchanged to Difficulty Tiers | **Hard** |

**Downstream (systems that depend on Run Structure / Node Map):**

| Dependent System | Interface (what it uses) | Hard / Soft |
|---|---|---|
| **Draft / Loadout Meta** ✅ | Delegation calls on Reward/Rest node entry and post-Battle-Victory; reads `rosterSnapshot` state it itself maintains, exposed back to this system | **Hard** — confirmed by `draft-and-loadout-meta.md`'s own Interactions table |
| **4X-lite Node Bonuses** ✅ | Reads `MapNode.state == Claimed` and `MapNode.type` per node; all bonus logic is that system's own | **Hard** |
| **Map/Run UI** ✅ | Reads the full `RunMap` + `reachableNodes()` for rendering; calls `enterNode()` on player click | **Hard** — confirmed by `map-run-ui.md`'s own Interactions table |
| **Meta-progression / Unlocks** ✅ | Calls into the `processRunEnd(outcome)` hook (Rule 15) once per terminal run event; its own `processRunEnd(runSummary, metaStats, catalog)` consumes the `RunSummary` this system assembles | **Hard** — resolves the gap `meta-progression-and-unlocks.md` flagged |

**Bidirectional-consistency note:** see the "Bidirectional-consistency notes"
paragraph at the end of the Interactions with Other Systems subsection above
for the full detail on which gaps this document resolves. `systems-index.md`
(row 13) already lists Difficulty Tiers, Objective / Win-Lose, and Turn &
Phase Manager in this system's `Depends On` column; it does **not** yet list
Run Persistence, Draft / Loadout Meta, Heroes & Abilities, or Meta-progression
/ Unlocks, despite each being confirmed **Hard** above — flagged for
`/consistency-check` and the next `systems-index.md` edit pass (out of scope
for this document to edit directly).

## Tuning Knobs

| Knob | Default | Safe Range | Category | Too Low | Too High |
|---|---|---|---|---|---|
| `map_depth` | 6 | 3–12 | Gate | A run barely exists as a campaign — too few meaningful route/draft decisions to deliver the "30–60 min run" session-level loop from `game-concept.md`; the roguelike meta-progression pacing collapses | Blows the 30–60 min session target (each additional row adds at least one ~5-min battle on the critical path); also forces the content catalog (`assets/data/` templates) to cover many more distinct tier bands than a small roster/template set can support well |
| `nodes_per_row` | 3 | 1–5 | Feel/Curve | `1` removes real path choice (legal per Edge Cases, but undermines the Autonomy fantasy — see Player Fantasy) | Beyond ~5, the map screen risks becoming unreadable at a glance (Pillar #5) purely from node/edge count, and decision paralysis sets in for a choice meant to be quick |
| `rows_per_tier` | 2 | 1–4 | Curve | `1` ramps difficulty a full tier every single row — closer to a vertical spike than the sawtooth curve this project's difficulty-design convention calls for (`CLAUDE.md`) | Too high flattens difficulty progression for too long, risking boredom (Csikszentmihalyi flow-channel violation on the low-challenge side) |
| `elite_min_row` | 3 | `2 .. map_depth−1` | Gate | Elites appearing at row 1–2 threaten a roster the player hasn't had a chance to build up at all — a frustration spike with no counter-play available yet | Setting it `≥ map_depth` silently removes Elites from the run entirely (Edge Cases) — a content footgun, not a hard error |
| `row_band_weights` (per band A/B/C, Rule 8) | see Rule 8's default vectors | each type `0.0–1.0`, vector sums to `1.00` | Curve | Skewing too far toward non-Battle types risks the run feeling padded/directionless for a *tactical* roguelike whose core loop is the battle puzzle | Skewing too far toward `Battle` (e.g. `≥0.85`) removes meaningful route variety — every row becomes "which Battle do I want," undermining the route-choice layer of Pillar #3 |
| `extra_edge_chance` | 0.3 | 0.0–1.0 | Feel | `0` gives every node exactly one outgoing edge — a map that looks branchy in node-type variety but is topologically closer to several independent single-file paths, reducing genuine route crossover | Near `1.0`, most nodes connect to most of the next row — the map becomes visually cluttered (crossing edges hurt Pillar #5 legibility) and route choice stops mattering (every path reconverges immediately) |
| `guarantee_rest_before_boss` | `true` | bool | Gate | `false` risks the player facing the run's hardest fight with zero guaranteed preparation opportunity — a fairness violation under Pillar #1 (the player should never be denied the *chance* to prepare, even if they choose not to take it) | N/A (boolean) |

**Interactions between knobs:**
- `map_depth × nodes_per_row` sets the total node count the Map/Run UI must
  render legibly (Pillar #5) — the product, not either factor alone, is the
  real complexity budget; raising both simultaneously compounds rather than
  adds.
- `rows_per_tier` and `map_depth` together determine `maxRegularTierIndex`
  (Formula F6) and therefore how many distinct difficulty tiers the content
  catalog (`assets/data/` templates, balance tables) must support — changing
  either without checking the other risks either too few tiers (flat
  difficulty) or tiers so short they barely register before ramping again.
- `elite_min_row` and `row_band_weights`' Band C vector interact: Band C only
  ever applies to rows `≥ elite_min_row`, so raising `elite_min_row` also
  shrinks the row-range Band C's (Elite-eligible) weights apply to, compounding
  with the "Elites become rarer" effect already described above.

**Intentionally NOT knobs (structural, design-locked invariants — matching
the project's established "fixed adjacency mode" / "fixed phase order"
convention):**
- **Traversal direction and one-way progression** (Rule 4) — no backtracking,
  ever; exposing this would let a setting silently break the "the graph has
  more width than any run uses" route-choice premise this whole system exists
  to deliver.
- **Row 1's Elite/Rest exclusion and the guaranteed-Rest-before-Boss override
  itself existing** (Rule 7's Hard Rules A and B) — these are fairness floors,
  not tunable difficulty content; only `guarantee_rest_before_boss`'s
  **on/off** state is a knob (above), not the mechanism.
- **The Boss row's width (always exactly 1) and its fixed, unrolled edges
  from every row-`map_depth` node** (Rule 9) — a single mandatory final
  challenge is a structural identity of the "one region, one map, one run"
  scope decision (Rule 2), not a tunable value.
- **Whole-map visibility (no fog of war on topology/type)** (Rule 3) — this is
  Pillar #1 made literal; a "hide upcoming rows" toggle would directly
  contradict the pillar's design test.

## Visual/Audio Requirements

Run Structure / Node Map has **substantial indirect visual presence** — unlike
Board & Grid or Objective / Win-Lose, it is the data backing an entire
player-facing screen (the map screen, owned by Map/Run UI), even though this
document does not itself specify layout, iconography, or animation. Its
requirements on that downstream presentation:

- **Every node's type must be visually distinguishable at a glance** (Pillar
  #5) — Battle/Elite/Reward/Event/Rest/Boss need six clearly distinct icons or
  silhouettes, consistent with the "Legible Battlefield" visual anchor's
  "icon-driven" principle from `game-concept.md`'s Visual Identity Anchor,
  extended here from in-battle telegraphs to the map screen.
- **Tier/difficulty escalation should be visually legible without requiring
  the player to read a number** — e.g. a color or intensity ramp across rows,
  so a player can feel "this is getting harder" from a glance at the whole map
  (Rule 3's "whole map visible" guarantee is only useful if the escalation it
  reveals is actually readable).
- **`Unvisited` / `Bypassed` / `Claimed` states need distinct, immediately
  readable visual treatments** — a `Bypassed` node (a path not taken) should
  read as "history," not as "still available" or "an error," since the player
  may want to recall their route after the fact.
- **The Boss node should be visually distinct from every other node** — it is
  the run's single mandatory endpoint and deserves unique presentation (scale,
  color, iconography) that reads as "the destination," not just "another
  battle."
- **No audio requirement is specified by this document** — a subtle map-screen
  ambience or a stinger on node-entry is Audio System's call, deferred
  entirely to that system's own design pass, matching this project's
  established convention of infrastructure systems not prescribing audio
  treatment (e.g. `objective-and-win-lose.md`'s equivalent section).

## UI Requirements

Full UI design is deferred to `ux-designer` (via `/ux-design` for a future
`design/ux/map-screen.md`). This system's contribution is the data contract
Map/Run UI must render against:

- A **map screen** rendering the full `RunMap` (Rule 3) — every node, every
  edge, every type, every tier — with the current position (`currentNodeId`)
  and the live `reachableNodes()` set clearly marked as the only
  currently-clickable options.
- A **node detail affordance** (hover/tap) surfacing at minimum: node type,
  difficulty tier, and (for Battle/Elite/Boss) that the specific encounter
  contents are unknown until entered — consistent with Rule 3's "topology and
  type are known; contents are not" boundary, which the UI must communicate
  honestly rather than implying full foreknowledge it doesn't have.
- A **confirm-to-enter interaction** for irreversible node selection (Rule 4's
  one-way progression means clicking a node is a committing action, not a
  preview) — the exact confirmation UX (single click vs. click-then-confirm)
  is a UX decision, not specified here.
- **Between-node screens** (Reward/Event/Rest resolution UI, and the
  post-Battle/Elite/Boss-Victory reward screen) are owned entirely by Draft /
  Loadout Meta's future UX pass — this document only guarantees the
  `resolveNode(nodeId, Completed)` callback contract those screens must
  eventually invoke.

## Acceptance Criteria

Pure, deterministic tests unless noted. "Battle-node" tests require a real or
lightweight-fake Encounter Generator / Turn & Phase Manager / Objective stack
implementing the contracts this document assumes.

**Map generation & reproducibility (Rules 2, 16, Formula F1)**
- **GIVEN** an identical `runSeed`, **WHEN** `generateRunMap(runSeed)` is
  called twice (including across separate process restarts), **THEN** both
  calls return byte-identical `RunMap` values (node types, tiers, edges, all
  fields).
- **GIVEN** two different `runSeed` values, **WHEN** both are generated,
  **THEN** the resulting `mapSeed` values (Formula F1) differ and the two
  `RunMap`s are not required to be identical (decorrelation smoke test).

**Node ID encoding (Formula F3)**
- **GIVEN** `nodes_per_row=3`, **WHEN** `nodeId(row=3, col=1)` is computed,
  **THEN** it equals `10` (worked example, reproduced literally); **GIVEN**
  the Boss row (`row=map_depth+1, col=0`), **THEN** its `nodeId` follows the
  same formula with no special-cased offset.
- **GIVEN** every valid `(row, col)` pair in a generated map, **THEN** every
  `nodeId` is unique (no collisions) across the whole graph including the
  Boss node.

**Row 1 and structural exclusions (Rule 7 Hard Rule A)**
- **GIVEN** any generated map, **WHEN** row-1 node types are inspected,
  **THEN** none are `Elite` or `Rest` (exhaustive check across ≥100 distinct
  seeds).

**Guaranteed Rest before Boss (Rule 7 Hard Rule B)**
- **GIVEN** any generated map, **WHEN** row `map_depth`'s node types are
  inspected, **THEN** at least one is `Rest` (exhaustive check across ≥100
  distinct seeds, including seeds engineered so the natural weighted roll
  produces zero `Rest` nodes in that row, to specifically exercise the
  override path).
- **GIVEN** a seed where the natural roll already produced a `Rest` node in
  that row, **WHEN** the override rule is applied, **THEN** it is a no-op
  (the row's node-type multiset is unchanged from the pre-override roll).

**Weighted type roll (Formula F4)**
- **GIVEN** Band A weights `{Battle:0.60, Reward:0.20, Event:0.20}` and
  `draw=0.91`, **WHEN** `rollWeightedType` resolves, **THEN** the result is
  exactly `Event` (worked example, reproduced literally).
- **GIVEN** Band C weights `{Battle:0.40, Elite:0.15, Reward:0.15,
  Event:0.15, Rest:0.15}` and `draw=0.62`, **THEN** the result is exactly
  `Reward` (worked example, reproduced literally).
- **GIVEN** any weight vector summing to `1.00` and any `draw ∈ [0,1)`,
  **THEN** `rollWeightedType` always returns exactly one type (never zero,
  never more than one) and never a type whose weight in that vector is `0`.

**Connectivity guarantee (Rule 10, Formula F5)**
- **GIVEN** any generated map, **WHEN** every regular-row node is inspected,
  **THEN** every node in rows `1..map_depth−1` has `≥1` outgoing edge and
  every node in rows `2..map_depth` has `≥1` incoming edge (exhaustive check
  across ≥100 distinct seeds — the connectivity guarantee must hold for
  every seed, not just typical ones).
- **GIVEN** the Formula F5 worked example's exact inputs (`Wr=W'=3, i=1,`
  edge-count draw `0.85`, target draws `0.40` then `0.90`), **WHEN** edges
  are rolled, **THEN** node `i=1` connects to exactly `{1, 2}` (reproduces
  the worked example literally).
- **GIVEN** every node in row `map_depth`, **WHEN** their outgoing edges are
  inspected, **THEN** every single one connects to the Boss node and no
  other target (Rule 9's fixed, unrolled edge).

**Difficulty tier by row (Formula F6)**
- **GIVEN** defaults (`rows_per_tier=2, map_depth=6`), **WHEN** F6 is
  evaluated for each row, **THEN** `tierIndex` values are exactly `[0,0,1,1,
  2,2]` for rows `1–6` and `3` for the Boss row (worked example, reproduced
  literally).

**Reachability & traversal (Rules 4, 15; Formula F7; States and Transitions)**
- **GIVEN** a fresh `RunMap` (`currentNodeId == null`), **WHEN**
  `reachable(runMap)` is computed, **THEN** it returns exactly the set of all
  row-1 `nodeId`s.
- **GIVEN** `currentNodeId` set to some node `X`, **WHEN** `reachable(runMap)`
  is computed, **THEN** it returns exactly `X`'s outgoing-edge targets, and no
  other node.
- **GIVEN** a call to `enterNode(targetId)` where `targetId ∉
  reachable(runMap)`, **WHEN** invoked, **THEN** it is rejected and
  `currentNodeId`/node states are unchanged.
- **GIVEN** a valid `enterNode(targetId)` call, **WHEN** it completes,
  **THEN** `targetId`'s state becomes `InProgress` (then `Claimed` on
  successful resolution) and every other `Unvisited` node in `targetId`'s row
  transitions to `Bypassed` in the same step.
- **GIVEN** a `Claimed` or `Bypassed` node, **WHEN** `enterNode` is attempted
  against it, **THEN** it is rejected (one-way progression enforcement).

**Run-level outcomes (Rule 15)**
- **GIVEN** the Boss node's battle reaches terminal `Victory`, **WHEN** Run
  Structure observes the `battle_ended` event, **THEN** exactly one
  `run_completed(Victory)` fires and no further node transitions are
  accepted.
- **GIVEN** any Battle/Elite/Boss node's battle reaches terminal `Defeat`,
  **THEN** exactly one `run_completed(Defeat)` fires, the triggering node
  never reaches `Claimed`, and no further node transitions are accepted.
- **GIVEN** the player abandons at the map screen (no battle in progress),
  **THEN** `run_abandoned` fires immediately with no `battle_ended` event
  involved.
- **GIVEN** the player abandons mid-battle, **THEN** the propagated
  `battle_ended(Abandon)` from Turn & Phase Manager results in exactly one
  `run_abandoned` from Run Structure (not a separate, additional event).

**Difficulty Tiers hand-off (Rule 13, resolves C1)**
- **GIVEN** a Battle/Elite/Boss node with ordinal position `nodeIndex` on the
  chosen path and the run's fixed `ascensionOffset`, **WHEN** Run Structure
  enters that node, **THEN** it calls exactly `getEncounterForNode(runSeed,
  nodeId, nodeIndex, ascensionOffset, rosterSnapshot)` on Difficulty Tiers —
  never `generateEncounter()` directly, and never constructs a
  `DifficultyConfig` itself (integration test, fake Difficulty Tiers
  acceptable; the fake asserts it — not Encounter Generator — is the sole
  callee).
- **GIVEN** `getEncounterForNode()` returns `{ tier: T, encounter }`, **WHEN**
  Run Structure records this node's difficulty, **THEN** the stored/displayed
  tier for that node becomes exactly `T` (overwriting Formula F6's
  display-only pre-battle estimate, if one had been shown) — `T` is treated as
  authoritative and is never recomputed or overridden by Run Structure.

**Reproducibility of daily-seed sharing (Rule 16)**
- **GIVEN** `(runSeed, nodeId)` requested twice (a shared seed, or resume
  regenerating the same node), **WHEN** the map and the node's encounter are
  both regenerated, **THEN** both the `RunMap` and the `EncounterDefinition`
  are byte-identical both times.

**Degenerate config rejection (Edge Cases)**
- **GIVEN** `map_depth < 1` or `nodes_per_row < 1`, **WHEN**
  `generateRunMap` is called, **THEN** construction is rejected and no
  `RunMap` is produced.
- **GIVEN** a row-band weight vector that does not sum to `1.00`, **WHEN**
  loaded, **THEN** it is rejected before any `generateRunMap()` call using it
  is attempted.

### Performance Budget (headless TS benchmarks, decoupled from render)

| Operation | Budget | Note |
|---|---|---|
| `generateRunMap()` (default 6×3 map, ~45–65 PRNG draws total) | < 10 ms | Runs once per run start/resume — not a per-frame or per-node cost; trivial relative to Encounter Generator's per-node solver budget (seconds) |
| `reachable(runMap)` / Formula F7 | < 0.05 ms/call | Called on every map-screen render and every hover; a plain set lookup or edge-list filter |
| `enterNode()` / `resolveNode()` state mutation (excluding the delegated battle/resolution work itself) | < 0.5 ms | The map-bookkeeping cost only — Battle/Elite/Boss node entry additionally pays Encounter Generator's own (much larger) budget, which this figure does not include |

## Open Questions

**Needs an architecture decision (→ ADR during `/create-architecture`):**

1. **Shared `mix()` hash algorithm confirmation.** Formula F1 depends on the
   same `mix` primitive `encounter-generator.md`'s Open Question #1 asks to be
   pinned via ADR — this document does not introduce a second algorithm choice,
   it inherits that one. *Owner:* Tech architecture, same ADR as Encounter
   Generator's.
2. **Battle orchestration ownership (Rule 14).** This document proposes Run
   Structure / Node Map as the system that instantiates a fresh Board & Grid +
   Turn & Phase Manager pair per battle node (`startBattle(encounterDefinition)
   → BattleHandle`) — neither `board-and-grid.md` nor
   `turn-and-phase-manager.md` currently names an owner for this
   responsibility. Confirm via ADR once those systems' implementation begins,
   or reassign to a dedicated "Battle Session" system if one is introduced
   later. *Owner:* Tech architecture, coordinated with Turn & Phase Manager.
3. **`systems-index.md` edge additions.** This document's dependencies on Run
   Persistence and Turn & Phase Manager are not currently reflected in
   `systems-index.md`'s `Depends On` column for Run Structure / Node Map (out
   of scope for this document to edit directly, per this task's constraints).
   *Owner:* next `/consistency-check` or `systems-index.md` edit pass.

**Resolved this session (provisional defaults — confirm during
implementation):**

4. **Lazy, on-entry encounter generation** (Rule 11) — chosen over
   pre-generating the whole map's battles upfront, specifically to resolve
   `encounter-generator.md`'s Open Question #11 in the direction that avoids
   its flagged stale-`rosterSnapshot` risk entirely.
5. **Uniform node width per regular row** (`nodes_per_row` is a single value,
   not a per-row array) — chosen for v1 simplicity and testability; a future
   iteration could vary width by row (e.g. narrower near the Boss for
   tension) without changing this document's core formulas, only the input
   shape to Formula F3/F5.
6. **A lost battle ends the whole run, not just removes a hero** (Rule 15) —
   chosen to match the roguelike-permadeath framing implied by
   `game-concept.md`'s "Long-Term Progression" section, and because
   partial-roster continuation would require Heroes & Abilities to define
   cross-battle HP/death persistence, which does not exist yet. *Owner:*
   revisit if Heroes & Abilities' eventual death/HP model makes a softer
   "lose a hero, not the run" failure mode desirable.
7. **Reward/Event/Rest nodes are always non-failing in v1** (Rule 12) — a
   deliberate scope line matching Objective / Win-Lose's own "exactly one
   objective type, no composition" v1 philosophy; a future Event system could
   introduce risk/consequence without necessarily needing a run-ending
   failure mode.

**Deferred to the owning system's GDD:**

8. **Reward/Event/Rest node content and resolution UX.** What a Reward
   node actually offers, what an Event node's choices/consequences are, and
   what Rest's heal-vs-upgrade trade-off looks like are entirely **Draft /
   Loadout Meta**'s (and a future event-content system's) to define — this
   document only specifies the completion-callback contract those systems
   must satisfy.
9. **4X-lite node "claim" bonuses — RESOLVED 2026-07-28.** `node-bonuses.md` is
   now Designed. It consumes exactly the read surface this document promised —
   `MapNode.state == Claimed` plus `MapNode.type` — and adds no state, no
   transition, and no new player decision here. This document's map model is
   unchanged.
10. **`DifficultyConfig`'s numeric balance content** (`depthRange`,
    `narrownessMax`, `countScalePerTier` per tier) — deferred to
    `assets/data/` content authoring, and potentially to a future dedicated
    Difficulty Tiers system that could absorb this document's Rule 13
    assembly responsibility without changing the calling contract. *Owner:*
    whoever authors the Difficulty Tiers GDD, or the balance-content pass if
    that system is never separately built.
11. **Map/Run UI's exact node-fade/Bypassed presentation, tier-escalation
    visual treatment, and confirm-to-enter interaction pattern.** Flagged in
    Visual/Audio Requirements and UI Requirements above; owned by
    `ux-designer` via a future `design/ux/map-screen.md`.
12. **Delegated-resolution timeout/fallback** (Edge Cases: "a Reward/Event/
    Rest node's resolution never calls back") — not designed in v1; revisit
    once Draft / Loadout Meta exists and real failure modes (network-free, so
    likely only logic bugs) can be characterized.
