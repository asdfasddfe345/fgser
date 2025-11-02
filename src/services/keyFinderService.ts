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
  DifficultyConfig
} from '../types/keyFinder';

type Level = 'easy' | 'medium' | 'hard';

//
// ────────────────────────────────────────────────────────────────────────────────
// Defaults (Accenture style): 8/10/12; 5:00 each; densities same as your code
// ────────────────────────────────────────────────────────────────────────────────
const DEFAULT_CONFIGS: Record<Level, DifficultyConfig> = {
  easy:   { gridSize: 8,  wallDensity: 0.20, timeLimitSeconds: 300, optimalMovesMultiplier: 1.3 },
  medium: { gridSize: 10, wallDensity: 0.28, timeLimitSeconds: 300, optimalMovesMultiplier: 1.5 },
  hard:   { gridSize: 12, wallDensity: 0.33, timeLimitSeconds: 300, optimalMovesMultiplier: 1.7 }
};

// Supabase table (optional). Shape:
// level: text('easy'|'medium'|'hard'), grid_size int, time_limit_seconds int,
// wall_density numeric, optimal_moves_multiplier numeric, is_active boolean
const CONFIG_TABLE = 'key_finder_config';

// Cache TTL for remote configs
const CONFIG_TTL_MS = 5 * 60 * 1000;

class KeyFinderService {
  // Local active configs (used by synchronous methods)
  private difficultyConfigs: Record<Level, DifficultyConfig> = { ...DEFAULT_CONFIGS };

  // Cache bookkeeping for remote fetch
  private lastFetchedAt: Partial<Record<Level, number>> = {};

  // ────────────────────────────────────────────────────────────────────────────
  // Public: Generate maze synchronously using active configs
  // ────────────────────────────────────────────────────────────────────────────
  generateMaze(difficulty: Level): MazeGrid {
    // Try to refresh config in the background (non-blocking)
    this.maybeRefreshConfig(difficulty).catch(() => { /* no-op */ });

    const config = this.difficultyConfigs[difficulty];
    const { gridSize, wallDensity } = config;

    let maze: MazeGrid;
    let attempts = 0;
    const maxAttempts = 50;

    do {
      maze = this.createMazeAttempt(gridSize, wallDensity);
      attempts++;
    } while (!this.isValidMaze(maze) && attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      maze = this.createSimpleMaze(gridSize);
    }
    return maze;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Maze internals
  // ────────────────────────────────────────────────────────────────────────────
  private createMazeAttempt(gridSize: number, wallDensity: number): MazeGrid {
    const cells: CellType[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill('empty'));

    const totalCells = gridSize * gridSize;
    const wallCount = Math.floor(totalCells * wallDensity);

    for (let i = 0; i < wallCount; i++) {
      const row = Math.floor(Math.random() * gridSize);
      const col = Math.floor(Math.random() * gridSize);
      if (cells[row][col] === 'empty') cells[row][col] = 'wall';
    }

    // Start on left mid like the real test feel (still fine if UI puts avatar elsewhere)
    const startPosition: Position = { row: Math.floor(gridSize / 2), col: 0 };
    const keyPosition  = this.findRandomEmptyPosition(cells, gridSize, [startPosition]);
    const exitPosition = this.findRandomEmptyPosition(cells, gridSize, [startPosition, keyPosition]);

    cells[startPosition.row][startPosition.col] = 'start';
    cells[keyPosition.row][keyPosition.col]     = 'key';
    cells[exitPosition.row][exitPosition.col]   = 'exit';

    const pathToKey  = this.findPath(cells, gridSize, startPosition, keyPosition);
    const pathToExit = this.findPath(cells, gridSize, keyPosition, exitPosition);
    const optimalPathLength = pathToKey.length + pathToExit.length;

    return { cells, gridSize, startPosition, keyPosition, exitPosition, optimalPathLength };
  }

  private createSimpleMaze(gridSize: number): MazeGrid {
    const cells: CellType[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill('empty'));
    const startPosition: Position = { row: Math.floor(gridSize / 2), col: 0 };
    const keyPosition:   Position = { row: Math.floor(gridSize / 2), col: Math.floor(gridSize / 2) };
    const exitPosition:   Position = { row: Math.floor(gridSize / 2), col: gridSize - 1 };

    cells[startPosition.row][startPosition.col] = 'start';
    cells[keyPosition.row][keyPosition.col]     = 'key';
    cells[exitPosition.row][exitPosition.col]   = 'exit';

    return { cells, gridSize, startPosition, keyPosition, exitPosition, optimalPathLength: gridSize };
  }

  private findRandomEmptyPosition(cells: CellType[][], gridSize: number, exclude: Position[]): Position {
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      const row = Math.floor(Math.random() * gridSize);
      const col = Math.floor(Math.random() * gridSize);
      const excluded = exclude.some(p => p.row === row && p.col === col);
      if (cells[row][col] === 'empty' && !excluded) return { row, col };
      attempts++;
    }

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const excluded = exclude.some(p => p.row === row && p.col === col);
        if (cells[row][col] === 'empty' && !excluded) return { row, col };
      }
    }
    return { row: 0, col: 0 };
  }

  private findPath(cells: CellType[][], gridSize: number, start: Position, end: Position): Position[] {
    const visited: boolean[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
    const queue: { pos: Position; path: Position[] }[] = [{ pos: start, path: [start] }];
    visited[start.row][start.col] = true;

    while (queue.length) {
      const { pos, path } = queue.shift()!;
      if (pos.row === end.row && pos.col === end.col) return path;

      const neighbors = this.getNeighbors(pos, gridSize);
      for (const n of neighbors) {
        if (!visited[n.row][n.col] && (['empty','key','exit','start'] as CellType[]).includes(cells[n.row][n.col])) {
          visited[n.row][n.col] = true;
          queue.push({ pos: n, path: [...path, n] });
        }
      }
    }
    return [];
  }

  private getNeighbors(pos: Position, gridSize: number): Position[] {
    const out: Position[] = [];
    if (pos.row > 0) out.push({ row: pos.row - 1, col: pos.col });
    if (pos.row < gridSize - 1) out.push({ row: pos.row + 1, col: pos.col });
    if (pos.col > 0) out.push({ row: pos.row, col: pos.col - 1 });
    if (pos.col < gridSize - 1) out.push({ row: pos.row, col: pos.col + 1 });
    return out;
  }

  private isValidMaze(maze: MazeGrid): boolean {
    const p1 = this.findPath(maze.cells, maze.gridSize, maze.startPosition, maze.keyPosition);
    if (p1.length === 0) return false;
    const p2 = this.findPath(maze.cells, maze.gridSize, maze.keyPosition, maze.exitPosition);
    return p2.length > 0;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Movement & scoring
  // ────────────────────────────────────────────────────────────────────────────
  canMove(
    currentPos: Position,
    direction: Direction,
    maze: MazeGrid
  ): { canMove: boolean; newPosition: Position | null; hitWall: boolean } {
    let { row, col } = currentPos;
    if (direction === 'up') row--;
    if (direction === 'down') row++;
    if (direction === 'left') col--;
    if (direction === 'right') col++;

    if (row < 0 || row >= maze.gridSize || col < 0 || col >= maze.gridSize) {
      return { canMove: false, newPosition: null, hitWall: true };
    }
    if (maze.cells[row][col] === 'wall') {
      return { canMove: false, newPosition: null, hitWall: true };
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

    // Larger bonus if you finish earlier
    const timeUsed = timeLimitSeconds - completionTimeSeconds;
    const timeBonus =
      timeUsed < 60 ? 200 :
      timeUsed < 120 ? 150 :
      timeUsed < 180 ? 100 : 50;

    const extraMoves   = Math.max(0, totalMoves - optimalMoves);
    const movePenalty  = extraMoves * 5;
    const restartPenalty = restartCount * 20;

    const finalScore = Math.max(baseScore + timeBonus - movePenalty - restartPenalty, 50);
    const efficiency = optimalMoves > 0 ? (optimalMoves / totalMoves) * 100 : 0;

    return { baseScore, timeBonus, movePenalty, restartPenalty, finalScore, efficiency, optimalMoves, actualMoves: totalMoves };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Sessions / moves / leaderboard
  // ────────────────────────────────────────────────────────────────────────────
  async createSession(
    userId: string,
    difficulty: Level,
    mazeConfig: MazeGrid
  ): Promise<KeyFinderSession> {
    // Ensure we use latest config (pulls from Supabase if available)
    const cfg = await this.getConfig(difficulty);

    const { data, error } = await supabase
      .from('key_finder_sessions')
      .insert({
        user_id: userId,
        difficulty,
        maze_config: mazeConfig,
        time_remaining_seconds: cfg.timeLimitSeconds,
        total_moves: 0,
        restart_count: 0,
        collision_count: 0,
        has_key: false,
        is_completed: false,
        final_score: 0
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating Key Finder session:', error);
      throw error;
    }
    return data;
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
        caused_restart: causedRestart
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording move:', error);
      throw error;
    }
    return data;
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
        end_time: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) {
      console.error('Error completing session:', error);
      throw error;
    }
  }

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
      p_restart_count: restartCount
    });
    if (error) console.error('Error updating leaderboard:', error);
  }

  async getLeaderboard(
    difficulty?: Level,
    period: 'daily' | 'weekly' | 'all_time' = 'all_time',
    limit: number = 100
  ): Promise<KeyFinderLeaderboardEntry[]> {
    let query = supabase
      .from('key_finder_leaderboard')
      .select('*')
      .eq('period', period)
      .order('highest_score', { ascending: false })
      .limit(limit);

    if (difficulty) query = query.eq('difficulty', difficulty);

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
    return (data || []).map((entry: any, i: number) => ({ ...entry, rank: i + 1 }));
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Config accessors
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Synchronous getter used by existing code paths.
   * Returns the currently active (cached) config, falling back to defaults.
   */
  getDifficultyConfig(difficulty: Level): DifficultyConfig {
    return this.difficultyConfigs[difficulty];
  }

  /**
   * Promise-based getter that ensures we try fetching from Supabase (with cache).
   * Use this in places where accuracy matters (e.g., createSession).
   */
  async getConfig(difficulty: Level): Promise<DifficultyConfig> {
    await this.maybeRefreshConfig(difficulty);
    return this.difficultyConfigs[difficulty];
  }

  /**
   * Background refresh from Supabase if:
   * - we never fetched this level, or
   * - cache is older than CONFIG_TTL_MS
   */
  private async maybeRefreshConfig(level: Level): Promise<void> {
    const now = Date.now();
    const last = this.lastFetchedAt[level] ?? 0;
    if (now - last < CONFIG_TTL_MS) return;

    try {
      const sel = 'grid_size,time_limit_seconds,wall_density,optimal_moves_multiplier,is_active,updated_at';
      const { data, error } = await supabase
        .from(CONFIG_TABLE)
        .select(sel)
        .eq('level', level)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const merged: DifficultyConfig = {
          gridSize: typeof data.grid_size === 'number' ? data.grid_size : this.difficultyConfigs[level].gridSize,
          timeLimitSeconds: typeof data.time_limit_seconds === 'number' ? data.time_limit_seconds : this.difficultyConfigs[level].timeLimitSeconds,
          wallDensity: typeof data.wall_density === 'number' ? Number(data.wall_density) : this.difficultyConfigs[level].wallDensity,
          optimalMovesMultiplier:
            typeof data.optimal_moves_multiplier === 'number'
              ? Number(data.optimal_moves_multiplier)
              : this.difficultyConfigs[level].optimalMovesMultiplier
        };
        this.difficultyConfigs[level] = merged;
      }
      // If error or no data -> keep existing (defaults)
    } catch {
      // ignore network/schema errors; keep defaults
    } finally {
      this.lastFetchedAt[level] = now;
    }
  }
}

export const keyFinderService = new KeyFinderService();
