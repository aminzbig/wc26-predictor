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
      className="px-3 py-2.5 border-[3px] border-ink bg-paper font-display text-[13px] uppercase text-ink outline-none placeholder:text-ink/40" />

  return (
    <>
      <div className="bg-ink text-paper px-3 py-2 mb-1">
        <h1 className="font-display text-[20px] uppercase tracking-wide">Admin</h1>
      </div>
      <AdminTabs />
      <div className="border-[3px] border-ink bg-paper p-4 mb-4 grid grid-cols-2 gap-2">
        <select value={f.stage} onChange={e => setF({ ...f, stage: e.target.value as Stage })}
          className="px-3 py-2.5 border-[3px] border-ink bg-paper font-display text-[13px] uppercase text-ink outline-none col-span-2">
          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {inp('Home label (e.g. Winner C)', 'home_label')}{inp('Away label', 'away_label')}
        {inp('Home flag code (br)', 'home_code')}{inp('Away flag code (hr)', 'away_code')}
        <input type="datetime-local" value={f.kickoff_at} onChange={e => setF({ ...f, kickoff_at: e.target.value })}
          className="px-3 py-2.5 border-[3px] border-ink bg-paper font-display text-[13px] text-ink outline-none col-span-2" />
        <button onClick={add}
          className="col-span-2 py-2.5 bg-ink text-paper font-display text-[15px] uppercase tracking-wide">
          Add fixture
        </button>
      </div>
      <p className="font-sans font-700 text-[11px] uppercase tracking-widest text-ink/60 mb-2">{matches.length} fixtures loaded.</p>
    </>
  )
}
