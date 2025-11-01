/*
  # Resume-Based AI Interview System

  ## Overview
  This migration adds support for resume-based AI interviews, allowing users to upload their resume
  and receive personalized interview questions based on their skills, experience, and projects.

  ## New Tables

  ### 1. `user_resumes`
  Stores uploaded resumes and their parsed content for interview personalization.
  - `id` (uuid, primary key) - Unique resume identifier
  - `user_id` (uuid, foreign key → user_profiles.id) - Resume owner
  - `file_url` (text) - Supabase Storage URL for the resume file
  - `file_name` (text) - Original file name
  - `file_type` (text) - File MIME type (PDF, DOCX)
  - `file_size` (integer) - File size in bytes
  - `parsed_text` (text) - Raw extracted text from resume
  - `parsed_data` (jsonb) - Structured resume data (skills, experience, projects, education)
  - `skills_detected` (text[]) - Array of detected technical and soft skills
  - `experience_level` (text) - Detected experience level: 'entry', 'junior', 'mid', 'senior', 'lead'
  - `years_of_experience` (numeric) - Estimated years of professional experience
  - `domains` (text[]) - Array of detected domains (Frontend, Backend, Data Science, etc.)
  - `is_primary` (boolean) - Whether this is the user's primary/active resume
  - `analysis_completed` (boolean) - Whether AI analysis has been completed
  - `analysis_metadata` (jsonb) - Additional analysis data and scores
  - `created_at` (timestamptz) - Resume upload timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. Table Updates: `mock_interview_sessions`
  Adds fields to link interview sessions with resumes and track question sources.
  - `resume_id` (uuid, foreign key → user_resumes.id, nullable) - Resume used for this interview
  - `question_generation_mode` (text) - Mode: 'database_only', 'ai_only', 'hybrid'
  - `database_questions_count` (integer) - Number of questions from database
  - `ai_generated_questions_count` (integer) - Number of AI-generated questions
  - `resume_skills_coverage` (jsonb) - Which resume skills were covered in questions

  ### 3. Table Updates: `interview_questions`
  Adds support for dynamically generated questions with resume context.
  - `is_dynamic` (boolean) - Whether question was AI-generated for specific user
  - `generated_for_user` (uuid, nullable) - User ID if dynamically generated
  - `resume_context` (jsonb, nullable) - Resume context used for generation
  - `source_question_id` (uuid, nullable) - Base question if derived from template

  ### 4. Table Updates: `interview_responses`
  Tracks resume relevance and validation for each response.
  - `resume_relevance_score` (numeric) - How relevant the question was to resume (0-10)
  - `validates_resume_claim` (boolean) - Whether answer validates a resume claim
  - `resume_skill_validated` (text, nullable) - Specific skill from resume being validated
  - `credibility_score` (numeric, nullable) - Answer credibility vs resume claims (0-10)

  ## Security
  - Row Level Security (RLS) enabled on user_resumes table
  - Users can only access their own resumes
  - Admin users can view all resumes for moderation
  - Resume files stored in private Supabase Storage bucket

  ## Indexes
  - Indexes on user_id and is_primary for quick resume lookups
  - Index on skills_detected for efficient skill-based matching
  - Index on experience_level for filtering questions by seniority
  - Index on analysis_completed for batch processing

  ## Storage Buckets
  - Creates 'user-resumes' bucket for resume file storage
*/

-- Create user_resumes table
CREATE TABLE IF NOT EXISTS user_resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL CHECK (file_size > 0 AND file_size <= 5242880),
  parsed_text text,
  parsed_data jsonb DEFAULT '{}'::jsonb,
  skills_detected text[] DEFAULT ARRAY[]::text[],
  experience_level text CHECK (experience_level IN ('entry', 'junior', 'mid', 'senior', 'lead', 'executive')),
  years_of_experience numeric CHECK (years_of_experience >= 0 AND years_of_experience <= 50),
  domains text[] DEFAULT ARRAY[]::text[],
  is_primary boolean DEFAULT false,
  analysis_completed boolean DEFAULT false,
  analysis_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add resume-related columns to mock_interview_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_interview_sessions' AND column_name = 'resume_id'
  ) THEN
    ALTER TABLE mock_interview_sessions ADD COLUMN resume_id uuid REFERENCES user_resumes(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_interview_sessions' AND column_name = 'question_generation_mode'
  ) THEN
    ALTER TABLE mock_interview_sessions ADD COLUMN question_generation_mode text DEFAULT 'hybrid' CHECK (question_generation_mode IN ('database_only', 'ai_only', 'hybrid'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_interview_sessions' AND column_name = 'database_questions_count'
  ) THEN
    ALTER TABLE mock_interview_sessions ADD COLUMN database_questions_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_interview_sessions' AND column_name = 'ai_generated_questions_count'
  ) THEN
    ALTER TABLE mock_interview_sessions ADD COLUMN ai_generated_questions_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_interview_sessions' AND column_name = 'resume_skills_coverage'
  ) THEN
    ALTER TABLE mock_interview_sessions ADD COLUMN resume_skills_coverage jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add dynamic question support to interview_questions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interview_questions' AND column_name = 'is_dynamic'
  ) THEN
    ALTER TABLE interview_questions ADD COLUMN is_dynamic boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interview_questions' AND column_name = 'generated_for_user'
  ) THEN
    ALTER TABLE interview_questions ADD COLUMN generated_for_user uuid REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interview_questions' AND column_name = 'resume_context'
  ) THEN
    ALTER TABLE interview_questions ADD COLUMN resume_context jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interview_questions' AND column_name = 'source_question_id'
  ) THEN
    ALTER TABLE interview_questions ADD COLUMN source_question_id uuid REFERENCES interview_questions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add resume validation tracking to interview_responses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interview_responses' AND column_name = 'resume_relevance_score'
  ) THEN
    ALTER TABLE interview_responses ADD COLUMN resume_relevance_score numeric CHECK (resume_relevance_score >= 0 AND resume_relevance_score <= 10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interview_responses' AND column_name = 'validates_resume_claim'
  ) THEN
    ALTER TABLE interview_responses ADD COLUMN validates_resume_claim boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interview_responses' AND column_name = 'resume_skill_validated'
  ) THEN
    ALTER TABLE interview_responses ADD COLUMN resume_skill_validated text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interview_responses' AND column_name = 'credibility_score'
  ) THEN
    ALTER TABLE interview_responses ADD COLUMN credibility_score numeric CHECK (credibility_score >= 0 AND credibility_score <= 10);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_resumes_user_id ON user_resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_resumes_is_primary ON user_resumes(user_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_user_resumes_skills ON user_resumes USING GIN (skills_detected);
CREATE INDEX IF NOT EXISTS idx_user_resumes_experience ON user_resumes(experience_level);
CREATE INDEX IF NOT EXISTS idx_user_resumes_analysis ON user_resumes(analysis_completed);
CREATE INDEX IF NOT EXISTS idx_user_resumes_domains ON user_resumes USING GIN (domains);

CREATE INDEX IF NOT EXISTS idx_mock_sessions_resume_id ON mock_interview_sessions(resume_id);
CREATE INDEX IF NOT EXISTS idx_interview_questions_dynamic ON interview_questions(is_dynamic, generated_for_user);
CREATE INDEX IF NOT EXISTS idx_interview_responses_resume_validation ON interview_responses(validates_resume_claim);

-- Enable Row Level Security
ALTER TABLE user_resumes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_resumes
-- Users can view their own resumes
CREATE POLICY "Users can view own resumes"
  ON user_resumes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own resumes
CREATE POLICY "Users can upload own resumes"
  ON user_resumes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own resumes
CREATE POLICY "Users can update own resumes"
  ON user_resumes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own resumes
CREATE POLICY "Users can delete own resumes"
  ON user_resumes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all resumes
CREATE POLICY "Admins can view all resumes"
  ON user_resumes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Create storage bucket for user resumes
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-resumes', 'user-resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for user resumes
CREATE POLICY "Users can upload their own resumes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read their own resumes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user-resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own resumes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Trigger for updated_at on user_resumes
CREATE TRIGGER update_user_resumes_updated_at BEFORE UPDATE ON user_resumes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one primary resume per user
CREATE OR REPLACE FUNCTION ensure_single_primary_resume()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE user_resumes
    SET is_primary = false
    WHERE user_id = NEW.user_id
    AND id != NEW.id
    AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_primary_resume_trigger
  BEFORE INSERT OR UPDATE ON user_resumes
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION ensure_single_primary_resume();