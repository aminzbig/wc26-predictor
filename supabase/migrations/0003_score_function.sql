-- recompute points for every prediction on a finished match, idempotently.
create or replace function score_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m matches%rowtype;
  px numeric; pd numeric; po numeric; mult numeric;
begin
  select * into m from matches where id = p_match;
  if m.home_score is null or m.away_score is null then
    raise exception 'match has no final score';
  end if;
  select value into px from settings where key='points_exact';
  select value into pd from settings where key='points_diff';
  select value into po from settings where key='points_outcome';
  mult := m.multiplier;

  update predictions p set
    points_awarded = mult * (
      case
        when p.home_pred = m.home_score and p.away_pred = m.away_score then px
        when p.home_pred - p.away_pred = m.home_score - m.away_score then pd
        when sign(p.home_pred - p.away_pred) = sign(m.home_score - m.away_score) then po
        else 0
      end),
    updated_at = now()
  where p.match_id = p_match;

  update matches set status='finished' where id = p_match;
end; $$;

-- leaderboard view: legacy + earned, with hit counts
create or replace view leaderboard as
select
  pl.id, pl.name, pl.flag_code,
  pl.legacy_points + coalesce(sum(pr.points_awarded),0)::int as total,
  count(*) filter (where m.status='finished'
    and pr.home_pred = m.home_score and pr.away_pred = m.away_score) as exact_hits,
  count(*) filter (where m.status='finished'
    and not (pr.home_pred = m.home_score and pr.away_pred = m.away_score)
    and pr.home_pred - pr.away_pred = m.home_score - m.away_score) as diff_hits
from players pl
left join predictions pr on pr.player_id = pl.id
left join matches m on m.id = pr.match_id and m.status='finished'
group by pl.id, pl.name, pl.flag_code, pl.legacy_points;

grant select on leaderboard to authenticated;
