-- 1. Make the matches table broadcast realtime changes so an open card/leaderboard
--    updates the moment live_*/scores change (the client subscribes in useMatches).
--    Idempotent: only adds the table if the publication exists and lacks it.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
     )
  then
    alter publication supabase_realtime add table matches;
  end if;
end $$;

-- 2. One-time backfill: matches already marked 'finished' with a score (e.g. seeded
--    results, or anything scored before the FT-based scorer existed) never had
--    recompute_match() run, so their predictions show no points. recompute_match
--    is idempotent, so this is safe to re-run.
do $$
declare r record;
begin
  for r in
    select id from matches
    where status = 'finished' and home_score is not null and away_score is not null
  loop
    perform recompute_match(r.id);
  end loop;
end $$;
