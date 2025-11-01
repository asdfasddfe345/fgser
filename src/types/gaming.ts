export interface GamingCompany {
  id: string;
  name: string;
  logo_url: string;
  description: string;
  primary_color: string;
  secondary_color: string;
  difficulty_modifier: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface GameLevel {
  id: string;
  company_id: string;
  level_number: number;
  grid_size: number;
  time_limit_seconds: number;
  target_score: number;
  obstacle_density: number;
  is_active: boolean;
  created_at: string;
}

export interface UserGameProgress {
  id: string;
  user_id: string;
  company_id: string;
  level_id: string;
  is_unlocked: boolean;
  is_completed: boolean;
  best_score: number;
  best_time_seconds: number | null;
  attempts_count: number;
  first_completed_at: string | null;
  last_played_at: string;
  created_at: string;
  updated_at: string;
}

export interface GameScore {
  id: string;
  user_id: string;
  company_id: string;
  level_id: string;
  session_id: string;
  score: number;
  completion_time_seconds: number;
  path_length: number;
  optimal_path_length: number;
  efficiency_percentage: number;
  is_valid: boolean;
  completed_at: string;
  created_at: string;
}

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  company_id: string | null;
  level_id: string | null;
  total_score: number;
  rank: number;
  percentile: number;
  period: 'all_time' | 'monthly' | 'weekly';
  period_start: string | null;
  period_end: string | null;
  updated_at: string;
  created_at: string;
  user_name?: string;
}

export interface GameSession {
  id: string;
  user_id: string;
  level_id: string;
  session_token: string;
  grid_data: GridData;
  start_time: string;
  expected_end_time: string;
  actual_end_time: string | null;
  is_active: boolean;
  is_validated: boolean;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface GridData {
  grid: CellType[][];
  start: Position;
  end: Position;
  obstacles: Position[];
  optimalPathLength: number;
}

export interface Position {
  row: number;
  col: number;
}

export type CellType = 'empty' | 'start' | 'end' | 'obstacle' | 'path' | 'current';

export interface GameState {
  status: 'idle' | 'ready' | 'playing' | 'paused' | 'completed' | 'failed';
  currentPath: Position[];
  timeRemaining: number;
  score: number;
  isPathValid: boolean;
}

export interface CompanyWithProgress {
  company: GamingCompany;
  levels: LevelWithProgress[];
  totalScore: number;
  completedLevels: number;
  totalLevels: number;
}

export interface LevelWithProgress {
  level: GameLevel;
  progress: UserGameProgress | null;
}

export interface ScoreCalculation {
  baseScore: number;
  timeBonus: number;
  efficiencyBonus: number;
  difficultyMultiplier: number;
  finalScore: number;
  efficiency: number;
}
