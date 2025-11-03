import type { ArrowDirection } from '../helpers/direction';

export type TilePatternType = 'straight' | 'corner' | 't_junction' | 'cross' | 'end';
export type TileRotation = 0 | 90 | 180 | 270;

export interface ConnectionPoints {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

export interface TilePattern {
  id: string;
  pattern_name: string;
  pattern_type: TilePatternType;
  arrow_directions: ArrowDirection[]; // canonical at rotation 0
  connection_points: ConnectionPoints; // (optional backup; can mirror arrow_directions)
  difficulty_level: number;
  is_active: boolean;
  created_at: string;
}

export interface GridTile {
  row: number;
  col: number;
  pattern: TilePattern;
  rotation: TileRotation;
  isStart?: boolean;
  isEnd?: boolean;
  isSelected?: boolean;
  isInPath?: boolean;
}

export interface GridConfig {
  tiles: GridTile[][];
  gridSize: number;
  startPosition: { row: number; col: number };
  endPosition: { row: number; col: number };
  optimalMoves: number;
}

export interface PathFinderSession {
  id: string;
  user_id: string;
  level_id: string;
  session_token: string;
  grid_config: GridConfig;
  start_time: string;
  end_time?: string;
  time_remaining_seconds: number;
  total_moves: number;
  rotation_count: number;
  flip_count: number;
  is_practice_mode: boolean;
  is_completed: boolean;
  is_valid: boolean;
  final_score: number;
  created_at: string;
}

export interface MoveHistory {
  id: string;
  session_id: string;
  move_number: number;
  tile_position: { row: number; col: number };
  action_type: 'rotate' | 'flip';
  previous_rotation: TileRotation;
  new_rotation: TileRotation;
  timestamp: string;
}

export interface PathFinderLeaderboardEntry {
  id: string;
  user_id: string;
  level_id?: string;
  best_time_seconds?: number;
  fewest_moves?: number;
  highest_score: number;
  completion_count: number;
  efficiency_rating: number;
  rank?: number;
  period: 'daily' | 'weekly' | 'all_time';
  updated_at: string;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export interface GameState {
  status: 'idle' | 'ready' | 'playing' | 'paused' | 'completed' | 'failed';
  selectedTile: { row: number; col: number } | null;
  timeRemaining: number;
  totalMoves: number;
  rotationCount: number;
  flipCount: number;
  currentScore: number;
  isPathValid: boolean;
}

export interface PathValidationResult {
  isValid: boolean;
  pathTiles: { row: number; col: number }[];
  message?: string;
}

export interface ScoreCalculation {
  baseScore: number;
  timeBonus: number;
  movePenalty: number;
  finalScore: number;
  efficiency: number;
}

// Game level (your existing type)
export interface GameLevel {
  id: string;
  level_number: number;
  grid_size: number;
  target_score: number;
}
