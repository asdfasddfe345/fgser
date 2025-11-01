/*
  # Create Jobs System Tables

  1. New Tables
    - `job_listings`
      - `id` (uuid, primary key)
      - `company_name` (text, not null)
      - `company_logo_url` (text, nullable)
      - `role_title` (text, not null)
      - `package_amount` (integer, nullable) - In rupees
      - `package_type` (text, nullable) - 'CTC', 'stipend', 'hourly'
      - `domain` (text, not null) - 'SDE', 'Data Science', etc.
      - `location_type` (text, not null) - 'Remote', 'Onsite', 'Hybrid'
      - `location_city` (text, nullable)
      - `experience_required` (text, not null) - '0-1 years', '2-5 years', etc.
      - `qualification` (text, not null)
      - `short_description` (text, not null)
      - `full_description` (text, not null)
      - `application_link` (text, not null)
      - `posted_date` (timestamptz, not null)
      - `source_api` (text, not null) - 'manual', 'linkedin', 'indeed', etc.
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

    - `optimized_resumes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles.id)
      - `job_listing_id` (uuid, foreign key to job_listings.id)
      - `resume_content` (jsonb, not null) - Structured resume data
      - `pdf_url` (text, nullable) - URL to stored PDF in Supabase Storage
      - `docx_url` (text, nullable) - URL to stored DOCX in Supabase Storage
      - `optimization_score` (integer, default 0) - AI-generated score
      - `created_at` (timestamptz, default now())

    - `manual_apply_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles.id)
      - `job_listing_id` (uuid, foreign key to job_listings.id)
      - `optimized_resume_id` (uuid, foreign key to optimized_resumes.id)
      - `application_date` (timestamptz, not null)
      - `status` (text, not null) - 'pending', 'submitted', 'failed'
      - `redirect_url` (text, not null) - The actual application link
      - `notes` (text, nullable)
      - `created_at` (timestamptz, default now())

    - `auto_apply_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles.id)
      - `job_listing_id` (uuid, foreign key to job_listings.id)
      - `optimized_resume_id` (uuid, foreign key to optimized_resumes.id)
      - `application_date` (timestamptz, not null)
      - `status` (text, not null) - 'pending', 'submitted', 'failed'
      - `screenshot_url` (text, nullable) - URL to screenshot proof
      - `form_data_snapshot` (jsonb, nullable) - Snapshot of form data used
      - `error_message` (text, nullable) - Error details if failed
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on all tables
    - Add policies for users to manage their own data
    - Allow public read access to job_listings

  3. Functions
    - Auto-update timestamp triggers
    - Helper functions for job and application management
*/

-- Create job_listings table
CREATE TABLE IF NOT EXISTS job_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  company_logo_url text,
  role_title text NOT NULL,
  package_amount integer, -- In rupees
  package_type text CHECK (package_type IN ('CTC', 'stipend', 'hourly')),
  domain text NOT NULL,
  location_type text NOT NULL CHECK (location_type IN ('Remote', 'Onsite', 'Hybrid')),
  location_city text,
  experience_required text NOT NULL,
  qualification text NOT NULL,
  short_description text NOT NULL,
  full_description text NOT NULL,
  application_link text NOT NULL,
  posted_date timestamptz NOT NULL,
  source_api text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

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

-- Enable Row Level Security
ALTER TABLE job_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimized_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_apply_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_apply_logs ENABLE ROW LEVEL SECURITY;

-- Policies for job_listings (public read access)
CREATE POLICY "Anyone can view active job listings"
  ON job_listings
  FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Service role can manage job listings"
  ON job_listings
  FOR ALL
  TO service_role
  USING (true);

-- Policies for optimized_resumes
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

CREATE POLICY "Service role can manage optimized resumes"
  ON optimized_resumes
  FOR ALL
  TO service_role
  USING (true);

-- Policies for manual_apply_logs
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

CREATE POLICY "Users can update own manual apply logs"
  ON manual_apply_logs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policies for auto_apply_logs
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

CREATE POLICY "Users can update own auto apply logs"
  ON auto_apply_logs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS job_listings_domain_idx ON job_listings(domain);
CREATE INDEX IF NOT EXISTS job_listings_location_type_idx ON job_listings(location_type);
CREATE INDEX IF NOT EXISTS job_listings_experience_idx ON job_listings(experience_required);
CREATE INDEX IF NOT EXISTS job_listings_posted_date_idx ON job_listings(posted_date);
CREATE INDEX IF NOT EXISTS job_listings_package_amount_idx ON job_listings(package_amount);
CREATE INDEX IF NOT EXISTS job_listings_active_idx ON job_listings(is_active);

CREATE INDEX IF NOT EXISTS optimized_resumes_user_id_idx ON optimized_resumes(user_id);
CREATE INDEX IF NOT EXISTS optimized_resumes_job_listing_id_idx ON optimized_resumes(job_listing_id);

CREATE INDEX IF NOT EXISTS manual_apply_logs_user_id_idx ON manual_apply_logs(user_id);
CREATE INDEX IF NOT EXISTS manual_apply_logs_job_listing_id_idx ON manual_apply_logs(job_listing_id);
CREATE INDEX IF NOT EXISTS manual_apply_logs_application_date_idx ON manual_apply_logs(application_date);

CREATE INDEX IF NOT EXISTS auto_apply_logs_user_id_idx ON auto_apply_logs(user_id);
CREATE INDEX IF NOT EXISTS auto_apply_logs_job_listing_id_idx ON auto_apply_logs(job_listing_id);
CREATE INDEX IF NOT EXISTS auto_apply_logs_application_date_idx ON auto_apply_logs(application_date);

-- Function to update job_listings timestamp
CREATE OR REPLACE FUNCTION update_job_listings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for job_listings timestamp updates
CREATE TRIGGER update_job_listings_timestamp
  BEFORE UPDATE ON job_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_job_listings_timestamp();

-- Function to get user's application history
CREATE OR REPLACE FUNCTION get_user_application_history(user_uuid uuid)
RETURNS TABLE (
  application_id uuid,
  job_id uuid,
  company_name text,
  role_title text,
  application_date timestamptz,
  application_method text,
  status text,
  resume_pdf_url text,
  screenshot_url text,
  redirect_url text
) AS $$
BEGIN
  RETURN QUERY
  -- Manual applications
  SELECT 
    mal.id as application_id,
    jl.id as job_id,
    jl.company_name,
    jl.role_title,
    mal.application_date,
    'manual'::text as application_method,
    mal.status,
    or_manual.pdf_url as resume_pdf_url,
    null::text as screenshot_url,
    mal.redirect_url
  FROM manual_apply_logs mal
  JOIN job_listings jl ON mal.job_listing_id = jl.id
  JOIN optimized_resumes or_manual ON mal.optimized_resume_id = or_manual.id
  WHERE mal.user_id = user_uuid
  
  UNION ALL
  
  -- Auto applications
  SELECT 
    aal.id as application_id,
    jl.id as job_id,
    jl.company_name,
    jl.role_title,
    aal.application_date,
    'auto'::text as application_method,
    aal.status,
    or_auto.pdf_url as resume_pdf_url,
    aal.screenshot_url,
    null::text as redirect_url
  FROM auto_apply_logs aal
  JOIN job_listings jl ON aal.job_listing_id = jl.id
  JOIN optimized_resumes or_auto ON aal.optimized_resume_id = or_auto.id
  WHERE aal.user_id = user_uuid
  
  ORDER BY application_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;