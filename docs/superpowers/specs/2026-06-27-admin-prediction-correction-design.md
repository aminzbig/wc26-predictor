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
- Introducing or altering the scoring formula. This feature reuses the
  canonical `recompute_match` unchanged.

## Behavioral note: corrections re-score the whole match

Because `admin_set_prediction` delegates to `recompute_match`, correcting one
player's prediction re-scores **every** prediction on that match. For most
components this is a no-op for other players (their inputs are unchanged), but
the **risky bonus** is distribution-dependent: it is awarded only when the
winning side was predicted by < 20% of users. Adding or editing one prediction
can cross that threshold, so another player's risky bonus on the same match may
legitimately appear or disappear. This is correct behavior, not a side effect to
avoid — scoring one row in isolation would be *wrong*. In practice a single
correction rarely flips the 20% threshold.

## Approach

Match-centric correction screen: the admin picks a match and sees every player's
prediction for it in one list, making a missing/wrong pick easy to spot and fix
in place. A single security-definer RPC performs the upsert + re-score + audit.

### Scoring: reuse the canonical scorer, do NOT reimplement it

**Critical:** production scoring is NOT the best-of-three formula in
`0003`/`0004`. It was redefined to the additive FIFA model in
`0013_fifa_scoring.sql`, given the per-player ×2 booster in `0022_boosters.sql`,
and given the "way-off ⇒ 0" rule in `0023_far_off_zero.sql`. The current scorer
(`recompute_match`, as of `0023`) computes points additively (Correct Outcome +10,
Correct Goals home/away +5 each, Correct Goal Difference +5, Exact Score +5,
Risky Bonus +10) × the per-match multiplier × a ×2 booster factor, with a
way-off override that zeroes a prediction whose total goal error ≥ 5 for matches
kicking off on/after 2026-06-24.

Three of these components depend on context **outside a single prediction row**:
the **risky bonus** depends on the distribution of *all* predictions for the
match (was the winning side predicted by < 20% of users?), the **booster** on a
per-player row in the `boosters` table, and the **way-off** rule on the match
kickoff time. Therefore a scalar `score_points(home, away, hs, as, mult)` helper
**cannot** express current scoring, and this feature must not introduce one.

Instead, `admin_set_prediction` upserts the prediction and then delegates to the
existing `recompute_match(p_match)`, which re-scores the whole match with the
canonical formula. This is not just convenient — it is **more correct**: editing
or adding one prediction can shift the risky-bonus distribution, so the whole
match legitimately needs re-scoring (see the revised Non-Goals).

### Data model / migrations

New migration `supabase/migrations/0027_admin_set_prediction.sql` (the next free
number; `0026` was taken by `0026_knockout_venues.sql`). It does **not** define a
new scoring formula. It includes an exact `create or replace` restore of the
canonical `recompute_match` from `0023` (idempotent no-op on a healthy DB; repairs
any environment that ran an earlier incorrect draft), and `drop function if exists
score_points(...)` to remove that mistaken helper.

1. **Audit table:**

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

     -- capture prior state for audit (all-null when no prior prediction)
     select * into existing
       from predictions where player_id = p_player and match_id = p_match;

     -- upsert; points are (re)derived by recompute_match below
     insert into predictions (player_id, match_id, home_pred, away_pred, points_awarded, updated_at)
     values (p_player, p_match, p_home, p_away, null, now())
     on conflict (player_id, match_id) do update
       set home_pred = excluded.home_pred,
           away_pred = excluded.away_pred,
           updated_at = now();

     -- delegate to the canonical scorer if the match has a final score
     if m.home_score is not null and m.away_score is not null then
       perform recompute_match(p_match);
       select points_awarded into new_points from predictions
         where player_id = p_player and match_id = p_match;
     else
       new_points := null;
     end if;

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
   - Delegates to `recompute_match`, so points always match the canonical
     formula (FIFA-additive + booster + way-off + risky bonus).
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
      → upsert predictions row (create or update)
      → if match has a final score: recompute_match(match) re-scores the match
      → read back the corrected player's points
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

- **SQL/RPC** (verified by applying to the cloud DB and inspecting):
  - After applying, `recompute_match` is the canonical `0023` definition
    (contains the booster and way-off rules) and `score_points` does not exist.
  - `admin_set_prediction` creates a missing prediction and, via
    `recompute_match`, scores it under the canonical formula against a finished
    match.
  - It updates an existing prediction and re-derives points.
  - It saves with null points when the match has no final score.
  - It rejects non-admin callers and negative inputs.
  - An audit row is written with correct old/new values.
- **UI (`AdminCorrections.test.tsx`):**
  - Players without a prediction render with blank boxes.
  - Saving calls the RPC with the right args and reloads.
  - The match actual score is rendered read-only.

## Out of scope / future

- A viewer UI for `prediction_corrections` (data is recorded now; surface later if
  needed).
- Undo of a correction (re-running the correction with the prior values achieves
  this manually).
