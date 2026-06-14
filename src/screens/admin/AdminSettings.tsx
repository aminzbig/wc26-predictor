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
      <h1 className="text-xl font-bold tracking-tight mb-1">Admin</h1>
      <AdminTabs />
      <p className="text-muted text-xs mb-3">Scoring values. Changes apply when matches are (re)scored.</p>
      {KEYS.map(k => (
        <div key={k} className="flex items-center gap-3 bg-surface rounded-neu shadow-neu-sm p-3 mb-2">
          <div className="flex-1 text-sm">{k}</div>
          <input type="number" step="0.5" defaultValue={vals[k] ?? 0} onBlur={e => save(k, +e.target.value)}
            className="w-24 h-9 text-center rounded-lg bg-surface shadow-neu-inset text-bright text-sm" />
        </div>
      ))}
    </>
  )
}
