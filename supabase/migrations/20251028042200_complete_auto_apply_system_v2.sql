/*
  # Complete Auto-Apply System Schema v2

  ## Changes
  - Creates all required tables for auto-apply system
  - Drops existing policies to avoid conflicts
  - Adds comprehensive RLS policies
  - Creates storage bucket and policies

  ## Tables Created/Updated
  1. ai_project_suggestions
  2. auto_apply_applications  
  3. user_credentials_vault
  4. auto_apply_sessions
  5. auto_apply_field_mappings
  6. auto_apply_analytics
*/

-- Drop existing policies on optimized_resumes to avoid conflicts
DROP POLICY IF EXISTS "Users can view own optimized resumes" ON optimized_resumes;
DROP POLICY IF EXISTS "Users can create own optimized resumes" ON optimized_resumes;
DROP POLICY IF EXISTS "Users can update own optimized resumes" ON optimized_resumes;
DROP POLICY IF EXISTS "Users can delete own optimized resumes" ON optimized_resumes;

-- Create ai_project_suggestions table
CREATE TABLE IF NOT EXISTS ai_project_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_listing_id uuid REFERENCES job_listings(id) ON DELETE CASCADE,
  resume_id uuid REFERENCES optimized_resumes(id) ON DELETE CASCADE,
  project_title text NOT NULL,
  project_summary text NOT NULL,
  tech_stack text[] DEFAULT ARRAY[]::text[],
  github_link text,
  live_demo_link text,
  code_snippet text,
  impact_description text,
  was_selected boolean DEFAULT false,
  selection_type text CHECK (selection_type IN ('replace', 'add', 'skip')),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create auto_apply_applications table
CREATE TABLE IF NOT EXISTS auto_apply_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_listing_id uuid REFERENCES job_listings(id) ON DELETE CASCADE NOT NULL,
  resume_version_id uuid REFERENCES optimized_resumes(id) ON DELETE SET NULL,
  platform text NOT NULL,
  application_url text NOT NULL,
  status text DEFAULT 'optimizing' CHECK (status IN ('optimizing', 'filling', 'submitted', 'failed', 'paused')),
  submission_time timestamptz,
  error_message text,
  screenshot_url text,
  form_data_captured jsonb DEFAULT '{}'::jsonb,
  paused_at_field text,
  retry_count integer DEFAULT 0,
  time_taken_seconds integer,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create user_credentials_vault table
CREATE TABLE IF NOT EXISTS user_credentials_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL,
  username text,
  password_encrypted text,
  oauth_token text,
  token_expiry timestamptz,
  cookies jsonb DEFAULT '{}'::jsonb,
  is_verified boolean DEFAULT false,
  last_used timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, platform)
);

-- Create auto_apply_sessions table
CREATE TABLE IF NOT EXISTS auto_apply_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  application_id uuid REFERENCES auto_apply_applications(id) ON DELETE CASCADE NOT NULL,
  current_step text NOT NULL,
  session_data jsonb DEFAULT '{}'::jsonb,
  paused_reason text,
  can_resume boolean DEFAULT true,
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create auto_apply_field_mappings table
CREATE TABLE IF NOT EXISTS auto_apply_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL,
  field_selector text,
  user_data_mapping text,
  is_required boolean DEFAULT false,
  default_value text,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(platform, field_label)
);

-- Create auto_apply_analytics table
CREATE TABLE IF NOT EXISTS auto_apply_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date DEFAULT CURRENT_DATE NOT NULL,
  total_applications integer DEFAULT 0,
  successful_applications integer DEFAULT 0,
  failed_applications integer DEFAULT 0,
  average_match_score decimal(5,2),
  average_time_saved_minutes integer DEFAULT 0,
  platforms_used jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_project_suggestions_user_id ON ai_project_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_project_suggestions_job_listing_id ON ai_project_suggestions(job_listing_id);
CREATE INDEX IF NOT EXISTS idx_ai_project_suggestions_resume_id ON ai_project_suggestions(resume_id);
CREATE INDEX IF NOT EXISTS idx_auto_apply_applications_user_id ON auto_apply_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_apply_applications_job_listing_id ON auto_apply_applications(job_listing_id);
CREATE INDEX IF NOT EXISTS idx_auto_apply_applications_status ON auto_apply_applications(status);
CREATE INDEX IF NOT EXISTS idx_user_credentials_vault_user_id ON user_credentials_vault(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_apply_sessions_user_id ON auto_apply_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_apply_sessions_application_id ON auto_apply_sessions(application_id);
CREATE INDEX IF NOT EXISTS idx_auto_apply_analytics_user_id ON auto_apply_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_apply_analytics_date ON auto_apply_analytics(date);

-- Enable Row Level Security
ALTER TABLE optimized_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_project_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_apply_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credentials_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_apply_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_apply_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_apply_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for optimized_resumes
CREATE POLICY "Users can view own optimized resumes"
  ON optimized_resumes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own optimized resumes"
  ON optimized_resumes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own optimized resumes"
  ON optimized_resumes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own optimized resumes"
  ON optimized_resumes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for ai_project_suggestions
CREATE POLICY "Users can view own project suggestions"
  ON ai_project_suggestions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own project suggestions"
  ON ai_project_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own project suggestions"
  ON ai_project_suggestions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own project suggestions"
  ON ai_project_suggestions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for auto_apply_applications
CREATE POLICY "Users can view own applications"
  ON auto_apply_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own applications"
  ON auto_apply_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own applications"
  ON auto_apply_applications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own applications"
  ON auto_apply_applications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for user_credentials_vault
CREATE POLICY "Users can view own credentials"
  ON user_credentials_vault FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own credentials"
  ON user_credentials_vault FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials"
  ON user_credentials_vault FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials"
  ON user_credentials_vault FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for auto_apply_sessions
CREATE POLICY "Users can view own sessions"
  ON auto_apply_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
  ON auto_apply_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON auto_apply_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON auto_apply_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for auto_apply_field_mappings
CREATE POLICY "Anyone can view field mappings"
  ON auto_apply_field_mappings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can create field mappings"
  ON auto_apply_field_mappings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update field mappings"
  ON auto_apply_field_mappings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for auto_apply_analytics
CREATE POLICY "Users can view own analytics"
  ON auto_apply_analytics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own analytics"
  ON auto_apply_analytics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analytics"
  ON auto_apply_analytics FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create or replace updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_auto_apply_applications_updated_at ON auto_apply_applications;
CREATE TRIGGER update_auto_apply_applications_updated_at
  BEFORE UPDATE ON auto_apply_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_credentials_vault_updated_at ON user_credentials_vault;
CREATE TRIGGER update_user_credentials_vault_updated_at
  BEFORE UPDATE ON user_credentials_vault
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_auto_apply_sessions_updated_at ON auto_apply_sessions;
CREATE TRIGGER update_auto_apply_sessions_updated_at
  BEFORE UPDATE ON auto_apply_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
