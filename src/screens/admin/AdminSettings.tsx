import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AdminTabs } from '../../components/AdminTabs'

const KEYS = ['points_exact','points_diff','points_outcome','mult_group','mult_r32','mult_r16','mult_qf','mult_sf','mult_third','mult_final']

export function AdminSettings() {
  const [vals, setVals] = useState<Record<string, number>>({})
  async function load() {
    const { data } = await supabase.from('settings').select('*')
    const map: Record<string, number> = {}
    ;(data ?? []).forEach((s: any) => { map[s.key] = Number(s.value) })
    setVals(map)
  }
  useEffect(() => { load() }, [])
  async function save(key: string, value: number) {
    await supabase.from('settings').upsert({ key, value }); load()
  }

  return (
    <>
      <div className="bg-ink text-paper px-3 py-2 mb-1">
        <h1 className="font-display text-[20px] uppercase tracking-wide">Admin</h1>
      </div>
      <AdminTabs />
      <p className="font-sans font-700 text-[11px] uppercase tracking-widest text-ink/60 mb-3">
        Scoring values. Changes apply when matches are (re)scored.
      </p>
      {KEYS.map(k => (
        <div key={k} className="flex items-center gap-3 border-[3px] border-ink bg-paper p-3 mb-2">
          <div className="flex-1 font-display text-[14px] uppercase tracking-wide">{k}</div>
          <input type="number" step="0.5" defaultValue={vals[k] ?? 0} onBlur={e => save(k, +e.target.value)}
            className="w-24 h-9 text-center border-[3px] border-ink bg-paper font-display text-[16px] text-ink outline-none" />
        </div>
      ))}
    </>
  )
}
