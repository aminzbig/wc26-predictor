import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import type { Match, Prediction } from '../lib/types'
import { matchState } from '../lib/matchState'
import { Flag } from './Flag'

// Same deterministic panel palette as the big deck card so the grid feels like
// the same poster, just shrunk down.
const PANEL_COLORS = ['bg-orange', 'bg-green', 'bg-blue text-paper', 'bg-yellow', 'bg-red text-paper']
const panelColor = (match_no: number) => PANEL_COLORS[match_no % PANEL_COLORS.length]

// The number shown on each team's row: real score when finished, live score in
// progress, otherwise the player's own prediction (or a dash if not picked yet).
function teamValue(match: Match, prediction: Prediction | undefined, finished: boolean, live: boolean, side: 'home' | 'away') {
  if (finished) return (side === 'home' ? match.home_score : match.away_score) ?? null
  if (live) return (side === 'home' ? match.live_home : match.live_away) ?? null
  if (prediction) return side === 'home' ? prediction.home_pred : prediction.away_pred
  return null
}

function Row({ code, label, value }: { code: string | null; label: string | null; value: number | null }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Flag code={code} label={label} size="sm" />
      {/* clamp to 2 lines max so a long name (e.g. Bosnia & Herzegovina) never
          blows out the tile height — every tile stays the same size. */}
      <span className="font-display text-[13px] leading-[0.95] uppercase tracking-wide line-clamp-2 flex-1 min-w-0">{label ?? '—'}</span>
      <span className={`w-[24px] h-[24px] grid place-items-center border-2 border-ink bg-paper font-display text-[15px] leading-none flex-none ${value == null ? 'text-ink/30' : 'text-ink'}`}>
        {value ?? '–'}
      </span>
    </div>
  )
}

export function MatchTile({ match, prediction, onOpen }: {
  match: Match
  prediction?: Prediction
  onOpen: () => void
}) {
  const state = matchState(match)
  const finished = state === 'finished'
  const live = state === 'locked' && match.live_home != null

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileTap={{ scale: 0.97 }}
      className={`${panelColor(match.match_no ?? 0)} border-[3px] border-ink p-2.5 relative overflow-hidden text-left flex flex-col w-full h-full min-h-[118px]`}
    >
      {/* Starburst points badge, same idea as the big card but smaller */}
      {finished && prediction?.points_awarded != null && (
        <div
          className="star-badge absolute -top-2 -right-1.5 w-[40px] h-[40px] bg-ink text-yellow flex items-center justify-center font-display text-[12px]"
          style={{ transform: 'rotate(8deg)' }}
        >
          +{prediction.points_awarded}
        </div>
      )}

      {/* Header: group/stage · date — status chip */}
      <div className="shrink-0 flex items-center justify-between text-[8px] font-sans font-900 uppercase tracking-widest leading-none gap-1">
        <span className="truncate">
          {match.group_label ?? match.stage.toUpperCase()} · {new Date(match.kickoff_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
        </span>
        {state === 'open' && <span className="flex-none">★ OPEN</span>}
        {state === 'locked' && (live
          ? <span className="flex-none">● LIVE{match.live_minute ? ` ${match.live_minute}'` : ''}</span>
          : <span className="flex items-center gap-0.5 flex-none"><Lock size={8} />LOCK</span>)}
        {finished && <span className="flex-none">FT</span>}
      </div>

      {/* Two team rows — centered in the remaining space so every tile matches */}
      <div className="flex-1 min-h-0 flex flex-col justify-center gap-2">
        <Row code={match.home_code} label={match.home_label} value={teamValue(match, prediction, finished, live, 'home')} />
        <Row code={match.away_code} label={match.away_label} value={teamValue(match, prediction, finished, live, 'away')} />
      </div>
    </motion.button>
  )
}
