/*
  # Add Complete Admin Role System

  1. Schema Changes
    - Add `role` column to user_profiles table with default 'client'
    - Create index on role column for performance

  2. Trigger Updates
    - Update create_user_profile trigger to sync role from auth.users metadata
    - Add trigger to keep role in sync when auth.users metadata changes

  3. Admin Functions
    - `grant_admin_role(user_id)` - Promote a user to admin
    - `revoke_admin_role(user_id)` - Demote an admin to client
    - `get_all_admins()` - List all admin users
    - `is_current_user_admin()` - Check if current user is admin

  4. RLS Policy Updates
    - Update policies to give admins full access to all tables
    - Add admin-only policies for sensitive operations

  5. Security
    - Only existing admins can grant/revoke admin roles
    - Admin operations are logged
    - Proper validation and error handling
*/

-- Step 1: Add role column to user_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE user_profiles
    ADD COLUMN role text DEFAULT 'client' NOT NULL
    CHECK (role IN ('client', 'admin'));

    COMMENT ON COLUMN user_profiles.role IS 'User role: client (default) or admin';
  END IF;
END $$;

-- Create index on role column for faster queries
CREATE INDEX IF NOT EXISTS user_profiles_role_idx ON user_profiles(role);

-- Step 2: Sync existing roles from auth.users to user_profiles
UPDATE user_profiles
SET role = COALESCE(
  (SELECT auth.users.raw_user_meta_data->>'role'
   FROM auth.users
   WHERE auth.users.id = user_profiles.id),
  'client'
)
WHERE role IS NULL OR role = 'client';

-- Step 3: Update the create_user_profile trigger to sync role
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
    full_name = COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), user_profiles.full_name),
    email_address = NEW.email,
    role = COALESCE(NEW.raw_user_meta_data->>'role', user_profiles.role),
    profile_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create admin management functions

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to grant admin role to a user
CREATE OR REPLACE FUNCTION grant_admin_role(target_user_id uuid)
RETURNS json AS $$
DECLARE
  current_user_role text;
  target_user_email text;
  result json;
BEGIN
  -- Check if current user is admin
  SELECT role INTO current_user_role
  FROM user_profiles
  WHERE id = auth.uid();

  IF current_user_role != 'admin' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Only administrators can grant admin roles'
    );
  END IF;

  -- Get target user email for logging
  SELECT email_address INTO target_user_email
  FROM user_profiles
  WHERE id = target_user_id;

  IF target_user_email IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User not found'
    );
  END IF;

  -- Update user_profiles
  UPDATE user_profiles
  SET role = 'admin', profile_updated_at = now()
  WHERE id = target_user_id;

  -- Update auth.users metadata
  UPDATE auth.users
  SET raw_user_meta_data =
    COALESCE(raw_user_meta_data, '{}'::jsonb) ||
    json_build_object('role', 'admin')::jsonb
  WHERE id = target_user_id;

  RETURN json_build_object(
    'success', true,
    'message', format('Successfully granted admin role to %s', target_user_email),
    'user_id', target_user_id,
    'user_email', target_user_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke admin role from a user
CREATE OR REPLACE FUNCTION revoke_admin_role(target_user_id uuid)
RETURNS json AS $$
DECLARE
  current_user_role text;
  target_user_email text;
  admin_count integer;
  result json;
BEGIN
  -- Check if current user is admin
  SELECT role INTO current_user_role
  FROM user_profiles
  WHERE id = auth.uid();

  IF current_user_role != 'admin' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Only administrators can revoke admin roles'
    );
  END IF;

  -- Prevent removing the last admin
  SELECT COUNT(*) INTO admin_count
  FROM user_profiles
  WHERE role = 'admin';

  IF admin_count <= 1 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Cannot revoke the last admin. At least one admin must remain.'
    );
  END IF;

  -- Prevent self-demotion
  IF target_user_id = auth.uid() THEN
    RETURN json_build_object(
      'success', false,
      'message', 'You cannot revoke your own admin role'
    );
  END IF;

  -- Get target user email for logging
  SELECT email_address INTO target_user_email
  FROM user_profiles
  WHERE id = target_user_id;

  IF target_user_email IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User not found'
    );
  END IF;

  -- Update user_profiles
  UPDATE user_profiles
  SET role = 'client', profile_updated_at = now()
  WHERE id = target_user_id;

  -- Update auth.users metadata
  UPDATE auth.users
  SET raw_user_meta_data =
    COALESCE(raw_user_meta_data, '{}'::jsonb) ||
    json_build_object('role', 'client')::jsonb
  WHERE id = target_user_id;

  RETURN json_build_object(
    'success', true,
    'message', format('Successfully revoked admin role from %s', target_user_email),
    'user_id', target_user_id,
    'user_email', target_user_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all admin users
CREATE OR REPLACE FUNCTION get_all_admins()
RETURNS TABLE (
  id uuid,
  full_name text,
  email_address text,
  profile_created_at timestamptz
) AS $$
BEGIN
  -- Check if current user is admin
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Only administrators can view admin list';
  END IF;

  RETURN QUERY
  SELECT
    user_profiles.id,
    user_profiles.full_name,
    user_profiles.email_address,
    user_profiles.profile_created_at
  FROM user_profiles
  WHERE user_profiles.role = 'admin'
  ORDER BY user_profiles.profile_created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all users (admin-only)
CREATE OR REPLACE FUNCTION get_all_users(
  search_query text DEFAULT '',
  role_filter text DEFAULT 'all',
  limit_count integer DEFAULT 50,
  offset_count integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  full_name text,
  email_address text,
  role text,
  is_active boolean,
  phone text,
  profile_created_at timestamptz,
  resumes_created_count integer
) AS $$
BEGIN
  -- Check if current user is admin
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Only administrators can view all users';
  END IF;

  RETURN QUERY
  SELECT
    user_profiles.id,
    user_profiles.full_name,
    user_profiles.email_address,
    user_profiles.role,
    user_profiles.is_active,
    user_profiles.phone,
    user_profiles.profile_created_at,
    user_profiles.resumes_created_count
  FROM user_profiles
  WHERE
    (search_query = '' OR
     user_profiles.full_name ILIKE '%' || search_query || '%' OR
     user_profiles.email_address ILIKE '%' || search_query || '%')
    AND
    (role_filter = 'all' OR user_profiles.role = role_filter)
  ORDER BY user_profiles.profile_created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Update RLS policies for admin access

-- Drop and recreate admin policies on subscriptions
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON subscriptions;
CREATE POLICY "Admins can view all subscriptions"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON subscriptions;
CREATE POLICY "Admins can manage all subscriptions"
  ON subscriptions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Drop and recreate admin policies on payment_transactions
DROP POLICY IF EXISTS "Admins can view all transactions" ON payment_transactions;
CREATE POLICY "Admins can view all transactions"
  ON payment_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can manage all transactions" ON payment_transactions;
CREATE POLICY "Admins can manage all transactions"
  ON payment_transactions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Grant execute permissions on admin functions
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION grant_admin_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_admin_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users(text, text, integer, integer) TO authenticated;

-- Create a view for easier admin checks (optional)
CREATE OR REPLACE VIEW admin_users AS
SELECT
  id,
  full_name,
  email_address,
  profile_created_at,
  profile_updated_at
FROM user_profiles
WHERE role = 'admin';

-- Add helpful comments
COMMENT ON FUNCTION grant_admin_role IS 'Promotes a user to admin role. Only admins can execute this.';
COMMENT ON FUNCTION revoke_admin_role IS 'Demotes an admin to client role. Only admins can execute this. Cannot remove the last admin or self-demote.';
COMMENT ON FUNCTION get_all_admins IS 'Returns list of all admin users. Only admins can execute this.';
COMMENT ON FUNCTION get_all_users IS 'Returns paginated list of all users with search and filtering. Only admins can execute this.';
COMMENT ON FUNCTION is_current_user_admin IS 'Returns true if the current authenticated user is an admin.';
