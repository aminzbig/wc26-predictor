-- 0014_social.sql — Social Wall: posts + counter reactions + RLS + realtime.

create table if not exists social_posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references players(id) on delete cascade,
  body         text not null,
  color        text not null default 'paper',
  match_id     uuid references matches(id) on delete set null,
  heart_count  int  not null default 0,
  up_count     int  not null default 0,
  down_count   int  not null default 0,
  sandal_count int  not null default 0,
  dead_count   int  not null default 0,
  created_at   timestamptz not null default now(),
  constraint social_body_len   check (char_length(body) between 1 and 280),
  constraint social_color_valid check (color in ('orange','green','blue','yellow','red','paper'))
);

create index if not exists social_posts_created_idx on social_posts (created_at desc);

-- Atomic, validated reaction increment. SECURITY DEFINER so clients never write
-- counts directly (they could otherwise forge totals).
create or replace function react_to_post(p_id uuid, kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if kind not in ('heart','up','down','sandal','dead') then
    raise exception 'invalid reaction kind: %', kind;
  end if;
  update social_posts set
    heart_count  = heart_count  + (kind = 'heart')::int,
    up_count     = up_count     + (kind = 'up')::int,
    down_count   = down_count   + (kind = 'down')::int,
    sandal_count = sandal_count + (kind = 'sandal')::int,
    dead_count   = dead_count   + (kind = 'dead')::int
  where id = p_id;
end $$;

-- RLS (mirrors 0002_rls.sql conventions; is_admin() already exists)
alter table social_posts enable row level security;

drop policy if exists social_read on social_posts;
create policy social_read on social_posts for select to authenticated using (true);

drop policy if exists social_insert_self on social_posts;
create policy social_insert_self on social_posts for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists social_delete on social_posts;
create policy social_delete on social_posts for delete to authenticated
  using (author_id = auth.uid() or is_admin());

-- No UPDATE policy: reactions go through react_to_post(); posts are not editable.
grant execute on function react_to_post(uuid, text) to authenticated;

-- Realtime: broadcast changes so the wall updates live (same idempotent guard
-- used for `matches` in 0011_realtime_and_recompute.sql).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'social_posts'
     )
  then
    alter publication supabase_realtime add table social_posts;
  end if;
end $$;
