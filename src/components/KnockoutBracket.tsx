import { Fragment, useMemo } from 'react'
import type { Match, Stage } from '../lib/types'
import { resolveBracket, bracketOrder, type BracketMatch } from '../lib/bracket'
import { KnockoutCard } from './KnockoutCard'

// The bracket as horizontal columns (Google-style): Round of 32 → … → Final,
// scrolled left-to-right, with elbow connectors joining each pair of feeder
// cards to the single card they feed. Each card resolves its teams from the
// match results; unknown sides render as TBD until their feeder is decided.
const ROUNDS: { stage: Stage; title: string; count: number }[] = [
  { stage: 'r32', title: 'Round of 32', count: 16 },
  { stage: 'r16', title: 'Round of 16', count: 8 },
  { stage: 'qf', title: 'Quarter-finals', count: 4 },
  { stage: 'sf', title: 'Semi-finals', count: 2 },
  { stage: 'final', title: 'Final', count: 1 },
]

const CARD_W = 188   // card (and column) width
const CARD_H = 84    // fixed card height so columns align
const GAP = 18       // vertical gap between Round-of-32 cards
const GUTTER = 32    // connector column width
const HEADER_H = 34  // round-title row height
const COL_H = ROUNDS[0].count * (CARD_H + GAP) // total height all columns share

// Vertical centre of card `i` of a round with `count` cards — equal to the
// centre of its slot under `justify-around`, which is what the columns use.
const centreY = (count: number, i: number) => (COL_H * (i + 0.5)) / count

// Connector gutter between a round of `leftCount` cards and the next round of
// `leftCount/2` cards: for each receiver, an elbow from its two feeders' right
// edges to its left edge.
function Gutter({ leftCount }: { leftCount: number }) {
  const rightCount = leftCount / 2
  const mid = GUTTER / 2
  const paths: string[] = []
  for (let j = 0; j < rightCount; j++) {
    const yTop = centreY(leftCount, 2 * j)
    const yBot = centreY(leftCount, 2 * j + 1)
    const yMid = (yTop + yBot) / 2
    paths.push(
      `M0 ${yTop} H${mid} M0 ${yBot} H${mid} M${mid} ${yTop} V${yBot} M${mid} ${yMid} H${GUTTER}`,
    )
  }
  return (
    <div className="flex-none flex flex-col" style={{ width: GUTTER }}>
      <div style={{ height: HEADER_H }} />
      <svg width={GUTTER} height={COL_H} className="block text-ink/25">
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={1.5} />
        ))}
      </svg>
    </div>
  )
}

// One round's column: a header, then `count` evenly-spaced slots. A slot with a
// fixture renders a card; a slot without one (data not seeded) renders a faint
// placeholder so the bracket keeps its shape. The final column also carries the
// third-place play-off, tucked just below the (centred) final card.
function Column({ title, count, cards, third }:
  { title: string; count: number; cards: BracketMatch[]; third?: BracketMatch }) {
  return (
    <div className="flex-none flex flex-col" style={{ width: CARD_W }}>
      <div className="flex items-center font-display uppercase text-[13px] tracking-wide text-ink"
        style={{ height: HEADER_H }}>
        {title}
      </div>
      <div className="relative flex flex-col justify-around" style={{ height: COL_H }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ height: CARD_H }} className="flex">
            {cards[i]
              ? <KnockoutCard match={cards[i]} />
              : <div className="h-full w-full border-[2px] border-dashed border-ink/15 rounded-md" />}
          </div>
        ))}
        {third && (
          <div className="absolute left-0 right-0 flex flex-col gap-1.5"
            style={{ top: COL_H / 2 + CARD_H / 2 + 28 }}>
            <div className="font-display uppercase text-[12px] tracking-wide text-ink/70">Third place</div>
            <div style={{ height: CARD_H }} className="flex">
              <KnockoutCard match={third} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function KnockoutBracket({ matches }: { matches: Match[] }) {
  const bracket = useMemo(() => resolveBracket(matches), [matches])
  const byStage = useMemo(() => {
    // Order each column by bracket-tree position (not match_no) so cards sit beside
    // the cards that feed them and the elbow connectors are truthful.
    const order = bracketOrder(bracket)
    const out: Record<string, BracketMatch[]> = {}
    for (const r of ROUNDS) {
      out[r.stage] = bracket
        .filter(b => b.stage === r.stage)
        .sort((a, b) => (order.get(a.match_no ?? -1) ?? 0) - (order.get(b.match_no ?? -1) ?? 0))
    }
    return out
  }, [bracket])
  const third = useMemo(() => bracket.find(b => b.stage === 'third'), [bracket])

  if (bracket.length === 0) {
    return <p className="font-sans font-700 text-ink/60 uppercase text-sm tracking-wide">No knockout matches yet.</p>
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex items-start" style={{ minWidth: 'max-content' }}>
        {ROUNDS.map((r, idx) => (
          <Fragment key={r.stage}>
            <Column title={r.title} count={r.count} cards={byStage[r.stage] ?? []}
              third={r.stage === 'final' ? third : undefined} />
            {idx < ROUNDS.length - 1 && <Gutter leftCount={r.count} />}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
