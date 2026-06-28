# Penalty-winner flag in "Everyone's picks"

**Date:** 2026-06-28
**Status:** Approved

## Problem

When a player predicts a level knockout scoreline (e.g. 1–1), they also pick which
team they think advances on penalties. That choice is stored in
`predictions.winner_side` (`'home' | 'away' | null`, added in migration
`0025_knockout_winner.sql`) and is shown on the player's own prediction
(`WinnerPicker` / `AdvancerBadge`), but it is **not** surfaced on the
"Everyone's picks" leaderboard. So when looking at a tie pick on someone else's
card (e.g. Canada vs South Africa), you can't tell who they backed to go through.

## Goal

On the "Everyone's picks" board, show the predicted advancer's team flag next to a
level-scoreline knockout pick. Display format (user-chosen): score + team flag,
no "P" / "pens" label, e.g. `1–1 🇨🇦` rendered with a rectangular `fi` flag icon.

## Changes

All changes are in `src/components/MatchDetail.tsx` plus a one-field type addition.
No DB, scoring, or query-side changes beyond selecting an existing column.

### 1. Fetch `winner_side`

`PeoplePredictions` (`MatchDetail.tsx:39-48`) currently selects:

```
id,home_pred,away_pred,points_awarded, players(name,flag_code,avatar_url)
```

- Add `winner_side` to the select clause.
- Add `winner_side: r.winner_side ?? null` to the `PeoplePick` row mapping.
- Add `winner_side?: 'home' | 'away' | null` to the `PeoplePick` type definition.

### 2. Render the winner flag

Add a small presentational helper in `MatchDetail.tsx`. The winning team's flag
code comes from the match (`home_code` / `away_code`), which are the ISO codes the
app already uses with `fi fi-{code}`:

```tsx
function WinnerFlag({ side, match }: { side?: 'home' | 'away' | null; match: Match }) {
  if (!side) return null
  const code = side === 'home' ? match.home_code : match.away_code
  if (!code) return null
  return (
    <span
      className={`fi fis fi-${code} !w-[18px] !h-[12px] bg-cover border border-ink/20 inline-block align-middle ml-1`}
      aria-label="advances on penalties"
    />
  )
}
```

Render it immediately after the predicted score in all three board states:

- **scored** — after the score span at `MatchDetail.tsx:142`
- **live** — after the score at `MatchDetail.tsx:158`
- **locked** — after the score at `MatchDetail.tsx:164`

The flag may need a slightly different inline size in the small scored-tier text
vs. the larger live/locked display score; size is tuned per call site if needed,
but the same helper is used everywhere.

### 3. Guard

`WinnerFlag` returns `null` when `side` is falsy. `winner_side` is only ever set
for level knockout scorelines, so no extra stage / `home_pred === away_pred` check
is required — a non-tie pick simply has no `winner_side`.

## Out of scope (YAGNI)

- No database, migration, or scoring changes — the data already exists.
- No change to live ranking / projected-points logic.
- No "pens" / "P" text label — flag only, per the chosen format.
- No Unicode flag emoji — uses the rectangular `fi` flag icon for consistency with
  `WinnerPicker` and `AdvancerBadge`.

## Verification

- A finished/locked knockout match where at least one player picked a level
  scoreline shows the backed team's flag next to that pick; non-tie picks show no
  flag.
- Group-stage matches (no `winner_side`) are unaffected.
- The flag matches the correct side (`home_code` vs `away_code`).
