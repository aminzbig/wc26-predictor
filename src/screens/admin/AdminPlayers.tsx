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
      <div className="bg-ink text-paper px-3 py-2 mb-1">
        <h1 className="font-display text-[20px] uppercase tracking-wide">Admin</h1>
      </div>
      <AdminTabs />
      <p className="font-sans font-700 text-[11px] uppercase tracking-widest text-ink/60 mb-3">
        Set each player's starting (legacy) points to migrate the existing pool.
      </p>
      {players.map(p => (
        <div key={p.id} className="flex items-center gap-3 border-[3px] border-ink bg-paper p-3 mb-2">
          <div className="flex-1 font-display text-[16px] uppercase">{p.name}</div>
          <label className="font-sans font-900 text-[10px] uppercase tracking-widest text-ink/60">legacy</label>
          <input type="number" defaultValue={p.legacy_points}
            onBlur={e => setLegacy(p.id, +e.target.value)}
            className="w-20 h-9 text-center border-[3px] border-ink bg-paper font-display text-[16px] text-ink outline-none" />
          <button onClick={() => toggleAdmin(p.id, !p.is_admin)}
            className={`font-display text-[11px] uppercase tracking-wide px-2 py-1 border-[2px] border-ink ${p.is_admin ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}>
            {p.is_admin ? 'ADMIN' : 'make admin'}
          </button>
        </div>
      ))}
    </>
  )
}
