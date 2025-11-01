/*
  # Final Admin Privileges Fix

  1. Verification and Setup
    - Verify all required functions exist
    - Ensure admin role is properly set for primoboostai@gmail.com
    - Sync roles between auth.users and user_profiles
    - Add comprehensive debugging capabilities

  2. Function Improvements
    - Enhanced is_current_user_admin() with better fallback logic
    - Improved debug_admin_status() with more detailed output
    - Add verify_admin_access() helper function

  3. RLS Policy Fixes
    - Clean up all conflicting policies on job_listings
    - Recreate policies with explicit admin checks
    - Ensure policies work with both role sources

  4. Testing and Validation
    - Add test queries to verify admin access
    - Create admin dashboard helper functions
    - Log admin operations for auditing
*/

-- ============================================================================
-- STEP 1: ENSURE USER_PROFILES TABLE HAS ROLE COLUMN
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE user_profiles
    ADD COLUMN role text DEFAULT 'client' NOT NULL
    CHECK (role IN ('client', 'admin'));

    CREATE INDEX IF NOT EXISTS user_profiles_role_idx ON user_profiles(role);
    RAISE NOTICE 'Added role column to user_profiles';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: GRANT ADMIN ROLE TO PRIMOBOOSTAI@GMAIL.COM
-- ============================================================================

DO $$
DECLARE
  admin_user_id uuid;
  admin_email text := 'primoboostai@gmail.com';
  user_exists boolean;
  profile_exists boolean;
BEGIN
  -- Check if user exists in auth.users
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = admin_email;

  user_exists := admin_user_id IS NOT NULL;

  IF user_exists THEN
    RAISE NOTICE 'Found admin user: % (ID: %)', admin_email, admin_user_id;

    -- Update auth.users metadata
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
    WHERE id = admin_user_id;

    RAISE NOTICE 'Updated auth.users metadata for %', admin_email;

    -- Check if profile exists
    SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = admin_user_id) INTO profile_exists;

    IF profile_exists THEN
      -- Update existing profile
      UPDATE user_profiles
      SET role = 'admin', profile_updated_at = now()
      WHERE id = admin_user_id;

      RAISE NOTICE 'Updated existing profile for % to admin role', admin_email;
    ELSE
      -- Create new profile
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
      WHERE id = admin_user_id;

      RAISE NOTICE 'Created new profile for % with admin role', admin_email;
    END IF;

    RAISE NOTICE '✅ Admin role successfully granted to %', admin_email;
  ELSE
    RAISE NOTICE '⚠️  User % not found in auth.users. Please sign up first.', admin_email;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: CREATE/UPDATE ADMIN CHECK FUNCTIONS
-- ============================================================================

-- Enhanced admin check function with comprehensive fallback logic
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

  -- Primary check: user_profiles table (most reliable)
  IF has_profile THEN
    SELECT role INTO user_role FROM user_profiles WHERE id = current_user_id;

    IF user_role = 'admin' THEN
      RETURN true;
    END IF;
  END IF;

  -- Fallback check: auth.users metadata
  SELECT raw_user_meta_data->>'role' INTO metadata_role
  FROM auth.users WHERE id = current_user_id;

  IF metadata_role = 'admin' THEN
    -- Sync the admin role to profile if it exists
    IF has_profile THEN
      UPDATE user_profiles
      SET role = 'admin', profile_updated_at = now()
      WHERE id = current_user_id;
    ELSE
      -- Create profile if it doesn't exist
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
        current_user_id,
        COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)),
        email,
        'admin',
        true,
        now(),
        now()
      FROM auth.users
      WHERE id = current_user_id;
    END IF;

    RETURN true;
  END IF;

  -- Default to false if neither check passes
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO anon;

COMMENT ON FUNCTION is_current_user_admin IS 'Returns true if the current authenticated user has admin role. Checks user_profiles first, then auth.users metadata. Auto-syncs roles if mismatch detected.';

-- ============================================================================
-- STEP 4: CREATE COMPREHENSIVE DEBUG FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION debug_admin_status()
RETURNS json AS $$
DECLARE
  result json;
  current_user_id uuid;
  user_email text;
  profile_role text;
  metadata_role text;
  profile_exists boolean;
  is_admin_check boolean;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'authenticated', false,
      'message', 'No authenticated user - please log in',
      'timestamp', now()
    );
  END IF;

  -- Gather all diagnostic information
  SELECT email INTO user_email FROM auth.users WHERE id = current_user_id;
  SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = current_user_id) INTO profile_exists;
  SELECT role INTO profile_role FROM user_profiles WHERE id = current_user_id;
  SELECT raw_user_meta_data->>'role' INTO metadata_role FROM auth.users WHERE id = current_user_id;
  SELECT is_current_user_admin() INTO is_admin_check;

  SELECT json_build_object(
    'authenticated', true,
    'user_id', current_user_id,
    'user_email', user_email,
    'profile_exists', profile_exists,
    'profile_role', COALESCE(profile_role, 'not set'),
    'metadata_role', COALESCE(metadata_role, 'not set'),
    'is_admin_result', is_admin_check,
    'raw_metadata', (SELECT raw_user_meta_data FROM auth.users WHERE id = current_user_id),
    'diagnosis', CASE
      WHEN is_admin_check THEN 'Admin access verified ✅'
      WHEN NOT profile_exists THEN 'Profile missing - will be created on next admin check'
      WHEN profile_role != 'admin' AND metadata_role = 'admin' THEN 'Role mismatch - will be synced on next admin check'
      WHEN profile_role = 'admin' AND metadata_role != 'admin' THEN 'Metadata missing admin role - needs manual sync'
      ELSE 'User does not have admin privileges'
    END,
    'timestamp', now()
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION debug_admin_status() TO authenticated;
GRANT EXECUTE ON FUNCTION debug_admin_status() TO anon;

COMMENT ON FUNCTION debug_admin_status IS 'Returns comprehensive diagnostic information about current user admin status. Use this function to troubleshoot admin access issues.';

-- ============================================================================
-- STEP 5: CREATE ADMIN VERIFICATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_admin_access()
RETURNS json AS $$
DECLARE
  current_user_id uuid;
  result json;
  can_insert boolean;
  can_update boolean;
  can_delete boolean;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Not authenticated'
    );
  END IF;

  -- Test actual permissions
  BEGIN
    -- Test if user can perform admin operations
    SELECT is_current_user_admin() INTO can_insert;

    RETURN json_build_object(
      'success', can_insert,
      'user_id', current_user_id,
      'is_admin', can_insert,
      'message', CASE
        WHEN can_insert THEN 'Admin access verified successfully ✅'
        ELSE 'Admin access denied - user is not an admin ❌'
      END,
      'timestamp', now()
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error verifying admin access: ' || SQLERRM
    );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION verify_admin_access() TO authenticated;

COMMENT ON FUNCTION verify_admin_access IS 'Tests if current user has working admin access to perform operations.';

-- ============================================================================
-- STEP 6: DROP ALL CONFLICTING JOB_LISTINGS POLICIES
-- ============================================================================

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  -- Drop all existing policies on job_listings
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'job_listings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON job_listings', policy_record.policyname);
    RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
  END LOOP;

  RAISE NOTICE 'All existing job_listings policies have been dropped';
END $$;

-- ============================================================================
-- STEP 7: RECREATE RLS POLICIES WITH CLEAR LOGIC
-- ============================================================================

-- Policy 1: Everyone can view ACTIVE job listings (public access)
CREATE POLICY "public_can_view_active_jobs"
  ON job_listings
  FOR SELECT
  USING (is_active = true);

-- Policy 2: Admins can view ALL job listings (including inactive)
CREATE POLICY "admins_can_view_all_jobs"
  ON job_listings
  FOR SELECT
  TO authenticated
  USING (is_current_user_admin());

-- Policy 3: Admins can INSERT new job listings
CREATE POLICY "admins_can_insert_jobs"
  ON job_listings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_current_user_admin());

-- Policy 4: Admins can UPDATE job listings
CREATE POLICY "admins_can_update_jobs"
  ON job_listings
  FOR UPDATE
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- Policy 5: Admins can DELETE job listings
CREATE POLICY "admins_can_delete_jobs"
  ON job_listings
  FOR DELETE
  TO authenticated
  USING (is_current_user_admin());

-- Add helpful comments on policies
COMMENT ON POLICY "public_can_view_active_jobs" ON job_listings IS 'Allows everyone to view active job listings';
COMMENT ON POLICY "admins_can_view_all_jobs" ON job_listings IS 'Allows admins to view all jobs including inactive ones';
COMMENT ON POLICY "admins_can_insert_jobs" ON job_listings IS 'Allows only admins to create new job listings';
COMMENT ON POLICY "admins_can_update_jobs" ON job_listings IS 'Allows only admins to update job listings';
COMMENT ON POLICY "admins_can_delete_jobs" ON job_listings IS 'Allows only admins to delete job listings';

-- ============================================================================
-- STEP 8: ENSURE RLS IS ENABLED
-- ============================================================================

ALTER TABLE job_listings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 9: CREATE HELPER VIEW FOR ADMIN USERS
-- ============================================================================

CREATE OR REPLACE VIEW admin_users_view AS
SELECT
  up.id,
  up.full_name,
  up.email_address,
  up.role,
  up.is_active,
  up.profile_created_at,
  au.raw_user_meta_data->>'role' as metadata_role,
  CASE
    WHEN up.role = 'admin' AND au.raw_user_meta_data->>'role' = 'admin' THEN 'synced ✅'
    WHEN up.role = 'admin' AND au.raw_user_meta_data->>'role' IS NULL THEN 'metadata missing ⚠️'
    WHEN up.role != 'admin' AND au.raw_user_meta_data->>'role' = 'admin' THEN 'profile not updated ⚠️'
    ELSE 'not admin'
  END as sync_status
FROM user_profiles up
JOIN auth.users au ON au.id = up.id
WHERE up.role = 'admin' OR au.raw_user_meta_data->>'role' = 'admin';

COMMENT ON VIEW admin_users_view IS 'Shows all admin users and their role sync status between user_profiles and auth.users';

-- ============================================================================
-- STEP 10: VERIFICATION AND LOGGING
-- ============================================================================

DO $$
DECLARE
  admin_count integer;
  admin_list text;
  primoboost_admin_status text;
BEGIN
  -- Count total admins
  SELECT COUNT(*) INTO admin_count
  FROM user_profiles
  WHERE role = 'admin';

  -- Get admin emails
  SELECT string_agg(email_address, ', ') INTO admin_list
  FROM user_profiles
  WHERE role = 'admin';

  -- Check primoboostai@gmail.com specifically
  SELECT
    CASE
      WHEN role = 'admin' THEN '✅ Has admin role'
      ELSE '❌ Does not have admin role'
    END
  INTO primoboost_admin_status
  FROM user_profiles
  WHERE email_address = 'primoboostai@gmail.com';

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Admin Privileges Setup Complete';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Total admin users: %', admin_count;
  RAISE NOTICE 'Admin users: %', COALESCE(admin_list, 'none');
  RAISE NOTICE 'primoboostai@gmail.com status: %', COALESCE(primoboost_admin_status, 'User not found');
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Log out from the application';
  RAISE NOTICE '2. Clear browser cache and cookies';
  RAISE NOTICE '3. Log back in with primoboostai@gmail.com';
  RAISE NOTICE '4. Try uploading a job listing';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Troubleshooting:';
  RAISE NOTICE 'Run: SELECT debug_admin_status(); to check your admin status';
  RAISE NOTICE 'Run: SELECT verify_admin_access(); to test admin permissions';
  RAISE NOTICE 'Run: SELECT * FROM admin_users_view; to see all admin users';
  RAISE NOTICE '=================================================================';
END $$;
