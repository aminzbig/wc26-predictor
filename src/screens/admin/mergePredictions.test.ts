import { describe, expect, test } from 'vitest'
import { mergePlayerPredictions } from './mergePredictions'
import type { Prediction } from '../../lib/types'

const players = [
  { id: 'p1', name: 'Alice', flag_code: null, avatar_url: null },
  { id: 'p2', name: 'Bob', flag_code: 'br', avatar_url: null },
]

describe('mergePlayerPredictions', () => {
  test('a player without a prediction gets null scores (blank boxes)', () => {
    const rows = mergePlayerPredictions(players, [])
    expect(rows[0]).toMatchObject({ player_id: 'p1', home_pred: null, away_pred: null, points_awarded: null })
  })

  test('a player with a prediction keeps its values', () => {
    const preds: Prediction[] = [
      { id: 'x', player_id: 'p2', match_id: 'm', home_pred: 2, away_pred: 1, points_awarded: 30 },
    ]
    const rows = mergePlayerPredictions(players, preds)
    expect(rows[1]).toMatchObject({ player_id: 'p2', home_pred: 2, away_pred: 1, points_awarded: 30 })
  })

  test('preserves player order', () => {
    const rows = mergePlayerPredictions(players, [])
    expect(rows.map(r => r.player_id)).toEqual(['p1', 'p2'])
  })
})
