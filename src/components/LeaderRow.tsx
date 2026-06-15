import { motion } from 'framer-motion'
import { Flag } from './Flag'
import type { LeaderRow as Row } from '../lib/types'

export function LeaderRow({ row, rank, isMe, idx = 0 }: { row: Row; rank: number; isMe: boolean; idx?: number }) {
  const top = rank <= 3
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30, delay: Math.min(idx, 12) * 0.04 }}
      className={`flex items-center gap-2.5 border-[3px] border-ink px-3 py-2 mb-2 ${isMe ? 'bg-yellow' : 'bg-paper'}`}>
      <div className={`w-[30px] h-[30px] flex items-center justify-center font-display text-[20px] flex-none
        ${top ? 'bg-ink text-yellow' : 'text-ink'}`}>
        {rank}
      </div>
      <Flag code={row.flag_code} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="font-display text-[18px] uppercase leading-none truncate">
          {isMe ? `You · ${row.name}` : row.name}
        </div>
        <small className="font-sans font-800 text-[10px] uppercase tracking-widest text-ink/60">
          {row.exact_hits} exact · {row.diff_hits} diff
        </small>
      </div>
      <div className="font-display text-[22px] text-ink text-right flex-none">{row.total}</div>
    </motion.div>
  )
}
