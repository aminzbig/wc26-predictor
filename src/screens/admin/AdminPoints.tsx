import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AdminTabs } from '../../components/AdminTabs'
import { Avatar } from '../../components/Avatar'
import type { Player } from '../../lib/types'

const MIN = -10
const MAX = 10

export function AdminPoints() {
  const [players, setPlayers] = useState<Player[]>([])

  async function load() {
    const { data } = await supabase.from('players').select('*').order('name')
    setPlayers((data ?? []) as Player[])
  }
  useEffect(() => { load() }, [])

  async function setUnits(id: string, units: number) {
    const v = Math.max(MIN, Math.min(MAX, units))
    // optimistic
    setPlayers(ps => ps.map(p => (p.id === id ? { ...p, admin_units: v } : p)))
    await supabase.from('players').update({ admin_units: v }).eq('id', id)
  }

  return (
    <>
      <div className="bg-ink text-paper px-3 py-2 mb-1">
        <h1 className="font-display text-[20px] uppercase tracking-wide">Admin</h1>
      </div>
      <AdminTabs />
      <p className="font-sans font-700 text-[11px] uppercase tracking-widest text-ink/60 mb-3">
        Award or deduct bonus points. Each step = 10 points. 0 removes the bonus.
      </p>
      {players.map(p => {
        const pts = p.admin_units * 10
        return (
          <div key={p.id} className="flex items-center gap-3 border-[3px] border-ink bg-paper p-3 mb-2">
            <Avatar url={p.avatar_url} code={p.flag_code} label={p.name} size="sm" />
            <div className="flex-1 min-w-0 font-display text-[16px] uppercase truncate">{p.name}</div>
            <div
              className={`font-display text-[14px] w-16 text-right ${pts > 0 ? 'text-green' : pts < 0 ? 'text-red' : 'text-ink/40'}`}>
              {pts > 0 ? '+' : ''}{pts} pts
            </div>
            <button
              aria-label={`decrease ${p.name}`}
              disabled={p.admin_units <= MIN}
              onClick={() => setUnits(p.id, p.admin_units - 1)}
              className="w-9 h-9 grid place-items-center border-[3px] border-ink bg-paper font-display text-[20px] disabled:opacity-30">
              −
            </button>
            <div className="w-8 text-center font-display text-[18px]">{p.admin_units}</div>
            <button
              aria-label={`increase ${p.name}`}
              disabled={p.admin_units >= MAX}
              onClick={() => setUnits(p.id, p.admin_units + 1)}
              className="w-9 h-9 grid place-items-center border-[3px] border-ink bg-paper font-display text-[20px] disabled:opacity-30">
              +
            </button>
          </div>
        )
      })}
    </>
  )
}
