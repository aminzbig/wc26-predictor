import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import type { Match, Prediction } from '../lib/types'
import { matchState } from '../lib/matchState'
import { Flag } from './Flag'

// Panel color cycles deterministically by match_no so each card looks bold.
const PANEL_COLORS = ['bg-orange', 'bg-green', 'bg-blue text-paper', 'bg-yellow', 'bg-red text-paper']
function panelColor(match_no: number) {
  return PANEL_COLORS[match_no % PANEL_COLORS.length]
}

// Module-level components: defining these inside MatchCard would give them a new
// identity each render, remounting the score <input> and dropping focus after
// one keystroke.
function Sbox({ v, set }: { v: number; set?: (n: number) => void; real?: boolean }) {
  return (
    <input
      type="number" min={0} value={v} disabled={!set}
      onChange={e => set?.(Math.max(0, +e.target.value))}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      className={`w-[52px] h-[58px] text-center font-display text-[32px] border-[3px] border-ink bg-paper text-ink outline-none flex-none ${!set ? 'opacity-90' : ''}`}
    />
  )
}

function Team({ code, label, sub }: { code: string | null; label: string | null; sub?: string }) {
  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <Flag code={code} label={label} size="lg" />
      <div className="font-display text-[27px] uppercase leading-[0.92] tracking-wide min-w-0">
        <span className="block truncate">{label}</span>
        {sub && <small className="block font-sans font-700 text-[11px] uppercase tracking-wider opacity-70">{sub}</small>}
      </div>
    </div>
  )
}

// Bookmaker win-probability bar (populated by the odds cron). Hidden if no data
// or the match is finished. Boxed on paper so it stays legible on any panel color.
function OddsBar({ m }: { m: Match }) {
  if (m.status === 'finished' || m.prob_home == null) return null
  const ph = m.prob_home, pd = m.prob_draw ?? 0, pa = m.prob_away ?? 0
  const h = (m.home_label ?? 'Home').slice(0, 3).toUpperCase()
  const a = (m.away_label ?? 'Away').slice(0, 3).toUpperCase()
  return (
    <div className="mt-3 border-[2px] border-ink bg-paper text-ink p-1.5">
      <div className="flex justify-between text-[9px] font-sans font-900 uppercase tracking-wider mb-1">
        <span>{h} {ph}%</span><span>Draw {pd}%</span><span>{a} {pa}%</span>
      </div>
      <div className="flex h-2">
        <div className="bg-ink" style={{ width: `${ph}%` }} />
        <div className="bg-ink/40" style={{ width: `${pd}%` }} />
        <div className="bg-ink/70" style={{ width: `${pa}%` }} />
      </div>
    </div>
  )
}

export function MatchCard({ match, prediction, onSave, onOpen }:
  { match: Match; prediction?: Prediction; onSave: (h: number, a: number) => Promise<void>; onOpen?: () => void }) {
  const state = matchState(match)
  const [hp, setHp] = useState(prediction?.home_pred ?? 0)
  const [ap, setAp] = useState(prediction?.away_pred ?? 0)
  const [saving, setSaving] = useState(false)
  const editable = state === 'open'

  const colorClass = panelColor(match.match_no ?? 0)

  return (
    <motion.div
      onClick={onOpen}
      whileTap={onOpen ? { scale: 0.99 } : undefined}
      className={`${colorClass} border-[3px] border-ink p-4 relative h-full flex flex-col overflow-hidden ${onOpen ? 'cursor-pointer' : ''}`}>
      {/* Starburst points badge for finished matches */}
      {state === 'finished' && prediction?.points_awarded != null && (
        <div
          className="star-badge absolute -top-3 -right-2.5 w-[60px] h-[60px] bg-ink text-yellow flex items-center justify-center font-display text-[16px]"
          style={{ transform: 'rotate(8deg)' }}
        >
          +{prediction.points_awarded}
        </div>
      )}

      {/* Header row: time/group + status */}
      <div className="flex justify-between items-center text-[11px] font-sans font-900 uppercase tracking-widest shrink-0">
        <span className="truncate pr-2">{match.group_label ?? match.stage.toUpperCase()} · {new Date(match.kickoff_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        {state === 'open' && <span className="shrink-0">★ OPEN</span>}
        {state === 'locked' && <span className="flex items-center gap-1 shrink-0"><Lock size={11} />LOCKED</span>}
        {state === 'finished' && <span className="shrink-0">FT</span>}
      </div>

      {/* Teams + scores — fill and center like a Tinder card */}
      <div className="flex-1 flex flex-col justify-center gap-6 py-4">
        <div className="flex items-center gap-3">
          <Team code={match.home_code} label={match.home_label}
            sub={state !== 'open' && prediction ? `you: ${prediction.home_pred}` : undefined} />
          <Sbox v={state === 'finished' ? match.home_score! : hp} set={editable ? setHp : undefined} />
        </div>
        <div className="font-display text-[13px] uppercase tracking-[0.3em] opacity-40 text-center">vs</div>
        <div className="flex items-center gap-3">
          <Team code={match.away_code} label={match.away_label}
            sub={state !== 'open' && prediction ? `you: ${prediction.away_pred}` : undefined} />
          <Sbox v={state === 'finished' ? match.away_score! : ap} set={editable ? setAp : undefined} />
        </div>
      </div>

      {/* Footer: odds + action, pinned to bottom */}
      <div className="shrink-0">
        <OddsBar m={match} />
        {state === 'open' && (
          <button
            disabled={saving}
            onPointerDown={e => e.stopPropagation()}
            onClick={async e => { e.stopPropagation(); setSaving(true); try { await onSave(hp, ap) } finally { setSaving(false) } }}
            className="w-full mt-3 bg-ink text-paper font-display text-[16px] uppercase tracking-widest py-3 text-center disabled:opacity-50"
          >
            {prediction ? 'Update prediction' : 'Lock prediction'}
          </button>
        )}
        {state === 'locked' && (
          <div className="flex items-center gap-1.5 text-[11px] font-sans font-700 uppercase tracking-wider mt-3 opacity-70">
            <Lock size={11} /> Prediction locked · tap for details
          </div>
        )}
        {state === 'finished' && (
          <div className="text-[11px] font-sans font-700 uppercase tracking-wider mt-3 opacity-70 text-center">Tap for details</div>
        )}
      </div>
    </motion.div>
  )
}
