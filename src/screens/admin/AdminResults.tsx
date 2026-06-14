import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMatches } from '../../hooks/useMatches'
import { AdminTabs } from '../../components/AdminTabs'
import { Flag } from '../../components/Flag'

export function AdminResults() {
  const { matches, reload } = useMatches()
  const [busy, setBusy] = useState<string | null>(null)

  async function saveScore(id: string, hs: number, as: number) {
    setBusy(id)
    try {
      const { error: e1 } = await supabase.from('matches').update({ home_score: hs, away_score: as }).eq('id', id)
      if (e1) throw e1
      const { error: e2 } = await supabase.rpc('score_match', { p_match: id })
      if (e2) throw e2
      await reload()
    } catch (e) { alert((e as Error).message) } finally { setBusy(null) }
  }

  return (
    <>
      <h1 className="text-xl font-bold tracking-tight mb-1">Admin</h1>
      <AdminTabs />
      {matches.map(m => (
        <div key={m.id} className="bg-surface rounded-neu shadow-neu-sm p-3 mb-3">
          <div className="text-[10px] text-muted uppercase mb-2">{m.group_label ?? m.stage} · {new Date(m.kickoff_at).toLocaleString()} {m.status === 'finished' && '· FINISHED'}</div>
          <Row m={m} onSave={saveScore} busy={busy === m.id} />
        </div>
      ))}
    </>
  )
}

function Row({ m, onSave, busy }: any) {
  const [hs, setHs] = useState(m.home_score ?? 0)
  const [as, setAs] = useState(m.away_score ?? 0)
  const box = (v: number, set: (n: number) => void) =>
    <input type="number" min={0} value={v} onChange={e => set(Math.max(0, +e.target.value))}
      className="w-12 h-10 text-center font-bold rounded-lg bg-surface shadow-neu-inset text-bright" />
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 flex-1"><Flag code={m.home_code} label={m.home_label} size="sm" /><span className="text-sm">{m.home_label}</span></div>
      {box(hs, setHs)}<span className="text-muted">:</span>{box(as, setAs)}
      <div className="flex items-center gap-2 flex-1 justify-end"><span className="text-sm">{m.away_label}</span><Flag code={m.away_code} label={m.away_label} size="sm" /></div>
      <button disabled={busy} onClick={() => onSave(m.id, hs, as)}
        className="ml-2 text-xs font-bold text-accent2 disabled:opacity-50">Save</button>
    </div>
  )
}
