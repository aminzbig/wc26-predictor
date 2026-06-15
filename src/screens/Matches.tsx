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

  if (loading) return <p className="font-sans font-700 text-ink/60 uppercase text-sm tracking-wide">Loading matches…</p>
  return (
    <>
      {/* Poster header */}
      <div className="bg-ink text-paper px-3 py-2 mb-3 flex justify-between items-center">
        <h1 className="font-display text-[20px] uppercase tracking-wide">Matches</h1>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-0 mb-4 border-[3px] border-ink">
        {(['upcoming', 'locked', 'finished'] as Filter[]).map(f =>
          <button key={f} onClick={() => setFilter(f)}
            className={`flex-1 font-display text-[13px] uppercase tracking-wide py-2 border-r-[3px] border-ink last:border-r-0 ${filter === f ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}>
            {f === 'upcoming' ? 'Open' : f}
          </button>)}
      </div>

      {shown.length === 0 && <p className="font-sans font-700 text-ink/60 uppercase text-sm tracking-wide">No matches here.</p>}
      {shown.map(m =>
        <MatchCard key={m.id} match={m} prediction={byMatch[m.id]}
          onSave={(h, a) => save(m.id, h, a)} />)}
    </>
  )
}
