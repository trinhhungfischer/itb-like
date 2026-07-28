# Input & Selection

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #1 Perfect Information, Perfect Blame; #5 Read in Ten Seconds

## Overview

Input & Selection is the translation layer between raw web input (mouse/pointer
and keyboard) and the logical battle state: it converts screen pixels into tile
coordinates, tracks what the player has selected (a unit, an action mode, a
target), and exposes a single, predictable **hover-to-preview, click-to-commit**
interaction model that every hero verb and enemy interaction rides on top of. It
owns *only* the selection/targeting state machine and the screen↔tile coordinate
contract — it does not decide whether a move is legal (Board & Grid / Combat
Resolution do that) and it does not render anything (Board Rendering & Juice
does). It exists because Pillar #1 (Perfect Information, Perfect Blame) is a
promise about *input*, not just display: the player must be able to preview the
full consequence of an action before committing to it, cancel freely before
committing, and never have an action "sneak past" them through ambiguous or
laggy input handling. Primary input for v1 is **keyboard + mouse on desktop web
browser**; gamepad and touch are explicitly out of scope (see Open Questions).

## Player Fantasy

Input & Selection has no direct player fantasy — like Board & Grid, it is
infrastructure. What the player *feels* when it works is **"the cursor is my
intention, instantly."** There is no lag between "I am thinking about this
tile" (hover) and "I can see what would happen" (preview), and no lag between
"I decide" (click) and "it happens." The player should never wonder *"did that
register?"* or *"wait, what did I just click?"* — every selection, hover, and
commit has an immediate, legible response. The failure state of this system is
a **misfire**: an action committing that the player didn't mean to commit
(destroys trust, breaks Pillar #1's "perfect blame" — a loss must be the
player's tactical mistake, never a UI mistake), or a click that silently does
nothing with no feedback (destroys the feeling of control). Because this system
sits directly beneath Pillar #1, it is held to a near-zero tolerance for
ambiguity: every input either does something visible or is visibly rejected.

## Detailed Design

### Core Rules

1. **Two input methods, one shared state machine.** Mouse/pointer and keyboard
   both drive the *same* selection state (Section "States and Transitions") —
   neither is a second-class citizen. Any action reachable by mouse must be
   reachable by keyboard alone (accessibility requirement: keyboard-only play).
2. **Hover previews, click commits — Input & Selection only emits events.**
   Input & Selection is a **silent event emitter**, never a caller into Move
   Preview: moving the pointer (or keyboard cursor) over a valid target
   tile/unit **emits a `hover` event**; selecting a unit/mode **emits a
   `select` event**; backing out **emits a `cancel` event**; and a commit
   click (or Enter/Space on the keyboard cursor) on a *valid* target **emits
   a `confirm` event**. Move Preview (system #6, Designed — see Dependencies)
   **subscribes** to this hover/select/cancel/confirm event stream; on a
   `hover`/`select` it dry-runs Combat Resolution's `resolve()` against
   `board.snapshot()` and displays the result — Input & Selection never calls
   a synchronous `preview()` function and never reads back a preview result
   (`input-and-selection.md` has no dependency on Move Preview's *return
   value*, only on Move Preview existing as a subscriber). There is no
   separate "confirm" step by default — a `confirm` event on a valid target
   commits immediately (see `require_confirm_click` tuning knob for the
   opt-in accessibility alternative, which gates the `confirm` event behind
   an extra arm-then-confirm step rather than changing this emit contract).
3. **Input is only live during Player Phase.** Per the turn order (TurnStart →
   PlayerPhase → Environment → EnemyResolve → Spawn → Telegraph → EndCheck),
   Input & Selection accepts commits only while Turn & Phase Manager reports
   the current phase as `PlayerPhase`. In every other phase the system is
   **Locked** (Core Rule 8).
4. **Selection is single-focus.** At most one unit is "selected" (has an open
   action-mode/targeting context) at a time. Selecting a new unit always
   replaces the previous selection — there is no multi-select in v1 (matches
   ITB; keeps Pillar #5 legibility — one thing being planned at a time).
5. **Screen↔tile mapping is owned here, geometry is owned by Rendering.**
   Input & Selection defines the *contract* — `screenToTile` / `tileToScreen`
   (Formulas 1–2) — but the concrete pixel origin and tile size are supplied by
   Board Rendering & Juing at render time (camera, zoom, letterboxing). The two
   systems **must agree on the same transform** or clicks will misregister —
   flagged as an architecture decision (see Dependencies).
6. **Cancel is always free and instant.** `Escape` or right-click, while
   Targeting, discards the in-progress target selection and returns to
   `UnitSelected` — **no Board state is touched**, because nothing was
   committed yet. This is distinct from Turn & Phase Manager's Undo (a Board
   `snapshot()` restore of an *already-committed* action), which Input &
   Selection triggers via a separate hotkey but does not own.
7. **Action availability is queried, not owned.** Input & Selection does not
   know which abilities a unit has, their range/shape, or whether the unit has
   already acted this turn — it queries Heroes & Abilities' real surface,
   `legalMoveTiles(origin, moveRange, board)` (Formula F1 of
   `heroes-and-abilities.md`, itself built on Board & Grid's shared
   `reachableTiles`) for the Move mode's highlight set, and
   `legalTargets(caster, ability, board)` (Formula F2 of that document) for
   an Ability mode's highlight set, and renders whatever tile set comes back.
   There is no `getActionModes`/`isLegalTarget` query — the action-mode list
   itself (whether the Move slot and/or Ability slot are still available this
   Player Phase) is read directly off the selected unit's `Unit` record
   (per the shared `unit_record`'s slot-used state, `heroes-and-abilities.md`
   Rule 6), not requested as a separate call.
8. **Locked state buffers at most one click.** Input & Selection enters
   Locked whenever **either** of two independent conditions holds: (a) Turn &
   Phase Manager's current phase is not `PlayerPhase`, **or** (b) Board
   Rendering & Juice's `isAnimating()` returns `true` (an animation batch is
   still `Playing` from a just-committed action, even though the phase itself
   is already back to `PlayerPhase`). `isAnimating()` is the authoritative
   signal for the mid-animation half of Locked — Input & Selection polls it
   rather than tracking animation state itself, since Board Rendering & Juice
   is the system that owns and drains the animation queue. While Locked,
   pointer/keyboard commit attempts do not act immediately. Per
   `input_buffer_depth` (default 1), the single most recent click intent is
   remembered and replayed — with a full legality re-check — the instant
   **both** conditions clear (`PlayerPhase` **and** `isAnimating() == false`);
   anything beyond the buffered slot is dropped with an "input rejected" cue
   (Formula 6).
9. **Every click either does something visible or is visibly rejected.** No
   silent no-ops. A click on an invalid target, a click while Locked past the
   buffer, or a click outside the board all produce an explicit, immediate
   visual (and audio) rejection cue — never nothing.
10. **The board's one-occupant invariant makes hit-testing unambiguous.** Since
    Board & Grid guarantees at most one unit per tile, a resolved tile
    coordinate maps to exactly zero or one selectable unit — there is never a
    "which of these overlapping units did you mean" case to design for.

### States and Transitions

| State | Entry Trigger | What Input Does | Exit Transitions |
|---|---|---|---|
| **Idle** | Player Phase starts; deselect; action fully resolves with unit exhausted | Hover highlights the hovered tile/unit (no preview simulation); clicking any unit shows its read-only Inspect panel (see Edge Cases) regardless of side/exhaustion | Click a friendly, acting-eligible unit → **UnitSelected**. Non-Player-Phase begins → **Locked**. |
| **UnitSelected** | Click/select a friendly unit with ≥1 action remaining (Move and/or an unused ability) | Board shows that unit's available action modes (via Battle HUD action bar / hotkeys 1–N, supplied by Heroes & Abilities); hovering other friendly units switches selection directly (Core Rule 4) | Choose an action mode (hotkey or HUD click) → **Targeting**(mode). Click the same unit again, click empty non-target space, or press Esc → **Idle**. Non-Player-Phase begins → **Locked**. |
| **Targeting**(mode = Move \| AbilityId) | Action mode chosen from UnitSelected | Hovering a candidate tile/unit **emits a `hover` event** (tagged with `mode`) that Move Preview subscribes to and renders the returned highlight/consequence from; clicking a tile classified **legal** by the owning system **emits a `confirm` event**, committing the action → **Locked** (animation), then back to **UnitSelected** (unit has actions left) or **Idle** (unit exhausted) | Esc / right-click → **UnitSelected** (emits `cancel`; no Board mutation, Core Rule 6). Commit → **Locked**. Non-Player-Phase begins → **Locked**. |
| **Locked** | Turn & Phase Manager reports the phase is not `PlayerPhase`; OR Board Rendering & Juice's `isAnimating()` is `true` | Clicks/keys are captured per `input_buffer_depth` (Formula 6) but not acted on; hover has no effect (no `hover` events are emitted — nothing to preview against a state that is about to change) | `PlayerPhase` is current **AND** `isAnimating() == false` → replay buffered click (if any) → **UnitSelected** or **Idle** per the outcome. |

**Global, state-independent bindings:** `Tab` / `Shift+Tab` cycle the keyboard
selection focus across friendly acting-eligible units in deterministic board
order (Formula 5) from any state except Locked. `Undo` hotkey (bound, not
owned, here) forwards to Turn & Phase Manager's Player-Phase-scoped `snapshot()`
restore; it is disabled (visibly, not silently) while Locked.

### Interactions with Other Systems

Input & Selection is a **translator**: it reads geometry and legality from
other systems and writes only its own local selection/targeting state (it never
mutates Board, Combat, or Turn state directly).

| System | Reads from / Requests | Writes to Input & Selection | Notes |
|---|---|---|---|
| **Board & Grid** ✅ | `inBounds`, `getOccupant`, `isBlocked` — to validate a resolved tile before treating it as selectable | — | **Hard** dependency, already listed as a hard dependent in `board-and-grid.md`'s Dependencies table. Status: Designed. |
| **Turn & Phase Manager** ✅ | current phase via `getCurrentPhase()` (is it `PlayerPhase`?) — the phase half of the Locked gate (Core Rule 8) | — | **Hard**. Status: Designed. Reconciled against `turn-and-phase-manager.md`'s real query surface (`getCurrentTurn()`/`getCurrentPhase()`); the animation half of Locked does **not** come from this system — see Board Rendering & Juice below. |
| **Move Preview** ✅ | *(none — Move Preview reads Input & Selection, not the reverse)* | subscribes to the `hover`/`select`/`cancel`/`confirm` event stream Input & Selection emits (Core Rule 2); dry-runs `CombatResolution.resolve()` on `board.snapshot()` and displays the result | **Hard**, Status: Designed. Input & Selection is a **silent emitter** — it never calls a `preview()` function and never reads a preview result back; Move Preview owns the subscribe/dry-run/display loop entirely on its own side. |
| **Heroes & Abilities** ✅ | `legalMoveTiles(origin, moveRange, board)` (F1) for the Move mode's highlight set; `legalTargets(caster, ability, board)` (F2) for the Ability mode's highlight set; slot-used/available state off the selected unit's `Unit` record | — | **Hard**, Status: Designed. Reconciled against the real query surface — there is no `getActionModes`/`isLegalTarget`. |
| **Combat Resolution** ✅ | (indirectly, via Heroes & Abilities / Enemy systems) ultimate legality + the commit call that actually mutates Board | — | **Hard**, Status: Designed. Input & Selection never calls Combat primitives directly — always through the owning ability. |
| **Board Rendering & Juice** ✅ | tile size, board screen-origin, camera/zoom state — the concrete values plugged into Formulas 1–2; `isAnimating()` — the animation half of the Locked gate (Core Rule 8) | hover tile, selected unit, targeting highlight set, keyboard-cursor position — so Rendering can draw them | **Hard, bidirectional.** Status: Designed. The screen↔tile transform must be identical on both sides — **flagged as an architecture decision** (shared coordinate-transform module, not duplicated math). Already listed as a **Hard** dependent in `board-rendering-and-juice.md`'s Dependencies table, including the `isAnimating()` interface. |
| **Battle HUD** ✅ | — | selected unit, available action modes, Inspect-panel target (hovered/clicked unit of either side) | **Hard**, Status: Designed. Already listed as a **Hard** dependent in `battle-hud.md`'s Dependencies table ("Selected unit, available action modes, `Inspect` target"). HUD renders whatever Input & Selection reports; Input & Selection never renders UI chrome itself. |
| **Enemy, Abilities & Telegraph** ✅ | (for Inspect mode) enemy unit's telegraphed next action, for read-only display | — | **Soft**, Status: Designed. Input & Selection only forwards "this unit was inspected" — telegraph *content* is that system's. `enemy-abilities-and-telegraph.md` does not yet list Input & Selection as a dependent — see Open Questions. |
| **Settings / Options** | — | (future) key bindings / click-tolerance overrides | **Soft**, future (Alpha tier, system #25). Not implemented in v1; this GDD's tuning knobs are the seed values Settings will eventually expose. |

## Formulas

All are deterministic, synchronous functions of pixel/keyboard input and
current state (no RNG, no simulated network latency). Examples assume a
64px tile size and a board screen-origin of `(32, 32)` (arbitrary HUD-margin
values supplied by Rendering) on the default **8×8** board.

### 1. Screen-to-Tile Mapping
`screenToTile(px, py) = (⌊(px − originX) / tileSize⌋, ⌊(py − originY) / tileSize⌋)`,
valid only if the result satisfies Board's `inBounds` (board-and-grid.md
Formula 1); otherwise the click resolves to `null` (off-board).

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| pointer x | px | float | ≥0, canvas px | Pointer/click x-position in canvas space |
| pointer y | py | float | ≥0, canvas px | Pointer/click y-position in canvas space |
| board origin x | originX | float | canvas px | Board's top-left screen x (owned by Rendering) |
| board origin y | originY | float | canvas px | Board's top-left screen y (owned by Rendering) |
| tile size | tileSize | float | >0, px | Uniform square tile edge length (owned by Rendering) |

**Output:** `(col, row)` integer pair, or `null`. **Example:** `tileSize=64,
origin=(32,32)`, click at `(300,150)` → `col=⌊268/64⌋=4`, `row=⌊118/64⌋=1` →
`(4,1)`; `inBounds(4,1)=true` on 8×8 → resolves to tile `(4,1)`.

### 2. Tile-to-Screen Mapping (center point)
`tileToScreenCenter(col, row) = (originX + col·tileSize + tileSize/2, originY + row·tileSize + tileSize/2)`
— the exact inverse of Formula 1, used to place the keyboard-cursor reticle and
targeting highlights.

**Output:** `(px, py)` in canvas space. **Example:** tile `(4,1)` →
`(32+256+32, 32+64+32) = (320, 128)`.

### 3. Click Precision Tolerance
`isValidClick(down, up) = (euclidean(down.xy, up.xy) ≤ click_tolerance_px) ∧ ((up.t − down.t) ≤ max_click_hold_ms)`

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| pointer-down point | down.xy | (px,py) | canvas px | Position at `pointerdown` |
| pointer-up point | up.xy | (px,py) | canvas px | Position at `pointerup` |
| pointer-down time | down.t | ms | ≥0 | Timestamp at `pointerdown` |
| pointer-up time | up.t | ms | ≥0 | Timestamp at `pointerup` |
| click tolerance | click_tolerance_px | float | 2–15 px (knob) | Max pixel drift still counted as a click, not a drag |
| max hold | max_click_hold_ms | int | 400–800 ms (fixed) | Max hold duration still counted as a click, not a press-and-hold |

**Output:** bool. **Example:** `click_tolerance_px=6`, down `(300,150)`, up
`(303,152)` → `dist=√(9+4)≈3.6 ≤ 6` → `true` → treated as a click; run Formula 1
on the `up` position.

### 4. Keyboard Tile-Cursor Step
`keyboardStep(cursor, dir) = Board.step(cursor, dir)` if `Board.inBounds(result)`,
else `cursor` unchanged (clamped, never wraps — matches Board & Grid's
no-wraparound rule).

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| current cursor tile | cursor | coord | valid tile | Keyboard-selection cursor position |
| direction | dir | enum | {N,S,E,W} (arrow keys) | Requested cursor movement |

**Output:** a valid tile (never OOB). **Example:** cursor `(0,3)`, press West →
raw step `(-1,3)` is OOB → cursor stays `(0,3)` (an edge "thud," not a wrap).

### 5. Deterministic Unit Cycle Order (Tab / Shift+Tab)
`cycleOrder = sort({ acting-eligible friendly units }, by = Board.index(unit.tile) ascending)`
(reuses Board & Grid Formula 5, `index(c,r) = r·W + c`). `Tab` moves to the next
entry cyclically; `Shift+Tab` to the previous.

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| eligible unit set | units | set | 0..N friendly units | Units with ≥1 action remaining this Player Phase |
| board width | W | int | 8 (default) | From Board & Grid |

**Output:** an ordered list, fully determined by current unit positions (no
insertion-order or ID dependence — satisfies Pillar #1's determinism). **Example:**
units at `(2,1)→index 10`, `(5,0)→index 5`, `(0,4)→index 32` on `W=8` cycle as
`(5,0) → (2,1) → (0,4) → wraps to (5,0)`.

### 6. Locked-State Input Buffer
```
onClick(intent):
  if not Locked: handle(intent); return
  if input_buffer_depth == 0: reject(intent); return   # immediate rejection cue
  buffer = intent   # overwrite — last-write-wins, depth is always ≤1 in v1

onUnlock():
  if buffer != empty:
    intent = buffer; buffer = empty
    revalidate(intent)                # target may no longer exist/be legal
    if valid: handle(intent) else: reject(intent)
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| buffer depth | input_buffer_depth | int | 0–1 (knob) | How many click intents survive a Locked period |
| buffered intent | intent | {tile/unit, mode} | — | The click payload replayed on unlock |

**Output:** either a handled action (post-revalidation) or an explicit reject
cue. **Example:** player clicks a tile at the exact moment an enemy's animation
starts (`Locked`); `input_buffer_depth=1` stores it; when Locked clears, the
tile is re-checked — if the acting unit died to the enemy's action in the
interim, revalidation fails and the click is rejected (with cue), never
silently applied to stale state.

## Edge Cases

- **Click resolves off-board (`screenToTile` returns `null`):** if a unit or
  targeting context is active, this is treated as an explicit **cancel/deselect**
  (return to `UnitSelected`→`Idle` or `Targeting`→`UnitSelected`, per Core Rule
  6) — "click empty space to back out" is a standard, expected escape hatch. If
  already `Idle`, it is a true no-op (nothing was selected to cancel).
- **Click on the already-selected unit again:** toggles selection off →
  `Idle` (deselect).
- **Click on a different friendly, acting-eligible unit while `UnitSelected` or
  `Targeting`:** immediately switches selection to the new unit and returns to
  `UnitSelected` for it — no confirmation dialog, since nothing was committed
  (Core Rule 4/6).
- **Click on a friendly unit that has already used all its actions this Player
  Phase:** enters **Inspect** (read-only stat/verb display via Battle HUD) —
  does **not** enter `UnitSelected`; the unit is visibly marked "acted" by
  Battle HUD (non-color cue required, e.g. a checkmark/greyed icon).
- **Click on an enemy unit (any state):** enters **Inspect** (read-only) showing
  its telegraphed next action via Enemy, Abilities & Telegraph — never enters a
  commandable state. This is available even in `Idle`.
- **Click during `Locked`:** handled per Formula 6 — buffered (depth 1) or
  immediately rejected (depth 0); never queued beyond one, never silently
  dropped without a rejection cue when depth is exhausted.
- **`Escape` while `Targeting`:** returns to `UnitSelected`; Board state is
  untouched (nothing was committed) — this is a *free* cancel, distinct from
  Turn & Phase Manager's committed-action Undo.
- **`Escape` while `UnitSelected`:** returns to `Idle` (deselects).
- **`Escape` while `Idle`:** opens the pause/options menu. **PROVISIONAL** —
  Settings/Options (system #25) is undesigned; this is a reserved hook, not an
  implemented behavior in v1's MVP scope.
- **Window/canvas loses focus while `Targeting`:** the active preview is
  cleared (nothing to show against a paused input stream) but the selection and
  target mode **persist** — focus regaining resumes exactly where the player
  left off. The system never auto-cancels on focus loss.
- **Keyboard cursor moved to a tile currently off-screen (camera panned, if
  Rendering ever adds panning):** Input & Selection requests "ensure tile X is
  visible" from Board Rendering & Juice; it does not compute camera scroll
  itself. **PROVISIONAL** — v1 assumes the entire 8×8 board is always visible
  at once with no in-battle camera panning/zoom (matches Pillar #5 and ITB); if
  Rendering later adds panning, this request becomes load-bearing.
- **Two clicks land on the same tile in rapid succession (double-click):** no
  special double-click behavior is defined in v1 — the first click already
  commits (hover-to-preview/click-to-commit model), so a second click lands on
  whatever the *new* state now presents under the cursor and is handled
  normally. No double-click gesture is reserved.
- **Ability requires a target tile, but the unit has no legal targets at all
  (e.g., no enemy in range):** resolved against `legalTargets(caster, ability,
  board)` (F2) returning `∅`. Per `heroes-and-abilities.md`'s UI Requirements,
  the Ability slot itself renders **visibly disabled** while `UnitSelected` —
  `Targeting` is never entered for that ability in the first place, so there is
  no "enter Targeting with zero valid tiles" state to design for. If the board
  changes mid-`Targeting` (e.g. a prior action removed the only legal target),
  every tile now renders as invalid-target styling; clicking anywhere invalid
  is a no-commit rejection (per Core Rule 9) — the player must `Escape` back
  out.
- **`Tab`-cycle is pressed with zero acting-eligible friendly units remaining:**
  no-op with a rejection cue (nothing to cycle to); selection (if any) is
  unaffected.
- **Undo hotkey pressed while `Locked` or outside Player Phase:** disabled and
  visibly indicated as such (e.g., greyed HUD icon) — never silently ignored.
- **Simultaneous mouse hover and keyboard-cursor input:** the two cursors are
  independent visual entities (Visual/Audio Requirements); whichever produces
  the most recent *commit* (click or Enter/Space) wins — there is no "last
  input method locks out the other," since both always operate on the same
  underlying selection state.

## Dependencies

**Upstream (systems Input & Selection depends on):**

| System | Interface Used | Hard / Soft | Status |
|---|---|---|---|
| **Board & Grid** | `inBounds`, `getOccupant`, `isBlocked`, `step` (Formula 4), `index` (Formula 5) | **Hard** | Designed |
| **Turn & Phase Manager** | `getCurrentPhase()` — is the current phase `PlayerPhase`? (the phase half of the Locked gate, Core Rule 8); Player-Phase-scoped `snapshot()` restore for the Undo hotkey | **Hard** | Designed |
| **Heroes & Abilities** | `legalMoveTiles(origin, moveRange, board)` (F1) for the Move mode's highlight set; `legalTargets(caster, ability, board)` (F2) for the Ability mode's highlight set; slot-used/available state off the selected unit's `Unit` record | **Hard** | Designed |
| **Combat Resolution** | (indirect) ultimate legality + the commit call that actually mutates Board, reached only through the owning ability (Heroes & Abilities / Enemy, Abilities & Telegraph) — Input & Selection never calls Combat primitives directly | **Hard** | Designed |
| **Board Rendering & Juice** | `tileSize`, board screen-origin, camera state — plugged into Formulas 1–2; `isAnimating()` — the animation half of the Locked gate (Core Rule 8) | **Hard** | Designed |
| **Enemy, Abilities & Telegraph** | telegraphed-action data for Inspect display | **Soft** | Designed |

Move Preview is intentionally **not** in this upstream table: Input & Selection
never calls into Move Preview (no `preview()` call, no return value read back)
— Move Preview only subscribes to the event stream Input & Selection emits.
See the Downstream table below.

**Downstream (systems that depend on Input & Selection):**

| Dependent System | Interface (what it uses) | Hard / Soft |
|---|---|---|
| **Board Rendering & Juice** | hover tile, selected unit, targeting highlight set, keyboard-cursor position — to draw them | **Hard** |
| **Battle HUD** | selected unit, available action modes, Inspect target | **Hard** |
| **Move Preview** | the hover/target event stream that triggers each preview request | **Hard** |
| **Settings / Options** *(Alpha tier)* | key bindings, click-tolerance overrides | **Soft**, future |
| **Accessibility** *(Alpha tier)* | confirmation of full keyboard-only operability; hooks for input remapping | **Soft**, future |

**Bidirectional-consistency note:** All five upstream systems above are
Status: Designed and were re-read this pass to confirm both sides agree.
Board & Grid already lists `Input & Selection` as a hard dependent with
interface "screen↔tile coordinate mapping, `inBounds`, `getOccupant`" — this
document's Board & Grid row matches that entry. Board Rendering & Juice
already lists `Input & Selection` as a hard, bidirectional dependent,
including the `isAnimating()` interface. Battle HUD already lists Input &
Selection's outputs ("Selected unit, available action modes, `Inspect`
target") in its own Dependencies table. `enemy-abilities-and-telegraph.md`
does **not** yet list Input & Selection as a downstream dependent — this is
the one remaining gap, tracked below in Open Questions rather than blocking
this GDD (the dependency is Soft and one-directional in intent: Input only
forwards "this unit was inspected").

## Tuning Knobs

| Knob | Default | Safe Range | Too Low | Too High |
|---|---|---|---|---|
| `click_tolerance_px` | 6 px | 2–15 px | Frustrating misses on small hero sprites, especially at lower zoom | Accidental wrong-tile selection on a dense board; erodes the "perfect blame" trust (Pillar #1) if a misclick reads as intentional |
| `hover_debounce_ms` | 50 ms | 0–150 ms | Preview recomputes on every pixel of pointer movement — visual flicker and unnecessary load on Move Preview's `snapshot()` path (board-and-grid.md perf budget: `snapshot()` < 1ms/call is already the highest-risk op) | Preview feels laggy behind the cursor — breaks the "instant" trust central to Pillar #1 |
| `max_click_hold_ms` | 600 ms | 400–800 ms | Legitimate slightly-slow clicks (e.g. trackpad users) misclassified as press-and-hold/drag | Genuine drag gestures misclassified as clicks |
| `input_buffer_depth` | 1 | 0–1 | `0`: every click during any animation is dropped — safer (never surprises the player) but can feel unresponsive during longer resolution chains | Hard-capped at 1 — queuing multiple actions during `Locked` would let the player commit to a decision made against stale (pre-resolution) information, directly violating Pillar #1 |
| `keyboard_repeat_delay_ms` | 300 ms | 150–500 ms | Cursor jitters/double-steps on a single tap | Keyboard-only players (accessibility-critical, since this is their *only* movement method) feel the game is unresponsive |
| `keyboard_repeat_rate_ms` | 100 ms | 50–200 ms | Held-arrow cursor movement overshoots the intended tile constantly | Cursor crawls too slowly across an 8×8 board, a real friction point for keyboard-only completion time |
| `require_confirm_click` | `false` | bool | — | `true` adds an explicit second confirm step (click-to-lock-target, then Enter/second-click to commit) — recommended as an opt-in **accessibility** setting for players prone to misclicks/tremor, traded against the default's speed |
| `tab_cycle_order` | `board-index` | enum {`board-index`} | — | Fixed to `board-index` (Formula 5) in v1 — must stay a deterministic, position-derived order (not insertion/spawn order) to satisfy Pillar #1; not exposed as a real choice, listed here only to document the constraint |

**Interactions between knobs:** `hover_debounce_ms` and Move Preview's
`snapshot()` performance budget are coupled — if Move Preview's per-call cost
ever exceeds board-and-grid.md's documented `<1ms` budget (e.g. on a larger
board via the `grid_width`/`grid_height` knobs), `hover_debounce_ms` must be
raised to keep combined per-frame cost under the `<2ms` board budget, at the
cost of feeling less instant. `require_confirm_click=true` and
`input_buffer_depth` interact during Locked periods: a buffered "first click"
under the confirm-click model only *arms* the target, it does not commit — the
buffer replay must still require the second confirm after unlock, not
auto-commit on the player's behalf.

## Visual/Audio Requirements

*(Detailed visual style deferred to art-director / Board Rendering & Juice;
these are the functional requirements Input & Selection imposes on that
system.)*

**Visual — every state must be legible without relying on color alone:**
- **Hover highlight**: hovered tile's border thickens/brightens (a shape
  change, not only a color fill) — distinct from selection and targeting
  highlights.
- **Selection indicator**: the selected unit's tile gets a persistent
  non-color cue (e.g. animated corner brackets or a pulsing outline shape), so
  colorblind players and monochrome/high-contrast modes can still identify the
  selected unit.
- **Valid-target vs invalid-target highlight**: differentiated by **icon**, not
  only color — e.g. a reticle/checkmark glyph for legal targets vs. a
  slashed-circle glyph for illegal ones, satisfying "functional without
  reliance on color alone."
- **Keyboard-cursor reticle**: a separate, always-visible on-screen marker
  distinct from the mouse-hover highlight, so keyboard-only players always
  know their current cursor tile without needing the mouse.
- **Acted/exhausted unit marker**: a non-color icon (e.g. greyed checkmark) on
  units with no actions remaining, consumed by Battle HUD/Rendering.
- **Rejection cue**: any rejected input (Edge Cases list) produces an
  immediate, brief visual response (e.g. a short shake/flash on the cursor or
  target tile) — never nothing.
- No flashing content exceeds standard safe thresholds (no strobing feedback
  effects) — a hard accessibility constraint on any "rejection" or "commit"
  flourish.

**Audio — every audio cue is paired with a simultaneous visual cue (never
audio-only feedback):**
- Hover-enter: soft, low-volume tick.
- Selection confirm: a light confirm chime, distinct from commit.
- Invalid-click / rejection: a soft "denied" buzz.
- Action commit: deferred to Audio System (system #20) / Combat Resolution's
  event hooks — Input & Selection only guarantees the *event* fires, not the
  specific sound.
- Cancel: a soft descending tick, distinct from rejection (cancel is a valid,
  expected action; rejection is a mistake).
- All cues are short (<150 ms) and non-overlapping with dialogue/narration
  needs (none exist in this system) — consistent with the "clarity over
  spectacle" art direction.

## Acceptance Criteria

All criteria are deterministic and independently testable (unit tests for the
state machine/formulas; a manual keyboard-only walkthrough doc for full-flow
accessibility criteria, per the project's UI test-evidence tier). Default board
**8×8**, `tileSize=64`, `origin=(32,32)` unless stated.

**Screen↔tile mapping (Formulas 1–2)**
- **GIVEN** `tileSize=64, origin=(32,32)`, **WHEN** `screenToTile(300,150)`,
  **THEN** it returns `(4,1)`.
- **GIVEN** the same setup, **WHEN** `tileToScreenCenter(4,1)` is called on the
  result of the prior test, **THEN** it returns `(320,128)` (round-trip
  consistency between Formulas 1 and 2, up to the tile-center offset).
- **GIVEN** a pixel position outside the board's pixel bounds, **WHEN**
  `screenToTile`, **THEN** it returns `null` and no selection state changes.

**Click precision (Formula 3)**
- **GIVEN** `click_tolerance_px=6`, pointerdown at `(300,150)` and pointerup at
  `(303,152)` within `max_click_hold_ms`, **WHEN** `isValidClick`, **THEN**
  `true`.
- **GIVEN** the same tolerance, pointerup at `(320,170)` (dist > 6),
  **WHEN** `isValidClick`, **THEN** `false` (not treated as a commit click).

**Selection state machine**
- **GIVEN** `Idle` state, **WHEN** the player clicks a friendly acting-eligible
  unit, **THEN** state becomes `UnitSelected` for that unit.
- **GIVEN** `UnitSelected`, **WHEN** the player clicks the same unit again,
  **THEN** state returns to `Idle` (deselect toggle).
- **GIVEN** `UnitSelected` for unit A, **WHEN** the player clicks a different
  friendly acting-eligible unit B, **THEN** state becomes `UnitSelected` for B
  (no confirmation prompt, immediate switch).
- **GIVEN** `Targeting`(Move) for a selected unit, **WHEN** `Escape` is
  pressed, **THEN** state returns to `UnitSelected` and Board state is
  byte-identical to before `Targeting` was entered (nothing committed).
- **GIVEN** `Targeting`(mode) with a hovered legal target tile, **WHEN** a
  valid click (Formula 3) lands on that tile, **THEN** the action commits,
  state transitions to `Locked`, and (after resolution) to `UnitSelected` or
  `Idle` depending on remaining actions.

**Locked-state buffering (Formula 6)**
- **GIVEN** `Locked` and `input_buffer_depth=1`, **WHEN** the player clicks a
  tile, **THEN** the click is stored (not acted on) and no Board mutation
  occurs during `Locked`.
- **GIVEN** a buffered click exists and the game unlocks, **WHEN** the buffered
  target is re-validated and found still legal, **THEN** it is handled exactly
  as if clicked in real time.
- **GIVEN** a buffered click exists and the game unlocks, **WHEN** the buffered
  target is re-validated and found no longer legal (e.g. target unit removed),
  **THEN** it is rejected (with the rejection cue) and no action is taken.
- **GIVEN** `input_buffer_depth=0` and `Locked`, **WHEN** the player clicks,
  **THEN** the click is rejected immediately with a visible cue, and nothing is
  buffered.

**Keyboard-only operability (accessibility)**
- **GIVEN** the game in `Idle` with ≥1 acting-eligible unit, **WHEN** the
  player presses `Tab` repeatedly with no mouse input at all, **THEN** the
  keyboard focus visits every acting-eligible unit exactly once per full cycle,
  in the deterministic order of Formula 5.
- **GIVEN** a unit is keyboard-selected, **WHEN** the player uses arrow keys to
  move the tile cursor and presses `Enter` on a legal target tile, **THEN** the
  action commits identically to a mouse click on that tile.
- **GIVEN** the keyboard cursor at an edge tile, **WHEN** an arrow key would
  step it off-board, **THEN** the cursor does not move (Formula 4) and no error
  state occurs.
- **GIVEN** a full Player Phase (select every eligible unit, choose and commit
  one action each), **WHEN** performed with keyboard input only (no mouse
  events), **THEN** the phase completes to `EndCheck` exactly as a mouse-driven
  Player Phase would (full-flow accessibility walkthrough — manual evidence per
  project testing standards for UI stories).

**Non-Player-Phase gating**
- **GIVEN** the current phase is not `PlayerPhase` (per Turn & Phase Manager),
  **WHEN** any click or key commit is attempted, **THEN** the system is in
  `Locked` and Formula 6's buffering rule applies — no direct commit occurs.

## Open Questions

**Needs an architecture decision (→ ADR during `/create-architecture`):**

1. **Shared screen↔tile transform.** Formulas 1–2 must be implemented
   identically by Input & Selection and Board Rendering & Juice (same
   `tileSize`/`origin`/camera values) or clicks will silently misregister
   against what the player sees highlighted. *Proposed:* a single shared
   coordinate-transform module both systems import, not two independent
   implementations. *Owner:* Tech architecture — both `input-and-selection.md`
   and `board-rendering-and-juice.md` are now Designed and already agree on
   Formulas 1–2's shape; the ADR only needs to pick the shared-module
   implementation pattern, not resolve a design gap.
2. **`enemy-abilities-and-telegraph.md` doesn't list Input & Selection as a
   downstream dependent yet.** This GDD's Interactions table already declares
   the Soft, one-directional edge (Input forwards "this unit was inspected";
   telegraph content is that system's). *Owner:* flag via `/consistency-check`
   or fold into that system's next revision pass.

**Resolved this session (provisional defaults — confirm during implementation):**

- **Turn & Phase Manager's exact phase/lock API** is confirmed as
  `getCurrentPhase()` (`turn-and-phase-manager.md`); the animation half of the
  Locked gate does **not** come from Turn & Phase Manager at all — it comes
  from Board Rendering & Juice's `isAnimating()` (Core Rule 8,
  `cross-system-contracts.md` §7). Both dependency GDDs were re-read this pass
  and reconciled — see the Dependencies table above.
3. **Double-click** has no reserved meaning in v1 (see Edge Cases) — simplest
   option given the hover-to-preview/click-to-commit model already needs only
   one click to act.
4. **Camera panning** is assumed absent in-battle (whole 8×8 board always
   visible) — if Board Rendering & Juice later adds pan/zoom, the "ensure tile
   visible" request (Edge Cases) becomes load-bearing and this assumption must
   be revisited.
5. **`Escape` in `Idle`** is reserved for a future pause/options menu hook but
   not implemented in MVP scope.

**Deferred to the owning system's GDD:**

6. **Ability targeting shapes (line, AoE, cone).** Input & Selection only
   forwards a candidate tile and asks "is this legal" — it does not define
   targeting geometry. *Owner:* Heroes & Abilities.
7. **Move/ability action-ordering rules per unit** (can a unit use its ability
   before moving, after, or is one exclusive with the other). Assumed
   "flexible order, each usable once" for this GDD's state machine, but not
   confirmed. *Owner:* Heroes & Abilities / Combat Resolution.
8. **Gamepad support.** Explicitly out of scope for v1 per this system's brief
   ("Web pointer+keyboard selection"); the state machine is designed so a
   future gamepad mapping (D-pad = keyboard-cursor equivalent, A = commit, B =
   cancel) could reuse it without rework, but no gamepad-specific bindings are
   defined now. *Owner:* revisit if a platform target changes.
9. **Touch support.** Out of scope for v1 (target platform is PC web browser).
   The hover-to-preview model has no direct touch equivalent (no hover on
   touch); if touch is added later, `require_confirm_click`'s two-step pattern
   is the natural fallback (tap = preview/arm, tap again = commit). *Owner:*
   revisit if a platform target changes.
10. **Settings/Options key-remapping UI.** This GDD defines default bindings
    and tuning-knob seed values only; the remapping interface itself belongs to
    system #25 (Alpha tier). *Owner:* Settings / Options.
