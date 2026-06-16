import { flagEmoji } from '../lib/social'

// The two teams of a tagged match, shown as flag emoji (more readable than codes,
// and no flag-image CSS dependency). Knockout slots without teams read "Upcoming".
export function MatchFlags({ home, away }: { home: string | null; away: string | null }) {
  const tbd = !home && !away
  return (
    <span className="inline-flex items-center gap-0.5 border-2 border-ink rounded-full px-2 py-0.5 bg-paper text-ink text-[14px] leading-none">
      {tbd ? (
        <span className="text-[10px] font-900 uppercase">Upcoming</span>
      ) : (
        <>
          <span>{flagEmoji(home)}</span>
          <span>{flagEmoji(away)}</span>
        </>
      )}
    </span>
  )
}
