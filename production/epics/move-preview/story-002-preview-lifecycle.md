# Story 002: Preview Event Subscription & Lifecycle

> **Epic**: Move Preview
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/gdd/move-preview.md`
**Requirement**: `TR-PREVIEW-002`, `TR-PREVIEW-003`

**ADR Governing Implementation**: ADR-0002: Deterministic synchronous event bus
**ADR Decision Summary**: VANGUARD's simulation core must be byte-for-byte reproducible so that move preview, undo, and full-run replay all agree with committed play.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Snapshot must be captured only AFTER an action's entire consequence chain resolves (for commits, but Move Preview drives its own snapshot)
- Forbidden: Preview dry-run events must never be published onto the shared event stream
- Forbidden: Event Bus handlers must not defer (no Promise/microtask/setTimeout/rAF)

---

## Acceptance Criteria

*From GDD `design/gdd/move-preview.md`, scoped to this story:*

- [ ] Silent and subscription-based: subscribes to Input & Selection's hover/select/cancel/confirm events; dry-run events NEVER reach the shared event stream.
- [ ] Snapshots the live board on every hover; t_preview = t_snapshot + t_resolve + t_diff ≤ 5 ms.

---

## Implementation Notes

*Derived from ADR-0002, ADR-0001, ADR-0007 Implementation Guidelines:*

- Listen to hover/select/cancel/confirm from Input & Selection.
- Ensure that the dry run's events are locally consumed to generate the visual diff and never `emit()` onto the global synchronous event bus.
- Manage the state transitions: Idle → Computing → Ready → Stale / Discarded / Committed.
- Cancel transitions to Discarded, leaving the board untouched.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 001: The core `resolve(board.snapshot())` execution logic.
- Story 003: Threat overlay logic.

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `tests/integration/move-preview/preview-lifecycle_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001
- Unlocks: Story 003
