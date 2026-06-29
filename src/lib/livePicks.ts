import { projectedPoints, projectedPointsKnockout } from './scoring'

// Annotate each pick with its live projection, then sort (proj desc, name asc) and
// apply dense competition ranking (equal proj share a place; rank = 1 + how many
// picks project strictly higher). Pure — recomputed on each live-score render.
// In knockout rounds the result point follows the projected advancer (who leads now),
// so a level pick backing a team on penalties already projects its +10 — pass
// `knockout` and each row's `winner_side` for that path.
export function rankLivePicks<T extends { home_pred: number; away_pred: number; name: string; winner_side?: 'home' | 'away' | null }>(
  rows: T[],
  live: { home: number; away: number },
  multiplier = 1,
  applyFarOff = false,
  knockout = false,
): Array<T & { proj: number; rank: number }> {
  const withProj = rows.map(r => ({
    ...r,
    proj: knockout
      ? projectedPointsKnockout({ hp: r.home_pred, ap: r.away_pred, winnerSide: r.winner_side ?? null }, { hs: live.home, as: live.away }, multiplier, 1, applyFarOff)
      : projectedPoints({ hp: r.home_pred, ap: r.away_pred }, { hs: live.home, as: live.away }, multiplier, 1, applyFarOff),
  }))
  const sorted = [...withProj].sort((a, b) => b.proj - a.proj || a.name.localeCompare(b.name))
  return sorted.map(r => ({ ...r, rank: withProj.filter(x => x.proj > r.proj).length + 1 }))
}
