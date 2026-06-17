-- Admin points: a single per-player adjustment. Each unit = 10 points.
-- Range -10..+10 (i.e. -100..+100 points). 0 = no adjustment.

alter table players
  add column if not exists admin_units smallint not null default 0;

alter table players
  drop constraint if exists players_admin_units_range;
alter table players
  add constraint players_admin_units_range check (admin_units between -10 and 10);

-- Fold admin points into the leaderboard total and expose the raw units
-- so the ranking row can render the sticker.
create or replace view leaderboard as
select
  pl.id, pl.name, pl.flag_code,
  pl.legacy_points + (pl.admin_units * 10) + coalesce(sum(pr.points_awarded),0)::int as total,
  count(*) filter (where m.status='finished'
    and pr.home_pred = m.home_score and pr.away_pred = m.away_score) as exact_hits,
  count(*) filter (where m.status='finished'
    and not (pr.home_pred = m.home_score and pr.away_pred = m.away_score)
    and pr.home_pred - pr.away_pred = m.home_score - m.away_score) as diff_hits,
  pl.avatar_url,
  pl.admin_units
from players pl
left join predictions pr on pr.player_id = pl.id
left join matches m on m.id = pr.match_id and m.status='finished'
group by pl.id, pl.name, pl.flag_code, pl.avatar_url, pl.legacy_points, pl.admin_units;

grant select on leaderboard to authenticated;

-- Harden the self-update policy: admin_units is admin-only, just like
-- is_admin and legacy_points. Without this, a non-admin could update their
-- own row and set admin_units to grant themselves points (privilege
-- escalation). Recreate players_update_self adding admin_units to the
-- frozen-column list.
drop policy if exists players_update_self on players;
create policy players_update_self on players for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and is_admin = (select is_admin from players where id = auth.uid())
    and legacy_points = (select legacy_points from players where id = auth.uid())
    and admin_units = (select admin_units from players where id = auth.uid())
  );

-- Broadcast players changes so the leaderboard refreshes live when an admin
-- adjusts admin_units (the client subscribes in useLeaderboard).
-- Idempotent: only adds the table if the publication exists and lacks it.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'players'
     )
  then
    alter publication supabase_realtime add table players;
  end if;
end $$;
