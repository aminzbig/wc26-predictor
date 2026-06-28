-- Admin per-prediction correction.
--
-- IMPORTANT: this migration does NOT introduce a new scoring formula. Current
-- production scoring is the additive FIFA model with the per-player booster and
-- the "way-off => 0" rule, defined in 0023_far_off_zero.sql. The risky bonus
-- depends on the whole prediction distribution for a match, the booster on a
-- per-player lookup, and the way-off rule on the kickoff cutoff -- so a single
-- prediction cannot be scored in isolation. admin_set_prediction therefore
-- upserts the prediction and delegates to recompute_match (the canonical
-- scorer), which re-scores the whole match correctly and idempotently.
--
-- The recompute_match definition below is an exact restore of 0023 (a no-op
-- where the cloud DB already matches it). It is included so this file is
-- self-consistent and so applying it repairs any environment that previously
-- ran an earlier, incorrect draft of this migration.
create or replace function recompute_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m matches%rowtype;
  mult numeric;
  actual_out int;
  total int;
  same_out int;
  risky boolean := false;
  far_off boolean;
begin
  select * into m from matches where id = p_match;
  if m.home_score is null or m.away_score is null then
    raise exception 'match has no final score';
  end if;
  mult := coalesce(m.multiplier, 1);
  actual_out := sign(m.home_score - m.away_score);
  far_off := m.kickoff_at >= '2026-06-24T00:00:00Z'::timestamptz;

  if actual_out <> 0 then
    select count(*), count(*) filter (where sign(home_pred - away_pred) = actual_out)
      into total, same_out
      from predictions where match_id = p_match;
    if total > 0 and same_out::numeric / total < 0.20 then
      risky := true;
    end if;
  end if;

  update predictions p set
    points_awarded = case
      when far_off
           and abs(p.home_pred - m.home_score) + abs(p.away_pred - m.away_score) >= 5
        then 0                                                                       -- Way-off: 0 for the whole match
      else mult
        * (case when exists (select 1 from boosters b
                             where b.player_id = p.player_id and b.match_id = p_match)
                then 2 else 1 end)                                                   -- Booster: double
        * (
            (case when sign(p.home_pred - p.away_pred) = actual_out then 10 else 0 end)  -- Correct Outcome
          + (case when p.home_pred = m.home_score then 5 else 0 end)                     -- Correct Goals (Home)
          + (case when p.away_pred = m.away_score then 5 else 0 end)                     -- Correct Goals (Away)
          + (case when p.home_pred - p.away_pred = m.home_score - m.away_score then 5 else 0 end) -- Goal Difference
          + (case when p.home_pred = m.home_score and p.away_pred = m.away_score then 5 else 0 end) -- Score Bonus
          + (case when risky and sign(p.home_pred - p.away_pred) = actual_out then 10 else 0 end)   -- Risky Bonus
        )
      end,
    updated_at = now()
  where p.match_id = p_match;

  update matches set status = 'finished' where id = p_match;
end; $$;

-- Drop the obsolete best-of-three helper an earlier draft of this migration
-- introduced; current scoring lives entirely in recompute_match.
drop function if exists score_points(int, int, int, int, numeric);

-- Audit trail of admin per-prediction corrections.
create table if not exists prediction_corrections (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  admin_id uuid not null references players(id),
  old_home_pred int, old_away_pred int, old_points int,
  new_home_pred int not null, new_away_pred int not null, new_points int,
  created_at timestamptz not null default now()
);
alter table prediction_corrections enable row level security;
drop policy if exists prediction_corrections_admin_read on prediction_corrections;
create policy prediction_corrections_admin_read on prediction_corrections
  for select to authenticated using (is_admin());

-- Admin may read everyone's predictions in any match state, for the Fixes screen.
drop policy if exists predictions_admin_read on predictions;
create policy predictions_admin_read on predictions
  for select to authenticated using (is_admin());

-- Admin: set/fix one player's prediction for one match, then re-score that match
-- with the canonical scorer. Returns the corrected player's new points (null if
-- the match has no final score yet). Re-scoring the whole match is intentional
-- and correct: the risky bonus is distribution-dependent, so adding or editing a
-- prediction can legitimately shift other players' risky bonus on that match.
create or replace function admin_set_prediction(
  p_player uuid, p_match uuid, p_home int, p_away int
) returns integer language plpgsql security definer set search_path = public as $$
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

  -- Capture the prior state for the audit row before we overwrite it. When no
  -- prior prediction exists, every field of `existing` is null.
  select * into existing from predictions
    where player_id = p_player and match_id = p_match;

  -- Upsert the prediction. Points are (re)derived below by recompute_match; if
  -- the match is not yet scored they stay null until normal FT scoring runs.
  insert into predictions (player_id, match_id, home_pred, away_pred, points_awarded, updated_at)
  values (p_player, p_match, p_home, p_away, null, now())
  on conflict (player_id, match_id) do update
    set home_pred = excluded.home_pred,
        away_pred = excluded.away_pred,
        updated_at = now();

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
