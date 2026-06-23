import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Match, Prediction, Stage } from '../lib/types'
import { MatchCard } from './MatchCard'
import { matchState } from '../lib/matchState'

const spring = { type: 'spring' as const, stiffness: 300, damping: 30 }

// Active card is inset from the top so the upcoming cards can peek ABOVE it,
// stacking up toward the top bar.
const CARD_POS = 'absolute inset-x-0 bottom-0 top-[clamp(40px,calc(var(--app-vh)*0.065),62px)]'

export function MatchDeck({ matches, index, setIndex, byMatch, onSave, onOpen, boostByMatch, byStage, setBooster, clearBooster }: {
  matches: Match[]
  index: number
  setIndex: (n: number) => void
  byMatch: Record<string, Prediction>
  onSave: (matchId: string, h: number, a: number) => Promise<void>
  onOpen: (m: Match) => void
  boostByMatch: Record<string, { match_id: string; stage: Stage }>
  byStage: Record<string, { match_id: string; stage: Stage }>
  setBooster: (matchId: string, stage: Stage) => Promise<void>
  clearBooster: (matchId: string) => Promise<void>
}) {
  // direction: +1 means moving forward (next), -1 backward (prev)
  const [dir, setDir] = useState(0)
  // distinguishes a real drag from a tap: set on drag start, checked on the
  // click that fires afterwards (framer doesn't suppress the child's onClick).
  const dragged = useRef(false)

  const clamp = (n: number) => Math.max(0, Math.min(matches.length - 1, n))
  const goNext = () => { if (index < matches.length - 1) { setDir(1); setIndex(clamp(index + 1)) } }
  const goPrev = () => { if (index > 0) { setDir(-1); setIndex(clamp(index - 1)) } }

  const active = matches[index]
  const peek1 = matches[index + 1]
  const peek2 = matches[index + 2]

  if (!active) return null

  // Booster greys siblings only once this round's booster is COMMITTED — i.e. the
  // booster sits on a *different* game that has already locked/finished. While the
  // boosted game is still open, every other open game in the round stays tappable
  // (tapping moves the booster there).
  const activeBoosted = !!boostByMatch[active.id]
  const roundBooster = byStage[active.stage]
  let boosterRoundCommitted = false
  if (roundBooster && roundBooster.match_id !== active.id) {
    const boostedMatch = matches.find(m => m.id === roundBooster.match_id)
    boosterRoundCommitted = !boostedMatch || matchState(boostedMatch) !== 'open'
  }

  // Incoming card drops down from the stack above and scales up into place;
  // the swiped card flies out sideways with a little rotation.
  const variants = {
    enter: { y: -18, scale: 0.94, opacity: 0.5 },
    center: { y: 0, scale: 1, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? 340 : -340, opacity: 0, rotate: d > 0 ? 8 : -8 }),
  }

  return (
    <div className="flex flex-col h-full select-none">
      {/* Deck stack — upcoming cards peek above the active one. overflow-hidden
          clips the active card's horizontal drag / fly-out (exit x: ±340) so it
          can't widen the page (no sideways scrollbar / scroll-to-another-page).
          The peek cards sit at positive offsets inside the stack, so they're not
          clipped. */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* Furthest peek (above, smallest) */}
        {peek2 && (
          <div aria-hidden className={`${CARD_POS} z-[1] pointer-events-none`}
            style={{ transform: 'translateY(clamp(-56px, calc(var(--app-vh) * -0.062), -32px)) scale(0.90)', transformOrigin: 'top center', opacity: 0.4 }}>
            <MatchCard match={peek2} prediction={byMatch[peek2.id]} onSave={async () => {}} boosterActive={!!boostByMatch[peek2.id]} />
          </div>
        )}
        {/* Nearer peek (above, a bit smaller) */}
        {peek1 && (
          <div aria-hidden className={`${CARD_POS} z-[2] pointer-events-none`}
            style={{ transform: 'translateY(clamp(-29px, calc(var(--app-vh) * -0.032), -16px)) scale(0.95)', transformOrigin: 'top center', opacity: 0.7 }}>
            <MatchCard match={peek1} prediction={byMatch[peek1.id]} onSave={async () => {}} boosterActive={!!boostByMatch[peek1.id]} />
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
            onPointerDownCapture={() => { dragged.current = false }}
            onDragStart={() => { dragged.current = true }}
            onDragEnd={(_e, info) => {
              const { offset, velocity } = info
              if (offset.x > 110 || velocity.x > 500) goNext()        // swipe right → next
              else if (offset.x < -110 || velocity.x < -500) goPrev() // swipe left → previous
            }}
            className={`${CARD_POS} z-10 cursor-grab active:cursor-grabbing`}
            data-testid="active-card"
          >
            <MatchCard
              match={active}
              prediction={byMatch[active.id]}
              onSave={(h, a) => onSave(active.id, h, a)}
              onOpen={() => { if (!dragged.current) onOpen(active) }}
              boosterActive={activeBoosted}
              boosterRoundUsed={boosterRoundCommitted}
              onToggleBooster={() => { if (activeBoosted) clearBooster(active.id); else setBooster(active.id, active.stage) }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Position row */}
      <div className="flex items-center justify-between mt-3 shrink-0">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={goPrev}
          disabled={index === 0}
          className="w-[42px] h-[42px] grid place-items-center border-[3px] border-ink bg-paper text-ink disabled:opacity-40"
          aria-label="Previous match"
        >
          <ChevronLeft size={20} />
        </motion.button>
        <span className="font-display text-[14px] uppercase tracking-wide text-ink">
          Match {index + 1} / {matches.length}
        </span>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={goNext}
          disabled={index === matches.length - 1}
          className="w-[42px] h-[42px] grid place-items-center border-[3px] border-ink bg-paper text-ink disabled:opacity-40"
          aria-label="Next match"
        >
          <ChevronRight size={20} />
        </motion.button>
      </div>
    </div>
  )
}
