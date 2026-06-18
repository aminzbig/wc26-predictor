import { AnimatePresence } from 'framer-motion'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { useAuth } from '../context/AuthContext'
import { LeaderRow } from '../components/LeaderRow'

export function Ranking() {
  const { rows } = useLeaderboard()
  const { player } = useAuth()
  return (
    <>
      <AnimatePresence initial={true}>
        {rows.map((r, i) => <LeaderRow key={r.id} row={r} rank={i + 1} idx={i} isMe={r.id === player?.id} />)}
      </AnimatePresence>
      <div className="flex justify-end mt-3">
        <span className="font-sans font-900 text-[10px] uppercase tracking-widest text-ink/60">{rows.length} players · live</span>
      </div>
    </>
  )
}
