import { describe, expect, test } from 'vitest'
import { buildPredictionRow } from './usePredictions'

describe('buildPredictionRow', () => {
  test('omits winner_side when not provided', () => {
    expect(buildPredictionRow('p', 'm', 1, 2)).toEqual({
      player_id: 'p', match_id: 'm', home_pred: 1, away_pred: 2,
    })
  })
  test('includes winner_side when a side is given', () => {
    expect(buildPredictionRow('p', 'm', 1, 1, 'home')).toMatchObject({ winner_side: 'home' })
  })
  test('includes winner_side when explicitly null (clears it)', () => {
    expect(buildPredictionRow('p', 'm', 1, 1, null)).toHaveProperty('winner_side', null)
  })
})
