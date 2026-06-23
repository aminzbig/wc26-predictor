# Booster Feature — Design

**Date:** 2026-06-23
**Status:** Approved (brainstorming) → ready for implementation plan

## Summary

Add a **Booster** to the World Cup prediction game. Each player may designate one
**booster match per round**, which **doubles** all points that prediction earns. The
booster is personal (each player has their own), is set/removed only while the match is
still open for predictions, and is surfaced on the match card as a circular **2× badge**
with a bright, light-hue **rainbow outline** when active.

## Core mechanic

- A **round = a `matches.stage`**: `group` (Round 1), `r32`, `r16`, `qf`, `sf`, `third`,
  `final`. Each stage gets exactly one booster per player.
- The booster **doubles** all points the boosted prediction earns: the full FIFA sum
  × `matches.multiplier` × **2**, including the risky bonus.
- A booster can be **set or removed only while the match is open**
  (`status='scheduled'` AND `kickoff_at > now()`), the same window as predictions.
- "Starts from Game 3 of Round 1" falls out naturally: group matchdays 1–2 have already
  kicked off, so the only boostable group games are the still-open **matchday-3** games.
  No explicit matchday concept is added to the schema.
- The booster is **per-player and personal**: only the owner sees their rainbow outline
  and 2× indicators.

## Data model — new `boosters` table

New migration `supabase/migrations/0022_boosters.sql`:

```sql
create table if not exists boosters (
  player_id  uuid not null references players(id) on delete cascade,
  match_id   uuid not null references matches(id) on delete cascade,
  stage      text not null,            -- denormalized from matches.stage
  created_at timestamptz not null default now(),
  primary key (player_id, match_id),   -- one booster per match
  unique (player_id, stage)            -- one booster per round  ← the key rule
);
create index if not exists boosters_match_idx on boosters (match_id);
```

Chosen over an `is_booster` flag on `predictions` because the one-per-round rule is
cleanly enforced by `unique (player_id, stage)`, and booster logic stays isolated from
prediction logic.

### RLS (mirrors the `predictions` policies)

- **select**: `player_id = auth.uid()` (owner sees only their own boosters).
- **insert**: `player_id = auth.uid()` AND the target match is still open
  (`status='scheduled'` AND `kickoff_at > now()`) AND the supplied `stage` equals the
  match's real stage.
- **delete**: `player_id = auth.uid()` AND the match is still open.

The `unique (player_id, stage)` constraint is the server-side backstop behind the
client's "disabled badge" UX — a second insert in the same round is rejected.

## Scoring integration

Redefine `recompute_match(p_match uuid)` (currently in `0013_fifa_scoring.sql`) in the
new migration to add a boost factor:

```sql
points_awarded = mult
  * (case when exists (select 1 from boosters b
                       where b.player_id = p.player_id and b.match_id = p_match)
          then 2 else 1 end)
  * ( -- existing FIFA additive sum, unchanged
        (case when sign(p.home_pred - p.away_pred) = actual_out then 10 else 0 end)
      + (case when p.home_pred = m.home_score then 5 else 0 end)
      + (case when p.away_pred = m.away_score then 5 else 0 end)
      + (case when p.home_pred - p.away_pred = m.home_score - m.away_score then 5 else 0 end)
      + (case when p.home_pred = m.home_score and p.away_pred = m.away_score then 5 else 0 end)
      + (case when risky and sign(p.home_pred - p.away_pred) = actual_out then 10 else 0 end)
    )
```

- The `leaderboard` view needs **no change** — it already sums `points_awarded`.
- Client `scoring.ts` / `livePicks.ts` get an optional `boost` factor (default 1) so the
  live/projected points the booster **owner** sees also reflect ×2. Other players' live
  rankings are unaffected by someone else's personal booster.

## Client data layer — `useBoosters` hook

New `src/hooks/useBoosters.ts`, parallel to `usePredictions`:

- Loads the current player's boosters into `byMatch: Record<matchId, Booster>`.
- Exposes `usedStages: Set<Stage>` — rounds already boosted by this player.
- `setBooster(matchId, stage)` — insert (only succeeds if that round is free).
- `clearBooster(matchId)` — delete.
- Reloads after each mutation. (Realtime not required; mutations are local to the user.)

A `Booster` type is added to `src/lib/types.ts`.

## UI — open cards: the 2× badge

On **open** cards, the top-right corner (currently the "★ OPEN" badge in
`MatchCard.tsx`) gains a circular **2× badge** with three states for the current player:

- **Available** (this round not yet boosted): solid, tappable. Tapping sets the booster
  on this match.
- **Active** (this match is the player's booster for its round): badge stays visible, and
  the **whole card outline animates as a bright, light-hue rainbow**. Tapping the badge
  again **removes** the booster (re-enabling the round).
- **Disabled** (player already boosted another match this round): badge at **~20%
  opacity, untappable**.

The "★ OPEN" label and the 2× badge coexist in that corner (small label + circular
badge). Tapping the badge must not trigger the card's open/detail navigation
(`stopPropagation`, as the existing top-3 avatar buttons do).

### Rainbow outline

New `booster-rainbow` CSS keyframe in `src/index.css`, a hue-rotating bright gradient
border built on the existing `adminHolo` hue-cycle pattern. It must read as a bold
~3px border consistent with the poster/brutalist card style (which currently uses
`border-[3px] border-ink`). Applied to the main card `motion.div` only when the current
player's booster is active on that match.

## UI — finished cards

When a match is **finished** and the **current player boosted it**, the top-right shows
the top-3 predictors with the **lowest-ranked avatar replaced by the 2× booster badge**
(2 avatars + booster badge = 3 slots), marking "your booster applied here." The finished
badge keeps a **subtle rainbow ring** for continuity with the active state. Non-boosted
finished cards are unchanged.

This requires `TopThreePredictors` (in `matchFace.tsx`) to accept a `boosted` prop and,
when set, render only the top 2 avatars plus the booster badge.

## Testing

- `scoring.test.ts`: boost factor doubles correctly, stacks with `multiplier`, and does
  not fire without a booster.
- `useBoosters` / one-per-round: setting a second booster in a round is rejected;
  removing frees the round.
- `MatchCard.test.tsx`: the 2× badge renders available / active / disabled correctly per
  state; finished card swaps the lowest avatar for the badge when boosted.

## Out of scope (YAGNI)

- No admin UI for boosters.
- No realtime sync of boosters across devices (single-user mutation; reload is enough).
- No analytics/history of past booster choices beyond the live `boosters` rows.
- No change to how non-owners view a match (boosters stay personal).
