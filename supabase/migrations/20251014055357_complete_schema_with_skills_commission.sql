/*
  # Complete Schema with Skills and Commission Tracking

  This migration creates the complete database schema including:
  1. User profiles and authentication
  2. Job listings with skills and commission tracking
  3. Application logs (manual and auto)
  4. Referral system
  5. RLS policies
  6. Helper functions
*/

-- ============================================================================
-- USER PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email_address text NOT NULL,
  role text DEFAULT 'client' NOT NULL CHECK (role IN ('client', 'admin')),
  is_active boolean DEFAULT true NOT NULL,
  phone text,
  resumes_created_count integer DEFAULT 0 NOT NULL,
  profile_created_at timestamptz DEFAULT now() NOT NULL,
  profile_updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE INDEX IF NOT EXISTS user_profiles_role_idx ON user_profiles(role);
CREATE INDEX IF NOT EXISTS user_profiles_email_idx ON user_profiles(email_address);

-- Admin check function
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_current_user_admin() TO authenticated;

-- ============================================================================
-- JOB LISTINGS WITH SKILLS AND COMMISSION
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  company_logo_url text,
  company_website text,
  company_description text,
  role_title text NOT NULL,
  package_amount integer,
  package_type text CHECK (package_type IN ('CTC', 'stipend', 'hourly')),
  domain text NOT NULL,
  location_type text NOT NULL CHECK (location_type IN ('Remote', 'Onsite', 'Hybrid')),
  location_city text,
  experience_required text NOT NULL,
  qualification text NOT NULL,
  eligible_years text,
  short_description text NOT NULL,
  description text NOT NULL,
  full_description text NOT NULL,
  application_link text NOT NULL,
  posted_date timestamptz DEFAULT now() NOT NULL,
  source_api text DEFAULT 'manual' NOT NULL,
  is_active boolean DEFAULT true NOT NULL,

  -- Skills tracking
  skills jsonb DEFAULT '[]'::jsonb,

  -- Referral system
  referral_person_name text,
  referral_email text,
  referral_code text,
  referral_link text,
  referral_bonus_amount numeric(10, 2),
  referral_terms text,
  has_referral boolean DEFAULT false,
  commission_percentage numeric(5, 2) DEFAULT 0,

  -- Test patterns
  test_requirements text,
  has_coding_test boolean DEFAULT false,
  has_aptitude_test boolean DEFAULT false,
  has_technical_interview boolean DEFAULT false,
  has_hr_interview boolean DEFAULT false,
  test_duration_minutes integer,

  -- AI polish tracking
  ai_polished boolean DEFAULT false,
  ai_polished_at timestamptz,
  original_description text,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE job_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active job listings"
  ON job_listings FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage job listings"
  ON job_listings FOR ALL TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_listings_domain ON job_listings(domain);
CREATE INDEX IF NOT EXISTS idx_job_listings_location ON job_listings(location_type);
CREATE INDEX IF NOT EXISTS idx_job_listings_active ON job_listings(is_active, posted_date DESC);
CREATE INDEX IF NOT EXISTS idx_job_listings_skills ON job_listings USING GIN (skills);
CREATE INDEX IF NOT EXISTS idx_job_listings_referral ON job_listings(has_referral) WHERE has_referral = true;
CREATE INDEX IF NOT EXISTS idx_job_listings_commission ON job_listings(commission_percentage) WHERE commission_percentage > 0;

-- ============================================================================
-- OPTIMIZED RESUMES
-- ============================================================================

CREATE TABLE IF NOT EXISTS optimized_resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  job_listing_id uuid REFERENCES job_listings(id) ON DELETE CASCADE NOT NULL,
  resume_content jsonb NOT NULL,
  pdf_url text,
  docx_url text,
  optimization_score integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE optimized_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own resumes"
  ON optimized_resumes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own resumes"
  ON optimized_resumes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_optimized_resumes_user ON optimized_resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_optimized_resumes_job ON optimized_resumes(job_listing_id);

-- ============================================================================
-- APPLICATION LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS manual_apply_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  job_listing_id uuid REFERENCES job_listings(id) ON DELETE CASCADE NOT NULL,
  optimized_resume_id uuid REFERENCES optimized_resumes(id) ON DELETE CASCADE NOT NULL,
  application_date timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'submitted', 'failed')),
  redirect_url text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE manual_apply_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own manual logs"
  ON manual_apply_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own manual logs"
  ON manual_apply_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_manual_apply_user ON manual_apply_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_apply_job ON manual_apply_logs(job_listing_id);

CREATE TABLE IF NOT EXISTS auto_apply_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  job_listing_id uuid REFERENCES job_listings(id) ON DELETE CASCADE NOT NULL,
  optimized_resume_id uuid REFERENCES optimized_resumes(id) ON DELETE CASCADE NOT NULL,
  application_date timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'submitted', 'failed')),
  screenshot_url text,
  form_data_snapshot jsonb,
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE auto_apply_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own auto logs"
  ON auto_apply_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own auto logs"
  ON auto_apply_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_auto_apply_user ON auto_apply_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_apply_job ON auto_apply_logs(job_listing_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Skill extraction function
CREATE OR REPLACE FUNCTION extract_skills_from_text(text_content text)
RETURNS jsonb AS $$
DECLARE
  common_skills text[] := ARRAY[
    'Python', 'Java', 'JavaScript', 'TypeScript', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP',
    'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQL', 'NoSQL',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Git', 'CI/CD',
    'Machine Learning', 'ML', 'AI', 'Deep Learning', 'Data Science',
    'REST API', 'GraphQL', 'Microservices', 'Agile',
    'HTML', 'CSS', 'Tailwind', 'Bootstrap',
    'TensorFlow', 'PyTorch', 'Pandas', 'NumPy',
    'Linux', 'Bash'
  ];
  skill text;
  found_skills jsonb := '[]'::jsonb;
  lower_text text;
BEGIN
  lower_text := LOWER(text_content);

  FOREACH skill IN ARRAY common_skills
  LOOP
    IF lower_text LIKE '%' || LOWER(skill) || '%' THEN
      found_skills := found_skills || jsonb_build_array(skill);
    END IF;
  END LOOP;

  RETURN found_skills;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Commission calculation trigger
CREATE OR REPLACE FUNCTION calculate_commission_percentage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_bonus_amount IS NOT NULL AND NEW.referral_bonus_amount > 0 THEN
    IF NEW.package_amount IS NOT NULL AND NEW.package_amount > 0 THEN
      NEW.commission_percentage := LEAST(
        ROUND((NEW.referral_bonus_amount::numeric / NEW.package_amount::numeric) * 100, 2),
        30.00
      );
    ELSE
      NEW.commission_percentage := 20.00;
    END IF;
  ELSE
    NEW.commission_percentage := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_commission
  BEFORE INSERT OR UPDATE OF referral_bonus_amount, package_amount ON job_listings
  FOR EACH ROW
  EXECUTE FUNCTION calculate_commission_percentage();

-- Auto-update has_referral flag
CREATE OR REPLACE FUNCTION update_job_referral_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.has_referral := (
    NEW.referral_person_name IS NOT NULL OR
    NEW.referral_email IS NOT NULL OR
    NEW.referral_code IS NOT NULL OR
    NEW.referral_link IS NOT NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_referral_status
  BEFORE INSERT OR UPDATE ON job_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_job_referral_status();

-- User application status view
CREATE OR REPLACE VIEW user_job_applications AS
SELECT
  mal.user_id,
  mal.job_listing_id,
  'manual' as application_method,
  mal.application_date,
  mal.status,
  jl.commission_percentage,
  LEAST(jl.commission_percentage * 0.6, 15)::numeric(5,2) as earned_commission
FROM manual_apply_logs mal
INNER JOIN job_listings jl ON mal.job_listing_id = jl.id
UNION ALL
SELECT
  aal.user_id,
  aal.job_listing_id,
  'auto' as application_method,
  aal.application_date,
  aal.status,
  jl.commission_percentage,
  LEAST(jl.commission_percentage, 25)::numeric(5,2) as earned_commission
FROM auto_apply_logs aal
INNER JOIN job_listings jl ON aal.job_listing_id = jl.id;

-- ============================================================================
-- PROFILE CREATION TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id, full_name, email_address, role, is_active
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email_address = NEW.email,
    profile_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();
