-- Each team's run in the current World Cup (finished games before this kickoff)
-- with per-game stats, for the detail view's "World Cup run" section.
-- Shape: [{id, date, opp, gf, ga, result:'W'|'D'|'L', poss, sot, cor}]
alter table matches add column if not exists home_wc_run jsonb;
alter table matches add column if not exists away_wc_run jsonb;
