import { useState } from 'react'
import { PALETTE, colorClass, validBody, type SocialColor, type MatchLite } from '../lib/social'

const MAX = 280

export function SocialComposer({ matchList, onPost }: {
  matchList: MatchLite[]
  onPost: (body: string, color: SocialColor, matchId: string | null) => void
}) {
  const [body, setBody] = useState('')
  // Default color derived from text length so it varies without Math.random.
  const [color, setColor] = useState<SocialColor>('orange')
  const [matchId, setMatchId] = useState<string>('')
  const [pickMatch, setPickMatch] = useState(false)

  const can = validBody(body)
  function submit() {
    if (!can) return
    onPost(body.trim(), color, matchId || null)
    setBody(''); setMatchId(''); setPickMatch(false)
  }

  return (
    <div className="border-[3px] border-ink bg-white rounded-[20px] p-3 shadow-[3px_3px_0_#141210] mb-4">
      <textarea
        value={body}
        maxLength={MAX}
        onChange={e => setBody(e.target.value)}
        rows={2}
        placeholder="Share something with the group…"
        className="w-full resize-none bg-transparent outline-none font-800 text-[14px]"
      />

      {/* color swatches */}
      <div className="flex gap-1.5 mt-1">
        {PALETTE.map(c => (
          <button
            key={c}
            type="button"
            aria-label={`color ${c}`}
            onClick={() => setColor(c)}
            className={`w-6 h-6 border-2 border-ink ${colorClass(c).split(' ')[0]} ${color === c ? 'ring-2 ring-ink ring-offset-1' : ''}`}
          />
        ))}
      </div>

      {pickMatch && matchList.length > 0 && (
        <select
          value={matchId}
          onChange={e => setMatchId(e.target.value)}
          className="mt-2 w-full border-2 border-ink bg-paper text-[12px] font-800 p-1"
        >
          <option value="">No match</option>
          {matchList.map(m => (
            <option key={m.id} value={m.id}>
              {(m.home_code ?? m.home_label ?? '?').toUpperCase()}–{(m.away_code ?? m.away_label ?? '?').toUpperCase()}
            </option>
          ))}
        </select>
      )}

      <div className="flex items-center justify-between mt-2">
        <button
          type="button"
          onClick={() => setPickMatch(v => !v)}
          className="text-[11px] font-900 uppercase border-2 border-ink px-2 py-0.5 bg-paper"
        >
          ＋ Tag match
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[11px] opacity-60">{MAX - body.length}</span>
          <button
            type="button"
            disabled={!can}
            onClick={submit}
            className="font-display uppercase bg-yellow border-[3px] border-ink rounded-[18px] px-4 py-1.5 text-[14px] disabled:opacity-50"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  )
}
