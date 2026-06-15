// Reliable per-minute ticker for live scores, instant Full-Time scoring, and
// pre-kickoff lineups. Triggered by pg_cron (see migration 0012) every minute
// because GitHub Actions throttles short-interval crons to ~once every 6 hours.
//
// One API-Football read per active match-day (only when a match is live, just
// finished, or about to start) — so API usage stays near zero outside of match
// windows. Scoring uses API-Football's FT status (real-time) instead of the
// openfootball dataset, which lagged 30+ minutes behind.
//
// Env (Supabase function secrets): APIFOOTBALL_KEY, CRON_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const HOUR = 3600_000
const LIVE_SHORT = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'])
const FT_SHORT = new Set(['FT', 'AET', 'PEN'])

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  // Auth: pg_cron sends `Authorization: Bearer <CRON_SECRET>`.
  const secret = Deno.env.get('CRON_SECRET')
  const auth = req.headers.get('Authorization') ?? ''
  if (!secret || auth !== `Bearer ${secret}`) return json({ error: 'unauthorized' }, 401)

  const KEY = Deno.env.get('APIFOOTBALL_KEY')
  const URL = Deno.env.get('SUPABASE_URL')
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!KEY) return json({ skipped: 'APIFOOTBALL_KEY not set' })
  if (!URL || !SERVICE) return json({ error: 'missing supabase env' }, 500)

  const db = createClient(URL, SERVICE, { auth: { persistSession: false } })
  const api = async (path: string) => {
    const r = await fetch('https://v3.football.api-sports.io/' + path, { headers: { 'x-apisports-key': KEY } })
    if (!r.ok) throw new Error(`api ${path} -> ${r.status}`)
    return (await r.json()).response ?? []
  }

  const now = Date.now()
  const { data: matches, error } = await db.from('matches')
    .select('id,api_fixture_id,home_api_team,away_api_team,status,kickoff_at,live_home,home_lineup')
    .neq('status', 'finished')
  if (error) return json({ error: error.message }, 500)

  // Which matches need attention right now?
  const active = (matches ?? []).filter((m) => {
    if (!m.api_fixture_id) return false
    const ko = new Date(m.kickoff_at).getTime()
    return ko <= now && now - ko <= 4 * HOUR // kicked off within the last 4h
  })
  const lineupNeeded = (matches ?? []).filter((m) => {
    if (!m.api_fixture_id || m.home_lineup) return false
    const ko = new Date(m.kickoff_at).getTime()
    return ko - now > 0 && ko - now <= 3 * HOUR // starts within the next 3h
  })

  if (active.length === 0 && lineupNeeded.length === 0) {
    return json({ idle: true, checked: matches?.length ?? 0 })
  }

  let live = 0, scored = 0, cleared = 0, lineups = 0

  // --- Live scores + Full-Time scoring -------------------------------------
  if (active.length) {
    // One fixtures-by-date call per distinct UTC match-day (usually one).
    const dates = [...new Set(active.map((m) => new Date(m.kickoff_at).toISOString().slice(0, 10)))]
    const byFixture = new Map<number, any>()
    for (const d of dates) {
      const fixtures = await api(`fixtures?league=1&season=2026&date=${d}&timezone=UTC`)
      for (const f of fixtures) byFixture.set(f.fixture.id, f)
    }

    for (const m of active) {
      const f = byFixture.get(m.api_fixture_id)
      if (!f) continue
      const short = f.fixture.status?.short
      if (FT_SHORT.has(short)) {
        const hg = f.goals?.home, ag = f.goals?.away
        if (hg == null || ag == null) continue
        await db.from('matches')
          .update({ home_score: hg, away_score: ag, live_home: null, live_away: null, live_minute: null, live_status: null })
          .eq('id', m.id)
        const { error: e } = await db.rpc('recompute_match', { p_match: m.id }) // sets status='finished' + awards points
        if (e) { console.error('recompute', m.id, e.message); continue }
        scored++
      } else if (LIVE_SHORT.has(short)) {
        await db.from('matches').update({
          live_home: f.goals?.home ?? 0, live_away: f.goals?.away ?? 0,
          live_minute: f.fixture.status?.elapsed ?? null, live_status: short,
        }).eq('id', m.id)
        live++
      } else if (m.live_home != null) {
        await db.from('matches').update({ live_home: null, live_away: null, live_minute: null, live_status: null }).eq('id', m.id)
        cleared++
      }
    }
  }

  // --- Pre-kickoff lineups (lightweight; club history enriched later) -------
  for (const m of lineupNeeded) {
    try {
      const lu = await api(`fixtures/lineups?fixture=${m.api_fixture_id}`)
      if (!lu.length) continue
      const pack = (e: any) => ({
        formation: e.formation, coach: e.coach?.name ?? null,
        startXI: (e.startXI ?? []).map((x: any) => ({
          id: x.player.id, name: x.player.name, number: x.player.number, pos: x.player.pos, grid: x.player.grid,
        })),
      })
      const home = lu.find((e: any) => e.team.id === m.home_api_team)
      const away = lu.find((e: any) => e.team.id === m.away_api_team)
      await db.from('matches').update({
        home_lineup: home ? pack(home) : null,
        away_lineup: away ? pack(away) : null,
      }).eq('id', m.id)
      lineups++
    } catch (e) { console.error('lineup', m.api_fixture_id, (e as Error).message) }
  }

  return json({ live, scored, cleared, lineups })
})
