-- Live in-progress score for matches currently being played.
alter table matches add column if not exists live_home integer;
alter table matches add column if not exists live_away integer;
alter table matches add column if not exists live_minute integer;
alter table matches add column if not exists live_status text; -- '1H','HT','2H','ET','P', etc.
