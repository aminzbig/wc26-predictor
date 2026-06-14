import type { Match } from './types'
export type MatchUiState = 'open' | 'locked' | 'finished'

export function matchState(m: Match, now: Date = new Date()): MatchUiState {
  if (m.status === 'finished') return 'finished'
  return new Date(m.kickoff_at) > now ? 'open' : 'locked'
}
