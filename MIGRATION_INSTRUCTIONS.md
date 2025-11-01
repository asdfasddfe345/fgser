# Database Migration Instructions

## New Supabase Database Configuration

**Database URL**: `https://rixmudvtbfkjpwjoefon.supabase.co`
**Status**: Environment variables updated ✅

## Steps to Complete Migration

### 1. Apply All Database Migrations

You need to apply all 32 migration files to your new Supabase database. Follow these steps:

#### Option A: Using Supabase Dashboard (Recommended)

1. Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/rixmudvtbfkjpwjoefon/sql/new)

2. Copy and paste each migration file content in order (starting from oldest):

   **Run these migrations in this exact order:**

   ```
   1. supabase/migrations/20250622114242_empty_shrine.sql
   2. supabase/migrations/20250622115646_falling_bridge.sql
   3. supabase/migrations/20250629091330_bronze_beacon.sql
   4. supabase/migrations/20250629091438_late_wave.sql
   5. supabase/migrations/20250629140421_dry_shrine.sql
   6. supabase/migrations/20250629145841_flat_mode.sql
   7. supabase/migrations/20250629151647_icy_cherry.sql
   8. supabase/migrations/20250629151834_azure_coast.sql
   9. supabase/migrations/20250629153127_shrill_fog.sql
   10. supabase/migrations/20250629173816_dawn_dune.sql
   11. supabase/migrations/20250726175620_fading_bush.sql
   12. supabase/migrations/20250727215752_ivory_coral.sql
   13. supabase/migrations/20250727222742_nameless_manor.sql
   14. supabase/migrations/20250727225426_delicate_bonus.sql
   15. supabase/migrations/20250801115106_fragrant_ocean.sql
   16. supabase/migrations/20250801121617_violet_dune.sql
   17. supabase/migrations/20250805050405_late_truth.sql
   18. supabase/migrations/20250805122100_add_wallet_deduction_to_payments.sql
   19. supabase/migrations/20250908090637_floral_frog.sql
   20. supabase/migrations/20250908112542_add_job_listing_id.sql
   21. supabase/migrations/20250926073326_cool_union.sql
   22. supabase/migrations/20250926075006_proud_harbor.sql
   23. supabase/migrations/20250926075013_twilight_torch.sql
   24. supabase/migrations/20250928013057_nameless_frog.sql
   25. supabase/migrations/20250928013132_lucky_river.sql
   26. supabase/migrations/20251002000001_add_job_applications_table.sql
   27. supabase/migrations/20251002053457_create_company_logos_storage.sql
   28. supabase/migrations/20251002070302_create_complete_schema_with_admin_policies.sql
   29. supabase/migrations/20251002071636_fix_admin_rls_policies.sql
   30. supabase/migrations/20251002083525_fix_admin_privileges_final.sql
   31. supabase/migrations/20251002100000_add_admin_role_system.sql
   32. supabase/migrations/20251002120000_comprehensive_admin_rls_fix.sql
   ```

3. Execute each migration by clicking "Run" button

4. Wait for success message before moving to next migration

#### Option B: Using Combined Migration File

A combined migration file has been created at `/tmp/combined_migration.sql` (5125 lines).

You can run this single file in the Supabase SQL Editor, but it's recommended to run migrations individually to catch any errors.

### 2. Verify Database Schema

After running all migrations, verify the following tables exist:

**Core Tables:**
- `user_profiles` - User profile information
- `subscriptions` - User subscription plans
- `payment_transactions` - Payment history
- `wallet_transactions` - Wallet credits and debits
- `referral_codes` - Referral system
- `job_listings` - Job postings
- `job_applications` - User job applications
- `optimized_resumes` - AI-optimized resume data
- `internship_records` - User internship experience
- `course_materials` - User certifications
- `auto_apply_logs` - Auto-apply tracking
- `manual_apply_logs` - Manual application tracking
- `device_tracking` - User device security

**Storage Buckets:**
- `company-logos` - Job company logos
- `resume-files` - User resume uploads
- `optimized-resumes` - Generated resume files

**Database Functions:**
- `is_current_user_admin()` - Check admin privileges
- `debug_admin_status()` - Admin diagnostics
- `sync_user_admin_role()` - Admin role sync
- `get_active_subscription()` - Get user subscription
- `use_optimization()` - Decrement optimization credits

### 3. Set Up Admin User

Run this SQL to set up the admin user (primoboostai@gmail.com):

```sql
-- This is already included in migration 20251002120000_comprehensive_admin_rls_fix.sql
-- But you can run it again to ensure admin is set up:

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
    -- Update auth.users metadata
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
    WHERE id = admin_user_id;

    -- Update or create user profile
    INSERT INTO user_profiles (id, full_name, email_address, role, is_active, profile_created_at, profile_updated_at)
    SELECT admin_user_id, COALESCE(raw_user_meta_data->>'name', 'Admin User'), email, 'admin', true, now(), now()
    FROM auth.users WHERE id = admin_user_id
    ON CONFLICT (id) DO UPDATE SET role = 'admin', profile_updated_at = now();

    RAISE NOTICE 'Admin role granted successfully';
  ELSE
    RAISE NOTICE 'User with email % not found. Please sign up first.', admin_email;
  END IF;
END $$;
```

### 4. Configure Storage Buckets

1. Go to [Storage](https://supabase.com/dashboard/project/rixmudvtbfkjpwjoefon/storage/buckets)

2. Ensure these buckets exist (they should be created by migrations):
   - `company-logos` (public)
   - `resume-files` (private)
   - `optimized-resumes` (private)

3. If not created, the migration `20251002053457_create_company_logos_storage.sql` should create them

### 5. Edge Functions Configuration (TODO)

Edge functions need to be deployed with the new Supabase URL. This will be handled separately.

The following edge functions exist:
- `auto-apply`
- `check-ip-restriction`
- `create-free-subscription`
- `create-order`
- `fetch-jobs`
- `generate-referral-code`
- `get-application-history`
- `optimize-resume-for-job`
- `send-redemption-email`
- `submit-job-application`
- `validate-coupon`
- `verify-payment`

### 6. Test Database Connection

After applying migrations:

1. Restart your development server
2. Visit the application
3. Try signing up with a test account
4. Check if user profile is created automatically
5. Verify database operations work correctly

## What Has Been Updated

✅ `.env` file updated with new Supabase URL and ANON_KEY
✅ All application code already uses the Supabase client from `src/lib/supabaseClient.ts`
✅ Migration instructions documented

## Next Steps

1. **YOU**: Apply all 32 migrations to the new database via Supabase Dashboard
2. **YOU**: Verify tables and functions are created
3. **YOU**: Set up admin user if not already done
4. **ME**: Test application connectivity after you confirm migrations are applied
5. **ME**: Deploy edge functions to new Supabase instance
6. **ME**: Run production build and final testing

## Verification Queries

Run these in Supabase SQL Editor to verify setup:

```sql
-- Check if all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check if functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('is_current_user_admin', 'debug_admin_status', 'sync_user_admin_role');

-- Check storage buckets
SELECT * FROM storage.buckets;

-- Check RLS policies
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Need Help?

If you encounter any errors during migration:
1. Note the exact error message
2. Check which migration file caused the issue
3. You may need to drop conflicting objects before re-running
4. Contact me with the error details for assistance
