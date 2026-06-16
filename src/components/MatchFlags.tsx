import { flagEmoji } from '../lib/social'

// The two teams of a tagged match, shown as flag emoji (more readable than codes,
// and no flag-image CSS dependency).
export function MatchFlags({ home, away }: { home: string | null; away: string | null }) {
  return (
    <span className="inline-flex items-center gap-0.5 border-2 border-ink rounded-full px-2 py-0.5 bg-paper text-[14px] leading-none">
      <span>{flagEmoji(home)}</span>
      <span>{flagEmoji(away)}</span>
    </span>
  )
}
