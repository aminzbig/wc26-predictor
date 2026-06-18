import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Pencil } from 'lucide-react'
import {
  PALETTE, FONTS, SCALES, colorClass, fontClass, validBody, matchOption,
  type SocialColor, type SocialFont, type SocialScale, type MatchLite,
} from '../lib/social'
import { useScrollContainer } from '../context/ScrollContext'
import { useScrollDirection } from '../hooks/useScrollDirection'
import { useKeyboardInset } from '../hooks/useKeyboardInset'

const MAX = 280
const BASE = 16 // composer preview base px, scaled by the chosen size

// Same glass recipe as BottomNav, so the composer reads as part of the dock.
const GLASS =
  'border-[3px] border-ink bg-paper/65 backdrop-blur-xl ' +
  'supports-[backdrop-filter]:bg-paper/55 ' +
  'shadow-[0_12px_30px_-8px_rgba(20,18,16,0.5)]'

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
  const [expanded, setExpanded] = useState(false)

  const scrollRef = useScrollContainer()
  const hidden = useScrollDirection(scrollRef, expanded)
  const kbInset = useKeyboardInset(expanded)

  const can = validBody(body)

  function submit() {
    if (!can) return
    onPost(body.trim(), color, font, scale, matchId || null)
    setBody(''); setMatchId(''); setPickMatch(false); setExpanded(false)
  }
  const collapse = useCallback(() => { setExpanded(false); setPickMatch(false) }, [])

  // Esc collapses the expanded editor.
  useEffect(() => {
    if (!expanded) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') collapse() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded, collapse])

  const tucked = hidden && !expanded // slid down behind the nav

  return (
    <>
      {/* Scrim dims the feed while composing; tap OR scroll over it to
          collapse (scroll-to-dismiss, same as tapping out). Collapsing
          unmounts the textarea, which also closes the keyboard. */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="composer-scrim"
            className="fixed inset-0 z-[55] bg-ink/30"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={collapse}
            onWheel={collapse}
            onTouchMove={collapse}
          />
        )}
      </AnimatePresence>

      {/* Floating composer, centered to the app column above the nav.
          Centered via inset-x-0 + mx-auto (NOT translate-x) so framer-motion's
          `y` transform doesn't clobber the horizontal centering. */}
      <motion.div
        className={`fixed inset-x-0 mx-auto w-full max-w-md px-4 ${expanded ? 'z-[60]' : 'z-30'}`}
        style={{ bottom: `calc(env(safe-area-inset-bottom) + 104px + ${kbInset}px)` }}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: tucked ? 160 : 0, opacity: tucked ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      >
        <div className={`${GLASS} ${tucked ? 'pointer-events-none' : ''}`}>
          {!expanded ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
            >
              <span className="text-[14px] font-700 text-ink/55">Share something with the group…</span>
              <Pencil size={18} strokeWidth={2.75} className="text-ink/70" />
            </button>
          ) : (
            <div className="p-3">
              <textarea
                autoFocus
                value={body}
                maxLength={MAX}
                onChange={e => setBody(e.target.value)}
                rows={2}
                placeholder="Share something with the group…"
                style={{ fontSize: BASE * scale }}
                className={`w-full resize-none bg-transparent outline-none leading-tight text-ink placeholder:text-ink placeholder:opacity-50 ${fontClass(font)}`}
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
                  <span className="text-[11px] opacity-60">{MAX - body.length}</span>
                  <button
                    type="button"
                    disabled={!can}
                    onClick={submit}
                    className="font-display uppercase bg-yellow text-ink border-[3px] border-ink px-4 py-1.5 text-[14px] disabled:opacity-50"
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}
