// Reconcile knockout team assignments against API-Football — the AUTHORITATIVE
// source for who actually plays whom in the bracket.
//
// WHY THIS EXISTS
// resolve-knockout.ts fills knockout slots from our OWN projection
// (src/lib/bracket.ts). The group-winner / runner-up slots ('1A','2B') are
// unambiguous, but the eight best-third-placed slots ('3A/B/C/D/F') are assigned
// by a generic bipartite matching (assignThirdPlaces) that is NOT FIFA's official
// allocation table. When more than one valid matching exists it can pick a
// different — wrong — one. That put Ecuador and Senegal (and Algeria) in the
// wrong Round-of-32 games until this script corrected them.
//
// Once FIFA seeds the bracket, API-Football exposes the REAL fixtures
// (round "Round of 32"/"Round of 16"/… with both real teams). This script pulls
// those and overwrites any knockout row whose teams disagree — so we never again
// depend on us re-deriving FIFA's table.
//
// PREDICTIONS ARE SAFE. Predictions are keyed by (player_id, match_id) and store
// a scoreline by SIDE (home_pred / away_pred / winner_side), never by team. We
// match each of our rows to its API fixture by kickoff time and reconcile each
// side independently, so a corrected opponent inherits the existing scoreline
// automatically ("Mexico 2 Senegal 1" becomes "Mexico 2 Ecuador 1"). Finished
// matches are never touched, so results/history are immutable.
//
// The code<->name map is derived from our OWN group rows, so it needs no upkeep:
// whatever code we use for a country in the group stage is what we write here.
//
// Idempotent. Dry-run by default; pass --apply to write. Run with node:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... APIFOOTBALL_KEY=... \
//     node scripts/reconcile-knockout-api.mjs --apply
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY = process.env.APIFOOTBALL_KEY
if (!KEY) { console.log('APIFOOTBALL_KEY not set — skipping'); process.exit(0) }
if (!URL || !SERVICE) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const APPLY = process.argv.includes('--apply')
const db = createClient(URL, SERVICE, { auth: { persistSession: false } })

const api = async path => {
  const r = await fetch('https://v3.football.api-sports.io/' + path, { headers: { 'x-apisports-key': KEY } })
  if (!r.ok) throw new Error(`api ${path} -> ${r.status}`)
  const j = await r.json()
  if (j.errors && (Array.isArray(j.errors) ? j.errors.length : Object.keys(j.errors).length))
    console.error('api errors', path, JSON.stringify(j.errors))
  return j.response || []
}

// Canonical country name for cross-source matching (mirrors fetch-football.mjs).
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')
const ALIAS = {
  unitedstates: 'usa', czechia: 'czechrepublic', korearepublic: 'southkorea',
  cotedivoire: 'ivorycoast', caboverde: 'capeverde', capeverdeislands: 'capeverde',
  congodr: 'drcongo', democraticrepublicofcongo: 'drcongo', turkiye: 'turkey',
  bosniaandherzegovina: 'bosniaherzegovina',
}
const canon = s => { const n = norm(s); return ALIAS[n] ?? n }

const isKnockoutRound = r => !!r && !/^group stage/i.test(r)

const { data: matches, error } = await db.from('matches')
  .select('id,match_no,stage,group_label,kickoff_at,status,home_code,home_label,away_code,away_label,api_fixture_id,home_api_team,away_api_team,venue_name,venue_city')
if (error) { console.error('load matches:', error.message); process.exit(1) }

// Build code<->name maps from our OWN group rows (self-maintaining, no hardcoding).
const codeByCanon = new Map()
const nameByCode = new Map()
for (const m of matches) {
  if (m.stage !== 'group') continue
  if (m.home_code && m.home_label) { codeByCanon.set(canon(m.home_label), m.home_code); nameByCode.set(m.home_code, m.home_label) }
  if (m.away_code && m.away_label) { codeByCanon.set(canon(m.away_label), m.away_code); nameByCode.set(m.away_code, m.away_label) }
}

// Our knockout rows, indexed by kickoff instant (unique per match).
const koByKickoff = new Map()
for (const m of matches) {
  if (m.stage === 'group') continue
  koByKickoff.set(new Date(m.kickoff_at).getTime(), m)
}

const fixtures = await api('fixtures?league=1&season=2026')

let planned = 0, applied = 0, skippedUnmapped = 0, skippedNoRow = 0
for (const f of fixtures) {
  if (!isKnockoutRound(f.league?.round)) continue
  const hName = f.teams?.home?.name, aName = f.teams?.away?.name
  if (!hName || !aName) continue // bracket slot not seeded with a real team yet

  const m = koByKickoff.get(new Date(f.fixture.date).getTime())
  if (!m) { skippedNoRow++; continue }
  if (m.status === 'finished') continue // never rewrite a played game

  const hCode = codeByCanon.get(canon(hName))
  const aCode = codeByCanon.get(canon(aName))
  if (!hCode || !aCode) {
    console.warn(`  ! could not map "${hName}" / "${aName}" to a team code — skipping ${f.league.round} @ ${f.fixture.date}`)
    skippedUnmapped++
    continue
  }

  const update = {}
  // Reconcile each side independently so predictions (stored by side) carry over.
  if (m.home_code !== hCode) { update.home_code = hCode; update.home_label = nameByCode.get(hCode) ?? hName }
  if (m.away_code !== aCode) { update.away_code = aCode; update.away_label = nameByCode.get(aCode) ?? aName }
  // Keep the live-score linkage in sync with the (now correct) teams.
  if (m.api_fixture_id !== f.fixture.id) update.api_fixture_id = f.fixture.id
  if (m.home_api_team !== f.teams.home.id) update.home_api_team = f.teams.home.id
  if (m.away_api_team !== f.teams.away.id) update.away_api_team = f.teams.away.id
  if (f.fixture.venue?.name && m.venue_name !== f.fixture.venue.name) update.venue_name = f.fixture.venue.name
  if (f.fixture.venue?.city && m.venue_city !== f.fixture.venue.city) update.venue_city = f.fixture.venue.city

  if (Object.keys(update).length === 0) continue

  const teamChanged = 'home_code' in update || 'away_code' in update
  planned++
  console.log(
    `match ${m.match_no} (${m.stage})` +
    (teamChanged
      ? `  ${m.home_label} v ${m.away_label}  ->  ${update.home_label ?? m.home_label} v ${update.away_label ?? m.away_label}`
      : `  ${m.home_label} v ${m.away_label}  (fixture/venue link only)`),
  )
  if (APPLY) {
    const { error: e } = await db.from('matches').update(update).eq('id', m.id)
    if (e) console.error(`  update match ${m.match_no} failed:`, e.message)
    else applied++
  }
}

console.log(
  (APPLY ? `reconciled ${applied}/${planned}` : `${planned} knockout row(s) would be reconciled (dry run; pass --apply)`) +
  ` · unmapped ${skippedUnmapped} · no-row ${skippedNoRow}`,
)
