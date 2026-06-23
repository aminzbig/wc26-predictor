import { useEffect, useMemo, useState } from 'react'
import { useMatches } from '../hooks/useMatches'
import { usePredictions } from '../hooks/usePredictions'
import { useBoosters } from '../hooks/useBoosters'
import { MatchDeck } from '../components/MatchDeck'
import { MatchGrid } from '../components/MatchGrid'
import { MatchDetail } from '../components/MatchDetail'
import { type View } from '../components/ViewToggle'
import { Layers, LayoutGrid } from 'lucide-react'
import type { Match } from '../lib/types'

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
  const { byMatch: boostByMatch, usedStages, setBooster, clearBooster } = useBoosters()
  const [view, setView] = useState<View>('deck')
  const [index, setIndex] = useState(-1)
  const [selected, setSelected] = useState<Match | null>(null)

  // Sorted ascending by kickoff.
  const shown = useMemo(
    () => [...matches].sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()),
    [matches],
  )

  // Set initial index once when matches first load (don't reset on realtime reloads).
  useEffect(() => {
    if (index === -1 && shown.length > 0) setIndex(initialFocus(shown))
  }, [shown, index])

  // Keep index in range when the list shrinks.
  useEffect(() => {
    if (index >= shown.length) setIndex(Math.max(0, shown.length - 1))
  }, [shown.length, index])

  if (loading) return <p className="font-sans font-700 text-ink/60 uppercase text-sm tracking-wide">Loading matches…</p>

  const safeIndex = Math.max(0, Math.min(index, shown.length - 1))
  // Re-derive the open match from the fresh list so realtime score/odds updates flow in.
  const selectedLive = selected ? (shown.find(m => m.id === selected.id) ?? selected) : null

  return (
    <>
      {/* Deck is a bounded, non-scrolling stack → sits above the floating dock.
          Its height is the measured viewport (--app-vh) minus the Shell's pt
          (16px) and pb (env(safe-area-inset-bottom)+104px), so the deck and the
          floating dock always agree on where the bottom is. Grid scrolls, so it
          fills to the viewport bottom and the negative margin cancels the
          Shell's reserved bottom padding (no double scroll); its tiles then
          scroll BEHIND the translucent dock. */}
      <div className={`flex flex-col ${view === 'grid'
        ? 'h-[calc(var(--app-vh)-16px)] -mb-[calc(env(safe-area-inset-bottom)+104px)]'
        : 'h-[calc(var(--app-vh)-120px-env(safe-area-inset-bottom))]'}`}>
        {/* Deck / Grid view toggle */}
        <div className="flex gap-0 mb-4 border-[3px] border-ink shrink-0">
          {([['deck', Layers, 'Deck'], ['grid', LayoutGrid, 'Grid']] as const).map(([v, Icon, label]) =>
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
              className={`flex-1 flex items-center justify-center gap-1.5 font-display text-[13px] uppercase tracking-wide py-2 border-r-[3px] border-ink last:border-r-0 ${view === v ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}>
              <Icon size={15} />
              {label}
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
                  boostByMatch={boostByMatch}
                  usedStages={usedStages}
                  setBooster={setBooster}
                  clearBooster={clearBooster}
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
