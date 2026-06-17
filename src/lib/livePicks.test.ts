import { describe, expect, test } from 'vitest'
import { rankLivePicks } from './livePicks'

const pick = (name: string, home_pred: number, away_pred: number) => ({ name, home_pred, away_pred })

describe('rankLivePicks', () => {
  test('sorts by projected points desc and assigns rank', () => {
    const rows = [pick('Bob', 0, 0), pick('Ann', 1, 0)] // live 1-0: Ann exact=30, Bob=5
    const out = rankLivePicks(rows, { home: 1, away: 0 })
    expect(out.map(r => r.name)).toEqual(['Ann', 'Bob'])
    expect(out.map(r => r.proj)).toEqual([30, 5])
    expect(out.map(r => r.rank)).toEqual([1, 2])
  })

  test('dense ranking: ties share a place, next distinct score skips ahead', () => {
    // live 1-0. Ann 1-0 -> 30, Cy 2-0 -> outcome10+away5=15, Dan 3-0 -> 15, Bob 0-0 -> 5
    const rows = [pick('Bob', 0, 0), pick('Cy', 2, 0), pick('Ann', 1, 0), pick('Dan', 3, 0)]
    const out = rankLivePicks(rows, { home: 1, away: 0 })
    expect(out.map(r => [r.name, r.proj, r.rank])).toEqual([
      ['Ann', 30, 1],
      ['Cy', 15, 2],
      ['Dan', 15, 2],
      ['Bob', 5, 4],
    ])
  })

  test('tie in proj breaks alphabetically by name', () => {
    const rows = [pick('Zoe', 2, 0), pick('Amy', 3, 0)] // live 1-0: both 15
    const out = rankLivePicks(rows, { home: 1, away: 0 })
    expect(out.map(r => r.name)).toEqual(['Amy', 'Zoe'])
  })

  test('applies multiplier to projections', () => {
    const out = rankLivePicks([pick('Ann', 1, 0)], { home: 1, away: 0 }, 3)
    expect(out[0].proj).toBe(90)
  })
})
