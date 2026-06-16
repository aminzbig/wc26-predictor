import { flagEmoji } from '../lib/social'

// The two teams of a tagged match, shown as flag emoji at 2× size in a sharp
// rectangle that mirrors the reaction buttons (border-[3px] border-ink, bg-paper)
// so it frames the post text from above. Undecided knockout slots read "Upcoming".
export function MatchFlags({ home, away }: { home: string | null; away: string | null }) {
  const tbd = !home && !away
  return (
    <span className="inline-flex items-center gap-2 border-[3px] border-ink bg-paper text-ink px-3 py-1.5 leading-none text-[28px]">
      {tbd ? (
        <span className="text-[16px] font-900 uppercase tracking-wide">Upcoming</span>
      ) : (
        <>
          <span>{flagEmoji(home)}</span>
          <span>{flagEmoji(away)}</span>
        </>
      )}
    </span>
  )
}
