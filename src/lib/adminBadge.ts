export type AdminBadge = { label: string; variant: 'holo' | 'bad' }

// Each admin unit is worth 10 points. 0 → no sticker.
export function adminBadge(units: number): AdminBadge | null {
  if (!units) return null
  const value = units * 10
  const label = `${value > 0 ? '+' : ''}${value} admin`
  return { label, variant: value > 0 ? 'holo' : 'bad' }
}
