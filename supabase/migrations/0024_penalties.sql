-- Penalty shoot-out score for knockout games that finish level after extra time.
-- Nullable; only set when a match was decided on penalties.
alter table matches add column if not exists home_pens int;
alter table matches add column if not exists away_pens int;
