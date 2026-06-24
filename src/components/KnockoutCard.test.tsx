import { render, screen } from '@testing-library/react'
import { KnockoutCard } from './KnockoutCard'
import type { BracketMatch } from '../lib/bracket'

function bm(p: Partial<BracketMatch>): BracketMatch {
  return {
    id: '1', match_no: 73, stage: 'r32', kickoff_at: '2026-06-28T19:00:00Z',
    multiplier: 1.5, status: 'scheduled',
    home: { code: null, name: null, label: '1A', confirmed: false },
    away: { code: null, name: null, label: '2B', confirmed: false },
    home_score: null, away_score: null, home_pens: null, away_pens: null,
    live_home: null, live_away: null, live_minute: null, live_status: null,
    winnerCode: null, ...p,
  }
}

test('shows TBD for an unresolved slot', () => {
  render(<KnockoutCard match={bm({})} />)
  // Both home and away are unresolved → two TBD rows.
  expect(screen.getAllByText('TBD')).toHaveLength(2)
})

test('shows team names and a final score when resolved', () => {
  render(<KnockoutCard match={bm({
    status: 'finished',
    home: { code: 'mx', name: 'Mexico', label: '1A', confirmed: true },
    away: { code: 'br', name: 'Brazil', label: '2B', confirmed: true },
    home_score: 2, away_score: 1, winnerCode: 'mx',
  })} />)
  expect(screen.getByText('Mexico')).toBeInTheDocument()
  expect(screen.getByText('Brazil')).toBeInTheDocument()
})

test('dims a projected (unconfirmed) team but not a confirmed one', () => {
  render(<KnockoutCard match={bm({
    home: { code: 'mx', name: 'Mexico', label: '1A', confirmed: false }, // projected
    away: { code: 'br', name: 'Brazil', label: '2B', confirmed: true },  // confirmed
  })} />)
  expect(screen.getByText('Mexico').closest('div')!.className).toMatch(/opacity-45/)
  expect(screen.getByText('Brazil').closest('div')!.className).not.toMatch(/opacity-45/)
})

test('shows the penalty line for a game decided on penalties', () => {
  render(<KnockoutCard match={bm({
    status: 'finished',
    home: { code: 'mx', name: 'Mexico', label: '1A', confirmed: true },
    away: { code: 'br', name: 'Brazil', label: '2B', confirmed: true },
    home_score: 1, away_score: 1, home_pens: 4, away_pens: 3, winnerCode: 'mx',
  })} />)
  expect(screen.getByText(/pens 4.?3/i)).toBeInTheDocument()
})
