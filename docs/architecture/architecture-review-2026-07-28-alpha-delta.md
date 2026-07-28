# Architecture Review Report — Alpha delta pass

> **Date**: 2026-07-28
> **Mode**: delta (not a full 28-GDD re-extraction)
> **Engine**: none — pure web (TypeScript strict + PixiJS 2D WebGL + Vite)
> **GDDs**: 28 · **ADRs**: 12 · **Requirements**: 147 (125 baseline + 22 new)

---

## Scope

The previous architecture sign-off (2026-07-28, `architecture.md`) covered **21
GDDs**. Four Alpha systems were authored the same day, bringing the total to 28.
This pass reviews **the delta only**: the four new GDDs and ADR-0012 against the
existing 125-requirement baseline.

The 24 pre-existing GDDs and their TRs were not re-extracted. That baseline was
reviewed on 2026-07-28 and nothing in this delta invalidates it.

| System | GDD | Prior TR coverage |
|---|---|---|
| #25 Pilots | `design/gdd/pilots.md` | **none** |
| #26 4X-lite Node Bonuses | `design/gdd/node-bonuses.md` | **none** |
| #27 Accessibility | `design/gdd/accessibility.md` | **none** |
| #28 Settings / Options | `design/gdd/settings-and-options.md` | **none** |

All four were invisible to `tr-registry.yaml`, and therefore invisible to
`/create-stories`, `/story-readiness`, and `/story-done`.

---

## Findings

### 🔴 GAP 1 — Settings contradicted an Accepted ADR

**ADR-0003** (Accepted) stated *"two independent persistence domains"* in six
places, including its Summary, Requirements, and Decision §2.
`settings-and-options.md` Rule 2 introduced a **third**,
`vanguard.settings.v{N}`.

This was not a detail. A count stated in an Accepted ADR is part of the decision
of record, and a Designed GDD silently exceeding it is the same failure class
that produced the Pilots/Passive-Modules lane collision and the Rule 21 /
Rule 2 contradiction earlier the same day.

**Resolution:** amend ADR-0003 rather than write a new ADR. Inspection showed the
arity was a **miscount of the architecture, not a constraint of it** — nothing in
the envelope, checksum, migration, or atomic-write design depends on there being
two. §2 is now a **domain registry** with the isolation property stated as the
invariant, and the three current domains tabulated. Adding a domain now requires
no change to any other part of the ADR.

### 🔴 GAP 2 — `RunState.nodeBonuses` had no ADR

ADR-0012 formally added `pilotDeaths` to the Run Save payload the same day.
`node-bonuses.md` Rule 12 added `RunState.nodeBonuses` (multiset plus one-shot
consumption flags) **through no ADR at all** — the same class of change held to
two different standards.

**Resolution:** recorded in ADR-0003 §2's Run Save row, with a standing rule that
Run Save payload additions require an ADR. The payload is opaque to Persistence,
but every field lands in the migration chain, which makes its growth an
architectural concern rather than a system-local one.

### ⚠️ GAP 3 — ADR-0007 was silent on consumable charges

`grep "slot"` against ADR-0007 (snapshot undo & preview) returned **zero
matches**, while `pilots.md` introduced an action-economy skill lane whose
defining example — *Reserve Thrusters*, a second Move slot **once per battle** —
is exactly such a charge. Neither document said what undo does to it.

**Resolution:** ADR-0007 amended. **Charges roll back with the snapshot.**

The reasoning is symmetry, not generosity: undo exists so the player can explore
a turn before committing (Pillar 1). A charge that does not roll back makes
exploration cost something, punishing the player who tries a line and reverts
relative to the one who guessed right first — which inverts the pillar. The
"undo-farm infinite Moves" objection does not hold, because undo restores the
board too; there is no net gain, only a restored option.

This places a constraint on implementers: a battle-scoped charge must live in
snapshotted state, not a side table. Run-scoped state (a pilot's `xp`, a node
bonus) must **not** be snapshotted — undo is Player-Phase scoped.

---

## Cross-ADR conflict detection

| Pair | Result |
|---|---|
| ADR-0012 ↔ ADR-0003 | **Compatible.** ADR-0012 declares the dependency and extends ADR-0003's existing migration chain rather than inventing a mechanism |
| ADR-0012 ↔ ADR-0007 | **Compatible.** Pilot death is run state, explicitly out of undo scope (undo cannot restore a `Removed` unit) |
| ADR-0003 ↔ ADR-0007 | **Compatible** after the GAP 3 amendment drew the snapshotted / run-state boundary explicitly |
| 11 pre-existing ADRs | No new conflicts |

**Dependency graph:** acyclic. ADR-0012 depends on ADR-0003 and ADR-0008, both
Accepted.

### Recommended implementation order (unchanged for Sprint 1)

```
Foundation:  ADR-0001 (board snapshot) · ADR-0002 (event bus) · ADR-0003 (persistence)
Core:        ADR-0005 (error contract) · ADR-0006 (single mutation path)
             ADR-0004 (PRNG) · ADR-0009 (reachableTiles)
             ADR-0007 (undo/preview — requires 0001, 0006)
Feature:     ADR-0008 (Unit record — requires 0006)
             ADR-0010 (difficulty chain) · ADR-0011 (telegraph query)
Alpha:       ADR-0012 (ironman — requires 0003, 0008)
```

---

## Engine compatibility

**Not applicable.** VANGUARD is a pure-web build with no native engine; there is
no Godot/Unity/Unreal API surface, no pinned engine version, and no post-cutoff
API gap. All 12 ADRs carry an Engine Compatibility section recording this. The
Godot reference under `docs/engine-reference/` does not apply to this build.

No engine specialist was consulted, for the same reason.

**GDD revision flags:** none — no GDD assumption conflicts with verified engine
behaviour, because no engine behaviour is being relied on.

---

## Architecture document coverage

`architecture.md` was updated earlier in this session to cover all 28 systems,
including the retraction of a "zero changes" claim that had been propagated from
a pre-review draft of `pilots.md`. ✅

No orphaned architecture: every layer entry maps to a system in
`systems-index.md`.

---

## Traceability

22 new requirements registered across four systems. IDs are permanent and safe
for story references.

| System | TRs | With ADR | Design/presentation level |
|---|---|---|---|
| `TR-PILOT-001..008` | 8 | 7 | 1 |
| `TR-NODEBONUS-001..003` | 3 | 1 | 2 |
| `TR-A11Y-001..005` | 5 | 0 | 5 |
| `TR-SETTINGS-001..006` | 6 | 4 | 2 |
| **Total** | **22** | **12** | **10** |

The ten without an ADR are correct, not gaps. Accessibility authors no runtime
code — its requirements are authoring constraints and verification gates binding
*other* systems. The remainder are presentation-level or delta-supplying
behaviours with no architectural decision to record.

Registry total: **147** (125 baseline + 22).

---

## Verdict: **CONCERNS → resolved**

Three gaps were found; all three are fixed in this pass. No blocking issue
remains.

**Sprint 1 is not affected.** All three findings sat in the Feature/Alpha layers;
Sprint 1 is Foundation + Core. GAP 3 is the one an implementer could have hit
early — undo is a Sprint 1 story — and it is now specified before any code was
written against the ambiguity.

### Pattern worth carrying forward

All three findings share a shape, and it is the third time today the same shape
appeared:

> **A new document extended something an older, already-approved document had
> pinned — and nobody re-read the older document.**

- `DraftOffer` union grew; F3/F4 were not re-read → 23 content items undraftable
- `pilots.md` Rule 21 asserted an absence in `run-persistence.md`; Rule 2 was not
  re-read → the only permanent loss in the design was reversible
- `settings-and-options.md` added a domain; ADR-0003's arity was not re-read →
  a Designed GDD silently contradicted an Accepted ADR

The cheap countermeasure in every case was the same: **grep the document you are
extending for the thing you are extending.** Neither `/consistency-check` (which
compares registry values) nor an independent `/design-review` (which reads one
document) catches this class — the first two were found by manual inspection
during unrelated work.
