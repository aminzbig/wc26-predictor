import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMatches } from '../../hooks/useMatches'
import { AdminTabs } from '../../components/AdminTabs'
import { Avatar } from '../../components/Avatar'
import { mergePlayerPredictions, type CorrectionRow } from './mergePredictions'
import type { Prediction } from '../../lib/types'

export function AdminCorrections() {
  const { matches } = useMatches()
  const [matchId, setMatchId] = useState('')
  const [rows, setRows] = useState<CorrectionRow[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const match = useMemo(() => matches.find(m => m.id === matchId), [matches, matchId])

  async function loadRows(id: string) {
    if (!id) { setRows([]); return }
    const { data: players } = await supabase
      .from('players').select('id, name, flag_code, avatar_url').order('name')
    const { data: preds } = await supabase
      .from('predictions').select('*').eq('match_id', id)
    setRows(mergePlayerPredictions(players ?? [], (preds ?? []) as Prediction[]))
  }
  useEffect(() => { loadRows(matchId) }, [matchId])

  async function save(playerId: string, home: number, away: number) {
    setBusy(playerId)
    try {
      const { error } = await supabase.rpc('admin_set_prediction', {
        p_player: playerId, p_match: matchId, p_home: home, p_away: away,
      })
      if (error) throw error
      await loadRows(matchId)
    } catch (e) { alert((e as Error).message) } finally { setBusy(null) }
  }

  return (
    <>
      <AdminTabs />
      <p className="font-sans font-700 text-[11px] uppercase tracking-widest text-ink/60 mb-3">
        Fix one player's prediction for a match. Does not change the real result.
      </p>
      <select
        aria-label="Select match"
        value={matchId}
        onChange={e => setMatchId(e.target.value)}
        className="w-full h-11 mb-4 px-2 border-[3px] border-ink bg-paper font-display text-[14px] uppercase">
        <option value="">— pick a match —</option>
        {matches.map(m => (
          <option key={m.id} value={m.id}>
            {m.home_label} v {m.away_label} · {new Date(m.kickoff_at).toLocaleDateString()}
          </option>
        ))}
      </select>

      {match && (
        <div className="border-[3px] border-ink bg-paper p-3 mb-4">
          <div className="font-sans font-900 text-[10px] uppercase tracking-widest text-ink/60 mb-1">
            {match.status === 'finished' ? 'Actual result · final' : 'Actual result · not scored yet'}
          </div>
          <div className="font-display text-[18px] uppercase">
            {`${match.home_label} ${match.home_score ?? '–'} : ${match.away_score ?? '–'} ${match.away_label}`}
          </div>
        </div>
      )}

      {match && rows.map(r => (
        <PlayerRow key={r.player_id} row={r} busy={busy === r.player_id} onSave={save} />
      ))}
    </>
  )
}

function PlayerRow({ row, busy, onSave }: {
  row: CorrectionRow; busy: boolean
  onSave: (playerId: string, home: number, away: number) => void
}) {
  const [hs, setHs] = useState<string>(row.home_pred?.toString() ?? '')
  const [as, setAs] = useState<string>(row.away_pred?.toString() ?? '')
  const box = (label: string, v: string, set: (s: string) => void) =>
    <input aria-label={label} type="number" min={0} value={v}
      onChange={e => set(e.target.value)}
      className="w-12 h-10 text-center font-display text-[18px] border-[3px] border-ink bg-paper text-ink outline-none" />
  return (
    <div className="flex items-center gap-2 border-[3px] border-ink bg-paper p-2 mb-2">
      <Avatar url={row.avatar_url} code={row.flag_code} label={row.name} size="sm" />
      <span className="font-display text-[14px] uppercase truncate flex-1 min-w-0">{row.name}</span>
      <span className="font-sans font-800 text-[10px] uppercase tracking-widest text-ink/60">
        {row.points_awarded ?? '—'} pts
      </span>
      {box(`${row.name} home prediction`, hs, setHs)}
      <span className="font-display text-ink/40">:</span>
      {box(`${row.name} away prediction`, as, setAs)}
      <button disabled={busy} onClick={() => onSave(row.player_id, Math.max(0, +hs || 0), Math.max(0, +as || 0))}
        className="ml-1 font-display text-[12px] uppercase tracking-wide bg-ink text-paper px-3 py-1.5 disabled:opacity-50">
        Save
      </button>
    </div>
  )
}
