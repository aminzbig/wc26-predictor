import { flagEmoji } from '../lib/social'

// The two teams of a tagged match, shown as flag emoji (more readable than codes,
// and no flag-image CSS dependency). Knockout slots without teams read "Upcoming".
// Sits above the post body at 2× size so the matchup is easy to read.
export function MatchFlags({ home, away }: { home: string | null; away: string | null }) {
  const tbd = !home && !away
  return (
    <span className="inline-flex items-center gap-1.5 border-[3px] border-ink rounded-full px-3 py-1 bg-paper text-ink text-[28px] leading-none">
      {tbd ? (
        <span className="text-[14px] font-900 uppercase">Upcoming</span>
      ) : (
        <>
          <span>{flagEmoji(home)}</span>
          <span>{flagEmoji(away)}</span>
        </>
      )}
    </span>
  )
}
