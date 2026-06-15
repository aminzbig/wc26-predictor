import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomNav } from './BottomNav'

// useAuth is consumed by BottomNav; stub a non-admin player.
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ player: { id: 'u1', is_admin: false }, session: null, loading: false }),
}))

test('renders a Social tab linking to /social', () => {
  render(<MemoryRouter><BottomNav /></MemoryRouter>)
  const link = screen.getByRole('link', { name: /social/i })
  expect(link).toHaveAttribute('href', '/social')
})
