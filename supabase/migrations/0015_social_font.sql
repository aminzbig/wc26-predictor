-- 0015_social_font.sql — add a per-post font choice to the social wall.
alter table social_posts add column if not exists font text not null default 'sans';
alter table social_posts drop constraint if exists social_font_valid;
alter table social_posts add constraint social_font_valid
  check (font in ('sans','impact','hand','mono','serif','pixel'));
