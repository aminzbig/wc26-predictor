import { adminStickers } from '../lib/adminStickers'

// A pile of admin reward/penalty stickers on a ranking row. They overlap into a
// tight, drop-shadowed stack so the layering reads. Each sticker shows its value
// on two lines ("+10" / "admin"); pressing/holding one pops it up and enlarges it
// (like an iOS keyboard key) so it's readable — the stack itself never separates.
export function StickerStack({ deltas }: { deltas: number[] | null }) {
  const stickers = adminStickers(deltas)
  if (stickers.length === 0) return null

  return (
    <span role="group" aria-label="admin stickers" className="flex-none flex items-center">
      {stickers.map((s, i) => (
        <button
          type="button"
          key={i}
          aria-label={`${s.delta > 0 ? '+' : ''}${s.delta} admin`}
          className={`star-badge sticker sticker--${s.variant} appearance-none border-0 p-0
            w-[60px] h-[60px] ${i > 0 ? '-ml-10' : ''}`}>
          <span className="flex flex-col items-center justify-center leading-none">
            <span className="font-display text-[16px]">{s.delta > 0 ? `+${s.delta}` : `${s.delta}`}</span>
            <span className="font-display text-[8px] tracking-wider mt-0.5">admin</span>
          </span>
        </button>
      ))}
    </span>
  )
}
