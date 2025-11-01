/*
  # Comprehensive Admin RLS Fix for Job Listings

  1. Admin Role Synchronization
    - Ensure primoboostai@gmail.com has admin role in both tables
    - Sync any other admin users between auth.users and user_profiles
    - Create user_profiles record if missing for admin users

  2. Function Improvements
    - Update is_current_user_admin() with enhanced logic and debugging
    - Add function to manually sync admin roles
    - Add function to verify admin setup

  3. RLS Policy Cleanup and Recreation
    - Drop ALL existing policies on job_listings to prevent conflicts
    - Recreate policies with clear, explicit logic
    - Ensure policies work regardless of role source

  4. Testing and Debugging
    - Add comprehensive debugging function
    - Create admin verification function
    - Log admin status changes
*/

-- ============================================================================
-- STEP 1: ENSURE ADMIN USER EXISTS AND IS SYNCED
-- ============================================================================

-- First, ensure user_profiles table has role column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE user_profiles
    ADD COLUMN role text DEFAULT 'client' NOT NULL
    CHECK (role IN ('client', 'admin'));
  END IF;
END $$;

-- Create or update user profile for primoboostai@gmail.com with admin role
DO $$
DECLARE
  admin_user_id uuid;
  admin_email text := 'primoboostai@gmail.com';
BEGIN
  -- Get the user ID for the admin email
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = admin_email;

  IF admin_user_id IS NOT NULL THEN
    -- Ensure the user has admin role in auth.users metadata
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
    WHERE id = admin_user_id;

    -- Ensure the user has a profile record with admin role
    INSERT INTO user_profiles (
      id,
      full_name,
      email_address,
      role,
      is_active,
      profile_created_at,
      profile_updated_at
    )
    SELECT
      admin_user_id,
      COALESCE(raw_user_meta_data->>'name', 'Admin User'),
      admin_email,
      'admin',
      true,
      now(),
      now()
    FROM auth.users
    WHERE id = admin_user_id
    ON CONFLICT (id) DO UPDATE SET
      role = 'admin',
      profile_updated_at = now();

    RAISE NOTICE 'Admin role granted to % (ID: %)', admin_email, admin_user_id;
  ELSE
    RAISE NOTICE 'Admin user % not found in auth.users. Please sign up first.', admin_email;
  END IF;
END $$;

-- Sync all admin roles from auth.users to user_profiles
UPDATE user_profiles
SET role = 'admin', profile_updated_at = now()
WHERE id IN (
  SELECT id FROM auth.users
  WHERE raw_user_meta_data->>'role' = 'admin'
)
AND role != 'admin';

-- ============================================================================
-- STEP 2: CREATE/UPDATE ADMIN CHECK FUNCTIONS
-- ============================================================================

-- Main admin check function with enhanced debugging
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean AS $$
DECLARE
  current_user_id uuid;
  user_role text;
  metadata_role text;
  has_profile boolean;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();

  -- If no user is authenticated, return false
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if user has a profile
  SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = current_user_id) INTO has_profile;

  -- If profile exists, check role in user_profiles table (primary source)
  IF has_profile THEN
    SELECT role INTO user_role
    FROM user_profiles
    WHERE id = current_user_id;

    IF user_role = 'admin' THEN
      RETURN true;
    END IF;
  END IF;

  -- Fallback: Check auth.users metadata directly (secondary source)
  SELECT raw_user_meta_data->>'role' INTO metadata_role
  FROM auth.users
  WHERE id = current_user_id;

  IF metadata_role = 'admin' THEN
    -- If metadata says admin but profile doesn't, create/update profile
    IF has_profile THEN
      UPDATE user_profiles
      SET role = 'admin', profile_updated_at = now()
      WHERE id = current_user_id;
    END IF;
    RETURN true;
  END IF;

  -- Default to false
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO anon;

-- Enhanced debug function with more details
CREATE OR REPLACE FUNCTION debug_admin_status()
RETURNS json AS $$
DECLARE
  result json;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'authenticated', false,
      'message', 'No authenticated user'
    );
  END IF;

  SELECT json_build_object(
    'authenticated', true,
    'user_id', current_user_id,
    'user_email', (SELECT email FROM auth.users WHERE id = current_user_id),
    'profile_exists', EXISTS(SELECT 1 FROM user_profiles WHERE id = current_user_id),
    'profile_role', (SELECT role FROM user_profiles WHERE id = current_user_id),
    'metadata_role', (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = current_user_id),
    'raw_metadata', (SELECT raw_user_meta_data FROM auth.users WHERE id = current_user_id),
    'is_admin_result', is_current_user_admin(),
    'timestamp', now()
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION debug_admin_status() TO authenticated;
GRANT EXECUTE ON FUNCTION debug_admin_status() TO anon;

-- Function to manually sync a user's admin role
CREATE OR REPLACE FUNCTION sync_user_admin_role(target_user_id uuid)
RETURNS json AS $$
DECLARE
  metadata_role text;
  profile_role text;
  result json;
BEGIN
  -- Get roles from both sources
  SELECT raw_user_meta_data->>'role' INTO metadata_role
  FROM auth.users
  WHERE id = target_user_id;

  SELECT role INTO profile_role
  FROM user_profiles
  WHERE id = target_user_id;

  -- If metadata says admin, update profile
  IF metadata_role = 'admin' THEN
    INSERT INTO user_profiles (
      id,
      full_name,
      email_address,
      role,
      is_active,
      profile_created_at,
      profile_updated_at
    )
    SELECT
      target_user_id,
      COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)),
      email,
      'admin',
      true,
      now(),
      now()
    FROM auth.users
    WHERE id = target_user_id
    ON CONFLICT (id) DO UPDATE SET
      role = 'admin',
      profile_updated_at = now();
  END IF;

  -- If profile says admin, update metadata
  IF profile_role = 'admin' THEN
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
    WHERE id = target_user_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'user_id', target_user_id,
    'metadata_role', metadata_role,
    'profile_role', profile_role,
    'synced_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION sync_user_admin_role(uuid) TO authenticated;

-- ============================================================================
-- STEP 3: DROP ALL EXISTING JOB_LISTINGS POLICIES
-- ============================================================================

-- Drop all existing policies to ensure clean slate
DROP POLICY IF EXISTS "Anyone can view active job listings" ON job_listings;
DROP POLICY IF EXISTS "Admins can view all job listings" ON job_listings;
DROP POLICY IF EXISTS "Admins can create job listings" ON job_listings;
DROP POLICY IF EXISTS "Admins can update job listings" ON job_listings;
DROP POLICY IF EXISTS "Admins can delete job listings" ON job_listings;
DROP POLICY IF EXISTS "Public can view active listings" ON job_listings;
DROP POLICY IF EXISTS "Admin full access" ON job_listings;
DROP POLICY IF EXISTS "Enable read access for all users" ON job_listings;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON job_listings;

-- ============================================================================
-- STEP 4: RECREATE RLS POLICIES WITH EXPLICIT LOGIC
-- ============================================================================

-- Policy 1: Public (unauthenticated and authenticated) can view ACTIVE job listings
CREATE POLICY "public_view_active_jobs"
  ON job_listings
  FOR SELECT
  USING (is_active = true);

-- Policy 2: Admins can SELECT all job listings (active and inactive)
CREATE POLICY "admin_view_all_jobs"
  ON job_listings
  FOR SELECT
  TO authenticated
  USING (is_current_user_admin());

-- Policy 3: Admins can INSERT job listings
CREATE POLICY "admin_insert_jobs"
  ON job_listings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_current_user_admin());

-- Policy 4: Admins can UPDATE job listings
CREATE POLICY "admin_update_jobs"
  ON job_listings
  FOR UPDATE
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- Policy 5: Admins can DELETE job listings
CREATE POLICY "admin_delete_jobs"
  ON job_listings
  FOR DELETE
  TO authenticated
  USING (is_current_user_admin());

-- ============================================================================
-- STEP 5: ADD HELPFUL COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION is_current_user_admin IS 'Checks if current user is admin. Checks user_profiles.role first, then falls back to auth.users.raw_user_meta_data. Auto-syncs if needed.';
COMMENT ON FUNCTION debug_admin_status IS 'Returns comprehensive debug information about current user admin status. Use this to troubleshoot RLS issues.';
COMMENT ON FUNCTION sync_user_admin_role IS 'Manually synchronizes a user admin role between auth.users and user_profiles tables.';

COMMENT ON POLICY "public_view_active_jobs" ON job_listings IS 'Allows everyone (authenticated or not) to view active job listings';
COMMENT ON POLICY "admin_view_all_jobs" ON job_listings IS 'Allows admins to view all job listings including inactive ones';
COMMENT ON POLICY "admin_insert_jobs" ON job_listings IS 'Allows only admins to create new job listings';
COMMENT ON POLICY "admin_update_jobs" ON job_listings IS 'Allows only admins to update existing job listings';
COMMENT ON POLICY "admin_delete_jobs" ON job_listings IS 'Allows only admins to delete job listings';

-- ============================================================================
-- STEP 6: VERIFY SETUP
-- ============================================================================

-- Log the admin users after setup
DO $$
DECLARE
  admin_count integer;
  admin_emails text;
BEGIN
  SELECT COUNT(*), string_agg(email_address, ', ')
  INTO admin_count, admin_emails
  FROM user_profiles
  WHERE role = 'admin';

  RAISE NOTICE 'Setup complete. Found % admin user(s): %', admin_count, admin_emails;
END $$;
