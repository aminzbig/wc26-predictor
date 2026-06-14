import { useLeaderboard } from '../hooks/useLeaderboard'
import { useAuth } from '../context/AuthContext'
import { LeaderRow } from '../components/LeaderRow'

export function Ranking() {
  const { rows } = useLeaderboard()
  const { player } = useAuth()
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight mb-1">Ranking</h1>
      <p className="text-muted text-xs mb-4">{rows.length} players · updated live</p>
      {rows.map((r, i) => <LeaderRow key={r.id} row={r} rank={i + 1} isMe={r.id === player?.id} />)}
    </>
  )
}
