import { useEffect, useState } from 'react'
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

// All vertical sizes use clamp(min, vh, max) so the card fits on short phones
// (no clipped Lock button) and still looks bold on tall ones. No <input> → no
// mobile keyboard; +/- stop propagation so they don't open the detail or swipe.
const BOX_W = 'w-[clamp(40px,11vw,52px)]'
function StepBtn({ label, onTap }: { label: string; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onTap() }}
      onPointerDown={e => e.stopPropagation()}
      className={`${BOX_W} h-[clamp(20px,2.6vh,28px)] grid place-items-center font-display text-[clamp(16px,2.4vh,20px)] leading-none text-ink select-none`}
    >
      {label}
    </button>
  )
}

function Sbox({ v, set }: { v: number; set?: (n: number) => void }) {
  if (!set) {
    return (
      <div className={`${BOX_W} h-[clamp(40px,6vh,58px)] flex items-center justify-center leading-none font-display text-[clamp(22px,4.4vh,32px)] border-[3px] border-ink bg-paper text-ink flex-none opacity-90`}>
        {v}
      </div>
    )
  }
  return (
    <div className="flex-none flex flex-col items-center">
      <StepBtn label="+" onTap={() => set(Math.min(20, v + 1))} />
      <div className={`${BOX_W} h-[clamp(32px,4.4vh,44px)] grid place-items-center font-display text-[clamp(20px,3.6vh,30px)] leading-none border-[3px] border-ink bg-paper text-ink`}>
        {v}
      </div>
      <StepBtn label="−" onTap={() => set(Math.max(0, v - 1))} />
    </div>
  )
}

function Team({ code, label, sub }: { code: string | null; label: string | null; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 flex-1 min-w-0">
      <Flag code={code} label={label} size="lg" />
      <div className="font-display text-[clamp(17px,3.3vh,27px)] uppercase leading-[0.95] tracking-wide min-w-0">
        <span className="block truncate">{label}</span>
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
    <div className="mt-2 border-[2px] border-ink bg-paper text-ink p-1.5">
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

  // keep the score in sync when the saved prediction changes (e.g. saved from the detail view)
  useEffect(() => {
    setHp(prediction?.home_pred ?? 0)
    setAp(prediction?.away_pred ?? 0)
  }, [prediction?.home_pred, prediction?.away_pred])

  const colorClass = panelColor(match.match_no ?? 0)

  return (
    <motion.div
      onClick={onOpen}
      whileTap={onOpen ? { scale: 0.99 } : undefined}
      className={`${colorClass} border-[3px] border-ink p-[clamp(10px,2vh,16px)] relative h-full flex flex-col overflow-hidden ${onOpen ? 'cursor-pointer' : ''}`}>
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
      <div className="flex justify-between items-center text-[10px] font-sans font-900 uppercase tracking-widest shrink-0">
        <span className="truncate pr-2">{match.group_label ?? match.stage.toUpperCase()} · {new Date(match.kickoff_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        {state === 'open' && <span className="shrink-0">★ OPEN</span>}
        {state === 'locked' && <span className="flex items-center gap-1 shrink-0"><Lock size={10} />LOCKED</span>}
        {state === 'finished' && <span className="shrink-0">FT</span>}
      </div>

      {/* Teams + scores — fill and center, scaling to the available height */}
      <div className="flex-1 min-h-0 flex flex-col justify-center gap-[clamp(6px,2.4vh,24px)] py-2">
        <div className="flex items-center gap-2.5">
          <Team code={match.home_code} label={match.home_label}
            sub={state !== 'open' && prediction ? `you: ${prediction.home_pred}` : undefined} />
          <Sbox v={state === 'finished' ? match.home_score! : hp} set={editable ? setHp : undefined} />
        </div>
        <div className="font-display text-[12px] uppercase tracking-[0.3em] opacity-40 text-center">vs</div>
        <div className="flex items-center gap-2.5">
          <Team code={match.away_code} label={match.away_label}
            sub={state !== 'open' && prediction ? `you: ${prediction.away_pred}` : undefined} />
          <Sbox v={state === 'finished' ? match.away_score! : ap} set={editable ? setAp : undefined} />
        </div>
      </div>

      {/* Footer: odds + action, always visible (shrink-0) */}
      <div className="shrink-0">
        <OddsBar m={match} />
        {state === 'open' && (
          <button
            disabled={saving}
            onPointerDown={e => e.stopPropagation()}
            onClick={async e => { e.stopPropagation(); setSaving(true); try { await onSave(hp, ap) } finally { setSaving(false) } }}
            className="w-full mt-2.5 bg-ink text-paper font-display text-[clamp(13px,1.9vh,16px)] uppercase tracking-widest py-[clamp(8px,1.5vh,12px)] text-center disabled:opacity-50"
          >
            {prediction ? 'Update prediction' : 'Lock prediction'}
          </button>
        )}
        {state === 'locked' && (
          <div className="flex items-center gap-1.5 text-[11px] font-sans font-700 uppercase tracking-wider mt-2.5 opacity-70">
            <Lock size={11} /> Prediction locked · tap for details
          </div>
        )}
        {state === 'finished' && (
          <div className="text-[11px] font-sans font-700 uppercase tracking-wider mt-2.5 opacity-70 text-center">Tap for details</div>
        )}
      </div>
    </motion.div>
  )
}
