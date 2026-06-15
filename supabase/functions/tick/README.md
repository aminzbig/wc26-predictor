# `tick` — live scores, FT scoring, lineups

Runs every minute via **pg_cron** (migration `0012_cron.sql`) because GitHub
Actions throttled the old `*/5` "Live scores" cron to ~once every 6 hours, so
live scores, instant Full-Time scoring, and pre-kickoff lineups never landed in
time.

Each tick (only when a match is live, just finished, or starting within 3h):

- **Live**: writes `live_home/away/minute/status` from API-Football.
- **Full-Time**: when the fixture hits FT/AET/PEN, writes the final score and
  calls `recompute_match()` — points appear within ~1 min, no openfootball lag.
- **Lineups**: fetches the starting XI in the pre-kickoff window (club history is
  enriched later by the slower `fetch-football.mjs` cron).

## One-time activation

```bash
# 1. Pick a random secret and set it as a function secret
export CRON_SECRET="$(openssl rand -hex 24)"
supabase secrets set CRON_SECRET="$CRON_SECRET" APIFOOTBALL_KEY="<your key>"

# 2. Deploy (no JWT — it authenticates via the CRON_SECRET bearer header)
supabase functions deploy tick --no-verify-jwt

# 3. Store the SAME secret in Vault so the cron job can send it, then apply migrations
#    (run the SQL in the dashboard SQL editor, or psql):
#      select vault.create_secret('<the CRON_SECRET value>', 'cron_secret');
supabase db push
```

Verify: `select * from cron.job;` shows `tick-live`, and
`select * from cron.job_run_details order by start_time desc limit 5;` shows
recent successful runs. Function logs are in the Supabase dashboard.
