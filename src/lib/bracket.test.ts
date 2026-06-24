import { describe, expect, test } from 'vitest'
import { resolveBracket, assignThirdPlaces } from './bracket'
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

  test('leaves a slot TBD (null code, raw label) while its group is unfinished', () => {
    const out = resolveBracket([
      g('Group A', 'mx', 'za', 2, 0), // group A not complete
      mk({ match_no: 73, stage: 'r32', home_label: '1A', away_label: '2B', multiplier: 1.5 }),
    ])
    const m = out.find(b => b.match_no === 73)!
    expect(m.home).toMatchObject({ code: null, label: '1A' })
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

  test('winnerCode is null for a level game with no penalties', () => {
    const out = resolveBracket([
      ...twoDoneGroups(),
      mk({ match_no: 73, stage: 'r32', home_label: '1A', away_label: '1B',
        home_score: 1, away_score: 1, status: 'finished', multiplier: 1.5 }),
    ])
    expect(out.find(b => b.match_no === 73)!.winnerCode).toBeNull()
  })
})
