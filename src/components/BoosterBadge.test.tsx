import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { BoosterBadge } from './BoosterBadge'

test('available badge is an enabled button labelled "use booster"', () => {
  render(<BoosterBadge state="available" onClick={() => {}} />)
  expect(screen.getByRole('button', { name: /use booster/i })).toBeEnabled()
})

test('active badge shows a remove label and the rainbow ring', () => {
  const { container } = render(<BoosterBadge state="active" onClick={() => {}} />)
  expect(screen.getByRole('button', { name: /remove booster/i })).toBeInTheDocument()
  expect(container.querySelector('.booster-rainbow')).toBeTruthy()
})

test('disabled badge is not clickable', () => {
  const onClick = vi.fn()
  render(<BoosterBadge state="disabled" onClick={onClick} />)
  expect(screen.getByRole('button', { name: /already used/i })).toBeDisabled()
})
