-- "Way-off" rule: a prediction whose total goal error (|home_pred - home_score|
-- + |away_pred - away_score|) is >= 5 scores 0 for the whole match. Applies ONLY
-- to matches kicking off on/after the cutoff below (going-forward only); earlier
-- matches keep their original scores, so this migration deliberately does NOT
-- re-score already-finished matches. Threshold (5) and cutoff timestamp are
-- mirrored in src/lib/scoring.ts (FAR_OFF_THRESHOLD / FAR_OFF_RULE_FROM) -- keep
-- the two in sync. Otherwise identical to 0022_boosters.sql.
create or replace function recompute_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m matches%rowtype;
  mult numeric;
  actual_out int;
  total int;
  same_out int;
  risky boolean := false;
  far_off boolean;
begin
  select * into m from matches where id = p_match;
  if m.home_score is null or m.away_score is null then
    raise exception 'match has no final score';
  end if;
  mult := coalesce(m.multiplier, 1);
  actual_out := sign(m.home_score - m.away_score);
  far_off := m.kickoff_at >= '2026-06-24T00:00:00Z'::timestamptz;

  if actual_out <> 0 then
    select count(*), count(*) filter (where sign(home_pred - away_pred) = actual_out)
      into total, same_out
      from predictions where match_id = p_match;
    if total > 0 and same_out::numeric / total < 0.20 then
      risky := true;
    end if;
  end if;

  update predictions p set
    points_awarded = case
      when far_off
           and abs(p.home_pred - m.home_score) + abs(p.away_pred - m.away_score) >= 5
        then 0                                                                       -- Way-off: 0 for the whole match
      else mult
        * (case when exists (select 1 from boosters b
                             where b.player_id = p.player_id and b.match_id = p_match)
                then 2 else 1 end)                                                   -- Booster: double
        * (
            (case when sign(p.home_pred - p.away_pred) = actual_out then 10 else 0 end)  -- Correct Outcome
          + (case when p.home_pred = m.home_score then 5 else 0 end)                     -- Correct Goals (Home)
          + (case when p.away_pred = m.away_score then 5 else 0 end)                     -- Correct Goals (Away)
          + (case when p.home_pred - p.away_pred = m.home_score - m.away_score then 5 else 0 end) -- Goal Difference
          + (case when p.home_pred = m.home_score and p.away_pred = m.away_score then 5 else 0 end) -- Score Bonus
          + (case when risky and sign(p.home_pred - p.away_pred) = actual_out then 10 else 0 end)   -- Risky Bonus
        )
      end,
    updated_at = now()
  where p.match_id = p_match;

  update matches set status = 'finished' where id = p_match;
end; $$;
