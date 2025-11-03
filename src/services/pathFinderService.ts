import { supabase } from '../lib/supabaseClient'; // ok if undefined; calls are try/caught
import {
  GridConfig, GridTile, TileRotation, PathValidationResult, ScoreCalculation,
  PathFinderSession, PathFinderLeaderboardEntry, MoveHistory, ConnectionPoints
} from '../types/pathfinder';
import { getRandomTilePattern } from '../data/tilePatterns';
import { rotateDirections, OPP } from '../helpers/direction';

class PathFinderService {
  generateGrid(gridSize: number, levelNumber: number): GridConfig {
    const maxDifficulty = Math.min(levelNumber, 3);
    const tiles: GridTile[][] = [];

    const startPosition = { row: Math.floor(gridSize / 2), col: 0 };
    const endPosition = { row: Math.floor(gridSize / 2), col: gridSize - 1 };

    for (let r = 0; r < gridSize; r++) {
      tiles[r] = [];
      for (let c = 0; c < gridSize; c++) {
        const pattern = getRandomTilePattern(maxDifficulty);
        const rotation: TileRotation = [0, 90, 180, 270][Math.floor(Math.random() * 4)] as TileRotation;
        tiles[r][c] = {
          row: r, col: c, pattern, rotation,
          isStart: r === startPosition.row && c === startPosition.col,
          isEnd: r === endPosition.row && c === endPosition.col,
          isSelected: false, isInPath: false
        };
      }
    }

    return {
      tiles, gridSize, startPosition, endPosition,
      optimalMoves: Math.floor((gridSize - 1) * 1.5 * (1 + levelNumber * 0.1))
    };
  }

  rotateConnectionPoints(connections: ConnectionPoints, rotation: TileRotation): ConnectionPoints {
    if (rotation === 0) return connections;
    let res = { ...connections };
    const turns = rotation / 90;
    for (let i = 0; i < turns; i++) {
      res = { left: res.bottom, right: res.top, top: res.left, bottom: res.right };
    }
    return res;
  }

  validatePath(grid: GridConfig): PathValidationResult {
    const { tiles, startPosition, endPosition, gridSize } = grid;
    const seen = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
    const q: { row: number; col: number; path: { row: number; col: number }[] }[] =
      [{ ...startPosition, path: [startPosition] }];
    seen[startPosition.row][startPosition.col] = true;

    while (q.length) {
      const cur = q.shift()!;
      if (cur.row === endPosition.row && cur.col === endPosition.col) {
        return { isValid: true, pathTiles: cur.path, message: 'Valid path found!' };
      }

      const curTile = tiles[cur.row][cur.col];
      const exits = rotateDirections(curTile.pattern.arrow_directions, curTile.rotation);

      const neigh = [
        { nr: cur.row - 1, nc: cur.col, dir: 'up' as const },
        { nr: cur.row + 1, nc: cur.col, dir: 'down' as const },
        { nr: cur.row, nc: cur.col - 1, dir: 'left' as const },
        { nr: cur.row, nc: cur.col + 1, dir: 'right' as const },
      ];

      for (const { nr, nc, dir } of neigh) {
        if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize || seen[nr][nc]) continue;
        if (!exits.includes(dir)) continue;

        const nxt = tiles[nr][nc];
        const nxtExits = rotateDirections(nxt.pattern.arrow_directions, nxt.rotation);
        if (!nxtExits.includes(OPP[dir])) continue;

        seen[nr][nc] = true;
        q.push({ row: nr, col: nc, path: [...cur.path, { row: nr, col: nc }] });
      }
    }
    return { isValid: false, pathTiles: [], message: 'No valid path found. Keep adjusting tiles!' };
  }

  rotateTile(tile: GridTile): GridTile {
    return { ...tile, rotation: ((tile.rotation + 90) % 360) as TileRotation };
  }

  flipTile(tile: GridTile): GridTile {
    const t = tile.pattern.pattern_type;
    let rot = tile.rotation;
    if (t === 'straight') rot = rot % 180 === 0 ? ((rot + 90) % 360 as TileRotation) : ((rot + 270) % 360 as TileRotation);
    else if (t === 'corner') rot = rot === 90 ? 270 : rot === 270 ? 90 : rot;
    else rot = ((rot + 180) % 360) as TileRotation;
    return { ...tile, rotation: rot };
  }

  calculateScore(done: number, limit: number, moves: number, optimal: number): ScoreCalculation {
    const base = 100;
    let timeBonus = 0;
    if (done < 60) timeBonus = 50;
    else if (done < limit) timeBonus = Math.floor((25 * (limit - done)) / limit);
    const penalty = moves > optimal ? (moves - optimal) * 10 : 0;
    const finalScore = Math.max(base + timeBonus - penalty, 10);
    return { baseScore: base, timeBonus, movePenalty: penalty, finalScore, efficiency: moves ? (optimal / moves) * 100 : 100 };
  }

  // Supabase calls are optional; we guard with try/catch so app runs without it
  async createSession(userId: string, levelId: string, grid: GridConfig, practice = false): Promise<PathFinderSession> {
    try {
      const { data, error } = await supabase
        .from('pathfinder_game_sessions')
        .insert({
          user_id: userId, level_id: levelId, grid_config: grid,
          time_remaining_seconds: 240, is_practice_mode: practice,
          is_completed: false, is_valid: true, final_score: 0
        }).select().single();
      if (error) throw error;
      return data as PathFinderSession;
    } catch {
      return {
        id: 'local-session', user_id: userId, level_id: levelId, session_token: 'local',
        grid_config: grid, start_time: new Date().toISOString(), time_remaining_seconds: 240,
        total_moves: 0, rotation_count: 0, flip_count: 0, is_practice_mode: practice,
        is_completed: false, is_valid: true, final_score: 0, created_at: new Date().toISOString()
      } as any;
    }
  }

  async recordMove(..._args: any): Promise<MoveHistory> {
    return { id: 'local', session_id: 'local', move_number: 0, tile_position: { row: 0, col: 0 }, action_type: 'rotate', previous_rotation: 0, new_rotation: 0, timestamp: new Date().toISOString() };
  }
  async completeSession(..._args: any): Promise<void> { return; }
  async updateLeaderboard(..._args: any): Promise<void> { return; }
  async getLeaderboard(..._args: any): Promise<PathFinderLeaderboardEntry[]> { return []; }
  async awardXP(..._args: any): Promise<number> { return 0; }
}

export const pathFinderService = new PathFinderService();
