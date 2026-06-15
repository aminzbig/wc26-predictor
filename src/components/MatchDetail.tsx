import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lock } from 'lucide-react'
import type { Match, Prediction, Lineup, SquadPlayer } from '../lib/types'
import { matchState } from '../lib/matchState'
import { Flag } from './Flag'

function shortLabel(label: string | null, fallback: string) {
  return (label ?? fallback).slice(0, 3).toUpperCase()
}

function pctInt(s: string | null | undefined): number {
  if (!s) return 0
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : 0
}

function PredictionBlock({ match }: { match: Match }) {
  const p = match.prediction
  if (!p) return null
  const hasAdvice = p.advice && p.advice !== 'No predictions available'
  if (!p.winner && !hasAdvice) return null

  const h3 = shortLabel(match.home_label, 'Home')
  const a3 = shortLabel(match.away_label, 'Away')
  const home = pctInt(p.percent?.home)
  const draw = pctInt(p.percent?.draw)
  const away = pctInt(p.percent?.away)
  const showBar = p.percent != null && (home + draw + away) > 0
  const showGoals = p.goals != null && p.goals.home != null && p.goals.away != null

  return (
    <div className="mt-4 border-[3px] border-ink bg-paper text-ink p-2.5">
      <div className="font-display text-[18px] uppercase tracking-wide leading-none mb-2">Prediction</div>
      {hasAdvice && (
        <div className="text-[12px] font-sans font-900 uppercase tracking-wider mb-2">{p.advice}</div>
      )}
      {showBar && (
        <>
          <div className="flex justify-between text-[11px] font-sans font-900 uppercase tracking-wider mb-1.5">
            <span>{h3} {home}%</span><span>Draw {draw}%</span><span>{a3} {away}%</span>
          </div>
          <div className="flex h-4 border-2 border-ink">
            <div className="bg-ink" style={{ width: `${home}%` }} />
            <div className="bg-ink/40" style={{ width: `${draw}%` }} />
            <div className="bg-ink/70" style={{ width: `${away}%` }} />
          </div>
        </>
      )}
      {showGoals && (
        <div className="mt-2 text-[12px] font-sans font-900 uppercase tracking-widest">
          Likely score: {p.goals!.home}–{p.goals!.away}
        </div>
      )}
    </div>
  )
}

const FORM_BADGE: Record<'W' | 'D' | 'L', string> = {
  W: 'bg-green text-paper',
  D: 'bg-yellow text-ink',
  L: 'bg-red text-paper',
}

type FormItem = { result: 'W' | 'D' | 'L'; score: string; opp: string; date?: string; comp?: string }

function FormTeamRow({ label, fallback, form }: {
  label: string | null; fallback: string; form: FormItem[]
}) {
  const [open, setOpen] = useState<number | null>(null)
  if (!form || form.length === 0) return null
  const shown = form.slice(0, 5)
  return (
    <div className="mb-1.5 last:mb-0">
      <div className="flex items-center gap-2">
        <div className="font-display text-[14px] uppercase tracking-wide w-12 flex-none">{shortLabel(label, fallback)}</div>
        <div className="flex gap-1">
          {shown.map((f, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              title={`${f.result} ${f.score} vs ${f.opp}`}
              className={`w-[22px] h-[22px] grid place-items-center font-display text-[12px] leading-none border-2 border-ink ${FORM_BADGE[f.result]}`}
            >
              {f.result}
            </button>
          ))}
        </div>
      </div>
      {open != null && shown[open] && (
        <div className="mt-1.5 bg-paper border-[3px] border-ink p-2 flex items-center gap-2 text-ink">
          <div className={`w-[34px] h-[34px] grid place-items-center font-display text-[16px] leading-none border-2 border-ink flex-none ${FORM_BADGE[shown[open].result]}`}>
            {shown[open].result}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[14px] uppercase leading-none truncate">
              vs {shown[open].opp} · {shown[open].score.replace('-', '–')}
            </div>
            <div className="text-[10px] font-sans font-700 uppercase tracking-wider opacity-80 truncate">
              {[shown[open].date ? new Date(shown[open].date!).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null, shown[open].comp].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button type="button" onClick={() => setOpen(null)} aria-label="Close"
            className="w-[24px] h-[24px] grid place-items-center bg-ink text-paper flex-none">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

function FormSection({ match }: { match: Match }) {
  const hf = match.home_form ?? []
  const af = match.away_form ?? []
  if (hf.length === 0 && af.length === 0) return null
  return (
    <div className="mt-4 border-[3px] border-ink bg-paper text-ink p-2.5">
      <div className="font-display text-[18px] uppercase tracking-wide leading-none mb-2">Form</div>
      <FormTeamRow label={match.home_label} fallback="Home" form={hf} />
      <FormTeamRow label={match.away_label} fallback="Away" form={af} />
    </div>
  )
}

const POS_WORD: Record<string, string> = { G: 'Goalkeeper', D: 'Defender', M: 'Midfielder', F: 'Forward' }

function expandPos(pos: string | null): string {
  if (!pos) return ''
  return POS_WORD[pos.toUpperCase()] ?? pos
}

type PlayerInfo = {
  key: string; id: number | null; name: string; number: number | null; position: string
  photo: string | null; age: number | null; current: string | null; prev: string | null
}

function FormationPitch({ label, fallback, lineup, squad }: {
  label: string | null; fallback: string; lineup: Lineup; squad?: SquadPlayer[] | null
}) {
  const [open, setOpen] = useState<PlayerInfo | null>(null)
  if (!lineup || !lineup.startXI || lineup.startXI.length === 0) return null

  const placed = lineup.startXI.filter(pl => pl.grid)
  const rows = new Map<number, typeof placed>()
  for (const pl of placed) {
    const row = parseInt(pl.grid!.split(':')[0], 10)
    if (!Number.isFinite(row)) continue
    if (!rows.has(row)) rows.set(row, [])
    rows.get(row)!.push(pl)
  }
  const rowNums = [...rows.keys()]
  const maxRow = rowNums.length ? Math.max(...rowNums) : 1

  const dots: { top: number; left: number; number: number | null; surname: string; key: string; info: PlayerInfo }[] = []
  for (const [row, players] of rows) {
    const topPct = 100 - (row / (maxRow + 1)) * 100
    const sorted = [...players].sort(
      (a, b) => parseInt(a.grid!.split(':')[1], 10) - parseInt(b.grid!.split(':')[1], 10),
    )
    sorted.forEach((pl, i) => {
      const leftPct = ((i + 1) / (sorted.length + 1)) * 100
      const parts = pl.name.trim().split(/\s+/)
      const sq = pl.id != null && squad ? squad.find(s => s.id === pl.id) : undefined
      const info: PlayerInfo = {
        key: `${row}-${i}-${pl.name}`,
        id: pl.id ?? null,
        name: sq?.name ?? pl.name,
        number: sq?.number ?? pl.number,
        position: sq?.position ?? expandPos(pl.pos),
        photo: sq?.photo ?? null,
        age: sq?.age ?? null,
        current: pl.current_team ?? null,
        prev: pl.prev_team ?? null,
      }
      dots.push({
        top: topPct, left: leftPct, number: pl.number,
        surname: parts[parts.length - 1] || pl.name,
        key: `${row}-${i}-${pl.name}`,
        info,
      })
    })
  }

  const headline = `${shortLabel(label, fallback)}${lineup.formation ? ` · ${lineup.formation}` : ''}`

  return (
    <div className="mt-3 first:mt-0">
      <div className="font-display text-[15px] uppercase tracking-wide leading-none">{headline}</div>
      {lineup.coach && (
        <div className="text-[10px] font-sans font-700 uppercase tracking-wider opacity-70 mb-1.5">Coach: {lineup.coach}</div>
      )}
      <div className="relative w-full bg-green border-[3px] border-ink overflow-hidden" style={{ aspectRatio: '3 / 4' }}>
        {/* center line */}
        <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-ink/40 -translate-y-1/2" />
        {/* center circle */}
        <div className="absolute left-1/2 top-1/2 w-[26%] aspect-square rounded-full border-2 border-ink/40 -translate-x-1/2 -translate-y-1/2" />

        {/* Player info popup pinned to top of the pitch */}
        {open && (
          <div className="absolute top-2 left-2 right-2 z-20 bg-paper border-[3px] border-ink p-2 flex items-center gap-2 text-ink">
            {open.photo && (
              <img src={open.photo} alt="" className="w-[44px] h-[44px] border-2 border-ink object-cover flex-none" />
            )}
            <div className="min-w-0 flex-1">
              <div className="font-display text-[16px] uppercase leading-none truncate">
                {open.number != null ? `${open.number} · ` : ''}{open.name}
              </div>
              <div className="text-[10px] font-sans font-700 uppercase tracking-wider opacity-80">
                {open.position}{open.age != null ? ` · AGE ${open.age}` : ''}
              </div>
              {open.current && (
                <div className="text-[9px] font-sans font-700 uppercase tracking-wider opacity-70 truncate">NOW: {open.current}</div>
              )}
              {open.prev && (
                <div className="text-[9px] font-sans font-700 uppercase tracking-wider opacity-70 truncate">PREV: {open.prev}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(null)}
              aria-label="Close"
              className="w-[24px] h-[24px] grid place-items-center bg-ink text-paper flex-none"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {dots.map(d => (
          <button
            key={d.key}
            type="button"
            onClick={() => setOpen(prev => (prev && prev.key === d.key ? null : d.info))}
            className="absolute flex flex-col items-center"
            style={{ top: `${d.top}%`, left: `${d.left}%`, transform: 'translate(-50%,-50%)' }}
          >
            <div className="w-[28px] h-[28px] rounded-full bg-paper border-2 border-ink grid place-items-center font-display text-[12px] leading-none text-ink">
              {d.number ?? ''}
            </div>
            <div className="mt-0.5 max-w-[52px] text-[8px] font-sans font-700 bg-ink/70 text-paper px-1 leading-tight truncate">
              {d.surname}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function LineupsSection({ match }: { match: Match }) {
  const hl = match.home_lineup
  const al = match.away_lineup
  const hasHome = !!hl && hl.startXI && hl.startXI.length > 0
  const hasAway = !!al && al.startXI && al.startXI.length > 0
  return (
    <div className="mt-4 border-[3px] border-ink bg-paper text-ink p-2.5">
      <div className="font-display text-[18px] uppercase tracking-wide leading-none mb-2">Lineups</div>
      {!hasHome && !hasAway ? (
        <div className="text-[11px] font-sans font-700 uppercase tracking-wider opacity-60">
          Lineups appear ~75 min before kickoff
        </div>
      ) : (
        <>
          {hasHome && <FormationPitch label={match.home_label} fallback="Home" lineup={hl!} squad={match.home_squad} />}
          {hasAway && <FormationPitch label={match.away_label} fallback="Away" lineup={al!} squad={match.away_squad} />}
        </>
      )}
    </div>
  )
}

const PANEL_COLORS = ['bg-orange', 'bg-green', 'bg-blue text-paper', 'bg-yellow', 'bg-red text-paper']
function panelColor(match_no: number) {
  return PANEL_COLORS[match_no % PANEL_COLORS.length]
}

const STAGE_LABEL: Record<string, string> = {
  group: 'Group', r32: 'Round of 32', r16: 'Round of 16',
  qf: 'Quarter-final', sf: 'Semi-final', third: 'Third place', final: 'Final',
}

function DScore({ v, set }: { v: number; set?: (n: number) => void }) {
  return (
    <input
      type="number" min={0} value={v} disabled={!set}
      onChange={e => set?.(Math.max(0, +e.target.value))}
      className={`w-[52px] h-[56px] text-center font-display text-[32px] border-[3px] border-ink bg-paper text-ink outline-none flex-none ${!set ? 'opacity-90' : ''}`}
    />
  )
}

function BigTeam({ code, label }: { code: string | null; label: string | null }) {
  return (
    <div className="flex items-center gap-2.5 flex-1 min-w-0">
      <Flag code={code} label={label} />
      <div className="font-display text-[26px] uppercase leading-none tracking-wide truncate">{label}</div>
    </div>
  )
}

export function MatchDetail({ match, prediction, onSave, onClose }: {
  match: Match
  prediction?: Prediction
  onSave: (h: number, a: number) => Promise<void>
  onClose: () => void
}) {
  const state = matchState(match)
  const editable = state === 'open'
  const [hp, setHp] = useState(prediction?.home_pred ?? 0)
  const [ap, setAp] = useState(prediction?.away_pred ?? 0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // keep the score in sync when the saved prediction changes (e.g. saved from the card)
  useEffect(() => {
    setHp(prediction?.home_pred ?? 0)
    setAp(prediction?.away_pred ?? 0)
  }, [prediction?.home_pred, prediction?.away_pred])

  const mult = match.multiplier ?? 1
  const stageText = match.group_label
    ? match.group_label
    : (STAGE_LABEL[match.stage] ?? match.stage.toUpperCase())
  const headerLine = `×${mult} · ${stageText}`.toUpperCase()

  const ph = match.prob_home, pd = match.prob_draw ?? 0, pa = match.prob_away ?? 0
  const showOdds = ph != null
  const h3 = (match.home_label ?? 'Home').slice(0, 3).toUpperCase()
  const a3 = (match.away_label ?? 'Away').slice(0, 3).toUpperCase()

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-ink/60"
          onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        />

        {/* Panel */}
        <motion.div
          initial={{ y: 60, scale: 0.92, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 60, scale: 0.92, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="relative w-full max-w-md max-h-[88vh] overflow-y-auto pb-28"
        >
          <div className={`${panelColor(match.match_no ?? 0)} border-[3px] border-ink p-4 m-3 relative`}>
            {/* Close */}
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute -top-2 -right-2 w-[40px] h-[40px] bg-ink text-paper grid place-items-center border-[3px] border-ink"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="text-[11px] font-sans font-900 uppercase tracking-widest mb-1">{headerLine}</div>
            <div className="text-[12px] font-sans font-700 uppercase tracking-wider mb-4 opacity-80">
              {new Date(match.kickoff_at).toLocaleString(undefined, {
                weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </div>

            {/* Teams + scores */}
            <div className="flex items-center gap-2 mb-3">
              <BigTeam code={match.home_code} label={match.home_label} />
              <DScore v={state === 'finished' ? match.home_score! : hp} set={editable ? setHp : undefined} />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <BigTeam code={match.away_code} label={match.away_label} />
              <DScore v={state === 'finished' ? match.away_score! : ap} set={editable ? setAp : undefined} />
            </div>

            {/* Save / status */}
            {state === 'open' && (
              <button
                disabled={saving}
                onClick={async () => { setSaving(true); try { await onSave(hp, ap); onClose() } finally { setSaving(false) } }}
                className="w-full mt-4 bg-ink text-paper font-display text-[15px] uppercase tracking-widest py-3 text-center disabled:opacity-50"
              >
                {prediction ? 'Update prediction' : 'Lock prediction'}
              </button>
            )}
            {state === 'locked' && (
              <div className="flex items-center gap-1.5 text-[12px] font-sans font-700 uppercase tracking-wider mt-4 opacity-80">
                <Lock size={13} /> Prediction locked
              </div>
            )}

            {/* Odds bar */}
            {showOdds && (
              <div className="mt-4 border-[3px] border-ink bg-paper text-ink p-2.5">
                <div className="text-[10px] font-sans font-900 uppercase tracking-widest mb-2">Bookmaker odds</div>
                <div className="flex justify-between text-[11px] font-sans font-900 uppercase tracking-wider mb-1.5">
                  <span>{h3} {ph}%</span><span>Draw {pd}%</span><span>{a3} {pa}%</span>
                </div>
                <div className="flex h-4 border-2 border-ink">
                  <div className="bg-ink" style={{ width: `${ph}%` }} />
                  <div className="bg-ink/40" style={{ width: `${pd}%` }} />
                  <div className="bg-ink/70" style={{ width: `${pa}%` }} />
                </div>
              </div>
            )}

            {/* Your prediction */}
            {prediction && (
              <div className="mt-4 text-[12px] font-sans font-900 uppercase tracking-widest">
                Your prediction: {prediction.home_pred} – {prediction.away_pred}
              </div>
            )}

            {/* Points earned */}
            {state === 'finished' && prediction?.points_awarded != null && (
              <div className="mt-2 inline-block bg-ink text-yellow font-display text-[16px] uppercase tracking-wide px-3 py-1.5">
                +{prediction.points_awarded} points
              </div>
            )}

            {/* API-Football: prediction, form, lineups */}
            <PredictionBlock match={match} />
            <FormSection match={match} />
            <LineupsSection match={match} />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
