-- Bookmaker win-probabilities per match (0..100), populated by the odds cron.
alter table matches add column if not exists prob_home integer;
alter table matches add column if not exists prob_draw integer;
alter table matches add column if not exists prob_away integer;
