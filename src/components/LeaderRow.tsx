import { motion } from 'framer-motion'
import { Avatar } from './Avatar'
import type { LeaderRow as Row } from '../lib/types'
import { StickerStack } from './StickerStack'

export function LeaderRow({ row, rank, isMe, idx = 0 }: { row: Row; rank: number; isMe: boolean; idx?: number }) {
  const top = rank <= 3
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30, delay: Math.min(idx, 12) * 0.04 }}
      className={`flex items-center gap-3 border-[3px] border-ink px-3 py-3 mb-2 ${isMe ? 'bg-yellow' : 'bg-paper'}`}>
      <div className={`w-[32px] h-[32px] flex items-center justify-center font-display text-[22px] flex-none
        ${top ? 'bg-ink text-yellow' : 'text-ink'}`}>
        {rank}
      </div>
      <Avatar url={row.avatar_url} code={row.flag_code} label={row.name} px={56} />
      <div className="flex-1 min-w-0">
        <div className="font-display text-[18px] uppercase leading-none truncate">
          {isMe ? `You · ${row.name}` : row.name}
        </div>
        <small className="block font-sans font-800 text-[10px] uppercase tracking-widest text-ink/60 leading-none mt-0.5">
          {row.exact_hits} exact · {row.diff_hits} diff
        </small>
      </div>
      <StickerStack deltas={row.admin_deltas} />
      <div className="font-display text-[22px] text-ink text-right flex-none">{row.total}</div>
    </motion.div>
  )
}
