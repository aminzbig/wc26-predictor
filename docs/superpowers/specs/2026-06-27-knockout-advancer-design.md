# Knockout advancer ("who goes through") picker — design

## Context & goal

Knockout matches cannot end in a draw, but a player can still predict a level
scoreline (e.g. 1–1). Today there is no way to say which team advances on
penalties. This feature adds a per-prediction **advancer** choice that appears
only when a knockout prediction is a tie, on both the deck card (`MatchCard`) and
the expanded view (`MatchDetail`). The pick is captured and displayed; it does
**not** change scoring yet.

Approved interactively via a working HTML prototype
(`scratchpad/knockout-advancer-prototype.html`).

## Decisions (locked)

- **Scoring:** Capture & persist the pick now. **No** change to `recompute_match`
  or `src/lib/scoring.ts`. A scoring bonus can be layered on later.
- **Placement:** A band the same width/height as the name bar that **slides up
  from behind `TeamNameBar`**, split `home | away`, sitting just above the names.
- **Nudge:** Soft only — shimmer/pulse on the band until a side is chosen; never
  blocks; the score still auto-saves.
- **Detail view:** In addition to the picker band, the chosen advancer is
  surfaced as a **match-winner badge** ("🏆 <Team> to advance") under "Your
  prediction", with a "▲ pick who advances" nudge shown while a tie has no pick.
- **Gesture:** Tap selects; a swipe (pointer travel > 10px) passes through to the
  deck drag / modal scroll — identical to the score-number behavior in
  `FlagPanel`.
- **Copy:** Band caption "WHO ADVANCES?" → "✓ <ABBR> GOES THROUGH" once chosen.
- **Highlight:** Chosen side fills solid **yellow** (`#ffd200`) with ink text.

## Data model

New nullable column on `predictions` (migration `0025_knockout_winner.sql`):

```sql
alter table predictions
  add column if not exists winner_side text
  check (winner_side in ('home','away'));
```

Stored as the **side** (`'home'`/`'away'`), not a team code, because early-round
knockout slots have no resolved `home_code`/`away_code` at prediction time (labels
like `1A`). This mirrors how `home_pred`/`away_pred` are side-based. Existing RLS
on `predictions` (owner insert/update) already covers the new column; no policy
change. No re-score / no `recompute_match` change.

## Types

`src/lib/types.ts` — extend `Prediction`:

```ts
winner_side?: 'home' | 'away' | null
```

## Persistence

`src/hooks/usePredictions.ts` — `save(matchId, hp, ap, winnerSide?)`:

- When `winnerSide` is provided (incl. `null`), include `winner_side` in the
  upsert payload; when omitted, leave the column untouched (so a plain score save
  preserves an existing pick).
- Both cards fold the choice into their existing debounced auto-save effect (one
  write), keyed on `[hp, ap, winner]`. Tapping a side on a fresh `0–0` saves
  `0–0 + side` (an explicit action ⇒ counts as touched).

Thread the extra arg through `MatchDeck` (`onSave`) and `Matches` (`save`).

## Shared component & helper (`src/components/matchFace.tsx`)

### `useTapNotSwipe(onTap)`
Extract the existing tap-vs-swipe logic from `FlagPanel` into a small hook
returning `{ onPointerDown, onPointerMove, onClick }`. `FlagPanel` is refactored
to use it (behavior unchanged) so the picker and the score number stay in sync.
`SWIPE_PX = 10`. On a confirmed tap: `stopPropagation()` + run `onTap`.

### `WinnerPicker`
Props: `{ homeLabel, awayLabel, homeCode, awayCode, value, editable, onChange }`
where `value: 'home' | 'away' | null`.

- Rendered **inside the flags container** (which is `relative overflow-hidden`),
  absolutely pinned to the bottom (`absolute inset-x-0 bottom-0`), full width,
  above `TeamNameBar`.
- Slide via framer-motion: hidden = `translateY(110%)` (behind the name bar),
  shown = `translateY(0)`. Driven by `AnimatePresence`/`animate` on a `visible`
  prop computed by the parent.
- Two halves (`home | away`): mini flag + 3-letter abbr (`abbr3`), centered, with
  a card-colour center divider matching the name bar. Chosen side: `bg-yellow
  text-ink` + a ▸/◂ mark; other side dimmed. Caption strip on top.
- **Attract** (only `editable && tie && value == null`): gloss sweep + pulsing
  yellow inset ring (new CSS, modeled on `.booster-shine`). Stops once chosen.
- Each half uses `useTapNotSwipe` so a swipe passes through and a tap selects.
- When `!editable`: read-only — show the chosen side highlighted, no shimmer, not
  tappable; render nothing interactive.

## Visibility / trigger rule (computed by each card)

Show the picker whenever `stage !== 'group'` AND the prediction is a tie:
`showPicker = isKnockout && tie` where
`tie = homeNum != null && awayNum != null && homeNum === awayNum`.

This deliberately includes the **default 0–0** on a freshly opened knockout card
(editable ⇒ `homeNum`/`awayNum` come from live `hp`/`ap`, which start at 0) so the
player is always prompted to pick who advances — a knockout can't end level. For a
locked/finished card the `tie` check naturally requires a real saved prediction,
since `homeNum` is `null` without one. When the score becomes decisive the band
slides down; the stored `winner_side` is kept (ignored while decisive) so flipping
back to a draw restores the choice. (Tapping a side sets `touched`, so the pick
persists; merely viewing the default 0–0 without interacting saves nothing.)

## States

- **open (editable):** interactive; slides up on a tie; shimmer until chosen.
- **locked / live:** read-only; if a tie was predicted, show the chosen side
  highlighted (no shimmer). If no pick was made, show a neutral "no advancer
  picked" treatment.
- **finished:** read-only display of the pick. No right/wrong styling (scoring
  not wired) — natural extension point later.

## MatchCard (deck) integration

- Add `winner` state (init from `prediction?.winner_side ?? null`), synced in the
  existing prediction→state effect.
- Render `<WinnerPicker>` inside the existing flags container, above
  `TeamNameBar`. Compute `visible`/`editable` per the rule above.
- Extend the auto-save effect to include `winner` (payload `winner_side`).
- Bottom status line reflects the tie state ("Draw predicted · choose who goes
  through" / "Draw → <Team> to advance").

## MatchDetail integration

- Same `WinnerPicker` inside its flags container.
- **Winner badge:** in the existing "Your prediction" block, when knockout & tie &
  a side chosen, render a boxed badge `🏆 <flag> <Team> to advance` (ink/yellow,
  `border-[3px] border-yellow`, mirrors the existing points badge styling). While
  a tie has no pick, show "▲ Pick who advances" in yellow instead.
- Extend the auto-save effect identically.

## CSS (`src/index.css`)

Add keyframes for the band attract treatment:
- `wp-shine` — skewed white gloss sweep across the choices (~2.7s, plays then
  idles), gated by a `needs-pick` class.
- `wp-pulse` — pulsing yellow inset ring on the band (~1.7s).
- Both disabled under `prefers-reduced-motion: reduce`; the slide transition also
  collapses to none there.

## Scope

**In:** `MatchCard`, `MatchDetail`, `matchFace.tsx` (`WinnerPicker` +
`useTapNotSwipe`), `MatchDeck`, `Matches`, `usePredictions`, `types.ts`,
migration `0025`, `index.css`.

**Out:** `MatchGrid`/`MatchTile` (small grid tiles), the Standings
`KnockoutBracket` (projects from real results, not picks), and any scoring change.

## Testing (TDD)

- `usePredictions.save` includes `winner_side` when provided; omits it otherwise.
- `WinnerPicker`: visible only under the trigger rule; tap a side calls
  `onChange` with that side; a simulated swipe (pointermove > 10px then click)
  does **not** call `onChange`; chosen side gets the highlight class;
  `!editable` renders read-only (no `onChange` on tap).
- `MatchCard`/`MatchDetail`: a knockout tie shows the picker; a decisive score
  hides it; choosing a side triggers a save carrying `winner_side`.
- `MatchDetail`: the winner badge appears with the chosen team when knockout +
  tie + pick.

## Non-goals / future

- Awarding points for a correct advancer (would need a `recompute_match` change,
  a client mirror update, and a re-score).
- Showing the pick in `MatchGrid` tiles or comparing it against the real result
  on finished games.
