import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMatches } from '../../hooks/useMatches'
import { AdminTabs } from '../../components/AdminTabs'
import type { Stage } from '../../lib/types'

const STAGES: Stage[] = ['group','r32','r16','qf','sf','third','final']
const DEFAULT_MULT: Record<Stage, number> = { group:1, r32:1.5, r16:2, qf:3, sf:4, third:6, final:6 }

export function AdminFixtures() {
  const { matches, reload } = useMatches()
  const [f, setF] = useState({ stage: 'r32' as Stage, home_label: '', away_label: '', home_code: '', away_code: '', kickoff_at: '' })

  async function add() {
    await supabase.from('matches').insert({
      stage: f.stage, multiplier: DEFAULT_MULT[f.stage],
      home_label: f.home_label, away_label: f.away_label,
      home_code: f.home_code || null, away_code: f.away_code || null,
      kickoff_at: new Date(f.kickoff_at).toISOString(),
    })
    setF({ ...f, home_label: '', away_label: '', home_code: '', away_code: '', kickoff_at: '' })
    reload()
  }
  const inp = (ph: string, key: keyof typeof f) =>
    <input placeholder={ph} value={f[key] as string} onChange={e => setF({ ...f, [key]: e.target.value })}
      className="px-3 py-2 rounded-lg bg-surface shadow-neu-inset text-sm outline-none" />
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight mb-1">Admin</h1>
      <AdminTabs />
      <div className="bg-surface rounded-neu shadow-neu p-4 mb-4 grid grid-cols-2 gap-2">
        <select value={f.stage} onChange={e => setF({ ...f, stage: e.target.value as Stage })}
          className="px-3 py-2 rounded-lg bg-surface shadow-neu-inset text-sm col-span-2">
          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}</select>
        {inp('Home label (e.g. Winner C)', 'home_label')}{inp('Away label', 'away_label')}
        {inp('Home flag code (br)', 'home_code')}{inp('Away flag code (hr)', 'away_code')}
        <input type="datetime-local" value={f.kickoff_at} onChange={e => setF({ ...f, kickoff_at: e.target.value })}
          className="px-3 py-2 rounded-lg bg-surface shadow-neu-inset text-sm col-span-2" />
        <button onClick={add} className="col-span-2 py-2.5 rounded-xl bg-gradient-to-b from-accent2 to-accent text-[#06101f] font-bold text-sm">Add fixture</button>
      </div>
      <p className="text-muted text-xs mb-2">{matches.length} fixtures loaded.</p>
    </>
  )
}
