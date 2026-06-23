import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Booster, Stage } from '../lib/types'
import { useAuth } from '../context/AuthContext'

// Pure: build the lookups the UI needs from a flat booster list.
export function indexBoosters(rows: Booster[]): { byMatch: Record<string, Booster>; usedStages: Set<Stage> } {
  const byMatch: Record<string, Booster> = {}
  const usedStages = new Set<Stage>()
  rows.forEach(b => { byMatch[b.match_id] = b; usedStages.add(b.stage) })
  return { byMatch, usedStages }
}

export function useBoosters() {
  const { player } = useAuth()
  const [rows, setRows] = useState<Booster[]>([])

  const load = useCallback(async () => {
    if (!player) { setRows([]); return }
    const { data } = await supabase.from('boosters').select('*').eq('player_id', player.id)
    setRows((data ?? []) as Booster[])
  }, [player])

  useEffect(() => { load() }, [load])

  const { byMatch, usedStages } = indexBoosters(rows)

  // One booster per round: only call when the round is free (UI guards this too).
  async function setBooster(matchId: string, stage: Stage) {
    if (!player) return
    const { error } = await supabase.from('boosters')
      .insert({ player_id: player.id, match_id: matchId, stage })
    if (error) throw new Error(error.message)
    await load()
  }
  async function clearBooster(matchId: string) {
    if (!player) return
    const { error } = await supabase.from('boosters')
      .delete().eq('player_id', player.id).eq('match_id', matchId)
    if (error) throw new Error(error.message)
    await load()
  }
  return { byMatch, usedStages, setBooster, clearBooster, reload: load }
}
