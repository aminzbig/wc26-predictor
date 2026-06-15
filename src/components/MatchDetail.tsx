import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lock } from 'lucide-react'
import type { Match, Prediction } from '../lib/types'
import { matchState } from '../lib/matchState'
import { Flag } from './Flag'

const PANEL_COLORS = ['bg-orange', 'bg-green', 'bg-blue text-paper', 'bg-yellow', 'bg-red text-paper']
function panelColor(match_no: number) {
  return PANEL_COLORS[match_no % PANEL_COLORS.length]
}

const STAGE_LABEL: Record<string, string> = {
  group: 'Group', r32: 'Round of 32', r16: 'Round of 16',
  qf: 'Quarter-final', sf: 'Semi-final', third: 'Third place', final: 'Final',
}

function DScore({ v, set }: { v: number; set?: (n: number) => void }) {
  return (
    <input
      type="number" min={0} value={v} disabled={!set}
      onChange={e => set?.(Math.max(0, +e.target.value))}
      className={`w-[52px] h-[56px] text-center font-display text-[32px] border-[3px] border-ink bg-paper text-ink outline-none flex-none ${!set ? 'opacity-90' : ''}`}
    />
  )
}

function BigTeam({ code, label }: { code: string | null; label: string | null }) {
  return (
    <div className="flex items-center gap-2.5 flex-1 min-w-0">
      <Flag code={code} label={label} />
      <div className="font-display text-[26px] uppercase leading-none tracking-wide truncate">{label}</div>
    </div>
  )
}

export function MatchDetail({ match, prediction, onSave, onClose }: {
  match: Match
  prediction?: Prediction
  onSave: (h: number, a: number) => Promise<void>
  onClose: () => void
}) {
  const state = matchState(match)
  const editable = state === 'open'
  const [hp, setHp] = useState(prediction?.home_pred ?? 0)
  const [ap, setAp] = useState(prediction?.away_pred ?? 0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const mult = match.multiplier ?? 1
  const stageText = match.group_label
    ? `Group ${match.group_label}`
    : (STAGE_LABEL[match.stage] ?? match.stage.toUpperCase())
  const headerLine = `×${mult} · ${stageText}`.toUpperCase()

  const ph = match.prob_home, pd = match.prob_draw ?? 0, pa = match.prob_away ?? 0
  const showOdds = ph != null
  const h3 = (match.home_label ?? 'Home').slice(0, 3).toUpperCase()
  const a3 = (match.away_label ?? 'Away').slice(0, 3).toUpperCase()

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-ink/60"
          onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        />

        {/* Panel */}
        <motion.div
          initial={{ y: 60, scale: 0.92, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 60, scale: 0.92, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="relative w-full max-w-md max-h-[88vh] overflow-y-auto pb-28"
        >
          <div className={`${panelColor(match.match_no ?? 0)} border-[3px] border-ink p-4 m-3 relative`}>
            {/* Close */}
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute -top-2 -right-2 w-[40px] h-[40px] bg-ink text-paper grid place-items-center border-[3px] border-ink"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="text-[11px] font-sans font-900 uppercase tracking-widest mb-1">{headerLine}</div>
            <div className="text-[12px] font-sans font-700 uppercase tracking-wider mb-4 opacity-80">
              {new Date(match.kickoff_at).toLocaleString(undefined, {
                weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </div>

            {/* Teams + scores */}
            <div className="flex items-center gap-2 mb-3">
              <BigTeam code={match.home_code} label={match.home_label} />
              <DScore v={state === 'finished' ? match.home_score! : hp} set={editable ? setHp : undefined} />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <BigTeam code={match.away_code} label={match.away_label} />
              <DScore v={state === 'finished' ? match.away_score! : ap} set={editable ? setAp : undefined} />
            </div>

            {/* Save / status */}
            {state === 'open' && (
              <button
                disabled={saving}
                onClick={async () => { setSaving(true); try { await onSave(hp, ap); onClose() } finally { setSaving(false) } }}
                className="w-full mt-4 bg-ink text-paper font-display text-[15px] uppercase tracking-widest py-3 text-center disabled:opacity-50"
              >
                {prediction ? 'Update prediction' : 'Lock prediction'}
              </button>
            )}
            {state === 'locked' && (
              <div className="flex items-center gap-1.5 text-[12px] font-sans font-700 uppercase tracking-wider mt-4 opacity-80">
                <Lock size={13} /> Prediction locked
              </div>
            )}

            {/* Odds bar */}
            {showOdds && (
              <div className="mt-4 border-[3px] border-ink bg-paper text-ink p-2.5">
                <div className="text-[10px] font-sans font-900 uppercase tracking-widest mb-2">Bookmaker odds</div>
                <div className="flex justify-between text-[11px] font-sans font-900 uppercase tracking-wider mb-1.5">
                  <span>{h3} {ph}%</span><span>Draw {pd}%</span><span>{a3} {pa}%</span>
                </div>
                <div className="flex h-4 border-2 border-ink">
                  <div className="bg-ink" style={{ width: `${ph}%` }} />
                  <div className="bg-ink/40" style={{ width: `${pd}%` }} />
                  <div className="bg-ink/70" style={{ width: `${pa}%` }} />
                </div>
              </div>
            )}

            {/* Your prediction */}
            {prediction && (
              <div className="mt-4 text-[12px] font-sans font-900 uppercase tracking-widest">
                Your prediction: {prediction.home_pred} – {prediction.away_pred}
              </div>
            )}

            {/* Points earned */}
            {state === 'finished' && prediction?.points_awarded != null && (
              <div className="mt-2 inline-block bg-ink text-yellow font-display text-[16px] uppercase tracking-wide px-3 py-1.5">
                +{prediction.points_awarded} points
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
