/*
  # AI Mock Interview System Schema

  ## Overview
  This migration creates the database schema for the AI Mock Interview feature, which allows users to practice technical and HR interviews with AI-powered feedback.

  ## New Tables

  ### 1. `interview_questions`
  Stores the pool of interview questions used during mock interviews.
  - `id` (uuid, primary key) - Unique question identifier
  - `question_text` (text) - The actual interview question
  - `category` (text) - Question category (HR, Technical, Behavioral, Coding, Projects, Aptitude)
  - `difficulty` (text) - Question difficulty level (Easy, Medium, Hard)
  - `interview_type` (text) - Type of interview (general, company-specific)
  - `company_name` (text, nullable) - Specific company name if company-specific question
  - `role` (text, nullable) - Specific role for company-specific questions
  - `is_active` (boolean) - Whether the question is currently active
  - `created_at` (timestamptz) - Question creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `mock_interview_sessions`
  Tracks individual mock interview sessions for users.
  - `id` (uuid, primary key) - Unique session identifier
  - `user_id` (uuid, foreign key → user_profiles.id) - User taking the interview
  - `session_type` (text) - Type: 'general' or 'company-based'
  - `interview_category` (text) - Category: 'technical' or 'hr'
  - `company_name` (text, nullable) - Company name for company-based interviews
  - `target_role` (text, nullable) - Target role/position
  - `domain` (text, nullable) - Domain/specialization (Frontend, Backend, Data Science, etc.)
  - `duration_minutes` (integer) - Selected duration in minutes
  - `actual_duration_seconds` (integer, nullable) - Actual time taken
  - `overall_score` (numeric, nullable) - Overall interview score (0-100)
  - `status` (text) - Session status: 'in_progress', 'completed', 'abandoned'
  - `started_at` (timestamptz) - When interview started
  - `completed_at` (timestamptz, nullable) - When interview completed
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 3. `interview_responses`
  Stores individual question responses and AI feedback for each session.
  - `id` (uuid, primary key) - Unique response identifier
  - `session_id` (uuid, foreign key → mock_interview_sessions.id) - Parent interview session
  - `question_id` (uuid, foreign key → interview_questions.id) - Question answered
  - `question_order` (integer) - Order in which question was asked (1, 2, 3, etc.)
  - `user_answer_text` (text, nullable) - Transcribed text of user's answer
  - `audio_url` (text, nullable) - URL to recorded audio file
  - `video_url` (text, nullable) - URL to recorded video file
  - `audio_transcript` (text, nullable) - Full transcript from speech-to-text
  - `ai_feedback_json` (jsonb, nullable) - AI-generated feedback structure
  - `individual_score` (numeric, nullable) - Score for this specific answer (0-10)
  - `tone_rating` (text, nullable) - AI assessment of tone (Confident, Nervous, Professional, etc.)
  - `confidence_rating` (numeric, nullable) - Confidence score (0-10)
  - `response_duration_seconds` (integer, nullable) - Time taken to answer
  - `created_at` (timestamptz) - Response creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Users can only access their own interview sessions and responses
  - Interview questions are publicly readable but not modifiable by regular users
  - Admin users can manage all interview data

  ## Indexes
  - Indexes on foreign keys for performance
  - Index on user_id and status for quick session lookups
  - Index on category and difficulty for question selection

  ## Storage Buckets
  - Creates 'interview-recordings' bucket for audio/video files
*/

-- Create interview_questions table
CREATE TABLE IF NOT EXISTS interview_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  category text NOT NULL CHECK (category IN ('HR', 'Technical', 'Behavioral', 'Coding', 'Projects', 'Aptitude')),
  difficulty text NOT NULL DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  interview_type text NOT NULL DEFAULT 'general' CHECK (interview_type IN ('general', 'company-specific')),
  company_name text,
  role text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create mock_interview_sessions table
CREATE TABLE IF NOT EXISTS mock_interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  session_type text NOT NULL CHECK (session_type IN ('general', 'company-based')),
  interview_category text NOT NULL CHECK (interview_category IN ('technical', 'hr', 'behavioral', 'mixed')),
  company_name text,
  target_role text,
  domain text,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  actual_duration_seconds integer,
  overall_score numeric CHECK (overall_score >= 0 AND overall_score <= 100),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned', 'paused')),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create interview_responses table
CREATE TABLE IF NOT EXISTS interview_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES mock_interview_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES interview_questions(id) ON DELETE RESTRICT,
  question_order integer NOT NULL CHECK (question_order > 0),
  user_answer_text text,
  audio_url text,
  video_url text,
  audio_transcript text,
  ai_feedback_json jsonb,
  individual_score numeric CHECK (individual_score >= 0 AND individual_score <= 10),
  tone_rating text,
  confidence_rating numeric CHECK (confidence_rating >= 0 AND confidence_rating <= 10),
  response_duration_seconds integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(session_id, question_order)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_interview_questions_category ON interview_questions(category);
CREATE INDEX IF NOT EXISTS idx_interview_questions_type_company ON interview_questions(interview_type, company_name);
CREATE INDEX IF NOT EXISTS idx_interview_questions_active ON interview_questions(is_active);

CREATE INDEX IF NOT EXISTS idx_mock_sessions_user_id ON mock_interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mock_sessions_status ON mock_interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_mock_sessions_user_status ON mock_interview_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_mock_sessions_started_at ON mock_interview_sessions(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_responses_session_id ON interview_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_responses_question_id ON interview_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_interview_responses_order ON interview_responses(session_id, question_order);

-- Enable Row Level Security
ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for interview_questions
-- Anyone can read active questions (needed for interview flow)
CREATE POLICY "Anyone can view active interview questions"
  ON interview_questions FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Only admins can insert questions
CREATE POLICY "Admins can insert interview questions"
  ON interview_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Only admins can update questions
CREATE POLICY "Admins can update interview questions"
  ON interview_questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- RLS Policies for mock_interview_sessions
-- Users can view their own sessions
CREATE POLICY "Users can view own interview sessions"
  ON mock_interview_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own sessions
CREATE POLICY "Users can create own interview sessions"
  ON mock_interview_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update own interview sessions"
  ON mock_interview_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all sessions
CREATE POLICY "Admins can view all interview sessions"
  ON mock_interview_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- RLS Policies for interview_responses
-- Users can view responses for their own sessions
CREATE POLICY "Users can view own interview responses"
  ON interview_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mock_interview_sessions
      WHERE mock_interview_sessions.id = interview_responses.session_id
      AND mock_interview_sessions.user_id = auth.uid()
    )
  );

-- Users can create responses for their own sessions
CREATE POLICY "Users can create own interview responses"
  ON interview_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mock_interview_sessions
      WHERE mock_interview_sessions.id = interview_responses.session_id
      AND mock_interview_sessions.user_id = auth.uid()
    )
  );

-- Users can update responses for their own sessions
CREATE POLICY "Users can update own interview responses"
  ON interview_responses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mock_interview_sessions
      WHERE mock_interview_sessions.id = interview_responses.session_id
      AND mock_interview_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mock_interview_sessions
      WHERE mock_interview_sessions.id = interview_responses.session_id
      AND mock_interview_sessions.user_id = auth.uid()
    )
  );

-- Admins can view all responses
CREATE POLICY "Admins can view all interview responses"
  ON interview_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Create storage bucket for interview recordings (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('interview-recordings', 'interview-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for interview recordings
CREATE POLICY "Users can upload their own interview recordings"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'interview-recordings' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read their own interview recordings"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'interview-recordings' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_interview_questions_updated_at BEFORE UPDATE ON interview_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mock_sessions_updated_at BEFORE UPDATE ON mock_interview_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_responses_updated_at BEFORE UPDATE ON interview_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample interview questions for trial version
-- Technical Questions
INSERT INTO interview_questions (question_text, category, difficulty, interview_type) VALUES
  ('Explain the difference between var, let, and const in JavaScript.', 'Technical', 'Easy', 'general'),
  ('What is the difference between == and === in JavaScript?', 'Technical', 'Easy', 'general'),
  ('How does the event loop work in JavaScript?', 'Technical', 'Medium', 'general'),
  ('Explain closures in JavaScript with an example.', 'Technical', 'Medium', 'general'),
  ('What are promises and how do they differ from callbacks?', 'Technical', 'Medium', 'general'),
  ('Describe the concept of hoisting in JavaScript.', 'Technical', 'Easy', 'general'),
  ('What is the purpose of the virtual DOM in React?', 'Technical', 'Medium', 'general'),
  ('Explain the difference between SQL and NoSQL databases.', 'Technical', 'Medium', 'general'),
  ('What is RESTful API design and what are its principles?', 'Technical', 'Medium', 'general'),
  ('Describe the SOLID principles in object-oriented programming.', 'Technical', 'Hard', 'general')
ON CONFLICT DO NOTHING;

-- HR/Behavioral Questions
INSERT INTO interview_questions (question_text, category, difficulty, interview_type) VALUES
  ('Tell me about yourself and your background.', 'HR', 'Easy', 'general'),
  ('Why do you want to work for our company?', 'HR', 'Easy', 'general'),
  ('What are your greatest strengths and weaknesses?', 'HR', 'Easy', 'general'),
  ('Describe a challenging project you worked on and how you overcame obstacles.', 'Behavioral', 'Medium', 'general'),
  ('Tell me about a time when you had to work under tight deadlines.', 'Behavioral', 'Medium', 'general'),
  ('How do you handle conflicts with team members?', 'Behavioral', 'Medium', 'general'),
  ('Where do you see yourself in 5 years?', 'HR', 'Easy', 'general'),
  ('Describe a situation where you had to learn a new technology quickly.', 'Behavioral', 'Medium', 'general'),
  ('What motivates you in your work?', 'HR', 'Easy', 'general'),
  ('Why should we hire you over other candidates?', 'HR', 'Medium', 'general')
ON CONFLICT DO NOTHING;
