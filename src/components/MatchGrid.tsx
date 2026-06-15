import { motion } from 'framer-motion'
import type { Match, Prediction } from '../lib/types'
import { MatchTile } from './MatchTile'

// Scrollable 2-up grid of compact tiles. Fills the available height and scrolls;
// tapping a tile opens the full detail page (predictions are made there).
export function MatchGrid({ matches, byMatch, onOpen }: {
  matches: Match[]
  byMatch: Record<string, Prediction>
  onOpen: (m: Match) => void
}) {
  return (
    <div className="h-full overflow-y-auto -mx-1 px-1 pb-2">
      <motion.div
        className="grid grid-cols-2 auto-rows-[124px] gap-2"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.025 } } }}
      >
        {matches.map(m => (
          <motion.div
            key={m.id}
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
