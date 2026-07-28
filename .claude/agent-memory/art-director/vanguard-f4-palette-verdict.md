---
name: vanguard-f4-palette-verdict
description: Professional verdict on whether VANGUARD's 8-hue verb-family palette can pass accessibility.md's F4 CVD-separation gate (ΔE00 >= 15 under protan/deutan/tritan sims)
metadata:
  type: project
---

**Verdict (given 2026-07-28, first art-director consult on this project — nobody
had reviewed `art-bible.md` or `accessibility.md` before this session).**

An 8-hue palette CANNOT reliably achieve ΔE00 >= 15 under all three CVD
simulations (protanopia, deuteranopia, tritanopia) simultaneously. Realistic
ceiling is **4 hues** with confidence, **5** if deliberately engineered
(co-varying lightness/saturation with hue, not hue rotation alone). Reasoning:
dichromacy collapses one full chromatic axis per type; surviving all three
types at once means the safe intersection shrinks fast as hue count grows.
Published CVD-safe categorical palettes (Okabe-Ito, ColorBrewer qualitative)
cap around 6-8 for a much weaker bar than ΔE00>=15-worst-case-across-3-sims,
and don't even vet tritanopia.

**Recommendation on `accessibility.md` Open Question #4**: keep F4 advisory,
do NOT shrink the verb-family/hero roster to chase this metric. Rule 2 (shape/
icon redundancy, F3 blocking gate) is the real correctness guarantee; F4 is
comfort-only. Shrinking the roster to satisfy an advisory metric would cut
Pillar #4 ("Every Hero Is a Verb") content for a benefit (prettier palette for
CVD players who are already fully served by shape) disproportionate to the
cost. Instead: fix concrete unforced collisions (see
[[vanguard-color-budget-gaps]]), and where F4 genuinely matters (a colorblind-
mode legend/swatch screen with thin icon redundancy), extend the existing
hazard-pattern convention (diagonal stripes for fire, dots for acid) to verb
swatches — cheap, makes F4 moot exactly where it would bite.

**Why the neutral/low-saturation board (`art-bible.md` §4 Color Philosophy)
helps**: CVD doesn't impair luminance/lightness perception (rod-based), so
saturated accents against `#1A1A24`/`#2D2D3D` get CVD-proof figure-ground
contrast for free. This solves "is something happening here" (the more common
real failure) unconditionally, but does NOT solve pairwise hue confusion
(two accents can still collapse into each other even if both pop off the
background) — so it's not a substitute for F4, but is a legitimate second
reason F4-advisory is defensible, currently uncredited in the doc's own
fallback reasoning.

**How to apply**: if this question resurfaces (roster growing past 12 heroes,
a colorblind-mode feature actually gets built, or someone proposes lowering
`delta_e_min` instead of accepting the advisory status) — reload this memory
before re-deriving the analysis from scratch.
