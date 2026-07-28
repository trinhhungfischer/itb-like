# Story 003: Threat Overlay Cross-Reference

> **Epic**: Move Preview
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/gdd/move-preview.md`
**Requirement**: `TR-PREVIEW-004`

**ADR Governing Implementation**: ADR-0011: Environmental telegraph query (C4)
**ADR Decision Summary**: Resolves cross-system contract C4: who owns the environmental (non-enemy-intent) telegraph and how the three consumers that must account for it stay in sync.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Move Preview must compute its telegraphed-tile set as the union of every living enemy's `Intent.telegraphedEffectTiles` with `telegraphedEnvironmentTiles(turn)`
- Forbidden: Move Preview MUST NOT consult Board & Grid's `getHazard` directly to build telegraphed-tile set

---

## Acceptance Criteria

*From GDD `design/gdd/move-preview.md`, scoped to this story:*

- [ ] Threat overlay unions `telegraphedEnvironmentTiles(turn)` with per-enemy `Intent.telegraphedEffectTiles` by the identical contract Battle HUD uses.

---

## Implementation Notes

*Derived from ADR-0011 Implementation Guidelines:*

- After computing the unit final positions from the dry run, check if those final tiles are in the telegraphed tile set.
- The set is the union of `telegraphedEnvironmentTiles(turn)` (from Enemy, Abilities & Telegraph) and every living enemy's `Intent.telegraphedEffectTiles`.
- Flag the preview output so the renderer knows to draw the threat overlay on those units.
- Do not re-derive hazard intent manually via Board `getHazard()`.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 001: Core dry-run execution.
- Story 002: Preview lifecycle and triggers.

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/move-preview/threat-overlay_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002
- Unlocks: None
