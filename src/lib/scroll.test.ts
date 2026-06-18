import { describe, expect, test } from 'vitest'
import { shouldHide } from './scroll'

describe('shouldHide', () => {
  test('never hides while the editor is expanded', () => {
    expect(shouldHide({ scrollTop: 500, lastScrollTop: 0, expanded: true, currentlyHidden: false })).toBe(false)
  })

  test('always shown at the top of the feed', () => {
    expect(shouldHide({ scrollTop: 0, lastScrollTop: 400, expanded: false, currentlyHidden: true })).toBe(false)
  })

  test('hides when scrolling down past the threshold', () => {
    expect(shouldHide({ scrollTop: 200, lastScrollTop: 100, expanded: false, currentlyHidden: false })).toBe(true)
  })

  test('reveals when scrolling up past the threshold', () => {
    expect(shouldHide({ scrollTop: 100, lastScrollTop: 200, expanded: false, currentlyHidden: true })).toBe(false)
  })

  test('keeps current state inside the dead zone', () => {
    expect(shouldHide({ scrollTop: 203, lastScrollTop: 200, expanded: false, currentlyHidden: true })).toBe(true)
    expect(shouldHide({ scrollTop: 203, lastScrollTop: 200, expanded: false, currentlyHidden: false })).toBe(false)
  })
})
