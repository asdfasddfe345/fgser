/*
  # Create Job Applications Table

  1. New Table
    - `job_applications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `job_listing_id` (uuid, foreign key to job_listings)
      - `full_name` (text, not null)
      - `email` (text, not null)
      - `phone` (text, not null)
      - `linkedin_url` (text, nullable)
      - `github_url` (text, nullable)
      - `portfolio_url` (text, nullable)
      - `degree` (text, not null) - NEW: Degree/Qualification
      - `institution` (text, not null)
      - `passed_out_year` (integer, not null) - NEW: Year of graduation
      - `completion_date` (date, nullable) - NEW: Specific completion date (MM/YYYY)
      - `cgpa` (text, nullable)
      - `company_name` (text, nullable) - Previous company
      - `job_title` (text, nullable) - Previous job title
      - `experience_duration` (text, nullable)
      - `experience_description` (text, nullable)
      - `why_good_fit` (text, nullable)
      - `expected_salary` (text, nullable)
      - `notice_period` (text, nullable)
      - `available_to_start` (text, nullable)
      - `resume_file_url` (text, not null)
      - `cover_letter_url` (text, nullable)
      - `application_method` (text, not null) - 'optimized' or 'normal'
      - `optimized_resume_id` (uuid, nullable) - foreign key to optimized_resumes
      - `status` (text, not null, default 'pending')
      - `applied_at` (timestamptz, not null, default now())
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on job_applications table
    - Add policy for users to read their own applications
    - Add policy for users to insert their own applications
    - Add policy for users to update their own applications

  3. Important Notes
    - NEW FIELDS: degree, passed_out_year, completion_date added to education section
    - These fields are required for proper job applications
    - Completion date format is MM/YYYY for month and year display
*/

-- Create job_applications table
CREATE TABLE IF NOT EXISTS job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_listing_id uuid REFERENCES job_listings(id) ON DELETE CASCADE NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  linkedin_url text,
  github_url text,
  portfolio_url text,
  degree text NOT NULL,
  institution text NOT NULL,
  passed_out_year integer NOT NULL,
  completion_date date,
  cgpa text,
  company_name text,
  job_title text,
  experience_duration text,
  experience_description text,
  why_good_fit text,
  expected_salary text,
  notice_period text,
  available_to_start text,
  resume_file_url text NOT NULL,
  cover_letter_url text,
  application_method text NOT NULL CHECK (application_method IN ('optimized', 'normal')),
  optimized_resume_id uuid REFERENCES optimized_resumes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'accepted', 'rejected')),
  applied_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS job_applications_user_id_idx ON job_applications(user_id);
CREATE INDEX IF NOT EXISTS job_applications_job_listing_id_idx ON job_applications(job_listing_id);
CREATE INDEX IF NOT EXISTS job_applications_status_idx ON job_applications(status);
CREATE INDEX IF NOT EXISTS job_applications_applied_at_idx ON job_applications(applied_at DESC);

-- Enable RLS
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own applications
CREATE POLICY "Users can view own applications"
  ON job_applications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own applications
CREATE POLICY "Users can create own applications"
  ON job_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own applications
CREATE POLICY "Users can update own applications"
  ON job_applications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_job_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_applications_updated_at_trigger
  BEFORE UPDATE ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_job_applications_updated_at();

-- Create storage buckets for resumes and cover letters if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('resumes', 'resumes', true),
  ('cover-letters', 'cover-letters', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for resumes bucket
CREATE POLICY "Users can upload own resumes"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resumes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own resumes"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resumes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for cover-letters bucket
CREATE POLICY "Users can upload own cover letters"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cover-letters' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own cover letters"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cover-letters' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow public read access to resumes and cover letters (for employer viewing)
CREATE POLICY "Public can read resumes"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'resumes');

CREATE POLICY "Public can read cover letters"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'cover-letters');
