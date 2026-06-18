import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { SocialComposer } from './SocialComposer'
import { ScrollProvider } from '../context/ScrollContext'

// SocialComposer reads the scroll container from context; wrap it in a provider
// with a real ref so the auto-hide hook has something to attach to.
function Harness({ onPost = () => {} }: { onPost?: (...a: unknown[]) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div ref={ref}>
      <ScrollProvider value={ref}>
        <SocialComposer matchList={[]} onPost={onPost} />
      </ScrollProvider>
    </div>
  )
}

test('collapsed pill shows the prompt and hides the editor', () => {
  render(<Harness />)
  expect(screen.getByText(/share something with the group/i)).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByRole('button', { name: /^post$/i })).toBeNull()
})

test('tapping the pill expands the editor, posts, then collapses', async () => {
  const onPost = vi.fn()
  render(<Harness onPost={onPost} />)
  await userEvent.click(screen.getByText(/share something with the group/i))
  const box = screen.getByRole('textbox')
  await userEvent.type(box, 'Brazil are cooking 🔥')
  const post = screen.getByRole('button', { name: /^post$/i })
  expect(post).toBeEnabled()
  await userEvent.click(post)
  expect(onPost).toHaveBeenCalledTimes(1)
  expect(onPost.mock.calls[0]).toEqual(['Brazil are cooking 🔥', 'paper', 'sans', 1, null])
  // posting collapses back to the pill
  expect(screen.queryByRole('textbox')).toBeNull()
})

test('shows remaining character count while expanded', async () => {
  render(<Harness />)
  await userEvent.click(screen.getByText(/share something with the group/i))
  await userEvent.type(screen.getByRole('textbox'), 'hello')
  expect(screen.getByText('275')).toBeInTheDocument() // 280 - 5
})
