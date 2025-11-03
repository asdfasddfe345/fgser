import { GridConfig, GridTile, TileRotation, PathValidationResult, ConnectionPoints, ScoreCalculation } from '../types/pathfinder';
import { getRandomTilePattern } from '../data/tilePatterns';

class PathFinderService {
  generateGrid(gridSize: number, levelNumber: number): GridConfig {
    const maxDifficulty = Math.min(levelNumber, 3);
    const tiles: GridTile[][] = [];

    const startPosition = { row: Math.floor(gridSize / 2), col: 0 };
    const endPosition   = { row: Math.floor(gridSize / 2), col: gridSize - 1 };

    for (let r = 0; r < gridSize; r++) {
      tiles[r] = [];
      for (let c = 0; c < gridSize; c++) {
        const pattern = getRandomTilePattern(maxDifficulty);
        const rotation: TileRotation = [0,90,180,270][Math.floor(Math.random()*4)] as TileRotation;
        tiles[r][c] = {
          row: r, col: c, pattern, rotation,
          isStart: r===startPosition.row && c===startPosition.col,
          isEnd: r===endPosition.row && c===endPosition.col,
          isSelected: false, isInPath: false
        };
      }
    }

    return {
      tiles,
      gridSize,
      startPosition,
      endPosition,
      optimalMoves: this.estimateOptimalMoves(gridSize, levelNumber)
    };
  }

  private estimateOptimalMoves(gridSize:number, level:number) {
    const base = (gridSize-1);
    return Math.max(4, Math.floor(base * 1.5 * (1 + level*0.1)));
  }

  rotateTile(tile: GridTile): GridTile {
    const rotation = ((tile.rotation + 90) % 360) as TileRotation;
    return { ...tile, rotation };
  }
  flipTile(tile: GridTile): GridTile {
    const rotation = ((tile.rotation + 180) % 360) as TileRotation;
    return { ...tile, rotation };
  }

  private rotateConnections(conns: ConnectionPoints, rot: TileRotation): ConnectionPoints {
    if (rot === 0) return conns;
    let r = { ...conns };
    const k = rot/90;
    for (let i=0;i<k;i++){
      r = { left: r.bottom, right: r.top, top: r.left, bottom: r.right };
    }
    return r;
  }

  validatePath(grid: GridConfig): PathValidationResult {
    const { tiles, startPosition, endPosition, gridSize } = grid;
    const visited = Array.from({length:gridSize},()=>Array(gridSize).fill(false));
    const q: {row:number;col:number;path:{row:number;col:number}[]}[] = [{...startPosition, path:[startPosition]}];
    visited[startPosition.row][startPosition.col] = true;

    while (q.length){
      const cur = q.shift()!;
      if (cur.row===endPosition.row && cur.col===endPosition.col){
        return { isValid:true, pathTiles:cur.path, message:'Valid path found' };
      }
      const curTile = tiles[cur.row][cur.col];
      const curConn = this.rotateConnections(curTile.pattern.connection_points, curTile.rotation);

      const nb = [
        {row:cur.row-1,col:cur.col, dir:'top' as const, opp:'bottom' as const},
        {row:cur.row+1,col:cur.col, dir:'bottom' as const, opp:'top' as const},
        {row:cur.row,col:cur.col-1, dir:'left' as const, opp:'right' as const},
        {row:cur.row,col:cur.col+1, dir:'right' as const, opp:'left' as const},
      ];

      for (const n of nb){
        if (n.row<0||n.row>=gridSize||n.col<0||n.col>=gridSize||visited[n.row][n.col]) continue;
        if (!curConn[n.dir]) continue;

        const t = tiles[n.row][n.col];
        const tConn = this.rotateConnections(t.pattern.connection_points, t.rotation);
        if (!tConn[n.opp]) continue;

        visited[n.row][n.col] = true;
        q.push({ row:n.row, col:n.col, path:[...cur.path, {row:n.row,col:n.col}] });
      }
    }
    return { isValid:false, pathTiles:[], message:'No valid path yet' };
  }

  calculateScore(elapsed: number, limit: number, moves: number, optimal: number): ScoreCalculation {
    const base = 100;
    const timeBonus = elapsed<60 ? 50 : Math.max(0, Math.floor(25*(limit-elapsed)/limit));
    const penalty = Math.max(0, (moves - optimal) * 10);
    const final = Math.max(10, base + timeBonus - penalty);
    const efficiency = Math.min(100, Math.round((optimal/Math.max(1,moves))*100));
    return { baseScore:base, timeBonus, movePenalty:penalty, finalScore:final, efficiency };
  }
}
export const pathFinderService = new PathFinderService();
