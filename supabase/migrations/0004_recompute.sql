-- Guard-free core scoring logic, callable by automation (service_role) for the
-- auto-score cron. The admin UI keeps calling score_match (which guards then
-- delegates here).
create or replace function recompute_match(p_match uuid)
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

-- only the service role (automation) and the function owner may call it directly
revoke all on function recompute_match(uuid) from public, anon, authenticated;
grant execute on function recompute_match(uuid) to service_role;

-- admin UI path: guard, then delegate to the shared core
create or replace function score_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only admins can score matches';
  end if;
  perform recompute_match(p_match);
end; $$;
