import { Flag } from './Flag'
import type { GroupStanding, TeamStanding } from '../lib/standings'

const STAT_COLS = ['MP', 'W', 'D', 'L', 'GD'] as const

// Qualification styling: top-2 (advance) fill the whole row yellow; a provisional
// best-8 third-place (wildcard) gets a dashed yellow left bar. The 6px left border
// is always present (transparent when plain) so every row's content stays aligned.
function rowClass(q: TeamStanding['qualification']) {
  if (q === 'advance') return 'bg-green border-l-[6px] border-green'
  if (q === 'wildcard') return 'border-l-[6px] border-dashed border-green'
  return 'border-l-[6px] border-transparent'
}

export function StandingsTable({ group }: { group: GroupStanding }) {
  return (
    <div className="border-[3px] border-ink bg-paper mb-4">
      <div className="bg-ink text-paper px-3 py-1.5 font-display text-[15px] uppercase tracking-wide">
        {group.label}
      </div>

      {/* Column labels */}
      <div className="flex items-center px-2 py-1.5 border-b-[2px] border-ink">
        <div className="flex-1 pl-[6px] font-sans font-900 text-[9px] uppercase tracking-widest text-ink/50">Team</div>
        <div className="grid grid-cols-6 w-[156px] text-center">
          {STAT_COLS.map(c => (
            <span key={c} className="font-sans font-900 text-[9px] uppercase tracking-widest text-ink/50">{c}</span>
          ))}
          <span className="font-sans font-900 text-[9px] uppercase tracking-widest text-ink">Pts</span>
        </div>
      </div>

      {group.rows.map(r => (
        <div key={r.code}
          className={`flex items-center px-2 py-2 border-b-[2px] border-ink/10 last:border-b-0 ${rowClass(r.qualification)}`}>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="w-[16px] text-center font-display text-[15px] text-ink/60 flex-none">{r.rank}</span>
            <Flag code={r.code} label={r.name} size="sm" />
            <span className="font-display text-[15px] uppercase truncate">{r.name}</span>
          </div>
          <div className="grid grid-cols-6 w-[156px] text-center items-center font-display text-[15px] tabular-nums text-ink">
            <span>{r.mp}</span>
            <span>{r.w}</span>
            <span>{r.d}</span>
            <span>{r.l}</span>
            <span>{r.gd > 0 ? `+${r.gd}` : r.gd}</span>
            <span>{r.pts}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
