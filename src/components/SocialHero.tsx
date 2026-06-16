import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Flag } from './Flag'
import { MatchFlags } from './MatchFlags'
import { ReactionBar } from './ReactionBar'
import { REACTIONS, colorClass, fontClass, isLight, relativeTime, type PostView, type Reaction } from '../lib/social'

interface Burst { id: number; emoji: string; x: number }

export function SocialHero({ view, canDelete, tapped, onReact, onDelete }: {
  view: PostView | null
  canDelete: boolean
  tapped: Reaction[]
  onReact: (key: Reaction) => void
  onDelete: () => void
}) {
  const [bursts, setBursts] = useState<Burst[]>([])
  const [seq, setSeq] = useState(0)

  if (!view) {
    return (
      <div className="border-[3px] border-dashed border-ink rounded-[24px] p-8 text-center">
        <p className="font-display uppercase text-[18px]">Be the first to post</p>
        <p className="text-[13px] opacity-60 mt-1">Start the trash talk below ⚽</p>
      </div>
    )
  }

  const light = isLight(view.color)

  function handleReact(key: Reaction) {
    const emoji = REACTIONS.find(r => r.key === key)!.emoji
    const id = seq
    setSeq(s => s + 1)
    // x in [-50, 50]px around center; index-derived so it varies without Math.random.
    setBursts(b => [...b, { id, emoji, x: ((id % 7) - 3) * 18 }])
    setTimeout(() => setBursts(b => b.filter(x => x.id !== id)), 900)
    onReact(key)
  }

  return (
    <div className="relative">
      {/* floating reaction burst */}
      <AnimatePresence>
        {bursts.map(b => (
          <motion.span
            key={b.id}
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: 1, y: -120, scale: 1.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="absolute left-1/2 bottom-16 text-[30px] z-10 pointer-events-none"
            style={{ marginLeft: b.x }}
          >
            {b.emoji}
          </motion.span>
        ))}
      </AnimatePresence>

      <div className={`${colorClass(view.color)} border-[4px] border-ink rounded-[26px] p-5 shadow-[6px_6px_0_#141210]`}>
        <div className="flex items-center gap-2.5">
          <Flag code={view.author_flag} label={view.author_name} size="md" />
          <span className="font-display uppercase text-[18px] tracking-wide">{view.author_name}</span>
          {view.match_label && <MatchFlags home={view.match_home} away={view.match_away} />}
          <span className={`ml-auto text-[12px] font-900 ${light ? 'opacity-80' : 'opacity-70'}`}>
            {relativeTime(view.created_at)}
          </span>
          {canDelete && (
            <button type="button" aria-label="delete" onClick={onDelete}><X size={16} /></button>
          )}
        </div>
        <p style={{ fontSize: 23 * view.scale }} className={`${fontClass(view.font)} font-900 leading-[1.2] tracking-[-0.4px] my-4`}>{view.body}</p>
        <ReactionBar row={view} color={view.color} size="hero" tapped={tapped} onReact={handleReact} />
      </div>
    </div>
  )
}
