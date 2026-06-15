// Lightweight live-score updater: one API-Football call (fixtures?live=all) →
// updates live_* on matches in progress, clears them otherwise. Runs often.
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY = process.env.APIFOOTBALL_KEY
if (!KEY) { console.log('APIFOOTBALL_KEY not set — skipping'); process.exit(0) }
if (!URL || !SERVICE) { console.error('Missing SUPABASE_URL / SERVICE key'); process.exit(1) }

const db = createClient(URL, SERVICE, { auth: { persistSession: false } })

const res = await fetch('https://v3.football.api-sports.io/fixtures?live=all', { headers: { 'x-apisports-key': KEY } })
if (!res.ok) { console.error('api', res.status); process.exit(1) }
const data = await res.json()
const liveByFixture = new Map()
for (const f of (data.response || [])) {
  if (f.league?.id !== 1) continue // World Cup only
  liveByFixture.set(f.fixture.id, {
    home: f.goals.home ?? 0, away: f.goals.away ?? 0,
    minute: f.fixture.status?.elapsed ?? null, status: f.fixture.status?.short ?? null,
  })
}

const { data: ours } = await db.from('matches')
  .select('id,api_fixture_id,status,live_home').neq('status', 'finished')
let set = 0, cleared = 0
for (const m of (ours || [])) {
  if (!m.api_fixture_id) continue
  const live = liveByFixture.get(m.api_fixture_id)
  if (live) {
    await db.from('matches').update({ live_home: live.home, live_away: live.away, live_minute: live.minute, live_status: live.status }).eq('id', m.id)
    set++
  } else if (m.live_home != null) {
    await db.from('matches').update({ live_home: null, live_away: null, live_minute: null, live_status: null }).eq('id', m.id)
    cleared++
  }
}
console.log(`live updated on ${set} match(es), cleared ${cleared}`)
