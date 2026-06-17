import { describe, expect, test } from 'vitest'
import { adminStickers } from './adminStickers'

describe('adminStickers', () => {
  test('null/undefined → empty', () => {
    expect(adminStickers(null)).toEqual([])
    expect(adminStickers(undefined)).toEqual([])
  })
  test('empty array → empty', () => {
    expect(adminStickers([])).toEqual([])
  })
  test('maps deltas to variants, preserving order', () => {
    expect(adminStickers([10, 10, -10])).toEqual([
      { delta: 10, variant: 'holo' },
      { delta: 10, variant: 'holo' },
      { delta: -10, variant: 'bad' },
    ])
  })
  test('single penalty', () => {
    expect(adminStickers([-10])).toEqual([{ delta: -10, variant: 'bad' }])
  })
})
