import { useMemo, useState } from 'react'
import type { Match } from '../lib/types'
import { resolveBracket, KO_TABS, type BracketMatch } from '../lib/bracket'
import { KnockoutCard } from './KnockoutCard'

// The default tab = the earliest round (in KO_TABS order) that still has an
// undecided game, so opening Knockout lands on "what's live / next". If every
// game is finished, fall back to the last tab (Final).
function defaultTab(byTab: BracketMatch[][]): string {
  for (let i = 0; i < KO_TABS.length; i++) {
    if (byTab[i].some(m => m.status !== 'finished')) return KO_TABS[i].key
  }
  return KO_TABS[KO_TABS.length - 1].key
}

export function KnockoutBracket({ matches }: { matches: Match[] }) {
  const bracket = useMemo(() => resolveBracket(matches), [matches])
  const byTab = useMemo(
    () => KO_TABS.map(t => bracket
      .filter(m => t.stages.includes(m.stage))
      .sort((a, b) => (a.match_no ?? 0) - (b.match_no ?? 0))),
    [bracket],
  )
  const [tab, setTab] = useState(() => defaultTab(byTab))

  const activeIndex = KO_TABS.findIndex(t => t.key === tab)
  const cards = byTab[activeIndex] ?? []

  return (
    <div className="flex flex-col">
      {/* Round sub-tabs — lighter than the top toggle. */}
      <div className="flex gap-0 mb-3 border-[3px] border-ink shrink-0">
        {KO_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} aria-pressed={tab === t.key}
            className={`flex-1 font-display text-[12px] uppercase tracking-wide py-1.5 border-r-[3px] border-ink last:border-r-0 ${tab === t.key ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {cards.length === 0
        ? <p className="font-sans font-700 text-ink/60 uppercase text-sm tracking-wide">No games in this round yet.</p>
        : cards.map(m => <KnockoutCard key={m.id} match={m} />)}
    </div>
  )
}
