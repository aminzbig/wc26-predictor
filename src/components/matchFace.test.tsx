import { render, screen } from '@testing-library/react'
import { TopThreePredictors } from './matchFace'
import type { Match } from '../lib/types'

const finished: Match = {
  id: '1', match_no: 1, stage: 'group', group_label: 'C',
  home_code: 'br', away_code: 'hr', home_label: 'Brazil', away_label: 'Croatia',
  kickoff_at: new Date(Date.now() - 3.6e6).toISOString(),
  home_score: 1, away_score: 1, multiplier: 1, status: 'finished',
}

test('boosted finished card renders the booster indicator', () => {
  render(<TopThreePredictors match={finished} boosted />)
  expect(screen.getByLabelText(/booster active/i)).toBeInTheDocument()
})

test('non-boosted finished card renders no booster indicator', () => {
  render(<TopThreePredictors match={finished} />)
  expect(screen.queryByLabelText(/booster active/i)).toBeNull()
})
