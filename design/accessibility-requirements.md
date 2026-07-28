# VANGUARD — Accessibility Requirements

> **Canonical document:** [`design/ux/accessibility-requirements.md`](ux/accessibility-requirements.md).
> This file mirrors the top-level summary; the UX doc holds the full detail and
> per-screen verification checklist.

The critical driver: Pillar #5 "Read in Ten Seconds" + "one accent color per verb-family"
means **color must never be the sole information channel**. Baseline (WCAG 2.1 AA where
applicable):

1. **Color independence (critical):** every verb, telegraph, hazard, and team is
   identifiable by shape/icon, not color alone; colorblind-safe palette + modes;
   greyscale must remain fully readable.
2. **Text & scaling:** UI scalable 100%–150%; contrast ≥ 4.5:1 (body), ≥ 3:1 (large/UI).
3. **Input & motor:** full key remapping; optional `require_confirm_click`; keyboard-only
   playable; no reaction-time inputs (turn-based, deterministic).
4. **Motion & audio:** reduced-motion setting; no critical info via audio (fully playable
   muted); no flashing > 3 Hz.
5. **Cognitive:** Move Preview + Inspect always available; onboarding teaches one verb at a time.

Full requirements, rationale, and the verification checklist:
`design/ux/accessibility-requirements.md`.
