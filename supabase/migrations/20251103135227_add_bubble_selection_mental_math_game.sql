/*
  # Bubble Selection Mental Math Speed Game System

  1. New Tables
    - `bubble_selection_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `session_token` (text, unique)
      - `difficulty_level` (text) - adaptive
      - `total_questions` (integer) - 24
      - `current_section` (integer) - 1-14
      - `questions_answered` (integer)
      - `correct_answers` (integer)
      - `start_time` (timestamptz)
      - `end_time` (timestamptz)
      - `total_time_seconds` (integer)
      - `final_score` (integer)
      - `is_completed` (boolean)
      - `created_at` (timestamptz)

    - `bubble_selection_questions`
      - `id` (uuid, primary key)
      - `session_id` (uuid, references bubble_selection_sessions)
      - `question_number` (integer) - 1-24
      - `section_number` (integer) - 1-14
      - `difficulty_level` (text) - easy, medium, hard
      - `expressions` (jsonb) - array of mathematical expressions
      - `correct_sequence` (jsonb) - array of correct indices
      - `user_sequence` (jsonb) - array of user selected indices
      - `time_limit_seconds` (integer) - default 10
      - `time_taken_seconds` (numeric)
      - `is_correct` (boolean)
      - `score_earned` (integer)
      - `created_at` (timestamptz)

    - `bubble_selection_expressions`
      - `id` (uuid, primary key)
      - `difficulty_level` (text) - easy, medium, hard
      - `operation_type` (text) - addition, subtraction, multiplication, division, mixed
      - `expression_text` (text)
      - `result_value` (numeric)
      - `has_decimals` (boolean)
      - `complexity_score` (integer) - 1-10
      - `is_active` (boolean)
      - `created_at` (timestamptz)

    - `bubble_selection_leaderboard`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `best_score` (integer)
      - `best_time_seconds` (integer)
      - `best_accuracy_percentage` (numeric)
      - `total_games_played` (integer)
      - `total_questions_answered` (integer)
      - `total_correct_answers` (integer)
      - `average_score` (numeric)
      - `highest_streak` (integer)
      - `period` (text) - daily, weekly, all_time
      - `rank` (integer)
      - `updated_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Add policies for reading leaderboard data

  3. Functions
    - `generate_bubble_question` - Generates a new question with expressions
    - `calculate_bubble_score` - Calculates score based on accuracy and time
    - `update_bubble_leaderboard` - Updates leaderboard after session completion
*/

-- Create bubble_selection_sessions table
CREATE TABLE IF NOT EXISTS bubble_selection_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_token text UNIQUE DEFAULT gen_random_uuid()::text,
  difficulty_level text DEFAULT 'adaptive',
  total_questions integer DEFAULT 24,
  current_section integer DEFAULT 1,
  questions_answered integer DEFAULT 0,
  correct_answers integer DEFAULT 0,
  start_time timestamptz DEFAULT now(),
  end_time timestamptz,
  total_time_seconds integer DEFAULT 0,
  final_score integer DEFAULT 0,
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create bubble_selection_questions table
CREATE TABLE IF NOT EXISTS bubble_selection_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES bubble_selection_sessions(id) ON DELETE CASCADE NOT NULL,
  question_number integer NOT NULL,
  section_number integer NOT NULL,
  difficulty_level text NOT NULL CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
  expressions jsonb NOT NULL,
  correct_sequence jsonb NOT NULL,
  user_sequence jsonb DEFAULT '[]'::jsonb,
  time_limit_seconds integer DEFAULT 10,
  time_taken_seconds numeric DEFAULT 0,
  is_correct boolean DEFAULT false,
  score_earned integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create bubble_selection_expressions table
CREATE TABLE IF NOT EXISTS bubble_selection_expressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  difficulty_level text NOT NULL CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
  operation_type text NOT NULL CHECK (operation_type IN ('addition', 'subtraction', 'multiplication', 'division', 'mixed')),
  expression_text text NOT NULL,
  result_value numeric NOT NULL,
  has_decimals boolean DEFAULT false,
  complexity_score integer DEFAULT 5 CHECK (complexity_score >= 1 AND complexity_score <= 10),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create bubble_selection_leaderboard table
CREATE TABLE IF NOT EXISTS bubble_selection_leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  best_score integer DEFAULT 0,
  best_time_seconds integer,
  best_accuracy_percentage numeric DEFAULT 0,
  total_games_played integer DEFAULT 0,
  total_questions_answered integer DEFAULT 0,
  total_correct_answers integer DEFAULT 0,
  average_score numeric DEFAULT 0,
  highest_streak integer DEFAULT 0,
  period text NOT NULL CHECK (period IN ('daily', 'weekly', 'all_time')),
  rank integer,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, period)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bubble_sessions_user_id ON bubble_selection_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_bubble_sessions_created_at ON bubble_selection_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bubble_questions_session_id ON bubble_selection_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_bubble_questions_number ON bubble_selection_questions(question_number);
CREATE INDEX IF NOT EXISTS idx_bubble_expressions_difficulty ON bubble_selection_expressions(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_bubble_leaderboard_score ON bubble_selection_leaderboard(best_score DESC);
CREATE INDEX IF NOT EXISTS idx_bubble_leaderboard_period ON bubble_selection_leaderboard(period);

-- Enable Row Level Security
ALTER TABLE bubble_selection_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bubble_selection_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bubble_selection_expressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bubble_selection_leaderboard ENABLE ROW LEVEL SECURITY;

-- Policies for bubble_selection_sessions
CREATE POLICY "Users can view own sessions"
  ON bubble_selection_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
  ON bubble_selection_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON bubble_selection_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies for bubble_selection_questions
CREATE POLICY "Users can view own questions"
  ON bubble_selection_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bubble_selection_sessions
      WHERE bubble_selection_sessions.id = bubble_selection_questions.session_id
      AND bubble_selection_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create questions for own sessions"
  ON bubble_selection_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bubble_selection_sessions
      WHERE bubble_selection_sessions.id = bubble_selection_questions.session_id
      AND bubble_selection_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own questions"
  ON bubble_selection_questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bubble_selection_sessions
      WHERE bubble_selection_sessions.id = bubble_selection_questions.session_id
      AND bubble_selection_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bubble_selection_sessions
      WHERE bubble_selection_sessions.id = bubble_selection_questions.session_id
      AND bubble_selection_sessions.user_id = auth.uid()
    )
  );

-- Policies for bubble_selection_expressions
CREATE POLICY "Anyone can view active expressions"
  ON bubble_selection_expressions FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Policies for bubble_selection_leaderboard
CREATE POLICY "Anyone can view leaderboard"
  ON bubble_selection_leaderboard FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own leaderboard entries"
  ON bubble_selection_leaderboard FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leaderboard entries"
  ON bubble_selection_leaderboard FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to calculate score
CREATE OR REPLACE FUNCTION calculate_bubble_score(
  p_time_taken numeric,
  p_time_limit integer,
  p_is_correct boolean,
  p_difficulty_level text
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_base_score integer := 100;
  v_time_bonus integer := 0;
  v_difficulty_multiplier numeric := 1.0;
  v_final_score integer;
BEGIN
  -- If incorrect, return 0
  IF NOT p_is_correct THEN
    RETURN 0;
  END IF;

  -- Calculate time bonus (max 50 points for completing in 3 seconds or less)
  IF p_time_taken <= 3 THEN
    v_time_bonus := 50;
  ELSIF p_time_taken <= 5 THEN
    v_time_bonus := 30;
  ELSIF p_time_taken <= 7 THEN
    v_time_bonus := 15;
  ELSIF p_time_taken < p_time_limit THEN
    v_time_bonus := 5;
  END IF;

  -- Apply difficulty multiplier
  CASE p_difficulty_level
    WHEN 'easy' THEN v_difficulty_multiplier := 1.0;
    WHEN 'medium' THEN v_difficulty_multiplier := 1.5;
    WHEN 'hard' THEN v_difficulty_multiplier := 2.0;
  END CASE;

  v_final_score := ((v_base_score + v_time_bonus) * v_difficulty_multiplier)::integer;
  
  RETURN v_final_score;
END;
$$;

-- Function to update leaderboard
CREATE OR REPLACE FUNCTION update_bubble_leaderboard(
  p_user_id uuid,
  p_session_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
  v_accuracy numeric;
BEGIN
  -- Get session data
  SELECT * INTO v_session
  FROM bubble_selection_sessions
  WHERE id = p_session_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Calculate accuracy
  IF v_session.questions_answered > 0 THEN
    v_accuracy := (v_session.correct_answers::numeric / v_session.questions_answered::numeric) * 100;
  ELSE
    v_accuracy := 0;
  END IF;

  -- Update all_time leaderboard
  INSERT INTO bubble_selection_leaderboard (
    user_id,
    best_score,
    best_time_seconds,
    best_accuracy_percentage,
    total_games_played,
    total_questions_answered,
    total_correct_answers,
    average_score,
    period
  )
  VALUES (
    p_user_id,
    v_session.final_score,
    v_session.total_time_seconds,
    v_accuracy,
    1,
    v_session.questions_answered,
    v_session.correct_answers,
    v_session.final_score,
    'all_time'
  )
  ON CONFLICT (user_id, period)
  DO UPDATE SET
    best_score = CASE
      WHEN v_session.final_score > bubble_selection_leaderboard.best_score
      THEN v_session.final_score
      ELSE bubble_selection_leaderboard.best_score
    END,
    best_time_seconds = CASE
      WHEN bubble_selection_leaderboard.best_time_seconds IS NULL
           OR v_session.total_time_seconds < bubble_selection_leaderboard.best_time_seconds
      THEN v_session.total_time_seconds
      ELSE bubble_selection_leaderboard.best_time_seconds
    END,
    best_accuracy_percentage = CASE
      WHEN v_accuracy > bubble_selection_leaderboard.best_accuracy_percentage
      THEN v_accuracy
      ELSE bubble_selection_leaderboard.best_accuracy_percentage
    END,
    total_games_played = bubble_selection_leaderboard.total_games_played + 1,
    total_questions_answered = bubble_selection_leaderboard.total_questions_answered + v_session.questions_answered,
    total_correct_answers = bubble_selection_leaderboard.total_correct_answers + v_session.correct_answers,
    average_score = (
      (bubble_selection_leaderboard.average_score * bubble_selection_leaderboard.total_games_played + v_session.final_score)
      / (bubble_selection_leaderboard.total_games_played + 1)
    ),
    updated_at = now();
END;
$$;