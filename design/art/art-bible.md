# VANGUARD — Art Bible

> **Art Director Sign-Off (AD-ART-BIBLE)**: Lean mode — AD sign-off skipped.

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Date** | 2026-07-28 |
| **Status** | Draft |
| **Visual Direction** | Legible Battlefield |
| **Platform** | Web (PC browser primary) |
| **Rendering** | PixiJS (2D WebGL / Canvas2D fallback) |

---

## §1 — Visual Identity Statement

**One-line visual rule**: *"If it affects the puzzle, it must be readable in a single glance."*

1. **Silhouette-First Units**
   * **Tied to Pillar 4:** Every Hero Is a Verb & **Pillar 5:** Read in Ten Seconds.
   * Because each hero represents a unique board-manipulating verb, their function must be immediately clear from their outline alone, without relying on internal textures. Enemies must contrast entirely from heroes geometrically.
   * *Design Test*: If two units (hero or enemy) are confusable when rendered purely as a solid black silhouette, redesign one.

2. **Icon-Driven Telegraphs**
   * **Tied to Pillar 1:** Perfect Information, Perfect Blame.
   * Enemy intents and incoming hazards are communicated via stark, consistent, high-contrast UI icons and overlays projected directly onto the grid. Subtle character animations are strictly forbidden as a method for telegraphing gameplay threats.
   * *Design Test*: A new player can correctly name every incoming threat (damage, movement, hazard) within 10 seconds without hovering for tooltips.

3. **Semantic Verb-Family Colors**
   * **Tied to Pillar 2:** Positioning Over Power & **Pillar 5:** Read in Ten Seconds.
   * A strict color-coding system governs the core board manipulation verbs (Shove, Pull, Swap, Wall). To make these saturated gameplay colors pop, the underlying grid and background environments must be neutral and deliberately low-saturation.
   * *Design Test*: A player must know what a hero's ability will do (e.g., push vs. pull) purely by looking at its associated accent color on the UI, before reading any text.

---

## §2 — Mood & Atmosphere

| Game State | Emotional Target | Lighting Character | Atmospheric Descriptors | Energy Level |
|------------|------------------|--------------------|-------------------------|--------------|
| **Battle (Player Phase)** | Calculated focus, intellectual clarity | Bright, even, unshadowed "blueprint" or "laboratory" lighting | Sterile, precise, static, clear | Low, contemplative |
| **Battle (Enemy Resolve / Telegraph)** | Tension, incoming danger | Slight vignette, pulsing of saturated threat colors (reds/magentas) | Urgent, sharp, threatening | High, kinetic |
| **Run Map / Draft** | Relief, anticipation, strategic planning | Warm, soft ambient light, slight glow on UI elements | Expanding, inviting, resting | Relaxed, steady |
| **Victory** | Satisfaction of a solved puzzle, "Aha!" | Bright screen-flash resolving to warm, golden upward illumination | Expansive, triumphant, clean | Surging |
| **Defeat** | Realization of a miscalculation (perfect blame) | Desaturated, harsh cold downlighting, heavy shadows | Clinical, stark, abruptly silent | Flatline |
| **Menus** | Readiness | High contrast, graphic, flat lighting | Functional, sleek, tactical | Steady |

---

## §3 — Shape Language

The shape language is rigorously tied to **Pillar 5: Read in Ten Seconds**. Players parse geometric primitives much faster than intricate art; therefore, all gameplay-relevant information uses a strict shape vocabulary.

* **Unit Silhouettes**:
  * **Heroes**: Friendly, stable geometry. Soft curves mixed with solid, grounded bases (e.g., trapezoids, semi-circles) to imply resilience, control, and weight.
  * **Enemies**: Aggressive, jagged geometry. Sharp angles, triangles, and inverted triangles (top-heavy shapes) to imply threat, instability, and danger.
* **Grid Tile Geometry**:
  * Strict, clean isometric or top-down squares. Clean 1px vector lines with slight rounding on the inner tile fill. No noisy textures; tiles are solid or lightly patterned fields.
* **Telegraph Overlay Shapes**:
  * Purely iconic, borrowing from UI design rather than in-world diegetic elements. Directional threats use distinct, heavy arrows (e.g., a chevron for shove, a hooked arrow for pull, a looping double-arrow for swap). Damage intents use stark, recognizable primitives.
* **UI Shape Grammar**:
  * Sharp corners for active, mutable elements (buttons, playable cards).
  * Rounded corners for static, informational panels (stats, tooltips) so they recede visually.

---

## §4 — Color System

Colors are chosen for maximum contrast against a dark, neutral background to ensure immediate readability of all board states.

### Primary Palette (The Canvas)
* **Background/Void**: `#1A1A24` (Deep neutral slate)
* **Default Grid Tile**: `#2D2D3D` (Low-sat blue-grey)
* **UI Panels**: `#222230` (Dark slate)
* **Primary Text**: `#F0F0F5` (Off-white)
* **Subdued Text/Lines**: `#7A7A99` (Muted grey-blue)

### Verb-Family Color Coding (The Actors)
* **Shove (Push away)**: `#FF8800` (Vibrant Orange)
* **Pull (Draw in)**: `#00CCFF` (Electric Cyan)
* **Swap (Exchange)**: `#BB33FF` (Neon Purple)
* **Wall (Block/Defend)**: `#FFCC00` (Bright Yellow)
* **Zone/AoE (Area Control)**: `#00FFAA` (Mint Green)

### Hazards & Telegraphs
* **Lethal Threat/Damage**: `#FF3333` (Warning Red)
* **Enemy Intent/Movement**: `#FF5588` (Magenta/Pink)
* **Fire Hazard**: `#FF6600` (Orange-Red)
* **Acid/Toxic Hazard**: `#99FF00` (Lime Green)

### UI Interaction Palette
* **Confirm/Select**: `#33FF77` (Success Green)
* **Cancel/Back**: `#FF4444` (Error Red)

### Colorblind Safety Plan
Color is **never** the sole channel of information.
1. **Verbs**: Verb families always pair their specific hex color with their unique geometric icon (e.g., Purple Swap is always accompanied by a looping double-arrow).
2. **Hazards**: Hazard tiles always include a distinct vector pattern (e.g., Fire has diagonal hazard stripes, Acid has bubbling dots) inside the colored tile border.
3. **Contrast**: The contrast ratio between all verb/telegraph colors and the `#2D2D3D` base tile is tested to exceed WCAG AA standards.
