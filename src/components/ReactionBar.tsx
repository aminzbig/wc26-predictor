import { motion } from 'framer-motion'
import { REACTIONS, colorClass, isLight, type Reaction, type SocialPostRow, type SocialColor } from '../lib/social'

// Rectangle reaction buttons, tinted the card's own color. Reactions YOU have
// tapped (tracked per-device) fill solid ink so you can see what you reacted with.
// `size` switches hero vs compact feed card.
export function ReactionBar({ row, color, size, tapped, onReact }: {
  row: SocialPostRow
  color: SocialColor
  size: 'hero' | 'card'
  tapped: Reaction[]
  onReact: (key: Reaction) => void
}) {
  const tint = colorClass(color).split(' ')[0] // e.g. 'bg-orange' (drop any text-paper)
  // Blue/red cards are dark — keep non-tapped button text light so the count stays legible.
  const restText = isLight(color) ? 'text-paper' : 'text-ink'
  const hero = size === 'hero'
  return (
    <div className={`flex ${hero ? 'gap-1.5' : 'gap-1'} ${hero ? 'mt-3' : 'mt-2'}`}>
      {REACTIONS.map(r => {
        const mine = tapped.includes(r.key)
        return (
          <motion.button
            key={r.key}
            type="button"
            whileTap={{ scale: 0.88 }}
            onClick={() => onReact(r.key)}
            aria-label={r.key}
            aria-pressed={mine}
            className={`flex-1 flex items-center justify-center gap-1 border-[3px] border-ink
              ${hero ? 'py-2 text-[18px]' : 'py-1 text-[15px]'} font-display
              ${mine ? 'bg-ink text-paper' : `${tint} ${restText}`}`}
          >
            <span>{r.emoji}</span>
            <span className={hero ? 'text-[13px]' : 'text-[11px]'}>{row[r.column]}</span>
          </motion.button>
        )
      })}
    </div>
  )
}
