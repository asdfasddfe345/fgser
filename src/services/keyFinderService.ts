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

class KeyFinderService {
  private difficultyConfigs: Record<string, DifficultyConfig> = {
    easy: {
      gridSize: 8,
      wallDensity: 0.20,
      timeLimitSeconds: 360,
      optimalMovesMultiplier: 1.3
    },
    medium: {
      gridSize: 10,
      wallDensity: 0.28,
      timeLimitSeconds: 300,
      optimalMovesMultiplier: 1.5
    },
    hard: {
      gridSize: 12,
      wallDensity: 0.33,
      timeLimitSeconds: 240,
      optimalMovesMultiplier: 1.7
    }
  };

  generateMaze(difficulty: 'easy' | 'medium' | 'hard'): MazeGrid {
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

  private createMazeAttempt(gridSize: number, wallDensity: number): MazeGrid {
    const cells: CellType[][] = Array(gridSize)
      .fill(null)
      .map(() => Array(gridSize).fill('empty'));

    const totalCells = gridSize * gridSize;
    const wallCount = Math.floor(totalCells * wallDensity);

    for (let i = 0; i < wallCount; i++) {
      const row = Math.floor(Math.random() * gridSize);
      const col = Math.floor(Math.random() * gridSize);
      if (cells[row][col] === 'empty') {
        cells[row][col] = 'wall';
      }
    }

    const startPosition: Position = { row: Math.floor(gridSize / 2), col: 0 };

    const keyPosition: Position = this.findRandomEmptyPosition(cells, gridSize, [startPosition]);

    const exitPosition: Position = this.findRandomEmptyPosition(cells, gridSize, [startPosition, keyPosition]);

    cells[startPosition.row][startPosition.col] = 'start';
    cells[keyPosition.row][keyPosition.col] = 'key';
    cells[exitPosition.row][exitPosition.col] = 'exit';

    const pathToKey = this.findPath(cells, gridSize, startPosition, keyPosition);
    const pathToExit = this.findPath(cells, gridSize, keyPosition, exitPosition);
    const optimalPathLength = pathToKey.length + pathToExit.length;

    return {
      cells,
      gridSize,
      startPosition,
      keyPosition,
      exitPosition,
      optimalPathLength
    };
  }

  private createSimpleMaze(gridSize: number): MazeGrid {
    const cells: CellType[][] = Array(gridSize)
      .fill(null)
      .map(() => Array(gridSize).fill('empty'));

    const startPosition: Position = { row: Math.floor(gridSize / 2), col: 0 };
    const keyPosition: Position = { row: Math.floor(gridSize / 2), col: Math.floor(gridSize / 2) };
    const exitPosition: Position = { row: Math.floor(gridSize / 2), col: gridSize - 1 };

    cells[startPosition.row][startPosition.col] = 'start';
    cells[keyPosition.row][keyPosition.col] = 'key';
    cells[exitPosition.row][exitPosition.col] = 'exit';

    return {
      cells,
      gridSize,
      startPosition,
      keyPosition,
      exitPosition,
      optimalPathLength: gridSize
    };
  }

  private findRandomEmptyPosition(
    cells: CellType[][],
    gridSize: number,
    exclude: Position[]
  ): Position {
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      const row = Math.floor(Math.random() * gridSize);
      const col = Math.floor(Math.random() * gridSize);

      const isExcluded = exclude.some(pos => pos.row === row && pos.col === col);

      if (cells[row][col] === 'empty' && !isExcluded) {
        return { row, col };
      }

      attempts++;
    }

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const isExcluded = exclude.some(pos => pos.row === row && pos.col === col);
        if (cells[row][col] === 'empty' && !isExcluded) {
          return { row, col };
        }
      }
    }

    return { row: 0, col: 0 };
  }

  private findPath(
    cells: CellType[][],
    gridSize: number,
    start: Position,
    end: Position
  ): Position[] {
    const visited: boolean[][] = Array(gridSize)
      .fill(null)
      .map(() => Array(gridSize).fill(false));

    const queue: { pos: Position; path: Position[] }[] = [
      { pos: start, path: [start] }
    ];

    visited[start.row][start.col] = true;

    while (queue.length > 0) {
      const { pos, path } = queue.shift()!;

      if (pos.row === end.row && pos.col === end.col) {
        return path;
      }

      const neighbors = this.getNeighbors(pos, gridSize);

      for (const neighbor of neighbors) {
        if (
          !visited[neighbor.row][neighbor.col] &&
          (cells[neighbor.row][neighbor.col] === 'empty' ||
            cells[neighbor.row][neighbor.col] === 'key' ||
            cells[neighbor.row][neighbor.col] === 'exit' ||
            cells[neighbor.row][neighbor.col] === 'start')
        ) {
          visited[neighbor.row][neighbor.col] = true;
          queue.push({
            pos: neighbor,
            path: [...path, neighbor]
          });
        }
      }
    }

    return [];
  }

  private getNeighbors(pos: Position, gridSize: number): Position[] {
    const neighbors: Position[] = [];

    if (pos.row > 0) neighbors.push({ row: pos.row - 1, col: pos.col });
    if (pos.row < gridSize - 1) neighbors.push({ row: pos.row + 1, col: pos.col });
    if (pos.col > 0) neighbors.push({ row: pos.row, col: pos.col - 1 });
    if (pos.col < gridSize - 1) neighbors.push({ row: pos.row, col: pos.col + 1 });

    return neighbors;
  }

  private isValidMaze(maze: MazeGrid): boolean {
    const pathToKey = this.findPath(
      maze.cells,
      maze.gridSize,
      maze.startPosition,
      maze.keyPosition
    );

    if (pathToKey.length === 0) return false;

    const pathToExit = this.findPath(
      maze.cells,
      maze.gridSize,
      maze.keyPosition,
      maze.exitPosition
    );

    return pathToExit.length > 0;
  }

  canMove(
    currentPos: Position,
    direction: Direction,
    maze: MazeGrid
  ): { canMove: boolean; newPosition: Position | null; hitWall: boolean } {
    let newRow = currentPos.row;
    let newCol = currentPos.col;

    switch (direction) {
      case 'up':
        newRow--;
        break;
      case 'down':
        newRow++;
        break;
      case 'left':
        newCol--;
        break;
      case 'right':
        newCol++;
        break;
    }

    if (newRow < 0 || newRow >= maze.gridSize || newCol < 0 || newCol >= maze.gridSize) {
      return { canMove: false, newPosition: null, hitWall: true };
    }

    const cellType = maze.cells[newRow][newCol];

    if (cellType === 'wall') {
      return { canMove: false, newPosition: null, hitWall: true };
    }

    return { canMove: true, newPosition: { row: newRow, col: newCol }, hitWall: false };
  }

  calculateScore(
    completionTimeSeconds: number,
    timeLimitSeconds: number,
    totalMoves: number,
    optimalMoves: number,
    restartCount: number
  ): ScoreResult {
    const baseScore = 1000;

    const timeUsed = timeLimitSeconds - completionTimeSeconds;
    let timeBonus = 0;
    if (timeUsed < 60) {
      timeBonus = 200;
    } else if (timeUsed < 120) {
      timeBonus = 150;
    } else if (timeUsed < 180) {
      timeBonus = 100;
    } else {
      timeBonus = 50;
    }

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
      actualMoves: totalMoves
    };
  }

  async createSession(
    userId: string,
    difficulty: 'easy' | 'medium' | 'hard',
    mazeConfig: MazeGrid
  ): Promise<KeyFinderSession> {
    const config = this.difficultyConfigs[difficulty];

    const { data, error } = await supabase
      .from('key_finder_sessions')
      .insert({
        user_id: userId,
        difficulty,
        maze_config: mazeConfig,
        time_remaining_seconds: config.timeLimitSeconds,
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
    difficulty: 'easy' | 'medium' | 'hard',
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

    if (error) {
      console.error('Error updating leaderboard:', error);
    }
  }

  async getLeaderboard(
    difficulty?: 'easy' | 'medium' | 'hard',
    period: 'daily' | 'weekly' | 'all_time' = 'all_time',
    limit: number = 100
  ): Promise<KeyFinderLeaderboardEntry[]> {
    let query = supabase
      .from('key_finder_leaderboard')
      .select('*')
      .eq('period', period)
      .order('highest_score', { ascending: false })
      .limit(limit);

    if (difficulty) {
      query = query.eq('difficulty', difficulty);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }

    return (data || []).map((entry: any, index: number) => ({
      ...entry,
      rank: index + 1
    }));
  }

  getDifficultyConfig(difficulty: 'easy' | 'medium' | 'hard'): DifficultyConfig {
    return this.difficultyConfigs[difficulty];
  }
}

export const keyFinderService = new KeyFinderService();
