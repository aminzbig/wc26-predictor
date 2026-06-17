-- Circular photo-blend avatars.
-- Users capture a photo and blend their flag over it; the baked composite is
-- stored in the `avatars` bucket and its public URL on players.avatar_url.

-- 1. Player columns: baked composite URL + last blend slider value (0-100)
--    + last blend mode (normal/multiply/overlay/soft), so the editor can restore.
alter table players add column if not exists avatar_url text;
alter table players add column if not exists avatar_blend smallint;
alter table players add column if not exists avatar_mode text;

-- 2. Leaderboard view must surface avatar_url so leaderboard rows render the avatar.
-- avatar_url is appended as the LAST column so `create or replace view` accepts it
-- (it forbids inserting/renaming columns mid-list).
create or replace view leaderboard as
select
  pl.id, pl.name, pl.flag_code,
  pl.legacy_points + coalesce(sum(pr.points_awarded),0)::int as total,
  count(*) filter (where m.status='finished'
    and pr.home_pred = m.home_score and pr.away_pred = m.away_score) as exact_hits,
  count(*) filter (where m.status='finished'
    and not (pr.home_pred = m.home_score and pr.away_pred = m.away_score)
    and pr.home_pred - pr.away_pred = m.home_score - m.away_score) as diff_hits,
  pl.avatar_url
from players pl
left join predictions pr on pr.player_id = pl.id
left join matches m on m.id = pr.match_id and m.status='finished'
group by pl.id, pl.name, pl.flag_code, pl.avatar_url, pl.legacy_points;

grant select on leaderboard to authenticated;

-- 3. Public storage bucket for avatars (read public; write scoped to own folder).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar public read"  on storage.objects;
drop policy if exists "avatar owner insert"  on storage.objects;
drop policy if exists "avatar owner update"  on storage.objects;
drop policy if exists "avatar owner delete"  on storage.objects;

create policy "avatar public read" on storage.objects
  for select using (bucket_id = 'avatars');

-- The first path segment is the owner's auth uid (avatars/{uid}/...).
create policy "avatar owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
