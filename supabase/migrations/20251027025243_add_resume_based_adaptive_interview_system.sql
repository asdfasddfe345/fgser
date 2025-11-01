/*
  # Resume-Based Adaptive Interview System with Code Compiler

  ## Overview
  This migration creates a comprehensive interview system that analyzes resumes, 
  generates project-specific questions, includes code compilation, and adapts 
  based on candidate responses.

  ## New Tables

  ### 1. `interview_resumes`
  Stores uploaded resumes and parsed data for interview generation
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `original_filename` (text)
  - `file_url` (text) - Storage URL for uploaded resume
  - `raw_text` (text) - Extracted resume text
  - `parsed_data` (jsonb) - Structured resume data (projects, skills, experience)
  - `projects_extracted` (jsonb) - Array of project details
  - `skills` (text[]) - Array of technical skills
  - `experience_level` (text) - junior/mid/senior
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `adaptive_interview_sessions`
  Enhanced interview sessions with resume context
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `resume_id` (uuid, references interview_resumes)
  - `interview_type` (text) - resume_based/standard/hybrid
  - `configuration` (jsonb) - Interview settings
  - `current_question_index` (integer)
  - `total_questions` (integer)
  - `status` (text) - in_progress/completed/paused
  - `started_at` (timestamptz)
  - `completed_at` (timestamptz)
  - `total_duration_seconds` (integer)
  - `overall_score` (numeric)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `interview_questions_dynamic`
  Dynamically generated questions based on resume
  - `id` (uuid, primary key)
  - `session_id` (uuid, references adaptive_interview_sessions)
  - `question_number` (integer)
  - `question_type` (text) - project_specific/coding/technical/behavioral
  - `question_text` (text)
  - `related_project` (text) - Project name from resume
  - `related_skills` (text[]) - Skills being tested
  - `difficulty_level` (text) - easy/medium/hard
  - `expected_duration_minutes` (integer) - 15 or 20 minutes
  - `requires_coding` (boolean)
  - `programming_language` (text) - For coding questions
  - `context` (jsonb) - Additional context for question generation
  - `created_at` (timestamptz)

  ### 4. `interview_responses_detailed`
  Stores candidate responses with analysis
  - `id` (uuid, primary key)
  - `session_id` (uuid, references adaptive_interview_sessions)
  - `question_id` (uuid, references interview_questions_dynamic)
  - `response_type` (text) - verbal/code/mixed
  - `verbal_response` (text)
  - `code_response` (text)
  - `programming_language` (text)
  - `time_spent_seconds` (integer)
  - `submitted_at` (timestamptz)
  - `ai_analysis` (jsonb) - AI evaluation of response
  - `score` (numeric)
  - `strengths` (text[])
  - `weaknesses` (text[])
  - `follow_up_generated` (boolean)
  - `created_at` (timestamptz)

  ### 5. `code_execution_results`
  Stores code execution and test case results
  - `id` (uuid, primary key)
  - `response_id` (uuid, references interview_responses_detailed)
  - `session_id` (uuid, references adaptive_interview_sessions)
  - `code` (text)
  - `language` (text)
  - `test_cases` (jsonb) - Array of test case objects
  - `execution_results` (jsonb) - Results for each test case
  - `all_tests_passed` (boolean)
  - `execution_time_ms` (integer)
  - `memory_used_mb` (numeric)
  - `errors` (text)
  - `created_at` (timestamptz)

  ### 6. `follow_up_questions`
  Adaptive follow-up questions based on responses
  - `id` (uuid, primary key)
  - `session_id` (uuid, references adaptive_interview_sessions)
  - `parent_question_id` (uuid, references interview_questions_dynamic)
  - `parent_response_id` (uuid, references interview_responses_detailed)
  - `follow_up_text` (text)
  - `reason_for_followup` (text) - Why this follow-up was generated
  - `depth_level` (integer) - How deep in the question chain
  - `asked_at` (timestamptz)
  - `response` (text)
  - `created_at` (timestamptz)

  ### 7. `interview_feedback_comprehensive`
  Detailed feedback and recommendations
  - `id` (uuid, primary key)
  - `session_id` (uuid, references adaptive_interview_sessions)
  - `user_id` (uuid, references auth.users)
  - `overall_performance` (jsonb)
  - `project_knowledge_score` (numeric)
  - `coding_proficiency_score` (numeric)
  - `problem_solving_score` (numeric)
  - `communication_score` (numeric)
  - `strengths` (text[])
  - `areas_for_improvement` (text[])
  - `project_specific_feedback` (jsonb)
  - `recommended_topics` (text[])
  - `detailed_breakdown` (jsonb)
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Users can only access their own interview data
  - Authenticated users can create and manage their sessions
  - Admin users can view all sessions for analytics
*/

-- Create interview_resumes table
CREATE TABLE IF NOT EXISTS interview_resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  original_filename text NOT NULL,
  file_url text,
  raw_text text,
  parsed_data jsonb DEFAULT '{}'::jsonb,
  projects_extracted jsonb DEFAULT '[]'::jsonb,
  skills text[] DEFAULT ARRAY[]::text[],
  experience_level text CHECK (experience_level IN ('junior', 'mid', 'senior', 'lead', 'unknown')) DEFAULT 'unknown',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create adaptive_interview_sessions table
CREATE TABLE IF NOT EXISTS adaptive_interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  resume_id uuid REFERENCES interview_resumes(id) ON DELETE SET NULL,
  interview_type text CHECK (interview_type IN ('resume_based', 'standard', 'hybrid')) DEFAULT 'resume_based',
  configuration jsonb DEFAULT '{}'::jsonb,
  current_question_index integer DEFAULT 0,
  total_questions integer DEFAULT 5,
  status text CHECK (status IN ('not_started', 'in_progress', 'completed', 'paused', 'abandoned')) DEFAULT 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  total_duration_seconds integer DEFAULT 0,
  overall_score numeric(5,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create interview_questions_dynamic table
CREATE TABLE IF NOT EXISTS interview_questions_dynamic (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES adaptive_interview_sessions(id) ON DELETE CASCADE NOT NULL,
  question_number integer NOT NULL,
  question_type text CHECK (question_type IN ('project_specific', 'coding', 'technical', 'behavioral', 'follow_up')) NOT NULL,
  question_text text NOT NULL,
  related_project text,
  related_skills text[] DEFAULT ARRAY[]::text[],
  difficulty_level text CHECK (difficulty_level IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
  expected_duration_minutes integer DEFAULT 15,
  requires_coding boolean DEFAULT false,
  programming_language text,
  context jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, question_number)
);

-- Create interview_responses_detailed table
CREATE TABLE IF NOT EXISTS interview_responses_detailed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES adaptive_interview_sessions(id) ON DELETE CASCADE NOT NULL,
  question_id uuid REFERENCES interview_questions_dynamic(id) ON DELETE CASCADE NOT NULL,
  response_type text CHECK (response_type IN ('verbal', 'code', 'mixed')) NOT NULL,
  verbal_response text,
  code_response text,
  programming_language text,
  time_spent_seconds integer DEFAULT 0,
  submitted_at timestamptz DEFAULT now(),
  ai_analysis jsonb DEFAULT '{}'::jsonb,
  score numeric(5,2),
  strengths text[] DEFAULT ARRAY[]::text[],
  weaknesses text[] DEFAULT ARRAY[]::text[],
  follow_up_generated boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create code_execution_results table
CREATE TABLE IF NOT EXISTS code_execution_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid REFERENCES interview_responses_detailed(id) ON DELETE CASCADE NOT NULL,
  session_id uuid REFERENCES adaptive_interview_sessions(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL,
  language text NOT NULL,
  test_cases jsonb DEFAULT '[]'::jsonb,
  execution_results jsonb DEFAULT '[]'::jsonb,
  all_tests_passed boolean DEFAULT false,
  execution_time_ms integer,
  memory_used_mb numeric(10,2),
  errors text,
  created_at timestamptz DEFAULT now()
);

-- Create follow_up_questions table
CREATE TABLE IF NOT EXISTS follow_up_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES adaptive_interview_sessions(id) ON DELETE CASCADE NOT NULL,
  parent_question_id uuid REFERENCES interview_questions_dynamic(id) ON DELETE CASCADE NOT NULL,
  parent_response_id uuid REFERENCES interview_responses_detailed(id) ON DELETE CASCADE NOT NULL,
  follow_up_text text NOT NULL,
  reason_for_followup text,
  depth_level integer DEFAULT 1,
  asked_at timestamptz DEFAULT now(),
  response text,
  created_at timestamptz DEFAULT now()
);

-- Create interview_feedback_comprehensive table
CREATE TABLE IF NOT EXISTS interview_feedback_comprehensive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES adaptive_interview_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  overall_performance jsonb DEFAULT '{}'::jsonb,
  project_knowledge_score numeric(5,2),
  coding_proficiency_score numeric(5,2),
  problem_solving_score numeric(5,2),
  communication_score numeric(5,2),
  strengths text[] DEFAULT ARRAY[]::text[],
  areas_for_improvement text[] DEFAULT ARRAY[]::text[],
  project_specific_feedback jsonb DEFAULT '{}'::jsonb,
  recommended_topics text[] DEFAULT ARRAY[]::text[],
  detailed_breakdown jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id)
);

-- Enable Row Level Security
ALTER TABLE interview_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE adaptive_interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_questions_dynamic ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_responses_detailed ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_execution_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_feedback_comprehensive ENABLE ROW LEVEL SECURITY;

-- RLS Policies for interview_resumes
CREATE POLICY "Users can view own resumes"
  ON interview_resumes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resumes"
  ON interview_resumes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resumes"
  ON interview_resumes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own resumes"
  ON interview_resumes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for adaptive_interview_sessions
CREATE POLICY "Users can view own sessions"
  ON adaptive_interview_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON adaptive_interview_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON adaptive_interview_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON adaptive_interview_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for interview_questions_dynamic
CREATE POLICY "Users can view questions from own sessions"
  ON interview_questions_dynamic FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM adaptive_interview_sessions
      WHERE adaptive_interview_sessions.id = interview_questions_dynamic.session_id
      AND adaptive_interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert questions for own sessions"
  ON interview_questions_dynamic FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM adaptive_interview_sessions
      WHERE adaptive_interview_sessions.id = interview_questions_dynamic.session_id
      AND adaptive_interview_sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for interview_responses_detailed
CREATE POLICY "Users can view own responses"
  ON interview_responses_detailed FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM adaptive_interview_sessions
      WHERE adaptive_interview_sessions.id = interview_responses_detailed.session_id
      AND adaptive_interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own responses"
  ON interview_responses_detailed FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM adaptive_interview_sessions
      WHERE adaptive_interview_sessions.id = interview_responses_detailed.session_id
      AND adaptive_interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own responses"
  ON interview_responses_detailed FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM adaptive_interview_sessions
      WHERE adaptive_interview_sessions.id = interview_responses_detailed.session_id
      AND adaptive_interview_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM adaptive_interview_sessions
      WHERE adaptive_interview_sessions.id = interview_responses_detailed.session_id
      AND adaptive_interview_sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for code_execution_results
CREATE POLICY "Users can view own code results"
  ON code_execution_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM adaptive_interview_sessions
      WHERE adaptive_interview_sessions.id = code_execution_results.session_id
      AND adaptive_interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own code results"
  ON code_execution_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM adaptive_interview_sessions
      WHERE adaptive_interview_sessions.id = code_execution_results.session_id
      AND adaptive_interview_sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for follow_up_questions
CREATE POLICY "Users can view own follow-ups"
  ON follow_up_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM adaptive_interview_sessions
      WHERE adaptive_interview_sessions.id = follow_up_questions.session_id
      AND adaptive_interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own follow-ups"
  ON follow_up_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM adaptive_interview_sessions
      WHERE adaptive_interview_sessions.id = follow_up_questions.session_id
      AND adaptive_interview_sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for interview_feedback_comprehensive
CREATE POLICY "Users can view own feedback"
  ON interview_feedback_comprehensive FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback"
  ON interview_feedback_comprehensive FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_interview_resumes_user_id ON interview_resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_adaptive_sessions_user_id ON adaptive_interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_adaptive_sessions_resume_id ON adaptive_interview_sessions(resume_id);
CREATE INDEX IF NOT EXISTS idx_questions_dynamic_session_id ON interview_questions_dynamic(session_id);
CREATE INDEX IF NOT EXISTS idx_responses_detailed_session_id ON interview_responses_detailed(session_id);
CREATE INDEX IF NOT EXISTS idx_code_execution_session_id ON code_execution_results(session_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_session_id ON follow_up_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_session_id ON interview_feedback_comprehensive(session_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_interview_resumes_updated_at
  BEFORE UPDATE ON interview_resumes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_adaptive_sessions_updated_at
  BEFORE UPDATE ON adaptive_interview_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();