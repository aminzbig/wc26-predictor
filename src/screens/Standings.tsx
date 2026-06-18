import { useMemo } from 'react'
import { useMatches } from '../hooks/useMatches'
import { computeStandings } from '../lib/standings'
import { StandingsTable } from '../components/StandingsTable'

export function Standings() {
  const { matches, loading } = useMatches()
  const groups = useMemo(() => computeStandings(matches), [matches])

  if (loading) return <p className="font-sans font-700 text-ink/60 uppercase text-sm tracking-wide">Loading standings…</p>

  return (
    <>
      {groups.length === 0
        ? <p className="font-sans font-700 text-ink/60 uppercase text-sm tracking-wide">No groups yet.</p>
        : groups.map(g => <StandingsTable key={g.label} group={g} />)}

      {/* Legend */}
      {groups.length > 0 && (
        <div className="flex items-center gap-4 mt-3 font-sans font-900 text-[10px] uppercase tracking-widest text-ink/60">
          <span className="flex items-center gap-1.5">
            <span className="w-[14px] h-[14px] bg-green border-[2px] border-ink inline-block" />Advance
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-[14px] h-[14px] border-[2px] border-dashed border-green inline-block" />Wildcard
          </span>
        </div>
      )}
    </>
  )
}
