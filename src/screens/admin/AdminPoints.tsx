import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AdminTabs } from '../../components/AdminTabs'
import { Avatar } from '../../components/Avatar'

const CAP = 10 // max bonus stickers and max penalty stickers per player

type Row = {
  id: string
  name: string
  flag_code: string | null
  avatar_url: string | null
  bonus: number   // count of +10 stickers
  penalty: number // count of -10 stickers
}

export function AdminPoints() {
  const [rows, setRows] = useState<Row[]>([])

  async function load() {
    const { data: players } = await supabase
      .from('players').select('id, name, flag_code, avatar_url').order('name')
    const { data: points } = await supabase
      .from('admin_points').select('player_id, delta')
    const counts = new Map<string, { bonus: number; penalty: number }>()
    for (const p of points ?? []) {
      const c = counts.get(p.player_id) ?? { bonus: 0, penalty: 0 }
      if (p.delta > 0) c.bonus++; else c.penalty++
      counts.set(p.player_id, c)
    }
    setRows((players ?? []).map(p => ({
      ...p,
      bonus: counts.get(p.id)?.bonus ?? 0,
      penalty: counts.get(p.id)?.penalty ?? 0,
    })))
  }
  useEffect(() => { load() }, [])

  async function add(id: string, delta: 10 | -10) {
    await supabase.from('admin_points').insert({ player_id: id, delta })
    load()
  }
  async function clear(id: string) {
    await supabase.from('admin_points').delete().eq('player_id', id)
    load()
  }

  return (
    <>
      <AdminTabs />
      <p className="font-sans font-700 text-[11px] uppercase tracking-widest text-ink/60 mb-3">
        Give bonus or penalty stickers. Each sticker = ±10 points. Up to {CAP} of each.
      </p>
      {rows.map(r => {
        const net = (r.bonus - r.penalty) * 10
        return (
          <div key={r.id} className="flex items-center gap-3 border-[3px] border-ink bg-paper p-3 mb-2">
            <Avatar url={r.avatar_url} code={r.flag_code} label={r.name} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="font-display text-[16px] uppercase truncate">{r.name}</div>
              <small className="block font-sans font-800 text-[10px] uppercase tracking-widest text-ink/60 leading-none mt-0.5">
                {r.bonus}★ · {r.penalty}☆ ·{' '}
                <span className={net > 0 ? 'text-green' : net < 0 ? 'text-red' : ''}>
                  {net > 0 ? '+' : ''}{net} pts
                </span>
              </small>
            </div>
            <button
              aria-label={`add bonus to ${r.name}`}
              disabled={r.bonus >= CAP}
              onClick={() => add(r.id, 10)}
              className="h-9 px-2 grid place-items-center border-[3px] border-ink bg-paper font-display text-[12px] uppercase disabled:opacity-30">
              + bonus
            </button>
            <button
              aria-label={`add penalty to ${r.name}`}
              disabled={r.penalty >= CAP}
              onClick={() => add(r.id, -10)}
              className="h-9 px-2 grid place-items-center border-[3px] border-ink bg-paper font-display text-[12px] uppercase disabled:opacity-30">
              − penalty
            </button>
            <button
              aria-label={`clear ${r.name}`}
              disabled={r.bonus === 0 && r.penalty === 0}
              onClick={() => clear(r.id)}
              className="h-9 px-2 grid place-items-center border-[3px] border-ink bg-paper font-display text-[12px] uppercase disabled:opacity-30">
              clear
            </button>
          </div>
        )
      })}
    </>
  )
}
