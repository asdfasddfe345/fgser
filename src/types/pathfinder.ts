export type ArrowDirection = 'up' | 'down' | 'left' | 'right';
export type TilePatternType = 'straight' | 'corner' | 't_junction' | 'cross';

export interface ConnectionPoints {
  left: boolean; right: boolean; top: boolean; bottom: boolean;
}

export interface TilePattern {
  id: string;
  pattern_name: string;
  pattern_type: TilePatternType;
  arrow_directions: ArrowDirection[];
  connection_points: ConnectionPoints;
  difficulty_level: number;
  is_active: boolean;
  created_at: string;
}

export type TileRotation = 0 | 90 | 180 | 270;

export interface GridTile {
  row: number; col: number;
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

export interface PathFinderSession {
  id: string;
  user_id: string;
  level_id: string;
  grid_config: GridConfig;
  time_remaining_seconds: number;
  total_moves?: number;
  rotation_count?: number;
  flip_count?: number;
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
  timestamp?: string;
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
