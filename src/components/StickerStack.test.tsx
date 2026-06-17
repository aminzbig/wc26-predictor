import { render, screen } from '@testing-library/react'
import { StickerStack } from './StickerStack'

test('renders nothing when there are no stickers', () => {
  const { container } = render(<StickerStack deltas={[]} />)
  expect(container).toBeEmptyDOMElement()
})

test('renders one sticker button per delta', () => {
  render(<StickerStack deltas={[10, 10, -10]} />)
  expect(screen.getAllByRole('button')).toHaveLength(3)
})

test('each sticker is labelled like "+10 admin" / "-10 admin"', () => {
  render(<StickerStack deltas={[10, -10]} />)
  expect(screen.getByRole('button', { name: '+10 admin' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '-10 admin' })).toBeInTheDocument()
})

test('colors stickers by sign', () => {
  const { container } = render(<StickerStack deltas={[10, -10]} />)
  expect(container.querySelectorAll('.sticker--holo')).toHaveLength(1)
  expect(container.querySelectorAll('.sticker--bad')).toHaveLength(1)
})
