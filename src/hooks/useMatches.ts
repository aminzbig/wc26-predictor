import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Match } from '../lib/types'

export function useMatches() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  async function load() {
    const { data } = await supabase.from('matches').select('*').order('kickoff_at')
    setMatches((data ?? []) as Match[]); setLoading(false)
  }
  useEffect(() => { load() }, [])
  return { matches, loading, reload: load }
}
