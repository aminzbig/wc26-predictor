import { render, screen } from '@testing-library/react'
import { MatchCard } from './MatchCard'
import type { Match } from '../lib/types'

const m: Match = {
  id: '1', match_no: 1, stage: 'group', group_label: 'C',
  home_code: 'br', away_code: 'hr', home_label: 'Brazil', away_label: 'Croatia',
  kickoff_at: new Date(Date.now() + 3.6e6).toISOString(),
  home_score: null, away_score: null, multiplier: 1, status: 'scheduled',
}

test('open match shows lock button', () => {
  render(<MatchCard match={m} prediction={undefined} onSave={async () => {}} />)
  expect(screen.getByRole('button', { name: /lock/i })).toBeInTheDocument()
})
test('finished match shows points', () => {
  const fin: Match = { ...m, status: 'finished', home_score: 1, away_score: 1,
    kickoff_at: new Date(Date.now() - 3.6e6).toISOString() }
  render(<MatchCard match={fin}
    prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 1, away_pred: 1, points_awarded: 30 }}
    onSave={async () => {}} />)
  expect(screen.getByText(/\+30/)).toBeInTheDocument()
})
