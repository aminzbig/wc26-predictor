import { render, screen } from '@testing-library/react'
import { KnockoutBracket } from './KnockoutBracket'
import type { Match } from '../lib/types'

let _id = 0
function mk(p: Partial<Match>): Match {
  return {
    id: String(++_id), match_no: null, stage: 'group', group_label: null,
    home_code: null, away_code: null, home_label: null, away_label: null,
    kickoff_at: '2026-06-28T00:00:00Z', home_score: null, away_score: null,
    home_pens: null, away_pens: null, multiplier: 1, status: 'scheduled',
    prob_home: null, prob_draw: null, prob_away: null, ...p,
  } as Match
}

const knockout: Match[] = [
  mk({ match_no: 73, stage: 'r32', home_label: '1A', away_label: '2B', multiplier: 1.5 }),
  mk({ match_no: 89, stage: 'r16', home_label: 'W73', away_label: 'W75', multiplier: 2 }),
  mk({ match_no: 104, stage: 'final', home_label: 'W101', away_label: 'W102', multiplier: 6 }),
]

test('renders a sub-tab for every knockout round', () => {
  render(<KnockoutBracket matches={knockout} />)
  for (const label of ['R32', 'R16', 'QF', 'SF', 'Final']) {
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
  }
})

test('defaults to the earliest round that still has an undecided match', () => {
  render(<KnockoutBracket matches={knockout} />)
  // R32 #73 is unfinished → R32 tab is active
  expect(screen.getByRole('button', { name: 'R32' })).toHaveAttribute('aria-pressed', 'true')
})

test('defaults to the Final tab when every round is finished', () => {
  const allDone = knockout.map(m => ({ ...m, status: 'finished' as const, home_score: 1, away_score: 0 }))
  render(<KnockoutBracket matches={allDone} />)
  expect(screen.getByRole('button', { name: 'Final' })).toHaveAttribute('aria-pressed', 'true')
})
