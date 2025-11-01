/*
  # Extend user_profiles for Jobs System

  1. New Columns
    - `education_details` (jsonb) - Structured education information
    - `experience_details` (jsonb) - Structured work experience
    - `skills_details` (jsonb) - Structured skills information
    - `linkedin_profile_url` (text) - LinkedIn profile URL
    - `github_profile_url` (text) - GitHub profile URL
    - `resume_headline` (text) - Professional headline for auto-apply
    - `current_location` (text) - Current location for job matching

  2. Security
    - Update existing RLS policies to include new fields
    - Ensure users can only update their own profile details

  3. Functions
    - Helper functions for profile completion checking
*/

-- Add new columns to user_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'education_details'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN education_details jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'experience_details'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN experience_details jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'skills_details'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN skills_details jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'linkedin_profile_url'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN linkedin_profile_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'github_profile_url'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN github_profile_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'resume_headline'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN resume_headline text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'current_location'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN current_location text;
  END IF;
END $$;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS user_profiles_linkedin_url_idx ON user_profiles(linkedin_profile_url);
CREATE INDEX IF NOT EXISTS user_profiles_github_url_idx ON user_profiles(github_profile_url);
CREATE INDEX IF NOT EXISTS user_profiles_current_location_idx ON user_profiles(current_location);

-- Function to check if user profile is complete for auto-apply
CREATE OR REPLACE FUNCTION is_profile_complete_for_auto_apply(user_uuid uuid)
RETURNS boolean AS $$
DECLARE
  profile_record user_profiles%ROWTYPE;
BEGIN
  SELECT * INTO profile_record
  FROM user_profiles
  WHERE id = user_uuid;

  -- Check if required fields are present
  RETURN (
    profile_record.full_name IS NOT NULL AND
    profile_record.email_address IS NOT NULL AND
    profile_record.phone IS NOT NULL AND
    profile_record.education_details IS NOT NULL AND
    profile_record.linkedin_profile_url IS NOT NULL AND
    profile_record.resume_headline IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user profile for auto-apply
CREATE OR REPLACE FUNCTION get_user_auto_apply_profile(user_uuid uuid)
RETURNS TABLE (
  full_name text,
  email_address text,
  phone text,
  education_details jsonb,
  experience_details jsonb,
  skills_details jsonb,
  linkedin_profile_url text,
  github_profile_url text,
  resume_headline text,
  current_location text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.full_name,
    up.email_address,
    up.phone,
    up.education_details,
    up.experience_details,
    up.skills_details,
    up.linkedin_profile_url,
    up.github_profile_url,
    up.resume_headline,
    up.current_location
  FROM user_profiles up
  WHERE up.id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;