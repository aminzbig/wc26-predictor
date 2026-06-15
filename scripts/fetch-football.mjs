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
  cotedivoire: 'ivorycoast', caboverde: 'capeverde', congodr: 'drcongo',
  democraticrepublicofcongo: 'drcongo', turkiye: 'turkey',
  bosniaandherzegovina: 'bosniaherzegovina',
}
const canon = s => { const n = norm(s); return ALIAS[n] ?? n }
const pair = (h, a) => `${canon(h)}|${canon(a)}`

const HOUR = 3600e3
const now = Date.now()

// 1. map unmapped matches to API-Football fixtures
const { data: ours } = await db.from('matches')
  .select('id,home_label,away_label,home_code,kickoff_at,status,api_fixture_id,home_lineup,prediction')
const unmapped = (ours || []).filter(m => m.home_code && !m.api_fixture_id && m.status !== 'finished')
if (unmapped.length) {
  const fixtures = await api('fixtures?league=1&season=2026')
  const byPair = new Map()
  for (const f of fixtures) byPair.set(pair(f.teams.home.name, f.teams.away.name), f)
  let mapped = 0
  for (const m of unmapped) {
    const f = byPair.get(pair(m.home_label, m.away_label))
    if (!f) continue
    await db.from('matches').update({
      api_fixture_id: f.fixture.id,
      home_api_team: f.teams.home.id,
      away_api_team: f.teams.away.id,
    }).eq('id', m.id)
    mapped++
  }
  console.log(`mapped ${mapped}/${unmapped.length} fixtures`)
}

// reload with team ids
const { data: all } = await db.from('matches')
  .select('id,home_label,away_label,kickoff_at,status,api_fixture_id,home_api_team,away_api_team,prediction,home_lineup')
const near = (all || []).filter(m => {
  if (!m.api_fixture_id || m.status === 'finished') return false
  const k = new Date(m.kickoff_at).getTime()
  return k - now < 48 * HOUR && k - now > -3 * HOUR // upcoming within 48h (and not long past)
}).sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at)).slice(0, 25)

const teamForm = async teamId => {
  const fx = await api(`fixtures?team=${teamId}&last=5`)
  return fx.filter(f => ['FT', 'AET', 'PEN'].includes(f.fixture.status.short)).map(f => {
    const home = f.teams.home.id === teamId
    const gf = home ? f.goals.home : f.goals.away
    const ga = home ? f.goals.away : f.goals.home
    return { result: gf > ga ? 'W' : gf < ga ? 'L' : 'D', score: `${gf}-${ga}`, opp: (home ? f.teams.away : f.teams.home).name }
  })
}

let pred = 0, lns = 0
for (const m of near) {
  const k = new Date(m.kickoff_at).getTime()
  try {
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
    if (!m.home_lineup && k - now < 3 * HOUR) {
      const lu = await api(`fixtures/lineups?fixture=${m.api_fixture_id}`)
      if (lu.length) {
        const pack = e => ({
          formation: e.formation, coach: e.coach?.name ?? null,
          startXI: (e.startXI || []).map(x => ({ name: x.player.name, number: x.player.number, pos: x.player.pos, grid: x.player.grid })),
        })
        const home = lu.find(e => e.team.id === m.home_api_team)
        const away = lu.find(e => e.team.id === m.away_api_team)
        await db.from('matches').update({
          home_lineup: home ? pack(home) : null,
          away_lineup: away ? pack(away) : null,
        }).eq('id', m.id)
        lns++
      }
    }
  } catch (e) { console.error('match', m.api_fixture_id, e.message) }
}
console.log(`done — predictions/form on ${pred} matches, lineups on ${lns} matches`)
