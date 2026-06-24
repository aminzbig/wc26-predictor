import { useMemo, useState } from 'react'
import { useMatches } from '../hooks/useMatches'
import { computeStandings } from '../lib/standings'
import { StandingsTable } from '../components/StandingsTable'
import { KnockoutBracket } from '../components/KnockoutBracket'

type Tab = 'group' | 'knockout'

export function Standings() {
  const { matches, loading } = useMatches()
  const groups = useMemo(() => computeStandings(matches), [matches])

  // The group stage is "done" when every group game has finished.
  const groupStageComplete = useMemo(() => {
    const gs = matches.filter(m => m.stage === 'group')
    return gs.length > 0 && gs.every(m => m.status === 'finished')
  }, [matches])

  // Default to Knockout once the group stage is complete; otherwise Group Stage.
  const [tab, setTab] = useState<Tab | null>(null)
  const active: Tab = tab ?? (groupStageComplete ? 'knockout' : 'group')

  if (loading) return <p className="font-sans font-700 text-ink/60 uppercase text-sm tracking-wide">Loading standings…</p>

  return (
    <>
      {/* Group Stage / Knockout toggle — same pattern as the Matches deck/grid control. */}
      <div className="flex gap-0 mb-4 border-[3px] border-ink shrink-0">
        {([['group', 'Group Stage'], ['knockout', 'Knockout']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} aria-pressed={active === v}
            className={`flex-1 font-display text-[13px] uppercase tracking-wide py-2 border-r-[3px] border-ink last:border-r-0 ${active === v ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {active === 'knockout' ? (
        <KnockoutBracket matches={matches} />
      ) : (
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
      )}
    </>
  )
}
