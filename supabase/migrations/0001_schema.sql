create table if not exists teams (
  code text primary key,
  name text not null
);

create table if not exists players (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null unique,
  slug text not null unique,
  flag_code text references teams(code),
  is_admin boolean not null default false,
  legacy_points integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  match_no integer,
  stage text not null check (stage in ('group','r32','r16','qf','sf','third','final')),
  group_label text,
  home_code text references teams(code),
  away_code text references teams(code),
  home_label text,
  away_label text,
  kickoff_at timestamptz not null,
  home_score integer,
  away_score integer,
  multiplier numeric not null default 1,
  status text not null default 'scheduled' check (status in ('scheduled','finished')),
  created_at timestamptz not null default now()
);

create table if not exists predictions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  home_pred integer not null check (home_pred >= 0),
  away_pred integer not null check (away_pred >= 0),
  points_awarded integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, match_id)
);

create table if not exists settings (
  key text primary key,
  value numeric not null
);

create index if not exists predictions_match_idx on predictions(match_id);
create index if not exists matches_kickoff_idx on matches(kickoff_at);

-- create a players row automatically when an auth user is created,
-- reading name/slug from the signup metadata
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.players (id, name, slug)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'name', new.email),
          coalesce(new.raw_user_meta_data->>'slug', new.id::text));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
