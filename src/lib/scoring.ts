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
