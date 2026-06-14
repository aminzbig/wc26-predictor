import { expect, test } from 'vitest'
import { matchState } from './matchState'
import type { Match } from './types'

const base: Match = {
  id: '1', match_no: 1, stage: 'group', group_label: 'A',
  home_code: 'br', away_code: 'hr', home_label: null, away_label: null,
  kickoff_at: '', home_score: null, away_score: null, multiplier: 1, status: 'scheduled',
}
const future = new Date(Date.now() + 3.6e6).toISOString()
const past = new Date(Date.now() - 3.6e6).toISOString()

test('open before kickoff', () => {
  expect(matchState({ ...base, kickoff_at: future })).toBe('open')
})
test('locked after kickoff, not finished', () => {
  expect(matchState({ ...base, kickoff_at: past })).toBe('locked')
})
test('finished when status finished', () => {
  expect(matchState({ ...base, kickoff_at: past, status: 'finished', home_score: 1, away_score: 0 })).toBe('finished')
})
