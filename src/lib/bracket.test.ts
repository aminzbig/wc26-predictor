import { describe, expect, test } from 'vitest'
import { resolveBracket, assignThirdPlaces, projectMatchTeams, bracketOrder } from './bracket'
import type { Match } from './types'

let _id = 0
function mk(p: Partial<Match>): Match {
  return {
    id: String(++_id), match_no: null, stage: 'group', group_label: null,
    home_code: null, away_code: null, home_label: null, away_label: null,
    kickoff_at: '2026-06-11T00:00:00Z', home_score: null, away_score: null,
    home_pens: null, away_pens: null,
    multiplier: 1, status: 'scheduled', prob_home: null, prob_draw: null, prob_away: null,
    ...p,
  } as Match
}
// A finished group match.
function g(group: string, home: string, away: string, hs: number, as_: number): Match {
  return mk({
    stage: 'group', group_label: group, home_code: home, away_code: away,
    home_label: home.toUpperCase(), away_label: away.toUpperCase(),
    home_score: hs, away_score: as_, status: 'finished',
  })
}
// Group A: mx 1st, kr 2nd. Group B: br 1st, ar 2nd. Both groups complete.
function twoDoneGroups(): Match[] {
  return [
    g('Group A', 'mx', 'za', 2, 0), g('Group A', 'mx', 'kr', 2, 1),
    g('Group A', 'kr', 'za', 2, 0), g('Group A', 'za', 'mx', 0, 1),
    g('Group A', 'kr', 'mx', 0, 1), g('Group A', 'za', 'kr', 0, 1),
    g('Group B', 'br', 'cm', 2, 0), g('Group B', 'br', 'ar', 2, 1),
    g('Group B', 'ar', 'cm', 2, 0), g('Group B', 'cm', 'br', 0, 1),
    g('Group B', 'ar', 'br', 0, 1), g('Group B', 'cm', 'ar', 0, 1),
  ]
}

describe('assignThirdPlaces', () => {
  test('produces a complete, constraint-valid matching', () => {
    const slots = [
      { label: '3A/B/C/D/F', allowed: ['A', 'B', 'C', 'D', 'F'] },
      { label: '3C/D/F/G/H', allowed: ['C', 'D', 'F', 'G', 'H'] },
      { label: '3A/E/H/I/J', allowed: ['A', 'E', 'H', 'I', 'J'] },
      { label: '3E/H/I/J/K', allowed: ['E', 'H', 'I', 'J', 'K'] },
      { label: '3B/E/F/I/J', allowed: ['B', 'E', 'F', 'I', 'J'] },
      { label: '3E/F/G/I/J', allowed: ['E', 'F', 'G', 'I', 'J'] },
      { label: '3C/E/F/H/I', allowed: ['C', 'E', 'F', 'H', 'I'] },
      { label: '3D/E/I/J/L', allowed: ['D', 'E', 'I', 'J', 'L'] },
    ]
    const thirds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(letter =>
      ({ letter, code: letter.toLowerCase(), name: `T${letter}` }))
    const out = assignThirdPlaces(slots, thirds)
    expect(out.size).toBe(8)
    // every slot got a third whose group letter is in its allowed set, no duplicates
    const usedLetters = new Set<string>()
    for (const s of slots) {
      const ref = out.get(s.label)!
      expect(ref).toBeDefined()
      expect(s.allowed).toContain(ref.code.toUpperCase())
      expect(usedLetters.has(ref.code)).toBe(false)
      usedLetters.add(ref.code)
    }
  })
})

describe('resolveBracket', () => {
  test('returns only knockout matches, sorted by match_no', () => {
    const out = resolveBracket([
      ...twoDoneGroups(),
      mk({ match_no: 74, stage: 'r32', home_label: '2A', away_label: '2B', multiplier: 1.5 }),
      mk({ match_no: 73, stage: 'r32', home_label: '1A', away_label: '1B', multiplier: 1.5 }),
    ])
    expect(out.map(b => b.match_no)).toEqual([73, 74])
  })

  test('resolves group-placement slots once both groups are complete', () => {
    const out = resolveBracket([
      ...twoDoneGroups(),
      mk({ match_no: 73, stage: 'r32', home_label: '1A', away_label: '2B', multiplier: 1.5 }),
    ])
    const m = out.find(b => b.match_no === 73)!
    expect(m.home).toMatchObject({ code: 'mx', label: '1A' }) // Group A winner
    expect(m.away).toMatchObject({ code: 'ar', label: '2B' }) // Group B runner-up
  })

  test('leaves a slot TBD while its group has not played any matches', () => {
    const out = resolveBracket([
      // scheduled, no score → Group A is not underway yet
      mk({ stage: 'group', group_label: 'Group A', home_code: 'mx', away_code: 'za', home_label: 'Mexico', away_label: 'ZA' }),
      mk({ match_no: 73, stage: 'r32', home_label: '1A', away_label: '2B', multiplier: 1.5 }),
    ])
    const m = out.find(b => b.match_no === 73)!
    expect(m.home).toMatchObject({ code: null, label: '1A' })
  })

  test('projects the provisional group leader from a partial table (Google-style)', () => {
    const out = resolveBracket([
      g('Group A', 'mx', 'za', 2, 0), // one finished match → Group A is underway
      mk({ match_no: 73, stage: 'r32', home_label: '1A', away_label: '2B', multiplier: 1.5 }),
    ])
    const m = out.find(b => b.match_no === 73)!
    expect(m.home).toMatchObject({ code: 'mx', label: '1A' }) // mx leads provisionally
  })

  test('resolves W/L from a finished knockout game decided on penalties', () => {
    const out = resolveBracket([
      ...twoDoneGroups(),
      // r32 #73: mx (1A) vs br (1B), 1-1, mx win 4-3 on pens
      mk({ match_no: 73, stage: 'r32', home_label: '1A', away_label: '1B',
        home_score: 1, away_score: 1, home_pens: 4, away_pens: 3, status: 'finished', multiplier: 1.5 }),
      // r16 #89: winner of 73 vs runner-up of A
      mk({ match_no: 89, stage: 'r16', home_label: 'W73', away_label: '2A', multiplier: 2 }),
      // third-place style loser reference
      mk({ match_no: 90, stage: 'r16', home_label: 'L73', away_label: '2B', multiplier: 2 }),
    ])
    const r32 = out.find(b => b.match_no === 73)!
    expect(r32.winnerCode).toBe('mx')
    const r16w = out.find(b => b.match_no === 89)!
    expect(r16w.home).toMatchObject({ code: 'mx', label: 'W73' })
    const r16l = out.find(b => b.match_no === 90)!
    expect(r16l.home).toMatchObject({ code: 'br', label: 'L73' })
  })

  test('uses a knockout team already persisted in the DB (resolve-knockout wrote a real name into the label)', () => {
    // Once a slot is confirmed, resolve-knockout.ts writes the real team into the
    // row: home_code='mx', home_label='Mexico' (the NAME, no longer a seed like
    // '1A'). The bracket must read that real team, not fall through to TBD.
    const out = resolveBracket([
      ...twoDoneGroups(),
      mk({ match_no: 73, stage: 'r32', home_code: 'mx', home_label: 'Mexico',
        away_code: 'ar', away_label: 'Argentina', multiplier: 1.5 }),
    ])
    const m = out.find(b => b.match_no === 73)!
    expect(m.home).toMatchObject({ code: 'mx', name: 'Mexico', confirmed: true })
    expect(m.away).toMatchObject({ code: 'ar', name: 'Argentina', confirmed: true })
  })

  test('cascades W{n} from a persisted-team R32 result into the next round', () => {
    const out = resolveBracket([
      ...twoDoneGroups(),
      // R32 with real teams persisted AND a finished penalty result.
      mk({ match_no: 73, stage: 'r32', home_code: 'mx', home_label: 'Mexico',
        away_code: 'br', away_label: 'Brazil',
        home_score: 1, away_score: 1, home_pens: 4, away_pens: 3, status: 'finished', multiplier: 1.5 }),
      mk({ match_no: 89, stage: 'r16', home_label: 'W73', away_label: '2A', multiplier: 2 }),
    ])
    expect(out.find(b => b.match_no === 73)!.winnerCode).toBe('mx')
    expect(out.find(b => b.match_no === 89)!.home).toMatchObject({ code: 'mx', label: 'W73' })
  })

  test('winnerCode is null for a level game with no penalties', () => {
    const out = resolveBracket([
      ...twoDoneGroups(),
      mk({ match_no: 73, stage: 'r32', home_label: '1A', away_label: '1B',
        home_score: 1, away_score: 1, status: 'finished', multiplier: 1.5 }),
    ])
    expect(out.find(b => b.match_no === 73)!.winnerCode).toBeNull()
  })
})

// The full WC26 knockout schedule (match_no + seed labels), from supabase/seed.sql.
function koSchedule(): Match[] {
  const r32: [number, string, string][] = [
    [73, '2A', '2B'], [74, '1E', '3A/B/C/D/F'], [75, '1F', '2C'], [76, '1C', '2F'],
    [77, '1I', '3C/D/F/G/H'], [78, '2E', '2I'], [79, '1A', '3C/E/F/H/I'], [80, '1L', '3E/H/I/J/K'],
    [81, '1D', '3B/E/F/I/J'], [82, '1G', '3A/E/H/I/J'], [83, '2K', '2L'], [84, '1H', '2J'],
    [85, '1B', '3E/F/G/I/J'], [86, '1J', '2H'], [87, '1K', '3D/E/I/J/L'], [88, '2D', '2G'],
  ]
  const r16: [number, string, string][] = [
    [89, 'W74', 'W77'], [90, 'W73', 'W75'], [91, 'W76', 'W78'], [92, 'W79', 'W80'],
    [93, 'W83', 'W84'], [94, 'W81', 'W82'], [95, 'W86', 'W88'], [96, 'W85', 'W87'],
  ]
  const qf: [number, string, string][] = [
    [97, 'W89', 'W90'], [98, 'W93', 'W94'], [99, 'W91', 'W92'], [100, 'W95', 'W96'],
  ]
  const sf: [number, string, string][] = [[101, 'W97', 'W98'], [102, 'W99', 'W100']]
  const rows: { no: number; stage: Match['stage']; h: string; a: string }[] = [
    ...r32.map(([no, h, a]) => ({ no, stage: 'r32' as const, h, a })),
    ...r16.map(([no, h, a]) => ({ no, stage: 'r16' as const, h, a })),
    ...qf.map(([no, h, a]) => ({ no, stage: 'qf' as const, h, a })),
    ...sf.map(([no, h, a]) => ({ no, stage: 'sf' as const, h, a })),
    { no: 103, stage: 'third', h: 'L101', a: 'L102' },
    { no: 104, stage: 'final', h: 'W101', a: 'W102' },
  ]
  return rows.map(r => mk({ match_no: r.no, stage: r.stage, home_label: r.h, away_label: r.a, multiplier: 1.5 }))
}

describe('bracketOrder', () => {
  const orderedNos = (matches: Match[], stage: Match['stage']) => {
    const bracket = resolveBracket(matches)
    const order = bracketOrder(bracket)
    return bracket.filter(b => b.stage === stage)
      .sort((a, b) => (order.get(a.match_no!) ?? 0) - (order.get(b.match_no!) ?? 0))
      .map(b => b.match_no)
  }

  test('orders each round by bracket-tree position, not match_no', () => {
    const ko = koSchedule()
    // R32 in tree order: feeders of consecutive R16 cards are adjacent.
    expect(orderedNos(ko, 'r32')).toEqual([74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87])
    expect(orderedNos(ko, 'r16')).toEqual([89, 90, 93, 94, 91, 92, 95, 96])
    expect(orderedNos(ko, 'qf')).toEqual([97, 98, 99, 100])
    expect(orderedNos(ko, 'sf')).toEqual([101, 102])
  })

  test('the two R32 feeders of an R16 card are adjacent in the ordered R32 column', () => {
    // R16 #90 = W73 vs W75; in tree order #73 and #75 must sit next to each other.
    const r32 = orderedNos(koSchedule(), 'r32')
    const i73 = r32.indexOf(73), i75 = r32.indexOf(75)
    expect(Math.abs(i73 - i75)).toBe(1)
    expect(Math.min(i73, i75) % 2).toBe(0) // a feeder pair starts on an even index
  })

  test('keeps tree order after resolve-knockout overwrites a winner label with a team name', () => {
    // The real bug: once Canada (W73) advances, the server writes its name into
    // R16 #90's home label, erasing the 'W73' wiring. Order must still place #73
    // and #75 as the adjacent feeders of #90 — recovered via winnerCode.
    const sched = koSchedule().map(m => {
      if (m.match_no === 73) return { ...m, home_code: 'za', away_code: 'ca', home_label: 'South Africa', away_label: 'Canada', home_score: 0, away_score: 1, status: 'finished' as const }
      if (m.match_no === 90) return { ...m, home_code: 'ca', home_label: 'Canada' } // server-resolved W73
      return m
    })
    expect(orderedNos(sched, 'r32')).toEqual([74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87])
    expect(orderedNos(sched, 'r16')).toEqual([89, 90, 93, 94, 91, 92, 95, 96])
  })
})

describe('projectMatchTeams', () => {
  test('fills knockout seed labels with projected code + country name', () => {
    const out = projectMatchTeams([
      ...twoDoneGroups(),
      mk({ id: 'r32a', match_no: 73, stage: 'r32', home_label: '1A', away_label: '2B', multiplier: 1.5 }),
    ])
    const m = out.find(x => x.id === 'r32a')!
    // Group A winner (mx) vs Group B runner-up (ar) — projected onto the card fields.
    expect(m.home_code).toBe('mx')
    expect(m.home_label).toBe('MX')   // name from standings (group g() sets name=CODE)
    expect(m.away_code).toBe('ar')
    expect(m.away_label).toBe('AR')
  })

  test('projects later rounds from finished earlier-round results', () => {
    const out = projectMatchTeams([
      ...twoDoneGroups(),
      mk({ id: 'r32', match_no: 73, stage: 'r32', home_label: '1A', away_label: '1B',
        home_score: 2, away_score: 0, status: 'finished', multiplier: 1.5 }),
      mk({ id: 'r16', match_no: 89, stage: 'r16', home_label: 'W73', away_label: '2A', multiplier: 2 }),
    ])
    const r16 = out.find(x => x.id === 'r16')!
    expect(r16.home_code).toBe('mx') // winner of #73
    expect(r16.away_code).toBe('kr') // Group A runner-up
  })

  test('keeps the seed label when the slot cannot be projected yet', () => {
    const out = projectMatchTeams([
      mk({ id: 'r32', match_no: 73, stage: 'r32', home_label: '1A', away_label: '2B', multiplier: 1.5 }),
    ])
    const m = out.find(x => x.id === 'r32')!
    expect(m.home_code).toBeNull()
    expect(m.home_label).toBe('1A')
  })

  test('leaves group matches untouched', () => {
    const group = g('Group A', 'mx', 'za', 2, 0)
    const out = projectMatchTeams([group])
    expect(out[0]).toBe(group)
  })

  test('does not overwrite a knockout team already set in the DB', () => {
    const out = projectMatchTeams([
      ...twoDoneGroups(),
      mk({ id: 'r32', match_no: 73, stage: 'r32', home_code: 'us', home_label: 'USA',
        away_label: '2B', multiplier: 1.5 }),
    ])
    const m = out.find(x => x.id === 'r32')!
    expect(m.home_code).toBe('us')   // DB value preserved
    expect(m.home_label).toBe('USA')
    expect(m.away_code).toBe('ar')   // still projected
  })

  test('derives each knockout team World Cup run from finished tournament games', () => {
    // mx played 3 finished Group A games in twoDoneGroups(); they become its WC run.
    const out = projectMatchTeams([
      ...twoDoneGroups(),
      mk({ id: 'r32', match_no: 73, stage: 'r32', home_label: '1A', away_label: '2B',
        kickoff_at: '2026-07-01T00:00:00Z', multiplier: 1.5 }),
    ])
    const m = out.find(x => x.id === 'r32')!
    const run = m.home_wc_run! // mx (Group A winner)
    expect(run.length).toBe(4) // mx appears in 4 finished Group A games in the fixture
    expect(run.every(x => x.opp !== 'mx')).toBe(true) // opponent is always the other side
    // every game involves mx, oldest→newest, with W/D/L from mx's perspective
    expect(run.every(x => x.result === 'W' || x.result === 'D' || x.result === 'L')).toBe(true)
    expect(run.some(x => x.gf != null && x.ga != null)).toBe(true)
  })

  test('only counts games before the knockout kickoff', () => {
    const out = projectMatchTeams([
      ...twoDoneGroups(),
      mk({ id: 'r32', match_no: 73, stage: 'r32', home_label: '1A', away_label: '2B',
        kickoff_at: '2020-01-01T00:00:00Z', multiplier: 1.5 }), // before all group games
    ])
    const m = out.find(x => x.id === 'r32')!
    expect(m.home_wc_run).toEqual([])
  })

  test('keeps a DB-provided wc_run (with stats) instead of deriving', () => {
    const dbRun = [{ id: 9, date: '2026-06-12T00:00:00Z', opp: 'X', gf: 1, ga: 0,
      result: 'W' as const, poss: '60%', sot: 5, cor: 4 }]
    const out = projectMatchTeams([
      ...twoDoneGroups(),
      mk({ id: 'r32', match_no: 73, stage: 'r32', home_label: '1A', away_label: '2B',
        kickoff_at: '2026-07-01T00:00:00Z', multiplier: 1.5, home_wc_run: dbRun }),
    ])
    const m = out.find(x => x.id === 'r32')!
    expect(m.home_wc_run).toBe(dbRun)
  })
})
