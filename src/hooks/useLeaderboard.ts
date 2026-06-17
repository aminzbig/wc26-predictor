import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { LeaderRow } from '../lib/types'

export function useLeaderboard() {
  const [rows, setRows] = useState<LeaderRow[]>([])
  async function load() {
    const { data } = await supabase.from('leaderboard').select('*').order('total', { ascending: false })
    setRows((data ?? []) as LeaderRow[])
  }
  useEffect(() => {
    load()
    const ch = supabase.channel('lb')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])
  return { rows, reload: load }
}
