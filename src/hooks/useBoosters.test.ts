import { describe, expect, test } from 'vitest'
import { indexBoosters } from './useBoosters'
import type { Booster } from '../lib/types'

describe('indexBoosters', () => {
  const rows: Booster[] = [
    { player_id: 'p', match_id: 'm1', stage: 'group', created_at: '' },
    { player_id: 'p', match_id: 'm2', stage: 'r32', created_at: '' },
  ]
  test('keys boosters by match id', () => {
    const { byMatch } = indexBoosters(rows)
    expect(byMatch['m1'].stage).toBe('group')
    expect(byMatch['m2'].stage).toBe('r32')
  })
  test('collects the set of used stages', () => {
    const { usedStages } = indexBoosters(rows)
    expect(usedStages.has('group')).toBe(true)
    expect(usedStages.has('r32')).toBe(true)
    expect(usedStages.has('r16')).toBe(false)
  })
  test('empty input yields empty views', () => {
    const { byMatch, usedStages } = indexBoosters([])
    expect(Object.keys(byMatch)).toHaveLength(0)
    expect(usedStages.size).toBe(0)
  })
})
