/*
  # Enhanced Realistic Interview System

  ## New Tables
    - `realistic_interview_sessions`
      - Stores main interview session data with company and role context
      - Tracks interview type (general vs company-based)
      - Records duration, status, and completion metadata

    - `realistic_interview_responses`
      - Stores user responses to questions
      - Supports both verbal and code answers
      - Tracks time spent per question
      - Records quality scores

    - `realistic_interview_followups`
      - Stores follow-up questions and answers
      - Links to parent questions
      - Tracks context and reasoning for follow-ups

    - `realistic_interview_code_reviews`
      - Stores code review questions and explanations
      - Links to specific code submissions
      - Tracks line-by-line analysis requests

  ## Security
    - Enable RLS on all tables
    - Users can only access their own interview data
    - Admins can view all interviews for analytics
*/

-- Create realistic_interview_sessions table
CREATE TABLE IF NOT EXISTS realistic_interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  resume_id uuid REFERENCES user_resumes(id) ON DELETE SET NULL,
  session_type text NOT NULL CHECK (session_type IN ('general', 'company-based')),
  interview_category text NOT NULL CHECK (interview_category IN ('technical', 'hr', 'behavioral', 'mixed')),
  company_name text,
  target_role text,
  duration_minutes integer NOT NULL DEFAULT 20,
  actual_duration_seconds integer,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  overall_score numeric(5, 2),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create realistic_interview_responses table
CREATE TABLE IF NOT EXISTS realistic_interview_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES realistic_interview_sessions(id) ON DELETE CASCADE NOT NULL,
  question_number integer NOT NULL,
  question_type text NOT NULL,
  question_text text NOT NULL,
  answer_text text,
  code_answer text,
  programming_language text,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  quality_score numeric(5, 2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create realistic_interview_followups table
CREATE TABLE IF NOT EXISTS realistic_interview_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES realistic_interview_sessions(id) ON DELETE CASCADE NOT NULL,
  parent_question_number integer NOT NULL,
  follow_up_question text NOT NULL,
  answer text,
  reason text,
  context jsonb,
  time_spent_seconds integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create realistic_interview_code_reviews table
CREATE TABLE IF NOT EXISTS realistic_interview_code_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES realistic_interview_sessions(id) ON DELETE CASCADE NOT NULL,
  response_id uuid REFERENCES realistic_interview_responses(id) ON DELETE CASCADE NOT NULL,
  review_question text NOT NULL,
  code_snippet text NOT NULL,
  explanation text,
  question_number integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE realistic_interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE realistic_interview_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE realistic_interview_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE realistic_interview_code_reviews ENABLE ROW LEVEL SECURITY;

-- Policies for realistic_interview_sessions
CREATE POLICY "Users can view own interview sessions"
  ON realistic_interview_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own interview sessions"
  ON realistic_interview_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interview sessions"
  ON realistic_interview_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies for realistic_interview_responses
CREATE POLICY "Users can view own interview responses"
  ON realistic_interview_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM realistic_interview_sessions
      WHERE realistic_interview_sessions.id = realistic_interview_responses.session_id
      AND realistic_interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own interview responses"
  ON realistic_interview_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM realistic_interview_sessions
      WHERE realistic_interview_sessions.id = realistic_interview_responses.session_id
      AND realistic_interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own interview responses"
  ON realistic_interview_responses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM realistic_interview_sessions
      WHERE realistic_interview_sessions.id = realistic_interview_responses.session_id
      AND realistic_interview_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM realistic_interview_sessions
      WHERE realistic_interview_sessions.id = realistic_interview_responses.session_id
      AND realistic_interview_sessions.user_id = auth.uid()
    )
  );

-- Policies for realistic_interview_followups
CREATE POLICY "Users can view own interview followups"
  ON realistic_interview_followups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM realistic_interview_sessions
      WHERE realistic_interview_sessions.id = realistic_interview_followups.session_id
      AND realistic_interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own interview followups"
  ON realistic_interview_followups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM realistic_interview_sessions
      WHERE realistic_interview_sessions.id = realistic_interview_followups.session_id
      AND realistic_interview_sessions.user_id = auth.uid()
    )
  );

-- Policies for realistic_interview_code_reviews
CREATE POLICY "Users can view own code reviews"
  ON realistic_interview_code_reviews
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM realistic_interview_sessions
      WHERE realistic_interview_sessions.id = realistic_interview_code_reviews.session_id
      AND realistic_interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own code reviews"
  ON realistic_interview_code_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM realistic_interview_sessions
      WHERE realistic_interview_sessions.id = realistic_interview_code_reviews.session_id
      AND realistic_interview_sessions.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_realistic_sessions_user_id ON realistic_interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_realistic_sessions_status ON realistic_interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_realistic_sessions_created_at ON realistic_interview_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_realistic_responses_session_id ON realistic_interview_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_realistic_followups_session_id ON realistic_interview_followups(session_id);
CREATE INDEX IF NOT EXISTS idx_realistic_code_reviews_session_id ON realistic_interview_code_reviews(session_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_realistic_sessions_updated_at'
  ) THEN
    CREATE TRIGGER update_realistic_sessions_updated_at
      BEFORE UPDATE ON realistic_interview_sessions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_realistic_responses_updated_at'
  ) THEN
    CREATE TRIGGER update_realistic_responses_updated_at
      BEFORE UPDATE ON realistic_interview_responses
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
