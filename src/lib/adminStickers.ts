export type Sticker = { delta: 10 | -10; variant: 'holo' | 'bad' }

// Each row in admin_points is a +/-10 sticker. Map deltas to display stickers,
// preserving order. Null/empty → no stickers.
export function adminStickers(deltas: number[] | null | undefined): Sticker[] {
  if (!deltas) return []
  return deltas.map(d =>
    d > 0 ? { delta: 10 as const, variant: 'holo' as const }
          : { delta: -10 as const, variant: 'bad' as const })
}
