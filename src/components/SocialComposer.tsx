import { useState } from 'react'
import {
  PALETTE, FONTS, SCALES, colorClass, fontClass, isLight, validBody, matchOption,
  type SocialColor, type SocialFont, type SocialScale, type MatchLite,
} from '../lib/social'

const MAX = 280
const BASE = 16 // composer preview base px, scaled by the chosen size

export function SocialComposer({ matchList, onPost }: {
  matchList: MatchLite[]
  onPost: (body: string, color: SocialColor, font: SocialFont, scale: SocialScale, matchId: string | null) => void
}) {
  const [body, setBody] = useState('')
  const [color, setColor] = useState<SocialColor>('paper')
  const [font, setFont] = useState<SocialFont>('sans')
  const [scale, setScale] = useState<SocialScale>(1)
  const [matchId, setMatchId] = useState<string>('')
  const [pickMatch, setPickMatch] = useState(false)

  const can = validBody(body)
  const dark = isLight(color) // blue/red → light text on the live preview
  function submit() {
    if (!can) return
    onPost(body.trim(), color, font, scale, matchId || null)
    setBody(''); setMatchId(''); setPickMatch(false)
  }

  return (
    // The composer previews your card live: its background is the chosen color.
    <div className={`${colorClass(color)} border-[3px] border-ink rounded-[20px] p-3 shadow-[3px_3px_0_#141210] mb-4`}>
      <textarea
        value={body}
        maxLength={MAX}
        onChange={e => setBody(e.target.value)}
        rows={2}
        placeholder="Share something with the group…"
        style={{ fontSize: BASE * scale }}
        className={`w-full resize-none bg-transparent outline-none leading-tight placeholder:opacity-50 ${fontClass(font)} ${dark ? 'text-paper placeholder:text-paper' : 'text-ink placeholder:text-ink'}`}
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

      {/* font picker — each chip rendered in its own font */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {FONTS.map(f => (
          <button
            key={f.key}
            type="button"
            aria-label={`font ${f.key}`}
            onClick={() => setFont(f.key)}
            className={`${fontClass(f.key)} px-2 py-0.5 text-[14px] leading-none border-2 border-ink bg-paper text-ink ${font === f.key ? 'ring-2 ring-ink ring-offset-1' : ''}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* text size picker */}
      <div className="flex gap-1.5 mt-2">
        {SCALES.map(s => (
          <button
            key={s.value}
            type="button"
            aria-label={`size ${s.value}`}
            onClick={() => setScale(s.value)}
            className={`px-2.5 py-0.5 text-[13px] font-display leading-none border-2 border-ink bg-paper text-ink ${scale === s.value ? 'ring-2 ring-ink ring-offset-1' : ''}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {pickMatch && matchList.length > 0 && (
        <select
          value={matchId}
          onChange={e => setMatchId(e.target.value)}
          className="mt-2 w-full border-2 border-ink bg-paper text-ink text-[12px] font-800 p-1"
        >
          <option value="">No match</option>
          {matchList.map(m => (
            <option key={m.id} value={m.id}>
              {matchOption(m)}
            </option>
          ))}
        </select>
      )}

      <div className="flex items-center justify-between mt-2">
        <button
          type="button"
          onClick={() => setPickMatch(v => !v)}
          className="text-[11px] font-900 uppercase border-2 border-ink px-2 py-0.5 bg-paper text-ink"
        >
          ＋ Tag match
        </button>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] ${dark ? 'text-paper opacity-80' : 'opacity-60'}`}>{MAX - body.length}</span>
          <button
            type="button"
            disabled={!can}
            onClick={submit}
            className="font-display uppercase bg-yellow text-ink border-[3px] border-ink rounded-[18px] px-4 py-1.5 text-[14px] disabled:opacity-50"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  )
}
