// FIFA World Cup 2026 Match Predictor scoring — ADDITIVE (sum every component
// that applies). Mirrors recompute_match() in migration 0023 (the source of truth).
// `risky` depends on the whole field's prediction distribution, so it's computed
// server-side and passed in (default false for a standalone preview).
export type FifaPoints = {
  outcome: number; goalsHome: number; goalsAway: number; goalDiff: number; scoreBonus: number; risky: number
}
type Pred = { hp: number; ap: number }
type Result = { hs: number; as: number }

export const FIFA_POINTS: FifaPoints = { outcome: 10, goalsHome: 5, goalsAway: 5, goalDiff: 5, scoreBonus: 5, risky: 10 }

// "Way-off" rule: a prediction whose total goal error is >= FAR_OFF_THRESHOLD scores
// 0 for the whole match. Applies only to matches kicking off on/after FAR_OFF_RULE_FROM
// (going-forward only; earlier matches keep their original scores). The SQL guard in
// migration 0023 uses the identical threshold and timestamp — keep them in sync.
export const FAR_OFF_THRESHOLD = 5
export const FAR_OFF_RULE_FROM = '2026-06-24T00:00:00Z'

export function isFarOff(p: Pred, r: Result): boolean {
  return Math.abs(p.hp - r.hs) + Math.abs(p.ap - r.as) >= FAR_OFF_THRESHOLD
}

// ISO-8601 UTC ('...Z') timestamps compare correctly as strings.
export function farOffApplies(kickoffAtISO: string): boolean {
  return kickoffAtISO >= FAR_OFF_RULE_FROM
}

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0)

export function basePoints(
  p: Pred,
  r: Result,
  pts: FifaPoints = FIFA_POINTS,
  risky = false,
  applyFarOff = false,
): number {
  if (applyFarOff && isFarOff(p, r)) return 0
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
  applyFarOff = false,
): number {
  return Math.round(basePoints(p, r, FIFA_POINTS, false, applyFarOff) * multiplier * boost)
}
