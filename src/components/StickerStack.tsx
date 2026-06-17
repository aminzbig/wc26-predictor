import { useState } from 'react'
import { adminStickers } from '../lib/adminStickers'

// A pile of admin reward/penalty stickers on a ranking row. Each sticker is
// labelled (e.g. "+10 admin"); collapsed they overlap into a pile, and tapping
// fans them out so every label is fully readable.
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
      className={`flex-none flex items-center bg-transparent border-0 p-0 ${expanded ? 'gap-1.5' : ''}`}>
      {stickers.map((s, i) => (
        <span
          key={i}
          className={`star-badge sticker sticker--${s.variant} grid place-items-center
            w-[54px] h-[54px] font-display text-[10px] leading-[1.05] text-center px-1
            ${expanded ? '' : i > 0 ? '-ml-5' : ''}`}>
          {s.delta > 0 ? `+${s.delta} admin` : `${s.delta} admin`}
        </span>
      ))}
    </button>
  )
}
