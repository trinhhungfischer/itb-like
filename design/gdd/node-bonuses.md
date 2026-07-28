# 4X-lite Node Bonuses

> **Status**: Designed (pending independent `/design-review`)
> **Author**: user + main session (Lean review mode)
> **Last Updated**: 2026-07-28
> **Priority**: Alpha | **Layer**: Feature | **Category**: Gameplay
> **Implements Pillars**: #3 Variety Lives in the Draft · #2 Positioning Over Power
> **Systems index**: #26

---

## Overview

A run traverses a node map by choosing **one node per row** — six regular rows plus a
mandatory Boss, seven nodes claimed out of a graph containing nineteen. Every node not
taken is permanently `Bypassed`. **Node Bonuses** attach a small, permanent, run-wide
advantage to each node the player claims, so the route itself becomes a build.

This is the "4X-lite" layer promised in `game-concept.md` — and it is deliberately
**route identity, not territory control**. The player never holds two nodes in the
same row, never defends a claim, and never manages a border. `game-concept.md`'s open
question *"How much 4X-lite (node bonuses vs. real territory control) survives v1?"*
is answered here: **node bonuses only.** Real territory control would demand a
holdings model, a contest mechanic, and a map-state UI — all of which break the
Anti-Pillar "NOT a grand 4X" and blow the scope target.

Node Bonuses occupy a lane no other progression system touches: they are **run-global
and unattached**. Every other axis in VANGUARD — signature ability, ability upgrades,
passive modules, gadgets, pilots — belongs to *one specific mech*. A node bonus
belongs to the run.

---

## Player Fantasy

**"The road I took is the army I have."**

The commander fantasy is about foresight. Node Bonuses extend foresight from the
tactical scale (reading a telegraph) to the strategic scale (reading a map three rows
ahead and choosing the path that builds the run you want).

The intended experience at a branch point: the player is looking at three nodes and
weighing *two* things at once — the immediate content (a battle? a rest? a reward?)
and the permanent bonus the claim grants. A Rest node when nobody is hurt is normally
a wasted row; with Field Hospital it is still a real choice, because the claim pays out
at every *later* combat node rather than at the Rest itself. That tension — "I don't
need this node's content, but I want its claim" — is the whole system.

*(This paragraph previously cited Rest healing compounding at the Rest itself. The
`systems-designer` gate found that bonus was mechanically dead at default tuning —
`rest_heal_percent = 1.00` makes F5's clamp always win, so additive healing did
nothing. The flagship example of the Player Fantasy was describing an effect that
could not occur. Field Hospital was redesigned; see the Bonus Catalog.)*

This serves **Pillar 3 (Variety Lives in the Draft, Not the Dice)** at the map scale:
two runs on the same seed diverge because the player routed differently, with zero
in-battle randomness involved.

What this fantasy is **not**: it is not a power fantasy. Bonuses are small, run-wide,
and never make a single mech stronger. A player who routes badly is *less flexible*,
not weaker in combat.

---

## Detailed Design

### Core Rules

1. **A node is claimed by entering and resolving it.** `MapNode.state` transitions to
   `Claimed` under `run-structure-node-map.md`'s existing rules. This document adds
   **no** new state and **no** new transition — `Claimed` is the only extension point
   that document commits to (its Dependencies table, "4X-lite Node Bonuses").

2. **Every node type carries exactly one claim bonus.** The six types defined by
   `run-structure-node-map.md` Rule 6 — **Battle**, **Elite**, **Reward**, **Event**,
   **Rest**, **Boss** — each map to one `NodeBonusDefinition`. The mapping is authored
   content, not rolled: entering a Reward node always grants the Reward claim bonus.

3. **A claim bonus is permanent for the remainder of the run.** Once granted it is
   never lost, expired, contested, or refunded. There is no upkeep, no decay, and no
   mechanism by which another party takes a claim back. This is what keeps the layer
   "lite".

4. **Bonuses are run-global and unattached.** A node bonus never references a
   `RosterMember`, a `PilotInstance`, or a `Unit`. It modifies run-layer parameters
   only. This is the lane boundary that keeps Node Bonuses disjoint from every other
   progression system (Rule 5).

5. **Lane restrictions.** A node bonus **may** modify: draft offer counts, post-combat
   HP recovery, map information visibility, and encounter setup parameters. A node bonus
   **may not** modify: any `AbilityDefinition` field (→ **Ability Upgrades**), any
   chassis field `maxHP`/`moveRange`/`hazardImmunities` (→ **Passive Modules**), any
   mech-attached action-slot or deployment effect (→ **Pilots**), or any Combat
   Resolution primitive. Any proposed bonus that names a specific mech belongs to
   another system.

   > **Boundary against Pilots specifically.** `pilots.md` Core Rule 4 permits pilot
   > skills to have "run-level" effects. The distinction is attachment: a pilot's
   > run-level skill is **attached to one mech and scales with that mech's
   > participation** (it stops working when that mech is benched or its pilot dies); a
   > node bonus is **unattached and unconditional**. Two effects with identical
   > wording belong to Pilots if a mech must be deployed for them to apply, and to
   > this document otherwise.

6. **Bonuses of the same type stack additively, up to a per-bonus cap.** A route that
   claims three Battle nodes gets the Battle bonus three times, subject to
   `stackCap(bonusId)` (Formula F2). Stacking is what makes a committed route
   ("I took every Battle node I could") a real strategy rather than a coin-flip.

   **Caps are per-bonus, not one global number** *(changed 2026-07-28,
   `systems-designer` gate).* A single shared cap does very different jobs depending on
   how *available* a node type is. Against `run-structure-node-map.md` Rule 8's band
   weights, the expected number of rows (of 6) offering each type is roughly:

   | Type | Expected rows offering it | A cap of 3 … |
   |---|---|---|
   | Battle | ≈ 4.95 | binds meaningfully — roughly halves an uncapped route |
   | Reward | ≈ 2.52 | **barely binds** — it trims lucky seeds, not the median route |
   | Rest | ≈ 1.82 | essentially never binds |

   So a global `3` was near-dead configuration for the one bonus that most needed
   damping. `stackCap(requisition)` is therefore **2**; everything else defaults to
   `node_bonus_stack_cap` (3).

7. **The Boss claim bonus is inert.** The Boss node is the terminal node of every run
   (`run-structure-node-map.md` Rule 9). Its claim grants a bonus for symmetry and for
   the end-of-run summary, but nothing consumes it. It exists so that "every node type
   has a bonus" holds without exception, which keeps the data model total.

8. **Bonuses apply at claim time, before the node's own content resolves where the
   ordering is observable.** For a Reward node, the offer-count bonus must be in effect
   for that same draft. Claiming and benefiting are the same beat — a bonus that only
   helped *future* nodes of its own type would make the last row's claims worthless.

   **Field Hospital is the deliberate exception** and is future-facing by construction:
   it grants post-combat recovery at *subsequent* combat nodes, because the Rest node
   that grants it already heals fully (`draft-and-loadout-meta.md` F5 with
   `rest_heal_percent = 1.00`). A Rest claim in the final row is therefore genuinely
   worth less than an early one — which is honest, not a defect.

9. **Bonuses are deterministic and contain no randomness.** Per Pillar 1, a claim
   bonus is a fixed value from authored content. Node *type* placement is already
   seeded by `run-structure-node-map.md` Formula F8; this document adds no PRNG draw
   of its own.

10. **Bonuses never gate progression.** No node bonus is required to complete a run.
    A player who claims the seven worst-suited nodes for their squad finishes the run;
    they simply have fewer options. There is no route that soft-locks.

11. **Bonuses are not visible as a resource the player spends.** There is no currency,
    no pool, and no spend decision. The player's only input is which node to enter —
    the choice `run-structure-node-map.md` already gives them. This document adds
    **zero** new player decisions, which is the primary defence of Pillar 5.

    > **This rule was false as written until 2026-07-28** (`systems-designer` gate).
    > Contingency was specified as "one Reward draft may be re-rolled once," which is a
    > spend decision *and* needs a UI trigger — contradicting this rule and its own
    > Acceptance Criterion three sections later, inside the same approved document.
    > Contingency is now **automatic** (Bonus Catalog): it fires on the first Reward
    > draft whose offers are all structurally unacceptable, without asking. Rule 11 is
    > now true, and every bonus in the catalog is checkable against it.

12. **The bonus set is run-scoped.** `RunState.nodeBonuses` is created empty at run
    start and discarded at run end. Nothing carries into the next run; cross-run
    persistence belongs to `meta-progression-and-unlocks.md` (Open Questions).

### Bonus Catalog (v1)

Six bonuses, one per node type. Values are the defaults from Tuning Knobs.

| Node type | Bonus name | Effect | Rationale |
|---|---|---|---|
| **Battle** | Supply Line | +1 to the offer count of the next Reward-node draft (stacking) | Rewards fighting through rather than routing around. Converts risk taken into choice gained |
| **Elite** | Forward Intel | Reveal the `type` of every node two rows ahead instead of one | Elite is the highest-risk regular node; paying that risk buys *foresight*, which is the commander fantasy's own currency |
| **Reward** | Requisition | +1 offer count on every subsequent Reward-node draft (stacking) | The compounding route. Stacking Reward claims is the clearest "I committed to a strategy" play |
| **Event** | Contingency | **Automatic**: the first Reward draft this run whose every offer is structurally unacceptable (no eligible target for any of them) is re-drawn once, without asking | Events are the least predictable node; their bonus is insurance against a dead offer set. Automatic by design — see Rule 11 |
| **Rest** | Field Hospital | At the end of every subsequent **combat** node, each deployed mech restores `field_hospital_hp` HP (stacking, clamped at `maxHP`) | Attrition mitigation *between* Rests. Makes a Rest claim worthwhile at full HP because the benefit is future-facing, and it operates entirely outside the Rest-heal formula |
| **Boss** | Campaign Honours | No mechanical effect. Recorded for the end-of-run summary | Rule 7 — keeps the type→bonus mapping total |

> **Content note:** this catalog is deliberately small and information-flavoured rather
> than power-flavoured. Five of six bonuses grant *options or knowledge*, not strength —
> which is what keeps the layer inside the Anti-Pillar "NOT a grand 4X" and away from
> the power-creep failure mode.

### States and Transitions

This document defines **no new state machine.** It observes one that already exists.

`MapNode.state`: `Unvisited → {Bypassed | Claimed}`, owned entirely by
`run-structure-node-map.md`. The `Unvisited → Claimed` edge is this document's sole
trigger.

**Bonus accumulator** (per run). *Reshaped 2026-07-28 (`systems-designer` gate) — see
the correction under Formula F2.* `RunState.nodeBonuses` is a **record**, not a bare
multiset:

```
nodeBonuses {
  claims:   NodeBonusId[]              // append-only; Rule 3 guarantees no removal
  consumed: { [NodeBonusId]: int }     // one-shot charges already spent; only grows
}
```

`claims` only ever grows, so the end-of-run summary stays accurate. `consumed` tracks
how many one-shot charges of each bonus have been spent, which is what makes
Supply Line and Contingency actually one-shot. Lifecycle:
`Empty → Accumulating → (discarded at run end)`.

### Interactions with Other Systems

| System | Reads from Node Bonuses | Node Bonuses reads / calls | Ownership boundary |
|---|---|---|---|
| **Run Structure / Node Map** | — | The `Unvisited → Claimed` transition and `MapNode.type` | Run Structure owns the map, the route rules, and node state; this document only observes claims. It adds no state and no transition |
| **Draft / Loadout Meta** | The effective offer-count modifier (Formula F2) and the re-roll allowance | — | Draft owns offer generation; this document only supplies a count delta it must add |
| **Map/Run UI** | The bonus badge on `Claimed` nodes; the active-bonus list; the reveal-depth value for Forward Intel | — | UI already reserves a badge-render slot on `Claimed` nodes (`map-run-ui.md` Dependencies). This document supplies what goes in it |
| **Run Persistence** | `RunState.nodeBonuses` | — | Run Persistence serialises; this document defines the shape |
| **Pilots** | — | — | Disjoint by Rule 5's attachment test |
| **Ability Upgrades · Passive Modules · Gadgets** | — | — | Fully disjoint. None of them operate at run-map scope |

**Systems requiring zero changes:** Board & Grid, Combat Resolution, Turn & Phase
Manager, Move Preview, Input & Selection, Heroes & Abilities, Enemy Abilities &
Telegraph, Objective / Win-Lose, Battle HUD, Audio System. This is a run-map-layer
system; the simulation core is untouched.

---

## Formulas

### F1 — Claim bonus grant

Evaluated once per `Unvisited → Claimed` transition, before the node's content resolves
(Rule 8).

`grant(node) : RunState.nodeBonuses ← RunState.nodeBonuses ⊎ { bonusForType(node.type) }`

where `⊎` is multiset union (duplicates are retained — Rule 6) and `bonusForType` is
the total mapping in the Bonus Catalog.

**Variables:**

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| `node.type` | — | enum | `Battle \| Elite \| Reward \| Event \| Rest \| Boss` | The claimed node's type |
| `RunState.nodeBonuses` | `B` | multiset\<NodeBonusId\> | 0–(`map_depth`+1) entries | Accumulated claims this run |

**Output Range:** `|B|` grows by exactly 1 per claim, reaching `map_depth + 1` (7 with
defaults) by run end. `bonusForType` is total over the six node types, so F1 never
fails to produce a value.

**Example:** a route of Battle → Reward → Battle → Rest → Elite → Reward → Boss yields
`B = {Supply Line ×2, Requisition ×2, Field Hospital, Forward Intel, Campaign Honours}`.

### F2 — Effective bonus magnitude

**Persistent** bonuses (Requisition, Forward Intel, Field Hospital):

`magnitude(bonusId) = base(bonusId) × min(count(bonusId, B.claims), stackCap(bonusId))`

**One-shot** bonuses (Supply Line, Contingency) — the *unspent* charges only:

`pending(bonusId) = base(bonusId) × ( min(count(bonusId, B.claims), stackCap(bonusId)) − B.consumed[bonusId] )`

> **🔴 Corrected 2026-07-28 (`systems-designer` gate).** This formula previously had a
> single generic form derived from an **append-only** multiset — and Rule 3 guarantees
> that multiset never shrinks. It therefore **could not express one-shot semantics at
> all**, while F3 instructed implementers to reuse it for `pendingSupplyLine`. Walk the
> document's own worked route (Battle → Reward → Battle → Rest → Elite → Reward → Boss):
> Supply Line is consumed at Reward #1, a second Battle claim is added, and at Reward #2
> the old formula returns `1 × min(2, 3) = 2` — silently restoring the spent charge and
> making a "one-shot" bonus permanent. The `consumed` map added to the accumulator is
> what closes this.

**Variables:**

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| `base(bonusId)` | `b` | int | per-bonus, see Tuning Knobs | The bonus's per-claim value |
| `count(bonusId, B)` | `n` | int | 0–(`map_depth`+1) | Times this bonus was claimed |
| `node_bonus_stack_cap` | `C` | int | 1–7 (default **3**) | Maximum counted stacks per bonus |

**Output Range:** 0 to `base × node_bonus_stack_cap`. With defaults, a bonus contributes
at most 3× its base regardless of route.

**Example:** `Requisition` with `base = 1` claimed 4 times on a Reward-heavy route.
`min(4, 3) = 3`, so the effective offer-count bonus is **+3**, not +4. The fourth claim
is not wasted — it still resolves its node's content — but its bonus is capped.

### F3 — Effective draft offer count

The single value Draft / Loadout Meta must consume.

`effectiveOfferCount(node) = min( offerCount + magnitude(requisition) + pending(supply_line),  max_effective_offer_count )`

> **🔴 Corrected 2026-07-28 (`systems-designer` gate).** This formula previously had no
> ceiling, while `draft-and-loadout-meta.md` Formula F4's own variable table declares
> `offerCount` as **`1–4`**. At *default* tuning — `reward_offer_count = 3`,
> `requisition_offers = 1`, Requisition stacked to its cap of 3 — the old formula
> produced **6**, fifty percent past the range the sibling document says it owns, with
> no exotic values involved. The theoretical maximum was 9, more than double.
>
> Worse, that state is exactly the failure the Tuning Knobs table already warns about
> for `requisition_offers` ("every draft contains what you want, deleting Pillar 3's
> scarcity") — written as if it were an edge of the safe range when the arithmetic put
> it *inside* the defaults. `max_effective_offer_count` (default **5**) is the clamp.
> `draft-and-loadout-meta.md` F4's range note now reads "1–4 base; up to
> `max_effective_offer_count` after Node Bonuses' delta."

**Variables:**

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| `offerCount` | — | int | Draft's own knob | Base offer count owned by `draft-and-loadout-meta.md` |
| `magnitude(requisition)` | — | int | 0–3 | Persistent, applies to every Reward draft |
| `pendingSupplyLine` | — | int | 0–3 | **One-shot** — consumed by the next Reward draft, then reset to 0 |

**Output Range:** `offerCount` to `offerCount + 6` at the theoretical maximum
(both bonuses capped). In practice a route cannot max both.

**Ownership note:** this document supplies the *delta*. `draft-and-loadout-meta.md`
owns `offerCount` itself and must not be modified to hardcode any node-bonus value.

**Example:** base `offerCount = 3`, `Requisition ×2` (+2), one unconsumed `Supply Line`
(+1) → this Reward node offers **6**. After it resolves, `pendingSupplyLine` resets;
the next Reward node offers 5 (Requisition persists, Supply Line does not).

### F4 — Map reveal depth

`revealDepth = 1 + (1 if count(forward_intel, B) ≥ 1 else 0)`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| `revealDepth` | `d` | int | 1–2 | Rows ahead whose `MapNode.type` is visible |

**Output Range:** 1 (baseline) or 2. **Forward Intel does not stack** — this is the one
bonus exempt from Rule 6, because reveal depth is an information channel and a route
that revealed the whole map would delete the routing decision entirely (Pillar 5, and
the "meaningful choice" rationale in `run-structure-node-map.md` Rule 4).

**Example:** the player is at row 2. Baseline shows row 3's node types. With Forward
Intel claimed, rows 3 and 4 are visible. A second Forward Intel claim changes nothing.

---

## Edge Cases

- **If the same bonus is claimed more times than `node_bonus_stack_cap`**: excess
  claims are retained in `B` (so the end-of-run summary is accurate) but contribute
  nothing to `magnitude` (F2). The node's own content still resolves normally.

- **If a Rest node's Field Hospital bonus is claimed at that same Rest node**: the
  bonus applies to that Rest (Rule 8). Claiming and benefiting are one beat, so a Rest
  claimed in the final row is not worthless.

- **If a Reward node's Requisition bonus is claimed at that same Reward node**: the
  bonus applies to that draft (Rule 8). Same reasoning.

- **If `Supply Line` is claimed but the run reaches the Boss without passing another
  Reward node**: the one-shot is never consumed and expires unused at run end. This is
  a real routing risk and is intentional — Supply Line rewards a route that pairs
  Battles with a downstream Reward, not Battles alone.

- **If multiple `Supply Line` claims accumulate before a Reward node**: they combine
  into a single `pendingSupplyLine` value (capped by F2) and are **all** consumed by
  that one draft. They do not queue for successive Reward nodes.

- **If Forward Intel is claimed at row `map_depth`** (the last regular row): reveal
  depth 2 would extend past the Boss row. Clamp to the map's last row — the Boss row
  is always visible anyway (`run-structure-node-map.md` Rule 9 makes it fixed and
  known), so the bonus grants nothing new. Legal, just inert.

- **If the Boss node is claimed**: `Campaign Honours` is added to `B` and nothing
  consumes it (Rule 7). The run ends immediately after, so no downstream system
  observes it except the end-of-run summary.

- **If a run ends in defeat**: `B` is discarded with the rest of `RunState` (Rule 12).
  No bonus survives into the next run.

- **If `node_bonus_stack_cap` is set to 1**: every bonus becomes binary
  (claimed / not claimed). This is a legal configuration and a reasonable fallback if
  playtest shows stacking is too strong. Documented so the lever is known.

- **If `node_bonus_stack_cap` is set above `map_depth + 1`**: no clamping ever occurs,
  because a run cannot claim more than `map_depth + 1` nodes total. F2's `min` makes
  this harmless rather than an error.

- **If `Contingency`'s re-roll is unused at run end**: it expires. Like Supply Line,
  it is a one-shot with no carry-over.

- **If a save is loaded mid-run**: `RunState.nodeBonuses` restores verbatim, and
  `pendingSupplyLine` / `Contingency` consumption flags restore with it. Because F2
  derives magnitudes from the multiset rather than storing them, no magnitude can
  desynchronise across a save/load boundary.

---

## Dependencies

### Upstream

| System | What Node Bonuses consumes | Hard / Soft |
|---|---|---|
| **Run Structure / Node Map** | The `Unvisited → Claimed` transition, `MapNode.type`, `map_depth`, and the row/reveal model | **Hard** |
| **Run Persistence** | Serialisation of `RunState.nodeBonuses` and the one-shot consumption flags | **Hard** |
| **Draft / Loadout Meta** | `offerCount`, to which F3 adds a delta | **Hard** |

### Downstream

| System | What it consumes | Hard / Soft |
|---|---|---|
| **Draft / Loadout Meta** | F3's `effectiveOfferCount` delta and the Contingency re-roll allowance | **Hard** |
| **Map/Run UI** | Claim badges on `Claimed` nodes, the active-bonus list, F4's `revealDepth` | **Hard** |
| **Run Persistence** | The `RunState.nodeBonuses` shape | **Hard** |

### Explicitly not dependencies

Board & Grid, Combat Resolution, Turn & Phase Manager, Move Preview, Input & Selection,
Heroes & Abilities, Enemy Abilities & Telegraph, Objective / Win-Lose, Battle HUD,
Board Rendering & Juice, Audio System, Pilots, Ability Upgrades, Passive Modules,
Gadgets. This system operates purely at run-map scope.

**Bidirectional-consistency note:** `run-structure-node-map.md` (Dependencies table,
Open Question #9) and `map-run-ui.md` (lines 294, 563) both list this system as
"Not Started / deferred". Those references are updated as part of this document's
landing changeset.

---

## Tuning Knobs

| Knob | Default | Safe range | Affects | Too high | Too low |
|---|---|---|---|---|---|
| `node_bonus_stack_cap` | 3 | 1–7 | Default per-bonus cap (Battle, Rest, Event) | A single-type route dominates; branching stops being a choice because one strategy is always correct | At 1, bonuses become binary and route *commitment* stops mattering — you want breadth, never depth |
| `stackCap(requisition)` | **2** | 1–4 | Requisition damping specifically | Requisition is the only *compounding* bonus (bigger drafts → better claims → bigger drafts) with no in-system dampener besides this. At 3 the cap barely binds, since only ≈2.5 rows offer Reward | At 1 the compounding loop is cut entirely and Reward-stacking stops being a strategy |
| `max_effective_offer_count` | **5** | 4–7 | Ceiling on Formula F3 | Approaches "every draft contains what you want", deleting Pillar 3's scarcity — the failure the `requisition_offers` row warns about | At 4 the delta can never exceed the base range and Requisition/Supply Line stop mattering at all |
| `supply_line_offers` | 1 | 0–3 | Battle-node value | Battles become mandatory routing; risk-averse play is punished too hard | At 0, Battle claims grant nothing and Battle nodes are pure downside versus Rest/Event |
| `requisition_offers` | 1 | 0–3 | Reward-node value | Reward-stacking trivialises the draft — with enough offers every draft contains what you want, deleting Pillar 3's scarcity | At 0, Reward nodes offer only their content, and the claim layer loses its clearest strategy |
| `field_hospital_hp` | 1 | 0–3 | Post-combat attrition recovery | Attrition stops mattering; Rule 3's non-lethal HP floor plus generous healing removes all pressure | At 0, Rest claims are worthless when the squad is healthy |
| `forward_intel_depth` | +1 row | +1 only | Information | Revealing 3+ rows collapses the routing decision into a solved lookahead (F4's non-stacking rationale) | At 0, Elite nodes carry the highest risk with no compensating claim |

**Interaction:** `supply_line_offers`, `requisition_offers`, and
`draft-and-loadout-meta.md`'s own `offerCount` are one system. Retune together — F3
shows they sum directly, and `offerCount` is **not** this document's knob to change.

**Not knobs here:** `map_depth` (6) and `nodes_per_row` (3) are owned by
`run-structure-node-map.md`. Changing `map_depth` changes how many bonuses a run
accumulates and therefore invalidates `node_bonus_stack_cap`'s tuning.

---

## Visual/Audio Requirements

> `art-director` not consulted — Lean review mode, and subagent dispatch was unavailable
> in the authoring session. Review manually before production.

- **Claim badge.** `map-run-ui.md` already reserves a badge-render slot on `Claimed`
  nodes. The badge shows the claimed bonus's icon. Per `art-bible.md` §1 principle 2
  (icon-driven, not animation-driven), it must be a static, high-contrast icon.
- **Icon per bonus, not per node type.** Five distinct icons plus an inert Boss mark.
  Because node *type* already has its own visual language on the map, the bonus badge
  must be visually subordinate — a corner overlay, not a second full-size symbol —
  or the map reads as twice as dense.
- **Active-bonus list.** A persistent, compact summary of accumulated bonuses with
  their current stack counts, visible on the map screen. This is the only place the
  player can see F2's capping take effect, so a capped stack must be visibly distinct
  from an uncapped one (e.g. `×3 (max)`).
- **Forward Intel reveal must be legible as a state change.** When claimed, the newly
  revealed row should be visually identical to the already-revealed row — not a
  "special" treatment — so the player reads it as *more map*, not as a different thing.
- **Audio**: one short claim-confirmation cue on the UI bus, reused for all bonus
  types. Per `audio-system.md`'s clarity-first direction, distinct per-bonus cues
  would be noise; the visual badge carries the identity.

📌 **Asset Spec** — after the art bible is approved, run
`/asset-spec system:node-bonuses` for per-icon specs.

---

## UI Requirements

> **📌 UX Flag — Node Bonuses**: this system has UI requirements. Run `/ux-design` for
> the map screen before writing stories.

All UI attaches to the **map screen** already specified in `map-run-ui.md`. **No new
screen is introduced**, and per Core Rule 11 **no new player decision is introduced** —
the player's only input remains choosing a node.

- **Node badge** on every `Claimed` node (Visual/Audio Requirements).
- **Active-bonus panel** — accumulated bonuses with stack counts and cap indication.
- **Pre-claim preview** — hovering an unclaimed reachable node shows which bonus its
  claim would grant, so the routing decision is informed. **This is required, not
  optional**: Pillar 1 (Perfect Information) means the player must never discover a
  claim bonus only after committing to the node.
- **End-of-run summary** — the full claimed route with its bonuses, alongside the
  existing route display (`map-run-ui.md` line 736).

**Accessibility note:** bonus badges must not rely on color alone to distinguish
bonuses — shape/icon redundancy per `design/ux/accessibility-requirements.md` §1.

---

## Acceptance Criteria

**Core rules**

- **GIVEN** a node in any state, **WHEN** it transitions `Unvisited → Claimed`,
  **THEN** exactly one bonus is appended to `RunState.nodeBonuses` (F1).
- **GIVEN** a node that is `Bypassed`, **WHEN** the run continues, **THEN** no bonus
  is ever granted for it.
- **GIVEN** any of the six node types, **WHEN** `bonusForType` is called, **THEN** it
  returns a defined bonus — the mapping is total (Rule 2, Rule 7).
- **GIVEN** a claim bonus has been granted, **WHEN** any subsequent run event occurs,
  **THEN** the bonus is never removed from `RunState.nodeBonuses` (Rule 3).
- **GIVEN** any authored `NodeBonusDefinition`, **WHEN** content review runs, **THEN**
  it references no `RosterMember`, `PilotInstance`, `Unit`, `AbilityDefinition` field,
  or chassis field (Rules 4–5).
- **GIVEN** a full run, **WHEN** it completes, **THEN** the player was asked to make
  zero decisions attributable to this system (Rule 11).

**Formulas**

- **GIVEN** a route claiming Battle, Reward, Battle, Rest, Elite, Reward, Boss,
  **WHEN** the run ends, **THEN** `RunState.nodeBonuses` contains exactly 7 entries
  with Supply Line ×2 and Requisition ×2 (F1).
- **GIVEN** `node_bonus_stack_cap = 3` and a bonus claimed 4 times, **WHEN**
  `magnitude` is computed, **THEN** it returns `base × 3`, not `base × 4` (F2).
- **GIVEN** a bonus claimed 0 times, **WHEN** `magnitude` is computed, **THEN** it
  returns 0 (F2).
- **GIVEN** base `offerCount = 3`, Requisition ×2, and one unconsumed Supply Line,
  **WHEN** a Reward node's draft is generated, **THEN** it offers 6 (F3).
- **GIVEN** the state above, **WHEN** the *next* Reward node's draft is generated,
  **THEN** it offers 5 — Requisition persists, Supply Line was consumed (F3).
- **GIVEN** Supply Line claimed but no Reward node remaining on the route, **WHEN**
  the run ends, **THEN** it expires unconsumed and no error occurs.
- **GIVEN** Forward Intel claimed once, **WHEN** `revealDepth` is computed, **THEN**
  it returns 2 (F4).
- **GIVEN** Forward Intel claimed twice, **WHEN** `revealDepth` is computed, **THEN**
  it still returns 2 — this bonus does not stack (F4).
- **GIVEN** the player is at row `map_depth` with Forward Intel, **WHEN** reveal is
  computed, **THEN** it clamps to the last row without error (Edge Cases).

**Cross-system**

- **GIVEN** any claim, **WHEN** it resolves, **THEN** no `MapNode.state` value outside
  `run-structure-node-map.md`'s existing three is written.
- **GIVEN** a Rest node claimed at full squad HP, **WHEN** its Rest resolves, **THEN**
  the Field Hospital bonus applies to that same Rest (Rule 8).
- **GIVEN** any battle, **WHEN** the simulation core executes, **THEN** no Combat
  Resolution, Board & Grid, Turn & Phase Manager, or Move Preview code path reads
  `RunState.nodeBonuses`.
- **GIVEN** a mid-run save, **WHEN** it is reloaded, **THEN** `RunState.nodeBonuses`
  and every one-shot consumption flag match the pre-save state exactly.
- **GIVEN** the same seed and the same routing choices, **WHEN** a run is replayed,
  **THEN** the accumulated bonus multiset is identical (Rule 9).
- **GIVEN** an unclaimed reachable node, **WHEN** the player hovers it, **THEN** the
  bonus its claim would grant is displayed before commitment (Pillar 1).

**Performance**

- Bonus resolution runs once per node claim — at most `map_depth + 1` (7) times per
  run. No per-frame or per-turn cost.

---

## Open Questions

1. **Does any bonus survive into the next run?** This document scopes bonuses strictly
   to one run (Rule 12). Whether a meta-progression unlock could grant a run a starting
   bonus belongs to `meta-progression-and-unlocks.md`, not here. *Owner:*
   Meta-progression / Unlocks.

2. **Is a six-bonus catalog enough variety?** One bonus per node type is the minimum
   that satisfies Rule 2's totality. A richer version would offer 2–3 variants per type,
   seeded per run, so the same node type is not always the same claim. That is a
   content expansion, deliberately deferred — v1 favours legibility (Pillar 5) over
   variety here, because the routing decision is already carrying node *type* and
   node *tier* as inputs. *Owner:* playtest.

3. **Does `Contingency`'s re-roll need its own UI affordance?** A re-roll is a player
   decision, which sits uneasily with Rule 11's "zero new decisions" claim. It may be
   better recast as an automatic effect (e.g. "the worst offer in one draft is replaced")
   to keep the rule absolute. *Owner:* resolve with `/ux-design` on the draft screen.

4. **Interaction with Difficulty Tiers.** `run-structure-node-map.md` Rule 13 has
   Difficulty Tiers return the authoritative `tier` on node entry. Whether a claim bonus
   should scale with tier — a claim on a harder node granting more — is unexplored. v1
   says no: flat values keep F2 legible. *Owner:* playtest, coordinated with Difficulty
   Tiers.

---

## Review Status

> **`systems-designer` gate: ✅ RUN 2026-07-28.** Returned 1 CRITICAL, 3 HIGH and
> several MEDIUM findings, **all applied**:
> **Field Hospital was mechanically dead** — `draft-and-loadout-meta.md` F5's
> `min(maxHP, currentHP + ceil(maxHP × rest_heal_percent))` with `rest_heal_percent`
> defaulting to **1.00** means the clamp always wins, so additive Rest healing did
> literally nothing at the reference configuration. It was the flagship example in this
> document's own Player Fantasy. Redesigned to grant post-combat recovery instead,
> operating entirely outside F5.
> **Formula F2 could not express one-shot semantics** off an append-only multiset;
> split into persistent/one-shot forms with a `consumed` map.
> **Formula F3 overflowed** the sibling doc's declared `offerCount` range `1–4`,
> reaching **6 at default tuning**; now clamped by `max_effective_offer_count`, and
> that range widened at the source.
> **Core Rule 11's "zero new decisions" was false** — contradicted by Contingency in
> the same file; Contingency is now automatic.
> **Stack caps are now per-bonus** — a global 3 barely bound Requisition (≈2.5 expected
> Reward rows), the one bonus that most needed damping.
> **The attachment boundary was one-sided** and is now mirrored into `pilots.md` Rule 5.
>
> **Design Review**: **run 2026-07-28** by the user in an independent terminal
> session — **but no verdict, findings, or document changes were recorded.** The
> working tree was unchanged afterward. This is indistinguishable from a clean pass:
> it may mean the review found nothing, or that its output stayed in that terminal.
> **Treat this document as unverified.** Re-run
> `/design-review design/gdd/node-bonuses.md` in a fresh session and capture the
> verdict here. For contrast, `pilots.md`'s review returned MAJOR REVISION NEEDED and
> wrote its fixes into the document — so a silent run is not evidence of quality.
>
> **Specialist gates not consulted** (Lean review mode; subagent dispatch unavailable):
> `systems-designer` (Formulas, Edge Cases), `qa-lead` (Acceptance Criteria),
> `art-director` (Visual/Audio), `creative-director` (CD-GDD-ALIGN).
