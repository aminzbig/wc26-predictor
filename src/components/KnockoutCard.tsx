import type { BracketMatch, BracketSlot } from '../lib/bracket'
import { Flag } from './Flag'
import { Shield } from 'lucide-react'

// "Sun, Jun 28, 12:00 PM" — the kickoff line at the top of a bracket card.
function kickoffLine(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

// One side of the matchup. A resolved slot shows its flag + team name; an
// unresolved slot shows a grey shield + "TBD" (Google-bracket style — we don't
// yet know which team lands here). The winning side is emphasised.
function SlotRow({ slot, score, isWinner }:
  { slot: BracketSlot; score: number | null; isWinner: boolean }) {
  const resolved = !!slot.code
  // A projected (not-yet-confirmed) team is dimmed to read as tentative.
  const projected = resolved && !slot.confirmed
  return (
    <div className={`flex items-center gap-2 min-w-0 ${projected ? 'opacity-45' : ''}`}>
      {resolved
        ? <Flag code={slot.code} label="" size="sm" />
        : <Shield size={22} className="flex-none text-ink/30" aria-hidden />}
      <span className={`flex-1 min-w-0 truncate font-display text-[14px] uppercase leading-none ${resolved ? (isWinner ? 'text-ink' : 'text-ink/85') : 'text-ink/40'}`}>
        {slot.name ?? 'TBD'}
      </span>
      {score != null && (
        <span className={`font-display text-[15px] tabular-nums leading-none ${isWinner ? 'text-ink' : 'text-ink/55'}`}>{score}</span>
      )}
    </div>
  )
}

// A single bracket fixture, sized to a fixed height so the bracket columns line up.
export function KnockoutCard({ match }: { match: BracketMatch }) {
  const live = match.status !== 'finished' && match.live_home != null
  const finished = match.status === 'finished'
  const homeScore = finished ? match.home_score : live ? match.live_home : null
  const awayScore = finished ? match.away_score : live ? match.live_away : null
  const hasPens = match.home_pens != null || match.away_pens != null

  const homeWin = match.winnerCode != null && match.winnerCode === match.home.code
  const awayWin = match.winnerCode != null && match.winnerCode === match.away.code

  return (
    <div className="h-full w-full border-[2px] border-ink/25 bg-paper rounded-md px-2.5 py-1.5 flex flex-col justify-center gap-1.5 overflow-hidden">
      {/* Top line: live indicator, else kickoff date — plus a compact pens note. */}
      <div className="flex items-center justify-between gap-1 font-sans font-700 text-[9.5px] tracking-wide leading-none">
        {live
          ? <span className="text-ink"><span className="live-dot">●</span> Live{match.live_minute ? ` ${match.live_minute}'` : ''}</span>
          : <span className="text-ink/50 truncate">{kickoffLine(match.kickoff_at)}</span>}
        {hasPens && <span className="text-ink/50 flex-none">Pens {match.home_pens}–{match.away_pens}</span>}
      </div>
      <SlotRow slot={match.home} score={homeScore} isWinner={homeWin} />
      <SlotRow slot={match.away} score={awayScore} isWinner={awayWin} />
    </div>
  )
}
