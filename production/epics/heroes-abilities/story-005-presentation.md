# Story 005: Presentation and Highlighting

> **Epic**: Heroes & Abilities
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Visual/Feel
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/gdd/heroes-and-abilities.md`
**Requirement**: `TR-HERO-008`

**ADR Governing Implementation**: N/A — Presentation contract
**ADR Decision Summary**: Defines visual rules for hero identity and highlighting.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Presentation handlers must record what to animate synchronously and drive animation from their own rAF loop.
- Forbidden: Presentation handlers must not re-emit onto the simulation stream.
- Guardrail: None

---

## Acceptance Criteria

*From GDD `design/gdd/heroes-and-abilities.md`, scoped to this story:*

- [ ] Verify silhouette-first hero identity.
- [ ] Verify one accent color per verb-family.
- [ ] Verify legal-move / legal-target highlight sets are distinct from hazard/telegraph overlays.
- [ ] Verify explicit direction choice for Line abilities.

---

## Implementation Notes

*Derived from presentation layer requirements:*

Ensure the visual layer correctly polls `legalMoveTiles` and `legalTargets` for highlighting. Colors should meet the contrast/accessibility guidelines. Line abilities should show an explicit visual selection step for the cardinal directions.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- None

---

## QA Test Cases

**Verification method**: Screenshot + lead sign-off
**Who must sign off**: art-lead / qa-lead
**Evidence to capture**: screenshots of highlights and visuals

Checklist:
- [ ] Silhouette-first hero identity is clearly readable.
- [ ] One distinct accent color used per verb-family.
- [ ] Legal-move and legal-target highlight sets are visually distinct from hazard/telegraph overlays.
- [ ] Line abilities show explicit visual selection steps for cardinal directions.

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**:
- Visual/Feel: `production/qa/evidence/heroes-abilities-presentation-evidence.md` + sign-off

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 004
- Unlocks: None
