export type Points = { exact: number; diff: number; outcome: number }
type Pred = { hp: number; ap: number }
type Result = { hs: number; as: number }

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0)

export function basePoints(p: Pred, r: Result, pts: Points): number {
  if (p.hp === r.hs && p.ap === r.as) return pts.exact
  const sameGd = p.hp - p.ap === r.hs - r.as
  const atLeastOneHigher = r.hs >= p.hp || r.as >= p.ap
  if (sameGd && atLeastOneHigher) return pts.diff
  if (sign(p.hp - p.ap) === sign(r.hs - r.as)) return pts.outcome
  return 0
}
