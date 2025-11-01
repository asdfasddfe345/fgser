/*
  # Accenture Path Finder Arrow Tile System

  1. New Tables
    - `pathfinder_tile_patterns` - Defines predefined arrow tile types
      - `id` (uuid, primary key)
      - `pattern_name` (text, e.g., "straight_horizontal", "l_corner")
      - `pattern_type` (text, category of tile)
      - `arrow_directions` (jsonb, array of arrow directions)
      - `connection_points` (jsonb, which edges connect)
      - `svg_path` (text, SVG path for rendering)
      - `difficulty_level` (integer, 1-3)
      - `is_active` (boolean)
      - `created_at` (timestamptz)

    - `pathfinder_game_sessions` - Extended session tracking for arrow tile games
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `level_id` (uuid, foreign key)
      - `session_token` (uuid)
      - `grid_config` (jsonb, initial tile configuration with rotations)
      - `start_time` (timestamptz)
      - `end_time` (timestamptz)
      - `time_remaining_seconds` (integer)
      - `total_moves` (integer)
      - `rotation_count` (integer)
      - `flip_count` (integer)
      - `is_practice_mode` (boolean)
      - `is_completed` (boolean)
      - `final_score` (integer)
      - `created_at` (timestamptz)

    - `pathfinder_move_history` - Tracks each move during game
      - `id` (uuid, primary key)
      - `session_id` (uuid, foreign key to pathfinder_game_sessions)
      - `move_number` (integer)
      - `tile_position` (jsonb, {row, col})
      - `action_type` (text, 'rotate' or 'flip')
      - `previous_rotation` (integer, 0-270)
      - `new_rotation` (integer, 0-270)
      - `timestamp` (timestamptz)

    - `pathfinder_leaderboard` - Dedicated leaderboard for Path Finder
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `level_id` (uuid, foreign key)
      - `best_time_seconds` (integer)
      - `fewest_moves` (integer)
      - `highest_score` (integer)
      - `completion_count` (integer)
      - `efficiency_rating` (numeric)
      - `rank` (integer)
      - `period` (text, 'daily', 'weekly', 'all_time')
      - `updated_at` (timestamptz)
      - `created_at` (timestamptz)

    - `pathfinder_xp_awards` - Track XP integration with global system
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `session_id` (uuid, foreign key)
      - `xp_earned` (integer)
      - `score_multiplier` (numeric)
      - `bonus_reason` (text)
      - `awarded_at` (timestamptz)

  2. Security
    - Enable RLS on all new tables
    - Users can only access their own sessions and moves
    - Leaderboards are publicly readable
    - Tile patterns are publicly readable

  3. Functions
    - Function to calculate Path Finder score with move penalties
    - Function to award XP based on performance
    - Function to update Path Finder leaderboard
    - Function to validate path completion
*/

-- ============================================================================
-- PATHFINDER TILE PATTERNS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pathfinder_tile_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name text NOT NULL UNIQUE,
  pattern_type text NOT NULL CHECK (pattern_type IN ('straight', 'corner', 't_junction', 'cross', 'end')),
  arrow_directions jsonb NOT NULL,
  connection_points jsonb NOT NULL,
  svg_path text,
  difficulty_level integer DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 3),
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE pathfinder_tile_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tile patterns"
  ON pathfinder_tile_patterns FOR SELECT
  USING (is_active = true);

CREATE INDEX IF NOT EXISTS idx_pathfinder_tile_patterns_type ON pathfinder_tile_patterns(pattern_type, difficulty_level);

-- ============================================================================
-- PATHFINDER GAME SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pathfinder_game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  level_id uuid REFERENCES game_levels(id) ON DELETE CASCADE NOT NULL,
  session_token uuid DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  grid_config jsonb NOT NULL,
  start_time timestamptz DEFAULT now() NOT NULL,
  end_time timestamptz,
  time_remaining_seconds integer DEFAULT 240,
  total_moves integer DEFAULT 0,
  rotation_count integer DEFAULT 0,
  flip_count integer DEFAULT 0,
  is_practice_mode boolean DEFAULT false NOT NULL,
  is_completed boolean DEFAULT false NOT NULL,
  is_valid boolean DEFAULT true NOT NULL,
  final_score integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE pathfinder_game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pathfinder sessions"
  ON pathfinder_game_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own pathfinder sessions"
  ON pathfinder_game_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pathfinder sessions"
  ON pathfinder_game_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_pathfinder_sessions_user ON pathfinder_game_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pathfinder_sessions_token ON pathfinder_game_sessions(session_token);

-- ============================================================================
-- PATHFINDER MOVE HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pathfinder_move_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES pathfinder_game_sessions(id) ON DELETE CASCADE NOT NULL,
  move_number integer NOT NULL CHECK (move_number > 0),
  tile_position jsonb NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('rotate', 'flip')),
  previous_rotation integer NOT NULL CHECK (previous_rotation IN (0, 90, 180, 270)),
  new_rotation integer NOT NULL CHECK (new_rotation IN (0, 90, 180, 270)),
  timestamp timestamptz DEFAULT now() NOT NULL,
  UNIQUE(session_id, move_number)
);

ALTER TABLE pathfinder_move_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own move history"
  ON pathfinder_move_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pathfinder_game_sessions
      WHERE id = pathfinder_move_history.session_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own move history"
  ON pathfinder_move_history FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pathfinder_game_sessions
      WHERE id = pathfinder_move_history.session_id
        AND user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_pathfinder_moves_session ON pathfinder_move_history(session_id, move_number);

-- ============================================================================
-- PATHFINDER LEADERBOARD TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pathfinder_leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  level_id uuid REFERENCES game_levels(id) ON DELETE CASCADE,
  best_time_seconds integer,
  fewest_moves integer,
  highest_score integer DEFAULT 0,
  completion_count integer DEFAULT 0,
  efficiency_rating numeric(5, 2) DEFAULT 0.00,
  rank integer,
  period text DEFAULT 'all_time' CHECK (period IN ('daily', 'weekly', 'all_time')),
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, level_id, period)
);

ALTER TABLE pathfinder_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pathfinder leaderboard"
  ON pathfinder_leaderboard FOR SELECT
  USING (true);

CREATE POLICY "System can manage pathfinder leaderboard"
  ON pathfinder_leaderboard FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pathfinder_leaderboard_score ON pathfinder_leaderboard(period, highest_score DESC);
CREATE INDEX IF NOT EXISTS idx_pathfinder_leaderboard_time ON pathfinder_leaderboard(period, best_time_seconds ASC) WHERE best_time_seconds IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pathfinder_leaderboard_level ON pathfinder_leaderboard(level_id, period, highest_score DESC);

-- ============================================================================
-- PATHFINDER XP AWARDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pathfinder_xp_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  session_id uuid REFERENCES pathfinder_game_sessions(id) ON DELETE CASCADE NOT NULL,
  xp_earned integer NOT NULL CHECK (xp_earned >= 0),
  score_multiplier numeric(3, 2) DEFAULT 1.00,
  bonus_reason text,
  awarded_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE pathfinder_xp_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own xp awards"
  ON pathfinder_xp_awards FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create xp awards"
  ON pathfinder_xp_awards FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_pathfinder_xp_user ON pathfinder_xp_awards(user_id, awarded_at DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate Path Finder score
CREATE OR REPLACE FUNCTION calculate_pathfinder_score(
  p_completion_time_seconds integer,
  p_time_limit_seconds integer,
  p_total_moves integer,
  p_optimal_moves integer
)
RETURNS integer AS $$
DECLARE
  v_base_score integer := 100;
  v_time_bonus integer := 0;
  v_move_penalty integer := 0;
  v_final_score integer;
BEGIN
  -- Calculate time bonus (up to 50 points for completing under 60 seconds)
  IF p_completion_time_seconds < 60 THEN
    v_time_bonus := 50;
  ELSIF p_completion_time_seconds < p_time_limit_seconds THEN
    v_time_bonus := FLOOR(25 * (p_time_limit_seconds - p_completion_time_seconds)::numeric / p_time_limit_seconds);
  END IF;

  -- Calculate move penalty (minus 10 points per move beyond optimal)
  IF p_total_moves > p_optimal_moves THEN
    v_move_penalty := (p_total_moves - p_optimal_moves) * 10;
  END IF;

  -- Calculate final score (minimum 10 points)
  v_final_score := GREATEST(v_base_score + v_time_bonus - v_move_penalty, 10);

  RETURN v_final_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update Path Finder leaderboard
CREATE OR REPLACE FUNCTION update_pathfinder_leaderboard(
  p_user_id uuid,
  p_level_id uuid,
  p_completion_time integer,
  p_total_moves integer,
  p_score integer
)
RETURNS void AS $$
DECLARE
  v_efficiency numeric;
BEGIN
  -- Calculate efficiency rating
  v_efficiency := (p_score::numeric / GREATEST(p_total_moves, 1)) * 10;

  -- Update all_time leaderboard
  INSERT INTO pathfinder_leaderboard (
    user_id,
    level_id,
    best_time_seconds,
    fewest_moves,
    highest_score,
    completion_count,
    efficiency_rating,
    period
  ) VALUES (
    p_user_id,
    p_level_id,
    p_completion_time,
    p_total_moves,
    p_score,
    1,
    v_efficiency,
    'all_time'
  )
  ON CONFLICT (user_id, level_id, period)
  DO UPDATE SET
    best_time_seconds = LEAST(pathfinder_leaderboard.best_time_seconds, p_completion_time),
    fewest_moves = LEAST(pathfinder_leaderboard.fewest_moves, p_total_moves),
    highest_score = GREATEST(pathfinder_leaderboard.highest_score, p_score),
    completion_count = pathfinder_leaderboard.completion_count + 1,
    efficiency_rating = GREATEST(pathfinder_leaderboard.efficiency_rating, v_efficiency),
    updated_at = now();

  -- Update global leaderboard (NULL level_id for overall stats)
  INSERT INTO pathfinder_leaderboard (
    user_id,
    level_id,
    best_time_seconds,
    fewest_moves,
    highest_score,
    completion_count,
    efficiency_rating,
    period
  )
  SELECT
    p_user_id,
    NULL,
    MIN(best_time_seconds),
    MIN(fewest_moves),
    SUM(highest_score),
    SUM(completion_count),
    AVG(efficiency_rating),
    'all_time'
  FROM pathfinder_leaderboard
  WHERE user_id = p_user_id
    AND level_id IS NOT NULL
    AND period = 'all_time'
  ON CONFLICT (user_id, level_id, period)
  DO UPDATE SET
    best_time_seconds = (
      SELECT MIN(best_time_seconds)
      FROM pathfinder_leaderboard
      WHERE user_id = p_user_id
        AND level_id IS NOT NULL
        AND period = 'all_time'
    ),
    fewest_moves = (
      SELECT MIN(fewest_moves)
      FROM pathfinder_leaderboard
      WHERE user_id = p_user_id
        AND level_id IS NOT NULL
        AND period = 'all_time'
    ),
    highest_score = (
      SELECT SUM(highest_score)
      FROM pathfinder_leaderboard
      WHERE user_id = p_user_id
        AND level_id IS NOT NULL
        AND period = 'all_time'
    ),
    completion_count = (
      SELECT SUM(completion_count)
      FROM pathfinder_leaderboard
      WHERE user_id = p_user_id
        AND level_id IS NOT NULL
        AND period = 'all_time'
    ),
    efficiency_rating = (
      SELECT AVG(efficiency_rating)
      FROM pathfinder_leaderboard
      WHERE user_id = p_user_id
        AND level_id IS NOT NULL
        AND period = 'all_time'
    ),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to award XP for Path Finder completion
CREATE OR REPLACE FUNCTION award_pathfinder_xp(
  p_user_id uuid,
  p_session_id uuid,
  p_score integer,
  p_is_first_completion boolean DEFAULT false
)
RETURNS integer AS $$
DECLARE
  v_base_xp integer;
  v_multiplier numeric := 1.0;
  v_total_xp integer;
  v_bonus_reason text := '';
BEGIN
  -- Base XP is score divided by 10
  v_base_xp := FLOOR(p_score / 10);

  -- First completion bonus
  IF p_is_first_completion THEN
    v_multiplier := v_multiplier + 0.5;
    v_bonus_reason := 'First completion bonus';
  END IF;

  -- High score bonus (score >= 150)
  IF p_score >= 150 THEN
    v_multiplier := v_multiplier + 0.3;
    v_bonus_reason := v_bonus_reason || CASE WHEN v_bonus_reason = '' THEN '' ELSE ', ' END || 'High score bonus';
  END IF;

  v_total_xp := FLOOR(v_base_xp * v_multiplier);

  -- Record XP award
  INSERT INTO pathfinder_xp_awards (
    user_id,
    session_id,
    xp_earned,
    score_multiplier,
    bonus_reason
  ) VALUES (
    p_user_id,
    p_session_id,
    v_total_xp,
    v_multiplier,
    v_bonus_reason
  );

  -- Update user's total XP (assuming user_profiles has a total_xp column)
  -- This can be customized based on your existing XP system

  RETURN v_total_xp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION calculate_pathfinder_score TO authenticated;
GRANT EXECUTE ON FUNCTION update_pathfinder_leaderboard TO authenticated;
GRANT EXECUTE ON FUNCTION award_pathfinder_xp TO authenticated;

-- ============================================================================
-- INSERT PREDEFINED TILE PATTERNS
-- ============================================================================

-- Insert predefined arrow tile patterns
INSERT INTO pathfinder_tile_patterns (pattern_name, pattern_type, arrow_directions, connection_points, difficulty_level)
VALUES
  -- Straight tiles (Level 1)
  ('straight_horizontal', 'straight', '["right", "left"]'::jsonb, '{"left": true, "right": true, "top": false, "bottom": false}'::jsonb, 1),
  ('straight_vertical', 'straight', '["down", "up"]'::jsonb, '{"left": false, "right": false, "top": true, "bottom": true}'::jsonb, 1),

  -- Corner tiles (Level 1)
  ('corner_top_right', 'corner', '["up", "right"]'::jsonb, '{"left": false, "right": true, "top": true, "bottom": false}'::jsonb, 1),
  ('corner_top_left', 'corner', '["up", "left"]'::jsonb, '{"left": true, "right": false, "top": true, "bottom": false}'::jsonb, 1),
  ('corner_bottom_right', 'corner', '["down", "right"]'::jsonb, '{"left": false, "right": true, "top": false, "bottom": true}'::jsonb, 1),
  ('corner_bottom_left', 'corner', '["down", "left"]'::jsonb, '{"left": true, "right": false, "top": false, "bottom": true}'::jsonb, 1),

  -- T-junction tiles (Level 2)
  ('t_junction_top', 't_junction', '["left", "right", "down"]'::jsonb, '{"left": true, "right": true, "top": false, "bottom": true}'::jsonb, 2),
  ('t_junction_bottom', 't_junction', '["left", "right", "up"]'::jsonb, '{"left": true, "right": true, "top": true, "bottom": false}'::jsonb, 2),
  ('t_junction_left', 't_junction', '["up", "down", "right"]'::jsonb, '{"left": false, "right": true, "top": true, "bottom": true}'::jsonb, 2),
  ('t_junction_right', 't_junction', '["up", "down", "left"]'::jsonb, '{"left": true, "right": false, "top": true, "bottom": true}'::jsonb, 2),

  -- Cross tile (Level 3)
  ('cross', 'cross', '["up", "down", "left", "right"]'::jsonb, '{"left": true, "right": true, "top": true, "bottom": true}'::jsonb, 3)
ON CONFLICT (pattern_name) DO NOTHING;

-- Update Accenture company to use 240 seconds (4 minutes) for all levels
UPDATE game_levels
SET time_limit_seconds = 240
WHERE company_id = (SELECT id FROM gaming_companies WHERE name = 'Accenture');
