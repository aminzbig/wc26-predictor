import { describe, expect, test } from 'vitest'
import { adminBadge } from './adminBadge'

describe('adminBadge', () => {
  test('zero units → null (no sticker)', () => {
    expect(adminBadge(0)).toBeNull()
  })
  test('positive units → holographic sticker with +N0 admin label', () => {
    expect(adminBadge(3)).toEqual({ label: '+30 admin', variant: 'holo' })
  })
  test('single positive unit', () => {
    expect(adminBadge(1)).toEqual({ label: '+10 admin', variant: 'holo' })
  })
  test('negative units → red sticker with -N0 admin label', () => {
    expect(adminBadge(-2)).toEqual({ label: '-20 admin', variant: 'bad' })
  })
  test('max bounds', () => {
    expect(adminBadge(10)).toEqual({ label: '+100 admin', variant: 'holo' })
    expect(adminBadge(-10)).toEqual({ label: '-100 admin', variant: 'bad' })
  })
})
