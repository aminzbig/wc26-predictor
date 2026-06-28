import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { TopThreePredictors, PensLine, FlagPanel, WinnerPicker, AdvancerBadge } from './matchFace'
import { tap, swipe } from '../test/pointer'
import type { Match } from '../lib/types'

const PICK = { homeLabel: 'Brazil', awayLabel: 'Croatia', homeCode: 'br', awayCode: 'hr' }

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

test('PensLine renders the penalty score when both are present', () => {
  render(<PensLine home={4} away={3} />)
  expect(screen.getByText(/penalties 4.?3/i)).toBeInTheDocument()
})

test('PensLine renders nothing without a penalty score', () => {
  const { container } = render(<PensLine home={null} away={2} />)
  expect(container).toBeEmptyDOMElement()
})

test('FlagPanel: a tap focuses the score input, a swipe does not', () => {
  render(<FlagPanel code="br" label="Brazil" value={1} editable onChange={vi.fn()} />)
  const overlay = screen.getByTestId('num-overlay')
  const input = screen.getByLabelText(/Brazil predicted score/i)

  swipe(overlay)
  expect(input).not.toHaveFocus()

  tap(overlay)
  expect(input).toHaveFocus()
})

test('WinnerPicker: tapping a side selects it', () => {
  const onChange = vi.fn()
  render(<WinnerPicker {...PICK} value={null} editable onChange={onChange} />)
  tap(screen.getByLabelText(/Brazil advances/i))
  expect(onChange).toHaveBeenCalledWith('home')
})

test('WinnerPicker: a swipe does not select (passes through)', () => {
  const onChange = vi.fn()
  render(<WinnerPicker {...PICK} value={null} editable onChange={onChange} />)
  swipe(screen.getByLabelText(/Croatia advances/i))
  expect(onChange).not.toHaveBeenCalled()
})

test('WinnerPicker: read-only does not fire onChange on tap', () => {
  const onChange = vi.fn()
  render(<WinnerPicker {...PICK} value="home" editable={false} onChange={onChange} />)
  tap(screen.getByLabelText(/Brazil advances/i))
  expect(onChange).not.toHaveBeenCalled()
})

test('WinnerPicker: a tap selects but does not bubble to a parent click handler', () => {
  const onChange = vi.fn()
  const parentClick = vi.fn()
  render(<div onClick={parentClick}><WinnerPicker {...PICK} value={null} editable onChange={onChange} /></div>)
  tap(screen.getByLabelText(/Brazil advances/i))
  expect(onChange).toHaveBeenCalledWith('home')
  expect(parentClick).not.toHaveBeenCalled()
})

test('WinnerPicker: read-only with no pick shows a neutral caption, not the prompt', () => {
  render(<WinnerPicker {...PICK} value={null} editable={false} onChange={() => {}} />)
  expect(screen.getByText(/no advancer picked/i)).toBeInTheDocument()
  expect(screen.queryByText(/who advances/i)).toBeNull()
})

test('AdvancerBadge: names the advancing team', () => {
  render(<AdvancerBadge side="away" {...PICK} />)
  expect(screen.getByText(/Croatia wins on penalties/i)).toBeInTheDocument()
})
