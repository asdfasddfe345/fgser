/*
  # AI Job Recommendations System

  This migration adds tables and functionality for AI-powered job recommendations:

  1. New Tables
    - `user_job_preferences`: Stores user resume data and job preferences
    - `ai_job_recommendations`: Stores AI-generated job match scores and reasons
    - `user_resume_storage`: Tracks uploaded resume files

  2. Storage
    - Creates `user-resumes` bucket for storing resume files

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to manage their own data
    - Admin policies for viewing all recommendations

  4. Indexes
    - Optimize queries for match scores and user lookups
*/

-- ============================================================================
-- USER JOB PREFERENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_job_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resume_text text,
  resume_url text,
  passout_year integer,
  role_type text CHECK (role_type IN ('internship', 'fulltime', 'both')),
  tech_interests text[] DEFAULT ARRAY[]::text[],
  preferred_modes text[] DEFAULT ARRAY[]::text[],
  skills_extracted jsonb DEFAULT '{}'::jsonb,
  onboarding_completed boolean DEFAULT false,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_job_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON user_job_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_job_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_job_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences"
  ON user_job_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_job_preferences_user_id_idx ON user_job_preferences(user_id);
CREATE INDEX IF NOT EXISTS user_job_preferences_passout_year_idx ON user_job_preferences(passout_year);

-- ============================================================================
-- AI JOB RECOMMENDATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_job_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
  match_score integer NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  match_reason text,
  skills_matched text[] DEFAULT ARRAY[]::text[],
  location_match boolean DEFAULT false,
  year_match boolean DEFAULT false,
  is_dismissed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, job_id)
);

ALTER TABLE ai_job_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recommendations"
  ON ai_job_recommendations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recommendations"
  ON ai_job_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recommendations"
  ON ai_job_recommendations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all recommendations"
  ON ai_job_recommendations FOR SELECT
  TO authenticated
  USING (is_current_user_admin());

CREATE INDEX IF NOT EXISTS ai_job_recommendations_user_id_idx ON ai_job_recommendations(user_id);
CREATE INDEX IF NOT EXISTS ai_job_recommendations_job_id_idx ON ai_job_recommendations(job_id);
CREATE INDEX IF NOT EXISTS ai_job_recommendations_match_score_idx ON ai_job_recommendations(user_id, match_score DESC);
CREATE INDEX IF NOT EXISTS ai_job_recommendations_created_at_idx ON ai_job_recommendations(created_at DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get recommended jobs for a user
CREATE OR REPLACE FUNCTION get_user_recommended_jobs(p_user_id uuid, p_min_score integer DEFAULT 40)
RETURNS TABLE (
  job_id uuid,
  match_score integer,
  match_reason text,
  skills_matched text[],
  location_match boolean,
  year_match boolean,
  job_data jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.job_id,
    r.match_score,
    r.match_reason,
    r.skills_matched,
    r.location_match,
    r.year_match,
    to_jsonb(j.*) as job_data
  FROM ai_job_recommendations r
  JOIN job_listings j ON r.job_id = j.id
  WHERE r.user_id = p_user_id
    AND r.match_score >= p_min_score
    AND r.is_dismissed = false
    AND j.is_active = true
  ORDER BY r.match_score DESC, r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update recommendation timestamp
CREATE OR REPLACE FUNCTION update_recommendation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_job_recommendations_timestamp
  BEFORE UPDATE ON ai_job_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_recommendation_timestamp();

-- Function to clean old recommendations (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_recommendations()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_job_recommendations
  WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STORAGE BUCKET FOR RESUMES
-- ============================================================================

-- Create storage bucket for user resumes (if it doesn't exist)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('user-resumes', 'user-resumes', false)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Storage policies for user-resumes bucket
CREATE POLICY "Users can upload own resumes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own resumes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user-resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own resumes"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own resumes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
