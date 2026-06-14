import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AdminTabs } from '../../components/AdminTabs'
import type { Player } from '../../lib/types'

export function AdminPlayers() {
  const [players, setPlayers] = useState<Player[]>([])
  async function load() {
    const { data } = await supabase.from('players').select('*').order('name')
    setPlayers((data ?? []) as Player[])
  }
  useEffect(() => { load() }, [])

  async function setLegacy(id: string, v: number) {
    await supabase.from('players').update({ legacy_points: v }).eq('id', id); load()
  }
  async function toggleAdmin(id: string, v: boolean) {
    await supabase.from('players').update({ is_admin: v }).eq('id', id); load()
  }
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight mb-1">Admin</h1>
      <AdminTabs />
      <p className="text-muted text-xs mb-3">Set each player's starting (legacy) points to migrate the existing pool.</p>
      {players.map(p => (
        <div key={p.id} className="flex items-center gap-3 bg-surface rounded-neu shadow-neu-sm p-3 mb-2">
          <div className="flex-1 font-semibold text-sm">{p.name}</div>
          <label className="text-[10px] text-muted">legacy</label>
          <input type="number" defaultValue={p.legacy_points}
            onBlur={e => setLegacy(p.id, +e.target.value)}
            className="w-20 h-9 text-center rounded-lg bg-surface shadow-neu-inset text-bright text-sm" />
          <button onClick={() => toggleAdmin(p.id, !p.is_admin)}
            className={`text-[10px] font-bold px-2 py-1 rounded-lg ${p.is_admin ? 'text-accent' : 'text-muted'}`}>
            {p.is_admin ? 'ADMIN' : 'make admin'}</button>
        </div>
      ))}
    </>
  )
}
