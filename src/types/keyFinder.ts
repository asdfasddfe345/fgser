export type CellType = 'empty' | 'wall' | 'start' | 'key' | 'exit';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Position {
  row: number;
  col: number;
}

export interface MazeCell {
  type: CellType;
  position: Position;
  isVisited: boolean;
  isPlayerHere: boolean;
}

export interface MazeGrid {
  cells: CellType[][];
  gridSize: number;
  startPosition: Position;
  keyPosition: Position;
  exitPosition: Position;
  optimalPathLength: number;
}

export interface KeyFinderGameState {
  status: 'instructions' | 'ready' | 'playing' | 'paused' | 'completed' | 'failed';
  phase: 'finding_key' | 'finding_exit';
  playerPosition: Position;
  hasKey: boolean;
  timeRemaining: number;
  totalMoves: number;
  restartCount: number;
  visitedCells: Set<string>;
  lastCollisionDirection: Direction | null;
}

export interface KeyFinderSession {
  id: string;
  user_id: string;
  difficulty: 'easy' | 'medium' | 'hard';
  maze_config: MazeGrid;
  session_token: string;
  start_time: string;
  end_time?: string;
  time_remaining_seconds: number;
  total_moves: number;
  restart_count: number;
  collision_count: number;
  has_key: boolean;
  is_completed: boolean;
  final_score: number;
  created_at: string;
}

export interface MoveRecord {
  id: string;
  session_id: string;
  move_number: number;
  from_position: Position;
  to_position: Position;
  direction: Direction;
  was_collision: boolean;
  caused_restart: boolean;
  timestamp: string;
}

export interface KeyFinderLeaderboardEntry {
  id: string;
  user_id: string;
  difficulty: 'easy' | 'medium' | 'hard';
  best_time_seconds: number;
  fewest_moves: number;
  highest_score: number;
  completion_count: number;
  average_restarts: number;
  rank?: number;
  period: 'daily' | 'weekly' | 'all_time';
  user_name?: string;
  user_email?: string;
  updated_at: string;
}

export interface ScoreResult {
  baseScore: number;
  timeBonus: number;
  movePenalty: number;
  restartPenalty: number;
  finalScore: number;
  efficiency: number;
  optimalMoves: number;
  actualMoves: number;
}

export interface DifficultyConfig {
  gridSize: number;
  wallDensity: number;
  timeLimitSeconds: number;
  optimalMovesMultiplier: number;
}
