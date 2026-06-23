import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import type { Match, Prediction } from '../lib/types'
import { matchState } from '../lib/matchState'
import { GameInfo, TopThreePredictors, FlagPanel, TeamNameBar, PointsStar, ScoreLine } from './matchFace'
import { BoosterBadge } from './BoosterBadge'

// Panel color cycles deterministically by match_no so each card looks bold.
const PANEL_COLORS = ['bg-orange', 'bg-green', 'bg-blue text-paper', 'bg-yellow', 'bg-red text-paper']
const panelColor = (match_no: number) => PANEL_COLORS[match_no % PANEL_COLORS.length]

// Interior colour for the rainbow-border trick — same order/values as PANEL_COLORS.
const PANEL_HEX = ['#ef4e1b', '#1ba94c', '#1f49d6', '#ffd200', '#e22a1c']
const panelHex = (match_no: number) => PANEL_HEX[match_no % PANEL_HEX.length]

export function MatchCard({ match, prediction, onSave, onOpen, boosterActive, boosterRoundUsed, onToggleBooster }:
  { match: Match; prediction?: Prediction; onSave: (h: number, a: number) => Promise<void>; onOpen?: () => void
    boosterActive?: boolean; boosterRoundUsed?: boolean; onToggleBooster?: () => void }) {
  const state = matchState(match)
  const [hp, setHp] = useState(prediction?.home_pred ?? 0)
  const [ap, setAp] = useState(prediction?.away_pred ?? 0)
  const [saving, setSaving] = useState(false)
  const editable = state === 'open'
  const live = state === 'locked' && match.live_home != null // in progress with a known score
  const finished = state === 'finished'

  // keep the score in sync when the saved prediction changes (e.g. from the detail view)
  useEffect(() => {
    setHp(prediction?.home_pred ?? 0)
    setAp(prediction?.away_pred ?? 0)
  }, [prediction?.home_pred, prediction?.away_pred])

  // Auto-save: debounce edits and persist them — no explicit "Lock prediction" button.
  const savedH = prediction?.home_pred ?? 0, savedA = prediction?.away_pred ?? 0
  useEffect(() => {
    if (!editable) return
    if (hp === savedH && ap === savedA) return
    const t = setTimeout(async () => {
      setSaving(true)
      try { await onSave(hp, ap) } finally { setSaving(false) }
    }, 700)
    return () => clearTimeout(t)
  }, [hp, ap, editable, savedH, savedA]) // eslint-disable-line react-hooks/exhaustive-deps

  // The giant flag numbers are the player's PREDICTION (editable while open); the
  // real/live score lives on the card background so it reads "your pick vs reality".
  const homeNum = editable ? hp : (prediction?.home_pred ?? null)
  const awayNum = editable ? ap : (prediction?.away_pred ?? null)
  const points = finished ? prediction?.points_awarded ?? null : null

  // Booster badge state for the header (open/locked only — finished uses the avatar swap):
  //  active → this match is the player's booster; available → round free; disabled → round already used.
  const boosterState: 'available' | 'active' | 'disabled' | null =
    finished ? null
      : boosterActive ? 'active'
        : editable ? (boosterRoundUsed ? 'disabled' : 'available')
          : null
  // Only let taps change the booster while the match is open.
  const badgeOnClick = editable && (boosterState === 'active' || boosterState === 'available') ? onToggleBooster : undefined

  return (
    <motion.div
      onClick={onOpen}
      whileTap={onOpen ? { scale: 0.99 } : undefined}
      style={boosterActive ? ({ ['--card-bg']: panelHex(match.match_no ?? 0) } as React.CSSProperties) : undefined}
      className={`${panelColor(match.match_no ?? 0)} border-[3px] ${boosterActive ? 'booster-rainbow border-transparent' : 'border-ink'} relative h-full flex flex-col overflow-hidden ${onOpen ? 'cursor-pointer' : ''}`}
    >
      {/* Header: game info (group · date · stadium · city) + status / top-3 winners */}
      <div className="shrink-0 flex items-start justify-between gap-2 px-3 pt-3 pb-2">
        <GameInfo match={match} />
        <div className="flex-none pt-0.5 flex items-center gap-2">
          {finished
            ? <TopThreePredictors match={match} boosted={!!boosterActive} />
            : (
              <>
                <span className="font-sans font-900 text-[10px] uppercase tracking-widest flex items-center gap-1">
                  {state === 'open' && '★ OPEN'}
                  {state === 'locked' && (live
                    ? <>● LIVE{match.live_minute ? ` ${match.live_minute}'` : ''}</>
                    : <><Lock size={10} />LOCKED</>)}
                </span>
                {boosterState && <BoosterBadge state={boosterState} px={30} onClick={badgeOnClick} />}
              </>
            )}
        </div>
      </div>

      {/* Flags + giant prediction numbers, full-bleed with a center divider */}
      <div className="relative flex-1 min-h-0 flex items-stretch border-t-[3px] border-ink">
        <FlagPanel code={match.home_code} label={match.home_label} value={homeNum} editable={editable} onChange={setHp} />
        <div className="w-[3px] bg-ink self-stretch flex-none" />
        <FlagPanel code={match.away_code} label={match.away_label} value={awayNum} editable={editable} onChange={setAp} />
      </div>

      {/* Points star — centered on the whole card (not just the flags area) */}
      {points != null && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] aspect-square z-20 pointer-events-none">
          <PointsStar points={points} multiplier={match.multiplier} />
        </div>
      )}

      {/* Team names — full names (shrunk to fit), matching the detail view.
          Center divider matches the card background colour (Figma). */}
      <TeamNameBar home={match.home_label} away={match.away_label} full divider={panelColor(match.match_no ?? 0).split(' ')[0]} />

      {/* Bottom zone — on the card background (no boxed banner). Same reserved
          height in every state so it's always an easy tap-target into the detail. */}
      <div className="shrink-0 px-3 py-[clamp(8px,calc(var(--app-vh)*0.022),16px)] min-h-[clamp(72px,calc(var(--app-vh)*0.135),104px)] grid place-items-center text-center">
        {live ? (
          <div>
            <div className="font-sans font-900 text-[11px] uppercase tracking-widest leading-none">
              <span className="live-dot">●</span> Live{match.live_minute ? ` ${match.live_minute}'` : ''}
            </div>
            <ScoreLine home={match.live_home} away={match.live_away} className="text-[clamp(41px,calc(var(--app-vh)*0.084),67px)] mt-1" />
          </div>
        ) : finished ? (
          <div>
            <div className="font-sans font-900 text-[11px] uppercase tracking-widest opacity-80 leading-none">Full time</div>
            <ScoreLine home={match.home_score} away={match.away_score} className="text-[clamp(41px,calc(var(--app-vh)*0.084),67px)] mt-1" />
          </div>
        ) : state === 'open' ? (
          <div>
            <div className="font-sans font-700 text-[11px] uppercase tracking-wider opacity-70">
              {saving ? 'Saving…' : prediction ? 'Prediction saved · tap a score to change' : 'Tap a score to predict'}
            </div>
            <div className="font-sans font-700 text-[10px] uppercase tracking-wider opacity-50 mt-1">Tap here to see the detail</div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-sans font-700 uppercase tracking-wider opacity-70">
            <Lock size={11} /> Prediction locked · tap for details
          </div>
        )}
      </div>
    </motion.div>
  )
}
