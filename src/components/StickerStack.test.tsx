import { render, screen, fireEvent } from '@testing-library/react'
import { StickerStack } from './StickerStack'

test('renders nothing when there are no stickers', () => {
  const { container } = render(<StickerStack deltas={[]} />)
  expect(container).toBeEmptyDOMElement()
})

test('renders one star per delta, collapsed by default', () => {
  render(<StickerStack deltas={[10, 10, -10]} />)
  // collapsed pile is a toggle button, not expanded
  const toggle = screen.getByRole('button', { name: /admin stickers/i })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(toggle.querySelectorAll('.sticker')).toHaveLength(3)
})

test('each sticker is labelled; tapping toggles the fanned-out state', () => {
  render(<StickerStack deltas={[10, -10]} />)
  const toggle = screen.getByRole('button', { name: /admin stickers/i })
  expect(screen.getByText('+10 admin')).toBeInTheDocument()
  expect(screen.getByText('-10 admin')).toBeInTheDocument()
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
})

test('colors stickers by sign', () => {
  render(<StickerStack deltas={[10, -10]} />)
  const toggle = screen.getByRole('button', { name: /admin stickers/i })
  expect(toggle.querySelectorAll('.sticker--holo')).toHaveLength(1)
  expect(toggle.querySelectorAll('.sticker--bad')).toHaveLength(1)
})
