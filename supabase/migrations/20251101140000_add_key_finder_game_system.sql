/*
  # Key Finder Memory Maze Game System

  1. New Tables
    - `key_finder_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `difficulty` (text) - easy, medium, hard
      - `maze_config` (jsonb) - stores complete maze layout
      - `session_token` (text, unique)
      - `start_time` (timestamptz)
      - `end_time` (timestamptz)
      - `time_remaining_seconds` (integer)
      - `total_moves` (integer)
      - `restart_count` (integer)
      - `collision_count` (integer)
      - `has_key` (boolean)
      - `is_completed` (boolean)
      - `final_score` (integer)
      - `created_at` (timestamptz)

    - `key_finder_moves`
      - `id` (uuid, primary key)
      - `session_id` (uuid, references key_finder_sessions)
      - `move_number` (integer)
      - `from_position` (jsonb)
      - `to_position` (jsonb)
      - `direction` (text)
      - `was_collision` (boolean)
      - `caused_restart` (boolean)
      - `timestamp` (timestamptz)

    - `key_finder_leaderboard`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `difficulty` (text)
      - `best_time_seconds` (integer)
      - `fewest_moves` (integer)
      - `highest_score` (integer)
      - `completion_count` (integer)
      - `average_restarts` (numeric)
      - `period` (text) - daily, weekly, all_time
      - `updated_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Add policies for reading leaderboard data

  3. Functions
    - `update_key_finder_leaderboard` - Updates leaderboard with new scores
*/

-- Create key_finder_sessions table
CREATE TABLE IF NOT EXISTS key_finder_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  maze_config jsonb NOT NULL,
  session_token text UNIQUE DEFAULT gen_random_uuid()::text,
  start_time timestamptz DEFAULT now(),
  end_time timestamptz,
  time_remaining_seconds integer DEFAULT 300,
  total_moves integer DEFAULT 0,
  restart_count integer DEFAULT 0,
  collision_count integer DEFAULT 0,
  has_key boolean DEFAULT false,
  is_completed boolean DEFAULT false,
  final_score integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create key_finder_moves table
CREATE TABLE IF NOT EXISTS key_finder_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES key_finder_sessions(id) ON DELETE CASCADE NOT NULL,
  move_number integer NOT NULL,
  from_position jsonb NOT NULL,
  to_position jsonb NOT NULL,
  direction text NOT NULL CHECK (direction IN ('up', 'down', 'left', 'right')),
  was_collision boolean DEFAULT false,
  caused_restart boolean DEFAULT false,
  timestamp timestamptz DEFAULT now()
);

-- Create key_finder_leaderboard table
CREATE TABLE IF NOT EXISTS key_finder_leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  best_time_seconds integer,
  fewest_moves integer,
  highest_score integer DEFAULT 0,
  completion_count integer DEFAULT 0,
  average_restarts numeric DEFAULT 0,
  period text NOT NULL CHECK (period IN ('daily', 'weekly', 'all_time')),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, difficulty, period)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_key_finder_sessions_user_id ON key_finder_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_key_finder_sessions_difficulty ON key_finder_sessions(difficulty);
CREATE INDEX IF NOT EXISTS idx_key_finder_sessions_created_at ON key_finder_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_key_finder_moves_session_id ON key_finder_moves(session_id);
CREATE INDEX IF NOT EXISTS idx_key_finder_leaderboard_user_difficulty ON key_finder_leaderboard(user_id, difficulty);
CREATE INDEX IF NOT EXISTS idx_key_finder_leaderboard_score ON key_finder_leaderboard(highest_score DESC);

-- Enable Row Level Security
ALTER TABLE key_finder_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_finder_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_finder_leaderboard ENABLE ROW LEVEL SECURITY;

-- Policies for key_finder_sessions
CREATE POLICY "Users can view own sessions"
  ON key_finder_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
  ON key_finder_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON key_finder_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies for key_finder_moves
CREATE POLICY "Users can view own moves"
  ON key_finder_moves FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM key_finder_sessions
      WHERE key_finder_sessions.id = key_finder_moves.session_id
      AND key_finder_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create moves for own sessions"
  ON key_finder_moves FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM key_finder_sessions
      WHERE key_finder_sessions.id = key_finder_moves.session_id
      AND key_finder_sessions.user_id = auth.uid()
    )
  );

-- Policies for key_finder_leaderboard
CREATE POLICY "Anyone can view leaderboard"
  ON key_finder_leaderboard FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own leaderboard entries"
  ON key_finder_leaderboard FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leaderboard entries"
  ON key_finder_leaderboard FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to update leaderboard
CREATE OR REPLACE FUNCTION update_key_finder_leaderboard(
  p_user_id uuid,
  p_difficulty text,
  p_completion_time integer,
  p_total_moves integer,
  p_score integer,
  p_restart_count integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO key_finder_leaderboard (
    user_id,
    difficulty,
    best_time_seconds,
    fewest_moves,
    highest_score,
    completion_count,
    average_restarts,
    period
  )
  VALUES (
    p_user_id,
    p_difficulty,
    p_completion_time,
    p_total_moves,
    p_score,
    1,
    p_restart_count,
    'all_time'
  )
  ON CONFLICT (user_id, difficulty, period)
  DO UPDATE SET
    best_time_seconds = CASE
      WHEN key_finder_leaderboard.best_time_seconds IS NULL
           OR p_completion_time < key_finder_leaderboard.best_time_seconds
      THEN p_completion_time
      ELSE key_finder_leaderboard.best_time_seconds
    END,
    fewest_moves = CASE
      WHEN key_finder_leaderboard.fewest_moves IS NULL
           OR p_total_moves < key_finder_leaderboard.fewest_moves
      THEN p_total_moves
      ELSE key_finder_leaderboard.fewest_moves
    END,
    highest_score = CASE
      WHEN p_score > key_finder_leaderboard.highest_score
      THEN p_score
      ELSE key_finder_leaderboard.highest_score
    END,
    completion_count = key_finder_leaderboard.completion_count + 1,
    average_restarts = (
      (key_finder_leaderboard.average_restarts * key_finder_leaderboard.completion_count + p_restart_count)
      / (key_finder_leaderboard.completion_count + 1)
    ),
    updated_at = now();
END;
$$;
