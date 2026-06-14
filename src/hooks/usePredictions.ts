import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Prediction } from '../lib/types'
import { useAuth } from '../context/AuthContext'

export function usePredictions() {
  const { player } = useAuth()
  const [byMatch, setByMatch] = useState<Record<string, Prediction>>({})

  const load = useCallback(async () => {
    if (!player) return
    const { data } = await supabase.from('predictions').select('*').eq('player_id', player.id)
    const map: Record<string, Prediction> = {}
    ;(data ?? []).forEach(p => { map[(p as Prediction).match_id] = p as Prediction })
    setByMatch(map)
  }, [player])

  useEffect(() => { load() }, [load])

  async function save(matchId: string, hp: number, ap: number) {
    if (!player) return
    const { error } = await supabase.from('predictions')
      .upsert({ player_id: player.id, match_id: matchId, home_pred: hp, away_pred: ap },
              { onConflict: 'player_id,match_id' })
    if (error) throw new Error(error.message)
    await load()
  }
  return { byMatch, save, reload: load }
}
