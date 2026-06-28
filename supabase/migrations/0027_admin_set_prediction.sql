-- Single source of truth for the prediction scoring formula. STABLE (not
-- IMMUTABLE) because it reads the settings table. Replaces the formula that was
-- duplicated inline in 0003_score_function.sql and 0004_recompute.sql.
create or replace function score_points(
  p_home_pred int, p_away_pred int,
  p_home_score int, p_away_score int,
  p_mult numeric
) returns integer language sql stable set search_path = public as $$
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

-- Refactor the whole-match scorer to use the shared helper. Behavior unchanged.
create or replace function recompute_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m matches%rowtype;
begin
  select * into m from matches where id = p_match;
  if m.home_score is null or m.away_score is null then
    raise exception 'match has no final score';
  end if;

  update predictions p set
    points_awarded = score_points(p.home_pred, p.away_pred, m.home_score, m.away_score, m.multiplier),
    updated_at = now()
  where p.match_id = p_match;

  update matches set status='finished' where id = p_match;
end; $$;

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

-- Admin: set/fix one player's prediction for one match, re-score that single
-- row, and record the change. Returns new points (null if match not scored yet).
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

  select * into existing from predictions
    where player_id = p_player and match_id = p_match;

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
