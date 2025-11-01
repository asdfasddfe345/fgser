/*
  # Complete Schema Setup with Admin Policies
  
  1. Create all necessary tables
    - user_profiles (if not exists)
    - job_listings
    - job_listing_drafts (for form auto-save)
    - optimized_resumes
    - manual_apply_logs
    - auto_apply_logs
    
  2. Setup RLS policies
    - User profile policies
    - Job listing policies (including admin access)
    - Job draft policies (admin auto-save)
    - Application log policies
    
  3. Create helper functions
    - Admin role checking
    - Auto-save and draft management
*/

-- Create user_profiles table if not exists
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

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- User profile policies
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can view own profile') THEN
    CREATE POLICY "Users can view own profile"
      ON user_profiles
      FOR SELECT
      TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile"
      ON user_profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS user_profiles_role_idx ON user_profiles(role);
CREATE INDEX IF NOT EXISTS user_profiles_email_idx ON user_profiles(email_address);

-- Create admin check function
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO authenticated;

-- Create job_listings table
CREATE TABLE IF NOT EXISTS job_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  company_logo_url text,
  role_title text NOT NULL,
  package_amount integer,
  package_type text CHECK (package_type IN ('CTC', 'stipend', 'hourly')),
  domain text NOT NULL,
  location_type text NOT NULL CHECK (location_type IN ('Remote', 'Onsite', 'Hybrid')),
  location_city text,
  experience_required text NOT NULL,
  qualification text NOT NULL,
  short_description text NOT NULL,
  full_description text NOT NULL,
  application_link text NOT NULL,
  posted_date timestamptz DEFAULT now() NOT NULL,
  source_api text DEFAULT 'manual' NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS on job_listings
ALTER TABLE job_listings ENABLE ROW LEVEL SECURITY;

-- Job listings policies
CREATE POLICY "Anyone can view active job listings"
  ON job_listings
  FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Admins can view all job listings"
  ON job_listings
  FOR SELECT
  TO authenticated
  USING (is_current_user_admin());

CREATE POLICY "Admins can create job listings"
  ON job_listings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can update job listings"
  ON job_listings
  FOR UPDATE
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can delete job listings"
  ON job_listings
  FOR DELETE
  TO authenticated
  USING (is_current_user_admin());

-- Create job_listing_drafts table for auto-save
CREATE TABLE IF NOT EXISTS job_listing_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  form_data jsonb NOT NULL,
  last_saved_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS on job_listing_drafts
ALTER TABLE job_listing_drafts ENABLE ROW LEVEL SECURITY;

-- Job draft policies
CREATE POLICY "Admins can view own drafts"
  ON job_listing_drafts
  FOR SELECT
  TO authenticated
  USING (admin_user_id = auth.uid() AND is_current_user_admin());

CREATE POLICY "Admins can create own drafts"
  ON job_listing_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (admin_user_id = auth.uid() AND is_current_user_admin());

CREATE POLICY "Admins can update own drafts"
  ON job_listing_drafts
  FOR UPDATE
  TO authenticated
  USING (admin_user_id = auth.uid() AND is_current_user_admin())
  WITH CHECK (admin_user_id = auth.uid() AND is_current_user_admin());

CREATE POLICY "Admins can delete own drafts"
  ON job_listing_drafts
  FOR DELETE
  TO authenticated
  USING (admin_user_id = auth.uid() AND is_current_user_admin());

-- Create optimized_resumes table
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

-- Enable RLS on optimized_resumes
ALTER TABLE optimized_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own optimized resumes"
  ON optimized_resumes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own optimized resumes"
  ON optimized_resumes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create manual_apply_logs table
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

-- Enable RLS on manual_apply_logs
ALTER TABLE manual_apply_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own manual apply logs"
  ON manual_apply_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own manual apply logs"
  ON manual_apply_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create auto_apply_logs table
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

-- Enable RLS on auto_apply_logs
ALTER TABLE auto_apply_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own auto apply logs"
  ON auto_apply_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own auto apply logs"
  ON auto_apply_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS job_listings_domain_idx ON job_listings(domain);
CREATE INDEX IF NOT EXISTS job_listings_location_type_idx ON job_listings(location_type);
CREATE INDEX IF NOT EXISTS job_listings_active_idx ON job_listings(is_active);
CREATE INDEX IF NOT EXISTS job_listing_drafts_admin_user_idx ON job_listing_drafts(admin_user_id);

-- Auto-update triggers
CREATE OR REPLACE FUNCTION update_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.profile_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_job_listings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_draft_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_saved_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_profiles_timestamp') THEN
    CREATE TRIGGER update_user_profiles_timestamp
      BEFORE UPDATE ON user_profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_profile_timestamp();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_job_listings_timestamp') THEN
    CREATE TRIGGER update_job_listings_timestamp
      BEFORE UPDATE ON job_listings
      FOR EACH ROW
      EXECUTE FUNCTION update_job_listings_timestamp();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_draft_timestamp') THEN
    CREATE TRIGGER update_draft_timestamp
      BEFORE UPDATE ON job_listing_drafts
      FOR EACH ROW
      EXECUTE FUNCTION update_draft_timestamp();
  END IF;
END $$;

-- Function to create/update profile on signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id, 
    full_name, 
    email_address,
    role,
    is_active,
    profile_created_at, 
    profile_updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NEW.raw_user_meta_data->>'name', user_profiles.full_name),
    email_address = NEW.email,
    role = COALESCE(NEW.raw_user_meta_data->>'role', user_profiles.role),
    profile_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for profile creation
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'create_profile_on_signup') THEN
    CREATE TRIGGER create_profile_on_signup
      AFTER INSERT ON auth.users
      FOR EACH ROW 
      EXECUTE FUNCTION create_user_profile();
  END IF;
END $$;