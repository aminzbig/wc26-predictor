import { useLayoutEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { Match, Prediction } from '../lib/types'
import { MatchTile } from './MatchTile'

// Scrollable 2-up grid of compact tiles. Fills the available height and scrolls;
// tapping a tile opens the full detail page (predictions are made there).
// When it opens it centers `focusId` — the live / next-to-be-played match.
export function MatchGrid({ matches, byMatch, onOpen, focusId }: {
  matches: Match[]
  byMatch: Record<string, Prediction>
  onOpen: (m: Match) => void
  focusId?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const focusRef = useRef<HTMLDivElement>(null)

  // Center the focused match's row in this container only (no page scroll).
  // Re-runs when the grid mounts or the target changes; user scrolling is
  // preserved otherwise since deps don't change on realtime refreshes.
  useLayoutEffect(() => {
    const c = containerRef.current, el = focusRef.current
    if (!c || !el) return
    const cRect = c.getBoundingClientRect()
    const eRect = el.getBoundingClientRect()
    const delta = (eRect.top - cRect.top) - (c.clientHeight - el.clientHeight) / 2
    c.scrollTop += delta
  }, [focusId, matches.length])

  return (
    <div ref={containerRef} className="h-full overflow-y-auto -mx-1 px-1 pb-[100px]">
      <motion.div
        className="grid grid-cols-2 auto-rows-[124px] gap-2"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.025 } } }}
      >
        {matches.map(m => (
          <motion.div
            key={m.id}
            ref={m.id === focusId ? focusRef : undefined}
            className="h-full"
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
          >
            <MatchTile match={m} prediction={byMatch[m.id]} onOpen={() => onOpen(m)} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
