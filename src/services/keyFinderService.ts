import { supabase } from '../lib/supabaseClient';
import {
  MazeGrid,
  Position,
  CellType,
  Direction,
  DifficultyConfig,
} from '../types/keyFinder';

type Level = 'easy'|'medium'|'hard';

class KeyFinderService {
  // Local fallbacks (used if DB rows missing)
  private defaults: Record<Level, DifficultyConfig> = {
    easy:   { gridSize: 8,  wallDensity: 0.20, timeLimitSeconds: 300, optimalMovesMultiplier: 1.3 },
    medium: { gridSize: 10, wallDensity: 0.28, timeLimitSeconds: 300, optimalMovesMultiplier: 1.5 },
    hard:   { gridSize: 12, wallDensity: 0.33, timeLimitSeconds: 300, optimalMovesMultiplier: 1.7 },
  };

  private cache = new Map<Level, DifficultyConfig>();
  private lastFetch = new Map<Level, number>();
  private cacheMs = 60_000;

  async getConfig(difficulty: Level): Promise<DifficultyConfig> {
    const now = Date.now();
    const last = this.lastFetch.get(difficulty) ?? 0;
    if (this.cache.has(difficulty) && now - last < this.cacheMs) {
      return this.cache.get(difficulty)!;
    }

    const { data, error } = await supabase
      .from('key_finder_config')
      .select('grid_size, wall_density, time_limit_seconds, optimal_moves_multiplier')
      .eq('difficulty', difficulty)
      .maybeSingle();

    let cfg: DifficultyConfig;
    if (!error && data) {
      cfg = {
        gridSize: data.grid_size,
        wallDensity: Number(data.wall_density),
        timeLimitSeconds: data.time_limit_seconds,
        optimalMovesMultiplier: Number(data.optimal_moves_multiplier),
      };
    } else {
      cfg = this.defaults[difficulty];
    }
    this.cache.set(difficulty, cfg);
    this.lastFetch.set(difficulty, now);
    return cfg;
  }

  // Maze generator (start at row=0, col=0 to match your UI)
  generateMaze(config: DifficultyConfig): MazeGrid {
    const { gridSize, wallDensity } = config;
    const cells: CellType[][] = Array.from({ length: gridSize }, () =>
      Array<CellType>(gridSize).fill('empty')
    );

    const wallCount = Math.floor(gridSize * gridSize * wallDensity);
    let placed = 0;
    while (placed < wallCount) {
      const r = Math.floor(Math.random() * gridSize);
      const c = Math.floor(Math.random() * gridSize);
      if ((r === 0 && c === 0) || cells[r][c] !== 'empty') continue;
      cells[r][c] = 'wall';
      placed++;
    }

    const startPosition: Position = { row: 0, col: 0 };
    const keyPosition    = this.findEmpty(cells, gridSize, [startPosition]);
    const exitPosition   = this.findEmpty(cells, gridSize, [startPosition, keyPosition]);

    cells[startPosition.row][startPosition.col] = 'start';
    cells[keyPosition.row][keyPosition.col] = 'key';
    cells[exitPosition.row][exitPosition.col] = 'exit';

    const pathToKey  = this.findPath(cells, gridSize, startPosition, keyPosition);
    const pathToExit = this.findPath(cells, gridSize, keyPosition, exitPosition);

    // If unsolvable, regenerate once with fewer walls
    if (pathToKey.length === 0 || pathToExit.length === 0) {
      return this.generateMaze({ ...config, wallDensity: Math.max(0, wallDensity - 0.1) });
    }

    return {
      cells,
      gridSize,
      startPosition,
      keyPosition,
      exitPosition,
      optimalPathLength: pathToKey.length + pathToExit.length,
    };
  }

  private findEmpty(cells: CellType[][], n: number, exclude: Position[]): Position {
    for (let tries = 0; tries < 200; tries++) {
      const row = Math.floor(Math.random() * n);
      const col = Math.floor(Math.random() * n);
      const isEx = exclude.some(p => p.row === row && p.col === col);
      if (!isEx && cells[row][col] === 'empty') return { row, col };
    }
    // fallback linear scan
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const isEx = exclude.some(p => p.row === r && p.col === c);
      if (!isEx && cells[r][c] === 'empty') return { row: r, col: c };
    }
    return { row: 0, col: 1 };
  }

  private neighbors(p: Position, n: number): Position[] {
    const out: Position[] = [];
    if (p.row > 0) out.push({ row: p.row - 1, col: p.col });
    if (p.row < n - 1) out.push({ row: p.row + 1, col: p.col });
    if (p.col > 0) out.push({ row: p.row, col: p.col - 1 });
    if (p.col < n - 1) out.push({ row: p.row, col: p.col + 1 });
    return out;
    }

  private findPath(cells: CellType[][], n: number, s: Position, e: Position): Position[] {
    const seen = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
    const q: { p: Position; path: Position[] }[] = [{ p: s, path: [s] }];
    seen[s.row][s.col] = true;

    while (q.length) {
      const { p, path } = q.shift()!;
      if (p.row === e.row && p.col === e.col) return path;
      for (const nb of this.neighbors(p, n)) {
        if (seen[nb.row][nb.col]) continue;
        const t = cells[nb.row][nb.col];
        if (t === 'wall') continue;
        seen[nb.row][nb.col] = true;
        q.push({ p: nb, path: [...path, nb] });
      }
    }
    return [];
  }

  // optional helper if you want server-side move validation
  canMove(current: Position, dir: Direction, maze: MazeGrid) {
    const n = maze.gridSize;
    let r = current.row, c = current.col;
    if (dir === 'up') r--; else if (dir === 'down') r++;
    else if (dir === 'left') c--; else if (dir === 'right') c++;
    if (r < 0 || r >= n || c < 0 || c >= n) return { canMove: false, hitWall: true, newPosition: null };
    if (maze.cells[r][c] === 'wall') return { canMove: false, hitWall: true, newPosition: null };
    return { canMove: true, hitWall: false, newPosition: { row: r, col: c } };
  }

  // ===== Results persistence used by your component =====
  async saveGameResult(params: {
    user_id: string;
    difficulty: Level;
    score: number;
    time_taken: number;
    moves_count: number;
    completed: boolean;
  }) {
    const { error } = await supabase.from('key_finder_results').insert(params);
    if (error) throw error;
  }
}

export const keyFinderService = new KeyFinderService();
