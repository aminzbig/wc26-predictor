import { describe, expect, test } from 'vitest'
import { basePoints } from './scoring'

const P = { exact: 30, diff: 15, outcome: 10 }

describe('basePoints', () => {
  test('exact score', () => {
    expect(basePoints({ hp: 2, ap: 1 }, { hs: 2, as: 1 }, P)).toBe(30)
  })
  test('correct goal difference, not exact', () => {
    expect(basePoints({ hp: 2, ap: 1 }, { hs: 3, as: 2 }, P)).toBe(15)
  })
  test('correct non-exact draw counts as goal difference', () => {
    expect(basePoints({ hp: 1, ap: 1 }, { hs: 2, as: 2 }, P)).toBe(15)
  })
  test('same goal difference is scored as diff (15), not outcome', () => {
    // pred 2-1 and result 1-0 both have GD +1 -> goal difference, matches DB
    expect(basePoints({ hp: 2, ap: 1 }, { hs: 1, as: 0 }, P)).toBe(15)
  })
  test('correct outcome only (right winner, different margin)', () => {
    expect(basePoints({ hp: 2, ap: 0 }, { hs: 1, as: 0 }, P)).toBe(10)
  })
  test('wrong', () => {
    expect(basePoints({ hp: 2, ap: 1 }, { hs: 0, as: 3 }, P)).toBe(0)
  })
})
