import { X } from 'lucide-react'
import { Flag } from './Flag'
import { MatchFlags } from './MatchFlags'
import { ReactionBar } from './ReactionBar'
import { colorClass, fontClass, isLight, relativeTime, type PostView, type Reaction } from '../lib/social'

export function SocialCard({ view, canDelete, tapped, onReact, onDelete }: {
  view: PostView
  canDelete: boolean
  tapped: Reaction[]
  onReact: (key: Reaction) => void
  onDelete: () => void
}) {
  const light = isLight(view.color)
  return (
    <div className={`${colorClass(view.color)} border-[3px] border-ink rounded-[14px] p-3 shadow-[3px_3px_0_#141210]`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Flag code={view.author_flag} label={view.author_name} size="sm" />
        <span className="font-display uppercase text-[14px] tracking-wide">{view.author_name}</span>
        <span className={`ml-auto text-[11px] font-900 ${light ? 'opacity-80' : 'opacity-60'}`}>
          {relativeTime(view.created_at)}
        </span>
        {canDelete && (
          <button type="button" aria-label="delete" onClick={onDelete} className="ml-1">
            <X size={14} />
          </button>
        )}
      </div>
      {view.match_label && (
        <div className="mb-2"><MatchFlags home={view.match_home} away={view.match_away} /></div>
      )}
      <p style={{ fontSize: 14 * view.scale }} className={`${fontClass(view.font)} font-800 leading-snug`}>{view.body}</p>
      <ReactionBar row={view} color={view.color} size="card" tapped={tapped} onReact={onReact} />
    </div>
  )
}
