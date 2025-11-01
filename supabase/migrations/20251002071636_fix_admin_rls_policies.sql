/*
  # Fix Admin RLS Policies for Job Listings
  
  1. Function Updates
    - Improve `is_current_user_admin()` to check both user_profiles and auth.users metadata
    - Add fallback checks for better reliability
    - Add proper null handling
    
  2. RLS Policy Updates
    - Update job_listings policies to be more robust
    - Add better error handling in policies
    - Ensure policies work even if user_profiles sync is delayed
    
  3. Security
    - Maintain strict access control
    - Only authenticated users with admin role can create/update/delete
    - Public can view active listings
    - Admins can view all listings
*/

-- Step 1: Improve the is_current_user_admin() function
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean AS $$
DECLARE
  user_role text;
  metadata_role text;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- First check user_profiles table
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = auth.uid();

  -- If found in user_profiles and is admin, return true
  IF user_role = 'admin' THEN
    RETURN true;
  END IF;

  -- Fallback: Check auth.users metadata directly
  SELECT raw_user_meta_data->>'role' INTO metadata_role
  FROM auth.users
  WHERE id = auth.uid();

  -- Return true if metadata shows admin
  IF metadata_role = 'admin' THEN
    RETURN true;
  END IF;

  -- Default to false
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO authenticated;

-- Step 2: Drop existing job_listings policies and recreate them
DROP POLICY IF EXISTS "Anyone can view active job listings" ON job_listings;
DROP POLICY IF EXISTS "Admins can view all job listings" ON job_listings;
DROP POLICY IF EXISTS "Admins can create job listings" ON job_listings;
DROP POLICY IF EXISTS "Admins can update job listings" ON job_listings;
DROP POLICY IF EXISTS "Admins can delete job listings" ON job_listings;

-- Public can view active job listings
CREATE POLICY "Anyone can view active job listings"
  ON job_listings
  FOR SELECT
  TO public
  USING (is_active = true);

-- Admins can view all job listings (active and inactive)
CREATE POLICY "Admins can view all job listings"
  ON job_listings
  FOR SELECT
  TO authenticated
  USING (is_current_user_admin());

-- Admins can create job listings
CREATE POLICY "Admins can create job listings"
  ON job_listings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_current_user_admin());

-- Admins can update job listings
CREATE POLICY "Admins can update job listings"
  ON job_listings
  FOR UPDATE
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- Admins can delete job listings
CREATE POLICY "Admins can delete job listings"
  ON job_listings
  FOR DELETE
  TO authenticated
  USING (is_current_user_admin());

-- Step 3: Create a helper function to debug admin status (for development)
CREATE OR REPLACE FUNCTION debug_admin_status()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'user_id', auth.uid(),
    'user_email', (SELECT email FROM auth.users WHERE id = auth.uid()),
    'profile_role', (SELECT role FROM user_profiles WHERE id = auth.uid()),
    'metadata_role', (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
    'is_admin', is_current_user_admin(),
    'profile_exists', EXISTS(SELECT 1 FROM user_profiles WHERE id = auth.uid())
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION debug_admin_status() TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION is_current_user_admin IS 'Checks if current user is admin by looking at both user_profiles.role and auth.users.raw_user_meta_data';
COMMENT ON FUNCTION debug_admin_status IS 'Returns debug information about current users admin status (for development use)';
