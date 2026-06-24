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
// A finished group match.
function g(home: string, away: string, name: string, hs: number, as_: number): Match {
  return mk({
    stage: 'group', group_label: 'Group A', home_code: home, away_code: away,
    home_label: name, away_label: away.toUpperCase(), home_score: hs, away_score: as_, status: 'finished',
  })
}

// Group A complete → '1A' resolves to Mexico. Group B absent → '2B' stays TBD.
// Plus later rounds that are entirely TBD.
const knockout: Match[] = [
  g('mx', 'za', 'Mexico', 2, 0),
  g('mx', 'kr', 'Mexico', 1, 0),
  mk({ stage: 'group', group_label: 'Group A', home_code: 'kr', away_code: 'za', home_label: 'KR', away_label: 'ZA', home_score: 1, away_score: 0, status: 'finished' }),
  mk({ match_no: 73, stage: 'r32', home_label: '1A', away_label: '2B', multiplier: 1.5 }),
  mk({ match_no: 89, stage: 'r16', home_label: 'W73', away_label: 'W75', multiplier: 2 }),
  mk({ match_no: 104, stage: 'final', home_label: 'W101', away_label: 'W102', multiplier: 6 }),
]

test('renders a column header for every knockout round', () => {
  render(<KnockoutBracket matches={knockout} />)
  for (const title of ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final']) {
    expect(screen.getByText(title)).toBeInTheDocument()
  }
})

test('shows a resolved team where known and TBD where not', () => {
  render(<KnockoutBracket matches={knockout} />)
  // Group A winner is known in the R32 card…
  expect(screen.getByText('Mexico')).toBeInTheDocument()
  // …while every undecided side (its opponent + all later rounds) shows TBD.
  expect(screen.getAllByText('TBD').length).toBeGreaterThan(0)
})

test('renders nothing-yet message when there are no knockout matches', () => {
  render(<KnockoutBracket matches={[g('mx', 'za', 'Mexico', 2, 0)]} />)
  expect(screen.getByText(/no knockout matches/i)).toBeInTheDocument()
})
