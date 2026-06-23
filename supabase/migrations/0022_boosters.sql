-- Booster: each player may pick ONE match per round (matches.stage) whose
-- prediction points are DOUBLED. One booster per round is enforced by
-- unique(player_id, stage); stage is denormalized from matches at insert time.
create table if not exists boosters (
  player_id  uuid not null references players(id) on delete cascade,
  match_id   uuid not null references matches(id) on delete cascade,
  stage      text not null,
  created_at timestamptz not null default now(),
  primary key (player_id, match_id),
  unique (player_id, stage)
);
create index if not exists boosters_match_idx on boosters (match_id);

alter table boosters enable row level security;

-- Read only your own boosters (the rainbow/2x indicators are personal).
drop policy if exists boosters_read_self on boosters;
create policy boosters_read_self on boosters for select to authenticated
  using (player_id = auth.uid());

-- Insert your own booster only while the match is open, and only with the
-- match's real stage (so the unique(player_id, stage) rule can't be bypassed).
drop policy if exists boosters_insert_self on boosters;
create policy boosters_insert_self on boosters for insert to authenticated
  with check (
    player_id = auth.uid()
    and exists (select 1 from matches m where m.id = match_id
                and m.stage = stage
                and m.status = 'scheduled' and m.kickoff_at > now())
  );

-- Remove your own booster only while the match is still open.
drop policy if exists boosters_delete_self on boosters;
create policy boosters_delete_self on boosters for delete to authenticated
  using (
    player_id = auth.uid()
    and exists (select 1 from matches m where m.id = match_id
                and m.status = 'scheduled' and m.kickoff_at > now())
  );

-- Redefine scoring to double a boosted prediction's points. Identical to
-- 0013_fifa_scoring.sql except for the `* (case when booster ...)` factor.
create or replace function recompute_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m matches%rowtype;
  mult numeric;
  actual_out int;
  total int;
  same_out int;
  risky boolean := false;
begin
  select * into m from matches where id = p_match;
  if m.home_score is null or m.away_score is null then
    raise exception 'match has no final score';
  end if;
  mult := coalesce(m.multiplier, 1);
  actual_out := sign(m.home_score - m.away_score);

  if actual_out <> 0 then
    select count(*), count(*) filter (where sign(home_pred - away_pred) = actual_out)
      into total, same_out
      from predictions where match_id = p_match;
    if total > 0 and same_out::numeric / total < 0.20 then
      risky := true;
    end if;
  end if;

  update predictions p set
    points_awarded = mult
      * (case when exists (select 1 from boosters b
                           where b.player_id = p.player_id and b.match_id = p_match)
              then 2 else 1 end)                                                       -- Booster: double
      * (
          (case when sign(p.home_pred - p.away_pred) = actual_out then 10 else 0 end)  -- Correct Outcome
        + (case when p.home_pred = m.home_score then 5 else 0 end)                     -- Correct Goals (Home)
        + (case when p.away_pred = m.away_score then 5 else 0 end)                     -- Correct Goals (Away)
        + (case when p.home_pred - p.away_pred = m.home_score - m.away_score then 5 else 0 end) -- Goal Difference
        + (case when p.home_pred = m.home_score and p.away_pred = m.away_score then 5 else 0 end) -- Score Bonus
        + (case when risky and sign(p.home_pred - p.away_pred) = actual_out then 10 else 0 end)   -- Risky Bonus
      ),
    updated_at = now()
  where p.match_id = p_match;

  update matches set status = 'finished' where id = p_match;
end; $$;

-- Re-score every finished match under the new rule (idempotent).
do $$
declare r record;
begin
  for r in select id from matches where status = 'finished' and home_score is not null and away_score is not null loop
    perform recompute_match(r.id);
  end loop;
end $$;
