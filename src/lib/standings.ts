import type { Match } from './types'

export interface TeamStanding {
  code: string
  name: string
  mp: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  gd: number
  pts: number
  rank: number // 1-based within the group
  qualification: 'advance' | 'wildcard' | null
}

export interface GroupStanding {
  label: string
  rows: TeamStanding[]
}

const WILDCARD_SLOTS = 8

// The score a played group match contributes: a final result, or — for a match
// in progress — its current live score. Returns null for not-yet-played matches.
function playedScore(m: Match): { home: number; away: number } | null {
  if (m.status === 'finished' && m.home_score != null && m.away_score != null) {
    return { home: m.home_score, away: m.away_score }
  }
  if (m.status !== 'finished' && m.live_home != null && m.live_away != null) {
    return { home: m.live_home, away: m.live_away }
  }
  return null
}

// Pts → GD → GF → name (the unmodelled fair-play/lots tiebreakers fall back to name).
function compareRows(a: TeamStanding, b: TeamStanding): number {
  return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name)
}

export function computeStandings(matches: Match[]): GroupStanding[] {
  const groupMatches = matches.filter(
    m => m.stage === 'group' && m.group_label && m.home_code && m.away_code,
  )

  const groups = new Map<string, Map<string, TeamStanding>>()

  const teamOf = (label: string, code: string, name: string | null): TeamStanding => {
    let teams = groups.get(label)
    if (!teams) groups.set(label, (teams = new Map()))
    let t = teams.get(code)
    if (!t) {
      t = { code, name: name ?? code, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, rank: 0, qualification: null }
      teams.set(code, t)
    } else if (name) {
      t.name = name
    }
    return t
  }

  for (const m of groupMatches) {
    const home = teamOf(m.group_label!, m.home_code!, m.home_label)
    const away = teamOf(m.group_label!, m.away_code!, m.away_label)
    const score = playedScore(m)
    if (!score) continue

    home.mp++; away.mp++
    home.gf += score.home; home.ga += score.away
    away.gf += score.away; away.ga += score.home
    if (score.home > score.away) { home.w++; away.l++; home.pts += 3 }
    else if (score.home < score.away) { away.w++; home.l++; away.pts += 3 }
    else { home.d++; away.d++; home.pts++; away.pts++ }
  }

  const standings: GroupStanding[] = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, teams]) => {
      const rows = [...teams.values()]
      rows.forEach(r => { r.gd = r.gf - r.ga })
      rows.sort(compareRows)
      rows.forEach((r, i) => {
        r.rank = i + 1
        r.qualification = i < 2 ? 'advance' : null
      })
      return { label, rows }
    })

  // The 8 best third-placed teams across all groups also advance.
  const thirds = standings.map(g => g.rows[2]).filter((r): r is TeamStanding => !!r)
  thirds.sort(compareRows)
  thirds.slice(0, WILDCARD_SLOTS).forEach(r => { r.qualification = 'wildcard' })

  return standings
}
