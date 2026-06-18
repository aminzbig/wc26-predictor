# Social bottom-docked glass composer

**Date:** 2026-06-17
**Status:** Approved (design)

## Goal

Replace the tall inline composer at the top of the Social feed with a slim,
glass **pill docked at the bottom** (above the nav) that:

1. Slides up from behind the bottom nav on entry ("comes out up").
2. Expands upward into the full editor (colors / fonts / size / tag) on tap,
   dimming the feed behind it; collapses on tap-out / Esc / post.
3. Auto-hides on scroll down and re-reveals on scroll up (Instagram-style), so
   it never occludes the feed while reading.
4. Uses the same glass material as the bottom nav.

## Non-goals

No changes to posting logic, the feed, reactions, or `src/lib/social.ts`. The
composer's form state and `onPost` contract are preserved.

## Current state

- `App.tsx` `Shell`: fixed-height (`h-[100dvh]`) flex column. The inner
  `<div className="flex-1 overflow-y-auto …">` is the **only** scroll container
  (the document body does not scroll). `<BottomNav>` floats over it as an
  `absolute` glass dock (`bg-paper/65 backdrop-blur-xl border-[3px] border-ink`,
  `bottom-[calc(env(safe-area-inset-bottom)+24px)]`, `z-50`).
- `Social.tsx`: renders `<SocialComposer>` inline at the top of the feed, then
  the feed cards. The composer scrolls away with content.
- `SocialComposer.tsx`: tall panel — textarea, 6 color swatches, 6 font chips,
  size picker, "＋ Tag match" toggle + `<select>`, char counter, Post button.
  Holds local state: `body`, `color`, `font`, `scale`, `matchId`, `pickMatch`.

## Design

### Material & layout

The floating composer reuses the nav's glass recipe:
`bg-paper/65 backdrop-blur-xl supports-[backdrop-filter]:bg-paper/55`,
`border-[3px] border-ink`, `shadow-[0_12px_30px_-8px_rgba(20,18,16,0.5)]`.

It is positioned `fixed`, centered to the app column
(`left-1/2 -translate-x-1/2 w-full max-w-md px-4`) so it matches the `max-w-md`
Shell on wide screens. `fixed` is safe here because only the inner div scrolls,
not the document. It sits just above the nav, anchored with
`bottom-[calc(env(safe-area-inset-bottom)+24px+<nav height>)]` (a single
computed offset so the pill rests directly above the dock).

### Collapsed state (pill)

One row on the glass — the whole pill is a single "tap to compose" target:
- Left: muted prompt text "Share something with the group…".
- Right: a pencil/compose icon as an affordance hint.

The **Post** button appears only in the expanded state (keeps the collapsed
pill clean). Tapping anywhere on the collapsed pill expands the editor.

Entrance animation: `initial={{ y: 80, opacity: 0 }}` →
`animate={{ y: 0, opacity: 1 }}` (spring), so it rises from behind the nav.

### Expanded state (editor)

Tapping the pill expands it **upward** into the full editor: auto-focused
textarea + color swatches + font chips + size picker + "＋ Tag match" +
char counter + Post — the existing controls, unchanged in behavior.

- A scrim `<div className="fixed inset-0 bg-ink/30">` dims the feed behind.
- Collapse triggers: tap scrim, press Esc, or successful post (which also
  clears the draft, per existing `submit()`).
- Framer-motion animates the expand (height/translate) and the controls
  fade+slide in via `AnimatePresence`.

Z-order: collapsed pill `z-40` (below nav `z-50`, so it tucks behind the dock
when hiding); when expanded, scrim + editor lift above the nav (`z-[55]`/
`z-[60]`) for a focused compose mode.

### Scroll auto-hide

New hook `useScrollDirection(scrollRef)` attaches a `scroll` listener to the
Shell's scroll container and returns a `hidden` boolean:

- `scrollTop <= 8px` → always shown (at top of feed).
- scrolling **down** past a small threshold → hidden.
- scrolling **up** → shown.
- While the composer is expanded → auto-hide suspended (always shown).

Hidden = `translateY` down + fade + `pointer-events-none`, tucking behind the
nav.

### Keyboard handling (mobile)

When the textarea is focused, the on-screen keyboard can cover a `fixed` bottom
element. Use the `visualViewport` API: on `resize`/`scroll` of
`window.visualViewport`, offset the expanded composer up by the keyboard height
(`window.innerHeight - visualViewport.height - visualViewport.offsetTop`,
clamped ≥ 0) so it stays above the keyboard. Collapsed pill keeps its normal
safe-area offset.

### Plumbing

1. **`App.tsx` `Shell`** — add a `ref` to the scroll `<div>`; create a tiny
   `ScrollContext` (holding the scroll element ref) and wrap `{children}` in its
   provider. Generic and harmless to other screens.
2. **`ScrollContext`** — new small module exporting the context + a
   `useScrollContainer()` hook.
3. **`Social.tsx`** — stop rendering the inline `<SocialComposer>` at the top;
   render the floating composer instead (it reads the scroll ref from context).
   Add a bottom spacer so the last card clears the pill.

## Components

- `SocialComposer.tsx` (reworked): floating glass pill + expand/collapse +
  scrim + entrance + keyboard offset. Preserves form state and the `onPost`
  signature `(body, color, font, scale, matchId)`.
- `useScrollDirection(scrollRef)`: returns whether the pill should hide.
- `ScrollContext` / `useScrollContainer()`: exposes the Shell scroll element.
- `App.tsx` `Shell`: scroll ref + provider.
- `Social.tsx`: drop inline composer, render floating, add bottom spacer.

## Testing

- Unit test `useScrollDirection` direction/threshold logic with a mocked scroll
  target (down → hidden, up → shown, at-top → shown, expanded → never hidden).
- Manual: entrance slide-up; expand dims feed; tap-out / Esc / post collapse and
  clear; scroll down hides, scroll up reveals; keyboard does not cover textarea
  on a real device.

## Risks

- `visualViewport` keyboard offset is the main mobile risk; verify on a device.
- `fixed` centering must match `max-w-md` so the pill aligns with the column on
  desktop.
