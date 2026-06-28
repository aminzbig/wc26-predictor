// Persist resolved knockout teams into the DB.
//
// Knockout match rows are seeded with placeholder labels ("2A", "W74") and
// null team codes. The browser fills in the real teams via resolveBracket()
// (src/lib/bracket.ts), but that projection lives only in the client and is
// never written back — so the server never learns who is actually playing.
//
// The live-score ticker (supabase/functions/tick) maps a row to its
// API-Football fixture BY TEAM NAME (byPair on home_label/away_label). With a
// placeholder label it can never match, so knockout matches never get
// api_fixture_id, live_home/live_away, venues, or instant FT scoring.
//
// This script closes that gap: it runs the SAME resolveBracket() the client
// uses, and writes back the real home_code/home_label/away_code/away_label for
// any knockout slot whose team is CONFIRMED (the feeding group is finished, or
// it's an actual match winner) — never a provisional live projection. Once a
// row carries real team names, the existing fetch-football / tick pipeline maps
// it to a fixture automatically, and live scores + venues + scoring all flow
// like a group match. Filling only null slots means a manually-set team is
// never overwritten.
//
// Idempotent — safe to run on every cron tick. Run with `tsx`:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/resolve-knockout.ts
// Add --apply to write; without it the script only prints planned changes.
import { createClient } from '@supabase/supabase-js'
import { resolveBracket } from '../src/lib/bracket'
import type { Match } from '../src/lib/types'

const URL = process.env.SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !SERVICE) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const APPLY = process.argv.includes('--apply')
const db = createClient(URL, SERVICE, { auth: { persistSession: false } })

const { data: matches, error } = await db.from('matches').select('*').order('kickoff_at')
if (error) { console.error('load matches:', error.message); process.exit(1) }

const rows = (matches ?? []) as Match[]
const byId = new Map(rows.map(m => [m.id, m]))

let planned = 0, applied = 0
for (const b of resolveBracket(rows)) {
  const m = byId.get(b.id)
  if (!m) continue
  const update: Partial<Match> = {}

  // Only fill a side that has no team yet AND whose projection is locked in.
  if (m.home_code == null && b.home.confirmed && b.home.code) {
    update.home_code = b.home.code
    update.home_label = b.home.name ?? b.home.code
  }
  if (m.away_code == null && b.away.confirmed && b.away.code) {
    update.away_code = b.away.code
    update.away_label = b.away.name ?? b.away.code
  }
  if (Object.keys(update).length === 0) continue

  planned++
  console.log(
    `match ${m.match_no} (${m.stage}) ${m.home_label} v ${m.away_label}  ->  ` +
    `${update.home_label ?? m.home_label} (${update.home_code ?? m.home_code ?? '—'}) v ` +
    `${update.away_label ?? m.away_label} (${update.away_code ?? m.away_code ?? '—'})`,
  )
  if (APPLY) {
    const { error: e } = await db.from('matches').update(update).eq('id', m.id)
    if (e) console.error(`  update match ${m.match_no} failed:`, e.message)
    else applied++
  }
}

console.log(APPLY ? `resolved ${applied}/${planned} knockout slots` : `${planned} knockout slot(s) would be resolved (dry run; pass --apply to write)`)
