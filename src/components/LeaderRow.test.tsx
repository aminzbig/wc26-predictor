import { render, screen } from '@testing-library/react'
import { LeaderRow } from './LeaderRow'
import type { LeaderRow as Row } from '../lib/types'

const base: Row = {
  id: 'p1', name: 'Sofia', flag_code: 'pt', avatar_url: null,
  total: 120, exact_hits: 2, diff_hits: 3, admin_deltas: null,
}

test('renders name and total', () => {
  render(<LeaderRow row={base} rank={1} isMe={false} />)
  expect(screen.getByText('Sofia')).toBeInTheDocument()
  expect(screen.getByText('120')).toBeInTheDocument()
})

test('no sticker stack when admin_deltas is empty/null', () => {
  render(<LeaderRow row={base} rank={1} isMe={false} />)
  expect(screen.queryByRole('group', { name: /admin stickers/i })).toBeNull()
})

test('shows a sticker stack when admin_deltas present', () => {
  render(<LeaderRow row={{ ...base, admin_deltas: [10, 10, -10] }} rank={1} isMe={false} />)
  const stack = screen.getByRole('group', { name: /admin stickers/i })
  expect(stack.querySelectorAll('.sticker')).toHaveLength(3)
})
