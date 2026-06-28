import { describe, expect, test } from 'vitest'
import { exceededSwipe, SWIPE_PX } from './tapNotSwipe'

describe('exceededSwipe', () => {
  const from = { x: 0, y: 0 }
  test('a tiny move (< threshold) is a tap, not a swipe', () => {
    expect(exceededSwipe(from, SWIPE_PX - 1, 0)).toBe(false)
  })
  test('a move past the threshold counts as a swipe', () => {
    expect(exceededSwipe(from, SWIPE_PX + 1, 0)).toBe(true)
  })
  test('measures diagonal distance', () => {
    expect(exceededSwipe(from, 8, 8)).toBe(true) // hypot(8,8) ≈ 11.3 > 10
  })
})
