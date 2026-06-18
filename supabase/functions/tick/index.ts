// Reliable per-minute ticker for live scores, instant Full-Time scoring, and
// pre-kickoff lineups. Triggered by pg_cron (see migration 0012) every minute
// because GitHub Actions throttles short-interval crons to ~once every 6 hours.
//
// Self-healing: also maps any match that isn't yet linked to an API-Football
// fixture (by team name, with aliases) from the fixtures it already fetches —
// so a name-mismatch in the seed (e.g. "Cape Verde" vs "Cape Verde Islands")
// can't silently leave a match with no live score / no points.
//
// Scoring uses API-Football's FT status (real-time), not the openfootball
// dataset, which lagged 30+ minutes behind.
//
// Env (Supabase function secrets): APIFOOTBALL_KEY, CRON_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const HOUR = 3600_000
const LIVE_SHORT = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'])
const FT_SHORT = new Set(['FT', 'AET', 'PEN'])

// Live scores feel near-instant by polling faster than the 1-minute cron floor:
// when a match is live, this invocation keeps re-polling every LIVE_POLL_SECONDS
// (default 15s) until it nears LOOP_BUDGET_MS, then returns — the next cron tick
// picks up seamlessly. Off the pitch (no live match) it does a single pass and
// returns immediately, so quota is only spent during actual live play.
const LIVE_POLL_SECONDS = Number(Deno.env.get('LIVE_POLL_SECONDS') ?? '15')
const LOOP_BUDGET_MS = 50_000 // stay safely under the 60s cron interval
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

// canonical country name for matching across sources (mirrors fetch-football.mjs)
const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')
const ALIAS: Record<string, string> = {
  unitedstates: 'usa', czechia: 'czechrepublic', korearepublic: 'southkorea',
  cotedivoire: 'ivorycoast', caboverde: 'capeverde', capeverdeislands: 'capeverde',
  congodr: 'drcongo', democraticrepublicofcongo: 'drcongo', turkiye: 'turkey',
  bosniaandherzegovina: 'bosniaherzegovina',
}
const canon = (s: string) => { const n = norm(s); return ALIAS[n] ?? n }
const pair = (h: string, a: string) => `${canon(h)}|${canon(a)}`

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

  // One polling pass: load relevant matches, fetch fixtures, update live scores /
  // FT results / lineups. Returns the per-pass counts; `live` > 0 means at least
  // one match is currently in play, which is what drives the fast re-poll loop.
  const runPass = async () => {
    const now = Date.now()
    const { data: matches, error } = await db.from('matches')
      .select('id,api_fixture_id,home_api_team,away_api_team,home_label,away_label,status,kickoff_at,live_home,home_lineup')
      .neq('status', 'finished')
    if (error) throw new Error(error.message)

    // Matches worth a look: kicked off within the last 12h (live / FT catch-up) or
    // starting within the next 3h (lineups). Generous so a cron gap can't strand one.
    const relevant = (matches ?? []).filter((m) => {
      const ko = new Date(m.kickoff_at).getTime()
      return ko >= now - 12 * HOUR && ko <= now + 3 * HOUR
    })
    if (relevant.length === 0) return { idle: true, checked: matches?.length ?? 0, live: 0 }

    // One fixtures-by-date call per distinct UTC match-day (usually one or two).
    const dates = [...new Set(relevant.map((m) => new Date(m.kickoff_at).toISOString().slice(0, 10)))]
    const byId = new Map<number, any>()
    const byPair = new Map<string, any>()
    for (const d of dates) {
      const fixtures = await api(`fixtures?league=1&season=2026&date=${d}&timezone=UTC`)
      for (const f of fixtures) { byId.set(f.fixture.id, f); byPair.set(pair(f.teams.home.name, f.teams.away.name), f) }
    }

    let live = 0, scored = 0, cleared = 0, lineups = 0, mapped = 0
    for (const m of relevant) {
      let fixtureId = m.api_fixture_id
      let homeTeam = m.home_api_team, awayTeam = m.away_api_team

      // Self-heal: link an unmapped match to its fixture by team name.
      if (!fixtureId && m.home_label && m.away_label) {
        const f = byPair.get(pair(m.home_label, m.away_label))
        if (f) {
          fixtureId = f.fixture.id; homeTeam = f.teams.home.id; awayTeam = f.teams.away.id
          await db.from('matches').update({
            api_fixture_id: fixtureId, home_api_team: homeTeam, away_api_team: awayTeam,
            venue_name: f.fixture.venue?.name ?? null, venue_city: f.fixture.venue?.city ?? null,
          }).eq('id', m.id)
          mapped++
        }
      }
      if (!fixtureId) continue

      const ko = new Date(m.kickoff_at).getTime()
      const f = byId.get(fixtureId)

      // Live score + Full-Time scoring (only once the match has kicked off).
      if (ko <= now && f) {
        const short = f.fixture.status?.short
        if (FT_SHORT.has(short)) {
          const hg = f.goals?.home, ag = f.goals?.away
          if (hg != null && ag != null) {
            await db.from('matches')
              .update({ home_score: hg, away_score: ag, live_home: null, live_away: null, live_minute: null, live_status: null })
              .eq('id', m.id)
            const { error: e } = await db.rpc('recompute_match', { p_match: m.id }) // sets status='finished' + awards points
            if (e) console.error('recompute', m.id, e.message); else scored++
          }
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

      // Pre-kickoff lineups (lightweight; club history enriched later by fetch-football).
      if (ko > now && ko - now <= 3 * HOUR && !m.home_lineup) {
        try {
          const lu = await api(`fixtures/lineups?fixture=${fixtureId}`)
          if (lu.length) {
            const packLineup = (e: any) => ({
              formation: e.formation, coach: e.coach?.name ?? null,
              startXI: (e.startXI ?? []).map((x: any) => ({
                id: x.player.id, name: x.player.name, number: x.player.number, pos: x.player.pos, grid: x.player.grid,
              })),
            })
            const home = lu.find((e: any) => e.team.id === homeTeam)
            const away = lu.find((e: any) => e.team.id === awayTeam)
            await db.from('matches').update({
              home_lineup: home ? packLineup(home) : null,
              away_lineup: away ? packLineup(away) : null,
            }).eq('id', m.id)
            lineups++
          }
        } catch (e) { console.error('lineup', fixtureId, (e as Error).message) }
      }
    }

    return { mapped, live, scored, cleared, lineups }
  }

  // First pass always runs. While a match is live, keep re-polling every
  // LIVE_POLL_SECONDS until we'd exceed the loop budget — turning the 60s cron
  // floor into ~15s live updates without overlapping the next cron tick.
  const start = Date.now()
  let pass = await runPass()
  let polls = 1
  while (pass.live > 0 && Date.now() - start + LIVE_POLL_SECONDS * 1000 < LOOP_BUDGET_MS) {
    await sleep(LIVE_POLL_SECONDS * 1000)
    pass = await runPass()
    polls++
  }

  return json({ ...pass, polls, pollEverySec: LIVE_POLL_SECONDS })
})
