-- 0016_social_scale.sql — add a per-post text-size scale to the social wall.
alter table social_posts add column if not exists scale real not null default 1;
alter table social_posts drop constraint if exists social_scale_valid;
alter table social_posts add constraint social_scale_valid
  check (scale in (0.5, 1, 2, 3));
