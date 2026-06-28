-- Knockout advancer pick: which side the player thinks goes through when they
-- predict a level scoreline (e.g. 1-1). Side-based ('home'/'away') because
-- early-round knockout slots have no resolved team code at prediction time.
-- Captured/displayed only — recompute_match() is intentionally unchanged.
alter table predictions
  add column if not exists winner_side text
  check (winner_side in ('home','away'));
