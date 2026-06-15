import { AnimatePresence } from 'framer-motion'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { useAuth } from '../context/AuthContext'
import { LeaderRow } from '../components/LeaderRow'

export function Ranking() {
  const { rows } = useLeaderboard()
  const { player } = useAuth()
  return (
    <>
      <div className="bg-ink text-paper px-3 py-2 mb-3 flex justify-between items-center">
        <h1 className="font-display text-[20px] uppercase tracking-wide">Ranking</h1>
        <span className="font-sans font-900 text-[10px] uppercase tracking-widest text-yellow">{rows.length} players · live</span>
      </div>
      <AnimatePresence initial={true}>
        {rows.map((r, i) => <LeaderRow key={r.id} row={r} rank={i + 1} idx={i} isMe={r.id === player?.id} />)}
      </AnimatePresence>
    </>
  )
}
