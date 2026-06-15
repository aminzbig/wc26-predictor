// Fetch bookmaker H2H odds for WC26 and store implied win-probabilities on each
// upcoming match. Free source: The Odds API (the-odds-api.com), needs ODDS_API_KEY.
// No-ops (exit 0) when no key is set, so the scheduled job stays green.
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY = process.env.ODDS_API_KEY
if (!KEY) { console.log('ODDS_API_KEY not set — skipping odds fetch'); process.exit(0) }
if (!URL || !SERVICE) { console.error('Missing SUPABASE_URL / SERVICE key'); process.exit(1) }

const db = createClient(URL, SERVICE, { auth: { persistSession: false } })

// normalize a country name for matching across data sources
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')
const ALIAS = { // odds-api name (normalized) -> our label (normalized)
  unitedstates: 'usa', czechia: 'czechrepublic', southkorea: 'southkorea',
  coastdivoire: 'ivorycoast', cotedivoire: 'ivorycoast', caboverde: 'capeverde',
  congodr: 'drcongo', turkiye: 'turkey', bosniaandherzegovina: 'bosniaherzegovina',
}
const canon = s => { const n = norm(s); return ALIAS[n] ?? n }

const SPORT = 'soccer_fifa_world_cup'
const api = `https://api.the-odds-api.com/v4/sports/${SPORT}/odds/?apiKey=${KEY}&regions=eu&markets=h2h&oddsFormat=decimal`
const res = await fetch(api)
if (!res.ok) { console.error('odds api', res.status, await res.text()); process.exit(1) }
const events = await res.json()

const { data: ours } = await db.from('matches')
  .select('id,home_label,away_label,status').neq('status', 'finished')
const key = (h, a) => `${canon(h)}|${canon(a)}`
const byPair = new Map((ours || []).map(m => [key(m.home_label, m.away_label), m]))

let updated = 0
for (const ev of events) {
  const mk = ev.bookmakers?.[0]?.markets?.find(m => m.key === 'h2h')
  if (!mk) continue
  const price = name => mk.outcomes.find(o => canon(o.name) === canon(name))?.price
  const oh = price(ev.home_team), oa = price(ev.away_team)
  const od = mk.outcomes.find(o => norm(o.name) === 'draw')?.price
  if (!oh || !oa || !od) continue
  const inv = [1 / oh, 1 / od, 1 / oa]; const s = inv[0] + inv[1] + inv[2]
  const ph = Math.round((inv[0] / s) * 100), pd = Math.round((inv[1] / s) * 100)
  const pa = 100 - ph - pd
  const m = byPair.get(key(ev.home_team, ev.away_team))
  if (!m) continue
  const { error } = await db.from('matches').update({ prob_home: ph, prob_draw: pd, prob_away: pa }).eq('id', m.id)
  if (!error) { updated++; console.log(`odds ${ev.home_team} ${ph}% / ${pd}% / ${pa}% ${ev.away_team}`) }
}
console.log(`done — odds updated on ${updated} matches`)
