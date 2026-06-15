import { motion } from 'framer-motion'
import { REACTIONS, hottest, colorClass, type Reaction, type SocialPostRow, type SocialColor } from '../lib/social'

// Rectangle reaction buttons, tinted the card's own color. The most-tapped
// ("hot") reaction fills solid ink. `size` switches hero vs compact feed card.
export function ReactionBar({ row, color, size, onReact }: {
  row: SocialPostRow
  color: SocialColor
  size: 'hero' | 'card'
  onReact: (key: Reaction) => void
}) {
  const hot = hottest(row)
  const tint = colorClass(color).split(' ')[0] // e.g. 'bg-orange' (drop any text-paper)
  const hero = size === 'hero'
  return (
    <div className={`flex ${hero ? 'gap-1.5' : 'gap-1'} ${hero ? 'mt-3' : 'mt-2'}`}>
      {REACTIONS.map(r => {
        const isHot = hot === r.key
        return (
          <motion.button
            key={r.key}
            type="button"
            whileTap={{ scale: 0.88 }}
            onClick={() => onReact(r.key)}
            aria-label={r.key}
            className={`flex-1 flex items-center justify-center gap-1 border-[3px] border-ink
              ${hero ? 'py-2 text-[18px]' : 'py-1 text-[15px]'} font-display
              ${isHot ? 'bg-ink text-paper' : `${tint} text-ink`}`}
          >
            <span>{r.emoji}</span>
            <span className={hero ? 'text-[13px]' : 'text-[11px]'}>{row[r.column]}</span>
          </motion.button>
        )
      })}
    </div>
  )
}
