<Epic: Draft/Loadout UI>
> **Layer**: Presentation
> **GDD**: design/gdd/draft-loadout-ui.md
> **Architecture Module**: Draft/Loadout UI
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories draftloadout-ui`

## Overview
Draft/Loadout UI is the presentation and interaction layer for everything `draft-and-loadout-meta.md` decides: it is the set of screens — Roster Hub, Loadout Configuration, the shared Offer Screen, the Rest Choice screen, and the Starting Roster Draft screen — through which the player views their Roster, reconfigures their Loadout, compares and picks Draft Offers, and makes the Rest node's Heal-vs-Train choice. This document owns **no game rules**: every legality check, every generated value, and every persistent fact it displays is computed by Draft / Loadout Meta and simply rendered here. What this document *does* own is how that information is organized, navigated, previewed, and confirmed — the interaction patterns, screen flow, keyboard/mouse accessibility, and the ability compare/preview mechanism that makes Pillar #1's "full information before commit" promise concretely usable rather than merely mechanically true.

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| None | N/A | No governing ADRs | N/A |

## GDD Requirements
- TR-DRAFTUI-001: Covered by None (Design/Presentation)
- TR-DRAFTUI-002: Covered by None (Design/Presentation)
- TR-DRAFTUI-003: Covered by None (Design/Presentation)

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`
