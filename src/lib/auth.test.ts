import { expect, test } from 'vitest'
import { nameToSlug, slugToEmail } from './auth'

test('nameToSlug lowercases and hyphenates', () => {
  expect(nameToSlug('Amir Vala')).toBe('amir-vala')
  expect(nameToSlug('  Sara  ')).toBe('sara')
  expect(nameToSlug('José+!!')).toBe('jos')
})
test('slugToEmail builds synthetic email', () => {
  expect(slugToEmail('amir-vala')).toBe('amir-vala@players.wc26.local')
})
