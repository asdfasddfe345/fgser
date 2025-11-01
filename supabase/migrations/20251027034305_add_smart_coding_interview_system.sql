/*
  # Smart Coding Interview System with AI-Powered Code Review

  ## Overview
  This migration creates a complete smart interview system that supports:
  - Text-based questions (introductory, behavioral, technical)
  - Coding questions with integrated compiler and test execution
  - Dynamic AI-generated follow-up questions for code logic review
  - Automatic question type detection and routing
  - Voice interaction with speech recognition and text-to-speech
  - Security monitoring with violation tracking

  ## New Tables Created

  ### 1. smart_interview_sessions
  - Stores interview session metadata
  - Tracks overall performance and security metrics
  - Links to user and tracks session status

  ### 2. smart_interview_questions
  - Stores all interview questions (text and coding types)
  - Supports multiple categories and difficulty levels
  - Includes expected answer patterns and test case templates

  ### 3. smart_interview_responses
  - Records all candidate answers (text or code)
  - Stores AI evaluation scores and feedback
  - Tracks response duration and submission method

  ### 4. code_execution_results
  - Stores test case execution outcomes
  - Records code quality analysis results
  - Tracks pass/fail status for each test case

  ### 5. code_logic_review_questions
  - Dynamic follow-up questions generated after code submission
  - Questions about time complexity, space complexity, edge cases
  - Linked to original code submission

  ### 6. code_logic_review_responses
  - Candidate explanations of their code logic
  - AI evaluation of technical understanding
  - Scores for logic explanation quality

  ## Security
  - Row Level Security enabled on all tables
  - Users can only access their own interview data
  - Admins have full access for moderation

  ## Indexes
  - Optimized for fast question retrieval by type and difficulty
  - Session lookup by user and status
  - Response ordering by timestamp
*/

-- Create smart interview sessions table
CREATE TABLE IF NOT EXISTS smart_interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL DEFAULT 'general',
  interview_category TEXT NOT NULL,
  company_name TEXT,
  target_role TEXT,
  domain TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  actual_duration_seconds INTEGER,
  total_questions INTEGER DEFAULT 0,
  questions_answered INTEGER DEFAULT 0,
  questions_skipped INTEGER DEFAULT 0,
  overall_score DECIMAL(5,2),
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- Security tracking
  tab_switches_count INTEGER DEFAULT 0,
  fullscreen_exits_count INTEGER DEFAULT 0,
  total_violation_time INTEGER DEFAULT 0,
  violations_log JSONB DEFAULT '[]'::jsonb,
  security_score DECIMAL(5,2),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create smart interview questions table
CREATE TABLE IF NOT EXISTS smart_interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_type TEXT NOT NULL,
  question_text TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  company_name TEXT,
  role TEXT,
  domain TEXT,
  
  -- For coding questions
  requires_coding BOOLEAN DEFAULT false,
  programming_languages TEXT[] DEFAULT ARRAY['Python', 'JavaScript', 'Java', 'C++'],
  default_language TEXT,
  test_case_template JSONB,
  expected_complexity JSONB,
  code_hints TEXT[],
  
  -- For text questions
  expected_answer_points TEXT[],
  sample_good_answer TEXT,
  
  -- Metadata
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  average_score DECIMAL(5,2),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create smart interview responses table
CREATE TABLE IF NOT EXISTS smart_interview_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES smart_interview_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES smart_interview_questions(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL,
  
  -- Answer data
  answer_type TEXT NOT NULL,
  text_answer TEXT,
  code_answer TEXT,
  programming_language TEXT,
  audio_transcript TEXT,
  
  -- Evaluation
  ai_feedback JSONB,
  individual_score DECIMAL(5,2),
  strengths TEXT[],
  improvements TEXT[],
  
  -- Metadata
  response_duration_seconds INTEGER,
  auto_submitted BOOLEAN DEFAULT false,
  silence_duration INTEGER DEFAULT 0,
  was_skipped BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_session_question UNIQUE(session_id, question_id)
);

-- Create code execution results table
CREATE TABLE IF NOT EXISTS code_execution_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES smart_interview_responses(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES smart_interview_sessions(id) ON DELETE CASCADE,
  
  -- Code details
  code_submitted TEXT NOT NULL,
  programming_language TEXT NOT NULL,
  
  -- Test execution
  test_cases JSONB NOT NULL,
  execution_results JSONB NOT NULL,
  total_test_cases INTEGER NOT NULL,
  passed_test_cases INTEGER NOT NULL,
  pass_rate DECIMAL(5,2),
  
  -- Code quality analysis
  code_quality_score DECIMAL(5,2),
  complexity_analysis JSONB,
  best_practices_violations TEXT[],
  optimization_suggestions TEXT[],
  
  -- Execution metadata
  execution_time_ms INTEGER,
  memory_used_kb INTEGER,
  compilation_errors TEXT[],
  runtime_errors TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create code logic review questions table
CREATE TABLE IF NOT EXISTS code_logic_review_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES smart_interview_responses(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES smart_interview_sessions(id) ON DELETE CASCADE,
  original_question_id UUID NOT NULL REFERENCES smart_interview_questions(id) ON DELETE CASCADE,
  
  -- Review question details
  review_question_number INTEGER NOT NULL,
  question_type TEXT NOT NULL,
  question_text TEXT NOT NULL,
  code_section_reference TEXT,
  expected_concepts TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create code logic review responses table
CREATE TABLE IF NOT EXISTS code_logic_review_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_question_id UUID NOT NULL REFERENCES code_logic_review_questions(id) ON DELETE CASCADE,
  response_id UUID NOT NULL REFERENCES smart_interview_responses(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES smart_interview_sessions(id) ON DELETE CASCADE,
  
  -- Response details
  explanation_text TEXT NOT NULL,
  audio_transcript TEXT,
  
  -- Evaluation
  understanding_score DECIMAL(5,2),
  ai_feedback JSONB,
  concepts_covered TEXT[],
  concepts_missed TEXT[],
  
  -- Metadata
  response_duration_seconds INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_smart_sessions_user_id ON smart_interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_sessions_status ON smart_interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_smart_sessions_created_at ON smart_interview_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_smart_questions_type ON smart_interview_questions(question_type);
CREATE INDEX IF NOT EXISTS idx_smart_questions_category ON smart_interview_questions(category);
CREATE INDEX IF NOT EXISTS idx_smart_questions_difficulty ON smart_interview_questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_smart_questions_company ON smart_interview_questions(company_name);
CREATE INDEX IF NOT EXISTS idx_smart_questions_active ON smart_interview_questions(is_active);

CREATE INDEX IF NOT EXISTS idx_smart_responses_session ON smart_interview_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_smart_responses_question ON smart_interview_responses(question_id);

CREATE INDEX IF NOT EXISTS idx_code_exec_response ON code_execution_results(response_id);
CREATE INDEX IF NOT EXISTS idx_code_exec_session ON code_execution_results(session_id);

CREATE INDEX IF NOT EXISTS idx_review_questions_response ON code_logic_review_questions(response_id);
CREATE INDEX IF NOT EXISTS idx_review_questions_session ON code_logic_review_questions(session_id);

CREATE INDEX IF NOT EXISTS idx_review_responses_review_q ON code_logic_review_responses(review_question_id);
CREATE INDEX IF NOT EXISTS idx_review_responses_session ON code_logic_review_responses(session_id);

-- Enable Row Level Security
ALTER TABLE smart_interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_interview_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_execution_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_logic_review_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_logic_review_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for smart_interview_sessions
CREATE POLICY "Users can view own sessions"
  ON smart_interview_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
  ON smart_interview_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON smart_interview_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for smart_interview_questions (public read for active questions)
CREATE POLICY "Anyone can view active questions"
  ON smart_interview_questions FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage questions"
  ON smart_interview_questions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- RLS Policies for smart_interview_responses
CREATE POLICY "Users can view own responses"
  ON smart_interview_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM smart_interview_sessions
      WHERE smart_interview_sessions.id = smart_interview_responses.session_id
      AND smart_interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own responses"
  ON smart_interview_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM smart_interview_sessions
      WHERE smart_interview_sessions.id = smart_interview_responses.session_id
      AND smart_interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own responses"
  ON smart_interview_responses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM smart_interview_sessions
      WHERE smart_interview_sessions.id = smart_interview_responses.session_id
      AND smart_interview_sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for code_execution_results
CREATE POLICY "Users can view own code execution results"
  ON code_execution_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM smart_interview_sessions
      WHERE smart_interview_sessions.id = code_execution_results.session_id
      AND smart_interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own code execution results"
  ON code_execution_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM smart_interview_sessions
      WHERE smart_interview_sessions.id = code_execution_results.session_id
      AND smart_interview_sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for code_logic_review_questions
CREATE POLICY "Users can view own review questions"
  ON code_logic_review_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM smart_interview_sessions
      WHERE smart_interview_sessions.id = code_logic_review_questions.session_id
      AND smart_interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "System can create review questions"
  ON code_logic_review_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM smart_interview_sessions
      WHERE smart_interview_sessions.id = code_logic_review_questions.session_id
      AND smart_interview_sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for code_logic_review_responses
CREATE POLICY "Users can view own review responses"
  ON code_logic_review_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM smart_interview_sessions
      WHERE smart_interview_sessions.id = code_logic_review_responses.session_id
      AND smart_interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own review responses"
  ON code_logic_review_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM smart_interview_sessions
      WHERE smart_interview_sessions.id = code_logic_review_responses.session_id
      AND smart_interview_sessions.user_id = auth.uid()
    )
  );

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_smart_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for auto-updating timestamps
CREATE TRIGGER update_smart_sessions_updated_at
  BEFORE UPDATE ON smart_interview_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_smart_updated_at_column();

CREATE TRIGGER update_smart_questions_updated_at
  BEFORE UPDATE ON smart_interview_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_smart_updated_at_column();

CREATE TRIGGER update_smart_responses_updated_at
  BEFORE UPDATE ON smart_interview_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_smart_updated_at_column();
