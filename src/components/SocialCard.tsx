import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Avatar } from './Avatar'
import { MatchFlags } from './MatchFlags'
import { ReactionBar } from './ReactionBar'
import { REACTIONS, colorClass, fontClass, isLight, relativeTime, type PostView, type Reaction } from '../lib/social'

interface Burst { id: number; emoji: string; x: number }

export function SocialCard({ view, canDelete, onReact, onDelete }: {
  view: PostView
  canDelete: boolean
  onReact: (key: Reaction) => void
  onDelete: () => void
}) {
  const light = isLight(view.color)
  const [bursts, setBursts] = useState<Burst[]>([])
  const [seq, setSeq] = useState(0)

  // Tapping a reaction floats its emoji upward off the card; each tap adds one,
  // so rapid taps blast a stream. Cleared after the animation.
  function handleReact(key: Reaction) {
    const emoji = REACTIONS.find(r => r.key === key)!.emoji
    const id = seq
    setSeq(s => s + 1)
    // x in [-54, 54]px around center; index-derived so it varies without Math.random.
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
            animate={{ opacity: 1, y: -110, scale: 1.25 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="absolute left-1/2 bottom-10 text-[28px] z-10 pointer-events-none"
            style={{ marginLeft: b.x }}
          >
            {b.emoji}
          </motion.span>
        ))}
      </AnimatePresence>

      <div className={`${colorClass(view.color)} border-[3px] border-ink p-3`}>
        <div className="flex items-center gap-2 mb-2">
          <Avatar url={view.author_avatar} code={view.author_flag} label={view.author_name} px={36} />
          <span className="font-display uppercase text-[17px] tracking-wide">{view.author_name}</span>
          <span className={`ml-auto text-[11px] font-900 ${light ? 'opacity-80' : 'opacity-60'}`}>
            {relativeTime(view.created_at)}
          </span>
          {canDelete && (
            <button type="button" aria-label="delete" onClick={onDelete} className="ml-1">
              <X size={14} />
            </button>
          )}
        </div>
        {view.match_label && (
          <div className="mb-2"><MatchFlags home={view.match_home} away={view.match_away} /></div>
        )}
        <p style={{ fontSize: 14 * view.scale }} className={`${fontClass(view.font)} font-800 leading-snug`}>{view.body}</p>
        <ReactionBar row={view} color={view.color} size="card" onReact={handleReact} />
      </div>
    </div>
  )
}
