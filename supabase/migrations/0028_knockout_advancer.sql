-- Knockout advancer: the result point follows who ADVANCES.
--
-- Until now the +10 "Correct Outcome" point was awarded for the sign of the
-- played (FT/extra-time) score in every round. In knockouts that conflated two
-- different skills — reading the match vs. calling who goes through — and created
-- two unfair edges:
--   * A player who predicted a tie and correctly tapped the side that advanced
--     (winner_side) scored nothing for that call (e.g. predicted 1-1 + Canada,
--     Canada won 0-1 in regulation -> advancer call paid 0).
--   * In a penalty shoot-out the played result is a DRAW, so a player who boldly
--     predicted a decisive win for the side that actually advanced had their
--     outcome marked wrong.
--
-- Fix (knockout rounds only — group scoring is unchanged): the +10 result point
-- is earned for correctly predicting WHO ADVANCES (regulation, extra time, or
-- penalties) instead of the played-score sign. Everything else is identical, so
-- in any match decided in normal/extra time the two are the same and nothing
-- changes; they differ only for penalty matches and for tie-predictors whose
-- side won outright.
--
-- Details:
--   * Predicted advancer = the higher side of the prediction; on a tie, the
--     tapped side (winner_side). A tie with no winner_side = no call = no point.
--   * Actual advancer = the higher side of the FT/ET score; if level, the side
--     that won the penalty shoot-out (home_pens/away_pens).
--   * The advancer point is EXEMPT from the way-off => 0 rule (you keep it even
--     when the scoreline is zeroed for being far off); the scoreline components
--     are still zeroed. It is multiplied by the match multiplier and the booster
--     like everything else.
--   * Group stage is byte-for-byte the same as before (the result point there is
--     still the played W/D/L, inside the way-off gate).
--
-- Additive for the one knockout already played: re-running recompute_match tops
-- up the two tie-predictors who backed Canada and takes points from no one.
create or replace function recompute_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m matches%rowtype;
  mult numeric;
  actual_out int;
  adv_actual text;  -- 'home'/'away' side that advances (knockouts), else null
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

  -- Who actually advances: the score winner, or the shoot-out winner if level.
  adv_actual := case
    when actual_out > 0 then 'home'
    when actual_out < 0 then 'away'
    when m.home_pens is not null and m.away_pens is not null
      then case when m.home_pens > m.away_pens then 'home' else 'away' end
    else null
  end;

  -- Risky bonus is unchanged: a contrarian-but-correct call on the played result
  -- (decisive only; distribution-dependent across the whole match).
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
              then 2 else 1 end)                                                   -- Booster: double
      * (
          -- Knockout advancer result point (exempt from the way-off rule).
          (case
             when m.stage <> 'group'
                  and (case when p.home_pred > p.away_pred then 'home'
                            when p.away_pred > p.home_pred then 'away'
                            else p.winner_side end) = adv_actual
               then 10 else 0
           end)                                                                    -- Correct Advancer (knockout)
          -- Scoreline points (+ the group result point), subject to way-off => 0.
        + (case
             when far_off
                  and abs(p.home_pred - m.home_score) + abs(p.away_pred - m.away_score) >= 5
               then 0                                                              -- Way-off: 0 for the scoreline
             else
               (case when m.stage = 'group' and sign(p.home_pred - p.away_pred) = actual_out then 10 else 0 end) -- Correct Outcome (group)
             + (case when p.home_pred = m.home_score then 5 else 0 end)            -- Correct Goals (Home)
             + (case when p.away_pred = m.away_score then 5 else 0 end)            -- Correct Goals (Away)
             + (case when p.home_pred - p.away_pred = m.home_score - m.away_score then 5 else 0 end) -- Goal Difference
             + (case when p.home_pred = m.home_score and p.away_pred = m.away_score then 5 else 0 end) -- Score Bonus
             + (case when risky and sign(p.home_pred - p.away_pred) = actual_out then 10 else 0 end)  -- Risky Bonus
           end)
        ),
    updated_at = now()
  where p.match_id = p_match;

  update matches set status = 'finished' where id = p_match;
end; $$;
