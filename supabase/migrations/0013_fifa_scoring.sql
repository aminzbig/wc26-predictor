-- Match the official FIFA World Cup 2026 Match Predictor scoring, which is
-- ADDITIVE (sum every component that applies) rather than best-of-three:
--   Correct Outcome ............ +10
--   Correct Goals (Home) ....... +5
--   Correct Goals (Away) ....... +5
--   Correct Goal Difference .... +5
--   Correct Score Bonus ........ +5   (exact scoreline)
--   Risky Bonus ................ +10  (correct Home/Away win predicted by <20% of users)
-- The app's per-match `multiplier` is kept (FIFA's analogous feature is the
-- per-round 2X Booster, which needs UI we don't have yet — see app TODO).
-- Knockout-only components (First Team/Player to Score) and the Round bonus
-- need extra prediction inputs / round modelling and are intentionally omitted.
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

  -- Risky bonus: only for a Home/Away win (not a draw) predicted by < 20% of users.
  if actual_out <> 0 then
    select count(*), count(*) filter (where sign(home_pred - away_pred) = actual_out)
      into total, same_out
      from predictions where match_id = p_match;
    if total > 0 and same_out::numeric / total < 0.20 then
      risky := true;
    end if;
  end if;

  update predictions p set
    points_awarded = mult * (
        (case when sign(p.home_pred - p.away_pred) = actual_out then 10 else 0 end)                  -- Correct Outcome
      + (case when p.home_pred = m.home_score then 5 else 0 end)                                      -- Correct Goals (Home)
      + (case when p.away_pred = m.away_score then 5 else 0 end)                                      -- Correct Goals (Away)
      + (case when p.home_pred - p.away_pred = m.home_score - m.away_score then 5 else 0 end)         -- Correct Goal Difference
      + (case when p.home_pred = m.home_score and p.away_pred = m.away_score then 5 else 0 end)       -- Correct Score Bonus
      + (case when risky and sign(p.home_pred - p.away_pred) = actual_out then 10 else 0 end)         -- Risky Bonus
    ),
    updated_at = now()
  where p.match_id = p_match;

  update matches set status = 'finished' where id = p_match;
end; $$;

-- Re-score every already-finished match under the new rules (idempotent).
do $$
declare r record;
begin
  for r in select id from matches where status = 'finished' and home_score is not null and away_score is not null loop
    perform recompute_match(r.id);
  end loop;
end $$;
