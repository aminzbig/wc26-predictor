import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SocialComposer } from './SocialComposer'

test('Post is disabled until valid text is entered, then fires onPost', async () => {
  const onPost = vi.fn()
  render(<SocialComposer matchList={[]} onPost={onPost} />)
  const post = screen.getByRole('button', { name: /post/i })
  expect(post).toBeDisabled()
  await userEvent.type(screen.getByRole('textbox'), 'Brazil are cooking 🔥')
  expect(post).toBeEnabled()
  await userEvent.click(post)
  expect(onPost).toHaveBeenCalledTimes(1)
  expect(onPost.mock.calls[0][0]).toBe('Brazil are cooking 🔥')
})

test('shows remaining character count', async () => {
  render(<SocialComposer matchList={[]} onPost={() => {}} />)
  await userEvent.type(screen.getByRole('textbox'), 'hello')
  expect(screen.getByText('275')).toBeInTheDocument() // 280 - 5
})
