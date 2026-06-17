import { useState } from 'react'
import { adminStickers } from '../lib/adminStickers'

// A pile of admin reward/penalty stickers on a ranking row. Collapsed it is an
// overlapping pile; tapping fans it out so each sticker's value is readable.
export function StickerStack({ deltas }: { deltas: number[] | null }) {
  const [expanded, setExpanded] = useState(false)
  const stickers = adminStickers(deltas)
  if (stickers.length === 0) return null

  return (
    <button
      type="button"
      aria-label="admin stickers"
      aria-expanded={expanded}
      onClick={() => setExpanded(e => !e)}
      className={`flex-none flex items-center bg-transparent border-0 p-0 ${expanded ? 'gap-1' : ''}`}>
      {stickers.map((s, i) => (
        <span
          key={i}
          className={`star-badge sticker sticker--${s.variant} grid place-items-center
            w-[34px] h-[34px] font-display text-[9px] leading-none text-center
            ${expanded ? '' : i > 0 ? '-ml-3' : ''}`}>
          {expanded ? (s.delta > 0 ? `+${s.delta}` : `${s.delta}`) : ''}
        </span>
      ))}
    </button>
  )
}
