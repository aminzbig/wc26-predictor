import { motion, useAnimationControls } from 'framer-motion'
import { REACTIONS, colorClass, isLight, type Reaction, type SocialPostRow, type SocialColor } from '../lib/social'

// Rectangle reaction buttons, tinted the card's own color. Tapping a reaction
// flashes the button ink and fades it back to normal — each tap retriggers the
// flash, so you can blast a reaction repeatedly without it sticking lit.
export function ReactionBar({ row, color, size, onReact }: {
  row: SocialPostRow
  color: SocialColor
  size: 'hero' | 'card'
  onReact: (key: Reaction) => void
}) {
  const tint = colorClass(color).split(' ')[0] // e.g. 'bg-orange' (drop any text-paper)
  // Blue/red cards are dark — keep button text light so the count stays legible.
  const light = isLight(color)
  const restText = light ? 'text-paper' : 'text-ink'
  const restHex = light ? '#f2eee2' : '#141210' // count color at rest (matches restText)
  const hero = size === 'hero'
  return (
    <div className={`flex ${hero ? 'gap-1.5' : 'gap-1'} ${hero ? 'mt-3' : 'mt-2'}`}>
      {REACTIONS.map(r => (
        <ReactionButton key={r.key} r={r} count={row[r.column]}
          tint={tint} restText={restText} restHex={restHex} hero={hero} onReact={onReact} />
      ))}
    </div>
  )
}

function ReactionButton({ r, count, tint, restText, restHex, hero, onReact }: {
  r: (typeof REACTIONS)[number]
  count: number
  tint: string
  restText: string
  restHex: string
  hero: boolean
  onReact: (key: Reaction) => void
}) {
  const fill = useAnimationControls() // ink overlay opacity
  const text = useAnimationControls() // count color, flipped light during the flash

  function tap() {
    fill.set({ opacity: 0.92 })
    fill.start({ opacity: 0, transition: { duration: 0.45, ease: 'easeOut' } })
    text.set({ color: '#f2eee2' })
    text.start({ color: restHex, transition: { duration: 0.45, ease: 'easeOut' } })
    onReact(r.key)
  }

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      onClick={tap}
      aria-label={r.key}
      className={`relative overflow-hidden flex-1 flex items-center justify-center gap-1 border-[3px] border-ink
        ${hero ? 'py-2 text-[18px]' : 'py-1 text-[15px]'} font-display ${tint} ${restText}`}
    >
      <motion.span aria-hidden initial={{ opacity: 0 }} animate={fill}
        className="absolute inset-0 bg-ink pointer-events-none" />
      <span className="relative z-10">{r.emoji}</span>
      <motion.span initial={{ color: restHex }} animate={text}
        className={`relative z-10 ${hero ? 'text-[13px]' : 'text-[11px]'}`}>{count}</motion.span>
    </motion.button>
  )
}
