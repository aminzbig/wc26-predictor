import { Flag } from './Flag'
import type { LeaderRow as Row } from '../lib/types'

export function LeaderRow({ row, rank, isMe }: { row: Row; rank: number; isMe: boolean }) {
  const top = rank <= 3
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface mb-3 ${isMe ? 'shadow-neu-inset' : 'shadow-neu-sm'}`}>
      <div className={`w-[30px] h-[30px] rounded-lg grid place-items-center font-bold text-[13px]
        ${top ? 'text-[#06101f] bg-gradient-to-b from-accent2 to-accent' : 'text-muted shadow-neu-inset'}`}>{rank}</div>
      <Flag code={row.flag_code} size="sm" />
      <div className="flex-1 font-semibold text-sm text-txt">{isMe ? `You · ${row.name}` : row.name}
        <small className="block text-[10.5px] text-muted">{row.exact_hits} exact · {row.diff_hits} diff</small></div>
      <div className="font-bold text-accent text-right">{row.total}<small className="block text-[9px] text-muted">PTS</small></div>
    </div>
  )
}
