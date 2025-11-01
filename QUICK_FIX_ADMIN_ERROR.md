# Quick Fix: Admin Privileges Error

## Immediate Action Required

You're getting **"Failed to verify admin privileges"** when uploading jobs. Here's the fastest fix:

### 🔧 Quick Fix (5 minutes)

#### Step 1: Apply Database Migration

Go to **Supabase Dashboard** → **SQL Editor** and run this migration:

```sql
-- Location: supabase/migrations/20251002083525_fix_admin_privileges_final.sql
```

Copy the entire file content and execute it in SQL Editor.

**OR** if using Supabase CLI:
```bash
cd /tmp/cc-agent/57839714/project
supabase db push
```

#### Step 2: Grant Admin Role Manually (Backup Method)

If migration doesn't work, run these queries directly:

```sql
-- Grant admin to primoboostai@gmail.com
UPDATE user_profiles
SET role = 'admin', profile_updated_at = now()
WHERE email_address = 'primoboostai@gmail.com';

UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'primoboostai@gmail.com';
```

#### Step 3: Clear Session

1. **Log out** from PrimoBoost AI
2. **Clear browser cache**: `Ctrl+Shift+Delete` → Clear cookies and cache
3. **Close all tabs**
4. **Log back in**

#### Step 4: Verify

1. Go to **Admin Panel** → **Upload Job Listing**
2. Click **"Check Admin Status"** in the debug panel at top
3. Verify you see ✅ "Admin Access Verified"

---

## Still Not Working?

### Quick Diagnostic

Run this in Supabase SQL Editor:

```sql
SELECT debug_admin_status();
```

Look for:
- `is_admin_result: true` ✅ Good
- `is_admin_result: false` ❌ Problem

If false, check the `diagnosis` field for specific issue.

### Force Admin Role

Nuclear option (use if nothing else works):

```sql
-- Force admin role in both tables
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'primoboostai@gmail.com';

  IF admin_user_id IS NOT NULL THEN
    -- Update user_profiles
    UPDATE user_profiles SET role = 'admin' WHERE id = admin_user_id;

    -- Update auth.users metadata
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
    WHERE id = admin_user_id;

    RAISE NOTICE 'Admin role forced for %', admin_user_id;
  END IF;
END $$;
```

Then **logout and login** again.

---

## Expected Result

After fix, you should see:

```
✅ Admin Access Verified
✅ Profile Role: admin
✅ Metadata Role: admin
✅ Diagnosis: Admin access verified ✅
```

Then you can upload jobs without errors!

---

## Need Help?

1. Check console logs (F12 → Console)
2. Run `SELECT debug_admin_status();` in SQL Editor
3. Take screenshot of Admin Debug Panel
4. Contact support with error details

---

## Files Changed

The fix includes:

1. **Migration**: `supabase/migrations/20251002083525_fix_admin_privileges_final.sql`
2. **Service**: `src/services/jobsService.ts` (better error messages)
3. **Component**: `src/components/admin/AdminDebugPanel.tsx` (new troubleshooting tool)
4. **Form**: `src/components/admin/JobUploadForm.tsx` (integrated debug panel)

All changes are committed and ready to use!
