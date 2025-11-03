// src/services/pathFinderService.ts
import { supabase } from '../lib/supabaseClient';
import {
  GridConfig,
  GridTile,
  TileRotation,
  PathValidationResult,
  ScoreCalculation,
  PathFinderSession,
  PathFinderLeaderboardEntry,
  MoveHistory,
  ConnectionPoints
} from '../types/pathfinder';
import { getRandomTilePattern } from '../data/tilePatterns';
import { rotateDirections, OPP } from '../helpers/direction';

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
    const seen = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
    const q: { row: number; col: number; path: { row: number; col: number }[] }[] = [
      { ...startPosition, path: [startPosition] }
    ];
    seen[startPosition.row][startPosition.col] = true;

    while (q.length) {
      const cur = q.shift()!;
      if (cur.row === endPosition.row && cur.col === endPosition.col) {
        return { isValid: true, pathTiles: cur.path, message: 'Valid path found!' };
      }

      const curTile = tiles[cur.row][cur.col];
      const curExits = rotateDirections(curTile.pattern.arrow_directions, curTile.rotation);

      const candidates: { nr: number; nc: number; dir: 'up' | 'down' | 'left' | 'right' }[] = [
        { nr: cur.row - 1, nc: cur.col, dir: 'up' },
        { nr: cur.row + 1, nc: cur.col, dir: 'down' },
        { nr: cur.row, nc: cur.col - 1, dir: 'left' },
        { nr: cur.row, nc: cur.col + 1, dir: 'right' }
      ];

      for (const { nr, nc, dir } of candidates) {
        if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize || seen[nr][nc]) continue;
        if (!curExits.includes(dir)) continue;

        const nxtTile = tiles[nr][nc];
        const nxtExits = rotateDirections(nxtTile.pattern.arrow_directions, nxtTile.rotation);
        if (!nxtExits.includes(OPP[dir])) continue;

        seen[nr][nc] = true;
        q.push({ row: nr, col: nc, path: [...cur.path, { row: nr, col: nc }] });
      }
    }

    return { isValid: false, pathTiles: [], message: 'No valid path found. Keep adjusting tiles!' };
  }

  rotateTile(tile: GridTile): GridTile {
    const newRotation = ((tile.rotation + 90) % 360) as TileRotation;
    return { ...tile, rotation: newRotation };
  }

  flipTile(tile: GridTile): GridTile {
    const t = tile.pattern.pattern_type;
    let rot = tile.rotation;

    if (t === 'straight') {
      rot = rot % 180 === 0 ? ((rot + 90) % 360 as TileRotation) : ((rot + 270) % 360 as TileRotation);
    } else if (t === 'corner') {
      rot = rot === 90 ? 270 : rot === 270 ? 90 : rot;
    } else {
      rot = ((rot + 180) % 360) as TileRotation;
    }
    return { ...tile, rotation: rot };
  }

  calculateScore(
    completionTimeSeconds: number,
    timeLimitSeconds: number,
    totalMoves: number,
    optimalMoves: number
  ): ScoreCalculation {
    const baseScore = 100;

    let timeBonus = 0;
    if (completionTimeSeconds < 60) timeBonus = 50;
    else if (completionTimeSeconds < timeLimitSeconds) {
      timeBonus = Math.floor((25 * (timeLimitSeconds - completionTimeSeconds)) / timeLimitSeconds);
    }

    let movePenalty = 0;
    if (totalMoves > optimalMoves) movePenalty = (totalMoves - optimalMoves) * 10;

    const finalScore = Math.max(baseScore + timeBonus - movePenalty, 10);
    const efficiency = totalMoves > 0 ? (optimalMoves / totalMoves) * 100 : 100;

    return { baseScore, timeBonus, movePenalty, finalScore, efficiency };
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

    if (error) throw error;
    return data as PathFinderSession;
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

    if (error) throw error;
    return data as MoveHistory;
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

    if (error) throw error;
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
    if (error) throw error;
  }

  async getLeaderboard(
    levelId?: string,
    period: 'daily' | 'weekly' | 'all_time' = 'all_time',
    limit: number = 100
  ): Promise<PathFinderLeaderboardEntry[]> {
    let query = supabase
      .from('pathfinder_leaderboard')
      .select(`*, user_profiles!inner(full_name, email)`)
      .eq('period', period)
      .order('highest_score', { ascending: false })
      .limit(limit);

    query = levelId ? query.eq('level_id', levelId) : query.is('level_id', null);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((entry: any, index: number) => ({
      ...entry,
      rank: index + 1,
      user_name: entry.user_profiles?.full_name || 'Anonymous',
      user_email: entry.user_profiles?.email
    }));
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

    if (error) throw error;
    return data || 0;
  }
}

export const pathFinderService = new PathFinderService();
