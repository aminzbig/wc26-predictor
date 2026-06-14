import { useMemo, useState } from 'react'
import { useMatches } from '../hooks/useMatches'
import { usePredictions } from '../hooks/usePredictions'
import { MatchCard } from '../components/MatchCard'
import { matchState } from '../lib/matchState'

type Filter = 'upcoming' | 'locked' | 'finished'

export function Matches() {
  const { matches, loading } = useMatches()
  const { byMatch, save } = usePredictions()
  const [filter, setFilter] = useState<Filter>('upcoming')

  const shown = useMemo(() => matches.filter(m => {
    const s = matchState(m)
    if (filter === 'upcoming') return s === 'open'
    if (filter === 'locked') return s === 'locked'
    return s === 'finished'
  }), [matches, filter])

  if (loading) return <p className="text-muted">Loading matches…</p>
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight mb-1">Matches</h1>
      <div className="flex gap-2 mb-4">
        {(['upcoming', 'locked', 'finished'] as Filter[]).map(f =>
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs font-semibold px-3 py-2 rounded-xl bg-surface ${filter === f ? 'shadow-neu-inset text-accent' : 'shadow-neu-sm text-muted'}`}>
            {f[0].toUpperCase() + f.slice(1)}</button>)}
      </div>
      {shown.length === 0 && <p className="text-muted text-sm">No matches here.</p>}
      {shown.map(m =>
        <MatchCard key={m.id} match={m} prediction={byMatch[m.id]}
          onSave={(h, a) => save(m.id, h, a)} />)}
    </>
  )
}
