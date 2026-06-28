import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi } from 'vitest'
import { MatchCard } from './MatchCard'
import { tap } from '../test/pointer'
import type { Match } from '../lib/types'

const m: Match = {
  id: '1', match_no: 1, stage: 'group', group_label: 'C',
  home_code: 'br', away_code: 'hr', home_label: 'Brazil', away_label: 'Croatia',
  kickoff_at: new Date(Date.now() + 3.6e6).toISOString(),
  home_score: null, away_score: null, multiplier: 1, status: 'scheduled',
}

test('open match shows editable score inputs (auto-saves, no lock button)', () => {
  render(<MatchCard match={m} prediction={undefined} onSave={async () => {}} />)
  expect(screen.getByLabelText(/Brazil predicted score/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/Croatia predicted score/i)).toBeInTheDocument()
})
test('entering a fresh 0-0 prediction auto-saves it', async () => {
  vi.useFakeTimers()
  try {
    const onSave = vi.fn(async () => {})
    render(<MatchCard match={m} prediction={undefined} onSave={onSave} />)
    // No prior prediction; the user deliberately picks 0-0. Clearing the field
    // fires onChange(0) — the realistic way to commit a zero.
    fireEvent.change(screen.getByLabelText(/Brazil predicted score/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/Croatia predicted score/i), { target: { value: '' } })
    await act(async () => { vi.advanceTimersByTime(800) })
    expect(onSave).toHaveBeenCalledWith(0, 0)
  } finally {
    vi.useRealTimers()
  }
})

test('finished match shows the points star', () => {
  const fin: Match = { ...m, status: 'finished', home_score: 1, away_score: 1,
    kickoff_at: new Date(Date.now() - 3.6e6).toISOString() }
  render(<MatchCard match={fin}
    prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 1, away_pred: 1, points_awarded: 30 }}
    onSave={async () => {}} />)
  expect(screen.getByText('POINTS')).toBeInTheDocument()
  expect(screen.getByText('30')).toBeInTheDocument()
})

test('open match shows an available, enabled booster badge', () => {
  render(<MatchCard match={m} onSave={async () => {}} boosterRoundUsed={false} onToggleBooster={() => {}} />)
  expect(screen.getByRole('button', { name: /use booster/i })).toBeEnabled()
})

test('active booster shows a remove control and the rainbow outline', () => {
  const { container } = render(<MatchCard match={m} onSave={async () => {}} boosterActive onToggleBooster={() => {}} />)
  expect(screen.getByRole('button', { name: /remove booster/i })).toBeInTheDocument()
  expect(container.querySelector('.booster-rainbow')).toBeTruthy()
})

test('booster already used this round renders a disabled badge', () => {
  render(<MatchCard match={m} onSave={async () => {}} boosterRoundUsed onToggleBooster={() => {}} />)
  expect(screen.getByRole('button', { name: /already used/i })).toBeDisabled()
})

const ko: Match = { ...m, stage: 'r16', group_label: null }

test('fresh knockout card (default 0-0, no prediction) shows the advancer picker', () => {
  render(<MatchCard match={ko} prediction={undefined} onSave={async () => {}} />)
  expect(screen.getByLabelText(/Brazil advances/i)).toBeInTheDocument()
})

test('knockout tie prediction shows the advancer picker', () => {
  render(<MatchCard match={ko}
    prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 1, away_pred: 1, points_awarded: null }}
    onSave={async () => {}} />)
  expect(screen.getByLabelText(/Brazil advances/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/Croatia advances/i)).toBeInTheDocument()
})

test('knockout decisive prediction hides the advancer picker', () => {
  render(<MatchCard match={ko}
    prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 2, away_pred: 1, points_awarded: null }}
    onSave={async () => {}} />)
  expect(screen.queryByLabelText(/Brazil advances/i)).toBeNull()
})

test('group-stage tie shows no advancer picker', () => {
  render(<MatchCard match={m}
    prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 1, away_pred: 1, points_awarded: null }}
    onSave={async () => {}} />)
  expect(screen.queryByLabelText(/Brazil advances/i)).toBeNull()
})

test('choosing an advancer auto-saves with the winner_side', async () => {
  vi.useFakeTimers()
  try {
    const onSave = vi.fn(async () => {})
    render(<MatchCard match={ko}
      prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 1, away_pred: 1, points_awarded: null }}
      onSave={onSave} />)
    tap(screen.getByLabelText(/Croatia advances/i))
    await act(async () => { vi.advanceTimersByTime(800) })
    expect(onSave).toHaveBeenCalledWith(1, 1, 'away')
  } finally {
    vi.useRealTimers()
  }
})
