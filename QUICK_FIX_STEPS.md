# Quick Fix Steps - Admin RLS Issue

## The Problem
Error: "new row violates row-level security policy for table 'job_listings'"

## The Solution (5 Steps)

### Step 1: Apply Migration
Open Supabase SQL Editor and run the migration:
```
supabase/migrations/20251002120000_comprehensive_admin_rls_fix.sql
```

Or copy/paste the entire file content into SQL Editor and execute.

### Step 2: Verify Admin User
Run this query to confirm admin role is set:
```sql
SELECT debug_admin_status();
```

Expected result should show:
- `is_admin_result: true`
- `profile_role: admin`
- `metadata_role: admin`

### Step 3: Log Out and Log Back In
**CRITICAL STEP:**
1. Log out of the application
2. Close all browser tabs
3. Clear browser cache (optional but recommended)
4. Log back in with: primoboostai@gmail.com

### Step 4: Test Job Creation
1. Go to `/admin/jobs/new`
2. Fill in the form
3. Click "Create Job Listing"
4. Should succeed without RLS errors

### Step 5: If Still Having Issues
Run this to manually sync:
```sql
SELECT sync_user_admin_role(
  (SELECT id FROM auth.users WHERE email = 'primoboostai@gmail.com')
);
```

Then log out and log back in again.

## Quick Debugging

Check admin status from browser console:
```javascript
// In browser console
const { data } = await supabase.rpc('debug_admin_status');
console.log(data);
```

Or check in SQL:
```sql
SELECT debug_admin_status();
```

## Common Issues

**Issue:** Still getting RLS errors after applying migration
**Fix:** Make sure you logged out and logged back in. Session needs to refresh.

**Issue:** debug_admin_status shows is_admin_result: false
**Fix:** Run the sync function and log out/in again.

**Issue:** User not found
**Fix:** Sign up with primoboostai@gmail.com first, then apply migration.

## Key Files Changed

1. Migration: `supabase/migrations/20251002120000_comprehensive_admin_rls_fix.sql`
2. Service: `src/services/jobsService.ts` (better error messages)
3. Service: `src/services/adminService.ts` (debug functions)

## Success Indicators

✅ Can create job listings without errors
✅ `debug_admin_status()` shows `is_admin_result: true`
✅ Console logs show "Admin verification successful"
✅ No RLS policy violation errors

## Still Need Help?

See the complete guide: `ADMIN_RLS_FIX_COMPLETE.md`
