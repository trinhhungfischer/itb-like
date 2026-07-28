# Boss Alternating AI

**Description:** Implement the multi-ability, alternating AI pattern for Boss enemies (Behemoth and Architect).

## Acceptance Criteria
1. Bosses can hold multiple `AbilityDefinition`s.
2. Boss AI alternates between abilities based on a turn-parity check (`turn % 2 == 0 ? ability1 : ability2`).
3. Behemoth alternates between Seismic Slam and Summon Swarm.
4. Architect alternates between Rift Tear and Shockwave.
5. The telegraph correctly shows the upcoming ability for the boss.

**Story Type:** Logic
**Story Points:** 3
**Dependencies:** Archetype Ability Definitions
