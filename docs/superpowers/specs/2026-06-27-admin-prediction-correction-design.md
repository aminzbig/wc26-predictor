# Admin Per-Prediction Correction — Design

**Date:** 2026-06-27
**Status:** Approved, ready for planning

## Problem

When a match has already been played and scored, an individual player's
prediction may be wrong in the system through no fault of the scoring formula:

1. **Missing prediction** — the player's pick never saved (network drop, bug),
   so there is no `predictions` row and they earned zero points for a match they
   actually predicted.
2. **Stale points** — a `predictions` row exists but `points_awarded` is blank
   or wrong.

Today an admin has **no path** to fix either case. RLS only lets a player write
their **own** prediction, and only while the match is **open** (`kickoff_at >
now()`). The existing Results tab edits the *actual match score* for everyone —
which is not what we want here. We need to correct **one player's prediction**
without touching the real game result or anyone else's points.

## Goals

- Let an admin set/fix a single player's prediction (`home_pred`/`away_pred`) for
  a given match, including creating one that never existed.
- Re-derive that player's `points_awarded` from the corrected prediction using
  the **normal scoring formula** — so the displayed prediction and the awarded
  points always agree.
- Keep a record of every correction for trust/auditability.

## Non-Goals

- Changing the actual match result (`matches.home_score`/`away_score`). That
  stays in the existing Results tab.
- Arbitrary raw-points overrides decoupled from a prediction.
- Bulk re-scoring of a whole match (already covered by `score_match` /
  `recompute_match`).

## Approach

Match-centric correction screen: the admin picks a match and sees every player's
prediction for it in one list, making a missing/wrong pick easy to spot and fix
in place. A single security-definer RPC performs the upsert + re-score + audit.

### Data model / migrations

New migration `supabase/migrations/0026_admin_set_prediction.sql`:

1. **Scalar scoring helper** — single source of truth for the formula, which is
   currently duplicated across `0003_score_function.sql` and
   `0004_recompute.sql`:

   ```sql
   create or replace function score_points(
     p_home_pred int, p_away_pred int,
     p_home_score int, p_away_score int,
     p_mult numeric
   ) returns integer language sql stable as $$  -- stable, not immutable: it reads the settings table
     select (p_mult * (
       case
         when p_home_pred = p_home_score and p_away_pred = p_away_score
           then (select value from settings where key='points_exact')
         when p_home_pred - p_away_pred = p_home_score - p_away_score
           then (select value from settings where key='points_diff')
         when sign(p_home_pred - p_away_pred) = sign(p_home_score - p_away_score)
           then (select value from settings where key='points_outcome')
         else 0
       end))::int;
   $$;
   ```

   Refactor `recompute_match` to call `score_points(...)` so the formula lives in
   one place. (Functional behavior of `recompute_match` is unchanged.)

2. **Audit table:**

   ```sql
   create table prediction_corrections (
     id uuid primary key default gen_random_uuid(),
     match_id uuid not null references matches(id) on delete cascade,
     player_id uuid not null references players(id) on delete cascade,
     admin_id uuid not null references players(id),
     old_home_pred int, old_away_pred int, old_points int,
     new_home_pred int not null, new_away_pred int not null, new_points int,
     created_at timestamptz not null default now()
   );
   ```

   RLS: admin-read only (`is_admin()`); no client write (only the RPC, running
   security-definer, inserts).

3. **Admin RPC:**

   ```sql
   create or replace function admin_set_prediction(
     p_player uuid, p_match uuid, p_home int, p_away int
   ) returns integer  -- the new points_awarded (null if match not yet scored)
   language plpgsql security definer set search_path = public as $$
   declare
     m matches%rowtype;
     existing predictions%rowtype;
     new_points int;
   begin
     if not is_admin() then
       raise exception 'only admins can correct predictions';
     end if;
     if p_home < 0 or p_away < 0 then
       raise exception 'scores must be non-negative';
     end if;

     select * into m from matches where id = p_match;
     if not found then raise exception 'match not found'; end if;

     select * into existing
       from predictions where player_id = p_player and match_id = p_match;

     if m.home_score is not null and m.away_score is not null then
       new_points := score_points(p_home, p_away, m.home_score, m.away_score, m.multiplier);
     else
       new_points := null;
     end if;

     insert into predictions (player_id, match_id, home_pred, away_pred, points_awarded, updated_at)
     values (p_player, p_match, p_home, p_away, new_points, now())
     on conflict (player_id, match_id) do update
       set home_pred = excluded.home_pred,
           away_pred = excluded.away_pred,
           points_awarded = excluded.points_awarded,
           updated_at = now();

     insert into prediction_corrections (
       match_id, player_id, admin_id,
       old_home_pred, old_away_pred, old_points,
       new_home_pred, new_away_pred, new_points
     ) values (
       p_match, p_player, auth.uid(),
       existing.home_pred, existing.away_pred, existing.points_awarded,
       p_home, p_away, new_points
     );

     return new_points;
   end; $$;

   revoke all on function admin_set_prediction(uuid, uuid, int, int) from public, anon;
   grant execute on function admin_set_prediction(uuid, uuid, int, int) to authenticated;
   ```

   Notes:
   - Guards on `is_admin()` internally, so granting `authenticated` is safe.
   - Re-scores **only** this one prediction; other players' rows are untouched.
   - If the match has no final score yet, the prediction is saved with
     `points_awarded = null` (normal FT scoring will fill it later).

4. **Admin read policy on `predictions`** so the screen can read everyone's picks
   regardless of match state:

   ```sql
   create policy predictions_admin_read on predictions
     for select to authenticated using (is_admin());
   ```

### UI

New screen `src/screens/admin/AdminCorrections.tsx`, reachable via a new **Fixes**
tab in `src/components/AdminTabs.tsx` (route e.g. `/admin/fixes`).

Layout (poster/ink-on-paper style, matching `AdminResults.tsx`):

- **Match selector** — dropdown of matches (most recent / finished first). On
  select, show the match's **actual score read-only** (clearly not editable).
- **Player rows** — one row per player (all players, left-joined to their
  prediction for this match):
  - flag + name,
  - two editable number boxes (prefilled from the prediction, **blank** if none),
  - current `points_awarded` (or "—"),
  - a **Save** button per row.
- **Save** → `supabase.rpc('admin_set_prediction', { p_player, p_match, p_home, p_away })`
  → on success, reload predictions for the match. Leaderboard updates via the
  existing realtime subscription on `predictions`.
- Errors surface via the existing `alert((e as Error).message)` pattern.

Data loading in the screen:
- matches: existing `useMatches()` hook.
- players: fetch `players` (admin can read).
- predictions for selected match: `supabase.from('predictions').select().eq('match_id', id)`,
  merged with the players list client-side so players without a prediction still
  appear with blank boxes.

## Data flow

```
Admin picks match + edits a player's boxes + Save
  → rpc admin_set_prediction(player, match, home, away)
      → guard is_admin()
      → compute new points via score_points() if match has final score
      → upsert predictions row (create or update)
      → insert prediction_corrections audit row
      → return new points
  → screen reloads predictions for the match
  → leaderboard realtime picks up the predictions change
```

## Error handling

- Non-admin caller → RPC raises `only admins can correct predictions`.
- Negative scores → RPC raises `scores must be non-negative` (UI also clamps to 0).
- Unknown match → `match not found`.
- Match not yet scored → prediction saved with null points (no error); points get
  filled by normal FT scoring later.

## Testing

- **SQL/RPC:**
  - `admin_set_prediction` creates a missing prediction and scores it correctly
    against a finished match.
  - It updates an existing prediction and re-derives points.
  - It saves with null points when the match has no final score.
  - It rejects non-admin callers and negative inputs.
  - An audit row is written with correct old/new values.
  - `score_points` returns the same values as the previous inline formula across
    exact / diff / outcome / miss cases and respects the multiplier.
- **UI (`AdminCorrections.test.tsx`):**
  - Players without a prediction render with blank boxes.
  - Saving calls the RPC with the right args and reloads.
  - The match actual score is rendered read-only.

## Out of scope / future

- A viewer UI for `prediction_corrections` (data is recorded now; surface later if
  needed).
- Undo of a correction (re-running the correction with the prior values achieves
  this manually).
