// Cache API-Football data (predictions, last-5 form, lineups) onto our matches.
// Needs APIFOOTBALL_KEY (Pro plan — current season). No-ops if the key is unset.
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY = process.env.APIFOOTBALL_KEY
if (!KEY) { console.log('APIFOOTBALL_KEY not set — skipping'); process.exit(0) }
if (!URL || !SERVICE) { console.error('Missing SUPABASE_URL / SERVICE key'); process.exit(1) }

const db = createClient(URL, SERVICE, { auth: { persistSession: false } })
const api = async path => {
  const r = await fetch('https://v3.football.api-sports.io/' + path, { headers: { 'x-apisports-key': KEY } })
  if (!r.ok) throw new Error(`api ${path} -> ${r.status}`)
  const j = await r.json()
  if (j.errors && (Array.isArray(j.errors) ? j.errors.length : Object.keys(j.errors).length))
    console.error('api errors', path, JSON.stringify(j.errors))
  return j.response || []
}

// canonical country name for matching across sources
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')
const ALIAS = {
  unitedstates: 'usa', czechia: 'czechrepublic', korearepublic: 'southkorea',
  cotedivoire: 'ivorycoast', caboverde: 'capeverde', capeverdeislands: 'capeverde',
  congodr: 'drcongo',
  democraticrepublicofcongo: 'drcongo', turkiye: 'turkey',
  bosniaandherzegovina: 'bosniaherzegovina',
}
const canon = s => { const n = norm(s); return ALIAS[n] ?? n }
const pair = (h, a) => `${canon(h)}|${canon(a)}`

const HOUR = 3600e3
const now = Date.now()
const sleep = ms => new Promise(r => setTimeout(r, ms))

// 1. map unmapped matches to API-Football fixtures (+ backfill venue)
const { data: ours } = await db.from('matches')
  .select('id,home_label,away_label,home_code,kickoff_at,status,api_fixture_id,home_lineup,prediction,venue_name')
const unmapped = (ours || []).filter(m => m.home_code && !m.api_fixture_id && m.status !== 'finished')
// Matches already linked but missing venue (the static stadium/city) get it backfilled.
const needVenue = (ours || []).filter(m => m.api_fixture_id && !m.venue_name)
if (unmapped.length || needVenue.length) {
  const fixtures = await api('fixtures?league=1&season=2026')
  const byPair = new Map(), byId = new Map()
  for (const f of fixtures) { byPair.set(pair(f.teams.home.name, f.teams.away.name), f); byId.set(f.fixture.id, f) }
  let mapped = 0
  for (const m of unmapped) {
    const f = byPair.get(pair(m.home_label, m.away_label))
    if (!f) continue
    await db.from('matches').update({
      api_fixture_id: f.fixture.id,
      home_api_team: f.teams.home.id,
      away_api_team: f.teams.away.id,
      venue_name: f.fixture.venue?.name ?? null,
      venue_city: f.fixture.venue?.city ?? null,
    }).eq('id', m.id)
    mapped++
  }
  let venued = 0
  for (const m of needVenue) {
    const f = byId.get(m.api_fixture_id)
    if (!f?.fixture.venue) continue
    await db.from('matches').update({
      venue_name: f.fixture.venue.name ?? null,
      venue_city: f.fixture.venue.city ?? null,
    }).eq('id', m.id)
    venued++
  }
  console.log(`mapped ${mapped}/${unmapped.length} fixtures · venue ${venued}/${needVenue.length}`)
}

// reload with team ids
const { data: all } = await db.from('matches')
  .select('id,home_label,away_label,kickoff_at,status,api_fixture_id,home_api_team,away_api_team,prediction,home_lineup,away_lineup,home_squad')
const near = (all || []).filter(m => {
  if (!m.api_fixture_id || m.status === 'finished') return false
  const k = new Date(m.kickoff_at).getTime()
  return k - now > -3 * HOUR // any upcoming (or recently kicked-off) match — fetch form/prediction ahead of the lineup window
}).sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at)).slice(0, 30)

const teamForm = async teamId => {
  const fx = await api(`fixtures?team=${teamId}&last=5`)
  return fx.filter(f => ['FT', 'AET', 'PEN'].includes(f.fixture.status.short)).map(f => {
    const home = f.teams.home.id === teamId
    const gf = home ? f.goals.home : f.goals.away
    const ga = home ? f.goals.away : f.goals.home
    return { result: gf > ga ? 'W' : gf < ga ? 'L' : 'D', score: `${gf}-${ga}`,
      opp: (home ? f.teams.away : f.teams.home).name, date: f.fixture.date, comp: f.league.name }
  })
}

// A team's World Cup 2026 fixtures (memoized per run — same regardless of which
// match we're enriching; we filter by date per match below).
const wcFixturesCache = new Map()
const teamWcFixtures = async teamId => {
  if (wcFixturesCache.has(teamId)) return wcFixturesCache.get(teamId)
  const fx = await api(`fixtures?league=1&season=2026&team=${teamId}`)
  wcFixturesCache.set(teamId, fx)
  return fx
}
// Per-game stats (possession / shots on target / corners) for one team, memoized.
const statsCache = new Map()
const fixtureStats = async (fixtureId, teamId) => {
  const key = `${fixtureId}:${teamId}`
  if (statsCache.has(key)) return statsCache.get(key)
  let out = { poss: null, sot: null, cor: null }
  try {
    const r = await api(`fixtures/statistics?fixture=${fixtureId}&team=${teamId}`)
    const s = {}
    for (const x of (r[0]?.statistics || [])) s[x.type] = x.value
    out = { poss: s['Ball Possession'] ?? null, sot: s['Shots on Goal'] ?? null, cor: s['Corner Kicks'] ?? null }
  } catch { /* ignore */ }
  statsCache.set(key, out)
  return out
}
// This team's finished WC-2026 games BEFORE `beforeMs`, oldest→newest, with stats.
const teamWcRun = async (teamId, beforeMs) => {
  const fx = await teamWcFixtures(teamId)
  const done = fx
    .filter(f => ['FT', 'AET', 'PEN'].includes(f.fixture.status.short) && new Date(f.fixture.date).getTime() < beforeMs)
    .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))
  const run = []
  for (const f of done) {
    const home = f.teams.home.id === teamId
    const gf = home ? f.goals.home : f.goals.away
    const ga = home ? f.goals.away : f.goals.home
    const st = await fixtureStats(f.fixture.id, teamId)
    await sleep(250)
    run.push({ id: f.fixture.id, date: f.fixture.date, opp: (home ? f.teams.away : f.teams.home).name,
      gf, ga, result: gf > ga ? 'W' : gf < ga ? 'L' : 'D', poss: st.poss, sot: st.sot, cor: st.cor })
  }
  return run
}

// player club history (current + previous team), memoized per run
const clubCache = new Map()
const playerClubs = async id => {
  if (!id) return { current: null, prev: null }
  if (clubCache.has(id)) return clubCache.get(id)
  let res = { current: null, prev: null }
  try {
    const tr = (await api(`transfers?player=${id}`))[0]?.transfers || []
    if (tr[0]) res = { current: tr[0].teams?.in?.name ?? null, prev: tr[0].teams?.out?.name ?? null }
  } catch { /* ignore */ }
  clubCache.set(id, res)
  return res
}

// squad fetch, memoized per team for the run
const squadCache = new Map()
const teamSquad = async teamId => {
  if (squadCache.has(teamId)) return squadCache.get(teamId)
  const r = await api(`players/squads?team=${teamId}`)
  const players = (r[0]?.players || []).map(p => ({ id: p.id, name: p.name, age: p.age, number: p.number, position: p.position, photo: p.photo }))
  squadCache.set(teamId, players)
  return players
}

let pred = 0, lns = 0, sqd = 0, wcr = 0
for (const m of near) {
  const k = new Date(m.kickoff_at).getTime()
  try {
    // World Cup run — refetched each pass so it stays current as teams play (cheap
    // via the per-run caches above). Both teams' finished WC games before kickoff.
    if (m.home_api_team && m.away_api_team) {
      const home_wc_run = await teamWcRun(m.home_api_team, k)
      const away_wc_run = await teamWcRun(m.away_api_team, k)
      await db.from('matches').update({ home_wc_run, away_wc_run }).eq('id', m.id)
      wcr++
    }
    if (!m.prediction) {
      const pr = (await api(`predictions?fixture=${m.api_fixture_id}`))[0]
      const prediction = pr ? {
        winner: pr.predictions?.winner?.name ?? null,
        comment: pr.predictions?.winner?.comment ?? null,
        advice: pr.predictions?.advice ?? null,
        percent: pr.predictions?.percent ?? null,
        goals: pr.predictions?.goals ?? null,
      } : null
      const home_form = m.home_api_team ? await teamForm(m.home_api_team) : null
      const away_form = m.away_api_team ? await teamForm(m.away_api_team) : null
      await db.from('matches').update({ prediction, home_form, away_form }).eq('id', m.id)
      pred++
    }
    // The `tick` Edge Function fetches lineups in the pre-kickoff window but
    // stores them lightweight (no club history). Here on the slow cron we either
    // fetch a missing lineup fresh, or enrich an existing one with NOW/PREV club.
    const needsClub = lu => lu && Array.isArray(lu.startXI) && lu.startXI.some(p => p.current_team === undefined)
    if (!m.home_lineup && k - now < 3 * HOUR) {
      const lu = await api(`fixtures/lineups?fixture=${m.api_fixture_id}`)
      if (lu.length) {
        const packTeam = async e => {
          const startXI = []
          for (const x of (e.startXI || [])) {
            const c = await playerClubs(x.player.id) // throttled below to respect per-minute limit
            startXI.push({ id: x.player.id, name: x.player.name, number: x.player.number, pos: x.player.pos, grid: x.player.grid, current_team: c.current, prev_team: c.prev })
            await sleep(250)
          }
          return { formation: e.formation, coach: e.coach?.name ?? null, startXI }
        }
        const home = lu.find(e => e.team.id === m.home_api_team)
        const away = lu.find(e => e.team.id === m.away_api_team)
        await db.from('matches').update({
          home_lineup: home ? await packTeam(home) : null,
          away_lineup: away ? await packTeam(away) : null,
        }).eq('id', m.id)
        lns++
      }
    } else if (needsClub(m.home_lineup) || needsClub(m.away_lineup)) {
      const enrich = async lu => {
        if (!lu || !Array.isArray(lu.startXI)) return lu
        const startXI = []
        for (const x of lu.startXI) {
          if (x.current_team !== undefined) { startXI.push(x); continue }
          const c = await playerClubs(x.id)
          startXI.push({ ...x, current_team: c.current, prev_team: c.prev })
          await sleep(250)
        }
        return { ...lu, startXI }
      }
      await db.from('matches').update({
        home_lineup: await enrich(m.home_lineup),
        away_lineup: await enrich(m.away_lineup),
      }).eq('id', m.id)
      lns++
    }
    if (!m.home_squad && m.home_api_team && m.away_api_team) {
      const home_squad = await teamSquad(m.home_api_team)
      const away_squad = await teamSquad(m.away_api_team)
      await db.from('matches').update({ home_squad, away_squad }).eq('id', m.id)
      sqd++
    }
  } catch (e) { console.error('match', m.api_fixture_id, e.message) }
}
console.log(`done — predictions/form on ${pred} matches, lineups on ${lns}, squads on ${sqd}, wc-run on ${wcr}`)
