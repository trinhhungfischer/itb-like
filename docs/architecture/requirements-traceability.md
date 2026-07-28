# VANGUARD — Architecture Traceability Index

> Coverage summary + full TR→ADR matrix + known gaps.
> Generated 2026-07-28 by the Technical Director architecture review.
> Source of TR IDs: `docs/architecture/tr-registry.yaml`. Full reasoning:
> `docs/architecture/architecture-review-2026-07-28.md`.

**Legend:** ✅ Covered (≥1 ADR directly addresses it) · ⚠️ Partial/design-level (no
dedicated ADR — expected/acceptable for presentation-only or GDD-owned invariants) ·
❌ Gap (architecturally significant, no owning decision).

---

## 1. Coverage Summary

| Metric | Count |
|--------|------:|
| Systems | 21 |
| Total TRs | 126 |
| ✅ Covered | 84 |
| ⚠️ Partial / design-level | 40 |
| ❌ Gap | 0 |
| Cross-ADR conflicts | 0 |

### Per-system coverage

| System | TRs | ✅ | ⚠️ | ❌ |
|--------|----:|---:|---:|---:|
| Board & Grid | 7 | 7 | 0 | 0 |
| Turn & Phase Manager | 8 | 6 | 2 | 0 |
| Combat Resolution | 9 | 9 | 0 | 0 |
| Heroes & Abilities | 8 | 6 | 2 | 0 |
| Enemy, Abilities & Telegraph | 8 | 7 | 1 | 0 |
| Move Preview | 6 | 6 | 0 | 0 |
| Objective / Win-Lose | 5 | 3 | 2 | 0 |
| Input & Selection | 5 | 3 | 2 | 0 |
| Board Rendering & Juice | 6 | 3 | 3 | 0 |
| Battle HUD | 5 | 4 | 1 | 0 |
| Run Persistence | 8 | 7 | 1 | 0 |
| Encounter Generator | 6 | 5 | 1 | 0 |
| Run Structure / Node Map | 7 | 6 | 1 | 0 |
| Draft / Loadout Meta | 6 | 5 | 1 | 0 |
| Ability Upgrades | 5 | 3 | 2 | 0 |
| Difficulty Tiers | 5 | 4 | 1 | 0 |
| Meta-progression / Unlocks | 4 | 3 | 1 | 0 |
| Map/Run UI | 4 | 1 | 3 | 0 |
| Draft/Loadout UI | 3 | 0 | 3 | 0 |
| Audio System | 6 | 5 | 1 | 0 |
| Onboarding / Tutorial | 4 | 2 | 2 | 0 |
| **Total** | **126** | **84** | **40** | **0** |

### Coverage by ADR (which TRs each ADR carries)

| ADR | Resolves | Representative TRs covered |
|-----|----------|----------------------------|
| ADR-0001 (A1) Board snapshot | Board Open Q2, snapshot budget | TR-BOARD-001/002/007, TR-TURN-002/008, TR-PREVIEW-003, TR-ENCGEN-002 |
| ADR-0002 (A2) Sync event bus | P1 dispatch, canonical events | TR-TURN-004/005, TR-COMBAT-004/009, TR-PREVIEW-002, TR-RENDER-001/004/006, TR-HUD-001/003, TR-INPUT-002, TR-AUDIO-001/002/005 |
| ADR-0003 (A3) Persistence schema | Run Persist Open Q1 | TR-PERSIST-001..007, TR-RUNMAP-007, TR-DRAFT-002/006, TR-UPGRADE-003, TR-DIFF-005, TR-META-002, TR-TUTORIAL-003 |
| ADR-0004 (A4) mulberry32 | determinism partition | TR-TURN-004, TR-ENEMY-002, TR-PERSIST-005, TR-ENCGEN-001/003, TR-RUNMAP-001, TR-DIFF-002, TR-DRAFT-003, TR-AUDIO-003, TR-META-003 |
| ADR-0005 (A5) error contract | Board Open Q1 | TR-BOARD-004, TR-COMBAT-003/005/007, TR-PREVIEW-005, TR-PERSIST-006 |
| ADR-0006 (A6) resolve() path | breaks Combat cycles | TR-BOARD-005/006, TR-COMBAT-001/002/003/004/005/008, TR-HERO-002/004/006, TR-ENEMY-001/006/008, TR-ENCGEN-002/005, TR-UPGRADE-001, TR-TUTORIAL-001 |
| ADR-0007 (A7) snapshot undo/preview | Move Preview risk | TR-TURN-002/008, TR-COMBAT-008, TR-HERO-004, TR-ENEMY-007, TR-PREVIEW-001/003/006, TR-ENCGEN-002, TR-UPGRADE-001, TR-AUDIO-002, TR-TUTORIAL-001 |
| ADR-0008 (A8) shared Unit (C2) | registry unit_record | TR-HERO-001/005, TR-ENEMY-001, TR-OBJECTIVE-001/002/005, TR-COMBAT-006, TR-UPGRADE-002, TR-DRAFT-001/002, TR-HUD-004, TR-TURN-006, TR-RUNMAP-004, TR-META-001 |
| ADR-0009 (A9) reachableTiles+transform (C3) | Board/Heroes/Enemy/Input | TR-BOARD-003, TR-HERO-003, TR-ENEMY-003, TR-INPUT-001/004, TR-RENDER-002, TR-ENCGEN-002 |
| ADR-0010 (A10) difficulty chain (C1) | Run Struct/Diff/EncGen | TR-RUNMAP-002/003/005, TR-DIFF-001/002/003/005, TR-ENCGEN-004, TR-MAPUI-002, TR-DRAFT-005 |
| ADR-0011 (A11) env telegraph (C4) | Enemy/HUD/Preview/Audio | TR-ENEMY-005, TR-PREVIEW-004, TR-HUD-002, TR-AUDIO-004 |

---

## 2. Full Traceability Matrix

| TR ID | System | Requirement (abbrev.) | ADR(s) | Status |
|-------|--------|-----------------------|--------|:------:|
| TR-BOARD-001 | Board & Grid | Grid model + pure query API | ADR-0001 | ✅ |
| TR-BOARD-002 | Board & Grid | Flat typed arrays, snapshot < 1 ms | ADR-0001 | ✅ |
| TR-BOARD-003 | Board & Grid | Single reachableTiles BFS (C3) | ADR-0009 | ✅ |
| TR-BOARD-004 | Board & Grid | Rejected-mutation Result-vs-throw | ADR-0005 | ✅ |
| TR-BOARD-005 | Board & Grid | Mutations only via Combat | ADR-0006 | ✅ |
| TR-BOARD-006 | Board & Grid | Runtime terrain (hero walls) | ADR-0006 | ✅ |
| TR-BOARD-007 | Board & Grid | Deterministic state, classify precedence | ADR-0001 | ✅ |
| TR-TURN-001 | Turn & Phase Manager | Fixed phase order, environment-first | — | ⚠️ |
| TR-TURN-002 | Turn & Phase Manager | Snapshot-adoption undo, post-chain | ADR-0007, ADR-0001 | ✅ |
| TR-TURN-003 | Turn & Phase Manager | Interface inversion (acyclic driving) | ADR-0006 | ✅ |
| TR-TURN-004 | Turn & Phase Manager | Deterministic, input-driven, no RNG | ADR-0004, ADR-0002 | ✅ |
| TR-TURN-005 | Turn & Phase Manager | Phase events on the sync bus | ADR-0002 | ✅ |
| TR-TURN-006 | Turn & Phase Manager | battle_ended carries nodeType | ADR-0008 | ✅ |
| TR-TURN-007 | Turn & Phase Manager | ≤4 Objective.evaluate/turn | ADR-0008 | ⚠️ |
| TR-TURN-008 | Turn & Phase Manager | Undo memory bounded to one phase | ADR-0007, ADR-0001 | ✅ |
| TR-COMBAT-001 | Combat Resolution | resolve() single pure mutation path | ADR-0006 | ✅ |
| TR-COMBAT-002 | Combat Resolution | Closed 10-primitive vocabulary | ADR-0006 | ✅ |
| TR-COMBAT-003 | Combat Resolution | Strict sequential, target-locking | ADR-0006, ADR-0005 | ✅ |
| TR-COMBAT-004 | Combat Resolution | Canonical events, sole integration surface | ADR-0002, ADR-0006 | ✅ |
| TR-COMBAT-005 | Combat Resolution | spawnUnit/removeUnit single add/exit | ADR-0006, ADR-0005 | ✅ |
| TR-COMBAT-006 | Combat Resolution | hazardImmunities at hazard sites | ADR-0008 | ✅ |
| TR-COMBAT-007 | Combat Resolution | Programmer-error asserts | ADR-0005 | ✅ |
| TR-COMBAT-008 | Combat Resolution | Preview reuses exact resolve() | ADR-0007, ADR-0006 | ✅ |
| TR-COMBAT-009 | Combat Resolution | Event-log field schema (Open Q1) | ADR-0002 | ⚠️ |
| TR-HERO-001 | Heroes & Abilities | Owns canonical Unit record (C2) | ADR-0008 | ✅ |
| TR-HERO-002 | Heroes & Abilities | Shared AbilityDefinition → primitives | ADR-0006 | ✅ |
| TR-HERO-003 | Heroes & Abilities | legalMoveTiles pass-through (C3) | ADR-0009 | ✅ |
| TR-HERO-004 | Heroes & Abilities | compileEffects pure, preview==commit | ADR-0006, ADR-0007 | ✅ |
| TR-HERO-005 | Heroes & Abilities | hazardImmunities first-class Unit field | ADR-0008 | ✅ |
| TR-HERO-006 | Heroes & Abilities | Orthogonal alignment for push/pull | ADR-0006 | ✅ |
| TR-HERO-007 | Heroes & Abilities | Action economy constants (3 / 2) | — | ⚠️ |
| TR-HERO-008 | Heroes & Abilities | Silhouette/verb-color/highlight presentation | — | ⚠️ |
| TR-ENEMY-001 | Enemy, Abilities & Telegraph | Reuses ability schema → primitives (acyclic) | ADR-0006, ADR-0008 | ✅ |
| TR-ENEMY-002 | Enemy, Abilities & Telegraph | Deterministic AI, no RNG | ADR-0004 | ✅ |
| TR-ENEMY-003 | Enemy, Abilities & Telegraph | Movement via reachableTiles (C3) | ADR-0009 | ✅ |
| TR-ENEMY-004 | Enemy, Abilities & Telegraph | Fixed Intent tiles, telegraph contract | — | ⚠️ |
| TR-ENEMY-005 | Enemy, Abilities & Telegraph | Env telegraph queries (C4) | ADR-0011 | ✅ |
| TR-ENEMY-006 | Enemy, Abilities & Telegraph | Emergence/broods via spawnUnit | ADR-0006 | ✅ |
| TR-ENEMY-007 | Enemy, Abilities & Telegraph | On-death cascade before snapshot | ADR-0007 | ✅ |
| TR-ENEMY-008 | Enemy, Abilities & Telegraph | Three deterministic phase-contract methods | ADR-0006 | ✅ |
| TR-PREVIEW-001 | Move Preview | Dry-run identical resolve(), parity | ADR-0007, ADR-0006 | ✅ |
| TR-PREVIEW-002 | Move Preview | Silent, subscription-based | ADR-0002 | ✅ |
| TR-PREVIEW-003 | Move Preview | Snapshot per hover, t_preview ≤ 5 ms | ADR-0001, ADR-0007 | ✅ |
| TR-PREVIEW-004 | Move Preview | Threat overlay union (C4) | ADR-0011 | ✅ |
| TR-PREVIEW-005 | Move Preview | Rejections as values (no throw) | ADR-0005 | ✅ |
| TR-PREVIEW-006 | Move Preview | Never touches undo stack | ADR-0007 | ✅ |
| TR-OBJECTIVE-001 | Objective / Win-Lose | Pure state-poll evaluate() | ADR-0008 | ✅ |
| TR-OBJECTIVE-002 | Objective / Win-Lose | battleState.units = canonical Unit | ADR-0008 | ✅ |
| TR-OBJECTIVE-003 | Objective / Win-Lose | Defeat precedence, party-wipe, four types | — | ⚠️ |
| TR-OBJECTIVE-004 | Objective / Win-Lose | Deterministic, no memory; upstream validation | — | ⚠️ |
| TR-OBJECTIVE-005 | Objective / Win-Lose | reason code; terminal via battle_ended | ADR-0008 | ✅ |
| TR-INPUT-001 | Input & Selection | Shared coordinate transform (C3) | ADR-0009 | ✅ |
| TR-INPUT-002 | Input & Selection | Silent event emitter | ADR-0002 | ✅ |
| TR-INPUT-003 | Input & Selection | Locked gates on isAnimating()+phase | — | ⚠️ |
| TR-INPUT-004 | Input & Selection | Reads Heroes legality (no local BFS) | ADR-0009 | ✅ |
| TR-INPUT-005 | Input & Selection | Deterministic Tab-cycle, keyboard-only | — | ⚠️ |
| TR-RENDER-001 | Board Rendering & Juice | Pure view layer, event consumer (P3) | ADR-0002 | ✅ |
| TR-RENDER-002 | Board Rendering & Juice | Owns pixel geometry, shared transform (C3) | ADR-0009 | ✅ |
| TR-RENDER-003 | Board Rendering & Juice | isAnimating() gates Input Locked | — | ⚠️ |
| TR-RENDER-004 | Board Rendering & Juice | Drains event log in strict order | ADR-0002 | ✅ |
| TR-RENDER-005 | Board Rendering & Juice | Death-anim by cause; polled hazard overlay | — | ⚠️ |
| TR-RENDER-006 | Board Rendering & Juice | Event-log field schema (Open Q2) | ADR-0002 | ⚠️ |
| TR-HUD-001 | Battle HUD | Read-only aggregator, two write paths | ADR-0002 | ✅ |
| TR-HUD-002 | Battle HUD | heroesInDanger union (C4) | ADR-0011 | ✅ |
| TR-HUD-003 | Battle HUD | Event-driven + pure-pull first frame | ADR-0002 | ✅ |
| TR-HUD-004 | Battle HUD | Reads canonical Unit HP; preview overlay | ADR-0008 | ✅ |
| TR-HUD-005 | Battle HUD | HP dual-encoding, phase collapse (presentation) | — | ⚠️ |
| TR-PERSIST-001 | Run Persistence | Envelope + two independent domains | ADR-0003 | ✅ |
| TR-PERSIST-002 | Run Persistence | Pinned order-sensitive checksum | ADR-0003 | ✅ |
| TR-PERSIST-003 | Run Persistence | Build-then-swap atomic writes | ADR-0003 | ✅ |
| TR-PERSIST-004 | Run Persistence | Four load outcomes + migration | ADR-0003 | ✅ |
| TR-PERSIST-005 | Run Persistence | Store seed+nodeId, resume re-derives | ADR-0004, ADR-0003 | ✅ |
| TR-PERSIST-006 | Run Persistence | Result-vs-throw (Open Q2) | ADR-0005, ADR-0003 | ✅ |
| TR-PERSIST-007 | Run Persistence | Capability probe, quota, run-end ordering | ADR-0003 | ✅ |
| TR-PERSIST-008 | Run Persistence | Node-level save granularity scope | — | ⚠️ |
| TR-ENCGEN-001 | Encounter Generator | generateEncounter pure/reproducible | ADR-0004, ADR-0010 | ✅ |
| TR-ENCGEN-002 | Encounter Generator | Solver drives real headless sim | ADR-0006, ADR-0007, ADR-0009 | ✅ |
| TR-ENCGEN-003 | Encounter Generator | Canonical mulberry32 + vectors | ADR-0004 | ✅ |
| TR-ENCGEN-004 | Encounter Generator | Difficulty Tiers sole caller (C1) | ADR-0010 | ✅ |
| TR-ENCGEN-005 | Encounter Generator | Authors initial hazards/terrain/flags | ADR-0006 | ✅ |
| TR-ENCGEN-006 | Encounter Generator | Headless Turn-Manager harness (Open Q2) | — | ⚠️ |
| TR-RUNMAP-001 | Run Structure / Node Map | Deterministic map gen (mapSeed salt) | ADR-0004 | ✅ |
| TR-RUNMAP-002 | Run Structure / Node Map | Calls getEncounterForNode, not gen (C1) | ADR-0010 | ✅ |
| TR-RUNMAP-003 | Run Structure / Node Map | tierIndex display-only, overwritten (C1) | ADR-0010 | ✅ |
| TR-RUNMAP-004 | Run Structure / Node Map | processRunEnd hook + nodeType | ADR-0008 | ✅ |
| TR-RUNMAP-005 | Run Structure / Node Map | Lazy generation on entry (C1) | ADR-0010 | ✅ |
| TR-RUNMAP-006 | Run Structure / Node Map | Battle-orchestration contract (Rule 14) | — | ⚠️ |
| TR-RUNMAP-007 | Run Structure / Node Map | Persists via Run Persistence | ADR-0003 | ✅ |
| TR-DRAFT-001 | Draft / Loadout Meta | RosterMember persistent identity | ADR-0008 | ✅ |
| TR-DRAFT-002 | Draft / Loadout Meta | Persistent non-lethal HP; Unit seeding | ADR-0008, ADR-0003 | ✅ |
| TR-DRAFT-003 | Draft / Loadout Meta | Deterministic seeded offers (draft salt) | ADR-0004 | ✅ |
| TR-DRAFT-004 | Draft / Loadout Meta | No-deadlock loadout proof | — | ⚠️ |
| TR-DRAFT-005 | Draft / Loadout Meta | Read-only rosterSnapshot export (C1) | ADR-0010 | ✅ |
| TR-DRAFT-006 | Draft / Loadout Meta | Persists roster/loadout/upgrades | ADR-0003 | ✅ |
| TR-UPGRADE-001 | Ability Upgrades | effectiveAbility pure, in compileEffects | ADR-0006, ADR-0007 | ✅ |
| TR-UPGRADE-002 | Ability Upgrades | hazardImmune → Unit hazardImmunities | ADR-0008 | ✅ |
| TR-UPGRADE-003 | Ability Upgrades | Upgrade slots persist | ADR-0003 | ✅ |
| TR-UPGRADE-004 | Ability Upgrades | Global slot constant, no-InTurn gate | — | ⚠️ |
| TR-UPGRADE-005 | Ability Upgrades | Extra-Use multi-cast (no 2nd slot) | — | ⚠️ |
| TR-DIFF-001 | Difficulty Tiers | Sole tier authority + generator caller (C1) | ADR-0010 | ✅ |
| TR-DIFF-002 | Difficulty Tiers | tier pure fn, no RNG | ADR-0010, ADR-0004 | ✅ |
| TR-DIFF-003 | Difficulty Tiers | Returned tier = single source of truth (C1) | ADR-0010 | ✅ |
| TR-DIFF-004 | Difficulty Tiers | Offline complexity validation (Open Q1) | — | ⚠️ |
| TR-DIFF-005 | Difficulty Tiers | Persist nodeIndex/ascensionOffset only | ADR-0010, ADR-0003 | ✅ |
| TR-META-001 | Meta-progression / Unlocks | processRunEnd once/run via hook | ADR-0008 | ✅ |
| TR-META-002 | Meta-progression / Unlocks | MetaStatistics canonical Meta Save | ADR-0003 | ✅ |
| TR-META-003 | Meta-progression / Unlocks | No RNG (deterministic unlocks) | ADR-0004 | ✅ |
| TR-META-004 | Meta-progression / Unlocks | Read-only unlock query interfaces | — | ⚠️ |
| TR-MAPUI-001 | Map/Run UI | Renders entire RunMap, scroll not zoom | — | ⚠️ |
| TR-MAPUI-002 | Map/Run UI | Displays authoritative tier (C1) | ADR-0010 | ✅ |
| TR-MAPUI-003 | Map/Run UI | Non-committing hover, explicit confirm | — | ⚠️ |
| TR-MAPUI-004 | Map/Run UI | Five node visual states, non-color-reliant | — | ⚠️ |
| TR-DRAFTUI-001 | Draft/Loadout UI | Presentation only, reads live | — | ⚠️ |
| TR-DRAFTUI-002 | Draft/Loadout UI | Stage-then-confirm, live validity gate | — | ⚠️ |
| TR-DRAFTUI-003 | Draft/Loadout UI | Effective-vs-base before commit | — | ⚠️ |
| TR-AUDIO-001 | Audio System | Read-only non-blocking event consumer | ADR-0002 | ✅ |
| TR-AUDIO-002 | Audio System | No committed tag (preview silence) | ADR-0002, ADR-0007 | ✅ |
| TR-AUDIO-003 | Audio System | Deterministic round-robin variants | ADR-0004 | ✅ |
| TR-AUDIO-004 | Audio System | Tension reads lethalThreatCount (C4) | ADR-0011 | ✅ |
| TR-AUDIO-005 | Audio System | Order inherited from resolution | ADR-0002 | ✅ |
| TR-AUDIO-006 | Audio System | Pan from column; sfx_cue_id gap | — | ⚠️ |
| TR-TUTORIAL-001 | Onboarding / Tutorial | Real systems, no second sim | ADR-0006, ADR-0007 | ✅ |
| TR-TUTORIAL-002 | Onboarding / Tutorial | Read-only coaching, no input gating | — | ⚠️ |
| TR-TUTORIAL-003 | Onboarding / Tutorial | Tutorial flags via canonical Meta Save | ADR-0003 | ✅ |
| TR-TUTORIAL-004 | Onboarding / Tutorial | Three fixed templates, board ramp | — | ⚠️ |

---

## 3. Known Gaps & Follow-ups

No ❌ hard gaps. The following ⚠️ items are the ones worth an explicit follow-up (the
remaining ⚠️ are presentation/design-level and correctly owned below the architecture
layer — see the review report §3a).

| Item | TRs | Nature | Recommended action | Blocks |
|------|-----|--------|--------------------|--------|
| Event-log field-level wire schema/versioning | TR-COMBAT-009, TR-RENDER-006 | Vocabulary settled (ADR-0002); fields not pinned | ADR-0002 addendum (or A12) before Presentation-layer impl | Rendering/HUD/Audio impl only |
| Headless Turn-Manager simulation harness | TR-ENCGEN-006 | Solver integration contract not pinned by any ADR | New ADR (A13) before Encounter Generator impl | Encounter Generator only |
| Per-node battle-orchestration ownership | TR-RUNMAP-006 | PROVISIONAL integration surface (Run Structure Rule 14) | New ADR / Turn-Manager amendment (A14) before Run Structure impl | Run Structure only |
| Heroes `Deployed` HP-seeding hook | TR-DRAFT-002 | Field-level GDD contract gap | `/consistency-check` — add seeding to Heroes `Deployed` transition | Draft persistence detail |
| `sfx_cue_id` on `AbilityDefinition` | TR-AUDIO-006 | Field-level GDD contract gap | `/consistency-check` — add field to Heroes/Enemy schema | Audio content detail |
| `unlockTier`/`complexityRating` placement | TR-DIFF-004 | Where the fields physically live (Diff Open Q1) | `/consistency-check` or `/create-architecture` | Difficulty content-validation only |

None of these blocks the Foundation set (A1–A5) or the Core set (A6/A9, A7/A8) from
implementation. See `architecture-review-2026-07-28.md` §3 and §6 for full reasoning and
the topologically-sorted ADR implementation order.
