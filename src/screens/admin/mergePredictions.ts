import type { Player, Prediction } from '../../lib/types'

export interface CorrectionRow {
  player_id: string
  name: string
  flag_code: string | null
  avatar_url: string | null
  home_pred: number | null
  away_pred: number | null
  points_awarded: number | null
}

// Left-join players to their prediction for one match. Players with no
// prediction get null scores so the UI renders blank, fillable boxes.
export function mergePlayerPredictions(
  players: Pick<Player, 'id' | 'name' | 'flag_code' | 'avatar_url'>[],
  predictions: Prediction[],
): CorrectionRow[] {
  const byPlayer = new Map(predictions.map(p => [p.player_id, p]))
  return players.map(pl => {
    const pr = byPlayer.get(pl.id)
    return {
      player_id: pl.id,
      name: pl.name,
      flag_code: pl.flag_code,
      avatar_url: pl.avatar_url,
      home_pred: pr ? pr.home_pred : null,
      away_pred: pr ? pr.away_pred : null,
      points_awarded: pr ? pr.points_awarded : null,
    }
  })
}
