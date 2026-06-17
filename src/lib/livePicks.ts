import { projectedPoints } from './scoring'

// Annotate each pick with its live projection, then sort (proj desc, name asc) and
// apply dense competition ranking (equal proj share a place; rank = 1 + how many
// picks project strictly higher). Pure — recomputed on each live-score render.
export function rankLivePicks<T extends { home_pred: number; away_pred: number; name: string }>(
  rows: T[],
  live: { home: number; away: number },
  multiplier = 1,
): Array<T & { proj: number; rank: number }> {
  const withProj = rows.map(r => ({
    ...r,
    proj: projectedPoints({ hp: r.home_pred, ap: r.away_pred }, { hs: live.home, as: live.away }, multiplier),
  }))
  const sorted = [...withProj].sort((a, b) => b.proj - a.proj || a.name.localeCompare(b.name))
  return sorted.map(r => ({ ...r, rank: withProj.filter(x => x.proj > r.proj).length + 1 }))
}
