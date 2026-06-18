import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SocialCard } from './SocialCard'
import type { PostView } from '../lib/social'

const view: PostView = {
  id: 'a', author_id: 'u1', body: 'my bracket is dead', color: 'yellow', font: 'sans', scale: 1, match_id: null,
  heart_count: 18, up_count: 6, down_count: 0, sandal_count: 3, dead_count: 0,
  created_at: new Date(Date.now() - 31 * 60_000).toISOString(),
  author_name: 'Sofia', author_flag: 'pt', match_label: null, match_home: null, match_away: null,
}

test('renders author, body, and a reaction count', () => {
  render(<SocialCard view={view} canDelete={false} onReact={() => {}} onDelete={() => {}} />)
  expect(screen.getByText('Sofia')).toBeInTheDocument()
  expect(screen.getByText('my bracket is dead')).toBeInTheDocument()
  expect(screen.getByText('18')).toBeInTheDocument()
})

test('shows delete control only when canDelete', () => {
  const { rerender } = render(<SocialCard view={view} canDelete={false} onReact={() => {}} onDelete={() => {}} />)
  expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
  rerender(<SocialCard view={view} canDelete onReact={() => {}} onDelete={() => {}} />)
  expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
})

test('clicking a reaction fires onReact with its key', async () => {
  const onReact = vi.fn()
  render(<SocialCard view={view} canDelete={false} onReact={onReact} onDelete={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: 'heart' }))
  expect(onReact).toHaveBeenCalledWith('heart')
})
