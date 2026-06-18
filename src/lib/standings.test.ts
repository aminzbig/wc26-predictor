import { describe, expect, test } from 'vitest'
import { computeStandings, type GroupStanding } from './standings'
import type { Match } from './types'

let _id = 0
function mk(p: Partial<Match>): Match {
  return {
    id: String(++_id), match_no: null, stage: 'group', group_label: 'Group A',
    home_code: null, away_code: null, home_label: null, away_label: null,
    kickoff_at: '2026-06-11T00:00:00Z', home_score: null, away_score: null,
    multiplier: 1, status: 'scheduled', prob_home: null, prob_draw: null, prob_away: null,
    ...p,
  } as Match
}

// A finished group match.
function g(group: string, home: string, away: string, hs: number, as_: number, extra: Partial<Match> = {}): Match {
  return mk({
    group_label: group, home_code: home, away_code: away,
    home_label: home.toUpperCase(), away_label: away.toUpperCase(),
    home_score: hs, away_score: as_, status: 'finished', ...extra,
  })
}

const grp = (s: GroupStanding[], label: string) => s.find(x => x.label === label)!

describe('computeStandings', () => {
  test('ranks a group by points then goal difference (screenshot Group A)', () => {
    const s = computeStandings([
      g('Group A', 'mx', 'za', 2, 0),
      g('Group A', 'kr', 'cz', 2, 1),
    ])
    const rows = grp(s, 'Group A').rows
    expect(rows.map(r => r.code)).toEqual(['mx', 'kr', 'cz', 'za'])
    expect(rows[0]).toMatchObject({ code: 'mx', mp: 1, w: 1, d: 0, l: 0, gf: 2, ga: 0, gd: 2, pts: 3, rank: 1 })
    expect(rows[1]).toMatchObject({ code: 'kr', pts: 3, gd: 1, rank: 2 })
    expect(rows[2]).toMatchObject({ code: 'cz', pts: 0, gd: -1, rank: 3 })
    expect(rows[3]).toMatchObject({ code: 'za', pts: 0, gd: -2, rank: 4 })
  })

  test('carries the team name from the match label', () => {
    const s = computeStandings([g('Group A', 'mx', 'za', 2, 0)])
    expect(grp(s, 'Group A').rows.find(r => r.code === 'mx')!.name).toBe('MX')
  })

  test('includes teams from not-yet-played fixtures with zeroed stats', () => {
    const s = computeStandings([
      g('Group B', 'br', 'rs', 3, 0),
      mk({ group_label: 'Group B', home_code: 'ch', away_code: 'cm' }), // scheduled, no score
    ])
    const rows = grp(s, 'Group B').rows
    expect(rows.map(r => r.code).sort()).toEqual(['br', 'ch', 'cm', 'rs'])
    expect(rows.find(r => r.code === 'cm')).toMatchObject({ mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 })
  })

  test('counts an in-progress match using its live score', () => {
    const s = computeStandings([
      mk({ group_label: 'Group C', home_code: 'fr', away_code: 'us', status: 'scheduled', live_home: 1, live_away: 0 }),
    ])
    expect(grp(s, 'Group C').rows.find(r => r.code === 'fr')).toMatchObject({ mp: 1, w: 1, pts: 3, gf: 1, ga: 0 })
  })

  test('ignores non-group matches', () => {
    const s = computeStandings([
      g('Group A', 'mx', 'za', 2, 0),
      mk({ stage: 'r16', group_label: null, home_code: 'mx', away_code: 'br', home_score: 1, away_score: 0, status: 'finished' }),
    ])
    expect(grp(s, 'Group A').rows.find(r => r.code === 'mx')).toMatchObject({ mp: 1 })
  })

  test('marks the top two of each group as advancing', () => {
    const s = computeStandings([g('Group A', 'mx', 'za', 2, 0), g('Group A', 'kr', 'cz', 2, 1)])
    const rows = grp(s, 'Group A').rows
    expect(rows[0].qualification).toBe('advance')
    expect(rows[1].qualification).toBe('advance')
    expect(rows[3].qualification).toBeNull()
  })

  // Two strong teams (6 pts), a third, and a bottom team. When `thirdScores`, the
  // third team beats the bottom team for 3 pts; otherwise both sit on 0 and the
  // third place is decided by name (…c before …d).
  function controlledGroup(label: string, thirdScores: boolean): Match[] {
    const A = `${label}a`, B = `${label}b`, C = `${label}c`, D = `${label}d`
    const ms = [
      g(label, A, D, 1, 0), g(label, A, C, 1, 0), // A: 6 pts
      g(label, B, D, 1, 0), g(label, B, C, 1, 0), // B: 6 pts
    ]
    if (thirdScores) ms.push(g(label, C, D, 1, 0)) // C: 3 pts (third); else C & D both 0
    return ms
  }

  test('with 8 or fewer groups, every third-placed team is a wildcard', () => {
    const s = computeStandings([
      ...controlledGroup('Group A', true),
      ...controlledGroup('Group B', true),
    ])
    expect(grp(s, 'Group A').rows.find(r => r.rank === 3)!.qualification).toBe('wildcard')
    expect(grp(s, 'Group B').rows.find(r => r.rank === 3)!.qualification).toBe('wildcard')
  })

  test('with 9 groups, only the best 8 third-placed teams get the wildcard mark', () => {
    const labels = ['Group A', 'Group B', 'Group C', 'Group D', 'Group E', 'Group F', 'Group G', 'Group H', 'Group I']
    // First 8 groups: third place has 3 pts. Group I: third place has 0 pts → it misses the cut.
    const matches = labels.flatMap((l, i) => controlledGroup(l, i < 8))
    const s = computeStandings(matches)

    const wildcards = s.flatMap(group => group.rows.filter(r => r.qualification === 'wildcard'))
    expect(wildcards).toHaveLength(8)
    expect(grp(s, 'Group A').rows.find(r => r.rank === 3)!.qualification).toBe('wildcard')
    expect(grp(s, 'Group I').rows.find(r => r.rank === 3)!.qualification).toBeNull()
  })

  test('returns groups sorted by label', () => {
    const s = computeStandings([g('Group C', 'a', 'b', 1, 0), g('Group A', 'c', 'd', 1, 0), g('Group B', 'e', 'f', 1, 0)])
    expect(s.map(x => x.label)).toEqual(['Group A', 'Group B', 'Group C'])
  })
})
