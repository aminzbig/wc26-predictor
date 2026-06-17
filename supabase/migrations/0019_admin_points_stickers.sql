-- Admin points v2: a list of individual +/-10 "stickers" per player,
-- replacing the single players.admin_units integer (migration 0018).
--
-- Ordering matters: the 0018 leaderboard view and players_update_self policy
-- both depend on players.admin_units, so we must recreate those dependent
-- objects WITHOUT admin_units before we can drop the column. The view's
-- trailing column also changes type (admin_units int -> admin_deltas
-- smallint[]), which CREATE OR REPLACE VIEW cannot do, so we DROP + CREATE it.

-- 1. New table: one row per sticker.
create table if not exists admin_points (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  delta smallint not null check (delta in (-10, 10)),
  created_at timestamptz not null default now()
);
create index if not exists admin_points_player_idx on admin_points (player_id);

-- 2. RLS: everyone reads, only admins write (mirrors matches_admin_write in 0002).
alter table admin_points enable row level security;
drop policy if exists admin_points_read on admin_points;
create policy admin_points_read on admin_points for select to authenticated using (true);
drop policy if exists admin_points_admin_write on admin_points;
create policy admin_points_admin_write on admin_points for all to authenticated
  using (is_admin()) with check (is_admin());

-- 3. Recreate the self-update policy WITHOUT the admin_units clause (back to the
--    pre-0018 original: freeze is_admin + legacy_points only). This removes the
--    policy's dependency on the admin_units column.
drop policy if exists players_update_self on players;
create policy players_update_self on players for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and is_admin = (select is_admin from players where id = auth.uid())
    and legacy_points = (select legacy_points from players where id = auth.uid())
  );

-- 4. Drop the old view (it depends on admin_units), then drop the column.
drop view if exists leaderboard;
alter table players drop column if exists admin_units;

-- 5. Recreate the leaderboard view: sum sticker deltas into total and expose the
--    ordered array. Scalar subqueries (not a join) keep the predictions
--    aggregation intact.
create view leaderboard as
select
  pl.id, pl.name, pl.flag_code,
  pl.legacy_points
    + coalesce((select sum(ap.delta) from admin_points ap where ap.player_id = pl.id), 0)
    + coalesce(sum(pr.points_awarded),0)::int as total,
  count(*) filter (where m.status='finished'
    and pr.home_pred = m.home_score and pr.away_pred = m.away_score) as exact_hits,
  count(*) filter (where m.status='finished'
    and not (pr.home_pred = m.home_score and pr.away_pred = m.away_score)
    and pr.home_pred - pr.away_pred = m.home_score - m.away_score) as diff_hits,
  pl.avatar_url,
  (select coalesce(array_agg(ap.delta order by ap.created_at, ap.id), '{}'::smallint[])
     from admin_points ap where ap.player_id = pl.id) as admin_deltas
from players pl
left join predictions pr on pr.player_id = pl.id
left join matches m on m.id = pr.match_id and m.status='finished'
group by pl.id, pl.name, pl.flag_code, pl.avatar_url, pl.legacy_points;

grant select on leaderboard to authenticated;

-- 6. Broadcast admin_points changes so the leaderboard refreshes live.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_points'
     )
  then
    alter publication supabase_realtime add table admin_points;
  end if;
end $$;

-- v1 (0018) added `players` to the publication for the leaderboard; v2 no
-- longer subscribes to it (the points moved to admin_points). Drop it so the
-- publication doesn't broadcast player-row changes with no subscriber.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'players'
  )
  then
    alter publication supabase_realtime drop table players;
  end if;
end $$;
