-- Admin points v2: a list of individual +/-10 "stickers" per player,
-- replacing the single players.admin_units integer (migration 0018).

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

-- 3. Drop the v1 column and revert the self-update policy to the original
--    (freeze is_admin + legacy_points only; admin_units no longer exists).
alter table players drop column if exists admin_units;
drop policy if exists players_update_self on players;
create policy players_update_self on players for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and is_admin = (select is_admin from players where id = auth.uid())
    and legacy_points = (select legacy_points from players where id = auth.uid())
  );

-- 4. Leaderboard view: sum sticker deltas into total and expose the ordered
--    array. Scalar subqueries (not a join) keep the predictions aggregation intact.
create or replace view leaderboard as
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

-- 5. Broadcast admin_points changes so the leaderboard refreshes live.
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
