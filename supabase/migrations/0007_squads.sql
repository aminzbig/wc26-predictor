-- Cached squad lists (for tap-a-player info on the formation pitch).
alter table matches add column if not exists home_squad jsonb; -- [{id,name,age,number,position,photo}]
alter table matches add column if not exists away_squad jsonb;
