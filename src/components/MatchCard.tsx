import { useState } from 'react'
import { Check, Clock, Lock } from 'lucide-react'
import type { Match, Prediction } from '../lib/types'
import { matchState } from '../lib/matchState'
import { Flag } from './Flag'

// Module-level components: defining these inside MatchCard would give them a new
// identity each render, remounting the score <input> and dropping focus after
// one keystroke.
function Sbox({ v, set, real }: { v: number; set?: (n: number) => void; real?: boolean }) {
  return (
    <input type="number" min={0} value={v} disabled={!set}
      onChange={e => set?.(Math.max(0, +e.target.value))}
      className={`w-[38px] h-[42px] text-center font-bold text-lg rounded-xl bg-surface shadow-neu-inset ${real ? 'text-bright' : 'text-accent'} ${!set ? 'opacity-90' : ''}`} />
  )
}

function Team({ code, label, sub }: { code: string | null; label: string | null; sub?: string }) {
  return (
    <div className="flex items-center gap-3 flex-1">
      <Flag code={code} label={label} />
      <div className="font-semibold text-[15px] text-txt">{label}
        {sub && <small className="block text-[10.5px] text-muted">{sub}</small>}</div>
    </div>
  )
}

export function MatchCard({ match, prediction, onSave }:
  { match: Match; prediction?: Prediction; onSave: (h: number, a: number) => Promise<void> }) {
  const state = matchState(match)
  const [hp, setHp] = useState(prediction?.home_pred ?? 0)
  const [ap, setAp] = useState(prediction?.away_pred ?? 0)
  const [saving, setSaving] = useState(false)
  const editable = state === 'open'

  return (
    <div className="bg-surface rounded-neu shadow-neu p-4 mb-3.5">
      <div className="flex justify-between items-center text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-3">
        <span>{match.group_label ?? match.stage.toUpperCase()} · {new Date(match.kickoff_at).toLocaleString()}</span>
        {state === 'open' && <span className="text-accent">OPEN</span>}
        {state === 'locked' && <span className="flex items-center gap-1"><Lock size={11} />LOCKED</span>}
        {state === 'finished' && prediction?.points_awarded != null &&
          <span className="bg-accent text-[#06101f] rounded-full px-2 py-1">+{prediction.points_awarded}</span>}
      </div>

      <div className="flex items-center gap-3 mb-2.5">
        <Team code={match.home_code} label={match.home_label}
          sub={state !== 'open' && prediction ? `you: ${prediction.home_pred}` : undefined} />
        <Sbox v={state === 'finished' ? match.home_score! : hp} set={editable ? setHp : undefined} real={state === 'finished'} />
      </div>
      <div className="flex items-center gap-3">
        <Team code={match.away_code} label={match.away_label}
          sub={state !== 'open' && prediction ? `you: ${prediction.away_pred}` : undefined} />
        <Sbox v={state === 'finished' ? match.away_score! : ap} set={editable ? setAp : undefined} real={state === 'finished'} />
      </div>

      {state === 'open' &&
        <button disabled={saving}
          onClick={async () => { setSaving(true); try { await onSave(hp, ap) } finally { setSaving(false) } }}
          className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-b from-accent2 to-accent text-[#06101f] font-bold text-[13px] disabled:opacity-50">
          {prediction ? 'Update prediction' : 'Lock prediction'} <Check size={16} />
        </button>}
      {state === 'locked' &&
        <div className="flex items-center gap-1.5 text-[11px] text-muted mt-3"><Clock size={13} /> Prediction locked</div>}
    </div>
  )
}
