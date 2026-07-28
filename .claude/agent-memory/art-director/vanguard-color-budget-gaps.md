---
name: vanguard-color-budget-gaps
description: Specific, checkable collisions and gaps found in art-bible.md's §4 Color System against actual usage in hero-roster-and-squads.md (as of 2026-07-28)
metadata:
  type: project
---

Found during first art-director review of `design/art/art-bible.md` cross-
referenced against `design/content/hero-roster-and-squads.md`. Status as of
2026-07-28: **identified, not yet fixed** — flagged to user, no file edits made.

1. **F4's palette array is undefined.** `accessibility.md` F4 claims
   `palette — sRGB[] — 8 entries (A2)` but no document enumerates which 8
   colors. V9 cannot actually be run until this is written down. Highest-
   priority fix — do this enumeration first, it will surface #2 below for
   free.

2. **Three unforced hue collisions exist independent of CVD:**
   - Green cluster: Zone `#00FFAA` (mint), Acid Hazard `#99FF00` (lime),
     Confirm `#33FF77` (success green) — will collapse under deuteranopia,
     and are close even for normal vision.
   - Red/orange cluster: Shove `#FF8800`, Fire Hazard `#FF6600`, Lethal
     Threat `#FF3333` — classic protanopia collapse zone.
   - Cancel `#FF4444` sits almost on top of Lethal Threat `#FF3333`
     (near-duplicate reds, different screens mitigate but it's still
     unforced).
   - Fix: restagger on lightness/saturation, not hue — cheap, no scope
     change, should happen regardless of the F4 advisory decision (see
     [[vanguard-f4-palette-verdict]]).

3. **"One accent color per verb-family" is already false as authored.**
   `art-bible.md` §4 lists Zone as one entry (Mint `#00FFAA`). But of the 3
   "Zone" heroes in the roster, only Flux (gravity vortex) uses Mint —
   Ember and Crucible (fire-based Zone) both render Orange-Red `#FF6600`,
   matching the Fire Hazard color instead of Zone's canonical color. Either
   intentional (fire-zone inherits fire's color — arguably more readable)
   or an oversight; either way needs to be stated explicitly in the art
   bible, since the "one color per verb family" claim is load-bearing for
   `accessibility.md`'s entire F4 argument.

4. **"Damage" is a de facto verb-family with no formal §4 entry.** Striker
   (pure damage) and Piston (Shove+Damage) both need a damage accent; both
   informally borrow hazard-table's Lethal Threat red `#FF3333` rather than
   having a verb-family-table entry. Semantically fine (red = "this hurts"
   reinforces across hero abilities and hazards) but should be formalized
   as a 6th verb-family row, not left implicit — an artist reading only the
   Verb-Family table wouldn't know Damage needs an accent.

5. **Pilots.md's "portrait, not icon" direction has no art-bible style
   guidance.** Deliberate, justified exception to silhouette/icon-first
   shape language (breaks cognitive-bandwidth pattern on purpose) — not a
   conflict. But `art-bible.md` has zero guidance on portrait rendering
   style (painted/flat/photo-referenced, framing, whether the neutral-
   background doctrine applies to faces, how the mood-register table maps
   onto a human face). Blocks `/asset-spec system:pilots` from producing
   anything usable until a portrait-style subsection is added.

6. **Node-bonus badges don't state whether they're color-coded.**
   `node-bonuses.md` correctly makes badges icon-driven and visually
   subordinate to node-type art. Doesn't say if the 5 bonus-type icons get
   distinct hues or share one neutral accent. Recommendation given: keep
   achromatic/single-accent rather than minting a 6th independent color
   family — palette is already crowded. Low severity, correctly deferred to
   future `/asset-spec` pass, not yet decided.

**How to apply**: if art-bible.md §4 gets revised, check whether these six
items were addressed before treating the palette as settled. If a new hero
or system proposes a new accent color, check it against the existing
green-cluster and red/orange-cluster collisions before approving.
