import { render, screen } from '@testing-library/react'
import { vi, beforeEach, test, expect } from 'vitest'
import type { Match } from '../lib/types'

let _id = 0
function mk(p: Partial<Match>): Match {
  return {
    id: String(++_id), match_no: null, stage: 'group', group_label: null,
    home_code: null, away_code: null, home_label: null, away_label: null,
    kickoff_at: '2026-06-12T00:00:00Z', home_score: null, away_score: null,
    home_pens: null, away_pens: null, multiplier: 1, status: 'scheduled',
    prob_home: null, prob_draw: null, prob_away: null, ...p,
  } as Match
}

// Controllable mock of the data hook.
let mockMatches: Match[] = []
vi.mock('../hooks/useMatches', () => ({ useMatches: () => ({ matches: mockMatches, loading: false }) }))

// Stub the bracket child so this test focuses on the toggle, not bracket internals.
vi.mock('../components/KnockoutBracket', () => ({ KnockoutBracket: () => <div data-testid="knockout" /> }))

import { Standings } from './Standings'

beforeEach(() => { _id = 0 })

test('shows both toggle tabs', async () => {
  mockMatches = [mk({ stage: 'group', group_label: 'Group A', home_code: 'mx', away_code: 'za', home_label: 'Mexico', away_label: 'South Africa', home_score: 2, away_score: 0, status: 'finished' })]
  render(<Standings />)
  expect(screen.getByRole('button', { name: /group stage/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /knockout/i })).toBeInTheDocument()
})

test('defaults to Group Stage while the group stage is incomplete', () => {
  mockMatches = [mk({ stage: 'group', group_label: 'Group A', home_code: 'mx', away_code: 'za', status: 'scheduled' })]
  render(<Standings />)
  expect(screen.getByRole('button', { name: /group stage/i })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByTestId('knockout')).toBeNull()
})

test('defaults to Knockout once every group game is finished', () => {
  mockMatches = [
    mk({ stage: 'group', group_label: 'Group A', home_code: 'mx', away_code: 'za', home_score: 1, away_score: 0, status: 'finished' }),
    mk({ stage: 'r32', home_label: '1A', away_label: '2B', match_no: 73, multiplier: 1.5 }),
  ]
  render(<Standings />)
  expect(screen.getByRole('button', { name: /knockout/i })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByTestId('knockout')).toBeInTheDocument()
})
