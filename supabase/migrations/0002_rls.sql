alter table teams enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;
alter table settings enable row level security;

-- helper: is the current user an admin?
create or replace function is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from players where id = auth.uid()), false);
$$;

-- teams
drop policy if exists teams_read on teams;
create policy teams_read on teams for select to authenticated using (true);
drop policy if exists teams_admin_write on teams;
create policy teams_admin_write on teams for all to authenticated
  using (is_admin()) with check (is_admin());

-- players
drop policy if exists players_read on players;
create policy players_read on players for select to authenticated using (true);
drop policy if exists players_update_self on players;
create policy players_update_self on players for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and is_admin = (select is_admin from players where id = auth.uid())
    and legacy_points = (select legacy_points from players where id = auth.uid())
  );
drop policy if exists players_admin_write on players;
create policy players_admin_write on players for all to authenticated
  using (is_admin()) with check (is_admin());

-- matches
drop policy if exists matches_read on matches;
create policy matches_read on matches for select to authenticated using (true);
drop policy if exists matches_admin_write on matches;
create policy matches_admin_write on matches for all to authenticated
  using (is_admin()) with check (is_admin());

-- predictions: read own always; read others only when that match is locked or finished
drop policy if exists predictions_read on predictions;
create policy predictions_read on predictions for select to authenticated using (
  player_id = auth.uid()
  or exists (
    select 1 from matches m where m.id = match_id
    and (m.status = 'finished' or m.kickoff_at <= now())
  )
);
-- insert/update own prediction only while match is open
drop policy if exists predictions_insert_self on predictions;
create policy predictions_insert_self on predictions for insert to authenticated
  with check (
    player_id = auth.uid()
    and points_awarded is null
    and exists (select 1 from matches m where m.id = match_id
                and m.status = 'scheduled' and m.kickoff_at > now())
  );
drop policy if exists predictions_update_self on predictions;
create policy predictions_update_self on predictions for update to authenticated
  using (player_id = auth.uid())
  with check (
    player_id = auth.uid()
    and points_awarded is null
    and exists (select 1 from matches m where m.id = match_id
                and m.status = 'scheduled' and m.kickoff_at > now())
  );

-- settings
drop policy if exists settings_read on settings;
create policy settings_read on settings for select to authenticated using (true);
drop policy if exists settings_admin_write on settings;
create policy settings_admin_write on settings for all to authenticated
  using (is_admin()) with check (is_admin());
