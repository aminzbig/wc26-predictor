import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Booster, Stage } from '../lib/types'
import { useAuth } from '../context/AuthContext'

// Pure: build the lookups the UI needs from a flat booster list.
// byStage maps a round (stage) → that round's single booster, so the UI can find
// where this round's booster currently sits (and whether that game is still open).
export function indexBoosters(rows: Booster[]): { byMatch: Record<string, Booster>; byStage: Record<string, Booster>; usedStages: Set<Stage> } {
  const byMatch: Record<string, Booster> = {}
  const byStage: Record<string, Booster> = {}
  const usedStages = new Set<Stage>()
  rows.forEach(b => { byMatch[b.match_id] = b; byStage[b.stage] = b; usedStages.add(b.stage) })
  return { byMatch, byStage, usedStages }
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

  const { byMatch, byStage, usedStages } = indexBoosters(rows)

  // One booster per round. If this round already has a booster on a *different*
  // game, MOVE it: delete the old, then insert the new. The old delete only
  // succeeds while that game is still open (RLS), which is exactly when moving
  // should be allowed — once the boosted game locks, the booster is committed.
  async function setBooster(matchId: string, stage: Stage) {
    if (!player) return
    const existing = rows.find(b => b.stage === stage && b.match_id !== matchId)
    if (existing) {
      await supabase.from('boosters').delete().eq('player_id', player.id).eq('match_id', existing.match_id)
    }
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
  return { byMatch, byStage, usedStages, setBooster, clearBooster, reload: load }
}
