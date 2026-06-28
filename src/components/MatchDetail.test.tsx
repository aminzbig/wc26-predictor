import { render, screen, act, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MatchDetail } from './MatchDetail'
import { tap } from '../test/pointer'
import type { Match } from '../lib/types'

// Locked/finished details render PeoplePredictions, which queries Supabase; stub it
// so those tests don't hit the network. Returns no rows (board renders nothing).
vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) },
}))

const ko: Match = {
  id: '1', match_no: 73, stage: 'r16', group_label: null,
  home_code: 'br', away_code: 'hr', home_label: 'Brazil', away_label: 'Croatia',
  kickoff_at: new Date(Date.now() + 3.6e6).toISOString(),
  home_score: null, away_score: null, multiplier: 1, status: 'scheduled',
  prob_home: null, prob_draw: null, prob_away: null,
}

test('fresh knockout card (no prediction) hides the picker until both scores are entered', () => {
  render(<MatchDetail match={ko} prediction={undefined} onSave={async () => {}} onClose={() => {}} />)
  // Untouched scores read "–", not a 0-0 tie, so the penalty picker stays hidden.
  expect(screen.queryByLabelText(/Brazil advances/i)).toBeNull()
  // Typing an equal scoreline (including a deliberate 0-0) makes it a tie → picker appears.
  fireEvent.change(screen.getByLabelText(/Brazil predicted score/i), { target: { value: '0' } })
  fireEvent.change(screen.getByLabelText(/Croatia predicted score/i), { target: { value: '0' } })
  expect(screen.getByLabelText(/Brazil advances/i)).toBeInTheDocument()
})

test('knockout tie shows the advancer picker in the detail view', () => {
  render(<MatchDetail match={ko}
    prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 1, away_pred: 1, points_awarded: null }}
    onSave={async () => {}} onClose={() => {}} />)
  expect(screen.getByLabelText(/Brazil advances/i)).toBeInTheDocument()
})

test('a chosen advancer renders the winner badge', () => {
  render(<MatchDetail match={ko}
    prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 1, away_pred: 1, points_awarded: null, winner_side: 'away' }}
    onSave={async () => {}} onClose={() => {}} />)
  expect(screen.getByText(/Croatia wins on penalties/i)).toBeInTheDocument()
})

test('choosing an advancer auto-saves with the winner_side', async () => {
  vi.useFakeTimers()
  try {
    const onSave = vi.fn(async () => {})
    render(<MatchDetail match={ko}
      prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 1, away_pred: 1, points_awarded: null }}
      onSave={onSave} onClose={() => {}} />)
    tap(screen.getByLabelText(/Brazil advances/i))
    await act(async () => { vi.advanceTimersByTime(800) })
    expect(onSave).toHaveBeenCalledWith(1, 1, 'home')
  } finally {
    vi.useRealTimers()
  }
})

test('locked knockout tie shows the read-only picker and the winner badge', () => {
  const locked: Match = { ...ko, kickoff_at: new Date(Date.now() - 3.6e6).toISOString() } // past kickoff → locked
  render(<MatchDetail match={locked}
    prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 1, away_pred: 1, points_awarded: null, winner_side: 'away' }}
    onSave={async () => {}} onClose={() => {}} />)
  expect(screen.getByLabelText(/Brazil advances/i)).toBeInTheDocument()
  expect(screen.getByText(/Croatia wins on penalties/i)).toBeInTheDocument()
})

test('group-stage tie shows no picker in the detail view', () => {
  const grp: Match = { ...ko, stage: 'group', group_label: 'C' }
  render(<MatchDetail match={grp}
    prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 1, away_pred: 1, points_awarded: null }}
    onSave={async () => {}} onClose={() => {}} />)
  expect(screen.queryByLabelText(/advances/i)).toBeNull()
})

test('decisive knockout hides the picker in the detail view', () => {
  render(<MatchDetail match={ko}
    prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 2, away_pred: 1, points_awarded: null }}
    onSave={async () => {}} onClose={() => {}} />)
  expect(screen.queryByLabelText(/advances/i)).toBeNull()
})

test('editable knockout tie with no pick shows the nudge', () => {
  render(<MatchDetail match={ko}
    prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 1, away_pred: 1, points_awarded: null }}
    onSave={async () => {}} onClose={() => {}} />)
  expect(screen.getByText(/pick the penalty winner/i)).toBeInTheDocument()
})
