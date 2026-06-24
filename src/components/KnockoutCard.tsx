import type { BracketMatch, BracketSlot } from '../lib/bracket'
import { Flag } from './Flag'
import { PensLine } from './matchFace'

// One side of the matchup: flag (or TBD placeholder) + name, with its score.
// A resolved slot shows its team; an unresolved slot shows the raw label (e.g. '2A').
function SlotRow({ slot, score, isWinner }:
  { slot: BracketSlot; score: number | null; isWinner: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 ${isWinner ? 'bg-green' : ''}`}>
      {/* Empty label → a clean blank box for a TBD slot (the label shows once in the
          name span beside it), instead of Flag's default '?' placeholder. */}
      <Flag code={slot.code} label="" size="sm" />
      <span className="flex-1 min-w-0 truncate font-display text-[15px] uppercase">
        {slot.name ?? slot.label}
      </span>
      <span className="font-display text-[18px] tabular-nums w-[20px] text-right">
        {score == null ? '' : score}
      </span>
    </div>
  )
}

export function KnockoutCard({ match }: { match: BracketMatch }) {
  const live = match.status !== 'finished' && match.live_home != null
  const finished = match.status === 'finished'
  const homeScore = finished ? match.home_score : live ? match.live_home : null
  const awayScore = finished ? match.away_score : live ? match.live_away : null

  return (
    <div className="border-[3px] border-ink bg-paper mb-3">
      {/* Feeder tag: where each side comes from (e.g. 'W73 · W75'). */}
      <div className="flex items-center justify-between px-2 py-1 bg-ink text-paper">
        <span className="font-sans font-900 text-[9px] uppercase tracking-widest">
          {match.home.label} · {match.away.label}
        </span>
        {live && (
          <span className="font-sans font-900 text-[9px] uppercase tracking-widest">
            <span className="live-dot">●</span> Live{match.live_minute ? ` ${match.live_minute}'` : ''}
          </span>
        )}
        {finished && (
          <span className="font-sans font-900 text-[9px] uppercase tracking-widest opacity-70">Full time</span>
        )}
      </div>
      <SlotRow slot={match.home} score={homeScore} isWinner={match.winnerCode != null && match.winnerCode === match.home.code} />
      <div className="h-[2px] bg-ink/10" />
      <SlotRow slot={match.away} score={awayScore} isWinner={match.winnerCode != null && match.winnerCode === match.away.code} />
      {(match.home_pens != null || match.away_pens != null) && (
        <PensLine home={match.home_pens} away={match.away_pens} className="text-[9px] px-2 py-1 text-center text-ink/70" />
      )}
    </div>
  )
}
