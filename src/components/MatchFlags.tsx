import { Flag } from './Flag'

// The two teams of a tagged match, shown as flags (more readable than codes).
export function MatchFlags({ home, away }: { home: string | null; away: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 border-2 border-ink rounded-full px-1.5 py-0.5 bg-paper">
      <Flag code={home} size="sm" />
      <Flag code={away} size="sm" />
    </span>
  )
}
