// FIFA World Cup 2026 Match Predictor scoring — ADDITIVE (sum every component
// that applies). Mirrors recompute_match() in migration 0013 (the source of truth).
// `risky` depends on the whole field's prediction distribution, so it's computed
// server-side and passed in (default false for a standalone preview).
export type FifaPoints = {
  outcome: number; goalsHome: number; goalsAway: number; goalDiff: number; scoreBonus: number; risky: number
}
type Pred = { hp: number; ap: number }
type Result = { hs: number; as: number }

export const FIFA_POINTS: FifaPoints = { outcome: 10, goalsHome: 5, goalsAway: 5, goalDiff: 5, scoreBonus: 5, risky: 10 }

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0)

export function basePoints(p: Pred, r: Result, pts: FifaPoints = FIFA_POINTS, risky = false): number {
  const outcomeHit = sign(p.hp - p.ap) === sign(r.hs - r.as)
  return (outcomeHit ? pts.outcome : 0)
    + (p.hp === r.hs ? pts.goalsHome : 0)
    + (p.ap === r.as ? pts.goalsAway : 0)
    + (p.hp - p.ap === r.hs - r.as ? pts.goalDiff : 0)
    + (p.hp === r.hs && p.ap === r.as ? pts.scoreBonus : 0)
    + (risky && outcomeHit && sign(r.hs - r.as) !== 0 ? pts.risky : 0)
}

// Live projection: what a pick would score if the match ended at result `r` right now.
// risky is intentionally omitted — it depends on the whole field's prediction distribution, so it's computed
// server-side at Full-Time. Multiplied and rounded to match the final figure.
export function projectedPoints(
  p: { hp: number; ap: number },
  r: { hs: number; as: number },
  multiplier = 1,
  boost = 1,
): number {
  return Math.round(basePoints(p, r) * multiplier * boost)
}
