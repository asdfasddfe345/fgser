// src/services/keyFinderService.ts
import { supabase } from '../lib/supabaseClient';
import {
  MazeGrid,
  Position,
  CellType,
  Direction,
  KeyFinderSession,
  MoveRecord,
  KeyFinderLeaderboardEntry,
  ScoreResult,
  DifficultyConfig,
} from '../types/keyFinder';

type Level = 'easy' | 'medium' | 'hard';

const DEFAULT_CONFIGS: Record<Level, DifficultyConfig> = {
  easy:   { gridSize: 8,  wallDensity: 0.20, timeLimitSeconds: 300, optimalMovesMultiplier: 1.3 },
  medium: { gridSize: 10, wallDensity: 0.28, timeLimitSeconds: 300, optimalMovesMultiplier: 1.5 },
  hard:   { gridSize: 12, wallDensity: 0.33, timeLimitSeconds: 300, optimalMovesMultiplier: 1.7 },
};

const CONFIG_TABLE  = 'key_finder_config';   // optional overrides per level
const RESULTS_TABLE = 'key_finder_results';  // compact per-run summary table
const CONFIG_TTL_MS = 5 * 60 * 1000;         // cache configs for 5 min

class KeyFinderService {
  private configs: Record<Level, DifficultyConfig> = { ...DEFAULT_CONFIGS };
  private lastFetchedAt: Partial<Record<Level, number>> = {};

  // ───────────────────────────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────────────────────────
  generateMaze(difficulty: Level): MazeGrid {
    // refresh config in background
    this.maybeRefreshConfig(difficulty).catch(() => {});
    const { gridSize, wallDensity } = this.configs[difficulty];

    let maze: MazeGrid;
    let tries = 0;
    const MAX = 50;

    do {
      maze = this.createMazeAttempt(gridSize, wallDensity);
      tries++;
    } while (!this.isValidMaze(maze) && tries < MAX);

    if (tries >= MAX) maze = this.createSimpleMaze(gridSize);
    return maze;
  }

  getDifficultyConfig(difficulty: Level): DifficultyConfig {
    return this.configs[difficulty];
  }

  async getConfig(difficulty: Level): Promise<DifficultyConfig> {
    await this.maybeRefreshConfig(difficulty);
    return this.configs[difficulty];
  }

  canMove(curr: Position, dir: Direction, maze: MazeGrid) {
    let row = curr.row, col = curr.col;
    if (dir === 'up') row--;
    if (dir === 'down') row++;
    if (dir === 'left') col--;
    if (dir === 'right') col++;

    if (row < 0 || row >= maze.gridSize || col < 0 || col >= maze.gridSize) {
      return { canMove: false, newPosition: null as Position | null, hitWall: true };
    }
    if (maze.cells[row][col] === 'wall') {
      return { canMove: false, newPosition: null as Position | null, hitWall: true };
    }
    return { canMove: true, newPosition: { row, col }, hitWall: false };
  }

  calculateScore(
    completionTimeSeconds: number,
    timeLimitSeconds: number,
    totalMoves: number,
    optimalMoves: number,
    restartCount: number
  ): ScoreResult {
    const baseScore = 1000;

    // timeRemaining = completionTimeSeconds; so "time used" = limit - remaining
    const timeUsed = timeLimitSeconds - completionTimeSeconds;
    const timeBonus = timeUsed < 60 ? 200 : timeUsed < 120 ? 150 : timeUsed < 180 ? 100 : 50;

    const extraMoves = Math.max(0, totalMoves - optimalMoves);
    const movePenalty = extraMoves * 5;

    const restartPenalty = restartCount * 20;

    const finalScore = Math.max(baseScore + timeBonus - movePenalty - restartPenalty, 50);
    const efficiency = optimalMoves > 0 ? (optimalMoves / totalMoves) * 100 : 0;

    return {
      baseScore,
      timeBonus,
      movePenalty,
      restartPenalty,
      finalScore,
      efficiency,
      optimalMoves,
      actualMoves: totalMoves,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Sessions & persistence
  // ───────────────────────────────────────────────────────────────────────────
  async createSession(
    userId: string,
    difficulty: Level,
    mazeConfig: MazeGrid
  ): Promise<KeyFinderSession> {
    const cfg = await this.getConfig(difficulty);
    const token =
      (globalThis.crypto as any)?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const { data, error } = await supabase
      .from('key_finder_sessions')
      .insert({
        user_id: userId,
        difficulty,
        maze_config: mazeConfig,
        session_token: token,
        start_time: new Date().toISOString(),
        time_remaining_seconds: cfg.timeLimitSeconds,
        total_moves: 0,
        restart_count: 0,
        collision_count: 0,
        has_key: false,
        is_completed: false,
        final_score: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data as KeyFinderSession;
  }

  async recordMove(
    sessionId: string,
    moveNumber: number,
    fromPosition: Position,
    toPosition: Position,
    direction: Direction,
    wasCollision: boolean,
    causedRestart: boolean
  ): Promise<MoveRecord> {
    const { data, error } = await supabase
      .from('key_finder_moves')
      .insert({
        session_id: sessionId,
        move_number: moveNumber,
        from_position: fromPosition,
        to_position: toPosition,
        direction,
        was_collision: wasCollision,
        caused_restart: causedRestart,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as MoveRecord;
  }

  async completeSession(
    sessionId: string,
    finalScore: number,
    totalMoves: number,
    restartCount: number,
    collisionCount: number,
    timeRemaining: number
  ): Promise<void> {
    const { error } = await supabase
      .from('key_finder_sessions')
      .update({
        is_completed: true,
        final_score: finalScore,
        total_moves: totalMoves,
        restart_count: restartCount,
        collision_count: collisionCount,
        time_remaining_seconds: timeRemaining,
        end_time: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) throw error;
  }

  // ✅ NEW: compact per-run result row (what your component calls)
  async saveGameResult(result: {
    user_id: string;
    difficulty: Level;
    score: number;
    time_taken: number;   // seconds elapsed
    moves_count: number;
    completed: boolean;
  }): Promise<void> {
    try {
      const { error } = await supabase.from(RESULTS_TABLE).insert({
        user_id: result.user_id,
        difficulty: result.difficulty,
        score: result.score,
        time_taken_seconds: result.time_taken,
        total_moves: result.moves_count,
        completed: result.completed,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Error saving game result:', error);
        throw error;
      }
    } catch (err) {
      console.error('Failed to save game result:', err);
    }
  }

  // Optional: if you have an RPC that rolls up leaderboards
  async updateLeaderboard(
    userId: string,
    difficulty: Level,
    completionTime: number,
    totalMoves: number,
    score: number,
    restartCount: number
  ): Promise<void> {
    const { error } = await supabase.rpc('update_key_finder_leaderboard', {
      p_user_id: userId,
      p_difficulty: difficulty,
      p_completion_time: completionTime,
      p_total_moves: totalMoves,
      p_score: score,
      p_restart_count: restartCount,
    });
    if (error) {
      // don’t break gameplay if leaderboard rollup fails
      console.warn('update_key_finder_leaderboard error:', error.message);
    }
  }

  async getLeaderboard(
    difficulty?: Level,
    period: 'daily' | 'weekly' | 'all_time' = 'all_time',
    limit = 100
  ): Promise<KeyFinderLeaderboardEntry[]> {
    let q = supabase
      .from('key_finder_leaderboard')
      .select('*')
      .eq('period', period)
      .order('highest_score', { ascending: false })
      .limit(limit);

    if (difficulty) q = q.eq('difficulty', difficulty);

    const { data, error } = await q;
    if (error) {
      console.warn('getLeaderboard error:', error.message);
      return [];
    }
    return (data || []).map((row: any, i: number) => ({ ...row, rank: i + 1 }));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Internal: maze creation / pathing
  // ───────────────────────────────────────────────────────────────────────────
  private createMazeAttempt(gridSize: number, wallDensity: number): MazeGrid {
    const cells: CellType[][] = Array(gridSize)
      .fill(null)
      .map(() => Array(gridSize).fill('empty'));

    // sprinkle walls
    const total = gridSize * gridSize;
    const wallCount = Math.floor(total * wallDensity);
    for (let i = 0; i < wallCount; i++) {
      const r = Math.floor(Math.random() * gridSize);
      const c = Math.floor(Math.random() * gridSize);
      if (cells[r][c] === 'empty') cells[r][c] = 'wall';
    }

    // start at left middle; key & exit on empty cells
    const start: Position = { row: Math.floor(gridSize / 2), col: 0 };
    const key = this.findRandomEmpty(cells, gridSize, [start]);
    const exit = this.findRandomEmpty(cells, gridSize, [start, key]);

    cells[start.row][start.col] = 'start';
    cells[key.row][key.col] = 'key';
    cells[exit.row][exit.col] = 'exit';

    const toKey = this.bfs(cells, gridSize, start, key);
    const toExit = this.bfs(cells, gridSize, key, exit);
    const optimalPathLength = toKey.length + toExit.length;

    return {
      cells,
      gridSize,
      startPosition: start,
      keyPosition: key,
      exitPosition: exit,
      optimalPathLength,
    };
  }

  private createSimpleMaze(gridSize: number): MazeGrid {
    const cells: CellType[][] = Array(gridSize)
      .fill(null)
      .map(() => Array(gridSize).fill('empty'));

    const start: Position = { row: Math.floor(gridSize / 2), col: 0 };
    const key: Position = { row: Math.floor(gridSize / 2), col: Math.floor(gridSize / 2) };
    const exit: Position = { row: Math.floor(gridSize / 2), col: gridSize - 1 };

    cells[start.row][start.col] = 'start';
    cells[key.row][key.col] = 'key';
    cells[exit.row][exit.col] = 'exit';

    return {
      cells,
      gridSize,
      startPosition: start,
      keyPosition: key,
      exitPosition: exit,
      optimalPathLength: gridSize,
    };
  }

  private findRandomEmpty(cells: CellType[][], gridSize: number, exclude: Position[]): Position {
    let tries = 0;
    while (tries++ < 100) {
      const row = Math.floor(Math.random() * gridSize);
      const col = Math.floor(Math.random() * gridSize);
      const excluded = exclude.some(p => p.row === row && p.col === col);
      if (!excluded && cells[row][col] === 'empty') return { row, col };
    }
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const excluded = exclude.some(p => p.row === row && p.col === col);
        if (!excluded && cells[row][col] === 'empty') return { row, col };
      }
    }
    return { row: 0, col: 0 };
  }

  private bfs(cells: CellType[][], gridSize: number, start: Position, end: Position): Position[] {
    const seen = Array(gridSize)
      .fill(null)
      .map(() => Array(gridSize).fill(false));

    const q: { pos: Position; path: Position[] }[] = [{ pos: start, path: [start] }];
    seen[start.row][start.col] = true;

    while (q.length) {
      const { pos, path } = q.shift()!;
      if (pos.row === end.row && pos.col === end.col) return path;

      const nbs = this.neigh(pos, gridSize);
      for (const n of nbs) {
        const t = cells[n.row][n.col];
        if (!seen[n.row][n.col] && (t === 'empty' || t === 'start' || t === 'key' || t === 'exit')) {
          seen[n.row][n.col] = true;
          q.push({ pos: n, path: [...path, n] });
        }
      }
    }
    return [];
  }

  private neigh(p: Position, gridSize: number): Position[] {
    const out: Position[] = [];
    if (p.row > 0) out.push({ row: p.row - 1, col: p.col });
    if (p.row < gridSize - 1) out.push({ row: p.row + 1, col: p.col });
    if (p.col > 0) out.push({ row: p.row, col: p.col - 1 });
    if (p.col < gridSize - 1) out.push({ row: p.row, col: p.col + 1 });
    return out;
  }

  private isValidMaze(maze: MazeGrid): boolean {
    const a = this.bfs(maze.cells, maze.gridSize, maze.startPosition, maze.keyPosition);
    if (!a.length) return false;
    const b = this.bfs(maze.cells, maze.gridSize, maze.keyPosition, maze.exitPosition);
    return b.length > 0;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Config overrides (optional)
  // ───────────────────────────────────────────────────────────────────────────
  private async maybeRefreshConfig(level: Level): Promise<void> {
    const now = Date.now();
    if (this.lastFetchedAt[level] && now - (this.lastFetchedAt[level] as number) < CONFIG_TTL_MS) return;

    const { data, error } = await supabase
      .from(CONFIG_TABLE)
      .select('*')
      .eq('difficulty', level)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const next: DifficultyConfig = {
        gridSize: data.grid_size ?? this.configs[level].gridSize,
        wallDensity: data.wall_density ?? this.configs[level].wallDensity,
        timeLimitSeconds: data.time_limit_seconds ?? this.configs[level].timeLimitSeconds,
        optimalMovesMultiplier: data.optimal_moves_multiplier ?? this.configs[level].optimalMovesMultiplier,
      };
      this.configs[level] = next;
    }
    this.lastFetchedAt[level] = now;
  }
}

export const keyFinderService = new KeyFinderService();
export default keyFinderService;
