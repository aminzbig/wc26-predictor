export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'

export interface Team { code: string; name: string }
export interface Player {
  id: string; name: string; slug: string; flag_code: string | null
  is_admin: boolean; legacy_points: number
}
export interface Match {
  id: string; match_no: number | null; stage: Stage; group_label: string | null
  home_code: string | null; away_code: string | null
  home_label: string | null; away_label: string | null
  kickoff_at: string; home_score: number | null; away_score: number | null
  multiplier: number; status: 'scheduled' | 'finished'
  prob_home: number | null; prob_draw: number | null; prob_away: number | null
  live_home?: number | null; live_away?: number | null; live_minute?: number | null; live_status?: string | null
  prediction?: { winner: string | null; comment: string | null; advice: string | null; percent: { home: string; draw: string; away: string } | null; goals: { home: number | null; away: number | null } | null } | null
  home_form?: { result: 'W' | 'D' | 'L'; score: string; opp: string; date?: string; comp?: string }[] | null
  away_form?: { result: 'W' | 'D' | 'L'; score: string; opp: string; date?: string; comp?: string }[] | null
  home_lineup?: Lineup | null
  away_lineup?: Lineup | null
  home_squad?: SquadPlayer[] | null
  away_squad?: SquadPlayer[] | null
}
export interface SquadPlayer { id: number; name: string; age: number | null; number: number | null; position: string; photo: string }
export interface LineupPlayer { id?: number; name: string; number: number | null; pos: string | null; grid: string | null; current_team?: string | null; prev_team?: string | null }
export interface Lineup { formation: string | null; coach: string | null; startXI: LineupPlayer[] }
export interface Prediction {
  id: string; player_id: string; match_id: string
  home_pred: number; away_pred: number; points_awarded: number | null
}
export interface LeaderRow {
  id: string; name: string; flag_code: string | null
  total: number; exact_hits: number; diff_hits: number
}
