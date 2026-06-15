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
function Sbox({ v, set, real: _real }: { v: number; set?: (n: number) => void; real?: boolean }) {
  return (
    <input
      type="number" min={0} value={v} disabled={!set}
      onChange={e => set?.(Math.max(0, +e.target.value))}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      className={`w-[36px] h-[38px] text-center font-display text-[22px] border-[3px] border-ink bg-paper text-ink outline-none flex-none ${!set ? 'opacity-90' : ''}`}
    />
  )
}

function Team({ code, label, sub }: { code: string | null; label: string | null; sub?: string }) {
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <Flag code={code} label={label} />
      <div className="font-display text-[22px] uppercase leading-none tracking-wide truncate">
        {label}
        {sub && <small className="block font-sans font-700 text-[10px] uppercase tracking-wider opacity-70">{sub}</small>}
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
    <div className="mt-2.5 border-[2px] border-ink bg-paper text-ink p-1.5">
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
      whileTap={onOpen ? { scale: 0.985 } : undefined}
      className={`${colorClass} border-[3px] border-ink p-3 mb-3.5 relative ${onOpen ? 'cursor-pointer' : ''}`}>
      {/* Starburst points badge for finished matches */}
      {state === 'finished' && prediction?.points_awarded != null && (
        <div
          className="star-badge absolute -top-3 -right-2.5 w-[54px] h-[54px] bg-ink text-yellow flex items-center justify-center font-display text-[15px]"
          style={{ transform: 'rotate(8deg)' }}
        >
          +{prediction.points_awarded}
        </div>
      )}

      {/* Header row: time/group + status */}
      <div className="flex justify-between items-center text-[10px] font-sans font-900 uppercase tracking-widest mb-2.5">
        <span>{match.group_label ?? match.stage.toUpperCase()} · {new Date(match.kickoff_at).toLocaleString()}</span>
        {state === 'open' && <span>★ OPEN</span>}
        {state === 'locked' && <span className="flex items-center gap-1"><Lock size={10} />LOCKED</span>}
        {state === 'finished' && <span>FT</span>}
      </div>

      {/* Teams + scores */}
      <div className="flex items-center gap-2 mb-2">
        <Team code={match.home_code} label={match.home_label}
          sub={state !== 'open' && prediction ? `you: ${prediction.home_pred}` : undefined} />
        <Sbox v={state === 'finished' ? match.home_score! : hp} set={editable ? setHp : undefined} real={state === 'finished'} />
      </div>
      <div className="flex items-center gap-2">
        <Team code={match.away_code} label={match.away_label}
          sub={state !== 'open' && prediction ? `you: ${prediction.away_pred}` : undefined} />
        <Sbox v={state === 'finished' ? match.away_score! : ap} set={editable ? setAp : undefined} real={state === 'finished'} />
      </div>

      <OddsBar m={match} />

      {/* Lock button */}
      {state === 'open' && (
        <button
          disabled={saving}
          onPointerDown={e => e.stopPropagation()}
          onClick={async e => { e.stopPropagation(); setSaving(true); try { await onSave(hp, ap) } finally { setSaving(false) } }}
          className="w-full mt-3 bg-ink text-paper font-display text-[14px] uppercase tracking-widest py-2.5 text-center disabled:opacity-50"
        >
          {prediction ? 'Update prediction' : 'Lock prediction'}
        </button>
      )}
      {state === 'locked' && (
        <div className="flex items-center gap-1.5 text-[11px] font-sans font-700 uppercase tracking-wider mt-3 opacity-70">
          <Lock size={11} /> Prediction locked
        </div>
      )}
    </motion.div>
  )
}
