import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Match, Prediction } from '../lib/types'
import { MatchCard } from './MatchCard'

const spring = { type: 'spring' as const, stiffness: 300, damping: 30 }

export function MatchDeck({ matches, index, setIndex, byMatch, onSave, onOpen }: {
  matches: Match[]
  index: number
  setIndex: (n: number) => void
  byMatch: Record<string, Prediction>
  onSave: (matchId: string, h: number, a: number) => Promise<void>
  onOpen: (m: Match) => void
}) {
  // direction: +1 means moving forward (next), -1 backward (prev)
  const [dir, setDir] = useState(0)

  const clamp = (n: number) => Math.max(0, Math.min(matches.length - 1, n))
  const goNext = () => { if (index < matches.length - 1) { setDir(1); setIndex(clamp(index + 1)) } }
  const goPrev = () => { if (index > 0) { setDir(-1); setIndex(clamp(index - 1)) } }

  const active = matches[index]
  const peek = matches[index + 1]

  if (!active) return null

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 320 : -320, opacity: 0, scale: 0.95 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: d > 0 ? -320 : 320, opacity: 0, scale: 0.95 }),
  }

  return (
    <div className="select-none">
      {/* Deck stack */}
      <div className="relative">
        {/* Peek of the next card behind the active one */}
        {peek && (
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 pointer-events-none"
            style={{ transform: 'translateY(14px) scale(0.93)', opacity: 0.55 }}
          >
            <MatchCard
              key={`peek-${peek.id}`}
              match={peek}
              prediction={byMatch[peek.id]}
              onSave={async () => {}}
            />
          </div>
        )}

        {/* Active draggable card */}
        <AnimatePresence custom={dir} mode="popLayout" initial={false}>
          <motion.div
            key={active.id}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={(_e, info) => {
              const { offset, velocity } = info
              if (offset.x < -110 || velocity.x < -500) goNext()
              else if (offset.x > 110 || velocity.x > 500) goPrev()
            }}
            className="relative z-10 cursor-grab active:cursor-grabbing"
          >
            <MatchCard
              match={active}
              prediction={byMatch[active.id]}
              onSave={(h, a) => onSave(active.id, h, a)}
              onOpen={() => onOpen(active)}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Position row */}
      <div className="flex items-center justify-between mt-4">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={goPrev}
          disabled={index === 0}
          className="w-[44px] h-[44px] grid place-items-center border-[3px] border-ink bg-paper text-ink disabled:opacity-40"
          aria-label="Previous match"
        >
          <ChevronLeft size={22} />
        </motion.button>
        <span className="font-display text-[15px] uppercase tracking-wide text-ink">
          Match {index + 1} / {matches.length}
        </span>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={goNext}
          disabled={index === matches.length - 1}
          className="w-[44px] h-[44px] grid place-items-center border-[3px] border-ink bg-paper text-ink disabled:opacity-40"
          aria-label="Next match"
        >
          <ChevronRight size={22} />
        </motion.button>
      </div>
    </div>
  )
}
