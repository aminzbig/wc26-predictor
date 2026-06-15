-- Cached API-Football data per match (predictions, recent form, lineups).
alter table matches add column if not exists api_fixture_id integer;
alter table matches add column if not exists home_api_team integer;
alter table matches add column if not exists away_api_team integer;
alter table matches add column if not exists prediction jsonb;   -- {winner, advice, percent:{home,draw,away}, goals:{home,away}}
alter table matches add column if not exists home_form jsonb;    -- [{result:'W'|'D'|'L', score:'2-1', opp:'...'}]
alter table matches add column if not exists away_form jsonb;
alter table matches add column if not exists home_lineup jsonb;  -- {formation, coach, startXI:[{name,number,pos,grid}]}
alter table matches add column if not exists away_lineup jsonb;
