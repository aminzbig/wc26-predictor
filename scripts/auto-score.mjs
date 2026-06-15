// Auto-score finished WC26 matches from the free openfootball dataset.
// Runs on a schedule (see .github/workflows/auto-score.yml). Idempotent.
// Uses the Supabase service role (bypasses RLS) and recompute_match().
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !SERVICE) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const db = createClient(URL, SERVICE, { auth: { persistSession: false } })
const SRC = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'

const res = await fetch(SRC)
if (!res.ok) { console.error('fetch failed', res.status); process.exit(1) }
const data = await res.json()

const { data: ours, error } = await db
  .from('matches')
  .select('id,match_no,home_code,home_score,away_score,status')
if (error) { console.error('db read failed', error.message); process.exit(1) }
const byNo = new Map(ours.map(m => [m.match_no, m]))

let updated = 0, skipped = 0
for (let i = 0; i < data.matches.length; i++) {
  const ft = (data.matches[i].score || {}).ft
  if (!ft) continue                          // not played yet
  const m = byNo.get(i + 1)                   // seed match_no = array index + 1
  if (!m || !m.home_code) { skipped++; continue }  // unknown / knockout placeholder (teams not set yet)
  if (m.status === 'finished' && m.home_score === ft[0] && m.away_score === ft[1]) continue // already scored
  const { error: e1 } = await db.from('matches').update({ home_score: ft[0], away_score: ft[1] }).eq('id', m.id)
  if (e1) { console.error(`update #${i + 1} failed`, e1.message); continue }
  const { error: e2 } = await db.rpc('recompute_match', { p_match: m.id })
  if (e2) { console.error(`score #${i + 1} failed`, e2.message); continue }
  updated++
  console.log(`scored match #${i + 1}: ${ft[0]}-${ft[1]}`)
}
console.log(`done — updated ${updated}, skipped ${skipped} placeholder matches`)
