import { render } from '@testing-library/react'
import { Flag } from './Flag'

test('renders flag span with country class', () => {
  const { container } = render(<Flag code="br" />)
  expect(container.querySelector('.fi-br')).toBeTruthy()
})
test('falls back to neutral box when code missing', () => {
  const { container } = render(<Flag code={null} label="Winner C" />)
  expect(container.textContent).toContain('Winner C')
})
