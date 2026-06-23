import { describe, expect, test } from 'vitest'
import { basePoints, projectedPoints, isFarOff, farOffApplies, FAR_OFF_RULE_FROM } from './scoring'

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
  test('booster doubles the projected points', () => {
    expect(projectedPoints({ hp: 2, ap: 1 }, { hs: 2, as: 1 }, 1, 2)).toBe(60)
  })
  test('booster stacks with the match multiplier', () => {
    expect(projectedPoints({ hp: 2, ap: 1 }, { hs: 2, as: 1 }, 2, 2)).toBe(120)
  })
  test('default boost leaves points unchanged', () => {
    expect(projectedPoints({ hp: 2, ap: 1 }, { hs: 2, as: 1 }, 2)).toBe(60)
  })
})

describe('far-off rule', () => {
  test('isFarOff: total goal error >= 5 is far off', () => {
    expect(isFarOff({ hp: 5, ap: 1 }, { hs: 1, as: 0 })).toBe(true)   // dist 5
    expect(isFarOff({ hp: 3, ap: 3 }, { hs: 0, as: 0 })).toBe(true)   // dist 6
  })
  test('isFarOff: dist 4 is NOT far off (1-0 vs 5-0 keeps points)', () => {
    expect(isFarOff({ hp: 1, ap: 0 }, { hs: 5, as: 0 })).toBe(false)  // dist 4
  })
  test('farOffApplies: kickoff on/after cutoff applies, before does not', () => {
    expect(farOffApplies('2026-06-25T18:00:00Z')).toBe(true)
    expect(farOffApplies(FAR_OFF_RULE_FROM)).toBe(true)               // boundary inclusive
    expect(farOffApplies('2026-06-15T18:00:00Z')).toBe(false)
  })
  test('farOffApplies: handles PostgREST offset form (+00:00), not just Z', () => {
    expect(farOffApplies('2026-06-24T00:00:00+00:00')).toBe(true)   // exactly at cutoff
    expect(farOffApplies('2026-06-25T18:00:00+00:00')).toBe(true)
    expect(farOffApplies('2026-06-15T18:00:00+00:00')).toBe(false)
  })
  test('basePoints zeroes a far-off prediction when the rule is active', () => {
    // 5-1 vs 1-0: correct home-win outcome (+10) normally, dist 5 -> 0
    expect(basePoints({ hp: 5, ap: 1 }, { hs: 1, as: 0 })).toBe(10)            // rule off
    expect(basePoints({ hp: 5, ap: 1 }, { hs: 1, as: 0 }, undefined, false, true)).toBe(0)
  })
  test('basePoints zeroes a far-off correct draw (3-3 vs 0-0) when active', () => {
    expect(basePoints({ hp: 3, ap: 3 }, { hs: 0, as: 0 })).toBe(15)            // rule off
    expect(basePoints({ hp: 3, ap: 3 }, { hs: 0, as: 0 }, undefined, false, true)).toBe(0)
  })
  test('basePoints leaves dist-4 prediction untouched even when active', () => {
    // 1-0 vs 5-0: dist 4 (not far-off). outcome+away = 15 (away goal 0==0 matches).
    expect(basePoints({ hp: 1, ap: 0 }, { hs: 5, as: 0 }, undefined, false, true)).toBe(15)
  })
  test('basePoints leaves an exact score untouched when active (dist 0)', () => {
    expect(basePoints({ hp: 4, ap: 3 }, { hs: 4, as: 3 }, undefined, false, true)).toBe(30)
  })
  test('projectedPoints zeroes a far-off pick when the rule is active', () => {
    // 5-1 vs live 1-0, multiplier 2, boost 2 -> normally 10*2*2=40, far-off -> 0
    expect(projectedPoints({ hp: 5, ap: 1 }, { hs: 1, as: 0 }, 2, 2)).toBe(40)        // rule off
    expect(projectedPoints({ hp: 5, ap: 1 }, { hs: 1, as: 0 }, 2, 2, true)).toBe(0)   // rule on
  })
})
