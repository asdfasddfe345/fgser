import { supabase } from '../lib/supabaseClient';
import {
  GridConfig,
  GridTile,
  TilePattern,
  TileRotation,
  PathValidationResult,
  ScoreCalculation,
  PathFinderSession,
  PathFinderLeaderboardEntry,
  MoveHistory,
  ConnectionPoints
} from '../types/pathfinder';
import { GameLevel } from '../types/gaming';
import { getTilePatternsByDifficulty, getRandomTilePattern } from '../data/tilePatterns';

class PathFinderService {
  generateGrid(gridSize: number, levelNumber: number): GridConfig {
    const maxDifficulty = Math.min(levelNumber, 3);
    const tiles: GridTile[][] = [];

    const startPosition = { row: Math.floor(gridSize / 2), col: 0 };
    const endPosition = { row: Math.floor(gridSize / 2), col: gridSize - 1 };

    for (let row = 0; row < gridSize; row++) {
      tiles[row] = [];
      for (let col = 0; col < gridSize; col++) {
        const pattern = getRandomTilePattern(maxDifficulty);
        const rotation: TileRotation = [0, 90, 180, 270][Math.floor(Math.random() * 4)] as TileRotation;

        tiles[row][col] = {
          row,
          col,
          pattern,
          rotation,
          isStart: row === startPosition.row && col === startPosition.col,
          isEnd: row === endPosition.row && col === endPosition.col,
          isSelected: false,
          isInPath: false
        };
      }
    }

    const optimalMoves = this.calculateOptimalMoves(gridSize, levelNumber);

    return {
      tiles,
      gridSize,
      startPosition,
      endPosition,
      optimalMoves
    };
  }

  private calculateOptimalMoves(gridSize: number, levelNumber: number): number {
    const baseMovesPerCell = 1.5;
    const pathLength = gridSize - 1;
    return Math.floor(pathLength * baseMovesPerCell * (1 + levelNumber * 0.1));
  }

  rotateConnectionPoints(connections: ConnectionPoints, rotation: TileRotation): ConnectionPoints {
    if (rotation === 0) return connections;

    let result = { ...connections };

    const rotations = rotation / 90;
    for (let i = 0; i < rotations; i++) {
      result = {
        left: result.bottom,
        right: result.top,
        top: result.left,
        bottom: result.right
      };
    }

    return result;
  }

  validatePath(gridConfig: GridConfig): PathValidationResult {
    const { tiles, startPosition, endPosition, gridSize } = gridConfig;
    const visited = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
    const path: { row: number; col: number }[] = [];

    const queue: { row: number; col: number; path: { row: number; col: number }[] }[] = [
      { ...startPosition, path: [startPosition] }
    ];
    visited[startPosition.row][startPosition.col] = true;

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentTile = tiles[current.row][current.col];
      const rotatedConnections = this.rotateConnectionPoints(
        currentTile.pattern.connection_points,
        currentTile.rotation
      );

      if (current.row === endPosition.row && current.col === endPosition.col) {
        return {
          isValid: true,
          pathTiles: current.path,
          message: 'Valid path found!'
        };
      }

      const neighbors = [
        { row: current.row - 1, col: current.col, direction: 'top', opposite: 'bottom' },
        { row: current.row + 1, col: current.col, direction: 'bottom', opposite: 'top' },
        { row: current.row, col: current.col - 1, direction: 'left', opposite: 'right' },
        { row: current.row, col: current.col + 1, direction: 'right', opposite: 'left' }
      ];

      for (const neighbor of neighbors) {
        if (
          neighbor.row < 0 || neighbor.row >= gridSize ||
          neighbor.col < 0 || neighbor.col >= gridSize ||
          visited[neighbor.row][neighbor.col]
        ) {
          continue;
        }

        const hasCurrentConnection = rotatedConnections[neighbor.direction as keyof ConnectionPoints];

        if (!hasCurrentConnection) {
          continue;
        }

        const neighborTile = tiles[neighbor.row][neighbor.col];
        const neighborConnections = this.rotateConnectionPoints(
          neighborTile.pattern.connection_points,
          neighborTile.rotation
        );
        const hasNeighborConnection = neighborConnections[neighbor.opposite as keyof ConnectionPoints];

        if (hasNeighborConnection) {
          visited[neighbor.row][neighbor.col] = true;
          queue.push({
            row: neighbor.row,
            col: neighbor.col,
            path: [...current.path, { row: neighbor.row, col: neighbor.col }]
          });
        }
      }
    }

    return {
      isValid: false,
      pathTiles: [],
      message: 'No valid path found. Keep adjusting tiles!'
    };
  }

  rotateTile(tile: GridTile): GridTile {
    const newRotation = ((tile.rotation + 90) % 360) as TileRotation;
    return {
      ...tile,
      rotation: newRotation
    };
  }

  flipTile(tile: GridTile): GridTile {
    const newRotation = ((tile.rotation + 180) % 360) as TileRotation;
    return {
      ...tile,
      rotation: newRotation
    };
  }

  calculateScore(
    completionTimeSeconds: number,
    timeLimitSeconds: number,
    totalMoves: number,
    optimalMoves: number
  ): ScoreCalculation {
    const baseScore = 100;

    let timeBonus = 0;
    if (completionTimeSeconds < 60) {
      timeBonus = 50;
    } else if (completionTimeSeconds < timeLimitSeconds) {
      timeBonus = Math.floor(25 * (timeLimitSeconds - completionTimeSeconds) / timeLimitSeconds);
    }

    let movePenalty = 0;
    if (totalMoves > optimalMoves) {
      movePenalty = (totalMoves - optimalMoves) * 10;
    }

    const finalScore = Math.max(baseScore + timeBonus - movePenalty, 10);
    const efficiency = (optimalMoves / totalMoves) * 100;

    return {
      baseScore,
      timeBonus,
      movePenalty,
      finalScore,
      efficiency
    };
  }

  async createSession(
    userId: string,
    levelId: string,
    gridConfig: GridConfig,
    isPracticeMode: boolean = false
  ): Promise<PathFinderSession> {
    const { data, error } = await supabase
      .from('pathfinder_game_sessions')
      .insert({
        user_id: userId,
        level_id: levelId,
        grid_config: gridConfig,
        time_remaining_seconds: 240,
        is_practice_mode: isPracticeMode,
        is_completed: false,
        is_valid: true,
        final_score: 0
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating PathFinder session:', error);
      throw error;
    }

    return data;
  }

  async recordMove(
    sessionId: string,
    moveNumber: number,
    tilePosition: { row: number; col: number },
    actionType: 'rotate' | 'flip',
    previousRotation: TileRotation,
    newRotation: TileRotation
  ): Promise<MoveHistory> {
    const { data, error } = await supabase
      .from('pathfinder_move_history')
      .insert({
        session_id: sessionId,
        move_number: moveNumber,
        tile_position: tilePosition,
        action_type: actionType,
        previous_rotation: previousRotation,
        new_rotation: newRotation
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
    rotationCount: number,
    flipCount: number,
    timeRemainingSeconds: number
  ): Promise<void> {
    const { error } = await supabase
      .from('pathfinder_game_sessions')
      .update({
        is_completed: true,
        final_score: finalScore,
        total_moves: totalMoves,
        rotation_count: rotationCount,
        flip_count: flipCount,
        time_remaining_seconds: timeRemainingSeconds,
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
    levelId: string,
    completionTime: number,
    totalMoves: number,
    score: number
  ): Promise<void> {
    const { error } = await supabase.rpc('update_pathfinder_leaderboard', {
      p_user_id: userId,
      p_level_id: levelId,
      p_completion_time: completionTime,
      p_total_moves: totalMoves,
      p_score: score
    });

    if (error) {
      console.error('Error updating leaderboard:', error);
      throw error;
    }
  }

  async getLeaderboard(
    levelId?: string,
    period: 'daily' | 'weekly' | 'all_time' = 'all_time',
    limit: number = 100
  ): Promise<PathFinderLeaderboardEntry[]> {
    let query = supabase
      .from('pathfinder_leaderboard')
      .select(`
        *,
        user_profiles!inner(full_name, email)
      `)
      .eq('period', period)
      .order('highest_score', { ascending: false })
      .limit(limit);

    if (levelId) {
      query = query.eq('level_id', levelId);
    } else {
      query = query.is('level_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }

    return (data || []).map((entry: any, index: number) => ({
      ...entry,
      rank: index + 1,
      user_name: entry.user_profiles?.full_name || 'Anonymous',
      user_email: entry.user_profiles?.email
    }));
  }

  async getUserRank(userId: string, period: 'daily' | 'weekly' | 'all_time' = 'all_time'): Promise<number | null> {
    const leaderboard = await this.getLeaderboard(undefined, period, 1000);
    const userEntry = leaderboard.find(entry => entry.user_id === userId);
    return userEntry?.rank || null;
  }

  async awardXP(
    userId: string,
    sessionId: string,
    score: number,
    isFirstCompletion: boolean = false
  ): Promise<number> {
    const { data, error } = await supabase.rpc('award_pathfinder_xp', {
      p_user_id: userId,
      p_session_id: sessionId,
      p_score: score,
      p_is_first_completion: isFirstCompletion
    });

    if (error) {
      console.error('Error awarding XP:', error);
      throw error;
    }

    return data || 0;
  }

  async getUserSessions(userId: string, limit: number = 10): Promise<PathFinderSession[]> {
    const { data, error } = await supabase
      .from('pathfinder_game_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching user sessions:', error);
      throw error;
    }

    return data || [];
  }

  async getSessionMoves(sessionId: string): Promise<MoveHistory[]> {
    const { data, error } = await supabase
      .from('pathfinder_move_history')
      .select('*')
      .eq('session_id', sessionId)
      .order('move_number', { ascending: true });

    if (error) {
      console.error('Error fetching session moves:', error);
      throw error;
    }

    return data || [];
  }
}

export const pathFinderService = new PathFinderService();
