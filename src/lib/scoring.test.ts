import { describe, expect, test } from 'vitest'
import { basePoints, projectedPoints } from './scoring'

// FIFA additive model: outcome 10, goalsHome 5, goalsAway 5, goalDiff 5, scoreBonus 5, risky 10.
describe('basePoints (FIFA additive)', () => {
  test('exact score = outcome+home+away+diff+bonus = 30', () => {
    expect(basePoints({ hp: 2, ap: 1 }, { hs: 2, as: 1 })).toBe(30)
  })
  test('correct goal difference + outcome, not exact = 15', () => {
    expect(basePoints({ hp: 2, ap: 1 }, { hs: 3, as: 2 })).toBe(15)
  })
  test('non-exact draw = outcome + goal diff = 15', () => {
    expect(basePoints({ hp: 1, ap: 1 }, { hs: 2, as: 2 })).toBe(15)
  })
  test('right winner + one team goals right = outcome + away goals = 15', () => {
    // pred 2-0, result 1-0: outcome +10, away 0 correct +5
    expect(basePoints({ hp: 2, ap: 0 }, { hs: 1, as: 0 })).toBe(15)
  })
  test('Reza case: 5-0 prediction on a 0-0 draw = away goals only = 5', () => {
    expect(basePoints({ hp: 5, ap: 0 }, { hs: 0, as: 0 })).toBe(5)
  })
  test('completely wrong = 0', () => {
    expect(basePoints({ hp: 2, ap: 1 }, { hs: 0, as: 3 })).toBe(0)
  })
  test('risky bonus adds 10 only on a correct home/away win', () => {
    expect(basePoints({ hp: 1, ap: 0 }, { hs: 1, as: 0 }, undefined, true)).toBe(40)
  })
  test('risky bonus does NOT apply to a correct draw', () => {
    expect(basePoints({ hp: 1, ap: 1 }, { hs: 0, as: 0 }, undefined, true)).toBe(15)
  })
})

describe('projectedPoints (live projection)', () => {
  test('exact live score = basePoints, multiplier 1', () => {
    expect(projectedPoints({ hp: 2, ap: 1 }, { hs: 2, as: 1 })).toBe(30)
  })
  test('applies the match multiplier', () => {
    expect(projectedPoints({ hp: 2, ap: 1 }, { hs: 2, as: 1 }, 2)).toBe(60)
  })
  test('never adds the risky bonus (server-only)', () => {
    // pred 1-0 on live 1-0: exact win = 30. With risky it would be 40 — must stay 30.
    expect(projectedPoints({ hp: 1, ap: 0 }, { hs: 1, as: 0 })).toBe(30)
  })
  test('missed pick projects 0', () => {
    expect(projectedPoints({ hp: 2, ap: 1 }, { hs: 0, as: 3 })).toBe(0)
  })
})
