import { describe, expect, test } from 'vitest'
import {
  REACTIONS, hottest, bump, relativeTime, colorClass, isLight,
  validBody, validColor, matchLabel, toView, upsertPost, removePost,
  type SocialPostRow,
} from './social'

const row = (over: Partial<SocialPostRow> = {}): SocialPostRow => ({
  id: 'a', author_id: 'u1', body: 'hi', color: 'orange', match_id: null,
  heart_count: 0, up_count: 0, down_count: 0, sandal_count: 0, dead_count: 0,
  created_at: '2026-06-15T00:00:00.000Z', ...over,
})

describe('social helpers', () => {
  test('REACTIONS has the 5 fixed kinds in order', () => {
    expect(REACTIONS.map(r => r.key)).toEqual(['heart', 'up', 'down', 'sandal', 'dead'])
  })
  test('hottest returns null when all counts are 0', () => {
    expect(hottest(row())).toBeNull()
  })
  test('hottest returns the highest-count reaction', () => {
    expect(hottest(row({ heart_count: 2, dead_count: 9 }))).toBe('dead')
  })
  test('bump increments the matching column immutably', () => {
    const r = row()
    expect(bump(r, 'sandal').sandal_count).toBe(1)
    expect(r.sandal_count).toBe(0)
  })
  test('relativeTime formats seconds/minutes/hours/days', () => {
    const base = Date.parse('2026-06-15T12:00:00.000Z')
    expect(relativeTime('2026-06-15T11:59:30.000Z', base)).toBe('now')
    expect(relativeTime('2026-06-15T11:46:00.000Z', base)).toBe('14m')
    expect(relativeTime('2026-06-15T09:00:00.000Z', base)).toBe('3h')
    expect(relativeTime('2026-06-13T12:00:00.000Z', base)).toBe('2d')
  })
  test('colorClass / isLight map blue & red to light text', () => {
    expect(colorClass('blue')).toBe('bg-blue text-paper')
    expect(colorClass('yellow')).toBe('bg-yellow')
    expect(isLight('red')).toBe(true)
    expect(isLight('orange')).toBe(false)
  })
  test('validBody enforces 1..280 non-blank; validColor checks palette', () => {
    expect(validBody('hey')).toBe(true)
    expect(validBody('   ')).toBe(false)
    expect(validBody('x'.repeat(281))).toBe(false)
    expect(validColor('green')).toBe(true)
    expect(validColor('magenta')).toBe(false)
  })
  test('matchLabel uppercases codes', () => {
    expect(matchLabel({ id: 'm', home_code: 'br', away_code: 'ar', home_label: null, away_label: null }))
      .toBe('BR–AR')
  })
  test('toView resolves author + match label', () => {
    const v = toView(row({ author_id: 'u1', match_id: 'm' }),
      { u1: { name: 'Rafa', flag_code: 'br' } },
      { m: { id: 'm', home_code: 'br', away_code: 'ar', home_label: null, away_label: null } })
    expect(v.author_name).toBe('Rafa')
    expect(v.author_flag).toBe('br')
    expect(v.match_label).toBe('BR–AR')
  })
  test('upsertPost adds/replaces and keeps newest-first; removePost deletes', () => {
    const older = row({ id: 'a', created_at: '2026-06-15T00:00:00.000Z' })
    const newer = row({ id: 'b', created_at: '2026-06-15T01:00:00.000Z' })
    const list = upsertPost(upsertPost([], older), newer)
    expect(list.map(p => p.id)).toEqual(['b', 'a'])
    const edited = upsertPost(list, row({ id: 'a', body: 'edited', created_at: older.created_at }))
    expect(edited.find(p => p.id === 'a')!.body).toBe('edited')
    expect(removePost(edited, 'a').map(p => p.id)).toEqual(['b'])
  })
})
