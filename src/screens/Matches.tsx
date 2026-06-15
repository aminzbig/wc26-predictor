import { useEffect, useMemo, useState } from 'react'
import { useMatches } from '../hooks/useMatches'
import { usePredictions } from '../hooks/usePredictions'
import { MatchDeck } from '../components/MatchDeck'
import { MatchGrid } from '../components/MatchGrid'
import { MatchDetail } from '../components/MatchDetail'
import { ViewToggle, type View } from '../components/ViewToggle'
import { matchState } from '../lib/matchState'
import type { Match } from '../lib/types'

type Filter = 'all' | 'upcoming' | 'finished'

// Which card to open on: a game playing right now, else the next upcoming one,
// else the most recent. (list is sorted ascending by kickoff.)
const LIVE_WINDOW_MS = 2.5 * 60 * 60 * 1000 // ~match length + buffer
function initialFocus(list: Match[]) {
  if (list.length === 0) return 0
  const now = Date.now()
  // 1. live: kicked off within the window and not yet finished
  const live = list.findIndex(m => {
    const k = new Date(m.kickoff_at).getTime()
    return k <= now && now - k <= LIVE_WINDOW_MS && m.status !== 'finished'
  })
  if (live !== -1) return live
  // 2. next upcoming
  const upcoming = list.findIndex(m => new Date(m.kickoff_at).getTime() > now)
  if (upcoming !== -1) return upcoming
  // 3. most recent
  return list.length - 1
}

export function Matches() {
  const { matches, loading } = useMatches()
  const { byMatch, save } = usePredictions()
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState<View>('deck')
  const [index, setIndex] = useState(-1)
  const [selected, setSelected] = useState<Match | null>(null)

  // Sorted ascending by kickoff.
  const sorted = useMemo(
    () => [...matches].sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()),
    [matches],
  )

  const shown = useMemo(() => sorted.filter(m => {
    if (filter === 'all') return true
    const s = matchState(m)
    if (filter === 'upcoming') return s === 'open'
    return s === 'finished'
  }), [sorted, filter])

  // Set initial index once when matches first load (don't reset on realtime reloads).
  useEffect(() => {
    if (index === -1 && shown.length > 0) setIndex(initialFocus(shown))
  }, [shown, index])

  // Keep index in range when filter changes / list shrinks.
  useEffect(() => {
    if (index >= shown.length) setIndex(Math.max(0, shown.length - 1))
  }, [shown.length, index])

  const onFilter = (f: Filter) => {
    setFilter(f)
    // recompute a sensible position for the new filtered list
    const next = sorted.filter(m => {
      if (f === 'all') return true
      const s = matchState(m)
      if (f === 'upcoming') return s === 'open'
      return s === 'finished'
    })
    setIndex(initialFocus(next))
  }

  if (loading) return <p className="font-sans font-700 text-ink/60 uppercase text-sm tracking-wide">Loading matches…</p>

  const safeIndex = Math.max(0, Math.min(index, shown.length - 1))
  // Re-derive the open match from the fresh list so realtime score/odds updates flow in.
  const selectedLive = selected ? (sorted.find(m => m.id === selected.id) ?? selected) : null

  return (
    <>
      <div className="flex flex-col h-[calc(100dvh-120px)]">
        {/* Poster header */}
        <div className="bg-ink text-paper px-3 py-2 mb-3 flex justify-between items-center shrink-0">
          <h1 className="font-display text-[20px] uppercase tracking-wide">Matches</h1>
          <ViewToggle view={view} setView={setView} />
        </div>

        {/* Filter chips */}
        <div className="flex gap-0 mb-4 border-[3px] border-ink shrink-0">
          {(['all', 'upcoming', 'finished'] as Filter[]).map(f =>
            <button key={f} onClick={() => onFilter(f)}
              className={`flex-1 font-display text-[13px] uppercase tracking-wide py-2 border-r-[3px] border-ink last:border-r-0 ${filter === f ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}>
              {f}
            </button>)}
        </div>

        <div className="flex-1 min-h-0">
          {shown.length === 0
            ? <p className="font-sans font-700 text-ink/60 uppercase text-sm tracking-wide">No matches here.</p>
            : view === 'grid'
              ? <MatchGrid matches={shown} byMatch={byMatch} onOpen={setSelected} focusId={shown[safeIndex]?.id} />
              : (
                <MatchDeck
                  matches={shown}
                  index={safeIndex}
                  setIndex={setIndex}
                  byMatch={byMatch}
                  onSave={save}
                  onOpen={setSelected}
                />
              )}
        </div>
      </div>

      {selectedLive && (
        <MatchDetail
          match={selectedLive}
          prediction={byMatch[selectedLive.id]}
          onSave={(h, a) => save(selectedLive.id, h, a)}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
