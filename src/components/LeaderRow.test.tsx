import { render, screen } from '@testing-library/react'
import { LeaderRow } from './LeaderRow'
import type { LeaderRow as Row } from '../lib/types'

const base: Row = {
  id: 'p1', name: 'Sofia', flag_code: 'pt', avatar_url: null,
  total: 120, exact_hits: 2, diff_hits: 3, admin_units: 0,
}

test('no sticker when admin_units is 0', () => {
  render(<LeaderRow row={base} rank={1} isMe={false} />)
  expect(screen.queryByText(/admin/)).toBeNull()
})

test('positive admin_units shows a holographic +N0 admin sticker', () => {
  render(<LeaderRow row={{ ...base, admin_units: 3 }} rank={1} isMe={false} />)
  const badge = screen.getByText('+30 admin')
  expect(badge).toBeInTheDocument()
  expect(badge.className).toContain('sticker--holo')
})

test('negative admin_units shows a red -N0 admin sticker', () => {
  render(<LeaderRow row={{ ...base, admin_units: -2 }} rank={1} isMe={false} />)
  const badge = screen.getByText('-20 admin')
  expect(badge).toBeInTheDocument()
  expect(badge.className).toContain('sticker--bad')
})
