export type Points = { exact: number; diff: number; outcome: number }
type Pred = { hp: number; ap: number }
type Result = { hs: number; as: number }

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0)

// Mirrors the DB score_match() function exactly (the source of truth):
// exact score > correct goal difference > correct outcome > wrong.
export function basePoints(p: Pred, r: Result, pts: Points): number {
  if (p.hp === r.hs && p.ap === r.as) return pts.exact
  if (p.hp - p.ap === r.hs - r.as) return pts.diff
  if (sign(p.hp - p.ap) === sign(r.hs - r.as)) return pts.outcome
  return 0
}
