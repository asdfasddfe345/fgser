# RLS Policy Fix - Job Listings Creation

## Problem Solved

The error "new row violates row-level security policy for table 'job_listings'" has been fixed.

### Root Cause
The admin user `primoboostai@gmail.com` existed in the database but did not have the admin role properly set in either:
- `auth.users.raw_user_meta_data`
- `user_profiles.role`

This caused the RLS policies to reject job creation attempts, even though the user should have admin privileges.

## What Was Fixed

### 1. Admin Role Granted
- Set `role = 'admin'` in `auth.users.raw_user_meta_data` for primoboostai@gmail.com
- Set `role = 'admin'` in `user_profiles` table for the same user
- Verified both settings are synchronized

### 2. Improved `is_current_user_admin()` Function
Updated the admin check function to be more robust:
- First checks `user_profiles.role` for admin status
- Falls back to checking `auth.users.raw_user_meta_data->>'role'`
- Handles null values gracefully
- Returns false if user is not authenticated

### 3. Recreated RLS Policies
Rebuilt all RLS policies on `job_listings` table:
- **Public SELECT**: Anyone can view active job listings
- **Admin SELECT**: Admins can view all job listings (including inactive)
- **Admin INSERT**: Only admins can create new job listings
- **Admin UPDATE**: Only admins can update job listings
- **Admin DELETE**: Only admins can delete job listings

### 4. Added Debug Function
Created `debug_admin_status()` function to help troubleshoot admin issues:
```sql
SELECT debug_admin_status();
```
Returns:
- Current user ID and email
- Profile role from user_profiles table
- Metadata role from auth.users table
- Whether user is considered admin
- Whether user profile exists

## Next Steps

### For the Current Admin User
1. **Log out** of the application completely
2. **Log back in** with `primoboostai@gmail.com`
3. The session will now have admin privileges
4. Navigate to the job upload form
5. You should now be able to create job listings successfully

### Testing Job Creation
1. Go to `/admin/jobs/new` (or your job upload route)
2. Fill in the required fields:
   - Company name
   - Role title
   - Domain
   - Location type
   - Experience required
   - Qualification
   - Short description (50+ chars)
   - Full description (100+ chars)
   - Application link
3. Click "Create Job Listing"
4. The job should be created successfully without RLS errors

### Adding More Admins in the Future

#### Method 1: Using SQL (Recommended)
Run this query in Supabase SQL Editor, replacing the email:
```sql
-- Grant admin role
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'new-admin@example.com';

-- Update user profile
INSERT INTO user_profiles (id, full_name, email_address, role, is_active)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)),
  email,
  'admin',
  true
FROM auth.users
WHERE email = 'new-admin@example.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  profile_updated_at = now();
```

#### Method 2: Using Supabase Dashboard
1. Go to Authentication → Users
2. Find the user to promote
3. Click to open user details
4. Edit "Raw User Meta Data"
5. Add or update: `{"role": "admin"}`
6. Save changes
7. User must log out and log back in

#### Method 3: Using Admin Functions (Once Logged In)
If you implement the admin management UI, you can use:
```javascript
const { data, error } = await supabase.rpc('grant_admin_role', {
  target_user_id: 'user-uuid-here'
});
```

## Troubleshooting

### Still Getting RLS Errors?

1. **Verify admin status**:
```sql
SELECT debug_admin_status();
```

2. **Check user exists in both tables**:
```sql
SELECT
  u.id,
  u.email,
  u.raw_user_meta_data->>'role' as metadata_role,
  up.role as profile_role
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.id
WHERE u.email = 'your-email@example.com';
```

3. **Force session refresh**:
   - Log out completely
   - Clear browser cache/cookies
   - Log back in

4. **Verify RLS policies**:
```sql
SELECT * FROM pg_policies WHERE tablename = 'job_listings';
```

### Session Not Updating After Role Change?

The session contains cached user metadata. After changing a user's role:
1. The user MUST log out
2. The user MUST log back in
3. The new session will include the updated role

### Profile Not Syncing?

If `user_profiles` doesn't have the admin role but `auth.users` does:
```sql
UPDATE user_profiles
SET role = (
  SELECT raw_user_meta_data->>'role'
  FROM auth.users
  WHERE auth.users.id = user_profiles.id
)
WHERE id IN (
  SELECT id FROM auth.users
  WHERE raw_user_meta_data->>'role' = 'admin'
);
```

## Security Notes

1. **Admin privileges are powerful** - Only grant to trusted users
2. **Change default password** - The password in ADMIN_SETUP.md should be changed
3. **Monitor admin actions** - Consider adding audit logging
4. **Regular reviews** - Periodically review who has admin access
5. **Principle of least privilege** - Don't create more admins than necessary

## Database Schema Reference

### user_profiles.role
- Type: `text`
- Values: `'client'` (default) or `'admin'`
- Indexed for performance
- Checked by RLS policies

### auth.users.raw_user_meta_data
- Type: `jsonb`
- Should contain: `{"role": "admin"}` for admin users
- Synced to user_profiles on signup/update
- Used as fallback in admin checks

## Files Modified

1. **Migration**: `supabase/migrations/[timestamp]_fix_admin_rls_policies.sql`
   - Improved `is_current_user_admin()` function
   - Recreated all job_listings RLS policies
   - Added `debug_admin_status()` helper function

2. **Database Changes**:
   - Updated admin role for primoboostai@gmail.com
   - Ensured user_profiles record exists with admin role

## Testing Checklist

- [ ] Admin user can log in successfully
- [ ] Admin sees "Admin Panel" or admin navigation options
- [ ] Admin can access `/admin/jobs/new`
- [ ] Admin can create new job listings
- [ ] Admin can edit existing job listings
- [ ] Admin can view all job listings (active and inactive)
- [ ] Non-admin users cannot create job listings
- [ ] Non-admin users can only view active job listings
- [ ] Public (unauthenticated) users can view active job listings

## Support

If you continue to experience issues:
1. Check the browser console for specific error messages
2. Review Supabase logs in the dashboard
3. Run `SELECT debug_admin_status();` to see current auth state
4. Verify the migration was applied successfully
5. Ensure you've logged out and logged back in after role changes
