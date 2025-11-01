# Database Setup Guide for PrimoBoost AI Admin Panel

This guide will help you set up the database functions and permissions required for the admin panel to work correctly.

## Current Database Configuration

- **Supabase URL**: `https://rixmudvtbfkjpwjoefon.supabase.co`
- **Environment File**: `.env` ✅ UPDATED (January 2025)
- **Migration Status**: ⚠️ PENDING - See MIGRATION_INSTRUCTIONS.md for complete setup

## Quick Setup Steps

### Step 1: Access Supabase SQL Editor

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/rixmudvtbfkjpwjoefon/sql/new)
2. Log in with your Supabase account
3. Navigate to the SQL Editor

### Step 2: Run the Admin Setup Migration

Copy and paste the entire content of this migration file into the SQL Editor:

**File**: `supabase/migrations/20251002120000_comprehensive_admin_rls_fix.sql`

This migration will:
- Create the `is_current_user_admin()` function
- Create the `debug_admin_status()` function
- Create the `sync_user_admin_role()` function
- Set up Row Level Security (RLS) policies for job_listings
- Grant admin role to primoboostai@gmail.com

### Step 3: Verify the Setup

After running the migration:

1. Refresh the admin panel page in your application
2. Click the "Check Admin Status" button in the Admin Debug Panel
3. You should see:
   - ✅ Database Connection: Connected
   - ✅ Admin Access Verified

## Required Database Functions

The following functions must exist in your database:

### 1. `is_current_user_admin()`
- Returns `boolean`
- Checks if the current authenticated user has admin privileges
- Checks both `user_profiles.role` and `auth.users.raw_user_meta_data`

### 2. `debug_admin_status()`
- Returns `json`
- Provides comprehensive diagnostic information about admin status
- Used by the Admin Debug Panel

### 3. `sync_user_admin_role(uuid)`
- Returns `json`
- Synchronizes admin role between auth.users and user_profiles

## Required Database Tables

### user_profiles
Must have a `role` column:
```sql
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS role text DEFAULT 'client' NOT NULL
CHECK (role IN ('client', 'admin'));
```

### job_listings
Must have RLS enabled with policies for:
- Public viewing of active jobs
- Admin full CRUD access

## Setting Up Your First Admin User

The migration automatically grants admin privileges to `primoboostai@gmail.com`.

To add additional admin users:

1. Ensure the user has signed up in your application
2. Run this SQL in Supabase SQL Editor:

```sql
-- Replace 'user@example.com' with the actual email
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Get user ID
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'user@example.com';

  IF admin_user_id IS NOT NULL THEN
    -- Update metadata
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
    WHERE id = admin_user_id;

    -- Update or create profile
    INSERT INTO user_profiles (id, full_name, email_address, role, is_active, profile_created_at, profile_updated_at)
    SELECT admin_user_id, COALESCE(raw_user_meta_data->>'name', 'Admin User'), email, 'admin', true, now(), now()
    FROM auth.users WHERE id = admin_user_id
    ON CONFLICT (id) DO UPDATE SET role = 'admin', profile_updated_at = now();

    RAISE NOTICE 'Admin role granted to user@example.com';
  END IF;
END $$;
```

## Troubleshooting

### Issue: "Could not find the function debug_admin_status"

**Solution**: The migration has not been applied. Follow Step 2 above.

### Issue: "Admin access denied"

**Possible causes**:
1. User email doesn't match the configured admin email
2. User profile doesn't exist in user_profiles table
3. Role is not set to 'admin' in either table

**Solution**:
- Check the Admin Debug Panel for detailed diagnostics
- Run the admin user setup SQL above
- Try logging out and logging back in

### Issue: "Cannot insert into job_listings"

**Possible causes**:
1. RLS policies not properly configured
2. User doesn't have admin role

**Solution**:
- Verify admin status using the Debug Panel
- Re-run the migration to recreate RLS policies
- Check that `is_current_user_admin()` returns true

## Verifying Your Setup

Run these queries in the Supabase SQL Editor to verify:

```sql
-- Check if functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('is_current_user_admin', 'debug_admin_status', 'sync_user_admin_role');

-- Check admin users
SELECT id, email_address, role
FROM user_profiles
WHERE role = 'admin';

-- Check RLS policies on job_listings
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'job_listings';
```

## Environment Variables

Ensure your `.env` file has the correct values:

```env
VITE_SUPABASE_URL=https://rixmudvtbfkjpwjoefon.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**Important**: After updating the `.env` file, restart your development server:
```bash
# Stop the current server (Ctrl+C)
# Clear cache and restart
npm run dev
```

## Need Help?

If you continue to experience issues:

1. Check the browser console for detailed error messages
2. Use the Admin Debug Panel to get diagnostic information
3. Verify the database URL is correct in the Debug Panel
4. Ensure you're logged in with the correct admin email
5. Clear browser cache and local storage, then try again

## Files Reference

- **Migration**: `supabase/migrations/20251002120000_comprehensive_admin_rls_fix.sql`
- **Admin Service**: `src/services/adminService.ts`
- **Admin Debug Panel**: `src/components/admin/AdminDebugPanel.tsx`
- **Environment Config**: `.env`
