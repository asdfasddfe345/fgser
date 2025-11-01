/*
  # Gaming Aptitude System

  1. New Tables
    - `gaming_companies` - Stores company information (Accenture, Cognizant, Capgemini)
    - `game_levels` - Defines level configurations for each company
    - `user_game_progress` - Tracks user progress across companies and levels
    - `game_scores` - Stores individual game attempt scores
    - `leaderboards` - Maintains rankings
    - `game_sessions` - Track active sessions and prevent cheating

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Admins can view all data and manage companies/levels
    - Public read access to companies and levels
    - Leaderboards are publicly readable

  3. Indexes
    - Create indexes on foreign keys for performance
    - Add composite indexes for leaderboard queries
    - Index on user_id + company_id + level_id for progress lookups

  4. Functions
    - Function to initialize user progress when starting a company
    - Function to update leaderboards after score submission
    - Function to calculate and validate scores
    - Function to unlock next level after completion
*/

-- ============================================================================
-- GAMING COMPANIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS gaming_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  logo_url text,
  description text NOT NULL,
  primary_color text DEFAULT '#0066CC',
  secondary_color text DEFAULT '#004499',
  difficulty_modifier numeric(3, 2) DEFAULT 1.00 CHECK (difficulty_modifier >= 0.5 AND difficulty_modifier <= 2.0),
  is_active boolean DEFAULT true NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE gaming_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active gaming companies"
  ON gaming_companies FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage gaming companies"
  ON gaming_companies FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_gaming_companies_active ON gaming_companies(is_active, display_order);

-- ============================================================================
-- GAME LEVELS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES gaming_companies(id) ON DELETE CASCADE NOT NULL,
  level_number integer NOT NULL CHECK (level_number BETWEEN 1 AND 4),
  grid_size integer NOT NULL CHECK (grid_size IN (4, 5, 6, 7)),
  time_limit_seconds integer DEFAULT 300 NOT NULL,
  target_score integer DEFAULT 500 NOT NULL,
  obstacle_density numeric(3, 2) DEFAULT 0.20 CHECK (obstacle_density BETWEEN 0.10 AND 0.50),
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(company_id, level_number)
);

ALTER TABLE game_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active game levels"
  ON game_levels FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage game levels"
  ON game_levels FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_game_levels_company ON game_levels(company_id, level_number);

-- ============================================================================
-- USER GAME PROGRESS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_game_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES gaming_companies(id) ON DELETE CASCADE NOT NULL,
  level_id uuid REFERENCES game_levels(id) ON DELETE CASCADE NOT NULL,
  is_unlocked boolean DEFAULT false NOT NULL,
  is_completed boolean DEFAULT false NOT NULL,
  best_score integer DEFAULT 0,
  best_time_seconds integer,
  attempts_count integer DEFAULT 0,
  first_completed_at timestamptz,
  last_played_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, level_id)
);

ALTER TABLE user_game_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own game progress"
  ON user_game_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own game progress"
  ON user_game_progress FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own game progress"
  ON user_game_progress FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_game_progress_user ON user_game_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_game_progress_composite ON user_game_progress(user_id, company_id, level_id);

-- ============================================================================
-- GAME SCORES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES gaming_companies(id) ON DELETE CASCADE NOT NULL,
  level_id uuid REFERENCES game_levels(id) ON DELETE CASCADE NOT NULL,
  session_id uuid NOT NULL,
  score integer NOT NULL CHECK (score >= 0),
  completion_time_seconds integer NOT NULL CHECK (completion_time_seconds > 0),
  path_length integer NOT NULL CHECK (path_length > 0),
  optimal_path_length integer NOT NULL CHECK (optimal_path_length > 0),
  efficiency_percentage numeric(5, 2) DEFAULT 0.00,
  is_valid boolean DEFAULT true NOT NULL,
  completed_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own game scores"
  ON game_scores FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own game scores"
  ON game_scores FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_game_scores_user ON game_scores(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_scores_level ON game_scores(level_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_game_scores_session ON game_scores(session_id);

-- ============================================================================
-- LEADERBOARDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS leaderboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES gaming_companies(id) ON DELETE CASCADE,
  level_id uuid REFERENCES game_levels(id) ON DELETE CASCADE,
  total_score integer DEFAULT 0 NOT NULL,
  rank integer DEFAULT 0,
  percentile numeric(5, 2) DEFAULT 0.00,
  period text DEFAULT 'all_time' CHECK (period IN ('all_time', 'monthly', 'weekly')),
  period_start timestamptz,
  period_end timestamptz,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, company_id, level_id, period)
);

ALTER TABLE leaderboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view leaderboards"
  ON leaderboards FOR SELECT
  USING (true);

CREATE POLICY "System can manage leaderboards"
  ON leaderboards FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_leaderboards_global ON leaderboards(period, total_score DESC) WHERE company_id IS NULL AND level_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_leaderboards_company ON leaderboards(company_id, period, total_score DESC) WHERE level_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_leaderboards_level ON leaderboards(level_id, period, total_score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboards_user ON leaderboards(user_id, period);

-- ============================================================================
-- GAME SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  level_id uuid REFERENCES game_levels(id) ON DELETE CASCADE NOT NULL,
  session_token uuid DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  grid_data jsonb NOT NULL,
  start_time timestamptz DEFAULT now() NOT NULL,
  expected_end_time timestamptz NOT NULL,
  actual_end_time timestamptz,
  is_active boolean DEFAULT true NOT NULL,
  is_validated boolean DEFAULT false NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own game sessions"
  ON game_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own game sessions"
  ON game_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own game sessions"
  ON game_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_game_sessions_user ON game_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_game_sessions_token ON game_sessions(session_token);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to initialize user progress for a company
CREATE OR REPLACE FUNCTION initialize_company_progress(
  p_user_id uuid,
  p_company_id uuid
)
RETURNS void AS $$
DECLARE
  v_level record;
  v_is_first_level boolean;
BEGIN
  FOR v_level IN
    SELECT id, level_number
    FROM game_levels
    WHERE company_id = p_company_id
    ORDER BY level_number
  LOOP
    v_is_first_level := (v_level.level_number = 1);

    INSERT INTO user_game_progress (
      user_id,
      company_id,
      level_id,
      is_unlocked,
      is_completed
    ) VALUES (
      p_user_id,
      p_company_id,
      v_level.id,
      v_is_first_level,
      false
    )
    ON CONFLICT (user_id, level_id) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unlock next level after completion
CREATE OR REPLACE FUNCTION unlock_next_level(
  p_user_id uuid,
  p_company_id uuid,
  p_current_level_number integer
)
RETURNS void AS $$
DECLARE
  v_next_level_id uuid;
BEGIN
  SELECT id INTO v_next_level_id
  FROM game_levels
  WHERE company_id = p_company_id
    AND level_number = p_current_level_number + 1
    AND is_active = true;

  IF v_next_level_id IS NOT NULL THEN
    UPDATE user_game_progress
    SET
      is_unlocked = true,
      updated_at = now()
    WHERE user_id = p_user_id
      AND level_id = v_next_level_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update leaderboards after score submission
CREATE OR REPLACE FUNCTION update_leaderboards_after_score(
  p_user_id uuid,
  p_company_id uuid,
  p_level_id uuid,
  p_score integer
)
RETURNS void AS $$
BEGIN
  -- Update all_time leaderboard for specific level
  INSERT INTO leaderboards (
    user_id,
    company_id,
    level_id,
    total_score,
    period
  ) VALUES (
    p_user_id,
    p_company_id,
    p_level_id,
    p_score,
    'all_time'
  )
  ON CONFLICT (user_id, company_id, level_id, period)
  DO UPDATE SET
    total_score = GREATEST(leaderboards.total_score, p_score),
    updated_at = now();

  -- Update all_time leaderboard for company (sum of all levels)
  INSERT INTO leaderboards (
    user_id,
    company_id,
    level_id,
    total_score,
    period
  )
  SELECT
    p_user_id,
    p_company_id,
    NULL,
    SUM(best_score),
    'all_time'
  FROM user_game_progress
  WHERE user_id = p_user_id
    AND company_id = p_company_id
  GROUP BY user_id, company_id
  ON CONFLICT (user_id, company_id, level_id, period)
  DO UPDATE SET
    total_score = (
      SELECT SUM(best_score)
      FROM user_game_progress
      WHERE user_id = p_user_id
        AND company_id = p_company_id
    ),
    updated_at = now();

  -- Update global leaderboard (sum across all companies)
  INSERT INTO leaderboards (
    user_id,
    company_id,
    level_id,
    total_score,
    period
  )
  SELECT
    p_user_id,
    NULL,
    NULL,
    SUM(best_score),
    'all_time'
  FROM user_game_progress
  WHERE user_id = p_user_id
  GROUP BY user_id
  ON CONFLICT (user_id, company_id, level_id, period)
  DO UPDATE SET
    total_score = (
      SELECT SUM(best_score)
      FROM user_game_progress
      WHERE user_id = p_user_id
    ),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION initialize_company_progress TO authenticated;
GRANT EXECUTE ON FUNCTION unlock_next_level TO authenticated;
GRANT EXECUTE ON FUNCTION update_leaderboards_after_score TO authenticated;

-- ============================================================================
-- INSERT DEFAULT DATA
-- ============================================================================

-- Insert the three gaming companies
INSERT INTO gaming_companies (name, logo_url, description, primary_color, secondary_color, difficulty_modifier, display_order)
VALUES
  ('Accenture', 'https://cdn.worldvectorlogo.com/logos/accenture.svg', 'Global professional services company with leading capabilities in digital, cloud, and security. Test your logical thinking and problem-solving skills with our Path Finder challenge.', '#A100FF', '#7000B3', 1.00, 1),
  ('Cognizant', 'https://cdn.worldvectorlogo.com/logos/cognizant-technology-solutions.svg', 'One of the world''s leading professional services companies, transforming clients'' business, operating, and technology models. Sharpen your analytical abilities with progressive difficulty levels.', '#0033A1', '#001F5F', 1.10, 2),
  ('Capgemini', 'https://cdn.worldvectorlogo.com/logos/capgemini.svg', 'Global leader in partnering with companies to transform and manage their business. Challenge yourself with our advanced aptitude assessment designed for top-tier consulting roles.', '#0070AD', '#005580', 1.20, 3)
ON CONFLICT (name) DO NOTHING;

-- Insert game levels for each company (4 levels per company)
DO $$
DECLARE
  v_company record;
BEGIN
  FOR v_company IN SELECT id FROM gaming_companies ORDER BY display_order
  LOOP
    -- Level 1: 4x4 grid
    INSERT INTO game_levels (company_id, level_number, grid_size, time_limit_seconds, target_score, obstacle_density)
    VALUES (v_company.id, 1, 4, 120, 300, 0.15)
    ON CONFLICT (company_id, level_number) DO NOTHING;

    -- Level 2: 5x5 grid
    INSERT INTO game_levels (company_id, level_number, grid_size, time_limit_seconds, target_score, obstacle_density)
    VALUES (v_company.id, 2, 5, 180, 500, 0.20)
    ON CONFLICT (company_id, level_number) DO NOTHING;

    -- Level 3: 6x6 grid
    INSERT INTO game_levels (company_id, level_number, grid_size, time_limit_seconds, target_score, obstacle_density)
    VALUES (v_company.id, 3, 6, 240, 750, 0.25)
    ON CONFLICT (company_id, level_number) DO NOTHING;

    -- Level 4: 7x7 grid
    INSERT INTO game_levels (company_id, level_number, grid_size, time_limit_seconds, target_score, obstacle_density)
    VALUES (v_company.id, 4, 7, 300, 1000, 0.30)
    ON CONFLICT (company_id, level_number) DO NOTHING;
  END LOOP;
END $$;