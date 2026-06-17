# Live Projected Picks ("Halo" mode) — Design

**Date:** 2026-06-17
**Status:** Approved (pending spec review)
**Area:** `src/components/MatchDetail.tsx` — "Everyone's picks" board

## Problem / Idea

While a match is **live**, the "Everyone's picks" board is locked and visible but inert —
it just lists each person's predicted score with no sense of how they're doing. The user
wants the board to come alive during the game: show, in real time, **how many points each
person *would* get if the match ended at the current live score**, sort everyone by that
projected total, and animate the reordering as goals go in. The whole board should carry a
soft glowing "halo" treatment whose meaning is **"this score is not finalized — it's still
moving."** When the match reaches Full-Time, the halo settles into the existing solid final
leaderboard.

## Goals

- During a live match, compute each pick's **projected points** from the current live score.
- Sort the board by projected points (desc), tie-break by name (matches finished behavior).
- **Animate** rows to their new positions when projections change (re-sort on each update).
- Apply a "halo" / provisional visual treatment that reads as **not finalized**.
- On Full-Time, transition cleanly into the existing final leaderboard (no regression).

## Non-Goals (YAGNI)

- No new data pipeline. Live scores already arrive via the `useMatches` realtime channel;
  the `match` prop re-renders on every `live_home`/`live_away` change.
- No `risky` bonus in the live projection. `risky` depends on the whole field's prediction
  distribution and is computed server-side at Full-Time; live projection passes `risky=false`
  (consistent with the standalone-preview default in `scoring.ts`).
- No changes outside `MatchDetail.tsx` / the picks board. Not touching `MatchCard`,
  `MatchTile`, scoring SQL, or the `tick` function.
- No persistence of projected points — they are derived, ephemeral, recomputed on render.

## Existing pieces we reuse

- **Scorer:** `basePoints(p: {hp,ap}, r: {hs,as}, pts?, risky?)` in `src/lib/scoring.ts`.
  Works on *any* result, so we feed it the live score. Already mirrors the server formula.
- **Multiplier:** `match.multiplier` — final points are `basePoints × multiplier` server-side,
  so the projection multiplies too, for parity with what the final figure will show.
- **Tier:** `resultTier(hp, ap, hs, as)` already defined in `MatchDetail.tsx` — reuse against
  the live score to label each pick (Exact / Goal diff / Outcome / Missed) live.
- **Animation:** `framer-motion` is already imported and used in `PicksBoard`.

## Live detection

A match is in **live mode** for this board when it is not finished but has live data:

```
const live = match.status !== 'finished' && match.live_status != null
             && match.live_home != null && match.live_away != null
```

The board therefore has three states:
- **locked, pre-kickoff** (`!live && !scored`): current behavior — list picks, no points.
- **live** (`live`): NEW — projected points, sorted, animated, halo treatment.
- **finished** (`scored`): current behavior — final leaderboard.

`PeoplePredictions` already renders whenever `matchState(match) !== 'open'`, which covers the
live window, so no gating change is needed there.

## Mechanic

In `PicksBoard`, when `live` is true:

1. For each row compute
   `proj = Math.round(basePoints({hp: home_pred, ap: away_pred}, {hs: live_home, as: live_away}) * (match.multiplier ?? 1))`.
2. Compute `tier = resultTier(home_pred, away_pred, live_home, live_away)`.
3. Sort rows by `proj` desc, then `name` asc (same comparator shape as the finished path).
4. Apply dense competition ranking on `proj` (reuse the existing rank logic, fed by `proj`
   instead of `points`).

Because the `match` prop re-renders on each realtime `live_home`/`live_away` update, steps
1–4 recompute automatically — no new subscription, effect, or fetch. `PeoplePredictions`
keeps fetching predictions once (they don't change mid-match); only the projection layer is
reactive to the live score.

### Animated re-sort

Give each `motion.div` row a **stable identity key**, not the array index, and add
framer-motion `layout` so rows physically slide to their new sorted
position when the order changes. The existing entrance animation (`initial`/`animate`) stays
for first paint; `layout` handles subsequent reorders. When a goal changes a row's `proj`,
that row gets a brief brighter **halo pulse** as it moves (a short keyframed
glow/box-shadow on `proj` change).

> Note: the current board keys rows by array index (`key={i}`). For animated re-sort this
> **must** change to a stable identity key, otherwise framer-motion can't track a row across
> reorders. The clean fix is to add the prediction row `id` to the `PeoplePredictions` select
> (`.select('id,home_pred,away_pred,points_awarded, players(name,flag_code)')`), carry it on
> `PeoplePick`, and key on it. This is a required, in-scope change.

## "Not finalized" halo treatment

Live rows read as provisional; final rows read as locked-in:

- **Glow:** live rows wear a soft, gently-pulsing outer glow (CSS `box-shadow` /
  `@keyframes` breathing). The pulse is slow and subtle at rest; brighter for one beat when a
  row's `proj` changes.
- **Provisional points badge:** the points figure shows in a **translucent / outlined** badge
  (not the solid inverted block used at Full-Time), signalling "tentative."
- **Header label:** the board header shows `LIVE · projected` (with the match minute,
  `match.live_minute`) instead of `Locked · N`, in place of the finished `Final · N`.
- **Settle on Full-Time:** when the match flips to `finished`, the glow fades out and badges
  become the existing solid final styling — the transition itself communicates "now it's
  locked." Reuse the finished render path unchanged; only the live path adds the halo.

Visual styling follows the existing poster aesthetic (3px ink borders, `font-display`,
paper/ink/yellow palette). The glow color stays within that palette (e.g. a soft yellow/ink
aura) rather than introducing new brand colors. Exact glow tuning is an implementation detail
to be refined against the running app.

## Components / boundaries

- **`PicksBoard`** gains a `live` branch alongside its existing `scored` branch. It stays
  presentational; all inputs come from `rows` + `match`. The three states (pre-kickoff live-less
  lock / live / finished) are selected by the `live` and `scored` booleans.
- Helper `projectedPoints(row, match)` (small pure function, local to the file or lifted to
  `scoring.ts` if cleaner) wraps the `basePoints × multiplier` call so it's unit-testable.
- No change to `PeoplePredictions`' fetch, to `types.ts`, or to any backend.

## Testing

- **Unit:** `projectedPoints` against a live score — exact (30 × mult), goal-diff (15),
  outcome (10/15), miss (0) — mirroring existing `scoring.test.ts` cases but with the live
  score as the result. Confirms parity with `basePoints`.
- **Sort/rank:** given a set of picks and a live score, the produced order and dense ranks
  match expectation; ties broken by name.
- **Manual / visual:** with a match in live state (seed `live_status`/`live_home`/`live_away`),
  verify rows reorder and the halo reads as provisional, and that flipping to `finished`
  settles into the existing final board with no layout regression.

## Risks

- **Re-key regression:** switching row keys from index to the prediction `id` is required for
  animation; the `id` must be added to the fetch (one extra column on the existing select).
- **Motion noise:** if live updates are frequent, constant reordering could feel busy. Mitigate
  with spring settling already used and a subtle (not flashy) pulse. Tune against the live app.
