# VANGUARD — Accessibility Requirements

> Accessibility baseline for VANGUARD (pure web, mouse + keyboard). The most critical
> driver: Pillar #5 "Read in Ten Seconds" and the art direction "one accent color per
> verb-family" mean the game leans on color to communicate — so **color must never be
> the sole channel**. Targets WCAG 2.1 AA where applicable. (Full-featured
> accessibility options are the Alpha system #24; this document is the requirements
> baseline every earlier system must respect.)

## 1. Color independence (CRITICAL)

- **Shape/icon redundancy:** every verb-family, telegraph, hazard, and team
  distinction must be identifiable by **shape or icon**, not color alone. A player who
  sees only greyscale must still read the full board (Pillar #1/#5).
  *Test:* render the battle in greyscale — every threat, verb, and team is still
  distinguishable.
- **Colorblind-safe palette:** choose an 8-way palette distinguishable under
  deuteranopia/protanopia/tritanopia; provide colorblind mode variants.
- Units are silhouette-first (art direction): confusable-in-monochrome units must be
  redesigned.

## 2. Text & scaling

- UI text scalable (100%–150%) without layout breakage or clipping.
- Minimum body contrast ratio ≥ 4.5:1; large/UI text ≥ 3:1.
- No critical information conveyed by text smaller than the scalable base.

## 3. Input & motor

- **Full key remapping** for all bindings in `design/ux/interaction-patterns.md`.
- **`require_confirm_click`** setting (from input-and-selection.md): converts
  single-click-commit into a two-step confirm, for players who benefit from a
  reduced misclick risk. Undo already covers accidental commits within a phase.
- No time-pressure inputs in battle (turn-based, deterministic) — no reaction-speed
  requirement anywhere in core play.
- All actions reachable by keyboard alone (deterministic Tab-cycle + Enter/Esc).

## 4. Motion & audio

- **Reduced-motion setting:** minimizes or disables juice (knockback tweens, screen
  shake, particle flourishes) while preserving the informational overlays.
- **No reliance on audio for critical information:** all telegraphs, threats, and
  outcomes are visual; audio is reinforcement only. The game is fully playable muted.
- Avoid flashing content > 3 Hz (photosensitivity).

## 5. Cognitive / legibility

- Move Preview always available (perfect information) — reduces working-memory load.
- Inspect mode (read-only) available on any unit at any time without committing.
- Onboarding introduces one verb at a time on small boards (onboarding-tutorial.md).

## Verification checklist (per screen/system)

- [ ] Greyscale pass: all game-relevant distinctions survive.
- [ ] Keyboard-only pass: full battle playable without a mouse.
- [ ] Muted pass: full battle playable without audio.
- [ ] Text at 150%: no clipping/overlap.
- [ ] Reduced-motion: informational overlays intact.
