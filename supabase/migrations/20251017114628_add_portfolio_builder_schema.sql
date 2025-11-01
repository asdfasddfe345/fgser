/*
  # Portfolio Builder Schema

  ## Overview
  This migration adds complete database support for the AI Portfolio Builder feature.

  ## New Tables Created

  ### 1. portfolio_data
  Stores user portfolio information including:
  - Personal information (name, contact, location, social links)
  - Professional summary or career objective
  - Work experience, projects, education
  - Skills, certifications, achievements
  - Additional custom sections
  - Associated metadata (role type, target role, creation/update timestamps)

  ### 2. portfolio_templates
  Stores template preferences and theme settings:
  - Template selection (Aurum, Nova, Slate, Vector, Scholar)
  - Theme customization (accent color, font family, dark/light mode)
  - Section visibility toggles
  - Section order preferences
  - Custom styling overrides

  ### 3. portfolio_deployments
  Tracks Netlify deployment status and analytics:
  - Deployment URLs (Netlify subdomain and custom domains)
  - Deployment status (pending, success, failed)
  - Build logs and error messages
  - Analytics data (views, shares)
  - Re-deployment history

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Users can only access their own portfolio data
  - Admin users have full access for support purposes

  ## Indexes
  - user_id indexes for fast user-based queries
  - deployment_status index for monitoring
  - created_at indexes for sorting and analytics
*/

-- ============================================================================
-- ADMIN CHECK FUNCTION (if not exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PORTFOLIO DATA TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS portfolio_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Personal Information
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  location text,
  linkedin_url text,
  github_url text,
  portfolio_url text,
  
  -- Professional Content
  user_type text NOT NULL CHECK (user_type IN ('fresher', 'student', 'experienced')),
  target_role text,
  professional_summary text,
  career_objective text,
  
  -- Experience and Projects (stored as JSONB for flexibility)
  work_experience jsonb DEFAULT '[]'::jsonb,
  projects jsonb DEFAULT '[]'::jsonb,
  education jsonb DEFAULT '[]'::jsonb,
  
  -- Skills and Certifications
  skills jsonb DEFAULT '[]'::jsonb,
  certifications jsonb DEFAULT '[]'::jsonb,
  
  -- Additional Sections
  achievements jsonb DEFAULT '[]'::jsonb,
  additional_sections jsonb DEFAULT '[]'::jsonb,
  
  -- SEO and Metadata
  seo_title text,
  seo_description text,
  seo_keywords text[],
  
  -- Raw Data (for re-processing)
  original_resume_text text,
  job_description_context text,
  
  -- Status and Timestamps
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE portfolio_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own portfolio data"
  ON portfolio_data FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolio data"
  ON portfolio_data FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolio data"
  ON portfolio_data FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own portfolio data"
  ON portfolio_data FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all portfolio data"
  ON portfolio_data FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS portfolio_data_user_id_idx ON portfolio_data(user_id);
CREATE INDEX IF NOT EXISTS portfolio_data_created_at_idx ON portfolio_data(created_at DESC);
CREATE INDEX IF NOT EXISTS portfolio_data_is_published_idx ON portfolio_data(is_published);

-- ============================================================================
-- PORTFOLIO TEMPLATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS portfolio_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_data_id uuid NOT NULL REFERENCES portfolio_data(id) ON DELETE CASCADE,
  
  -- Template Selection
  template_id text NOT NULL CHECK (template_id IN ('aurum', 'nova', 'slate', 'vector', 'scholar')),
  
  -- Theme Settings
  accent_color text DEFAULT '#3B82F6',
  font_family text DEFAULT 'Inter',
  color_mode text DEFAULT 'light' CHECK (color_mode IN ('light', 'dark', 'auto')),
  
  -- Section Visibility (JSONB for flexible section toggles)
  visible_sections jsonb DEFAULT '{"contact": true, "summary": true, "skills": true, "experience": true, "projects": true, "education": true, "certifications": true, "achievements": true}'::jsonb,
  
  -- Section Order (array of section names in display order)
  section_order text[] DEFAULT ARRAY['contact', 'summary', 'skills', 'experience', 'projects', 'education', 'certifications', 'achievements'],
  
  -- Custom Styling Overrides
  custom_css text,
  custom_fonts jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Constraint: One template per portfolio
  UNIQUE(portfolio_data_id)
);

ALTER TABLE portfolio_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own templates"
  ON portfolio_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates"
  ON portfolio_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON portfolio_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON portfolio_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all templates"
  ON portfolio_templates FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS portfolio_templates_user_id_idx ON portfolio_templates(user_id);
CREATE INDEX IF NOT EXISTS portfolio_templates_portfolio_id_idx ON portfolio_templates(portfolio_data_id);

-- ============================================================================
-- PORTFOLIO DEPLOYMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS portfolio_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_data_id uuid NOT NULL REFERENCES portfolio_data(id) ON DELETE CASCADE,
  
  -- Deployment Information
  netlify_site_id text,
  netlify_deploy_id text,
  deployment_url text NOT NULL,
  custom_domain text,
  subdomain text,
  
  -- Deployment Status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'success', 'failed')),
  build_log text,
  error_message text,
  
  -- Analytics
  view_count integer DEFAULT 0,
  share_count integer DEFAULT 0,
  analytics_data jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  deployed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE portfolio_deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deployments"
  ON portfolio_deployments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deployments"
  ON portfolio_deployments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own deployments"
  ON portfolio_deployments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own deployments"
  ON portfolio_deployments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all deployments"
  ON portfolio_deployments FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS portfolio_deployments_user_id_idx ON portfolio_deployments(user_id);
CREATE INDEX IF NOT EXISTS portfolio_deployments_portfolio_id_idx ON portfolio_deployments(portfolio_data_id);
CREATE INDEX IF NOT EXISTS portfolio_deployments_status_idx ON portfolio_deployments(status);
CREATE INDEX IF NOT EXISTS portfolio_deployments_created_at_idx ON portfolio_deployments(created_at DESC);

-- ============================================================================
-- UPDATE TIMESTAMP TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_portfolio_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for all portfolio tables
DROP TRIGGER IF EXISTS portfolio_data_update_timestamp ON portfolio_data;
CREATE TRIGGER portfolio_data_update_timestamp
  BEFORE UPDATE ON portfolio_data
  FOR EACH ROW
  EXECUTE FUNCTION update_portfolio_updated_at();

DROP TRIGGER IF EXISTS portfolio_templates_update_timestamp ON portfolio_templates;
CREATE TRIGGER portfolio_templates_update_timestamp
  BEFORE UPDATE ON portfolio_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_portfolio_updated_at();

DROP TRIGGER IF EXISTS portfolio_deployments_update_timestamp ON portfolio_deployments;
CREATE TRIGGER portfolio_deployments_update_timestamp
  BEFORE UPDATE ON portfolio_deployments
  FOR EACH ROW
  EXECUTE FUNCTION update_portfolio_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get user's latest portfolio
CREATE OR REPLACE FUNCTION get_user_latest_portfolio(p_user_id uuid)
RETURNS TABLE (
  portfolio_id uuid,
  template_id text,
  deployment_url text,
  is_published boolean,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pd.id,
    pt.template_id,
    dep.deployment_url,
    pd.is_published,
    pd.created_at
  FROM portfolio_data pd
  LEFT JOIN portfolio_templates pt ON pt.portfolio_data_id = pd.id
  LEFT JOIN portfolio_deployments dep ON dep.portfolio_data_id = pd.id AND dep.status = 'success'
  WHERE pd.user_id = p_user_id
  ORDER BY pd.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_latest_portfolio(uuid) TO authenticated;

-- Function to increment deployment view count
CREATE OR REPLACE FUNCTION increment_portfolio_views(p_deployment_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE portfolio_deployments
  SET view_count = view_count + 1,
      updated_at = now()
  WHERE id = p_deployment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_portfolio_views(uuid) TO authenticated, anon;

-- Function to check if user has portfolio deployment credits
CREATE OR REPLACE FUNCTION check_portfolio_deployment_credits(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_deployment_count integer;
BEGIN
  -- Count existing successful deployments
  SELECT COUNT(*) INTO v_deployment_count
  FROM portfolio_deployments
  WHERE user_id = p_user_id AND status = 'success';
  
  -- Allow 1 free deployment for all users
  IF v_deployment_count = 0 THEN
    RETURN true;
  END IF;
  
  -- For additional deployments, integrate with existing subscription system
  -- TODO: Check user's active subscription plan
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_portfolio_deployment_credits(uuid) TO authenticated;