import { TilePattern } from '../types/pathfinder';

export const TILE_PATTERNS: TilePattern[] = [
  {
    id: 'straight_horizontal',
    pattern_name: 'Straight Horizontal',
    pattern_type: 'straight',
    arrow_directions: ['right', 'left'],
    connection_points: { left: true, right: true, top: false, bottom: false },
    difficulty_level: 1,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'straight_vertical',
    pattern_name: 'Straight Vertical',
    pattern_type: 'straight',
    arrow_directions: ['down', 'up'],
    connection_points: { left: false, right: false, top: true, bottom: true },
    difficulty_level: 1,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'corner_top_right',
    pattern_name: 'Corner Top Right',
    pattern_type: 'corner',
    arrow_directions: ['up', 'right'],
    connection_points: { left: false, right: true, top: true, bottom: false },
    difficulty_level: 1,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'corner_top_left',
    pattern_name: 'Corner Top Left',
    pattern_type: 'corner',
    arrow_directions: ['up', 'left'],
    connection_points: { left: true, right: false, top: true, bottom: false },
    difficulty_level: 1,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'corner_bottom_right',
    pattern_name: 'Corner Bottom Right',
    pattern_type: 'corner',
    arrow_directions: ['down', 'right'],
    connection_points: { left: false, right: true, top: false, bottom: true },
    difficulty_level: 1,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'corner_bottom_left',
    pattern_name: 'Corner Bottom Left',
    pattern_type: 'corner',
    arrow_directions: ['down', 'left'],
    connection_points: { left: true, right: false, top: false, bottom: true },
    difficulty_level: 1,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 't_junction_top',
    pattern_name: 'T-Junction Top',
    pattern_type: 't_junction',
    arrow_directions: ['left', 'right', 'down'],
    connection_points: { left: true, right: true, top: false, bottom: true },
    difficulty_level: 2,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 't_junction_bottom',
    pattern_name: 'T-Junction Bottom',
    pattern_type: 't_junction',
    arrow_directions: ['left', 'right', 'up'],
    connection_points: { left: true, right: true, top: true, bottom: false },
    difficulty_level: 2,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 't_junction_left',
    pattern_name: 'T-Junction Left',
    pattern_type: 't_junction',
    arrow_directions: ['up', 'down', 'right'],
    connection_points: { left: false, right: true, top: true, bottom: true },
    difficulty_level: 2,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 't_junction_right',
    pattern_name: 'T-Junction Right',
    pattern_type: 't_junction',
    arrow_directions: ['up', 'down', 'left'],
    connection_points: { left: true, right: false, top: true, bottom: true },
    difficulty_level: 2,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'cross',
    pattern_name: 'Cross',
    pattern_type: 'cross',
    arrow_directions: ['up', 'down', 'left', 'right'],
    connection_points: { left: true, right: true, top: true, bottom: true },
    difficulty_level: 3,
    is_active: true,
    created_at: new Date().toISOString()
  }
];

export function getTilePatternsByDifficulty(maxDifficulty: number): TilePattern[] {
  return TILE_PATTERNS.filter(pattern => pattern.difficulty_level <= maxDifficulty && pattern.is_active);
}

export function getTilePatternById(id: string): TilePattern | undefined {
  return TILE_PATTERNS.find(pattern => pattern.id === id);
}

export function getRandomTilePattern(maxDifficulty: number): TilePattern {
  const availablePatterns = getTilePatternsByDifficulty(maxDifficulty);
  return availablePatterns[Math.floor(Math.random() * availablePatterns.length)];
}
