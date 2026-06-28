import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, beforeEach, test, expect } from 'vitest'
import type { Match } from '../../lib/types'

const finished = {
  id: 'm1', match_no: 1, stage: 'group', group_label: 'A',
  home_code: 'mx', away_code: 'za', home_label: 'Mexico', away_label: 'South Africa',
  kickoff_at: '2026-06-12T00:00:00Z', home_score: 2, away_score: 0,
  multiplier: 1, status: 'finished', prob_home: null, prob_draw: null, prob_away: null,
} as Match

vi.mock('../../hooks/useMatches', () => ({
  useMatches: () => ({ matches: [finished], loading: false, reload: async () => {} }),
}))

const players = [
  { id: 'p1', name: 'Alice', flag_code: null, avatar_url: null },
  { id: 'p2', name: 'Bob', flag_code: null, avatar_url: null },
]
let predictions: any[] = []
const rpc = vi.fn(async () => ({ error: null }))

// AdminTabs uses NavLink which requires a Router context; stub it out since
// this suite is focused on AdminCorrections logic, not the tab bar.
vi.mock('../../components/AdminTabs', () => ({ AdminTabs: () => null }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        order: async () => ({ data: table === 'players' ? players : predictions }),
        eq: async () => ({ data: predictions }),
      }),
    }),
    rpc: (...args: any[]) => rpc(...args),
  },
}))

import { AdminCorrections } from './AdminCorrections'

beforeEach(() => { predictions = []; rpc.mockClear() })

function pickMatch() {
  fireEvent.change(screen.getByLabelText(/select match/i), { target: { value: 'm1' } })
}

test('shows the actual result read-only once a match is picked', async () => {
  render(<AdminCorrections />)
  pickMatch()
  expect(await screen.findByText(/Mexico 2 : 0 South Africa/)).toBeInTheDocument()
})

test('a player with no prediction renders blank boxes', async () => {
  render(<AdminCorrections />)
  pickMatch()
  const home = await screen.findByLabelText(/Alice home prediction/i) as HTMLInputElement
  expect(home.value).toBe('')
})

test('saving calls the RPC with player, match and entered scores', async () => {
  render(<AdminCorrections />)
  pickMatch()
  const home = await screen.findByLabelText(/Alice home prediction/i)
  const away = screen.getByLabelText(/Alice away prediction/i)
  fireEvent.change(home, { target: { value: '2' } })
  fireEvent.change(away, { target: { value: '1' } })
  fireEvent.click(screen.getAllByRole('button', { name: /save/i })[0])
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('admin_set_prediction', {
    p_player: 'p1', p_match: 'm1', p_home: 2, p_away: 1,
  }))
})
