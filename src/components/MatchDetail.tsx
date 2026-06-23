import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lock } from 'lucide-react'
import type { Match, Prediction, Lineup, SquadPlayer, WcRunGame } from '../lib/types'
import { matchState } from '../lib/matchState'
import { supabase } from '../lib/supabase'
import { rankLivePicks } from '../lib/livePicks'
import { farOffApplies, isFarOff } from '../lib/scoring'
import { GameInfo, FlagPanel, TeamNameBar, PointsStar, ScoreLine } from './matchFace'
import { Avatar } from './Avatar'

type PeoplePick = { id: string; name: string; flag_code: string | null; avatar_url: string | null; home_pred: number; away_pred: number; points: number | null }

// How close a pick landed vs. the final score — mirrors the tiers in lib/scoring.ts.
type Tier = 'exact' | 'diff' | 'outcome' | 'miss' | 'faroff'
const sgn = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0)
function resultTier(hp: number, ap: number, hs: number, as: number, applyFarOff = false): Tier {
  if (applyFarOff && isFarOff({ hp, ap }, { hs, as })) return 'faroff'
  if (hp === hs && ap === as) return 'exact'
  if (hp - ap === hs - as) return 'diff'
  if (sgn(hp - ap) === sgn(hs - as)) return 'outcome'
  return 'miss'
}
const TIER: Record<Tier, { label: string; cls: string }> = {
  exact:   { label: 'Exact score', cls: 'text-green' },
  diff:    { label: 'Goal diff',   cls: 'text-blue' },
  outcome: { label: 'Outcome',     cls: 'text-orange' },
  miss:    { label: 'Missed',      cls: 'text-ink/40' },
  faroff:  { label: 'Too far off', cls: 'text-red' },
}

// Everyone's predictions for a match — only readable once it's locked/finished
// (enforced by RLS). Once the match is scored this becomes a ranked leaderboard:
// sorted by points, the leader gets the starburst, every pick gets a result tag.
function PeoplePredictions({ match }: { match: Match }) {
  const [rows, setRows] = useState<PeoplePick[]>([])
  useEffect(() => {
    let active = true
    supabase.from('predictions')
      .select('id,home_pred,away_pred,points_awarded, players(name,flag_code,avatar_url)')
      .eq('match_id', match.id)
      .then(({ data }) => {
        if (!active) return
        const list: PeoplePick[] = (data ?? []).map((r: any) => ({
          id: r.id, name: r.players?.name ?? '?', flag_code: r.players?.flag_code ?? null,
          avatar_url: r.players?.avatar_url ?? null,
          home_pred: r.home_pred, away_pred: r.away_pred, points: r.points_awarded,
        }))
        list.sort((a, b) => (b.points ?? -1) - (a.points ?? -1) || a.name.localeCompare(b.name))
        setRows(list)
      })
    return () => { active = false }
  }, [match.id, match.status, match.home_score])
  if (rows.length === 0) return null
  return <PicksBoard rows={rows} match={match} />
}

// Live projected-points badge: outlined (provisional), and emits a one-shot halo
// pulse whenever the projection changes — so a goal visibly ripples through the row.
function HaloPoints({ value }: { value: number }) {
  const prev = useRef(value)
  const [pulse, setPulse] = useState(false)
  useEffect(() => {
    if (prev.current === value) return
    prev.current = value
    setPulse(true)
    const t = setTimeout(() => setPulse(false), 900)
    return () => clearTimeout(t)
  }, [value])
  return (
    <div className={`flex-none grid place-items-center w-[50px] h-[40px] border-2 border-ink/50 bg-paper ${pulse ? 'halo-pulse' : ''}`}>
      <div className="font-display text-[22px] leading-none text-ink/50">{value}</div>
      <div className="mt-0.5 font-sans font-900 text-[6px] uppercase tracking-[0.2em] leading-none text-ink/50">proj</div>
    </div>
  )
}

// Presentational leaderboard — kept separate from the fetch so it can be rendered
// in isolation. `rows` is expected pre-sorted by points desc, then name.
function PicksBoard({ rows, match }: { rows: PeoplePick[]; match: Match }) {
  const scored = match.status === 'finished' && match.home_score != null && match.away_score != null
  const live = !scored && match.live_status != null && match.live_home != null && match.live_away != null
  const hs = match.home_score ?? 0, as = match.away_score ?? 0
  const lh = match.live_home ?? 0, la = match.live_away ?? 0
  const topPoints = scored ? Math.max(0, ...rows.map(r => r.points ?? 0)) : 0
  const applyFarOff = farOffApplies(match.kickoff_at)

  // LIVE: rank by projected points from the current live score.
  // FINISHED / pre-kickoff: existing behavior (rank by awarded points, or none).
  const ranked = live
    ? rankLivePicks(rows, { home: lh, away: la }, match.multiplier ?? 1, applyFarOff).map(r => ({
        ...r, points: r.proj, tier: resultTier(r.home_pred, r.away_pred, lh, la, applyFarOff),
      }))
    : rows.map((r) => {
        const pts = r.points ?? 0
        const rank = rows.filter(x => (x.points ?? 0) > pts).length + 1
        return { ...r, rank, tier: scored ? resultTier(r.home_pred, r.away_pred, hs, as, applyFarOff) : null }
      })

  return (
    <div className="mt-4 border-[3px] border-ink bg-paper text-ink">
      {/* Inverted header bar — poster-style boxed label */}
      <div className="flex items-stretch justify-between bg-ink text-paper">
        <div className="font-display text-[18px] uppercase tracking-wide leading-none px-2.5 py-2">Everyone's picks</div>
        <div className="self-center px-2.5 font-sans font-900 text-[10px] uppercase tracking-widest text-yellow">
          {scored ? `Final · ${rows.length}` : live ? `Live · ${match.live_minute ?? 0}′ · projected` : `Locked · ${rows.length}`}
        </div>
      </div>

      <div className="p-1.5">
        {ranked.map((r, i) => {
          const pts = r.points ?? 0
          const isTop = scored && pts > 0 && pts === topPoints
          return (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                layout: { type: 'spring', stiffness: 380, damping: 30 },
                delay: Math.min(i * 0.04, 0.4), type: 'spring', stiffness: 320, damping: 26,
              }}
              className={`flex items-center gap-2 px-1.5 py-1.5 border-t-2 border-ink/10 first:border-t-0 ${isTop ? 'bg-yellow border-t-yellow' : ''} ${live ? 'halo-live' : ''}`}
            >
              {/* Rank — leader wears the starburst, the rest a plain numeral */}
              {(scored || live) && (
                (scored && isTop) ? (
                  <div className="star-badge flex-none w-[32px] h-[32px] grid place-items-center bg-ink text-yellow font-display text-[15px] leading-none">{r.rank}</div>
                ) : (
                  <div className="flex-none w-[32px] text-center font-display text-[22px] leading-none text-ink/55">{r.rank}</div>
                )
              )}

              <Avatar url={r.avatar_url} code={r.flag_code} label={r.name} size="md" />

              <div className="min-w-0 flex-1">
                <div className="font-display text-[15px] uppercase truncate leading-none">{r.name}</div>
                {(scored || live) && r.tier && (
                  <div className="mt-1 text-[9px] font-sans font-900 uppercase tracking-widest leading-none">
                    {/* live shows the predicted score beside the square instead, so omit it here */}
                    {scored && <span className="opacity-60">{r.home_pred}–{r.away_pred}</span>}
                    <span className={`${scored ? 'ml-1.5' : ''} ${isTop ? (r.tier === 'miss' ? 'text-ink/40' : 'text-ink') : TIER[r.tier].cls}`}>{scored ? '· ' : ''}{TIER[r.tier].label}</span>
                  </div>
                )}
              </div>

              {scored ? (
                /* The hero figure — big inverted points block */
                <div className={`flex-none grid place-items-center w-[50px] h-[40px] border-2 border-ink ${pts > 0 ? 'bg-ink' : 'bg-transparent'}`}>
                  <div className={`font-display text-[22px] leading-none ${pts > 0 ? (isTop ? 'text-yellow' : 'text-paper') : 'text-ink/40'}`}>{pts}</div>
                  <div className={`mt-0.5 font-sans font-900 text-[6px] uppercase tracking-[0.2em] leading-none ${pts > 0 ? (isTop ? 'text-yellow/70' : 'text-paper/60') : 'text-ink/30'}`}>pts</div>
                </div>
              ) : live ? (
                /* predicted score sits to the LEFT of the projected square for readability */
                <div className="flex items-center gap-2 flex-none">
                  <div className="grid place-items-center h-[40px]">
                    <div className="font-display text-[18px] leading-none text-ink">{r.home_pred}–{r.away_pred}</div>
                    <div className="mt-0.5 font-sans font-900 text-[6px] uppercase tracking-[0.2em] leading-none text-ink/40">pick</div>
                  </div>
                  <HaloPoints value={pts} />
                </div>
              ) : (
                <div className="font-display text-[16px] leading-none">{r.home_pred}–{r.away_pred}</div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

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

// One team's run in this World Cup: a row of tappable score chips (W/D/L coloured);
// tapping one reveals that game's possession / shots-on-target / corners.
function WcRunTeamRow({ label, fallback, run }: { label: string | null; fallback: string; run: WcRunGame[] }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!run || run.length === 0) return null
  const g = open != null ? run[open] : null
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center gap-2">
        <div className="font-display text-[14px] uppercase tracking-wide w-12 flex-none">{shortLabel(label, fallback)}</div>
        <div className="flex gap-1.5 flex-wrap">
          {run.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              title={`${x.gf}-${x.ga} vs ${x.opp}`}
              className={`w-[46px] h-[24px] grid place-items-center font-display text-[12px] leading-none border-2 border-ink ${FORM_BADGE[x.result]}`}
            >
              {x.gf}–{x.ga}
            </button>
          ))}
        </div>
      </div>
      {g && (
        <div className="mt-1.5 bg-paper border-[3px] border-ink p-2 text-ink">
          <div className="font-display text-[13px] uppercase leading-none mb-2 truncate">
            {g.result === 'W' ? 'Beat' : g.result === 'L' ? 'Lost to' : 'Drew'} {g.opp} · {g.gf}–{g.ga}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {([['Possession', g.poss], ['Shots on target', g.sot], ['Corners', g.cor]] as const).map(([l, v]) => (
              <div key={l} className="border-2 border-ink p-1.5 text-center">
                <div className="font-display text-[18px] leading-none">{v ?? '—'}</div>
                <div className="mt-1 text-[8px] font-sans font-900 uppercase tracking-wider opacity-70 leading-none">{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function WorldCupRun({ match }: { match: Match }) {
  const hr = match.home_wc_run ?? []
  const ar = match.away_wc_run ?? []
  if (hr.length === 0 && ar.length === 0) return null
  return (
    <div className="mt-4 border-[3px] border-ink bg-paper text-ink p-2.5">
      <div className="font-display text-[18px] uppercase tracking-wide leading-none mb-2">World Cup run</div>
      <WcRunTeamRow label={match.home_label} fallback="Home" run={hr} />
      <WcRunTeamRow label={match.away_label} fallback="Away" run={ar} />
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

export function MatchDetail({ match, prediction, onSave, onClose }: {
  match: Match
  prediction?: Prediction
  onSave: (h: number, a: number) => Promise<void>
  onClose: () => void
}) {
  const state = matchState(match)
  const editable = state === 'open'
  const live = state === 'locked' && match.live_home != null // in progress with a known score
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

  // Auto-save: debounce edits and persist them — no explicit "Update prediction" button.
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

  const mult = match.multiplier ?? 1
  const finished = state === 'finished'
  // Giant flag numbers are the player's prediction; real/live score sits in the banner.
  const homeNum = editable ? hp : (prediction?.home_pred ?? null)
  const awayNum = editable ? ap : (prediction?.away_pred ?? null)
  const points = finished ? prediction?.points_awarded ?? null : null

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
          className="relative w-full max-w-md max-h-[calc(var(--app-vh)*0.88)] overflow-y-auto pb-28"
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

            {/* Header: game info (group · date · stadium · city) + multiplier + status / winners */}
            <div className="flex items-start justify-between gap-2 mb-3 pr-9">
              <GameInfo match={match} big />
              <div className="flex-none flex flex-col items-end gap-1.5">
                {mult > 1 && <span className="font-display text-[14px] leading-none bg-ink text-yellow px-1.5 py-1">×{mult}</span>}
                <span className="font-sans font-900 text-[10px] uppercase tracking-widest flex items-center gap-1">
                  {state === 'open' && '★ OPEN'}
                  {state === 'locked' && (live
                    ? <>● LIVE{match.live_minute ? ` ${match.live_minute}'` : ''}</>
                    : <><Lock size={10} />LOCKED</>)}
                  {finished && 'FT'}
                </span>
              </div>
            </div>

            {/* Flags + giant prediction numbers + rainbow points star */}
            <div className="relative flex items-stretch gap-2 h-[clamp(200px,calc(var(--app-vh)*0.34),280px)]">
              <FlagPanel code={match.home_code} label={match.home_label} value={homeNum} editable={editable} onChange={setHp} />
              <FlagPanel code={match.away_code} label={match.away_label} value={awayNum} editable={editable} onChange={setAp} />
              {points != null && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] aspect-square z-10">
                  <PointsStar points={points} multiplier={match.multiplier} />
                </div>
              )}
            </div>

            {/* Team names */}
            <div className="mt-2">
              <TeamNameBar home={match.home_label} away={match.away_label} full divider={panelColor(match.match_no ?? 0).split(' ')[0]} />
            </div>

            {/* Live / Full-time score — on the card background (no boxed banner) */}
            {live && (
              <div className="mt-2 text-center">
                <div className="font-sans font-900 text-[10px] uppercase tracking-widest leading-none">
                  <span className="live-dot">●</span> Live{match.live_minute ? ` ${match.live_minute}'` : ''}
                </div>
                <ScoreLine home={match.live_home} away={match.live_away} className="text-[48px] mt-1" />
              </div>
            )}
            {finished && (
              <div className="mt-2 text-center">
                <div className="font-sans font-900 text-[10px] uppercase tracking-widest opacity-80 leading-none">Full time</div>
                <ScoreLine home={match.home_score} away={match.away_score} className="text-[48px] mt-1" />
              </div>
            )}

            {/* Auto-save status (open) / locked hint */}
            {state === 'open' && (
              <div className="mt-3 text-[12px] font-sans font-700 uppercase tracking-wider opacity-80 text-center">
                {saving ? 'Saving…' : prediction ? 'Prediction saved — tap a score to change' : 'Tap a score to predict'}
              </div>
            )}
            {state === 'locked' && !live && (
              <div className="flex items-center gap-1.5 text-[12px] font-sans font-700 uppercase tracking-wider mt-3 opacity-80">
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

            {/* Your prediction — full team names so the abbreviations in the card
                bar are spelled out here. */}
            {prediction && (
              <div className="mt-4">
                <div className="text-[11px] font-sans font-900 uppercase tracking-widest opacity-70">Your prediction</div>
                <div className="mt-1 font-display text-[18px] uppercase tracking-wide leading-tight">
                  {match.home_label ?? 'Home'} {prediction.home_pred} <span className="opacity-40">–</span> {prediction.away_pred} {match.away_label ?? 'Away'}
                </div>
              </div>
            )}

            {/* Points earned */}
            {state === 'finished' && prediction?.points_awarded != null && (
              farOffApplies(match.kickoff_at)
                && isFarOff(
                  { hp: prediction.home_pred, ap: prediction.away_pred },
                  { hs: match.home_score ?? 0, as: match.away_score ?? 0 },
                ) ? (
                <div className="mt-2 inline-block bg-ink text-red font-display text-[16px] uppercase tracking-wide px-3 py-1.5">
                  Too far off — 0 pts
                </div>
              ) : (
                <div className="mt-2 inline-block bg-ink text-yellow font-display text-[16px] uppercase tracking-wide px-3 py-1.5">
                  +{prediction.points_awarded} points
                </div>
              )
            )}

            {/* Everyone's picks — revealed once the match locks at kickoff (state !== 'open') */}
            {state !== 'open' && <PeoplePredictions match={match} />}

            {/* API-Football: prediction, World Cup run, form, lineups */}
            <PredictionBlock match={match} />
            <WorldCupRun match={match} />
            <FormSection match={match} />
            <LineupsSection match={match} />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
